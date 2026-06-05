import { LayoutDashboard, Calculator, Package, Database, ChevronLeft, ChevronRight, ShieldAlert, Activity } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, section: 'Overview' },
  { id: 'calculator', label: 'Tariff Calculator', icon: Calculator, section: 'Tools' },
  { id: 'scoring', label: 'Criticality Scoring', icon: ShieldAlert, section: 'Tools' },
  { id: 'riskengine', label: 'Risk Engine', icon: Activity, section: 'Tools' },
  { id: 'products', label: 'Product Master', icon: Package, section: 'Data' },
  { id: 'masterdata', label: 'Master Data', icon: Database, section: 'Data' },
];

export default function Sidebar({ currentPage, onNavigate, collapsed, onToggleCollapse }) {
  const sections = {};
  navItems.forEach(item => {
    if (!sections[item.section]) sections[item.section] = [];
    sections[item.section].push(item);
  });

  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`} role="navigation" aria-label="Main navigation">
      <div className="sidebar-header">
        <div className="sidebar-logo">TT</div>
        {!collapsed && (
          <div>
            <div className="sidebar-title">Tariff Tracker</div>
            <div className="sidebar-subtitle">Import Cost Intelligence</div>
          </div>
        )}
      </div>

      <div className="sidebar-nav">
        {Object.entries(sections).map(([sectionName, items]) => (
          <div key={sectionName}>
            {!collapsed && <div className="sidebar-section-label">{sectionName}</div>}
            {items.map(item => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className={`sidebar-nav-item ${currentPage === item.id ? 'active' : ''}`}
                  onClick={() => onNavigate(item.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && onNavigate(item.id)}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="sidebar-nav-icon" size={20} />
                  {!collapsed && <span>{item.label}</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="sidebar-collapse-btn" onClick={onToggleCollapse} role="button" tabIndex={0}>
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </div>
    </nav>
  );
}
