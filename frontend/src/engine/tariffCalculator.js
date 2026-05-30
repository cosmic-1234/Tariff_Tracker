// Tariff Calculator Engine
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

    // Auto-calculated rates
    const tariffPct = getTariffRate(destinationCountry, hsCode, originCountryCode);
    const insurancePct = getInsuranceCostPct(transportMode, originRegion, destRegion);
    const freightPct = getShippingCostPct(transportMode, originRegion, destRegion);
    const otherDutiesPct = getOtherDutiesPct(destinationCountry);

    // Dollar calculations
    const tariffValue = fob * (tariffPct / 100);
    const insuranceValue = fob * (insurancePct / 100);
    const freightValue = fob * (freightPct / 100);
    const otherDutiesValue = fob * (otherDutiesPct / 100);

    const totalLandedCost = fob + tariffValue + insuranceValue + freightValue + otherDutiesValue;
    const landedCostPerUnit = numberOfUnits > 0 ? totalLandedCost / numberOfUnits : 0;

    // Trade corridors
    const corridors = getApplicableCorridors(originRegion, destRegion);

    // Notifications
    const notifications = generateNotifications(product, supplierData, tariffPct, fob, totalLandedCost);

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

      // Auto-calculated values ($)
      tariffValue,
      insuranceValue,
      freightValue,
      otherDutiesValue,

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
function generateNotifications(product, supplier, tariffPct, fob, totalLandedCost) {
  const notifications = [];

  // High tariff alert
  if (tariffPct >= 20) {
    notifications.push({
      type: 'warning',
      message: `High tariff rate of ${tariffPct}% from ${supplier.country}. Consider alternative sourcing.`,
    });
  }

  // Low inventory alert
  if (product.daysOfCoverage <= 15) {
    notifications.push({
      type: 'critical',
      message: `Critical inventory: only ${product.daysOfCoverage} days of coverage remaining.`,
    });
  }

  // Cost impact alert
  if (fob > 0) {
    const costIncreasePct = ((totalLandedCost - fob) / fob * 100).toFixed(1);
    if (costIncreasePct > 30) {
      notifications.push({
        type: 'warning',
        message: `Total cost increase of ${costIncreasePct}% over FOB. Review cost structure.`,
      });
    }
  }

  // Low reliability supplier
  if (supplier.reliability < 85) {
    notifications.push({
      type: 'info',
      message: `Supplier reliability at ${supplier.reliability}%. Consider diversification.`,
    });
  }

  // Long lead time
  if (supplier.leadTimeDays > 45) {
    notifications.push({
      type: 'info',
      message: `Extended lead time of ${supplier.leadTimeDays} days. Monitor closely.`,
    });
  }

  return notifications;
}

/**
 * Compare two suppliers side by side
 */
export function compareSuppliers(result1, result2) {
  if (!result1 || !result2) return null;

  const costDiff = result1.landedCostPerUnit - result2.landedCostPerUnit;
  const leadTimeDiff = result1.leadTimeDays - result2.leadTimeDays;
  const tariffDiff = result1.tariffPct - result2.tariffPct;

  return {
    cheaperSupplier: costDiff <= 0 ? result1.supplierName : result2.supplierName,
    costDifference: Math.abs(costDiff),
    costDifferencePct: result2.landedCostPerUnit > 0 ? ((costDiff / result2.landedCostPerUnit) * 100).toFixed(1) : 0,
    fasterSupplier: leadTimeDiff <= 0 ? result1.supplierName : result2.supplierName,
    leadTimeDifference: Math.abs(leadTimeDiff),
    lowerTariffSupplier: tariffDiff <= 0 ? result1.supplierName : result2.supplierName,
    tariffDifference: Math.abs(tariffDiff),
  };
}
