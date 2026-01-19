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

  // Array to preserve all non-metal items (diamonds, stones, other items)
  const preservedItems = [];

  // 1️⃣ Calculate Gold & Silver values (optional) and preserve other items
  priceDetails.forEach((item) => {
    const name = item.name?.toLowerCase();

    console.log(`Calculating item: ${item.name}, weight: ${item.weight}, value: ${item.value}`);

    if (name?.includes('gold')) {
      console.log(`Calculating Gold: ${item.weight}g`);
      const weight = parseFloat(item.weight) ;
      goldWeight = weight;
      goldValue = goldPrice * weight; // ✅ weight × rate (no purity)
      totalWeight += weight;
    } else if (name?.includes('silver')) {
      console.log(`Calculating Silver: ${item.weight}g`);
      const weight = parseFloat(item.weight) ;
      silverWeight = weight;
      silverValue = silverPrice * weight; // ✅ weight × rate
      totalWeight += weight;
    } else if (name?.includes('stone') || name?.includes('diamond') || name?.includes('ruby') || 
               name?.includes('emerald') || name?.includes('sapphire') || name?.includes('pearl')) {
      // Preserve stone/diamond/gem items
      console.log(`Preserving Stone/Diamond: ${item.name}, weight: ${item.weight}, value: ${item.value}`);
      const weight = parseFloat(item.weight) || 0;
      const value = parseFloat(item.value) || 0;
      stoneWeight += weight;
      stoneValue += value;
      // Keep the first stone name or use a generic name if multiple
      if (!stoneName) {
      stoneName = item.name;
    }
      // Also preserve the item for the breakdown
      preservedItems.push({
        name: item.name,
        weight: item.weight || `${weight.toFixed(3)}g`,
        value: value
      });
    } else if (name?.includes('other')) {
      console.log(`Preserving Other: ${item.name}, weight: ${item.weight}, value: ${item.value}`);
      const weight = parseFloat(item.weight) || 0;
      const value = parseFloat(item.value) || 0;
      othersWeight += weight;
      otherValue += value;
      if (!othersName) {
      othersName = item.name;
      }
      // Also preserve the item for the breakdown
      preservedItems.push({
        name: item.name,
        weight: item.weight || `${weight.toFixed(3)}g`,
        value: value
      });
    } else if (!name?.includes('making') && !name?.includes('discount') && 
               !name?.includes('gst') && !name?.includes('subtotal') && 
               !name?.includes('total') && !name?.includes('grand') && 
               !name?.includes('final') && !name?.includes('roundoff') && 
               !name?.includes('round off') && !name?.includes('round-off')) {
      // Preserve any other custom items that are not system items
      // Exclude roundoff entries - we only want one at the end
      console.log(`Preserving custom item: ${item.name}, weight: ${item.weight}, value: ${item.value}`);
      preservedItems.push({
        name: item.name,
        weight: item.weight || '',
        value: parseFloat(item.value) || 0
      });
      // Add to otherValue for making charges calculation
      otherValue += parseFloat(item.value) || 0;
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

  // Format GST rate to display exactly as stored (avoid recalculation from rounded value)
  // Remove trailing zeros for whole numbers, but keep 2 decimal places for decimals
  const displayGstRate = gstRate % 1 === 0 ? gstRate.toString() : gstRate.toFixed(2);

  console.log(`GST (${displayGstRate}%): ${gstValue}`);
  // 6️⃣ Final Grand Total
  const grandTotalBeforeRoundoff = subtotalAfterDiscount + gstValue;
  // Round up the Grand Total to the nearest whole number
  const grandTotal = Math.ceil(grandTotalBeforeRoundoff);
  const roundOff = grandTotal - grandTotalBeforeRoundoff;
  console.log(`Grand Total (before roundoff): ${grandTotalBeforeRoundoff}`);
  console.log(`Grand Total (after roundoff): ${grandTotal}`);
  if (roundOff > 0) {
    console.log(`Roundoff: ${roundOff}`);
  }

  // 7️⃣ Build formatted breakdown (invoice-style)
  const breakdown = [];

  if (goldValue > 0)
    breakdown.push({ name: 'Gold', weight: `${(goldWeight).toFixed(3)}g`, value: +goldValue.toFixed(2) });
  if (silverValue > 0)
    breakdown.push({ name: 'Silver', weight: `${(silverWeight).toFixed(3)}g`, value: +silverValue.toFixed(2) });
  
  // Add all preserved items (diamonds, stones, other custom items)
  preservedItems.forEach(item => {
    breakdown.push({
      name: item.name,
      weight: item.weight || '',
      value: +parseFloat(item.value).toFixed(2)
    });
  });

  breakdown.push({ name: 'Making Charges', weight: makingchargesvalue, value: +makingCharges.toFixed(2) });
  breakdown.push({ name: 'Sub Total', weight: `${totalWeight.toFixed(3)}g Gross Wt.`, value: +subtotal.toFixed(2) });
  breakdown.push({ name: 'Discount', weight: discountValue ? `${((discountValue / subtotal) * 100).toFixed(2)}%` : '0%', value: +discountValue.toFixed(2) });
  breakdown.push({ name: 'Subtotal after Discount', weight: 'After discount', value: +subtotalAfterDiscount.toFixed(2) });
  breakdown.push({ name: 'GST', weight: `${displayGstRate}%`, value: +gstValue.toFixed(2) });
  // Add roundoff if it exists
  if (roundOff > 0) {
    breakdown.push({ name: 'Roundoff', weight: 'Rounding', value: +roundOff.toFixed(2) });
  }
  breakdown.push({ name: 'Grand Total', weight: 'Final Price', value: +grandTotal.toFixed(2) });

    const sellingprice = grandTotal;
  console.log('Price Breakdown:', breakdown, 'Final Selling Price:', sellingprice);

  return {
    breakdown,
    sellingprice,
  };
}

/**
 * Update all product prices when gold/silver prices change
 * Uses appropriate gold price based on product's selectedCaret (24K, 22K, 18K)
 */
const updateAllProductPrices = async (goldPrice24kt, goldPrice22kt, goldPrice18kt, silverPrice, makingChargesPercentage = 15) => {
  try {
    console.log(`Updating product prices with Gold 24kt: ₹${goldPrice24kt}, Gold 22kt: ₹${goldPrice22kt}, Gold 18kt: ₹${goldPrice18kt}, Silver: ₹${silverPrice}`);
    
    const products = await Product.find({ active: true });
    let updatedCount = 0;
    let errorCount = 0;
    let count24kt = 0;
    let count22kt = 0;
    let count18kt = 0;
    let countNoCaret = 0;

    for (const product of products) {
      try {
        // Determine which gold price to use based on selectedCaret
        let selectedGoldPrice = goldPrice24kt; // Default to 24kt
        const caret = (product.selectedCaret || '').toString().toUpperCase().trim();
        
        if (caret.includes('24') || caret === '24K' || caret === '24KT') {
          selectedGoldPrice = goldPrice24kt;
          count24kt++;
        } else if (caret.includes('22') || caret === '22K' || caret === '22KT') {
          selectedGoldPrice = goldPrice22kt || goldPrice24kt; // Fallback to 24kt if 22kt not set
          count22kt++;
        } else if (caret.includes('18') || caret === '18K' || caret === '18KT') {
          selectedGoldPrice = goldPrice18kt || goldPrice24kt; // Fallback to 24kt if 18kt not set
          count18kt++;
        } else {
          // No caret specified or unknown caret - default to 24kt
          selectedGoldPrice = goldPrice24kt;
          countNoCaret++;
          console.log(`⚠️ Product ${product.name} has no valid selectedCaret (${caret}), using 24kt price`);
        }

        console.log(`Processing ${product.name} - Caret: ${caret || 'N/A'}, Using Gold Price: ₹${selectedGoldPrice}`);

        const priceCalculation = calculateProductPrice(product, selectedGoldPrice, silverPrice, makingChargesPercentage);
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
        console.log(`Updated product: ${product.name} (${caret || 'N/A'}) - Final Price: ₹${priceCalculation.sellingprice}`);

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
      caretBreakdown: {
        '24kt': count24kt,
        '22kt': count22kt,
        '18kt': count18kt,
        'noCaret': countNoCaret
      },
      message: `Updated ${updatedCount} products successfully. ${errorCount} errors occurred. (24kt: ${count24kt}, 22kt: ${count22kt}, 18kt: ${count18kt}, No Caret: ${countNoCaret})`
    };

  } catch (error) {
    console.error('Error updating product prices:', error);
    throw error;
  }
};

/**
 * Update a single product price
 * Uses appropriate gold price based on product's selectedCaret (24K, 22K, 18K)
 */
const updateSingleProductPrice = async (productId, goldPrice24kt, goldPrice22kt, goldPrice18kt, silverPrice, makingChargesPercentage = 15) => {
  try {
    const product = await Product.findById(productId);
    if (!product) {
      throw new Error('Product not found');
    }

    // Determine which gold price to use based on selectedCaret
    let selectedGoldPrice = goldPrice24kt; // Default to 24kt
    const caret = (product.selectedCaret || '').toString().toUpperCase().trim();
    
    if (caret.includes('24') || caret === '24K' || caret === '24KT') {
      selectedGoldPrice = goldPrice24kt;
    } else if (caret.includes('22') || caret === '22K' || caret === '22KT') {
      selectedGoldPrice = goldPrice22kt || goldPrice24kt; // Fallback to 24kt if 22kt not set
    } else if (caret.includes('18') || caret === '18K' || caret === '18KT') {
      selectedGoldPrice = goldPrice18kt || goldPrice24kt; // Fallback to 24kt if 18kt not set
    } else {
      // No caret specified or unknown caret - default to 24kt
      selectedGoldPrice = goldPrice24kt;
      console.log(`⚠️ Product ${product.name} has no valid selectedCaret (${caret}), using 24kt price`);
    }

    console.log(`Updating single product: ${product.name} - Caret: ${caret || 'N/A'}, Using Gold Price: ₹${selectedGoldPrice}`);

    const priceCalculation = calculateProductPrice(product, selectedGoldPrice, silverPrice, makingChargesPercentage);
    
    // Use the updated price details from the calculation (preserves existing structure)
    const updatedPriceDetails = priceCalculation.breakdown;

    // Update the product
    const updatedProduct = await Product.findByIdAndUpdate(productId, {
      priceDetails: updatedPriceDetails,
      sellingprice: priceCalculation.sellingprice,
      lastPriceUpdate: new Date()
    }, { new: true });

    return {
      success: true,
      product: updatedProduct,
      priceCalculation: priceCalculation,
      caretUsed: caret || 'N/A',
      goldPriceUsed: selectedGoldPrice,
      message: `Product ${product.name} price updated successfully using ${caret || '24kt'} gold price`
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
      goldPrice: settings.goldRate24kt || settings.goldRate, // Backward compatibility
      goldPrice24kt: settings.goldRate24kt || settings.goldRate,
      goldPrice22kt: settings.goldRate22kt || null,
      goldPrice18kt: settings.goldRate18kt || null,
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
