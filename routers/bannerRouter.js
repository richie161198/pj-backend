const express = require('express');
const router = express.Router();
const {
  createBanner,
  getAllBanners,
  getActiveBanners,
  getBannerById,
  updateBanner,
  updateBannerImage,
  deleteBanner,
  toggleBannerStatus,
  updateBannerPosition,
  getBannerStats,
  getBannersByCategory
} = require('../controller/bannerController');
const { upload, handleUploadError } = require('../controller/imageController');
const { adminAuth } = require('../middleware/adminAuth');

// Public routes (no authentication required)
router.get('/active', getActiveBanners);
router.get('/category/:category', getBannersByCategory);
router.get('/by-category', getBannersByCategory);

// Protected routes (admin authentication required)
router.use(adminAuth); // Apply admin authentication to all routes below

// Banner CRUD operations
router.get('/stats', getBannerStats);
router.get('/', getAllBanners);
router.post('/', upload.single('image'), handleUploadError, createBanner);
router.get('/:id', getBannerById);
router.put('/:id', updateBanner);
router.put('/:id/image', upload.single('image'), handleUploadError, updateBannerImage);
router.delete('/:id', deleteBanner);

// Banner management operations
router.patch('/:id/toggle', toggleBannerStatus);
router.patch('/:id/position', updateBannerPosition);

// Quick status update (active/inactive)
router.patch('/:id/status', async (req, res, next) => {
  // alias to toggle if no body provided; else set explicit status
  if (typeof req.body.isActive === 'boolean') {
    req.overrideStatus = req.body.isActive;
  }
  return toggleBannerStatus(req, res, next);
});

module.exports = router;
