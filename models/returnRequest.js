const mongoose = require("mongoose");

const ReturnRequestSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductOrder" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  items: [{ 
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, 
    qty: Number, 
    reason: String,
    note: { type: String, default: null }, // Additional note when reason is "Other"
    mediaUrls: [{ type: String }] // Array of image/video URLs
  }],
  status: { type: String, enum: ["requested","approved","rejected","collected","completed"], default: "requested" },
  refundAmount: Number,
  rejectionMessage: { type: String },
  requestType: { type: String, enum: ["return", "replacement"] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

module.exports = mongoose.model("ReturnRequest", ReturnRequestSchema);
