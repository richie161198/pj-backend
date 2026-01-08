const express = require('express');
const router = express.Router();
const { adminAuth } = require("../middleware/adminAuth");
const {
  fetchAndSaveGoldPrice,
  getLatestGoldPrice,
} = require('../controller/goldPriceController');

// Public: get latest saved price
router.get('/latest', getLatestGoldPrice);

// Admin: trigger fetch and save now
router.post('/admin/fetch', adminAuth, (req, res) => fetchAndSaveGoldPrice(req, res));

module.exports = router;

