const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false, // Allow guest appointments
    index: true,
  },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  preferredDate: { type: String },
  preferredTime: { type: String },
  notes: { type: String },
  status: { type: String, enum: ['pending', 'confirmed', 'completed', 'cancelled'], default: 'pending', index: true },
  contacted: { type: Boolean, default: false, index: true },
  contactedAt: { type: Date },
  source: { type: String, default: 'app' },
  createdAt: { type: Date, default: Date.now, index: true }
}, {
  timestamps: true,
});

module.exports = mongoose.model('Appointment', appointmentSchema);

