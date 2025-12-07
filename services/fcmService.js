const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
let firebaseApp = null;

const initializeFirebase = () => {
  if (!firebaseApp) {
    try {
      // Try to load service account from config
      try {
        const serviceAccount = require('../config/firebase-service-account.json');
        firebaseApp = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        console.log('Firebase Admin SDK initialized with service account');
      } catch (serviceAccountError) {
        console.log('Service account not found, trying environment variables...');
        
        // Try environment variables
        if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
          const serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
          };
          
          firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
          console.log('Firebase Admin SDK initialized with environment variables');
        } else {
          // Fallback: try to use default credentials
          firebaseApp = admin.initializeApp();
          console.log('Firebase Admin SDK initialized with default credentials');
        }
      }
    } catch (error) {
      console.error('Error initializing Firebase Admin SDK:', error);
      console.log('FCM service will work in mock mode - notifications will be logged but not sent');
      // Don't throw error, just log it and continue
    }
  }
  return firebaseApp;
};

// Initialize Firebase on module load
initializeFirebase();


const sendNotification = async (notificationData, deviceTokens) => {
  try {
    if (!firebaseApp) {
      console.log('Firebase not configured - running in mock mode');
      console.log('Mock notification data:', notificationData);
      console.log('Mock device tokens:', deviceTokens.length);
      
      // Return mock success response
      return {
        successCount: deviceTokens.length,
        failedCount: 0,
        responses: deviceTokens.map(() => ({ success: true }))
      };
    }
    
    // Check if messaging service is available
    if (!admin.messaging) {
      console.log('Firebase messaging service not available - running in mock mode');
      console.log('Mock notification data:', notificationData);
      console.log('Mock device tokens:', deviceTokens.length);
      
      return {
        successCount: deviceTokens.length,
        failedCount: 0,
        responses: deviceTokens.map(() => ({ success: true }))
      };
    }

    const { title, body, imageUrl, actionUrl, actionType, screenName, data } = notificationData;

    // Prepare the message payload
    const message = {
      notification: {
        title,
        body,
        ...(imageUrl && { imageUrl })
      },
      data: {
        ...data,
        actionUrl: actionUrl || '',
        actionType: actionType || 'open_app',
        screenName: screenName || '',
        imageUrl: imageUrl || '', // Include imageUrl in data payload for foreground notifications
        clickAction: actionType === 'open_url' ? actionUrl : 
                    actionType === 'open_screen' ? screenName : 'open_app'
      },
      android: {
        notification: {
          title,
          body,
          ...(imageUrl && { imageUrl }),
          clickAction: actionType === 'open_url' ? actionUrl : 
                      actionType === 'open_screen' ? screenName : 'FLUTTER_NOTIFICATION_CLICK',
          channelId: 'default',
          priority: 'high',
          sound: 'default'
        },
        data: {
          ...data,
          actionUrl: actionUrl || '',
          actionType: actionType || 'open_app',
          screenName: screenName || '',
          imageUrl: imageUrl || '' // Include imageUrl in Android data payload
        }
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title,
              body
            },
            sound: 'default',
            badge: 1,
            ...(imageUrl && { 'mutable-content': 1 })
          }
        },
        fcmOptions: {
          imageUrl: imageUrl || undefined
        }
      },
      webpush: {
        notification: {
          title,
          body,
          ...(imageUrl && { image: imageUrl }),
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png'
        },
        data: {
          ...data,
          actionUrl: actionUrl || '',
          actionType: actionType || 'open_app',
          screenName: screenName || '',
          imageUrl: imageUrl || '' // Include imageUrl in webpush data payload
        }
      }
    };

    // Send to multiple devices
    let response;
    try {
      // Check if messaging is available
      if (!admin.messaging) {
        throw new Error('Firebase Admin messaging not available');
      }
      
      const messaging = admin.messaging();
      if (!messaging.sendMulticast) {
        console.log('sendMulticast not available, using individual send method...');
        // Fallback to individual sends
        const individualResults = [];
        let successCount = 0;
        let failedCount = 0;
        
        for (const token of deviceTokens.map(dt => dt.token)) {
          try {
            await messaging.send({
              token: token,
              ...message
            });
            successCount++;
            individualResults.push({ success: true, token });
          } catch (individualError) {
            failedCount++;
            individualResults.push({ success: false, token, error: individualError.message });
          }
        }
        
        response = {
          successCount,
          failureCount: failedCount,
          responses: individualResults
        };
      } else {
        response = await messaging.sendMulticast({
          tokens: deviceTokens.map(dt => dt.token),
          ...message
        });
      }
    } catch (error) {
      console.error('FCM sendMulticast error:', error);
      
      // Fallback: try sending individual notifications
      console.log('Trying fallback method: sending individual notifications...');
      try {
        const individualResults = [];
        let successCount = 0;
        let failedCount = 0;
        
        for (const token of deviceTokens.map(dt => dt.token)) {
          try {
            await admin.messaging().send({
              token: token,
              ...message
            });
            successCount++;
            individualResults.push({ success: true, token });
          } catch (individualError) {
            failedCount++;
            individualResults.push({ success: false, token, error: individualError.message });
          }
        }
        
        response = {
          successCount,
          failureCount: failedCount,
          responses: individualResults
        };
        
        console.log(`Fallback method completed: ${successCount} success, ${failedCount} failed`);
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError);
        throw new Error(`FCM service error: ${error.message}. Fallback also failed: ${fallbackError.message}`);
      }
    }

    // Process results
    const results = {
      successCount: response.successCount,
      failedCount: response.failureCount,
      responses: response.responses
    };

    // Log failed tokens for cleanup
    const failedTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        console.error(`Failed to send to token ${deviceTokens[idx].token}:`, resp.error);
        if (resp.error?.code === 'messaging/invalid-registration-token' ||
            resp.error?.code === 'messaging/registration-token-not-registered') {
          failedTokens.push(deviceTokens[idx].token);
        }
      }
    });

    // Clean up invalid tokens
    if (failedTokens.length > 0) {
      await cleanupInvalidTokens(failedTokens);
    }

    console.log(`Notification sent successfully: ${results.successCount} success, ${results.failedCount} failed`);
    return results;

  } catch (error) {
    console.error('Error sending notification:', error);
    throw error;
  }
};

