const axios = require("axios");
const Subscription = require("../models/subscription_model");
const User = require("../models/userModel");

// PhonePe Autopay Configuration
const PHONEPE_CONFIG = {
  // Production
  baseUrl: process.env.PHONEPE_ENV === 'PRODUCTION' 
    ? "https://api.phonepe.com/apis/pg" 
    : "https://api-preprod.phonepe.com/apis/pg-sandbox",
  tokenUrl: process.env.PHONEPE_ENV === 'PRODUCTION'
    ? "https://api.phonepe.com/apis/identity-manager/v1/oauth/token"
    : "https://api-preprod.phonepe.com/apis/pg-sandbox/v1/oauth/token",
  clientId: process.env.PHONEPE_AUTOPAY_CLIENT_ID || "TEST-M23HLKE4QF87Z_25102",
  clientSecret: process.env.PHONEPE_AUTOPAY_CLIENT_SECRET || "Y2E1NWFhOGQtZjQ1YS00MjNmLThiZDYtYjA1NjlhMWUwOTVl",
  merchantId: process.env.PHONEPE_MERCHANT_ID || "M23HLKE4QF87Z",
};

/**
 * Generate PhonePe OAuth Access Token
 */
const generateAuthToken = async () => {
  try {
    const params = new URLSearchParams({
      client_id: PHONEPE_CONFIG.clientId,
      client_secret: PHONEPE_CONFIG.clientSecret,
      grant_type: "client_credentials",
      client_version: "1",
    });

    const response = await axios.post(PHONEPE_CONFIG.tokenUrl, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    console.log("✅ PhonePe Auth Token Generated ");
    return response.data.access_token;
  } catch (error) {
    console.error("❌ PhonePe Auth Token Error:", error.response?.data || error.message);
    throw new Error("Failed to generate PhonePe auth token");
  }
};

/**
 * Get Auth Token (API Endpoint)
 */
const getAuthToken = async (req, res) => {
  try {
    const token = await generateAuthToken();
    res.status(200).json({
      success: true,
      access_token: token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to generate auth token",
      error: error.message,
    });
  }
};

/**
 * Setup Subscription (Create Mandate)
 * This creates a UPI AutoPay mandate with the customer
 */
const setupSubscription = async (req, res) => {

  console.log("api called");
  try {
    const userId = req.user.id;
    const {
      amount,
      maxAmount,
      frequency = "ON_DEMAND",
      subscriptionName = "Precious Goldsmith AutoPay",
      vpa, // UPI VPA for UPI_COLLECT
      targetApp = "com.phonepe.app", // For UPI_INTENT
      paymentMode = "UPI_INTENT", // UPI_INTENT or UPI_COLLECT
      authWorkflowType = "TRANSACTION", // TRANSACTION or PENNY_DROP
      amountType = "FIXED", // FIXED or VARIABLE
      subscriptionExpiry, // Optional: subscription end date
    } = req.body;

    // Validate required fields
    if (!amount) {
      return res.status(400).json({
        success: false,
        message: "Amount is required",
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Generate unique IDs
    const merchantOrderId = `MO_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const merchantSubscriptionId = `SUB_${userId}_${Date.now()}`;


    console.log(merchantOrderId,"sddsd")
    // Get auth token
    const accessToken = await generateAuthToken();

console.log("accessToken",accessToken);
    // Calculate expiry (default: 1 year from now)
    const defaultExpiry = Date.now() + 365 * 24 * 60 * 60 * 10000;
    const subscriptionExpireAt = subscriptionExpiry 
      ? new Date(subscriptionExpiry).getTime() 
      : defaultExpiry;

    // Build payment mode config
    let paymentModeConfig;
    if (paymentMode === "UPI_COLLECT" && vpa) {
      paymentModeConfig = {
        type: "UPI_COLLECT",
        details: {
          type: "VPA",
          vpa: vpa,
        },
      };
    } else {
      paymentModeConfig = {
        type: "UPI_INTENT",
        targetApp: targetApp,
      };
    }

    // const amountInPaise = Math.round(amount * 100);
    // const calculatedMaxAmount = amountType === "FIXED" 
    //   ? amountInPaise  // FIXED: maxAmount must equal amount
    //   : Math.round((maxAmount || amount * 10) * 100); // VARIABLE: use provided or 10x

    // Build request payload
    const payload = {
      merchantOrderId,
      // amount: amountInPaise,
      amount: amount*100,
      expireAt: Date.now() + 60 * 60 * 1000, // Order expires in 1 hour
      metaInfo: {
        udf1: userId,
        udf2: subscriptionName,
        udf3: user.email || "",
        udf4: user.phone || "",
        udf5: "PreciousGoldsmith",
      },
      paymentFlow: {
        type: "SUBSCRIPTION_SETUP",
        merchantSubscriptionId,
        authWorkflowType,
        // amountType,
        amountType,
        // maxAmount: calculatedMaxAmount,
        maxAmount: amount*100,
        frequency,
        expireAt: subscriptionExpireAt,
        paymentMode: paymentModeConfig,
      },
    };

    // Add device context for UPI_INTENT
    if (paymentMode === "UPI_INTENT") {
      payload.deviceContext = {
        deviceOS: req.body.deviceOS || "ANDROID",
      };
    }

    console.log("📤 PhonePe Subscription Setup Payload:", JSON.stringify(payload, null, 2));

    // Make API request to PhonePe
    const response = await axios.post(
      `${PHONEPE_CONFIG.baseUrl}/subscriptions/v2/setup`,
      payload,
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ PhonePe Subscription Setup Response:", response.data);

    // Save subscription to database
    const subscription = new Subscription({
      userId,
      merchantSubscriptionId,
      merchantOrderId,
      subscriptionName,
      amount: amount,
      // maxAmount: maxAmount || amount * 10,
      maxAmount: amount,
      frequency,
      amountType,
      status: "PENDING",
      phonepeOrderId: response.data.orderId,
      expiresAt: new Date(subscriptionExpireAt),
      metadata: {
        authWorkflowType,
        paymentMode,
        vpa: vpa || null,
      },
    });

    await subscription.save();

    res.status(200).json({
      success: true,
      message: "Subscription setup initiated",
      data: {
        subscriptionId: merchantSubscriptionId,
        orderId: response.data.orderId,
        state: response.data.state,
        intentUrl: response.data.intentUrl,
        redirectInfo: response.data.redirectInfo,
        expireAt: response.data.expireAt,
      },
    });
  } catch (error) {
    console.error("❌ PhonePe Subscription Setup Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to setup subscription",
      error: error.response?.data || error.message,
    });
  }
};

/**
 * Check Order/Subscription Status
 */
const checkOrderStatus = async (req, res) => {
  try {
    const { merchantOrderId } = req.params;

    if (!merchantOrderId) {
      return res.status(400).json({
        success: false,
        message: "merchantOrderId is required",
      });
    }

    const accessToken = await generateAuthToken();

    const response = await axios.get(
      `${PHONEPE_CONFIG.baseUrl}/subscriptions/v2/order/${merchantOrderId}/status?details=true`,
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Order Status Response:", response.data);

    // Update subscription status in database if exists
    const subscription = await Subscription.findOne({ merchantOrderId });
    if (subscription && response.data.state) {
      // Map PhonePe status to our subscription status enum
      let mappedStatus = response.data.state.toUpperCase();
      
      // PhonePe returns "COMPLETED" when mandate setup is done, map it to "ACTIVE"
      if (mappedStatus === "COMPLETED") {
        mappedStatus = "ACTIVE";
      }
      
      // Only update if status is valid enum value
      const validStatuses = ["PENDING", "ACTIVE", "PAUSED", "REVOKED", "EXPIRED", "FAILED", "CANCELLED"];
      if (validStatuses.includes(mappedStatus)) {
        subscription.status = mappedStatus;
        
        // Update timestamps based on status
        if (mappedStatus === "ACTIVE" && !subscription.activatedAt) {
          subscription.activatedAt = new Date();
        }
        
        if (response.data.subscriptionId) {
          subscription.phonepeSubscriptionId = response.data.subscriptionId;
        }
        
        await subscription.save();
        console.log(`✅ Updated subscription ${subscription.merchantSubscriptionId} status to ${mappedStatus}`);
      } else {
        console.warn(`⚠️ Invalid status from PhonePe: ${response.data.state}, skipping update`);
      }
    }

    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("❌ Order Status Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to check order status",
      error: error.response?.data || error.message,
    });
  }
};

/**
 * Check Subscription Status
 */
const checkSubscriptionStatus = async (req, res) => {
  try {
    const { merchantSubscriptionId } = req.params;

    if (!merchantSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: "merchantSubscriptionId is required",
      });
    }

    const accessToken = await generateAuthToken();

    const response = await axios.get(
      `${PHONEPE_CONFIG.baseUrl}/subscriptions/v2/subscription/${merchantSubscriptionId}/status`,
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Subscription Status Response:", response.data);

    // Update subscription status in database
    const subscription = await Subscription.findOne({ merchantSubscriptionId });
    if (subscription && response.data.state) {
      // Map PhonePe status to our subscription status enum
      let mappedStatus = response.data.state.toUpperCase();
      
      // PhonePe returns "COMPLETED" when mandate setup is done, map it to "ACTIVE"
      if (mappedStatus === "COMPLETED") {
        mappedStatus = "ACTIVE";
      }
      
      // Only update if status is valid enum value
      const validStatuses = ["PENDING", "ACTIVE", "PAUSED", "REVOKED", "EXPIRED", "FAILED", "CANCELLED"];
      if (validStatuses.includes(mappedStatus)) {
        subscription.status = mappedStatus;
        
        // Update timestamps based on status
        if (mappedStatus === "ACTIVE" && !subscription.activatedAt) {
          subscription.activatedAt = new Date();
        } else if (mappedStatus === "PAUSED" && !subscription.pausedAt) {
          subscription.pausedAt = new Date();
        } else if ((mappedStatus === "REVOKED" || mappedStatus === "CANCELLED") && !subscription.revokedAt) {
          subscription.revokedAt = new Date();
        }
        
        await subscription.save();
        console.log(`✅ Updated subscription ${merchantSubscriptionId} status to ${mappedStatus}`);
      } else {
        console.warn(`⚠️ Invalid status from PhonePe: ${response.data.state}, skipping update`);
      }
    }

    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("❌ Subscription Status Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to check subscription status",
      error: error.response?.data || error.message,
    });
  }
};

/**
 * Notify Redemption (Pre-debit notification)
 * This notifies the customer before executing the actual debit
 */
const notifyRedemption = async (req, res) => {
  try {
    const { merchantSubscriptionId, amount, transactionNote } = req.body;

    if (!merchantSubscriptionId || !amount) {
      return res.status(400).json({
        success: false,
        message: "merchantSubscriptionId and amount are required",
      });
    }

    // Find subscription
    const subscription = await Subscription.findOne({ merchantSubscriptionId });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    const accessToken = await generateAuthToken();
    const notificationId = `NOTIFY_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const payload = {
      merchantSubscriptionId,
      notificationId,
      amount: Math.round(amount * 100), // Convert to paise
      transactionNote: transactionNote || "Precious Goldsmith AutoPay",
    };

    console.log("📤 PhonePe Notify Redemption Payload:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${PHONEPE_CONFIG.baseUrl}/subscriptions/v2/notify`,
      payload,
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Notify Redemption Response:", response.data);

    // Store notification details
    subscription.lastNotificationId = notificationId;
    subscription.lastNotificationAmount = amount;
    subscription.lastNotifiedAt = new Date();
    await subscription.save();

    res.status(200).json({
      success: true,
      message: "Redemption notification sent",
      data: {
        notificationId,
        response: response.data,
      },
    });
  } catch (error) {
    console.error("❌ Notify Redemption Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to send redemption notification",
      error: error.response?.data || error.message,
    });
  }
};

/**
 * Execute Redemption (Actual debit)
 * This executes the actual payment from the customer's bank account
 */
const executeRedemption = async (req, res) => {
  try {
    const userId = req.user.id;
    const { merchantSubscriptionId, amount, transactionNote } = req.body;

    if (!merchantSubscriptionId || !amount) {
      return res.status(400).json({
        success: false,
        message: "merchantSubscriptionId and amount are required",
      });
    }

    // Find subscription
    const subscription = await Subscription.findOne({ merchantSubscriptionId, userId });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    // Check subscription status
    if (subscription.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: `Subscription is ${subscription.status}, must be ACTIVE to execute redemption`,
      });
    }

    const accessToken = await generateAuthToken();
    const merchantOrderId = `REDEEM_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const payload = {
      merchantOrderId,
      merchantSubscriptionId,
      amount: Math.round(amount * 100), // Convert to paise
      transactionNote: transactionNote || "Precious Goldsmith AutoPay Payment",
    };

    console.log("📤 PhonePe Execute Redemption Payload:", JSON.stringify(payload, null, 2));

    const response = await axios.post(
      `${PHONEPE_CONFIG.baseUrl}/subscriptions/v2/execute`,
      payload,
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Execute Redemption Response:", response.data);

    // Store redemption details
    const redemption = {
      merchantOrderId,
      amount,
      status: response.data.state || "PENDING",
      executedAt: new Date(),
      transactionNote,
    };
    subscription.redemptions.push(redemption);
    subscription.lastRedemptionAt = new Date();
    await subscription.save();

    res.status(200).json({
      success: true,
      message: "Redemption executed",
      data: {
        merchantOrderId,
        orderId: response.data.orderId,
        state: response.data.state,
        amount: amount,
      },
    });
  } catch (error) {
    console.error("❌ Execute Redemption Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to execute redemption",
      error: error.response?.data || error.message,
    });
  }
};

const cancelSubscription =async(req,res)=>{
  try {
    const { subscriptionId, reason } = req.body;
    console.log(req.body,"req.body");

    if (!subscriptionId) {
      return res.status(400).json({ message: "subscriptionId is required" });
    }

    // Payload
    const payload = {
      merchantId: "M23HLKE4QF87Z",
      subscriptionId: subscriptionId,
      cancelReason: reason || "USER_REQUEST"
    };

    const payloadString = JSON.stringify(payload);
    const base64Payload = Buffer.from(payloadString).toString("base64");

    // Compute X-VERIFY
    const apiPath = "/v2/subscription/cancel"; // IMPORTANT (must match PhonePe spec)
    const checksumString = base64Payload + apiPath + SALT_KEY;

    const sha256 = crypto.createHash("sha256").update(checksumString).digest("hex");
    const xVerify = `${sha256}###${SALT_INDEX}`;

    // PhonePe API call
    const phonepeResponse = await axios.post(
      BASE_URL + apiPath,
      { request: base64Payload },
      {
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify
        }
      }
    );

    return res.json({
      success: true,
      message: "Autopay cancel request processed",
      phonepe: phonepeResponse.data
    });

  } catch (err) {
    console.error("Cancel Autopay V2 Error:", err?.response?.data || err);
    return res.status(500).json({
      success: false,
      message: "Failed to cancel autopay",
      error: err?.response?.data || err.message
    });
  }
}


const revokeSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { merchantSubscriptionId, forceLocal } = req.body;

    if (!merchantSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: "merchantSubscriptionId is required",
      });
    }

    // Find subscription
    const subscription = await Subscription.findOne({ merchantSubscriptionId, userId });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    // Check if already cancelled
    if (subscription.status === "CANCELLED" || subscription.status === "REVOKED") {
      return res.status(400).json({
        success: false,
        message: `Subscription is already ${subscription.status}`,
      });
    }

    // const isSandbox = !process.env.PHONEPE_ENV || process.env.PHONEPE_ENV !== 'PRODUCTION';
    
    // // In sandbox mode or if forceLocal is true, only update local database
    // if (isSandbox || forceLocal) {
    //   console.log("📤 Cancelling subscription locally (sandbox mode or forceLocal)");
      
    //   subscription.status = "CANCELLED";
    //   subscription.cancelledAt = new Date();
    //   subscription.metadata = {
    //     ...subscription.metadata,
    //     cancelledInSandbox: isSandbox,
    //     cancelledAt: new Date().toISOString(),
    //   };
    //   await subscription.save();

    //   return res.status(200).json({
    //     success: true,
    //     message: isSandbox 
    //       ? "Subscription cancelled locally (Sandbox mode - PhonePe cancel API not supported)"
    //       : "Subscription cancelled locally",
    //     localOnly: true,
    //     data: {
    //       merchantSubscriptionId,
    //       status: "CANCELLED",
    //       cancelledAt: subscription.cancelledAt,
    //     },
    //   });
    // }

  const phonepeSubscriptionId = subscription.phonepeSubscriptionId;
  console.log("phonepeSubscriptionId",phonepeSubscriptionId);

    // const hasRealPhonePeId = phonepeSubscriptionId && 
    //                          typeof phonepeSubscriptionId === 'string' &&
    //                          phonepeSubscriptionId.trim() !== "" &&
    //                          phonepeSubscriptionId !== subscription.merchantSubscriptionId;
    
    // if (!hasRealPhonePeId) {
    //   // If no real PhonePe subscription ID, cancel locally WITHOUT calling API
    //   console.log("⚠️ No valid PhonePe subscription ID found, cancelling locally");
    //   console.log("   merchantSubscriptionId:", subscription.merchantSubscriptionId);
    //   console.log("   phonepeSubscriptionId:", phonepeSubscriptionId || "null/undefined");
    //   console.log("   Status:", subscription.status);
    //   console.log("   Reason: PhonePe subscription ID is missing, invalid, or same as merchant ID");
      
    //   subscription.status = "CANCELLED";
    //   subscription.cancelledAt = new Date();
    //   subscription.metadata = {
    //     ...subscription.metadata,
    //     cancelledLocally: true,
    //     reason: "No valid PhonePe subscription ID available - subscription may not be fully activated yet",
    //     cancelledAt: new Date().toISOString(),
    //   };
    //   await subscription.save();
      
    //   return res.status(200).json({
    //     success: true,
    //     message: "Subscription cancelled locally (No valid PhonePe subscription ID - subscription may not be fully activated)",
    //     localOnly: true,
    //     data: {
    //       merchantSubscriptionId,
    //       status: "CANCELLED",
    //       cancelledAt: subscription.cancelledAt,
    //     },
    //   });
    // }

    // Only call PhonePe API if we have a valid PhonePe subscription ID
    const accessToken = await generateAuthToken();

    console.log("accessToken",accessToken)
    console.log("📤 PhonePe Cancel Subscription (via PhonePe API)");
    console.log("   merchantSubscriptionId:", merchantSubscriptionId);
    console.log("   phonepeSubscriptionId:", phonepeSubscriptionId);

    const response = await axios.post(
      `${PHONEPE_CONFIG.baseUrl}/subscriptions/v2/${merchantSubscriptionId}/cancel`,
      {},
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Cancel Subscription Response:", response.data);

    // Update subscription status
    subscription.status = "CANCELLED";
    subscription.cancelledAt = new Date();
    await subscription.save();

    res.status(200).json({
      success: true,
      message: "Subscription cancelled successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("❌ Cancel Subscription Error:", error.response?.data || error.message);
    
    // Check if it's a sandbox API limitation error, invalid endpoint, or bad request
    // const errorMessage = error.response?.data?.message || error.message || "";
    // const errorString = JSON.stringify(error.response?.data || error.message || "");
    // const errorCode = error.response?.status;
    
    // // Handle various PhonePe API errors that indicate the endpoint doesn't work
    // const isApiError = errorMessage.includes("Api Mapping Not Found") || 
    //                    errorMessage.includes("Not Found") ||
    //                    errorMessage.includes("Bad Request") ||
    //                    errorString.includes("Api Mapping Not Found") ||
    //                    errorCode === 404 ||
    //                    errorCode === 400;
    
    // if (isApiError) {
    //   // API endpoint not available, invalid ID, or sandbox limitation - update locally
    //   const subscription = await Subscription.findOne({ 
    //     merchantSubscriptionId: req.body.merchantSubscriptionId, 
    //     userId: req.user.id 
    //   });
      
    //   if (subscription && subscription.status !== "CANCELLED" && subscription.status !== "REVOKED") {
    //     subscription.status = "CANCELLED";
    //     subscription.cancelledAt = new Date();
    //     subscription.metadata = {
    //       ...subscription.metadata,
    //       cancelledInSandbox: true,
    //       sandboxError: errorMessage || errorString,
    //       cancelledViaFallback: true,
    //       errorCode: errorCode,
    //     };
    //     await subscription.save();
        
    //     console.log("✅ Subscription cancelled locally due to API error");
        
    //     return res.status(200).json({
    //       success: true,
    //       message: "Subscription cancelled locally (PhonePe API error - endpoint may not be available or subscription ID invalid)",
    //       localOnly: true,
    //       data: {
    //         merchantSubscriptionId: req.body.merchantSubscriptionId,
    //         status: "CANCELLED",
    //         cancelledAt: subscription.cancelledAt,
    //       },
    //     });
    //   }
    // }
    
    res.status(400).json({
      success: false,
      message: "Failed to cancel subscription",
      error: error.response?.data || error.message,
    });
  }
};

/**
 * Pause Subscription
 * API: POST /subscriptions/v2/subscription/{merchantSubscriptionId}/pause
 * 
 * NOTE: PhonePe Sandbox does not support pause API.
 */
const pauseSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { merchantSubscriptionId, forceLocal } = req.body;

    if (!merchantSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: "merchantSubscriptionId is required",
      });
    }

    const subscription = await Subscription.findOne({ merchantSubscriptionId, userId });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (subscription.status !== "ACTIVE") {
      return res.status(400).json({
        success: false,
        message: `Cannot pause subscription with status: ${subscription.status}. Must be ACTIVE.`,
      });
    }

    const isSandbox = !process.env.PHONEPE_ENV || process.env.PHONEPE_ENV !== 'PRODUCTION';
    
    // In sandbox mode or if forceLocal is true, only update local database
    if (isSandbox || forceLocal) {
      console.log("📤 Pausing subscription locally (sandbox mode or forceLocal)");
      
      subscription.status = "PAUSED";
      subscription.pausedAt = new Date();
      subscription.metadata = {
        ...subscription.metadata,
        pausedInSandbox: isSandbox,
      };
      await subscription.save();

      return res.status(200).json({
        success: true,
        message: isSandbox 
          ? "Subscription paused locally (Sandbox mode - PhonePe pause API not supported)"
          : "Subscription paused locally",
        localOnly: true,
        data: {
          merchantSubscriptionId,
          status: "PAUSED",
          pausedAt: subscription.pausedAt,
        },
      });
    }

    // PhonePe API requires phonepeSubscriptionId (their ID), NOT merchantSubscriptionId (our ID)
    const phonepeSubscriptionId = subscription.phonepeSubscriptionId;
    const hasRealPhonePeId = phonepeSubscriptionId && 
                             phonepeSubscriptionId !== subscription.merchantSubscriptionId &&
                             phonepeSubscriptionId.trim() !== "";
    
    if (!hasRealPhonePeId) {
      // If no real PhonePe subscription ID, pause locally
      console.log("⚠️ No PhonePe subscription ID found, pausing locally");
      subscription.status = "PAUSED";
      subscription.pausedAt = new Date();
      subscription.metadata = {
        ...subscription.metadata,
        pausedLocally: true,
        reason: "No PhonePe subscription ID available - subscription may not be fully activated yet",
      };
      await subscription.save();
      
      return res.status(200).json({
        success: true,
        message: "Subscription paused locally (No PhonePe subscription ID)",
        localOnly: true,
        data: {
          merchantSubscriptionId,
          status: "PAUSED",
        },
      });
    }

    const accessToken = await generateAuthToken();

    console.log("📤 PhonePe Pause Subscription");
    console.log("   merchantSubscriptionId:", merchantSubscriptionId);
    console.log("   phonepeSubscriptionId:", phonepeSubscriptionId);

    const response = await axios.post(
      `${PHONEPE_CONFIG.baseUrl}/subscriptions/v2/subscription/${phonepeSubscriptionId}/pause`,
      {},
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Pause Subscription Response:", response.data);

    subscription.status = "PAUSED";
    subscription.pausedAt = new Date();
    await subscription.save();

    res.status(200).json({
      success: true,
      message: "Subscription paused successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("❌ Pause Subscription Error:", error.response?.data || error.message);
    
    // Check if it's a sandbox API limitation error
    const errorMessage = error.response?.data?.message || error.message;
    if (errorMessage.includes("Api Mapping Not Found")) {
      const subscription = await Subscription.findOne({ 
        merchantSubscriptionId: req.body.merchantSubscriptionId, 
        userId: req.user.id 
      });
      if (subscription && subscription.status === "ACTIVE") {
        subscription.status = "PAUSED";
        subscription.pausedAt = new Date();
        subscription.metadata = {
          ...subscription.metadata,
          pausedInSandbox: true,
        };
        await subscription.save();
        
        return res.status(200).json({
          success: true,
          message: "Subscription paused locally (PhonePe Sandbox does not support pause API)",
          localOnly: true,
          data: {
            merchantSubscriptionId: req.body.merchantSubscriptionId,
            status: "PAUSED",
          },
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to pause subscription",
      error: error.response?.data || error.message,
    });
  }
};

/**
 * Unpause/Resume Subscription
 * API: POST /subscriptions/v2/subscription/{merchantSubscriptionId}/resume
 * 
 * NOTE: PhonePe Sandbox does not support resume API.
 */
const unpauseSubscription = async (req, res) => {
  try {
    const userId = req.user.id;
    const { merchantSubscriptionId, forceLocal } = req.body;

    if (!merchantSubscriptionId) {
      return res.status(400).json({
        success: false,
        message: "merchantSubscriptionId is required",
      });
    }

    const subscription = await Subscription.findOne({ merchantSubscriptionId, userId });
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: "Subscription not found",
      });
    }

    if (subscription.status !== "PAUSED") {
      return res.status(400).json({
        success: false,
        message: `Cannot resume subscription with status: ${subscription.status}. Must be PAUSED.`,
      });
    }

    const isSandbox = !process.env.PHONEPE_ENV || process.env.PHONEPE_ENV !== 'PRODUCTION';
    
    // In sandbox mode or if forceLocal is true, only update local database
    if (isSandbox || forceLocal) {
      console.log("📤 Resuming subscription locally (sandbox mode or forceLocal)");
      
      subscription.status = "ACTIVE";
      subscription.pausedAt = null;
      subscription.resumedAt = new Date();
      subscription.metadata = {
        ...subscription.metadata,
        resumedInSandbox: isSandbox,
      };
      await subscription.save();

      return res.status(200).json({
        success: true,
        message: isSandbox 
          ? "Subscription resumed locally (Sandbox mode - PhonePe resume API not supported)"
          : "Subscription resumed locally",
        localOnly: true,
        data: {
          merchantSubscriptionId,
          status: "ACTIVE",
          resumedAt: subscription.resumedAt,
        },
      });
    }

    // PhonePe API requires phonepeSubscriptionId (their ID), NOT merchantSubscriptionId (our ID)
    const phonepeSubscriptionId = subscription.phonepeSubscriptionId;
    const hasRealPhonePeId = phonepeSubscriptionId && 
                             phonepeSubscriptionId !== subscription.merchantSubscriptionId &&
                             phonepeSubscriptionId.trim() !== "";
    
    if (!hasRealPhonePeId) {
      // If no real PhonePe subscription ID, resume locally
      console.log("⚠️ No PhonePe subscription ID found, resuming locally");
      subscription.status = "ACTIVE";
      subscription.pausedAt = null;
      subscription.metadata = {
        ...subscription.metadata,
        resumedLocally: true,
        reason: "No PhonePe subscription ID available - subscription may not be fully activated yet",
      };
      await subscription.save();
      
      return res.status(200).json({
        success: true,
        message: "Subscription resumed locally (No PhonePe subscription ID)",
        localOnly: true,
        data: {
          merchantSubscriptionId,
          status: "ACTIVE",
        },
      });
    }

    const accessToken = await generateAuthToken();

    console.log("📤 PhonePe Resume Subscription");
    console.log("   merchantSubscriptionId:", merchantSubscriptionId);
    console.log("   phonepeSubscriptionId:", phonepeSubscriptionId);

    const response = await axios.post(
      `${PHONEPE_CONFIG.baseUrl}/subscriptions/v2/subscription/${phonepeSubscriptionId}/resume`,
      {},
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log("✅ Resume Subscription Response:", response.data);

    subscription.status = "ACTIVE";
    subscription.pausedAt = null;
    subscription.resumedAt = new Date();
    await subscription.save();

    res.status(200).json({
      success: true,
      message: "Subscription resumed successfully",
      data: response.data,
    });
  } catch (error) {
    console.error("❌ Resume Subscription Error:", error.response?.data || error.message);
    
    // Check if it's a sandbox API limitation error
    const errorMessage = error.response?.data?.message || error.message;
    if (errorMessage.includes("Api Mapping Not Found")) {
      const subscription = await Subscription.findOne({ 
        merchantSubscriptionId: req.body.merchantSubscriptionId, 
        userId: req.user.id 
      });
      if (subscription && subscription.status === "PAUSED") {
        subscription.status = "ACTIVE";
        subscription.pausedAt = null;
        subscription.resumedAt = new Date();
        subscription.metadata = {
          ...subscription.metadata,
          resumedInSandbox: true,
        };
        await subscription.save();
        
        return res.status(200).json({
          success: true,
          message: "Subscription resumed locally (PhonePe Sandbox does not support resume API)",
          localOnly: true,
          data: {
            merchantSubscriptionId: req.body.merchantSubscriptionId,
            status: "ACTIVE",
          },
        });
      }
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to resume subscription",
      error: error.response?.data || error.message,
    });
  }
};

