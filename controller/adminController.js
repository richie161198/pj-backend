const Admin = require('../models/adminModel');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h',
    issuer: 'precious-jewels-admin',
    audience: 'precious-jewels-admin-panel'
  });
};

// Generate Refresh Token
const generateRefreshToken = (id) => {
  return jwt.sign({ id, type: 'refresh' }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
    issuer: 'precious-jewels-admin',
    audience: 'precious-jewels-admin-panel'
  });
};

// @desc    Register new admin
// @route   POST /api/v0/admin/register
// @access  Private (Super Admin only)
const registerAdmin = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, email, password, role, permissions, department, phone } = req.body;
    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: email.toLowerCase() });
    if (existingAdmin) {
      return res.status(400).json({
        status: false,
        message: 'Admin with this email already exists'
      });
    }

    // Check if user has permission to create admin
    const requestingAdmin = await Admin.findById(req.admin.id);
    if (requestingAdmin.role !== 'super_admin' && requestingAdmin.role !== 'admin') {
      return res.status(403).json({
        status: false,
        message: 'Insufficient permissions to create admin'
      });
    }

    // Create admin
    const admin = new Admin({
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'admin',
      permissions: permissions || [],
      department,
      phone,
      createdBy: req.admin.id
    });

    await admin.save();

    // Generate tokens
    const token = admin.generateAuthToken();
    const refreshToken = admin.generateRefreshToken();

    // Remove password from response
    const adminData = admin.toObject();
    delete adminData.password;
    delete adminData.twoFactorSecret;

    res.status(201).json({
      status: true,
      message: 'Admin registered successfully',
      data: {
        admin: adminData,
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Admin registration error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error during admin registration',
      error: error.message
    });
  }
};

const loginAdmin = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password, rememberMe } = req.body;

    // Find admin by credentials
    const admin = await Admin.findByCredentials(email, password);

    // Generate tokens
    const token = admin.generateAuthToken();
    const refreshToken = admin.generateRefreshToken();

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Remove sensitive data from response
    const adminData = admin.toObject();
    delete adminData.password;
    delete adminData.twoFactorSecret;
    delete adminData.loginAttempts;
    delete adminData.lockUntil;

    res.status(200).json({
      status: true,
      message: 'Login successful',
      data: {
        admin: adminData,
        token,
        refreshToken,
        expiresIn: process.env.JWT_EXPIRE || '24h'
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    
    let statusCode = 500;
    let message = 'Server error during login';

    if (error.message === 'Invalid credentials') {
      statusCode = 401;
      message = 'Invalid email or password';
    } else if (error.message && (error.message.includes('locked') || error.message.includes('too many failed'))) {
      statusCode = 423;
      message = error.message || 'Account is temporarily locked due to too many failed login attempts';
    }

    res.status(statusCode).json({
      status: false,
      message,
      error: error.message
    });
  }
};

const getAdminProfile = async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password -twoFactorSecret');
    
    if (!admin) {
      return res.status(404).json({
        status: false,
        message: 'Admin not found'
      });
    }

    res.status(200).json({
      status: true,
      message: 'Admin profile retrieved successfully',
      data: { admin }
    });

  } catch (error) {
    console.error('Get admin profile error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error retrieving admin profile',
      error: error.message
    });
  }
};

