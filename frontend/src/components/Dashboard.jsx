
import { Package, AlertTriangle, TrendingUp, Globe, ArrowRight, ShieldAlert, Truck, BarChart3, Calculator } from 'lucide-react';
import { formatCurrency } from '../services/exchangeRateService.js';

export default function Dashboard({ onNavigate, currency, convertAmount, products = [], suppliers = [], riskSummary = null }) {

  // Local helper for suppliers
  const getLocalSuppliers = (erpCode) => suppliers.filter(s => s.productErpCode === erpCode);

  const getInventoryCriticality = (daysOfCoverage) => {
    if (daysOfCoverage <= 15) return 'Critical';
    if (daysOfCoverage <= 30) return 'Medium';
    return 'Low';
  };

  // Calculate dashboard KPIs
  const totalProducts = products.length;
  const totalSuppliers = [...new Set(suppliers.map(s => s.supplierId))].length;
  const totalCountries = [...new Set(suppliers.map(s => s.country))].length;

  const criticalProducts = products.filter(p => getInventoryCriticality(p.daysOfCoverage) === 'Critical');

  const totalInventoryValue = products.reduce((sum, p) => sum + p.inventoryValue, 0);
  const avgDaysOfCoverage = riskSummary ? riskSummary.avgDaysOfCoverage : 0;


  // Top products by inventory value
  const topProducts = [...products].sort((a, b) => b.inventoryValue - a.inventoryValue).slice(0, 5);

  // Risk products (critical inventory)
  const riskProducts = [...products]
    .filter(p => p.daysOfCoverage <= 20)
    .sort((a, b) => a.daysOfCoverage - b.daysOfCoverage);

  return (
    <div className="animate-fade-in">
      {/* KPI Cards */}
      <div className="kpi-grid stagger-children">
        <div className="kpi-card">
          <div className="kpi-icon blue">
            <Package size={20} />
          </div>
          <div className="kpi-label">Total Products Tracked</div>
          <div className="kpi-value">{totalProducts}</div>
          <div className="kpi-change neutral">{products.filter(p => p.category === 'Mechanical').length} Mechanical · {products.filter(p => p.category === 'Electrical').length} Electrical</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple">
            <Truck size={20} />
          </div>
          <div className="kpi-label">Active Suppliers</div>
          <div className="kpi-value">{totalSuppliers}</div>
          <div className="kpi-change neutral">Across {totalCountries} countries</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green">
            <TrendingUp size={20} />
          </div>
          <div className="kpi-label">Total Inventory Value</div>
          <div className="kpi-value small">{formatCurrency(convertAmount(totalInventoryValue), currency)}</div>
          <div className="kpi-change positive">Avg {avgDaysOfCoverage} days coverage</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon orange">
            <AlertTriangle size={20} />
          </div>
          <div className="kpi-label">Critical Inventory Items</div>
          <div className="kpi-value">{criticalProducts.length}</div>
          <div className="kpi-change negative">{criticalProducts.length > 0 ? 'Requires immediate action' : 'All healthy'}</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon red">
            <ShieldAlert size={20} />
          </div>
          <div className="kpi-label">Tariff Risk Exposure</div>
          <div className="kpi-value small">{products.filter(p => p.daysOfCoverage <= 30).length} / {totalProducts}</div>
          <div className="kpi-change warning">Products with ≤30 day coverage</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon blue">
            <Globe size={20} />
          </div>
          <div className="kpi-label">Trade Corridors Active</div>
          <div className="kpi-value">4</div>
          <div className="kpi-change neutral">Asia-NA · Asia-EU · Trans-Atlantic · Pacific</div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid-2 mt-6">
        {/* Inventory Risk Table */}
        <div className="glass-card">
          <div className="card-title">
            <AlertTriangle size={18} className="icon" />
            Inventory Risk Alert
          </div>
          <div className="data-table-container" style={{ maxHeight: '360px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Days</th>
                  <th>In-Hand</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {riskProducts.map(p => {
                  const criticality = getInventoryCriticality(p.daysOfCoverage);
                  return (
                    <tr key={p.erpCode} className="clickable" onClick={() => onNavigate('calculator')}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.description}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.erpCode} · HS {p.hsCode}</div>
                      </td>
                      <td><span className="badge neutral">{p.category}</span></td>
                      <td style={{ fontWeight: 700, color: criticality === 'Critical' ? 'var(--danger)' : 'var(--warning)' }}>
                        {p.daysOfCoverage}d
                      </td>
                      <td>{p.inHandInventory}</td>
                      <td>
                        <span className={`badge ${criticality === 'Critical' ? 'critical' : 'warning'}`}>
                          {criticality}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products by Value */}
        <div className="glass-card">
          <div className="card-title">
            <BarChart3 size={18} className="icon" />
            Top Products by Inventory Value
          </div>
          <div className="data-table-container" style={{ maxHeight: '360px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Value</th>
                  <th>Suppliers</th>
                  <th>Review</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map(p => {
                  const productSuppliers = getLocalSuppliers(p.erpCode);
                  return (
                    <tr key={p.erpCode} className="clickable" onClick={() => onNavigate('calculator')}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.description}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>HS {p.hsCode}</div>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--success)' }}>
                        {formatCurrency(convertAmount(p.inventoryValue), currency)}
                      </td>
                      <td>{productSuppliers.length} suppliers</td>
                      <td><span className="badge info">{p.reviewType}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="glass-card mt-6">
        <div className="card-title">
          <ArrowRight size={18} className="icon" />
          Quick Actions
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={() => onNavigate('calculator')}>
            <Calculator size={16} /> Open Tariff Impact Calculator
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('products')}>
            <Package size={16} /> View Product Master
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('masterdata')}>
            <Globe size={16} /> View Supplier Master & Matrices
          </button>
        </div>
      </div>

      {/* Supplier Distribution */}
      <div className="glass-card mt-6">
        <div className="card-title">
          <Globe size={18} className="icon" />
          Supplier Country Distribution
        </div>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          {(() => {
            const countryCount = {};
            suppliers.forEach(s => {
              if (!countryCount[s.country]) countryCount[s.country] = { count: 0, region: s.region };
              countryCount[s.country].count++;
            });
            return Object.entries(countryCount)
              .sort((a, b) => b[1].count - a[1].count)
              .map(([country, data]) => (
                <div key={country} style={{
                  padding: '12px 20px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  minWidth: '140px',
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-bright)' }}>{data.count}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>{country}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{data.region}</div>
                </div>
              ));
          })()}
        </div>
      </div>
    </div>
  );
}

