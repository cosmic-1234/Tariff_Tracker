const {
  getRegionForCountry,
  getInsuranceCostPct,
  getShippingCostPct,
  getTariffRate,
  getOtherDutiesPct,
  getApplicableCorridors,
} = require('../config/masterData');

// ─────────────────────────────────────────────
// Constants and Defaults
// ─────────────────────────────────────────────

const DEFAULT_WEIGHTS_A = {
  p1_invLevel: 0.08,
  p2_daysOfSupply: 0.15,
  p3_safetyStock: 0.12,
  p4_leadTime: 0.15,
  p5_supplierDep: 0.18,
  p6_criticality: 0.12,
  p7_tariffNews: 0.10,
  p8_corridorNews: 0.10,
};

const DEFAULT_WEIGHTS_B = {
  p1_invLevel: 0.09,
  p2_daysOfSupply: 0.17,
  p3_safetyStock: 0.14,
  p4_leadTime: 0.17,
  p5_supplierDep: 0.20,
  p7_tariffNews: 0.115,
  p8_corridorNews: 0.115,
};

const DEFAULT_THRESHOLDS = {
  p1_safe: 1.2,
  p1_crit: 0.5,
  p4_safe: 15,
  p4_crit: 45,
  p5_otifTarget: 0.98,
  p5_otifFloor: 0.80,
  p2_safeMultiplier: 2.0,
  p2_critMultiplier: 1.0,
};

function clamp(val, min = 0, max = 1) {
  return Math.max(min, Math.min(max, val));
}

// ─────────────────────────────────────────────
// Risk scoring calculations (Model A & B)
// ─────────────────────────────────────────────

function getSdeClassification(maxLeadTime, numSuppliers) {
  let score = 2.0;
  let classification = 'E';

  if (maxLeadTime > 30 || numSuppliers === 1) {
    score = numSuppliers === 1 ? 5.0 : 4.5;
    classification = 'S';
  } else if (maxLeadTime > 20 || numSuppliers === 2) {
    score = numSuppliers === 2 ? 3.5 : 3.0;
    classification = 'D';
  } else {
    score = maxLeadTime <= 12 ? 1.0 : 1.8;
    classification = 'E';
  }
  return { score, classification };
}

function getVedClassification(category, daysOfCoverage) {
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

  let score = baseScore;
  if (daysOfCoverage <= 20) {
    score += 1.0;
  } else if (daysOfCoverage > 60) {
    score -= 1.0;
  }

  score = Math.min(5.0, Math.max(1.0, score));

  let classification = 'D';
  if (score >= 4.0) classification = 'V';
  else if (score >= 2.5) classification = 'E';

  return { score, classification };
}

