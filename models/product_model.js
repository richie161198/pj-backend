const mongoose = require("mongoose");

// const productSchema = new mongoose.Schema(
//   {
//     name: { type: String, required: true },
//     description: { type: String },
//     price: { type: Number, required: true },
//     category: { type: String },
//     stock: { type: Number, default: 0 },
//     imageUrl: { type: String },
//   },
//   { timestamps: true }
// );


const ProductSchema = new mongoose.Schema({
  sku: { type: String, index: true },
  name: { type: String, required: true },
  description: { type: String, required: true },
  images: [String],
  price: { type: Number, required: true },
  mrp: Number,
  currency: { type: String, default: "INR" },
  stock: { type: Number, default: 0 },
  reserved: { type: Number, default: 0 },
  categories: [String],
  attributes: mongoose.Mixed,
  active: { type: Boolean, default: true },
  rating: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Product", ProductSchema);
