import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import Dashboard from './components/Dashboard.jsx';
import TariffCalculator from './components/TariffCalculator.jsx';
import CriticalityScoring from './components/CriticalityScoring.jsx';
import InventoryClassification from './components/InventoryClassification.jsx';
import ProductMaster from './components/ProductMaster.jsx';
import MasterDataView from './components/MasterDataView.jsx';
import { fetchExchangeRates } from './services/exchangeRateService.js';

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [exchangeRates, setExchangeRates] = useState(null);
  const [rateSource, setRateSource] = useState('');
  const [theme, setTheme] = useState(() => localStorage.getItem('tariff_tracker_theme') || 'dark');

  // Sync theme to root element
  useEffect(() => {
    localStorage.setItem('tariff_tracker_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [theme]);

  // Fetch exchange rates on mount
  useEffect(() => {
    const loadRates = async () => {
      const result = await fetchExchangeRates('USD');
      setExchangeRates(result.rates);
      setRateSource(result.source);
    };
    loadRates();
  }, []);

  const convertAmount = useCallback((amount, fromCurrency = 'USD') => {
    if (!exchangeRates || currency === fromCurrency) return amount;
    const usdAmount = fromCurrency === 'USD' ? amount : amount / (exchangeRates[fromCurrency] || 1);
    return currency === 'USD' ? usdAmount : usdAmount * (exchangeRates[currency] || 1);
  }, [exchangeRates, currency]);

  const pageTitle = {
    dashboard: 'Dashboard',
    calculator: 'Tariff Calculator',
    scoring: 'SDE-VED Criticality Scoring Tool',
    classification: 'Inventory Risk Analysis (SDE/VED)',
    products: 'Product Master',
    masterdata: 'Master Data',
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} currency={currency} convertAmount={convertAmount} />;
      case 'calculator':
        return <TariffCalculator currency={currency} convertAmount={convertAmount} />;
      case 'scoring':
        return <CriticalityScoring currency={currency} convertAmount={convertAmount} />;
      case 'classification':
        return <InventoryClassification currency={currency} convertAmount={convertAmount} />;
      case 'products':
        return <ProductMaster onNavigate={setCurrentPage} currency={currency} convertAmount={convertAmount} />;
      case 'masterdata':
        return <MasterDataView />;
      default:
        return <Dashboard onNavigate={setCurrentPage} currency={currency} convertAmount={convertAmount} />;
    }
  };

  return (
    <div className="app-layout">
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <div className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Header
          title={pageTitle[currentPage] || 'Dashboard'}
          sidebarCollapsed={sidebarCollapsed}
          currency={currency}
          onCurrencyChange={setCurrency}
          exchangeRates={exchangeRates}
          rateSource={rateSource}
          theme={theme}
          onToggleTheme={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
        />
        <div className="page-wrapper">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

export default App;
