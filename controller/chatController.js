const { Message, Conversation, ChatRoom, UserStatus, MessageReaction } = require("../models/chatModel");
const User = require("../models/userModel");
const asyncHandler = require("express-async-handler");

// Get or create conversation between two users
const getOrCreateConversation = asyncHandler(async (req, res) => {
  const { receiverId } = req.params;
  const senderId = req.user._id;

  if (senderId.toString() === receiverId) {
    return res.status(400).json({
      success: false,
      message: "Cannot create conversation with yourself"
    });
  }

  // Check if receiver exists
  const receiver = await User.findById(receiverId);
  if (!receiver) {
    return res.status(404).json({
      success: false,
      message: "Receiver not found"
    });
  }

  // Find existing conversation
  let conversation = await Conversation.findOne({
    participants: { $all: [senderId, receiverId] },
    conversationType: "private"
  }).populate("participants", "name email profilePhoto");

  // Create new conversation if doesn't exist
  if (!conversation) {
    conversation = new Conversation({
      participants: [senderId, receiverId],
      conversationType: "private",
      createdBy: senderId
    });
    await conversation.save();
    await conversation.populate("participants", "name email profilePhoto");
  }

  res.json({
    success: true,
    data: conversation
  });
});

// Send message
const sendMessage = asyncHandler(async (req, res) => {
  const { receiverId, message, messageType = "text", replyTo } = req.body;
  const senderId = req.user._id;

  if (!receiverId || !message) {
    return res.status(400).json({
      success: false,
      message: "Receiver ID and message are required"
    });
  }

  // Get or create conversation
  let conversation = await Conversation.findOne({
    participants: { $all: [senderId, receiverId] },
    conversationType: "private"
  });

  if (!conversation) {
    conversation = new Conversation({
      participants: [senderId, receiverId],
      conversationType: "private",
      createdBy: senderId
    });
    await conversation.save();
  }

  // Create message
  const newMessage = new Message({
    sender: senderId,
    receiver: receiverId,
    message,
    messageType,
    replyTo
  });

  await newMessage.save();

  // Update conversation
  conversation.lastMessage = newMessage._id;
  conversation.lastMessageAt = new Date();
  await conversation.save();

  // Populate message data
  await newMessage.populate([
    { path: "sender", select: "name email profilePhoto" },
    { path: "receiver", select: "name email profilePhoto" },
    { path: "replyTo", select: "message sender", populate: { path: "sender", select: "name" } }
  ]);

  res.json({
    success: true,
    data: newMessage
  });
});

// Get conversation messages
const getConversationMessages = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;
  const { page = 1, limit = 50 } = req.query;

  // Verify user is participant in conversation
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !conversation.participants.includes(userId)) {
    return res.status(403).json({
      success: false,
      message: "Access denied to this conversation"
    });
  }

  const messages = await Message.find({
    $or: [
      { sender: userId, receiver: { $in: conversation.participants } },
      { sender: { $in: conversation.participants }, receiver: userId }
    ],
    isDeleted: false
  })
    .populate("sender", "name email profilePhoto")
    .populate("receiver", "name email profilePhoto")
    .populate("replyTo", "message sender")
    .sort({ createdAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  res.json({
    success: true,
    data: messages.reverse(),
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: await Message.countDocuments({
        $or: [
          { sender: userId, receiver: { $in: conversation.participants } },
          { sender: { $in: conversation.participants }, receiver: userId }
        ],
        isDeleted: false
      })
    }
  });
});

// Get user conversations
const getUserConversations = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 20 } = req.query;

  const conversations = await Conversation.find({
    participants: userId,
    isActive: true
  })
    .populate("participants", "name email profilePhoto")
    .populate("lastMessage")
    .populate("createdBy", "name")
    .sort({ lastMessageAt: -1 })
    .limit(limit * 1)
    .skip((page - 1) * limit);

  res.json({
    success: true,
    data: conversations,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: await Conversation.countDocuments({
        participants: userId,
        isActive: true
      })
    }
  });
});

// Mark message as read
const markMessageAsRead = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  const message = await Message.findOne({
    _id: messageId,
    receiver: userId,
    isRead: false
  });

  if (!message) {
    return res.status(404).json({
      success: false,
      message: "Message not found or already read"
    });
  }

  message.isRead = true;
  message.readAt = new Date();
  await message.save();

  res.json({
    success: true,
    message: "Message marked as read"
  });
});

