const axios = require("axios");
const orderModel = require("../models/orderModel");
const productOrder = require("../models/commerce_order_model");
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
        createdAt: Date.now(),
        orderId: orderId,
        Payment_method: Payment_method
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
        createdAt: Date.now(),
        orderId: orderId,
        Payment_method: Payment_method

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

    console.log("order", req.body)
    const { orderId } = req.body;

    console.log("order", orderId)
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




// Place Order
const placeOrder = async (req, res) => {
  try {
    const { items, totalAmount ,deliveryAddress} = req.body;

    console.log(req.body, req.user.id);
    const orderId = `PGCOM-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const order = new productOrder({
      user: req.user.id,
      orderCode: orderId,
      items,
      totalAmount,
      deliveryAddress
    });

    await order.save();

    // Automatically create invoice for the order
    try {
      const Invoice = require('../models/invoice_model');
      const User = require('../models/userModel');
      const Product = require('../models/product_model');

      // Get customer details
      const customer = await User.findById(req.user.id);
      if (customer) {
        // Prepare customer details
        const customerDetails = {
          name: customer.name || 'N/A',
          email: customer.email,
          phone: customer.phone || 'N/A',
          address: customer.address && customer.address.length > 0 ? customer.address[0] : {
            street: 'N/A',
            city: 'N/A',
            state: 'N/A',
            pincode: 'N/A'
          }
        };

        // Prepare products with detailed pricing and complete product data
        const products = await Promise.all(items.map(async (orderItem) => {
          const product = await Product.findById(orderItem.productDataid);
          if (!product) {
            throw new Error(`Product not found: ${orderItem.productDataid}`);
          }

          // Extract detailed product information
          const productDetails = product.productDetails || [];
          const priceDetails = product.priceDetails || [];
          
          // Get weight from product details or price details
          let weight = 0;
          let purity = '22Karat';
          let metalType = 'gold';
          
          // Extract weight and purity from product details
          productDetails.forEach(detail => {
            if (detail.type === 'Metal') {
              if (detail.attributes && detail.attributes['Gross Weight']) {
                weight = parseFloat(detail.attributes['Gross Weight']) || 0;
              }
              if (detail.attributes && detail.attributes.Karatage) {
                purity = detail.attributes.Karatage;
              }
              if (detail.attributes && detail.attributes.Material) {
                metalType = detail.attributes.Material.toLowerCase();
              }
            }
          });

          // Calculate pricing details from priceDetails or use defaults
          const unitPrice = product.sellingprice || 0;
          const totalPrice = unitPrice * orderItem.quantity;
          
          // Extract making charges, GST, and discount from priceDetails
          let makingCharges = 0;
          let gst = 0;
          let discount = 0;
          
          priceDetails.forEach(price => {
            if (price.name === 'Making Charges') {
              makingCharges = (parseFloat(price.value) || 0) * orderItem.quantity;
            } else if (price.name === 'GST') {
              gst = (parseFloat(price.value) || 0) * orderItem.quantity;
            } else if (price.name === 'Discount') {
              discount = (parseFloat(price.value) || 0) * orderItem.quantity;
            }
          });

          // If no making charges found in priceDetails, calculate from percentage
          if (makingCharges === 0) {
            const goldValue = priceDetails.find(p => p.name === 'Gold')?.value || 0;
            const makingChargesPercentage = priceDetails.find(p => p.name === 'Making Charges')?.weight;
            if (makingChargesPercentage && makingChargesPercentage.includes('%')) {
              const percentage = parseFloat(makingChargesPercentage.replace('%', '')) / 100;
              makingCharges = (goldValue * percentage) * orderItem.quantity;
            }
          }

          // If no GST found in priceDetails, use the product's GST field
          if (gst === 0 && product.gst) {
            gst = (totalPrice * product.gst / 100) * orderItem.quantity;
          }

          // If no discount found in priceDetails, use the product's Discount field
          if (discount === 0 && product.Discount) {
            discount = (totalPrice * product.Discount / 100) * orderItem.quantity;
          }

          const finalPrice = totalPrice + makingCharges + gst - discount;

          return {
            productId: product._id,
            name: product.name,
            sku: product.skuId || 'N/A',
            category: product.categories || 'N/A',
            brand: product.brand || 'N/A',
            quantity: orderItem.quantity,
            unitPrice,
            totalPrice,
            weight: weight,
            metalType: metalType,
            purity: purity,
            makingCharges,
            gst,
            discount,
            finalPrice,
            // Store complete product details for invoice
            productDetails: productDetails,
            priceDetails: priceDetails,
            images: product.images || [],
            description: product.description || '',
            selectedCaret: product.selectedCaret || purity
          };
        }));

        // Calculate totals
        const subtotal = products.reduce((sum, product) => sum + product.totalPrice, 0);
        const totalMakingCharges = products.reduce((sum, product) => sum + product.makingCharges, 0);
        const totalGST = products.reduce((sum, product) => sum + product.gst, 0);
        const totalDiscount = products.reduce((sum, product) => sum + product.discount, 0);
        const grandTotal = subtotal + totalMakingCharges + totalGST - totalDiscount;

        // Generate invoice number
        const invoiceCount = await Invoice.countDocuments();
        const year = new Date().getFullYear();
        const month = String(new Date().getMonth() + 1).padStart(2, '0');
        const day = String(new Date().getDate()).padStart(2, '0');
        const sequence = String(invoiceCount + 1).padStart(4, '0');
        const invoiceNumber = `INV-${year}${month}${day}-${sequence}`;

        // Create invoice
        const invoice = new Invoice({
          invoiceNumber,
          orderId: order._id,
          customerId: req.user.id,
          customerDetails,
          products,
          pricing: {
            subtotal,
            totalMakingCharges,
            totalGST,
            totalDiscount,
            grandTotal,
            currency: 'INR'
          },
          paymentDetails: {
            method: 'cash',
            paymentStatus: 'pending',
            paidAmount: 0
          },
          shippingDetails: {
            method: 'standard',
            shippingAddress: customerDetails.address
          },
          status: 'draft',
          createdBy: req.user.id, // Using user ID as admin for now
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
        });

        await invoice.save();
        console.log('Invoice created automatically for order:', order._id);
      }
    } catch (invoiceError) {
      console.error('Error creating automatic invoice:', invoiceError);
      // Don't fail the order if invoice creation fails
    }

    res.status(201).json({ success: true, message: "Order placed", order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Return Order
const returnOrder = async (req, res) => {
  try {
    const { orderId, reason } = req.body;

    const order = await productOrder.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.status = "RETURNED";
    order.returnReason = reason;
    await order.save();

    res.json({ success: true, message: "Order marked as returned", order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Refund Order
const refundOrder = async (req, res) => {
  try {
    const { orderId, refundAmount } = req.body;

    const order = await productOrder.findById(orderId);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.status = "REFUNDED";
    order.refundAmount = refundAmount;
    await order.save();

    res.json({ success: true, message: "Refund processed", order });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Get Order History
const getOrderHistory = async (req, res) => {
  console.log(req.user.id);
  try {
    const orders = await productOrder.find({ user: req.user.id }).sort({ createdAt: -1 }).populate("items.productDataid");
     console.log("req.user.id",orders);
    res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ==========================
// ADMIN: GET ALL ORDERS WITH PAGINATION AND FILTERING
// ==========================
const getAllOrdersAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (type) {
      filter.type = type;
    }
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }
    
    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'user.email': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get orders with pagination and populate user data
    const orders = await transactionSchema
      .find(filter)
      .populate('userId', 'name email phone')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalOrders = await transactionSchema.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / parseInt(limit));

    // Calculate summary statistics
    const stats = await transactionSchema.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$amount' }
        }
      }
    ]);

    const summary = stats.length > 0 ? stats[0] : {
      totalAmount: 0,
      totalOrders: 0,
      averageOrderValue: 0
    };

    res.status(200).json({
      status: true,
      message: "All orders fetched successfully for admin",
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalOrders,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        summary: {
          totalAmount: summary.totalAmount,
          totalOrders: summary.totalOrders,
          averageOrderValue: Math.round(summary.averageOrderValue * 100) / 100
        }
      }
    });
  } catch (error) {
    console.error("Error fetching orders for admin:", error);
    res.status(500).json({ 
      status: false, 
      message: "Error fetching orders", 
      error: error.message 
    });
  }
};

// ==========================
// ADMIN: GET ALL PRODUCT ORDERS WITH PAGINATION AND FILTERING
// ==========================
const getAllProductOrdersAdmin = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (status) {
      filter.status = status;
    }
    
    if (paymentStatus) {
      filter.paymentStatus = paymentStatus;
    }
    
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        filter.createdAt.$lte = new Date(endDate);
      }
    }
    
    if (search) {
      filter.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'user.name': { $regex: search, $options: 'i' } },
        { 'user.email': { $regex: search, $options: 'i' } },
        { 'items.productDataid.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get product orders with pagination and populate user and product data
    const orders = await productOrder
      .find(filter)
      .populate('user', 'name email phone')
      .populate('items.productDataid', 'name brand price images')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalOrders = await productOrder.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / parseInt(limit));

    // Calculate summary statistics
    const stats = await productOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$totalAmount' },
          totalOrders: { $sum: 1 },
          averageOrderValue: { $avg: '$totalAmount' }
        }
      }
    ]);

    const summary = stats.length > 0 ? stats[0] : {
      totalAmount: 0,
      totalOrders: 0,
      averageOrderValue: 0
    };

    // Get status-wise breakdown
    const statusBreakdown = await productOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    // Get payment status breakdown
    const paymentStatusBreakdown = await productOrder.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$paymentStatus',
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      }
    ]);

    res.status(200).json({
      status: true,
      message: "All product orders fetched successfully for admin",
      data: {
        orders,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalOrders,
          hasNextPage: parseInt(page) < totalPages,
          hasPrevPage: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        summary: {
          totalAmount: summary.totalAmount,
          totalOrders: summary.totalOrders,
          averageOrderValue: Math.round(summary.averageOrderValue * 100) / 100
        },
        breakdown: {
          status: statusBreakdown,
          paymentStatus: paymentStatusBreakdown
        }
      }
    });
  } catch (error) {
    console.error("Error fetching product orders for admin:", error);
    res.status(500).json({ 
      status: false, 
      message: "Error fetching product orders", 
      error: error.message 
    });
  }
};

module.exports = {
  placeOrder, returnOrder, refundOrder, getOrderHistory,
  buyOrSellGold,
  getAllOrderHistory,
  getUserOrderHistory,
  getParticularOrderHistory,
  depositINR,
  withdrawINR, 
  createOrder,
  getAllOrdersAdmin,
  getAllProductOrdersAdmin
};
