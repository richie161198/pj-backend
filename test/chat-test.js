const { io } = require('socket.io-client');
const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:5000';
const TEST_USERS = [
  { email: 'user1@test.com', password: 'password123' },
  { email: 'user2@test.com', password: 'password123' },
  { email: 'admin@test.com', password: 'admin123' }
];

class ChatTester {
  constructor() {
    this.users = [];
    this.sockets = [];
  }

  async runTests() {
    console.log('🚀 Starting Chat System Tests...\n');

    try {
      // Test 1: User Authentication
      await this.testAuthentication();
      
      // Test 2: Socket Connection
      await this.testSocketConnection();
      
      // Test 3: User-to-User Messaging
      await this.testUserToUserMessaging();
      
      // Test 4: Admin Broadcast
      await this.testAdminBroadcast();
      
      // Test 5: Admin Direct Message
      await this.testAdminDirectMessage();
      
      // Test 6: Typing Indicators
      await this.testTypingIndicators();
      
      // Test 7: Message Read Status
      await this.testMessageReadStatus();
      
      console.log('\n✅ All tests completed successfully!');
      
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
    } finally {
      // Cleanup
      this.cleanup();
    }
  }

  async testAuthentication() {
    console.log('📝 Testing User Authentication...');
    
    for (const userData of TEST_USERS) {
      try {
        const response = await axios.post(`${BASE_URL}/api/v0/auth/login`, userData);
        
        if (response.data.success) {
          this.users.push({
            ...userData,
            token: response.data.data.token,
            user: response.data.data.user
          });
          console.log(`✅ ${userData.email} authenticated successfully`);
        } else {
          console.log(`❌ ${userData.email} authentication failed: ${response.data.message}`);
        }
      } catch (error) {
        console.log(`❌ ${userData.email} authentication error: ${error.response?.data?.message || error.message}`);
      }
    }
    
    if (this.users.length === 0) {
      throw new Error('No users could be authenticated');
    }
    
    console.log(`✅ Authentication test completed. ${this.users.length} users authenticated.\n`);
  }

