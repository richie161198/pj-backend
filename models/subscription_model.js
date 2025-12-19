const mongoose = require("mongoose");

const redemptionSchema = new mongoose.Schema({
  merchantOrderId: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  status: {
    type: String,
    enum: ["PENDING", "COMPLETED", "FAILED", "REFUNDED","ACTIVE", "PAUSED", "REVOKED", "EXPIRED"],
    default: "PENDING",
  },
  transactionId: String,
  transactionNote: String,
  failureReason: String,
  executedAt: {
    type: Date,
    default: Date.now,
  },
  refundedAt: Date,
});

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    merchantSubscriptionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    merchantOrderId: {
      type: String,
      required: true,
    },
    phonepeSubscriptionId: {
      type: String,
      index: true,
    },
    phonepeOrderId: String,
    subscriptionName: {
      type: String,
      default: "Precious Goldsmith AutoPay",
    },
    amount: {
      type: Number,
      required: true,
    },
    maxAmount: {
      type: Number,
      required: true,
    },
    frequency: {
      type: String,
      enum: ["ON_DEMAND", "DAILY", "WEEKLY", "FORTNIGHTLY", "MONTHLY", "QUARTERLY", "HALF_YEARLY", "YEARLY"],
      default: "ON_DEMAND",
    },
    amountType: {
      type: String,
      enum: ["FIXED", "VARIABLE"],
      default: "VARIABLE",
    },
    status: {
      type: String,
      enum: ["PENDING", "ACTIVE", "PAUSED", "REVOKED", "EXPIRED", "FAILED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    failureReason: String,
    metadata: {
      authWorkflowType: String,
      paymentMode: String,
      vpa: String,
    },
    // Notification tracking
    lastNotificationId: String,
    lastNotificationAmount: Number,
    lastNotifiedAt: Date,
    // Redemption history
    redemptions: [redemptionSchema],
    lastRedemptionAt: Date,
    totalRedemptionAmount: {
      type: Number,
      default: 0,
    },
    redemptionCount: {
      type: Number,
      default: 0,
    },
    // Lifecycle dates
    expiresAt: {
      type: Date,
      required: true,
    },
    activatedAt: Date,
    pausedAt: Date,
    revokedAt: Date,
    cancelledAt: Date,
  },
  {
    timestamps: true,
  }
);

// Pre-save middleware to update totals
subscriptionSchema.pre("save", function (next) {
  if (this.isModified("redemptions")) {
    this.redemptionCount = this.redemptions.length;
    this.totalRedemptionAmount = this.redemptions
      .filter((r) => r.status === "COMPLETED")
      .reduce((sum, r) => sum + r.amount, 0);
  }
  next();
});

// Indexes for efficient queries
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ createdAt: -1 });
subscriptionSchema.index({ expiresAt: 1 });

const Subscription = mongoose.model("Subscription", subscriptionSchema);

module.exports = Subscription;

