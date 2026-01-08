const asyncHandler = require('express-async-handler');
const axios = require('axios');
const GoldPrice = require('../models/goldPrice_model');
const InvestmentSettings = require('../models/investment_settings_model');
const { updateAllProductPrices } = require('../services/priceCalculationService');

const GOLD_API_URL = 'https://www.goldapi.io/api/XAU/INR';
const FETCH_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
// const FETCH_INTERVAL_MS = 10 * 1000; // 24 hours

// Fetch price from GoldAPI and save
const fetchAndSaveGoldPrice = asyncHandler(async (_req, _res, options = {}) => {
  const { silent = false } = options;
  const token = process.env.GOLDAPI_TOKEN || 'goldapi-3pz9dsmk3loabk-io';

  try {
    const { data } = await axios.get(GOLD_API_URL, {
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    const basePriceGram24k = parseFloat(data?.price_gram_24k);
    if (!basePriceGram24k || Number.isNaN(basePriceGram24k)) {
      throw new Error('Invalid price_gram_24k received from GoldAPI');
    }

    // Add 9.5% premium to the fetched price
    const priceGram24k = +(basePriceGram24k * 1.095).toFixed(2);

    const record = await GoldPrice.create({
      priceGram24k,
      basePriceGram24k,
      fetchedAt: new Date(),
      raw: data,
    });

    // Update InvestmentSettings with new 24kt price (keeps 22kt/18kt derived)
    const gold22 = parseFloat((priceGram24k * 0.916).toFixed(2));
    const gold18 = parseFloat((priceGram24k * 0.75).toFixed(2));
    const settings = await InvestmentSettings.findOneAndUpdate(
      {},
      {
        goldRate: priceGram24k,
        goldRate24kt: priceGram24k,
        goldRate22kt: gold22,
        goldRate18kt: gold18,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Trigger product price update using latest prices (requires silverRate)
    try {
      const silver = settings?.silverRate || 0;
      if (silver && priceGram24k) {
        await updateAllProductPrices(priceGram24k, gold22, gold18, silver, settings?.makingChargesPercentage || 15);
      } else {
        console.warn('Skipping product price update: missing silverRate or gold price');
      }
    } catch (updateErr) {
      console.error('Error updating product prices after gold price refresh:', updateErr.message);
    }

    if (!silent && _res) {
      return _res.status(200).json({
        status: true,
        message: 'Gold price fetched and saved',
        data: record,
      });
    }

    return record;
  } catch (error) {
    if (!silent && _res) {
      return _res.status(500).json({
        status: false,
        message: 'Failed to fetch gold price',
        error: error.message,
      });
    }
    throw error;
  }
});

// Get latest saved gold price
const getLatestGoldPrice = asyncHandler(async (_req, res) => {
  const latest = await GoldPrice.findOne().sort({ fetchedAt: -1 });
  if (!latest) {
    return res.status(404).json({
      status: false,
      message: 'No gold price found. Please fetch first.',
    });
  }

  return res.status(200).json({
    status: true,
    data: latest,
  });
});

// Scheduler (every 24h)
let schedulerStarted = false;
const startGoldPriceScheduler = () => {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Initial fetch (silent)
  fetchAndSaveGoldPrice(null, null, { silent: true }).catch((e) =>
    console.error('Gold price initial fetch failed:', e.message)
  );

  setInterval(() => {
    fetchAndSaveGoldPrice(null, null, { silent: true }).catch((e) =>
      console.error('Gold price scheduled fetch failed:', e.message)
    );
  }, FETCH_INTERVAL_MS);
};

module.exports = {
  fetchAndSaveGoldPrice,
  getLatestGoldPrice,
  startGoldPriceScheduler,
};

