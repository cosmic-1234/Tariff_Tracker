// Master Data — Countries, Corridors, Cost Matrices, Tariff Rates
// This data drives all auto-calculations in the Tariff Calculator

// ─────────────────────────────────────────────
// Country & Region Data
// ─────────────────────────────────────────────
export const countries = [
  { name: 'USA', region: 'NA', code: 'US' },
  { name: 'India', region: 'Asia', code: 'IN' },
  { name: 'China', region: 'Asia', code: 'CN' },
  { name: 'Japan', region: 'Asia', code: 'JP' },
  { name: 'Germany', region: 'EU', code: 'DE' },
  { name: 'Netherlands', region: 'EU', code: 'NL' },
  { name: 'South Korea', region: 'Asia', code: 'KR' },
  { name: 'Taiwan', region: 'Asia', code: 'TW' },
  { name: 'United Kingdom', region: 'EU', code: 'GB' },
  { name: 'France', region: 'EU', code: 'FR' },
  { name: 'Italy', region: 'EU', code: 'IT' },
  { name: 'Mexico', region: 'NA', code: 'MX' },
  { name: 'Canada', region: 'NA', code: 'CA' },
  { name: 'Brazil', region: 'NA', code: 'BR' },
  { name: 'Thailand', region: 'Asia', code: 'TH' },
];

export const regions = ['NA', 'Asia', 'EU'];

// ─────────────────────────────────────────────
// Major Trade Corridors
// ─────────────────────────────────────────────
export const majorCorridors = [
  { name: 'Asia-North America Corridor', from: 'Asia', to: 'NA', description: 'Pacific route connecting Asian manufacturers to North American markets' },
  { name: 'Asia-Europe Corridor', from: 'Asia', to: 'EU', description: 'Suez Canal and overland rail connecting Asia to European markets' },
  { name: 'Trans-Atlantic Corridor', from: 'NA', to: 'EU', description: 'Atlantic shipping lanes between North America and Europe' },
  { name: 'Pacific Corridor', from: 'Asia', to: 'Asia', description: 'Intra-Asian trade routes connecting major Asian economies' },
];

// Get applicable corridors based on origin and destination regions
export function getApplicableCorridors(originRegion, destRegion) {
  return majorCorridors.filter(c =>
    (c.from === originRegion && c.to === destRegion) ||
    (c.from === destRegion && c.to === originRegion)
  );
}

// ─────────────────────────────────────────────
// Transport Modes
// ─────────────────────────────────────────────
export const transportModes = ['Ship/Ocean', 'Air', 'Train'];

// ─────────────────────────────────────────────
// Average Insurance Cost Matrix (% of FOB)
// Indexed by [transportMode][originRegion][destRegion]
// ─────────────────────────────────────────────
export const insuranceCostMatrix = {
  'Ship/Ocean': {
    NA:   { NA: 0.35, Asia: 1.20, EU: 1.10 },
    Asia: { NA: 1.20, Asia: 0.50, EU: 1.30 },
    EU:   { NA: 1.10, Asia: 1.30, EU: 0.40 },
  },
  'Air': {
    NA:   { NA: 0.25, Asia: 0.80, EU: 0.70 },
    Asia: { NA: 0.80, Asia: 0.30, EU: 0.85 },
    EU:   { NA: 0.70, Asia: 0.85, EU: 0.25 },
  },
  'Train': {
    NA:   { NA: 0.30, Asia: 0, EU: 0 },
    Asia: { NA: 0, Asia: 0.40, EU: 1.00 },
    EU:   { NA: 0, Asia: 1.00, EU: 0.35 },
  },
};

