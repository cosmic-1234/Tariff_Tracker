import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  ShieldAlert, Settings2, FileSpreadsheet, Plus, Upload, Download, Filter, 
  Trash2, Edit3, CheckCircle2, ChevronRight, ChevronLeft, Layers, Sliders, MapPin, RefreshCw
} from 'lucide-react';
import { formatCurrency } from '../services/exchangeRateService.js';
import { lookupHSCodeDescription, getHSCodesRecommendation } from '../services/tariffLookupService.js';
import { fetchCriticalityScores } from '../services/dataService.js';

// Pre-defined fallback default VED sub-factors for the 30 base components
function getDefaultVedSubFactors(category) {
  const cat = String(category).toLowerCase();
  if (
    cat.includes('engine') || 
    cat.includes('transmission') || 
    cat.includes('drivetrain') || 
    cat.includes('brake') || 
    cat.includes('electrical')
  ) {
    return { prodStop: 5, bottleneck: 5, substitutability: 4, safetyQuality: 4, recovery: 4 };
  } else if (
    cat.includes('hvac') || 
    cat.includes('fuel') || 
    cat.includes('steering') || 
    cat.includes('suspension') || 
    cat.includes('wheel') || 
    cat.includes('tire')
  ) {
    return { prodStop: 3, bottleneck: 4, substitutability: 3, safetyQuality: 3, recovery: 3 };
  } else {
    return { prodStop: 1, bottleneck: 2, substitutability: 1, safetyQuality: 1, recovery: 2 };
  }
}

