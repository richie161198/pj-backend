const mongoose = require('mongoose');

const goldPriceSchema = new mongoose.Schema({
  priceGram24k: {
    type: Number,
    required: true,
  },
  basePriceGram24k: {
    type: Number,
  },
  source: {
    type: String,
    default: 'goldapi.io',
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

module.exports = mongoose.model('GoldPrice', goldPriceSchema);