function calculateRiskScore(product, suppliers, config = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
  const weightsA = { ...DEFAULT_WEIGHTS_A, ...config.weightsA };
  const weightsB = { ...DEFAULT_WEIGHTS_B, ...config.weightsB };

  const dailyUse = product.daysOfCoverage > 0
    ? product.inHandInventory / product.daysOfCoverage
    : 1;

  let ltAvg = 20;
  if (suppliers && suppliers.length > 0) {
    const totalPct = suppliers.reduce((sum, s) => sum + (s.supplyPct || 0), 0);
    if (totalPct > 0) {
      ltAvg = suppliers.reduce((sum, s) => sum + ((s.supplyPct || 0) / 100) * (s.leadTimeDays || 0), 0);
    } else {
      ltAvg = suppliers.reduce((sum, s) => sum + (s.leadTimeDays || 0), 0) / suppliers.length;
    }
  }

  let sigmaLT = 5;
  if (suppliers && suppliers.length > 0) {
    const totalPct = suppliers.reduce((sum, s) => sum + (s.supplyPct || 0), 0);
    if (totalPct > 0) {
      sigmaLT = suppliers.reduce((sum, s) => {
        const reliability = s.reliability || 90;
        const sSigma = s.leadTimeDays * (0.1 + (1 - reliability / 100) * 0.5);
        return sum + ((s.supplyPct || 0) / 100) * sSigma;
      }, 0);
    } else {
      sigmaLT = suppliers.reduce((sum, s) => {
        const reliability = s.reliability || 90;
        return sum + s.leadTimeDays * (0.1 + (1 - reliability / 100) * 0.5);
      }, 0) / suppliers.length;
    }
  }

  const rop = (dailyUse * ltAvg) + (product.safetyStock || 0);
  const k = rop > 0 ? product.inHandInventory / rop : 1.2;
  const r1 = clamp((thresholds.p1_safe - k) / (thresholds.p1_safe - thresholds.p1_crit));

  const dosSafe = thresholds.p2_safeMultiplier * ltAvg;
  const dosCrit = thresholds.p2_critMultiplier * ltAvg;
  const doS = product.daysOfCoverage || 0;
  const r2 = clamp((dosSafe - doS) / (dosSafe - dosCrit));

  const ssTarget = Math.max((product.safetyStock || 0) * 1.5, 5);
  const ssNow = product.safetyStock || 0;
  const r3 = clamp((ssTarget - ssNow) / ssTarget);

  const ltEff = ltAvg + 1.65 * sigmaLT;
  const r4 = clamp((ltEff - thresholds.p4_safe) / (thresholds.p4_crit - thresholds.p4_safe));

  let rConc = 1.0;
  if (suppliers && suppliers.length > 1) {
    const hhi = suppliers.reduce((sum, s) => sum + Math.pow((s.supplyPct || 0) / 100, 2), 0);
    const n = suppliers.length;
    rConc = (hhi - 1 / n) / (1 - 1 / n);
  }
  
  let otifAvg = 0.90;
  if (suppliers && suppliers.length > 0) {
    const totalPct = suppliers.reduce((sum, s) => sum + (s.supplyPct || 0), 0);
    if (totalPct > 0) {
      otifAvg = suppliers.reduce((sum, s) => sum + ((s.supplyPct || 0) / 100) * ((s.reliability || 90) / 100), 0);
    } else {
      otifAvg = suppliers.reduce((sum, s) => sum + (s.reliability || 90), 0) / suppliers.length / 100;
    }
  }
  const rOtif = clamp((thresholds.p5_otifTarget - otifAvg) / (thresholds.p5_otifTarget - thresholds.p5_otifFloor));
  const r5 = 0.5 * rConc + 0.5 * rOtif;

  let baseCR = 0.5;
  const cat = String(product.category || 'General').toLowerCase();
  if (cat.includes('engine') || cat.includes('transmission') || cat.includes('drivetrain')) {
    baseCR = 1.00;
  } else if (cat.includes('brakes') || cat.includes('electrical') || cat.includes('fuel')) {
    baseCR = 0.75;
  } else if (cat.includes('suspension') || cat.includes('hvac')) {
    baseCR = 0.50;
  } else if (cat.includes('wheel') || cat.includes('tire') || cat.includes('body')) {
    baseCR = 0.25;
  } else {
    baseCR = 0.10;
  }
  
  const cr = config.criticalityOverride && config.criticalityOverride[product.erpCode] !== undefined
    ? config.criticalityOverride[product.erpCode]
    : baseCR;
  const r6 = cr;

  let tariffSeverity = 0.4;
  let tariffProbability = 0.6;
  let tariffRelevance = 0.1;
  
  if (suppliers && suppliers.some(s => s.country === 'China')) {
    tariffRelevance = 0.9;
    tariffSeverity = 0.6;
    tariffProbability = 0.8;
  } else if (suppliers && suppliers.some(s => s.country === 'Germany' || s.country === 'Japan')) {
    tariffRelevance = 0.5;
  }
  
  const customTariff = config.tariffOverride && config.tariffOverride[product.erpCode]
    ? config.tariffOverride[product.erpCode]
    : { severity: tariffSeverity, probability: tariffProbability, relevance: tariffRelevance };

  const r7 = customTariff.severity * customTariff.probability * customTariff.relevance;

  let corridorSeverity = 0.4;
  let corridorProbability = 0.5;
  let corridorPersistence = 0.5;
  let corridorRelevance = 0.1;

  if (suppliers && suppliers.some(s => s.region === 'Asia')) {
    corridorRelevance = 0.8;
    corridorSeverity = 0.6;
    corridorProbability = 0.7;
    corridorPersistence = 0.6;
  } else if (suppliers && suppliers.some(s => s.region === 'EU')) {
    corridorRelevance = 0.4;
  }

  const customCorridor = config.corridorOverride && config.corridorOverride[product.erpCode]
    ? config.corridorOverride[product.erpCode]
    : { severity: corridorSeverity, probability: corridorProbability, persistence: corridorPersistence, relevance: corridorRelevance };

  const coreThreat = 0.5 * customCorridor.severity + 0.3 * customCorridor.probability + 0.2 * customCorridor.persistence;
  const r8 = customCorridor.relevance * coreThreat;

  const scoreA = 100 * (
    weightsA.p1_invLevel * r1 +
    weightsA.p2_daysOfSupply * r2 +
    weightsA.p3_safetyStock * r3 +
    weightsA.p4_leadTime * r4 +
    weightsA.p5_supplierDep * r5 +
    weightsA.p6_criticality * r6 +
    weightsA.p7_tariffNews * r7 +
    weightsA.p8_corridorNews * r8
  );

  const likelihood = (
    weightsB.p1_invLevel * r1 +
    weightsB.p2_daysOfSupply * r2 +
    weightsB.p3_safetyStock * r3 +
    weightsB.p4_leadTime * r4 +
    weightsB.p5_supplierDep * r5 +
    weightsB.p7_tariffNews * r7 +
    weightsB.p8_corridorNews * r8
  );
  
  const impact = 0.4 + 0.6 * cr;
  const scoreB = 100 * likelihood * impact;

  let scoreFinal = scoreB;
  let hasOverride = false;
  if (Math.max(r2, r7, r8) >= 0.90) {
    scoreFinal = Math.max(scoreB, 70);
    hasOverride = true;
  }

  let riskBand = 'Low';
  if (scoreFinal > 75) riskBand = 'Critical';
  else if (scoreFinal > 50) riskBand = 'High';
  else if (scoreFinal > 25) riskBand = 'Moderate';

  return {
    subScores: { r1, r2, r3, r4, r5, r6, r7, r8 },
    rawMetrics: {
      rop,
      k,
      dailyUse,
      ltAvg,
      sigmaLT,
      ltEff,
      rConc,
      rOtif,
      otifAvg,
      cr,
      tariffDetails: customTariff,
      corridorDetails: customCorridor,
    },
    scoreA: parseFloat(scoreA.toFixed(1)),
    scoreB: parseFloat(scoreB.toFixed(1)),
    scoreFinal: parseFloat(scoreFinal.toFixed(1)),
    hasOverride,
    riskBand,
  };
}

