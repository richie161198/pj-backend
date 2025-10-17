const express = require('express');
const router = express.Router();

// Import controllers
const {
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
} = require('../controller/adminController');

// Import middleware
const { adminAuth, requireRole, requirePermission } = require('../middleware/adminAuth');
const {
  validateAdminRegistration,
  validateAdminLogin,
  validateAdminProfileUpdate,
  validatePasswordChange,
  validateRefreshToken,
  validateAdminUpdate,
  validateAdminPasswordUpdate
} = require('../middleware/adminValidation');

// @route   POST /api/v0/admin/register
// @desc    Register new admin
// @access  Private (Super Admin/Admin only)
router.post('/register', 
  adminAuth,
  requireRole('super_admin', 'admin'),
  validateAdminRegistration,
  registerAdmin
);

// @route   POST /api/v0/admin/login
// @desc    Login admin
// @access  Public
router.post('/login', 
  validateAdminLogin,
  loginAdmin
);

// @route   GET /api/v0/admin/profile
// @desc    Get current admin profile
// @access  Private
router.get('/profile', 
  adminAuth,
  getAdminProfile
);

// @route   PUT /api/v0/admin/profile
// @desc    Update admin profile
// @access  Private
router.put('/profile', 
  adminAuth,
  validateAdminProfileUpdate,
  updateAdminProfile
);

// @route   PUT /api/v0/admin/change-password
// @desc    Change admin password
// @access  Private
router.put('/change-password', 
  adminAuth,
  validatePasswordChange,
  changePassword
);

// @route   POST /api/v0/admin/refresh-token
// @desc    Refresh admin token
// @access  Public
router.post('/refresh-token', 
  validateRefreshToken,
  refreshToken
);

// @route   POST /api/v0/admin/logout
// @desc    Logout admin
// @access  Private
router.post('/logout', 
  adminAuth,
  logoutAdmin
);

// @route   GET /api/v0/admin/admins
// @desc    Get all admins
// @access  Private (Admin/Super Admin only)
router.get('/admins', 
  adminAuth,
  requireRole('super_admin', 'admin'),
  getAllAdmins
);

// @route   GET /api/v0/admin/stats
// @desc    Get admin statistics
// @access  Private (Admin/Super Admin only)
router.get('/stats', 
  adminAuth,
  requireRole('super_admin', 'admin'),
  getAdminStats
);

// @route   GET /api/v0/admin/:id
// @desc    Get single admin by ID
// @access  Private (Admin/Super Admin only)
router.get('/:id', 
  adminAuth,
  requireRole('super_admin', 'admin'),
  getAdminById
);

// @route   PUT /api/v0/admin/:id
// @desc    Update admin by ID
// @access  Private (Super Admin only)
router.put('/:id', 
  adminAuth,
  requireRole('super_admin'),
  validateAdminUpdate,
  updateAdminById
);

// @route   DELETE /api/v0/admin/:id
// @desc    Delete admin by ID
// @access  Private (Super Admin only)
router.delete('/:id', 
  adminAuth,
  requireRole('super_admin'),
  deleteAdminById
);

// @route   PUT /api/v0/admin/:id/password
// @desc    Update admin password by ID
// @access  Private (Super Admin only)
router.put('/:id/password', 
  adminAuth,
  requireRole('super_admin'),
  validateAdminPasswordUpdate,
  updateAdminPassword
);

module.exports = router;
