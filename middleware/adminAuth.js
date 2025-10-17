const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');

// Verify JWT token for admin authentication
const adminAuth = async (req, res, next) => {
  try {
    let token;

    // Check for token in headers
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        status: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check token issuer and audience
    if (decoded.iss !== 'precious-jewels-admin' || decoded.aud !== 'precious-jewels-admin-panel') {
      return res.status(401).json({
        status: false,
        message: 'Invalid token issuer or audience'
      });
    }

    // Find admin
    const admin = await Admin.findById(decoded.id).select('-password -twoFactorSecret');
    
    if (!admin) {
      return res.status(401).json({
        status: false,
        message: 'Admin not found'
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      return res.status(401).json({
        status: false,
        message: 'Admin account is inactive'
      });
    }

    // Add admin to request object
    req.admin = admin;
    next();

  } catch (error) {
    console.error('Admin auth error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: false,
        message: 'Token expired'
      });
    }

    res.status(500).json({
      status: false,
      message: 'Server error during authentication',
      error: error.message
    });
  }
};

// Check admin role permissions
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        status: false,
        message: 'Authentication required'
      });
    }

    if (!roles.includes(req.admin.role)) {
      return res.status(403).json({
        status: false,
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Check specific permission
const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        status: false,
        message: 'Authentication required'
      });
    }

    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      return next();
    }

    if (!req.admin.permissions || !req.admin.permissions.includes(permission)) {
      return res.status(403).json({
        status: false,
        message: `Permission '${permission}' required`
      });
    }

    next();
  };
};

// Check multiple permissions (user needs ALL permissions)
const requireAllPermissions = (...permissions) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        status: false,
        message: 'Authentication required'
      });
    }

    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      return next();
    }

    const hasAllPermissions = permissions.every(permission => 
      req.admin.permissions && req.admin.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      return res.status(403).json({
        status: false,
        message: `All permissions required: ${permissions.join(', ')}`
      });
    }

    next();
  };
};

// Check any permission (user needs ANY of the permissions)
const requireAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({
        status: false,
        message: 'Authentication required'
      });
    }

    // Super admin has all permissions
    if (req.admin.role === 'super_admin') {
      return next();
    }

    const hasAnyPermission = permissions.some(permission => 
      req.admin.permissions && req.admin.permissions.includes(permission)
    );

    if (!hasAnyPermission) {
      return res.status(403).json({
        status: false,
        message: `One of these permissions required: ${permissions.join(', ')}`
      });
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
const optionalAdminAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const admin = await Admin.findById(decoded.id).select('-password -twoFactorSecret');
      
      if (admin && admin.isActive) {
        req.admin = admin;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication for optional auth
    next();
  }
};

module.exports = {
  adminAuth,
  requireRole,
  requirePermission,
  requireAllPermissions,
  requireAnyPermission,
  optionalAdminAuth
};
