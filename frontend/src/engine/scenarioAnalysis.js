// Scenario Analysis / Sensitivity Analysis Engine
// Handles tariff increase (Scenario A) and tariff decrease (Scenario B)

/**
 * Run scenario analysis on a supplier result
 * 
 * @param {Object} baseResult - Original supplier calculation result from tariffCalculator
 * @param {Object} scenarioParams - { tariffChangePct, newFob, newUnits }
 * @returns {Object} Scenario result with new costs
 */
export function runScenario(baseResult, scenarioParams) {
  const {
    tariffChangePct = 0,   // positive for increase, negative for decrease
    newFob = null,         // optional new FOB ($ manual input)
    newUnits = null,       // optional new units
  } = scenarioParams;

  const fob = newFob !== null ? parseFloat(newFob) : baseResult.fob;
  const units = newUnits !== null ? parseInt(newUnits) : baseResult.numberOfUnits;

  // Calculate new tariff rate
  const currentTariffPct = baseResult.tariffPct;
  const newTariffPct = Math.max(0, currentTariffPct * (1 + tariffChangePct / 100));

  // Recalculate with new tariff (insurance, freight, other duties stay same)
  const tariffValue = fob * (newTariffPct / 100);
  const insuranceValue = fob * (baseResult.insurancePct / 100);
  const freightValue = fob * (baseResult.freightPct / 100);
  const otherDutiesValue = fob * (baseResult.otherDutiesPct / 100);

  const newTotalCost = fob + tariffValue + insuranceValue + freightValue + otherDutiesValue;
  const newCostPerUnit = units > 0 ? newTotalCost / units : 0;

  // Impact calculations
  const costDifference = newTotalCost - baseResult.totalLandedCost;
  const costDifferencePct = baseResult.totalLandedCost > 0
    ? ((costDifference / baseResult.totalLandedCost) * 100)
    : 0;

  return {
    // Scenario inputs
    scenarioType: tariffChangePct >= 0 ? 'increase' : 'decrease',
    tariffChangePct,
    fob,
    numberOfUnits: units,

    // Current values (for comparison)
    currentTariffPct,
    currentTotalCost: baseResult.totalLandedCost,
    currentCostPerUnit: baseResult.landedCostPerUnit,

    // New calculated values
    newTariffPct: parseFloat(newTariffPct.toFixed(4)),
    newTariffValue: tariffValue,
    insurancePct: baseResult.insurancePct,
    insuranceValue,
    freightPct: baseResult.freightPct,
    freightValue,
    otherDutiesPct: baseResult.otherDutiesPct,
    otherDutiesValue,

    // Final results
    newTotalCost,
    newCostPerUnit,

    // Impact
    costDifference,
    costDifferencePct: parseFloat(costDifferencePct.toFixed(2)),
    direction: tariffChangePct >= 0 ? '+++' : '----',

    // Supplier info (pass-through)
    supplierName: baseResult.supplierName,
    originCountry: baseResult.originCountry,
    transportMode: baseResult.transportMode,
  };
}

/**
 * Run paired scenario analysis (increase + decrease) for a supplier
 */
export function runPairedScenarios(baseResult, increasePct, decreasePct, newFobA = null, newFobB = null, newUnitsA = null, newUnitsB = null) {
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

  // Cross-scenario comparison
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

/**
 * Run sensitivity matrix: test multiple tariff change levels
 */
export function runSensitivityMatrix(baseResult, changeLevels = [-25, -15, -10, -5, 0, 5, 10, 15, 25, 50]) {
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
