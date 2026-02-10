const mongoose = require('mongoose');

const exchangeRateSchema = new mongoose.Schema({
  fromCurrency: {
    type: String,
    required: true,
    default: 'USD',
  },
  toCurrency: {
    type: String,
    required: true,
    default: 'INR',
  },
  rate: {
    type: Number,
    required: true,
  },
  fetchedAt: {
    type: Date,
    default: Date.now,
    index: true,
  },
  raw: {
    type: Object,
  },
}, {
  timestamps: true,
});

// Index for faster queries
exchangeRateSchema.index({ fromCurrency: 1, toCurrency: 1, fetchedAt: -1 });

module.exports = mongoose.model('ExchangeRate', exchangeRateSchema);
