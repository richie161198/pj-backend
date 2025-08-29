const axios = require("axios");
const orderModel = require("../models/orderModel");
const transactionSchema = require("../models/transcationModel");
const { Cashfree, CFEnvironment } = require("cashfree-pg");
var cashfree = new Cashfree(
  CFEnvironment.PRODUCTION,
  process.env.CASHFREE_APP_ID_prod,
  process.env.CASHFREE_SECRET_prod
);
const userModel = require("../models/userModel");


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
    //         await orderModel.create({ userId, transactionType: "Deposit", asset: result.currency, amount: result.amount, hash: result.id })
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
// const buyOrSellGold = async (req, res) => {

//     const userId = req.user.id;
//   const {
//     orderType, // "buy" or "sell"
//     transactionType, // "gold"
//     product, // e.g., "Gold 24K"
//     goldQty, // optional for buy
//     gstAmount,
//     goldPrice,
//     Payment_method,
//     inrAmount, // INR total for buy/sell
//   } = req.body;
// console.log("req.body",req.body);
//   try {
//     const user = await userModel.findById(userId);
//     console.log(user);

//     if (!user)
//       return res.status(404).json({ status: false, message: "User not found" });
// const orderId = `PGORD-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

//     // const gstRate = 0.03;
//     // // Get live gold price per gram in INR
//     // const livePrice = await fetchLiveGoldPriceINR();
//     // console.log("liver price:", livePrice);
//     // const goldPrice = livePrice || 7200; // fallback price

//     // // GST & net amount
//     // const gstAmount = +(amount * gstRate).toFixed(2);
//     // const netAmount = +(amount - gstAmount).toFixed(2);

//     if (orderType === "buy") {
//       // const goldQty = +(netAmount / goldPrice).toFixed(4);

//       // if (user.balanceINR < amount) {
//       //   return res
//       //     .status(400)
//       //     .json({ status: false, message: "Insufficient INR balance" });
//       // }

//       // const newGoldBalance = (+user.goldBalance + goldQty).toFixed(2);
//       const newGoldBalance = Number(user.goldBalance) + goldQty;
    

//       await userModel.findByIdAndUpdate(userId, {
//         goldBalance: newGoldBalance.toString(),
//         // balanceINR: newINRBalance,
//       });

//       await transactionSchema.create({
//         userId,
//         orderId: orderId,
//         orderType,
//         transactionType,
//         gst_value: gstAmount,
//         // product,
//         goldCurrentPrice: goldPrice,
//         goldQtyInGm: goldQty,
//         Payment_method,
//         inramount: inrAmount,
//         status: "created",
//       });

//       return res.status(201).json({
//         status: true,
//         message: `Bought ${goldQty}g gold for ₹${inrAmount} (₹${gstAmount} GST applied)`,
//         goldBalance: newGoldBalance,
//       });
//     } else if (orderType === "sell") {
//       // const goldQty = +(amount / goldPrice).toFixed(4);

//       if (user.goldBalance < goldQty) {
//         return res
//           .status(400)
//           .json({ status: false, message: "Insufficient gold balance" });
//       }

//       const receivedAmount = inrAmount;

//       const newGoldBalance = (+user.goldBalance - goldQty).toFixed(4);
//       const newINRBalance = Number(user.balanceINR) + Number(receivedAmount)

//       await userModel.findByIdAndUpdate(userId, {
//         goldBalance: newGoldBalance,
//         balanceINR: newINRBalance,
//       });

//       await transactionSchema.create({
//         userId,
//         orderId: orderId,
//         orderType,
//         transactionType,
//         gst_value: gstAmount,
//         // product,
//         goldCurrentPrice: goldPrice,
//         goldQtyInGm: goldQty,
//         Payment_method,
//         inramount: receivedAmount,
//         status: "created",
//       });
//       // user.goldBalance = (user.goldBalance || 0) - goldQty;
//       // await user.save();
//       return res.status(201).json({
//         status: true,
//         message: `Sold ${goldQty}g gold for ₹${receivedAmount} (₹${gstAmount} GST deducted)`,
//         goldBalance: newGoldBalance,
//         balanceINR: newINRBalance,
//       });
//     } else {
//       return res
//         .status(400)
//         .json({ status: false, message: "Invalid order type" });
//     }
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ status: false, message: error.message });
//   }
// };

