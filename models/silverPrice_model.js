const mongoose = require('mongoose');

const silverPriceSchema = new mongoose.Schema({
  priceGram: {
    type: Number,
    required: true,
  },
  basePriceGram: {
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

module.exports = mongoose.model('SilverPrice', silverPriceSchema);

