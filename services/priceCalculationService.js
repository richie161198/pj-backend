const Product = require('../models/product_model');
const InvestmentSettings = require('../models/investment_settings_model');

/**
 * Calculate product price based on live gold/silver price and admin-entered percentages.
 * Rules:
 * - Gold/Silver values are ALWAYS recalculated from live rates and product weights.
 * - Making charges: percentage of (gold + silver + stone  also these three optional ) when percentage is provided
 *   - Read percentage from priceDetails item "Making Charges" -> weight like "15"
 *  - after calculate the total of gold,silver and stone and making charges amount and name it as Sub Total
 *   - First try to read percentage from priceDetails "Making Charges" -> weight like "15 ,12 any value given in price details"
 *  if discount is available in product then apply discount on subtotal
  *  - if discount is not available in product then check in price details for discount percentage
  *  - if discount percentage is not available in price details then no discount will be applied
  * - Sub Total: sum of (gold + silver + stone + other + making charges)
  *  minus discount in sub total name it as sub total after discount
  * - GST: percentage applied OVER subtotal after discount
  *   - Read percentage from product.gst
  * - Final Price: Sub Total After Discount + GST
 */
// const calculateProductPrice = (product, goldPrice, silverPrice, makingChargesPercentage = 15) => {
//   // Get existing price details
//   const existingPriceDetails = product.priceDetails || [];
  
//   // Calculate new gold and silver values
//   let newGoldValue = 0;
//   let newSilverValue = 0;
//   let goldWeight = 0;
//   let silverWeight = 0;
//   let goldKarat = '';
//   let silverType = '';

//   // Extract gold and silver details from productDetails
//   console.log(`\n[Price Calc] Processing product: ${product.name}`);
//   console.log(`[Price Calc] productDetails length: ${product.productDetails?.length || 0}`);
  
//   if (product.productDetails && Array.isArray(product.productDetails)) {
//     product.productDetails.forEach((detail, idx) => {
//       console.log(`\n[Price Calc] Detail #${idx}: type="${detail.type}"`);
      
//       if (detail.type === 'Metal' && detail.attributes) {
//         console.log(`[Price Calc] Attributes object:`, detail.attributes);
//         console.log(`[Price Calc] Attributes has .get method:`, typeof detail.attributes?.get === 'function');
//         console.log(`[Price Calc] Attributes keys:`, Object.keys(detail.attributes || {}));
        
//         // Handle both Mongoose Map and plain object attributes
//         const getAttr = (key) => {
//           let value;
//           if (detail.attributes.get && typeof detail.attributes.get === 'function') {
//             value = detail.attributes.get(key);
//             console.log(`[Price Calc]   getAttr('${key}') via .get() =`, value);
//           } else {
//             value = detail.attributes[key];
//             console.log(`[Price Calc]   getAttr('${key}') via bracket =`, value);
//           }
//           return value;
//         };
        
//         const karatage = getAttr('Karatage') || getAttr('karatage') || getAttr('karat');
//         const grossWeight = getAttr('Gross Weight') || getAttr('gross weight') || getAttr('weight');
//         const weight = parseFloat(grossWeight?.toString().replace('g', '').trim() || 0);
//         const materialColor = getAttr('Material Colour') || getAttr('Material Color') || getAttr('material colour') || getAttr('material color') || getAttr('color') || '';
//         const metal = getAttr('Metal') || getAttr('metal') || '';
        
//         console.log(`[Price Calc] Extracted: karatage="${karatage}", weight=${weight}, materialColor="${materialColor}", metal="${metal}"`);
        
//         if (karatage && weight > 0) {
//           // Enhanced gold detection - check multiple indicators
//           const isGold = karatage.includes('K') || 
//                         karatage.toLowerCase().includes('k') ||
//                         materialColor.toLowerCase().includes('gold') || 
//                         materialColor.toLowerCase().includes('yellow') ||
//                         metal.toLowerCase().includes('gold');
          
//           const isSilver = karatage.toLowerCase().includes('silver') || 
//                            materialColor.toLowerCase().includes('silver') || 
//                            metal.toLowerCase().includes('silver');
          
