// Tariff Impact Calculator Engine
// All auto-calculated (*) fields are computed here

import { getProductByHSCode, getProductByERPCode, getInventoryCriticality } from '../data/productMaster.js';
import { getSuppliersForProduct, getSupplierCountries } from '../data/supplierMaster.js';
import {
  getRegionForCountry,
  getInsuranceCostPct,
  getShippingCostPct,
  getTariffRate,
  getOtherDutiesPct,
  getApplicableCorridors,
} from '../data/masterData.js';

/**
 * Full tariff calculation for a product with multiple suppliers
 * 
 * @param {string} hsCode - HS Code of the product
 * @param {string} destinationCountry - e.g., 'India'
 * @param {Array} supplierInputs - Array of { supplierId, fob, numberOfUnits, transportMode }
 * @returns {Object} Complete calculation result
 */
export function calculateTariff(hsCode, destinationCountry, supplierInputs) {
  // 1. Auto-lookup product info
  const product = getProductByHSCode(hsCode);
  if (!product) {
    return { error: `Product not found for HS Code: ${hsCode}` };
  }

  const suppliers = getSuppliersForProduct(product.erpCode);
  const supplierCountries = getSupplierCountries(product.erpCode);
  const destRegion = getRegionForCountry(destinationCountry);

  // 2. Product-level auto-calculated fields
  const productInfo = {
    hsCode,
    erpCode: product.erpCode,
    productDescription: product.description,
    productCategory: product.category,
    inventoryCriticality: getInventoryCriticality(product.daysOfCoverage),
    numberOfSuppliers: suppliers.length,
    numberOfCountriesSupplying: supplierCountries.length,
    currentInventoryLevel: product.inHandInventory + product.inTransitInventory,
    inHandInventory: product.inHandInventory,
    inTransitInventory: product.inTransitInventory,
    inventoryValue: product.inventoryValue,
    daysOfSupply: product.daysOfCoverage,
    currentSafetyStockLevel: product.safetyStock,
    roq: product.roq,
    reviewType: product.reviewType,
  };

  // 3. Per-supplier calculations
  const supplierResults = supplierInputs.map((input, idx) => {
    const supplierData = suppliers.find(s => s.supplierId === input.supplierId) || suppliers[idx];
    if (!supplierData) return null;

    const originCountry = supplierData.country;
    const originRegion = supplierData.region;
    const originCountryCode = supplierData.countryCode;
    const transportMode = input.transportMode || supplierData.defaultTransport;
    const fob = parseFloat(input.fob) || 0;
    const numberOfUnits = parseInt(input.numberOfUnits) || 1;

    // Auto-calculated rates (or user overrides)
    const tariffPct = input.tariffPctOverride !== undefined ? parseFloat(input.tariffPctOverride) : getTariffRate(destinationCountry, hsCode, originCountryCode);
    const insurancePct = input.insurancePctOverride !== undefined ? parseFloat(input.insurancePctOverride) : getInsuranceCostPct(transportMode, originRegion, destRegion);
    const freightPct = input.freightPctOverride !== undefined ? parseFloat(input.freightPctOverride) : getShippingCostPct(transportMode, originRegion, destRegion);
    const otherDutiesPct = input.otherDutiesPctOverride !== undefined ? parseFloat(input.otherDutiesPctOverride) : getOtherDutiesPct(destinationCountry);
    const variableCostPct = input.variableCostPctOverride !== undefined ? parseFloat(input.variableCostPctOverride) : 0;

    // Dollar calculations
    const tariffValue = fob * (tariffPct / 100);
    const insuranceValue = fob * (insurancePct / 100);
    const freightValue = fob * (freightPct / 100);
    const otherDutiesValue = fob * (otherDutiesPct / 100);
    const variableCostValue = fob * (variableCostPct / 100);

    const totalLandedCost = fob + tariffValue + insuranceValue + freightValue + otherDutiesValue + variableCostValue;
    const landedCostPerUnit = numberOfUnits > 0 ? totalLandedCost / numberOfUnits : 0;

    // Trade corridors
    const corridors = getApplicableCorridors(originRegion, destRegion);

    // Notifications
    const notifications = generateNotifications(product, supplierData, tariffPct, fob, totalLandedCost, suppliers);

    return {
      supplierId: supplierData.supplierId,
      supplierName: supplierData.supplierName,
      originCountry,
      originRegion,
      originCountryCode,
      destinationCountry,
      destinationRegion: destRegion,
      supplyPct: supplierData.supplyPct,
      leadTimeDays: supplierData.leadTimeDays,
      reliability: supplierData.reliability,
      transportMode,

      // Manual inputs
      fob,
      numberOfUnits,

      // Auto-calculated rates (%)
      tariffPct,
      insurancePct,
      freightPct,
      otherDutiesPct,
      variableCostPct,

      // Auto-calculated values ($)
      tariffValue,
      insuranceValue,
      freightValue,
      otherDutiesValue,
      variableCostValue,

      // Final calculations
      totalLandedCost,
      landedCostPerUnit,

      // Corridor & notifications
      corridors,
      notifications,
    };
  }).filter(Boolean);

  return {
    productInfo,
    supplierResults,
    destinationCountry,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate notifications based on business rules
 */
function generateNotifications(product, supplier, tariffPct, fob, totalLandedCost, suppliers = []) {
  const notifications = [];

  // Single sourcing risk
  if (suppliers.length === 1) {
    notifications.push({
      type: 'warning',
      message: `Single sourcing risk: only one supplier (${supplier.supplierName}) is registered for this product in Supplier Master.`,
    });
  }

  // Low inventory alert
  if (product.daysOfCoverage <= 15) {
    notifications.push({
      type: 'critical',
      message: `Critical inventory: only ${product.daysOfCoverage} days of coverage remaining.`,
    });
  } else if (product.daysOfCoverage <= 30) {
    notifications.push({
      type: 'warning',
      message: `Low inventory: only ${product.daysOfCoverage} days of coverage remaining. Safety stock is at risk.`,
    });
  }

  // High tariff alert
  if (tariffPct >= 20) {
    notifications.push({
      type: 'critical',
      message: `Severe tariff rate of ${tariffPct}% from ${supplier.country}. Sourcing alternative is highly advised.`,
    });
  } else if (tariffPct >= 12) {
    notifications.push({
      type: 'warning',
      message: `High tariff rate of ${tariffPct}% from ${supplier.country}. Consider alternative trade channels.`,
    });
  }

  // Cost impact alert
  if (fob > 0) {
    const costIncreasePct = ((totalLandedCost - fob) / fob * 100).toFixed(1);
    if (parseFloat(costIncreasePct) > 25) {
      notifications.push({
        type: 'warning',
        message: `High landed cost overhead: total cost is ${costIncreasePct}% higher than FOB base price.`,
      });
    } else if (parseFloat(costIncreasePct) > 15) {
      notifications.push({
        type: 'info',
        message: `Landed cost overhead is ${costIncreasePct}% over FOB base price.`,
      });
    }
  }

  // Low reliability supplier
  if (supplier.reliability < 85) {
    notifications.push({
      type: 'critical',
      message: `Critical reliability: supplier reliability is extremely low at ${supplier.reliability}%.`,
    });
  } else if (supplier.reliability < 92) {
    notifications.push({
      type: 'warning',
      message: `Sub-optimal reliability: supplier reliability is ${supplier.reliability}%. Monitor fulfillment rates closely.`,
    });
  }

  // Long lead time
  if (supplier.leadTimeDays > 40) {
    notifications.push({
      type: 'warning',
      message: `Extended lead time of ${supplier.leadTimeDays} days may cause production delays.`,
    });
  } else if (supplier.leadTimeDays > 25) {
    notifications.push({
      type: 'info',
      message: `Lead time of ${supplier.leadTimeDays} days. Factor this into order planning.`,
    });
  }

  return notifications;
}

/**
 * Compare two suppliers side by side
 */
export function compareSuppliers(resultsOrResult1, result2) {
  let results = [];
  if (Array.isArray(resultsOrResult1)) {
    results = resultsOrResult1;
  } else {
    if (!resultsOrResult1 || !result2) return null;
    results = [resultsOrResult1, result2];
  }

  if (results.length < 2) return null;

  // Find cheapest supplier
  const sortedByCost = [...results].sort((a, b) => a.landedCostPerUnit - b.landedCostPerUnit);
  const bestCost = sortedByCost[0];
  const secondBestCost = sortedByCost[1];
  const costDiff = secondBestCost.landedCostPerUnit - bestCost.landedCostPerUnit;
  const costDifferencePct = secondBestCost.landedCostPerUnit > 0
    ? ((costDiff / secondBestCost.landedCostPerUnit) * 100).toFixed(1)
    : 0;

  // Find fastest supplier
  const sortedByTime = [...results].sort((a, b) => a.leadTimeDays - b.leadTimeDays);
  const bestTime = sortedByTime[0];
  const secondBestTime = sortedByTime[1];
  const leadTimeDiff = secondBestTime.leadTimeDays - bestTime.leadTimeDays;

  // Find lowest tariff supplier
  const sortedByTariff = [...results].sort((a, b) => a.tariffPct - b.tariffPct);
  const bestTariff = sortedByTariff[0];
  const secondBestTariff = sortedByTariff[1];
  const tariffDiff = secondBestTariff.tariffPct - bestTariff.tariffPct;

  return {
    cheaperSupplier: bestCost.supplierName,
    costDifference: costDiff,
    costDifferencePct: parseFloat(costDifferencePct),
    fasterSupplier: bestTime.supplierName,
    leadTimeDifference: leadTimeDiff,
    lowerTariffSupplier: bestTariff.supplierName,
    tariffDifference: tariffDiff,
  };
}
