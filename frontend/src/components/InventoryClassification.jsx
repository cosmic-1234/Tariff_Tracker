import { useState, useMemo, useRef, useEffect } from 'react';
import { Layers, ShieldAlert, DollarSign, Activity, AlertTriangle, Filter, CheckCircle2 } from 'lucide-react';
import { getInventoryRiskRecords, getRiskSummary } from '../engine/inventoryAnalysis.js';
import { formatCurrency } from '../services/exchangeRateService.js';

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

export default function InventoryClassification({ currency, convertAmount, products, suppliers }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCell, setSelectedCell] = useState(null); // format: { sde: 'S', ved: 'V' }
  const [riskFilter, setRiskFilter] = useState('All');
  const [viewMode, setViewMode] = useState('treemap'); // 'treemap' (default) or 'matrix'
  const [treemapGroup, setTreemapGroup] = useState('product'); // 'product' (default), 'country', 'category', 'cell'

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

  const records = useMemo(() => getInventoryRiskRecords(), [products, suppliers]);
  const summary = useMemo(() => getRiskSummary(), [products, suppliers]);

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
          riskValue: r.riskValue,
          riskLevel: r.riskLevel,
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
        categoryValues[cat].weightedRisk += r.riskValue * val;
        categoryValues[cat].itemsCount++;
      });

      parentGroup.children = Object.values(categoryValues).map(c => {
        const avgRisk = c.value > 0 ? c.weightedRisk / c.value : 0;
        let riskLevel = 'Low';
        if (avgRisk >= 15) riskLevel = 'Critical';
        else if (avgRisk >= 6) riskLevel = 'Medium';
        
        return {
          name: c.name,
          value: c.value,
          riskValue: avgRisk,
          riskLevel: riskLevel,
          formattedValue: formatCurrency(c.value, currency),
          itemsCount: c.itemsCount,
          sdeClass: avgRisk >= 15 ? 'S' : avgRisk >= 6 ? 'D' : 'E',
          vedClass: avgRisk >= 15 ? 'V' : avgRisk >= 6 ? 'E' : 'D'
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
          cNode.weightedRisk += r.riskValue * val;
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
            cNode.weightedRisk += r.riskValue * val;
            cNode.itemsCount++;
          });
        }
      });

      // Compute average SDE*VED risk and format labels
      Object.values(regionGroups).forEach(reg => {
        reg.children.forEach(c => {
          const avgRisk = c.value > 0 ? c.weightedRisk / c.value : 0;
          c.riskValue = avgRisk;
          c.riskLevel = avgRisk >= 15 ? 'Critical' : avgRisk >= 6 ? 'Medium' : 'Low';
          c.formattedValue = formatCurrency(c.value, currency);
          c.sdeClass = avgRisk >= 15 ? 'S' : avgRisk >= 6 ? 'D' : 'E';
          c.vedClass = avgRisk >= 15 ? 'V' : avgRisk >= 6 ? 'E' : 'D';
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
            riskValue: r.riskValue,
            riskLevel: r.riskLevel,
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


  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* 1. KPIs */}
      <div className="kpi-grid stagger-children">
        <div className="kpi-card animate-scale-in">
          <div className="kpi-label">Total Classified Value</div>
          <div className="kpi-value">{fmt(summary.totalValue)}</div>
        </div>
        <div className="kpi-card animate-scale-in">
          <div className="kpi-label">Critical SDE*VED Cash Risk</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>
            {fmt(summary.riskSegments.Critical.value)}
          </div>
        </div>
        <div className="kpi-card animate-scale-in">
          <div className="kpi-label">Avg Sourcing Risk Rating</div>
          <div className="kpi-value">{summary.avgRiskScore.toFixed(1)} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>/ 25</span></div>
        </div>
        <div className="kpi-card animate-scale-in">
          <div className="kpi-label">Critical SDE*VED Components</div>
          <div className="kpi-value" style={{ color: 'var(--danger)' }}>
            {summary.riskSegments.Critical.count} <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>items</span>
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
                <th>SDE Score</th>
                <th>VED Score</th>
                <th>Risk Rating</th>
                <th>Status</th>
                <th>MOQ (Min)</th>
                <th>Lead Time</th>
                <th>Inv. Value</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(p => {
                return (
                  <tr key={p.erpCode}>
                    <td style={{ fontWeight: 600, fontFamily: 'monospace' }}>{p.erpCode}</td>
                    <td style={{ fontFamily: 'monospace' }}>{p.hsCode}</td>
                    <td><span className="badge neutral">{p.category}</span></td>
                    <td style={{ fontWeight: 500 }}>{p.description}</td>
                    <td>{p.inHandInventory}</td>
                    
                    {/* SDE Score & Badge */}
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ marginRight: '6px' }}>{p.sdeScore.toFixed(1)}</span>
                      <span className={`badge ${p.sdeClass === 'S' ? 'critical' : p.sdeClass === 'D' ? 'warning' : 'success'}`} style={{ fontSize: '10px', padding: '1px 4px' }}>
                        {p.sdeClass}
                      </span>
                    </td>

                    {/* VED Score & Badge */}
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ marginRight: '6px' }}>{p.vedScore.toFixed(1)}</span>
                      <span className={`badge ${p.vedClass === 'V' ? 'critical' : p.vedClass === 'E' ? 'warning' : 'success'}`} style={{ fontSize: '10px', padding: '1px 4px' }}>
                        {p.vedClass}
                      </span>
                    </td>

                    {/* Risk score SDE * VED */}
                    <td style={{ 
                      fontWeight: 700, 
                      color: p.riskLevel === 'Critical' ? 'var(--danger)' : p.riskLevel === 'Medium' ? 'var(--warning)' : 'var(--success)' 
                    }}>
                      {p.riskValue.toFixed(1)}
                    </td>

                    {/* Risk Status */}
                    <td>
                      <span className={`badge ${p.riskLevel === 'Critical' ? 'critical' : p.riskLevel === 'Medium' ? 'warning' : 'success'}`}>
                        {p.riskLevel}
                      </span>
                    </td>

                    <td>{p.moq || '—'}</td>
                    <td>{p.maxLeadTime} days</td>
                    <td style={{ fontWeight: 700, color: 'var(--success)' }}>{fmt(p.inventoryValue)}</td>
                  </tr>
                );
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                    No inventory records match the active matrix filter or search term.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-muted)' }}>
          Showing {filteredProducts.length} of {records.length} items classified by supply redundancy and stoppage risk.
        </div>

      </div>

    </div>
  );
}
