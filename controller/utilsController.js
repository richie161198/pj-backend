const asyncHandler = require("express-async-handler");
const { generateOTP } = require("../helpers/helpers");
const { sendEmail } = require("../helpers/mailer");
const InvestmentSettings = require("../models/investment_settings_model");
const adminModel = require("../models/adminModel");
const { updateAllProductPrices, getCurrentPrices } = require("../services/priceCalculationService");
// ✅ GET Investment Settings
const getInvestmentSettings = asyncHandler(async (req, res) => {
  console.log("Fetching Investment Settings...");

  try {


    // fetch latest settings (sorted by updatedAt)
    const settings = await InvestmentSettings.findOne().sort({ updatedAt: -1 });

    if (!settings) {
      return res.status(404).json({
        status: false,
        message: "No investment settings found",
      });
    }

    const result = {
      goldPrice: settings.goldRate ?? null, 
      goldStatus: settings.goldStatus ?? "inactive",
      silverPrice: settings.silverRate ?? null, 
      silverStatus: settings.silverStatus ?? "inactive",
      updatedAt: settings.updatedAt,
    };

    return res.status(200).json({
      status: true,
      data: result,
    });
  } catch (error) {
    console.error("Error fetching investment settings:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// ✅ CREATE / UPDATE Investment Settings
const createInvestmentSettings = asyncHandler(async (req, res) => {
  console.log("createInvestmentSettings:", req.body);
     const requestingAdmin = await adminModel.findById(req.admin.id);
     if (!requestingAdmin ) {
       return res.status(403).json({
         status: false,
         message: 'Not authorized. Only super admins can create or update investment settings.'
       });
     }
  try {
    const { goldRate, goldStatus, silverRate, silverStatus, makingChargesPercentage } = req.body;
console.log("Parsed Input:", { goldRate, goldStatus, silverRate, silverStatus, makingChargesPercentage });
    if (!goldRate || !silverRate) {
      return res.status(400).json({
        status: false,
        message: "Gold rate and Silver rate are required",
      });
    }

    // Get previous prices to check if they changed
    const previousSettings = await InvestmentSettings.findOne().sort({ updatedAt: -1 });
    const pricesChanged = !previousSettings || 
      previousSettings.goldRate !== goldRate || 
      previousSettings.silverRate !== silverRate;

    // either update existing or create new
    let settings = await InvestmentSettings.findOne();
    if (settings) {
      settings.goldRate = goldRate;
      settings.goldStatus = goldStatus ?? settings.goldStatus;
      settings.silverRate = silverRate;
      settings.silverStatus = silverStatus ?? settings.silverStatus;
      if (makingChargesPercentage) {
        settings.makingChargesPercentage = makingChargesPercentage;
      }
      await settings.save();
    } else {
      settings = await InvestmentSettings.create({
        ...req.body,
        makingChargesPercentage: makingChargesPercentage || 15
      });
    }

    // If prices changed, update all product prices
    if (pricesChanged) {
      console.log("🔄 Prices changed, updating all product prices...");
      try {
        const updateResult = await updateAllProductPrices(
          goldRate, 
          silverRate, 
          settings.makingChargesPercentage || 15
        );
        
        console.log("✅ Product prices updated:", updateResult);
        
        return res.status(201).json({
          status: true,
          message: "✅ Investment settings saved successfully and all product prices updated",
          settings,
          productUpdateResult: updateResult
        });
      } catch (updateError) {
        console.error("❌ Error updating product prices:", updateError);
        return res.status(201).json({
          status: true,
          message: "✅ Investment settings saved successfully, but failed to update some product prices",
          settings,
          warning: "Some product prices may not have been updated. Please check manually."
        });
      }
    } else {
      console.log("ℹ️ Prices unchanged, skipping product price updates");
      return res.status(201).json({
        status: true,
        message: "✅ Investment settings saved successfully (no price changes detected)",
        settings,
      });
    }

  } catch (error) {
    console.error("Error creating investment settings:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});


const getbanners = asyncHandler(async (req, res) => {
    res.status(200).json({message:"banners"})
})

const sendMailotp = asyncHandler( async (req, res) => {
  try {
    const { toEmail, toName } = req.body;
console.log("sendMailotp", toEmail, toName);
    if (!toEmail) {
      return res.status(400).json({ error: 'Recipient email is required' });
    }

    const otp = generateOTP();
    const htmlContent = `
      <h2>Your OTP Code</h2>
      <p>Dear ${toName || 'User'},</p>
      <p>Your OTP is: <strong>${otp}</strong></p>
      <p>This code will expire in 10 minutes.</p>
    `;

  

    const response = await sendEmail(toEmail, 'Your OTP Code', htmlContent, toName);


    res.json({ success: true, data: response, otp });
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

const uploadimages = asyncHandler(async (req, res) => {
  // console.log(req.file);
  //   if (!req.file) {
  //   return res.status(400).json({ error: 'No file uploaded' });
  // }

  // cloudinary.uploader.upload_stream({ resource_type: 'auto' }, (error, result) => {
  //   if (error) {
  //     console.log(error);
  //     return res.status(500).json({ error: 'Error uploading to Cloudinary' });
  //   }
  //   res.json({ public_id: result.public_id, url: result.secure_url });
  // }).end(req.file.buffer);
})

// ✅ MANUALLY UPDATE ALL PRODUCT PRICES
const updateAllProductPricesManually = asyncHandler(async (req, res) => {
  console.log("Manually updating all product prices...");
  
  const requestingAdmin = await adminModel.findById(req.admin.id);
  if (!requestingAdmin) {
    return res.status(403).json({
      status: false,
      message: 'Not authorized. Only admins can update product prices.'
    });
  }

  try {
    // Get current prices
    const currentPrices = await getCurrentPrices();
    
    if (!currentPrices.goldPrice || !currentPrices.silverPrice) {
      return res.status(400).json({
        status: false,
        message: "Gold and Silver prices must be set before updating product prices"
      });
    }

    // Update all product prices
    const updateResult = await updateAllProductPrices(
      currentPrices.goldPrice,
      currentPrices.silverPrice,
      req.body.makingChargesPercentage || 15
    );

    return res.status(200).json({
      status: true,
      message: "✅ All product prices updated successfully",
      data: updateResult,
      currentPrices: {
        goldPrice: currentPrices.goldPrice,
        silverPrice: currentPrices.silverPrice,
        makingChargesPercentage: req.body.makingChargesPercentage || 15
      }
    });

  } catch (error) {
    console.error("Error updating product prices:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// ✅ UPDATE SINGLE PRODUCT PRICE
const updateSingleProductPrice = asyncHandler(async (req, res) => {
  console.log("Updating single product price:", req.params.id);
  
  const requestingAdmin = await adminModel.findById(req.admin.id);
  if (!requestingAdmin) {
    return res.status(403).json({
      status: false,
      message: 'Not authorized. Only admins can update product prices.'
    });
  }

  try {
    const { updateSingleProductPrice } = require("../services/priceCalculationService");
    
    // Get current prices
    const currentPrices = await getCurrentPrices();
    
    if (!currentPrices.goldPrice || !currentPrices.silverPrice) {
      return res.status(400).json({
        status: false,
        message: "Gold and Silver prices must be set before updating product prices"
      });
    }

    // Update single product price
    const updateResult = await updateSingleProductPrice(
      req.params.id,
      currentPrices.goldPrice,
      currentPrices.silverPrice,
      req.body.makingChargesPercentage || 15
    );

    return res.status(200).json({
      status: true,
      message: "✅ Product price updated successfully",
      data: updateResult
    });

  } catch (error) {
    console.error("Error updating single product price:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// ✅ GET DETAILED PRICE BREAKDOWN FOR A PRODUCT
const getProductPriceBreakdown = asyncHandler(async (req, res) => {
  console.log("Getting price breakdown for product:", req.params.id);
  
  try {
    const Product = require("../models/product_model");
    const { calculateProductPrice } = require("../services/priceCalculationService");
    
    // Get product
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({
        status: false,
        message: "Product not found"
      });
    }
    
    // Get current prices
    const currentPrices = await getCurrentPrices();
    
    if (!currentPrices.goldPrice || !currentPrices.silverPrice) {
      return res.status(400).json({
        status: false,
        message: "Gold and Silver prices must be set to calculate product prices"
      });
    }

    // Calculate detailed price breakdown
    const priceCalculation = calculateProductPrice(
      product,
      currentPrices.goldPrice,
      currentPrices.silverPrice,
      req.query.makingChargesPercentage || 15
    );

    return res.status(200).json({
      status: true,
      message: "✅ Product price breakdown calculated successfully",
      data: {
        product: {
          _id: product._id,
          name: product.name,
          brand: product.brand,
          categories: product.categories
        },
        currentPrices: {
          goldPrice: currentPrices.goldPrice,
          silverPrice: currentPrices.silverPrice,
          makingChargesPercentage: req.query.makingChargesPercentage || 15
        },
        priceBreakdown: priceCalculation.priceBreakdown,
        summary: {
          goldValue: priceCalculation.goldValue,
          silverValue: priceCalculation.silverValue,
          stoneValue: priceCalculation.stoneValue,
          totalMetalValue: priceCalculation.totalMetalValue,
          makingCharges: priceCalculation.makingCharges,
          subtotal: priceCalculation.subtotal,
          gstAmount: priceCalculation.gstAmount,
          discountAmount: priceCalculation.discountAmount,
          finalPrice: priceCalculation.finalPrice,
          totalWeight: priceCalculation.totalWeight
        }
      }
    });

  } catch (error) {
    console.error("Error getting product price breakdown:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

module.exports={
  getInvestmentSettings,
  sendMailotp,
  getbanners,
  uploadimages,
  createInvestmentSettings,
  updateAllProductPricesManually,
  updateSingleProductPrice,
  getProductPriceBreakdown
}