// ─────────────────────────────────────────────
// Average Shipping/Freight Cost Matrix (% of FOB)
// Indexed by [transportMode][originRegion][destRegion]
// ─────────────────────────────────────────────
export const shippingCostMatrix = {
  'Ship/Ocean': {
    NA:   { NA: 2.00, Asia: 5.50, EU: 4.80 },
    Asia: { NA: 5.50, Asia: 2.50, EU: 6.00 },
    EU:   { NA: 4.80, Asia: 6.00, EU: 2.00 },
  },
  'Air': {
    NA:   { NA: 5.00, Asia: 12.00, EU: 10.00 },
    Asia: { NA: 12.00, Asia: 5.50, EU: 13.00 },
    EU:   { NA: 10.00, Asia: 13.00, EU: 5.00 },
  },
  'Train': {
    NA:   { NA: 1.50, Asia: 0, EU: 0 },
    Asia: { NA: 0, Asia: 2.00, EU: 4.50 },
    EU:   { NA: 0, Asia: 4.50, EU: 1.80 },
  },
};

// ─────────────────────────────────────────────
// Tariff Rate Table (% of FOB)
// Key: destinationCountry -> hsCodePrefix -> originCountry
// India's import tariffs on auto parts from various countries
// ─────────────────────────────────────────────
export const tariffRateTable = {
  'India': {
    // HS Chapter 87: Vehicles and parts
    '8701': { default: 15.0, US: 15.0, CN: 15.0, DE: 10.0, NL: 10.0, JP: 12.5, KR: 10.0 },
    '8702': { default: 25.0, US: 25.0, CN: 25.0, DE: 15.0, NL: 15.0, JP: 20.0, KR: 15.0 },
    '8703': { default: 12.5, US: 12.5, CN: 12.5, DE: 7.5, NL: 7.5, JP: 10.0, KR: 7.5 },
    '8704': { default: 10.0, US: 10.0, CN: 10.0, DE: 7.5, NL: 7.5, JP: 7.5, KR: 7.5 },
    '8705': { default: 15.0, US: 15.0, CN: 15.0, DE: 10.0, NL: 10.0, JP: 12.5, KR: 10.0 },
    '8706': { default: 10.0, US: 10.0, CN: 10.0, DE: 7.5, NL: 7.5, JP: 7.5, KR: 7.5 },
    '8707': { default: 15.0, US: 15.0, CN: 15.0, DE: 12.5, NL: 12.5, JP: 12.5, KR: 10.0 },
    '8708': { default: 15.0, US: 15.0, CN: 15.0, DE: 10.0, NL: 10.0, JP: 12.5, KR: 10.0 },
    '8709': { default: 7.5, US: 7.5, CN: 7.5, DE: 5.0, NL: 5.0, JP: 5.0, KR: 5.0 },
    // HS Chapter 40: Rubber and tires
    '4011': { default: 10.0, US: 10.0, CN: 15.0, DE: 10.0, NL: 10.0, JP: 10.0, KR: 10.0 },
    // HS Chapter 84: Nuclear reactors, boilers, machinery and mechanical appliances; parts thereof
    '8409': { default: 15.0, US: 15.0, CN: 15.0, DE: 7.5, NL: 7.5, JP: 10.0, KR: 7.5 },
    '8414': { default: 7.5, US: 7.5, CN: 10.0, DE: 7.5, NL: 7.5, JP: 7.5, KR: 7.5 },
    // HS Chapter 85: Electrical machinery and equipment; parts thereof
    '8507': { default: 15.0, US: 15.0, CN: 15.0, DE: 10.0, NL: 10.0, JP: 10.0, KR: 10.0 },
    '8512': { default: 15.0, US: 15.0, CN: 15.0, DE: 10.0, NL: 10.0, JP: 10.0, KR: 10.0 },
    // HS Chapter 90: Optical, photographic, measuring, checking, medical instruments; parts thereof
    '9018': { default: 7.5, US: 7.5, CN: 10.0, DE: 7.5, NL: 7.5, JP: 7.5, KR: 7.5 },
    // HS Chapter 22: Beverages (for HS 221193 from prototype)
    '2211': { default: 30.0, US: 30.0, CN: 30.0, DE: 25.0, NL: 25.0, JP: 28.0, KR: 25.0 },
    // General fallback
    'default': { default: 10.0, US: 10.0, CN: 10.0, DE: 7.5, NL: 7.5, JP: 7.5, KR: 7.5 },
  },
  'USA': {
    '8701': { default: 2.5, IN: 2.5, CN: 27.5, DE: 2.5, JP: 2.5 },
    '8708': { default: 2.5, IN: 2.5, CN: 27.5, DE: 2.5, JP: 2.5 },
    '4011': { default: 3.4, IN: 3.4, CN: 28.4, DE: 3.4, JP: 3.4 },
    '8409': { default: 2.5, IN: 2.5, CN: 27.5, DE: 2.5, JP: 2.5 },
    '8414': { default: 2.5, IN: 2.5, CN: 27.5, DE: 2.5, JP: 2.5 },
    '8507': { default: 3.4, IN: 3.4, CN: 28.4, DE: 3.4, JP: 3.4 },
    '8512': { default: 2.5, IN: 2.5, CN: 27.5, DE: 2.5, JP: 2.5 },
    '9018': { default: 1.5, IN: 1.5, CN: 26.5, DE: 1.5, JP: 1.5 },
    'default': { default: 3.0, IN: 3.0, CN: 25.0, DE: 2.5, JP: 2.5 },
  },
};