// Mark all messages in conversation as read
const markConversationAsRead = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user._id;

  // Verify user is participant
  const conversation = await Conversation.findById(conversationId);
  if (!conversation || !conversation.participants.includes(userId)) {
    return res.status(403).json({
      success: false,
      message: "Access denied"
    });
  }

  await Message.updateMany(
    {
      receiver: userId,
      sender: { $in: conversation.participants },
      isRead: false
    },
    {
      isRead: true,
      readAt: new Date()
    }
  );

  res.json({
    success: true,
    message: "All messages marked as read"
  });
});

// Delete message
const deleteMessage = asyncHandler(async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  const message = await Message.findOne({
    _id: messageId,
    sender: userId
  });

  if (!message) {
    return res.status(404).json({
      success: false,
      message: "Message not found or access denied"
    });
  }

  message.isDeleted = true;
  message.deletedAt = new Date();
  await message.save();

  res.json({
    success: true,
    message: "Message deleted successfully"
  });
});

// Get unread message count
const getUnreadCount = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const unreadCount = await Message.countDocuments({
    receiver: userId,
    isRead: false,
    isDeleted: false
  });

  res.json({
    success: true,
    data: { unreadCount }
  });
});

// Admin: Send broadcast message to all users
const sendBroadcastMessage = asyncHandler(async (req, res) => {
  const { message, messageType = "text", roomType = "admin_broadcast" } = req.body;
  const adminId = req.user._id;

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }

  if (!message) {
    return res.status(400).json({
      success: false,
      message: "Message is required"
    });
  }

  // Get all active users
  const users = await User.find({ active: true, isBlocked: false });

  // Create broadcast message for each user
  const broadcastMessages = users.map(user => ({
    sender: adminId,
    receiver: user._id,
    message,
    messageType,
    metadata: { isBroadcast: true, roomType }
  }));

  const messages = await Message.insertMany(broadcastMessages);

  res.json({
    success: true,
    data: {
      messageCount: messages.length,
      message: "Broadcast sent successfully"
    }
  });
});

// Admin: Send message to specific user
const sendMessageToUser = asyncHandler(async (req, res) => {
  const { userId, message, messageType = "text" } = req.body;
  const adminId = req.user._id;

  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required"
    });
  }

  if (!userId || !message) {
    return res.status(400).json({
      success: false,
      message: "User ID and message are required"
    });
  }

  // Check if user exists
  const user = await User.findById(userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  }

  // Create message
  const newMessage = new Message({
    sender: adminId,
    receiver: userId,
    message,
    messageType,
    metadata: { isAdminMessage: true }
  });

  await newMessage.save();

  // Get or create conversation
  let conversation = await Conversation.findOne({
    participants: { $all: [adminId, userId] },
    conversationType: "private"
  });

  if (!conversation) {
    conversation = new Conversation({
      participants: [adminId, userId],
      conversationType: "private",
      createdBy: adminId
    });
    await conversation.save();
  }

  // Update conversation
  conversation.lastMessage = newMessage._id;
  conversation.lastMessageAt = new Date();
  await conversation.save();

  await newMessage.populate([
    { path: "sender", select: "name email profilePhoto role" },
    { path: "receiver", select: "name email profilePhoto" }
  ]);

  res.json({
    success: true,
    data: newMessage
  });
});

// Get online users
const getOnlineUsers = asyncHandler(async (req, res) => {
  const onlineUsers = await UserStatus.find({ isOnline: true })
    .populate("user", "name email profilePhoto")
    .sort({ lastSeen: -1 });

  res.json({
    success: true,
    data: onlineUsers
  });
});

// Get user status
const getUserStatus = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const userStatus = await UserStatus.findOne({ user: userId })
    .populate("user", "name email profilePhoto");

  if (!userStatus) {
    return res.json({
      success: true,
      data: {
        user: await User.findById(userId).select("name email profilePhoto"),
        isOnline: false,
        lastSeen: null
      }
    });
  }

  res.json({
    success: true,
    data: userStatus
  });
});

module.exports = {
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
};
