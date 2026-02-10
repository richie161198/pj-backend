const asyncHandler = require('express-async-handler');
const axios = require('axios');
const GoldPrice = require('../models/goldPrice_model');
const SilverPrice = require('../models/silverPrice_model');
const ExchangeRate = require('../models/exchangeRate_model');
const InvestmentSettings = require('../models/investment_settings_model');
const { updateAllProductPrices } = require('../services/priceCalculationService');

// Shivsahai API (primary for gold & silver rates)
const SHIVSAHAI_API_URL = 'http://13.200.166.91/Imxtrade/winbullliteapi/api/v1/broadcastrates';
const SHIVSAHAI_CLIENT = 'ssahaitrd';
const SHIVSAHAI_CACHE_MS = 2 * 60 * 1000; // 2 min cache to avoid duplicate calls
let shivsahaiCache = { data: null, timestamp: 0 };

// Fallback API endpoints (when Shivsahai fails)
const GOLD_API_URL = 'https://api.gold-api.com/price/XAU'; // Returns gold price in USD per ounce
const EXCHANGE_RATE_API_URL = 'https://v6.exchangerate-api.com/v6/ae934249be1a81003206d759/pair/USD/INR'; // Returns USD to INR rate
const SILVER_API_URL = 'https://api.gold-api.com/price/XAG'; // Returns silver price in USD per ounce
const FETCH_INTERVAL_MS = 1 * 60 * 60 * 1000; // 1 hour
// const FETCH_INTERVAL_MS = 20 * 1000; // For testing - 20 seconds
  // const token = process.env.GOLDAPI_TOKEN || 'goldapi-1cxhm2smkaqq4tb-io';
const token=process.env.GOLDAPI_TOKEN;

/**
 * Fetch and save USD to INR exchange rate
 */
const fetchAndSaveExchangeRate = asyncHandler(async (options = {}) => {
  const { silent = false } = options;
  try {
    console.log('💱 Fetching USD to INR exchange rate from API...');
    const exchangeResponse = await axios.get(EXCHANGE_RATE_API_URL, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 15000,
    });

    // Extract exchange rate (USD to INR)
    const usdToInrRate = parseFloat(
      exchangeResponse.data?.conversion_rate || 
      exchangeResponse.data?.rate || 
      exchangeResponse.data?.exchange_rate ||
      exchangeResponse.data?.result?.rate
    );
    
    if (!usdToInrRate || Number.isNaN(usdToInrRate) || usdToInrRate <= 0) {
      console.error('❌ Exchange Rate API Response:', JSON.stringify(exchangeResponse.data, null, 2));
      throw new Error(`Invalid exchange rate received from API. Expected numeric rate > 0, got: ${usdToInrRate}`);
    }

    console.log(`✅ Exchange Rate: ₹${usdToInrRate.toFixed(2)} per $1`);

    // Save to database
    const exchangeRate = await ExchangeRate.create({
      fromCurrency: 'USD',
      toCurrency: 'INR',
      rate: usdToInrRate,
      fetchedAt: new Date(),
      raw: exchangeResponse.data,
    });

    console.log(`✅ Exchange rate saved to database: ${exchangeRate._id}`);
    return exchangeRate;
  } catch (error) {
    console.error('❌ Failed to fetch exchange rate:', error.message);
    if (!silent) {
      throw error;
    }
    return null;
  }
});

/**
 * Get latest USD to INR exchange rate from database
 * Falls back to API if not found in DB or if DB rate is older than 24 hours
 * Default fallback value: 90.3 if all methods fail
 */
