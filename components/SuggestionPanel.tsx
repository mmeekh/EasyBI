import React, { useMemo, useState } from 'react';
import { AggregationType, ChartConfig, ChartType, DashboardItem, Dataset } from '../types';
import ChartRenderer from './ChartRenderer';
import { PlusCircle, BarChart2, TrendingUp, PieChart, Hash, Database, ChevronDown, ChevronRight, CheckSquare, Square, MinusSquare, MapPin } from 'lucide-react';
import { DEFAULT_CHART_CONFIG, THEMES } from '../constants';

interface SuggestionPanelProps {
  datasets: Dataset[];
  mergedDataset: Dataset;
  selectedColumns: Record<string, string[]>;
  onColumnToggle: (datasetId: string, columnKey: string) => void;
  onDatasetToggle: (datasetId: string, allKeys: string[], shouldSelect: boolean) => void;
  onAddChart: (metricKey: string, chartType: ChartType, title: string, aggregation?: AggregationType, categoryKey?: string) => void;
  activeThemeId: string;
  onAddNewData: () => void;
  activeCategories: string[];
  onCategoryFilterChange: (values: string[]) => void;
  onApplyLayout: (items: DashboardItem[], mode: 'replace' | 'append') => void;
}

const SuggestionPanel: React.FC<SuggestionPanelProps> = ({ 
  datasets,
  mergedDataset,
  selectedColumns,
  onColumnToggle,
  onDatasetToggle,
  onAddChart,
  activeThemeId,
  onAddNewData,
  activeCategories,
  onCategoryFilterChange,
  onApplyLayout,
}) => {
  const activeTheme = THEMES.find(t => t.id === activeThemeId) || THEMES[0];
  const [expandedDatasets, setExpandedDatasets] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedDatasets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const stringCols = useMemo(() => mergedDataset.columns.filter((c) => c.type === 'string'), [mergedDataset]);
  const dateCols = useMemo(() => mergedDataset.columns.filter((c) => c.type === 'date'), [mergedDataset]);

  const pickColumnByKeywords = (keywords: string[], allowValues = false) => {
    const lowered = keywords.map((k) => k.toLowerCase());
    const labelMatch = stringCols.find((col) => lowered.some((k) => col.label.toLowerCase().includes(k)));
    if (labelMatch) return labelMatch;
    if (!allowValues) return undefined;

    let bestCol;
    let bestScore = 0;
    const sampleRows = mergedDataset.data.slice(0, 80);

    stringCols.forEach((col) => {
      let score = 0;
      sampleRows.forEach((row) => {
        const raw = row[col.key];
        if (raw === undefined || raw === null) return;
        const value = String(raw).toLowerCase();
        if (lowered.some((k) => value.includes(k))) {
          score += 1;
        }
      });
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    });

    return bestScore > 0 ? bestCol : undefined;
  };

  const locationCol = useMemo(() => {
    return pickColumnByKeywords(
      ['city', 'country', 'region', 'state', 'province', 'location', 'geo', 'sehir', 'ulke', 'bolge', 'il', 'ilce'],
      true,
    );
  }, [pickColumnByKeywords]);

  const categoryCol = useMemo(() => {
    return (
      pickColumnByKeywords(['channel', 'source', 'campaign', 'affiliate', 'email', 'social', 'referral', 'satis', 'urun', 'kategori'], true) ||
      pickColumnByKeywords(['region', 'country', 'city', 'product', 'category', 'segment'], false) ||
      stringCols[0] ||
      dateCols[0] ||
      mergedDataset.columns[0]
    );
  }, [dateCols, mergedDataset.columns, pickColumnByKeywords, stringCols]);

  const dateCol = useMemo(() => {
    return (
      dateCols[0] ||
      pickColumnByKeywords(['date', 'month', 'day', 'year'], false) ||
      categoryCol
    );
  }, [categoryCol, dateCols, pickColumnByKeywords]);

  // Identify numeric columns for metrics
  const metricCols = useMemo(() => {
    return mergedDataset.columns.filter(c => c.type === 'number');
  }, [mergedDataset]);

  const findMetricByKeywords = (keywords: string[]) => {
    const lowered = keywords.map((k) => k.toLowerCase());
    return metricCols.find((col) => lowered.some((k) => col.label.toLowerCase().includes(k)));
  };

  const createDashboardItem = (
    metricKey: string,
    chartType: ChartType,
    title: string,
    options?: {
      categoryKey?: string;
      aggregation?: AggregationType;
      colSpan?: number;
      rowSpan?: number;
      chartConfig?: Partial<ChartConfig>;
    },
  ): DashboardItem => ({
    id: Math.random().toString(36).substr(2, 9),
    datasetId: mergedDataset.id,
    title,
    metricKey,
    categoryKey: options?.categoryKey || categoryCol?.key || '',
    chartType,
    colorTheme: activeThemeId,
    aggregation: chartType === 'kpi' ? options?.aggregation || 'sum' : undefined,
    chartConfig: chartType === 'kpi' ? undefined : { ...DEFAULT_CHART_CONFIG, ...options?.chartConfig },
    colSpan: options?.colSpan || (chartType === 'kpi' ? 2 : chartType === 'geo' ? 6 : 4),
    rowSpan: options?.rowSpan || (chartType === 'kpi' ? 1 : 2),
  });

  const layoutTemplates = useMemo(() => {
    if (metricCols.length === 0) return [];

    const revenueMetric = findMetricByKeywords(['revenue', 'sales', 'income', 'gmv']);
    const profitMetric = findMetricByKeywords(['profit', 'margin']);
    const expenseMetric = findMetricByKeywords(['expense', 'cost', 'spend', 'ad spend']);
    const ordersMetric = findMetricByKeywords(['orders', 'order', 'transactions']);
    const customerMetric = findMetricByKeywords(['customer', 'customers', 'users', 'clients', 'subscribers']);
    const conversionMetric = findMetricByKeywords(['conversion', 'conversions']);
    const clicksMetric = findMetricByKeywords(['clicks', 'click']);

    const templates: {
      id: string;
      title: string;
      description: string;
      score: number;
      tags: string[];
      items: DashboardItem[];
    }[] = [];

    const autoItems: DashboardItem[] = [];
    const primaryMetric = metricCols[0];
    const secondaryMetric = metricCols[1];
    const tertiaryMetric = metricCols[2];

    if (primaryMetric) {
      autoItems.push(createDashboardItem(primaryMetric.key, 'kpi', `${primaryMetric.label} Total`, { aggregation: 'sum' }));
      autoItems.push(createDashboardItem(primaryMetric.key, 'line', `${primaryMetric.label} Trend`, { categoryKey: dateCol?.key }));
    }
    if (secondaryMetric) {
      autoItems.push(createDashboardItem(secondaryMetric.key, 'kpi', `${secondaryMetric.label} Total`, { aggregation: 'sum' }));
      autoItems.push(createDashboardItem(secondaryMetric.key, 'bar', `${secondaryMetric.label} by ${categoryCol?.label || 'Category'}`, { chartConfig: { sortBy: 'value', sortOrder: 'desc', topN: 8, groupOther: true } }));
    }
    if (tertiaryMetric) {
      autoItems.push(createDashboardItem(tertiaryMetric.key, 'pie', `${tertiaryMetric.label} Distribution`, { chartConfig: { sortBy: 'value', sortOrder: 'desc', topN: 8, groupOther: true, labelDensity: 'sparse' } }));
    }

    templates.push({
      id: 'auto-layout',
      title: 'Auto Layout',
      description: 'Balanced overview based on your top numeric fields.',
      score: 1,
      tags: ['auto', 'overview'],
      items: autoItems,
    });

    const kpiItems = metricCols.slice(0, 6).map((metric) =>
      createDashboardItem(metric.key, 'kpi', `${metric.label} Total`, { aggregation: 'sum' }),
    );
    if (kpiItems.length >= 3) {
      templates.push({
        id: 'kpi-grid',
        title: 'KPI Grid',
        description: 'Quick snapshot of your core metrics.',
        score: 2,
        tags: ['kpi', 'snapshot'],
        items: kpiItems,
      });
    }

    const powerItems: DashboardItem[] = [];
    const powerKpis = metricCols.slice(0, 4);
    powerKpis.forEach((metric) => {
      powerItems.push(
        createDashboardItem(metric.key, 'kpi', `${metric.label} Total`, {
          aggregation: 'sum',
          colSpan: 3,
          rowSpan: 1,
        }),
      );
    });
    if (primaryMetric) {
      powerItems.push(
        createDashboardItem(primaryMetric.key, 'line', `${primaryMetric.label} Trend`, {
          categoryKey: dateCol?.key,
          colSpan: 8,
          rowSpan: 2,
        }),
      );
    }
    if (secondaryMetric) {
      powerItems.push(
        createDashboardItem(
          secondaryMetric.key,
          'bar',
          `${secondaryMetric.label} by ${categoryCol?.label || 'Category'}`,
          {
            colSpan: 4,
            rowSpan: 2,
            chartConfig: { sortBy: 'value', sortOrder: 'desc', topN: 8 },
          },
        ),
      );
    }
    if (tertiaryMetric) {
      powerItems.push(
        createDashboardItem(tertiaryMetric.key, 'pie', `${tertiaryMetric.label} Mix`, {
          colSpan: 4,
          rowSpan: 2,
          chartConfig: { sortBy: 'value', sortOrder: 'desc', topN: 8, labelDensity: 'sparse' },
        }),
      );
    }
    if (locationCol && primaryMetric) {
      powerItems.push(
        createDashboardItem(primaryMetric.key, 'geo', `${primaryMetric.label} by ${locationCol.label}`, {
          categoryKey: locationCol.key,
          colSpan: 8,
          rowSpan: 2,
        }),
      );
    } else if (secondaryMetric) {
      powerItems.push(
        createDashboardItem(secondaryMetric.key, 'area', `${secondaryMetric.label} Trend`, {
          categoryKey: dateCol?.key,
          colSpan: 8,
          rowSpan: 2,
        }),
      );
    }

    if (powerItems.length >= 6) {
      templates.push({
        id: 'power-kpi',
        title: 'Power KPI',
        description: 'Executive view with KPIs, trend, mix, and location highlights.',
        score: 4,
        tags: ['power', 'kpi', 'executive'],
        items: powerItems,
      });
    }

    if (revenueMetric || ordersMetric || profitMetric) {
      const salesItems: DashboardItem[] = [];
      if (revenueMetric) {
        salesItems.push(createDashboardItem(revenueMetric.key, 'kpi', `${revenueMetric.label} Total`, { aggregation: 'sum' }));
        salesItems.push(createDashboardItem(revenueMetric.key, 'line', `${revenueMetric.label} Trend`, { categoryKey: dateCol?.key }));
        salesItems.push(createDashboardItem(revenueMetric.key, 'bar', `${revenueMetric.label} by ${categoryCol?.label || 'Category'}`, { chartConfig: { sortBy: 'value', sortOrder: 'desc', topN: 10 } }));
        if (locationCol) {
          salesItems.push(createDashboardItem(revenueMetric.key, 'geo', `${revenueMetric.label} by ${locationCol.label}`, { categoryKey: locationCol.key }));
        }
      }
      if (ordersMetric) {
        salesItems.push(createDashboardItem(ordersMetric.key, 'kpi', `${ordersMetric.label} Total`, { aggregation: 'sum' }));
      }
      if (profitMetric) {
        salesItems.push(createDashboardItem(profitMetric.key, 'pie', `${profitMetric.label} Mix`, { chartConfig: { sortBy: 'value', sortOrder: 'desc', topN: 8, labelDensity: 'sparse' } }));
      }
      if (salesItems.length >= 3) {
        templates.push({
          id: 'sales-performance',
          title: 'Sales Performance',
          description: 'Revenue, orders, and margin-focused view.',
          score: [revenueMetric, ordersMetric, profitMetric].filter(Boolean).length + 2,
          tags: ['sales', 'revenue'],
          items: salesItems,
        });
      }
    }

    if (expenseMetric || clicksMetric || conversionMetric) {
      const marketingItems: DashboardItem[] = [];
      if (expenseMetric) {
        marketingItems.push(createDashboardItem(expenseMetric.key, 'kpi', `${expenseMetric.label} Total`, { aggregation: 'sum' }));
        marketingItems.push(createDashboardItem(expenseMetric.key, 'line', `${expenseMetric.label} Trend`, { categoryKey: dateCol?.key }));
        marketingItems.push(createDashboardItem(expenseMetric.key, 'pie', `${expenseMetric.label} by ${categoryCol?.label || 'Channel'}`, { chartConfig: { sortBy: 'value', sortOrder: 'desc', topN: 8, groupOther: true, labelDensity: 'sparse' } }));
        if (locationCol) {
          marketingItems.push(createDashboardItem(expenseMetric.key, 'geo', `${expenseMetric.label} by ${locationCol.label}`, { categoryKey: locationCol.key }));
        }
      }
      if (clicksMetric) {
        marketingItems.push(createDashboardItem(clicksMetric.key, 'bar', `${clicksMetric.label} by ${categoryCol?.label || 'Channel'}`, { chartConfig: { sortBy: 'value', sortOrder: 'desc', topN: 10 } }));
      }
      if (conversionMetric) {
        marketingItems.push(createDashboardItem(conversionMetric.key, 'kpi', `${conversionMetric.label} Total`, { aggregation: 'sum' }));
      }
      if (marketingItems.length >= 3) {
        templates.push({
          id: 'marketing-funnel',
          title: 'Marketing Funnel',
          description: 'Spend, clicks, and conversions across channels.',
          score: [expenseMetric, clicksMetric, conversionMetric].filter(Boolean).length + 2,
          tags: ['marketing', 'channels'],
          items: marketingItems,
        });
      }
    }

    if (customerMetric) {
      const customerItems: DashboardItem[] = [
        createDashboardItem(customerMetric.key, 'kpi', `${customerMetric.label} Total`, { aggregation: 'sum' }),
        createDashboardItem(customerMetric.key, 'line', `${customerMetric.label} Trend`, { categoryKey: dateCol?.key }),
        createDashboardItem(customerMetric.key, 'bar', `${customerMetric.label} by ${categoryCol?.label || 'Segment'}`, { chartConfig: { sortBy: 'value', sortOrder: 'desc', topN: 10 } }),
      ];
      templates.push({
        id: 'customer-growth',
        title: 'Customer Growth',
        description: 'Growth and distribution of your audience.',
        score: 3,
        tags: ['customers', 'growth'],
        items: customerItems,
      });
    }

    const sorted = templates
      .filter((template) => template.items.length >= 2)
      .sort((a, b) => b.score - a.score);

    const auto = sorted.find((template) => template.id === 'auto-layout');
    const recommended = sorted.filter((template) => template.id !== 'auto-layout').slice(0, 3);
    return auto ? [auto, ...recommended] : recommended;
  }, [activeThemeId, categoryCol, dateCol, findMetricByKeywords, locationCol, metricCols, mergedDataset.id]);

  const categoryValues = useMemo(() => {
    if (!categoryCol) return [];
    const seen = new Set<string>();
    const values: string[] = [];

    mergedDataset.data.forEach((row) => {
      const raw = row[categoryCol.key];
      if (raw === undefined || raw === null) return;
      const str = String(raw);
      if (!seen.has(str)) {
        seen.add(str);
        values.push(str);
      }
    });

    return values;
  }, [categoryCol, mergedDataset]);

  const toggleCategory = (value: string) => {
    const isActive = activeCategories.includes(value);
    if (isActive) {
      onCategoryFilterChange(activeCategories.filter((v) => v !== value));
    } else {
      onCategoryFilterChange([...activeCategories, value]);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* 1. Source Data Management */}
      <div className="flex-shrink-0 mb-6 space-y-3">
        <div className="flex items-center justify-between">
           <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Source Data</label>
           <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
             {mergedDataset.columns.length} columns selected
           </span>
        </div>
        
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar border border-gray-100 rounded-lg bg-gray-50/30 p-2">
          {datasets.map(d => {
             const isExpanded = expandedDatasets[d.id] ?? true; // Default open
             const currentSelected = selectedColumns[d.id] || [];
             const selectedCount = currentSelected.length;
             const totalCols = d.columns.length;
             
             const isAllSelected = selectedCount === totalCols && totalCols > 0;
             const isIndeterminate = selectedCount > 0 && selectedCount < totalCols;
             
             return (
               <div key={d.id} className="bg-white border border-gray-200 rounded-md overflow-hidden">
                 {/* Dataset Header */}
                 <div 
                   onClick={() => toggleExpand(d.id)}
                   className="flex items-center justify-between px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                 >
                    <div className="flex items-center gap-2 overflow-hidden flex-1 min-w-0">
                       <Database size={12} className="text-blue-500 flex-shrink-0" />
                       <span className="text-sm font-medium text-gray-700 truncate" title={d.name}>{d.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                       {/* Bulk Selection Checkbox */}
                       <button 
                         onClick={(e) => {
                           e.stopPropagation();
                           onDatasetToggle(d.id, d.columns.map(c => c.key), !isAllSelected);
                         }}
                         className="text-blue-600 hover:text-blue-700 p-0.5 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                         title={isAllSelected ? "Deselect All" : "Select All"}
                       >
                          {isAllSelected ? (
                            <CheckSquare size={14} />
                          ) : isIndeterminate ? (
                            <MinusSquare size={14} />
                          ) : (
                            <Square size={14} className="text-gray-300" />
                          )}
                       </button>

                       {selectedCount > 0 && (
                         <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 rounded-full min-w-[1.25rem] text-center">
                           {selectedCount}
                         </span>
                       )}
                       {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                    </div>
                 </div>

                 {/* Columns List */}
                 {isExpanded && (
                   <div className="px-2 py-2 space-y-1 bg-white">
                      {d.columns.map(col => {
                        const isSelected = (selectedColumns[d.id] || []).includes(col.key);
                        return (
                          <div 
                            key={col.key}
                            onClick={() => onColumnToggle(d.id, col.key)}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-xs transition-colors ${isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-600'}`}
                          >
                             {isSelected ? (
                               <CheckSquare size={14} className="text-blue-500 flex-shrink-0" />
                             ) : (
                               <Square size={14} className="text-gray-300 flex-shrink-0" />
                             )}
                             <span className="truncate select-none">{col.label}</span>
                             <span className="ml-auto text-[9px] uppercase text-gray-300 font-semibold">{col.type.substr(0,3)}</span>
                          </div>
                        );
                      })}
                   </div>
                 )}
               </div>
             );
          })}
        </div>

        <button 
          onClick={onAddNewData}
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <PlusCircle size={16} /> Add Another Source
        </button>
      </div>

      <hr className="border-gray-100 mb-4" />

      {layoutTemplates.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="bg-slate-100 text-slate-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                Layouts
              </span>
              <span className="text-xs text-gray-500">
                Auto layouts based on your columns
              </span>
            </div>
          </div>
          <div className="space-y-3">
            {layoutTemplates.map((template) => (
              <div key={template.id} className="border border-gray-200 rounded-xl p-3 bg-white shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700">{template.title}</h4>
                    <p className="text-xs text-gray-500">{template.description}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {template.tags.map((tag) => (
                        <span key={tag} className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => onApplyLayout(template.items, 'replace')}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => onApplyLayout(template.items, 'append')}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {categoryCol && categoryValues.length > 0 && (
        <div className="mb-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">
                Filter
              </span>
              <span className="text-xs text-gray-500">
                Filter by {categoryCol.label}
              </span>
            </div>
            {activeCategories.length > 0 && (
              <button
                onClick={() => onCategoryFilterChange([])}
                className="text-[10px] font-semibold text-gray-500 hover:text-gray-700"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categoryValues.map((value) => {
              const isActive = activeCategories.includes(value);
              return (
                <button
                  key={value}
                  onClick={() => toggleCategory(value)}
                  className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    isActive
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  title={value}
                >
                  {value}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Visualizations Area */}
      <div className="flex-1 overflow-y-auto pr-2 pb-10 custom-scrollbar">
        {metricCols.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <p>Select numeric columns from your sources to generate visualizations.</p>
          </div>
        ) : (
          <>
            {/* Summary Cards Section */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">Summary</span>
                <h4 className="font-semibold text-gray-700 text-sm">Key Metrics</h4>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {metricCols.map(metric => (
                   <button
                    key={`kpi-${metric.key}`}
                    onClick={() => onAddChart(metric.key, 'kpi', `${metric.label} Total`, 'sum')}
                    className="group relative bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-500 hover:shadow-md transition-all text-left flex flex-col items-center justify-center gap-2 h-20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                   >
                      <Hash size={20} className="text-gray-400 group-hover:text-blue-500 mb-1" />
                      <span className="text-xs font-medium text-gray-600 text-center line-clamp-2 leading-tight">{metric.label}</span>
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <PlusCircle size={14} className="text-blue-500" />
                      </div>
                   </button>
                ))}
              </div>
            </div>

            <hr className="border-gray-100 mb-8" />

            {/* Charts Section */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-gray-800 mb-1">Visualizations</h3>
              <p className="text-xs text-gray-500 mb-4">
                {categoryCol ? `Breakdowns by ${categoryCol.label}` : 'No category column selected'}
              </p>
            
              <div className="space-y-8">
                {metricCols.map((metric) => (
                  <div key={metric.key} className="border-b border-gray-100 pb-6 last:border-0">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide">Metric</span>
                      <h4 className="font-semibold text-gray-700 text-sm">{metric.label}</h4>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3">
                      {/* Line Option */}
                      <button 
                        onClick={() => onAddChart(metric.key, 'line', `${metric.label} Trend`)}
                        className="group relative bg-white border border-gray-200 rounded-lg p-2 hover:border-blue-500 hover:shadow-md transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 group-hover:text-blue-600">
                            <TrendingUp size={14} /> Trend
                          </div>
                          <PlusCircle size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="h-16 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                          <ChartRenderer 
                            type="line" 
                            data={mergedDataset.data.slice(0, 8)} 
                            metricKey={metric.key} 
                            categoryKey={categoryCol?.key || ''} 
                            colors={activeTheme.colors}
                            height={64}
                          />
                        </div>
                      </button>

                      {/* Bar Option */}
                      <button 
                        onClick={() => onAddChart(metric.key, 'bar', `${metric.label} Comparison`)}
                        className="group relative bg-white border border-gray-200 rounded-lg p-2 hover:border-blue-500 hover:shadow-md transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 group-hover:text-blue-600">
                            <BarChart2 size={14} /> Comparison
                          </div>
                          <PlusCircle size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="h-16 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                          <ChartRenderer 
                            type="bar" 
                            data={mergedDataset.data.slice(0, 8)} 
                            metricKey={metric.key} 
                            categoryKey={categoryCol?.key || ''} 
                            colors={activeTheme.colors}
                            height={64}
                          />
                        </div>
                      </button>

                      {/* Pie Option */}
                      <button 
                        onClick={() => onAddChart(metric.key, 'pie', `${metric.label} Distribution`)}
                        className="group relative bg-white border border-gray-200 rounded-lg p-2 hover:border-blue-500 hover:shadow-md transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 group-hover:text-blue-600">
                            <PieChart size={14} /> Distribution
                          </div>
                          <PlusCircle size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="h-16 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                          <ChartRenderer 
                            type="pie" 
                            data={mergedDataset.data.slice(0, 8)} 
                            metricKey={metric.key} 
                            categoryKey={categoryCol?.key || ''} 
                            colors={activeTheme.colors}
                            height={64}
                          />
                        </div>
                      </button>
                      {locationCol && (
                        <button 
                          onClick={() =>
                            onAddChart(
                              metric.key,
                              'geo',
                              `${metric.label} by ${locationCol.label}`,
                              undefined,
                              locationCol.key,
                            )
                          }
                          className="group relative bg-white border border-gray-200 rounded-lg p-2 hover:border-blue-500 hover:shadow-md transition-all text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 group-hover:text-blue-600">
                              <MapPin size={14} /> Map
                            </div>
                            <PlusCircle size={16} className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="h-16 pointer-events-none opacity-60 group-hover:opacity-100 transition-opacity">
                            <ChartRenderer 
                              type="geo" 
                              data={mergedDataset.data.slice(0, 12)} 
                              metricKey={metric.key} 
                              categoryKey={locationCol.key} 
                              colors={activeTheme.colors}
                              height={64}
                            />
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default SuggestionPanel;
