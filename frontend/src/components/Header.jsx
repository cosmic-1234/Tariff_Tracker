import { RefreshCw, Sun, Moon } from 'lucide-react';
import { useState } from 'react';
import { fetchExchangeRates } from '../services/exchangeRateService.js';

export default function Header({ title, sidebarCollapsed, currency, onCurrencyChange, exchangeRates, rateSource, theme, onToggleTheme }) {
  const [refreshing, setRefreshing] = useState(false);

  const handleRefreshRates = async () => {
    setRefreshing(true);
    // Clear cache to force fresh fetch
    localStorage.removeItem('tariff_tracker_exchange_rates');
    await fetchExchangeRates('USD');
    setRefreshing(false);
    window.location.reload();
  };

  const usdToInr = exchangeRates?.INR ? exchangeRates.INR.toFixed(2) : '—';

  return (
    <header className={`header ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="header-left">
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-right">
        {/* Exchange Rate Display */}
        <div className="exchange-rate-badge">
          <span>1 USD =</span>
          <span className="rate-value">₹{usdToInr}</span>
          <span className="rate-source">{rateSource}</span>
          <button
            className="btn-ghost"
            onClick={handleRefreshRates}
            title="Refresh exchange rates"
            style={{ padding: '2px', marginLeft: '2px' }}
          >
            <RefreshCw size={12} className={refreshing ? 'animate-pulse' : ''} />
          </button>
        </div>

        {/* Currency Toggle */}
        <div className="currency-toggle">
          {['USD', 'INR', 'EUR'].map(c => (
            <button
              key={c}
              className={`currency-btn ${currency === c ? 'active' : ''}`}
              onClick={() => onCurrencyChange(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Theme Toggle */}
        <button
          className="theme-toggle-btn currency-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '6px', 
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            border: '1px solid var(--border-medium)',
            background: 'var(--bg-glass)',
            color: 'var(--text-primary)',
            marginLeft: '8px',
            width: '32px',
            height: '32px'
          }}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>
    </header>
  );
}
