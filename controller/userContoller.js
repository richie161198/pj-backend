const { default: axios } = require("axios");
const User = require("../models/userModel");
const Ticket = require("../models/ticket_model");
const Product = require("../models/product_model");
const Notification = require("../models/notification_model");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");
const twilio = require("twilio");

// Initialize Twilio client for WhatsApp messaging
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const getAllUser = asyncHandler(async (req, res) => {
  const user = await User.find({});
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  if (user) {
    const details = user.map((u) => {
      const doc = u.toObject ? u.toObject() : { ...u };
      doc.goldBalance = (parseFloat(u.goldBalance) || 0).toFixed(4);
      return doc;
    });
    res.status(200).json({ status: true, details });
  }
});
const getuserById = asyncHandler(async (req, res) => {
  console.log("req.user", req.user);
  try {
    const user = await User.findById(req.user.id);
    console.log(user);
    if (!user || user === null || user === undefined) {
      // res.status(404).json({ message: "Not found", details: user });
      res.status(404);
      throw new Error("Not found ");
    }
    const details = user.toObject ? user.toObject() : { ...user };
    details.goldBalance = (parseFloat(user.goldBalance) || 0).toFixed(4);
    res.status(200).json({ message: "success", details });
  } catch (error) {

    res.status(500).json(error);
  }
});
const getuserByIds = asyncHandler(async (req, res) => {
  console.log(req.params.id);
  console.log(req.body);
  try {
    const user = await User.findById(req.params.id);
    console.log(user);
    if (!user || user === null || user === undefined) {
      // res.status(404).json({ message: "Not found", details: user });
      res.status(404);
      throw new Error("Not found ");
    }
    const details = user.toObject ? user.toObject() : { ...user };
    details.goldBalance = (parseFloat(user.goldBalance) || 0).toFixed(4);
    res.status(200).json({ message: "success", details });
  } catch (error) {

    res.status(500).json(error);
  }
});
// Set Transaction PIN
const setTransactionPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;
  console.log("req.user", req.user, req.body);
  // Validate 4-digit PIN
  if (!pin || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ status: false, message: "PIN must be a 4-digit number" });
  }

  try {
    const hashedPin = await bcrypt.hash(pin, 10);

    await User.findByIdAndUpdate(req.user.id, { transactionPin: hashedPin });

    res.status(200).json({ status: true, message: "Transaction PIN set successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});

// Verify Transaction PIN
const verifyTransactionPin = asyncHandler(async (req, res) => {
  const { pin } = req.body;

  if (!pin || !/^\d{4}$/.test(pin)) {
    return res.status(400).json({ status: false, message: "PIN must be a 4-digit number" });
  }

  try {
    const user = await User.findById(req.user._id);

    if (!user || !user.transactionPin) {
      return res.status(404).json({ status: false, message: "Transaction PIN not set" });
    }

    const isMatch = await bcrypt.compare(pin, user.transactionPin);

    if (!isMatch) {
      return res.status(401).json({ status: false, message: "Invalid Transaction PIN" });
    }

    res.status(200).json({ status: true, message: "Transaction PIN verified successfully" });
  } catch (error) {
    res.status(500).json({ status: false, message: error.message });
  }
});



const getGoldprice = asyncHandler(async (req, res) => {
  try {
    const response = await axios.get("https://api.metalpriceapi.com/v1/latest", {
      params: {
        base: "INR",
        symbols: "XAU",
        apikey: "75a775b84af3b34f9f259dd510de2284"  // replace with your real API key
      }
    });

    // const goldPrice = response.data.rates.XAU;
    console.log(`Current Gold Price (INR): ₹${response.data}`);

    res.status(200).json({ message: "success", details: response.data });
  } catch (error) {
    console.error('Error fetching gold price:', error.message);
  }
});

const updateuserById = asyncHandler(async (req, res) => {
  console.log(req.params.id);
  console.log(req.body);
  const user = await User.findById(req.params.id);
  console.log(user);
  if (!user || user === undefined || user === null) {
    res.status(404);
    throw new Error("Not found ");
  }
  const userData = await User.findByIdAndUpdate(req.params.id, req.body, { new: true });


  res.status(200).json({ message: "success", details: userData });
});

const deleteuserById = asyncHandler(async (req, res) => {
  console.log(req.params.id);
  const user = await User.findById(req.params.id);
  console.log(user);
  if (!user || user === undefined || user === null) {
    res.status(404);
    throw new Error("Not found ");
  }
  const userData = await User.findByIdAndDelete(req.params.id);


  res.status(200).json({ message: "success", details: `${user.name} profile has been deleted` });
});



const addAddress = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const newAddress = req.body;

    const user = await User.findById(userId);
    console.log("user", user);
    if (!user) {
      res.status(404).json({ message: "User not found" });
    }

    if (newAddress.isDefault) {
      await User.updateOne(
        { _id: userId },
        { $set: { "address.$[].isDefault": false } }
      );
    }


    user.address.push(newAddress);
    await user.save();

    res.status(200).json({ message: "Address added successfully", user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


const getAddresses = asyncHandler(async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findById(userId);
    console.log(user, "iser", userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ address: user.address });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// const deleteAddress = asyncHandler(async (req, res) => {
//   try {
//     const { addressId } = req.body;
//     const user = await User.findByIdAndUpdate(
//       req.user.id,
//       { $pull: { addresses: { id: addressId } } },
//       { new: true }
//     );

//     if (!user) return res.status(404).json({ message: "User not found" });

//     res.status(200).json({ message: "Address deleted", user });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });
const deleteAddress = asyncHandler(async (req, res) => {
  try {
    const { addressId } = req.body;
    console.log("addd", addressId, req.body);
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $pull: { address: { _id: addressId } } },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      message: "Address deleted successfully",
      addresses: user.address,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const updateAddress = asyncHandler(async (req, res) => {
  try {
    const { addressId } = req.params;
    const { name, phone, street, city, state, pincode, type, landmark, isDefault } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Find the address index in the array
    const addressIndex = user.address.findIndex(
      (addr) => addr._id.toString() === addressId
    );

    if (addressIndex === -1) {
      return res.status(404).json({ 
        success: false,
        message: "Address not found" 
      });
    }

    // If setting as default, unset all other addresses as default
    if (isDefault === true || isDefault === "true") {
      user.address.forEach((addr) => {
        addr.isDefault = false;
      });
    }

    // Update the address fields
    if (name) user.address[addressIndex].name = name;
    if (phone) user.address[addressIndex].phone = phone;
    if (street) user.address[addressIndex].street = street;
    if (city) user.address[addressIndex].city = city;
    if (state) user.address[addressIndex].state = state;
    if (pincode) user.address[addressIndex].pincode = pincode;
    if (type) user.address[addressIndex].type = type;
    if (landmark !== undefined) user.address[addressIndex].landmark = landmark;
    if (isDefault !== undefined) {
      user.address[addressIndex].isDefault = isDefault === true || isDefault === "true";
    }

    // Save the user document
    await user.save();

    res.status(200).json({
      success: true,
      message: "Address updated successfully",
      address: user.address[addressIndex],
      addresses: user.address,
    });
  } catch (err) {
    console.error("Update Address Error:", err);
    res.status(500).json({ 
      success: false,
      error: err.message,
      message: "Error updating address"
    });
  }
});


const addToWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  try {

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: "Product not found" });

    if (user.wishlist.includes(productId)) {
      return res.status(400).json({ message: "Product already in wishlist" });
    }

    user.wishlist.push(productId);
    await user.save();

    res.status(200).json({ message: "Product added to wishlist", wishlist: user.wishlist });
  } catch (error) {
    res.status(400).json({ message: "Something went wrong", error: error });

  }
});

const removeFromWishlist = asyncHandler(async (req, res) => {
  const { productId } = req.body;
  try {

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    user.wishlist = user.wishlist.filter(
      (item) => item.toString() !== productId.toString()
    );

    await user.save();

    res.status(200).json({ message: "Product removed from wishlist", wishlist: user.wishlist });
  } catch (error) {
    res.status(400).json({ message: "Something went wrong", error: error });

  }
});

const getWishlist = asyncHandler(async (req, res) => {
  try {

    const user = await User.findById(req.user.id).populate("wishlist");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({ wishlist: user.wishlist });
  } catch (error) {
    res.status(400).json({ message: "Something went wrong", error: error });

  }
});



const createTicket = asyncHandler(async (req, res) => {
  try {
    const { category, subject, description } = req.body;

    const ticket = await new Ticket({
      user: req.user.id,
      category,
      subject,
      description,
    });
    await ticket.save();

    res.status(201).json({
      success: true,
      message: "Ticket raised successfully",
      ticket,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all tickets of logged-in user
const getMyTickets = asyncHandler(async (req, res) => {
  try {
    const tickets = await Ticket.find({ user: req.user.id }).sort({
      createdAt: -1,
    });

    const unreadCount = await Ticket.countDocuments({ user: req.user.id, readByUser: false });

    res.status(200).json({ success: true, tickets, unreadCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const getTicketById = asyncHandler(async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    // ensure user owns the ticket
    if (ticket.user.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    // Mark as read by user when they view the ticket
    if (!ticket.readByUser) {
      ticket.readByUser = true;
      await ticket.save();
    }

    res.status(200).json({ success: true, ticket });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const updateTicketStatus = asyncHandler(async (req, res) => {
  try {
    const { status } = req.body;
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    ticket.status = status || ticket.status;
    await ticket.save();

    res.status(200).json({
      success: true,
      message: "Ticket status updated",
      ticket,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: count unread replies for admin (user messages since last admin reply / since ticket creation)
function getUnreadReplyCountForAdmin(ticket) {
  if (ticket.readByAdmin) return 0;
  const replies = ticket.replies || [];
  if (replies.length === 0) return 0;
  const userId = ticket.user?._id?.toString() || ticket.user?.toString();
  let count = 0;
  for (let i = replies.length - 1; i >= 0; i--) {
    const r = replies[i];
    const repliedById = r.repliedBy?._id?.toString() || r.repliedBy?.toString();
    if (repliedById === userId && !r.isInternal) {
      count++;
    } else {
      break; // stop at first non-user (admin) reply
    }
  }
  return count;
}

// Admin functions for ticket management
const getAllTickets = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (status) filter.status = status;
    if (category) filter.category = category;

    const tickets = await Ticket.find(filter)
      .populate('user', 'name email phone')
      .populate('replies.repliedBy', 'name email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Ticket.countDocuments(filter);

    const ticketsWithUnreadCount = tickets.map((t) => {
      const doc = t.toObject ? t.toObject() : t;
      doc.unreadReplyCount = getUnreadReplyCountForAdmin(t);
      return doc;
    });

    res.status(200).json({
      success: true,
      message: "All tickets fetched successfully",
      data: {
        tickets: ticketsWithUnreadCount,
        pagination: {
          current: parseInt(page),
          pages: Math.ceil(total / limit),
          total
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const getTicketByIdAdmin = asyncHandler(async (req, res) => {
  try {
    const ticket = await Ticket.findById(req.params.id).populate('user', 'name email phone');

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    // Mark as read by admin when they view the ticket
    if (!ticket.readByAdmin) {
      ticket.readByAdmin = true;
      await ticket.save();
    }

    const ticketObj = ticket.toObject ? ticket.toObject() : ticket;
    ticketObj.unreadReplyCount = 0; // just viewed, so 0

    res.status(200).json({ success: true, ticket: ticketObj });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const updateTicketStatusAdmin = asyncHandler(async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    console.log("Tcket status", status, adminNote, req.params.id);
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    ticket.status = status || ticket.status;
    if (adminNote) ticket.adminNote = adminNote;
    ticket.updatedBy = req.user.id;
    await ticket.save();

    await ticket.populate('user', 'name email phone');

    res.status(200).json({
      success: true,
      message: "Ticket status updated successfully",
      ticket,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const getTicketStats = asyncHandler(async (req, res) => {
  try {
    const stats = await Ticket.aggregate([
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          open: { $sum: { $cond: [{ $eq: ['$status', 'open'] }, 1, 0] } },
          inProgress: { $sum: { $cond: [{ $eq: ['$status', 'in-progress'] }, 1, 0] } },
          resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } },
          unread: { $sum: { $cond: [{ $ne: ['$readByAdmin', true] }, 1, 0] } }
        }
      }
    ]);

    const categoryStats = await Ticket.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const overview = stats[0] || { total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0, unread: 0 };

    res.status(200).json({
      success: true,
      message: "Ticket statistics fetched successfully",
      data: {
        overview: { ...overview, unread: overview.unread ?? 0 },
        categoryStats
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const addTicketReply = asyncHandler(async (req, res) => {
  try {
    const { message, isInternal = false } = req.body;
    console.log("Tcket reply", message, isInternal, req.params.id);
    const ticket = await Ticket.findById(req.params.id);

    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    const reply = {
      message,
      repliedBy: req.user.id,
      isInternal,
      timestamp: new Date()
    };

    if (!ticket.replies) ticket.replies = [];
    ticket.replies.push(reply);

    // User replied -> mark unread for admin; admin replied (non-internal) -> mark unread for user
    const isUserReplying = ticket.user.toString() === req.user.id;
    if (isUserReplying) {
      ticket.readByAdmin = false;
    } else if (!isInternal) {
      ticket.readByUser = false;
    }

    await ticket.save();
    await ticket.populate('user', 'name email phone');
    await ticket.populate('replies.repliedBy', 'name email');

    // When admin sends a non-internal reply, create an in-app notification for the user (chat-style)
    if (!isUserReplying && !isInternal) {
      const messagePreview = message.length > 100 ? message.substring(0, 97) + '...' : message;
      try {
        const ticketNotification = new Notification({
          title: 'New reply on your support ticket',
          message: `${ticket.subject}: ${messagePreview}`,
          type: 'support_ticket',
          priority: 'normal',
          targetAudience: 'specific_users',
          targetUsers: [ticket.user],
          status: 'sent',
          createdBy: req.user.id,
          metadata: { ticketId: ticket._id.toString() },
          actionType: 'open_screen',
          screenName: 'support_ticket',
        });
        await ticketNotification.save();
      } catch (notifErr) {
        console.error('Failed to create ticket reply notification:', notifErr);
      }
    }

    res.status(200).json({
      success: true,
      message: "Reply added successfully",
      ticket,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});








// Get referred users for admin panel
const getReferredUsers = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 20, userId } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    
    // If userId is provided, get users referred by that specific user
    if (userId) {
      query.referredBy = userId;
    } else {
      // Get all users who were referred (have a referredBy field)
      query.referredBy = { $exists: true, $ne: null };
    }

    const referredUsers = await User.find(query)
      .populate('referredBy', 'name email referralCode')
      .select('name email phone _id referralPoints kycVerified panVerified mobileVerified createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    // Format response
    const formattedUsers = referredUsers.map(user => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      userId: user._id,
      referralPoints: user.referralPoints || 0,
      kycVerified: user.kycVerified || false,
      panVerified: user.panVerified || false,
      mobileVerified: user.mobileVerified || false,
      referredBy: user.referredBy ? {
        _id: user.referredBy._id,
        name: user.referredBy.name,
        email: user.referredBy.email,
        referralCode: user.referredBy.referralCode
      } : null,
      createdAt: user.createdAt
    }));

    res.status(200).json({
      status: true,
      message: "Referred users fetched successfully",
      data: {
        users: formattedUsers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Failed to fetch referred users",
      error: error.message
    });
  }
});

// Get referral statistics for admin
const getReferralStats = asyncHandler(async (req, res) => {
  try {
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalReferredUsers: { $sum: { $cond: [{ $ne: ['$referredBy', null] }, 1, 0] } },
          totalKycVerified: { $sum: { $cond: [{ $eq: ['$kycVerified', true] }, 1, 0] } },
          totalReferralPointsGiven: { $sum: '$referralPoints' },
          totalReferralCount: { $sum: '$referralCount' }
        }
      }
    ]);

    const topReferrers = await User.find({ referralCount: { $gt: 0 } })
      .select('name email referralCode referralCount referralPoints')
      .sort({ referralCount: -1 })
      .limit(10);

    res.status(200).json({
      status: true,
      message: "Referral statistics fetched successfully",
      data: {
        overview: stats[0] || {
          totalReferredUsers: 0,
          totalKycVerified: 0,
          totalReferralPointsGiven: 0,
          totalReferralCount: 0
        },
        topReferrers
      }
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Failed to fetch referral statistics",
      error: error.message
    });
  }
});

// Send WhatsApp message to customer
const sendWhatsAppMessageToCustomer = asyncHandler(async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    if (!phoneNumber || !message) {
      return res.status(400).json({
        status: false,
        message: "Phone number and message are required"
      });
    }

    // Format phone number (ensure it starts with +91 for India)
    let formattedPhone = phoneNumber;
    if (!formattedPhone.startsWith('+')) {
      // Remove any leading zeros or country code if present
      formattedPhone = formattedPhone.replace(/^0+/, '').replace(/^91/, '');
      formattedPhone = `whatsapp:+91${formattedPhone}`;
    } else {
      formattedPhone = `whatsapp:${formattedPhone}`;
    }

    console.log(`📱 Sending WhatsApp message to: ${formattedPhone}`);

    // Send WhatsApp message
    const twilioMessage = await twilioClient.messages.create({
      from: `whatsapp:+919933661149`,
      to: formattedPhone,
      body: message
    });

    console.log(`✅ WhatsApp message sent successfully. SID: ${twilioMessage.sid}`);

    res.status(200).json({
      status: true,
      message: "WhatsApp message sent successfully",
      data: {
        messageSid: twilioMessage.sid,
        phoneNumber: phoneNumber
      }
    });
  } catch (error) {
    console.error('❌ Error sending WhatsApp message:', error);
    res.status(500).json({
      status: false,
      message: "Failed to send WhatsApp message",
      error: error.message
    });
  }
});

module.exports = { updateTicketStatus, getuserByIds, getTicketById, getMyTickets, createTicket, addToWishlist, removeFromWishlist, getWishlist, addAddress, getAddresses, deleteAddress, updateAddress, updateuserById, getuserById, getAllUser, deleteuserById, getGoldprice, setTransactionPin, verifyTransactionPin, getAllTickets, getTicketByIdAdmin, updateTicketStatusAdmin, getTicketStats, addTicketReply, getReferredUsers, getReferralStats, sendWhatsAppMessageToCustomer }