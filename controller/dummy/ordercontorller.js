const asyncHandler = require("express-async-handler");
const Order = require("../../models/orderModel");
const Cart = require("../../models/cart_model");
const Product = require("../../models/product_model");
const Address = require("../../models/address_model");
const Coupon = require("../../models/coupon");
const User = require("../../models/coupon");
const ReturnRequest = require("../../models/returnRequest");
const mongoose = require("mongoose");

const generateOrderId = () => `ORD-${Date.now()}-${Math.floor(Math.random()*10000)}`;

const placeOrder = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { addressId, paymentMethod = "cod", cartItems, couponCode, notes } = req.body;

  let items = cartItems;
  if (!items) {
    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) return res.status(400).json({ status: false, message: "Cart empty" });
    items = cart.items.map(i => ({ productId: i.productId, qty: i.qty, price: i.priceAtAdded, attributes: i.attributes }));
  }

  const address = await Address.findById(addressId);
  if (!address) return res.status(400).json({ status: false, message: "Address not found" });

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // reserve
    for (const it of items) {
      const prod = await Product.findById(it.productId).session(session);
      if (!prod) throw new Error("Product not found");
      if (prod.stock - prod.reserved < it.qty) throw new Error(`Insufficient stock for ${prod.name}`);
      prod.reserved = (prod.reserved || 0) + it.qty;
      await prod.save({ session });
    }

    const subTotal = items.reduce((s,i) => s + (i.price * i.qty), 0);
    let discount = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, active: true }).session(session);
      const now = new Date();
      if (coupon && (!coupon.validFrom || coupon.validFrom <= now) && (!coupon.validTo || coupon.validTo >= now)) {
        if(!coupon.usageLimit || (coupon.usedBy.length < coupon.usageLimit)) {
          if (coupon.discountType === "percentage") {
            discount = (subTotal * coupon.discountValue / 100);
            if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
          } else discount = coupon.discountValue;
          coupon.usedBy.push(userId);
          await coupon.save({ session });
        }
      }
    }

    const shipping = 0;
    const tax = Math.round((subTotal - discount) * 0.18);
    const grandTotal = Math.max(0, subTotal - discount + shipping + tax);

    const order = new Order({
      orderId: generateOrderId(),
      userId,
      items: items.map(i => ({ productId: i.productId, qty: i.qty, price: i.price, attributes: i.attributes })),
      totals: { subTotal, shipping, tax, discount, grandTotal },
      payment: { method: paymentMethod, status: paymentMethod === "cod" ? "pending" : "pending" },
      shippingAddress: address._id,
      notes
    });
    await order.save({ session });

    if (!cartItems) await Cart.findOneAndUpdate({ userId }, { items: [] }).session(session);

    // if paymentMethod === wallet, deduct immediately
    if (paymentMethod === "wallet") {
      const user = await User.findById(userId).session(session);
      if (user.wallet < grandTotal) throw new Error("Insufficient wallet balance");
      user.wallet -= grandTotal;
      await user.save({ session });
      order.payment.status = "paid";
      order.payment.transactionId = `WALLET-${Date.now()}`;
      order.payment.paidAt = new Date();
      await order.save({ session });
      // decrement stock now
      for (const it of order.items) {
        await Product.findByIdAndUpdate(it.productId, { $inc: { stock: -it.qty, reserved: -it.qty } });
      }
      order.status = "confirmed";
      await order.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ status: true, message: "Order placed", details: order });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    // best-effort to release reserved
    try {
      for (const it of items) {
        await Product.findByIdAndUpdate(it.productId, { $inc: { reserved: -it.qty } });
      }
    } catch (e) {}
    res.status(500).json({ status: false, message: err.message });
  }
});

const paymentWebhook = asyncHandler(async (req, res) => {
  // Example: { orderId, status, transactionId }
  const { orderId, status, transactionId } = req.body;
  const order = await Order.findOne({ orderId });
  if (!order) return res.status(404).json({ status: false, message: "Order not found" });

  if (status === "success") {
    if (order.payment.status === "paid") return res.json({ status: true });
    order.payment.status = "paid";
    order.payment.transactionId = transactionId;
    order.payment.paidAt = new Date();
    order.status = "confirmed";
    await order.save();
    // decrement stock
    for (const it of order.items) {
      await Product.findByIdAndUpdate(it.productId, { $inc: { stock: -it.qty, reserved: -it.qty } });
    }
  } else {
    order.payment.status = "failed";
    await order.save();
    // release reserved
    for (const it of order.items) {
      await Product.findByIdAndUpdate(it.productId, { $inc: { reserved: -it.qty } });
    }
  }
  res.json({ status: true });
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ status: false, message: "Forbidden" });
  const { orderId, status, shipment } = req.body;
  const order = await Order.findOne({ orderId });
  if (!order) return res.status(404).json({ status: false, message: "Order not found" });

  const prev = order.status;
  order.status = status;
  if (shipment) order.shipment = shipment;
  order.updatedAt = new Date();
  await order.save();

  // handle cancellation/refund stock logic
  if (status === "cancelled") {
    if (order.payment.status === "paid") {
      order.payment.status = "refunded";
      order.status = "refunded";
      await order.save();
      for (const it of order.items) {
        await Product.findByIdAndUpdate(it.productId, { $inc: { stock: it.qty } });
      }
    } else {
      for (const it of order.items) {
        await Product.findByIdAndUpdate(it.productId, { $inc: { reserved: -it.qty } });
      }
    }
  }

  res.json({ status: true, message: "Order updated", details: order });
});

const getOrdersForUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const orders = await Order.find({ userId }).sort({ createdAt: -1 });
  res.json({ status: true, details: orders });
});

const getAllOrders = asyncHandler(async (req, res) => {
  if (req.user.role !== "admin") return res.status(403).json({ status: false, message: "Forbidden" });
  const orders = await Order.find({}).sort({ createdAt: -1 });
  res.json({ status: true, details: orders });
});

const requestReturn = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { orderId, items } = req.body;
  const order = await Order.findOne({ orderId });
  if (!order) return res.status(404).json({ status: false, message: "Order not found" });

  let refundAmount = 0;
  for (const it of items) {
    const ordered = order.items.find(o => o.productId.toString() === it.productId);
    if (!ordered) return res.status(400).json({ status: false, message: "Item not in order" });
    if (it.qty > ordered.qty) return res.status(400).json({ status: false, message: "Invalid qty" });
    refundAmount += ordered.price * it.qty;
  }

  const rr = new ReturnRequest({ orderId: order._id, userId, items, refundAmount, status: "requested" });
  await rr.save();
  res.json({ status: true, message: "Return requested", details: rr });
});

module.exports = { placeOrder, paymentWebhook, updateOrderStatus, getOrdersForUser, getAllOrders, requestReturn };
