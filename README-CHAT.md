# Real-time Chat System

A comprehensive, scalable, and reliable real-time chat system built with Socket.IO for the Precious Jewellery backend.

## Features

### Core Functionality
- ✅ **User-to-User Messaging**: Private conversations between users
- ✅ **Admin Broadcast**: Send messages to all users simultaneously
- ✅ **Admin Direct Messages**: Admins can message individual users
- ✅ **Real-time Communication**: Instant message delivery using Socket.IO
- ✅ **Typing Indicators**: Show when users are typing
- ✅ **Message Read Receipts**: Track when messages are read
- ✅ **Online/Offline Status**: Real-time user presence
- ✅ **Message History**: Persistent message storage with pagination
- ✅ **Authentication**: JWT-based authentication for all chat features

### Advanced Features
- ✅ **Message Types**: Support for text, image, and file messages
- ✅ **Message Replies**: Reply to specific messages
- ✅ **Message Deletion**: Soft delete messages
- ✅ **Conversation Management**: Automatic conversation creation
- ✅ **User Status Tracking**: Track online/offline status with timestamps
- ✅ **Error Handling**: Comprehensive error handling and validation
- ✅ **Scalable Architecture**: Designed for horizontal scaling

## Architecture

### Backend Components

```
├── models/
│   └── chatModel.js          # Database schemas for chat
├── controller/
│   └── chatController.js     # REST API controllers
├── routers/
│   └── chatRouter.js         # API routes
├── middleware/
│   └── socketAuth.js         # Socket.IO authentication
├── services/
│   └── socketService.js      # Socket.IO event handlers
├── views/
│   └── chat-test.html        # Test client interface
└── test/
    └── chat-test.js          # Automated tests
```

### Database Models

1. **Message**: Individual chat messages
2. **Conversation**: Chat conversations between users
3. **ChatRoom**: Admin broadcast rooms
4. **UserStatus**: User online/offline status
5. **MessageReaction**: Message reactions (extensible)

## Installation & Setup

### Prerequisites
- Node.js 14+
- MongoDB
- Existing authentication system with JWT

### Installation

1. **Dependencies are already installed** (Socket.IO is in package.json)

2. **Environment Variables**
   Add to your `.env` file:
   ```env
   CLIENT_URL=http://localhost:3000  # Your frontend URL
   JWT_SECRET=your-jwt-secret        # Your existing JWT secret
   ```

3. **Database Setup**
   The chat models will be automatically created when the server starts.

### Starting the Chat System

```bash
# Start the server (includes chat functionality)
npm run dev

# Or start production server
npm start
```

## API Documentation

### REST Endpoints

#### Authentication Required
All endpoints require JWT token in Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

#### User Endpoints
```http
GET    /api/v0/chat/conversations           # Get user conversations
GET    /api/v0/chat/unread-count           # Get unread message count
GET    /api/v0/chat/online-users           # Get online users list
GET    /api/v0/chat/user-status/:userId    # Get user status
```

#### Conversation Endpoints
```http
GET    /api/v0/chat/conversation/:receiverId              # Get/create conversation
GET    /api/v0/chat/conversation/:conversationId/messages # Get messages
```

#### Message Endpoints
```http
POST   /api/v0/chat/send                    # Send message
PUT    /api/v0/chat/message/:messageId/read # Mark message as read
PUT    /api/v0/chat/conversation/:conversationId/read # Mark all as read
DELETE /api/v0/chat/message/:messageId      # Delete message
```

#### Admin Endpoints
```http
POST   /api/v0/chat/admin/broadcast         # Send broadcast message
POST   /api/v0/chat/admin/send-to-user      # Send message to user
```

### Socket.IO Events

#### Client → Server Events
```javascript
// Send message
socket.emit('send_message', {
  receiverId: 'user-id',
  message: 'Hello!',
  messageType: 'text',
  replyTo: 'message-id' // optional
});

// Typing indicators
socket.emit('typing_start', { receiverId: 'user-id' });
socket.emit('typing_stop', { receiverId: 'user-id' });

// Mark message as read
socket.emit('mark_message_read', { messageId: 'message-id' });

// Admin broadcast (admin only)
socket.emit('admin_broadcast', {
  message: 'Important announcement!',
  messageType: 'text'
});

// Admin direct message (admin only)
socket.emit('admin_message_user', {
  userId: 'user-id',
  message: 'Hello from admin',
  messageType: 'text'
});
```