//           if (isGold) {
//             // Gold calculation
//             const karat = parseFloat(karatage.replace(/[^\d.]/g, '')) || 24;
//             const goldPurity = karat / 24; // Convert to purity (e.g., 18K = 0.75)
//             const value = (goldPrice * goldPurity * weight);
//             console.log(`✨ Gold: ${karat}K, ${weight}g @ ₹${goldPrice}/g = ₹${value.toFixed(2)}`);
//             newGoldValue += value;
//             goldWeight += weight;
//             goldKarat = karatage;
//           } else if (isSilver) {
//             // Silver calculation
//             const value = (silverPrice * weight);
//             console.log(`✨ Silver: ${karatage}, ${weight}g @ ₹${silverPrice}/g = ₹${value.toFixed(2)}`);
//             newSilverValue += value;
//             silverWeight += weight;
//             silverType = karatage;
//           } else {
//             console.log(`[Price Calc] ❌ Unknown metal type: karatage="${karatage}", color="${materialColor}", metal="${metal}"`);
//           }
//         } else {
//           console.log(`[Price Calc] ❌ Skipped: Missing karatage or weight <= 0`);
//         }
//       }
//     });
//   }
  
//   console.log(`\n[Price Calc] FINAL: Gold=${newGoldValue.toFixed(2)} (${goldWeight}g), Silver=${newSilverValue.toFixed(2)} (${silverWeight}g)\n`);

//   // Preserve existing non-metal values
//   let existingStoneValue = 0;
//   let existingOtherValue = 0;
//   let existingMakingChargesValueIfFixed = 0; // Fixed value (legacy)
//   let existingMakingChargesPct = null;      // Prefer percentage if present
//   let existingGST = 0;                      // Fixed GST value, rarely set
//   let existingDiscountPct = null;           // Prefer percentage if present

//   // Extract existing values from priceDetails
//   existingPriceDetails.forEach(item => {
//     const name = item.name?.toLowerCase() || '';
//     const value = parseFloat(item.value) || 0;
    
//     if (name.includes('stone') || name.includes('diamond') || name.includes('ruby') || 
//         name.includes('emerald') || name.includes('sapphire') || name.includes('pearl')) {
//       existingStoneValue += value;
//     } else if (name.includes('making charges')) {
//       // Try to read percentage from weight like "15%"
//       const pctStr = (item.weight || '').toString();
//       if (/%/.test(pctStr)) {
//         const pct = parseFloat(pctStr.replace('%',''));
//         if (!isNaN(pct)) existingMakingChargesPct = pct;
//       } else {
//         existingMakingChargesValueIfFixed = value; // legacy fixed value
//       }
//     } else if (name.includes('gst')) {
//       existingGST = value; // Preserve existing GST
//     } else if (name.includes('discount')) {
//       const pctStr = (item.weight || '').toString();
//       if (/%/.test(pctStr)) {
//         const pct = parseFloat(pctStr.replace('%',''));
//         if (!isNaN(pct)) existingDiscountPct = pct;
//       }
//     } else if (!name.includes('gold') && !name.includes('silver') && 
//                !name.includes('total') && !name.includes('final') && 
//                !name.includes('grand') && !name.includes('subtotal')) {
//       // Other elements (not gold, silver, or totals)
//       existingOtherValue += value;
//     }
//   });

//   // Step 1: Calculate base values (gold + silver + stone + other)
//   const baseValue = newGoldValue + newSilverValue + existingStoneValue + existingOtherValue;

//   // Step 2: Calculate making charges percentage
//   // First try to read percentage from priceDetails "Making Charges" -> weight like "15"
//   let resolvedMakingPct = makingChargesPercentage; // default
//   if (existingMakingChargesPct != null) {
//     resolvedMakingPct = existingMakingChargesPct;
//   }
  
//   // Calculate making charges as percentage of (gold + silver + stone + other)
//   const makingChargesAmount = (baseValue * resolvedMakingPct) / 100;

//   // Step 3: Calculate Sub Total = gold + silver + stone + other + making charges
//   const subTotal = baseValue + makingChargesAmount;

