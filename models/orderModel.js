const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  orderId: { type: String, index: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    qty: Number,
    price: Number,
    attributes: mongoose.Mixed
  }],
  totals: {
    subTotal: Number,
    shipping: Number,
    tax: Number,
    discount: Number,
    grandTotal: Number,
    currency: { type: String, default: "INR" }
  },
  payment: {
    method: String,
    status: { type: String, enum: ["pending","paid","failed","refunded"], default: "pending" },
    transactionId: String,
    paidAt: Date
  },
  shippingAddress: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
  status: {
    type: String,
    enum: ["created","confirmed","packed","shipped","delivered","cancelled","returned","refunded"],
    default: "created"
  },
  shipment: {
    carrier: String,
    trackingId: String,
    estimatedDelivery: Date
  },
  notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

module.exports = mongoose.model("Order", OrderSchema);
