const mongoose = require("mongoose");

/**
 * Shipment Model
 * Stores shipment data for commerce orders with BVC integration
 */
const ShipmentSchema = new mongoose.Schema(
  {
    // Order Reference
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductOrder",
      required: true,
    },
    orderCode: {
      type: String,
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // BVC Shipment Details
    bvcOrderNo: { type: String }, // BVC OrderNo from response
    docketNo: { type: String, index: true }, // BVC DockNo / AWB Number
    awbNo: { type: String, index: true }, // AWB Number sent to BVC
    agentId: { type: String, default: "KSAN0001" },

    // Shipment Type
    shipmentType: {
      type: String,
      enum: ["FORWARD", "REVERSE", "RETURN"],
      default: "FORWARD",
    },

    // Shipment Status
    status: {
      type: String,
      enum: [
        "PENDING",           // Order placed, shipment not yet created
        "CREATED",           // Shipment created with BVC
        "PICKUP_SCHEDULED",  // Pickup scheduled
        "PICKED_UP",         // Picked up from warehouse
        "IN_TRANSIT",        // In transit
        "OUT_FOR_DELIVERY",  // Out for delivery
        "DELIVERED",         // Successfully delivered
        "FAILED",            // Delivery failed
        "RTO_INITIATED",     // Return to origin initiated
        "RTO_IN_TRANSIT",    // RTO in transit
        "RTO_DELIVERED",     // Returned to origin
        "CANCELLED",         // Shipment cancelled
      ],
      default: "PENDING",
    },

    // BVC Status (raw from BVC API)
    bvcStatus: { type: String },
    bvcTrackingCode: { type: String },

    // Customer Details
    customerName: { type: String, required: true },
    customerPhone: { type: String, required: true },
    customerEmail: { type: String },

    // Delivery Address
    deliveryAddress: {
      addressLine1: { type: String, required: true },
      addressLine2: { type: String },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      landmark: { type: String },
    },

    // Package Details
    packageDetails: {
      weight: { type: Number, default: 0.5 }, // in KG
      length: { type: Number }, // in cm
      breadth: { type: Number },
      height: { type: Number },
      noOfPieces: { type: Number, default: 1 },
    },

    // Item Details
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        productName: { type: String },
        productCode: { type: String },
        quantity: { type: Number },
        price: { type: Number },
      },
    ],

    // Payment Details
    paymentMode: {
      type: String,
      enum: ["PREPAID", "COD"],
      default: "PREPAID",
    },
    codAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },

    // Service Type
    serviceType: {
      type: String,
      enum: ["Express", "Standard", "Economy"],
      default: "Express",
    },

    // Tracking History
    trackingHistory: [
      {
        status: { type: String },
        statusCode: { type: String },
        description: { type: String },
        location: { type: String },
        city: { type: String },
        timestamp: { type: Date },
        updatedBy: { type: String, default: "BVC System" },
      },
    ],

    // Dates
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    pickedUpAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    returnedAt: { type: Date },

    // Additional Info
    cancelReason: { type: String },
    deliveryAttempts: { type: Number, default: 0 },
    ndrReason: { type: String }, // Non-Delivery Report reason
    estimatedDeliveryDate: { type: Date },

    // BVC Raw Response (for debugging)
    bvcCreateResponse: { type: mongoose.Schema.Types.Mixed },
    bvcTrackResponse: { type: mongoose.Schema.Types.Mixed },

    // Return/Reverse shipment reference
    originalShipmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Shipment" },
    returnShipmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Shipment" },
    reverseAwbNo: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for faster queries
ShipmentSchema.index({ userId: 1, createdAt: -1 });
ShipmentSchema.index({ status: 1 });
ShipmentSchema.index({ docketNo: 1 });
ShipmentSchema.index({ orderCode: 1 });

// Virtual for formatted address
ShipmentSchema.virtual("formattedAddress").get(function () {
  const addr = this.deliveryAddress;
  if (!addr) return "";
  return `${addr.addressLine1}${addr.addressLine2 ? ", " + addr.addressLine2 : ""}, ${addr.city}, ${addr.state} - ${addr.pincode}`;
});

// Pre-save middleware to update timestamps
ShipmentSchema.pre("save", function (next) {
  this.updatedAt = new Date();
  next();
});

// Static method to get shipments by user
ShipmentSchema.statics.getByUserId = function (userId, options = {}) {
  const { page = 1, limit = 10, status } = options;
  const query = { userId };
  if (status) query.status = status;

  return this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("orderId", "orderCode totalAmount status")
    .lean();
};

// Static method to get shipment by order code
ShipmentSchema.statics.getByOrderCode = function (orderCode) {
  return this.findOne({ orderCode })
    .populate("orderId", "orderCode totalAmount status items")
    .populate("userId", "name email phone")
    .lean();
};

module.exports = mongoose.model("Shipment", ShipmentSchema);

