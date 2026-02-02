const asyncHandler = require('express-async-handler');
const axios = require('axios');
const GoldPrice = require('../models/goldPrice_model');
const SilverPrice = require('../models/silverPrice_model');
const InvestmentSettings = require('../models/investment_settings_model');
const { updateAllProductPrices } = require('../services/priceCalculationService');

const GOLD_API_URL = 'https://www.goldapi.io/api/XAU/INR';
const SILVER_API_URL = 'https://www.goldapi.io/api/XAG/INR';
const FETCH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 24 hours
// const FETCH_INTERVAL_MS = 20 * 1000; // 24 hours]
  // const token = process.env.GOLDAPI_TOKEN || 'goldapi-1cxhm2smkaqq4tb-io';
const token=process.env.GOLDAPI_TOKEN;

// Fetch price from GoldAPI and save
const fetchAndSaveGoldPrice = asyncHandler(async (_req, _res, options = {}) => {
  const { silent = false } = options;
  // const token = process.env.GOLDAPI_TOKEN || 'goldapi-3pz9dsmk3loabk-io';
  // const token = process.env.GOLDAPI_TOKEN || 'GOLDAPI_TOKEN-3pz9dsmk3loabk-io';
  // const token = process.env.GOLDAPI_TOKEN || 'goldapi-1cxhm2smkaqq4tb-io';
  // const token = '';
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

    // Get premium percentage from InvestmentSettings, fallback to 9.5% if not found or failed
    let premiumPercentage = 9.5; // Default fallback
    try {
      const settings = await InvestmentSettings.findOne().sort({ updatedAt: -1 });
      if (settings && settings.goldPremiumPercentage != null && !isNaN(settings.goldPremiumPercentage)) {
        premiumPercentage = parseFloat(settings.goldPremiumPercentage);
      }
    } catch (settingsError) {
      console.warn('Failed to fetch premium percentage from settings, using default 9.5%:', settingsError.message);
      premiumPercentage = 9.5; // Fallback to 9.5%
    }

    // Add customizable premium to the fetched price
    const premiumMultiplier = 1 + (premiumPercentage / 100);
    const priceGram24k = +(basePriceGram24k * premiumMultiplier).toFixed(2);

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

// Fetch price from SilverAPI and save
const fetchAndSaveSilverPrice = asyncHandler(async (_req, _res, options = {}) => {
  const { silent = false } = options;
  // const token = process.env.GOLDAPI_TOKEN || 'goldapi-1cxhm2smkaqq4tb-io';
  try {
    const { data } = await axios.get(SILVER_API_URL, {
      headers: {
        'x-access-token': token,
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    const basePriceGram = parseFloat(data?.price_gram_24k);
    if (!basePriceGram || Number.isNaN(basePriceGram)) {
      throw new Error('Invalid price_gram_24k received from SilverAPI');
    }

    // Get premium percentage from InvestmentSettings, fallback to 9.5% if not found or failed
    let premiumPercentage = 9.5; // Default fallback
    try {
      const settings = await InvestmentSettings.findOne().sort({ updatedAt: -1 });
      if (settings && settings.silverPremiumPercentage != null && !isNaN(settings.silverPremiumPercentage)) {
        premiumPercentage = parseFloat(settings.silverPremiumPercentage);
      }
    } catch (settingsError) {
      console.warn('Failed to fetch silver premium percentage from settings, using default 9.5%:', settingsError.message);
      premiumPercentage = 9.5; // Fallback to 9.5%
    }

    // Add customizable premium to the fetched price
    const premiumMultiplier = 1 + (premiumPercentage / 100);
    const priceGram = +(basePriceGram * premiumMultiplier).toFixed(2);

    const record = await SilverPrice.create({
      priceGram,
      basePriceGram,
      fetchedAt: new Date(),
      raw: data,
    });

    // Update InvestmentSettings with new pure silver price (auto-calculate 92.5% silver)
    const silver925 = parseFloat((priceGram * 0.925).toFixed(2));
    const settings = await InvestmentSettings.findOneAndUpdate(
      {},
      {
        silverRate: priceGram,
        silverRate925: silver925,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    // Trigger product price update using latest prices (requires goldRate)
    try {
      const gold24kt = settings?.goldRate24kt || settings?.goldRate || 0;
      const gold22kt = settings?.goldRate22kt || 0;
      const gold18kt = settings?.goldRate18kt || 0;
      if (gold24kt && priceGram) {
        await updateAllProductPrices(gold24kt, gold22kt, gold18kt, priceGram, settings?.makingChargesPercentage || 15);
      } else {
        console.warn('Skipping product price update: missing goldRate or silver price');
      }
    } catch (updateErr) {
      console.error('Error updating product prices after silver price refresh:', updateErr.message);
    }

    if (!silent && _res) {
      return _res.status(200).json({
        status: true,
        message: 'Silver price fetched and saved',
        data: record,
      });
    }

    return record;
  } catch (error) {
    if (!silent && _res) {
      return _res.status(500).json({
        status: false,
        message: 'Failed to fetch silver price',
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

// Get latest saved silver price
const getLatestSilverPrice = asyncHandler(async (_req, res) => {
  const latest = await SilverPrice.findOne().sort({ fetchedAt: -1 });
  if (!latest) {
    return res.status(404).json({
      status: false,
      message: 'No silver price found. Please fetch first.',
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

  // Initial fetch for gold (silent)
  fetchAndSaveGoldPrice(null, null, { silent: true }).catch((e) =>
    console.error('Gold price initial fetch failed:', e.message)
  );

  // Initial fetch for silver (silent)
  fetchAndSaveSilverPrice(null, null, { silent: true }).catch((e) =>
    console.error('Silver price initial fetch failed:', e.message)
  );

  setInterval(() => {
    fetchAndSaveGoldPrice(null, null, { silent: true }).catch((e) =>
      console.error('Gold price scheduled fetch failed:', e.message)
    );
    fetchAndSaveSilverPrice(null, null, { silent: true }).catch((e) =>
      console.error('Silver price scheduled fetch failed:', e.message)
    );
  }, FETCH_INTERVAL_MS);
};

module.exports = {
  fetchAndSaveGoldPrice,
  fetchAndSaveSilverPrice,
  getLatestGoldPrice,
  getLatestSilverPrice,
  startGoldPriceScheduler,
};

