const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const calculationService = require('../services/calculationService');
const apiService = require('../services/apiService');

/**
 * Calculates SDE/VED risk records and summaries for all inventory items
 */
exports.calculateRiskRecords = async (req, res) => {
  try {
    const config = req.body || {};
    
    // Fetch all products and suppliers from MongoDB
    const products = await Product.find().lean();
    const suppliers = await Supplier.find().lean();
    
    // Extract unique countries
    const uniqueCountries = [];
    const seen = new Set();
    suppliers.forEach(s => {
      if (s.countryCode && s.country && !seen.has(s.countryCode)) {
        seen.add(s.countryCode);
        uniqueCountries.push({ code: s.countryCode, name: s.country });
      }
    });

    const lpiMap = {};
    const newsMap = {};

    // Fetch LPI and News threat index in parallel
    await Promise.all(uniqueCountries.map(async (c) => {
      try {
        const [lpiVal, news] = await Promise.all([
          apiService.fetchWorldBankLPI(c.code),
          apiService.fetchGDELTNews(c.name)
        ]);
        lpiMap[c.code] = lpiVal;
        
        // Scale threat index to 0-1 range based on news count (up to 5 articles query)
        const threatFactor = Array.isArray(news) ? (news.length / 5.0) : 0;
        newsMap[c.code] = threatFactor;
      } catch (err) {
        console.error(`Failed to fetch live data for ${c.name}:`, err);
        lpiMap[c.code] = 3.5;
        newsMap[c.code] = 0;
      }
    }));

    const records = calculationService.getInventoryRiskRecords(products, suppliers, config, lpiMap, newsMap);
    const summary = calculationService.getRiskSummary(products, suppliers, config, lpiMap, newsMap);
    
    res.json({
      success: true,
      records,
      summary
    });
  } catch (error) {
    console.error('Failed to calculate risk records:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Calculates landed costs, tariffs, and generate alerts/notifications
 */
exports.calculateTariff = async (req, res) => {
  try {
    const { hsCode, destinationCountry, supplierInputs } = req.body;
    if (!hsCode || !destinationCountry || !supplierInputs) {
      return res.status(400).json({ success: false, error: 'Missing required parameters: hsCode, destinationCountry, or supplierInputs' });
    }

    // Lookup product by HS Code
    const product = await Product.findOne({ hsCode }).lean();
    if (!product) {
      return res.status(404).json({ success: false, error: `Product not found for HS Code: ${hsCode}` });
    }

    // Lookup suppliers for this product
    const suppliers = await Supplier.find({ productErpCode: product.erpCode }).lean();

    // Perform tariff calculations
    const result = calculationService.calculateTariff(product, suppliers, destinationCountry, supplierInputs);

    // Calculate supplier comparisons if we have results
    let comparison = null;
    if (result && result.supplierResults && result.supplierResults.length >= 2) {
      comparison = calculationService.compareSuppliers(result.supplierResults);
    }

    res.json({
      success: true,
      result,
      comparison
    });
  } catch (error) {
    console.error('Failed to calculate tariff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Simulates tariff scenario parameters (sensitivity analysis)
 */
exports.runScenario = async (req, res) => {
  try {
    const { type, baseResult } = req.body;
    if (!baseResult) {
      return res.status(400).json({ success: false, error: 'Missing baseResult parameter' });
    }

    if (type === 'paired') {
      const { increasePct, decreasePct, newFobA, newFobB, newUnitsA, newUnitsB } = req.body;
      const pairedResult = calculationService.runPairedScenarios(
        baseResult,
        increasePct || 0,
        decreasePct || 0,
        newFobA,
        newFobB,
        newUnitsA,
        newUnitsB
      );
      return res.json({ success: true, pairedResult });
    }

    if (type === 'sensitivity') {
      const { changeLevels } = req.body;
      const matrix = calculationService.runSensitivityMatrix(baseResult, changeLevels);
      return res.json({ success: true, matrix });
    }

    // Default: run single scenario
    const { scenarioParams } = req.body;
    const singleResult = calculationService.runScenario(baseResult, scenarioParams || {});
    res.json({ success: true, singleResult });
  } catch (error) {
    console.error('Failed to run scenario simulation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Runs subset enumeration solver to optimize supplier allocation
 */
exports.optimizeProcurement = async (req, res) => {
  try {
    const {
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
    } = req.body;

    if (!selectedProduct || !suppliers) {
      return res.status(400).json({ success: false, error: 'Missing selectedProduct or suppliers' });
    }

    const optimizationResults = calculationService.solveProcurement(
      selectedProduct,
      suppliers,
      serviceLevelZ || 1.65,
      dailyUse || 1.0,
      destinationCountry || 'India',
      dualSourcingEnabled !== undefined ? dualSourcingEnabled : false,
      maxSharePct || 0.7,
      totalDemand || 100,
      holdingCostRate || 0.1,
      riskWeight || 0.3,
      criticalityInfo || { rating: 'Essential' }
    );

    res.json({
      success: true,
      optimizationResults
    });
  } catch (error) {
    console.error('Failed to optimize procurement solver:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Calculates step-by-step mathematical details overlay for a single product risk model
 */
exports.getRiskDetails = async (req, res) => {
  try {
    const { product, localCrit, localTar, localCorr, config, activeModel } = req.body;
    if (!product) {
      return res.status(400).json({ success: false, error: 'Missing product' });
    }

    const calcDetails = calculationService.getCalculationDetails(
      product,
      localCrit || 0.5,
      localTar || { severity: 0.4, probability: 0.6, relevance: 0.1 },
      localCorr || { severity: 0.4, probability: 0.5, persistence: 0.5, relevance: 0.1 },
      config || {},
      activeModel || 'ModelB'
    );

    // Fetch primary supplier LPI and News, and call Bedrock for AI analysis
    const suppliers = product.suppliers || [];
    const primarySupplier = suppliers.reduce((max, s) => (s.supplyPct || 0) > (max.supplyPct || 0) ? s : max, suppliers[0] || null);

    let lpiValue = 3.0;
    let newsArticles = [];
    if (primarySupplier) {
      try {
        const [fetchedLpi, fetchedNews] = await Promise.all([
          apiService.fetchWorldBankLPI(primarySupplier.countryCode),
          apiService.fetchGDELTNews(primarySupplier.country)
        ]);
        lpiValue = fetchedLpi;
        newsArticles = fetchedNews;
      } catch (err) {
        console.warn('Failed to fetch supplier details for AI analysis:', err.message);
      }
    }

    try {
      const aiAnalysis = await apiService.analyzeRiskWithAI(product, suppliers, lpiValue, newsArticles);
      calcDetails.aiAnalysis = aiAnalysis;
    } catch (err) {
      console.error('Bedrock AI Risk Analysis invocation failed:', err);
      calcDetails.aiAnalysis = 'Error: Unable to run AI Risk Analysis at this time.';
    }

    res.json({
      success: true,
      calcDetails
    });
  } catch (error) {
    console.error('Failed to get risk details derivation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};