// Other duties (customs processing, cess, etc.) — % of FOB
export const otherDutiesTable = {
  'India': {
    socialWelfareSurcharge: 10, // 10% of BCD (basic customs duty)
    igst: 18,                  // 18% IGST on (CIF + BCD + SWS)
    compensationCess: 0,       // varies by product
    customsCess: 0,
    // We'll compute "other duties" as a simplified % of FOB
    // This is a simplification; in reality it's cascading
    effectiveOtherDutyPct: 3.0,
  },
  'USA': {
    merchandiseProcessingFee: 0.3464, // 0.3464% of value
    harborMaintenanceFee: 0.125,      // 0.125% of value
    effectiveOtherDutyPct: 0.5,
  },
  'default': {
    effectiveOtherDutyPct: 2.0,
  },
};

// ─────────────────────────────────────────────
// Lookup Functions
// ─────────────────────────────────────────────

export function getCountryByCode(code) {
  return countries.find(c => c.code === code);
}

export function getCountryByName(name) {
  // Handle combined names like "Germany/Netherlands"
  if (name.includes('/')) {
    const parts = name.split('/');
    return countries.find(c => parts.some(p => c.name.toLowerCase().startsWith(p.toLowerCase())));
  }
  return countries.find(c => c.name.toLowerCase() === name.toLowerCase());
}

export function getRegionForCountry(countryName) {
  const country = getCountryByName(countryName);
  return country ? country.region : 'Asia'; // default to Asia
}

export function getInsuranceCostPct(transportMode, originRegion, destRegion) {
  const modeMatrix = insuranceCostMatrix[transportMode];
  if (!modeMatrix) return 0.5; // default
  const fromRegion = modeMatrix[originRegion];
  if (!fromRegion) return 0.5;
  return fromRegion[destRegion] ?? 0.5;
}

export function getShippingCostPct(transportMode, originRegion, destRegion) {
  const modeMatrix = shippingCostMatrix[transportMode];
  if (!modeMatrix) return 3.0; // default
  const fromRegion = modeMatrix[originRegion];
  if (!fromRegion) return 3.0;
  return fromRegion[destRegion] ?? 3.0;
}

export function getTariffRate(destCountry, hsCode, originCountryCode) {
  const destTable = tariffRateTable[destCountry] || tariffRateTable['India'];
  // Try exact 4-digit prefix match
  const prefix = hsCode.substring(0, 4);
  const rateTable = destTable[prefix] || destTable['default'] || { default: 10.0 };
  return rateTable[originCountryCode] ?? rateTable['default'] ?? 10.0;
}

export function getOtherDutiesPct(destCountry) {
  const duties = otherDutiesTable[destCountry] || otherDutiesTable['default'];
  return duties.effectiveOtherDutyPct;
}
