const mongoose = require("mongoose");

// Message Schema
const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true
  },
  message: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: ["text", "image", "file", "system"],
    default: "text"
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message"
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Conversation Schema
const conversationSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true
  }],
  conversationType: {
    type: String,
    enum: ["private", "group", "admin_broadcast"],
    default: "private"
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message"
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users"
  },
  title: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  settings: {
    allowNewMembers: {
      type: Boolean,
      default: true
    },
    muteNotifications: {
      type: Boolean,
      default: false
    }
  }
}, {
  timestamps: true
});

// Chat Room Schema for admin broadcasts
const chatRoomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  roomType: {
    type: String,
    enum: ["admin_broadcast", "support", "announcement"],
    default: "admin_broadcast"
  },
  allowedUsers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users"
  }],
  settings: {
    allowUserMessages: {
      type: Boolean,
      default: false
    },
    autoJoin: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// User Online Status Schema
const userStatusSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
    unique: true
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  socketId: {
    type: String
  },
  deviceInfo: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Message Reactions Schema
const messageReactionSchema = new mongoose.Schema({
  message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true
  },
  reaction: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for better performance
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });
messageSchema.index({ conversation: 1, createdAt: -1 });
conversationSchema.index({ participants: 1 });
conversationSchema.index({ lastMessageAt: -1 });
userStatusSchema.index({ isOnline: 1 });
userStatusSchema.index({ lastSeen: -1 });

const Message = mongoose.model("Message", messageSchema);
const Conversation = mongoose.model("Conversation", conversationSchema);
const ChatRoom = mongoose.model("ChatRoom", chatRoomSchema);
const UserStatus = mongoose.model("UserStatus", userStatusSchema);
const MessageReaction = mongoose.model("MessageReaction", messageReactionSchema);

module.exports = {
  Message,
  Conversation,
  ChatRoom,
  UserStatus,
  MessageReaction
};