const getLatestExchangeRate = async () => {
  const DEFAULT_EXCHANGE_RATE = 90.3; // Default fallback value
  
  try {
    // Get the latest exchange rate from database
    const latestRate = await ExchangeRate.findOne({ 
      fromCurrency: 'USD', 
      toCurrency: 'INR' 
    }).sort({ fetchedAt: -1 });

    // If no rate found or rate is older than 24 hours, fetch from API
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = new Date();
    
    if (!latestRate || (now - latestRate.fetchedAt) > maxAge) {
      console.log('⚠️ Exchange rate not found or expired, fetching from API...');
      const newRate = await fetchAndSaveExchangeRate({ silent: true });
      if (newRate) {
        return newRate.rate;
      }
      // If API fetch fails, use the old rate if available
      if (latestRate) {
        console.warn(`⚠️ Using expired exchange rate from ${latestRate.fetchedAt}`);
        return latestRate.rate;
      }
      // If no rate available, try direct API call before using default
      console.warn('⚠️ No exchange rate in database, trying direct API call...');
    } else {
      // Rate found and still valid
      return latestRate.rate;
    }
  } catch (error) {
    console.error('❌ Error getting exchange rate from database:', error.message);
  }

  // Fallback: try to fetch from API directly
  try {
    console.log('🔄 Attempting direct API fetch as fallback...');
    const exchangeResponse = await axios.get(EXCHANGE_RATE_API_URL, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    });
    const rate = parseFloat(
      exchangeResponse.data?.conversion_rate || 
      exchangeResponse.data?.rate || 
      exchangeResponse.data?.exchange_rate ||
      exchangeResponse.data?.result?.rate
    );
    if (rate && rate > 0 && !Number.isNaN(rate)) {
      console.log(`✅ Fetched exchange rate from API as fallback: ${rate}`);
      // Try to save it to database for future use
      try {
        await ExchangeRate.create({
          fromCurrency: 'USD',
          toCurrency: 'INR',
          rate: rate,
          fetchedAt: new Date(),
          raw: exchangeResponse.data,
        });
      } catch (saveError) {
        console.warn('⚠️ Could not save fallback rate to database:', saveError.message);
      }
      return rate;
    }
  } catch (apiError) {
    console.error('❌ Fallback API fetch also failed:', apiError.message);
  }

  // Final fallback: use default value
  console.warn(`⚠️ All exchange rate fetch methods failed. Using default value: ${DEFAULT_EXCHANGE_RATE}`);
  return DEFAULT_EXCHANGE_RATE;
};

/**
 * Fetch gold and silver rates from Shivsahai API (primary source)
 * GOLD CHN 999 = 24k gold rate (typically per 10g in India)
 * SILVER CHN = pure silver rate (typically per kg in India)
 * Returns { goldPerGram, silverPerGram, raw } or null on failure
 */
