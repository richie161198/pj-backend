const { validationResult } = require('express-validator');
const Notification = require('../models/notification_model');
const DeviceToken = require('../models/device_token_model');
const User = require('../models/userModel');
const fcmService = require('../services/fcmService');

// @desc    Create a new notification
// @route   POST /api/v0/admin/notifications
// @access  Private (Admin)
const createNotification = async (req, res) => {
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

    const {
      title,
      message,
      type,
      priority,
      targetAudience,
      targetUsers,
      targetSegment,
      imageUrl,
      actionUrl,
      actionType,
      screenName,
      scheduledAt,
      metadata
    } = req.body;

    // Determine status based on scheduledAt
    let status = 'draft';
    if (scheduledAt) {
      const scheduledDate = new Date(scheduledAt);
      const now = new Date();
      if (scheduledDate > now) {
        status = 'scheduled';
      } else {
        // If scheduled time is in the past, set as draft (can be sent immediately)
        status = 'draft';
      }
    }

    // Create notification
    const notification = new Notification({
      title,
      message,
      type,
      priority,
      targetAudience,
      targetUsers: targetUsers || [],
      targetSegment,
      imageUrl,
      actionUrl,
      actionType,
      screenName,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      status,
      createdBy: req.admin.id,
      metadata
    });

    await notification.save();

    res.status(201).json({
      status: true,
      message: 'Notification created successfully',
      data: { notification }
    });

  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error creating notification',
      error: error.message
    });
  }
};

// @desc    Get all notifications with pagination and filters
// @route   GET /api/v0/admin/notifications
// @access  Private (Admin)
const getAllNotifications = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      type,
      priority,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    if (status) filter.status = status;
    if (type) filter.type = type;
    if (priority) filter.priority = priority;
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get notifications with pagination
    const notifications = await Notification.find(filter)
      .populate('createdBy', 'name email')
      .populate('targetUsers', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Notification.countDocuments(filter);

    res.status(200).json({
      status: true,
      message: 'Notifications retrieved successfully',
      data: {
        notifications,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error retrieving notifications',
      error: error.message
    });
  }
};

// @desc    Get notification by ID
// @route   GET /api/v0/admin/notifications/:id
// @access  Private (Admin)
const getNotificationById = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id)
      .populate('createdBy', 'name email')
      .populate('targetUsers', 'name email');

    if (!notification) {
      return res.status(404).json({
        status: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      status: true,
      message: 'Notification retrieved successfully',
      data: { notification }
    });

  } catch (error) {
    console.error('Get notification error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error retrieving notification',
      error: error.message
    });
  }
};

// @desc    Update notification
// @route   PUT /api/v0/admin/notifications/:id
// @access  Private (Admin)
const updateNotification = async (req, res) => {
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
    const updateData = { ...req.body };

    // Convert scheduledAt to Date object if provided
    if (updateData.scheduledAt) {
      updateData.scheduledAt = new Date(updateData.scheduledAt);
      
      // Update status based on scheduledAt
      const scheduledDate = new Date(updateData.scheduledAt);
      const now = new Date();
      if (scheduledDate > now) {
        updateData.status = 'scheduled';
      } else {
        // If scheduled time is in the past, keep current status or set as draft
        if (!updateData.status) {
          updateData.status = 'draft';
        }
      }
    }

    // Don't allow updating sent notifications
    const existingNotification = await Notification.findById(id);
    if (existingNotification && existingNotification.status === 'sent') {
      return res.status(400).json({
        status: false,
        message: 'Cannot update sent notifications'
      });
    }

    const notification = await Notification.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('targetUsers', 'name email');

    if (!notification) {
      return res.status(404).json({
        status: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      status: true,
      message: 'Notification updated successfully',
      data: { notification }
    });

  } catch (error) {
    console.error('Update notification error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error updating notification',
      error: error.message
    });
  }
};

// @desc    Delete notification
// @route   DELETE /api/v0/admin/notifications/:id
// @access  Private (Admin)
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        status: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      status: true,
      message: 'Notification deleted successfully'
    });

  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error deleting notification',
      error: error.message
    });
  }
};

