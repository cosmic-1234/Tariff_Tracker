import { useState } from 'react';
import { Globe, Ship, Plane, MapPin, DollarSign } from 'lucide-react';
import { countries, regions, majorCorridors, insuranceCostMatrix, shippingCostMatrix, tariffRateTable } from '../data/masterData.js';
import { supplierMaster, getAllSuppliers } from '../data/supplierMaster.js';

export default function MasterDataView() {
  const [activeTab, setActiveTab] = useState('countries');

  const tabs = [
    { id: 'countries', label: 'Countries & Corridors', icon: Globe },
    { id: 'insurance', label: 'Insurance Matrix', icon: Ship },
    { id: 'shipping', label: 'Shipping Matrix', icon: Plane },
    { id: 'tariffs', label: 'Tariff Rates', icon: DollarSign },
    { id: 'suppliers', label: 'Supplier Directory', icon: MapPin },
  ];

  return (
    <div className="animate-fade-in">
      <div className="tabs">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
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
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
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
        <div className="grid-2">
          {['Ship/Ocean', 'Air'].map(mode => (
            <div key={mode} className="glass-card">
              <div className="card-title">
                {mode === 'Ship/Ocean' ? <Ship size={18} className="icon" /> : <Plane size={18} className="icon" />}
                Average Insurance Cost Matrix — {mode}
                <span className="badge neutral" style={{ marginLeft: 'auto' }}>% of FOB</span>
              </div>
              <div className="data-table-container">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th>From \ To</th>
                      {regions.map(r => <th key={r}>{r}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {regions.map(fromRegion => (
                      <tr key={fromRegion}>
                        <td style={{ fontWeight: 600, textAlign: 'left', background: 'var(--bg-tertiary)' }}>{fromRegion}</td>
                        {regions.map(toRegion => {
                          const val = insuranceCostMatrix[mode]?.[fromRegion]?.[toRegion];
                          const isDiag = fromRegion === toRegion;
                          return (
                            <td key={toRegion} className={isDiag ? 'diagonal' : ''} style={{
                              fontWeight: 600,
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
        <div className="grid-2">
          {['Ship/Ocean', 'Air'].map(mode => (
            <div key={mode} className="glass-card">
              <div className="card-title">
                {mode === 'Ship/Ocean' ? <Ship size={18} className="icon" /> : <Plane size={18} className="icon" />}
                Average Shipping Cost Matrix — {mode}
                <span className="badge neutral" style={{ marginLeft: 'auto' }}>% of FOB</span>
              </div>
              <div className="data-table-container">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th>From \ To</th>
                      {regions.map(r => <th key={r}>{r}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {regions.map(fromRegion => (
                      <tr key={fromRegion}>
                        <td style={{ fontWeight: 600, textAlign: 'left', background: 'var(--bg-tertiary)' }}>{fromRegion}</td>
                        {regions.map(toRegion => {
                          const val = shippingCostMatrix[mode]?.[fromRegion]?.[toRegion];
                          const isDiag = fromRegion === toRegion;
                          return (
                            <td key={toRegion} className={isDiag ? 'diagonal' : ''} style={{
                              fontWeight: 600,
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
        <div className="glass-card">
          <div className="card-title">
            <DollarSign size={18} className="icon" />
            Tariff Rate Table — India Import Duties
            <span className="badge info" style={{ marginLeft: 'auto' }}>% of FOB · Based on HS Code prefix</span>
          </div>
          {Object.entries(tariffRateTable).map(([destCountry, hsRates]) => (
            <div key={destCountry} style={{ marginBottom: '24px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '12px' }}>
                Destination: {destCountry}
              </h3>
              <div className="data-table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>HS Prefix</th>
                      <th>Default</th>
                      <th>USA (US)</th>
                      <th>China (CN)</th>
                      <th>Germany (DE)</th>
                      <th>Netherlands (NL)</th>
                      <th>Japan (JP)</th>
                      <th>S. Korea (KR)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(hsRates).map(([prefix, rates]) => (
                      <tr key={prefix}>
                        <td style={{ fontWeight: 700, fontFamily: 'monospace' }}>{prefix}</td>
                        <td>{rates.default !== undefined ? `${rates.default}%` : '—'}</td>
                        <td>{rates.US !== undefined ? `${rates.US}%` : '—'}</td>
                        <td>{rates.CN !== undefined ? `${rates.CN}%` : '—'}</td>
                        <td>{rates.DE !== undefined ? `${rates.DE}%` : '—'}</td>
                        <td>{rates.NL !== undefined ? `${rates.NL}%` : '—'}</td>
                        <td>{rates.JP !== undefined ? `${rates.JP}%` : '—'}</td>
                        <td>{rates.KR !== undefined ? `${rates.KR}%` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
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
                  <th>Lead Time</th>
                  <th>Transport</th>
                  <th>Reliability</th>
                </tr>
              </thead>
              <tbody>
                {supplierMaster.map((s, idx) => (
                  <tr key={idx}>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{s.supplierId}</td>
                    <td style={{ fontWeight: 600 }}>{s.supplierName}</td>
                    <td>{s.country}</td>
                    <td><span className="badge info">{s.region}</span></td>
                    <td style={{ fontFamily: 'monospace' }}>{s.productErpCode}</td>
                    <td style={{ fontWeight: 600 }}>{s.supplyPct}%</td>
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
            Total: {supplierMaster.length} supplier-product relationships · {getAllSuppliers().length} unique suppliers
          </div>
        </div>
      )}
    </div>
  );
}
