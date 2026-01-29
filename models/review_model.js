const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  userName: { type: String, required: true },
  userEmail: { type: String },
  rating: { type: Number, min: 1, max: 5, required: true },
  title: { type: String },
  body: { type: String, required: true },
  isVerified: { type: Boolean, default: false }, // If user purchased the product
  helpful: { type: Number, default: 0 }, // Number of helpful votes
  status: { 
    type: String, 
    enum: ["pending", "approved", "rejected"], 
    default: "pending" 
  }, // Admin approval status
  rejectionReason: { type: String }, // Reason for rejection (optional)
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // Admin who reviewed
  reviewedAt: { type: Date }, // When admin reviewed
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for faster queries
ReviewSchema.index({ productId: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1, productId: 1 }); // Prevent duplicate reviews
ReviewSchema.index({ status: 1 }); // For filtering by approval status
ReviewSchema.index({ productId: 1, status: 1 }); // For fetching approved reviews per product

module.exports = mongoose.model("Review", ReviewSchema);
