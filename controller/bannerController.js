const Banner = require('../models/banner_model');
const { upload, uploadSingleImage, handleUploadError } = require('./imageController');
const cloudinary = require('cloudinary').v2;

// Create a new banner
const createBanner = async (req, res) => {
  try {
    const {
      description,
      link,
      linkText,
      position,
      isActive,
      startDate,
      endDate,
      targetAudience,
      category,
      tags,
      imageUrl,
      publicId,
      imageWidth,
      imageHeight,
      imageFormat,
      imageBytes
    } = req.body;

    // Validate required fields
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Category is required'
      });
    }

    if (position === undefined || position === null) {
      return res.status(400).json({
        success: false,
        message: 'Position is required'
      });
    }

    // Check if position is already taken for this category
    const existingBanner = await Banner.findOne({
      category: category,
      position: Number(position),
      isActive: true
    });

    if (existingBanner) {
      return res.status(400).json({
        success: false,
        message: `Position ${position} is already set for category "${category}". Please change the position.`
      });
    }

    // Generate a default title
    const resolvedTitle = `Banner ${new Date().toISOString()}`;

    let imageResult = null;

    // Handle image upload - either from file or existing URL
    if (req.file) {
      // Upload new image to Cloudinary
      imageResult = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: 'auto',
              folder: 'precious-jewels/banners',
              transformation: [
                { width: 1200, height: 600, crop: 'limit' },
                { quality: 'auto' }
              ]
            },
            (error, result) => {
              if (error) reject(error);
              else resolve(result);
            }
          )
          .end(req.file.buffer);
      });
    } else if (imageUrl) {
      // Use existing image URL (from previous upload)
      imageResult = {
        secure_url: imageUrl,
        public_id: publicId,
        width: imageWidth,
        height: imageHeight,
        format: imageFormat,
        bytes: imageBytes
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Image is required'
      });
    }

    // Create banner object
    const bannerData = {
      title: resolvedTitle,
      description,
      imageUrl: imageResult.secure_url,
      publicId: imageResult.public_id,
      imageWidth: imageResult.width,
      imageHeight: imageResult.height,
      imageFormat: imageResult.format,
      imageBytes: imageResult.bytes,
      link,
      linkText,
      position: position || 0,
      isActive: isActive !== undefined ? isActive : true,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      targetAudience: targetAudience || 'all',
      category,
      tags: tags ? tags.split(',').map(tag => tag.trim()) : [],
      createdBy: req.admin._id
    };

    const banner = new Banner(bannerData);
    await banner.save();

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: banner
    });

  } catch (error) {
    console.error('Create banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating banner',
      error: error.message
    });
  }
};

// Get all banners with pagination and filtering
const getAllBanners = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      targetAudience,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      filter.category = category;
    }

    if (targetAudience) {
      filter.targetAudience = targetAudience;
    }

    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get banners with pagination
    const banners = await Banner.find(filter)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Banner.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        banners,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalItems: total,
          itemsPerPage: parseInt(limit)
        }
      }
    });

  } catch (error) {
    console.error('Get all banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching banners',
      error: error.message
    });
  }
};

// Get active banners for public display
const getActiveBanners = async (req, res) => {
  try {
    const { targetAudience = 'all', category } = req.query;

    let query = { isActive: true };
    
    if (targetAudience !== 'all') {
      query.$or = [
        { targetAudience: 'all' },
        { targetAudience: targetAudience }
      ];
    }

    if (category) {
      query.category = category;
    }

    // Add date filtering
    const now = new Date();
    query.$and = [
      {
        $or: [
          { startDate: { $exists: false } },
          { startDate: { $lte: now } }
        ]
      },
      {
        $or: [
          { endDate: { $exists: false } },
          { endDate: { $gte: now } }
        ]
      }
    ];

    const banners = await Banner.find(query)
      .sort({ position: 1, createdAt: -1 })
      .select('title description imageUrl link linkText category tags');

    res.status(200).json({
      success: true,
      data: banners
    });

  } catch (error) {
    console.error('Get active banners error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active banners',
      error: error.message
    });
  }
};

// Public: Get active banners by category (from param or query)
const getBannersByCategory = async (req, res) => {
  try {
    const categoryFromParam = req.params.category;
    const categoryFromQuery = req.query.category;
    const category = (categoryFromParam || categoryFromQuery || '').trim();
    const { targetAudience = 'all' } = req.query;

    if (!category) {
      return res.status(400).json({ success: false, message: 'category is required' });
    }

    const now = new Date();
    const query = {
      isActive: true,
      category,
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: { $gte: now } }] }
      ]
    };

    if (targetAudience !== 'all') {
      query.$or = [{ targetAudience: 'all' }, { targetAudience }];
    }

    const banners = await Banner.find(query)
      .sort({ position: 1, createdAt: -1 })
      .select('title description imageUrl link linkText category');

    return res.status(200).json({ success: true, data: banners });
  } catch (error) {
    console.error('Get banners by category error:', error);
    return res.status(500).json({ success: false, message: 'Error fetching banners by category', error: error.message });
  }
};

