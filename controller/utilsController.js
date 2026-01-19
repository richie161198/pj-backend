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
      investmentEnabled: settings.investmentEnabled ?? true,
      goldPrice: settings.goldRate24kt || settings.goldRate || null, // 24kt for backward compatibility
      goldPrice24kt: settings.goldRate24kt || settings.goldRate || null,
      goldPrice22kt: settings.goldRate22kt || null,
      goldPrice18kt: settings.goldRate18kt || null,
      goldStatus: settings.goldStatus ?? "inactive",
      silverPrice: settings.silverRate ?? null,
      silverPrice925: settings.silverRate925 || (settings.silverRate ? parseFloat((settings.silverRate * 0.925).toFixed(2)) : null),
      silverStatus: settings.silverStatus ?? "inactive",
      goldPremiumPercentage: settings.goldPremiumPercentage ?? 9.5,
      silverPremiumPercentage: settings.silverPremiumPercentage ?? 9.5,
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
    const { 
      goldRate, 
      goldRate24kt, 
      goldRate22kt, 
      goldRate18kt, 
      goldStatus, 
      silverRate, 
      silverRate925,
      silverStatus, 
      makingChargesPercentage,
      goldPremiumPercentage,
      silverPremiumPercentage
    } = req.body;
    
    console.log("Parsed Input:", { 
      goldRate, 
      goldRate24kt, 
      goldRate22kt, 
      goldRate18kt, 
      goldStatus, 
      silverRate, 
      silverStatus, 
      makingChargesPercentage 
    });
    
    // Use goldRate24kt if provided, otherwise fall back to goldRate for backward compatibility
    const finalGoldRate24kt = goldRate24kt || goldRate;
    
    if (!finalGoldRate24kt || !silverRate) {
      return res.status(400).json({
        status: false,
        message: "Gold rate (24kt) and Silver rate are required",
      });
    }

    // Get previous prices to check if they changed
    const previousSettings = await InvestmentSettings.findOne().sort({ updatedAt: -1 });
    const pricesChanged = !previousSettings || 
      previousSettings.goldRate24kt !== finalGoldRate24kt || 
      previousSettings.goldRate22kt !== (goldRate22kt || 0) ||
      previousSettings.goldRate18kt !== (goldRate18kt || 0) ||
      previousSettings.silverRate !== silverRate;

    // either update existing or create new
    let settings = await InvestmentSettings.findOne();
    if (settings) {
      // Update goldRate for backward compatibility (use 24kt value)
      settings.goldRate = finalGoldRate24kt;
      settings.goldRate24kt = finalGoldRate24kt;
      settings.goldRate22kt = goldRate22kt || 0;
      settings.goldRate18kt = goldRate18kt || 0;
      settings.goldStatus = goldStatus ?? settings.goldStatus;
      settings.silverRate = silverRate;
      // Auto-calculate 92.5% silver if not provided
      settings.silverRate925 = silverRate925 || parseFloat((silverRate * 0.925).toFixed(2));
      settings.silverStatus = silverStatus ?? settings.silverStatus;
      if (makingChargesPercentage) {
        settings.makingChargesPercentage = makingChargesPercentage;
      }
      if (goldPremiumPercentage != null && !isNaN(goldPremiumPercentage)) {
        settings.goldPremiumPercentage = parseFloat(goldPremiumPercentage);
      }
      if (silverPremiumPercentage != null && !isNaN(silverPremiumPercentage)) {
        settings.silverPremiumPercentage = parseFloat(silverPremiumPercentage);
      }
      await settings.save();
    } else {
      settings = await InvestmentSettings.create({
        goldRate: finalGoldRate24kt, // Backward compatibility
        goldRate24kt: finalGoldRate24kt,
        goldRate22kt: goldRate22kt || 0,
        goldRate18kt: goldRate18kt || 0,
        goldStatus: goldStatus ?? true,
        silverRate: silverRate,
        silverRate925: silverRate925 || parseFloat((silverRate * 0.925).toFixed(2)), // Auto-calculate if not provided
        silverStatus: silverStatus ?? false,
        makingChargesPercentage: makingChargesPercentage || 15,
        goldPremiumPercentage: goldPremiumPercentage != null && !isNaN(goldPremiumPercentage) ? parseFloat(goldPremiumPercentage) : 9.5,
        silverPremiumPercentage: silverPremiumPercentage != null && !isNaN(silverPremiumPercentage) ? parseFloat(silverPremiumPercentage) : 9.5
      });
    }

    // If prices changed, update all product prices
    if (pricesChanged) {
      console.log("🔄 Prices changed, updating all product prices...");
      try {
        const updateResult = await updateAllProductPrices(
          finalGoldRate24kt, // 24kt gold price
          goldRate22kt || 0, // 22kt gold price
          goldRate18kt || 0, // 18kt gold price
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
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <style>
          @media only screen and (max-width: 600px) {
            .email-container {
              width: 100% !important;
              max-width: 100% !important;
              padding: 15px !important;
            }
            .email-content {
              padding: 20px 15px !important;
            }
            .otp-box {
              padding: 20px 15px !important;
            }
            .otp-code {
              font-size: 32px !important;
              letter-spacing: 6px !important;
              padding: 15px 20px !important;
            }
            .email-title {
              font-size: 20px !important;
            }
            .email-text {
              font-size: 14px !important;
            }
          }
        </style>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 20px 10px;">
              <table role="presentation" class="email-container" style="width: 100%; max-width: 500px; border-collapse: collapse; background-color: #ffffff; border-radius: 10px; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td class="email-content" style="padding: 30px; text-align: center;">
                    <h2 class="email-title" style="margin: 0 0 20px; color: #333; font-size: 24px;">Your OTP Code</h2>
                    <p class="email-text" style="margin: 0 0 15px; color: #555; font-size: 16px;">Dear ${toName || 'User'},</p>
                    <div class="otp-box" style="background: linear-gradient(135deg, #f9f4ef 0%, #fff8f0 100%); border: 2px solid #D4AF37; border-radius: 10px; padding: 25px; margin: 20px 0; display: inline-block;">
                      <p style="margin: 0 0 10px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Verification Code</p>
                      <div class="otp-code" style="font-size: 36px; font-weight: bold; color: #333; letter-spacing: 8px; font-family: 'Courier New', monospace; background: #D4AF37; padding: 15px 25px; border-radius: 8px; margin: 10px 0;">
                        ${otp}
                      </div>
                      <p style="margin: 15px 0 0; color: #999; font-size: 12px;">This code expires in <strong style="color: #d4a574;">10 minutes</strong></p>
                    </div>
                    <p class="email-text" style="margin: 20px 0 0; color: #888; font-size: 13px; line-height: 1.6;">
                      If you did not request this code, please ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px; text-align: center; background: #fafafa; border-top: 1px solid #eee;">
                    <p style="margin: 0; color: #aaa; font-size: 11px;">
                      © ${new Date().getFullYear()} Precious Goldsmith. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
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
    
    if (!currentPrices.goldPrice24kt || !currentPrices.silverPrice) {
      return res.status(400).json({
        status: false,
        message: "Gold (24kt) and Silver prices must be set before updating product prices"
      });
    }

    // Update all product prices with karat-specific gold rates
    const updateResult = await updateAllProductPrices(
      currentPrices.goldPrice24kt || currentPrices.goldPrice,
      currentPrices.goldPrice22kt || currentPrices.goldPrice24kt || currentPrices.goldPrice,
      currentPrices.goldPrice18kt || currentPrices.goldPrice24kt || currentPrices.goldPrice,
      currentPrices.silverPrice,
      req.body.makingChargesPercentage || 15
    );

    return res.status(200).json({
      status: true,
      message: "✅ All product prices updated successfully",
      data: updateResult,
      currentPrices: {
        goldPrice24kt: currentPrices.goldPrice24kt || currentPrices.goldPrice,
        goldPrice22kt: currentPrices.goldPrice22kt,
        goldPrice18kt: currentPrices.goldPrice18kt,
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
    
    if (!currentPrices.goldPrice24kt || !currentPrices.silverPrice) {
      return res.status(400).json({
        status: false,
        message: "Gold (24kt) and Silver prices must be set before updating product prices"
      });
    }

    // Update single product price with karat-specific gold rates
    const updateResult = await updateSingleProductPrice(
      req.params.id,
      currentPrices.goldPrice24kt || currentPrices.goldPrice,
      currentPrices.goldPrice22kt || currentPrices.goldPrice24kt || currentPrices.goldPrice,
      currentPrices.goldPrice18kt || currentPrices.goldPrice24kt || currentPrices.goldPrice,
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
    
    if (!currentPrices.goldPrice24kt || !currentPrices.silverPrice) {
      return res.status(400).json({
        status: false,
        message: "Gold (24kt) and Silver prices must be set to calculate product prices"
      });
    }

    // Determine which gold price to use based on product's selectedCaret
    let selectedGoldPrice = currentPrices.goldPrice24kt || currentPrices.goldPrice;
    const caret = (product.selectedCaret || '').toString().toUpperCase().trim();
    
    if (caret.includes('24') || caret === '24K' || caret === '24KT') {
      selectedGoldPrice = currentPrices.goldPrice24kt || currentPrices.goldPrice;
    } else if (caret.includes('22') || caret === '22K' || caret === '22KT') {
      selectedGoldPrice = currentPrices.goldPrice22kt || currentPrices.goldPrice24kt || currentPrices.goldPrice;
    } else if (caret.includes('18') || caret === '18K' || caret === '18KT') {
      selectedGoldPrice = currentPrices.goldPrice18kt || currentPrices.goldPrice24kt || currentPrices.goldPrice;
    }

    // Calculate detailed price breakdown
    const priceCalculation = calculateProductPrice(
      product,
      selectedGoldPrice,
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
          goldPrice24kt: currentPrices.goldPrice24kt || currentPrices.goldPrice,
          goldPrice22kt: currentPrices.goldPrice22kt,
          goldPrice18kt: currentPrices.goldPrice18kt,
          silverPrice: currentPrices.silverPrice,
          makingChargesPercentage: req.query.makingChargesPercentage || 15,
          selectedCaret: product.selectedCaret || 'N/A',
          goldPriceUsed: selectedGoldPrice
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

// ✅ GET Investment Option Status
const getInvestmentOption = asyncHandler(async (req, res) => {
  console.log("Fetching Investment Option Status...");

  try {
    const settings = await InvestmentSettings.findOne().sort({ updatedAt: -1 });

    if (!settings) {
      return res.status(200).json({
        status: true,
        data: {
          investmentEnabled: true, // Default to enabled if no settings exist
          appointmentEnabled: true, // Default to enabled if no settings exist
        },
      });
    }

    return res.status(200).json({
      status: true,
      data: {
        investmentEnabled: settings.investmentEnabled ?? true,
        appointmentEnabled: settings.appointmentEnabled ?? true,
      },
    });
  } catch (error) {
    console.error("Error fetching investment option:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// ✅ UPDATE Investment Option Status
const updateInvestmentOption = asyncHandler(async (req, res) => {
  console.log("Updating Investment Option:", req.body);
  
  const requestingAdmin = await adminModel.findById(req.admin.id);
  if (!requestingAdmin) {
    return res.status(403).json({
      status: false,
      message: 'Not authorized. Only super admins can update investment option.'
    });
  }

  try {
    const { investmentEnabled } = req.body;

    if (typeof investmentEnabled !== 'boolean') {
      return res.status(400).json({
        status: false,
        message: "investmentEnabled must be a boolean value",
      });
    }

    let settings = await InvestmentSettings.findOne();
    if (settings) {
      settings.investmentEnabled = investmentEnabled;
      settings.updatedAt = new Date();
      await settings.save();
    } else {
      // Create new settings with default values
      settings = await InvestmentSettings.create({
        investmentEnabled: investmentEnabled,
        appointmentEnabled: true,
        goldRate: 0,
        goldRate24kt: 0,
        goldRate22kt: 0,
        goldRate18kt: 0,
        silverRate: 0,
        goldStatus: true,
        silverStatus: false,
        makingChargesPercentage: 15,
      });
    }

    return res.status(200).json({
      status: true,
      message: `Investment option ${investmentEnabled ? 'enabled' : 'disabled'} successfully`,
      data: {
        investmentEnabled: settings.investmentEnabled,
      },
    });
  } catch (error) {
    console.error("Error updating investment option:", error);
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
});

// ✅ GET Appointment Option Status
const getAppointmentOption = asyncHandler(async (req, res) => {
  console.log("Fetching Appointment Option Status...");

  try {
    const settings = await InvestmentSettings.findOne().sort({ updatedAt: -1 });

    if (!settings) {
      return res.status(200).json({
        status: true,
        data: {
          appointmentEnabled: true, // Default to enabled if no settings exist
        },
      });
    }

    return res.status(200).json({
      status: true,
      data: {
        appointmentEnabled: settings.appointmentEnabled ?? true,
      },
    });
  } catch (error) {
    console.error("Error fetching appointment option:", error);
    return res.status(500).json({
      status: false,
      message: "Internal Server Error",
      error: error.message,
    });
  }
});

// ✅ UPDATE Appointment Option Status
const updateAppointmentOption = asyncHandler(async (req, res) => {
  console.log("Updating Appointment Option:", req.body);
  
  const requestingAdmin = await adminModel.findById(req.admin.id);
  if (!requestingAdmin) {
    return res.status(403).json({
      status: false,
      message: 'Not authorized. Only super admins can update appointment option.'
    });
  }

  try {
    const { appointmentEnabled } = req.body;

    if (typeof appointmentEnabled !== 'boolean') {
      return res.status(400).json({
        status: false,
        message: "appointmentEnabled must be a boolean value",
      });
    }

    let settings = await InvestmentSettings.findOne();
    if (settings) {
      settings.appointmentEnabled = appointmentEnabled;
      settings.updatedAt = new Date();
      await settings.save();
    } else {
      // Create new settings with default values
      settings = await InvestmentSettings.create({
        investmentEnabled: true,
        appointmentEnabled: appointmentEnabled,
        goldRate: 0,
        goldRate24kt: 0,
        goldRate22kt: 0,
        goldRate18kt: 0,
        silverRate: 0,
        goldStatus: true,
        silverStatus: false,
        makingChargesPercentage: 15,
      });
    }

    return res.status(200).json({
      status: true,
      message: `Appointment option ${appointmentEnabled ? 'enabled' : 'disabled'} successfully`,
      data: {
        appointmentEnabled: settings.appointmentEnabled,
      },
    });
  } catch (error) {
    console.error("Error updating appointment option:", error);
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
  getProductPriceBreakdown,
  getInvestmentOption,
  updateInvestmentOption,
  getAppointmentOption,
  updateAppointmentOption
}