import { useState, useMemo, useRef, useEffect } from 'react';
import { Layers, ShieldAlert, DollarSign, Activity, AlertTriangle, Filter, CheckCircle2, Calculator, HelpCircle } from 'lucide-react';
import { fetchRiskRecords, fetchRiskDetails } from '../services/dataService.js';
import { formatCurrency } from '../services/exchangeRateService.js';

const DEFAULT_WEIGHTS_A = {
  p1_invLevel: 0.08,
  p2_daysOfSupply: 0.15,
  p3_safetyStock: 0.12,
  p4_leadTime: 0.15,
  p5_supplierDep: 0.18,
  p6_criticality: 0.12,
  p7_tariffNews: 0.10,
  p8_corridorNews: 0.10,
};

const DEFAULT_WEIGHTS_B = {
  p1_invLevel: 0.09,
  p2_daysOfSupply: 0.17,
  p3_safetyStock: 0.14,
  p4_leadTime: 0.17,
  p5_supplierDep: 0.20,
  p7_tariffNews: 0.115,
  p8_corridorNews: 0.115,
};

const DEFAULT_THRESHOLDS = {
  p1_safe: 1.2,
  p1_crit: 0.5,
  p4_safe: 15,
  p4_crit: 45,
  p5_otifTarget: 0.98,
  p5_otifFloor: 0.80,
  p2_safeMultiplier: 2.0,
  p2_critMultiplier: 1.0,
};


const CustomizedTreemapContent = (props) => {
  const { x, y, width, height, index, payload, name, value, currency, onClick, depth } = props;
  const isLeaf = !props.children || props.children.length === 0;
  if (!isLeaf) return null;
  if (!payload || width < 25 || height < 15) return null;

  const riskValue = payload.riskValue || 1.0;
  const riskLevel = payload.riskLevel || 'Low';

  // Sourced exact premium colors from the reference slide
  // Left: Red/brown, Middle: Mustard/yellow/tan, Right: Forest/olive green
  let bgColor = '#3f6212'; // Default Low Risk (forest olive green)
  
  if (riskLevel === 'Critical') {
    bgColor = '#a82b2b'; // Critical Risk (rust/red)
  } else if (riskLevel === 'Medium') {
    bgColor = '#dbaf58'; // Medium Risk (warm tan/mustard)
  }

  // Adjust for light theme specifically if active
  const isLightTheme = document.documentElement.classList.contains('light-theme');
  
  return (
    <g onClick={() => onClick && onClick(payload)} style={{ cursor: 'pointer' }}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: bgColor,
          stroke: isLightTheme ? '#ffffff' : 'var(--bg-secondary)',
          strokeWidth: 2,
        }}
        className="treemap-rect"
      />
      {width > 35 && height > 25 && (
        <foreignObject x={x + 3} y={y + 3} width={width - 6} height={height - 6}>
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              color: '#ffffff',
              fontFamily: "'Inter', sans-serif",
              textAlign: 'center',
              overflow: 'hidden',
              boxSizing: 'border-box',
              pointerEvents: 'none', // Prevents capturing hover events so rect hover works smoothly
              textShadow: '0 1.5px 3px rgba(0, 0, 0, 0.75)'
            }}
          >
            {/* Title text */}
            <div
              style={{
                fontWeight: 800,
                fontSize: width > 130 ? '14px' : width > 80 ? '11px' : '9px',
                lineHeight: 1.15,
                width: '100%',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: height > 60 ? 3 : 2,
                WebkitBoxOrient: 'vertical',
                marginBottom: '2px'
              }}
            >
              {name}
            </div>
            {/* Value text */}
            {height > 45 && (
              <div
                style={{
                  fontWeight: 800,
                  fontSize: width > 130 ? '16px' : width > 80 ? '12px' : '10px',
                  opacity: 0.95
                }}
              >
                {payload.formattedValue}
              </div>
            )}
            {/* Code/Tag */}
            {width > 90 && height > 75 && (
              <div
                style={{
                  fontSize: '8.5px',
                  fontWeight: 700,
                  marginTop: '4px',
                  background: 'rgba(0, 0, 0, 0.25)',
                  padding: '2px 5px',
                  borderRadius: '3px',
                  letterSpacing: '0.3px',
                  textTransform: 'uppercase'
                }}
              >
                {payload.erpCode || `${payload.sdeClass}*${payload.vedClass}`}
              </div>
            )}
          </div>
        </foreignObject>
      )}
    </g>
  );
};

