const mongoose = require("mongoose");

const CartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    qty: { type: Number, default: 1 },
    priceAtAdded: Number,
    attributes: mongoose.Mixed
  }],
      total: { type: Number, default: 0 },
      deliveryFee: { type: Number, default: 0 },

  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Cart", CartSchema);


