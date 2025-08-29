const mongoose = require("mongoose");

const ReturnRequestSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  items: [{ productId: mongoose.Schema.Types.ObjectId, qty: Number, reason: String }],
  status: { type: String, enum: ["requested","approved","rejected","collected","completed"], default: "requested" },
  refundAmount: Number,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

module.exports = mongoose.model("ReturnRequest", ReturnRequestSchema);
