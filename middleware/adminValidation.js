const { body } = require('express-validator');

// Admin registration validation
const validateAdminRegistration = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('role')
    .optional()
    .isIn(['admin', 'moderator', 'support'])
    .withMessage('Invalid role'),
  
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array'),
  
  body('department')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Department cannot exceed 50 characters'),
  
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number')
];

// Admin login validation
const validateAdminLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase(),
  
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Admin profile update validation
const validateAdminProfileUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  
  body('department')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Department cannot exceed 50 characters'),
  
  body('avatar')
    .optional()
    .isURL()
    .withMessage('Avatar must be a valid URL')
];

// Password change validation
const validatePasswordChange = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  
  body('confirmPassword')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Password confirmation does not match');
      }
      return true;
    })
];

// Refresh token validation
const validateRefreshToken = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token is required')
];

// Admin update validation
const validateAdminUpdate = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail()
    .toLowerCase(),
  
  body('role')
    .optional()
    .isIn(['admin', 'moderator', 'support'])
    .withMessage('Invalid role'),
  
  body('permissions')
    .optional()
    .isArray()
    .withMessage('Permissions must be an array'),
  
  body('department')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Department cannot exceed 50 characters'),
  
  body('phone')
    .optional()
    .isMobilePhone()
    .withMessage('Please provide a valid phone number'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean')
];

// Admin password update validation
const validateAdminPasswordUpdate = [
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .withMessage('New password must contain at least one uppercase letter, one lowercase letter, one number, and one special character')
];

module.exports = {
  validateAdminRegistration,
  validateAdminLogin,
  validateAdminProfileUpdate,
  validatePasswordChange,
  validateRefreshToken,
  validateAdminUpdate,
  validateAdminPasswordUpdate
};
