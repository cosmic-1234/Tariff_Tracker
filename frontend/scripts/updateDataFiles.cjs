// Script to update productMaster.js and supplierMaster.js from newly uploaded Excel files
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

console.log('Starting data updates from Excel master files...');

// ─────────────────────────────────────────────
// 1. Process Product Master
// ─────────────────────────────────────────────
const productWbPath = path.join(__dirname, '../src/data/Product Master Ptototype.xlsx');
if (!fs.existsSync(productWbPath)) {
  console.error(`Product Master file not found at ${productWbPath}`);
  process.exit(1);
}

const productWb = XLSX.readFile(productWbPath);
const productSheet = productWb.Sheets['Product Master'] || productWb.Sheets[productWb.SheetNames[0]];
const productRowsRaw = XLSX.utils.sheet_to_json(productSheet);

const productMaster = [];

productRowsRaw.forEach((row, index) => {
  // Trim keys
  const cleanRow = {};
  Object.keys(row).forEach(k => {
    cleanRow[k.trim()] = row[k];
  });

  const erpCode = cleanRow['ERP Code'];
  if (!erpCode || String(erpCode).trim() === '') {
    return; // skip empty rows
  }

  // Column Mapping
  const hsCode = String(cleanRow['HS Code (Mapped)'] || '').trim();
  const category = cleanRow['Category/Commodity'] || 'General';
  const description = cleanRow['Discreption'] || cleanRow['Discription'] || cleanRow['Description'] || 'No Description';
  const inHandInventory = Number(cleanRow['In-Hand Inventory'] ?? 0);
  const inventoryValue = Number(cleanRow['Inventory Value'] ?? cleanRow['Inventory Value '] ?? 0);
  const inTransitInventory = Number(cleanRow['In-Transit Inventory (Nos)'] ?? 0);
  const daysOfCoverage = Number(cleanRow['Days of Cover (Days)'] ?? 0);
  const roq = Number(cleanRow['ROQ (Nos)'] ?? 0);
  const reviewType = cleanRow['Peroidic/Perpatual Review'] || cleanRow['Periodic/Perpetual Review'] || 'Perpetual';
  const safetyStock = Number(cleanRow['Safety Stock (Nos)'] ?? 0);
  const holdingCostPct = Number(cleanRow['Holding cost - % of unit cost /unit/day'] ?? 0);

  productMaster.push({
    erpCode,
    hsCode,
    category,
    description,
    inHandInventory,
    inventoryValue,
    inTransitInventory,
    daysOfCoverage,
    roq,
    reviewType,
    safetyStock,
    holdingCostPct
  });
});

console.log(`Successfully parsed ${productMaster.length} products from excel.`);

// ─────────────────────────────────────────────
// 2. Process Supplier Master
// ─────────────────────────────────────────────
const supplierWbPath = path.join(__dirname, '../src/data/Supplier Master Prototype.xlsx');
if (!fs.existsSync(supplierWbPath)) {
  console.error(`Supplier Master file not found at ${supplierWbPath}`);
  process.exit(1);
}

const supplierWb = XLSX.readFile(supplierWbPath);
const supplierSheet = supplierWb.Sheets['Supplier Master'] || supplierWb.Sheets[supplierWb.SheetNames[0]];
const supplierRowsRaw = XLSX.utils.sheet_to_json(supplierSheet);

const countryToInfo = {
  'china': { region: 'Asia', code: 'CN' },
  'usa': { region: 'NA', code: 'US' },
  'us': { region: 'NA', code: 'US' },
  'germany': { region: 'EU', code: 'DE' },
  'japan': { region: 'Asia', code: 'JP' },
  'netherlands': { region: 'EU', code: 'NL' },
  'india': { region: 'Asia', code: 'IN' }
};

function getCountryInfo(countryName) {
  const normalized = String(countryName || '').trim().toLowerCase();
  if (countryToInfo[normalized]) {
    return countryToInfo[normalized];
  }
  return { region: 'Asia', code: 'CN' }; // fallback
}

const supplierMaster = [];

