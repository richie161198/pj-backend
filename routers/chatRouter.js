const express = require('express');
const router = express.Router();
const {
  getAllChats,
  getChatById,
  createChat,
  sendMessage,
  markAsRead,
  assignChat,
  updateChatStatus,
  getChatStats,
  closeChat
} = require('../controller/chatController');
const { isAuth } = require('../middleware/tokenValidation');

// Get all chats (admin only)
router.get('/chats', isAuth, getAllChats);

// Get chat statistics (admin only)
router.get('/chats/stats', isAuth, getChatStats);

// Get specific chat
router.get('/chats/:chatId', isAuth, getChatById);

// Create new chat
router.post('/chats', isAuth, createChat);

// Send message
router.post('/chats/:chatId/messages', isAuth, sendMessage);

// Mark messages as read
router.put('/chats/:chatId/read', isAuth, markAsRead);

// Assign chat to admin
router.put('/chats/:chatId/assign', isAuth, assignChat);

// Update chat status
router.put('/chats/:chatId/status', isAuth, updateChatStatus);

// Close chat
router.put('/chats/:chatId/close', isAuth, closeChat);

module.exports = router;
