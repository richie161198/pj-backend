const express = require("express");
const router = express.Router();
const {
  upload,
  uploadSingleImage,
  uploadMultipleImages,
  deleteImage,
  getImageDetails,
  handleUploadError,
} = require("../controller/imageController");

// Single image upload endpoint
router.post("/upload", upload.single("image"), uploadSingleImage);

// Multiple images upload endpoint
router.post("/upload-multiple", upload.array("images", 10), uploadMultipleImages);

// Delete image endpoint
router.delete("/delete/:public_id", deleteImage);

// Get image details endpoint
router.get("/details/:public_id", getImageDetails);

// Error handling middleware for upload routes
router.use(handleUploadError);

module.exports = router;

