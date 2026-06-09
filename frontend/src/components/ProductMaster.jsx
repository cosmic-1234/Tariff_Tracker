import { useState, useMemo } from 'react';
import { Package, Search } from 'lucide-react';
import { productMaster, getInventoryCriticality } from '../data/productMaster.js';
import { getSuppliersForProduct } from '../data/supplierMaster.js';
import { formatCurrency } from '../services/exchangeRateService.js';

export default function ProductMaster({ onNavigate, setSelectedProductForCalc, currency, convertAmount, products = productMaster, suppliers = supplierMaster }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('erpCode');
  const [sortDir, setSortDir] = useState('asc');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter(p => p.category === categoryFilter);
    }

    // Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.erpCode.toLowerCase().includes(term) ||
        p.hsCode.includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [searchTerm, sortField, sortDir, categoryFilter]);

  const fmt = (amount) => formatCurrency(convertAmount(amount), currency);

  const categories = ['all', ...new Set(products.map(p => p.category))];

  const renderSortIcon = (field) => (
    <span style={{ opacity: sortField === field ? 1 : 0.3, marginLeft: '4px' }}>
      {sortField === field && sortDir === 'desc' ? '↓' : '↑'}
    </span>
  );

  return (
    <div className="animate-fade-in">
      {/* KPIs */}
      <div className="kpi-grid stagger-children" style={{ marginBottom: '20px' }}>
        <div className="kpi-card">
          <div className="kpi-label">Total Products</div>
          <div className="kpi-value">{products.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Inventory Value</div>
          <div className="kpi-value small">{fmt(products.reduce((s, p) => s + p.inventoryValue, 0))}</div>
        </div>
      </div>

      <div className="glass-card">
        <div className="card-title">
          <Package size={18} className="icon" />
          Product Master Data
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="form-input"
              placeholder="Search by ERP code, HS code, description..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ paddingLeft: '38px' }}
            />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button
                key={cat}
                className={`btn btn-sm ${categoryFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCategoryFilter(cat)}
              >
                {cat === 'all' ? 'All' : cat}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="data-table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th onClick={() => handleSort('erpCode')} className={sortField === 'erpCode' ? 'sorted' : ''}>
                  ERP Code {renderSortIcon('erpCode')}
                </th>
                <th onClick={() => handleSort('hsCode')} className={sortField === 'hsCode' ? 'sorted' : ''}>
                  HS Code {renderSortIcon('hsCode')}
                </th>
                <th onClick={() => handleSort('category')} className={sortField === 'category' ? 'sorted' : ''}>
                  Category {renderSortIcon('category')}
                </th>
                <th onClick={() => handleSort('description')} className={sortField === 'description' ? 'sorted' : ''}>
                  Description {renderSortIcon('description')}
                </th>
                <th onClick={() => handleSort('inHandInventory')} className={sortField === 'inHandInventory' ? 'sorted' : ''}>
                  In-Hand {renderSortIcon('inHandInventory')}
                </th>
                <th onClick={() => handleSort('inventoryValue')} className={sortField === 'inventoryValue' ? 'sorted' : ''}>
                  Inv. Value {renderSortIcon('inventoryValue')}
                </th>
                <th onClick={() => handleSort('inTransitInventory')} className={sortField === 'inTransitInventory' ? 'sorted' : ''}>
                  In-Transit {renderSortIcon('inTransitInventory')}
                </th>
                <th onClick={() => handleSort('daysOfCoverage')} className={sortField === 'daysOfCoverage' ? 'sorted' : ''}>
                  Days Cov. {renderSortIcon('daysOfCoverage')}
                </th>
                <th>ROQ</th>
                <th>Review</th>
                <th>Safety Stock</th>
                <th onClick={() => handleSort('holdingCostPct')} className={sortField === 'holdingCostPct' ? 'sorted' : ''}>
                  Holding Cost {renderSortIcon('holdingCostPct')}
                </th>
                <th>Inventory Level</th>
                <th>Suppliers</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                const criticality = getInventoryCriticality(p.daysOfCoverage);
                const productSuppliers = suppliers.filter(s => s.productErpCode === p.erpCode);
                return (
                  <tr key={p.erpCode} className="clickable" onClick={() => {
                    setSelectedProductForCalc(p);
                    onNavigate('calculator');
                  }}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{p.erpCode}</td>
                    <td style={{ fontFamily: 'monospace' }}>{p.hsCode}</td>
                    <td><span className="badge neutral">{p.category}</span></td>
                    <td style={{ fontWeight: 500 }}>{p.description}</td>
                    <td style={{ fontWeight: 600 }}>{p.inHandInventory}</td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(p.inventoryValue)}</td>
                    <td>{p.inTransitInventory}</td>
                    <td style={{
                      fontWeight: 700,
                      color: criticality === 'Critical' ? 'var(--danger)' : criticality === 'Medium' ? 'var(--warning)' : 'var(--success)',
                    }}>
                      {p.daysOfCoverage}
                    </td>
                    <td>{p.roq}</td>
                    <td><span className="badge info">{p.reviewType}</span></td>
                    <td>{p.safetyStock}</td>
                    <td style={{ fontWeight: 600, color: 'var(--warning)', fontFamily: 'monospace' }}>
                      {p.holdingCostPct ? `${(p.holdingCostPct * 365 * 100).toFixed(1)}%` : '15.0%'}
                    </td>
                    <td>
                      <span className={`badge ${criticality === 'Critical' ? 'critical' : criticality === 'Medium' ? 'warning' : 'success'}`}>
                        {criticality}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{productSuppliers.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Showing {filteredProducts.length} of {products.length} products · Click any row to calculate tariff
        </div>
      </div>
    </div>
  );
}
