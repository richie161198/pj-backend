const Shipment = require("../models/shipment_model");
const ProductOrder = require("../models/commerce_order_model");
const User = require("../models/userModel");
const bvcService = require("../services/bvcService");
const mongoose = require("mongoose");

/**
 * Shipment Controller
 * Handles all shipment-related operations with BVC integration
 */

// Flag to track if index fix has been attempted
let indexFixAttempted = false;

/**
 * Fix problematic trackingNumber_1 index if it exists
 * This handles legacy index that causes duplicate key errors
 */
const fixTrackingNumberIndex = async () => {
  if (indexFixAttempted) return;
  indexFixAttempted = true;
  
  try {
    const collection = mongoose.connection.db.collection('shipments');
    const indexes = await collection.indexes();
    const hasProblematicIndex = indexes.some(idx => idx.name === 'trackingNumber_1');
    
    if (hasProblematicIndex) {
      console.log('⚠️  Found problematic trackingNumber_1 index, dropping...');
      await collection.dropIndex('trackingNumber_1');
      console.log('✅ Successfully dropped trackingNumber_1 index');
    }
  } catch (error) {
    // Index might not exist, which is fine
    if (!error.message.includes('index not found')) {
      console.warn('Warning fixing index:', error.message);
    }
  }
};


const createShipment = async (req, res) => {
  try {
    // Fix problematic index on first call
    await fixTrackingNumberIndex();
    
    const { orderCode } = req.body;
    const userId = req.user?.id || req.user?.user?.id;

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        error: "Order code is required",
      });
    }

    // Find the order
    const order = await ProductOrder.findOne({ orderCode })
      .populate("user", "name email phone")
      .populate("items.productDataid", "name productCode");

    if (!order) {
      return res.status(404).json({
        success: false,
        error: "Order not found",
      });
    }

    // Check if shipment already exists for this order
    const existingShipment = await Shipment.findOne({ orderCode });
    if (existingShipment) {
      return res.status(200).json({
        success: true,
        message: "Shipment already exists",
        shipment: existingShipment,
      });
    }

    // Parse delivery address
    let deliveryAddress = {};
    try {
      deliveryAddress =
        typeof order.deliveryAddress === "string"
          ? JSON.parse(order.deliveryAddress)
          : order.deliveryAddress || {};
    } catch (e) {
      deliveryAddress = { addressLine1: order.deliveryAddress || "N/A" };
    }

    // Prepare items for BVC
    const items = (order.items || []).map((item) => ({
      productId: item.productDataid?._id,
      productName: item.productDataid?.name || "Product",
      productCode: item.productDataid?.productCode || "PROD",
      quantity: item.quantity || 1,
      price: item.price || 0,
    }));

    // Create shipment with BVC
    const bvcResponse = await bvcService.createShipment({
      orderCode: order.orderCode,
      customerName: deliveryAddress.name || order.user?.name || "Customer",
      customerPhone: deliveryAddress.phone || order.user?.phone || "0000000000",
      customerEmail: order.user?.email,
      deliveryAddress: {
        addressLine1: deliveryAddress.street || deliveryAddress.addressLine1 || "N/A",
        addressLine2: deliveryAddress.landmark || deliveryAddress.addressLine2 || "",
        city: deliveryAddress.city || "N/A",
        state: deliveryAddress.state || "N/A",
        pincode: deliveryAddress.pincode || "000000",
      },
      items: items,
      totalAmount: order.totalAmount,
      codAmount: 0, // Prepaid orders
      weight: 0.5,
      packageCount: 1,
    });

    // Create shipment record in database
    const shipment = new Shipment({
      orderId: order._id,
      orderCode: order.orderCode,
      userId: order.user?._id || order.user,
      bvcOrderNo: bvcResponse.orderNo,
      docketNo: bvcResponse.docketNo,
      awbNo: bvcResponse.docketNo,
      status: bvcResponse.success ? "CREATED" : "PENDING",
      bvcStatus: bvcResponse.success ? "Order Created" : "Failed",
      customerName: deliveryAddress.name || order.user?.name || "Customer",
      customerPhone: deliveryAddress.phone || order.user?.phone || "0000000000",
      customerEmail: order.user?.email,
      deliveryAddress: {
        addressLine1: deliveryAddress.street || deliveryAddress.addressLine1 || "N/A",
        addressLine2: deliveryAddress.landmark || deliveryAddress.addressLine2 || "",
        city: deliveryAddress.city || "N/A",
        state: deliveryAddress.state || "N/A",
        pincode: deliveryAddress.pincode || "000000",
        landmark: deliveryAddress.landmark || "",
      },
      packageDetails: {
        weight: 0.5,
        noOfPieces: 1,
      },
      items: items,
      paymentMode: "PREPAID",
      totalAmount: order.totalAmount,
      serviceType: "Express",
      trackingHistory: [
        {
          status: bvcResponse.success ? "Shipment Created" : "Creation Failed",
          statusCode: bvcResponse.success ? "SC" : "SF",
          description: bvcResponse.message || bvcResponse.error || "Shipment initiated",
          timestamp: new Date(),
          updatedBy: "System",
        },
      ],
      bvcCreateResponse: bvcResponse.rawResponse,
    });

    await shipment.save();

    // Update order with shipment reference
    order.shipmentId = shipment._id;
    if (bvcResponse.success) {
      order.status = "CONFIRMED";
    }
    await order.save();

    console.log(`✅ Shipment created for order ${orderCode}:`, shipment.docketNo);

    res.status(201).json({
      success: true,
      message: bvcResponse.success
        ? "Shipment created successfully"
        : "Shipment record created but BVC upload failed",
      shipment: {
        _id: shipment._id,
        orderCode: shipment.orderCode,
        docketNo: shipment.docketNo,
        awbNo: shipment.awbNo,
        status: shipment.status,
        bvcStatus: shipment.bvcStatus,
      },
      bvcSuccess: bvcResponse.success,
    });
  } catch (error) {
    console.error("❌ Create Shipment Error:", error);
    
    // Handle duplicate key error (legacy trackingNumber index)
    if (error.code === 11000 && error.message.includes('trackingNumber')) {
      console.log('⚠️  Duplicate key error detected, attempting to fix index...');
      
      try {
        // Force fix the index
        indexFixAttempted = false;
        await fixTrackingNumberIndex();
        
        // Return a more helpful error
        return res.status(409).json({
          success: false,
          error: "Database index conflict detected. Please retry the operation.",
          retryable: true,
        });
      } catch (fixError) {
        console.error('Failed to fix index:', fixError);
      }
    }
    
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};


