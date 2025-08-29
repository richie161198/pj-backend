const mongoose = require("mongoose");

const OrderSchema = new mongoose.Schema({
  // orderId: { type: String, index: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  orderId: { type: String, unique: true },
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
  paymentMethod: { type: String, enum: ["COD", "Card", "UPI"], default: "COD" },
  subtotal: Number,
  deliveryFee: Number,
  gst: Number,
  total: Number,
  status: { type: String, default: "Pending Payment" },

  shippingAddress: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },

  // shipment: {
  //   carrier: String,
  //   trackingId: String,
  //   estimatedDelivery: Date
  // },
  // notes: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: Date
});

module.exports = mongoose.model("Order", OrderSchema);
