const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  type: {
    type: String,
    required: true,
    enum: ['general', 'promotional', 'order_update', 'system', 'security', 'support_ticket'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  targetAudience: {
    type: String,
    enum: ['all', 'specific_users', 'user_segment'],
    default: 'all'
  },
  targetUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  targetSegment: {
    type: String,
    enum: ['all_users', 'active_users', 'new_users', 'premium_users'],
    default: 'all_users'
  },
  imageUrl: {
    type: String,
    default: null
  },
  actionUrl: {
    type: String,
    default: null
  },
  actionType: {
    type: String,
    enum: ['open_app', 'open_url', 'open_screen', 'none'],
    default: 'open_app'
  },
  screenName: {
    type: String,
    default: null
  },
  scheduledAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ['draft', 'scheduled', 'sent', 'failed', 'cancelled'],
    default: 'draft'
  },
  sentAt: {
    type: Date,
    default: null
  },
  sentCount: {
    type: Number,
    default: 0
  },
  deliveredCount: {
    type: Number,
    default: 0
  },
  clickedCount: {
    type: Number,
    default: 0
  },
  readBy: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  deliveredTo: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for better query performance
notificationSchema.index({ status: 1, scheduledAt: 1 });
notificationSchema.index({ type: 1, priority: 1 });
notificationSchema.index({ createdBy: 1, createdAt: -1 });

// Virtual for delivery rate
notificationSchema.virtual('deliveryRate').get(function() {
  if (this.sentCount === 0) return 0;
  return ((this.deliveredCount / this.sentCount) * 100).toFixed(2);
});

// Virtual for click rate
notificationSchema.virtual('clickRate').get(function() {
  if (this.deliveredCount === 0) return 0;
  return ((this.clickedCount / this.deliveredCount) * 100).toFixed(2);
});

// Ensure virtual fields are serialized
notificationSchema.set('toJSON', { virtuals: true });
notificationSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Notification', notificationSchema);
