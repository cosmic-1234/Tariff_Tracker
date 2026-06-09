import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Calculator, ArrowRight, AlertTriangle, Info, MapPin, Ship, Plane, Train, TrendingUp, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react';
import { productMaster, getProductByHSCode, getProductByERPCode, getInventoryCriticality } from '../data/productMaster.js';
import { getSuppliersForProduct, getSupplierCountries } from '../data/supplierMaster.js';
import { countries, transportModes, getRegionForCountry, getApplicableCorridors } from '../data/masterData.js';
import { calculateTariffAPI, runScenarioSimulation } from '../services/dataService.js';
import { formatCurrency } from '../services/exchangeRateService.js';
import { lookupHSCodeDescription, getHSCodesRecommendation } from '../services/tariffLookupService.js';

const TRANSPORT_ICONS = { 'Ship/Ocean': Ship, 'Air': Plane, 'Train': Train };

const getInitialSupplierInputs = (product, suppliers) => {
  const inventoryVal = parseFloat(product?.inventoryValue) || 0;
  const inHand = parseInt(product?.inHandInventory) || 0;
  const unitCost = (inventoryVal > 0 && inHand > 0) ? (inventoryVal / inHand) : 11;
  return suppliers.map(s => {
    const moq = s.moq || 1;
    return {
      supplierId: s.supplierId,
      fob: moq * unitCost,
      numberOfUnits: moq,
      moqMultiplier: 1,
      transportMode: s.defaultTransport,
    };
  });
};

