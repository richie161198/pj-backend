const express = require('express');
const { body } = require('express-validator');
const { adminAuth } = require('../middleware/adminAuth');
const { isAuth } = require('../middleware/tokenValidation');
const {
  createNotification,
  getAllNotifications,
  getNotificationById,
  updateNotification,
  deleteNotification,
  sendNotification,
  getNotificationStats,
  registerDeviceToken,
  updateNotificationPreferences,
  getNotificationHistory,
  markNotificationAsRead,
  deleteNotificationForUser,
  getUserNotificationStats
} = require('../controller/notificationController');

const router = express.Router();

// Validation middleware
const validateNotification = [
  body('title')
    .notEmpty()
    .withMessage('Title is required')
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  
  body('message')
    .notEmpty()
    .withMessage('Message is required')
    .isLength({ min: 1, max: 500 })
    .withMessage('Message must be between 1 and 500 characters'),
  
  body('type')
    .optional()
    .isIn(['general', 'promotional', 'order_update', 'system', 'security'])
    .withMessage('Invalid notification type'),
  
  body('priority')
    .optional()
    .isIn(['low', 'normal', 'high', 'urgent'])
    .withMessage('Invalid priority level'),
  
  body('targetAudience')
    .optional()
    .isIn(['all', 'specific_users', 'user_segment'])
    .withMessage('Invalid target audience'),
  
  body('targetUsers')
    .optional()
    .isArray()
    .withMessage('Target users must be an array'),
  
  body('targetSegment')
    .optional()
    .isIn(['all_users', 'active_users', 'new_users', 'premium_users'])
    .withMessage('Invalid target segment'),
  
  body('imageUrl')
    .optional()
    .isURL()
    .withMessage('Image URL must be a valid URL'),
  
  // body('actionUrl')
  //   .optional()
  //   .isURL()
  //   .withMessage('Action URL must be a valid URL'),
  
  body('actionType')
    .optional()
    .isIn(['open_app', 'open_url', 'open_screen', 'none'])
    .withMessage('Invalid action type'),
  
  body('scheduledAt')
    .optional()
    .isISO8601()
    .withMessage('Scheduled date must be a valid ISO 8601 date'),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object')
];

const validateDeviceToken = [
  body('token')
    .notEmpty()
    .withMessage('Device token is required')
    .isLength({ min: 1, max: 1000 })
    .withMessage('Device token must be between 1 and 1000 characters'),
  
  body('platform')
    .notEmpty()
    .withMessage('Platform is required')
    .isIn(['android', 'ios', 'web'])
    .withMessage('Platform must be android, ios, or web'),
  
  body('deviceInfo')
    .optional()
    .isObject()
    .withMessage('Device info must be an object'),
  
  body('preferences')
    .optional()
    .isObject()
    .withMessage('Preferences must be an object')
];

const validateNotificationPreferences = [
  body('preferences')
    .isObject()
    .withMessage('Preferences must be an object'),
  
  body('preferences.general')
    .optional()
    .isBoolean()
    .withMessage('General preference must be a boolean'),
  
  body('preferences.promotional')
    .optional()
    .isBoolean()
    .withMessage('Promotional preference must be a boolean'),
  
  body('preferences.orderUpdates')
    .optional()
    .isBoolean()
    .withMessage('Order updates preference must be a boolean'),
  
  body('preferences.system')
    .optional()
    .isBoolean()
    .withMessage('System preference must be a boolean'),
  
  body('preferences.security')
    .optional()
    .isBoolean()
    .withMessage('Security preference must be a boolean')
];

// Admin routes (protected)
router.post('/admin/notifications', 
  adminAuth, 
  validateNotification, 
  createNotification
);

router.get('/admin/notifications', 
  adminAuth, 
  getAllNotifications
);

router.get('/admin/notifications/stats', 
  adminAuth, 
  getNotificationStats
);

router.get('/admin/notifications/:id', 
  adminAuth, 
  getNotificationById
);

router.put('/admin/notifications/:id', 
  adminAuth, 
  validateNotification, 
  updateNotification
);

router.delete('/admin/notifications/:id', 
  adminAuth, 
  deleteNotification
);

router.post('/admin/notifications/:id/send', 
  adminAuth, 
  sendNotification
);

// User routes (protected)
router.post('/register-token', 
  isAuth, 
  validateDeviceToken, 
  registerDeviceToken
);

router.put('/preferences', 
  isAuth, 
  validateNotificationPreferences, 
  updateNotificationPreferences
);

router.get('/history', 
  isAuth, 
  getNotificationHistory
);

router.put('/:id/read', 
  isAuth, 
  markNotificationAsRead
);

router.delete('/:id', 
  isAuth, 
  deleteNotificationForUser
);

router.get('/stats', 
  isAuth, 
  getUserNotificationStats
);

module.exports = router;
