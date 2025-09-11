const { Message, Conversation, UserStatus } = require("../models/chatModel");
const User = require("../models/userModel");
const { updateUserStatus } = require("../middleware/socketAuth");

class SocketService {
  constructor(io) {
    this.io = io;
    this.userSockets = new Map(); // userId -> Set of socketIds
    this.socketUsers = new Map(); // socketId -> userId
  }

  // Initialize socket connection
  initializeConnection(socket) {
    const userId = socket.userId;
    
    // Store socket mapping
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(socket.id);
    this.socketUsers.set(socket.id, userId);

    // Update user online status
    updateUserStatus(userId, true, socket.id);

    // Join user to their personal room
    socket.join(`user_${userId}`);

    // Join admin to admin room if user is admin
    if (socket.user.role === "admin") {
      socket.join("admin_room");
    }

    console.log(`User ${socket.user.name} connected with socket ${socket.id}`);
    
    // Emit user online status to relevant users
    this.emitUserStatusUpdate(userId, true);

    // Handle disconnection
    socket.on("disconnect", () => {
      this.handleDisconnection(socket);
    });

    // Handle private messages
    socket.on("send_message", (data) => {
      this.handleSendMessage(socket, data);
    });

    // Handle typing indicators
    socket.on("typing_start", (data) => {
      this.handleTypingStart(socket, data);
    });

    socket.on("typing_stop", (data) => {
      this.handleTypingStop(socket, data);
    });

    // Handle message read status
    socket.on("mark_message_read", (data) => {
      this.handleMarkMessageRead(socket, data);
    });

    // Handle admin broadcast
    socket.on("admin_broadcast", (data) => {
      this.handleAdminBroadcast(socket, data);
    });

    // Handle admin message to user
    socket.on("admin_message_user", (data) => {
      this.handleAdminMessageUser(socket, data);
    });

    // Handle join conversation
    socket.on("join_conversation", (data) => {
      this.handleJoinConversation(socket, data);
    });

    // Handle leave conversation
    socket.on("leave_conversation", (data) => {
      this.handleLeaveConversation(socket, data);
    });
  }

  // Handle user disconnection
  async handleDisconnection(socket) {
    const userId = this.socketUsers.get(socket.id);
    
    if (userId) {
      // Remove socket from user's socket set
      const userSockets = this.userSockets.get(userId);
      if (userSockets) {
        userSockets.delete(socket.id);
        
        // If no more sockets for this user, mark as offline
        if (userSockets.size === 0) {
          this.userSockets.delete(userId);
          await updateUserStatus(userId, false);
          this.emitUserStatusUpdate(userId, false);
        }
      }
      
      this.socketUsers.delete(socket.id);
    }

    console.log(`Socket ${socket.id} disconnected`);
  }

