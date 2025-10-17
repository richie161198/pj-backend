const mongoose = require("mongoose");

const maintenanceSchema = new mongoose.Schema({
  isMaintenanceMode: {
    type: Boolean,
    default: false,
    required: true
  },
  maintenanceMessage: {
    type: String,
    default: "We are currently performing maintenance. Please try again later.",
    maxlength: 500
  },
  maintenanceTitle: {
    type: String,
    default: "System Maintenance",
    maxlength: 100
  },
  estimatedEndTime: {
    type: Date,
    default: null
  },
  isScheduled: {
    type: Boolean,
    default: false
  },
  scheduledStartTime: {
    type: Date,
    default: null
  },
  scheduledEndTime: {
    type: Date,
    default: null
  },
  allowedIPs: [{
    type: String,
    trim: true
  }],
  allowedUserIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }],
  maintenanceType: {
    type: String,
    enum: ["emergency", "scheduled", "update"],
    default: "emergency"
  },
  affectedServices: [{
    type: String,
    enum: ["api", "mobile", "web", "all"],
    default: ["all"]
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
    required: true
  },
  lastUpdatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin"
  }
}, {
  timestamps: true
});

// Index for quick lookup
maintenanceSchema.index({ isMaintenanceMode: 1 });

module.exports = mongoose.model("Maintenance", maintenanceSchema);
