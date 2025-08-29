const mongoose = require("mongoose");

const CouponSchema = new mongoose.Schema({
  code: { type: String, index: true },
  description: String,
  discountType: { type: String, enum: ["percentage","flat"], default: "percentage" },
  discountValue: Number,
  minCartValue: Number,
  maxDiscount: Number,
  validFrom: Date,
  validTo: Date,
  usageLimit: Number,
  usedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  active: { type: Boolean, default: true }
});

module.exports = mongoose.model("Coupon", CouponSchema);
