// External API Controller
// Proxies external third-party API requests from the backend instead of the frontend.

const EXCHANGE_RATE_API_KEY = process.env.EXCHANGE_RATE_API_KEY || '95ef2d9d91cb825be6a26d14';

/**
 * Proxy Trade Tariff Headings Endpoint
 * @route GET /api/external/trade-tariff/headings/:id
 */
const getTradeTariffHeading = async (req, res, next) => {
  try {
    const { id } = req.params;
    const response = await fetch(`https://trade-tariff.service.gov.uk/api/v2/headings/${id}`, {
      headers: { 'Accept': 'application/vnd.uktt.v2' }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `Trade Tariff API error: ${response.statusText}`
      });
    }
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * Proxy Trade Tariff Chapters Endpoint
 * @route GET /api/external/trade-tariff/chapters/:id
 */
const getTradeTariffChapter = async (req, res, next) => {
  try {
    const { id } = req.params;
    const response = await fetch(`https://trade-tariff.service.gov.uk/api/v2/chapters/${id}`, {
      headers: { 'Accept': 'application/vnd.uktt.v2' }
    });
    
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `Trade Tariff API error: ${response.statusText}`
      });
    }
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * Proxy REST Countries Endpoint
 * @route GET /api/external/countries
 */
const getCountries = async (req, res, next) => {
  try {
    const response = await fetch('https://restcountries.com/v3.1/all');
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `REST Countries API error: ${response.statusText}`
      });
    }
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

/**
 * Proxy Exchange Rates Endpoint
 * @route GET /api/external/exchange-rates/latest/:baseCurrency
 */
const getExchangeRates = async (req, res, next) => {
  try {
    const { baseCurrency } = req.params;
    const response = await fetch(`https://v6.exchangerate-api.com/v6/${EXCHANGE_RATE_API_KEY}/latest/${baseCurrency}`);
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        message: `Exchange Rate API error: ${response.statusText}`
      });
    }
    
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getTradeTariffHeading,
  getTradeTariffChapter,
  getCountries,
  getExchangeRates
};