  // Handle sending private messages
  async handleSendMessage(socket, data) {
    try {
      const { receiverId, message, messageType = "text", replyTo } = data;
      const senderId = socket.userId;

      if (!receiverId || !message) {
        socket.emit("error", { message: "Receiver ID and message are required" });
        return;
      }

      // Check if receiver exists
      const receiver = await User.findById(receiverId);
      if (!receiver) {
        socket.emit("error", { message: "Receiver not found" });
        return;
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

      // Emit to sender
      socket.emit("message_sent", {
        success: true,
        data: newMessage
      });

      // Emit to receiver if online
      const receiverSockets = this.userSockets.get(receiverId);
      if (receiverSockets && receiverSockets.size > 0) {
        this.io.to(`user_${receiverId}`).emit("new_message", {
          success: true,
          data: newMessage
        });
      }

      // Emit conversation update to both users
      this.io.to(`user_${senderId}`).emit("conversation_updated", {
        conversationId: conversation._id,
        lastMessage: newMessage
      });
      
      this.io.to(`user_${receiverId}`).emit("conversation_updated", {
        conversationId: conversation._id,
        lastMessage: newMessage
      });

    } catch (error) {
      console.error("Error handling send message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  }

  // Handle typing indicators
  handleTypingStart(socket, data) {
    const { receiverId } = data;
    const senderId = socket.userId;

    if (receiverId) {
      this.io.to(`user_${receiverId}`).emit("user_typing", {
        senderId,
        senderName: socket.user.name,
        isTyping: true
      });
    }
  }

  handleTypingStop(socket, data) {
    const { receiverId } = data;
    const senderId = socket.userId;

    if (receiverId) {
      this.io.to(`user_${receiverId}`).emit("user_typing", {
        senderId,
        senderName: socket.user.name,
        isTyping: false
      });
    }
  }

  // Handle marking message as read
  async handleMarkMessageRead(socket, data) {
    try {
      const { messageId } = data;
      const userId = socket.userId;

      const message = await Message.findOne({
        _id: messageId,
        receiver: userId,
        isRead: false
      });

      if (message) {
        message.isRead = true;
        message.readAt = new Date();
        await message.save();

        // Notify sender that message was read
        const senderSockets = this.userSockets.get(message.sender.toString());
        if (senderSockets && senderSockets.size > 0) {
          this.io.to(`user_${message.sender}`).emit("message_read", {
            messageId,
            readBy: userId,
            readAt: message.readAt
          });
        }
      }
    } catch (error) {
      console.error("Error marking message as read:", error);
    }
  }

  // Handle admin broadcast
  async handleAdminBroadcast(socket, data) {
    try {
      if (socket.user.role !== "admin") {
        socket.emit("error", { message: "Admin access required" });
        return;
      }

      const { message, messageType = "text" } = data;
      const adminId = socket.userId;

      if (!message) {
        socket.emit("error", { message: "Message is required" });
        return;
      }

      // Get all active users
      const users = await User.find({ active: true, isBlocked: false });

      // Create broadcast messages
      const broadcastMessages = users.map(user => ({
        sender: adminId,
        receiver: user._id,
        message,
        messageType,
        metadata: { isBroadcast: true }
      }));

      const messages = await Message.insertMany(broadcastMessages);

      // Emit to all online users
      this.io.emit("admin_broadcast", {
        success: true,
        data: {
          message,
          messageType,
          sentBy: socket.user.name,
          sentAt: new Date(),
          messageCount: messages.length
        }
      });

      socket.emit("broadcast_sent", {
        success: true,
        messageCount: messages.length
      });

    } catch (error) {
      console.error("Error handling admin broadcast:", error);
      socket.emit("error", { message: "Failed to send broadcast" });
    }
  }

  // Handle admin message to specific user
  async handleAdminMessageUser(socket, data) {
    try {
      if (socket.user.role !== "admin") {
        socket.emit("error", { message: "Admin access required" });
        return;
      }

      const { userId, message, messageType = "text" } = data;
      const adminId = socket.userId;

      if (!userId || !message) {
        socket.emit("error", { message: "User ID and message are required" });
        return;
      }

      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        socket.emit("error", { message: "User not found" });
        return;
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

      // Emit to admin
      socket.emit("admin_message_sent", {
        success: true,
        data: newMessage
      });

      // Emit to user if online
      const userSockets = this.userSockets.get(userId);
      if (userSockets && userSockets.size > 0) {
        this.io.to(`user_${userId}`).emit("new_message", {
          success: true,
          data: newMessage
        });
      }

    } catch (error) {
      console.error("Error handling admin message:", error);
      socket.emit("error", { message: "Failed to send message" });
    }
  }

  // Handle joining conversation
  handleJoinConversation(socket, data) {
    const { conversationId } = data;
    if (conversationId) {
      socket.join(`conversation_${conversationId}`);
    }
  }

  // Handle leaving conversation
  handleLeaveConversation(socket, data) {
    const { conversationId } = data;
    if (conversationId) {
      socket.leave(`conversation_${conversationId}`);
    }
  }

  // Emit user status update
  emitUserStatusUpdate(userId, isOnline) {
    this.io.emit("user_status_update", {
      userId,
      isOnline,
      timestamp: new Date()
    });
  }

  // Get online users count
  getOnlineUsersCount() {
    return this.userSockets.size;
  }

  // Get user's socket count
  getUserSocketCount(userId) {
    const sockets = this.userSockets.get(userId);
    return sockets ? sockets.size : 0;
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.userSockets.has(userId) && this.userSockets.get(userId).size > 0;
  }

  // Send message to specific user
  sendToUser(userId, event, data) {
    this.io.to(`user_${userId}`).emit(event, data);
  }

  // Send message to admin room
  sendToAdmins(event, data) {
    this.io.to("admin_room").emit(event, data);
  }

  // Broadcast to all users
  broadcast(event, data) {
    this.io.emit(event, data);
  }
}

module.exports = SocketService;
