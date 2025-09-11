const mongoose = require("mongoose");

const ProductOrderSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    orderCode: { type: String, unique: true },
    items: [
      {
        productDataid: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        
        quantity: Number,
        price: Number,
      },
    ],
    totalAmount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["PLACED","CONFIRMED", "RETURNED", "REFUNDED"],
      default: "PLACED",
    },
    returnReason: { type: String },
    deliveryAddress: { type: String },
    refundAmount: { type: Number },
  },
  { timestamps: true }
);

module.exports = mongoose.model("ProductOrder", ProductOrderSchema);