// @desc    Update admin profile
// @route   PUT /api/v0/admin/profile
// @access  Private
const updateAdminProfile = async (req, res) => {
  try {
    // Check for validation errors
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({
    //     status: false,
    //     message: 'Validation failed',
    //     errors: errors.array()
    //   });
    // }

    const { name, phone, department, avatar } = req.body;
    const updateData = { lastModifiedBy: req.admin.id };

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (department) updateData.department = department;
    if (avatar) updateData.avatar = avatar;

    const admin = await Admin.findByIdAndUpdate(
      req.admin.id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -twoFactorSecret');

    if (!admin) {
      return res.status(404).json({
        status: false,
        message: 'Admin not found'
      });
    }

    res.status(200).json({
      status: true,
      message: 'Admin profile updated successfully',
      data: { admin }
    });

  } catch (error) {
    console.error('Update admin profile error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error updating admin profile',
      error: error.message
    });
  }
};

// @desc    Change admin password
// @route   PUT /api/v0/admin/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    console.log("changePassword:", req.body);
    // Check for validation errors
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({
    //     status: false,
    //     message: 'Validation failed',
    //     errors: errors.array()
    //   });
    // }

    const { currentPassword, newPassword } = req.body;

    // Get admin with password
    const admin = await Admin.findById(req.admin.id).select('+password');
    
    if (!admin) {
      return res.status(404).json({
        status: false,
        message: 'Admin not found'
      });
    }

    // Verify current password
    const isMatch = await admin.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        status: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.status(200).json({
      status: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error changing password',
      error: error.message
    });
  }
};

// @desc    Refresh admin token
// @route   POST /api/v0/admin/refresh-token
// @access  Public
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        status: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    
    if (decoded.type !== 'refresh') {
      return res.status(400).json({
        status: false,
        message: 'Invalid refresh token'
      });
    }

    // Find admin
    const admin = await Admin.findById(decoded.id).select('-password -twoFactorSecret');
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        status: false,
        message: 'Admin not found or inactive'
      });
    }

    // Generate new tokens
    const newToken = admin.generateAuthToken();
    const newRefreshToken = admin.generateRefreshToken();

    res.status(200).json({
      status: true,
      message: 'Token refreshed successfully',
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: process.env.JWT_EXPIRE || '24h'
      }
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      status: false,
      message: 'Invalid refresh token',
      error: error.message
    });
  }
};

// @desc    Logout admin
// @route   POST /api/v0/admin/logout
// @access  Private
const logoutAdmin = async (req, res) => {
  try {
    // In a more sophisticated system, you might want to blacklist the token
    // For now, we'll just return success
    res.status(200).json({
      status: true,
      message: 'Logout successful'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error during logout',
      error: error.message
    });
  }
};

// @desc    Get all admins
// @route   GET /api/v0/admin/admins
// @access  Private (Admin/Super Admin only)
const getAllAdmins = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || '';
    const role = req.query.role || '';
    const isActive = req.query.isActive;

    // Build filter
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { department: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) filter.role = role;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const admins = await Admin.find(filter)
      .select('-password -twoFactorSecret')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Admin.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      status: true,
      message: 'Admins retrieved successfully',
      data: {
        admins,
        pagination: {
          currentPage: page,
          totalPages,
          totalAdmins: total,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
          limit
        }
      }
    });

  } catch (error) {
    console.error('Get all admins error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error retrieving admins',
      error: error.message
    });
  }
};

// @desc    Get admin statistics
// @route   GET /api/v0/admin/stats
// @access  Private (Admin/Super Admin only)
const getAdminStats = async (req, res) => {
  try {
    const stats = await Admin.getAdminStats();
    
    res.status(200).json({
      status: true,
      message: 'Admin statistics retrieved successfully',
      data: { stats }
    });

  } catch (error) {
    console.error('Get admin stats error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error retrieving admin statistics',
      error: error.message
    });
  }
};

// @desc    Get single admin by ID
// @route   GET /api/v0/admin/:id
// @access  Private (Admin/Super Admin only)
const getAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    const admin = await Admin.findById(id)
      .select('-password -twoFactorSecret')
      .populate('createdBy', 'name email')
      .populate('lastModifiedBy', 'name email');
    
    if (!admin) {
      return res.status(404).json({
        status: false,
        message: 'Admin not found'
      });
    }

    res.status(200).json({
      status: true,
      message: 'Admin details retrieved successfully',
      data: { admin }
    });

  } catch (error) {
    console.error('Get admin by ID error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error retrieving admin details',
      error: error.message
    });
  }
};

