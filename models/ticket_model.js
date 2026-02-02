

const mongoose = require("mongoose");

const ticketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    subject: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["open", "in-progress", "resolved", "closed"],
      default: "open",
    },
    // Admin note visible only in admin tools
    adminNote: {
      type: String,
      default: "",
    },
    // Last admin who updated the ticket
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // Thread of replies (admin and/or system)
    replies: [
      {
        message: { type: String, required: true },
        repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        isInternal: { type: Boolean, default: false },
        timestamp: { type: Date, default: Date.now },
      },
    ],
    // Unread: admin has not viewed this ticket / no new user message since last view
    readByAdmin: { type: Boolean, default: false },
    // Unread: user has not viewed new admin reply
    readByUser: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ticket", ticketSchema); // ✅ Export model directly
