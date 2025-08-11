const transactionModel = require("../models/orderModel");
const User = require("../models/userModel");
const axios = require("axios");
const settingsModel = require("../models/settings_model");
const orderModel = require("../models/orderModel");

// const Razorpay = require('razorpay');
const userModel = require("../models/userModel");
// const razorpay = new Razorpay({
//     key_id: 'rzp_test_HjGAinZNMpVBaE',
//     key_secret: 'nAffDZ365JRyOoI9yR0OOd2t',
// });

async function fetchLiveGoldPriceINR() {
  try {
    const response = await axios.get("https://www.goldapi.io/api/XAU/INR", {
      headers: {
        "x-access-token": "goldapi-4y761smdi9d802-io", // move to process.env in production
        "Content-Type": "application/json",
      },
    });

    // GoldAPI returns price in troy ounces; convert to grams
    if (response.data && response.data.price) {
      const pricePerOunce = parseFloat(response.data.price);
      const pricePerGram = +(pricePerOunce / 31.1035).toFixed(2); // 1 oz = 31.1035 g
      return pricePerGram;
    }
  } catch (err) {
    console.error("Error fetching gold price:", err.message);
  }
  return null; // fallback if API fails
}
const depositINR = async (req, res) => {
  const amount = req.body.amount;
  const userId = req.user.id;
  try {
    const options = {
      amount: amount,
      currency: "INR",
      receipt: "order_receipt23",
    };
    // await razorpay.orders.create(options, async (err, result) => {
    //     if (err) res.status(201).json({ status: false, message: err });

    //     if (result) {
    //         console.log(result);
    //         const user = await userModel.findById({ _id: userId });
    //         const updatedBalance = +user.balanceINR + +result.amount;

    //         await userModel.findByIdAndUpdate({ _id: userId }, { balanceINR: updatedBalance })
    //         await transactionModel.create({ userId, transactionType: "Deposit", asset: result.currency, amount: result.amount, hash: result.id })
    //         res.status(200).json({ status: true, message: result })
    //     };
    // })
  } catch (error) {
    res.status(500).json({ status: false, message: error });
  }
};

