// Data Service
// Interacts with MERN backend to fetch products and suppliers from MongoDB Atlas

const API_BASE = 'http://localhost:5000/api';

/**
 * Fetch all products from MongoDB Atlas
 */
export async function fetchProducts() {
  try {
    const response = await fetch(`${API_BASE}/products`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data && data.status === 'success') {
      return data.products;
    }
    throw new Error('API payload invalid');
  } catch (error) {
    console.error('Failed to fetch products from backend API:', error.message);
    throw error;
  }
}

/**
 * Fetch all suppliers from MongoDB Atlas
 */
export async function fetchSuppliers() {
  try {
    const response = await fetch(`${API_BASE}/suppliers`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data && data.status === 'success') {
      return data.suppliers;
    }
    throw new Error('API payload invalid');
  } catch (error) {
    console.error('Failed to fetch suppliers from backend API:', error.message);
    throw error;
  }
}

/**
 * Fetch calculated SDE/VED and advanced risk scores from backend API
 */
export async function fetchRiskRecords(config = {}) {
  try {
    const response = await fetch(`${API_BASE}/calculations/risk-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data && data.success) {
      return { records: data.records, summary: data.summary };
    }
    throw new Error('Risk calculation API payload invalid');
  } catch (error) {
    console.error('Failed to fetch calculated risk records:', error.message);
    throw error;
  }
}

/**
 * Fetch landed cost and tariff calculations from backend API
 */
export async function calculateTariffAPI(hsCode, destinationCountry, supplierInputs) {
  try {
    const response = await fetch(`${API_BASE}/calculations/tariff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hsCode, destinationCountry, supplierInputs })
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data && data.success) {
      return { result: data.result, comparison: data.comparison };
    }
    throw new Error('Tariff calculation API payload invalid');
  } catch (error) {
    console.error('Failed to run tariff calculation:', error.message);
    throw error;
  }
}

/**
 * Run scenario simulation on backend API
 */
export async function runScenarioSimulation(params) {
  try {
    const response = await fetch(`${API_BASE}/calculations/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data && data.success) {
      return data;
    }
    throw new Error('Scenario simulation API payload invalid');
  } catch (error) {
    console.error('Failed to run scenario simulation:', error.message);
    throw error;
  }
}

/**
 * Fetch optimized procurement supplier allocation from backend API
 */
export async function optimizeProcurement(params) {
  try {
    const response = await fetch(`${API_BASE}/calculations/procurement-optimizer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data && data.success) {
      return data.optimizationResults;
    }
    throw new Error('Procurement optimizer API payload invalid');
  } catch (error) {
    console.error('Failed to optimize procurement:', error.message);
    throw error;
  }
}

/**
 * Fetch step-by-step mathematical details explanation for a single product risk model
 */
export async function fetchRiskDetails(params) {
  try {
    const response = await fetch(`${API_BASE}/calculations/risk-details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data && data.success) {
      return data.calcDetails;
    }
    throw new Error('Risk details API payload invalid');
  } catch (error) {
    console.error('Failed to fetch risk calculation details:', error.message);
    throw error;
  }
}
