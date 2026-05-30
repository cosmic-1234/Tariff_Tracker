// Exchange Rate Service
// Uses ExchangeRate-API with localStorage caching and manual fallback

const API_KEY = '95ef2d9d91cb825be6a26d14';
const BASE_URL = `https://v6.exchangerate-api.com/v6/${API_KEY}`;
const CACHE_KEY = 'tariff_tracker_exchange_rates';
const CACHE_TTL = 3600000; // 1 hour in ms

// Default fallback rates (manual)
const FALLBACK_RATES = {
  USD: 1.0,
  INR: 83.50,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.50,
  CNY: 7.24,
  KRW: 1325.0,
};

/**
 * Get cached exchange rates
 */
function getCachedRates() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const data = JSON.parse(cached);
    if (Date.now() - data.timestamp > CACHE_TTL) return null;
    return data.rates;
  } catch {
    return null;
  }
}

/**
 * Cache exchange rates
 */
function setCachedRates(rates) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      rates,
      timestamp: Date.now(),
    }));
  } catch {
    // localStorage might be full; ignore
  }
}

/**
 * Fetch live exchange rates from API
 */
export async function fetchExchangeRates(baseCurrency = 'USD') {
  // Try cache first
  const cached = getCachedRates();
  if (cached) {
    return { rates: cached, source: 'cache', timestamp: new Date().toISOString() };
  }

  try {
    const response = await fetch(`${BASE_URL}/latest/${baseCurrency}`);
    if (!response.ok) throw new Error(`API error: ${response.status}`);
    const data = await response.json();

    if (data.result === 'success') {
      const rates = data.conversion_rates;
      setCachedRates(rates);
      return { rates, source: 'api', timestamp: data.time_last_update_utc };
    }
    throw new Error(data['error-type'] || 'Unknown API error');
  } catch (error) {
    console.warn('Exchange rate API failed, using fallback rates:', error.message);
    return { rates: FALLBACK_RATES, source: 'fallback', timestamp: new Date().toISOString() };
  }
}

/**
 * Convert amount between currencies
 */
export async function convertCurrency(amount, fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return amount;

  const { rates, source } = await fetchExchangeRates('USD');

  // Convert through USD
  const amountInUSD = fromCurrency === 'USD' ? amount : amount / (rates[fromCurrency] || 1);
  const result = toCurrency === 'USD' ? amountInUSD : amountInUSD * (rates[toCurrency] || 1);

  return {
    amount: parseFloat(result.toFixed(2)),
    rate: rates[toCurrency] / (rates[fromCurrency] || 1),
    source,
  };
}

/**
 * Get a specific exchange rate
 */
export async function getExchangeRate(fromCurrency, toCurrency) {
  if (fromCurrency === toCurrency) return { rate: 1, source: 'identity' };
  const { rates, source } = await fetchExchangeRates('USD');
  const rate = (rates[toCurrency] || 1) / (rates[fromCurrency] || 1);
  return { rate: parseFloat(rate.toFixed(4)), source };
}

/**
 * Format currency amount
 */
export function formatCurrency(amount, currency = 'USD') {
  const formatters = {
    USD: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
    INR: new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }),
    EUR: new Intl.NumberFormat('en-DE', { style: 'currency', currency: 'EUR' }),
    JPY: new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }),
    CNY: new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }),
  };
  return (formatters[currency] || formatters.USD).format(amount);
}