// Get banner by ID
const getBannerById = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id)
      .populate('createdBy', 'name email')
      .populate('updatedBy', 'name email');

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.status(200).json({
      success: true,
      data: banner
    });

  } catch (error) {
    console.error('Get banner by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching banner',
      error: error.message
    });
  }
};

// Update banner
const updateBanner = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.imageUrl;
    delete updateData.publicId;
    delete updateData.imageWidth;
    delete updateData.imageHeight;
    delete updateData.imageFormat;
    delete updateData.imageBytes;
    delete updateData.createdBy;
    delete updateData.createdAt;

    // Add updatedBy
    updateData.updatedBy = req.admin._id;

    // Handle date fields
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.endDate) {
      updateData.endDate = new Date(updateData.endDate);
    }

    // Handle tags
    if (updateData.tags && typeof updateData.tags === 'string') {
      updateData.tags = updateData.tags.split(',').map(tag => tag.trim());
    }

    const banner = await Banner.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('createdBy', 'name email')
     .populate('updatedBy', 'name email');

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      data: banner
    });

  } catch (error) {
    console.error('Update banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating banner',
      error: error.message
    });
  }
};

// Update banner image
const updateBannerImage = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image is required'
      });
    }

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Delete old image from Cloudinary
    if (banner.publicId) {
      try {
        await cloudinary.uploader.destroy(banner.publicId);
      } catch (error) {
        console.error('Error deleting old image:', error);
      }
    }

    // Upload new image to Cloudinary
    const imageResult = await new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: 'auto',
            folder: 'precious-jewels/banners',
            transformation: [
              { width: 1200, height: 600, crop: 'limit' },
              { quality: 'auto' }
            ]
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(req.file.buffer);
    });

    // Update banner with new image data
    banner.imageUrl = imageResult.secure_url;
    banner.publicId = imageResult.public_id;
    banner.imageWidth = imageResult.width;
    banner.imageHeight = imageResult.height;
    banner.imageFormat = imageResult.format;
    banner.imageBytes = imageResult.bytes;
    banner.updatedBy = req.admin._id;

    await banner.save();

    res.status(200).json({
      success: true,
      message: 'Banner image updated successfully',
      data: banner
    });

  } catch (error) {
    console.error('Update banner image error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating banner image',
      error: error.message
    });
  }
};

// Delete banner
const deleteBanner = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    // Delete image from Cloudinary
    if (banner.publicId) {
      try {
        await cloudinary.uploader.destroy(banner.publicId);
      } catch (error) {
        console.error('Error deleting image from Cloudinary:', error);
      }
    }

    // Delete banner from database
    await Banner.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully'
    });

  } catch (error) {
    console.error('Delete banner error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting banner',
      error: error.message
    });
  }
};

// Toggle banner status
const toggleBannerStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const banner = await Banner.findById(id);
    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    if (typeof req.overrideStatus === 'boolean') {
      banner.isActive = req.overrideStatus;
    } else if (typeof req.body?.isActive === 'boolean') {
      banner.isActive = req.body.isActive;
    } else {
      banner.isActive = !banner.isActive;
    }
    banner.updatedBy = req.admin._id;
    await banner.save();

    res.status(200).json({
      success: true,
      message: `Banner ${banner.isActive ? 'activated' : 'deactivated'} successfully`,
      data: banner
    });

  } catch (error) {
    console.error('Toggle banner status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error toggling banner status',
      error: error.message
    });
  }
};

// Update banner position
const updateBannerPosition = async (req, res) => {
  try {
    const { id } = req.params;
    const { position } = req.body;

    if (position === undefined || position < 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid position is required'
      });
    }

    const banner = await Banner.findByIdAndUpdate(
      id,
      { position, updatedBy: req.admin._id },
      { new: true }
    );

    if (!banner) {
      return res.status(404).json({
        success: false,
        message: 'Banner not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Banner position updated successfully',
      data: banner
    });

  } catch (error) {
    console.error('Update banner position error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating banner position',
      error: error.message
    });
  }
};

// Get banner statistics
const getBannerStats = async (req, res) => {
  try {
    const stats = await Banner.aggregate([
      {
        $group: {
          _id: null,
          totalBanners: { $sum: 1 },
          activeBanners: {
            $sum: { $cond: [{ $eq: ['$isActive', true] }, 1, 0] }
          },
          totalViews: { $sum: '$views' },
          totalClicks: { $sum: '$clicks' },
          avgViews: { $avg: '$views' },
          avgClicks: { $avg: '$clicks' }
        }
      }
    ]);

    const categoryStats = await Banner.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          views: { $sum: '$views' },
          clicks: { $sum: '$clicks' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        overview: stats[0] || {
          totalBanners: 0,
          activeBanners: 0,
          totalViews: 0,
          totalClicks: 0,
          avgViews: 0,
          avgClicks: 0
        },
        categoryStats
      }
    });

  } catch (error) {
    console.error('Get banner stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching banner statistics',
      error: error.message
    });
  }
};

module.exports = {
  createBanner,
  getAllBanners,
  getActiveBanners,
  getBannersByCategory,
  getBannerById,
  updateBanner,
  updateBannerImage,
  deleteBanner,
  toggleBannerStatus,
  updateBannerPosition,
  getBannerStats
};
