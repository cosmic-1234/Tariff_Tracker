// SDE & VED Inventory Sourcing & Criticality Analysis Engine
import { productMaster } from '../data/productMaster.js';
import { getSuppliersForProduct } from '../data/supplierMaster.js';
import { calculateRiskScore } from './riskScoringModel.js';

/**
 * Calculates SDE (Scarce, Difficult, Easy) rating for a product's sourcing difficulty.
 * Score is 1 to 5, where 5 is the most scarce / high risk.
 */
export function getSdeClassification(maxLeadTime, numSuppliers) {
  let score = 2.0; // base score (Easy)
  let classification = 'E'; // Easy

  if (maxLeadTime > 30 || numSuppliers === 1) {
    score = numSuppliers === 1 ? 5.0 : 4.5;
    classification = 'S'; // Scarce
  } else if (maxLeadTime > 20 || numSuppliers === 2) {
    score = numSuppliers === 2 ? 3.5 : 3.0;
    classification = 'D'; // Difficult
  } else {
    score = maxLeadTime <= 12 ? 1.0 : 1.8;
    classification = 'E'; // Easy
  }
  return { score, classification };
}

/**
 * Calculates VED (Vital, Essential, Desirable) rating for production criticality.
 * Score is 1 to 5, where 5 is the most vital.
 */
export function getVedClassification(category, daysOfCoverage) {
  let baseScore = 1.5;
  
  const cat = String(category).toLowerCase();
  if (
    cat.includes('engine') || 
    cat.includes('transmission') || 
    cat.includes('drivetrain') || 
    cat.includes('brake') || 
    cat.includes('electrical')
  ) {
    baseScore = 4.5;
  } else if (
    cat.includes('hvac') || 
    cat.includes('fuel') || 
    cat.includes('steering') || 
    cat.includes('suspension') || 
    cat.includes('wheel') || 
    cat.includes('tire')
  ) {
    baseScore = 3.0;
  } else {
    baseScore = 1.5;
  }

  // Adjust score by current coverage level
  let score = baseScore;
  if (daysOfCoverage <= 20) {
    score += 1.0; // low coverage makes it more vital to monitor
  } else if (daysOfCoverage > 60) {
    score -= 1.0; // high coverage buffers stoppage risk
  }

  // Clamp between 1.0 and 5.0
  score = Math.min(5.0, Math.max(1.0, score));

  // Determine class based on score threshold
  let classification = 'D';
  if (score >= 4.0) classification = 'V';
  else if (score >= 2.5) classification = 'E';

  return { score, classification };
}

/**
 * Returns classified product inventory records with risk analysis.
 */
export function getInventoryRiskRecords(config = {}) {
  return productMaster.map(product => {
    const suppliers = getSuppliersForProduct(product.erpCode);
    const maxLeadTime = suppliers.reduce((max, s) => Math.max(max, s.leadTimeDays), 15);
    const numSuppliers = suppliers.length;

    const sde = getSdeClassification(maxLeadTime, numSuppliers);
    const ved = getVedClassification(product.category, product.daysOfCoverage);
    const riskValue = sde.score * ved.score;

    let riskLevel = 'Low';
    if (riskValue >= 15) riskLevel = 'Critical';
    else if (riskValue >= 6) riskLevel = 'Medium';

    // Calculate advanced 0-100 Risk Scores
    const advancedRisk = calculateRiskScore(product, suppliers, config);

    return {
      ...product,
      maxLeadTime,
      numSuppliers,
      sdeScore: sde.score,
      sdeClass: sde.classification,
      vedScore: ved.score,
      vedClass: ved.classification,
      riskValue,
      riskLevel,
      suppliers,
      
      // Advanced 0-100 Risk Scoring Model integration
      subScores: advancedRisk.subScores,
      rawMetrics: advancedRisk.rawMetrics,
      scoreA: advancedRisk.scoreA,
      scoreB: advancedRisk.scoreB,
      scoreFinal: advancedRisk.scoreFinal,
      hasOverride: advancedRisk.hasOverride,
      riskBand: advancedRisk.riskBand
    };
  });
}

/**
 * Generates aggregated metrics for SDE & VED cash valuations.
 */
export function getRiskSummary(config = {}) {
  const records = getInventoryRiskRecords(config);
  const totalValue = records.reduce((sum, r) => sum + r.inventoryValue, 0);

  const riskSegments = {
    Critical: { count: 0, value: 0 },
    High: { count: 0, value: 0 },
    Moderate: { count: 0, value: 0 },
    Low: { count: 0, value: 0 }
  };

  const sdeSegments = {
    S: { count: 0, value: 0 },
    D: { count: 0, value: 0 },
    E: { count: 0, value: 0 }
  };

  const vedSegments = {
    V: { count: 0, value: 0 },
    E: { count: 0, value: 0 },
    D: { count: 0, value: 0 }
  };

  records.forEach(r => {
    // Increment according to 0-100 final risk score bands
    const band = r.riskBand;
    if (riskSegments[band]) {
      riskSegments[band].count++;
      riskSegments[band].value += r.inventoryValue;
    } else {
      // Fallback to legacy categories for count safety
      const legacyBand = r.riskLevel === 'Critical' ? 'Critical' : r.riskLevel === 'Medium' ? 'Moderate' : 'Low';
      riskSegments[legacyBand].count++;
      riskSegments[legacyBand].value += r.inventoryValue;
    }

    sdeSegments[r.sdeClass].count++;
    sdeSegments[r.sdeClass].value += r.inventoryValue;

    vedSegments[r.vedClass].count++;
    vedSegments[r.vedClass].value += r.inventoryValue;
  });

  return {
    totalValue,
    riskSegments,
    sdeSegments,
    vedSegments,
    avgRiskScore: records.reduce((sum, r) => sum + r.scoreFinal, 0) / records.length
  };
}