function getInventoryRiskRecords(products, suppliers, config = {}) {
  return products.map(product => {
    const productSuppliers = suppliers.filter(s => s.productErpCode === product.erpCode);
    const maxLeadTime = productSuppliers.reduce((max, s) => Math.max(max, s.leadTimeDays), 15);
    const numSuppliers = productSuppliers.length;

    const sde = getSdeClassification(maxLeadTime, numSuppliers);
    const ved = getVedClassification(product.category, product.daysOfCoverage);
    const riskValue = sde.score * ved.score;

    let riskLevel = 'Low';
    if (riskValue >= 15) riskLevel = 'Critical';
    else if (riskValue >= 6) riskLevel = 'Medium';

    const advancedRisk = calculateRiskScore(product, productSuppliers, config);

    return {
      ...product,
      maxLeadTime,
      numSuppliers,
      sdeScore: sde.score,
      sdeClass: sde.classification,
      vedScore: ved.score,
      vedClass: ved.classification, // Keep legacy compatibility if needed or use actual ved class
      riskValue,
      riskLevel,
      suppliers: productSuppliers,
      
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

function getRiskSummary(products, suppliers, config = {}) {
  const records = getInventoryRiskRecords(products, suppliers, config);
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
    const band = r.riskBand;
    if (riskSegments[band]) {
      riskSegments[band].count++;
      riskSegments[band].value += r.inventoryValue;
    } else {
      const legacyBand = r.riskLevel === 'Critical' ? 'Critical' : r.riskLevel === 'Medium' ? 'Moderate' : 'Low';
      if (riskSegments[legacyBand]) {
        riskSegments[legacyBand].count++;
        riskSegments[legacyBand].value += r.inventoryValue;
      }
    }

    const sClass = r.sdeClass || 'E';
    if (sdeSegments[sClass]) {
      sdeSegments[sClass].count++;
      sdeSegments[sClass].value += r.inventoryValue;
    }

    const vClass = r.vedClass || 'D';
    if (vedSegments[vClass]) {
      vedSegments[vClass].count++;
      vedSegments[vClass].value += r.inventoryValue;
    }
  });

  return {
    totalValue,
    riskSegments,
    sdeSegments,
    vedSegments,
    avgRiskScore: records.length > 0 ? (records.reduce((sum, r) => sum + r.scoreFinal, 0) / records.length) : 0
  };
}

// ─────────────────────────────────────────────
// Landed Cost & Tariff Impact Calculator
// ─────────────────────────────────────────────

function generateNotifications(product, supplier, tariffPct, fob, totalLandedCost, suppliers = []) {
  const notifications = [];

  if (suppliers.length === 1) {
    notifications.push({
      type: 'warning',
      message: `Single sourcing risk: only one supplier (${supplier.supplierName}) is registered for this product in Supplier Master.`,
    });
  }

  const coverage = product.daysOfCoverage || product.daysOfCover || 30;
  if (coverage <= 15) {
    notifications.push({
      type: 'critical',
      message: `Critical inventory: only ${coverage} days of coverage remaining.`,
    });
  } else if (coverage <= 30) {
    notifications.push({
      type: 'warning',
      message: `Low inventory: only ${coverage} days of coverage remaining. Safety stock is at risk.`,
    });
  }

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

function calculateTariff(product, suppliers, destinationCountry, supplierInputs) {
  const destRegion = getRegionForCountry(destinationCountry);

  const productInfo = {
    hsCode: product.hsCode,
    erpCode: product.erpCode,
    productDescription: product.description,
    productCategory: product.category,
    inventoryCriticality: getVedClassification(product.category, product.daysOfCoverage || product.daysOfCover || 30).classification === 'V' ? 'Vital' : getVedClassification(product.category, product.daysOfCoverage || product.daysOfCover || 30).classification === 'E' ? 'Essential' : 'Desirable',
    numberOfSuppliers: suppliers.length,
    numberOfCountriesSupplying: [...new Set(suppliers.map(s => s.country))].length,
    currentInventoryLevel: product.inHandInventory + product.inTransitInventory,
    inHandInventory: product.inHandInventory,
    inTransitInventory: product.inTransitInventory,
    inventoryValue: product.inventoryValue,
    daysOfSupply: product.daysOfCoverage || product.daysOfCover || 30,
    currentSafetyStockLevel: product.safetyStock,
    roq: product.roq,
    reviewType: product.reviewType,
  };

  const supplierResults = supplierInputs.map((input, idx) => {
    const supplierData = suppliers.find(s => s.supplierId === input.supplierId) || suppliers[idx];
    if (!supplierData) return null;

    const originCountry = supplierData.country;
    const originRegion = supplierData.region;
    const originCountryCode = supplierData.countryCode;
    const transportMode = input.transportMode || supplierData.defaultTransport;
    const fob = parseFloat(input.fob) || 0;
    const numberOfUnits = parseInt(input.numberOfUnits) || 1;

    const tariffPct = input.tariffPctOverride !== undefined ? parseFloat(input.tariffPctOverride) : getTariffRate(destinationCountry, product.hsCode, originCountryCode);
    const insurancePct = input.insurancePctOverride !== undefined ? parseFloat(input.insurancePctOverride) : getInsuranceCostPct(transportMode, originRegion, destRegion);
    const freightPct = input.freightPctOverride !== undefined ? parseFloat(input.freightPctOverride) : getShippingCostPct(transportMode, originRegion, destRegion);
    const otherDutiesPct = input.otherDutiesPctOverride !== undefined ? parseFloat(input.otherDutiesPctOverride) : getOtherDutiesPct(destinationCountry);
    const variableCostPct = input.variableCostPctOverride !== undefined ? parseFloat(input.variableCostPctOverride) : 0;

    const tariffValue = fob * (tariffPct / 100);
    const insuranceValue = fob * (insurancePct / 100);
    const freightValue = fob * (freightPct / 100);
    const otherDutiesValue = fob * (otherDutiesPct / 100);
    const variableCostValue = fob * (variableCostPct / 100);

    const totalLandedCost = fob + tariffValue + insuranceValue + freightValue + otherDutiesValue + variableCostValue;
    const landedCostPerUnit = numberOfUnits > 0 ? totalLandedCost / numberOfUnits : 0;

    const corridors = getApplicableCorridors(originRegion, destRegion);
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
      fob,
      numberOfUnits,
      tariffPct,
      insurancePct,
      freightPct,
      otherDutiesPct,
      variableCostPct,
      tariffValue,
      insuranceValue,
      freightValue,
      otherDutiesValue,
      variableCostValue,
      totalLandedCost,
      landedCostPerUnit,
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

function compareSuppliers(results) {
  if (!results || results.length < 2) return null;

  const sortedByCost = [...results].sort((a, b) => a.landedCostPerUnit - b.landedCostPerUnit);
  const bestCost = sortedByCost[0];
  const secondBestCost = sortedByCost[1];
  const costDiff = secondBestCost.landedCostPerUnit - bestCost.landedCostPerUnit;
  const costDifferencePct = secondBestCost.landedCostPerUnit > 0
    ? ((costDiff / secondBestCost.landedCostPerUnit) * 100).toFixed(1)
    : 0;

  const sortedByTime = [...results].sort((a, b) => a.leadTimeDays - b.leadTimeDays);
  const bestTime = sortedByTime[0];
  const secondBestTime = sortedByTime[1];
  const leadTimeDiff = secondBestTime.leadTimeDays - bestTime.leadTimeDays;

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

// ─────────────────────────────────────────────
// Scenario Simulator
// ─────────────────────────────────────────────

function runScenario(baseResult, scenarioParams) {
  const {
    tariffChangePct = 0,
    newFob = null,
    newUnits = null,
  } = scenarioParams;

  const fob = newFob !== null ? parseFloat(newFob) : baseResult.fob;
  const units = newUnits !== null ? parseInt(newUnits) : baseResult.numberOfUnits;

  const currentTariffPct = baseResult.tariffPct;
  const newTariffPct = Math.max(0, currentTariffPct * (1 + tariffChangePct / 100));

  const tariffValue = fob * (newTariffPct / 100);
  const insuranceValue = fob * (baseResult.insurancePct / 100);
  const freightValue = fob * (baseResult.freightPct / 100);
  const otherDutiesValue = fob * (baseResult.otherDutiesPct / 100);
  const variableCostPct = baseResult.variableCostPct || 0;
  const variableCostValue = fob * (variableCostPct / 100);

  const newTotalCost = fob + tariffValue + insuranceValue + freightValue + otherDutiesValue + variableCostValue;
  const newCostPerUnit = units > 0 ? newTotalCost / units : 0;

  const costDifference = newTotalCost - baseResult.totalLandedCost;
  const costDifferencePct = baseResult.totalLandedCost > 0
    ? ((costDifference / baseResult.totalLandedCost) * 100)
    : 0;

  return {
    scenarioType: tariffChangePct >= 0 ? 'increase' : 'decrease',
    tariffChangePct,
    fob,
    numberOfUnits: units,
    currentTariffPct,
    currentTotalCost: baseResult.totalLandedCost,
    currentCostPerUnit: baseResult.landedCostPerUnit,
    newTariffPct: parseFloat(newTariffPct.toFixed(4)),
    newTariffValue: tariffValue,
    insurancePct: baseResult.insurancePct,
    insuranceValue,
    freightPct: baseResult.freightPct,
    freightValue,
    otherDutiesPct: baseResult.otherDutiesPct,
    otherDutiesValue,
    variableCostPct,
    variableCostValue,
    newTotalCost,
    newCostPerUnit,
    costDifference,
    costDifferencePct: parseFloat(costDifferencePct.toFixed(2)),
    direction: tariffChangePct >= 0 ? '+++' : '----',
    supplierName: baseResult.supplierName,
    originCountry: baseResult.originCountry,
    transportMode: baseResult.transportMode,
  };
}

function runPairedScenarios(baseResult, increasePct, decreasePct, newFobA = null, newFobB = null, newUnitsA = null, newUnitsB = null) {
  const scenarioA = runScenario(baseResult, {
    tariffChangePct: Math.abs(increasePct),
    newFob: newFobA,
    newUnits: newUnitsA,
  });

  const scenarioB = runScenario(baseResult, {
    tariffChangePct: -Math.abs(decreasePct),
    newFob: newFobB,
    newUnits: newUnitsB,
  });

  const scenarioSpread = scenarioA.newTotalCost - scenarioB.newTotalCost;
  const scenarioSpreadPct = scenarioB.newTotalCost > 0
    ? ((scenarioSpread / scenarioB.newTotalCost) * 100).toFixed(2)
    : 0;

  return {
    scenarioA,
    scenarioB,
    comparison: {
      spread: scenarioSpread,
      spreadPct: parseFloat(scenarioSpreadPct),
      baselineCost: baseResult.totalLandedCost,
      worstCase: scenarioA.newTotalCost,
      bestCase: scenarioB.newTotalCost,
    },
  };
}

function runSensitivityMatrix(baseResult, changeLevels = [-25, -15, -10, -5, 0, 5, 10, 15, 25, 50]) {
  return changeLevels.map(pct => {
    const result = runScenario(baseResult, { tariffChangePct: pct });
    return {
      changePct: pct,
      newTariffPct: result.newTariffPct,
      newTotalCost: result.newTotalCost,
      newCostPerUnit: result.newCostPerUnit,
      costDifference: result.costDifference,
      costDifferencePct: result.costDifferencePct,
    };
  });
}

// ─────────────────────────────────────────────
// Procurement Subset Solver
// ─────────────────────────────────────────────

function solveProcurement(
  selectedProduct,
  suppliers,
  serviceLevelZ,
  dailyUse,
  destinationCountry,
  dualSourcingEnabled,
  maxSharePct,
  totalDemand,
  holdingCostRate,
  riskWeight,
  criticalityInfo
) {
  const inventoryVal = parseFloat(selectedProduct.inventoryValue) || 0;
  const inHand = parseInt(selectedProduct.inHandInventory) || 0;
  const unitCost = (inventoryVal > 0 && inHand > 0) ? (inventoryVal / inHand) : 11;
  const destRegion = getRegionForCountry(destinationCountry);

  const supplierCosts = suppliers.map(s => {
    const originCountry = s.country;
    const originRegion = s.region;
    const originCountryCode = s.countryCode;
    const transportMode = s.defaultTransport || 'Ship/Ocean';

    const tariffPct = getTariffRate(destinationCountry, selectedProduct.hsCode, originCountryCode);
    const insurancePct = getInsuranceCostPct(transportMode, originRegion, destRegion);
    const freightPct = getShippingCostPct(transportMode, originRegion, destRegion);
    const otherDutiesPct = getOtherDutiesPct(destinationCountry);

    const landedFactor = 1 + (tariffPct + insurancePct + freightPct + otherDutiesPct) / 100;
    const landedCostPerUnit = unitCost * landedFactor;

    const reliability = s.reliability || 90;
    const ltDays = s.leadTimeDays || 15;
    const sigmaLT = ltDays * (0.1 + (1 - reliability / 100) * 0.5);
    const safetyStockQty = serviceLevelZ * sigmaLT * dailyUse;

    const relRisk = 100 - reliability;
    const corridorRisk = originRegion === 'Asia' ? 70 : originRegion === 'EU' ? 35 : 10;
    const tariffRisk = Math.min(100, tariffPct * 3);
    const ltRisk = Math.min(100, sigmaLT * 4);
    const riskScore = 0.35 * relRisk + 0.25 * corridorRisk + 0.20 * tariffRisk + 0.20 * ltRisk;

    let criticalityFactor = 1.0;
    if (criticalityInfo.rating === 'Vital') criticalityFactor = 1.5;
    else if (criticalityInfo.rating === 'Essential') criticalityFactor = 1.0;
    else criticalityFactor = 0.5;

    const holdingCostPerUnit = landedCostPerUnit * holdingCostRate;
    const safetyStockCost = safetyStockQty * holdingCostPerUnit;

    const riskFactor = (riskScore / 100) * riskWeight * criticalityFactor;
    const W = landedCostPerUnit + (holdingCostPerUnit / 2) + landedCostCostPerUnit * riskFactor; // Fix typo from front: landedCostPerUnit * riskFactor

    return {
      supplierId: s.supplierId,
      supplierName: s.supplierName,
      country: originCountry,
      region: originRegion,
      moq: s.moq || 1,
      leadTimeDays: ltDays,
      reliability,
      sigmaLT,
      safetyStockQty,
      safetyStockCost,
      landedCostPerUnit,
      holdingCostPerUnit,
      riskScore,
      criticalityFactor,
      riskFactor,
      W,
      tariffPct,
      insurancePct,
      freightPct,
      otherDutiesPct,
      transportMode
    };
  });

  const N = suppliers.length;
  let bestSolution = null;
  let bestCost = Infinity;
  const numSubsets = Math.pow(2, N);

  for (let mask = 1; mask < numSubsets; mask++) {
    const activeIndices = [];
    for (let i = 0; i < N; i++) {
      if ((mask & (1 << i)) !== 0) {
        activeIndices.push(i);
      }
    }

    const activeSuppliers = activeIndices.map(idx => supplierCosts[idx]);
    const numActive = activeSuppliers.length;

    if (dualSourcingEnabled && N >= 2 && numActive < 2) {
      continue;
    }

    let isLPFeasible = true;
    const Q = {};
    activeSuppliers.forEach(s => {
      Q[s.supplierId] = s.moq;
    });

    let currentSum = activeSuppliers.reduce((sum, s) => sum + s.moq, 0);
    if (currentSum < totalDemand) {
      let remaining = totalDemand - currentSum;
      const sortedActive = [...activeSuppliers].sort((a, b) => a.W - b.W);
      
      for (let s of sortedActive) {
        const limit = (dualSourcingEnabled && numActive >= 2) ? Math.floor(maxSharePct * totalDemand) : totalDemand;
        const maxAdd = limit - Q[s.supplierId];
        if (maxAdd <= 0) continue;
        
        const step = s.moq;
        const maxSteps = Math.floor(maxAdd / step);
        if (maxSteps <= 0) continue;
        
        const stepsNeeded = Math.ceil(remaining / step);
        const stepsToAdd = Math.min(maxSteps, stepsNeeded);
        
        const qtyToAdd = stepsToAdd * step;
        Q[s.supplierId] += qtyToAdd;
        remaining -= qtyToAdd;
        currentSum += qtyToAdd;
        if (remaining <= 0) break;
      }
      
      if (remaining > 0) {
        for (let s of sortedActive) {
          const qtyToAdd = Math.ceil(remaining / s.moq) * s.moq;
          Q[s.supplierId] += qtyToAdd;
          remaining -= qtyToAdd;
          currentSum += qtyToAdd;
          if (remaining <= 0) break;
        }
      }
    }

    if (isLPFeasible) {
      let landedCostSum = 0;
      let holdingCostSum = 0;
      let riskPenaltySum = 0;
      let ssCostSum = 0;

      activeSuppliers.forEach(s => {
        const qty = Q[s.supplierId];
        landedCostSum += qty * s.landedCostPerUnit;
        holdingCostSum += (qty / 2) * s.holdingCostPerUnit;
        ssCostSum += s.safetyStockCost;
        riskPenaltySum += qty * s.landedCostPerUnit * s.riskFactor;
      });

      const totalCost = landedCostSum + holdingCostSum + ssCostSum + riskPenaltySum;
      if (totalCost < bestCost) {
        bestCost = totalCost;
        bestSolution = {
          activeMask: mask,
          allocations: Q,
          landedCost: landedCostSum,
          holdingCost: holdingCostSum,
          safetyStockCost: ssCostSum,
          riskPenalty: riskPenaltySum,
          totalCost: totalCost,
          supplierDetails: activeSuppliers.map(s => ({
            ...s,
            qty: Q[s.supplierId],
            sharePct: Math.round((Q[s.supplierId] / currentSum) * 100)
          }))
        };
      }
    }
  }

  let isRelaxed = false;
  let relaxationMsg = '';
  if (!bestSolution) {
    isRelaxed = true;
    const sortedAll = [...supplierCosts].sort((a, b) => a.W - b.W);
    const cheapest = sortedAll[0];
    
    const cheapestQty = Math.ceil(totalDemand / cheapest.moq) * cheapest.moq;
    const allocations = { [cheapest.supplierId]: cheapestQty };
    const qty = cheapestQty;
    const landedCostSum = qty * cheapest.landedCostPerUnit;
    const holdingCostSum = (qty / 2) * cheapest.holdingCostPerUnit;
    const ssCostSum = cheapest.safetyStockCost;
    const riskPenaltySum = qty * cheapest.landedCostPerUnit * cheapest.riskFactor;
    const totalCost = landedCostSum + holdingCostSum + ssCostSum + riskPenaltySum;

    bestSolution = {
      activeMask: 1,
      allocations,
      landedCost: landedCostSum,
      holdingCost: holdingCostSum,
      safetyStockCost: ssCostSum,
      riskPenalty: riskPenaltySum,
      totalCost,
      supplierDetails: [{
        ...cheapest,
        qty,
        sharePct: 100
      }]
    };
    relaxationMsg = 'Constraints relaxed: Single sourcing allowed to satisfy MOQ constraints.';
  }

  return {
    feasible: true,
    solution: bestSolution,
    relaxed: isRelaxed,
    relaxationMsg,
    supplierCosts
  };
}

// Recalculates risk scores step-by-step using local modal overrides and product info to show exact math
function getCalculationDetails(product, localCrit, localTar, localCorr, config, activeModel) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
  const weightsA = { ...DEFAULT_WEIGHTS_A, ...config.weightsA };
  const weightsB = { ...DEFAULT_WEIGHTS_B, ...config.weightsB };

  // Daily Consumption
  const dailyUse = product.daysOfCoverage > 0
    ? product.inHandInventory / product.daysOfCoverage
    : 1;

  // Average Lead time
  const suppliers = product.suppliers || [];
  let ltAvg = 20;
  let ltAvgFormula = '';
  let ltAvgCalculation = '';
  if (suppliers.length > 0) {
    const totalPct = suppliers.reduce((sum, s) => sum + (s.supplyPct || 0), 0);
    if (totalPct > 0) {
      ltAvg = suppliers.reduce((sum, s) => sum + ((s.supplyPct || 0) / 100) * (s.leadTimeDays || 0), 0);
      ltAvgFormula = 'Sum(Supply% * LT_days)';
      ltAvgCalculation = suppliers.map(s => `(${s.supplyPct}% * ${s.leadTimeDays}d)`).join(' + ') + ` = ${ltAvg.toFixed(2)} days`;
    } else {
      ltAvg = suppliers.reduce((sum, s) => sum + (s.leadTimeDays || 0), 0) / suppliers.length;
      ltAvgFormula = 'Sum(LT_days) / N';
      ltAvgCalculation = `(${suppliers.map(s => `${s.leadTimeDays}d`).join(' + ')}) / ${suppliers.length} = ${ltAvg.toFixed(2)} days`;
    }
  } else {
    ltAvgFormula = 'Fallback Default';
    ltAvgCalculation = `Default value = 20.00 days (no suppliers available)`;
  }

  // Sigma LT
  let sigmaLT = 5;
  let sigmaLTFormula = '';
  let sigmaLTCalculation = '';
  if (suppliers.length > 0) {
    const totalPct = suppliers.reduce((sum, s) => sum + (s.supplyPct || 0), 0);
    const supplierSigmas = suppliers.map(s => {
      const reliability = s.reliability || 90;
      const sSigma = s.leadTimeDays * (0.1 + (1 - reliability / 100) * 0.5);
      return { s, reliability, sSigma };
    });
    
    if (totalPct > 0) {
      sigmaLT = supplierSigmas.reduce((sum, item) => sum + ((item.s.supplyPct || 0) / 100) * item.sSigma, 0);
      sigmaLTFormula = 'Sum(Supply% * sSigma)';
      sigmaLTCalculation = supplierSigmas.map(item => `(${item.s.supplyPct}% * [${item.s.leadTimeDays}d * (0.1 + (1 - ${item.reliability}/100) * 0.5)])`).join('\n+ ') + `\n= ${sigmaLT.toFixed(2)} days`;
    } else {
      sigmaLT = supplierSigmas.reduce((sum, item) => sum + item.sSigma, 0) / suppliers.length;
      sigmaLTFormula = 'Sum(sSigma) / N';
      sigmaLTCalculation = `(${supplierSigmas.map(item => `[${item.s.leadTimeDays}d * (0.1 + (1 - ${item.reliability}/100) * 0.5)]`).join(' + ')}) / ${suppliers.length} = ${sigmaLT.toFixed(2)} days`;
    }
  } else {
    sigmaLTFormula = 'Fallback Default';
    sigmaLTCalculation = `Default value = 5.00 days (no suppliers available)`;
  }

  // ROP
  const rop = (dailyUse * ltAvg) + (product.safetyStock || 0);
  const ropFormula = '(DailyUse * LT_avg) + SafetyStock';
  const ropCalculation = `(${dailyUse.toFixed(2)} * ${ltAvg.toFixed(2)}) + ${product.safetyStock || 0} = ${rop.toFixed(2)} units`;

  // k Ratio
  const k = rop > 0 ? product.inHandInventory / rop : 1.2;
  const kFormula = 'IL / ROP';
  const kCalculation = `${product.inHandInventory} / ${rop.toFixed(2)} = ${k.toFixed(4)}`;

  // --- Subscores ---
  // P1
  const r1 = clamp((thresholds.p1_safe - k) / (thresholds.p1_safe - thresholds.p1_crit));
  const r1Formula = 'clamp((Safe_p1 - k) / (Safe_p1 - Crit_p1))';
  const r1Calculation = `clamp((${thresholds.p1_safe} - ${k.toFixed(2)}) / (${thresholds.p1_safe} - ${thresholds.p1_crit})) = clamp(${(thresholds.p1_safe - k).toFixed(2)} / ${(thresholds.p1_safe - thresholds.p1_crit).toFixed(2)}) = ${r1.toFixed(2)}`;

  // P2
  const dosSafe = thresholds.p2_safeMultiplier * ltAvg;
  const dosCrit = thresholds.p2_critMultiplier * ltAvg;
  const doS = product.daysOfCoverage || 0;
  const r2 = clamp((dosSafe - doS) / (dosSafe - dosCrit));
  const r2Formula = 'clamp((dosSafe - DoS) / (dosSafe - dosCrit))';
  const r2Calculation = `dosSafe = ${thresholds.p2_safeMultiplier} * ${ltAvg.toFixed(1)} = ${dosSafe.toFixed(1)}d, dosCrit = ${thresholds.p2_critMultiplier} * ${ltAvg.toFixed(1)} = ${dosCrit.toFixed(1)}d\nclamp((${dosSafe.toFixed(1)} - ${doS}) / (${dosSafe.toFixed(1)} - ${dosCrit.toFixed(1)})) = clamp(${(dosSafe - doS).toFixed(1)} / ${(dosSafe - dosCrit).toFixed(1)}) = ${r2.toFixed(2)}`;

  // P3
  const ssTarget = Math.max((product.safetyStock || 0) * 1.5, 5);
  const ssNow = product.safetyStock || 0;
  const r3 = clamp((ssTarget - ssNow) / ssTarget);
  const r3Formula = 'clamp((ssTarget - ssNow) / ssTarget)';
  const r3Calculation = `ssTarget = max(${ssNow} * 1.5, 5) = ${ssTarget.toFixed(1)}\nclamp((${ssTarget.toFixed(1)} - ${ssNow}) / ${ssTarget.toFixed(1)}) = ${r3.toFixed(2)}`;

  // P4
  const ltEff = ltAvg + 1.65 * sigmaLT;
  const r4 = clamp((ltEff - thresholds.p4_safe) / (thresholds.p4_crit - thresholds.p4_safe));
  const r4Formula = 'clamp((ltEff - Safe_p4) / (Crit_p4 - Safe_p4))';
  const r4Calculation = `ltEff = ${ltAvg.toFixed(1)} + (1.65 * ${sigmaLT.toFixed(1)}) = ${ltEff.toFixed(1)}d\nclamp((${ltEff.toFixed(1)} - ${thresholds.p4_safe}) / (${thresholds.p4_crit} - ${thresholds.p4_safe})) = clamp(${(ltEff - thresholds.p4_safe).toFixed(1)} / ${(thresholds.p4_crit - thresholds.p4_safe).toFixed(1)}) = ${r4.toFixed(2)}`;

  // P5 concentration
  let rConc = 1.0;
  let rConcFormula = '';
  let rConcCalculation = '';
  if (suppliers.length > 1) {
    const hhi = suppliers.reduce((sum, s) => sum + Math.pow((s.supplyPct || 0) / 100, 2), 0);
    const n = suppliers.length;
    rConc = (hhi - 1 / n) / (1 - 1 / n);
    rConcFormula = '(HHI - 1/N) / (1 - 1/N)';
    rConcCalculation = `HHI = ${suppliers.map(s => `(${s.supplyPct}%/100)^2`).join(' + ')} = ${hhi.toFixed(3)}\n(${hhi.toFixed(3)} - 1/${n}) / (1 - 1/${n}) = ${rConc.toFixed(2)}`;
  } else {
    rConcFormula = 'Fallback Single Supplier';
    rConcCalculation = `Only ${suppliers.length} supplier(s), HHI concentration score = 1.00`;
  }

  // P5 OTIF reliability
  let otifAvg = 0.90;
  let otifAvgFormula = '';
  let otifAvgCalculation = '';
  if (suppliers.length > 0) {
    const totalPct = suppliers.reduce((sum, s) => sum + (s.supplyPct || 0), 0);
    if (totalPct > 0) {
      otifAvg = suppliers.reduce((sum, s) => sum + ((s.supplyPct || 0) / 100) * ((s.reliability || 90) / 100), 0);
      otifAvgFormula = 'Sum(Supply% * Reliability%)';
      otifAvgCalculation = suppliers.map(s => `(${s.supplyPct}% * ${s.reliability}%)`).join(' + ') + ` = ${(otifAvg*100).toFixed(1)}%`;
    } else {
      otifAvg = suppliers.reduce((sum, s) => sum + (s.reliability || 90), 0) / suppliers.length / 100;
      otifAvgFormula = 'Sum(Reliability%) / N';
      otifAvgCalculation = `(${suppliers.map(s => `${s.reliability}%`).join(' + ')}) / ${suppliers.length} = ${(otifAvg*100).toFixed(1)}%`;
    }
  } else {
    otifAvgFormula = 'Fallback Default';
    otifAvgCalculation = `Default value = 90.0% (no suppliers available)`;
  }
  const rOtif = clamp((thresholds.p5_otifTarget - otifAvg) / (thresholds.p5_otifTarget - thresholds.p5_otifFloor));
  const rOtifFormula = 'clamp((otifTarget - otifAvg) / (otifTarget - otifFloor))';
  const rOtifCalculation = `clamp((${thresholds.p5_otifTarget} - ${otifAvg.toFixed(3)}) / (${thresholds.p5_otifTarget} - ${thresholds.p5_otifFloor})) = ${rOtif.toFixed(2)}`;

  const r5 = 0.5 * rConc + 0.5 * rOtif;
  const r5Formula = '0.5 * Concentration + 0.5 * OTIF';
  const r5Calculation = `0.5 * ${rConc.toFixed(2)} + 0.5 * ${rOtif.toFixed(2)} = ${r5.toFixed(2)}`;

  // P6 Criticality
  const r6 = localCrit;
  const r6Formula = 'Category Base Score (or Custom Override)';
  const r6Calculation = `Criticality Rating = ${r6.toFixed(2)}`;

  // P7 Tariff
  const r7 = localTar.severity * localTar.probability * localTar.relevance;
  const r7Formula = 'Severity * Probability * Relevance';
  const r7Calculation = `${localTar.severity.toFixed(1)} * ${localTar.probability.toFixed(1)} * ${localTar.relevance.toFixed(1)} = ${r7.toFixed(2)}`;

  // P8 Corridor Threat
  const coreThreat = 0.5 * localCorr.severity + 0.3 * localCorr.probability + 0.2 * localCorr.persistence;
  const r8 = localCorr.relevance * coreThreat;
  const r8Formula = 'Relevance * (0.5 * Sev + 0.3 * Prob + 0.2 * Pers)';
  const r8Calculation = `CoreThreat = (0.5 * ${localCorr.severity.toFixed(1)} + 0.3 * ${localCorr.probability.toFixed(1)} + 0.2 * ${localCorr.persistence.toFixed(1)}) = ${coreThreat.toFixed(2)}\n${localCorr.relevance.toFixed(1)} * ${coreThreat.toFixed(2)} = ${r8.toFixed(2)}`;

  // --- Model A Sum ---
  const weightedSumParts = [
    { name: 'P1: Inventory Level', score: r1, weight: weightsA.p1_invLevel },
    { name: 'P2: Days of Supply', score: r2, weight: weightsA.p2_daysOfSupply },
    { name: 'P3: Safety Stock Shortfall', score: r3, weight: weightsA.p3_safetyStock },
    { name: 'P4: Effective Lead Time', score: r4, weight: weightsA.p4_leadTime },
    { name: 'P5: Supplier Dependence', score: r5, weight: weightsA.p5_supplierDep },
    { name: 'P6: Inventory Criticality', score: r6, weight: weightsA.p6_criticality },
    { name: 'P7: Tariff Changes', score: r7, weight: weightsA.p7_tariffNews },
    { name: 'P8: Corridor Threats', score: r8, weight: weightsA.p8_corridorNews },
  ];
  const modelASumProd = weightedSumParts.reduce((sum, part) => sum + part.score * part.weight, 0);
  const scoreA = 100 * modelASumProd;

  // --- Model B Likelihood x Impact ---
  const likelihoodParts = [
    { name: 'P1: Inventory Level', score: r1, weight: weightsB.p1_invLevel },
    { name: 'P2: Days of Supply', score: r2, weight: weightsB.p2_daysOfSupply },
    { name: 'P3: Safety Stock Shortfall', score: r3, weight: weightsB.p3_safetyStock },
    { name: 'P4: Effective Lead Time', score: r4, weight: weightsB.p4_leadTime },
    { name: 'P5: Supplier Dependence', score: r5, weight: weightsB.p5_supplierDep },
    { name: 'P7: Tariff Changes', score: r7, weight: weightsB.p7_tariffNews },
    { name: 'P8: Corridor Threats', score: r8, weight: weightsB.p8_corridorNews },
  ];
  const likelihood = likelihoodParts.reduce((sum, part) => sum + part.score * part.weight, 0);
  const impact = 0.4 + 0.6 * r6;
  const scoreB = 100 * likelihood * impact;

  // Floor Override
  let scoreFinal = scoreB;
  let hasOverride = false;
  const maxOverrideVal = Math.max(r2, r7, r8);
  if (maxOverrideVal >= 0.90) {
    scoreFinal = Math.max(scoreB, 70);
    hasOverride = true;
  }

  return {
    inputs: {
      inHandInventory: product.inHandInventory,
      daysOfCoverage: product.daysOfCoverage,
      safetyStock: product.safetyStock || 0,
      category: product.category,
      suppliers,
    },
    thresholds,
    weightsA,
    weightsB,
    intermediates: {
      dailyUse,
      ltAvg,
      ltAvgFormula,
      ltAvgCalculation,
      sigmaLT,
      sigmaLTFormula,
      sigmaLTCalculation,
      ltEff,
      rop,
      ropFormula,
      ropCalculation,
      k,
      kFormula,
      kCalculation,
    },
    subScores: {
      r1: { score: r1, formula: r1Formula, calculation: r1Calculation },
      r2: { score: r2, formula: r2Formula, calculation: r2Calculation },
      r3: { score: r3, formula: r3Formula, calculation: r3Calculation },
      r4: { score: r4, formula: r4Formula, calculation: r4Calculation },
      r5: { score: r5, formula: r5Formula, calculation: r5Calculation, parts: { rConc, rConcFormula, rConcCalculation, rOtif, rOtifFormula, rOtifCalculation, otifAvg, otifAvgFormula, otifAvgCalculation } },
      r6: { score: r6, formula: r6Formula, calculation: r6Calculation },
      r7: { score: r7, formula: r7Formula, calculation: r7Calculation },
      r8: { score: r8, formula: r8Formula, calculation: r8Calculation },
    },
    modelA: {
      parts: weightedSumParts,
      sumProd: modelASumProd,
      score: scoreA,
    },
    modelB: {
      parts: likelihoodParts,
      likelihood,
      impact,
      score: scoreB,
      hasOverride,
      maxOverrideVal,
      scoreFinal,
    }
  };
}

module.exports = {
  getSdeClassification,
  getVedClassification,
  calculateRiskScore,
  getInventoryRiskRecords,
  getRiskSummary,
  calculateTariff,
  compareSuppliers,
  runScenario,
  runPairedScenarios,
  runSensitivityMatrix,
  solveProcurement,
  getCalculationDetails
};