// Initial country risk tiers
const initialCountryTiers = {
  'India': 1, // Domestic
  'China': 3, // Stable International / dist
  'USA': 3,
  'Germany': 3,
  'Japan': 3,
  'UK': 3,
  'France': 3,
  'Italy': 3,
  'South Korea': 3,
  'Mexico': 4, // Distant / import-dep
  'Brazil': 4,
  'Other': 3
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

export default function CriticalityScoring({ currency, convertAmount, products = [], suppliers = [] }) {
  // --- STATE DECLARATIONS ---
  const [components, setComponents] = useState(() => {
    // Dynamically build initial components with calculations from product/supplier master
    const sourceProducts = products && products.length > 0 ? products : [];
    return sourceProducts.map(p => {
      const productSuppliers = suppliers && suppliers.length > 0
        ? suppliers.filter(s => s.productErpCode === p.erpCode)
        : [];
      const primarySupplier = productSuppliers.reduce((prev, current) => 
        (prev.supplyPct > current.supplyPct) ? prev : current, { supplyPct: 100, reliability: 90, leadTimeDays: 15, moq: 1, country: 'India' }
      );

      const maxLeadTime = productSuppliers.reduce((max, s) => Math.max(max, s.leadTimeDays), 15);
      const numSuppliers = productSuppliers.length || 1;
      const defaultVed = getDefaultVedSubFactors(p.category);

      return {
        erpCode: p.erpCode,
        hsCode: p.hsCode,
        category: p.category,
        description: p.description,
        inHandInventory: p.inHandInventory,
        inventoryValue: p.inventoryValue,
        inTransitInventory: p.inTransitInventory,
        daysOfCoverage: p.daysOfCoverage || p.daysOfCover || 30,
        roq: p.roq,
        safetyStock: p.safetyStock,
        
        // SDE scoring elements
        supplierCode: primarySupplier.supplierId || 'SUP0001',
        supplierName: primarySupplier.supplierName || 'Primary Supplier',
        countryOfOrigin: primarySupplier.country || 'India',
        supplyPct: primarySupplier.supplyPct || 100,
        reliabilityOTIF: primarySupplier.reliability || 90,
        leadTimeDays: maxLeadTime,
        moq: primarySupplier.moq || 1,
        numSuppliers,

        // VED scoring elements (defaults)
        ...defaultVed,
        
        isCustom: false
      };
    });
  });

  // Sync components when backend products or suppliers are fetched
  useEffect(() => {
    if (products && products.length > 0) {
      setComponents(products.map(p => {
        const productSuppliers = suppliers.filter(s => s.productErpCode === p.erpCode) || [];
        const primarySupplier = productSuppliers.reduce((prev, current) => 
          (prev.supplyPct > current.supplyPct) ? prev : current, { supplyPct: 100, reliability: 90, leadTimeDays: 15, moq: 1, country: 'India' }
        );

        const maxLeadTime = productSuppliers.reduce((max, s) => Math.max(max, s.leadTimeDays), 15);
        const numSuppliers = productSuppliers.length || 1;
        const defaultVed = getDefaultVedSubFactors(p.category);

        return {
          erpCode: p.erpCode,
          hsCode: p.hsCode,
          category: p.category,
          description: p.description,
          inHandInventory: p.inHandInventory,
          inventoryValue: p.inventoryValue,
          inTransitInventory: p.inTransitInventory,
          daysOfCoverage: p.daysOfCoverage || p.daysOfCover || 30,
          roq: p.roq,
          safetyStock: p.safetyStock,
          
          // SDE scoring elements
          supplierCode: primarySupplier.supplierId || 'SUP0001',
          supplierName: primarySupplier.supplierName || 'Primary Supplier',
          countryOfOrigin: primarySupplier.country || 'India',
          supplyPct: primarySupplier.supplyPct || 100,
          reliabilityOTIF: primarySupplier.reliability || 90,
          leadTimeDays: maxLeadTime,
          moq: primarySupplier.moq || 1,
          numSuppliers,

          // VED scoring elements (defaults)
          ...defaultVed,
          
          isCustom: false
        };
      }));
    }
  }, [products, suppliers]);

  const [activeTab, setActiveTab] = useState('upload'); // 'upload' or 'manual'
  const [selectedCell, setSelectedCell] = useState(null); // { sde: 1-5, ved: 1-5 }
  const [selectedBand, setSelectedBand] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [matrixSizingMode, setMatrixSizingMode] = useState('score'); // 'score', 'value', 'count', 'equal'
  const [viewMode, setViewMode] = useState('treemap'); // 'treemap' (default) or 'matrix'
  const [treemapGroup, setTreemapGroup] = useState('product'); // 'product', 'category', 'cell'
  const [hoveredCard, setHoveredCard] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 450, height: 380 });
  const [isInputPanelCollapsed, setIsInputPanelCollapsed] = useState(false);
  
  // Collapse configurations
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: width || 450,
          height: height || 380
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // --- CONFIGURABLE STATES (Weights, Thresholds, Country Tiers) ---
  const [sdeWeights, setSdeWeights] = useState({
    concentration: 0.25,
    leadTime: 0.20,
    reliability: 0.20,
    buffer: 0.20,
    moq: 0.10,
    geography: 0.05
  });

  const [vedWeights, setVedWeights] = useState({
    prodStop: 0.35,
    bottleneck: 0.20,
    substitutability: 0.20,
    safetyQuality: 0.15,
    recovery: 0.10
  });

  const [countryTiers, setCountryTiers] = useState(initialCountryTiers);
  const [newCountryName, setNewCountryName] = useState('');
  const [newCountryRisk, setNewCountryRisk] = useState(3);

  const [bandsConfig, setBandsConfig] = useState([
    { name: 'Low', min: 1, max: 4, desc: 'Standard planning; low-touch review', color: 'band-low' },
    { name: 'Moderate', min: 5, max: 9, desc: 'Planner monitoring; monthly review', color: 'band-moderate' },
    { name: 'High', min: 10, max: 15, desc: 'Safety stock & supplier review', color: 'band-high' },
    { name: 'Very High', min: 16, max: 20, desc: 'Alternate source; weekly review', color: 'band-veryhigh' },
    { name: 'Critical', min: 21, max: 25, desc: 'Executive watchlist; watchlist', color: 'band-critical' }
  ]);

  // VED meta labels
  const [vedMeta, setVedMeta] = useState({
    prodStop: { label: "Production Stop Impact", desc: "Line stoppage risk on output stoppage" },
    bottleneck: { label: "Process Bottleneck", desc: "Production bottleneck dependence" },
    substitutability: { label: "Substitutability", desc: "Validated replacement availability" },
    safetyQuality: { label: "Safety & Quality", desc: "Compliance, hazard or product safety" },
    recovery: { label: "Recovery Time", desc: "Lead time to restore normal supply" }
  });

  const [stockoutConfig, setStockoutConfig] = useState({
    inHandLowDays: 10,
    docLowDays: 15,
    leadTimeLongDays: 30
  });

  // Manual component inputs state
  const [manualInput, setManualInput] = useState({
    erpCode: '',
    hsCode: '',
    category: 'Engine',
    description: '',
    inHandInventory: 50,
    inventoryValue: 10000,
    inTransitInventory: 0,
    daysOfCoverage: 30,
    roq: 100,
    safetyStock: 10,
    supplierCode: 'SUP0001',
    supplierName: 'New Supplier',
    countryOfOrigin: 'India',
    supplyPct: 100,
    reliabilityOTIF: 95,
    leadTimeDays: 15,
    moq: 10,
    prodStop: 3,
    bottleneck: 3,
    substitutability: 3,
    safetyQuality: 3,
  });

  const [manualRecs, setManualRecs] = useState([]);
  const [isManualRecLoading, setIsManualRecLoading] = useState(false);
  const [showManualRec, setShowManualRec] = useState(false);


  // Clear filters helper
  const handleClearFilters = () => {
    setSelectedCell(null);
    setSelectedBand('All');
    setSearchTerm('');
    setCategoryFilter('All');
  };

  // Convert risk score to band name
  const getBandName = (score) => {
    const band = bandsConfig.find(b => score >= b.min && score <= b.max);
    return band ? band.name : 'Low';
  };

  // Convert risk score to band color class
  const getBandColor = (score) => {
    const band = bandsConfig.find(b => score >= b.min && score <= b.max);
    return band ? band.color : 'band-low';
  };

  // Continuous gradient color matching InventoryClassification exactly:
  // #a82b2b (rust red, score 25) → #dbaf58 (mustard/tan, score ~12) → #3f6212 (forest olive, score 1)
  const getScoreColor = (score, opacity = 1) => {
    const t = Math.max(0, Math.min(1, (score - 1) / 24)); // 0 = score 1 (green), 1 = score 25 (red)
    // 3 stops matching InventoryClassification palette
    const stops = [
      { pos: 0,   r: 63,  g: 98,  b: 18  }, // forest olive green (#3f6212)
      { pos: 0.5, r: 219, g: 175, b: 88  }, // warm mustard/tan (#dbaf58)
      { pos: 1,   r: 168, g: 43,  b: 43  }, // rust red (#a82b2b)
    ];
    let i = 0;
    for (let s = 1; s < stops.length; s++) {
      if (t <= stops[s].pos) { i = s - 1; break; }
      if (s === stops.length - 1) i = s - 1;
    }
    const segT = (t - stops[i].pos) / (stops[i + 1].pos - stops[i].pos);
    const r = Math.round(stops[i].r + segT * (stops[i + 1].r - stops[i].r));
    const g = Math.round(stops[i].g + segT * (stops[i + 1].g - stops[i].g));
    const b = Math.round(stops[i].b + segT * (stops[i + 1].b - stops[i].b));
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const [scoredComponents, setScoredComponents] = useState([]);
  const [isScoringLoading, setIsScoringLoading] = useState(false);

  useEffect(() => {
    let active = true;
    async function fetchScores() {
      if (!components || components.length === 0) return;
      setIsScoringLoading(true);
      try {
        const scores = await fetchCriticalityScores(components, {
          sdeWeights,
          vedWeights,
          countryTiers,
          bandsConfig,
          stockoutConfig
        });
        if (active) {
          setScoredComponents(scores);
        }
      } catch (err) {
        console.error('Failed to fetch criticality scores from backend:', err);
      } finally {
        if (active) {
          setIsScoringLoading(false);
        }
      }
    }
    fetchScores();
    return () => {
      active = false;
    };
  }, [components, sdeWeights, vedWeights, countryTiers, bandsConfig, stockoutConfig]);

  // Unique categories list for filters
  const categories = useMemo(() => {
    return ['All', ...new Set(components.map(c => c.category))];
  }, [components]);

  // KPI band counters
  const bandKPIs = useMemo(() => {
    const kpis = {
      Low: { count: 0, value: 0 },
      Moderate: { count: 0, value: 0 },
      High: { count: 0, value: 0 },
      'Very High': { count: 0, value: 0 },
      Critical: { count: 0, value: 0 }
    };
    scoredComponents.forEach(c => {
      if (kpis[c.band]) {
        kpis[c.band].count++;
        kpis[c.band].value += convertAmount(c.inventoryValue);
      }
    });
    return kpis;
  }, [scoredComponents, convertAmount]);

  // Compute 5x5 Matrix coordinates count & value mapping
  const matrix5x5Map = useMemo(() => {
    const grid = {};
    for (let r = 1; r <= 5; r++) {
      grid[r] = {};
      for (let c = 1; c <= 5; c++) {
        grid[r][c] = { count: 0, value: 0, items: [] };
      }
    }
    scoredComponents.forEach(item => {
      const s = item.sdeScore;
      const v = item.vedScore;
      if (grid[s] && grid[s][v]) {
        grid[s][v].count++;
        grid[s][v].value += convertAmount(item.inventoryValue);
        grid[s][v].items.push(item);
      }
    });
    return grid;
  }, [scoredComponents, convertAmount]);

  // Dynamic row heights (SDE rows 1-5) and column widths (VED columns 1-5) for 5x5 heatmap sizing
  const colWidths = useMemo(() => {
    if (matrixSizingMode === 'equal') {
      return [1.0, 1.0, 1.0, 1.0, 1.0];
    }
    if (matrixSizingMode === 'score') {
      return [1.0, 2.0, 3.0, 4.0, 5.0];
    }
    if (matrixSizingMode === 'count') {
      const total = scoredComponents.length || 1;
      return [1, 2, 3, 4, 5].map(v => {
        const count = scoredComponents.filter(c => c.vedScore === v).length;
        return 1.0 + (count / total) * 3.0;
      });
    }
    const total = scoredComponents.reduce((sum, c) => sum + convertAmount(c.inventoryValue), 0) || 1;
    return [1, 2, 3, 4, 5].map(v => {
      const val = scoredComponents.filter(c => c.vedScore === v).reduce((sum, c) => sum + convertAmount(c.inventoryValue), 0);
      return 1.0 + (val / total) * 3.0;
    });
  }, [scoredComponents, convertAmount, matrixSizingMode]);

  const rowHeights = useMemo(() => {
    if (matrixSizingMode === 'equal') {
      return [1.0, 1.0, 1.0, 1.0, 1.0];
    }
    if (matrixSizingMode === 'score') {
      return [1.0, 2.0, 3.0, 4.0, 5.0];
    }
    if (matrixSizingMode === 'count') {
      const total = scoredComponents.length || 1;
      return [1, 2, 3, 4, 5].map(s => {
        const count = scoredComponents.filter(c => c.sdeScore === s).length;
        return 1.0 + (count / total) * 3.0;
      });
    }
    const total = scoredComponents.reduce((sum, c) => sum + convertAmount(c.inventoryValue), 0) || 1;
    return [1, 2, 3, 4, 5].map(s => {
      const val = scoredComponents.filter(c => c.sdeScore === s).reduce((sum, c) => sum + convertAmount(c.inventoryValue), 0);
      return 1.0 + (val / total) * 3.0;
    });
  }, [scoredComponents, convertAmount, matrixSizingMode]);

  // Treemap data processing
  const treemapData = useMemo(() => {
    if (treemapGroup === 'product') {
      const categoryGroups = {};
      scoredComponents.forEach(r => {
        const val = matrixSizingMode === 'value' 
          ? convertAmount(r.inventoryValue) 
          : matrixSizingMode === 'count' 
            ? 1 
            : r.compositeScore;
        if (val <= 0) return;
        const cat = r.category || 'Other';
        if (!categoryGroups[cat]) {
          categoryGroups[cat] = { name: cat, children: [] };
        }
        categoryGroups[cat].children.push({
          name: r.description,
          erpCode: r.erpCode,
          value: val,
          score: r.compositeScore,
          band: r.band,
          colorClass: r.colorClass,
          formattedValue: matrixSizingMode === 'value' ? formatCurrency(convertAmount(r.inventoryValue), currency) : matrixSizingMode === 'count' ? '1 component' : `${val} points`,
          itemsCount: 1,
          rawItem: r
        });
      });
      return Object.values(categoryGroups).sort((a, b) => {
        const valA = a.children.reduce((sum, c) => sum + c.value, 0);
        const valB = b.children.reduce((sum, c) => sum + c.value, 0);
        return valB - valA;
      });
    }

    if (treemapGroup === 'category') {
      const parentGroup = { name: 'Classified Categories', children: [] };
      const categoryValues = {};
      
      scoredComponents.forEach(r => {
        const cat = r.category || 'Other';
        const val = matrixSizingMode === 'value' 
          ? convertAmount(r.inventoryValue) 
          : matrixSizingMode === 'count' 
            ? 1 
            : r.compositeScore;
        if (val <= 0) return;
        if (!categoryValues[cat]) {
          categoryValues[cat] = { name: cat, value: 0, itemsCount: 0, scoresSum: 0, dollarsSum: 0 };
        }
        categoryValues[cat].value += val;
        categoryValues[cat].itemsCount++;
        categoryValues[cat].scoresSum += r.compositeScore;
        categoryValues[cat].dollarsSum += convertAmount(r.inventoryValue);
      });

      parentGroup.children = Object.values(categoryValues).map(c => {
        const avgScore = c.itemsCount > 0 ? Math.round(c.scoresSum / c.itemsCount) : 1;
        const band = bandsConfig.find(b => avgScore >= b.min && avgScore <= b.max) || bandsConfig[0];
        return {
          name: c.name,
          value: c.value,
          score: avgScore,
          band: band.name,
          colorClass: band.color,
          formattedValue: matrixSizingMode === 'value' ? formatCurrency(c.dollarsSum, currency) : `${c.itemsCount} components`,
          itemsCount: c.itemsCount,
          rawItem: null
        };
      }).filter(x => x.value > 0).sort((a, b) => b.value - a.value);

      return [parentGroup];
    }

    if (treemapGroup === 'cell') {
      const sdeGroups = {};
      scoredComponents.forEach(r => {
        const key = `${r.sdeScore}-${r.vedScore}`;
        const val = matrixSizingMode === 'value' 
          ? convertAmount(r.inventoryValue) 
          : matrixSizingMode === 'count' 
            ? 1 
            : r.compositeScore;
        if (val <= 0) return;

        const parentName = `SDE ${r.sdeScore}`;
        if (!sdeGroups[parentName]) {
          sdeGroups[parentName] = { name: parentName, children: [] };
        }
        
        let cNode = sdeGroups[parentName].children.find(c => c.cellKey === key);
        if (!cNode) {
          cNode = { 
            cellKey: key,
            name: `${r.band} Criticality (SDE ${r.sdeScore} · VED ${r.vedScore})`,
            value: 0,
            score: r.compositeScore,
            band: r.band,
            colorClass: r.colorClass,
            itemsCount: 0,
            dollarsSum: 0
          };
          sdeGroups[parentName].children.push(cNode);
        }
        cNode.value += val;
        cNode.itemsCount++;
        cNode.dollarsSum += convertAmount(r.inventoryValue);
      });

      Object.values(sdeGroups).forEach(group => {
        group.children.forEach(c => {
          c.formattedValue = matrixSizingMode === 'value' ? formatCurrency(c.dollarsSum, currency) : `${c.itemsCount} components`;
        });
        group.children = group.children.filter(c => c.value > 0);
      });

      return Object.values(sdeGroups).filter(group => group.children.length > 0);
    }

    return [];
  }, [scoredComponents, treemapGroup, matrixSizingMode, convertAmount, currency, bandsConfig]);



  const handleTreemapClick = (node) => {
    if (!node) return;
    
    if (treemapGroup === 'product') {
      setSearchTerm(prev => prev === node.erpCode ? '' : node.erpCode);
      setSelectedCell(null);
    } else if (treemapGroup === 'category') {
      setCategoryFilter(prev => prev === node.name ? 'All' : node.name);
      setSelectedCell(null);
    } else if (treemapGroup === 'cell') {
      if (node.cellKey) {
        const [s, v] = node.cellKey.split('-').map(Number);
        setSelectedCell(prev => prev && prev.sde === s && prev.ved === v ? null : { sde: s, ved: v });
        setSearchTerm('');
      }
    }
  };

  // Filter components for the list table
  const filteredComponents = useMemo(() => {
    let result = [...scoredComponents];

    if (categoryFilter !== 'All') {
      result = result.filter(c => c.category === categoryFilter);
    }

    if (selectedBand !== 'All') {
      result = result.filter(c => c.band === selectedBand);
    }

    if (selectedCell) {
      result = result.filter(c => c.sdeScore === selectedCell.sde && c.vedScore === selectedCell.ved);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.erpCode.toLowerCase().includes(term) ||
        c.hsCode.toLowerCase().includes(term) ||
        c.description.toLowerCase().includes(term) ||
        c.supplierName.toLowerCase().includes(term)
      );
    }

    return result;
  }, [scoredComponents, categoryFilter, selectedBand, selectedCell, searchTerm]);

  // Currency Formatter
  const fmt = (amount) => formatCurrency(amount, currency);

  const adjustWeights = (prevWeights, field, targetVal) => {
    const keys = Object.keys(prevWeights);
    const otherKeys = keys.filter(k => k !== field);
    const oldVal = prevWeights[field];
    const newVal = Number(targetVal);
    const diff = newVal - oldVal;

    if (diff === 0) return prevWeights;

    const updated = { ...prevWeights, [field]: newVal };

    let remainingDiff = -diff;
    let activeKeys = [...otherKeys];

    // Iterative redistribution to respect 0-1 bounds
    while (Math.abs(remainingDiff) > 0.0001 && activeKeys.length > 0) {
      const changePerKey = remainingDiff / activeKeys.length;
      const nextActiveKeys = [];
      let nextRemainingDiff = 0;

      for (const key of activeKeys) {
        const currentVal = updated[key];
        const proposedVal = currentVal + changePerKey;

        if (proposedVal < 0) {
          updated[key] = 0;
          const appliedChange = -currentVal;
          nextRemainingDiff += (changePerKey - appliedChange);
        } else if (proposedVal > 1) {
          updated[key] = 1;
          const appliedChange = 1 - currentVal;
          nextRemainingDiff += (changePerKey - appliedChange);
        } else {
          updated[key] = proposedVal;
          nextActiveKeys.push(key);
        }
      }

      activeKeys = nextActiveKeys;
      remainingDiff = nextRemainingDiff;
    }

    // Force strict 1.0 sum normalization for microscopic rounding error
    const sum = keys.reduce((s, k) => s + updated[k], 0);
    if (Math.abs(sum - 1.0) > 0.0001) {
      const adjustKey = otherKeys.find(k => updated[k] > 0 && updated[k] < 1) || otherKeys[0];
      updated[adjustKey] = Math.max(0, Math.min(1, updated[adjustKey] + (1.0 - sum)));
    }

    // Round to 4 decimals to avoid float representation issues in state
    for (const k of keys) {
      updated[k] = Math.round(updated[k] * 10000) / 10000;
    }

    return updated;
  };

  const handleUpdateSdeWeight = (field, val) => {
    setSdeWeights(prev => adjustWeights(prev, field, val));
  };

  const handleUpdateVedWeight = (field, val) => {
    setVedWeights(prev => adjustWeights(prev, field, val));
  };

  const handleAddCountryRisk = () => {
    if (!newCountryName.trim()) return;
    setCountryTiers(prev => ({
      ...prev,
      [newCountryName.trim()]: Number(newCountryRisk)
    }));
    setNewCountryName('');
  };

  const handleRemoveCountryRisk = (country) => {
    setCountryTiers(prev => {
      const updated = { ...prev };
      delete updated[country];
      return updated;
    });
  };

  const handleResetSettings = () => {
    setSdeWeights({
      concentration: 0.25,
      leadTime: 0.20,
      reliability: 0.20,
      buffer: 0.20,
      moq: 0.10,
      geography: 0.05
    });
    setVedWeights({
      prodStop: 0.35,
      bottleneck: 0.20,
      substitutability: 0.20,
      safetyQuality: 0.15,
      recovery: 0.10
    });
    setCountryTiers(initialCountryTiers);
    setBandsConfig([
      { name: 'Low', min: 1, max: 4, desc: 'Standard planning; low-touch review', color: 'band-low' },
      { name: 'Moderate', min: 5, max: 9, desc: 'Planner monitoring; monthly review', color: 'band-moderate' },
      { name: 'High', min: 10, max: 15, desc: 'Safety stock & supplier review', color: 'band-high' },
      { name: 'Very High', min: 16, max: 20, desc: 'Alternate source; weekly review', color: 'band-veryhigh' },
      { name: 'Critical', min: 21, max: 25, desc: 'Executive watchlist; watchlist', color: 'band-critical' }
    ]);
  };

  const handleFormChange = async (field, val) => {
    setManualInput(prev => ({ ...prev, [field]: val }));
    
    if (field === 'hsCode') {
      const cleaned = String(val).replace(/[^0-9]/g, '');
      if (cleaned.length === 0) {
        setManualRecs([]);
        setShowManualRec(false);
      }
      
      if (cleaned.length === 4 || cleaned.length === 6) {
        const liveDesc = await lookupHSCodeDescription(cleaned);
        if (liveDesc) {
          setManualInput(prev => ({
            ...prev,
            description: liveDesc
          }));
        }
      }

      if (cleaned.length === 2 || cleaned.length === 4 || cleaned.length === 6) {
        setIsManualRecLoading(true);
        setShowManualRec(true);
        getHSCodesRecommendation(cleaned).then(recs => {
          setIsManualRecLoading(false);
          if (recs) {
            setManualRecs(recs);
          } else {
            setManualRecs([]);
          }
        }).catch(() => {
          setIsManualRecLoading(false);
          setManualRecs([]);
        });
      } else {
        setManualRecs([]);
        setShowManualRec(false);
      }
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!manualInput.erpCode.trim() || !manualInput.description.trim()) {
      alert("Please provide both ERP Code and Description.");
      return;
    }

    const newComponent = {
      ...manualInput,
      inHandInventory: Number(manualInput.inHandInventory || 0),
      inventoryValue: Number(manualInput.inventoryValue || 0),
      inTransitInventory: Number(manualInput.inTransitInventory || 0),
      daysOfCoverage: Number(manualInput.daysOfCoverage || 20),
      roq: Number(manualInput.roq || 10),
      safetyStock: Number(manualInput.safetyStock || 5),
      supplyPct: Number(manualInput.supplyPct || 100),
      reliabilityOTIF: Number(manualInput.reliabilityOTIF || 90),
      leadTimeDays: Number(manualInput.leadTimeDays || 15),
      moq: Number(manualInput.moq || 1),
      isCustom: true
    };

    setComponents(prev => {
      // Check if updating existing erpCode
      const idx = prev.findIndex(c => c.erpCode === newComponent.erpCode);
      if (idx > -1) {
        const copy = [...prev];
        copy[idx] = newComponent;
        return copy;
      }
      return [newComponent, ...prev];
    });

    // Reset input fields
    setManualInput({
      erpCode: '',
      hsCode: '',
      category: 'Engine',
      description: '',
      inHandInventory: 50,
      inventoryValue: 10000,
      inTransitInventory: 0,
      daysOfCoverage: 30,
      roq: 100,
      safetyStock: 10,
      supplierCode: 'SUP0001',
      supplierName: 'New Supplier',
      countryOfOrigin: 'India',
      supplyPct: 100,
      reliabilityOTIF: 95,
      leadTimeDays: 15,
      moq: 10,
      prodStop: 3,
      bottleneck: 3,
      substitutability: 3,
      safetyQuality: 3,
      recovery: 3
    });
    setEditingComponent(null);
  };

  const handleEditClick = (comp) => {
    setEditingComponent(comp.erpCode);
    setManualInput(comp);
    setActiveTab('manual');
  };

  const handleDeleteClick = (erpCode) => {
    if (confirm(`Are you sure you want to delete component ${erpCode}?`)) {
      setComponents(prev => prev.filter(c => c.erpCode !== erpCode));
    }
  };

  // --- CSV UPLOAD/EXPORT ACTIONS ---
  const handleCSVUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target.result;
      const lines = text.split(/\r?\n/);
      if (lines.length <= 1) return;

      const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const parsedData = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = [];
        let current = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        const row = {};
        headers.forEach((header, index) => {
          let val = values[index] || '';
          val = val.replace(/^"|"$/g, '');
          row[header] = val;
        });

        if (row.erpCode) {
          parsedData.push({
            erpCode: row.erpCode,
            hsCode: row.hsCode || '851220',
            category: row.category || 'Electrical',
            description: row.description || 'Uploaded Component',
            inHandInventory: Number(row.inHandInventory || 0),
            inventoryValue: Number(row.inventoryValue || 0),
            inTransitInventory: Number(row.inTransitInventory || 0),
            daysOfCoverage: Number(row.daysOfCoverage || 30),
            roq: Number(row.roq || 100),
            safetyStock: Number(row.safetyStock || 10),
            supplierCode: row.supplierCode || 'SUP-UP',
            supplierName: row.supplierName || 'Uploaded Supplier',
            countryOfOrigin: row.countryOfOrigin || 'India',
            supplyPct: Number(row.supplyPct || 100),
            reliabilityOTIF: Number(row.reliabilityOTIF || 90),
            leadTimeDays: Number(row.leadTimeDays || 15),
            moq: Number(row.moq || 1),
            prodStop: Number(row.prodStop || 3),
            bottleneck: Number(row.bottleneck || 3),
            substitutability: Number(row.substitutability || 3),
            safetyQuality: Number(row.safetyQuality || 3),
            recovery: Number(row.recovery || 3),
            isCustom: true
          });
        }
      }

      if (parsedData.length > 0) {
        setComponents(prev => {
          // Merge uploaded items (overwrite duplicates by erpCode)
          const merged = [...prev];
          parsedData.forEach(newComp => {
            const idx = merged.findIndex(c => c.erpCode === newComp.erpCode);
            if (idx > -1) {
              merged[idx] = newComp;
            } else {
              merged.unshift(newComp);
            }
          });
          return merged;
        });
        alert(`Successfully imported ${parsedData.length} components!`);
      }
    };
    reader.readAsText(file);
  };

  const handleDownloadTemplate = () => {
    const headers = [
      'erpCode', 'hsCode', 'category', 'description', 'inHandInventory', 'inventoryValue',
      'inTransitInventory', 'daysOfCoverage', 'roq', 'safetyStock', 'supplierCode', 
      'supplierName', 'countryOfOrigin', 'supplyPct', 'reliabilityOTIF', 'leadTimeDays', 'moq',
      'prodStop', 'bottleneck', 'substitutability', 'safetyQuality', 'recovery'
    ];
    
    const sampleRow = [
      'PRD0101', '851220', 'Electrical', 'Rear tail light module', '50', '25000',
      '20', '45', '100', '10', 'SUP0101',
      'AutoLamps Ltd', 'Germany', '100', '96', '14', '5',
      '3', '3', '2', '4', '2'
    ];
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), sampleRow.join(',')].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "SDE_VED_Inventory_Analysis_Template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportScoredCSV = () => {
    const headers = [
      'ERP Code', 'HS Code', 'Category', 'Description', 'In-Hand Inventory',
      'Inventory Value', 'In-Transit Inventory', 'Days of Cover', 'ROQ', 'Safety Stock', 'SDE Score', 'VED Score',
      'Composite Score', 'Criticality Band', 'Buffer-to-Lead-Time Ratio', 'MOQ Stress Ratio',
      'Supplier Dependency Flag', 'Stockout Exposure Flag'
    ];
    
    const rows = filteredComponents.map(item => [
      item.erpCode,
      item.hsCode,
      item.category,
      `"${item.description.replace(/"/g, '""')}"`,
      item.inHandInventory,
      item.inventoryValue,
      item.inTransitInventory,
      item.daysOfCoverage,
      item.roq,
      item.safetyStock,
      item.sdeScore,
      item.vedScore,
      item.compositeScore,
      item.band,
      item.bufferRatio.toFixed(2),
      item.moqRatio.toFixed(2),
      item.supplierDependencyFlag,
      item.stockoutExposureFlag
    ]);
    
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "Scored_Inventory_Analysis.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* CARD HEADER WITH SETTINGS ICON */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Score supply chain risk on SDE (Procurement difficulty) & VED (Stoppage criticality). Range: 1–25.
        </div>
        <button 
          onClick={() => setSettingsOpen(!settingsOpen)}
          className={`btn ${settingsOpen ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Settings2 size={15} />
          {settingsOpen ? 'Hide Configuration' : 'Scoring Parameter Settings'}
        </button>
      </div>

      {/* COLLAPSIBLE CONFIGURATION PANEL */}
      {settingsOpen && (
        <div className="glass-card animate-scale-in" style={{ padding: '20px', border: '1px solid var(--border-medium)', background: 'var(--bg-tertiary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '15px', fontWeight: 700, color: 'var(--text-bright)' }}>
              <Sliders size={18} className="text-accent" />
              Dynamic Weight & Threshold Configurations
            </div>
            <button className="btn btn-secondary btn-sm" onClick={handleResetSettings}>
              <RefreshCw size={12} style={{ marginRight: '6px' }} />
              Reset Defaults
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
            {/* SDE Weights */}
            <div>
              <div style={{ fontWeight: 650, fontSize: '13px', color: 'var(--text-accent)', marginBottom: '10px' }}>SDE procurement difficulty sub-factors weights (Sum: 1.0)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { key: 'concentration', name: 'Supplier Concentration' },
                  { key: 'leadTime', name: 'Lead Time' },
                  { key: 'reliability', name: 'Reliability/OTIF' },
                  { key: 'buffer', name: 'Buffer Ratio' },
                  { key: 'moq', name: 'MOQ Rigidity' },
                  { key: 'geography', name: 'Geography Risk' }
                ].map(w => (
                  <div key={w.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{w.name} ({Math.round((sdeWeights[w.key] || 0) * 100)}%)</span>
                    <input 
                      type="range" min="0" max="1.0" step="0.01" 
                      value={sdeWeights[w.key]} 
                      onChange={(e) => handleUpdateSdeWeight(w.key, e.target.value)} 
                      style={{ width: '100px', accentColor: 'var(--accent-primary)' }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* VED Weights */}
            <div>
              <div style={{ fontWeight: 650, fontSize: '13px', color: 'var(--text-accent)', marginBottom: '10px' }}>VED production criticality sub-factors weights (Sum: 1.0)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { key: 'prodStop', name: 'Line Stoppage' },
                  { key: 'bottleneck', name: 'Bottleneck Dep' },
                  { key: 'substitutability', name: 'Substitutability' },
                  { key: 'safetyQuality', name: 'Safety & Quality' },
                  { key: 'recovery', name: 'Recovery Time' }
                ].map(w => (
                  <div key={w.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{w.name} ({Math.round((vedWeights[w.key] || 0) * 100)}%)</span>
                    <input 
                      type="range" min="0" max="1.0" step="0.01" 
                      value={vedWeights[w.key]} 
                      onChange={(e) => handleUpdateVedWeight(w.key, e.target.value)} 
                      style={{ width: '100px', accentColor: 'var(--accent-primary)' }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC KPI SUMMARY CARDS */}
      <div className="kpi-grid stagger-children">
        {bandsConfig.map(band => {
          const kpi = bandKPIs[band.name] || { count: 0, value: 0 };
          return (
            <div 
              key={band.name} 
              onClick={() => setSelectedBand(prev => prev === band.name ? 'All' : band.name)}
              className={`kpi-card animate-scale-in clickable ${selectedBand === band.name ? 'active border-primary' : ''}`}
              style={{ borderLeft: `4px solid ${getScoreColor(Math.round((band.min + band.max) / 2))}` }}
            >
              <div className="kpi-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{band.name} Risk</span>
                <span style={{ fontSize: '9px', textTransform: 'uppercase', background: getScoreColor(Math.round((band.min + band.max) / 2), 0.2), color: getScoreColor(Math.round((band.min + band.max) / 2)), padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>{band.min}-{band.max}</span>
              </div>
              <div className="kpi-value" style={{ fontSize: '20px' }}>
                {kpi.count} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>items</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--success)', fontWeight: 650, marginTop: '2px' }}>
                {fmt(kpi.value)} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>locked</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* TWO-COLUMN GRID: 5X5 MATRIX VS INPUT FORM */}
      <div 
        className="criticality-layout-grid" 
        style={{ 
          display: 'grid', 
          gridTemplateColumns: isInputPanelCollapsed ? '1fr 80px' : '1fr 1fr', 
          transition: 'grid-template-columns 0.35s cubic-bezier(0.4, 0, 0.2, 1)',
          gap: '20px',
          alignItems: 'start'
        }}
      >
        
        {/* Left Side: Sourcing & Criticality Treemap View */}
        <div 
          className="glass-card animate-slide-up" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column',
            padding: '24px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
            <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} className="icon" />
              Sourcing & Criticality Treemap View
            </div>
          </div>
          
          {/* Subtitle & Grouping Filters */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Click tiles to filter table. Tile size represents {matrixSizingMode === 'value' ? 'inventory cash value' : matrixSizingMode === 'count' ? 'number of components' : 'VED * SDE composite score'}.
            </div>
            
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Sizing pill */}
              <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-tertiary)', padding: '2.5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '9.5px', alignSelf: 'center', color: 'var(--text-muted)', padding: '0 4px', fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Size:</span>
                {['score', 'value'].map(sz => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setMatrixSizingMode(sz)}
                    className={`tab ${matrixSizingMode === sz ? 'active' : ''}`}
                    style={{
                      padding: '3px 8px',
                      fontSize: '10px',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      background: matrixSizingMode === sz ? 'var(--accent-gradient)' : 'transparent',
                      color: matrixSizingMode === sz ? 'white' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontFamily: "'Inter', sans-serif"
                    }}
                  >
                    {sz === 'score' ? 'Score' : 'Value'}
                  </button>
                ))}
              </div>

              {/* Grouping pill */}
              <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-tertiary)', padding: '2.5px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: '9.5px', alignSelf: 'center', color: 'var(--text-muted)', padding: '0 4px', fontWeight: 650, textTransform: 'uppercase', letterSpacing: '0.3px' }}>Group:</span>
                {['product', 'category'].map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setTreemapGroup(g)}
                    className={`tab ${treemapGroup === g ? 'active' : ''}`}
                    style={{
                      padding: '3px 8px',
                      fontSize: '10px',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      background: treemapGroup === g ? 'var(--text-primary)' : 'transparent',
                      color: treemapGroup === g ? 'var(--bg-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontWeight: 650,
                      fontFamily: "'Inter', sans-serif"
                    }}
                  >
                    {g === 'product' ? 'Products' : 'Categories'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Visual Container (Proportional Packed HTML Treemap) */}
          <div style={{ position: 'relative', flexShrink: 0, marginTop: '4px' }}>
            <div
              ref={containerRef}
              style={{
                width: '100%',
                height: '380px',
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

                    return (
                      <>
                        {layoutCards.map((card, idx) => {
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
                                background: getScoreColor(card.score || 1),
                                color: '#ffffff',
                                border: document.documentElement.classList.contains('light-theme') ? '2px solid #ffffff' : '2px solid var(--bg-secondary)',
                                display: 'flex',
                                flexDirection: 'column',
                                justifyContent: 'center',
                                alignItems: 'center',
                                cursor: 'pointer',
                                overflow: 'hidden',
                                transition: 'transform 0.15s ease-out, filter 0.15s ease-out',
                                textShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
                                textAlign: 'center',
                                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                                letterSpacing: '-0.01em'
                              }}
                              className="treemap-rect"
                            >
                              {/* Name */}
                              <div
                                style={{
                                  fontWeight: 500,
                                  fontSize: card.w > 120 ? '13px' : card.w > 80 ? '11px' : '9.5px',
                                  lineHeight: 1.25,
                                  textAlign: 'center',
                                  width: '100%',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: card.h > 60 ? 3 : 2,
                                  WebkitBoxOrient: 'vertical',
                                  marginBottom: '3px',
                                  pointerEvents: 'none',
                                  letterSpacing: '0.01em'
                                }}
                              >
                                {card.name}
                              </div>
                              
                              {/* Value */}
                              {card.h > 45 && (
                                <div
                                  style={{
                                    fontWeight: 400,
                                    fontSize: card.w > 120 ? '12px' : card.w > 80 ? '10.5px' : '9px',
                                    opacity: 0.9,
                                    textAlign: 'center',
                                    pointerEvents: 'none',
                                    letterSpacing: '0'
                                  }}
                                >
                                  {card.formattedValue}
                                </div>
                              )}
    
                              {/* Info Badge */}
                              {card.w > 95 && card.h > 70 && (
                                <div
                                  style={{
                                    fontSize: '8px',
                                    fontWeight: 500,
                                    marginTop: '6px',
                                    background: 'rgba(0, 0, 0, 0.2)',
                                    padding: '2px 6px',
                                    borderRadius: '3px',
                                    letterSpacing: '0.8px',
                                    textTransform: 'uppercase',
                                    pointerEvents: 'none',
                                    border: '1px solid rgba(255, 255, 255, 0.12)'
                                  }}
                                >
                                  {card.erpCode || `${card.band} Band`}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </>
                    );
                  })()}
            </div>

            {/* Cursor-Following Glassmorphic Tooltip */}
            {hoveredCard && (
                  <div 
                    className="glass-card animate-scale-in" 
                    style={{ 
                      position: 'absolute',
                      left: `${mousePos.x > dimensions.width - 250 ? mousePos.x - 240 - 15 : mousePos.x + 15}px`,
                      top: `${mousePos.y > dimensions.height - 250 ? mousePos.y - 230 - 15 : mousePos.y + 15}px`,
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
                        ERP: {hoveredCard.erpCode} · Segment: {hoveredCard.band}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '8px' }}>
                        Segment: {treemapGroup === 'category' ? 'Product Category' : 'SDE-VED Cell'}
                      </div>
                    )}

                    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Weighted Rating:</span>
                        <span style={{ fontWeight: 700, color: getScoreColor(hoveredCard.score || 1) }}>
                          {hoveredCard.score} points
                        </span>
                      </div>
                      
                      {hoveredCard.rawItem && (
                        <>
                          <div style={{ fontSize: '11.5px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Inventory Value:</span>
                            <span style={{ fontWeight: 700, color: 'var(--success)' }}>{formatCurrency(convertAmount(hoveredCard.rawItem.inventoryValue), currency)}</span>
                          </div>
                          <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>SDE * VED Rating:</span>
                            <span style={{ fontWeight: 700, color: 'var(--text-accent)' }}>{hoveredCard.rawItem.sdeScore} * {hoveredCard.rawItem.vedScore} ({hoveredCard.rawItem.compositeScore})</span>
                          </div>
                          <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Lead Time:</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{hoveredCard.rawItem.leadTimeDays} days</span>
                          </div>
                          <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>Supplier Reliability:</span>
                            <span style={{ fontWeight: 600, color: 'var(--success)' }}>{hoveredCard.rawItem.reliabilityOTIF}% OTIF</span>
                          </div>
                          <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>In-Hand / Safety:</span>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{hoveredCard.rawItem.inHandInventory} / {hoveredCard.rawItem.safetyStock}</span>
                          </div>
                        </>
                      )}

                      {!hoveredCard.rawItem && (
                        <div style={{ fontSize: '11px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Components:</span>
                          <span style={{ fontWeight: 700, color: 'var(--text-bright)' }}>{hoveredCard.itemsCount} items</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
          </div>

        </div>

        {/* Right Side: Manual input form and CSV bulk upload */}
        <div 
          className="glass-card animate-slide-up" 
          style={{ 
            display: 'flex', 
            flexDirection: 'column',
            padding: isInputPanelCollapsed ? '12px 8px' : '24px',
            transition: 'padding 0.35s ease',
            minHeight: '446px'
          }}
        >
          {isInputPanelCollapsed ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', height: '100%' }}>
              <button
                type="button"
                onClick={() => setIsInputPanelCollapsed(false)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title="Expand Sourcing Input Panel"
              >
                <ChevronLeft size={18} />
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '20px', alignItems: 'center' }}>
                <Upload size={18} style={{ opacity: 0.6 }} title="CSV Bulk Import" />
                <Plus size={18} style={{ opacity: 0.6 }} title="Manual Component Entry" />
              </div>
            </div>
          ) : (
            <>
              {/* Tabs with Collapse Button */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', flex: 1, background: 'var(--bg-tertiary)', padding: '3px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <button 
              onClick={() => setActiveTab('upload')}
              className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
              style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
            >
              <Upload size={14} />
              CSV Bulk Import
            </button>
            <button 
              onClick={() => setActiveTab('manual')}
              className={`tab ${activeTab === 'manual' ? 'active' : ''}`}
              style={{ flex: 1, padding: '6px', fontSize: '12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} />
              {editingComponent ? 'Edit Component' : 'Manual Component Entry'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setIsInputPanelCollapsed(true)}
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: '12px', padding: '6px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Collapse Sourcing Input Panel"
          >
            <ChevronRight size={15} />
          </button>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* Tab 1: CSV Upload */}
            {activeTab === 'upload' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', height: '100%' }}>
                <div style={{ border: '2px dashed var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '24px 16px', textAlign: 'center', background: 'rgba(255,255,255,0.01)', transition: 'border-color 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <FileSpreadsheet size={40} className="text-accent" style={{ opacity: 0.8 }} />
                  <div>
                    <div style={{ fontWeight: 650, fontSize: '13.5px', color: 'var(--text-bright)' }}>Bulk Load Component Database</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>Upload a CSV master to instantly compute all SDE & VED criticality values.</div>
                  </div>
                  <label className="btn btn-secondary btn-sm clickable" style={{ cursor: 'pointer', marginTop: '6px' }}>
                    <Upload size={13} style={{ marginRight: '6px' }} />
                    Choose Scored CSV file
                    <input type="file" accept=".csv" onChange={handleCSVUpload} style={{ display: 'none' }} />
                  </label>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Download Sample Excel / CSV Templates:</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={handleDownloadTemplate} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11.5px' }}>
                      <Download size={13} />
                      Download Empty Template
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Manual Component Entry */}
            {activeTab === 'manual' && (
              <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label className="form-label">ERP Code</label>
                    <input 
                      type="text" placeholder="e.g. PRD0101" className="form-input form-input-sm" required
                      value={manualInput.erpCode} onChange={e => handleFormChange('erpCode', e.target.value)}
                      disabled={!!editingComponent}
                    />
                  </div>
                  <div style={{ position: 'relative' }}>
                    <label className="form-label">HS Code</label>
                    <input 
                      type="text" placeholder="e.g. 870899" className="form-input form-input-sm"
                      value={manualInput.hsCode} 
                      onChange={e => handleFormChange('hsCode', e.target.value)}
                      onFocus={() => {
                        if (manualInput.hsCode.length >= 2) {
                          setShowManualRec(true);
                        }
                      }}
                      onBlur={() => setTimeout(() => setShowManualRec(false), 250)}
                    />
                    {showManualRec && (manualRecs.length > 0 || isManualRecLoading) && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-strong)',
                        borderRadius: 'var(--radius-sm)', padding: '4px',
                        boxShadow: 'var(--shadow-lg)', width: '280px', maxHeight: '200px', overflowY: 'auto',
                      }}>
                        {isManualRecLoading && (
                          <div style={{ padding: '8px 10px', color: 'var(--text-muted)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="animate-pulse">🌐</span>
                            <span>Querying recommendations...</span>
                          </div>
                        )}
                        {manualRecs.map((rec, index) => (
                          <div
                            key={`manual-rec-${index}`}
                            style={{
                              padding: '8px 10px', cursor: 'pointer', borderRadius: '4px',
                              background: 'var(--accent-gradient-subtle)',
                              display: 'flex', flexDirection: 'column', gap: '2px',
                              marginBottom: index < manualRecs.length - 1 ? '4px' : '0',
                              borderBottom: index < manualRecs.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                            }}
                            className="sidebar-nav-item"
                            onMouseDown={() => {
                              setManualInput(prev => ({
                                ...prev,
                                hsCode: rec.hsCode,
                                description: rec.description
                              }));
                              setManualRecs([]);
                              setShowManualRec(false);
                            }}
                          >
                            <span style={{ fontSize: '9px', fontWeight: 700, color: 'var(--text-accent)' }}>
                              💡 Dynamic API Recommendation
                            </span>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-bright)' }}>
                              HS {rec.hsCode} · {rec.type}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                              {rec.description}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '8px' }}>
                  <div>
                    <label className="form-label">Category</label>
                    <select 
                      className="form-input form-input-sm"
                      value={manualInput.category} onChange={e => handleFormChange('category', e.target.value)}
                    >
                      {['Engine', 'Transmission', 'Drivetrain', 'Brakes', 'Suspension & Steering', 'Wheels & Tires', 'Electrical', 'Fuel System', 'HVAC', 'Other'].map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Description</label>
                    <input 
                      type="text" placeholder="Part description..." className="form-input form-input-sm" required
                      value={manualInput.description} onChange={e => handleFormChange('description', e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '10px' }}>In-Hand Qty</label>
                    <input 
                      type="number" className="form-input form-input-sm" min="0"
                      value={manualInput.inHandInventory} onChange={e => handleFormChange('inHandInventory', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '10px' }}>Days Cover</label>
                    <input 
                      type="number" className="form-input form-input-sm" min="0"
                      value={manualInput.daysOfCoverage} onChange={e => handleFormChange('daysOfCoverage', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontSize: '10px' }}>Safety Stock</label>
                    <input 
                      type="number" className="form-input form-input-sm" min="0"
                      value={manualInput.safetyStock} onChange={e => handleFormChange('safetyStock', e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', marginTop: '4px' }}>
                  <div style={{ fontWeight: 650, fontSize: '12px', color: 'var(--text-accent)', marginBottom: '8px' }}>Manual Production VED Sub-Factors Rating (1–5)</div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {[
                      { key: 'prodStop', label: vedMeta.prodStop.label, desc: vedMeta.prodStop.desc },
                      { key: 'bottleneck', label: vedMeta.bottleneck.label, desc: vedMeta.bottleneck.desc },
                      { key: 'substitutability', label: vedMeta.substitutability.label, desc: vedMeta.substitutability.desc },
                      { key: 'safetyQuality', label: vedMeta.safetyQuality.label, desc: vedMeta.safetyQuality.desc },
                      { key: 'recovery', label: vedMeta.recovery.label, desc: vedMeta.recovery.desc }
                    ].map(f => (
                      <div key={f.key} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.8fr', gap: '8px', alignItems: 'center' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }} title={f.desc}>{f.label}</div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {[1,2,3,4,5].map(v => (
                            <button
                              key={v} type="button"
                              onClick={() => handleFormChange(f.key, v)}
                              className={`btn btn-sm`}
                              style={{ 
                                flex: 1, padding: '3px 0', fontSize: '10.5px',
                                background: manualInput[f.key] === v ? 'var(--accent-primary)' : 'rgba(255,255,255,0.02)',
                                color: manualInput[f.key] === v ? 'white' : 'var(--text-secondary)',
                                border: manualInput[f.key] === v ? '1px solid var(--accent-primary)' : '1px solid var(--border-subtle)'
                              }}
                            >
                              {v}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                  <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                    {editingComponent ? 'Update Scored Component' : 'Submit & Calculate Score'}
                  </button>
                  {editingComponent && (
                    <button 
                      type="button" className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setEditingComponent(null);
                        setManualInput({
                          erpCode: '', hsCode: '', category: 'Engine', description: '',
                          inHandInventory: 50, inventoryValue: 10000, inTransitInventory: 0,
                          daysOfCoverage: 30, roq: 100, safetyStock: 10, supplierCode: 'SUP0001',
                          supplierName: 'New Supplier', countryOfOrigin: 'India', supplyPct: 100,
                          reliabilityOTIF: 95, leadTimeDays: 15, moq: 10, prodStop: 3,
                          bottleneck: 3, substitutability: 3, safetyQuality: 3, recovery: 3
                        });
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>
        </>
      )}
    </div>
  </div>

      {/* DETAILED TABLE LIST OF COMPONENTS */}
      <div className="glass-card animate-slide-up">
        
        {/* Table Filters & Searches */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
          <div className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FileSpreadsheet size={18} className="icon" />
            Classified Components & Derived Parameters ({filteredComponents.length} items)
            {(selectedCell || selectedBand !== 'All' || categoryFilter !== 'All' || searchTerm) && (
              <span className="badge info" style={{ fontSize: '10.5px', padding: '1px 5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={10} /> Active Filters
              </span>
            )}
          </div>

          <div className="custom-scrollbar" style={{ display: 'flex', gap: '8px', alignItems: 'center', overflowX: 'auto', maxWidth: '100%', paddingBottom: '4px' }}>
            {/* Category Dropdown */}
            <select 
              className="form-input form-input-sm" style={{ minWidth: '150px', width: 'auto', margin: 0 }}
              value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
            >
              {categories.map(cat => <option key={cat} value={cat}>{cat === 'All' ? 'All Categories' : cat}</option>)}
            </select>

            <button className="btn btn-secondary btn-sm" onClick={handleExportScoredCSV}>
              <Download size={13} style={{ marginRight: '6px' }} />
              Export CSV Output
            </button>

            {(selectedCell || selectedBand !== 'All' || categoryFilter !== 'All' || searchTerm) && (
              <button className="btn btn-secondary btn-sm btn-danger" onClick={handleClearFilters}>
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* Real-time search */}
        <input 
          type="text" placeholder="Search components by ERP code, HS code, supplier, or description..."
          className="form-input form-input-sm" style={{ marginBottom: '12px' }}
          value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
        />

        {/* Scored Data Table */}
        <div className="data-table-container" style={{ maxHeight: '350px', overflow: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>ERP Code</th>
                <th>Category</th>
                <th>Description</th>
                <th>SDE Score</th>
                <th>VED Score</th>
                <th>Composite</th>
                <th>Band</th>
                <th>Stockout Flag</th>
                <th>Inv Value</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredComponents.map(comp => (
                <tr key={comp.erpCode} style={{ cursor: 'pointer' }} onClick={() => handleEditClick(comp)}>
                  <td style={{ fontWeight: 650, fontFamily: 'monospace' }}>{comp.erpCode}</td>
                  <td><span className="badge neutral">{comp.category}</span></td>
                  <td style={{ fontWeight: 500, fontSize: '12.5px' }} title={comp.description}>{comp.description}</td>
                  
                  {/* Scores */}
                  <td style={{ fontWeight: 700 }}>{comp.sdeScore} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/ 5</span></td>
                  <td style={{ fontWeight: 700 }}>{comp.vedScore} <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>/ 5</span></td>
                  <td style={{ fontWeight: 800 }}>{comp.compositeScore} <span style={{ fontSize: '10px', color: 'var(--text-accent)' }}>/ 25</span></td>
                  
                  {/* Band */}
                  <td><span className={`badge ${comp.colorClass}`}>{comp.band}</span></td>
                  
                  {/* Stockout Flag */}
                  <td style={{ textAlign: 'center' }}>
                    {comp.stockoutExposureFlag === 1 ? (
                      <span className="badge critical" style={{ fontSize: '10px', fontWeight: 850 }}>RISK OUT</span>
                    ) : (
                      <span className="badge success" style={{ fontSize: '10px', opacity: 0.6 }}>OK</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 650, color: 'var(--success)' }}>{fmt(convertAmount(comp.inventoryValue))}</td>
                  
                  {/* Actions */}
                  <td style={{ textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleEditClick(comp)} style={{ padding: '3px 6px' }} title="Edit Manual VED factors">
                        <Edit3 size={11} />
                      </button>
                      {comp.isCustom && (
                        <button className="btn btn-secondary btn-sm" onClick={() => handleDeleteClick(comp.erpCode)} style={{ padding: '3px 6px', color: 'var(--danger)' }} title="Delete component">
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredComponents.length === 0 && (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)' }}>
                    No component scoring records found matching active filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