const CustomTreemapTooltip = ({ active, payload, treemapGroup }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    
    let riskColor = 'var(--success)';
    if (data.riskLevel === 'Critical') riskColor = 'var(--danger)';
    else if (data.riskLevel === 'Medium') riskColor = 'var(--warning)';

    return (
      <div 
        className="glass-card" 
        style={{ 
          padding: '14px', 
          border: '1px solid var(--border-strong)', 
          background: 'var(--bg-secondary)', 
          boxShadow: 'var(--shadow-xl)',
          borderRadius: 'var(--radius-md)',
          maxWidth: '280px',
          backdropFilter: 'blur(10px)'
        }}
      >
        <div style={{ fontWeight: 700, color: 'var(--text-bright)', fontSize: '13px', marginBottom: '4px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {data.name}
        </div>
        
        {data.erpCode && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '8px' }}>
            ERP: {data.erpCode} · Category: {data.category}
          </div>
        )}
        
        {!data.erpCode && (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
            Segment: {treemapGroup === 'country' ? 'Sourcing Country' : treemapGroup === 'category' ? 'Product Category' : 'SDE-VED Cell'}
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Inventory Value:</span>
            <span style={{ fontWeight: 700, color: 'var(--success)' }}>{data.formattedValue}</span>
          </div>
          
          <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Sourcing SDE*VED:</span>
            <span style={{ fontWeight: 700, color: riskColor }}>
              {data.riskValue.toFixed(1)} ({data.sdeClass}*{data.vedClass})
            </span>
          </div>

          <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Risk Level:</span>
            <span style={{ fontWeight: 700, color: riskColor, textTransform: 'uppercase', fontSize: '11px' }}>
              {data.riskLevel}
            </span>
          </div>

          {data.itemsCount > 1 && (
            <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Components Count:</span>
              <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{data.itemsCount} items</span>
            </div>
          )}
          
          {data.maxLeadTime && (
            <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Max Lead Time:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{data.maxLeadTime} days</span>
            </div>
          )}

          {data.numSuppliers && (
            <div style={{ fontSize: '12px', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Suppliers:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{data.numSuppliers} active</span>
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// Proportional Binary Tree Partitioning Layout Algorithm for custom HTML Treemap
function computeTreemapLayout(items, x, y, width, height) {
  if (!items || items.length === 0) return [];
  if (items.length === 1) {
    return [{ ...items[0], x, y, w: width, h: height }];
  }
  
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) {
    const count = items.length;
    if (width > height) {
      const w1 = width / count;
      return items.map((item, i) => ({ ...item, x: x + i * w1, y, w: w1, h: height }));
    } else {
      const h1 = height / count;
      return items.map((item, i) => ({ ...item, x, y: y + i * h1, w: width, h: h1 }));
    }
  }
  
  let leftSum = 0;
  let splitIndex = 0;
  let minDiff = Infinity;
  for (let i = 0; i < items.length - 1; i++) {
    leftSum += items[i].value;
    const diff = Math.abs(leftSum - total / 2);
    if (diff < minDiff) {
      minDiff = diff;
      splitIndex = i + 1;
    }
  }
  if (splitIndex === 0) splitIndex = 1;
  
  const leftGroup = items.slice(0, splitIndex);
  const rightGroup = items.slice(splitIndex);
  
  const leftVal = leftGroup.reduce((sum, item) => sum + item.value, 0);
  const leftRatio = leftVal / total;
  
  if (width > height) {
    const w1 = width * leftRatio;
    return [
      ...computeTreemapLayout(leftGroup, x, y, w1, height),
      ...computeTreemapLayout(rightGroup, x + w1, y, width - w1, height)
    ];
  } else {
    const h1 = height * leftRatio;
    return [
      ...computeTreemapLayout(leftGroup, x, y, width, h1),
      ...computeTreemapLayout(rightGroup, x, y + h1, width, height - h1)
    ];
  }
}

export default function RiskEngine({ currency, convertAmount, products, suppliers }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCell, setSelectedCell] = useState(null); // format: { sde: 'S', ved: 'V' }
  const [riskFilter, setRiskFilter] = useState('All');
  const [viewMode, setViewMode] = useState('treemap'); // 'treemap' (default) or 'matrix'
  const [treemapGroup, setTreemapGroup] = useState('product'); // 'product' (default), 'country', 'category', 'cell'

  // --- Advanced 0-100 Risk Model State ---
  const [activeModel, setActiveModel] = useState('ModelB'); // 'ModelB' (Likelihood * Impact) or 'ModelA' (Weighted Sum)
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  const [showCalculationDetails, setShowCalculationDetails] = useState(false);

  // States for backend custom risk calculations
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [calcDetails, setCalcDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Custom multi-criteria Option B scoring rubric states
  const [optionBAnswers, setOptionBAnswers] = useState({}); // { erpCode: [4, 4, 3, 4] }
  const [showWeightsConfig, setShowWeightsConfig] = useState(false);

  const [config, setConfig] = useState({
    weightsA: { ...DEFAULT_WEIGHTS_A },
    weightsB: { ...DEFAULT_WEIGHTS_B },
    thresholds: { ...DEFAULT_THRESHOLDS },
    criticalityOverride: {},
    tariffOverride: {},
    corridorOverride: {}
  });

  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 450, height: 260 });
  const [hoveredCard, setHoveredCard] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });



  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: width || 450,
          height: height || 260
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Fetch custom risk reports from backend on config changes
  useEffect(() => {
    let active = true;
    const loadRiskData = async () => {
      try {
        setLoading(true);
        const data = await fetchRiskRecords(config);
        if (active) {
          setRecords(data.records);
          setSummary(data.summary);
        }
      } catch (err) {
        console.error('Failed to fetch custom risk reports:', err);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadRiskData();
    return () => { active = false; };
  }, [config, products, suppliers]);

  // Format currencies helper
  const fmt = (amount) => formatCurrency(convertAmount(amount), currency);



  // Treemap grouped data processing (Hierarchical tree structure)
  const treemapData = useMemo(() => {
    if (treemapGroup === 'product') {
      // Group products by their Category (Parent-Child hierarchy)
      const categoryGroups = {};
      records.forEach(r => {
        const val = convertAmount(r.inventoryValue);
        if (val <= 0) return;
        const cat = r.category || 'Other';
        if (!categoryGroups[cat]) {
          categoryGroups[cat] = { name: cat, children: [] };
        }
        categoryGroups[cat].children.push({
          name: r.description,
          erpCode: r.erpCode,
          value: val,
          riskValue: r.scoreFinal,
          riskLevel: r.riskBand,
          formattedValue: formatCurrency(val, currency),
          itemsCount: 1,
          sdeClass: r.sdeClass,
          vedClass: r.vedClass,
          category: r.category,
          maxLeadTime: r.maxLeadTime,
          numSuppliers: r.numSuppliers
        });
      });
      // Sort parent categories by total value
      return Object.values(categoryGroups).sort((a, b) => {
        const valA = a.children.reduce((sum, c) => sum + c.value, 0);
        const valB = b.children.reduce((sum, c) => sum + c.value, 0);
        return valB - valA;
      });
    }

    if (treemapGroup === 'category') {
      // Wrap categories in a single dummy parent categories node
      const parentGroup = { name: 'Classified Categories', children: [] };
      const categoryValues = {};
      
      records.forEach(r => {
        const cat = r.category || 'Other';
        const val = convertAmount(r.inventoryValue);
        if (val <= 0) return;
        if (!categoryValues[cat]) {
          categoryValues[cat] = { name: cat, value: 0, weightedRisk: 0, itemsCount: 0 };
        }
        categoryValues[cat].value += val;
        categoryValues[cat].weightedRisk += r.scoreFinal * val;
        categoryValues[cat].itemsCount++;
      });

      parentGroup.children = Object.values(categoryValues).map(c => {
        const avgRisk = c.value > 0 ? c.weightedRisk / c.value : 0;
        let riskLevel = 'Low';
        if (avgRisk > 75) riskLevel = 'Critical';
        else if (avgRisk > 50) riskLevel = 'High';
        else if (avgRisk > 25) riskLevel = 'Moderate';
        
        return {
          name: c.name,
          value: c.value,
          riskValue: avgRisk,
          riskLevel: riskLevel,
          formattedValue: formatCurrency(c.value, currency),
          itemsCount: c.itemsCount,
          sdeClass: avgRisk > 75 ? 'S' : avgRisk > 35 ? 'D' : 'E',
          vedClass: avgRisk > 75 ? 'V' : avgRisk > 35 ? 'E' : 'D'
        };
      }).filter(x => x.value > 0).sort((a, b) => b.value - a.value);

      return [parentGroup];
    }

    if (treemapGroup === 'country') {
      // Group countries by geographic Region (Parent-Child hierarchy)
      const regionGroups = {};
      records.forEach(r => {
        const suppliers = r.suppliers || [];
        if (suppliers.length === 0) {
          const region = 'Asia';
          const country = 'India';
          const val = convertAmount(r.inventoryValue);
          if (val <= 0) return;
          
          if (!regionGroups[region]) {
            regionGroups[region] = { name: region, children: [] };
          }
          let cNode = regionGroups[region].children.find(c => c.name === country);
          if (!cNode) {
            cNode = { name: country, value: 0, weightedRisk: 0, itemsCount: 0 };
            regionGroups[region].children.push(cNode);
          }
          cNode.value += val;
          cNode.weightedRisk += r.scoreFinal * val;
          cNode.itemsCount++;
        } else {
          suppliers.forEach(s => {
            const region = s.region || 'Asia';
            const country = s.country;
            const pct = s.supplyPct || 100;
            const val = convertAmount(r.inventoryValue) * (pct / 100);
            if (val <= 0) return;
            
            if (!regionGroups[region]) {
              regionGroups[region] = { name: region, children: [] };
            }
            let cNode = regionGroups[region].children.find(c => c.name === country);
            if (!cNode) {
              cNode = { name: country, value: 0, weightedRisk: 0, itemsCount: 0 };
              regionGroups[region].children.push(cNode);
            }
            cNode.value += val;
            cNode.weightedRisk += r.scoreFinal * val;
            cNode.itemsCount++;
          });
        }
      });

      // Compute average risk and format labels
      Object.values(regionGroups).forEach(reg => {
        reg.children.forEach(c => {
          const avgRisk = c.value > 0 ? c.weightedRisk / c.value : 0;
          c.riskValue = avgRisk;
          c.riskLevel = avgRisk > 75 ? 'Critical' : avgRisk > 50 ? 'High' : avgRisk > 25 ? 'Moderate' : 'Low';
          c.formattedValue = formatCurrency(c.value, currency);
          c.sdeClass = avgRisk > 75 ? 'S' : avgRisk > 35 ? 'D' : 'E';
          c.vedClass = avgRisk > 75 ? 'V' : avgRisk > 35 ? 'E' : 'D';
        });
        reg.children = reg.children.filter(c => c.value > 0);
      });

      return Object.values(regionGroups).filter(reg => reg.children.length > 0);
    }

    if (treemapGroup === 'cell') {
      // Group SDE-VED cells by SDE Class (Parent-Child hierarchy)
      const sdeGroups = {};
      records.forEach(r => {
        const sde = r.sdeClass || 'E';
        const sdeName = sde === 'S' ? 'Scarce (S)' : sde === 'D' ? 'Difficult (D)' : 'Easy (E)';
        const key = `${r.sdeClass}-${r.vedClass}`;
        const val = convertAmount(r.inventoryValue);
        if (val <= 0) return;

        if (!sdeGroups[sdeName]) {
          sdeGroups[sdeName] = { name: sdeName, children: [] };
        }
        
        let cNode = sdeGroups[sdeName].children.find(c => c.cellKey === key);
        if (!cNode) {
          cNode = { 
            cellKey: key,
            name: `${sdeName.split(' ')[0]} · ${r.vedClass === 'V' ? 'Vital' : r.vedClass === 'E' ? 'Essential' : 'Desirable'} (${key})`,
            value: 0,
            riskValue: r.scoreFinal,
            riskLevel: r.riskBand,
            itemsCount: 0,
            sdeClass: r.sdeClass,
            vedClass: r.vedClass
          };
          sdeGroups[sdeName].children.push(cNode);
        }
        cNode.value += val;
        cNode.itemsCount++;
      });

      Object.values(sdeGroups).forEach(group => {
        group.children.forEach(c => {
          c.formattedValue = formatCurrency(c.value, currency);
        });
        group.children = group.children.filter(c => c.value > 0);
      });

      return Object.values(sdeGroups).filter(group => group.children.length > 0);
    }

    return [];
  }, [records, treemapGroup, convertAmount, currency]);

  const handleTreemapClick = (node) => {
    if (!node) return;
    
    if (treemapGroup === 'product') {
      // Toggle ERP code search
      setSearchTerm(prev => prev === node.erpCode ? '' : node.erpCode);
      setSelectedCell(null);
    } else if (treemapGroup === 'category') {
      // Toggle category search
      setSearchTerm(prev => prev === node.name ? '' : node.name);
      setSelectedCell(null);
    } else if (treemapGroup === 'country') {
      // Toggle country search
      setSearchTerm(prev => prev === node.name ? '' : node.name);
      setSelectedCell(null);
    } else if (treemapGroup === 'cell') {
      // Toggle cell selection
      const sde = node.sdeClass;
      const ved = node.vedClass;
      if (sde && ved) {
        setSelectedCell(prev => prev && prev.sde === sde && prev.ved === ved ? null : { sde, ved });
        setSearchTerm('');
      }
    }
  };

  // 3x3 Matrix data definition
  // SDE columns (Scarce, Difficult, Easy)
  // VED rows (Vital, Essential, Desirable)
  const columns = ['S', 'D', 'E'];
  const rows = ['V', 'E', 'D'];

  // Calculate sourcing/criticality column & row dollar shares for Marimekko grid sizing
  const colWidths = useMemo(() => {
    const colValues = columns.map(c => 
      records.filter(p => p.sdeClass === c).reduce((sum, p) => sum + p.inventoryValue, 0)
    );
    const colTotal = colValues.reduce((a, b) => a + b, 0) || 1;
    // Distribute with a healthy minimum unit weight of 1.0 to prevent columns from collapsing
    return colValues.map(v => 1.0 + (v / colTotal) * 2.5);
  }, [records]);

  const rowHeights = useMemo(() => {
    const rowValues = rows.map(r => 
      records.filter(p => p.vedClass === r).reduce((sum, p) => sum + p.inventoryValue, 0)
    );
    const rowTotal = rowValues.reduce((a, b) => a + b, 0) || 1;
    // Distribute with a healthy minimum unit weight of 1.0 to prevent rows from squashing
    return rowValues.map(v => 1.0 + (v / rowTotal) * 2.5);
  }, [records]);

  const getCellHeightsForColumn = (col) => {
    const vVal = records.filter(p => p.sdeClass === col && p.vedClass === 'V').reduce((sum, p) => sum + p.inventoryValue, 0);
    const eVal = records.filter(p => p.sdeClass === col && p.vedClass === 'E').reduce((sum, p) => sum + p.inventoryValue, 0);
    const dVal = records.filter(p => p.sdeClass === col && p.vedClass === 'D').reduce((sum, p) => sum + p.inventoryValue, 0);
    
    const total = vVal + eVal + dVal;
    if (total === 0) {
      return [1.0, 1.0, 1.0]; // Perfect flat equal heights if 0 value (keeps size uniform)
    }
    
    return [
      1.0 + (vVal / total) * 2.5,
      1.0 + (eVal / total) * 2.5,
      1.0 + (dVal / total) * 2.5
    ];
  };

  const getMatrixCellData = (sde, ved) => {
    const cellRecords = records.filter(r => r.sdeClass === sde && r.vedClass === ved);
    const count = cellRecords.length;
    const value = cellRecords.reduce((sum, r) => sum + r.inventoryValue, 0);
    
    // Determine risk level based on score: SDE (S=4.5/5, D=3/3.5, E=1/1.8) * VED (V=4.5, E=3, D=1.5)
    // S*V (e.g. 5 * 4.5 = 22.5) -> Critical
    // D*V (3.5 * 4.5 = 15.75) -> Critical
    // S*E (4.5 * 3.0 = 13.5) -> Medium
    // Let's use cell coordinates to color the matrix cells
    let colorClass = 'risk-low';
    if ((sde === 'S' && ved === 'V') || (sde === 'D' && ved === 'V') || (sde === 'S' && ved === 'E')) {
      colorClass = 'risk-critical';
    } else if ((sde === 'E' && ved === 'V') || (sde === 'D' && ved === 'E') || (sde === 'S' && ved === 'D')) {
      colorClass = 'risk-medium';
    }

    return { count, value, colorClass };
  };

  // Filtering products for the table
  const filteredProducts = useMemo(() => {
    let result = [...records];

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.erpCode.toLowerCase().includes(term) ||
        p.hsCode.includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term)
      );
    }

    // Interactive Heatmap cell filter
    if (selectedCell) {
      result = result.filter(p => p.sdeClass === selectedCell.sde && p.vedClass === selectedCell.ved);
    }

    // Risk quick filter tabs
    if (riskFilter !== 'All') {
      result = result.filter(p => p.riskBand === riskFilter);
    }

    return result;
  }, [records, searchTerm, selectedCell, riskFilter]);

  // Clear active filters
  const handleClearFilters = () => {
    setSelectedCell(null);
    setRiskFilter('All');
    setSearchTerm('');
  };



  // --- Modal Local State & Synchronization Effect ---
  const [localCriticality, setLocalCriticality] = useState(0.5);
  const [useOptionB, setUseOptionB] = useState(false);
  const [localOptionB, setLocalOptionB] = useState([3, 3, 3, 3]);
  const [localTariff, setLocalTariff] = useState({ severity: 0.4, probability: 0.6, relevance: 0.1 });
  const [localCorridor, setLocalCorridor] = useState({ severity: 0.4, probability: 0.5, persistence: 0.5, relevance: 0.1 });

  useEffect(() => {
    if (!selectedProductForModal) return;
    const p = selectedProductForModal;
    
    // Match current overridden or background criticality
    const existingCrit = config.criticalityOverride[p.erpCode];
    if (existingCrit !== undefined) {
      setLocalCriticality(existingCrit);
    } else {
      let baseCR = 0.5;
      const cat = String(p.category || '').toLowerCase();
      if (cat.includes('engine') || cat.includes('transmission') || cat.includes('drivetrain')) baseCR = 1.0;
      else if (cat.includes('brakes') || cat.includes('electrical') || cat.includes('fuel')) baseCR = 0.75;
      else if (cat.includes('suspension') || cat.includes('hvac')) baseCR = 0.50;
      else if (cat.includes('wheel') || cat.includes('tire') || cat.includes('body')) baseCR = 0.25;
      else baseCR = 0.10;
      setLocalCriticality(baseCR);
    }

    const answers = optionBAnswers[p.erpCode] || [3, 3, 3, 3];
    setLocalOptionB(answers);
    setUseOptionB(optionBAnswers[p.erpCode] !== undefined);

    const tariff = config.tariffOverride[p.erpCode] || p.rawMetrics?.tariffDetails || { severity: 0.4, probability: 0.6, relevance: 0.1 };
    setLocalTariff(tariff);

    const corridor = config.corridorOverride[p.erpCode] || p.rawMetrics?.corridorDetails || { severity: 0.4, probability: 0.5, persistence: 0.5, relevance: 0.1 };
    setLocalCorridor(corridor);
  }, [selectedProductForModal, config.criticalityOverride, config.tariffOverride, config.corridorOverride, optionBAnswers]);

  // Fetch detailed step-by-step mathematical explanation when sub-modal is open
  useEffect(() => {
    if (showCalculationDetails && selectedProductForModal && records.length > 0) {
      let active = true;
      const getDetails = async () => {
        try {
          setLoadingDetails(true);
          const p = records.find(r => r.erpCode === selectedProductForModal.erpCode) || selectedProductForModal;
          const details = await fetchRiskDetails({
            product: p,
            localCrit: localCriticality,
            localTar: localTariff,
            localCorr: localCorridor,
            config,
            activeModel
          });
          if (active) {
            setCalcDetails(details);
          }
        } catch (err) {
          console.error('Failed to get detailed calculation derivation:', err);
        } finally {
          if (active) setLoadingDetails(false);
        }
      };
      getDetails();
      return () => { active = false; };
    } else {
      setCalcDetails(null);
    }
  }, [showCalculationDetails, selectedProductForModal, localCriticality, localTariff, localCorridor, config, activeModel, records]);

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. KPIs */}
      <div className="kpi-grid stagger-children">
        <div className="kpi-card animate-scale-in">
          <div className="kpi-label">Total Classified Value</div>
          <div className="kpi-value">{fmt(summary.totalValue)}</div>
        </div>
        <div className="kpi-card animate-scale-in">
          <div className="kpi-label">Critical 0–100 Cash Risk</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>
            {fmt(summary.riskSegments.Critical.value)}
          </div>
        </div>
        <div className="kpi-card animate-scale-in">
          <div className="kpi-label">Avg Sourcing Risk Rating</div>
          <div className="kpi-value">{summary.avgRiskScore.toFixed(1)} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ 100</span></div>
        </div>
        <div className="kpi-card animate-scale-in">
          <div className="kpi-label">Critical Sourcing Components</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>
            {summary.riskSegments.Critical.count} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>items</span>
          </div>
        </div>
      </div>

      {/* Global Risk Model Config & Weight Calibration Panel */}
      <div className="glass-card animate-slide-up" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              🔧 Advanced 0-100 Risk Scoring Model calibration
            </h3>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
              Aggregate raw parameters into a single comparable scale using weighted average or likelihood × impact algorithms.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <button
                className={`tab ${activeModel === 'ModelB' ? 'active' : ''}`}
                onClick={() => setActiveModel('ModelB')}
                style={{
                  padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: 'var(--radius-sm)',
                  background: activeModel === 'ModelB' ? 'var(--accent-gradient)' : 'transparent',
                  color: activeModel === 'ModelB' ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer', fontWeight: 600, fontFamily: "'Inter', sans-serif"
                }}
              >
                Model B: Likelihood × Impact (Rec.)
              </button>
              <button
                className={`tab ${activeModel === 'ModelA' ? 'active' : ''}`}
                onClick={() => setActiveModel('ModelA')}
                style={{
                  padding: '5px 12px', fontSize: '12px', border: 'none', borderRadius: 'var(--radius-sm)',
                  background: activeModel === 'ModelA' ? 'var(--accent-gradient)' : 'transparent',
                  color: activeModel === 'ModelA' ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer', fontWeight: 600, fontFamily: "'Inter', sans-serif"
                }}
              >
                Model A: Weighted Sum
              </button>
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowWeightsConfig(!showWeightsConfig)}
            >
              {showWeightsConfig ? 'Hide Calibration' : 'Calibrate Parameters'}
            </button>
          </div>
        </div>

        {showWeightsConfig && (
          <div className="animate-slide-down" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', borderTop: '1px solid var(--border-subtle)', paddingTop: '14px', marginTop: '4px' }}>
            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                Normalized Parameter Weights (Model {activeModel === 'ModelA' ? 'A' : 'B'})
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {Object.keys(activeModel === 'ModelA' ? config.weightsA : config.weightsB).map(key => {
                  const label = key.replace('p', 'P').replace('_', ' ').replace('inv', 'Inventory ').replace('daysOfSupply', 'Days of Supply').replace('safetyStock', 'Safety Stock Shortfall').replace('leadTime', 'Effective Lead Time').replace('supplierDep', 'Supplier Dependence').replace('criticality', 'Inventory Criticality').replace('tariffNews', 'Tariff Changes (News)').replace('corridorNews', 'Corridor Threats (News)');
                  const currentWeights = activeModel === 'ModelA' ? config.weightsA : config.weightsB;
                  const currentVal = currentWeights[key];

                  return (
                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{(currentVal * 100).toFixed(1)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="0.5"
                        step="0.01"
                        value={currentVal}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setConfig(prev => {
                            const newWeights = activeModel === 'ModelA' ? { ...prev.weightsA, [key]: val } : { ...prev.weightsB, [key]: val };
                            const keys = Object.keys(newWeights);
                            const otherKeys = keys.filter(k => k !== key);
                            const sumOthers = otherKeys.reduce((s, k) => s + newWeights[k], 0);
                            const remainder = 1.0 - val;
                            if (sumOthers > 0 && remainder >= 0) {
                              otherKeys.forEach(k => {
                                newWeights[k] = (newWeights[k] / sumOthers) * remainder;
                              });
                            }
                            return activeModel === 'ModelA' ? { ...prev, weightsA: newWeights } : { ...prev, weightsB: newWeights };
                          });
                        }}
                        style={{ width: '100%', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', outline: 'none', cursor: 'pointer' }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '12px' }}>
                Operational Safe/Critical Threshold Bounds
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>P1 Safe Ratio (S)</label>
                    <input
                      type="number" step="0.1" className="form-input" style={{ padding: '6px' }}
                      value={config.thresholds.p1_safe}
                      onChange={e => setConfig(prev => ({ ...prev, thresholds: { ...prev.thresholds, p1_safe: parseFloat(e.target.value) || 1.2 } }))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>P1 Critical Ratio (C)</label>
                    <input
                      type="number" step="0.1" className="form-input" style={{ padding: '6px' }}
                      value={config.thresholds.p1_crit}
                      onChange={e => setConfig(prev => ({ ...prev, thresholds: { ...prev.thresholds, p1_crit: parseFloat(e.target.value) || 0.5 } }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>P4 Safe Lead Time (Days)</label>
                    <input
                      type="number" className="form-input" style={{ padding: '6px' }}
                      value={config.thresholds.p4_safe}
                      onChange={e => setConfig(prev => ({ ...prev, thresholds: { ...prev.thresholds, p4_safe: parseInt(e.target.value) || 15 } }))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>P4 Crit Lead Time (Days)</label>
                    <input
                      type="number" className="form-input" style={{ padding: '6px' }}
                      value={config.thresholds.p4_crit}
                      onChange={e => setConfig(prev => ({ ...prev, thresholds: { ...prev.thresholds, p4_crit: parseInt(e.target.value) || 45 } }))}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>P5 OTIF Target %</label>
                    <input
                      type="number" step="0.01" className="form-input" style={{ padding: '6px' }}
                      value={config.thresholds.p5_otifTarget}
                      onChange={e => setConfig(prev => ({ ...prev, thresholds: { ...prev.thresholds, p5_otifTarget: parseFloat(e.target.value) || 0.98 } }))}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px' }}>P5 OTIF Floor %</label>
                    <input
                      type="number" step="0.01" className="form-input" style={{ padding: '6px' }}
                      value={config.thresholds.p5_otifFloor}
                      onChange={e => setConfig(prev => ({ ...prev, thresholds: { ...prev.thresholds, p5_otifFloor: parseFloat(e.target.value) || 0.80 } }))}
                    />
                  </div>
                </div>

                <div style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', lineHeight: '1.4' }}>
                  💡 Parameters are normalized into a comparable 0-1 range. Threshold bounds specify the operational safety margin.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Detailed Records Table */}
      <div className="glass-card animate-slide-up">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div className="card-title" style={{ margin: 0 }}>
            <Layers size={18} className="icon" />
            Classified Inventory Details
            {selectedCell && (
              <span className="badge info" style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={10} /> SDE-{selectedCell.sde} & VED-{selectedCell.ved} Filtered
              </span>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* Quick Filter Tabs */}
            <div style={{ display: 'flex', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
              {['All', 'Critical', 'High', 'Moderate', 'Low'].map(r => (
                <button
                  key={r}
                  onClick={() => setRiskFilter(r)}
                  className={`tab ${riskFilter === r ? 'active' : ''}`}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    border: 'none',
                    borderRadius: 0,
                    background: riskFilter === r ? 'var(--accent-gradient)' : 'transparent',
                    color: riskFilter === r ? 'white' : 'var(--text-secondary)'
                  }}
                >
                  {r} ({r === 'All' ? records.length : records.filter(p => p.riskBand === r).length})
                </button>
              ))}
            </div>

            {(selectedCell || searchTerm || riskFilter !== 'All') && (
              <button className="btn btn-secondary btn-sm" onClick={handleClearFilters}>
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search classified components by code, category, or description..."
          className="form-input"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ marginBottom: '12px' }}
        />

        {/* Products List Table */}
        <div className="data-table-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ERP Code</th>
                <th>HS Code</th>
                <th>Category</th>
                <th>Description</th>
                <th>No. of Suppliers</th>
                <th>In-Hand</th>
                <th>SDE*VED Cell</th>
                <th>0–100 Risk Score</th>
                <th>Risk Band</th>
                <th>Lead Time</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                const activeScore = activeModel === 'ModelA' ? p.scoreA : p.scoreFinal;
                return (
                  <tr key={p.erpCode} style={{ background: selectedProductForModal?.erpCode === p.erpCode ? 'var(--accent-gradient-subtle)' : undefined }}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{p.erpCode}</td>
                    <td style={{ fontFamily: 'monospace' }}>{p.hsCode}</td>
                    <td><span className="badge neutral">{p.category}</span></td>
                    <td style={{ fontWeight: 500 }}>{p.description}</td>
                    <td style={{ fontWeight: 600 }}>{getSuppliersForProduct(p.erpCode).length}</td>
                    <td>{p.inHandInventory}</td>
                    
                    {/* Legacy SDE*VED Cell */}
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ marginRight: '6px' }}>{p.riskValue.toFixed(1)}</span>
                      <span className={`badge ${p.sdeClass === 'S' ? 'critical' : p.sdeClass === 'D' ? 'warning' : 'success'}`} style={{ fontSize: '10px', padding: '1px 4px' }}>
                        {p.sdeClass}
                      </span>
                      <span className={`badge ${p.vedClass === 'V' ? 'critical' : p.vedClass === 'E' ? 'warning' : 'success'}`} style={{ fontSize: '10px', padding: '1px 4px', marginLeft: '2px' }}>
                        {p.vedClass}
                      </span>
                    </td>

                    {/* Advanced 0-100 Score */}
                    <td style={{ 
                      fontWeight: 700, 
                      fontSize: '14.5px',
                      color: p.riskBand === 'Critical' ? 'var(--danger)' : p.riskBand === 'High' ? 'var(--warning)' : 'var(--success)' 
                    }}>
                      {activeScore.toFixed(1)}
                      {p.hasOverride && activeModel === 'ModelB' && (
                        <span style={{ fontSize: '11px', marginLeft: '4px', cursor: 'help' }} title="Non-compensatory floor override active">⚠️</span>
                      )}
                    </td>

                    {/* Risk Status Band */}
                    <td>
                      <span className={`badge ${p.riskBand === 'Critical' ? 'critical' : p.riskBand === 'High' ? 'warning' : p.riskBand === 'Moderate' ? 'neutral' : 'success'}`} style={{ fontWeight: 700 }}>
                        {p.riskBand}
                      </span>
                    </td>

                    <td>{p.maxLeadTime} days</td>
                    <td style={{ textAlign: 'center' }}>
                      <button 
                        className="btn btn-secondary btn-sm" 
                        onClick={() => setSelectedProductForModal(p)}
                        style={{ padding: '3px 8px', fontSize: '11px', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        ⚙️ Calibrate SKU
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                    No inventory records match the active filters or search terms.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Showing {filteredProducts.length} of {records.length} items classified by supply redundancy and comprehensive operational risk metrics.
        </div>

      </div>

      {/* --- Advanced SKU-Level Interactive Risk Calibration Modal --- */}
      {selectedProductForModal && (() => {
        const p = records.find(r => r.erpCode === selectedProductForModal.erpCode) || selectedProductForModal;
        const activeScore = activeModel === 'ModelA' ? p.scoreA : p.scoreFinal;
        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 2000, overflowY: 'auto', padding: '20px'
          }}>
            <div className="glass-card animate-scale-in" style={{
              width: '100%', maxWidth: '850px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-2xl)',
              borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column',
              maxHeight: '90vh', overflow: 'hidden', margin: 0
            }}>
              {/* Modal Header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-tertiary)'
              }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-bright)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    📊 Product Risk Calibration Sheet: <span style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{p.erpCode}</span>
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {p.description} (HS {p.hsCode})
                  </div>
                </div>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setSelectedProductForModal(null)}
                  style={{ padding: '6px 12px', minWidth: 0, borderRadius: '50%' }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Body */}
              <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
                
                {/* Top row: basic metrics summary */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>In-Hand Inventory</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)' }}>{p.inHandInventory} units</div>
                  </div>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Weighted Lead Time</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)' }}>{p.rawMetrics?.ltAvg?.toFixed(1) || p.maxLeadTime} days</div>
                  </div>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Daily Consump. (Derived)</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)' }}>{p.rawMetrics?.dailyUse?.toFixed(2) || '—'} units/d</div>
                  </div>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Reorder Point (ROP)</div>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)' }}>{p.rawMetrics?.rop?.toFixed(1) || '—'} units</div>
                  </div>
                </div>

                {/* Split row: sub-scores vs configuration */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px', alignItems: 'stretch' }}>
                  
                  {/* Parameters list & Sub-scores */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', margin: 0 }}>
                      1. Normalized Parameter Risk Sub-scores
                    </h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {Object.keys(p.subScores).map(key => {
                        const rVal = p.subScores[key];
                        const label = key.toUpperCase().replace('R', 'P');
                        let paramName = '';
                        let rawValLabel = '';

                        switch(key) {
                          case 'r1':
                            paramName = 'Inventory Level';
                            rawValLabel = `Ratio k: ${p.rawMetrics.k.toFixed(2)}`;
                            break;
                          case 'r2':
                            paramName = 'Days of Supply';
                            rawValLabel = `${p.daysOfCoverage} days coverage`;
                            break;
                          case 'r3':
                            paramName = 'Safety Stock Shortfall';
                            rawValLabel = `${p.safetyStock} ss (target: ${Math.max(p.safetyStock * 1.5, 5).toFixed(0)})`;
                            break;
                          case 'r4':
                            paramName = 'Effective Lead Time';
                            rawValLabel = `${p.rawMetrics.ltEff.toFixed(1)}d eff (mean: ${p.rawMetrics.ltAvg.toFixed(1)}d)`;
                            break;
                          case 'r5':
                            paramName = 'Supplier Dependence';
                            rawValLabel = `HHI: ${p.rawMetrics.rConc.toFixed(2)} · OTIF: ${(p.rawMetrics.otifAvg * 100).toFixed(0)}%`;
                            break;
                          case 'r6':
                            paramName = 'Inventory Criticality';
                            rawValLabel = `CR Score: ${p.rawMetrics.cr.toFixed(2)}`;
                            break;
                          case 'r7':
                            paramName = 'Tariff Changes (News)';
                            rawValLabel = `S:${p.rawMetrics.tariffDetails.severity.toFixed(1)} P:${p.rawMetrics.tariffDetails.probability.toFixed(1)} R:${p.rawMetrics.tariffDetails.relevance.toFixed(1)}`;
                            break;
                          case 'r8':
                            paramName = 'Corridor Threats (News)';
                            rawValLabel = `S:${p.rawMetrics.corridorDetails.severity.toFixed(1)} P:${p.rawMetrics.corridorDetails.probability.toFixed(1)} Rel:${p.rawMetrics.corridorDetails.relevance.toFixed(1)}`;
                            break;
                        }

                        // Progress bar color based on score (red for high risk, green for low risk)
                        let pColor = 'var(--success)';
                        if (rVal > 0.75) pColor = 'var(--danger)';
                        else if (rVal > 0.4) pColor = 'var(--warning)';

                        return (
                          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600 }}>
                              <span style={{ color: 'var(--text-bright)' }}>{label}: {paramName}</span>
                              <span style={{ color: 'var(--text-muted)' }}>{rawValLabel}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ flex: 1, height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                                <div style={{ width: `${rVal * 100}%`, height: '100%', background: pColor, borderRadius: '3px' }}></div>
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 700, minWidth: '28px', textAlign: 'right', color: rVal > 0 ? 'var(--text-bright)' : 'var(--text-muted)' }}>
                                {rVal.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Rubric tweak panel */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--bg-tertiary)', padding: '14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                    <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '6px', margin: 0 }}>
                      2. Calibrate SKU Rubrics & News Threat
                    </h4>
                    
                    {/* Criticality option toggle */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-bright)' }}>P6: Criticality Assessment</span>
                        
                        <div style={{ display: 'flex', background: 'var(--bg-secondary)', padding: '2.5px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                          <button 
                            style={{ padding: '2px 8px', fontSize: '10px', border: 'none', background: !useOptionB ? 'var(--text-primary)' : 'transparent', color: !useOptionB ? 'var(--bg-primary)' : 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}
                            onClick={() => { setUseOptionB(false); setLocalCriticality(0.5); }}
                          >
                            Option A
                          </button>
                          <button 
                            style={{ padding: '2px 8px', fontSize: '10px', border: 'none', background: useOptionB ? 'var(--text-primary)' : 'transparent', color: useOptionB ? 'var(--bg-primary)' : 'var(--text-muted)', cursor: 'pointer', borderRadius: '2px', fontWeight: 600, fontFamily: "'Inter', sans-serif" }}
                            onClick={() => { setUseOptionB(true); }}
                          >
                            Option B (Rubric)
                          </button>
                        </div>
                      </div>

                      {!useOptionB ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Option A Category Mapping (Direct Override)</label>
                          <select 
                            className="form-select" style={{ padding: '6px', fontSize: '12px' }}
                            value={localCriticality}
                            onChange={e => setLocalCriticality(parseFloat(e.target.value))}
                          >
                            <option value="1.0">Critical / line-stopping (1.00)</option>
                            <option value="0.75">High (0.75)</option>
                            <option value="0.50">Medium (0.50)</option>
                            <option value="0.25">Low (0.25)</option>
                            <option value="0.10">Negligible (0.10)</option>
                          </select>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-secondary)', padding: '8px 10px', borderRadius: '4px', border: '1px solid var(--border-subtle)' }}>
                          <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '3px', marginBottom: '2px' }}>Option B Multi-Criteria Score</div>
                          
                          {[
                            { label: 'Production Line Stoppage', idx: 0 },
                            { label: 'Part Substitutability', idx: 1 },
                            { label: 'Replacement Lead Time', idx: 2 },
                            { label: 'Revenue/Contract Exposure', idx: 3 }
                          ].map(item => (
                            <div key={item.idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                              <span style={{ color: 'var(--text-secondary)' }}>{item.label}</span>
                              <select 
                                style={{ padding: '2px', fontSize: '11px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-medium)', borderRadius: '2px' }}
                                value={localOptionB[item.idx]}
                                onChange={e => {
                                  const val = parseInt(e.target.value);
                                  setLocalOptionB(prev => {
                                    const next = [...prev];
                                    next[item.idx] = val;
                                    const score = next.reduce((sum, v) => sum + v, 0) / 20;
                                    setLocalCriticality(score);
                                    return next;
                                  });
                                }}
                              >
                                <option value="1">1 - Low</option>
                                <option value="2">2 - Minor</option>
                                <option value="3">3 - Moderate</option>
                                <option value="4">4 - Severe</option>
                                <option value="5">5 - Extreme</option>
                              </select>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '4px', fontSize: '11px', fontWeight: 700, marginTop: '2px' }}>
                            <span>Computed Impact (CR):</span>
                            <span style={{ color: 'var(--text-accent)' }}>{localCriticality.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Tariff news override sliders */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-bright)' }}>P7: Tariff Changes (News Overrides)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', fontSize: '10px' }}>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Sev: {localTariff.severity.toFixed(1)}</div>
                          <input 
                            type="range" min="0" max="1" step="0.1" value={localTariff.severity} 
                            onChange={e => setLocalTariff(prev => ({ ...prev, severity: parseFloat(e.target.value) }))}
                            style={{ width: '100%', height: '3px', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Prob: {localTariff.probability.toFixed(1)}</div>
                          <input 
                            type="range" min="0" max="1" step="0.1" value={localTariff.probability} 
                            onChange={e => setLocalTariff(prev => ({ ...prev, probability: parseFloat(e.target.value) }))}
                            style={{ width: '100%', height: '3px', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Rel: {localTariff.relevance.toFixed(1)}</div>
                          <input 
                            type="range" min="0" max="1" step="0.1" value={localTariff.relevance} 
                            onChange={e => setLocalTariff(prev => ({ ...prev, relevance: parseFloat(e.target.value) }))}
                            style={{ width: '100%', height: '3px', outline: 'none' }}
                          />
                        </div>
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                        <span>P7 Risk Score (Severity × Prob × Rel):</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{(localTariff.severity * localTariff.probability * localTariff.relevance).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Corridor threat override sliders */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-bright)' }}>P8: Corridor Threats (News Overrides)</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', fontSize: '9px' }}>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Sev: {localCorridor.severity.toFixed(1)}</div>
                          <input 
                            type="range" min="0" max="1" step="0.1" value={localCorridor.severity} 
                            onChange={e => setLocalCorridor(prev => ({ ...prev, severity: parseFloat(e.target.value) }))}
                            style={{ width: '100%', height: '3px', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Prob: {localCorridor.probability.toFixed(1)}</div>
                          <input 
                            type="range" min="0" max="1" step="0.1" value={localCorridor.probability} 
                            onChange={e => setLocalCorridor(prev => ({ ...prev, probability: parseFloat(e.target.value) }))}
                            style={{ width: '100%', height: '3px', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Pers: {localCorridor.persistence.toFixed(1)}</div>
                          <input 
                            type="range" min="0" max="1" step="0.1" value={localCorridor.persistence} 
                            onChange={e => setLocalCorridor(prev => ({ ...prev, persistence: parseFloat(e.target.value) }))}
                            style={{ width: '100%', height: '3px', outline: 'none' }}
                          />
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-secondary)', marginBottom: '2px' }}>Rel: {localCorridor.relevance.toFixed(1)}</div>
                          <input 
                            type="range" min="0" max="1" step="0.1" value={localCorridor.relevance} 
                            onChange={e => setLocalCorridor(prev => ({ ...prev, relevance: parseFloat(e.target.value) }))}
                            style={{ width: '100%', height: '3px', outline: 'none' }}
                          />
                        </div>
                      </div>
                      {(() => {
                        const localCore = 0.5 * localCorridor.severity + 0.3 * localCorridor.probability + 0.2 * localCorridor.persistence;
                        const localR8 = localCorridor.relevance * localCore;
                        return (
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                            <span>P8 Risk Score (Relevance × core):</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{localR8.toFixed(2)}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                </div>

                {/* Bottom Row: Score calculations & override band warning */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Calibration Comparison:</div>
                    <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span>Model A (Weighted Sum): <strong style={{ color: 'var(--text-primary)' }}>{p.scoreA.toFixed(1)}</strong></span>
                      <span>Model B (L×I): <strong style={{ color: 'var(--text-primary)' }}>{p.scoreB.toFixed(1)}</strong></span>
                    </div>
                  </div>

                  {p.hasOverride && activeModel === 'ModelB' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '11px', maxWidth: '380px' }}>
                      <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                      <span><strong>Non-compensatory floor override active!</strong> Risk capped at 70 due to critical lead-time shortfall or severe news event (subscore ≥ 0.90).</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '10px' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Active SKU Risk Rating (Model {activeModel === 'ModelA' ? 'A' : 'B'})</div>
                      <div style={{ fontSize: '26px', fontWeight: 900, color: p.riskBand === 'Critical' ? 'var(--danger)' : p.riskBand === 'High' ? 'var(--warning)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                        {activeScore.toFixed(1)}
                        <span className={`badge ${p.riskBand === 'Critical' ? 'critical' : p.riskBand === 'High' ? 'warning' : p.riskBand === 'Moderate' ? 'neutral' : 'success'}`} style={{ fontSize: '11px', padding: '3px 8px' }}>
                          {p.riskBand}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Modal Footer */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '14px 20px', borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-tertiary)'
              }}>
                <button 
                  className="btn btn-secondary"
                  onClick={() => setShowCalculationDetails(true)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', borderColor: 'var(--border-strong)', color: 'var(--text-accent)' }}
                >
                  <Calculator size={14} /> View Math Details
                </button>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => setSelectedProductForModal(null)}
                  >
                    Cancel
                  </button>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    // Save overrides to global config state
                    setConfig(prev => {
                      const nextCrit = { ...prev.criticalityOverride, [p.erpCode]: localCriticality };
                      const nextTariff = { ...prev.tariffOverride, [p.erpCode]: localTariff };
                      const nextCorridor = { ...prev.corridorOverride, [p.erpCode]: localCorridor };
                      
                      return {
                        ...prev,
                        criticalityOverride: nextCrit,
                        tariffOverride: nextTariff,
                        corridorOverride: nextCorridor
                      };
                    });
                    // If using option B, save Option B answers as well
                    if (useOptionB) {
                      setOptionBAnswers(prev => ({
                        ...prev,
                        [p.erpCode]: localOptionB
                      }));
                    } else {
                      setOptionBAnswers(prev => {
                        const copy = { ...prev };
                        delete copy[p.erpCode];
                        return copy;
                      });
                    }
                    setSelectedProductForModal(null);
                  }}
                >
                  Save Calibration & Recalculate
                </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* --- Detailed Math Explanation Sub-Modal --- */}
      {showCalculationDetails && selectedProductForModal && (() => {
        const p = records.find(r => r.erpCode === selectedProductForModal.erpCode) || selectedProductForModal;
        const isModelB = activeModel === 'ModelB';

        return (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
            display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 3000, overflowY: 'auto', padding: '20px'
          }}>
            <div className="glass-card animate-scale-in" style={{
              width: '100%', maxWidth: '900px', background: 'var(--bg-secondary)',
              border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-2xl)',
              borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column',
              maxHeight: '90vh', overflow: 'hidden', margin: 0
            }}>
              {/* Header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-tertiary)'
              }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-bright)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    🧮 Mathematical Derivation Sheet: <span style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{p.erpCode}</span>
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    Calculations for {p.description} (Active Model: {isModelB ? 'Model B: Likelihood × Impact' : 'Model A: Weighted Sum'})
                  </div>
                </div>
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCalculationDetails(false)}
                  style={{ padding: '6px 12px', minWidth: 0, borderRadius: '50%' }}
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              {(!calcDetails || loadingDetails) ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px', color: 'var(--text-secondary)', flex: 1 }}>
                  <div className="animate-spin" style={{ width: '40px', height: '40px', border: '4px solid #1e293b', borderTop: '4px solid var(--tm-red, #e11d48)', borderRadius: '50%', marginBottom: '16px' }} />
                  <div>Computing mathematical derivation sheet on backend...</div>
                </div>
              ) : (() => {
                const calc = calcDetails;
                const activeScore = activeModel === 'ModelA' ? calc.modelA.score : calc.modelB.scoreFinal;
                return (
              <div style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, fontFamily: "'Poppins', sans-serif" }}>
                
                {/* Step 1: Base Inputs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-bright)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', margin: 0 }}>
                    Step 1: Base System Inputs
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', fontSize: '12px' }}>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>In-Hand Inventory (IL):</span>
                      <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '14px' }}>{calc.inputs.inHandInventory} units</strong>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Days of Supply (DoS):</span>
                      <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '14px' }}>{calc.inputs.daysOfCoverage} days</strong>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Safety Stock (SS):</span>
                      <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '14px' }}>{calc.inputs.safetyStock} units</strong>
                    </div>
                    <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Product Category:</span>
                      <strong style={{ display: 'block', color: 'var(--text-primary)', fontSize: '14px' }}>{calc.inputs.category}</strong>
                    </div>
                  </div>

                  {calc.inputs.suppliers.length > 0 ? (
                    <div style={{ marginTop: '8px' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Active Suppliers:</span>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginTop: '4px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                        <thead>
                          <tr style={{ background: 'var(--border-subtle)', textAlign: 'left', borderBottom: '1px solid var(--border-medium)' }}>
                            <th style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>Supplier Name</th>
                            <th style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>Country</th>
                            <th style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>Supply %</th>
                            <th style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>Lead Time (Days)</th>
                            <th style={{ padding: '6px 10px', color: 'var(--text-secondary)' }}>Reliability (OTIF)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {calc.inputs.suppliers.map((s, idx) => (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                              <td style={{ padding: '6px 10px', color: 'var(--text-primary)' }}>{s.name}</td>
                              <td style={{ padding: '6px 10px', color: 'var(--text-muted)' }}>{s.country} ({s.region})</td>
                              <td style={{ padding: '6px 10px', color: 'var(--text-primary)', fontWeight: 600 }}>{s.supplyPct}%</td>
                              <td style={{ padding: '6px 10px', color: 'var(--text-primary)' }}>{s.leadTimeDays} days</td>
                              <td style={{ padding: '6px 10px', color: 'var(--text-primary)' }}>{s.reliability}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '11.5px', fontStyle: 'italic', padding: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', marginTop: '4px' }}>
                      No active suppliers configured for this SKU. Background fallback constants will be utilized.
                    </div>
                  )}
                </div>

                {/* Step 2: Intermediate Variables */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-bright)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', margin: 0 }}>
                    Step 2: Derived Supply Chain Variables
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    
                    {/* Daily Use */}
                    <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        <span>Daily Consumption Rate (DailyUse)</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{calc.intermediates.dailyUse.toFixed(4)} units/day</span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        Formula: if (DoS &gt; 0) IL / DoS else 1
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                        Calculation: {calc.inputs.daysOfCoverage > 0 ? `${calc.inputs.inHandInventory} / ${calc.inputs.daysOfCoverage}` : 'Fallback Default'} = {calc.intermediates.dailyUse.toFixed(4)}
                      </div>
                    </div>

                    {/* Mean Lead Time */}
                    <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        <span>Average Lead Time (LT_avg)</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{calc.intermediates.ltAvg.toFixed(2)} days</span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        Formula: {calc.intermediates.ltAvgFormula}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                        Calculation: {calc.intermediates.ltAvgCalculation}
                      </div>
                    </div>

                    {/* Sigma Lead Time */}
                    <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        <span>Lead Time Volatility (Standard Deviation σ_LT)</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{calc.intermediates.sigmaLT.toFixed(2)} days</span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        Formula: {calc.intermediates.sigmaLTFormula} (penalized by OTIF failure rates)
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace', whiteSpace: 'pre-line' }}>
                        Calculation: {calc.intermediates.sigmaLTCalculation}
                      </div>
                    </div>

                    {/* Effective Lead Time */}
                    <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        <span>Effective Lead Time (LT_eff)</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{calc.intermediates.ltEff.toFixed(2)} days</span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        Formula: LT_avg + 1.65 * σ_LT (95% service level confidence interval)
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                        Calculation: {calc.intermediates.ltAvg.toFixed(2)} + 1.65 * {calc.intermediates.sigmaLT.toFixed(2)} = {calc.intermediates.ltEff.toFixed(2)} days
                      </div>
                    </div>

                    {/* ROP */}
                    <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        <span>Reorder Point (ROP)</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{calc.intermediates.rop.toFixed(2)} units</span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        Formula: {calc.intermediates.ropFormula}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                        Calculation: {calc.intermediates.ropCalculation}
                      </div>
                    </div>

                    {/* k ratio */}
                    <div style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        <span>Inventory Coverage Ratio (k)</span>
                        <span style={{ fontFamily: 'monospace', color: 'var(--text-accent)' }}>{calc.intermediates.k.toFixed(4)}</span>
                      </div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        Formula: {calc.intermediates.kFormula}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '2px', fontFamily: 'monospace' }}>
                        Calculation: {calc.intermediates.kCalculation}
                      </div>
                    </div>

                  </div>
                </div>

                {/* Step 3: Sub-scores */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-bright)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', margin: 0 }}>
                    Step 3: Normalized Parameter Risk Sub-scores (P1 to P8)
                  </h4>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                    {[
                      { id: 'P1', title: 'Inventory Level (P1)', obj: calc.subScores.r1 },
                      { id: 'P2', title: 'Days of Supply (P2)', obj: calc.subScores.r2 },
                      { id: 'P3', title: 'Safety Stock Shortfall (P3)', obj: calc.subScores.r3 },
                      { id: 'P4', title: 'Effective Lead Time (P4)', obj: calc.subScores.r4 },
                      { id: 'P5', title: 'Supplier Dependence (P5)', obj: calc.subScores.r5, customRender: () => {
                        const r5Obj = calc.subScores.r5;
                        return (
                          <div style={{ paddingLeft: '14px', borderLeft: '1px solid var(--border-medium)', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '4px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '11px' }}>
                            <div>• Concentration Score (HHI): {r5Obj.parts.rConcFormula} &rarr; {r5Obj.parts.rConcCalculation}</div>
                            <div>• Average OTIF Score: {r5Obj.parts.rOtifFormula} &rarr; {r5Obj.parts.rOtifCalculation} (Avg OTIF: {r5Obj.parts.otifAvgCalculation})</div>
                            <div style={{ fontWeight: 600 }}>• Combined (0.5 * HHI + 0.5 * OTIF): {r5Obj.calculation}</div>
                          </div>
                        );
                      }},
                      { id: 'P6', title: 'Inventory Criticality (P6)', obj: calc.subScores.r6 },
                      { id: 'P7', title: 'Tariff Changes (P7)', obj: calc.subScores.r7 },
                      { id: 'P8', title: 'Corridor Threats (P8)', obj: calc.subScores.r8 },
                    ].map(param => (
                      <div key={param.id} style={{ background: 'var(--bg-tertiary)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', borderLeft: `3px solid ${param.obj.score > 0.75 ? 'var(--danger)' : param.obj.score > 0.4 ? 'var(--warning)' : 'var(--success)'}` }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--text-primary)' }}>
                          <span>{param.title}</span>
                          <span style={{ color: param.obj.score > 0.75 ? 'var(--danger)' : param.obj.score > 0.4 ? 'var(--warning)' : 'var(--success)', fontWeight: 700 }}>
                            {param.obj.score.toFixed(2)}
                          </span>
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '2px' }}>
                          Formula: {param.obj.formula}
                        </div>
                        {!param.customRender && (
                          <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', marginTop: '2px' }}>
                            Calculation: {param.obj.calculation}
                          </div>
                        )}
                        {param.customRender && param.customRender()}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Step 4: Model Aggregation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-bright)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', margin: 0 }}>
                    Step 4: Active Model Aggregation ({isModelB ? 'Model B: Likelihood × Impact' : 'Model A: Weighted Sum'})
                  </h4>

                  {isModelB ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                      
                      {/* Likelihood Table */}
                      <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                          Part 4a: Likelihood Index Calculation (Weighted Sum of Operational Parameters)
                        </span>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
                              <th style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>Parameter Name</th>
                              <th style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>Subscore (S)</th>
                              <th style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>Weight (W)</th>
                              <th style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>Contribution (S × W)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calc.modelB.parts.map((part, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '5px 6px', color: 'var(--text-primary)' }}>{part.name}</td>
                                <td style={{ padding: '5px 6px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{part.score.toFixed(2)}</td>
                                <td style={{ padding: '5px 6px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{(part.weight * 100).toFixed(1)}%</td>
                                <td style={{ padding: '5px 6px', color: 'var(--text-accent)', fontWeight: 600, fontFamily: 'monospace' }}>{(part.score * part.weight).toFixed(4)}</td>
                              </tr>
                            ))}
                            <tr style={{ background: 'var(--border-subtle)', fontWeight: 700 }}>
                              <td colSpan={3} style={{ padding: '6px', color: 'var(--text-primary)' }}>Weighted Likelihood (L)</td>
                              <td style={{ padding: '6px', color: 'var(--text-accent)', fontFamily: 'monospace' }}>{calc.modelB.likelihood.toFixed(4)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Impact Calculation */}
                      <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                          Part 4b: Impact Multiplier Calculation
                        </span>
                        <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          Formula: Impact (I) = 0.40 + 0.60 * CriticalityScore (P6)
                        </div>
                        <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)', marginTop: '4px' }}>
                          Calculation: 0.40 + 0.60 * {calc.subScores.r6.score.toFixed(2)} = {calc.modelB.impact.toFixed(3)}
                        </div>
                      </div>

                      {/* Aggregate Risk Score */}
                      <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                          Part 4c: Initial Risk Score Synthesis
                        </span>
                        <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          Formula: InitialScore = 100 * Likelihood * Impact
                        </div>
                        <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)', marginTop: '4px' }}>
                          Calculation: 100 * {calc.modelB.likelihood.toFixed(4)} * {calc.modelB.impact.toFixed(3)} = {calc.modelB.score.toFixed(4)}
                        </div>
                      </div>

                      {/* Floor overrides */}
                      <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: calc.modelB.hasOverride ? '1px solid var(--danger-border)' : '1px solid var(--border-subtle)' }}>
                        <span style={{ fontWeight: 700, color: calc.modelB.hasOverride ? 'var(--danger)' : 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                          Part 4d: Non-Compensatory Floor Overrides Check
                        </span>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          If any critical threat (Days of Supply P2, Tariffs P7, or Corridor Threats P8) is extreme (sub-score &ge; 0.90), the final risk score has a floor cap backstop of 70.0 to prevent safe metrics from masking severe single-point failures.
                        </div>
                        <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          Max of P2 ({calc.subScores.r2.score.toFixed(2)}), P7 ({calc.subScores.r7.score.toFixed(2)}), P8 ({calc.subScores.r8.score.toFixed(2)}) = {calc.modelB.maxOverrideVal.toFixed(2)}
                        </div>
                        <div style={{ fontWeight: 600, color: calc.modelB.hasOverride ? 'var(--danger)' : 'var(--success)', marginTop: '6px' }}>
                          {calc.modelB.hasOverride 
                            ? `⚠️ Extreme parameter found (>= 0.90)! Final Score = max(${calc.modelB.score.toFixed(1)}, 70.0) = ${calc.modelB.scoreFinal.toFixed(1)}`
                            : `✓ No parameters exceed the 0.90 override trigger. Final Score = ${calc.modelB.scoreFinal.toFixed(1)}`
                          }
                        </div>
                      </div>

                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                      <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
                          Weighted Sum Aggregation Table
                        </span>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
                              <th style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>Parameter Name</th>
                              <th style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>Subscore (S)</th>
                              <th style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>Weight (W)</th>
                              <th style={{ padding: '4px 6px', color: 'var(--text-secondary)' }}>Contribution (S × W)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calc.modelA.parts.map((part, idx) => (
                              <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                <td style={{ padding: '5px 6px', color: 'var(--text-primary)' }}>{part.name}</td>
                                <td style={{ padding: '5px 6px', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{part.score.toFixed(2)}</td>
                                <td style={{ padding: '5px 6px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{(part.weight * 100).toFixed(1)}%</td>
                                <td style={{ padding: '5px 6px', color: 'var(--text-accent)', fontWeight: 600, fontFamily: 'monospace' }}>{(part.score * part.weight).toFixed(4)}</td>
                              </tr>
                            ))}
                            <tr style={{ background: 'var(--border-subtle)', fontWeight: 700 }}>
                              <td colSpan={3} style={{ padding: '6px', color: 'var(--text-primary)' }}>Weighted Sum Product</td>
                              <td style={{ padding: '6px', color: 'var(--text-accent)', fontFamily: 'monospace' }}>{calc.modelA.sumProd.toFixed(4)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                          Initial Score Scaling
                        </span>
                        <div style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                          Formula: FinalScore = 100 * WeightedSumProduct
                        </div>
                        <div style={{ fontFamily: 'monospace', color: 'var(--text-primary)', marginTop: '4px' }}>
                          Calculation: 100 * {calc.modelA.sumProd.toFixed(4)} = {calc.modelA.score.toFixed(1)}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 5: Output Verdict */}
                <div style={{
                  background: 'var(--accent-gradient-subtle)',
                  border: '1px solid var(--tm-red)',
                  borderRadius: 'var(--radius-md)',
                  padding: '16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '10px'
                }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 600 }}>
                      Calculated Risk Score Output
                    </span>
                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginTop: '2px' }}>
                      Model: <strong>{isModelB ? 'Model B (Likelihood × Impact)' : 'Model A (Weighted Sum)'}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: activeScore > 75 ? 'var(--danger)' : activeScore > 50 ? 'var(--warning)' : 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end', lineHeight: 1.1 }}>
                      {activeScore.toFixed(1)}
                      <span className={`badge ${activeScore > 75 ? 'critical' : activeScore > 50 ? 'warning' : activeScore > 25 ? 'neutral' : 'success'}`} style={{ fontSize: '11px', padding: '3px 8px' }}>
                        {activeScore > 75 ? 'Critical' : activeScore > 50 ? 'High' : activeScore > 25 ? 'Moderate' : 'Low'}
                      </span>
                    </div>
                  </div>
                </div>

                  </div>
                );
              })()}
              {/* Footer */}
              <div style={{
                display: 'flex', justifyContent: 'flex-end',
                padding: '14px 20px', borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-tertiary)'
              }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowCalculationDetails(false)}
                >
                  Close Details
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