/**
 * Validate UPI VPA Address
 */
const validateUpiAddress = async (req, res) => {
  try {
    const { vpa } = req.body;

    if (!vpa) {
      return res.status(400).json({
        success: false,
        message: "VPA is required",
      });
    }

    const accessToken = await generateAuthToken();

    const response = await axios.post(
      `${PHONEPE_CONFIG.baseUrl}/v2/validate/upi`,
      { vpa },
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json({
      success: true,
      data: response.data,
    });
  } catch (error) {
    console.error("❌ UPI Validation Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to validate UPI address",
      error: error.response?.data || error.message,
    });
  }
};

/**
 * Get User Subscriptions
 */
const getUserSubscriptions = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const filter = { userId };
    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const subscriptions = await Subscription.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalCount = await Subscription.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        subscriptions,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalCount,
          hasNextPage: parseInt(page) < Math.ceil(totalCount / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("❌ Get Subscriptions Error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch subscriptions",
      error: error.message,
    });
  }
};

/**
 * Sync all subscription statuses from PhonePe API
 * This checks the actual status from PhonePe and updates the database
 */
const syncSubscriptionStatuses = async (req, res) => {
  try {
    const userId = req.user.id;

    // Get all user subscriptions
    const subscriptions = await Subscription.find({ userId });

    if (subscriptions.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          syncedCount: 0,
          message: "No subscriptions to sync",
        },
      });
    }

    const accessToken = await generateAuthToken();
    let syncedCount = 0;
    let errorCount = 0;

    // Check status for each subscription
    for (const subscription of subscriptions) {
      try {
        // Skip if no PhonePe subscription ID
        if (!subscription.phonepeSubscriptionId && !subscription.merchantSubscriptionId) {
          continue;
        }

        const subscriptionId = subscription.phonepeSubscriptionId || subscription.merchantSubscriptionId;

        // Call PhonePe API to get current status
        const response = await axios.get(
          `${PHONEPE_CONFIG.baseUrl}/subscriptions/v2/subscription/${subscriptionId}/status`,
          {
            headers: {
              Authorization: `O-Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        // Update subscription status if changed
        if (response.data && response.data.state) {
          // Map PhonePe status to our subscription status enum
          let mappedStatus = response.data.state.toUpperCase();
          
          // PhonePe returns "COMPLETED" when mandate setup is done, map it to "ACTIVE"
          if (mappedStatus === "COMPLETED") {
            mappedStatus = "ACTIVE";
          }
          
          // Only update if status is valid enum value
          const validStatuses = ["PENDING", "ACTIVE", "PAUSED", "REVOKED", "EXPIRED", "FAILED", "CANCELLED"];
          if (validStatuses.includes(mappedStatus)) {
            if (subscription.status !== mappedStatus) {
              console.log(`🔄 Updating subscription ${subscription.merchantSubscriptionId}: ${subscription.status} → ${mappedStatus}`);
              subscription.status = mappedStatus;
              
              // Update timestamps based on status
              if (mappedStatus === "ACTIVE" && !subscription.activatedAt) {
                subscription.activatedAt = new Date();
              } else if (mappedStatus === "PAUSED" && !subscription.pausedAt) {
                subscription.pausedAt = new Date();
              } else if ((mappedStatus === "REVOKED" || mappedStatus === "CANCELLED") && !subscription.revokedAt) {
                subscription.revokedAt = new Date();
              }
              
              await subscription.save();
              syncedCount++;
            }
          } else {
            console.warn(`⚠️ Invalid status from PhonePe for ${subscription.merchantSubscriptionId}: ${response.data.state}`);
          }
        }
      } catch (error) {
        console.error(`❌ Error syncing subscription ${subscription.merchantSubscriptionId}:`, error.message);
        errorCount++;
        // Continue with next subscription
      }
    }

    console.log(`✅ Synced ${syncedCount} subscription statuses (${errorCount} errors)`);

    res.status(200).json({
      success: true,
      data: {
        syncedCount,
        errorCount,
        totalSubscriptions: subscriptions.length,
        message: `Synced ${syncedCount} of ${subscriptions.length} subscriptions`,
      },
    });
  } catch (error) {
    console.error("❌ Sync Subscription Statuses Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to sync subscription statuses",
      error: error.message,
    });
  }
};

/**
 * Initiate Refund for a Redemption
 */
const initiateRefund = async (req, res) => {
  try {
    const { merchantOrderId, amount, reason } = req.body;

    if (!merchantOrderId || !amount) {
      return res.status(400).json({
        success: false,
        message: "merchantOrderId and amount are required",
      });
    }

    const accessToken = await generateAuthToken();
    const merchantRefundId = `REFUND_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const payload = {
      merchantOrderId,
      merchantRefundId,
      amount: Math.round(amount * 100), // Convert to paise
      reason: reason || "Customer requested refund",
    };

    const response = await axios.post(
      `${PHONEPE_CONFIG.baseUrl}/v2/refund`,
      payload,
      {
        headers: {
          Authorization: `O-Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Refund initiated successfully",
      data: {
        merchantRefundId,
        response: response.data,
      },
    });
  } catch (error) {
    console.error("❌ Refund Error:", error.response?.data || error.message);
    res.status(500).json({
      success: false,
      message: "Failed to initiate refund",
      error: error.response?.data || error.message,
    });
  }
};

/**
 * Webhook Handler for PhonePe Callbacks
 */
const handleWebhook = async (req, res) => {
  try {
    const payload = req.body;
    console.log("📥 PhonePe Webhook Received:", JSON.stringify(payload, null, 2));

    // Verify webhook signature if provided
    // const signature = req.headers['x-phonepe-signature'];
    // TODO: Implement signature verification

    const { event, data } = payload;

    switch (event) {
      case "SUBSCRIPTION_SETUP_SUCCESS":
        await handleSubscriptionSetupSuccess(data);
        break;
      case "SUBSCRIPTION_SETUP_FAILED":
        await handleSubscriptionSetupFailed(data);
        break;
      case "REDEMPTION_SUCCESS":
        await handleRedemptionSuccess(data);
        break;
      case "REDEMPTION_FAILED":
        await handleRedemptionFailed(data);
        break;
      case "SUBSCRIPTION_CANCELLED":
        await handleSubscriptionCancelled(data);
        break;
      default:
        console.log(`⚠️ Unknown webhook event: ${event}`);
    }

    res.status(200).json({ success: true, message: "Webhook processed" });
  } catch (error) {
    console.error("❌ Webhook Processing Error:", error.message);
    res.status(500).json({ success: false, message: "Webhook processing failed" });
  }
};

// Webhook Helper Functions
const handleSubscriptionSetupSuccess = async (data) => {
  const subscription = await Subscription.findOne({
    merchantSubscriptionId: data.merchantSubscriptionId,
  });
  if (subscription) {
    subscription.status = "ACTIVE";
    subscription.phonepeSubscriptionId = data.subscriptionId;
    subscription.activatedAt = new Date();
    await subscription.save();
    console.log(`✅ Subscription ${data.merchantSubscriptionId} activated`);
  }
};

const handleSubscriptionSetupFailed = async (data) => {
  const subscription = await Subscription.findOne({
    merchantSubscriptionId: data.merchantSubscriptionId,
  });
  if (subscription) {
    subscription.status = "FAILED";
    subscription.failureReason = data.errorMessage || "Setup failed";
    await subscription.save();
    console.log(`❌ Subscription ${data.merchantSubscriptionId} setup failed`);
  }
};

const handleRedemptionSuccess = async (data) => {
  const subscription = await Subscription.findOne({
    merchantSubscriptionId: data.merchantSubscriptionId,
  });
  if (subscription) {
    const redemption = subscription.redemptions.find(
      (r) => r.merchantOrderId === data.merchantOrderId
    );
    if (redemption) {
      redemption.status = "COMPLETED";
      redemption.transactionId = data.transactionId;
      await subscription.save();
    }
    console.log(`✅ Redemption ${data.merchantOrderId} completed`);
  }
};

const handleRedemptionFailed = async (data) => {
  const subscription = await Subscription.findOne({
    merchantSubscriptionId: data.merchantSubscriptionId,
  });
  if (subscription) {
    const redemption = subscription.redemptions.find(
      (r) => r.merchantOrderId === data.merchantOrderId
    );
    if (redemption) {
      redemption.status = "FAILED";
      redemption.failureReason = data.errorMessage || "Redemption failed";
      await subscription.save();
    }
    console.log(`❌ Redemption ${data.merchantOrderId} failed`);
  }
};

const handleSubscriptionCancelled = async (data) => {
  const subscription = await Subscription.findOne({
    merchantSubscriptionId: data.merchantSubscriptionId,
  });
  if (subscription) {
    subscription.status = "CANCELLED";
    subscription.cancelledAt = new Date();
    await subscription.save();
    console.log(`🚫 Subscription ${data.merchantSubscriptionId} cancelled`);
  }
};

module.exports = {
  getAuthToken,
  setupSubscription,
  checkOrderStatus,
  checkSubscriptionStatus,
  notifyRedemption,
  executeRedemption,
  revokeSubscription,
  pauseSubscription,
  unpauseSubscription,
  validateUpiAddress,
  getUserSubscriptions,
  syncSubscriptionStatuses,
  initiateRefund,
  handleWebhook,cancelSubscription
};

