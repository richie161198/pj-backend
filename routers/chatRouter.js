const express = require("express");
const router = express.Router();
const {
  getOrCreateConversation,
  sendMessage,
  getConversationMessages,
  getUserConversations,
  markMessageAsRead,
  markConversationAsRead,
  deleteMessage,
  getUnreadCount,
  sendBroadcastMessage,
  sendMessageToUser,
  getOnlineUsers,
  getUserStatus
} = require("../controller/chatController");
const { protect } = require("../middleware/tokenValidation");

// Apply authentication middleware to all routes
router.use(protect);

// User routes
router.get("/conversations", getUserConversations);
router.get("/unread-count", getUnreadCount);
router.get("/online-users", getOnlineUsers);
router.get("/user-status/:userId", getUserStatus);

// Conversation routes
router.get("/conversation/:receiverId", getOrCreateConversation);
router.get("/conversation/:conversationId/messages", getConversationMessages);

// Message routes
router.post("/send", sendMessage);
router.put("/message/:messageId/read", markMessageAsRead);
router.put("/conversation/:conversationId/read", markConversationAsRead);
router.delete("/message/:messageId", deleteMessage);

// Admin routes
router.post("/admin/broadcast", sendBroadcastMessage);
router.post("/admin/send-to-user", sendMessageToUser);

module.exports = router;