const buyOrSellGold = async (req, res) => {
  const userId = req.user.id;
  const {
    orderType, // "buy" or "sell"
    transactionType, // "gold"
    product, // e.g., "Gold 24K"
    goldQty, // optional for buy
    gstAmount,
    goldPrice,
    Payment_method,
    inrAmount, // INR total for buy/sell
  } = req.body;

  try {
    const user = await userModel.findById(userId);
    if (!user)
      return res.status(404).json({ status: false, message: "User not found" });

    const orderId = `PGORD-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    // Ensure balances are numbers
    const currentGoldBalance = parseFloat(user.goldBalance) || 0;
    const currentINRBalance = parseFloat(user.balanceINR) || 0;

    if (orderType === "buy") {
      const newGoldBalance = +(currentGoldBalance + parseFloat(goldQty)).toFixed(4);

      await userModel.findByIdAndUpdate(userId, {
        goldBalance: newGoldBalance,
      });

      await transactionSchema.create({
        userId,
        orderId,
        orderType,
        transactionType,
        gst_value: parseFloat(gstAmount),
        goldCurrentPrice: parseFloat(goldPrice),
        goldQtyInGm: parseFloat(goldQty),
        Payment_method,
        inramount: parseFloat(inrAmount),
        status: "created",
      });

      return res.status(201).json({
        status: true,
        message: `Bought ${goldQty}g gold for ₹${inrAmount} (₹${gstAmount} GST applied)`,
        goldBalance: newGoldBalance,
        createdAt:Date.now(),
        orderId:orderId,
        Payment_method:Payment_method
      });
    } 
    
    else if (orderType === "sell") {
      if (currentGoldBalance < goldQty) {
        return res.status(400).json({ status: false, message: "Insufficient gold balance" });
      }

      const receivedAmount = parseFloat(inrAmount);
      const newGoldBalance = +(currentGoldBalance - parseFloat(goldQty)).toFixed(4);
      const newINRBalance = +(currentINRBalance + receivedAmount).toFixed(2);

      await userModel.findByIdAndUpdate(userId, {
        goldBalance: newGoldBalance,
        balanceINR: newINRBalance,
      });

      await transactionSchema.create({
        userId,
        orderId,
        orderType,
        transactionType,
        gst_value: parseFloat(gstAmount),
        goldCurrentPrice: parseFloat(goldPrice),
        goldQtyInGm: parseFloat(goldQty),
        Payment_method,
        inramount: receivedAmount,
        status: "created",
      });

      return res.status(201).json({
        status: true,
        message: `Sold ${goldQty}g gold for ₹${receivedAmount} (₹${gstAmount} GST deducted)`,
        goldBalance: newGoldBalance,
        balanceINR: newINRBalance,
        createdAt:Date.now(),
        orderId:orderId,
        Payment_method:Payment_method

      });
    } 
    
    else {
      return res.status(400).json({ status: false, message: "Invalid order type" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: false, message: error.message });
  }
};

const getAllOrderHistory = async (req, res) => {
  try {
    const orders = await transactionSchema.find({});
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
    const userId = req.user.id;
    // const userId = "6895539eb12327731f85535f";

    if (!userId) {
      return res
        .status(400)
        .json({ status: false, message: "User ID missing" });
    }

    const orders = await transactionSchema.find({ userId });
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

const createOrder = async (req, res) => {
  console.log("sddsds", req.body);
    const { order_amount } = req.body;
   const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  try {
    var request = {
      order_amount: order_amount,
      order_currency: "INR",
      order_id: orderId,
      customer_details: {
        customer_id: "walterwNdrcMi",
        customer_phone: "9999999999",
      },
      order_meta: {
        return_url:
          "https://www.cashfree.com/devstudio/preview/pg/web/checkout?order_id={order_id}",
      },
    };
    cashfree
      .PGCreateOrder(request)
      .then((response) => {
        console.log("Order Created successfully:", response.data);
        res.status(200).json({ message: response.data });
      })
      .catch((error) => {
        console.error("Error:", error.response.data.message);
        res.status(400).json({ message: response.data.message });
      });
  } catch (err) {
    console.error(err.response?.data || err);
    res
      .status(500)
      .json({
        error: "Create order failed",
        details: err.response?.data || err.message,
      });
  }
};




module.exports = {
  buyOrSellGold,
  getAllOrderHistory,
  getUserOrderHistory,
  getParticularOrderHistory,
  depositINR,
  withdrawINR,createOrder
};
