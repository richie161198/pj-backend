const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: false,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: false,
    trim: true,
    maxlength: 500
  },
  imageUrl: {
    type: String,
    required: true,
    trim: true
  },
  publicId: {
    type: String,
    required: true,
    trim: true
  },
  imageWidth: {
    type: Number,
    required: false
  },
  imageHeight: {
    type: Number,
    required: false
  },
  imageFormat: {
    type: String,
    required: false
  },
  imageBytes: {
    type: Number,
    required: false
  },
  link: {
    type: String,
    required: false,
    trim: true
  },
  linkText: {
    type: String,
    required: false,
    trim: true,
    maxlength: 50
  },
  position: {
    type: Number,
    required: true,
    default: 0
  },
  isActive: {
    type: Boolean,
    required: true,
    default: true
  },
  startDate: {
    type: Date,
    required: false
  },
  endDate: {
    type: Date,
    required: false
  },
  targetAudience: {
    type: String,
    enum: ['all', 'mobile', 'web', 'admin'],
    default: 'all'
  },
  category: {
    type: String,
    required: false,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  clicks: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: false
  }
}, {
  timestamps: true
});

// Index for better query performance
bannerSchema.index({ isActive: 1, position: 1 });
bannerSchema.index({ targetAudience: 1, isActive: 1 });
bannerSchema.index({ startDate: 1, endDate: 1 });

// Virtual for image dimensions
bannerSchema.virtual('dimensions').get(function() {
  if (this.imageWidth && this.imageHeight) {
    return `${this.imageWidth}x${this.imageHeight}`;
  }
  return null;
});

// Virtual for file size in MB
bannerSchema.virtual('fileSizeMB').get(function() {
  if (this.imageBytes) {
    return (this.imageBytes / (1024 * 1024)).toFixed(2);
  }
  return null;
});

// Method to check if banner is currently active
bannerSchema.methods.isCurrentlyActive = function() {
  if (!this.isActive) return false;
  
  const now = new Date();
  if (this.startDate && this.startDate > now) return false;
  if (this.endDate && this.endDate < now) return false;
  
  return true;
};

// Method to increment views
bannerSchema.methods.incrementViews = function() {
  this.views += 1;
  return this.save();
};

// Method to increment clicks
bannerSchema.methods.incrementClicks = function() {
  this.clicks += 1;
  return this.save();
};

// Static method to get active banners
bannerSchema.statics.getActiveBanners = function(targetAudience = 'all') {
  const now = new Date();
  return this.find({
    isActive: true,
    $or: [
      { startDate: { $exists: false } },
      { startDate: { $lte: now } }
    ],
    $or: [
      { endDate: { $exists: false } },
      { endDate: { $gte: now } }
    ],
    $or: [
      { targetAudience: 'all' },
      { targetAudience: targetAudience }
    ]
  }).sort({ position: 1, createdAt: -1 });
};

// Static method to get banners by category
bannerSchema.statics.getBannersByCategory = function(category) {
  return this.find({ 
    category: category,
    isActive: true 
  }).sort({ position: 1, createdAt: -1 });
};

// Pre-save middleware to validate dates
bannerSchema.pre('save', function(next) {
  if (this.startDate && this.endDate && this.startDate >= this.endDate) {
    return next(new Error('Start date must be before end date'));
  }
  next();
});

module.exports = mongoose.model('Banner', bannerSchema);
