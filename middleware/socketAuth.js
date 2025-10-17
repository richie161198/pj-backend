const jwt = require("jsonwebtoken");
const User = require("../models/userModel");
const { UserStatus } = require("../models/chatModel");

// Socket.IO authentication middleware
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return next(new Error("Authentication token required"));
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Get user from database
    const user = await User.findById(decoded.id).select("-password");
    
    if (!user) {
      return next(new Error("User not found"));
    }

    if (!user.active || user.isBlocked) {
      return next(new Error("User account is inactive or blocked"));
    }

    // Attach user to socket
    socket.user = user;
    socket.userId = user._id.toString();
    
    next();
  } catch (error) {
    console.error("Socket authentication error:", error);
    next(new Error("Authentication failed"));
  }
};

// Update user online status
const updateUserStatus = async (userId, isOnline, socketId = null) => {
  try {
    const updateData = {
      user: userId,
      isOnline,
      lastSeen: new Date(),
      ...(socketId && { socketId })
    };

    await UserStatus.findOneAndUpdate(
      { user: userId },
      updateData,
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error("Error updating user status:", error);
  }
};

module.exports = {
  socketAuth,
  updateUserStatus
};