// @desc    Send notification immediately
// @route   POST /api/v0/admin/notifications/:id/send
// @access  Private (Admin)
const sendNotification = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({
        status: false,
        message: 'Notification not found'
      });
    }

    if (notification.status === 'sent') {
      return res.status(400).json({
        status: false,
        message: 'Notification already sent'
      });
    }

    // Get target device tokens
    let deviceTokens = [];
    
    if (notification.targetAudience === 'all') {
      deviceTokens = await DeviceToken.find({ isActive: true }).select('token platform userId');
    } else if (notification.targetAudience === 'specific_users') {
      deviceTokens = await DeviceToken.find({
        userId: { $in: notification.targetUsers },
        isActive: true
      }).select('token platform userId');
    } else if (notification.targetAudience === 'user_segment') {
      // Implement user segmentation logic here
      const users = await User.find({}).select('_id');
      deviceTokens = await DeviceToken.find({
        userId: { $in: users.map(u => u._id) },
        isActive: true
      }).select('token platform userId');
    }

    if (deviceTokens.length === 0) {
      return res.status(400).json({
        status: false,
        message: 'No active device tokens found for target audience'
      });
    }

    // Send notification via FCM
    const result = await fcmService.sendNotification({
      title: notification.title,
      body: notification.message,
      imageUrl: notification.imageUrl,
      actionUrl: notification.actionUrl,
      actionType: notification.actionType,
      screenName: notification.screenName,
      data: {
        notificationId: notification._id.toString(),
        type: notification.type,
        priority: notification.priority,
        ...notification.metadata
      }
    }, deviceTokens);

    // Update notification status
    notification.status = 'sent';
    notification.sentAt = new Date();
    notification.sentCount = result.successCount;
    await notification.save();

    res.status(200).json({
      status: true,
      message: 'Notification sent successfully',
      data: {
        sentCount: result.successCount,
        failedCount: result.failedCount,
        totalTargets: deviceTokens.length
      }
    });

  } catch (error) {
    console.error('Send notification error:', error);
    
    // Update notification status to failed
    try {
      await Notification.findByIdAndUpdate(req.params.id, {
        status: 'failed'
      });
    } catch (updateError) {
      console.error('Error updating notification status:', updateError);
    }

    res.status(500).json({
      status: false,
      message: 'Server error sending notification',
      error: error.message
    });
  }
};

// @desc    Get notification statistics
// @route   GET /api/v0/admin/notifications/stats
// @access  Private (Admin)
const getNotificationStats = async (req, res) => {
  try {
    const stats = await Notification.aggregate([
      {
        $group: {
          _id: null,
          totalNotifications: { $sum: 1 },
          sentNotifications: {
            $sum: { $cond: [{ $eq: ['$status', 'sent'] }, 1, 0] }
          },
          scheduledNotifications: {
            $sum: { $cond: [{ $eq: ['$status', 'scheduled'] }, 1, 0] }
          },
          draftNotifications: {
            $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] }
          },
          totalSent: { $sum: '$sentCount' },
          totalDelivered: { $sum: '$deliveredCount' },
          totalClicked: { $sum: '$clickedCount' }
        }
      }
    ]);

    const typeStats = await Notification.aggregate([
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
          sentCount: { $sum: '$sentCount' }
        }
      }
    ]);

    res.status(200).json({
      status: true,
      message: 'Notification statistics retrieved successfully',
      data: {
        overview: stats[0] || {
          totalNotifications: 0,
          sentNotifications: 0,
          scheduledNotifications: 0,
          draftNotifications: 0,
          totalSent: 0,
          totalDelivered: 0,
          totalClicked: 0
        },
        typeBreakdown: typeStats
      }
    });

  } catch (error) {
    console.error('Get notification stats error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error retrieving notification statistics',
      error: error.message
    });
  }
};

// @desc    Register device token
// @route   POST /api/v0/notifications/register-token
// @access  Private (User)
const registerDeviceToken = async (req, res) => {
  try {
    const { token, platform, deviceInfo, preferences } = req.body;
    const userId = req.user.id;

    // Check if token already exists
    let deviceToken = await DeviceToken.findOne({ token });

    if (deviceToken) {
      // Update existing token
      deviceToken.userId = userId;
      deviceToken.platform = platform;
      deviceToken.deviceInfo = deviceInfo;
      deviceToken.preferences = { ...deviceToken.preferences, ...preferences };
      deviceToken.isActive = true;
      deviceToken.lastUsed = new Date();
    } else {
      // Create new token
      deviceToken = new DeviceToken({
        userId,
        token,
        platform,
        deviceInfo,
        preferences,
        isActive: true
      });
    }

    await deviceToken.save();

    res.status(200).json({
      status: true,
      message: 'Device token registered successfully',
      data: { deviceToken }
    });

  } catch (error) {
    console.error('Register device token error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error registering device token',
      error: error.message
    });
  }
};

