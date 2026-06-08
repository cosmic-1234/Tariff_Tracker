import { useState, useRef, useEffect } from 'react';
import { Sun, Moon, RefreshCw, ChevronDown, Menu, X, LayoutDashboard, Cpu, Wrench, Database } from 'lucide-react';
import { fetchExchangeRates } from '../services/exchangeRateService.js';

// ── Tech Mahindra SVG Logo ──────────────────────────────────────────────────
const TechMahindraLogo = ({ theme }) => (
  <svg width="150" height="36" viewBox="0 0 200 50" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Tech Mahindra">
    <title>Tech Mahindra</title>
    <g>
      <path
        d="M74.1701 15.9128H69.1051V25.6588H65.5673V15.9128H60.5022V12.9792H74.1701V15.9128ZM75.8703 25.6624V12.9792H87.8169V15.733H79.3904V17.89H87.302V20.4461H79.3904V22.9266H88.2261V25.6624H75.8738H75.8703ZM89.7252 19.5905C89.7252 18.0087 90.0285 16.7181 90.6317 15.7222C91.2348 14.7264 92.1342 13.9894 93.3229 13.5113C94.5151 13.0332 95.9789 12.7959 97.7213 12.7959C98.3033 12.7959 98.8218 12.8067 99.2839 12.8318C99.746 12.857 100.18 12.8966 100.582 12.9505C100.984 13.0044 101.379 13.0727 101.764 13.1482C102.148 13.2273 102.55 13.328 102.963 13.4466L102.25 16.0386C101.728 15.9307 101.227 15.8409 100.748 15.7762C100.268 15.7115 99.7953 15.6575 99.3333 15.6216C98.8712 15.5856 98.4092 15.5677 97.9471 15.5677C97.1394 15.5677 96.448 15.6431 95.866 15.7941C95.284 15.9451 94.8114 16.1788 94.4446 16.4916C94.0777 16.8043 93.8061 17.2142 93.6263 17.7139C93.4499 18.2136 93.3582 18.8175 93.3582 19.515C93.3582 20.1441 93.4428 20.6869 93.6157 21.1471C93.7885 21.6073 94.0566 21.9776 94.4234 22.2616C94.7902 22.5456 95.2523 22.7577 95.8096 22.8943C96.3669 23.0345 97.0371 23.1028 97.8166 23.1028C98.5961 23.1028 99.432 23.0525 100.279 22.9482C101.125 22.8475 101.929 22.7037 102.688 22.524L103.326 25.0405C102.924 25.1627 102.515 25.2706 102.099 25.3677C101.682 25.4647 101.238 25.5474 100.758 25.6121C100.279 25.6768 99.753 25.7343 99.1851 25.7739C98.6173 25.817 97.9824 25.8386 97.284 25.8386C96.053 25.8386 94.9631 25.72 94.0213 25.4863C93.0795 25.249 92.2894 24.8859 91.6475 24.3898C91.0091 23.8937 90.5258 23.2502 90.1978 22.4593C89.8733 21.6684 89.7075 20.7121 89.7075 19.5869L89.7252 19.5905ZM105.287 25.6624V12.9792H108.843V18.3969H115.685V12.9792H119.241V25.6624H115.685V21.352H108.843V25.6624H105.287Z"
        fill={theme === 'dark' ? '#e2e8f0' : '#4D4D4F'}
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M168.445 32.0328V49.2997H154.598C153.286 49.2997 152.21 48.2463 152.21 46.9557V40.4847C152.21 38.3673 153.973 36.6345 156.128 36.6345H164.019L162.869 39.0899H157.345C156.255 39.0899 155.278 39.9455 155.278 41.0635V46.3733C155.278 46.6502 155.557 46.8443 155.815 46.8443H165.377V32.0292H168.445V32.0328ZM122.856 40.4847C122.856 38.3673 121.093 36.6345 118.938 36.6345H112.412L111.262 39.0899H117.721C118.811 39.0899 119.788 39.9455 119.788 41.0635V49.2961H122.856V40.4811V40.4847ZM107.03 32.0328V49.2997H110.098V32.0328H107.03ZM60.5022 36.6381V49.2997H63.5709V39.5608C63.5709 39.284 63.8495 39.0899 64.107 39.0899H70.4454C70.7029 39.0899 70.9815 39.284 70.9815 39.5608V49.2997H74.0502V39.5608C74.0502 39.284 74.3289 39.0899 74.5864 39.0899H79.3904C80.4803 39.0899 81.4574 39.9455 81.4574 41.0635V49.2961H84.526V40.4811C84.526 38.3637 82.7624 36.6309 80.6073 36.6309H60.5057L60.5022 36.6381ZM175.902 41.0671C175.902 39.9455 176.883 39.0934 177.969 39.0934H183.295L184.445 36.6381H176.756C174.6 36.6381 172.837 38.3708 172.837 40.4883V49.3033H175.906V41.0707L175.902 41.0671ZM146.044 41.0743C146.044 39.9527 145.064 39.0934 143.977 39.0934H136.609V49.2997H133.54V36.6381H145.194C147.349 36.6381 149.113 38.3708 149.113 40.4883V49.3033H146.044V41.0779V41.0743ZM126.666 37.4361L129.734 35.6566V49.2997H126.666V37.4361ZM129.731 33.8771V32.0005H126.662V35.6566L129.731 33.8771ZM90.159 46.3769C90.159 46.6538 90.4377 46.8479 90.6951 46.8479H100.748V41.0707C100.748 39.9491 99.7671 39.097 98.6807 39.097H89.2525L90.4024 36.6416H99.8976C102.053 36.6416 103.816 38.3744 103.816 40.4919V49.3069H89.6158C88.3037 49.3069 87.2314 48.2535 87.2314 46.9629V43.9C87.2314 42.7028 88.2296 41.7214 89.45 41.7214H97.3263L96.4903 43.5045H90.6951C90.4377 43.5045 90.159 43.6987 90.159 43.9755V46.3841V46.3769ZM186.343 46.3769C186.343 46.6538 186.621 46.8479 186.879 46.8479H196.931V41.0707C196.931 39.9491 195.951 39.097 194.864 39.097H185.436L186.586 36.6416H196.081C198.236 36.6416 200 38.3744 200 40.4919V49.3069H185.799C184.487 49.3069 183.415 48.2535 183.415 46.9629V43.9C183.415 42.7028 184.413 41.7214 185.634 41.7214H193.51L192.674 43.5045H186.879C186.621 43.5045 186.343 43.6987 186.343 43.9755V46.3841V46.3769Z"
        fill="#E31837"
      />
    </g>
    <path d="M0 18.1239V49.2998L48.0759 31.4757V0.299805L0 18.1239Z" fill="#E31837" />
  </svg>
);

