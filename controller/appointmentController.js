const asyncHandler = require('express-async-handler');
const Appointment = require('../models/appointment_model');

// Public: create appointment
const createAppointment = asyncHandler(async (req, res) => {
  const { name, phone, email, preferredDate, preferredTime, notes } = req.body;
  const userId = req.user?.id || req.user?._id; // Get userId from authenticated user if available

  if (!name || !phone) {
    return res.status(400).json({
      status: false,
      message: 'Name and phone are required',
    });
  }

  const appointment = await Appointment.create({
    userId,
    name,
    phone,
    email,
    preferredDate,
    preferredTime,
    notes,
    status: 'pending',
    source: 'app',
  });

  return res.status(201).json({
    status: true,
    message: 'Appointment booked successfully',
    data: appointment,
  });
});

// Admin: list all appointments with pagination
const listAppointments = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const status = req.query.status || '';
  const contacted = req.query.contacted;

  // Build query
  const query = {};

  // Search filter
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { notes: { $regex: search, $options: 'i' } },
    ];
  }

  // Status filter
  if (status) {
    query.status = status;
  }

  // Contacted filter
  if (contacted !== undefined) {
    query.contacted = contacted === 'true';
  }

  // Calculate pagination
  const skip = (page - 1) * limit;
  const total = await Appointment.countDocuments(query);

  // Fetch appointments
  const appointments = await Appointment.find(query)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .select('-__v');

  const totalPages = Math.ceil(total / limit);

  return res.status(200).json({
    status: true,
    data: {
      appointments,
      pagination: {
        currentPage: page,
        totalPages,
        totalAppointments: total,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    },
  });
});

// User: get user's appointments
const getUserAppointments = asyncHandler(async (req, res) => {
  const userId = req.user?.id || req.user?._id;
  const userPhone = req.user?.phone;

  if (!userId && !userPhone) {
    return res.status(401).json({
      status: false,
      message: 'User not authenticated',
    });
  }

  // Query by userId if available, otherwise by phone
  // Also include appointments with matching phone for backward compatibility
  let query = {};
  if (userId) {
    query = { $or: [{ userId: userId }, { phone: userPhone }] };
  } else if (userPhone) {
    query = { phone: userPhone };
  }
  
  const appointments = await Appointment.find(query)
    .sort({ createdAt: -1 })
    .select('-__v');

  return res.status(200).json({
    status: true,
    data: appointments,
  });
});

// Admin: get unmarked (unseen) appointments count for sidebar badge
const getAppointmentUnmarkedCount = asyncHandler(async (req, res) => {
  const unmarkedCount = await Appointment.countDocuments({ contacted: false });
  return res.status(200).json({
    status: true,
    data: { unmarkedCount },
  });
});

// Admin: mark contacted
const markAppointmentContacted = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updated = await Appointment.findByIdAndUpdate(
    id,
    { contacted: true, contactedAt: new Date(), status: 'confirmed' },
    { new: true }
  );

  if (!updated) {
    return res.status(404).json({
      status: false,
      message: 'Appointment not found',
    });
  }

  return res.status(200).json({
    status: true,
    message: 'Appointment marked as contacted',
    data: updated,
  });
});

module.exports = {
  createAppointment,
  listAppointments,
  getUserAppointments,
  getAppointmentUnmarkedCount,
  markAppointmentContacted,
};

