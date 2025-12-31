const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema({
    investmentEnabled: {
        type: Boolean,
        default: true
    }, // Master toggle for investment features
    goldRate: {
        type: Number,
        default: 0
    }, // Keep for backward compatibility (24kt)
    goldRate24kt: {
        type: Number,
        default: 0
    },
    goldRate22kt: {
        type: Number,
        default: 0
    },
    goldRate18kt: {
        type: Number,
        default: 0
    }, 
    silverRate: {
        type: Number,
        default: 0
    }, 
    goldStatus: {
        type: Boolean,
        default: true
    }, 
    silverStatus: {
        type: Boolean,
        default: false
    },
    makingChargesPercentage: {
        type: Number,
        default: 15,
        min: 0,
        max: 100
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("InvestmentSettings", investmentSchema);
