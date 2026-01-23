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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Index for faster queries
ReviewSchema.index({ productId: 1, createdAt: -1 });
ReviewSchema.index({ userId: 1, productId: 1 }); // Prevent duplicate reviews

module.exports = mongoose.model("Review", ReviewSchema);
