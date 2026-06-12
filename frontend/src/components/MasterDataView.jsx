import { useState, useMemo } from 'react';
import { Globe, Ship, Plane, MapPin, DollarSign } from 'lucide-react';
import { countries, regions, majorCorridors, insuranceCostMatrix, shippingCostMatrix, tariffRateTable, getCountryByCode } from '../data/masterData.js';

export default function MasterDataView({ suppliers = [] }) {
  const [activeTab, setActiveTab] = useState('countries');

  const getLocalUniqueSuppliers = () => {
    const seen = new Set();
    return suppliers.filter(s => {
      if (seen.has(s.supplierId)) return false;
      seen.add(s.supplierId);
      return true;
    });
  };
  const [selectedDestCountry, setSelectedDestCountry] = useState('India');

  const tariffsHsRates = tariffRateTable[selectedDestCountry] || {};
  const tariffsSourceCountryCodes = useMemo(() => {
    const codes = [];
    const seen = new Set();
    Object.values(tariffsHsRates).forEach(rates => {
      Object.keys(rates).forEach(k => {
        if (k !== 'default' && !seen.has(k)) {
          seen.add(k);
          codes.push(k);
        }
      });
    });
    return codes;
  }, [tariffsHsRates]);

  const tabs = [
    { id: 'countries', label: 'Countries & Corridors', icon: Globe },
    { id: 'insurance', label: 'Insurance Matrix', icon: Ship },
    { id: 'shipping', label: 'Shipping Matrix', icon: Plane },
    { id: 'tariffs', label: 'Tariff Rates', icon: DollarSign },
    { id: 'suppliers', label: 'Supplier Directory', icon: MapPin },
  ];

  return (
    <div className="animate-fade-in">
      <div className="tab-group">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Icon size={14} /> {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Countries & Corridors ── */}
      {activeTab === 'countries' && (
        <div className="grid-2">
          <div className="glass-card">
            <div className="card-title">
              <Globe size={18} className="icon" />
              Country List
            </div>
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Country</th>
                    <th>Code</th>
                    <th>Region</th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map(c => (
                    <tr key={c.code}>
                      <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '15px' }}>{c.flag || '🏳️'}</span>
                        <span>{c.name}</span>
                      </td>
                      <td><span className="badge neutral">{c.code}</span></td>
                      <td><span className="badge info">{c.region}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              Tariff codes classified as per the industry standards. Data fetched from WTO.
            </div>
          </div>

          <div className="glass-card">
            <div className="card-title">
              <MapPin size={18} className="icon" />
              Major Trade Corridors
            </div>
            {majorCorridors.map((c, idx) => (
              <div key={idx} style={{
                padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                marginBottom: '12px', border: '1px solid var(--border-subtle)',
              }}>
                <div style={{ fontWeight: 700, color: 'var(--text-bright)', marginBottom: '6px', fontSize: '14px' }}>
                  {c.name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  {c.description}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className="badge info">{c.from}</span>
                  <span style={{ color: 'var(--text-muted)' }}>→</span>
                  <span className="badge info">{c.to}</span>
                </div>
              </div>
            ))}
            <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
              Map country & latest news corridors
            </div>
          </div>
        </div>
      )}

      {/* ── Insurance Cost Matrix ── */}
      {activeTab === 'insurance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {['Ship/Ocean', 'Air'].map(mode => (
            <div key={mode} className="glass-card" style={{ width: '100%' }}>
              <div className="card-title">
                {mode === 'Ship/Ocean' ? <Ship size={18} className="icon" /> : <Plane size={18} className="icon" />}
                Average Insurance Cost Matrix — {mode}
                <span className="badge neutral" style={{ marginLeft: 'auto' }}>% of FOB</span>
              </div>
              <div className="data-table-container" style={{ border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
                <table className="matrix-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-medium)' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid var(--border-subtle)', padding: '14px 18px', background: 'var(--bg-tertiary)', textTransform: 'uppercase', fontSize: '12px', color: 'var(--text-secondary)' }}>From \ To</th>
                      {regions.map(r => (
                        <th key={r} style={{ border: '1px solid var(--border-subtle)', padding: '14px 18px', background: 'var(--bg-tertiary)', textTransform: 'uppercase', fontSize: '12px', color: 'var(--text-secondary)' }}>{r}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {regions.map(fromRegion => (
                      <tr key={fromRegion} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ fontWeight: 600, textAlign: 'left', background: 'var(--bg-tertiary)', padding: '14px 18px', border: '1px solid var(--border-subtle)', borderRight: '2px solid var(--border-medium)' }}>{fromRegion}</td>
                        {regions.map(toRegion => {
                          const val = insuranceCostMatrix[mode]?.[fromRegion]?.[toRegion];
                          const isDiag = fromRegion === toRegion;
                          return (
                            <td key={toRegion} className={isDiag ? 'diagonal' : ''} style={{
                              fontWeight: 600,
                              textAlign: 'center',
                              padding: '14px 18px',
                              border: '1px solid var(--border-subtle)',
                              color: val > 1 ? 'var(--warning)' : val > 0.5 ? 'var(--text-primary)' : 'var(--success)',
                            }}>
                              {val !== undefined ? `${val}%` : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Shipping Cost Matrix ── */}
      {activeTab === 'shipping' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {['Ship/Ocean', 'Air'].map(mode => (
            <div key={mode} className="glass-card" style={{ width: '100%' }}>
              <div className="card-title">
                {mode === 'Ship/Ocean' ? <Ship size={18} className="icon" /> : <Plane size={18} className="icon" />}
                Average Shipping Cost Matrix — {mode}
                <span className="badge neutral" style={{ marginLeft: 'auto' }}>% of FOB</span>
              </div>
              <div className="data-table-container" style={{ border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', overflowX: 'auto' }}>
                <table className="matrix-table" style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border-medium)' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid var(--border-subtle)', padding: '14px 18px', background: 'var(--bg-tertiary)', textTransform: 'uppercase', fontSize: '12px', color: 'var(--text-secondary)' }}>From \ To</th>
                      {regions.map(r => (
                        <th key={r} style={{ border: '1px solid var(--border-subtle)', padding: '14px 18px', background: 'var(--bg-tertiary)', textTransform: 'uppercase', fontSize: '12px', color: 'var(--text-secondary)' }}>{r}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {regions.map(fromRegion => (
                      <tr key={fromRegion} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ fontWeight: 600, textAlign: 'left', background: 'var(--bg-tertiary)', padding: '14px 18px', border: '1px solid var(--border-subtle)', borderRight: '2px solid var(--border-medium)' }}>{fromRegion}</td>
                        {regions.map(toRegion => {
                          const val = shippingCostMatrix[mode]?.[fromRegion]?.[toRegion];
                          const isDiag = fromRegion === toRegion;
                          return (
                            <td key={toRegion} className={isDiag ? 'diagonal' : ''} style={{
                              fontWeight: 600,
                              textAlign: 'center',
                              padding: '14px 18px',
                              border: '1px solid var(--border-subtle)',
                              color: val > 8 ? 'var(--danger)' : val > 4 ? 'var(--warning)' : 'var(--success)',
                            }}>
                              {val !== undefined ? `${val}%` : '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tariff Rates ── */}
      {activeTab === 'tariffs' && (
        <div className="glass-card animate-fade-in">
          <div className="card-title" style={{ marginBottom: '20px' }}>
            <DollarSign size={18} className="icon" />
            Tariff Rate Matrix by Destination
            <span className="badge info" style={{ marginLeft: 'auto' }}>% of FOB · Based on HS Code prefix</span>
          </div>

          {/* Destination Country Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>Destination Country:</span>
            <select
              className="form-select"
              style={{ width: '220px', margin: 0, padding: '8px 12px', background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)', color: 'var(--text-bright)' }}
              value={selectedDestCountry}
              onChange={e => setSelectedDestCountry(e.target.value)}
            >
              {Object.keys(tariffRateTable).map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '12px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '8px' }}>
              Import Duties for Destination: <span style={{ color: 'var(--tm-red)' }}>{selectedDestCountry}</span>
            </h3>
          </div>

          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>HS Prefix</th>
                  {tariffsSourceCountryCodes.map(code => {
                    const c = getCountryByCode(code);
                    return <th key={code}>{c ? `${c.name} (${code})` : code}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {Object.entries(tariffsHsRates).map(([prefix, rates]) => (
                  <tr key={prefix}>
                    <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{prefix}</td>
                    {tariffsSourceCountryCodes.map(code => (
                      <td key={code}>
                        {rates[code] !== undefined ? `${rates[code]}%` : '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            Tariff rates classified as per destination customs regulations. DEFAULT values omitted from grid representation.
          </div>
        </div>
      )}

      {/* ── Supplier Directory ── */}
      {activeTab === 'suppliers' && (
        <div className="glass-card">
          <div className="card-title">
            <MapPin size={18} className="icon" />
            Supplier Directory
          </div>
          <div className="data-table-container" style={{ maxHeight: '600px', overflowY: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Supplier ID</th>
                  <th>Supplier Name</th>
                  <th>Country</th>
                  <th>Region</th>
                  <th>Product (ERP)</th>
                  <th>Supply %</th>
                  <th>MOQ</th>
                  <th>Lead Time</th>
                  <th>Transport</th>
                  <th>Reliability</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map((s, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.supplierId}</td>
                    <td style={{ fontWeight: 600 }}>{s.supplierName}</td>
                    <td>{s.country}</td>
                    <td><span className="badge info">{s.region}</span></td>
                    <td style={{ fontFamily: 'monospace' }}>{s.productErpCode}</td>
                    <td style={{ fontWeight: 600 }}>{s.supplyPct}%</td>
                    <td style={{ fontWeight: 600 }}>{s.moq} units</td>
                    <td>{s.leadTimeDays} days</td>
                    <td><span className="badge neutral">{s.defaultTransport}</span></td>
                    <td>
                      <span className={`badge ${s.reliability >= 95 ? 'success' : s.reliability >= 85 ? 'warning' : 'critical'}`}>
                        {s.reliability}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
            Total: {suppliers.length} supplier-product relationships · {getLocalUniqueSuppliers().length} unique suppliers
          </div>
        </div>
      )}
    </div>
  );
}
