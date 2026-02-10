const mongoose = require("mongoose");

const investmentSchema = new mongoose.Schema({
    investmentEnabled: {
        type: Boolean,
        default: true
    }, // Master toggle for investment features
    appointmentEnabled: {
        type: Boolean,
        default: true
    }, // Master toggle for appointment booking feature
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
    }, // Pure silver (100%)
    silverRate925: {
        type: Number,
        default: 0
    }, // Sterling silver (92.5%) 
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
    goldPremiumPercentage: {
        type: Number,
        default: 9.5,
        min: 0,
        max: 100
    }, // Premium percentage added to fetched gold price (general/fallback)
    silverPremiumPercentage: {
        type: Number,
        default: 9.5,
        min: 0,
        max: 100
    }, // Premium percentage added to fetched silver price (general/fallback)
    shivsahaiGoldPremiumPercentage: {
        type: Number,
        default: 9.5,
        min: 0,
        max: 100
    }, // Premium percentage added to gold price when fetched from Shivsahai API
    shivsahaiSilverPremiumPercentage: {
        type: Number,
        default: 9.5,
        min: 0,
        max: 100
    }, // Premium percentage added to silver price when fetched from Shivsahai API
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model("InvestmentSettings", investmentSchema);
