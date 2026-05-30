import { useState, useMemo, useCallback } from 'react';
import { Search, Calculator, ArrowRight, AlertTriangle, Info, MapPin, Ship, Plane, Train, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { productMaster, getProductByHSCode, getProductByERPCode, getInventoryCriticality } from '../data/productMaster.js';
import { getSuppliersForProduct, getSupplierCountries } from '../data/supplierMaster.js';
import { countries, transportModes, getRegionForCountry, getApplicableCorridors } from '../data/masterData.js';
import { calculateTariff, compareSuppliers } from '../engine/tariffCalculator.js';
import { runPairedScenarios, runSensitivityMatrix } from '../engine/scenarioAnalysis.js';
import { formatCurrency } from '../services/exchangeRateService.js';
import { lookupHSCodeDescription } from '../services/tariffLookupService.js';

const TRANSPORT_ICONS = { 'Ship/Ocean': Ship, 'Air': Plane, 'Train': Train };

export default function TariffCalculator({ currency, convertAmount }) {
  // ── State ──
  const [hsCode, setHsCode] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [destinationCountry, setDestinationCountry] = useState('India');
  const [suppliers, setSuppliers] = useState([]);
  const [supplierInputs, setSupplierInputs] = useState([]);
  const [calcResult, setCalcResult] = useState(null);
  const [showScenario, setShowScenario] = useState(false);

  // Scenario state
  const [scenarioIncreasePct, setScenarioIncreasePct] = useState(25);
  const [scenarioDecreasePct, setScenarioDecreasePct] = useState(15);
  const [scenarioFobA, setScenarioFobA] = useState('');
  const [scenarioFobB, setScenarioFobB] = useState('');
  const [scenarioUnitsA, setScenarioUnitsA] = useState('');
  const [scenarioUnitsB, setScenarioUnitsB] = useState('');
  const [selectedScenarioSupplier, setSelectedScenarioSupplier] = useState(0);

  // ── Product Lookup ──
  const handleHSCodeChange = useCallback((value) => {
    setHsCode(value);
    setCalcResult(null);
    setShowScenario(false);

    // Try to find product by HS code
    const product = getProductByHSCode(value);
    if (product) {
      setSelectedProduct(product);
      const productSuppliers = getSuppliersForProduct(product.erpCode);
      setSuppliers(productSuppliers);
      setSupplierInputs(productSuppliers.map(s => ({
        supplierId: s.supplierId,
        fob: '',
        numberOfUnits: '',
        transportMode: s.defaultTransport,
      })));
    } else {
      setSelectedProduct(null);
      setSuppliers([]);
      setSupplierInputs([]);

      // If not in database, attempt real-time WCO Trade Tariff API lookup for custom HS codes
      const cleaned = String(value).replace(/[^0-9]/g, '');
      if (cleaned.length === 4 || cleaned.length === 6) {
        lookupHSCodeDescription(cleaned).then(liveDesc => {
          if (liveDesc) {
            const customProduct = {
              hsCode: cleaned,
              erpCode: 'CUSTOM_PRD',
              description: liveDesc,
              category: 'Other Parts',
              daysOfCoverage: 30,
              inHandInventory: 10,
              inTransitInventory: 0,
              inventoryValue: 0,
              safetyStock: 5,
              roq: 10,
              reviewType: 'Spot Sourcing'
            };
            const customSuppliers = [
              { supplierId: 'SUP_CUST_A', supplierName: 'Global Supplier A', country: 'Germany', region: 'EU', countryCode: 'DE', defaultTransport: 'Ship/Ocean', supplyPct: 100, leadTimeDays: 14, reliability: 95 },
              { supplierId: 'SUP_CUST_B', supplierName: 'Global Supplier B', country: 'China', region: 'Asia', countryCode: 'CN', defaultTransport: 'Ship/Ocean', supplyPct: 0, leadTimeDays: 21, reliability: 90 },
            ];
            
            setSelectedProduct(customProduct);
            setSuppliers(customSuppliers);
            setSupplierInputs(customSuppliers.map(s => ({
              supplierId: s.supplierId,
              fob: '',
              numberOfUnits: '',
              transportMode: s.defaultTransport,
            })));
          }
        });
      }
    }
  }, []);

  const handleProductSelect = useCallback((product) => {
    setHsCode(product.hsCode);
    setSelectedProduct(product);
    setCalcResult(null);
    setShowScenario(false);
    const productSuppliers = getSuppliersForProduct(product.erpCode);
    setSuppliers(productSuppliers);
    setSupplierInputs(productSuppliers.map(s => ({
      supplierId: s.supplierId,
      fob: '',
      numberOfUnits: '',
      transportMode: s.defaultTransport,
    })));
  }, []);

  // ── Supplier Input Updates ──
  const updateSupplierInput = useCallback((index, field, value) => {
    setSupplierInputs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  // ── Calculate ──
  const handleCalculate = useCallback(() => {
    if (!selectedProduct || supplierInputs.length === 0) return;

    const result = calculateTariff(hsCode, destinationCountry, supplierInputs);
    setCalcResult(result);
    setShowScenario(true);
  }, [hsCode, destinationCountry, selectedProduct, supplierInputs]);

  // ── Scenario Results ──
  const scenarioResults = useMemo(() => {
    if (!calcResult || !calcResult.supplierResults || calcResult.supplierResults.length === 0) return null;
    const baseResult = calcResult.supplierResults[selectedScenarioSupplier] || calcResult.supplierResults[0];
    return runPairedScenarios(
      baseResult,
      scenarioIncreasePct,
      scenarioDecreasePct,
      scenarioFobA || null,
      scenarioFobB || null,
      scenarioUnitsA || null,
      scenarioUnitsB || null,
    );
  }, [calcResult, selectedScenarioSupplier, scenarioIncreasePct, scenarioDecreasePct, scenarioFobA, scenarioFobB, scenarioUnitsA, scenarioUnitsB]);

  // ── Sensitivity Matrix ──
  const sensitivityData = useMemo(() => {
    if (!calcResult || !calcResult.supplierResults || calcResult.supplierResults.length === 0) return null;
    const baseResult = calcResult.supplierResults[selectedScenarioSupplier] || calcResult.supplierResults[0];
    return runSensitivityMatrix(baseResult);
  }, [calcResult, selectedScenarioSupplier]);

  // ── Supplier Comparison ──
  const comparison = useMemo(() => {
    if (!calcResult || !calcResult.supplierResults || calcResult.supplierResults.length < 2) return null;
    return compareSuppliers(calcResult.supplierResults[0], calcResult.supplierResults[1]);
  }, [calcResult]);

  // ── Format helpers ──
  const fmt = (amount) => formatCurrency(convertAmount(amount), currency);
  const fmtPct = (pct) => `${pct.toFixed(2)}%`;

  // Product suggestions dropdown
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filteredProducts = useMemo(() => {
    if (!hsCode) return productMaster.slice(0, 8);
    return productMaster.filter(p =>
      p.hsCode.includes(hsCode) ||
      p.description.toLowerCase().includes(hsCode.toLowerCase()) ||
      p.erpCode.toLowerCase().includes(hsCode.toLowerCase())
    );
  }, [hsCode]);

  return (
    <div className="animate-fade-in">
      {/* ═══ SECTION 1: Product Selector ═══ */}
      <div className="product-selector">
        <div className="section-title">
          <div className="section-icon"><Search size={18} /></div>
          Product Lookup
        </div>
        <div className="product-selector-grid">
          <div className="form-group" style={{ position: 'relative', marginBottom: 0 }}>
            <label className="form-label">HS Code / Product Name / ERP Code</label>
            <input
              type="text"
              className="form-input"
              placeholder="Enter HS Code (e.g., 870112) or product name..."
              value={hsCode}
              onChange={e => {
                handleHSCodeChange(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            />
            {showSuggestions && filteredProducts.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)', maxHeight: '250px', overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)',
              }}>
                {filteredProducts.map(p => (
                  <div
                    key={p.erpCode}
                    style={{
                      padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                    className="sidebar-nav-item"
                    onMouseDown={() => handleProductSelect(p)}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{p.description}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.erpCode} · HS {p.hsCode}</div>
                    </div>
                    <span className="badge neutral">{p.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Destination Country</label>
            <select
              className="form-select"
              value={destinationCountry}
              onChange={e => setDestinationCountry(e.target.value)}
            >
              {countries.map(c => (
                <option key={c.code} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">No. of Suppliers</label>
            <input type="text" className="form-input" value={suppliers.length || '—'} readOnly
              style={{ color: 'var(--accent-primary)', fontWeight: 700 }} />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleCalculate}
            disabled={!selectedProduct || supplierInputs.every(s => !s.fob)}
            style={{ height: '42px', marginTop: '18px' }}
          >
            <Calculator size={16} /> Calculate
          </button>
        </div>
      </div>

      {/* ═══ SECTION 2: Product Info (Auto-populated) ═══ */}
      {selectedProduct && (
        <div className="glass-card mb-6 animate-slide-up">
          <div className="card-title">
            <Info size={18} className="icon" />
            Product Information
            <span className="badge info" style={{ marginLeft: 'auto' }}>Auto-populated from Master Data</span>
          </div>
          <div className="grid-3">
            <div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">HS Code</span>
                <span className="supplier-detail-value" style={{ fontFamily: 'monospace', fontSize: '15px' }}>{selectedProduct.hsCode}</span>
              </div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">Product Description</span>
                <span className="supplier-detail-value auto-calc">{selectedProduct.description}</span>
              </div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">Product Category</span>
                <span className="supplier-detail-value auto-calc">{selectedProduct.category}</span>
              </div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">Inventory Criticality</span>
                <span className={`badge ${getInventoryCriticality(selectedProduct.daysOfCoverage) === 'Critical' ? 'critical' : getInventoryCriticality(selectedProduct.daysOfCoverage) === 'Medium' ? 'warning' : 'success'}`}>
                  {getInventoryCriticality(selectedProduct.daysOfCoverage)}
                </span>
              </div>
            </div>
            <div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">No. of Suppliers</span>
                <span className="supplier-detail-value auto-calc">{suppliers.length}</span>
              </div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">Countries Supplying</span>
                <span className="supplier-detail-value auto-calc">{getSupplierCountries(selectedProduct.erpCode).length}</span>
              </div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">Current Inventory</span>
                <span className="supplier-detail-value auto-calc">{selectedProduct.inHandInventory + selectedProduct.inTransitInventory} units</span>
              </div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">In-Hand / In-Transit</span>
                <span className="supplier-detail-value auto-calc">{selectedProduct.inHandInventory} / {selectedProduct.inTransitInventory}</span>
              </div>
            </div>
            <div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">Days of Supply</span>
                <span className="supplier-detail-value auto-calc">{selectedProduct.daysOfCoverage} days</span>
              </div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">Safety Stock Level</span>
                <span className="supplier-detail-value auto-calc">{selectedProduct.safetyStock} units</span>
              </div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">ROQ</span>
                <span className="supplier-detail-value auto-calc">{selectedProduct.roq} units</span>
              </div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">Review Type</span>
                <span className="badge info">{selectedProduct.reviewType}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ SECTION 3: Supplier Inputs & Comparison ═══ */}
      {suppliers.length > 0 && (
        <div className="supplier-comparison mb-6">
          {suppliers.map((supplier, idx) => {
            const TransportIcon = TRANSPORT_ICONS[supplierInputs[idx]?.transportMode] || Ship;
            return (
              <div key={supplier.supplierId} className="supplier-card animate-slide-up" style={{ animationDelay: `${idx * 100}ms` }}>
                <div className="supplier-card-header">
                  <h3>Supplier {String.fromCharCode(65 + idx)}: {supplier.supplierName}</h3>
                  <span className="badge neutral">{supplier.supplyPct}% supply</span>
                </div>
                <div className="supplier-card-body">
                  {/* Auto-calculated supplier info */}
                  <div className="supplier-detail-row">
                    <span className="supplier-detail-label">Origin Country</span>
                    <span className="supplier-detail-value">{supplier.country}</span>
                  </div>
                  <div className="supplier-detail-row">
                    <span className="supplier-detail-label">Destination Country</span>
                    <span className="supplier-detail-value">{destinationCountry}</span>
                  </div>
                  <div className="supplier-detail-row">
                    <span className="supplier-detail-label">Supply %</span>
                    <span className="supplier-detail-value auto-calc">{supplier.supplyPct}%</span>
                  </div>
                  <div className="supplier-detail-row">
                    <span className="supplier-detail-label">Lead Time</span>
                    <span className="supplier-detail-value auto-calc">{supplier.leadTimeDays} days</span>
                  </div>
                  <div className="supplier-detail-row">
                    <span className="supplier-detail-label">Reliability</span>
                    <span className={`badge ${supplier.reliability >= 95 ? 'success' : supplier.reliability >= 85 ? 'warning' : 'critical'}`}>
                      {supplier.reliability}%
                    </span>
                  </div>

                  <div className="section-divider" />

                  {/* Manual inputs */}
                  <div className="form-group">
                    <label className="form-label" style={{ color: 'var(--success)' }}>$ FOB Price (Manual Entry)</label>
                    <div className="form-input-with-icon">
                      <span className="input-icon" style={{ color: 'var(--success)' }}>$</span>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="Enter FOB price..."
                        value={supplierInputs[idx]?.fob || ''}
                        onChange={e => updateSupplierInput(idx, 'fob', e.target.value)}
                        style={{ borderColor: 'rgba(16,185,129,0.3)' }}
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Mode of Transport</label>
                    <select
                      className="form-select"
                      value={supplierInputs[idx]?.transportMode || 'Ship/Ocean'}
                      onChange={e => updateSupplierInput(idx, 'transportMode', e.target.value)}
                    >
                      {transportModes.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Number of Units</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter quantity..."
                      value={supplierInputs[idx]?.numberOfUnits || ''}
                      onChange={e => updateSupplierInput(idx, 'numberOfUnits', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ SECTION 4: Calculation Results ═══ */}
      {calcResult && calcResult.supplierResults && (
        <div className="animate-slide-up">
          {/* Cost Breakdown per Supplier */}
          <div className="supplier-comparison mb-6">
            {calcResult.supplierResults.map((result, idx) => (
              <div key={result.supplierId} className="glass-card">
                <div className="card-title">
                  <Calculator size={18} className="icon" />
                  Cost Breakdown — Supplier {String.fromCharCode(65 + idx)}
                  <span className="badge info" style={{ marginLeft: 'auto' }}>
                    {result.transportMode}
                  </span>
                </div>

                {/* Rates & Values */}
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 80px 1fr', gap: '0', fontSize: '12px', color: 'var(--text-muted)', padding: '0 0 8px', borderBottom: '1px solid var(--border-medium)', marginBottom: '4px' }}>
                  <span>Cost Component</span>
                  <span style={{ textAlign: 'right' }}>Rate %</span>
                  <span style={{ textAlign: 'right' }}>Value</span>
                </div>

                <div className="cost-breakdown-row">
                  <span className="cost-label" style={{ color: 'var(--success)', fontWeight: 600 }}>FOB (Base Price) $</span>
                  <span className="cost-pct">—</span>
                  <span className="cost-value" style={{ color: 'var(--success)' }}>{fmt(result.fob)}</span>
                </div>

                <div className="cost-breakdown-row">
                  <span className="cost-label">Applicable Tariff</span>
                  <span className="cost-pct">{fmtPct(result.tariffPct)}</span>
                  <span className="cost-value">{fmt(result.tariffValue)}</span>
                </div>

                <div className="cost-breakdown-row">
                  <span className="cost-label">Avg Insurance Cost</span>
                  <span className="cost-pct">{fmtPct(result.insurancePct)}</span>
                  <span className="cost-value">{fmt(result.insuranceValue)}</span>
                </div>

                <div className="cost-breakdown-row">
                  <span className="cost-label">Avg Freight Cost</span>
                  <span className="cost-pct">{fmtPct(result.freightPct)}</span>
                  <span className="cost-value">{fmt(result.freightValue)}</span>
                </div>

                <div className="cost-breakdown-row">
                  <span className="cost-label">Other Duties</span>
                  <span className="cost-pct">{fmtPct(result.otherDutiesPct)}</span>
                  <span className="cost-value">{fmt(result.otherDutiesValue)}</span>
                </div>

                <div className="cost-breakdown-row total">
                  <span className="cost-label" style={{ fontWeight: 700, color: 'var(--text-bright)', fontSize: '14px' }}>Total Landed Cost</span>
                  <span className="cost-pct" style={{ fontWeight: 700 }}>$ Cal</span>
                  <span className="cost-value total-value">{fmt(result.totalLandedCost)}</span>
                </div>

                <div className="cost-breakdown-row">
                  <span className="cost-label" style={{ fontWeight: 700, color: 'var(--text-bright)' }}>Landed Cost / Unit</span>
                  <span className="cost-pct" style={{ fontWeight: 700 }}>$ Cal</span>
                  <span className="cost-value" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--warning)' }}>
                    {fmt(result.landedCostPerUnit)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* ═══ Supplier Comparison Summary ═══ */}
          {comparison && (
            <div className="glass-card mb-6">
              <div className="card-title">
                <TrendingUp size={18} className="icon" />
                Supplier Comparison Summary
              </div>
              <div className="grid-3">
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Lower Cost Supplier</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--success)' }}>{comparison.cheaperSupplier}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Saves {fmt(comparison.costDifference)}/unit ({comparison.costDifferencePct}%)
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Faster Delivery</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--info)' }}>{comparison.fasterSupplier}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {comparison.leadTimeDifference} days faster
                  </div>
                </div>
                <div style={{ textAlign: 'center', padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Lower Tariff</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent-primary)' }}>{comparison.lowerTariffSupplier}</div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    {comparison.tariffDifference.toFixed(1)}% difference
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Notifications & Trade Corridors ═══ */}
          <div className="grid-2 mb-6">
            <div className="glass-card">
              <div className="card-title">
                <AlertTriangle size={18} className="icon" />
                Major Notifications
              </div>
              {calcResult.supplierResults.flatMap((r, idx) =>
                r.notifications.map((n, nIdx) => (
                  <div key={`${idx}-${nIdx}`} className={`notification ${n.type}`}>
                    <div className="notification-icon">
                      {n.type === 'critical' ? <AlertTriangle size={16} style={{ color: 'var(--danger)' }} /> :
                       n.type === 'warning' ? <AlertTriangle size={16} style={{ color: 'var(--warning)' }} /> :
                       <Info size={16} style={{ color: 'var(--info)' }} />}
                    </div>
                    <div className="notification-message">
                      <span style={{ fontWeight: 600 }}>Supplier {String.fromCharCode(65 + idx)}: </span>
                      {n.message}
                    </div>
                  </div>
                ))
              )}
              {calcResult.supplierResults.every(r => r.notifications.length === 0) && (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px' }}>
                  No major notifications. All parameters within acceptable ranges.
                </div>
              )}
            </div>

            <div className="glass-card">
              <div className="card-title">
                <MapPin size={18} className="icon" />
                Possible Trade Corridors
              </div>
              {[...new Map(calcResult.supplierResults.flatMap(r => r.corridors).map(c => [c.name, c])).values()].map((corridor, idx) => (
                <div key={idx} style={{
                  padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
                  marginBottom: '8px', border: '1px solid var(--border-subtle)',
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-bright)', marginBottom: '4px' }}>{corridor.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{corridor.description}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {corridor.from} → {corridor.to}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ═══ SECTION 5: Scenario Analysis ═══ */}
          {showScenario && calcResult.supplierResults.length > 0 && (
            <div className="glass-card mb-6">
              <div className="card-title" style={{ cursor: 'pointer' }} onClick={() => setShowScenario(!showScenario)}>
                <div className="section-icon"><TrendingUp size={18} /></div>
                Scenario Analysis — Sensitivity Analysis
                <span style={{ marginLeft: 'auto' }}>{showScenario ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
              </div>

              {/* Supplier selector for scenario */}
              {calcResult.supplierResults.length > 1 && (
                <div className="tabs" style={{ marginBottom: '20px' }}>
                  {calcResult.supplierResults.map((r, idx) => (
                    <button
                      key={idx}
                      className={`tab ${selectedScenarioSupplier === idx ? 'active' : ''}`}
                      onClick={() => setSelectedScenarioSupplier(idx)}
                    >
                      Supplier {String.fromCharCode(65 + idx)}: {r.supplierName}
                    </button>
                  ))}
                </div>
              )}

              <div className="scenario-container">
                {/* Scenario A — Tariff Increase */}
                <div className="scenario-card">
                  <div className="scenario-header increase">
                    <h3>Scenario A: Tariff Increase</h3>
                    <span className="scenario-direction up">+++</span>
                  </div>
                  <div className="scenario-body">
                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--danger)' }}>% of Tariff Increase</label>
                      <input
                        type="number"
                        className="form-input"
                        value={scenarioIncreasePct}
                        onChange={e => setScenarioIncreasePct(parseFloat(e.target.value) || 0)}
                        style={{ borderColor: 'rgba(239,68,68,0.3)' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--success)' }}>$ FOB (New, optional)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder={`Current: ${calcResult.supplierResults[selectedScenarioSupplier]?.fob || '—'}`}
                        value={scenarioFobA}
                        onChange={e => setScenarioFobA(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">No. of Units (optional)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder={`Current: ${calcResult.supplierResults[selectedScenarioSupplier]?.numberOfUnits || '—'}`}
                        value={scenarioUnitsA}
                        onChange={e => setScenarioUnitsA(e.target.value)}
                      />
                    </div>

                    {scenarioResults && (
                      <>
                        <div className="section-divider" />
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label">New Tariff Rate</span>
                          <span className="supplier-detail-value auto-calc" style={{ color: 'var(--danger)' }}>
                            {fmtPct(scenarioResults.scenarioA.newTariffPct)}
                          </span>
                        </div>
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label">Applicable Tariff %</span>
                          <span className="supplier-detail-value auto-calc">{fmtPct(scenarioResults.scenarioA.newTariffPct)}</span>
                        </div>
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label">Avg Insurance Cost %</span>
                          <span className="supplier-detail-value auto-calc">{fmtPct(scenarioResults.scenarioA.insurancePct)}</span>
                        </div>
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label">Avg Freight Cost %</span>
                          <span className="supplier-detail-value auto-calc">{fmtPct(scenarioResults.scenarioA.freightPct)}</span>
                        </div>
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label">Other Duties %</span>
                          <span className="supplier-detail-value auto-calc">{fmtPct(scenarioResults.scenarioA.otherDutiesPct)}</span>
                        </div>
                        <div className="section-divider" />
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label" style={{ fontWeight: 700, color: 'var(--text-bright)' }}>New Total Cost</span>
                          <span className="supplier-detail-value dollar-calc" style={{ color: 'var(--danger)' }}>
                            {fmt(scenarioResults.scenarioA.newTotalCost)}
                          </span>
                        </div>
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label" style={{ fontWeight: 700, color: 'var(--text-bright)' }}>New Cost/Unit</span>
                          <span className="supplier-detail-value dollar-calc" style={{ color: 'var(--danger)' }}>
                            {fmt(scenarioResults.scenarioA.newCostPerUnit)}
                          </span>
                        </div>
                        <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--danger-bg)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--danger)' }}>
                          Impact: +{fmt(Math.abs(scenarioResults.scenarioA.costDifference))} ({scenarioResults.scenarioA.costDifferencePct > 0 ? '+' : ''}{scenarioResults.scenarioA.costDifferencePct}%)
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Scenario B — Tariff Decrease */}
                <div className="scenario-card">
                  <div className="scenario-header decrease">
                    <h3>Scenario B: Tariff Decrease</h3>
                    <span className="scenario-direction down">----</span>
                  </div>
                  <div className="scenario-body">
                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--success)' }}>% of Tariff Decrease</label>
                      <input
                        type="number"
                        className="form-input"
                        value={scenarioDecreasePct}
                        onChange={e => setScenarioDecreasePct(parseFloat(e.target.value) || 0)}
                        style={{ borderColor: 'rgba(16,185,129,0.3)' }}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ color: 'var(--success)' }}>$ FOB (New, optional)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder={`Current: ${calcResult.supplierResults[selectedScenarioSupplier]?.fob || '—'}`}
                        value={scenarioFobB}
                        onChange={e => setScenarioFobB(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">No. of Units (optional)</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder={`Current: ${calcResult.supplierResults[selectedScenarioSupplier]?.numberOfUnits || '—'}`}
                        value={scenarioUnitsB}
                        onChange={e => setScenarioUnitsB(e.target.value)}
                      />
                    </div>

                    {scenarioResults && (
                      <>
                        <div className="section-divider" />
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label">New Tariff Rate</span>
                          <span className="supplier-detail-value auto-calc" style={{ color: 'var(--success)' }}>
                            {fmtPct(scenarioResults.scenarioB.newTariffPct)}
                          </span>
                        </div>
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label">Applicable Tariff %</span>
                          <span className="supplier-detail-value auto-calc">{fmtPct(scenarioResults.scenarioB.newTariffPct)}</span>
                        </div>
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label">Avg Insurance Cost %</span>
                          <span className="supplier-detail-value auto-calc">{fmtPct(scenarioResults.scenarioB.insurancePct)}</span>
                        </div>
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label">Avg Freight Cost %</span>
                          <span className="supplier-detail-value auto-calc">{fmtPct(scenarioResults.scenarioB.freightPct)}</span>
                        </div>
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label">Other Duties %</span>
                          <span className="supplier-detail-value auto-calc">{fmtPct(scenarioResults.scenarioB.otherDutiesPct)}</span>
                        </div>
                        <div className="section-divider" />
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label" style={{ fontWeight: 700, color: 'var(--text-bright)' }}>New Total Cost</span>
                          <span className="supplier-detail-value dollar-calc" style={{ color: 'var(--success)' }}>
                            {fmt(scenarioResults.scenarioB.newTotalCost)}
                          </span>
                        </div>
                        <div className="supplier-detail-row">
                          <span className="supplier-detail-label" style={{ fontWeight: 700, color: 'var(--text-bright)' }}>New Cost/Unit</span>
                          <span className="supplier-detail-value dollar-calc" style={{ color: 'var(--success)' }}>
                            {fmt(scenarioResults.scenarioB.newCostPerUnit)}
                          </span>
                        </div>
                        <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', fontSize: '12px', color: 'var(--success)' }}>
                          Savings: {fmt(Math.abs(scenarioResults.scenarioB.costDifference))} ({scenarioResults.scenarioB.costDifferencePct}%)
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Scenario Comparison Summary */}
              {scenarioResults && (
                <div style={{ marginTop: '20px', padding: '20px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-medium)' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '16px' }}>
                    Scenario Spread Analysis
                  </div>
                  <div className="grid-3">
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Worst Case (A)</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--danger)' }}>{fmt(scenarioResults.comparison.worstCase)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Baseline (Current)</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-bright)' }}>{fmt(scenarioResults.comparison.baselineCost)}</div>
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Best Case (B)</div>
                      <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--success)' }}>{fmt(scenarioResults.comparison.bestCase)}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Total Spread: <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{fmt(scenarioResults.comparison.spread)}</span>
                    {' '}({scenarioResults.comparison.spreadPct}% range)
                  </div>
                </div>
              )}

              {/* Sensitivity Table */}
              {sensitivityData && (
                <div style={{ marginTop: '20px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-bright)', marginBottom: '12px' }}>
                    Sensitivity Matrix
                  </div>
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tariff Change %</th>
                          <th>New Tariff Rate</th>
                          <th>New Total Cost</th>
                          <th>New Cost/Unit</th>
                          <th>Impact</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sensitivityData.map((row, idx) => (
                          <tr key={idx} style={{ background: row.changePct === 0 ? 'var(--accent-gradient-subtle)' : undefined }}>
                            <td style={{
                              fontWeight: 700,
                              color: row.changePct > 0 ? 'var(--danger)' : row.changePct < 0 ? 'var(--success)' : 'var(--text-bright)',
                            }}>
                              {row.changePct > 0 ? '+' : ''}{row.changePct}%
                            </td>
                            <td>{fmtPct(row.newTariffPct)}</td>
                            <td style={{ fontWeight: 600 }}>{fmt(row.newTotalCost)}</td>
                            <td style={{ fontWeight: 600 }}>{fmt(row.newCostPerUnit)}</td>
                            <td>
                              <span className={`badge ${row.costDifferencePct > 0 ? 'critical' : row.costDifferencePct < 0 ? 'success' : 'neutral'}`}>
                                {row.costDifferencePct > 0 ? '+' : ''}{row.costDifferencePct}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Empty state when no product selected */}
      {!selectedProduct && (
        <div className="glass-card">
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-title">Select a Product to Begin</div>
            <div className="empty-state-desc">
              Enter an HS Code, product name, or ERP code above to load product details and begin the tariff calculation.
            </div>
          </div>
        </div>
      )}

      {/* Floating Calculate Button */}
      {selectedProduct && suppliers.length > 0 && (
        <button
          className={`btn btn-primary ${(!calcResult && supplierInputs.some(s => s.fob)) ? 'animate-pulse' : ''}`}
          onClick={handleCalculate}
          disabled={supplierInputs.every(s => !s.fob)}
          style={{
            position: 'fixed',
            bottom: '32px',
            right: '32px',
            zIndex: 1000,
            padding: '14px 28px',
            borderRadius: '50px',
            boxShadow: 'var(--accent-glow), 0 10px 30px rgba(0, 0, 0, 0.3)',
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            fontSize: '15px',
            fontWeight: 600,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.3s ease',
            cursor: 'pointer',
            opacity: supplierInputs.every(s => !s.fob) ? 0.6 : 1,
            transform: 'scale(1)',
          }}
          onMouseEnter={e => {
            if (!supplierInputs.every(s => !s.fob)) {
              e.currentTarget.style.transform = 'scale(1.05)';
              e.currentTarget.style.boxShadow = '0 0 30px rgba(102, 126, 234, 0.6), 0 12px 40px rgba(0, 0, 0, 0.4)';
            }
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.boxShadow = 'var(--accent-glow), 0 10px 30px rgba(0, 0, 0, 0.3)';
          }}
        >
          <Calculator size={18} />
          <span>Calculate Landed Cost</span>
        </button>
      )}
    </div>
  );
}