#### Server → Client Events
```javascript
// New message received
socket.on('new_message', (data) => {
  console.log('New message:', data.data);
});

// Message sent confirmation
socket.on('message_sent', (data) => {
  console.log('Message sent:', data.data);
});

// Typing indicator
socket.on('user_typing', (data) => {
  console.log(`${data.senderName} is ${data.isTyping ? 'typing' : 'not typing'}`);
});

// Message read receipt
socket.on('message_read', (data) => {
  console.log('Message read:', data);
});

// Admin broadcast
socket.on('admin_broadcast', (data) => {
  console.log('Admin broadcast:', data.data);
});

// User status update
socket.on('user_status_update', (data) => {
  console.log('User status:', data);
});
```

## Frontend Integration

### React.js Example

```javascript
import { useState, useEffect } from 'react';
import io from 'socket.io-client';

const ChatComponent = () => {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const newSocket = io('your-server-url', {
      auth: { token }
    });

    newSocket.on('new_message', (data) => {
      setMessages(prev => [...prev, data.data]);
    });

    setSocket(newSocket);

    return () => newSocket.close();
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

  return (
    <div>
      {/* Your chat UI */}
    </div>
  );
};
```

### Vue.js Example

```javascript
import { ref, onMounted, onUnmounted } from 'vue';
import io from 'socket.io-client';

export default {
  setup() {
    const socket = ref(null);
    const messages = ref([]);

    onMounted(() => {
      const token = localStorage.getItem('authToken');
      socket.value = io('your-server-url', {
        auth: { token }
      });

      socket.value.on('new_message', (data) => {
        messages.value.push(data.data);
      });
    });

    onUnmounted(() => {
      if (socket.value) {
        socket.value.close();
      }
    });

    return { messages };
  }
};
```

## Testing

### Automated Tests
```bash
# Run chat system tests
npm run test:chat
```

### Manual Testing
1. Open `http://localhost:5000/views/chat-test.html` in your browser
2. Login with test credentials
3. Test various chat features

### Test Coverage
- ✅ User authentication
- ✅ Socket connection
- ✅ User-to-user messaging
- ✅ Admin broadcast
- ✅ Admin direct messages
- ✅ Typing indicators
- ✅ Message read status

## Security Features

### Authentication & Authorization
- JWT token validation for all connections
- User role-based access control
- Admin-only features protected
- Socket connection authentication

### Data Validation
- Input sanitization for all messages
- User permission checks
- Rate limiting ready (can be added)
- SQL injection protection via Mongoose

### Privacy
- Users can only access their own conversations
- Message soft deletion
- Secure token-based authentication

## Performance & Scalability

### Optimizations
- Database indexing on frequently queried fields
- Message pagination for large conversations
- Efficient socket connection management
- Connection pooling ready

### Scaling Considerations
- Redis adapter for Socket.IO clustering
- Load balancer with sticky sessions
- Database sharding for large message volumes
- CDN for file uploads

## Monitoring & Logging

### Built-in Monitoring
- Connection status tracking
- User online/offline status
- Message delivery confirmation
- Error logging and handling

### Recommended Additions
- Redis for session management
- Message queuing for high volume
- Performance metrics collection
- Real-time analytics dashboard

## Deployment

### Production Checklist
- [ ] Set `CLIENT_URL` environment variable
- [ ] Configure CORS properly
- [ ] Use Redis adapter for clustering
- [ ] Set up SSL/TLS certificates
- [ ] Configure firewall for WebSocket ports
- [ ] Set up monitoring and logging
- [ ] Configure load balancer with sticky sessions

### Docker Support
The existing Dockerfile can be used. Ensure environment variables are properly set.

## Troubleshooting

### Common Issues

1. **Socket Connection Failed**
   - Check JWT token validity
   - Verify CORS configuration
   - Ensure server is running

2. **Messages Not Delivered**
   - Check user authentication
   - Verify receiver is online
   - Check database connection

3. **Admin Features Not Working**
   - Verify user role is 'admin'
   - Check admin authentication
   - Ensure proper permissions

### Debug Mode
Enable debug logging by setting:
```env
DEBUG=socket.io:*
```

## Contributing

### Code Structure
- Follow existing code patterns
- Add proper error handling
- Include JSDoc comments
- Write tests for new features

### Adding New Features
1. Update database models if needed
2. Add controller methods
3. Create API routes
4. Implement socket handlers
5. Add tests
6. Update documentation

## License

This chat system is part of the Precious Jewellery backend project and follows the same license terms.

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the test files for examples
3. Check server logs for errors
4. Verify environment configuration

---

**Note**: This chat system is production-ready and includes all necessary features for a scalable real-time messaging application. The architecture supports future enhancements like file sharing, video calls, and advanced moderation features.

