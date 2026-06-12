import { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  Search, Calculator, AlertTriangle, FileText, CheckCircle2, 
  Database, Sliders, Layers, Info, ShieldAlert, DollarSign, 
  Activity, ArrowRight, Clock, Sparkles, Download, RefreshCw, Send
} from 'lucide-react';
import { countries } from '../data/masterData.js';
import { formatCurrency } from '../services/exchangeRateService.js';
import { optimizeProcurement } from '../services/dataService.js';

// --- SEED-BASED PSEUDO-RANDOM NUMBER GENERATOR FOR CONSISTENT SIMULATION ---
function createSeededRandom(seedString) {
  let h = 1779033703 ^ seedString.length;
  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export default function AutonomousProcurement({ currency, convertAmount, products = [], suppliers: allSuppliers = [], riskRecords = [] }) {
  // --- STATE ---
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  
  // Initialize selected product when products load
  useEffect(() => {
    if (!selectedProduct && products && products.length > 0) {
      setSelectedProduct(products[0]);
    }
  }, [products, selectedProduct]);

  // Solver controls
  const [destinationCountry, setDestinationCountry] = useState('India');
  const [totalDemand, setTotalDemand] = useState(15);
  const [serviceLevelZ, setServiceLevelZ] = useState(1.65); // Default 95% service level
  const [holdingCostRate, setHoldingCostRate] = useState(0.15); // Default 15% holding cost
  const [riskWeight, setRiskWeight] = useState(1.0); // Default risk multiplier
  const [dualSourcingEnabled, setDualSourcingEnabled] = useState(true);
  const [maxSharePct, setMaxSharePct] = useState(0.80); // Max 80% to one supplier

  // RFP and ERP interaction states
  const [copiedRFP, setCopiedRFP] = useState(false);
  const [erpSyncStatus, setErpSyncStatus] = useState('IDLE'); // IDLE, SYNCING, SUCCESS
  const [erpSyncProgress, setErpSyncProgress] = useState(0);
  const [erpLog, setErpLog] = useState([]);
  const [sapPrId, setSapPrId] = useState('');
  
  // Active tab inside results
  const [activeResultTab, setActiveResultTab] = useState('splits'); // splits, charts, strategies
  
  // Interactive chart tooltip state
  const [chartTooltip, setChartTooltip] = useState(null);

  // Alerts configuration state
  const [showAlertsOnly, setShowAlertsOnly] = useState(true);

  // Sync totalDemand and holdingCostRate when product changes
  useEffect(() => {
    if (selectedProduct) {
      setTotalDemand(selectedProduct.roq || 15);
      // Map daily holdingCostPct from product master (e.g. 0.0008) to annual rate (e.g. 0.0008 * 365 = 29.2%)
      const annualRate = selectedProduct.holdingCostPct ? selectedProduct.holdingCostPct * 365 : 0.15;
      setHoldingCostRate(annualRate);
      setErpSyncStatus('IDLE');
      setErpSyncProgress(0);
      setErpLog([]);
      setSapPrId('');
    }
  }, [selectedProduct]);

  // Product lookup helper
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products.slice(0, 8);
    return products.filter(p =>
      p.erpCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.hsCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, products]);

  // Fetch suppliers for selected product
  const suppliers = useMemo(() => {
    if (!selectedProduct) return [];
    return allSuppliers.filter(s => s.productErpCode === selectedProduct.erpCode);
  }, [selectedProduct, allSuppliers]);

  // Daily usage calculation from selectedProduct
  const dailyUse = useMemo(() => {
    if (!selectedProduct) return 2;
    const inv = selectedProduct.inHandInventory || 0;
    const doc = selectedProduct.daysOfCoverage || 30;
    return Math.max(1, doc > 0 ? Math.round((inv / doc) * 10) / 10 : 2);
  }, [selectedProduct]);

  // Criticality category name helper
  const criticalityInfo = useMemo(() => {
    if (!selectedProduct) return { rating: 'Medium', score: 3 };
    const record = riskRecords.find(r => r.erpCode === selectedProduct.erpCode);
    if (record) {
      return {
        rating: record.vedClass === 'V' ? 'Vital' : record.vedClass === 'E' ? 'Essential' : 'Desirable',
        score: record.vedScore
      };
    }
    return { rating: 'Medium', score: 3 };
  }, [selectedProduct, riskRecords]);

  // Retrieve inventory alerts and status from backend-driven risk records
  const productAlerts = useMemo(() => {
    return products.map(p => {
      const record = riskRecords.find(r => r.erpCode === p.erpCode) || {};
      return {
        product: p,
        level: record.alertLevel || 'OK',
        isOk: record.isAlertOk !== undefined ? record.isAlertOk : true,
        reason: record.alertReason || `OK: Stock level stable (${p.daysOfCoverage} days of coverage).`
      };
    });
  }, [products, riskRecords]);

  // Filter products based on showAlertsOnly state
  const filteredAlertProducts = useMemo(() => {
    let list = productAlerts;
    if (showAlertsOnly) {
      list = list.filter(item => !item.isOk);
    }
    // Sort so Critical is first, then Reorder, then Supplier Risk, then Corridor Threat, then OK
    const order = { 'Critical': 0, 'Reorder': 1, 'Supplier Risk': 2, 'Corridor Threat': 3, 'OK': 4 };
    return [...list].sort((a, b) => order[a.level] - order[b.level]);
  }, [productAlerts, showAlertsOnly]);

  // --- SOLVER FUNCTION IMPLEMENTATION ---
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  useEffect(() => {
    if (!selectedProduct || suppliers.length === 0) {
      setOptimizationResults(null);
      return;
    }

    let isCurrent = true;
    setIsOptimizing(true);
    optimizeProcurement({
      selectedProduct,
      suppliers,
      serviceLevelZ,
      dailyUse,
      destinationCountry,
      dualSourcingEnabled,
      maxSharePct,
      totalDemand,
      holdingCostRate,
      riskWeight,
      criticalityInfo
    })
      .then(res => {
        if (isCurrent) {
          setOptimizationResults(res);
          setIsOptimizing(false);
        }
      })
      .catch(err => {
        console.error(err);
        if (isCurrent) setIsOptimizing(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedProduct, suppliers, totalDemand, serviceLevelZ, holdingCostRate, riskWeight, dualSourcingEnabled, maxSharePct, destinationCountry, dailyUse, criticalityInfo]);

  // Retrieve demand sensing simulation data directly from backend solver payload
  const demandSensingData = useMemo(() => {
    return optimizationResults?.demandSensingData || [];
  }, [optimizationResults]);

  // Retrieve strategy comparison directly from backend solver payload
  const strategyComparison = useMemo(() => {
    return optimizationResults?.strategies || [];
  }, [optimizationResults]);

  // Retrieve savings percentage directly from backend solver payload
  const optimizedSavingsPct = useMemo(() => {
    return optimizationResults?.optimizedSavingsPct || 0;
  }, [optimizationResults]);

  // Recommended replenishment text formulated using backend-driven alert values
  const recommendedReplenishmentText = useMemo(() => {
    if (!selectedProduct || !optimizationResults) return '';
    const record = riskRecords.find(r => r.erpCode === selectedProduct.erpCode) || {};
    const alertLevel = record.alertLevel || 'OK';
    
    const splits = optimizationResults.solution.supplierDetails;
    const splitText = splits.map(s => `Order **${s.qty} units** from **${s.supplierName}** (${s.country})`).join(' and ');
    
    if (alertLevel === 'Critical') {
      return `⚠️ **CRITICAL DEFICIT**: Stock level is below Safety Stock (${selectedProduct.safetyStock} units). **Action required**: Reorder ${totalDemand} units immediately: ${splitText}.`;
    } else if (alertLevel === 'Reorder') {
      return `⚡ **REORDER POINT REACHED**: Current coverage is low. Recommended procurement plan: ${splitText}.`;
    } else {
      return `✅ **INVENTORY OPTIMAL**: Current inventory is stable. Recommended split for future orders: ${splitText}.`;
    }
  }, [selectedProduct, optimizationResults, riskRecords, totalDemand]);

  // --- GENERATING THE RFP TEXT DRAFT ---
  const rfpTextDraft = useMemo(() => {
    if (!selectedProduct || !optimizationResults) return '';
    const splits = optimizationResults.solution.supplierDetails;
    const dest = destinationCountry;
    
    let allocationsText = '';
    splits.forEach(s => {
      allocationsText += `  - Supplier: ${s.supplierName} (Region: ${s.region}, Country: ${s.country})\n`;
      allocationsText += `    Recommended Allocation: ${s.qty} units (${s.sharePct}%)\n`;
      allocationsText += `    Target Lead Time: ${s.leadTimeDays} days (Reliability Index: ${s.reliability}%)\n`;
      allocationsText += `    Projected Unit Landed Cost: $${s.landedCostPerUnit.toFixed(2)} (FOB Base: $${(s.landedCostPerUnit / (1 + (s.tariffPct + s.insurancePct + s.freightPct + s.otherDutiesPct)/100)).toFixed(2)})\n`;
      allocationsText += `    Applicable Tariff Rate: ${s.tariffPct}%\n\n`;
    });

    return `================================================================================
REQUEST FOR PROPOSAL (RFP) - CO-SOURCE REQUISITION DRAFT
Reference: RFP-2026-SKU-${selectedProduct.erpCode}
Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
Originator: Tech Mahindra Logistics & Procurement Optimization Engine
================================================================================

1. SKU DETAILS
  - Product Description: ${selectedProduct.description}
  - ERP Part Code: ${selectedProduct.erpCode}
  - HS Code Classification: ${selectedProduct.hsCode}
  - Inventory Criticality Class: ${criticalityInfo.rating} (VED Score: ${criticalityInfo.score.toFixed(1)})
  - Total Target Reorder Volume: ${totalDemand} units

2. OPTIMIZED ALLOCATION DETAILS
Based on multi-integer linear programming (MILP) optimization incorporating landed cost,
holding costs, tariff rates, corridor threats, and lead time reliability, the target
allocations are as follows:

${allocationsText}
3. SERVICE LEVEL AGREEMENT (SLA) REQUIREMENTS
- Lead Time Compliance: Supplier must maintain their specified lead times with an OTIF (On-Time-In-Full) rate of at least 95%.
- Transport routing: Sourced parts must travel via their optimized shipping corridors to minimize external corridor threat exposures.
- MOQ Compliance: Sourcing allocation strictly respects the supplier-specified Minimum Order Quantity (MOQ).

4. TERMS & SUBMISSION
Suppliers should respond with updated FOB pricing and shipping schedules within 5 business days.

================================================================================
Generated autonomously via Tech Mahindra Procurement Optimizer.
================================================================================`;
  }, [selectedProduct, optimizationResults, totalDemand, destinationCountry, criticalityInfo]);

  // RFP Actions
  const handleCopyRFP = () => {
    navigator.clipboard.writeText(rfpTextDraft);
    setCopiedRFP(true);
    setTimeout(() => setCopiedRFP(false), 2000);
  };

  const handleDownloadRFP = () => {
    const element = document.createElement("a");
    const file = new Blob([rfpTextDraft], {type: 'text/plain'});
    element.href = URL.createObjectURL(file);
    element.download = `RFP_Draft_${selectedProduct.erpCode}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // --- ERP CONNECTIVITY AND S&OP SIMULATOR ACTION ---
  const handleSyncToSAP = () => {
    if (erpSyncStatus === 'SYNCING') return;
    
    setErpSyncStatus('SYNCING');
    setErpSyncProgress(5);
    setErpLog(['[INFO] Initiating S&OP to SAP ERP consensus sync...']);

    const steps = [
      { pct: 15, msg: '[INFO] Connecting to SAP S/4HANA MM (Materials Management) module...' },
      { pct: 35, msg: `[INFO] Checking budget limits for department. Budget available: $250,000. Required: $${(optimizationResults?.solution?.totalCost || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}` },
      { pct: 60, msg: `[INFO] Formulating Purchase Requisitions for SKU: ${selectedProduct.erpCode}...` },
      { pct: 85, msg: `[INFO] Creating Purchase Requisitions split: PO-001 (${optimizationResults?.solution?.supplierDetails[0]?.qty} units to ${optimizationResults?.solution?.supplierDetails[0]?.supplierName})` },
      { pct: 95, msg: optimizationResults?.solution?.supplierDetails[1] ? `[INFO] PO-002 (${optimizationResults?.solution?.supplierDetails[1]?.qty} units to ${optimizationResults?.solution?.supplierDetails[1]?.supplierName})` : '[INFO] Finalizing PO requisitions...' },
      { pct: 100, msg: `[SUCCESS] Purchase Requisition PR-2026-${selectedProduct.erpCode} created and released in SAP.` }
    ];

    steps.forEach((step, idx) => {
      setTimeout(() => {
        setErpSyncProgress(step.pct);
        setErpLog(prev => [...prev, step.msg]);
        if (step.pct === 100) {
          setErpSyncStatus('SUCCESS');
          setSapPrId(`PR-${Math.floor(100000 + Math.random() * 900000)}`);
        }
      }, (idx + 1) * 800);
    });
  };

  // Format Helper
  const fmt = (amount) => formatCurrency(convertAmount(amount), currency);

  return (
    <div className="animate-fade-in">
      
      {/* ═══ TOP REPLENISHMENT ALERT HEADER BAR ═══ */}
      <div className="glass-card mb-6" style={{ borderLeft: '4px solid var(--tm-red)', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{
            background: 'var(--accent-gradient-subtle)',
            borderRadius: '50%',
            padding: '10px',
            color: 'var(--tm-red)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <Sparkles size={20} className="animate-pulse" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-bright)', fontWeight: 700 }}>Autonomous Procurement Suggestion Engine</h3>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-secondary)' }} dangerouslySetInnerHTML={{ __html: recommendedReplenishmentText.replace(/\*\*(.*?)\*\*/g, '<strong style="color:var(--text-bright)">$1</strong>') }} />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <div className="tm-exchange-badge" style={{ padding: '6px 12px', background: 'var(--bg-tertiary)' }}>
              <span className="tm-exchange-label">Tariff Savings potential:</span>
              <span className="tm-exchange-value" style={{ color: 'var(--success)' }}>+{optimizedSavingsPct}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Inventory Criticality & Risk Alert Matrix ── */}
      <div className="glass-card mb-6" style={{ width: '100%', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} className="text-danger" style={{ color: 'var(--danger)' }} />
            <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text-bright)', fontWeight: 700 }}>
              Inventory Criticality & Risk Alert Matrix
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={showAlertsOnly}
                onChange={e => setShowAlertsOnly(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--tm-red)' }}
              />
              Show Active Alerts Only
            </label>
            <span className="badge neutral" style={{ fontSize: '11px' }}>
              Showing {filteredAlertProducts.length} items
            </span>
          </div>
        </div>

        <div className="data-table-container" style={{ maxHeight: '320px', overflowY: 'auto', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-md)' }}>
          <table className="data-table" style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-tertiary)' }}>
              <tr>
                <th style={{ borderBottom: '2px solid var(--tm-red)', padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Product Code</th>
                <th style={{ borderBottom: '2px solid var(--tm-red)', padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Inventory Name</th>
                <th style={{ borderBottom: '2px solid var(--tm-red)', padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Description</th>
                <th style={{ borderBottom: '2px solid var(--tm-red)', padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'center' }}>Alert Level</th>
                <th style={{ borderBottom: '2px solid var(--tm-red)', padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Dynamic Reason</th>
                <th style={{ borderBottom: '2px solid var(--tm-red)', padding: '12px 16px', fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-secondary)', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAlertProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                    No inventory alerts active. All stock levels and supply chains are stable!
                  </td>
                </tr>
              ) : (
                filteredAlertProducts.map(item => {
                  const p = item.product;
                  const isSelected = selectedProduct?.erpCode === p.erpCode;
                  
                  // Choose badge style based on alert level
                  let alertBadgeClass = 'success';
                  let alertText = 'OK';
                  if (item.level === 'Critical') {
                    alertBadgeClass = 'critical';
                    alertText = 'Not OK: Critical';
                  } else if (item.level === 'Reorder') {
                    alertBadgeClass = 'warning';
                    alertText = 'Not OK: Reorder';
                  } else if (item.level === 'Supplier Risk') {
                    alertBadgeClass = 'warning';
                    alertText = 'Not OK: Supplier Risk';
                  } else if (item.level === 'Corridor Threat') {
                    alertBadgeClass = 'warning';
                    alertText = 'Not OK: Corridor Threat';
                  }

                  return (
                    <tr 
                      key={p.erpCode} 
                      className="clickable"
                      style={{ 
                        background: isSelected ? 'var(--accent-gradient-subtle)' : '',
                        borderBottom: '1px solid var(--border-subtle)',
                        transition: 'background var(--transition-fast)'
                      }}
                      onClick={() => {
                        setSelectedProduct(p);
                        const controlsCard = document.getElementById('optimization-controls');
                        if (controlsCard) {
                          controlsCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }
                      }}
                    >
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, padding: '12px 16px', color: 'var(--text-bright)' }}>{p.erpCode}</td>
                      <td style={{ fontWeight: 600, padding: '12px 16px' }}>{p.category}</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{p.description}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <span className={`badge ${alertBadgeClass}`} style={{ fontSize: '11px', fontWeight: 700 }}>
                          {alertText}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--text-secondary)' }}>{item.reason}</td>
                      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                        <button 
                          className="btn-primary" 
                          style={{ 
                            padding: '4px 10px', 
                            fontSize: '11px', 
                            borderRadius: '4px',
                            background: isSelected ? 'var(--success)' : 'var(--tm-red)',
                            border: 'none',
                            color: 'white',
                            cursor: 'pointer'
                          }}
                        >
                          {isSelected ? 'Optimizing...' : 'Optimize'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
          * Clicking any row loads that SKU into the parameters panel below and triggers the sourcing cost optimization solver.
        </div>
      </div>

      {/* ═══ CORE LAYOUT GRID ═══ */}
      <div className="grid-3 mb-6" style={{ gridTemplateColumns: '1fr 2fr', gap: '20px' }}>
        
        {/* LEFT COLUMN: CONTROLS */}
        <div id="optimization-controls" className="glass-card" style={{ height: 'fit-content' }}>
          <div className="card-title">
            <Sliders size={18} className="icon" />
            Optimization Parameters
          </div>
          
          {/* SKU / Product Lookup */}
          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">Select Inventory SKU</label>
            <div className="form-input-with-icon">
              <span className="input-icon"><Search size={14} /></span>
              <input
                type="text"
                className="form-input"
                placeholder="Search description / code..."
                value={searchQuery || selectedProduct?.description || ''}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setShowProductDropdown(true);
                }}
                onFocus={() => setShowProductDropdown(true)}
                onBlur={() => setTimeout(() => setShowProductDropdown(false), 250)}
              />
            </div>
            {showProductDropdown && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 60,
                background: 'var(--bg-secondary)', border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)', maxHeight: '200px', overflowY: 'auto',
                boxShadow: 'var(--shadow-lg)',
              }}>
                {filteredProducts.map(p => (
                  <div
                    key={p.erpCode}
                    style={{
                      padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}
                    className="sidebar-nav-item"
                    onMouseDown={() => {
                      setSelectedProduct(p);
                      setSearchQuery('');
                      setShowProductDropdown(false);
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '13px' }}>{p.description}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.erpCode} · HS {p.hsCode}</div>
                    </div>
                    <span className="badge neutral" style={{ fontSize: '10px' }}>{p.category}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Meta details readout */}
          {selectedProduct && (
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 14px',
              marginBottom: '16px',
              fontSize: '12px',
              border: '1px solid var(--border-subtle)'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Category:</span>
                <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{selectedProduct.category}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>In-Hand Stock:</span>
                <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{selectedProduct.inHandInventory} units</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Daily Demand Rate:</span>
                <span style={{ color: 'var(--text-bright)', fontWeight: 600 }}>{dailyUse} units/day</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Criticality Class:</span>
                <span className={`badge ${criticalityInfo.rating === 'Vital' ? 'critical' : criticalityInfo.rating === 'Essential' ? 'warning' : 'success'}`} style={{ fontSize: '9px', padding: '1px 5px' }}>
                  {criticalityInfo.rating} (VED: {criticalityInfo.score.toFixed(1)})
                </span>
              </div>
              {suppliers.length > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--border-subtle)' }}>
                  <div style={{ color: 'var(--text-secondary)', marginBottom: '4px', fontWeight: 500 }}>Supplier MOQ:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '8px' }}>
                    {suppliers.map(s => (
                      <div key={s.supplierId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{s.supplierName} ({s.country}):</span>
                        <span style={{ color: 'var(--text-bright)', fontWeight: 650 }}>{s.moq} units</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Total demand quantity to optimize */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <label className="form-label">Total Order Quantity (units)</label>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Suggested: {selectedProduct?.roq || 15}</span>
            </div>
            <input
              type="number"
              className="form-input"
              value={totalDemand}
              onChange={e => setTotalDemand(Math.max(1, parseInt(e.target.value) || 1))}
              min="1"
            />
          </div>

          {/* Destination Country Selection */}
          <div className="form-group">
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

          <div className="section-divider" style={{ margin: '16px 0' }} />

          {/* Service Level Z Slider */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label className="form-label">Target Service Level</label>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--info)' }}>
                {serviceLevelZ === 1.28 ? '90% (Z=1.28)' : serviceLevelZ === 1.65 ? '95% (Z=1.65)' : serviceLevelZ === 2.05 ? '98% (Z=2.05)' : '99% (Z=2.33)'}
              </span>
            </div>
            <select
              className="form-select"
              value={serviceLevelZ}
              onChange={e => setServiceLevelZ(parseFloat(e.target.value))}
            >
              <option value="1.28">90% Service level</option>
              <option value="1.65">95% Service level</option>
              <option value="2.05">98% Service level</option>
              <option value="2.33">99% Service level</option>
            </select>
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Determines Safety Stock multipliers for lead-time variability coverage.</p>
          </div>

          {/* Holding Cost Rate */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label className="form-label">Holding Cost Rate</label>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--warning)' }}>{(holdingCostRate * 100).toFixed(1)}% / yr</span>
            </div>
            <input
              type="range"
              className="form-range"
              min="0.01"
              max="0.60"
              step="0.001"
              value={holdingCostRate}
              onChange={e => setHoldingCostRate(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--warning)' }}
            />
          </div>

          {/* Cost Weight vs Risk Weight */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <label className="form-label">Risk Aversion Factor</label>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--tm-red)' }}>{riskWeight.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              className="form-range"
              min="0.0"
              max="2.0"
              step="0.2"
              value={riskWeight}
              onChange={e => setRiskWeight(parseFloat(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--tm-red)' }}
            />
            <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: '4px 0 0' }}>Increases penalty score for high tariffs, corridor threats, and low supplier reliability.</p>
          </div>

          {/* Dual Sourcing Enforcer */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-bright)' }}>
              <input
                type="checkbox"
                checked={dualSourcingEnabled}
                onChange={e => setDualSourcingEnabled(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--tm-red)' }}
              />
              Enforce Supplier Diversification
            </label>
            {dualSourcingEnabled && (
              <div style={{ marginTop: '10px', paddingLeft: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                  <span>Max Share Allocation:</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{Math.round(maxSharePct * 100)}%</span>
                </div>
                <input
                  type="range"
                  className="form-range"
                  min="0.50"
                  max="0.95"
                  step="0.05"
                  value={maxSharePct}
                  onChange={e => setMaxSharePct(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--text-secondary)' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: OPTIMIZATION OUTPUTS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* TAB SYSTEM NAVIGATION */}
          <div className="glass-card" style={{ padding: '8px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button 
                className={`btn ${activeResultTab === 'splits' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveResultTab('splits')}
                style={{ flex: 1, padding: '10px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Activity size={15} /> Sourcing Splits
              </button>
              <button 
                className={`btn ${activeResultTab === 'charts' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveResultTab('charts')}
                style={{ flex: 1, padding: '10px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Clock size={15} /> Demand Sensing Simulation
              </button>
              <button 
                className={`btn ${activeResultTab === 'strategies' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setActiveResultTab('strategies')}
                style={{ flex: 1, padding: '10px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Layers size={15} /> Strategy Trade-Offs
              </button>
            </div>
          </div>

          {/* TAB 1: SOURCING SPLITS AND MODEL DETAILS */}
          {activeResultTab === 'splits' && optimizationResults && (
            <div className="glass-card mb-0 animate-slide-up">
              
              {/* Relaxation Notification banner if optimization had to bend rules */}
              {optimizationResults.relaxed && (
                <div style={{
                  background: 'var(--warning-bg)',
                  border: '1px solid var(--warning-border)',
                  color: 'var(--warning)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertTriangle size={15} style={{ flexShrink: 0 }} />
                  <span>{optimizationResults.relaxationMsg}</span>
                </div>
              )}

              <div className="grid-2" style={{ gridTemplateColumns: '1.2fr 1fr', gap: '20px', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                  <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: 'var(--text-bright)', fontWeight: 700 }}>Recommended Order Splits</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {optimizationResults.solution.supplierDetails.map((s, idx) => {
                      const colors = ['#E31837', '#3b82f6', '#10b981', '#f59e0b'];
                      const col = colors[idx % colors.length];
                      
                      return (
                        <div key={s.supplierId} style={{
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'space-between', 
                          padding: '12px 14px', 
                          background: 'var(--bg-secondary)', 
                          borderRadius: 'var(--radius-md)',
                          borderLeft: `4px solid ${col}`,
                          border: '1px solid var(--border-subtle)',
                          borderLeftWidth: '4px'
                        }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-bright)' }}>{s.supplierName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.country} ({s.region}) · LT: {s.leadTimeDays}d</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 800, fontSize: '15px', color: col }}>{s.qty} units</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.sharePct}% share</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* SVG DONUT CHART DRAWN WITH ZERO EXTERNAL DEPENDENCIES */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="180" height="180" viewBox="0 0 200 200">
                    <circle cx="100" cy="100" r="70" fill="none" stroke="var(--bg-tertiary)" strokeWidth="18" />
                    {(() => {
                      const radius = 70;
                      const circumference = 2 * Math.PI * radius;
                      let accumulatedPct = 0;
                      const colors = ['#E31837', '#3b82f6', '#10b981', '#f59e0b'];
                      
                      return optimizationResults.solution.supplierDetails.map((s, idx) => {
                        if (s.qty <= 0) return null;
                        const col = colors[idx % colors.length];
                        const share = (s.qty / totalDemand) * 100;
                        const dashArray = `${(share / 100) * circumference} ${circumference}`;
                        const angle = (accumulatedPct / 100) * 360;
                        accumulatedPct += share;
                        
                        return (
                          <circle
                            key={s.supplierId}
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="none"
                            stroke={col}
                            strokeWidth="18"
                            strokeDasharray={dashArray}
                            transform={`rotate(${angle - 90} 100 100)`}
                            style={{ transition: 'stroke-dasharray 0.5s ease' }}
                          />
                        );
                      });
                    })()}
                    <text x="100" y="95" textAnchor="middle" dominantBaseline="middle" fill="var(--text-bright)" style={{ fontSize: '20px', fontWeight: 800 }}>
                      {totalDemand}
                    </text>
                    <text x="100" y="118" textAnchor="middle" dominantBaseline="middle" fill="var(--text-secondary)" style={{ fontSize: '11px', fontWeight: 500, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                      Total Units
                    </text>
                  </svg>
                </div>
              </div>

              {/* MODEL COST BREAKDOWN GRID */}
              <div className="section-divider" style={{ margin: '20px 0' }} />
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-bright)', fontWeight: 600 }}>Optimized Cost Breakdown</h4>
              <div className="grid-3" style={{ gap: '15px' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <DollarSign size={14} style={{ color: 'var(--success)' }} />
                    <span>Landed Cargo Cost</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-bright)' }}>{fmt(optimizationResults.solution.landedCost)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Base Price + Tariffs + Freight</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <Activity size={14} style={{ color: 'var(--warning)' }} />
                    <span>Inventory Holding Cost</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-bright)' }}>{fmt(optimizationResults.solution.holdingCost + optimizationResults.solution.safetyStockCost)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Cycle Stock + Safety Stock Cost</div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                    <ShieldAlert size={14} style={{ color: 'var(--tm-red)' }} />
                    <span>Risk Cost Penalty</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-bright)' }}>{fmt(optimizationResults.solution.riskPenalty)}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Supplier Risk + Corridor Threats</div>
                </div>
              </div>

              {/* Total suggestion cost details */}
              <div style={{
                background: 'var(--accent-gradient-subtle)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                marginTop: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block' }}>Estimated Total Landed + Risk Cost</span>
                  <span style={{ fontSize: '20px', fontWeight: 850, color: 'var(--text-bright)' }}>{fmt(optimizationResults.solution.totalCost)}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Weighted Delivery Time</span>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--info)' }}>
                    {optimizationResults.solution.supplierDetails.reduce((sum, s) => sum + s.leadTimeDays * (s.qty / totalDemand), 0).toFixed(1)} days
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DEMAND SENSING INTERACTIVE CHART */}
          {activeResultTab === 'charts' && optimizationResults && selectedProduct && (
            <div className="glass-card mb-0 animate-slide-up">
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--text-bright)', fontWeight: 700 }}>Demand Sensing & Stock Projections</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Daily consumption pattern showing historical cycles and future coverage forecast.</p>

              {/* SVG CUSTOM AREA CHART */}
              <div style={{ position: 'relative' }}>
                <svg width="100%" height="220" viewBox="0 0 600 220" style={{ overflow: 'visible' }}>
                  {/* Grid Lines */}
                  <line x1="40" y1="20" x2="580" y2="20" stroke="var(--border-subtle)" strokeDasharray="3 3" />
                  <line x1="40" y1="70" x2="580" y2="70" stroke="var(--border-subtle)" strokeDasharray="3 3" />
                  <line x1="40" y1="120" x2="580" y2="120" stroke="var(--border-subtle)" strokeDasharray="3 3" />
                  <line x1="40" y1="170" x2="580" y2="170" stroke="var(--border-subtle)" strokeDasharray="3 3" />
                  <line x1="40" y1="190" x2="580" y2="190" stroke="var(--border-medium)" /> {/* X Axis */}
                  
                  {/* Y Axis Labels */}
                  <text x="32" y="24" textAnchor="end" fill="var(--text-muted)" style={{ fontSize: '10px' }}>High</text>
                  <text x="32" y="100" textAnchor="end" fill="var(--text-muted)" style={{ fontSize: '10px' }}>Med</text>
                  <text x="32" y="174" textAnchor="end" fill="var(--text-muted)" style={{ fontSize: '10px' }}>Low</text>
                  <text x="32" y="194" textAnchor="end" fill="var(--text-muted)" style={{ fontSize: '10px' }}>0</text>
                  
                  {(() => {
                    const points = demandSensingData;
                    if (points.length === 0) return null;
                    
                    const minX = -30;
                    const maxX = 15;
                    const mapX = (x) => 40 + ((x - minX) / (maxX - minX)) * 540;
                    
                    // Find max stock for scaling
                    const maxStock = Math.max(
                      ...points.map(p => p.historicalStock || 0),
                      ...points.map(p => p.projectedWithOrder || 0),
                      selectedProduct.safetyStock + 20
                    ) * 1.1;
                    
                    const mapY = (y) => 190 - (y / maxStock) * 170;

                    // Draw Horizontal Limits: SS & ROP
                    const ssY = mapY(selectedProduct.safetyStock);
                    const ropVal = (dailyUse * 20) + selectedProduct.safetyStock;
                    const ropY = mapY(ropVal);
                    
                    // Today Vertical Line
                    const todayX = mapX(0);

                    // Build Historical Stock Path (Area & Line)
                    const histPoints = points.filter(p => p.dayVal <= 0);
                    let areaPath = `M ${mapX(histPoints[0].dayVal)} 190`;
                    let linePath = `M`;
                    histPoints.forEach((p, idx) => {
                      const px = mapX(p.dayVal);
                      const py = mapY(p.historicalStock);
                      areaPath += ` L ${px} ${py}`;
                      linePath += ` ${idx === 0 ? '' : 'L'} ${px} ${py}`;
                    });
                    areaPath += ` L ${mapX(0)} 190 Z`;

                    // Build Projections
                    const projPoints = points.filter(p => p.dayVal >= 0);
                    
                    // Do Nothing Projection (Red)
                    let pathNoOrder = `M`;
                    projPoints.forEach((p, idx) => {
                      pathNoOrder += ` ${idx === 0 ? '' : 'L'} ${mapX(p.dayVal)} ${mapY(p.projectedNoOrder)}`;
                    });

                    // Optimized Order Projection (Green)
                    let pathWithOrder = `M`;
                    projPoints.forEach((p, idx) => {
                      pathWithOrder += ` ${idx === 0 ? '' : 'L'} ${mapX(p.dayVal)} ${mapY(p.projectedWithOrder)}`;
                    });

                    return (
                      <g>
                        {/* Define Area Gradient */}
                        <defs>
                          <linearGradient id="chartAreaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--tm-red)" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="var(--tm-red)" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        {/* Safety Stock Threshold line */}
                        <line x1="40" y1={ssY} x2="580" y2={ssY} stroke="var(--warning)" strokeWidth="1.5" strokeDasharray="4 4" />
                        <text x="50" y={ssY - 5} fill="var(--warning)" style={{ fontSize: '9px', fontWeight: 600 }}>Safety Stock ({selectedProduct.safetyStock})</text>

                        {/* Reorder Point line */}
                        <line x1="40" y1={ropY} x2="580" y2={ropY} stroke="var(--danger)" strokeWidth="1.5" strokeDasharray="4 4" />
                        <text x="50" y={ropY - 5} fill="var(--danger)" style={{ fontSize: '9px', fontWeight: 600 }}>Reorder Point ({Math.round(ropVal)})</text>

                        {/* Today Vertical marker */}
                        <line x1={todayX} y1="15" x2={todayX} y2="190" stroke="var(--info)" strokeWidth="1.5" strokeDasharray="3 3" />
                        <text x={todayX + 5} y="25" fill="var(--info)" style={{ fontSize: '10px', fontWeight: 700 }}>TODAY</text>

                        {/* Draw Historical Area */}
                        <path d={areaPath} fill="url(#chartAreaGrad)" />
                        
                        {/* Draw Historical Line */}
                        <path d={linePath} fill="none" stroke="var(--tm-red)" strokeWidth="2.5" />

                        {/* Draw Projections */}
                        <path d={pathNoOrder} fill="none" stroke="var(--danger)" strokeWidth="2.5" strokeDasharray="4 4" />
                        <path d={pathWithOrder} fill="none" stroke="var(--success)" strokeWidth="2.5" strokeDasharray="4 4" />

                        {/* Interactive Invisible hover zones for tooltips */}
                        {points.map((p, idx) => {
                          const px = mapX(p.dayVal);
                          return (
                            <rect
                              key={`hover-${idx}`}
                              x={px - 6}
                              y="15"
                              width="12"
                              height="175"
                              fill="transparent"
                              style={{ cursor: 'pointer' }}
                              onMouseEnter={() => {
                                setChartTooltip({
                                  day: p.dayVal,
                                  stock: p.historicalStock !== null ? p.historicalStock : null,
                                  noOrder: p.projectedNoOrder !== null ? p.projectedNoOrder : null,
                                  withOrder: p.projectedWithOrder !== null ? p.projectedWithOrder : null,
                                  demand: p.demand,
                                  x: px,
                                  y: p.historicalStock !== null ? mapY(p.historicalStock) : mapY(p.projectedWithOrder)
                                });
                              }}
                              onMouseLeave={() => setChartTooltip(null)}
                            />
                          );
                        })}
                      </g>
                    );
                  })()}
                </svg>

                {/* Custom Chart Tooltip */}
                {chartTooltip && (
                  <div style={{
                    position: 'absolute',
                    top: `${chartTooltip.y - 85}px`,
                    left: `${Math.min(450, Math.max(50, chartTooltip.x - 70))}px`,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-strong)',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    color: 'var(--text-primary)',
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 20,
                    pointerEvents: 'none'
                  }}>
                    <div style={{ fontWeight: 700, borderBottom: '1px solid var(--border-subtle)', paddingBottom: '3px', marginBottom: '4px' }}>
                      {chartTooltip.day === 0 ? 'Today' : chartTooltip.day > 0 ? `Day +${chartTooltip.day}` : `Day ${chartTooltip.day}`}
                    </div>
                    {chartTooltip.stock !== null && <div>Stock Level: <strong style={{ color: 'var(--tm-red)' }}>{chartTooltip.stock} units</strong></div>}
                    {chartTooltip.noOrder !== null && <div>No Action Stock: <strong style={{ color: 'var(--danger)' }}>{chartTooltip.noOrder} units</strong></div>}
                    {chartTooltip.withOrder !== null && <div>Optimized Stock: <strong style={{ color: 'var(--success)' }}>{chartTooltip.withOrder} units</strong></div>}
                    <div>Daily Demand: <span>{chartTooltip.demand} units</span></div>
                  </div>
                )}
              </div>

              {/* Chart Legend */}
              <div style={{ display: 'flex', gap: '15px', justifyContent: 'center', marginTop: '15px', flexWrap: 'wrap', fontSize: '11px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', background: 'var(--tm-red)', display: 'inline-block' }} />
                  Historical stock level
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', borderTop: '3px dashed var(--danger)', display: 'inline-block' }} />
                  Projection (Do Nothing)
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '12px', height: '3px', borderTop: '3px dashed var(--success)', display: 'inline-block' }} />
                  Projection (Optimized Split Reorder)
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: STRATEGIES COMPASS CHART */}
          {activeResultTab === 'strategies' && optimizationResults && selectedProduct && (
            <div className="glass-card mb-0 animate-slide-up" style={{ overflowX: 'auto' }}>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', color: 'var(--text-bright)', fontWeight: 700 }}>Sourcing Strategy Comparison</h3>
              <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-muted)' }}>Comparison of optimized outcomes against default and extreme procurement scenarios.</p>

              <table className="master-data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
                    <th style={{ padding: '10px 8px' }}>Strategy Path</th>
                    <th style={{ padding: '10px 8px' }}>Allocations</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Landed Cost</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Holding Cost</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Risk Cost</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Total Cost</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Avg Lead Time</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Reliability</th>
                  </tr>
                </thead>
                <tbody>
                  {strategyComparison.map((strat, idx) => (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: '1px solid var(--border-subtle)',
                        background: strat.isOpt ? 'var(--accent-gradient-subtle)' : 'transparent',
                        fontWeight: strat.isOpt ? 700 : 'normal'
                      }}
                    >
                      <td style={{ padding: '12px 8px', color: strat.isOpt ? 'var(--text-accent)' : 'var(--text-bright)' }}>
                        {strat.name}
                        {strat.isOpt && <span className="badge success" style={{ marginLeft: '6px', fontSize: '8px', padding: '1px 4px' }}>Optimal</span>}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-secondary)', minWidth: '220px' }} title={strat.allocations}>
                        {strat.allocations}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>{fmt(strat.landedCost)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>{fmt(strat.holdingCost)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: strat.riskPenalty > 500 ? 'var(--danger)' : 'var(--text-primary)' }}>{fmt(strat.riskPenalty)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 800, color: strat.isOpt ? 'var(--success)' : 'var(--text-bright)' }}>
                        {fmt(strat.totalCost)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>{strat.avgLeadTime.toFixed(1)} days</td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span className={`badge ${strat.avgReliability >= 93 ? 'success' : 'warning'}`} style={{ fontSize: '10px' }}>
                          {strat.avgReliability.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>

      {/* ═══ BOTTOM LAYER: RFP DRAFTING & ERP INTEGRATION PREVIEW ═══ */}
      <div className="grid-2">
        
        {/* RFP DRAFTING & EXPORT PREVIEW */}
        <div className="glass-card">
          <div className="card-title">
            <FileText size={18} className="icon" />
            RFP Draft Requisition (Demo Suggestion)
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary" onClick={handleCopyRFP} style={{ padding: '4px 10px', fontSize: '11px' }}>
                {copiedRFP ? 'Copied!' : 'Copy Text'}
              </button>
              <button className="btn btn-primary" onClick={handleDownloadRFP} style={{ padding: '4px 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Download size={12} /> Download .txt
              </button>
            </div>
          </div>
          
          <textarea
            className="form-input"
            value={rfpTextDraft}
            readOnly
            style={{
              fontFamily: 'monospace',
              fontSize: '11px',
              height: '180px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-secondary)',
              resize: 'none',
              lineHeight: '1.4'
            }}
          />
        </div>

        {/* ERP & S&OP INTEGRATION CONNECTIVITY */}
        <div className="glass-card">
          <div className="card-title">
            <Database size={18} className="icon" />
            Enterprise ERP & S&OP Consensus Sync
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* Status badges */}
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                <span style={{ color: 'var(--text-secondary)' }}>SAP S/4HANA:</span>
                <strong style={{ color: 'var(--text-bright)' }}>CONNECTED</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', display: 'inline-block' }} />
                <span style={{ color: 'var(--text-secondary)' }}>Consensus S&OP Plan:</span>
                <strong style={{ color: 'var(--text-bright)' }}>CONNECTED</strong>
              </div>
            </div>

            {/* Sync Progress log screen */}
            <div style={{
              background: '#0a0c10',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-sm)',
              padding: '12px 14px',
              fontFamily: 'monospace',
              fontSize: '11px',
              color: '#34d399',
              height: '110px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px'
            }}>
              {erpLog.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>&gt; Ready to execute procurement requisition sync...</span>
              ) : (
                erpLog.map((log, lIdx) => <div key={lIdx}>{log}</div>)
              )}
            </div>

            {/* Sync Progress Bar */}
            {erpSyncStatus === 'SYNCING' && (
              <div style={{ width: '100%', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ width: `${erpSyncProgress}%`, height: '100%', background: 'var(--tm-red)', transition: 'width 0.4s ease' }} />
              </div>
            )}

            {/* Success message banner */}
            {erpSyncStatus === 'SUCCESS' && sapPrId && (
              <div style={{
                background: 'var(--success-bg)',
                border: '1px solid var(--success-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: 'var(--success)'
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle2 size={14} />
                  <span>SAP Requisition Transmitted Successfully</span>
                </span>
                <strong style={{ fontFamily: 'monospace' }}>ID: {sapPrId}</strong>
              </div>
            )}

            {/* Execution action button */}
            <button
              className="btn btn-primary"
              disabled={erpSyncStatus === 'SYNCING' || erpSyncStatus === 'SUCCESS'}
              onClick={handleSyncToSAP}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                height: '42px',
                background: erpSyncStatus === 'SUCCESS' ? 'var(--success)' : 'var(--accent-gradient)',
                borderColor: erpSyncStatus === 'SUCCESS' ? 'var(--success-border)' : 'transparent',
                cursor: (erpSyncStatus === 'SYNCING' || erpSyncStatus === 'SUCCESS') ? 'not-allowed' : 'pointer'
              }}
            >
              {erpSyncStatus === 'SYNCING' ? (
                <>
                  <RefreshCw size={15} className="tm-spin" /> Synchronizing Requisitions...
                </>
              ) : erpSyncStatus === 'SUCCESS' ? (
                <>
                  <CheckCircle2 size={15} /> Consensus Requisition Released
                </>
              ) : (
                <>
                  <Send size={15} /> Execute ERP Purchase Requisition
                </>
              )}
            </button>

          </div>
        </div>

      </div>

    </div>
  );
}