export default function TariffCalculator({ currency, convertAmount, preselectedProduct, clearPreselectedProduct, products = productMaster, suppliers: allSuppliers = supplierMaster }) {
  // Load initial state from sessionStorage (persisting state between tab navigations)
  const savedState = useMemo(() => {
    try {
      const data = sessionStorage.getItem('tariff_tracker_calculator_state');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }, []);

  // ── State ──
  const [hsCode, setHsCode] = useState(savedState?.hsCode || '');
  const [selectedProduct, setSelectedProduct] = useState(savedState?.selectedProduct || null);
  const [destinationCountry, setDestinationCountry] = useState(savedState?.destinationCountry || 'India');
  const [suppliers, setSuppliers] = useState(savedState?.suppliers || []);
  const [supplierInputs, setSupplierInputs] = useState(savedState?.supplierInputs || []);
  const [showScenario, setShowScenario] = useState(savedState?.showScenario || false);
  const [liveSuggestions, setLiveSuggestions] = useState([]);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [calcResult, setCalcResult] = useState(savedState?.calcResult || null);
  const [comparison, setComparison] = useState(savedState?.comparison || null);
  const [sensitivityData, setSensitivityData] = useState(savedState?.sensitivityData || null);
  const [isCalculating, setIsCalculating] = useState(false);

  // Scenario state
  const [scenarioIncreasePct, setScenarioIncreasePct] = useState(savedState?.scenarioIncreasePct !== undefined ? savedState.scenarioIncreasePct : 25);
  const [scenarioDecreasePct, setScenarioDecreasePct] = useState(savedState?.scenarioDecreasePct !== undefined ? savedState.scenarioDecreasePct : 15);
  const [scenarioFobA, setScenarioFobA] = useState(savedState?.scenarioFobA || '');
  const [scenarioFobB, setScenarioFobB] = useState(savedState?.scenarioFobB || '');
  const [scenarioUnitsA, setScenarioUnitsA] = useState(savedState?.scenarioUnitsA || '');
  const [scenarioUnitsB, setScenarioUnitsB] = useState(savedState?.scenarioUnitsB || '');
  const [selectedScenarioSupplier, setSelectedScenarioSupplier] = useState(savedState?.selectedScenarioSupplier || 0);

  // ── Product Lookup ──
  const handleHSCodeChange = useCallback((value) => {
    setHsCode(value);
    setCalcResult(null);
    setShowScenario(false);
    setLiveSuggestions([]);

    // Try to find product by HS code or ERP code
    const product = products.find(p => p.hsCode === value) || products.find(p => p.erpCode === value);
    if (product) {
      setSelectedProduct(product);
      const productSuppliers = allSuppliers.filter(s => s.productErpCode === product.erpCode);
      setSuppliers(productSuppliers);
      setSupplierInputs(getInitialSupplierInputs(product, productSuppliers));
    } else {
      setSelectedProduct(null);
      setSuppliers([]);
      setSupplierInputs([]);

      const cleaned = String(value).replace(/[^0-9]/g, '');
      
      // Auto-calculate directly if custom 4/6 digit code entered
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
            setSupplierInputs(getInitialSupplierInputs(customProduct, customSuppliers));
          }
        });
      }

      // Fetch live suggestions for autocomplete recommendations
      if (cleaned.length === 2 || cleaned.length === 4 || cleaned.length === 6) {
        setIsSearchingApi(true);
        getHSCodesRecommendation(cleaned).then(recs => {
          setIsSearchingApi(false);
          if (recs) {
            setLiveSuggestions(recs);
          }
        }).catch(() => setIsSearchingApi(false));
      }
    }
  }, [products, allSuppliers]);

  const handleProductSelect = useCallback((product) => {
    setHsCode(product.hsCode);
    setSelectedProduct(product);
    setCalcResult(null);
    setShowScenario(false);
    const productSuppliers = allSuppliers.filter(s => s.productErpCode === product.erpCode);
    setSuppliers(productSuppliers);
    setSupplierInputs(getInitialSupplierInputs(product, productSuppliers));
  }, [allSuppliers]);

  // ── Preselected Product Effect ──
  useEffect(() => {
    if (preselectedProduct) {
      handleProductSelect(preselectedProduct);
      clearPreselectedProduct();
    }
  }, [preselectedProduct, handleProductSelect, clearPreselectedProduct]);

  // ── Supplier Input Updates ──
  const updateSupplierInput = useCallback((index, field, value) => {
    setSupplierInputs(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  // Auto-recalculate in real-time when inputs change if we've already done an initial calculation
  useEffect(() => {
    if (calcResult && selectedProduct && supplierInputs.length > 0) {
      let isCurrent = true;
      setIsCalculating(true);
      calculateTariffAPI(hsCode, destinationCountry, supplierInputs)
        .then(({ result, comparison: comp }) => {
          if (isCurrent) {
            setCalcResult(result);
            setComparison(comp);
            setIsCalculating(false);
          }
        })
        .catch(err => {
          console.error(err);
          if (isCurrent) setIsCalculating(false);
        });
      return () => { isCurrent = false; };
    }
  }, [supplierInputs, hsCode, destinationCountry, selectedProduct]);

  // Persist calculator state to sessionStorage (preserves inputs and calculation results when switching sidebar tabs)
  useEffect(() => {
    const stateToSave = {
      hsCode,
      selectedProduct,
      destinationCountry,
      suppliers,
      supplierInputs,
      showScenario,
      calcResult,
      scenarioIncreasePct,
      scenarioDecreasePct,
      scenarioFobA,
      scenarioFobB,
      scenarioUnitsA,
      scenarioUnitsB,
      selectedScenarioSupplier,
      comparison,
      sensitivityData
    };
    sessionStorage.setItem('tariff_tracker_calculator_state', JSON.stringify(stateToSave));
  }, [
    hsCode, selectedProduct, destinationCountry, suppliers, supplierInputs,
    showScenario, calcResult, scenarioIncreasePct, scenarioDecreasePct,
    scenarioFobA, scenarioFobB, scenarioUnitsA, scenarioUnitsB, selectedScenarioSupplier,
    comparison, sensitivityData
  ]);

  // Handler for custom overrides from the breakdown card
  const handleOverrideChange = useCallback((supplierIndex, field, value, isRate) => {
    setSupplierInputs(prev => {
      const updated = [...prev];
      const input = { ...updated[supplierIndex] };
      const parsed = parseFloat(value);
      const fob = parseFloat(input.fob) || 0;

      if (field === 'fob') {
        input.fob = isNaN(parsed) ? '' : parsed;
      } else if (isRate) {
        // Percentage override
        const key = `${field}Override`;
        input[key] = isNaN(parsed) ? undefined : parsed;
      } else {
        // Dollar value override -> backward calculate the percentage
        const key = `${field}Override`;
        if (isNaN(parsed) || fob <= 0) {
          input[key] = undefined;
        } else {
          input[key] = (parsed / fob) * 100;
        }
      }

      updated[supplierIndex] = input;
      return updated;
    });
  }, [calcResult]);

  // ── Calculate ──
  const handleCalculate = useCallback(() => {
    if (!selectedProduct || supplierInputs.length === 0) return;

    setIsCalculating(true);
    calculateTariffAPI(hsCode, destinationCountry, supplierInputs)
      .then(({ result, comparison: comp }) => {
        setCalcResult(result);
        setComparison(comp);
        setShowScenario(true);
        setIsCalculating(false);
      })
      .catch(err => {
        console.error(err);
        setIsCalculating(false);
      });
  }, [hsCode, destinationCountry, selectedProduct, supplierInputs]);

  // ── Sensitivity Matrix ──
  useEffect(() => {
    if (!calcResult || !calcResult.supplierResults || calcResult.supplierResults.length === 0) {
      setSensitivityData(null);
      return;
    }
    const baseResult = calcResult.supplierResults[selectedScenarioSupplier] || calcResult.supplierResults[0];
    if (!baseResult) return;

    let isCurrent = true;
    runScenarioSimulation({ type: 'sensitivity', baseResult })
      .then(res => {
        if (isCurrent && res.success) {
          setSensitivityData(res.matrix);
        }
      })
      .catch(err => console.error(err));
    return () => { isCurrent = false; };
  }, [calcResult, selectedScenarioSupplier]);

  // ── Format helpers ──
  const fmt = (amount) => formatCurrency(convertAmount(amount), currency);
  const fmtPct = (pct) => `${pct.toFixed(2)}%`;

  // Product suggestions dropdown
  const [showSuggestions, setShowSuggestions] = useState(false);
  const filteredProducts = useMemo(() => {
    if (!hsCode) return products.slice(0, 8);
    return products.filter(p =>
      p.hsCode.includes(hsCode) ||
      p.description.toLowerCase().includes(hsCode.toLowerCase()) ||
      p.erpCode.toLowerCase().includes(hsCode.toLowerCase())
    );
  }, [hsCode, products]);

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
            {showSuggestions && (filteredProducts.length > 0 || liveSuggestions.length > 0 || isSearchingApi) && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)', maxHeight: '250px', overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)',
              }}>
                {isSearchingApi && (
                  <div style={{ padding: '10px 14px', color: 'var(--text-muted)', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="animate-pulse">🌐</span>
                    <span>Querying WCO Trade Tariff...</span>
                  </div>
                )}
                {liveSuggestions.map((rec, index) => (
                  <div
                    key={`live-rec-${index}`}
                    style={{
                      padding: '10px 14px', cursor: 'pointer', borderBottom: '2px solid var(--border-medium)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: 'var(--accent-gradient-subtle)',
                    }}
                    className="sidebar-nav-item"
                    onMouseDown={() => {
                      const customProduct = {
                        hsCode: rec.hsCode,
                        erpCode: 'CUSTOM_PRD',
                        description: rec.description,
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
                      setHsCode(rec.hsCode);
                      setSelectedProduct(customProduct);
                      setSuppliers(customSuppliers);
                      setSupplierInputs(getInitialSupplierInputs(customProduct, customSuppliers));
                      setLiveSuggestions([]);
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-accent)' }}>
                        🌐 Live WCO Code Recommendation
                      </div>
                      <div style={{ fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>{rec.description}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>HS {rec.hsCode} · {rec.type} level</div>
                    </div>
                    <span className="badge info">{rec.type}</span>
                  </div>
                ))}
                {filteredProducts.map(p => (
                  <div
                    key={p.erpCode}
                    style={{
                      padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                    className="sidebar-nav-item"
                    onMouseDown={() => {
                      handleProductSelect(p);
                      setLiveSuggestions([]);
                    }}
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
            <span className="badge info" style={{ marginLeft: 'auto' }}>Auto-populated from Supplier Master</span>
          </div>
          <div className="grid-3">
            <div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">HS Code</span>
                <span className="supplier-detail-value" style={{ fontFamily: 'monospace', fontSize: '15px' }}>{selectedProduct.hsCode}</span>
              </div>
              <div className="supplier-detail-row">
                <span className="supplier-detail-label">ERP Code</span>
                <span className="supplier-detail-value" style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{selectedProduct.erpCode}</span>
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
                <span className="supplier-detail-value auto-calc">{allSuppliers.filter(s => s.productErpCode === selectedProduct.erpCode).map(s => s.country).filter((v, i, a) => a.indexOf(v) === i).length}</span>
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
                    <label className="form-label" style={{ color: 'var(--success)', opacity: 0.85 }}>$ FOB Price (Auto-calculated)</label>
                    <div className="form-input-with-icon">
                      <span className="input-icon" style={{ color: 'var(--success)', opacity: 0.7 }}>$</span>
                      <input
                        type="number"
                        className="form-input"
                        placeholder="FOB price..."
                        value={supplierInputs[idx]?.fob || ''}
                        readOnly={true}
                        style={{ 
                          borderColor: 'rgba(16,185,129,0.15)',
                          background: 'var(--bg-tertiary)',
                          color: 'var(--text-muted)',
                          cursor: 'not-allowed'
                        }}
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
                    <label className="form-label">MOQ Multiplier (MOQ: {supplier.moq || 1})</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="Enter multiplier..."
                      value={supplierInputs[idx]?.moqMultiplier !== undefined ? supplierInputs[idx].moqMultiplier : 1}
                      onChange={e => {
                        const mStr = e.target.value;
                        const parsedM = parseInt(mStr);
                        const moq = supplier.moq || 1;
                        
                        // Calculate units and FOB
                        const units = (isNaN(parsedM) || parsedM < 1) ? 0 : parsedM * moq;
                        const inventoryVal = parseFloat(selectedProduct?.inventoryValue) || 0;
                        const inHand = parseInt(selectedProduct?.inHandInventory) || 0;
                        const unitCost = (inventoryVal > 0 && inHand > 0) ? (inventoryVal / inHand) : 11;
                        const fobVal = (units * unitCost).toFixed(2);

                        setSupplierInputs(prev => {
                          const updated = [...prev];
                          updated[idx] = { 
                            ...updated[idx],
                            moqMultiplier: mStr,
                            numberOfUnits: units,
                            fob: units > 0 ? parseFloat(fobVal) : ''
                          };
                          return updated;
                        });
                      }}
                      min="1"
                      step="1"
                    />
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Calculated Quantity: <strong style={{ color: 'var(--accent-primary)' }}>{supplierInputs[idx]?.numberOfUnits || (supplier.moq || 1)}</strong> units
                    </div>
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
                  <span className="cost-value" style={{ color: 'var(--success)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ color: 'var(--success)', marginRight: '2px', opacity: 0.8 }}>$</span>
                      <input
                        type="number"
                        className="editable-cost-input"
                        value={supplierInputs[idx]?.fob !== undefined ? supplierInputs[idx].fob : result.fob}
                        readOnly={true}
                        step="0.01"
                        style={{ 
                          color: 'var(--success)', 
                          fontWeight: 600, 
                          width: '80px',
                          cursor: 'not-allowed',
                          borderBottom: 'none'
                        }}
                      />
                    </div>
                  </span>
                </div>

                <div className="cost-breakdown-row">
                  <span className="cost-label">Applicable Tariff</span>
                  <span className="cost-pct">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <input
                        type="number"
                        className="editable-cost-input"
                        value={supplierInputs[idx]?.tariffPctOverride !== undefined ? supplierInputs[idx].tariffPctOverride : parseFloat(result.tariffPct.toFixed(2))}
                        onChange={e => handleOverrideChange(idx, 'tariffPct', e.target.value, true)}
                        step="0.01"
                        style={{ color: 'var(--accent-primary)', fontWeight: 600, width: '65px' }}
                      />
                      <span style={{ color: 'var(--accent-primary)', marginLeft: '2px' }}>%</span>
                    </div>
                  </span>
                  <span className="cost-value">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '2px' }}>$</span>
                      <input
                        type="number"
                        className="editable-cost-input"
                        value={parseFloat(result.tariffValue.toFixed(2))}
                        onChange={e => handleOverrideChange(idx, 'tariffPct', e.target.value, false)}
                        step="0.01"
                        style={{ color: 'var(--text-primary)', fontWeight: 600, width: '75px' }}
                      />
                    </div>
                  </span>
                </div>

                <div className="cost-breakdown-row">
                  <span className="cost-label">Avg Insurance Cost</span>
                  <span className="cost-pct">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <input
                        type="number"
                        className="editable-cost-input"
                        value={supplierInputs[idx]?.insurancePctOverride !== undefined ? supplierInputs[idx].insurancePctOverride : parseFloat(result.insurancePct.toFixed(2))}
                        onChange={e => handleOverrideChange(idx, 'insurancePct', e.target.value, true)}
                        step="0.01"
                        style={{ color: 'var(--accent-primary)', fontWeight: 600, width: '65px' }}
                      />
                      <span style={{ color: 'var(--accent-primary)', marginLeft: '2px' }}>%</span>
                    </div>
                  </span>
                  <span className="cost-value">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '2px' }}>$</span>
                      <input
                        type="number"
                        className="editable-cost-input"
                        value={parseFloat(result.insuranceValue.toFixed(2))}
                        onChange={e => handleOverrideChange(idx, 'insurancePct', e.target.value, false)}
                        step="0.01"
                        style={{ color: 'var(--text-primary)', fontWeight: 600, width: '75px' }}
                      />
                    </div>
                  </span>
                </div>

                <div className="cost-breakdown-row">
                  <span className="cost-label">Avg Freight Cost</span>
                  <span className="cost-pct">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <input
                        type="number"
                        className="editable-cost-input"
                        value={supplierInputs[idx]?.freightPctOverride !== undefined ? supplierInputs[idx].freightPctOverride : parseFloat(result.freightPct.toFixed(2))}
                        onChange={e => handleOverrideChange(idx, 'freightPct', e.target.value, true)}
                        step="0.01"
                        style={{ color: 'var(--accent-primary)', fontWeight: 600, width: '65px' }}
                      />
                      <span style={{ color: 'var(--accent-primary)', marginLeft: '2px' }}>%</span>
                    </div>
                  </span>
                  <span className="cost-value">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '2px' }}>$</span>
                      <input
                        type="number"
                        className="editable-cost-input"
                        value={parseFloat(result.freightValue.toFixed(2))}
                        onChange={e => handleOverrideChange(idx, 'freightPct', e.target.value, false)}
                        step="0.01"
                        style={{ color: 'var(--text-primary)', fontWeight: 600, width: '75px' }}
                      />
                    </div>
                  </span>
                </div>

                <div className="cost-breakdown-row">
                  <span className="cost-label">Other Duties</span>
                  <span className="cost-pct">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <input
                        type="number"
                        className="editable-cost-input"
                        value={supplierInputs[idx]?.otherDutiesPctOverride !== undefined ? supplierInputs[idx].otherDutiesPctOverride : parseFloat(result.otherDutiesPct.toFixed(2))}
                        onChange={e => handleOverrideChange(idx, 'otherDutiesPct', e.target.value, true)}
                        step="0.01"
                        style={{ color: 'var(--accent-primary)', fontWeight: 600, width: '65px' }}
                      />
                      <span style={{ color: 'var(--accent-primary)', marginLeft: '2px' }}>%</span>
                    </div>
                  </span>
                  <span className="cost-value">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '2px' }}>$</span>
                      <input
                        type="number"
                        className="editable-cost-input"
                        value={parseFloat(result.otherDutiesValue.toFixed(2))}
                        onChange={e => handleOverrideChange(idx, 'otherDutiesPct', e.target.value, false)}
                        step="0.01"
                        style={{ color: 'var(--text-primary)', fontWeight: 600, width: '75px' }}
                      />
                    </div>
                  </span>
                </div>

                <div className="cost-breakdown-row">
                  <span className="cost-label">Variable Cost</span>
                  <span className="cost-pct">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <input
                        type="number"
                        className="editable-cost-input"
                        value={supplierInputs[idx]?.variableCostPctOverride !== undefined ? supplierInputs[idx].variableCostPctOverride : parseFloat((result.variableCostPct || 0).toFixed(2))}
                        onChange={e => handleOverrideChange(idx, 'variableCostPct', e.target.value, true)}
                        step="0.01"
                        style={{ color: 'var(--accent-primary)', fontWeight: 600, width: '65px' }}
                      />
                      <span style={{ color: 'var(--accent-primary)', marginLeft: '2px' }}>%</span>
                    </div>
                  </span>
                  <span className="cost-value">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      <span style={{ color: 'var(--text-muted)', marginRight: '2px' }}>$</span>
                      <input
                        type="number"
                        className="editable-cost-input"
                        value={parseFloat((result.variableCostValue || 0).toFixed(2))}
                        onChange={e => handleOverrideChange(idx, 'variableCostPct', e.target.value, false)}
                        step="0.01"
                        style={{ color: 'var(--text-primary)', fontWeight: 600, width: '75px' }}
                      />
                    </div>
                  </span>
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

          {/* ═══ SECTION 5: Sensitivity Matrix ═══ */}
          {showScenario && calcResult.supplierResults.length > 0 && (
            <div className="glass-card mb-6">
              <div className="card-title">
                <div className="section-icon"><TrendingUp size={18} /></div>
                Sensitivity Matrix
              </div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                Analyze cost and unit price sensitivity across various tariff adjustment levels.
              </div>

              {/* Supplier selector for sensitivity matrix */}
              {calcResult.supplierResults.length > 1 && (
                <div className="tab-group" style={{ marginBottom: '20px' }}>
                  {calcResult.supplierResults.map((r, idx) => (
                    <button
                      key={idx}
                      className={`tab-btn ${selectedScenarioSupplier === idx ? 'active' : ''}`}
                      onClick={() => setSelectedScenarioSupplier(idx)}
                      type="button"
                    >
                      Supplier {String.fromCharCode(65 + idx)}: {r.supplierName}
                    </button>
                  ))}
                </div>
              )}

              {/* Sensitivity Table */}
              {sensitivityData && (
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
          <span>Calculate</span>
        </button>
      )}
    </div>
  );
}
