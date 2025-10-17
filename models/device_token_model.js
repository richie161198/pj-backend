const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  platform: {
    type: String,
    required: true,
    enum: ['android', 'ios', 'web']
  },
  deviceInfo: {
    deviceModel: String,
    osVersion: String,
    appVersion: String,
    timezone: String,
    language: String
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastUsed: {
    type: Date,
    default: Date.now
  },
  preferences: {
    general: { type: Boolean, default: true },
    promotional: { type: Boolean, default: true },
    orderUpdates: { type: Boolean, default: true },
    system: { type: Boolean, default: true },
    security: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

// Index for better query performance
deviceTokenSchema.index({ userId: 1, isActive: 1 });
deviceTokenSchema.index({ platform: 1, isActive: 1 });
deviceTokenSchema.index({ token: 1 }, { unique: true });

module.exports = mongoose.model('DeviceToken', deviceTokenSchema);
