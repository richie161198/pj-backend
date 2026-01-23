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

// Wrapper to catch multer errors and ensure CORS headers
const multerErrorHandler = (multerMiddleware) => {
  return (req, res, next) => {
    multerMiddleware(req, res, (err) => {
      if (err) {
        // Set CORS headers before handling error
        const origin = req.headers.origin;
        if (origin) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
        return handleUploadError(err, req, res, next);
      }
      next();
    });
  };
};

// Single image upload endpoint
router.post("/upload", multerErrorHandler(upload.single("image")), uploadSingleImage, handleUploadError);

// Multiple images upload endpoint
router.post("/upload-multiple", multerErrorHandler(upload.array("images", 10)), uploadMultipleImages, handleUploadError);

// Delete image endpoint
router.delete("/delete/:public_id", deleteImage);

// Get image details endpoint
router.get("/details/:public_id", getImageDetails);

module.exports = router;

