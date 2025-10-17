# Chat System Integration Guide

## Overview
This chat system provides real-time messaging capabilities with the following features:
- User-to-user private messaging
- Admin broadcast messages to all users
- Admin-to-single-user messaging
- Typing indicators
- Message read receipts
- Online/offline status
- Message history and pagination

## Backend API Endpoints

### Authentication
All chat endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### REST API Endpoints

#### User Routes
- `GET /api/v0/chat/conversations` - Get user's conversations
- `GET /api/v0/chat/unread-count` - Get unread message count
- `GET /api/v0/chat/online-users` - Get list of online users
- `GET /api/v0/chat/user-status/:userId` - Get specific user's status

#### Conversation Routes
- `GET /api/v0/chat/conversation/:receiverId` - Get or create conversation with user
- `GET /api/v0/chat/conversation/:conversationId/messages` - Get conversation messages

#### Message Routes
- `POST /api/v0/chat/send` - Send a message
- `PUT /api/v0/chat/message/:messageId/read` - Mark message as read
- `PUT /api/v0/chat/conversation/:conversationId/read` - Mark all messages in conversation as read
- `DELETE /api/v0/chat/message/:messageId` - Delete a message

#### Admin Routes
- `POST /api/v0/chat/admin/broadcast` - Send broadcast message to all users
- `POST /api/v0/chat/admin/send-to-user` - Send message to specific user

## Socket.IO Events

### Client to Server Events

#### Connection
```javascript
const socket = io('your-server-url', {
  auth: {
    token: 'your-jwt-token'
  }
});
```

#### Send Message
```javascript
socket.emit('send_message', {
  receiverId: 'user-id',
  message: 'Hello!',
  messageType: 'text', // optional: 'text', 'image', 'file'
  replyTo: 'message-id' // optional: for replies
});
```

#### Typing Indicators
```javascript
// Start typing
socket.emit('typing_start', {
  receiverId: 'user-id'
});

// Stop typing
socket.emit('typing_stop', {
  receiverId: 'user-id'
});
```

#### Message Read Status
```javascript
socket.emit('mark_message_read', {
  messageId: 'message-id'
});
```

#### Join/Leave Conversation
```javascript
// Join conversation room
socket.emit('join_conversation', {
  conversationId: 'conversation-id'
});

// Leave conversation room
socket.emit('leave_conversation', {
  conversationId: 'conversation-id'
});
```

#### Admin Events
```javascript
// Admin broadcast (admin only)
socket.emit('admin_broadcast', {
  message: 'Important announcement!',
  messageType: 'text'
});

// Admin message to specific user (admin only)
socket.emit('admin_message_user', {
  userId: 'user-id',
  message: 'Hello from admin',
  messageType: 'text'
});
```

### Server to Client Events

#### New Message
```javascript
socket.on('new_message', (data) => {
  console.log('New message received:', data);
  // data.data contains the message object
});
```

#### Message Sent Confirmation
```javascript
socket.on('message_sent', (data) => {
  console.log('Message sent successfully:', data);
});
```

#### Typing Indicators
```javascript
socket.on('user_typing', (data) => {
  console.log('User typing:', data);
  // data.senderId, data.senderName, data.isTyping
});
```

#### Message Read Receipt
```javascript
socket.on('message_read', (data) => {
  console.log('Message read:', data);
  // data.messageId, data.readBy, data.readAt
});
```

#### Conversation Updates
```javascript
socket.on('conversation_updated', (data) => {
  console.log('Conversation updated:', data);
  // data.conversationId, data.lastMessage
});
```

#### Admin Broadcast
```javascript
socket.on('admin_broadcast', (data) => {
  console.log('Admin broadcast:', data);
  // data.message, data.sentBy, data.sentAt
});
```

#### User Status Updates
```javascript
socket.on('user_status_update', (data) => {
  console.log('User status changed:', data);
  // data.userId, data.isOnline, data.timestamp
});
```

#### Error Handling
```javascript
socket.on('error', (data) => {
  console.error('Socket error:', data.message);
});
```

