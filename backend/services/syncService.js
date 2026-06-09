const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const SyncMetadata = require('../models/SyncMetadata');

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

const syncExcelToDatabase = async () => {
  console.log('🔄 Checking if Excel master files require synchronization...');

  const dataDir = path.join(__dirname, '../data');
  const productFile = 'Product Master Ptototype.xlsx';
  const supplierFile = 'Supplier Master Prototype.xlsx';

  const productFilePath = path.join(dataDir, productFile);
  const supplierFilePath = path.join(dataDir, supplierFile);

  try {
    // ─────────────────────────────────────────────
    // 1. Check Product Master file sync
    // ─────────────────────────────────────────────
    if (fs.existsSync(productFilePath)) {
      const prodStats = fs.statSync(productFilePath);
      const prodMtime = prodStats.mtimeMs;

      const prodMeta = await SyncMetadata.findOne({ filename: productFile });

      if (!prodMeta || prodMeta.lastModified !== prodMtime) {
        console.log(`⚡ Product Master file has changed or is new. Synced timestamp is ${prodMeta ? prodMeta.lastModified : 'none'}, current modified timestamp is ${prodMtime}. Syncing...`);
        
        const wb = XLSX.readFile(productFilePath);
        const sheet = wb.Sheets['Product Master'] || wb.Sheets[wb.SheetNames[0]];
        const rowsRaw = XLSX.utils.sheet_to_json(sheet);
        
        const productsToInsert = [];
        rowsRaw.forEach((row) => {
          const cleanRow = {};
          Object.keys(row).forEach(k => {
            cleanRow[k.trim()] = row[k];
          });

          const erpCode = cleanRow['ERP Code'];
          if (!erpCode || String(erpCode).trim() === '') {
            return; // skip empty rows
          }

          // Column Mapping matching updateDataFiles.cjs
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

          productsToInsert.push({
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

        // Clear and upload
        await Product.deleteMany({});
        await Product.insertMany(productsToInsert);
        console.log(`✅ Successfully uploaded ${productsToInsert.length} products to MongoDB Atlas.`);

        // Update SyncMetadata
        if (prodMeta) {
          prodMeta.lastModified = prodMtime;
          await prodMeta.save();
        } else {
          await SyncMetadata.create({ filename: productFile, lastModified: prodMtime });
        }
      } else {
        console.log('✅ Product Master data is already up to date in MongoDB.');
      }
    } else {
      console.warn(`⚠️ Warning: Product Master Excel file not found at: ${productFilePath}`);
    }

    // ─────────────────────────────────────────────
    // 2. Check Supplier Master file sync
    // ─────────────────────────────────────────────
    if (fs.existsSync(supplierFilePath)) {
      const suppStats = fs.statSync(supplierFilePath);
      const suppMtime = suppStats.mtimeMs;

      const suppMeta = await SyncMetadata.findOne({ filename: supplierFile });

      if (!suppMeta || suppMeta.lastModified !== suppMtime) {
        console.log(`⚡ Supplier Master file has changed or is new. Synced timestamp is ${suppMeta ? suppMeta.lastModified : 'none'}, current modified timestamp is ${suppMtime}. Syncing...`);
        
        const wb = XLSX.readFile(supplierFilePath);
        const sheet = wb.Sheets['Supplier Master'] || wb.Sheets[wb.SheetNames[0]];
        const rowsRaw = XLSX.utils.sheet_to_json(sheet);
        
        const suppliersToInsert = [];
        rowsRaw.forEach((row) => {
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
          
          const supplyPct = Math.round(Number(cleanRow['% of supplies'] ?? 0) * 100);
          const reliability = Math.round(Number(cleanRow['% of OTIF '] ?? cleanRow['% of OTIF'] ?? 0) * 100);
          const leadTimeDays = Number(cleanRow['Lead Time (Days)'] ?? 0);
          const moq = Number(cleanRow['MOQ (Nos)'] ?? 0);
          const defaultTransport = leadTimeDays <= 16 ? 'Air' : 'Ship/Ocean';

          suppliersToInsert.push({
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

        // Clear and upload
        await Supplier.deleteMany({});
        await Supplier.insertMany(suppliersToInsert);
        console.log(`✅ Successfully uploaded ${suppliersToInsert.length} suppliers to MongoDB Atlas.`);

        // Update SyncMetadata
        if (suppMeta) {
          suppMeta.lastModified = suppMtime;
          await suppMeta.save();
        } else {
          await SyncMetadata.create({ filename: supplierFile, lastModified: suppMtime });
        }
      } else {
        console.log('✅ Supplier Master data is already up to date in MongoDB.');
      }
    } else {
      console.warn(`⚠️ Warning: Supplier Master Excel file not found at: ${supplierFilePath}`);
    }

  } catch (error) {
    console.error(`❌ Auto-Sync Excel-to-Database failed: ${error.message}`);
  }
};

module.exports = syncExcelToDatabase;
