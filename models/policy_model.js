const mongoose = require('mongoose');

const policySchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    unique: true,
    enum: ['privacy', 'return', 'shipping', 'cancellation', 'terms'],
    index: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  version: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
policySchema.index({ type: 1, isActive: 1 });

// Method to increment version on update
policySchema.pre('save', function(next) {
  if (!this.isNew && this.isModified('content')) {
    this.version += 1;
    this.lastUpdated = Date.now();
  }
  next();
});

module.exports = mongoose.model('Policy', policySchema);

