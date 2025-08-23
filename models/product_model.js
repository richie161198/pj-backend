const mongoose = require("mongoose");

const detailSchema = new mongoose.Schema({
  type: { type: String, required: true },   // e.g. "Metal", "Stone", "Pearl"
  name: { type: String },                   // e.g. "Gold", "Diamond"
  attributes: { type: Map, of: mongoose.Schema.Types.Mixed } 
  // flexible key-value pairs (e.g. { karatage: "18K", weight: 2.96, clarity: "VS1" })
}, { _id: false });

// Sub-schema for price details
const priceDetailSchema = new mongoose.Schema({
  name: { type: String, required: true },   // e.g. "Gold", "Stone", "Making Charges"
  weight: { type: String },                 // e.g. "2.903g"
  value: { type: Number, required: true }   // e.g. 22127.86
}, { _id: false });

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },      
    brand: { type: String, required: true },     
    description: { type: String },
    sellingprice: { type: Number, required: true },
    categories: [String],

    skuId: { type: String, unique: true },       
    active: { type: Boolean, default: true },

    rating: {
      value: { type: Number, default: 0 },       
      count: { type: Number, default: 0 }        
    },
    stock: { type: Number, default: 0 },

    caretOptions: [{ type: String }],           
    selectedCaret: { type: String },            

    // 🔑 Common flexible product details
    productDetails: [detailSchema],             

    // Expandable Price Details
    priceDetails: [priceDetailSchema],          

    subtotal: {
      weight: { type: String },                 
      value: { type: Number }                   
    },
    gst: { type: Number, default: 0 },
    total: { type: Number, required: true },    

    images: [{ type: String }]                  
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", productSchema);