## Frontend Integration Example

### React.js Example

```javascript
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const ChatComponent = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const newSocket = io('your-server-url', {
      auth: { token }
    });

    newSocket.on('connect', () => {
      console.log('Connected to chat server');
    });

    newSocket.on('new_message', (data) => {
      setMessages(prev => [...prev, data.data]);
    });

    newSocket.on('user_typing', (data) => {
      setTypingUsers(prev => ({
        ...prev,
        [data.senderId]: data.isTyping
      }));
    });

    newSocket.on('user_status_update', (data) => {
      // Update online status in your state
      console.log('User status update:', data);
    });

    newSocket.on('admin_broadcast', (data) => {
      // Show admin broadcast notification
      console.log('Admin broadcast:', data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

  const sendMessage = (receiverId, message) => {
    if (socket) {
      socket.emit('send_message', {
        receiverId,
        message,
        messageType: 'text'
      });
    }
  };

  const startTyping = (receiverId) => {
    if (socket) {
      socket.emit('typing_start', { receiverId });
    }
  };

  const stopTyping = (receiverId) => {
    if (socket) {
      socket.emit('typing_stop', { receiverId });
    }
  };

  return (
    <div>
      {/* Your chat UI components */}
    </div>
  );
};
```


## Database Models

### Message Schema
```javascript
{
  sender: ObjectId, // User who sent the message
  receiver: ObjectId, // User who receives the message
  message: String, // Message content
  messageType: String, // 'text', 'image', 'file', 'system'
  isRead: Boolean, // Read status
  readAt: Date, // When message was read
  isDeleted: Boolean, // Soft delete flag
  deletedAt: Date, // When message was deleted
  replyTo: ObjectId, // Reference to replied message
  metadata: Object, // Additional data
  createdAt: Date,
  updatedAt: Date
}
```

### Conversation Schema
```javascript
{
  participants: [ObjectId], // Array of user IDs
  conversationType: String, // 'private', 'group', 'admin_broadcast'
  lastMessage: ObjectId, // Reference to last message
  lastMessageAt: Date, // Timestamp of last message
  isActive: Boolean, // Conversation status
  createdBy: ObjectId, // User who created conversation
  title: String, // Optional conversation title
  description: String, // Optional description
  settings: Object, // Conversation settings
  createdAt: Date,
  updatedAt: Date
}
```

### UserStatus Schema
```javascript
{
  user: ObjectId, // Reference to user
  isOnline: Boolean, // Online status
  lastSeen: Date, // Last seen timestamp
  socketId: String, // Current socket ID
  deviceInfo: Object, // Device information
  createdAt: Date,
  updatedAt: Date
}
```

## Security Considerations

1. **Authentication**: All socket connections require valid JWT tokens
2. **Authorization**: Users can only access their own conversations
3. **Rate Limiting**: Consider implementing rate limiting for message sending
4. **Input Validation**: All message content should be validated and sanitized
5. **File Uploads**: Implement proper file type and size validation for file messages

## Performance Optimization

1. **Message Pagination**: Use pagination for message history
2. **Connection Pooling**: Monitor and optimize database connections
3. **Redis Integration**: Consider using Redis for session management and caching
4. **Message Queuing**: For high-volume applications, consider message queuing
5. **Database Indexing**: Ensure proper indexes on frequently queried fields

## Monitoring and Logging

1. **Connection Monitoring**: Track active connections and user sessions
2. **Message Analytics**: Monitor message volume and patterns
3. **Error Logging**: Log all socket errors and connection issues
4. **Performance Metrics**: Track response times and system performance

## Deployment Considerations

1. **Load Balancing**: Use sticky sessions for Socket.IO with multiple servers
2. **Redis Adapter**: Use Redis adapter for Socket.IO clustering
3. **Environment Variables**: Configure CORS and other settings via environment variables
4. **SSL/TLS**: Use secure connections in production
5. **Firewall**: Configure firewall rules for WebSocket connections

