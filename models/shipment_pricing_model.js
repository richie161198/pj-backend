const mongoose = require("mongoose");

const LocationRuleSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["city", "place", "pincode"],
    required: true,
  },
  value: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { _id: true });

const ShipmentPricingSchema = new mongoose.Schema(
  {
    fixedPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    locationRules: [LocationRuleSchema],
    isLocationBasedEnabled: {
      type: Boolean,
      default: false,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
    },
  },
  { timestamps: true }
);

// Index for faster lookups
LocationRuleSchema.index({ type: 1, value: 1 });
ShipmentPricingSchema.index({ isLocationBasedEnabled: 1 });

module.exports = mongoose.model("ShipmentPricing", ShipmentPricingSchema);

