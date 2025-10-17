const Product = require('../models/product_model');
const InvestmentSettings = require('../models/investment_settings_model');

/**
 * Calculate product price based on live gold/silver price and admin-entered percentages.
 * Rules:
 * - Gold/Silver values are ALWAYS recalculated from live rates and product weights.
 * - Making charges: percentage of (gold + silver + stone) when percentage is provided
 *   - Read percentage from priceDetails item "Making Charges" -> weight like "15%"
 *   - Else fallback to function arg makingChargesPercentage
 * - Discount: percentage of Sub Total when discount is available
 *   - Prefer product.Discount (as percentage) when product.isDiscountAvailable is true
 *   - Else read from priceDetails "Discount" -> weight like "10%"
 * - GST: percentage applied AFTER discount over Sub Total After Discount
 */
const calculateProductPrice = (product, goldPrice, silverPrice, makingChargesPercentage = 15) => {
  // Get existing price details
  const existingPriceDetails = product.priceDetails || [];
  
  // Calculate new gold and silver values
  let newGoldValue = 0;
  let newSilverValue = 0;
  let goldWeight = 0;
  let silverWeight = 0;
  let goldKarat = '';
  let silverType = '';

  // Extract gold and silver details from productDetails
  console.log(`\n[Price Calc] Processing product: ${product.name}`);
  console.log(`[Price Calc] productDetails length: ${product.productDetails?.length || 0}`);
  
  if (product.productDetails && Array.isArray(product.productDetails)) {
    product.productDetails.forEach((detail, idx) => {
      console.log(`\n[Price Calc] Detail #${idx}: type="${detail.type}"`);
      
      if (detail.type === 'Metal' && detail.attributes) {
        console.log(`[Price Calc] Attributes object:`, detail.attributes);
        console.log(`[Price Calc] Attributes has .get method:`, typeof detail.attributes?.get === 'function');
        console.log(`[Price Calc] Attributes keys:`, Object.keys(detail.attributes || {}));
        
        // Handle both Mongoose Map and plain object attributes
        const getAttr = (key) => {
          let value;
          if (detail.attributes.get && typeof detail.attributes.get === 'function') {
            value = detail.attributes.get(key);
            console.log(`[Price Calc]   getAttr('${key}') via .get() =`, value);
          } else {
            value = detail.attributes[key];
            console.log(`[Price Calc]   getAttr('${key}') via bracket =`, value);
          }
          return value;
        };
        
        const karatage = getAttr('Karatage') || getAttr('karatage') || getAttr('karat');
        const grossWeight = getAttr('Gross Weight') || getAttr('gross weight') || getAttr('weight');
        const weight = parseFloat(grossWeight?.toString().replace('g', '').trim() || 0);
        const materialColor = getAttr('Material Colour') || getAttr('Material Color') || getAttr('material colour') || getAttr('material color') || getAttr('color') || '';
        const metal = getAttr('Metal') || getAttr('metal') || '';
        
        console.log(`[Price Calc] Extracted: karatage="${karatage}", weight=${weight}, materialColor="${materialColor}", metal="${metal}"`);
        
        if (karatage && weight > 0) {
          // Enhanced gold detection - check multiple indicators
          const isGold = karatage.includes('K') || 
                        karatage.toLowerCase().includes('k') ||
                        materialColor.toLowerCase().includes('gold') || 
                        materialColor.toLowerCase().includes('yellow') ||
                        metal.toLowerCase().includes('gold');
          
          const isSilver = karatage.toLowerCase().includes('silver') || 
                           materialColor.toLowerCase().includes('silver') || 
                           metal.toLowerCase().includes('silver');
          
          if (isGold) {
            // Gold calculation
            const karat = parseFloat(karatage.replace(/[^\d.]/g, '')) || 24;
            const goldPurity = karat / 24; // Convert to purity (e.g., 18K = 0.75)
            const value = (goldPrice * goldPurity * weight);
            console.log(`✨ Gold: ${karat}K, ${weight}g @ ₹${goldPrice}/g = ₹${value.toFixed(2)}`);
            newGoldValue += value;
            goldWeight += weight;
            goldKarat = karatage;
          } else if (isSilver) {
            // Silver calculation
            const value = (silverPrice * weight);
            console.log(`✨ Silver: ${karatage}, ${weight}g @ ₹${silverPrice}/g = ₹${value.toFixed(2)}`);
            newSilverValue += value;
            silverWeight += weight;
            silverType = karatage;
          } else {
            console.log(`[Price Calc] ❌ Unknown metal type: karatage="${karatage}", color="${materialColor}", metal="${metal}"`);
          }
        } else {
          console.log(`[Price Calc] ❌ Skipped: Missing karatage or weight <= 0`);
        }
      }
    });
  }
  
  console.log(`\n[Price Calc] FINAL: Gold=${newGoldValue.toFixed(2)} (${goldWeight}g), Silver=${newSilverValue.toFixed(2)} (${silverWeight}g)\n`);

  // Preserve existing non-metal values
  let existingStoneValue = 0;
  let existingOtherValue = 0;
  let existingMakingChargesValueIfFixed = 0; // Fixed value (legacy)
  let existingMakingChargesPct = null;      // Prefer percentage if present
  let existingGST = 0;                      // Fixed GST value, rarely set
  let existingDiscountPct = null;           // Prefer percentage if present

  // Extract existing values from priceDetails
  existingPriceDetails.forEach(item => {
    const name = item.name?.toLowerCase() || '';
    const value = parseFloat(item.value) || 0;
    
    if (name.includes('stone') || name.includes('diamond') || name.includes('ruby') || 
        name.includes('emerald') || name.includes('sapphire') || name.includes('pearl')) {
      existingStoneValue += value;
    } else if (name.includes('making charges')) {
      // Try to read percentage from weight like "15%"
      const pctStr = (item.weight || '').toString();
      if (/%/.test(pctStr)) {
        const pct = parseFloat(pctStr.replace('%',''));
        if (!isNaN(pct)) existingMakingChargesPct = pct;
      } else {
        existingMakingChargesValueIfFixed = value; // legacy fixed value
      }
    } else if (name.includes('gst')) {
      existingGST = value; // Preserve existing GST
    } else if (name.includes('discount')) {
      const pctStr = (item.weight || '').toString();
      if (/%/.test(pctStr)) {
        const pct = parseFloat(pctStr.replace('%',''));
        if (!isNaN(pct)) existingDiscountPct = pct;
      }
    } else if (!name.includes('gold') && !name.includes('silver') && 
               !name.includes('total') && !name.includes('final') && 
               !name.includes('grand') && !name.includes('subtotal')) {
      // Other elements (not gold, silver, or totals)
      existingOtherValue += value;
    }
  });

  // Calculate new metal value
  const newMetalValue = newGoldValue + newSilverValue;
  const baseForMakingCharges = newMetalValue + existingStoneValue; // gold + silver + stone

  // Determine Making Charges percentage precedence: existing percentage in details > function arg
  const resolvedMakingPct = (existingMakingChargesPct != null ? existingMakingChargesPct : makingChargesPercentage);
  // If legacy fixed making charges value exists and no percentage present, keep it; else compute from percentage
  const computedMakingFromPct = (baseForMakingCharges * (resolvedMakingPct || 0)) / 100;
  const finalMakingCharges = (existingMakingChargesPct == null && existingMakingChargesValueIfFixed > 0)
    ? existingMakingChargesValueIfFixed
    : computedMakingFromPct;

  // Subtotal before discount and GST
  const subTotal = baseForMakingCharges + existingOtherValue + finalMakingCharges;

  // Resolve discount percent: product.Discount (if enabled) > existing priceDetails percent
  let resolvedDiscountPct = 0;
  if (product.isDiscountAvailable && product.Discount > 0) {
    resolvedDiscountPct = Number(product.Discount) || 0; // treat as percentage
  } else if (existingDiscountPct != null) {
    resolvedDiscountPct = existingDiscountPct;
  }
  const discountAmount = (subTotal * resolvedDiscountPct) / 100;
  const subTotalAfterDiscount = Math.max(0, subTotal - discountAmount);

  // GST on subtotal after discount
  const gstPct = Number(product.gst || 0);
  const finalGST = existingGST > 0 ? existingGST : (subTotalAfterDiscount * gstPct) / 100;
  
  console.log(`Product: ${product.name}`);
  const existingMakingChargesLabel = (existingMakingChargesPct != null)
    ? `${existingMakingChargesPct}%`
    : (existingMakingChargesValueIfFixed || 0);
  console.log(`- Existing Making Charges: ${existingMakingChargesLabel}, Final: ${finalMakingCharges}`);
  console.log(`- Existing GST: ${existingGST}, Final: ${finalGST}`);
  console.log(`- New Metal Value: ${newMetalValue} (Gold: ${newGoldValue}, Silver: ${newSilverValue})`);
  console.log(`- Preserved Stone Value: ${existingStoneValue}, Other Value: ${existingOtherValue}`);

  const newSubtotal = subTotal; // for compatibility in returns below
  const totalBeforeDiscount = subTotalAfterDiscount + finalGST;
  const finalPrice = Math.max(0, totalBeforeDiscount);

  // Build updated price details preserving existing structure
  const updatedPriceDetails = [];
  
  // Add gold if present
  if (newGoldValue > 0) {
    updatedPriceDetails.push({
      name: 'Gold',
      weight: `${goldWeight}g`,
      value: newGoldValue,
      details: `${goldKarat} - ₹${goldPrice.toLocaleString()}/g`
    });
  }
  
  // Add silver if present
  if (newSilverValue > 0) {
    updatedPriceDetails.push({
      name: 'Silver',
      weight: `${silverWeight}g`,
      value: newSilverValue,
      details: `${silverType} - ₹${silverPrice.toLocaleString()}/g`
    });
  }
  
  // Preserve existing stone and other elements
  existingPriceDetails.forEach(item => {
    const name = item.name?.toLowerCase() || '';
    if (name.includes('stone') || name.includes('diamond') || name.includes('ruby') || 
        name.includes('emerald') || name.includes('sapphire') || name.includes('pearl') ||
        (!name.includes('gold') && !name.includes('silver') && 
         !name.includes('making') && !name.includes('subtotal') && 
         !name.includes('gst') && !name.includes('discount') && 
         !name.includes('total') && !name.includes('final'))) {
      updatedPriceDetails.push(item);
    }
  });
  
  // Add making charges (preserve existing or use new)
  const makingChargesWeightLabel = (existingMakingChargesPct != null) 
    ? `${existingMakingChargesPct}%` 
    : (existingMakingChargesValueIfFixed > 0 ? 'Preserved' : `${resolvedMakingPct}%`);
  updatedPriceDetails.push({
    name: 'Making Charges',
    weight: makingChargesWeightLabel,
    value: finalMakingCharges
  });
  
  // Add subtotal
  updatedPriceDetails.push({
    name: 'Sub Total',
    weight: `${(goldWeight + silverWeight).toFixed(3)}g Gross Wt.`,
    value: newSubtotal
  });
  
  // Add discount details
  updatedPriceDetails.push({
    name: 'Discount',
    weight: `${resolvedDiscountPct || 0}%`,
    value: discountAmount > 0 ? discountAmount : 0
  });
  
  // Sub total after discount
  updatedPriceDetails.push({
    name: 'Subtotal after discount',
    weight: 'After discount',
    value: subTotalAfterDiscount
  });
  
  // Add GST (always show, even if 0)
  updatedPriceDetails.push({
    name: 'GST',
    weight: `${gstPct}%`,
    value: finalGST
  });
  
  // Add final price
  updatedPriceDetails.push({
    name: 'Grand Total',
    weight: 'Final Price',
    value: finalPrice
  });

  return {
    // Individual values
    goldValue: newGoldValue,
    silverValue: newSilverValue,
    stoneValue: existingStoneValue,
    otherValue: existingOtherValue,
    totalMetalValue: newMetalValue,
    makingCharges: finalMakingCharges,
    subtotal: newSubtotal,
    subtotalAfterDiscount: subTotalAfterDiscount,
    gstAmount: finalGST,
    totalBeforeDiscount: totalBeforeDiscount,
    discountAmount: discountAmount,
    finalPrice: finalPrice,
    
    // Weights and details
    goldWeight: goldWeight,
    silverWeight: silverWeight,
    totalWeight: goldWeight + silverWeight,
    
    // Updated price details
    updatedPriceDetails: updatedPriceDetails,
    
    // Metadata
    hasGold: newGoldValue > 0,
    hasSilver: newSilverValue > 0,
    hasStones: existingStoneValue > 0,
    hasOtherElements: existingOtherValue > 0,
    goldKarat: goldKarat,
    silverType: silverType
  };
};

