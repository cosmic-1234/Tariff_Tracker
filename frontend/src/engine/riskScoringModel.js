// End-to-End Inventory Risk Scoring Model Engine
// Converts 8 supply chain parameters into a single 0-100 Risk Factor per SKU
// Handles both quantitative and qualitative inputs on one comparable scale.

export const DEFAULT_WEIGHTS_A = {
  p1_invLevel: 0.08,
  p2_daysOfSupply: 0.15,
  p3_safetyStock: 0.12,
  p4_leadTime: 0.15,
  p5_supplierDep: 0.18,
  p6_criticality: 0.12,
  p7_tariffNews: 0.10,
  p8_corridorNews: 0.10,
};

export const DEFAULT_WEIGHTS_B = {
  p1_invLevel: 0.09,
  p2_daysOfSupply: 0.17,
  p3_safetyStock: 0.14,
  p4_leadTime: 0.17,
  p5_supplierDep: 0.20,
  p7_tariffNews: 0.115,
  p8_corridorNews: 0.115,
};

export const DEFAULT_THRESHOLDS = {
  p1_safe: 1.2,
  p1_crit: 0.5,
  p4_safe: 15, // days
  p4_crit: 45, // days
  p5_otifTarget: 0.98,
  p5_otifFloor: 0.80,
  p2_safeMultiplier: 2.0,
  p2_critMultiplier: 1.0,
};

// Clamp helper
export function clamp(val, min = 0, max = 1) {
  return Math.max(min, Math.min(max, val));
}

// Calculate the 8 normalized sub-scores r1 - r8 and final aggregate risk scores
export function calculateRiskScore(product, suppliers, config = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...config.thresholds };
  const weightsA = { ...DEFAULT_WEIGHTS_A, ...config.weightsA };
  const weightsB = { ...DEFAULT_WEIGHTS_B, ...config.weightsB };

  // --- Calculate basic helper variables ---
  
  // Daily use derived from In-Hand Inventory / Days of Cover
  const dailyUse = product.daysOfCoverage > 0
    ? product.inHandInventory / product.daysOfCoverage
    : 1;

  // Average lead time (weighted by supply percent if available, otherwise simple average)
  let ltAvg = 20; // fallback
  if (suppliers && suppliers.length > 0) {
    const totalPct = suppliers.reduce((sum, s) => sum + (s.supplyPct || 0), 0);
    if (totalPct > 0) {
      ltAvg = suppliers.reduce((sum, s) => sum + ((s.supplyPct || 0) / 100) * (s.leadTimeDays || 0), 0);
    } else {
      ltAvg = suppliers.reduce((sum, s) => sum + (s.leadTimeDays || 0), 0) / suppliers.length;
    }
  }

  // Standard deviation of lead time (including OTIF reliability penalty)
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

  // 1. P1: Inventory Level (LR on coverage ratio k = IL / ROP)
  const rop = (dailyUse * ltAvg) + (product.safetyStock || 0);
  const k = rop > 0 ? product.inHandInventory / rop : 1.2;
  const r1 = clamp((thresholds.p1_safe - k) / (thresholds.p1_safe - thresholds.p1_crit));

  // 2. P2: Days of Supply (LR anchored to lead time)
  const dosSafe = thresholds.p2_safeMultiplier * ltAvg;
  const dosCrit = thresholds.p2_critMultiplier * ltAvg;
  const doS = product.daysOfCoverage || 0;
  const r2 = clamp((dosSafe - doS) / (dosSafe - dosCrit));

  // 3. P3: Current Safety Stock (LR shortfall vs target)
  const ssTarget = Math.max((product.safetyStock || 0) * 1.5, 5);
  const ssNow = product.safetyStock || 0;
  const r3 = clamp((ssTarget - ssNow) / ssTarget);

  // 4. P4: Lead Time (HR on effective lead time)
  const ltEff = ltAvg + 1.65 * sigmaLT;
  const r4 = clamp((ltEff - thresholds.p4_safe) / (thresholds.p4_crit - thresholds.p4_safe));

  // 5. P5: Supplier dependence (0.5 * rConc + 0.5 * rOtif)
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

  // 6. P6: Inventory Criticality (default derived from category)
  let baseCR = 0.5;
  const cat = String(product.category || 'General').toLowerCase();
  if (cat.includes('engine') || cat.includes('transmission') || cat.includes('drivetrain')) {
    baseCR = 1.00; // Critical
  } else if (cat.includes('brakes') || cat.includes('electrical') || cat.includes('fuel')) {
    baseCR = 0.75; // High
  } else if (cat.includes('suspension') || cat.includes('hvac')) {
    baseCR = 0.50; // Medium
  } else if (cat.includes('wheel') || cat.includes('tire') || cat.includes('body')) {
    baseCR = 0.25; // Low
  } else {
    baseCR = 0.10; // Negligible
  }
  
  // Custom user override if passed in config
  const cr = config.criticalityOverride && config.criticalityOverride[product.erpCode] !== undefined
    ? config.criticalityOverride[product.erpCode]
    : baseCR;
  const r6 = cr;

  // 7. P7: Tariff Changes news rubric
  // Pre-populate with realistic news values based on supplier country (China imports score higher)
  let tariffSeverity = 0.4;
  let tariffProbability = 0.6; // proposed
  let tariffRelevance = 0.1;
  
  if (suppliers && suppliers.some(s => s.country === 'China')) {
    tariffRelevance = 0.9;
    tariffSeverity = 0.6;
    tariffProbability = 0.8;
  } else if (suppliers && suppliers.some(s => s.country === 'Germany' || s.country === 'Japan')) {
    tariffRelevance = 0.5;
  }
  
  // Custom override if provided in config
  const customTariff = config.tariffOverride && config.tariffOverride[product.erpCode]
    ? config.tariffOverride[product.erpCode]
    : { severity: tariffSeverity, probability: tariffProbability, relevance: tariffRelevance };

  const r7 = customTariff.severity * customTariff.probability * customTariff.relevance;

  // 8. P8: Trade Corridor Threats news rubric
  let corridorSeverity = 0.4;
  let corridorProbability = 0.5;
  let corridorPersistence = 0.5;
  let corridorRelevance = 0.1;

  if (suppliers && suppliers.some(s => s.region === 'Asia')) {
    corridorRelevance = 0.8; // Routes through South China Sea / Malacca Strait
    corridorSeverity = 0.6;
    corridorProbability = 0.7;
    corridorPersistence = 0.6;
  } else if (suppliers && suppliers.some(s => s.region === 'EU')) {
    corridorRelevance = 0.4;
  }

  // Custom override if provided in config
  const customCorridor = config.corridorOverride && config.corridorOverride[product.erpCode]
    ? config.corridorOverride[product.erpCode]
    : { severity: corridorSeverity, probability: corridorProbability, persistence: corridorPersistence, relevance: corridorRelevance };

  const coreThreat = 0.5 * customCorridor.severity + 0.3 * customCorridor.probability + 0.2 * customCorridor.persistence;
  const r8 = customCorridor.relevance * coreThreat;

  // --- MODEL A: Weighted Sum ---
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

  // --- MODEL B: Likelihood x Impact ---
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

  // --- Non-compensatory override backstop ---
  let scoreFinal = scoreB;
  let hasOverride = false;
  if (Math.max(r2, r7, r8) >= 0.90) {
    scoreFinal = Math.max(scoreB, 70);
    hasOverride = true;
  }

  // Determine risk band
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