supplierRowsRaw.forEach((row, index) => {
  const cleanRow = {};
  Object.keys(row).forEach(k => {
    cleanRow[k.trim()] = row[k];
  });

  const supplierCode = cleanRow['Supplier Code'];
  const productCode = cleanRow['Inventory Code'];

  if (!supplierCode || !productCode) {
    return; // skip invalid records
  }

  const supplierName = cleanRow['Supplier'] || 'Unknown Supplier';
  const country = cleanRow['Country of Origin'] || 'China';
  const info = getCountryInfo(country);
  
  // % of supplies (0.6 -> 60%)
  const supplyPct = Math.round(Number(cleanRow['% of supplies'] ?? 0) * 100);
  
  // % of OTIF (0.88 -> 88%)
  const reliability = Math.round(Number(cleanRow['% of OTIF '] ?? cleanRow['% of OTIF'] ?? 0) * 100);

  const leadTimeDays = Number(cleanRow['Lead Time (Days)'] ?? 0);
  const moq = Number(cleanRow['MOQ (Nos)'] ?? 0);

  // default transport: Ocean by default, Air if lead time is short or air shipment
  const defaultTransport = leadTimeDays <= 16 ? 'Air' : 'Ship/Ocean';

  supplierMaster.push({
    productErpCode: productCode,
    supplierId: supplierCode,
    supplierName,
    country,
    region: info.region,
    countryCode: info.code,
    supplyPct,
    leadTimeDays,
    defaultTransport,
    reliability,
    moq
  });
});

console.log(`Successfully parsed ${supplierMaster.length} supplier relationships from excel.`);

// ─────────────────────────────────────────────
// 3. Write productMaster.js
// ─────────────────────────────────────────────
const productMasterContent = `// Product Master Data — generated dynamically from excel Product Master Prototype
// Fields: erpCode, hsCode, category, description, inHandInventory, inventoryValue,
//         inTransitInventory, daysOfCoverage, roq, reviewType, safetyStock, holdingCostPct

export const productMaster = ${JSON.stringify(productMaster, null, 2)};

// Lookup product by HS Code
export function getProductByHSCode(hsCode) {
  return productMaster.find(p => p.hsCode === hsCode) || null;
}

// Lookup product by ERP Code
export function getProductByERPCode(erpCode) {
  return productMaster.find(p => p.erpCode === erpCode) || null;
}

// Get all unique categories
export function getCategories() {
  return [...new Set(productMaster.map(p => p.category))];
}

// Get inventory criticality based on days of coverage
export function getInventoryCriticality(daysOfCoverage) {
  if (daysOfCoverage <= 15) return 'Critical';
  if (daysOfCoverage <= 30) return 'Medium';
  return 'Low';
}
`;

fs.writeFileSync(path.join(__dirname, '../src/data/productMaster.js'), productMasterContent, 'utf8');
console.log('Updated frontend/src/data/productMaster.js');

// ─────────────────────────────────────────────
// 4. Write supplierMaster.js
// ─────────────────────────────────────────────
const supplierMasterContent = `// Supplier Master Data — generated dynamically from excel Supplier Master Prototype
// Each product can have multiple suppliers from different countries

export const supplierMaster = ${JSON.stringify(supplierMaster, null, 2)};

// Get suppliers for a product
export function getSuppliersForProduct(erpCode) {
  return supplierMaster.filter(s => s.productErpCode === erpCode);
}

// Get all unique suppliers
export function getAllSuppliers() {
  const seen = new Set();
  return supplierMaster.filter(s => {
    if (seen.has(s.supplierId)) return false;
    seen.add(s.supplierId);
    return true;
  });
}

// Get unique countries for a product's suppliers
export function getSupplierCountries(erpCode) {
  const suppliers = getSuppliersForProduct(erpCode);
  return [...new Set(suppliers.map(s => s.country))];
}
`;

fs.writeFileSync(path.join(__dirname, '../src/data/supplierMaster.js'), supplierMasterContent, 'utf8');
console.log('Updated frontend/src/data/supplierMaster.js');

console.log('All Excel data processed and adjusted successfully!');