//   // Step 4: Apply discount
//   let discountAmount = 0;
//   let resolvedDiscountPct = 0;
  
//   // First check if discount is available in product
//   if (product.isDiscountAvailable && product.Discount > 0) {
//     resolvedDiscountPct = Number(product.Discount) || 0;
//     discountAmount = (subTotal * resolvedDiscountPct) / 100;
//   } 
//   // If no product discount, check price details for discount percentage
//   else if (existingDiscountPct != null) {
//     resolvedDiscountPct = existingDiscountPct;
//     discountAmount = (subTotal * resolvedDiscountPct) / 100;
//   }
//   // If no discount available, no discount will be applied

//   // Step 5: Calculate Sub Total After Discount
//   const subTotalAfterDiscount = Math.max(0, subTotal - discountAmount);

//   // Step 6: Calculate GST on subtotal after discount
//   const gstPct = Number(product.gst || 0);
//   const gstAmount = (subTotalAfterDiscount * gstPct) / 100;

//   // Step 7: Calculate Final Price = Sub Total After Discount + GST
//   const finalPrice = subTotalAfterDiscount + gstAmount;
  
//   console.log(`Product: ${product.name}`);
//   console.log(`- Base Value (Gold+Silver+Stone+Other): ${baseValue.toFixed(2)}`);
//   console.log(`- Making Charges (${resolvedMakingPct}%): ${makingChargesAmount.toFixed(2)}`);
//   console.log(`- Sub Total: ${subTotal.toFixed(2)}`);
//   console.log(`- Discount (${resolvedDiscountPct}%): ${discountAmount.toFixed(2)}`);
//   console.log(`- Sub Total After Discount: ${subTotalAfterDiscount.toFixed(2)}`);
//   console.log(`- GST (${gstPct}%): ${gstAmount.toFixed(2)}`);
//   console.log(`- Final Price: ${finalPrice.toFixed(2)}`);

//   // Build updated price details preserving existing structure
//   const updatedPriceDetails = [];
  
//   // Add gold if present
//   if (newGoldValue > 0) {
//     updatedPriceDetails.push({
//       name: 'Gold',
//       weight: `${goldWeight}g`,
//       value: newGoldValue,
//       details: `${goldKarat} - ₹${goldPrice.toLocaleString()}/g`
//     });
//   }
  
//   // Add silver if present
//   if (newSilverValue > 0) {
//     updatedPriceDetails.push({
//       name: 'Silver',
//       weight: `${silverWeight}g`,
//       value: newSilverValue,
//       details: `${silverType} - ₹${silverPrice.toLocaleString()}/g`
//     });
//   }
  
//   // Preserve existing stone and other elements
//   existingPriceDetails.forEach(item => {
//     const name = item.name?.toLowerCase() || '';
//     if (name.includes('stone') || name.includes('diamond') || name.includes('ruby') || 
//         name.includes('emerald') || name.includes('sapphire') || name.includes('pearl') ||
//         (!name.includes('gold') && !name.includes('silver') && 
//          !name.includes('making') && !name.includes('subtotal') && 
//          !name.includes('gst') && !name.includes('discount') && 
//          !name.includes('total') && !name.includes('final'))) {
//       updatedPriceDetails.push(item);
//     }
//   });
  
//   // Add making charges
//   updatedPriceDetails.push({
//     name: 'Making Charges',
//     weight: `${resolvedMakingPct}%`,
//     value: makingChargesAmount
//   });
  
//   // Add subtotal
//   updatedPriceDetails.push({
//     name: 'Sub Total',
//     weight: `${(goldWeight + silverWeight).toFixed(3)}g Gross Wt.`,
//     value: subTotal
//   });
  
//   // Add discount details (only if discount is applied)
//   if (discountAmount > 0) {
//     updatedPriceDetails.push({
//       name: 'Discount',
//       weight: `${resolvedDiscountPct}%`,
//       value: discountAmount
//     });
//   }
  
//   // Sub total after discount
//   updatedPriceDetails.push({
//     name: 'Sub Total After Discount',
//     weight: 'After discount',
//     value: subTotalAfterDiscount
//   });
  
