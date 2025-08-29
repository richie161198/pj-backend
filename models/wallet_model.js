const mongoose = require("mongoose");

const walletSchema = mongoose.Schema({
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "Users",
  },
  inrBlanace: {
    type: String,
  },
  goldBlanace: {
    type: String,
  },
  silverBlanace: {
    type: String,
  },
});

module.exports = mongoose.model("PG_walletBalance", walletSchema);
