import React, { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X, GripVertical, BarChart2, TrendingUp, PieChart, Activity, Hash, MoreHorizontal } from 'lucide-react';

import { AggregationType, ChartConfig, ChartType, DashboardItem, Dataset, LabelDensity, SortBy, SortOrder } from '../types';
import ChartRenderer from './ChartRenderer';
import { THEMES } from '../constants';

const ROW_HEIGHT = 140;

const PICKER_COLORS = [
  '#2563eb',
  '#dc2626',
  '#16a34a',
  '#9333ea',
  '#ea580c',
  '#db2777',
  '#0891b2',
  '#4b5563',
];

const DEFAULT_CHART_CONFIG: ChartConfig = {
  sortBy: 'none',
  sortOrder: 'desc',
  topN: 0,
  groupOther: false,
  otherThreshold: 5,
  labelDensity: 'balanced',
};

interface SortableItemProps {
  item: DashboardItem;
  dataset?: Dataset;
  themeId: string;
  onRemove: (id: string) => void;
  onUpdate: (id: string, updates: Partial<DashboardItem>) => void;
}

const SortableItem: React.FC<SortableItemProps> = ({ item, dataset, themeId, onRemove, onUpdate }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.id });

  const [isEditing, setIsEditing] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const [title, setTitle] = useState(item.title);

  const inputRef = useRef<HTMLInputElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleTitleSubmit = () => {
    setIsEditing(false);
    if (title.trim() !== item.title) {
      onUpdate(item.id, { title: title.trim() || 'Untitled' });
    } else {
      setTitle(item.title);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleTitleSubmit();
  };

  const handleResizeStart = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = item.colSpan || 4;
    const startHeight = item.rowSpan || 2;

    const currentEl = cardRef.current;
    if (!currentEl) return;

    const elRect = currentEl.getBoundingClientRect();
    const approxColWidth = elRect.width / startWidth;
    const approxRowHeight = ROW_HEIGHT;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const colChange = Math.round(deltaX / approxColWidth);
      const rowChange = Math.round(deltaY / approxRowHeight);

      const newColSpan = Math.max(2, Math.min(12, startWidth + colChange));
      const newRowSpan = Math.max(1, Math.min(6, startHeight + rowChange));

      if (newColSpan !== item.colSpan || newRowSpan !== item.rowSpan) {
        onUpdate(item.id, { colSpan: newColSpan, rowSpan: newRowSpan });
      }
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging || showColorPicker || showQuickMenu ? 50 : 1,
    opacity: isDragging ? 0.8 : 1,
    gridColumn: `span ${item.colSpan || 4}`,
    gridRow: `span ${item.rowSpan || 2}`,
  };

  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];

  const chartConfig = { ...DEFAULT_CHART_CONFIG, ...(item.chartConfig || {}) };

  const updateChartConfig = (updates: Partial<ChartConfig>) => {
    onUpdate(item.id, { chartConfig: { ...chartConfig, ...updates } });
  };

  const ChartIcon = ({ type, icon: Icon }: { type: ChartType; icon: any }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onUpdate(item.id, { chartType: type });
      }}
      className={`p-1 rounded hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        item.chartType === type ? 'text-blue-600 bg-blue-50' : 'text-gray-400'
      }`}
      title={`Switch to ${type}`}
    >
      <Icon size={14} />
    </button>
  );

  const aggregationMode: AggregationType = item.aggregation || 'sum';

  const AggregationButton = ({ mode, label }: { mode: AggregationType; label: string }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onUpdate(item.id, { aggregation: mode });
      }}
      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        aggregationMode === mode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
      title={`${label} aggregation`}
    >
      {label}
    </button>
  );

  const LabelDensityButton = ({ density, label }: { density: LabelDensity; label: string }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        updateChartConfig({ labelDensity: density });
      }}
      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        chartConfig.labelDensity === density
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
      title={`${label} labels`}
    >
      {label}
    </button>
  );

  const SortButton = ({ mode, label }: { mode: SortBy; label: string }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        updateChartConfig({ sortBy: mode });
      }}
      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        chartConfig.sortBy === mode
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
      title={`Sort by ${label}`}
    >
      {label}
    </button>
  );

  const SortOrderButton = ({ mode, label }: { mode: SortOrder; label: string }) => (
    <button
      onClick={(e) => {
        e.stopPropagation();
        updateChartConfig({ sortOrder: mode });
      }}
      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        chartConfig.sortOrder === mode
          ? 'bg-blue-600 text-white'
          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
      title={`Order ${label}`}
    >
      {label}
    </button>
  );

  const renderColorPicker = () => (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowColorPicker((prev) => !prev);
        }}
        className={`p-1 rounded hover:bg-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          item.customColor ? 'text-gray-800' : 'text-gray-400'
        }`}
        title="Change Color"
      >
        <div
          className="w-3.5 h-3.5 rounded-full border border-gray-300"
          style={{ backgroundColor: item.customColor || 'transparent' }}
        />
      </button>

      {showColorPicker && (
        <div
          className="absolute right-0 top-7 mt-1 p-2 bg-white rounded-lg shadow-xl border border-gray-200 z-50 w-32 grid grid-cols-4 gap-2"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              onUpdate(item.id, { customColor: undefined });
              setShowColorPicker(false);
            }}
            className="w-6 h-6 rounded-full border border-gray-200 flex items-center justify-center hover:bg-gray-50 text-xs text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            title="Default Theme"
          >
            <X size={12} />
          </button>
          {PICKER_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                onUpdate(item.id, { customColor: c });
                setShowColorPicker(false);
              }}
              className="w-6 h-6 rounded-full border border-gray-100 hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col group ${
        isDragging ? 'shadow-2xl ring-2 ring-blue-500' : 'hover:shadow-md transition-shadow'
      }`}
    >
      <div ref={cardRef} className="flex flex-col h-full w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50/50">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing text-gray-300 hover:text-gray-500 p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <GripVertical size={14} />
            </button>

            <div className="flex flex-col min-w-0 flex-1">
              {isEditing ? (
                <input
                  ref={inputRef}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleSubmit}
                  onKeyDown={handleKeyDown}
                  className="w-full bg-white border border-blue-300 rounded px-1 py-0.5 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              ) : (
                <h3
                  onDoubleClick={() => setIsEditing(true)}
                  className="font-semibold text-gray-700 truncate text-sm cursor-text hover:text-blue-600 select-none"
                  title="Double click to rename"
                >
                  {item.title}
                </h3>
              )}
            </div>
          </div>

          {/* Quick Actions - always via 3-dots */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowQuickMenu((prev) => !prev);
              }}
              className="hidden group-hover:inline-flex items-center justify-center rounded-full p-1.5 bg-white/90 shadow-sm border border-gray-200 text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              title="More options"
            >
              <MoreHorizontal size={16} />
            </button>

            {showQuickMenu && (
              <div
                className="absolute right-0 top-7 z-40 w-44 bg-white rounded-lg shadow-xl border border-gray-200 p-2 space-y-2"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                  Chart type
                </div>
                <div className="flex items-center gap-1">
                  <ChartIcon type="kpi" icon={Hash} />
                  <ChartIcon type="line" icon={TrendingUp} />
                  <ChartIcon type="bar" icon={BarChart2} />
                  <ChartIcon type="area" icon={Activity} />
                  <ChartIcon type="pie" icon={PieChart} />
                </div>

                {item.chartType !== 'kpi' && (
                  <div className="space-y-1 pt-1 border-t border-gray-100 mt-1">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Labels
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <LabelDensityButton density="sparse" label="Sparse" />
                      <LabelDensityButton density="balanced" label="Normal" />
                      <LabelDensityButton density="dense" label="Dense" />
                    </div>
                  </div>
                )}

                {(item.chartType === 'bar' || item.chartType === 'pie') && (
                  <div className="space-y-2 pt-1 border-t border-gray-100 mt-1">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Sorting
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <SortButton mode="none" label="None" />
                      <SortButton mode="value" label="Value" />
                      <SortButton mode="name" label="Name" />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <SortOrderButton mode="desc" label="Desc" />
                      <SortOrderButton mode="asc" label="Asc" />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] text-gray-500">Top N</span>
                      <input
                        type="range"
                        min={0}
                        max={12}
                        step={1}
                        value={chartConfig.topN}
                        onChange={(e) => updateChartConfig({ topN: Number(e.target.value) })}
                        className="flex-1 accent-blue-600"
                        aria-label="Top N categories"
                      />
                      <span className="text-[10px] font-semibold text-gray-600 w-8 text-right">
                        {chartConfig.topN === 0 ? 'All' : chartConfig.topN}
                      </span>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] text-gray-500">
                      <input
                        type="checkbox"
                        checked={chartConfig.groupOther}
                        onChange={(e) => updateChartConfig({ groupOther: e.target.checked })}
                        className="h-3.5 w-3.5 text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      />
                      Group small into Other
                    </label>
                    {chartConfig.groupOther && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] text-gray-500">
                          Other &lt; {chartConfig.otherThreshold}%
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={15}
                          step={1}
                          value={chartConfig.otherThreshold}
                          onChange={(e) => updateChartConfig({ otherThreshold: Number(e.target.value) })}
                          className="flex-1 accent-blue-600"
                          aria-label="Other bucket threshold"
                        />
                      </div>
                    )}
                  </div>
                )}

                {item.chartType === 'kpi' && (
                  <div className="space-y-1 pt-1 border-t border-gray-100 mt-1">
                    <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
                      Aggregation
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <AggregationButton mode="sum" label="?" />
                      <AggregationButton mode="avg" label="Avg" />
                      <AggregationButton mode="min" label="Min" />
                      <AggregationButton mode="max" label="Max" />
                      <AggregationButton mode="count" label="#" />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-gray-100 mt-1">
                  {renderColorPicker()}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(item.id);
                      setShowQuickMenu(false);
                    }}
                    className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-3 w-full min-h-0 relative overflow-hidden">
          {dataset ? (
              <ChartRenderer
              type={item.chartType}
              data={dataset.data}
              metricKey={item.metricKey}
              categoryKey={item.categoryKey}
              colors={theme.colors}
              customColor={item.customColor}
              aggregation={item.aggregation}
              chartConfig={item.chartConfig}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-xs bg-gray-50 rounded text-center px-3">
              Source dataset not found. It may have been removed or filtered out.
            </div>
          )}
        </div>

        {/* Resize Handle (Bottom Right) */}
        <div
          onPointerDown={handleResizeStart}
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-end justify-end p-1 z-20 group/resize"
        >
          <div className="w-2.5 h-2.5 border-r-2 border-b-2 border-gray-300 group-hover/resize:border-blue-500 transition-colors rounded-br-sm" />
        </div>
      </div>

      {/* Backdrop for closing overlays */}
      {(showColorPicker || showQuickMenu) && (
        <div
          className="fixed inset-0 z-30"
          onPointerDown={() => {
            setShowColorPicker(false);
            setShowQuickMenu(false);
          }}
        />
      )}
    </div>
  );
};

interface DashboardGridProps {
  items: DashboardItem[];
  datasets: Dataset[];
  themeId: string;
  onItemsChange: (items: DashboardItem[]) => void;
  dashboardRef?: React.RefObject<HTMLDivElement>;
}

const DashboardGrid: React.FC<DashboardGridProps> = ({
  items,
  datasets,
  themeId,
  onItemsChange,
  dashboardRef,
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      onItemsChange(arrayMove(items, oldIndex, newIndex));
    }
  };

  const handleRemove = (id: string) => {
    onItemsChange(items.filter((i) => i.id !== id));
  };

  const handleUpdate = (id: string, updates: Partial<DashboardItem>) => {
    onItemsChange(items.map((item) => (item.id === id ? { ...item, ...updates } : item)));
  };

  const theme = THEMES.find((t) => t.id === themeId) || THEMES[0];

  return (
    <div ref={dashboardRef} className="p-8 min-h-full transition-colors duration-300">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-12 auto-rows-[140px] gap-2 grid-flow-dense">
            {items.map((item) => {
              const dataset = datasets.find((d) => d.id === item.datasetId);
              return (
                <SortableItem
                  key={item.id}
                  item={item}
                  dataset={dataset}
                  themeId={theme.id}
                  onRemove={handleRemove}
                  onUpdate={handleUpdate}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {items.length === 0 && (
        <div className="h-96 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl bg-white/50">
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            <BarChart2 size={32} className="text-blue-200" />
          </div>
          <p className="text-lg font-medium text-gray-600">Your canvas is empty</p>
          <p className="text-sm max-w-md text-center mt-2">
            Add data, then click charts in the sidebar to build your dashboard.
          </p>
        </div>
      )}
    </div>
  );
};

export default DashboardGrid;
