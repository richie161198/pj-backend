const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema({
    goldGSTRate: {
        type: Number,
        default: 0.03 
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("Settings", settingsSchema);