const trackShipmentByOrder = async (req, res) => {
  try {
    const { orderCode } = req.body;

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        error: "Order code is required",
      });
    }

    // Find shipment
    const shipment = await Shipment.findOne({ orderCode });
    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: "Shipment not found for this order",
      });
    }

    // If no docket number, return current status
    if (!shipment.docketNo) {
      return res.status(200).json({
        success: true,
        data: {
          orderCode: shipment.orderCode,
          status: shipment.status,
          orderStatus: shipment.status,
          statusLabel: "Shipment Pending",
          trackingHistory: shipment.trackingHistory,
        },
      });
    }

    // Track with BVC
    try {
      const trackingData = await bvcService.trackShipment(shipment.docketNo);

      // Update shipment with latest tracking data
      shipment.bvcStatus = trackingData.status;
      shipment.bvcTrackingCode = trackingData.statusCode;
      shipment.status = trackingData.orderStatus;
      shipment.ndrReason = trackingData.ndrReason;

      // Update tracking history if new entries
      if (trackingData.trackingHistory && trackingData.trackingHistory.length > 0) {
        // Add new tracking entries
        trackingData.trackingHistory.forEach((entry) => {
          const exists = shipment.trackingHistory.some(
            (h) => h.statusCode === entry.statusCode && h.city === entry.city
          );
          if (!exists) {
            shipment.trackingHistory.push({
              status: entry.status,
              statusCode: entry.statusCode,
              city: entry.city,
              timestamp: entry.timestamp,
              updatedBy: "BVC System",
            });
          }
        });
      }

      shipment.bvcTrackResponse = trackingData.rawResponse;
      await shipment.save();

      // Update order status if needed
      const order = await ProductOrder.findOne({ orderCode });
      if (order && trackingData.orderStatus === "DELIVERED" && order.status !== "DELIVERED") {
        order.status = "DELIVERED";
        await order.save();
      }

      res.status(200).json({
        success: true,
        data: {
          orderCode: shipment.orderCode,
          docketNo: shipment.docketNo,
          status: trackingData.status,
          orderStatus: trackingData.orderStatus,
          statusLabel: bvcService.getStatusLabel(trackingData.status),
          deliveryType: trackingData.deliveryType,
          destinationCity: trackingData.destinationCity,
          receiverName: trackingData.receiverName,
          trackingHistory: trackingData.trackingHistory,
          ndrReason: trackingData.ndrReason,
        },
      });
    } catch (trackError) {
      // Return cached data if BVC tracking fails
      res.status(200).json({
        success: true,
        data: {
          orderCode: shipment.orderCode,
          docketNo: shipment.docketNo,
          status: shipment.bvcStatus || shipment.status,
          orderStatus: shipment.status,
          statusLabel: bvcService.getStatusLabel(shipment.bvcStatus),
          trackingHistory: shipment.trackingHistory,
          cached: true,
        },
      });
    }
  } catch (error) {
    console.error("❌ Track Shipment Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Track shipment by docket/AWB number
 * GET /api/v0/shipments/track/:docketNo
 */
const trackShipmentByDocket = async (req, res) => {
  try {
    const { docketNo } = req.params;

    if (!docketNo) {
      return res.status(400).json({
        success: false,
        error: "Docket number is required",
      });
    }

    const trackingData = await bvcService.trackShipment(docketNo);

    res.status(200).json({
      success: true,
      data: trackingData,
    });
  } catch (error) {
    console.error("❌ Track Docket Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get user's shipments list
 * GET /api/v0/shipments/user/shipments
 */
const getUserShipments = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.user?.id;
    const { page = 1, limit = 10, status } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
      });
    }

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [shipments, total] = await Promise.all([
      Shipment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("orderId", "orderCode totalAmount status items")
        .lean(),
      Shipment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        shipments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("❌ Get User Shipments Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get shipment by order ID
 * GET /api/v0/shipments/order/:orderId
 */
const getShipmentByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const shipment = await Shipment.findOne({
      $or: [{ orderCode: orderId }, { orderId: orderId }],
    })
      .populate("orderId", "orderCode totalAmount status")
      .populate("userId", "name email phone")
      .lean();

    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: "Shipment not found",
      });
    }

    res.status(200).json({
      success: true,
      data: shipment,
    });
  } catch (error) {
    console.error("❌ Get Shipment by Order Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Get all shipments (Admin)
 * GET /api/v0/shipments
 */
const getAllShipments = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;

    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { orderCode: { $regex: search, $options: "i" } },
        { docketNo: { $regex: search, $options: "i" } },
        { customerName: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [shipments, total] = await Promise.all([
      Shipment.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .populate("orderId", "orderCode totalAmount status")
        .populate("userId", "name email phone")
        .lean(),
      Shipment.countDocuments(query),
    ]);

    res.status(200).json({
      success: true,
      data: {
        shipments,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("❌ Get All Shipments Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Create reverse/return shipment
 * POST /api/v0/shipments/return
 */
const createReturnShipment = async (req, res) => {
  try {
    const { orderCode, reason } = req.body;

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        error: "Order code is required",
      });
    }

    // Find original shipment
    const originalShipment = await Shipment.findOne({ orderCode });
    if (!originalShipment) {
      return res.status(404).json({
        success: false,
        error: "Original shipment not found",
      });
    }

    // Create reverse shipment with BVC
    const bvcResponse = await bvcService.createReverseShipment({
      requestId: `RET_${orderCode}_${Date.now()}`,
      awbNo: originalShipment.docketNo || originalShipment.awbNo,
      customerName: originalShipment.customerName,
      customerAddress: originalShipment.deliveryAddress,
      customerPincode: originalShipment.deliveryAddress?.pincode,
      customerPhone: originalShipment.customerPhone,
      weight: originalShipment.packageDetails?.weight || 0.5,
      skuDescription: "Return Order",
      value: originalShipment.totalAmount,
    });

    if (bvcResponse.success) {
      // Create return shipment record
      const returnShipment = new Shipment({
        orderId: originalShipment.orderId,
        orderCode: `RET_${orderCode}`,
        userId: originalShipment.userId,
        docketNo: bvcResponse.reverseAwbNo,
        awbNo: bvcResponse.reverseAwbNo,
        shipmentType: "RETURN",
        status: "CREATED",
        customerName: originalShipment.customerName,
        customerPhone: originalShipment.customerPhone,
        customerEmail: originalShipment.customerEmail,
        deliveryAddress: originalShipment.deliveryAddress,
        packageDetails: originalShipment.packageDetails,
        items: originalShipment.items,
        totalAmount: originalShipment.totalAmount,
        originalShipmentId: originalShipment._id,
        trackingHistory: [
          {
            status: "Return Shipment Created",
            statusCode: "RC",
            description: reason || "Return initiated",
            timestamp: new Date(),
            updatedBy: "System",
          },
        ],
      });

      await returnShipment.save();

      // Update original shipment
      originalShipment.returnShipmentId = returnShipment._id;
      originalShipment.reverseAwbNo = bvcResponse.reverseAwbNo;
      await originalShipment.save();

      res.status(201).json({
        success: true,
        message: "Return shipment created successfully",
        data: {
          returnShipmentId: returnShipment._id,
          reverseAwbNo: bvcResponse.reverseAwbNo,
        },
      });
    } else {
      res.status(400).json({
        success: false,
        error: bvcResponse.error || "Failed to create return shipment",
      });
    }
  } catch (error) {
    console.error("❌ Create Return Shipment Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Cancel shipment
 * POST /api/v0/shipments/cancel
 */
const cancelShipment = async (req, res) => {
  try {
    const { orderCode, reason } = req.body;

    if (!orderCode) {
      return res.status(400).json({
        success: false,
        error: "Order code is required",
      });
    }

    // Find shipment
    const shipment = await Shipment.findOne({ orderCode });
    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: "Shipment not found",
      });
    }

    // Check if shipment can be cancelled
    const nonCancellableStatuses = ["DELIVERED", "CANCELLED", "RTO_DELIVERED"];
    if (nonCancellableStatuses.includes(shipment.status)) {
      return res.status(400).json({
        success: false,
        error: `Shipment cannot be cancelled. Current status: ${shipment.status}`,
      });
    }

    // Cancel with BVC if docket exists
    if (shipment.docketNo) {
      const bvcResponse = await bvcService.cancelShipment(
        shipment.docketNo,
        reason || "Customer requested cancellation"
      );

      if (!bvcResponse.success) {
        console.warn("BVC cancellation warning:", bvcResponse.error);
        // Continue with local cancellation even if BVC fails
      }
    }

    // Update shipment status
    shipment.status = "CANCELLED";
    shipment.cancelReason = reason || "Customer requested cancellation";
    shipment.cancelledAt = new Date();
    shipment.trackingHistory.push({
      status: "Shipment Cancelled",
      statusCode: "CAN",
      description: reason || "Customer requested cancellation",
      timestamp: new Date(),
      updatedBy: "User",
    });

    await shipment.save();

    // Update order status
    const order = await ProductOrder.findOne({ orderCode });
    if (order) {
      order.status = "CANCELLED";
      await order.save();
    }

    res.status(200).json({
      success: true,
      message: "Shipment cancelled successfully",
      data: {
        orderCode: shipment.orderCode,
        status: shipment.status,
        cancelledAt: shipment.cancelledAt,
      },
    });
  } catch (error) {
    console.error("❌ Cancel Shipment Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Update shipment status (Admin)
 * PUT /api/v0/shipments/:id/status
 */
const updateShipmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, description } = req.body;

    const shipment = await Shipment.findById(id);
    if (!shipment) {
      return res.status(404).json({
        success: false,
        error: "Shipment not found",
      });
    }

    shipment.status = status;
    shipment.trackingHistory.push({
      status: status,
      statusCode: status.substring(0, 3).toUpperCase(),
      description: description || `Status updated to ${status}`,
      timestamp: new Date(),
      updatedBy: "Admin",
    });

    // Update special dates
    if (status === "DELIVERED") {
      shipment.deliveredAt = new Date();
    } else if (status === "PICKED_UP") {
      shipment.pickedUpAt = new Date();
    }

    await shipment.save();

    // Sync order status
    const order = await ProductOrder.findById(shipment.orderId);
    if (order) {
      if (status === "DELIVERED") order.status = "DELIVERED";
      else if (status === "SHIPPED" || status === "IN_TRANSIT") order.status = "SHIPPED";
      await order.save();
    }

    res.status(200).json({
      success: true,
      message: "Shipment status updated",
      data: shipment,
    });
  } catch (error) {
    console.error("❌ Update Shipment Status Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

/**
 * Sync all pending shipments with BVC (Cron job)
 * POST /api/v0/shipments/sync
 */
const syncShipments = async (req, res) => {
  try {
    const pendingShipments = await Shipment.find({
      status: { $nin: ["DELIVERED", "CANCELLED", "RTO_DELIVERED"] },
      docketNo: { $exists: true, $ne: null },
    }).limit(50);

    const results = [];

    for (const shipment of pendingShipments) {
      try {
        const trackingData = await bvcService.trackShipment(shipment.docketNo);

        shipment.bvcStatus = trackingData.status;
        shipment.status = trackingData.orderStatus;
        shipment.bvcTrackResponse = trackingData.rawResponse;

        await shipment.save();

        results.push({
          orderCode: shipment.orderCode,
          status: "synced",
          newStatus: trackingData.orderStatus,
        });
      } catch (syncError) {
        results.push({
          orderCode: shipment.orderCode,
          status: "error",
          error: syncError.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Synced ${results.filter((r) => r.status === "synced").length} shipments`,
      results,
    });
  } catch (error) {
    console.error("❌ Sync Shipments Error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

module.exports = {
  createShipment,
  trackShipmentByOrder,
  trackShipmentByDocket,
  getUserShipments,
  getShipmentByOrder,
  getAllShipments,
  createReturnShipment,
  cancelShipment,
  updateShipmentStatus,
  syncShipments,
};

