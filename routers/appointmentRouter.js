const express = require('express');
const router = express.Router();
const { adminAuth } = require("../middleware/adminAuth");
const { isAuth } = require("../middleware/tokenValidation");
const { createAppointment, listAppointments, getUserAppointments, markAppointmentContacted } = require('../controller/appointmentController');

// Optional auth middleware - doesn't fail if no token
const optionalAuth = async (req, res, next) => {
  const jwt = require("jsonwebtoken");
  let token = null;
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (token) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded.user) {
        req.user = decoded.user;
      } else if (decoded.id) {
        req.user = {
          id: decoded.id,
          _id: decoded.id,
          role: 'admin'
        };
      }
    } catch (err) {
      // Continue without authentication for optional auth
    }
  }
  next();
};

// Public: create appointment (optionally authenticated to save userId)
router.post('/', optionalAuth, createAppointment);

// User: get user's appointments (requires authentication)
router.get('/my-appointments', isAuth, getUserAppointments);

// Admin: list appointments
router.get('/admin', adminAuth, listAppointments);

// Admin: mark contacted
router.patch('/admin/:id/contacted', adminAuth, markAppointmentContacted);

module.exports = router;