/**
 * Update all product prices when gold/silver prices change
 */
const updateAllProductPrices = async (goldPrice, silverPrice, makingChargesPercentage = 15) => {
  try {
    console.log(`Updating product prices with Gold: ₹${goldPrice}, Silver: ₹${silverPrice}`);
    
    const products = await Product.find({ active: true });
    let updatedCount = 0;
    let errorCount = 0;

    for (const product of products) {
      try {
        const priceCalculation = calculateProductPrice(product, goldPrice, silverPrice, makingChargesPercentage);
        
        // Use the updated price details from the calculation (preserves existing structure)
        const updatedPriceDetails = priceCalculation.updatedPriceDetails;

        // Update the product
        await Product.findByIdAndUpdate(product._id, {
          priceDetails: updatedPriceDetails,
          sellingprice: priceCalculation.finalPrice,
          $set: {
            'priceDetails': updatedPriceDetails,
            'sellingprice': priceCalculation.finalPrice,
            'lastPriceUpdate': new Date()
          }
        });

        updatedCount++;
        console.log(`Updated product: ${product.name} - Final Price: ₹${priceCalculation.finalPrice}`);
        
      } catch (error) {
        console.error(`Error updating product ${product.name}:`, error);
        errorCount++;
      }
    }

    return {
      success: true,
      totalProducts: products.length,
      updatedCount: updatedCount,
      errorCount: errorCount,
      message: `Updated ${updatedCount} products successfully. ${errorCount} errors occurred.`
    };

  } catch (error) {
    console.error('Error updating product prices:', error);
    throw error;
  }
};

