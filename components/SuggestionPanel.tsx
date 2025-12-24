import React, { useMemo, useState } from 'react';
import { ChartType, Dataset } from '../types';
import ChartRenderer from './ChartRenderer';
import { PlusCircle, BarChart2, TrendingUp, PieChart, Hash, Database, ChevronDown, ChevronRight, CheckSquare, Square, MinusSquare } from 'lucide-react';
import { THEMES } from '../constants';

interface SuggestionPanelProps {
  datasets: Dataset[];
  mergedDataset: Dataset;
  selectedColumns: Record<string, string[]>;
  onColumnToggle: (datasetId: string, columnKey: string) => void;
  onDatasetToggle: (datasetId: string, allKeys: string[], shouldSelect: boolean) => void;
  onAddChart: (metricKey: string, chartType: ChartType, title: string, aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count') => void;
  activeThemeId: string;
  onAddNewData: () => void;
  activeCategories: string[];
  onCategoryFilterChange: (values: string[]) => void;
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
}) => {
  const activeTheme = THEMES.find(t => t.id === activeThemeId) || THEMES[0];
  const [expandedDatasets, setExpandedDatasets] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedDatasets(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Identify category column (first string column in merged dataset)
  const categoryCol = useMemo(() => {
    return mergedDataset.columns.find(c => c.type === 'string') || mergedDataset.columns[0];
  }, [mergedDataset]);

  // Identify numeric columns for metrics
  const metricCols = useMemo(() => {
    return mergedDataset.columns.filter(c => c.type === 'number');
  }, [mergedDataset]);

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
                         className="text-blue-600 hover:text-blue-700 p-0.5 rounded transition-colors"
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
          className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 text-sm font-medium hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
        >
          <PlusCircle size={16} /> Add Another Source
        </button>
      </div>

      <hr className="border-gray-100 mb-4" />

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
                  className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
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
                    className="group relative bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-500 hover:shadow-md transition-all text-left flex flex-col items-center justify-center gap-2 h-20"
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
                        className="group relative bg-white border border-gray-200 rounded-lg p-2 hover:border-blue-500 hover:shadow-md transition-all text-left"
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
                        className="group relative bg-white border border-gray-200 rounded-lg p-2 hover:border-blue-500 hover:shadow-md transition-all text-left"
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
                        className="group relative bg-white border border-gray-200 rounded-lg p-2 hover:border-blue-500 hover:shadow-md transition-all text-left"
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