// @desc    Update admin by ID
// @route   PUT /api/v0/admin/:id
// @access  Private (Super Admin only)
const updateAdminById = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { name, email, role, permissions, department, phone, isActive } = req.body;

    // Check if admin exists
    const existingAdmin = await Admin.findById(id);
    if (!existingAdmin) {
      return res.status(404).json({
        status: false,
        message: 'Admin not found'
      });
    }

    // Check if user has permission to update admin
    const requestingAdmin = await Admin.findById(req.admin.id);
    if (requestingAdmin.role !== 'super_admin') {
      return res.status(403).json({
        status: false,
        message: 'Only super admins can update admin accounts'
      });
    }

    // Check if email is being changed and if it's already taken
    if (email && email !== existingAdmin.email) {
      const emailExists = await Admin.findOne({ 
        email: email.toLowerCase(), 
        _id: { $ne: id } 
      });
      if (emailExists) {
        return res.status(400).json({
          status: false,
          message: 'Email already exists'
        });
      }
    }

    // Update admin
    const updateData = { lastModifiedBy: req.admin.id };
    if (name) updateData.name = name;
    if (email) updateData.email = email.toLowerCase();
    if (role) updateData.role = role;
    if (permissions) updateData.permissions = permissions;
    if (department !== undefined) updateData.department = department;
    if (phone !== undefined) updateData.phone = phone;
    if (isActive !== undefined) updateData.isActive = isActive;

    const admin = await Admin.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).select('-password -twoFactorSecret');

    res.status(200).json({
      status: true,
      message: 'Admin updated successfully',
      data: { admin }
    });

  } catch (error) {
    console.error('Update admin by ID error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error updating admin',
      error: error.message
    });
  }
};

// @desc    Delete admin by ID
// @route   DELETE /api/v0/admin/:id
// @access  Private (Super Admin only)
const deleteAdminById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if admin exists
    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({
        status: false,
        message: 'Admin not found'
      });
    }

    // Check if user has permission to delete admin
    const requestingAdmin = await Admin.findById(req.admin.id);
    if (requestingAdmin.role !== 'super_admin') {
      return res.status(403).json({
        status: false,
        message: 'Only super admins can delete admin accounts'
      });
    }

    // Prevent deleting self
    if (id === req.admin.id) {
      return res.status(400).json({
        status: false,
        message: 'Cannot delete your own account'
      });
    }

    // Prevent deleting super admin
    if (admin.role === 'super_admin') {
      return res.status(400).json({
        status: false,
        message: 'Cannot delete super admin account'
      });
    }

    // Delete admin
    await Admin.findByIdAndDelete(id);

    res.status(200).json({
      status: true,
      message: 'Admin deleted successfully'
    });

  } catch (error) {
    console.error('Delete admin by ID error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error deleting admin',
      error: error.message
    });
  }
};

// @desc    Update admin password by ID
// @route   PUT /api/v0/admin/:id/password
// @access  Private (Super Admin only)
const updateAdminPassword = async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        status: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { id } = req.params;
    const { newPassword } = req.body;

    // Check if admin exists
    const admin = await Admin.findById(id);
    if (!admin) {
      return res.status(404).json({
        status: false,
        message: 'Admin not found'
      });
    }

    // Check if user has permission to update admin password
    const requestingAdmin = await Admin.findById(req.admin.id);
    if (requestingAdmin.role !== 'super_admin') {
      return res.status(403).json({
        status: false,
        message: 'Only super admins can update admin passwords'
      });
    }

    // Update password
    admin.password = newPassword;
    await admin.save();

    res.status(200).json({
      status: true,
      message: 'Admin password updated successfully'
    });

  } catch (error) {
    console.error('Update admin password error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error updating admin password',
      error: error.message
    });
  }
};

module.exports = {
  registerAdmin,
  loginAdmin,
  getAdminProfile,
  updateAdminProfile,
  changePassword,
  refreshToken,
  logoutAdmin,
  getAllAdmins,
  getAdminStats,
  getAdminById,
  updateAdminById,
  deleteAdminById,
  updateAdminPassword
};
