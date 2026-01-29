const Notification = require('../models/notification_model');
const DeviceToken = require('../models/device_token_model');
const User = require('../models/userModel');
const fcmService = require('./fcmService');

let schedulerInterval = null;
let isRunning = false;


const processScheduledNotification = async (notification) => {
  try {
    console.log(`Processing scheduled notification: ${notification._id} - ${notification.title}`);

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
      console.log(`No active device tokens found for notification: ${notification._id}`);
      // Update status to failed if no tokens found
      notification.status = 'failed';
      await notification.save();
      return;
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
    notification.sentCount = result.successCount || 0;
    await notification.save();

    console.log(`Notification ${notification._id} sent successfully to ${result.successCount || 0} devices`);

  } catch (error) {
    console.error(`Error processing scheduled notification ${notification._id}:`, error);
    
    // Update notification status to failed
    try {
      notification.status = 'failed';
      await notification.save();
    } catch (updateError) {
      console.error('Error updating notification status:', updateError);
    }
  }
};

/**
 * Check for scheduled notifications that need to be sent
 */
const checkScheduledNotifications = async () => {
  try {
    const now = new Date();
    
    // Find notifications that are scheduled and the scheduledAt time has passed
    const scheduledNotifications = await Notification.find({
      status: 'scheduled',
      scheduledAt: { $lte: now }
    });

    if (scheduledNotifications.length > 0) {
      console.log(`Found ${scheduledNotifications.length} scheduled notification(s) to send`);
      
      // Process each notification
      for (const notification of scheduledNotifications) {
        await processScheduledNotification(notification);
      }
    }
  } catch (error) {
    console.error('Error checking scheduled notifications:', error);
  }
};

/**
 * Start the notification scheduler
 * Checks every 30 seconds for scheduled notifications
 */
const startNotificationScheduler = () => {
  if (isRunning) {
    console.log('Notification scheduler is already running');
    return;
  }

  console.log('Starting notification scheduler...');
  isRunning = true;

  // Check immediately on start
  checkScheduledNotifications();

  // Then check every 30 seconds
  schedulerInterval = setInterval(() => {
    checkScheduledNotifications();
  }, 30000); // 30 seconds

  console.log('Notification scheduler started. Checking every 30 seconds.');
};

/**
 * Stop the notification scheduler
 */
const stopNotificationScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    isRunning = false;
    console.log('Notification scheduler stopped');
  }
};

module.exports = {
  startNotificationScheduler,
  stopNotificationScheduler,
  checkScheduledNotifications,
  processScheduledNotification
};

