// Quick script to extract data from Excel files
const XLSX = require('xlsx');
const path = require('path');

// Read Product Master
const productWb = XLSX.readFile(path.join(__dirname, '../src/data/Product Master Ptototype.xlsx'));
console.log('=== PRODUCT MASTER ===');
console.log('Sheet names:', productWb.SheetNames);
productWb.SheetNames.forEach(name => {
  console.log(`\n--- Sheet: ${name} ---`);
  const sheet = productWb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  data.forEach((row, idx) => {
    if (row.some(cell => cell !== '')) {
      console.log(`Row ${idx}: ${JSON.stringify(row)}`);
    }
  });
});

// Read Supplier Master
const supplierWb = XLSX.readFile(path.join(__dirname, '../src/data/Supplier Master Prototype.xlsx'));
console.log('\n\n=== SUPPLIER MASTER ===');
console.log('Sheet names:', supplierWb.SheetNames);
supplierWb.SheetNames.forEach(name => {
  console.log(`\n--- Sheet: ${name} ---`);
  const sheet = supplierWb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  data.forEach((row, idx) => {
    if (row.some(cell => cell !== '')) {
      console.log(`Row ${idx}: ${JSON.stringify(row)}`);
    }
  });
});