//   // Add GST (always show, even if 0)
//   updatedPriceDetails.push({
//     name: 'GST',
//     weight: `${gstPct}%`,
//     value: gstAmount
//   });
  
//   // Add final price
//   updatedPriceDetails.push({
//     name: 'Final Price',
//     weight: 'Grand Total',
//     value: finalPrice
//   });

//   return {
//     // Individual values
//     goldValue: newGoldValue,
//     silverValue: newSilverValue,
//     stoneValue: existingStoneValue,
//     otherValue: existingOtherValue,
//     totalMetalValue: newGoldValue + newSilverValue,
//     makingCharges: makingChargesAmount,
//     subtotal: subTotal,
//     subtotalAfterDiscount: subTotalAfterDiscount,
//     gstAmount: gstAmount,
//     discountAmount: discountAmount,
//     finalPrice: finalPrice,
    
//     // Weights and details
//     goldWeight: goldWeight,
//     silverWeight: silverWeight,
//     totalWeight: goldWeight + silverWeight,
    
//     // Updated price details
//     updatedPriceDetails: updatedPriceDetails,
    
//     // Metadata
//     hasGold: newGoldValue > 0,
//     hasSilver: newSilverValue > 0,
//     hasStones: existingStoneValue > 0,
//     hasOtherElements: existingOtherValue > 0,
//     goldKarat: goldKarat,
//     silverType: silverType
//   };
// };


