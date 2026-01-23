const cloudinary = require("cloudinary").v2;
const multer = require("multer");
const path = require("path");

// Configure multer for memory storage
const storage = multer.memoryStorage();

// File filter to accept images and videos
const fileFilter = (req, file, cb) => {
  const allowedImageTypes = /jpeg|jpg|png|gif|webp|avif/;
  const allowedVideoTypes = /mp4|webm|mov|quicktime/;
  const extname = path.extname(file.originalname).toLowerCase();
  const isImage = allowedImageTypes.test(extname) && (file.mimetype.startsWith('image/') || allowedImageTypes.test(file.mimetype));
  const isVideo = allowedVideoTypes.test(extname) && (file.mimetype.startsWith('video/') || allowedVideoTypes.test(file.mimetype));

  if (isImage || isVideo) {
    return cb(null, true);
  } else {
    cb(new Error("Only image files (jpeg, jpg, png, gif, webp, avif) and video files (mp4, webm, mov) are allowed!"));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Single image upload
const uploadSingleImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    // Check if file is a video
    const isVideo = req.file.mimetype && req.file.mimetype.startsWith('video/');
    
    // Upload to Cloudinary
    const uploadOptions = {
      resource_type: "auto",
      folder: "precious-jewels",
    };
    
    // Only apply image transformations for images
    if (!isVideo) {
      uploadOptions.transformation = [
        { width: 1200, height: 1200, crop: "limit" },
        { quality: "auto" },
      ];
    }
    
    const result = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(req.file.buffer);
    });

    res.status(200).json({
      success: true,
      message: "Image uploaded successfully",
      data: {
        public_id: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      },
    });
  } catch (error) {
    console.error("Image upload error:", error);
    // Pass error to error handler middleware
    next(error);
  }
};

// Multiple images upload
const uploadMultipleImages = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No image files provided",
      });
    }

    const uploadPromises = req.files.map((file) => {
      return new Promise((resolve, reject) => {
        // Check if file is a video
        const isVideo = file.mimetype && file.mimetype.startsWith('video/');
        
        const uploadOptions = {
          resource_type: "auto",
          folder: "precious-jewels",
        };
        
        // Only apply image transformations for images
        if (!isVideo) {
          uploadOptions.transformation = [
            { width: 1200, height: 1200, crop: "limit" },
            { quality: "auto" },
          ];
        }
        
        cloudinary.uploader
          .upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          )
          .end(file.buffer);
      });
    });

    const results = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      message: "Images uploaded successfully",
      data: results.map((result) => ({
        public_id: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
      })),
    });
  } catch (error) {
    console.error("Multiple images upload error:", error);
    // Pass error to error handler middleware
    next(error);
  }
};

// Delete image from Cloudinary
const deleteImage = async (req, res) => {
  try {
    const { public_id } = req.params;

    if (!public_id) {
      return res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
    }

    const result = await cloudinary.uploader.destroy(public_id);

    if (result.result === "ok") {
      res.status(200).json({
        success: true,
        message: "Image deleted successfully",
      });
    } else {
      res.status(404).json({
        success: false,
        message: "Image not found or already deleted",
      });
    }
  } catch (error) {
    console.error("Image deletion error:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting image",
      error: error.message,
    });
  }
};

// Get image details
const getImageDetails = async (req, res) => {
  try {
    const { public_id } = req.params;

    if (!public_id) {
      return res.status(400).json({
        success: false,
        message: "Public ID is required",
      });
    }

    const result = await cloudinary.api.resource(public_id);

    res.status(200).json({
      success: true,
      data: {
        public_id: result.public_id,
        url: result.secure_url,
        width: result.width,
        height: result.height,
        format: result.format,
        bytes: result.bytes,
        created_at: result.created_at,
      },
    });
  } catch (error) {
    console.error("Get image details error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching image details",
      error: error.message,
    });
  }
};

// Error handling middleware for multer
const handleUploadError = (error, req, res, next) => {
  // Set CORS headers for error responses
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "File size too large. Maximum size is 5MB.",
      });
    }
    if (error.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({
        success: false,
        message: "Too many files. Maximum 10 files allowed.",
      });
    }
    // Handle other multer errors
    return res.status(400).json({
      success: false,
      message: `Upload error: ${error.message}`,
    });
  }
  
  if (error.message && (error.message.includes("Only image files") || error.message.includes("Only image files (jpeg") || error.message.includes("Only image files (jpeg, jpg"))) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }

  // For any other errors, pass to next error handler or return error
  if (error) {
    return res.status(500).json({
      success: false,
      message: "Upload error",
      error: error.message || "Unknown error occurred",
    });
  }
  
  // If no error, continue to next middleware
  next();
};

module.exports = {
  upload,
  uploadSingleImage,
  uploadMultipleImages,
  deleteImage,
  getImageDetails,
  handleUploadError,
};