/**
 * Update a single product price
 */
const updateSingleProductPrice = async (productId, goldPrice, silverPrice, makingChargesPercentage = 15) => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    const priceCalculation = calculateProductPrice(product, goldPrice, silverPrice, makingChargesPercentage);
    
    // Use the updated price details from the calculation (preserves existing structure)
    const updatedPriceDetails = priceCalculation.updatedPriceDetails;

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(productId, {
      priceDetails: updatedPriceDetails,
      sellingprice: priceCalculation.finalPrice,
      lastPriceUpdate: new Date()
    }, { new: true });

    return {
      success: true,
      product: updatedProduct,
      priceCalculation: priceCalculation,
      message: `Product ${product.name} price updated successfully`
    };

  } catch (error) {
    console.error('Error updating single product price:', error);
    throw error;
  }
};

/**
 * Get current gold and silver prices
 */
const getCurrentPrices = async () => {
  try {
    const settings = await InvestmentSettings.findOne().sort({ updatedAt: -1 });
    if (!settings) {
      throw new Error('No investment settings found');
    }
    
    return {
      goldPrice: settings.goldRate,
      silverPrice: settings.silverRate,
      goldStatus: settings.goldStatus,
      silverStatus: settings.silverStatus
    };
  } catch (error) {
    console.error('Error getting current prices:', error);
    throw error;
  }
};

module.exports = {
  calculateProductPrice,
  updateAllProductPrices,
  updateSingleProductPrice,
  getCurrentPrices
};
