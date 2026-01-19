const express = require('express');
const router = express.Router();
const { adminAuth } = require("../middleware/adminAuth");
const {
  fetchAndSaveGoldPrice,
  fetchAndSaveSilverPrice,
  getLatestGoldPrice,
  getLatestSilverPrice,
} = require('../controller/goldPriceController');

// Public: get latest saved gold price
router.get('/latest', getLatestGoldPrice);

// Public: get latest saved silver price
router.get('/silver/latest', getLatestSilverPrice);

// Admin: trigger fetch and save gold price now
router.post('/admin/fetch', adminAuth, (req, res) => fetchAndSaveGoldPrice(req, res));

// Admin: trigger fetch and save silver price now
router.post('/admin/fetch-silver', adminAuth, (req, res) => fetchAndSaveSilverPrice(req, res));

module.exports = router;

