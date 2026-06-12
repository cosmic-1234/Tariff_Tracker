// Country Service
// Fetches live real-time country data (regions, flags, names, currencies) from REST Countries API
// Incorporates localStorage caching with a 24-hour TTL and graceful fallbacks

const API_BASE = import.meta.env.VITE_API_BASE || `http://${window.location.hostname}:5000/api`;
const API_URL = `${API_BASE}/external/countries`;
const CACHE_KEY = 'tariff_tracker_country_data';
const CACHE_TTL = 86400000; // 24 hours in ms

// Official Fallback Data (matching masterData.js exactly)
const FALLBACK_COUNTRIES = [
  { name: 'USA', region: 'NA', code: 'US', flag: '🇺🇸', currency: 'USD' },
  { name: 'India', region: 'Asia', code: 'IN', flag: '🇮🇳', currency: 'INR' },
  { name: 'China', region: 'Asia', code: 'CN', flag: '🇨🇳', currency: 'CNY' },
  { name: 'Japan', region: 'Asia', code: 'JP', flag: '🇯🇵', currency: 'JPY' },
  { name: 'Germany', region: 'EU', code: 'DE', flag: '🇩🇪', currency: 'EUR' },
  { name: 'Netherlands', region: 'EU', code: 'NL', flag: '🇳🇱', currency: 'EUR' },
  { name: 'South Korea', region: 'Asia', code: 'KR', flag: '🇰🇷', currency: 'KRW' },
  { name: 'Taiwan', region: 'Asia', code: 'TW', flag: '🇹🇼', currency: 'TWD' },
  { name: 'United Kingdom', region: 'EU', code: 'GB', flag: '🇬🇧', currency: 'GBP' },
  { name: 'France', region: 'EU', code: 'FR', flag: '🇫🇷', currency: 'EUR' },
  { name: 'Italy', region: 'EU', code: 'IT', flag: '🇮🇹', currency: 'EUR' },
  { name: 'Mexico', region: 'NA', code: 'MX', flag: '🇲🇽', currency: 'MXN' },
  { name: 'Canada', region: 'NA', code: 'CA', flag: '🇨🇦', currency: 'CAD' },
  { name: 'Brazil', region: 'NA', code: 'BR', flag: '🇧🇷', currency: 'BRL' },
  { name: 'Thailand', region: 'Asia', code: 'TH', flag: '🇹🇭', currency: 'THB' },
];

/**
 * Maps REST Countries region to one of our three target matrices regions: NA, Asia, EU
 */
function mapRegion(restCountry) {
  const name = restCountry.name?.common || '';
  const restRegion = restCountry.region || '';
  
  // Explicit country overrides for matrices mapping
  if (['United States', 'USA', 'Canada', 'Mexico', 'Brazil', 'Argentina', 'Chile'].includes(name) || restCountry.cca2 === 'US' || restCountry.cca2 === 'CA' || restCountry.cca2 === 'MX' || restCountry.cca2 === 'BR') {
    return 'NA';
  }
  
  if (restRegion === 'Europe') {
    return 'EU';
  }
  
  if (restRegion === 'Americas') {
    return 'NA';
  }
  
  return 'Asia'; // default region
}

/**
 * Get cached country data
 */
function getCachedCountries() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_TTL) return null;
    return data.countries;
  } catch {
    return null;
  }
}

/**
 * Cache country data
 */
function setCachedCountries(countries) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      countries,
      timestamp: Date.now(),
    }));
  } catch {
    // localStorage might be full; ignore
  }
}

/**
 * Fetch live countries from REST Countries API
 */
export async function fetchLiveCountries() {
  // Try cache first
  const cached = getCachedCountries();
  if (cached && cached.length > 0) {
    return { countries: cached, source: 'cache' };
  }

  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();

    if (Array.isArray(data)) {
      // Map to internal schema
      const mapped = data.map(item => {
        const currencies = item.currencies ? Object.keys(item.currencies) : [];
        return {
          name: item.name?.common || item.name?.official || '',
          code: item.cca2 || '',
          region: mapRegion(item),
          flag: item.flag || '🏳️',
          currency: currencies[0] || 'USD'
        };
      }).filter(c => c.name && c.code);

      // Sort alphabetically by name
      mapped.sort((a, b) => a.name.localeCompare(b.name));

      setCachedCountries(mapped);
      return { countries: mapped, source: 'api' };
    }
    throw new Error('Invalid REST Countries API payload');
  } catch (error) {
    console.warn('REST Countries API failed, using fallback database:', error.message);
    return { countries: FALLBACK_COUNTRIES, source: 'fallback' };
  }
}