// @desc    Update notification preferences
// @route   PUT /api/v0/notifications/preferences
// @access  Private (User)
const updateNotificationPreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    const userId = req.user.id;

    await DeviceToken.updateMany(
      { userId },
      { preferences }
    );

    res.status(200).json({
      status: true,
      message: 'Notification preferences updated successfully'
    });

  } catch (error) {
    console.error('Update notification preferences error:', error);
    res.status(500).json({
      status: false,
      message: 'Server error updating notification preferences',
      error: error.message
    });
  }
};

// @desc    Get notification history for user
// @route   GET /api/v0/notifications/history
// @access  Private (User)
const getNotificationHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 50, type, status } = req.query;
    
    // Build query to get all notifications visible to this user:
    // 1. General notifications (targetAudience: 'all')
    // 2. User-specific notifications (userId in targetUsers array)
    // 3. Segment-based notifications (for now, include all segments - can be refined later)
    const query = { 
      $or: [
        // General notifications for all users
        { targetAudience: 'all' },
        // User-specific notifications where this user is in the targetUsers array
        { targetUsers: { $in: [userId] } },
        // Segment-based notifications (include all for now)
        { 
          targetAudience: 'user_segment',
          targetSegment: { $exists: true, $ne: null }
        }
      ],
      // Only show sent notifications (not drafts or cancelled)
      status: { $in: ['sent', 'scheduled'] }
    };
    
    if (type) query.type = type;
    if (status) {
      // Override status filter if provided
      query.status = status;
    }
    
    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit))
      .populate('createdBy', 'name email')
      .populate('targetUsers', 'name email')
      .lean();
    
    // Add read status for each notification based on readBy array
    const notificationsWithReadStatus = notifications.map(notification => {
      const notificationId = notification._id.toString();
      const readByArray = notification.readBy || [];
      const isRead = readByArray.some(id => id.toString() === userId.toString());
      
      return {
        ...notification,
        isRead: isRead,
        readAt: isRead ? (notification.readAt || notification.updatedAt) : null
      };
    });
    
    const total = await Notification.countDocuments(query);
    
    res.status(200).json({
      status: true,
      data: {
        notifications: notificationsWithReadStatus,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          total
        }
      }
    });
  } catch (error) {
    console.error('Error getting notification history:', error);
    res.status(500).json({
      status: false,
      message: 'Server error getting notification history',
      error: error.message
    });
  }
};

// @desc    Mark notification as read
// @route   PUT /api/v0/notifications/:id/read
// @access  Private (User)
const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({
        status: false,
        message: 'Notification not found'
      });
    }
    
    // Add user to readBy array if not already there
    if (!notification.readBy.includes(userId)) {
      notification.readBy.push(userId);
      await notification.save();
    }
    
    res.status(200).json({
      status: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      status: false,
      message: 'Server error marking notification as read',
      error: error.message
    });
  }
};

// @desc    Get user notification stats
// @route   GET /api/v0/notifications/stats
// @access  Private (User)
const getUserNotificationStats = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const total = await Notification.countDocuments({
      $or: [
        { targetAudience: 'all' },
        { targetUsers: userId },
        { targetSegment: { $exists: true } }
      ]
    });
    
    const unread = await Notification.countDocuments({
      $or: [
        { targetAudience: 'all' },
        { targetUsers: userId },
        { targetSegment: { $exists: true } }
      ],
      readBy: { $nin: [userId] }
    });
    
    const byType = await Notification.aggregate([
      {
        $match: {
          $or: [
            { targetAudience: 'all' },
            { targetUsers: userId },
            { targetSegment: { $exists: true } }
          ]
        }
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.status(200).json({
      status: true,
      data: {
        total,
        unread,
        byType: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error getting user notification stats:', error);
    res.status(500).json({
      status: false,
      message: 'Server error getting notification stats',
      error: error.message
    });
  }
};

module.exports = {
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
  getUserNotificationStats
};
