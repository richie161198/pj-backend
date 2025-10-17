const { default: axios } = require("axios");
const User = require("../models/userModel");
const Ticket = require("../models/ticket_model");
const Product = require("../models/product_model");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");

const getAllUser = asyncHandler(async (req, res) => {
  const user = await User.find({});
  if (!user) {
    res.status(404);
    throw new Error("User not found");
  }
  if (user) {
    res.status(200).json({ status: true, details: user });
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

    res.status(200).json({ message: "success", details: user });
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

    res.status(200).json({ message: "success", details: user });
  } catch (error) {

    res.status(500).json(error);
  }
}); ``
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

    // const user = await User.findByIdAndUpdate(
    //   req.user.id,
    //   { $pull: { address: { _id: addressId } } },
    //   { new: true }
    // );

    const user = await User.findById(req.user.id);
    console.log(user.address);
    const addressIddd = await user.address.findById(addressId);
    console.log(addressIddd);

    if (!user) return res.status(404).json({ message: "User not found" });

    res.status(200).json({
      message: "Address deleted successfully",
      addresses: user.address,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    res.status(200).json({ success: true, tickets });
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
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Ticket.countDocuments(filter);

    res.status(200).json({
      success: true,
      message: "All tickets fetched successfully",
      data: {
        tickets,
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

    res.status(200).json({ success: true, ticket });
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
          closed: { $sum: { $cond: [{ $eq: ['$status', 'closed'] }, 1, 0] } }
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

    res.status(200).json({
      success: true,
      message: "Ticket statistics fetched successfully",
      data: {
        overview: stats[0] || { total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 },
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

    await ticket.save();
    await ticket.populate('user', 'name email phone');
    await ticket.populate('replies.repliedBy', 'name email');

    res.status(200).json({
      success: true,
      message: "Reply added successfully",
      ticket,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});








module.exports = { updateTicketStatus, getuserByIds, getTicketById, getMyTickets, createTicket, addToWishlist, removeFromWishlist, getWishlist, addAddress, getAddresses, deleteAddress, updateAddress, updateuserById, getuserById, getAllUser, deleteuserById, getGoldprice, setTransactionPin, verifyTransactionPin, getAllTickets, getTicketByIdAdmin, updateTicketStatusAdmin, getTicketStats, addTicketReply }