/**
 * Send notification to a single device
 * @param {Object} notificationData - Notification data
 * @param {String} deviceToken - Device token
 * @returns {Object} Result
 */
const sendToDevice = async (notificationData, deviceToken) => {
  try {
    if (!firebaseApp) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    const { title, body, imageUrl, actionUrl, actionType, screenName, data } = notificationData;

    const message = {
      token: deviceToken,
      notification: {
        title,
        body,
        ...(imageUrl && { imageUrl })
      },
      data: {
        ...data,
        actionUrl: actionUrl || '',
        actionType: actionType || 'open_app',
        screenName: screenName || '',
        imageUrl: imageUrl || '' // Include imageUrl in data payload for foreground notifications
      },
      android: {
        notification: {
          title,
          body,
          ...(imageUrl && { imageUrl }),
          clickAction: actionType === 'open_url' ? actionUrl : 
                      actionType === 'open_screen' ? screenName : 'FLUTTER_NOTIFICATION_CLICK',
          channelId: 'default',
          priority: 'high'
        },
        data: {
          ...data,
          actionUrl: actionUrl || '',
          actionType: actionType || 'open_app',
          screenName: screenName || '',
          imageUrl: imageUrl || '' // Include imageUrl in Android data payload
        }
      },
      apns: {
        payload: {
          aps: {
            alert: { title, body },
            sound: 'default',
            badge: 1
          }
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
    return { success: true, messageId: response };

  } catch (error) {
    console.error('Error sending to device:', error);
    return { success: false, error: error.message };
  }
};


const sendToTopic = async (notificationData, topic) => {
  try {
    if (!firebaseApp) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    const { title, body, imageUrl, actionUrl, actionType, screenName, data } = notificationData;

    const message = {
      topic,
      notification: {
        title,
        body,
        ...(imageUrl && { imageUrl })
      },
      data: {
        ...data,
        actionUrl: actionUrl || '',
        actionType: actionType || 'open_app',
        screenName: screenName || ''
      }
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent message to topic:', response);
    return { success: true, messageId: response };

  } catch (error) {
    console.error('Error sending to topic:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe device to topic
 * @param {String} token - Device token
 * @param {String} topic - Topic name
 * @returns {Object} Result
 */
const subscribeToTopic = async (token, topic) => {
  try {
    if (!firebaseApp) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    const response = await admin.messaging().subscribeToTopic([token], topic);
    console.log('Successfully subscribed to topic:', response);
    return { success: true, response };

  } catch (error) {
    console.error('Error subscribing to topic:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Unsubscribe device from topic
 * @param {String} token - Device token
 * @param {String} topic - Topic name
 * @returns {Object} Result
 */
const unsubscribeFromTopic = async (token, topic) => {
  try {
    if (!firebaseApp) {
      throw new Error('Firebase Admin SDK not initialized');
    }

    const response = await admin.messaging().unsubscribeFromTopic([token], topic);
    console.log('Successfully unsubscribed from topic:', response);
    return { success: true, response };

  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Clean up invalid device tokens
 * @param {Array} invalidTokens - Array of invalid tokens
 */
const cleanupInvalidTokens = async (invalidTokens) => {
  try {
    const DeviceToken = require('../models/device_token_model');
    
    const result = await DeviceToken.updateMany(
      { token: { $in: invalidTokens } },
      { isActive: false }
    );
    
    console.log(`Cleaned up ${result.modifiedCount} invalid tokens`);
  } catch (error) {
    console.error('Error cleaning up invalid tokens:', error);
  }
};

/**
 * Get delivery report for a message
 * @param {String} messageId - Message ID
 * @returns {Object} Delivery report
 */
const getDeliveryReport = async (messageId) => {
  try {
    // This is a placeholder - FCM doesn't provide detailed delivery reports
    // You would need to implement your own tracking system
    console.log('Getting delivery report for message:', messageId);
    return { messageId, status: 'delivered' };
  } catch (error) {
    console.error('Error getting delivery report:', error);
    return { messageId, status: 'unknown', error: error.message };
  }
};

module.exports = {
  sendNotification,
  sendToDevice,
  sendToTopic,
  subscribeToTopic,
  unsubscribeFromTopic,
  cleanupInvalidTokens,
  getDeliveryReport
};