// ── Sidebar Config with Icons ────────────────────────────────────────────────
const navConfig = [
  { id: 'dashboard', label: 'Dashboard', type: 'link', icon: <LayoutDashboard size={17} /> },
  {
    id: 'tools',
    label: 'Tools',
    type: 'mega',
    icon: <Wrench size={17} />,
    items: [
      { id: 'calculator',  label: 'Tariff Impact Calculator' },
      { id: 'scoring',     label: 'Inventory Analysis' },
      { id: 'riskengine',  label: 'Risk Factor Analysis' },
      { id: 'procurement', label: 'Autonomous Procurement' },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    type: 'mega',
    icon: <Database size={17} />,
    items: [
      { id: 'products',   label: 'Product Master' },
      { id: 'masterdata', label: 'Supplier Master' },
    ],
  },
];

export default function Navbar({
  currentPage, onNavigate,
  currency, onCurrencyChange,
  exchangeRates, rateSource,
  theme, onToggleTheme,
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openSections, setOpenSections] = useState({ tools: true, data: true });
  const [refreshing, setRefreshing] = useState(false);
  const navRef = useRef(null);

  const usdToInr = exchangeRates?.INR ? exchangeRates.INR.toFixed(2) : '—';

  // Close mobile sidebar on navigate or outside click
  useEffect(() => {
    const handler = (e) => {
      if (mobileOpen && navRef.current && !navRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [mobileOpen]);

  const handleRefreshRates = async () => {
    setRefreshing(true);
    localStorage.removeItem('tariff_tracker_exchange_rates');
    await fetchExchangeRates('USD');
    setRefreshing(false);
    window.location.reload();
  };

  const handleNavigate = (id) => {
    onNavigate(id);
    setMobileOpen(false);
  };

  const toggleSection = (id) => {
    setOpenSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderSidebarContent = () => (
    <div className="tm-sidebar-inner">
      {/* Logo Area */}
      <div className="tm-sidebar-logo">
        <button onClick={() => handleNavigate('dashboard')} aria-label="Home">
          <TechMahindraLogo theme={theme} />
        </button>
      </div>

      {/* Navigation Links */}
      <div className="tm-sidebar-links">
        {navConfig.map((item) => {
          if (item.type === 'link') {
            return (
              <button
                key={item.id}
                className={`tm-sidebar-link ${currentPage === item.id ? 'active' : ''}`}
                onClick={() => handleNavigate(item.id)}
              >
                <span className="tm-sidebar-link-content">
                  {item.icon}
                  {item.label}
                </span>
              </button>
            );
          }

          const hasActive = item.items?.some(sub => sub.id === currentPage);
          const isExpanded = openSections[item.id];

          return (
            <div key={item.id} style={{ display: 'flex', flexDirection: 'column' }}>
              <button
                className={`tm-sidebar-link ${hasActive ? 'active' : ''}`}
                onClick={() => toggleSection(item.id)}
                style={{ active: hasActive ? '1' : '0' }}
              >
                <span className="tm-sidebar-link-content">
                  {item.icon}
                  {item.label}
                </span>
                <ChevronDown
                  size={14}
                  style={{
                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                    transition: 'transform 0.2s ease',
                    opacity: 0.8
                  }}
                />
              </button>

              {isExpanded && (
                <div className="tm-sidebar-submenu">
                  {item.items.map((sub) => (
                    <button
                      key={sub.id}
                      className={`tm-sidebar-sublink ${currentPage === sub.id ? 'active' : ''}`}
                      onClick={() => handleNavigate(sub.id)}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sidebar Controls Footer */}
      <div className="tm-sidebar-controls">
        {/* Exchange Rate */}
        <div className="tm-sidebar-exchange-badge">
          <span>1 USD = ₹{usdToInr}</span>
          <button onClick={handleRefreshRates} title="Refresh rates" aria-label="Refresh rates">
            <RefreshCw size={11} className={refreshing ? 'tm-spin' : ''} />
          </button>
        </div>

        {/* Currency Selector */}
        <div className="tm-sidebar-currency-toggle" role="group" aria-label="Currency">
          {['USD', 'INR', 'EUR'].map(c => (
            <button
              key={c}
              className={`tm-sidebar-currency-btn ${currency === c ? 'active' : ''}`}
              onClick={() => onCurrencyChange(c)}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Theme Toggle */}
        <button
          className="tm-sidebar-theme-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile Header Bar ── */}
      <div className="tm-mobile-header">
        <div className="tm-mobile-header-logo">
          <button onClick={() => handleNavigate('dashboard')} aria-label="Home">
            <TechMahindraLogo theme={theme} />
          </button>
        </div>
        <button
          className="tm-mobile-hamburger"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Drawer Overlay Backdrop */}
      <div
        className={`tm-sidebar-overlay ${mobileOpen ? 'mobile-open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* ── Left Sidebar navigation ── */}
      <aside
        className={`tm-sidebar ${mobileOpen ? 'mobile-open' : ''}`}
        ref={navRef}
        role="complementary"
        aria-label="Sidebar navigation"
      >
        {renderSidebarContent()}
      </aside>
    </>
  );
}
