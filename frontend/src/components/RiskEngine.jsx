import { useState, useMemo, useRef, useEffect } from 'react';
import { Layers, ShieldAlert, DollarSign, Activity, AlertTriangle, Filter, CheckCircle2 } from 'lucide-react';
import { getInventoryRiskRecords, getRiskSummary } from '../engine/inventoryAnalysis.js';
import { DEFAULT_WEIGHTS_A, DEFAULT_WEIGHTS_B, DEFAULT_THRESHOLDS, clamp } from '../engine/riskScoringModel.js';
import { formatCurrency } from '../services/exchangeRateService.js';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Treemap } from 'recharts';

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

export default function RiskEngine({ currency, convertAmount }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCell, setSelectedCell] = useState(null); // format: { sde: 'S', ved: 'V' }
  const [riskFilter, setRiskFilter] = useState('All');
  const [viewMode, setViewMode] = useState('treemap'); // 'treemap' (default) or 'matrix'
  const [treemapGroup, setTreemapGroup] = useState('product'); // 'product' (default), 'country', 'category', 'cell'

  // --- Advanced 0-100 Risk Model State ---
  const [activeModel, setActiveModel] = useState('ModelB'); // 'ModelB' (Likelihood * Impact) or 'ModelA' (Weighted Sum)
  const [selectedProductForModal, setSelectedProductForModal] = useState(null);
  
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

  // Draggable Splitter Layout states and hooks
  const [splitPercent, setSplitPercent] = useState(42); // default 42% for treemap
  const [isDragging, setIsDragging] = useState(false);
  const gridRef = useRef(null);

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleTouchStart = () => {
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      if (!gridRef.current) return;
      const rect = gridRef.current.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const relativeX = clientX - rect.left;
      let pct = (relativeX / rect.width) * 100;
      
      // Maintain reasonable ratios (25% - 75%) so cards don't squish completely
      if (pct < 25) pct = 25;
      if (pct > 75) pct = 75;
      
      setSplitPercent(pct);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleMouseMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

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

  const records = useMemo(() => getInventoryRiskRecords(config), [config]);
  const summary = useMemo(() => getRiskSummary(config), [config]);

  // Format currencies helper
  const fmt = (amount) => formatCurrency(convertAmount(amount), currency);

  // Sorting products by Risk score (descending) for the area chart
  const chartData = useMemo(() => {
    return [...records]
      .sort((a, b) => b.scoreFinal - a.scoreFinal)
      .map(r => ({
        erpCode: r.erpCode,
        description: r.description,
        value: convertAmount(r.inventoryValue),
        riskValue: r.scoreFinal,
        riskLevel: r.riskBand,
        sdeClass: r.sdeClass,
        vedClass: r.vedClass
      }));
  }, [records, convertAmount]);

  // Calculate dynamic stops for the Area chart gradient based on product counts
  const gradientStops = useMemo(() => {
    const total = chartData.length;
    if (total === 0) return { critStop: 0, medStop: 0 };
    
    const critCount = chartData.filter(r => r.riskLevel === 'Critical').length;
    const medCount = chartData.filter(r => r.riskLevel === 'High' || r.riskLevel === 'Moderate').length;
    
    const critStop = (critCount / total) * 100;
    const medStop = ((critCount + medCount) / total) * 100;
    
    return { critStop, medStop };
  }, [chartData]);

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
      result = result.filter(p => p.riskLevel === riskFilter);
    }

    return result;
  }, [records, searchTerm, selectedCell, riskFilter]);

  // Clear active filters
  const handleClearFilters = () => {
    setSelectedCell(null);
    setRiskFilter('All');
    setSearchTerm('');
  };

  // Custom chart tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="glass-card" style={{ padding: '12px', border: '1px solid var(--border-medium)', background: 'var(--bg-secondary)', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ fontWeight: 600, color: 'var(--text-bright)', marginBottom: '4px' }}>{data.description}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '8px' }}>ERP: {data.erpCode}</div>
          <div style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Inventory Value:</span>
            <span style={{ fontWeight: 600, color: 'var(--success)' }}>{formatCurrency(data.value, currency)}</span>
          </div>
          <div style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>SDE * VED Score:</span>
            <span style={{ 
              fontWeight: 700, 
              color: data.riskLevel === 'Critical' ? 'var(--danger)' : data.riskLevel === 'Medium' ? 'var(--warning)' : 'var(--success)' 
            }}>
              {data.riskValue.toFixed(1)} ({data.sdeClass}*{data.vedClass})
            </span>
          </div>
        </div>
      );
    }
    return null;
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

      {/* 2. Heatmap Matrix & Risk Area Chart Draggable Split Layout */}
      <div 
        ref={gridRef}
        style={{ 
          display: 'flex', 
          width: '100%', 
          gap: '12px',
          alignItems: 'stretch',
          position: 'relative',
          userSelect: isDragging ? 'none' : 'auto'
        }}
      >
        
        {/* Left Side: Visual SDE/VED Classification Card */}
        <div 
          className="glass-card animate-slide-up" 
          style={{ 
            width: `${splitPercent}%`, 
            minWidth: '350px', 
            display: 'flex', 
            flexDirection: 'column', 
            minHeight: '430px',
            margin: 0 
          }}
        >
          
          {/* Card Header with Title and Tab Selector */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldAlert size={18} className="icon" />
              {viewMode === 'treemap' ? 'SDE & VED Cash Sourcing Treemap' : 'SDE & VED Elastic Marimekko Grid'}
            </div>
            
            {/* View Mode Switcher Pills */}
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '2.5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <button
                onClick={() => setViewMode('treemap')}
                className={`tab ${viewMode === 'treemap' ? 'active' : ''}`}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: viewMode === 'treemap' ? 'var(--accent-gradient)' : 'transparent',
                  color: viewMode === 'treemap' ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                Treemap View
              </button>
              <button
                onClick={() => setViewMode('matrix')}
                className={`tab ${viewMode === 'matrix' ? 'active' : ''}`}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  background: viewMode === 'matrix' ? 'var(--accent-gradient)' : 'transparent',
                  color: viewMode === 'matrix' ? 'white' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontFamily: "'Inter', sans-serif"
                }}
              >
                3x3 Matrix Grid
              </button>
            </div>
          </div>

          {/* Conditional Subtitle & Grouping Filters */}
          {viewMode === 'treemap' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Click cells to filter table below. Tile size represents inventory cash value.
              </div>
              
              {/* Group by pill tabs */}
              <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-tertiary)', padding: '2.5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                {['product', 'country', 'category', 'cell'].map(g => (
                  <button
                    key={g}
                    onClick={() => setTreemapGroup(g)}
                    style={{
                      padding: '3px 8px',
                      fontSize: '10.5px',
                      border: 'none',
                      borderRadius: 'var(--radius-xs)',
                      background: treemapGroup === g ? 'var(--text-primary)' : 'transparent',
                      color: treemapGroup === g ? 'var(--bg-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontFamily: "'Inter', sans-serif"
                    }}
                  >
                    {g === 'product' ? 'Products' : g === 'country' ? 'Countries' : g === 'category' ? 'Categories' : 'SDE-VED'}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Click cells to filter products below. The size of columns (SDE) and rows (VED) are proportional to the cash value locked up.
            </div>
          )}

          {/* Visual Container (Proportional Packed HTML Treemap) */}
          {viewMode === 'treemap' ? (
            <div 
              style={{ 
                position: 'relative', 
                width: '100%', 
                height: '260px', 
                flex: 1, 
                minHeight: '260px'
              }}
            >
              {/* Inner clipping container */}
              <div
                ref={containerRef}
                style={{
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  position: 'relative'
                }}
              >
                {(() => {
                  const leafNodes = [];
                  treemapData.forEach(parent => {
                    if (parent.children) {
                      parent.children.forEach(child => {
                        leafNodes.push(child);
                      });
                    } else {
                      leafNodes.push(parent);
                    }
                  });

                  const layoutCards = computeTreemapLayout(
                    leafNodes.sort((a, b) => b.value - a.value),
                    0,
                    0,
                    dimensions.width,
                    dimensions.height
                  );

                  return layoutCards.map((card, idx) => {
                    let bgColor = '#3f6212';
                    if (card.riskLevel === 'Critical') {
                      bgColor = '#a82b2b';
                    } else if (card.riskLevel === 'High') {
                      bgColor = '#c25e1a';
                    } else if (card.riskLevel === 'Moderate' || card.riskLevel === 'Medium') {
                      bgColor = '#dbaf58';
                    }
                    
                    const isLightTheme = document.documentElement.classList.contains('light-theme');

                    return (
                      <div
                        key={card.erpCode || card.name || idx}
                        onClick={() => handleTreemapClick(card)}
                        onMouseEnter={() => setHoveredCard(card)}
                        onMouseMove={(e) => {
                          const rect = e.currentTarget.parentElement.getBoundingClientRect();
                          setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                        }}
                        onMouseLeave={() => setHoveredCard(null)}
                        style={{
                          position: 'absolute',
                          left: `${card.x}px`,
                          top: `${card.y}px`,
                          width: `${card.w}px`,
                          height: `${card.h}px`,
                          padding: '6px',
                          boxSizing: 'border-box',
                          background: bgColor,
                          border: isLightTheme ? '2px solid #ffffff' : '2px solid var(--bg-secondary)',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                          alignItems: 'center',
                          color: '#ffffff',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          transition: 'transform 0.15s ease-out, filter 0.15s ease-out',
                          textShadow: '0 1.5px 3px rgba(0, 0, 0, 0.85)',
                        }}
                        className="treemap-rect"
                      >
                        {/* Name */}
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: card.w > 120 ? '13px' : card.w > 80 ? '11px' : '9px',
                            lineHeight: 1.2,
                            textAlign: 'center',
                            width: '100%',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: card.h > 55 ? 3 : 2,
                            WebkitBoxOrient: 'vertical',
                            marginBottom: '2px',
                            pointerEvents: 'none'
                          }}
                        >
                          {card.name}
                        </div>
                        
                        {/* Value */}
                        {card.h > 45 && (
                          <div
                            style={{
                              fontWeight: 800,
                              fontSize: card.w > 120 ? '14px' : card.w > 80 ? '11px' : '9px',
                              opacity: 0.95,
                              textAlign: 'center',
                              pointerEvents: 'none'
                            }}
                          >
                            {card.formattedValue}
                          </div>
                        )}

                        {/* Info Badge */}
                        {card.w > 95 && card.h > 70 && (
                          <div
                            style={{
                              fontSize: '8.5px',
                              fontWeight: 700,
                              marginTop: '4px',
                              background: 'rgba(0, 0, 0, 0.22)',
                              padding: '1.5px 5px',
                              borderRadius: '3px',
                              letterSpacing: '0.3px',
                              textTransform: 'uppercase',
                              pointerEvents: 'none'
                            }}
                          >
                            {card.erpCode || `${card.sdeClass}*${card.vedClass}`}
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Cursor-Following Glassmorphic Tooltip (outside overflow: hidden sibling!) */}
              {hoveredCard && (
                <div 
                  className="glass-card animate-scale-in" 
                  style={{ 
                    position: 'absolute',
                    left: `${mousePos.x > dimensions.width - 250 ? mousePos.x - 240 - 15 : mousePos.x + 15}px`,
                    top: `${mousePos.y > dimensions.height - 200 ? mousePos.y - 180 - 15 : mousePos.y + 15}px`,
                    zIndex: 10000,
                    padding: '14px', 
                    border: '1px solid var(--border-strong)', 
                    background: 'var(--bg-secondary)', 
                    boxShadow: 'var(--shadow-xl)',
                    borderRadius: 'var(--radius-md)',
                    width: '240px',
                    pointerEvents: 'none',
                    backdropFilter: 'blur(12px)',
                    boxSizing: 'border-box'
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--text-bright)', fontSize: '13px', marginBottom: '4px' }}>
                    {hoveredCard.name}
                  </div>
                  
                  {hoveredCard.erpCode ? (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace', marginBottom: '8px' }}>
                      ERP: {hoveredCard.erpCode} · Category: {hoveredCard.category}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
                      Segment: {treemapGroup === 'country' ? 'Sourcing Country' : treemapGroup === 'category' ? 'Product Category' : 'SDE-VED Cell'}
                    </div>
                  )}

                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Inventory Value:</span>
                      <span style={{ fontWeight: 700, color: 'var(--success)' }}>{hoveredCard.formattedValue}</span>
                    </div>
                    
                    <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Sourcing SDE*VED:</span>
                      <span style={{ fontWeight: 700, color: hoveredCard.riskLevel === 'Critical' ? 'var(--danger)' : hoveredCard.riskLevel === 'Medium' ? 'var(--warning)' : 'var(--success)' }}>
                        {hoveredCard.riskValue.toFixed(1)} ({hoveredCard.sdeClass}*{hoveredCard.vedClass})
                      </span>
                    </div>

                    <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Risk Level:</span>
                      <span style={{ fontWeight: 750, color: hoveredCard.riskLevel === 'Critical' ? 'var(--danger)' : hoveredCard.riskLevel === 'Medium' ? 'var(--warning)' : 'var(--success)', textTransform: 'uppercase', fontSize: '10px' }}>
                        {hoveredCard.riskLevel}
                      </span>
                    </div>

                    {hoveredCard.itemsCount > 1 && (
                      <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Components:</span>
                        <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{hoveredCard.itemsCount} items</span>
                      </div>
                    )}
                    
                    {hoveredCard.maxLeadTime && (
                      <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Max Lead Time:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{hoveredCard.maxLeadTime} days</span>
                      </div>
                    )}

                    {hoveredCard.numSuppliers && (
                      <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Suppliers:</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{hoveredCard.numSuppliers} active</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr', gap: '8px', flex: 1, minHeight: '260px' }}>
              {/* VED Y-Axis Label aligned with row heights */}
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateRows: `${rowHeights[0]}fr ${rowHeights[1]}fr ${rowHeights[2]}fr`,
                  gap: '8px',
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontWeight: 600, 
                  color: 'var(--text-muted)', 
                  fontSize: '12px',
                  transition: 'grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <div>V</div>
                <div>E</div>
                <div>D</div>
              </div>

              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: `${colWidths[0]}fr ${colWidths[1]}fr ${colWidths[2]}fr`,
                  gap: '8px', 
                  flex: 1,
                  transition: 'grid-template-columns 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                {columns.map((col, colIdx) => {
                  const heights = getCellHeightsForColumn(col);
                  return (
                    <div 
                      key={col} 
                      style={{ 
                        display: 'grid', 
                        gridTemplateRows: `${heights[0]}fr ${heights[1]}fr ${heights[2]}fr`,
                        gap: '8px',
                        transition: 'grid-template-rows 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                      }}
                    >
                      {rows.map((row, rowIdx) => {
                        const cellData = getMatrixCellData(col, row);
                        const isSelected = selectedCell && selectedCell.sde === col && selectedCell.ved === row;
                        return (
                          <div key={row} className="tooltip-container" style={{ width: '100%', height: '100%', display: 'flex', position: 'relative' }}>
                            <div
                              onClick={() => setSelectedCell(isSelected ? null : { sde: col, ved: row })}
                              className={`matrix-cell ${cellData.colorClass} ${isSelected ? 'selected' : ''}`}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                border: isSelected ? '2px solid var(--text-bright)' : '1px solid var(--border-subtle)',
                                transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                boxShadow: isSelected ? 'var(--accent-glow)' : 'none',
                                padding: '8px',
                                minWidth: 0,
                                overflow: 'hidden',
                                textAlign: 'center',
                                flex: 1
                              }}
                            >
                              <div style={{ fontSize: '11px', fontWeight: 700, opacity: 0.9, marginBottom: '2px' }}>{col}-{row}</div>
                              <div style={{ fontSize: '13px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                {cellData.count} <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.7 }}>items</span>
                              </div>
                              <div style={{ fontSize: '11px', fontWeight: 600, opacity: 0.8, whiteSpace: 'nowrap' }}>{fmt(cellData.value)}</div>
                            </div>
                            
                            {/* Premium Custom Hover Tooltip */}
                            <div className="tooltip" style={{ bottom: 'calc(100% + 6px)', padding: '10px 14px', borderRadius: 'var(--radius-md)', background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-xl)', pointerEvents: 'none', transform: 'translateX(-50%)', left: '50%' }}>
                              <div style={{ fontWeight: 700, color: 'var(--text-bright)', marginBottom: '6px', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>
                                {col === 'S' ? 'Scarce' : col === 'D' ? 'Difficult' : 'Easy'} · {row === 'V' ? 'Vital' : row === 'E' ? 'Essential' : 'Desirable'} ({col}-{row})
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '11px', marginBottom: '3px', whiteSpace: 'nowrap' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Items Count:</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cellData.count} components</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', fontSize: '11px', whiteSpace: 'nowrap' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Inventory Value:</span>
                                <span style={{ fontWeight: 600, color: 'var(--success)' }}>{fmt(cellData.value)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SDE X-Axis Labels aligned with column widths (Only shown in Matrix Mode) */}
          {viewMode === 'matrix' && (
            <div style={{ display: 'grid', gridTemplateColumns: '30px 1fr', gap: '8px', marginTop: '8px' }}>
              <div></div> {/* spacer for VED label column */}
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: `${colWidths[0]}fr ${colWidths[1]}fr ${colWidths[2]}fr`,
                  gap: '8px', 
                  textAlign: 'center', 
                  fontWeight: 600, 
                  color: 'var(--text-muted)', 
                  fontSize: '11px',
                  transition: 'grid-template-columns 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
                }}
              >
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Scarce (S)</div>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Difficult (D)</div>
                <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Easy (E)</div>
              </div>
            </div>
          )}
          
          {/* Bottom Scale Scale/Gradient Legend (Styled to match the slide EXACTLY) */}
          {viewMode === 'treemap' ? (
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>SDE * VED Sourcing Risk Scale (Gradient Legend)</span>
                <span style={{ fontStyle: 'italic', opacity: 0.8 }}>Proportional Size By Value</span>
              </div>
              <div style={{ position: 'relative', height: '14px', borderRadius: '4px', background: 'linear-gradient(90deg, #a82b2b 0%, #dbaf58 50%, #3f6212 100%)', border: '1px solid var(--border-medium)' }}>
                {/* Visual scale ticks */}
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '20%', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '40%', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '60%', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: '80%', width: '1px', background: 'rgba(255,255,255,0.15)' }}></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 2px 0', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, fontFamily: 'monospace' }}>
                <div style={{ textAlign: 'left' }}>
                  <span style={{ color: 'var(--danger)', fontSize: '11px', fontWeight: 750 }}>25.0</span>
                  <div style={{ fontSize: '8.5px', fontWeight: 500, color: 'var(--danger)', marginTop: '2px' }}>CRITICAL RISK</div>
                </div>
                <div style={{ textAlign: 'center', transform: 'translateX(-10px)' }}>
                  <span>15.0</span>
                  <div style={{ fontSize: '8.5px', fontWeight: 500, color: 'var(--warning)', marginTop: '2px' }}>HIGH</div>
                </div>
                <div style={{ textAlign: 'center', transform: 'translateX(10px)' }}>
                  <span>6.0</span>
                  <div style={{ fontSize: '8.5px', fontWeight: 500, color: 'var(--warning)', marginTop: '2px' }}>MEDIUM</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ color: 'var(--success)', fontSize: '11px', fontWeight: 750 }}>1.0</span>
                  <div style={{ fontSize: '8.5px', fontWeight: 500, color: 'var(--success)', marginTop: '2px' }}>LOW RISK</div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', fontSize: '11.5px', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--danger-bg)', border: '1px solid var(--danger)' }}></span> Critical Risk</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}></span> Medium Risk</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'var(--success-bg)', border: '1px solid var(--success)' }}></span> Low Risk</span>
              </div>
            </div>
          )}
        </div>

        {/* Dynamic Resizer Divider Handle */}
        <div 
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          style={{
            width: '8px',
            cursor: 'col-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDragging ? 'var(--accent-primary)' : 'transparent',
            borderRadius: '4px',
            transition: 'background 0.2s',
            margin: '0 -2px',
            zIndex: 10
          }}
          className="layout-resizer"
        >
          <div style={{ width: '2px', height: '30px', background: 'var(--border-strong)', borderRadius: '1px' }}></div>
        </div>

        {/* Right Side: Recharts Risk Area Chart */}
        <div 
          className="glass-card animate-slide-up" 
          style={{ 
            flex: 1, 
            minWidth: '350px', 
            display: 'flex', 
            flexDirection: 'column',
            margin: 0
          }}
        >
          <div className="card-title">
            <Activity size={18} className="icon" />
            Inventory Value vs Risk Exposure Curve
          </div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Products sorted from Critical (left) to Low Risk (right). The area reflects locked-up capital, colored by SDE*VED risk.
          </div>

          <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '12px', flex: 1 }} className="custom-scrollbar">
            <div style={{ width: '1500px', height: '230px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 15, left: -5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRiskArea" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="var(--danger)" stopOpacity={0.65} />
                      <stop offset={`${gradientStops.critStop}%`} stopColor="var(--danger)" stopOpacity={0.65} />
                      <stop offset={`${gradientStops.critStop + 1}%`} stopColor="var(--warning)" stopOpacity={0.55} />
                      <stop offset={`${gradientStops.medStop}%`} stopColor="var(--warning)" stopOpacity={0.55} />
                      <stop offset={`${gradientStops.medStop + 1}%`} stopColor="var(--success)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--success)" stopOpacity={0.45} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                  <XAxis 
                    dataKey="erpCode" 
                    stroke="var(--text-muted)" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    dy={8}
                  />
                  <YAxis 
                    stroke="var(--text-muted)" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false}
                    tickFormatter={(val) => currency === 'INR' ? `₹${(val/100000).toFixed(0)}L` : `$${(val/1000).toFixed(0)}k`}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--border-strong)', strokeWidth: 1 }} />
                  <Area 
                    type="monotone" 
                    dataKey="value" 
                    stroke="var(--border-strong)" 
                    strokeWidth={1.5}
                    fill="url(#colorRiskArea)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
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
              {['All', 'Critical', 'Medium', 'Low'].map(r => (
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
                  {r} ({r === 'All' ? records.length : records.filter(p => p.riskLevel === r).length})
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
                <th>In-Hand</th>
                <th>SDE*VED Cell</th>
                <th>0–100 Risk Score</th>
                <th>Risk Band</th>
                <th>Lead Time</th>
                <th>Inv. Value</th>
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
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(p.inventoryValue)}</td>
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
                display: 'flex', justifyContent: 'flex-end', gap: '10px',
                padding: '14px 20px', borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-tertiary)'
              }}>
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
        );
      })()}

    </div>
  );
}
