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
import { fetchProducts, fetchSuppliers } from './services/dataService.js';
import { productMaster } from './data/productMaster.js';
import { supplierMaster } from './data/supplierMaster.js';

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

  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState(null);

  // Sync theme to root element
  useEffect(() => {
    localStorage.setItem('tariff_tracker_theme', theme);
    if (theme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  }, [theme]);

  // Fetch exchange rates, countries, and MongoDB data on mount
  useEffect(() => {
    const loadRates = async () => {
      try {
        const result = await fetchExchangeRates('USD');
        setExchangeRates(result.rates);
        setRateSource(result.source);
      } catch (err) {
        console.error('Failed to load exchange rates:', err);
      }
    };
    const loadCountries = async () => {
      try {
        const result = await fetchLiveCountries();
        if (result && result.countries) {
          countries.length = 0;
          countries.push(...result.countries);
          setCountriesList([...result.countries]);
        }
      } catch (err) {
        console.error('Failed to load countries:', err);
      }
    };
    const loadMainData = async () => {
      try {
        const fetchedProducts = await fetchProducts();
        const fetchedSuppliers = await fetchSuppliers();
        
        // Mutate local static arrays for lookup functions compatibility
        productMaster.length = 0;
        productMaster.push(...fetchedProducts);
        
        supplierMaster.length = 0;
        supplierMaster.push(...fetchedSuppliers);
        
        setProducts(fetchedProducts);
        setSuppliers(fetchedSuppliers);
        
        if (fetchedProducts.length > 0 && !selectedProductForCalc) {
          setSelectedProductForCalc(fetchedProducts[0]);
        }
      } catch (err) {
        console.error('Failed to load products/suppliers from MongoDB Atlas:', err);
        setLoadError(err.message);
      } finally {
        setLoadingData(false);
      }
    };
    loadRates();
    loadCountries();
    loadMainData();
  }, []);

  const convertAmount = useCallback((amount, fromCurrency = 'USD') => {
    if (!exchangeRates || currency === fromCurrency) return amount;
    const usdAmount = fromCurrency === 'USD' ? amount : amount / (exchangeRates[fromCurrency] || 1);
    return currency === 'USD' ? usdAmount : usdAmount * (exchangeRates[currency] || 1);
  }, [exchangeRates, currency]);

  const pageTitle = {
    dashboard:    'Dashboard',
    procurement:  'Autonomous Procurement Optimizer',
    calculator:   'Tariff Impact Calculator',
    scoring:      'Inventory Analysis',
    classification: 'Inventory Risk Analysis (SDE/VED)',
    riskengine:   'Risk Factor Analysis',
    products:     'Product Master',
    masterdata:   'Supplier Master',
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard onNavigate={setCurrentPage} currency={currency} convertAmount={convertAmount} products={products} suppliers={suppliers} />;
      case 'procurement':
        return <AutonomousProcurement currency={currency} convertAmount={convertAmount} products={products} suppliers={suppliers} />;
      case 'calculator':
        return (
          <TariffCalculator
            currency={currency}
            convertAmount={convertAmount}
            preselectedProduct={selectedProductForCalc}
            clearPreselectedProduct={() => setSelectedProductForCalc(null)}
            products={products}
            suppliers={suppliers}
          />
        );
      case 'scoring':
        return <CriticalityScoring currency={currency} convertAmount={convertAmount} products={products} suppliers={suppliers} />;
      case 'classification':
        return <InventoryClassification currency={currency} convertAmount={convertAmount} products={products} suppliers={suppliers} />;
      case 'riskengine':
        return <RiskEngine currency={currency} convertAmount={convertAmount} products={products} suppliers={suppliers} />;
      case 'products':
        return (
          <ProductMaster
            onNavigate={setCurrentPage}
            setSelectedProductForCalc={setSelectedProductForCalc}
            currency={currency}
            convertAmount={convertAmount}
            products={products}
            suppliers={suppliers}
          />
        );
      case 'masterdata':
        return <MasterDataView suppliers={suppliers} />;
      default:
        return <Dashboard onNavigate={setCurrentPage} currency={currency} convertAmount={convertAmount} products={products} suppliers={suppliers} />;
    }
  };

  if (loadError) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: theme === 'light' ? '#f8fafc' : '#0a0e17',
        color: theme === 'light' ? '#0f172a' : '#f1f5f9',
        fontFamily: 'Inter, sans-serif',
        padding: '20px',
        textAlign: 'center'
      }}>
        <div style={{ color: '#ef4444', fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
        <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>Database Connection Failed</div>
        <p style={{ fontSize: '14px', color: theme === 'light' ? '#475569' : '#94a3b8', maxWidth: '450px', margin: '0 0 20px', lineHeight: 1.5 }}>
          Could not retrieve data from MongoDB Atlas. Please check that your <strong>MONGO_URI</strong> is correctly configured in <code>backend/.env</code> and that your MERN backend server is running on port 5000.
        </p>
        <button 
          className="btn btn-primary"
          onClick={() => window.location.reload()}
          style={{ padding: '8px 16px', background: 'var(--tm-red, #e11d48)', border: 'none', borderRadius: '4px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: theme === 'light' ? '#f8fafc' : '#0a0e17',
        color: theme === 'light' ? '#0f172a' : '#f1f5f9',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div className="animate-spin" style={{
          width: '40px',
          height: '40px',
          border: '4px solid #1e293b',
          borderTop: '4px solid var(--tm-red, #e11d48)',
          borderRadius: '50%',
          marginBottom: '16px'
        }} />
        <div style={{ fontSize: '16px', fontWeight: 600 }}>📡 Connecting to MongoDB Atlas...</div>
        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
          Fetching inventory and supplier master records from database
        </div>
      </div>
    );
  }

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
