const express = require('express');
const router = express.Router();
const externalApiController = require('../controllers/externalApiController');

// Trade Tariff API routes
router.get('/trade-tariff/headings/:id', externalApiController.getTradeTariffHeading);
router.get('/trade-tariff/chapters/:id', externalApiController.getTradeTariffChapter);

// Countries API route
router.get('/countries', externalApiController.getCountries);

// Exchange Rates API route
router.get('/exchange-rates/latest/:baseCurrency', externalApiController.getExchangeRates);

module.exports = router;
