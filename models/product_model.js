const mongoose = require("mongoose");

const detailSchema = new mongoose.Schema({
  type: { type: String, required: true },   // e.g. "Metal", "Stone", "Pearl"
  attributes: { type: Map, of: mongoose.Schema.Types.Mixed }
  // flexible key-value pairs (e.g. { karatage: "18K", weight: 2.96, clarity: "VS1" })
}, { _id: false });

// Sub-schema for price details
const priceDetailSchema = new mongoose.Schema({
  name: { type: String, required: true },
  weight: { type: String },
  value: { type: Number }
}, { _id: false });

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    brand: { type: String, required: true },
    description: { type: String },
    categories: { type: String, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true },

    skuId: { type: String, unique: true },
    active: { type: Boolean, default: true },
    CurrentlyNotAvailable: { type: Boolean, default: false },
    popular: { type: Boolean, default: false },
    trending: { type: Boolean, default: false },

    rating: {
      value: { type: Number, default: 0 },
      count: { type: Number, default: 0 }
    },
    stock: { type: Number, default: 0 },
    sellingprice: { 
      type: Number, 
      default: 0,
      min: 0,
      // set: function(value) {
      //   return Math.round(value * 100) / 100; // Round to 2 decimal places
      // }
    },
    selectedCaret: { type: String },

    // 🔑 Common flexible product details
    productDetails: [detailSchema],

    // Expandable Price Details
    priceDetails: [priceDetailSchema],

    subtotal: {
      weight: { type: String }
    },
    gst: { type: Number, default: 0 },
    Discount: { type: Number },
    isDiscountAvailable: { type: Boolean, default: false },

    images: [{ type: String }],

    // Return & Replacement Policy
    isReturnAllowed: { type: Boolean, default: true },
    isReplacementAllowed: { type: Boolean, default: true },
    returnReplacementDays: { type: Number, default: 5, min: 0 },
    
    // Stock Management
    outOfStockDate: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