  async testSocketConnection() {
    console.log('🔌 Testing Socket Connection...');
    
    for (const user of this.users) {
      const socket = io(BASE_URL, {
        auth: { token: user.token }
      });

      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error(`Socket connection timeout for ${user.email}`));
        }, 5000);

        socket.on('connect', () => {
          clearTimeout(timeout);
          this.sockets.push({ socket, user });
          console.log(`✅ ${user.email} connected to socket`);
          resolve();
        });

        socket.on('connect_error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`Socket connection failed for ${user.email}: ${error.message}`));
        });
      });
    }
    
    console.log(`✅ Socket connection test completed. ${this.sockets.length} sockets connected.\n`);
  }

  async testUserToUserMessaging() {
    console.log('💬 Testing User-to-User Messaging...');
    
    if (this.sockets.length < 2) {
      console.log('⚠️  Skipping user-to-user messaging test (need at least 2 users)');
      return;
    }

    const sender = this.sockets[0];
    const receiver = this.sockets[1];
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('User-to-user messaging test timeout'));
      }, 10000);

      // Listen for message on receiver socket
      receiver.socket.on('new_message', (data) => {
        clearTimeout(timeout);
        console.log(`✅ Message received by ${receiver.user.email}: ${data.data.message}`);
        resolve();
      });

      // Send message from sender
      const testMessage = `Hello from ${sender.user.email} at ${new Date().toISOString()}`;
      sender.socket.emit('send_message', {
        receiverId: receiver.user.user._id,
        message: testMessage,
        messageType: 'text'
      });
      
      console.log(`📤 Message sent from ${sender.user.email} to ${receiver.user.email}`);
    });
  }

  async testAdminBroadcast() {
    console.log('📢 Testing Admin Broadcast...');
    
    const adminSocket = this.sockets.find(s => s.user.user.role === 'admin');
    if (!adminSocket) {
      console.log('⚠️  Skipping admin broadcast test (no admin user found)');
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Admin broadcast test timeout'));
      }, 10000);

      let receivedCount = 0;
      const expectedCount = this.sockets.length;

      // Listen for broadcast on all sockets
      this.sockets.forEach(socketData => {
        socketData.socket.on('admin_broadcast', (data) => {
          receivedCount++;
          console.log(`✅ Broadcast received by ${socketData.user.email}: ${data.data.message}`);
          
          if (receivedCount === expectedCount) {
            clearTimeout(timeout);
            resolve();
          }
        });
      });

      // Send broadcast from admin
      const broadcastMessage = `Admin broadcast test at ${new Date().toISOString()}`;
      adminSocket.socket.emit('admin_broadcast', {
        message: broadcastMessage,
        messageType: 'text'
      });
      
      console.log(`📢 Broadcast sent by admin: ${broadcastMessage}`);
    });
  }

  async testAdminDirectMessage() {
    console.log('👤 Testing Admin Direct Message...');
    
    const adminSocket = this.sockets.find(s => s.user.user.role === 'admin');
    const regularUser = this.sockets.find(s => s.user.user.role !== 'admin');
    
    if (!adminSocket || !regularUser) {
      console.log('⚠️  Skipping admin direct message test (need admin and regular user)');
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Admin direct message test timeout'));
      }, 10000);

      // Listen for message on regular user socket
      regularUser.socket.on('new_message', (data) => {
        if (data.data.metadata?.isAdminMessage) {
          clearTimeout(timeout);
          console.log(`✅ Admin direct message received by ${regularUser.user.email}: ${data.data.message}`);
          resolve();
        }
      });

      // Send direct message from admin
      const directMessage = `Direct message from admin at ${new Date().toISOString()}`;
      adminSocket.socket.emit('admin_message_user', {
        userId: regularUser.user.user._id,
        message: directMessage,
        messageType: 'text'
      });
      
      console.log(`📤 Direct message sent by admin to ${regularUser.user.email}`);
    });
  }

  async testTypingIndicators() {
    console.log('⌨️  Testing Typing Indicators...');
    
    if (this.sockets.length < 2) {
      console.log('⚠️  Skipping typing indicators test (need at least 2 users)');
      return;
    }

    const sender = this.sockets[0];
    const receiver = this.sockets[1];
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Typing indicators test timeout'));
      }, 5000);

      // Listen for typing indicator on receiver socket
      receiver.socket.on('user_typing', (data) => {
        if (data.isTyping) {
          console.log(`✅ Typing indicator received by ${receiver.user.email}: ${data.senderName} is typing`);
          
          // Stop typing after 1 second
          setTimeout(() => {
            sender.socket.emit('typing_stop', {
              receiverId: receiver.user.user._id
            });
          }, 1000);
        } else {
          clearTimeout(timeout);
          console.log(`✅ Typing stopped indicator received by ${receiver.user.email}`);
          resolve();
        }
      });

      // Start typing
      sender.socket.emit('typing_start', {
        receiverId: receiver.user.user._id
      });
      
      console.log(`⌨️  Typing started by ${sender.user.email}`);
    });
  }

  async testMessageReadStatus() {
    console.log('👁️  Testing Message Read Status...');
    
    if (this.sockets.length < 2) {
      console.log('⚠️  Skipping message read status test (need at least 2 users)');
      return;
    }

    const sender = this.sockets[0];
    const receiver = this.sockets[1];
    let messageId = null;
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Message read status test timeout'));
      }, 10000);

      // Listen for message sent confirmation
      sender.socket.on('message_sent', (data) => {
        messageId = data.data._id;
        console.log(`✅ Message sent with ID: ${messageId}`);
        
        // Simulate marking message as read after 1 second
        setTimeout(() => {
          receiver.socket.emit('mark_message_read', { messageId });
          console.log(`👁️  Marking message as read: ${messageId}`);
        }, 1000);
      });

      // Listen for read receipt on sender socket
      sender.socket.on('message_read', (data) => {
        if (data.messageId === messageId) {
          clearTimeout(timeout);
          console.log(`✅ Message read receipt received: ${data.messageId}`);
          resolve();
        }
      });

      // Send test message
      const testMessage = `Read status test message at ${new Date().toISOString()}`;
      sender.socket.emit('send_message', {
        receiverId: receiver.user.user._id,
        message: testMessage,
        messageType: 'text'
      });
      
      console.log(`📤 Test message sent for read status test`);
    });
  }

  cleanup() {
    console.log('\n🧹 Cleaning up...');
    
    this.sockets.forEach(socketData => {
      socketData.socket.disconnect();
    });
    
    console.log('✅ Cleanup completed');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new ChatTester();
  tester.runTests().catch(console.error);
}

module.exports = ChatTester;
