const XLSX = require('xlsx');
const path = require('path');

const productWb = XLSX.readFile(path.join(__dirname, '../src/data/Product Master Ptototype.xlsx'));
console.log('Sheet Names:', productWb.SheetNames);
productWb.SheetNames.forEach(name => {
  console.log(`Sheet: ${name}`);
  const sheet = productWb.Sheets[name];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  // Show header + first row
  console.log('Data[0] length:', data[0].length);
  console.log('Headers:', JSON.stringify(data[0].slice(0, 30)));
  console.log('Row 1:', JSON.stringify(data[1].slice(0, 30)));
});
