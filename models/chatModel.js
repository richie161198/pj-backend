const mongoose = require('mongoose');

const chatSchema = new mongoose.Schema({
  participants: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      required: true
    },
    isOnline: {
      type: Boolean,
      default: false
    },
    lastSeen: {
      type: Date,
      default: Date.now
    }
  }],
  messages: [{
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    senderRole: {
      type: String,
      enum: ['user', 'admin'],
      required: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'system'],
      default: 'text'
    },
    attachments: [{
      filename: String,
      originalName: String,
      mimeType: String,
      size: Number,
      url: String
    }],
    isRead: {
      type: Boolean,
      default: false
    },
    readBy: [{
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      readAt: {
        type: Date,
        default: Date.now
      }
    }],
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  category: {
    type: String,
    enum: ['general', 'support', 'technical', 'billing', 'complaint'],
    default: 'general'
  },
  status: {
    type: String,
    enum: ['open', 'closed', 'pending', 'resolved'],
    default: 'open'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [String],
  metadata: {
    userAgent: String,
    ipAddress: String,
    deviceType: String,
    browser: String
  }
}, {
  timestamps: true
});

// Indexes for better performance
chatSchema.index({ 'participants.userId': 1 });
chatSchema.index({ 'messages.timestamp': -1 });
chatSchema.index({ status: 1, priority: 1 });
chatSchema.index({ createdAt: -1 });

// Virtual for unread message count
chatSchema.virtual('unreadCount').get(function() {
  return this.messages.filter(msg => !msg.isRead).length;
});

// Method to add a new message
chatSchema.methods.addMessage = function(senderId, senderRole, message, messageType = 'text', attachments = []) {
  const newMessage = {
    senderId,
    senderRole,
    message,
    messageType,
    attachments,
    timestamp: new Date()
  };
  
  this.messages.push(newMessage);
  return this.save();
};

// Method to mark messages as read
chatSchema.methods.markAsRead = function(userId) {
  this.messages.forEach(msg => {
    if (!msg.readBy.some(read => read.userId.toString() === userId.toString())) {
      msg.readBy.push({
        userId,
        readAt: new Date()
      });
    }
  });
  return this.save();
};

// Static method to find or create chat
chatSchema.statics.findOrCreateChat = async function(userId, adminId = null) {
  let chat = await this.findOne({
    'participants.userId': userId,
    isActive: true
  }).populate('participants.userId', 'name email profilePhoto');

  if (!chat) {
    const participants = [{
      userId,
      role: 'user'
    }];

    if (adminId) {
      participants.push({
        userId: adminId,
        role: 'admin'
      });
    }

    chat = new this({
      participants,
      messages: []
    });
    await chat.save();
  }

  return chat;
};

module.exports = mongoose.model('Chat', chatSchema);