const withdrawINR = async (req, res) => {
  console.log(req.body);
};
const buyOrSellGold = async (req, res) => {
  // const userId = req.user.id;
  const userId = "6895539eb12327731f85535f";
  const {
    orderType, // "buy" or "sell"
    transactionType, // "gold"
    product, // e.g., "Gold 24K"
    qty, // optional for buy
    Payment_method,
    amount, // INR total for buy/sell
  } = req.body;

  try {
    const user = await userModel.findById(userId);
    console.log(user);

    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    // Get GST rate from DB
    // const settings = await settingsModel.findOne({});
    // const gstRate = settings?.goldGSTRate || 0.03;
    const gstRate = 0.03;
    // Get live gold price per gram in INR
    const livePrice = await fetchLiveGoldPriceINR();
    console.log("liver price:", livePrice);
    const goldPrice = livePrice || 7200; // fallback price

    // GST & net amount
    const gstAmount = +(amount * gstRate).toFixed(2);
    const netAmount = +(amount - gstAmount).toFixed(2);

    if (orderType === "buy") {
      const goldQty = +(netAmount / goldPrice).toFixed(4);

      if (user.balanceINR < amount) {
        return res
          .status(400)
          .json({ status: false, message: "Insufficient INR balance" });
      }

      // const newGoldBalance = (+user.goldBalance + goldQty).toFixed(2);
      const newGoldBalance = Number(user.goldBalance) + goldQty;
      const newINRBalance = (+user.balanceINR - amount).toFixed(2);
      console.log(
        "liver price:",
        user.goldBalance,
        user.balanceINR,
        newGoldBalance,
        newINRBalance
      );

      await userModel.findByIdAndUpdate(userId, {
        goldBalance: newGoldBalance.toString(),
        balanceINR: newINRBalance,
      });

      await transactionModel.create({
        userId,
        orderId: `ORD-${Date.now()}`,
        orderType,
        transactionType,
        gst_value: gstAmount.toString(),
        product,
        price: goldPrice.toString(),
        qty: goldQty.toString(),
        Payment_method,
        amount: amount.toString(),
        status: "completed",
      });

      return res.status(201).json({
        status: true,
        message: `Bought ${goldQty}g gold for ₹${amount} (₹${gstAmount} GST applied)`,
        goldBalance: newGoldBalance,
        balanceINR: newINRBalance,
      });
    } else if (orderType === "sell") {
      const goldQty = +(amount / goldPrice).toFixed(4);

      if (user.goldBalance < goldQty) {
        return res
          .status(400)
          .json({ status: false, message: "Insufficient gold balance" });
      }

      const receivedAmount = netAmount;

      const newGoldBalance = (+user.goldBalance - goldQty).toFixed(4);
      const newINRBalance = (+user.balanceINR + receivedAmount).toFixed(2);

      await userModel.findByIdAndUpdate(userId, {
        goldBalance: newGoldBalance,
        balanceINR: newINRBalance,
      });

      await transactionModel.create({
        userId,
        orderId: `ORD-${Date.now()}`,
        orderType,
        transactionType,
        gst_value: gstAmount.toString(),
        product,
        price: goldPrice.toString(),
        qty: goldQty.toString(),
        Payment_method,
        amount: receivedAmount.toString(),
        status: "completed",
      });
      // user.goldBalance = (user.goldBalance || 0) - goldQty;
      // await user.save();
      return res.status(201).json({
        status: true,
        message: `Sold ${goldQty}g gold for ₹${receivedAmount} (₹${gstAmount} GST deducted)`,
        goldBalance: newGoldBalance,
        balanceINR: newINRBalance,
      });
    } else {
      return res
        .status(400)
        .json({ status: false, message: "Invalid order type" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: error.message });
  }
};

// const orderHistoy = async (req, res) => {
//     // const orderID = req.body.orderID;
//    try {

//     //    console.log("orderID:",orderID);
//        try {
//            const orderHistoryData = await orderSchema.find({});
//         //    if (!user || user === null || user === undefined) {
//         //        // res.status(404).json({ message: "Not found", details: user });
//         //        res.status(404);
//         //        throw new Error("Not found ");
//         //    }

//            res.status(200).json({ message: "success", details: orderHistoryData });
//        } catch (error) {

//            res.status(500).json(error);
//        }

//         // res.status(200).json({ status: true, details: `My ${userAddress} balance ${bal}` })
//     } catch (error) {

//         res.status(404).json({ status: true, details: `My balance ${error}` })
//     }
// }

// const getSingleUserOrderHistory = async (req, res) => {
//     const userId = req.user.id;
//     if (!userId || userId === undefined || userId == null) {
//         res.status(400);
//         throw new Error(error);
//     }
//     try {
//         const history = await orderModel.find({
//             orderId: orderID
//         })
//         console.log(history);
//         res.status(200).json({ status: true, details: history })

//     } catch (error) {
//         res.status(400).json({ status: false, details: `${error.message}` });

//     }
// }
// ==========================
// 1. ALL ORDER HISTORY
// ==========================
const getAllOrderHistory = async (req, res) => {
  try {
    const orders = await orderModel.find({});
    res.status(200).json({
      status: true,
      message: "All order history fetched successfully",
      details: orders,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

// ==========================
// 2. SINGLE USER ORDER HISTORY
// ==========================
const getUserOrderHistory = async (req, res) => {
  try {
    // const userId = req.user?.id;
    const userId = "6895539eb12327731f85535f";

    if (!userId) {
      return res
        .status(400)
        .json({ status: false, message: "User ID missing" });
    }

    const orders = await orderModel.find({ userId });
    res.status(200).json({
      status: true,
      message: "User order history fetched successfully",
      details: orders,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

// ==========================
// 3. PARTICULAR ORDER HISTORY
// ==========================
const getParticularOrderHistory = async (req, res) => {
  try {
    
    console.log("order",req.body)
    const { orderId } = req.body;

    console.log("order",orderId)
    if (!orderId) {
      return res
        .status(400)
        .json({ status: false, message: "Order ID missing" });
    }

    const order = await orderModel.findOne({ orderId });
    if (!order) {
      return res
        .status(404)
        .json({ status: false, message: "Order not found" });
    }

    res.status(200).json({
      status: true,
      message: "Order details fetched successfully",
      details: order,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
};

module.exports = {
  buyOrSellGold,
  getAllOrderHistory,
  getUserOrderHistory,
  getParticularOrderHistory,
  depositINR,
  withdrawINR,
};