function calculateProductPrice(product, goldPrice, silverPrice) {
  const priceDetails = product.priceDetails || [];
  // const goldPrice = parseFloat(ligoldPrice) || 0;
  // const silverPrice = parseFloat(silverPrice) || 0;

  let goldValue = 0;
  let silverValue = 0;

  let goldWeight = 0;
  let silverWeight = 0;
  let stoneWeight = 0;
  let othersWeight = 0;
  let stoneValue = 0;
  let otherValue = 0;
  let makingCharges = 0;
  let makingchargesvalue=0;
  let discountValue = 0;
  let subtotal = 0;
  let gstValue = 0;
  let totalWeight = 0;
  let stoneName = "";
  let othersName = "";

  // 1️⃣ Calculate Gold & Silver values (optional)
  priceDetails.forEach((item) => {
    const name = item.name?.toLowerCase();

    console.log(`Calculating item: ${item.name}, weight: ${item.weight}, value: ${item.value}`);

    if (name?.includes('gold')) {
      console.log(`Calculating Gold: ${item.weight}g`);
      const weight = parseFloat(item.weight) ;
      goldWeight = weight;
      goldValue = goldPrice * weight; // ✅ weight × rate (no purity)
      totalWeight += weight;
    }

    if (name?.includes('silver')) {
      console.log(`Calculating Silver: ${item.weight}g`);
      const weight = parseFloat(item.weight) ;
      silverWeight = weight;
      silverValue = silverPrice * weight; // ✅ weight × rate
      totalWeight += weight;
    }

    if (name?.includes('stone')) {
      console.log(`Calculating Stone: ${item.weight}g`);
            stoneWeight = parseFloat(item.weight);

      stoneValue = parseFloat(item.value) ;
      stoneName = item.name;
    }

    if (name?.includes('other')) {
      console.log(`Calculating Other: ${item.weight}g`);
      othersWeight = parseFloat(item.weight);
      otherValue = parseFloat(item.value) ;
      othersName = item.name;
    }
  });

  // 2️⃣ Calculate Making Charges (can be % or fixed)
  const baseForMaking = goldValue + silverValue + stoneValue + otherValue;
  console.log(`Base for Making Charges: ${baseForMaking} (Gold: ${goldValue}, Silver: ${silverValue}, Stone: ${stoneValue}, Other: ${otherValue})`);
  const makingItem = priceDetails.find(i => i.name?.toLowerCase().includes('making'));
  if (makingItem) {
    const mc = makingItem.weight?.toString() || '0';
    if (mc.includes('%')) {
      const perc = parseFloat(mc);
      makingchargesvalue= perc;
      makingCharges = (baseForMaking * perc) / 100;
    } else {
      // makingCharges = parseFloat(mc) || 0;

      const perc = parseFloat(mc);
      makingchargesvalue= perc;
      makingCharges = (baseForMaking * perc) / 100;
    }
  }

  console.log(`Making Charges: ${makingCharges}`);
  // 3️⃣ Sub Total
  subtotal = baseForMaking + makingCharges;
console.log(`Subtotal (before discount): ${subtotal}`);
  // 4️⃣ Discount (optional)
  if (product.isDiscountAvailable && product.discount) {
    discountValue = (subtotal * parseFloat(product.discount)) / 100;
  } else {
    const discountItem = priceDetails.find(i => i.name?.toLowerCase().includes('discount'));
    if (discountItem) {
      const d = discountItem.weight?.toString() || '0';
      discountValue = d.includes('%')
        ? (subtotal * parseFloat(d)) / 100
        : parseFloat(d) || 0;
    }
  }

  const subtotalAfterDiscount = subtotal - discountValue;

  console.log(`Discount: ${discountValue}, Subtotal after Discount: ${subtotalAfterDiscount}`);
  // 5️⃣ GST (always show)
  const gstRate = parseFloat(product.gst) || 0;
  gstValue = (subtotalAfterDiscount * gstRate) / 100;


  console.log(`GST (${gstRate}%): ${gstValue}`);
  // 6️⃣ Final Grand Total
  const grandTotal = subtotalAfterDiscount + gstValue;
  console.log(`Grand Total: ${grandTotal}`);

  // 7️⃣ Build formatted breakdown (invoice-style)
  const breakdown = [];

  if (goldValue > 0)
    breakdown.push({ name: 'Gold', weight: `${(goldWeight).toFixed(3)}g`, value: +goldValue.toFixed(2) });
  if (silverValue > 0)
    breakdown.push({ name: 'Silver', weight: `${(silverWeight).toFixed(3)}g`, value: +silverValue.toFixed(2) });
  if (stoneValue > 0)
    breakdown.push({ name: stoneName, weight: `${(stoneWeight).toFixed(3)}g`, value: +stoneValue.toFixed(2) });
  if (otherValue > 0)
    breakdown.push({ name: othersName, weight: `${(othersWeight).toFixed(3)}g`, value: +otherValue.toFixed(2) });

  breakdown.push({ name: 'Making Charges', weight: makingchargesvalue, value: +makingCharges.toFixed(2) });
  breakdown.push({ name: 'Sub Total', weight: `${totalWeight.toFixed(3)}g Gross Wt.`, value: +subtotal.toFixed(2) });
  breakdown.push({ name: 'Discount', weight: discountValue ? `${((discountValue / subtotal) * 100).toFixed(2)}%` : '0%', value: +discountValue.toFixed(2) });
  breakdown.push({ name: 'Subtotal after Discount', weight: 'After discount', value: +subtotalAfterDiscount.toFixed(2) });
  breakdown.push({ name: 'GST', weight: `${gstRate}%`, value: +gstValue.toFixed(2) });
  breakdown.push({ name: 'Grand Total', weight: 'Final Price', value: +grandTotal.toFixed(2) });

    const sellingprice = (+grandTotal.toFixed(2));
  console.log('Price Breakdown:', breakdown, 'Final Selling Price:', sellingprice);

  return {
    breakdown,
    sellingprice,
  };
}

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
        const updatedPriceDetails = priceCalculation.breakdown;
console.log(`Updated Price Details for ${priceCalculation.sellingprice}:`, updatedPriceDetails);
        // Update the product
        await Product.findByIdAndUpdate(product._id, {
          priceDetails: updatedPriceDetails,
          sellingprice: priceCalculation.sellingprice,
          $set: {
            'priceDetails': updatedPriceDetails,
            'sellingprice': priceCalculation.sellingprice,
            'lastPriceUpdate': new Date()
          }
        });

        updatedCount++;
        console.log(`Updated product: ${product.name} - Final Price: ₹${priceCalculation.sellingprice}`);

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
