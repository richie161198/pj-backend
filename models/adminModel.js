const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const adminSchema = new mongoose.Schema({
  // Basic Information
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't include password in queries by default
  },
  
  // Admin Role & Permissions
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'moderator', 'support'],
    default: 'admin',
    required: true
  },
  permissions: [{
    type: String,
    enum: [
      // Legacy permissions (for backward compatibility)
      'users_manage',
      'products_manage', 
      'orders_manage',
      'categories_manage',
      'settings_manage',
      'reports_view',
      'analytics_view',
      'support_manage',
      'finance_manage',
      // Page-based permissions - All pages require explicit permissions
      'dashboard',
      'customers',
      'products',
      'categories',
      'banners',
      'orders',
      'invoices',
      'return-refunds',
      'investment-orders',
      'autopay-subscriptions',
      'investment-invoices',
      'investment-settings',
      'shipment-settings',
      'support-tickets',
      'notifications',
      'referred-users',
      'admin-profile',
      'admin-list',
      'maintenance',
      'privacy-policy',
      'return-policy',
      'shipping-policy',
      'cancellation-policy',
      'grievance-policy',
      'digigold-redemption-policy',
      'terms-and-conditions'
    ]
  }],
  
  // Profile Information
  avatar: {
    type: String,
    default: null
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number']
  },
  department: {
    type: String,
    trim: true,
    maxlength: [50, 'Department cannot exceed 50 characters']
  },
  
  // Security & Status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  },
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  },
  
  // Two-Factor Authentication
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false
  },
  
  // Audit Trail
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  lastModifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
adminSchema.index({ email: 1 });
adminSchema.index({ role: 1 });
adminSchema.index({ isActive: 1 });
adminSchema.index({ createdAt: -1 });

// Virtual for account lock status
adminSchema.virtual('isLocked').get(function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
});

// Pre-save middleware to hash password
adminSchema.pre('save', async function(next) {
  // Only hash password if it's been modified
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update updatedAt
adminSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to check password
adminSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    throw new Error('Password not set');
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to generate JWT token
adminSchema.methods.generateAuthToken = function() {
  const payload = {
    id: this._id,
    email: this.email,
    role: this.role,
    permissions: this.permissions,
    isActive: this.isActive
  };
  
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h',
    issuer: 'precious-jewels-admin',
    audience: 'precious-jewels-admin-panel'
  });
};

// Instance method to generate refresh token
adminSchema.methods.generateRefreshToken = function() {
  const payload = {
    id: this._id,
    type: 'refresh'
  };
  
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
    issuer: 'precious-jewels-admin',
    audience: 'precious-jewels-admin-panel'
  });
};

// Instance method to handle login attempts
adminSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts for 2 hours
  if (this.loginAttempts + 1 >= 5 && !this.isLocked) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Instance method to reset login attempts
adminSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 },
    $set: { lastLogin: Date.now() }
  });
};

// Static method to find admin by credentials
adminSchema.statics.findByCredentials = async function(email, password) {
  const admin = await this.findOne({ 
    email: email.toLowerCase(),
    isActive: true 
  }).select('+password');
  
  if (!admin) {
    throw new Error('Invalid credentials');
  }
  
  if (admin.isLocked) {
    throw new Error('Account is temporarily locked due to too many failed login attempts');
  }
  
  const isMatch = await admin.comparePassword(password);
  
  if (!isMatch) {
    await admin.incLoginAttempts();
    throw new Error('Invalid credentials');
  }
  
  // Reset login attempts on successful login
  if (admin.loginAttempts > 0) {
    await admin.resetLoginAttempts();
  }
  
  return admin;
};

// Static method to create super admin
adminSchema.statics.createSuperAdmin = async function(adminData) {
  const existingSuperAdmin = await this.findOne({ role: 'super_admin' });
  
  if (existingSuperAdmin) {
    throw new Error('Super admin already exists');
  }
  
  const superAdmin = new this({
    ...adminData,
    role: 'super_admin',
    permissions: [
      'users_manage',
      'products_manage',
      'orders_manage', 
      'categories_manage',
      'settings_manage',
      'reports_view',
      'analytics_view',
      'support_manage',
      'finance_manage'
    ],
    isEmailVerified: true
  });
  
  return await superAdmin.save();
};

// Static method to get admin statistics
adminSchema.statics.getAdminStats = async function() {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalAdmins: { $sum: 1 },
        activeAdmins: {
          $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
        },
        superAdmins: {
          $sum: { $cond: [{ $eq: ['$role', 'super_admin'] }, 1, 0] }
        },
        regularAdmins: {
          $sum: { $cond: [{ $eq: ['$role', 'admin'] }, 1, 0] }
        },
        moderators: {
          $sum: { $cond: [{ $eq: ['$role', 'moderator'] }, 1, 0] }
        },
        supportStaff: {
          $sum: { $cond: [{ $eq: ['$role', 'support'] }, 1, 0] }
        }
      }
    }
  ]);
  
  return stats[0] || {
    totalAdmins: 0,
    activeAdmins: 0,
    superAdmins: 0,
    regularAdmins: 0,
    moderators: 0,
    supportStaff: 0
  };
};

module.exports = mongoose.model('Admin', adminSchema);
