const Chat = require('../models/chatModel');
const User = require('../models/userModel');
const { validationResult } = require('express-validator');

// Get all chats for admin
const getAllChats = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, priority, category } = req.query;
    const skip = (page - 1) * limit;

    let filter = { isActive: true };
    if (status) filter.status = status;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;

    const chats = await Chat.find(filter)
      .populate('participants.userId', 'name email profilePhoto role')
      .populate('assignedTo', 'name email profilePhoto')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Chat.countDocuments(filter);

    res.status(200).json({
      status: true,
      message: 'Chats fetched successfully',
      data: {
        chats,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to fetch chats',
      error: error.message
    });
  }
};

// Get specific chat by ID
const getChatById = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.user;

    const chat = await Chat.findById(chatId)
      .populate('participants.userId', 'name email profilePhoto role')
      .populate('assignedTo', 'name email profilePhoto')
      .populate('messages.senderId', 'name email profilePhoto');

    if (!chat) {
      return res.status(404).json({
        status: false,
        message: 'Chat not found'
      });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      p => p.userId.toString() === userId.toString()
    );

    if (!isParticipant) {
      return res.status(403).json({
        status: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      status: true,
      message: 'Chat fetched successfully',
      data: chat
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to fetch chat',
      error: error.message
    });
  }
};

// Create new chat
const createChat = async (req, res) => {
  try {
    const { userId } = req.user;
    const { category = 'general', priority = 'medium' } = req.body;

    const chat = await Chat.findOrCreateChat(userId);
    
    // Update chat properties
    chat.category = category;
    chat.priority = priority;
    await chat.save();

    await chat.populate('participants.userId', 'name email profilePhoto role');

    res.status(201).json({
      status: true,
      message: 'Chat created successfully',
      data: chat
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to create chat',
      error: error.message
    });
  }
};

// Send message
const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.user;
    const { message, messageType = 'text', attachments = [] } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        status: false,
        message: 'Chat not found'
      });
    }

    // Check if user is participant
    const participant = chat.participants.find(
      p => p.userId.toString() === userId.toString()
    );

    if (!participant) {
      return res.status(403).json({
        status: false,
        message: 'Access denied'
      });
    }

    const updatedChat = await chat.addMessage(
      userId,
      participant.role,
      message,
      messageType,
      attachments
    );

    await updatedChat.populate('messages.senderId', 'name email profilePhoto');

    res.status(200).json({
      status: true,
      message: 'Message sent successfully',
      data: updatedChat.messages[updatedChat.messages.length - 1]
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to send message',
      error: error.message
    });
  }
};

// Mark messages as read
const markAsRead = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.user;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        status: false,
        message: 'Chat not found'
      });
    }

    await chat.markAsRead(userId);

    res.status(200).json({
      status: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to mark messages as read',
      error: error.message
    });
  }
};

// Assign chat to admin
const assignChat = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { adminId } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        status: false,
        message: 'Chat not found'
      });
    }

    // Check if admin exists and has admin role
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'admin') {
      return res.status(400).json({
        status: false,
        message: 'Invalid admin user'
      });
    }

    chat.assignedTo = adminId;
    await chat.save();

    await chat.populate('assignedTo', 'name email profilePhoto');

    res.status(200).json({
      status: true,
      message: 'Chat assigned successfully',
      data: chat
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to assign chat',
      error: error.message
    });
  }
};

// Update chat status
const updateChatStatus = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { status, priority, category, tags } = req.body;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        status: false,
        message: 'Chat not found'
      });
    }

    if (status) chat.status = status;
    if (priority) chat.priority = priority;
    if (category) chat.category = category;
    if (tags) chat.tags = tags;

    await chat.save();

    res.status(200).json({
      status: true,
      message: 'Chat updated successfully',
      data: chat
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to update chat',
      error: error.message
    });
  }
};

// Get chat statistics
const getChatStats = async (req, res) => {
  try {
    const stats = await Chat.aggregate([
      {
        $group: {
          _id: null,
          totalChats: { $sum: 1 },
          openChats: {
            $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] }
          },
          closedChats: {
            $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] }
          },
          pendingChats: {
            $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
          },
          resolvedChats: {
            $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
          }
        }
      }
    ]);

    const categoryStats = await Chat.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const priorityStats = await Chat.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      status: true,
      message: 'Chat statistics fetched successfully',
      data: {
        overview: stats[0] || {
          totalChats: 0,
          openChats: 0,
          closedChats: 0,
          pendingChats: 0,
          resolvedChats: 0
        },
        categoryStats,
        priorityStats
      }
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to fetch chat statistics',
      error: error.message
    });
  }
};

// Close chat
const closeChat = async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        status: false,
        message: 'Chat not found'
      });
    }

    chat.status = 'closed';
    chat.isActive = false;
    await chat.save();

    res.status(200).json({
      status: true,
      message: 'Chat closed successfully',
      data: chat
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to close chat',
      error: error.message
    });
  }
};

module.exports = {
  getAllChats,
  getChatById,
  createChat,
  sendMessage,
  markAsRead,
  assignChat,
  updateChatStatus,
  getChatStats,
  closeChat
};
