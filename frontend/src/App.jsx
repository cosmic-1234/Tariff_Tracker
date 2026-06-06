import { useState, useEffect, useCallback } from 'react';
import Navbar from './components/Navbar.jsx';
import Dashboard from './components/Dashboard.jsx';
import TariffCalculator from './components/TariffCalculator.jsx';
import CriticalityScoring from './components/CriticalityScoring.jsx';
import InventoryClassification from './components/InventoryClassification.jsx';
import RiskEngine from './components/RiskEngine.jsx';
import ProductMaster from './components/ProductMaster.jsx';
import MasterDataView from './components/MasterDataView.jsx';
import AutonomousProcurement from './components/AutonomousProcurement.jsx';
import { fetchExchangeRates } from './services/exchangeRateService.js';
import { fetchLiveCountries } from './services/countryService.js';
import { countries } from './data/masterData.js';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [currency, setCurrency]       = useState('USD');
  const [exchangeRates, setExchangeRates] = useState(null);
  const [rateSource, setRateSource]   = useState('');
  const [theme, setTheme]             = useState(
    () => localStorage.getItem('tariff_tracker_theme') || 'dark'
  );
  const [countriesList, setCountriesList] = useState(countries);
  const [selectedProductForCalc, setSelectedProductForCalc] = useState(null);

  // Sync theme to root element
  useEffect(() => {
    localStorage.setItem('tariff_tracker_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [theme]);

  // Fetch exchange rates and countries on mount
  useEffect(() => {
    const loadRates = async () => {
      const result = await fetchExchangeRates('USD');
      setExchangeRates(result.rates);
      setRateSource(result.source);
    };
    const loadCountries = async () => {
      const result = await fetchLiveCountries();
      if (result && result.countries) {
        countries.length = 0;
        countries.push(...result.countries);
        setCountriesList([...result.countries]);
      }
    };
    loadRates();
    loadCountries();
  }, []);

  const convertAmount = useCallback((amount, fromCurrency = 'USD') => {
    if (!exchangeRates || currency === fromCurrency) return amount;
    const usdAmount = fromCurrency === 'USD' ? amount : amount / (exchangeRates[fromCurrency] || 1);
    return currency === 'USD' ? usdAmount : usdAmount * (exchangeRates[currency] || 1);
  }, [exchangeRates, currency]);

  const pageTitle = {
    dashboard:    'Dashboard',
    procurement:  'Autonomous Procurement Optimizer',
    calculator:   'Tariff Calculator',
    scoring:      'SDE-VED Criticality Scoring Tool',
    classification: 'Inventory Risk Analysis (SDE/VED)',
    riskengine:   'Risk Engine',
    products:     'Product Master',
    masterdata:   'Master Data',
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} currency={currency} convertAmount={convertAmount} />;
      case 'procurement':
        return <AutonomousProcurement currency={currency} convertAmount={convertAmount} />;
      case 'calculator':
        return (
          <TariffCalculator
            currency={currency}
            convertAmount={convertAmount}
            preselectedProduct={selectedProductForCalc}
            clearPreselectedProduct={() => setSelectedProductForCalc(null)}
          />
        );
      case 'scoring':
        return <CriticalityScoring currency={currency} convertAmount={convertAmount} />;
      case 'classification':
        return <InventoryClassification currency={currency} convertAmount={convertAmount} />;
      case 'riskengine':
        return <RiskEngine currency={currency} convertAmount={convertAmount} />;
      case 'products':
        return (
          <ProductMaster
            onNavigate={setCurrentPage}
            setSelectedProductForCalc={setSelectedProductForCalc}
            currency={currency}
            convertAmount={convertAmount}
          />
        );
      case 'masterdata':
        return <MasterDataView />;
      default:
        return <Dashboard onNavigate={setCurrentPage} currency={currency} convertAmount={convertAmount} />;
    }
  };

  return (
    <div className={`tm-app-layout ${theme}`}>
      <Navbar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        currency={currency}
        onCurrencyChange={setCurrency}
        exchangeRates={exchangeRates}
        rateSource={rateSource}
        theme={theme}
        onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />
      <main className="tm-main-content" id="main-content" tabIndex={-1}>
        {/* Page Title Bar */}
        <div className="tm-page-titlebar">
          <div className="tm-page-titlebar-inner">
            <h1 className="tm-page-title">{pageTitle[currentPage] || 'Dashboard'}</h1>
            <div className="tm-breadcrumb">
              <span>Tariff Tracker</span>
              <span className="tm-breadcrumb-sep">›</span>
              <span className="tm-breadcrumb-current">{pageTitle[currentPage] || 'Dashboard'}</span>
            </div>
          </div>
        </div>
        <div className="tm-page-wrapper">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default App;