const fetchRatesFromShivsahai = async () => {
  const now = Date.now();
  if (shivsahaiCache.data && (now - shivsahaiCache.timestamp) < SHIVSAHAI_CACHE_MS) {
    return shivsahaiCache.data;
  }
  try {
    // const url = `${SHIVSAHAI_API_URL}?client=${SHIVSAHAI_CLIENT}`;
      // console.log(`📊 Shivsahai API called: ${url}`);

  //   const response = await axios.post(url
  //     // , {}, {
  //     // headers: {
  //     //   // client: SHIVSAHAI_CLIENT,
  //     //   Accept: 'application/json',
  //     //   'Content-Type': 'application/json',
  //     // },
  //   //   timeout: 15000,
  //   // }
  // );

    // const url =
    //   "http://13.200.166.91/lmxtrade/winbullliteapi/api/v1/broadcastrates?client=ssahaitrd";

    // const response = await axios.post(url, {}, {
    //   headers: {
    //     "Content-Type": "application/json"
    //   }
    // });

    // const raw = response.data;
    // console.log('📊 Shivsahai API response received',raw);
    // const data = response.data;
    // console.log('📊 Shivsahai API response data:', JSON.stringify(data, null, 2));
    // if (!data) throw new Error('Empty response from Shivsahai API');

    // let goldValue = null;
    // let silverValue = null;

    // // Parse: response can be object with keys like "GOLD CHN 999" or array of { name, value } etc.
    // if (Array.isArray(data)) {
    //   for (const item of data) {
    //     const name = (item.name || item.label || item.key || item.code || '').toString().toUpperCase();
    //     const val = item.value ?? item.rate ?? item.price;
    //     if (name.includes('GOLD CHN 999') || name === 'GOLD CHN 999') goldValue = val;
    //     if (name.includes('SILVER CHN') && !name.includes('COIN')) silverValue = val; // SILVER CHN (pure), avoid COIN SIL
    //   }
    // } else if (typeof data === 'object') {
    //   const keys = Object.keys(data);
    //   for (const k of keys) {
    //     const keyUpper = k.toUpperCase();
    //     if (keyUpper.includes('GOLD CHN 999') || keyUpper === 'GOLD CHN 999') goldValue = data[k];
    //     if ((keyUpper === 'SILVER CHN' || keyUpper.includes('SILVER CHN')) && !keyUpper.includes('COIN')) silverValue = data[k];
    //   }
    // }

    // // Take first numeric value if multiple (e.g. "16066 16070" -> 16066)
    // const firstNum = (v) => {
    //   const s = String(v).trim();
    //   const match = s.match(/[\d.]+/);
    //   return match ? parseFloat(match[0]) : NaN;
    // };


    const url =
      "http://13.200.166.91/lmxtrade/winbullliteapi/api/v1/broadcastrates?client=ssahaitrd";

    const res = await axios.post(url);

    const lines = res.data.split("\n");

    let gold999 = null;
    let silverChn = null;

    lines.forEach(line => {
      const parts = line.trim().match(/"[^"]+"|\S+/g);
      if (!parts) return;

      const name = parts[2]?.replace(/"/g, "");
      const price = parts[4];

      if (name === "GOLD CHN 999") {
        gold999 = price;
      }

      if (name === "SILVER CHN") {
        silverChn = price;
      }
    });
const goldNum = parseFloat(gold999);
const silverNum = parseFloat(silverChn);

// India: gold is already per gram in this feed
// Silver comes per kg → convert to gram
const goldPerGram =
  Number.isNaN(goldNum) || goldNum <= 0
    ? null
    : parseFloat(goldNum.toFixed(4));

const silverPerGram =
  Number.isNaN(silverNum) || silverNum <= 0
    ? null
    : parseFloat((silverNum / 1000).toFixed(4));

    // const goldNum = gold999;
    // const silverNum = silverChn;

    // // India: gold often quoted per 10g, silver per kg
    // const goldPerGram = Number.isNaN(goldNum) || goldNum <= 0 ? null : parseFloat((goldNum ).toFixed(4));
    // const silverPerGram = Number.isNaN(silverNum) || silverNum <= 0 ? null : parseFloat((silverNum / 1000).toFixed(4));

    if (!goldPerGram || !silverPerGram) {
      console.warn('Shivsahai API: missing or invalid GOLD CHN 999 / SILVER CHN', { gold999, silverChn, goldPerGram, silverPerGram });
      return null;
    }

    console.log(`✅ Shivsahai API: Gold ₹${goldPerGram}/g, Silver ₹${silverPerGram}/g`);
    const result = { goldPerGram, silverPerGram, raw: res.data, source: 'shivsahai' };
    shivsahaiCache = { data: result, timestamp: now };
    return result;
  } catch (error) {
    console.warn('⚠️ Shivsahai API failed, will use fallback:', error.message);
    return null;
  }
};

// Fallback: fetch gold price using gold-api.com + exchange rate
const fetchGoldPriceFallback = async () => {
  const goldResponse = await axios.get(GOLD_API_URL, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  const goldPriceUSDPerOunce = parseFloat(
    goldResponse.data?.price || goldResponse.data?.price_per_ounce || goldResponse.data?.XAU ||
    goldResponse.data?.value || goldResponse.data?.rate
  );
  if (!goldPriceUSDPerOunce || Number.isNaN(goldPriceUSDPerOunce) || goldPriceUSDPerOunce <= 0) {
    throw new Error(`Invalid gold price from fallback API: ${goldPriceUSDPerOunce}`);
  }
  const usdToInrRate = await getLatestExchangeRate();
  if (!usdToInrRate || Number.isNaN(usdToInrRate) || usdToInrRate <= 0) {
    throw new Error(`Invalid exchange rate: ${usdToInrRate}`);
  }
  const goldPriceINRPerOunce = goldPriceUSDPerOunce * usdToInrRate;
  const basePriceGram24k = parseFloat((goldPriceINRPerOunce / 31.1035).toFixed(4));
  return { basePriceGram24k, goldResponse: goldResponse.data, goldPriceUSDPerOunce, usdToInrRate, goldPriceINRPerOunce, source: 'fallback' };
};

// Fetch price: try Shivsahai first, then fallback
const fetchAndSaveGoldPrice = asyncHandler(async (_req, _res, options = {}) => {
  const { silent = false } = options;
  try {
    let basePriceGram24k;
    let rawPayload = {};
    let source = 'shivsahai';

    // Primary: Shivsahai API
    const shivsahaiRates = await fetchRatesFromShivsahai();
    if (shivsahaiRates && shivsahaiRates.goldPerGram) {
      console.log('📊 Using gold rate from Shivsahai API (primary)');
      basePriceGram24k = shivsahaiRates.goldPerGram;
      rawPayload = { shivsahaiResponse: shivsahaiRates.raw, source: 'shivsahai' };
    } else {
      // Fallback: gold-api.com + exchange rate
      console.log('📊 Shivsahai unavailable, fetching gold from fallback API (gold-api.com + exchange rate)...');
      const fallback = await fetchGoldPriceFallback();
      basePriceGram24k = fallback.basePriceGram24k;
      rawPayload = {
        goldApiResponse: fallback.goldResponse,
        goldPriceUSDPerOunce: fallback.goldPriceUSDPerOunce,
        usdToInrRate: fallback.usdToInrRate,
        calculatedPriceINRPerOunce: fallback.goldPriceINRPerOunce,
        exchangeRateSource: 'database',
        source: 'fallback',
      };
      source = 'fallback';
    }

    if (!basePriceGram24k || Number.isNaN(basePriceGram24k) || basePriceGram24k <= 0) {
      throw new Error(`Invalid gold price per gram: ${basePriceGram24k}`);
    }

    // Get premium percentage from InvestmentSettings based on source
    let premiumPercentage = 9.5;
    try {
      const settings = await InvestmentSettings.findOne().sort({ updatedAt: -1 });
      if (settings) {
        // Use Shivsahai premium if source is shivsahai, otherwise use general premium
        if (source === 'shivsahai' && settings.shivsahaiGoldPremiumPercentage != null && !isNaN(settings.shivsahaiGoldPremiumPercentage)) {
          premiumPercentage = parseFloat(settings.shivsahaiGoldPremiumPercentage);
          console.log(`📊 Using Shivsahai gold premium: ${premiumPercentage}%`);
        } else if (settings.goldPremiumPercentage != null && !isNaN(settings.goldPremiumPercentage)) {
          premiumPercentage = parseFloat(settings.goldPremiumPercentage);
          console.log(`📊 Using general gold premium: ${premiumPercentage}%`);
        }
      }
    } catch (settingsError) {
      console.warn('Failed to fetch premium percentage from settings, using default 9.5%:', settingsError.message);
    }

    const premiumMultiplier = 1 + (premiumPercentage / 100);
    const priceGram24k = +(basePriceGram24k * premiumMultiplier).toFixed(2);
    console.log(`✅ Final Gold Price (${source}) after ${premiumPercentage}% premium: ₹${priceGram24k.toFixed(2)}/gram`);

    const record = await GoldPrice.create({
      priceGram24k,
      basePriceGram24k,
      fetchedAt: new Date(),
      raw: rawPayload,
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

// Fallback: fetch silver price using gold-api.com + exchange rate
const fetchSilverPriceFallback = async () => {
  const silverResponse = await axios.get(SILVER_API_URL, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });
  const silverPriceUSDPerOunce = parseFloat(
    silverResponse.data?.price || silverResponse.data?.price_per_ounce || silverResponse.data?.XAG ||
    silverResponse.data?.value || silverResponse.data?.rate
  );
  if (!silverPriceUSDPerOunce || Number.isNaN(silverPriceUSDPerOunce) || silverPriceUSDPerOunce <= 0) {
    throw new Error(`Invalid silver price from fallback API: ${silverPriceUSDPerOunce}`);
  }
  const usdToInrRate = await getLatestExchangeRate();
  if (!usdToInrRate || Number.isNaN(usdToInrRate) || usdToInrRate <= 0) {
    throw new Error(`Invalid exchange rate: ${usdToInrRate}`);
  }
  const silverPriceINRPerOunce = silverPriceUSDPerOunce * usdToInrRate;
  const basePriceGram = parseFloat((silverPriceINRPerOunce / 31.1035).toFixed(4));
  return { basePriceGram, silverResponse: silverResponse.data, silverPriceUSDPerOunce, usdToInrRate, silverPriceINRPerOunce, source: 'fallback' };
};

// Fetch price: try Shivsahai first, then fallback
const fetchAndSaveSilverPrice = asyncHandler(async (_req, _res, options = {}) => {
  const { silent = false } = options;
  try {
    let basePriceGram;
    let rawPayload = {};
    let source = 'shivsahai';

    // Primary: Shivsahai API
    const shivsahaiRates = await fetchRatesFromShivsahai();
    if (shivsahaiRates && shivsahaiRates.silverPerGram) {
      console.log('📊 Using silver rate from Shivsahai API (primary)');
      basePriceGram = shivsahaiRates.silverPerGram;
      rawPayload = { shivsahaiResponse: shivsahaiRates.raw, source: 'shivsahai' };
    } else {
      // Fallback: gold-api.com + exchange rate
      console.log('📊 Shivsahai unavailable, fetching silver from fallback API (gold-api.com + exchange rate)...');
      const fallback = await fetchSilverPriceFallback();
      basePriceGram = fallback.basePriceGram;
      rawPayload = {
        silverApiResponse: fallback.silverResponse,
        silverPriceUSDPerOunce: fallback.silverPriceUSDPerOunce,
        usdToInrRate: fallback.usdToInrRate,
        calculatedPriceINRPerOunce: fallback.silverPriceINRPerOunce,
        exchangeRateSource: 'database',
        source: 'fallback',
      };
      source = 'fallback';
    }

    if (!basePriceGram || Number.isNaN(basePriceGram) || basePriceGram <= 0) {
      throw new Error(`Invalid silver price per gram: ${basePriceGram}`);
    }

    // Get premium percentage from InvestmentSettings based on source
    let premiumPercentage = 9.5;
    try {
      const settings = await InvestmentSettings.findOne().sort({ updatedAt: -1 });
      if (settings) {
        // Use Shivsahai premium if source is shivsahai, otherwise use general premium
        if (source === 'shivsahai' && settings.shivsahaiSilverPremiumPercentage != null && !isNaN(settings.shivsahaiSilverPremiumPercentage)) {
          premiumPercentage = parseFloat(settings.shivsahaiSilverPremiumPercentage);
          console.log(`📊 Using Shivsahai silver premium: ${premiumPercentage}%`);
        } else if (settings.silverPremiumPercentage != null && !isNaN(settings.silverPremiumPercentage)) {
          premiumPercentage = parseFloat(settings.silverPremiumPercentage);
          console.log(`📊 Using general silver premium: ${premiumPercentage}%`);
        }
      }
    } catch (settingsError) {
      console.warn('Failed to fetch silver premium percentage from settings, using default 9.5%:', settingsError.message);
    }

    const premiumMultiplier = 1 + (premiumPercentage / 100);
    const priceGram = +(basePriceGram * premiumMultiplier).toFixed(2);
    console.log(`✅ Final Silver Price (${source}) after ${premiumPercentage}% premium: ₹${priceGram.toFixed(2)}/gram`);

    const record = await SilverPrice.create({
      priceGram,
      basePriceGram,
      fetchedAt: new Date(),
      raw: rawPayload,
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

// Scheduler (every hour at :30 minutes - 8:30, 9:30, 10:30, etc.)
let schedulerStarted = false;
let schedulerTimeout = null;

/**
 * Calculate milliseconds until the next :30 minute mark
 * @returns {number} Milliseconds until next :30
 */
const getMsUntilNextHalfHour = () => {
  const now = new Date();
  const currentMinutes = now.getMinutes();
  const currentSeconds = now.getSeconds();
  const currentMs = now.getMilliseconds();
  
  let minutesUntilNext = 30 - currentMinutes;
  
  // If we're past :30, go to next hour's :30
  if (minutesUntilNext <= 0) {
    minutesUntilNext += 60;
  }
  
  // Calculate total milliseconds
  const msUntilNext = (minutesUntilNext * 60 * 1000) - (currentSeconds * 1000) - currentMs;
  
  return msUntilNext;
};

/**
 * Schedule the next fetch at :30 past the hour
 */
const scheduleNextFetch = () => {
  const msUntilNext = getMsUntilNextHalfHour();
  const nextTime = new Date(Date.now() + msUntilNext);
  
  console.log(`⏰ Next scheduled fetch at: ${nextTime.toLocaleString()} (in ${Math.round(msUntilNext / 1000 / 60)} minutes)`);
  
  schedulerTimeout = setTimeout(() => {
    console.log('⏰ Scheduled fetch triggered at :30 - fetching exchange rate, gold, and silver prices...');
    
    // Fetch exchange rate first
    fetchAndSaveExchangeRate({ silent: true }).catch((e) =>
      console.error('Exchange rate scheduled fetch failed:', e.message)
    );
    
    // Then fetch gold and silver prices
    fetchAndSaveGoldPrice(null, null, { silent: true }).catch((e) =>
      console.error('Gold price scheduled fetch failed:', e.message)
    );
    fetchAndSaveSilverPrice(null, null, { silent: true }).catch((e) =>
      console.error('Silver price scheduled fetch failed:', e.message)
    );
    
    // Schedule the next fetch (1 hour later at :30)
    scheduleNextFetch();
  }, msUntilNext);
};

const startGoldPriceScheduler = () => {
  if (schedulerStarted) return;
  schedulerStarted = true;

  console.log('🕐 Starting gold/silver price scheduler - fetching every hour at :30 minutes (8:30, 9:30, 10:30, etc.)');

  // Initial fetch for exchange rate (silent)
  fetchAndSaveExchangeRate({ silent: true }).catch((e) =>
    console.error('Exchange rate initial fetch failed:', e.message)
  );

  // Initial fetch for gold (silent)
  fetchAndSaveGoldPrice(null, null, { silent: true }).catch((e) =>
    console.error('Gold price initial fetch failed:', e.message)
  );

  // Initial fetch for silver (silent)
  fetchAndSaveSilverPrice(null, null, { silent: true }).catch((e) =>
    console.error('Silver price initial fetch failed:', e.message)
  );

  // Schedule periodic fetches at :30 past each hour
  scheduleNextFetch();
};

module.exports = {
  fetchAndSaveGoldPrice,
  fetchAndSaveSilverPrice,
  fetchAndSaveExchangeRate,
  getLatestExchangeRate,
  fetchRatesFromShivsahai, // Primary API (shivsahai) - GOLD CHN 999 & SILVER CHN
  getLatestGoldPrice,
  getLatestSilverPrice,
  startGoldPriceScheduler,
};

