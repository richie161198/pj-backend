const express = require('express');
const { body } = require('express-validator');
const { adminAuth } = require('../middleware/adminAuth');
const { tokenValidation } = require('../middleware/tokenValidation');
const {
  getMaintenanceStatus,
  updateMaintenanceStatus,
  getMaintenanceHistory,
  checkMaintenanceAccess
} = require('../controller/maintenanceController');

const router = express.Router();

// Validation middleware
const validateMaintenanceUpdate = [
  body('isMaintenanceMode').isBoolean().withMessage('isMaintenanceMode must be a boolean'),
  body('maintenanceMessage').optional().isLength({ min: 1, max: 500 }).withMessage('Maintenance message must be between 1 and 500 characters'),
  body('maintenanceTitle').optional().isLength({ min: 1, max: 100 }).withMessage('Maintenance title must be between 1 and 100 characters'),
  body('estimatedEndTime').optional().isISO8601().withMessage('Estimated end time must be a valid ISO 8601 date'),
  body('maintenanceType').optional().isIn(['emergency', 'scheduled', 'update']).withMessage('Invalid maintenance type'),
  body('affectedServices').optional().isArray().withMessage('Affected services must be an array'),
  body('affectedServices.*').optional().isIn(['api', 'mobile', 'web', 'all']).withMessage('Invalid service type'),
  body('allowedIPs').optional().isArray().withMessage('Allowed IPs must be an array'),
  body('allowedUserIds').optional().isArray().withMessage('Allowed user IDs must be an array')
];

// Public routes
router.get('/status', getMaintenanceStatus);

// Admin routes (protected)
router.put('/admin/update', adminAuth, validateMaintenanceUpdate, updateMaintenanceStatus);
router.get('/admin/history', adminAuth, getMaintenanceHistory);

// Middleware to check maintenance access (apply to all routes except status)
router.use((req, res, next) => {
  if (req.path === '/status') {
    return next();
  }
  checkMaintenanceAccess(req, res, next);
});

module.exports = router;
