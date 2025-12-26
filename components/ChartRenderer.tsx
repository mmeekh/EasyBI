import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { AggregationType, ChartConfig, ChartType, DataPoint, LabelDensity } from '../types';

interface ChartRendererProps {
  type: ChartType;
  data: DataPoint[];
  metricKey: string;
  categoryKey: string;
  colors: string[];
  customColor?: string; // Allow single color override
  height?: number; 
  aggregation?: AggregationType;
  chartConfig?: ChartConfig;
}

const RADIAN = Math.PI / 180;
const MIN_PIE_LABEL_HEIGHT = 140;
const MIN_PIE_LABEL_WIDTH = 180;

const formatNumber = (num: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
};

const parseNumberValue = (raw: unknown): number | null => {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;
  const normalized = raw
    .replace(/\s/g, '')
    .replace(/[,$\u20AC\u00A3\u20BA\u20BD\u00A5]/g, '')
    .replace(/\((.*)\)/, '-$1')
    .replace(/%$/, '');
  const num = Number(normalized.replace(/,/g, ''));
  return Number.isFinite(num) ? num : null;
};

const shortenLabel = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  const sliceLength = Math.max(0, maxLength - 3);
  return `${text.slice(0, sliceLength)}...`;
};

const formatCategoryLabel = (label: string): string => {
  const trimmed = label.trim();
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(trimmed)) {
    return trimmed.slice(5);
  }
  return trimmed;
};

const estimateTextWidth = (text: string, fontSize: number): number => text.length * fontSize * 0.56;

const getLabelThreshold = (density: LabelDensity): number => {
  if (density === 'sparse') return 0.1;
  if (density === 'balanced') return 0.06;
  return 0;
};

const ChartRenderer: React.FC<ChartRendererProps> = ({
  type,
  data,
  metricKey,
  categoryKey,
  colors,
  customColor,
  aggregation,
  height,
  chartConfig,
}) => {
  const primaryColor = customColor || colors[0];
  const chartColors = customColor ? [customColor, ...colors.slice(1)] : colors;
  const sortBy = chartConfig?.sortBy ?? 'none';
  const sortOrder = chartConfig?.sortOrder ?? 'desc';
  const topN = chartConfig?.topN ?? 0;
  const groupOther = chartConfig?.groupOther ?? false;
  const otherThreshold = chartConfig?.otherThreshold ?? 5;
  const labelDensity = chartConfig?.labelDensity ?? 'balanced';
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!containerRef.current || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setContainerSize({ width, height });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);
  
  const aggregatedValue = useMemo(() => {
    if (type !== 'kpi' || !data) return 0;

    const mode: AggregationType = aggregation || 'sum';
    const numbers: number[] = [];

    data.forEach((point) => {
      const val = point[metricKey];
      if (val === undefined || val === null) return;
      const num = parseNumberValue(val);
      if (num !== null) {
        numbers.push(num);
      }
    });

    if (numbers.length === 0) return 0;

    switch (mode) {
      case 'avg':
        return numbers.reduce((acc, v) => acc + v, 0) / numbers.length;
      case 'min':
        return Math.min(...numbers);
      case 'max':
        return Math.max(...numbers);
      case 'count':
        return numbers.length;
      case 'sum':
      default:
        return numbers.reduce((acc, v) => acc + v, 0);
    }
  }, [aggregation, data, metricKey, type]);

  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    if (type !== 'pie' && type !== 'bar') return data;

    const totals = new Map<string, number>();
    const order = new Map<string, number>();
    let orderIndex = 0;

    data.forEach((row) => {
      const rawCategory = row[categoryKey];
      const rawValue = row[metricKey];
      if (rawCategory === undefined || rawCategory === null) return;

      const numericValue = parseNumberValue(rawValue);
      if (numericValue === null) return;

      const category = String(rawCategory);
      if (!order.has(category)) {
        order.set(category, orderIndex);
        orderIndex += 1;
      }
      totals.set(category, (totals.get(category) || 0) + numericValue);
    });

    const items = Array.from(totals.entries()).map(([category, value]) => ({
      [categoryKey]: category,
      [metricKey]: value,
      __order: order.get(category) || 0,
    }));

    const sorted = [...items].sort((a, b) => {
      if (sortBy === 'value') {
        const diff = (a[metricKey] as number) - (b[metricKey] as number);
        return sortOrder === 'asc' ? diff : -diff;
      }
      if (sortBy === 'name') {
        const diff = String(a[categoryKey]).localeCompare(String(b[categoryKey]));
        return sortOrder === 'asc' ? diff : -diff;
      }
      return (a.__order as number) - (b.__order as number);
    });

    let visibleItems = sorted;
    let otherItems: typeof sorted = [];

    if (topN > 0 && topN < sorted.length) {
      visibleItems = sorted.slice(0, topN);
      otherItems = sorted.slice(topN);
    }

    if (groupOther && otherThreshold > 0) {
      const totalValue = sorted.reduce((sum, item) => sum + (item[metricKey] as number), 0);
      const keep: typeof sorted = [];
      visibleItems.forEach((item) => {
        const percent = totalValue > 0 ? (item[metricKey] as number) / totalValue : 0;
        if (percent * 100 < otherThreshold) {
          otherItems = [...otherItems, item];
        } else {
          keep.push(item);
        }
      });
      visibleItems = keep;
    }

    if (groupOther && otherItems.length > 0) {
      const otherTotal = otherItems.reduce((sum, item) => sum + (item[metricKey] as number), 0);
      if (otherTotal > 0) {
        visibleItems = [
          ...visibleItems,
          { [categoryKey]: 'Other', [metricKey]: otherTotal, __order: sorted.length + 1 },
        ];
      }
    }

    return visibleItems.map((item) => {
      const { __order, ...rest } = item;
      return rest as DataPoint;
    });
  }, [categoryKey, data, groupOther, metricKey, otherThreshold, sortBy, sortOrder, topN, type]);

  const axisFontSize =
    containerSize.width > 0 && containerSize.width < 240
      ? 8
      : labelDensity === 'dense'
        ? 9
        : 10;

  const yAxisWidth = useMemo(() => {
    if (type === 'pie') return 0;

    const values = chartData
      .map((row) => parseNumberValue(row[metricKey]))
      .filter((val): val is number => typeof val === 'number');

    if (values.length === 0) return 32;

    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const maxLabel = formatNumber(maxValue);
    const minLabel = formatNumber(minValue);
    const longest = maxLabel.length >= minLabel.length ? maxLabel : minLabel;
    const estimated = Math.ceil(estimateTextWidth(longest, axisFontSize)) + 10;
    const maxWidth =
      containerSize.width > 0 ? Math.min(64, Math.floor(containerSize.width * 0.35)) : 64;
    return Math.max(30, Math.min(estimated, maxWidth));
  }, [axisFontSize, chartData, containerSize.width, metricKey, type]);

  const xAxisConfig = useMemo(() => {
    if (type === 'pie') {
      return {
        height: 20,
        interval: 'preserveStartEnd' as const,
        angle: 0,
        textAnchor: 'middle' as const,
        tickMargin: 6,
        formatter: (value: unknown) => String(value ?? ''),
      };
    }

    const labels = chartData.map((row) => {
      const raw = row[categoryKey];
      const formatted = formatCategoryLabel(raw === undefined || raw === null ? '' : String(raw));
      return formatted;
    });

    const maxLabel = labels.reduce((acc, val) => (val.length > acc.length ? val : acc), '');
    const baseLimit = containerSize.width > 0 && containerSize.width < 260 ? 6 : 10;
    const maxLabelLength = labelDensity === 'dense' ? baseLimit : baseLimit + 2;
    const sampleLabel = shortenLabel(maxLabel, maxLabelLength);
    const labelWidth = estimateTextWidth(sampleLabel, axisFontSize) + 8;
    const availableWidth =
      containerSize.width > 0 ? Math.max(0, containerSize.width - yAxisWidth - 16) : 0;

    let interval: number | 'preserveStartEnd' = labelDensity === 'dense' ? 0 : 0;
    if (availableWidth > 0 && labelWidth > 0 && labels.length > 0) {
      const maxTicks = Math.max(1, Math.floor(availableWidth / labelWidth));
      if (maxTicks < labels.length) {
        interval = Math.max(0, Math.ceil(labels.length / maxTicks) - 1);
      }
    } else {
      interval = 'preserveStartEnd';
    }

    const shouldAngle =
      availableWidth > 0 && labels.length > 0 && labelWidth > availableWidth / labels.length;

    return {
      height: shouldAngle ? 34 : 22,
      interval,
      angle: shouldAngle ? -25 : 0,
      textAnchor: shouldAngle ? 'end' : 'middle',
      tickMargin: shouldAngle ? 10 : 6,
      formatter: (value: unknown) => {
        const raw = value === undefined || value === null ? '' : String(value);
        const formatted = formatCategoryLabel(raw);
        return shortenLabel(formatted, maxLabelLength);
      },
    };
  }, [axisFontSize, categoryKey, chartData, containerSize.width, labelDensity, type, yAxisWidth]);

  const pieLabelRenderer = useMemo(() => {
    if (type !== 'pie' || chartData.length === 0) {
      return () => null;
    }

    const effectiveHeight = containerSize.height || height || 0;
    const effectiveWidth = containerSize.width;
    const minHeight = labelDensity === 'dense' ? 110 : MIN_PIE_LABEL_HEIGHT;
    const minWidth = labelDensity === 'dense' ? 150 : MIN_PIE_LABEL_WIDTH;
    const allowLabels =
      effectiveHeight >= minHeight && (effectiveWidth === 0 || effectiveWidth >= minWidth);

    if (!allowLabels) {
      return () => null;
    }

    const maxNameLength = labelDensity === 'dense' ? 8 : labelDensity === 'balanced' ? 10 : 12;
    const fontSize = labelDensity === 'dense' ? 8 : 9;
    const threshold = getLabelThreshold(labelDensity);
    const isCompactWidth = effectiveWidth > 0 && effectiveWidth < 260;
    const maxLabels =
      labelDensity === 'dense' || !isCompactWidth
        ? chartData.length
        : labelDensity === 'balanced'
          ? Math.min(chartData.length, 6)
          : Math.min(chartData.length, 4);

    const allowedIndexes = maxLabels < chartData.length ? new Set<number>() : null;
    if (allowedIndexes) {
      chartData
        .map((row, index) => ({
          index,
          value: parseNumberValue(row[metricKey]) ?? 0,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, maxLabels)
        .forEach((item) => allowedIndexes.add(item.index));
    }

    return (props: any) => {
      const {
        cx,
        cy,
        midAngle,
        innerRadius,
        outerRadius,
        name,
        value,
        percent,
        index,
        startAngle,
        endAngle,
      } = props;

      if (allowedIndexes && !allowedIndexes.has(index)) return null;
      if (typeof percent === 'number' && percent > 0 && percent < threshold) {
        return null;
      }

      const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
      const x = cx + radius * Math.cos(-midAngle * RADIAN);
      const y = cy + radius * Math.sin(-midAngle * RADIAN);
      const arcAngle =
        typeof startAngle === 'number' && typeof endAngle === 'number'
          ? Math.abs(endAngle - startAngle)
          : 0;
      const arcLength = arcAngle > 0 ? radius * arcAngle * RADIAN : 0;

      const numericValue = typeof value === 'number' ? value : Number(value);
      const labelValue = Number.isNaN(numericValue)
        ? String(value ?? '')
        : formatNumber(numericValue);
      const rawName = name === undefined || name === null ? '' : String(name);
      const formattedName = formatCategoryLabel(rawName);
      const labelName = shortenLabel(formattedName, maxNameLength);

      const valueWidth = estimateTextWidth(labelValue, fontSize);
      const nameWidth = estimateTextWidth(labelName, fontSize);
      const showValue = arcLength === 0 || valueWidth <= arcLength;
      const showName = labelName.length > 0 && (arcLength === 0 || nameWidth <= arcLength);

      if (!showValue && !showName) return null;

      return (
        <text
          x={x}
          y={y}
          fill="#64748b"
          fontWeight={600}
          fontSize={fontSize}
          textAnchor="middle"
          dominantBaseline="middle"
          pointerEvents="none"
        >
          {showName && (
            <tspan x={x} dy={showValue ? '-0.2em' : '0'}>
              {labelName}
            </tspan>
          )}
          {showValue && (
            <tspan x={x} dy={showName ? '1.1em' : '0'}>
              {labelValue}
            </tspan>
          )}
        </text>
      );
    };
  }, [chartData, containerSize.height, containerSize.width, height, labelDensity, metricKey, type]);

  const hasChartData =
    type === 'pie' || type === 'bar'
      ? chartData.length > 0
      : data && data.length > 0;

  if (!hasChartData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs text-center px-3">
        No data to display. Check your source selection or filters.
      </div>
    );
  }

  // --- KPI RENDER (Direct HTML with Container Queries) ---
  if (type === 'kpi') {
    const mode: AggregationType = aggregation || 'sum';
    const prefix =
      mode === 'avg' ? 'Average' : mode === 'min' ? 'Min' : mode === 'max' ? 'Max' : mode === 'count' ? 'Count' : 'Total';
    const metricLabel = metricKey.includes(':') ? metricKey.split(':')[1].trim() : metricKey;

    return (
      <div 
        className="flex flex-col h-full w-full justify-between py-2 px-3"
        style={{ containerType: 'size' } as React.CSSProperties}
      >
         <span 
           className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate w-full"
           title={metricKey}
         >
           {prefix} {metricLabel}
         </span>
         <div className="flex-1 flex items-center justify-center min-h-0 w-full overflow-hidden">
           <span 
             className="font-bold tracking-tight leading-none whitespace-nowrap" 
             style={{ 
               color: primaryColor, 
               fontSize: '35cqmin' // Using Container Query Minimum unit for responsiveness
             }}
           >
             {formatNumber(aggregatedValue)}
           </span>
         </div>
      </div>
    );
  }

  // Common XAxis props
  const xAxisProps = {
    dataKey: categoryKey,
    tick: { fontSize: axisFontSize, fill: '#64748b', fontWeight: 600 },
    axisLine: false,
    tickLine: false,
    height: xAxisConfig.height,
    interval: xAxisConfig.interval,
    angle: xAxisConfig.angle,
    textAnchor: xAxisConfig.textAnchor,
    tickMargin: xAxisConfig.tickMargin,
    minTickGap: labelDensity === 'sparse' ? 16 : 6,
    tickFormatter: xAxisConfig.formatter,
  };

  const yAxisProps = {
    tick: { fontSize: axisFontSize, fill: '#64748b', fontWeight: 600 },
    axisLine: false,
    tickLine: false,
    width: yAxisWidth,
    tickMargin: 6,
    tickFormatter: (val: any) => formatNumber(val as number)
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: Math.max(4, Math.floor(yAxisWidth * 0.15)), bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Line type="monotone" dataKey={metricKey} stroke={primaryColor} strokeWidth={3} dot={false} activeDot={{ r: 6 }} animationDuration={1000} />
          </LineChart>
        );
      case 'area':
        const safeKey = metricKey.replace(/[^a-zA-Z0-9]/g, '');
        const gradientId = `color-${safeKey}-${Math.random().toString(36).substr(2, 5)}`;
        return (
          <AreaChart data={chartData} margin={{ top: 5, right: 5, left: Math.max(4, Math.floor(yAxisWidth * 0.15)), bottom: 0 }}>
             <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey={metricKey} stroke={primaryColor} fillOpacity={1} fill={`url(#${gradientId})`} />
          </AreaChart>
        );
      case 'bar':
        return (
          <BarChart data={chartData} margin={{ top: 5, right: 5, left: Math.max(4, Math.floor(yAxisWidth * 0.15)), bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey={metricKey} fill={primaryColor} radius={[4, 4, 0, 0]} animationDuration={1000} />
          </BarChart>
        );
      case 'pie':
        const pieData = chartData;
        return (
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius="50%"
              outerRadius="80%"
              paddingAngle={2}
              dataKey={metricKey}
              nameKey={categoryKey}
              label={pieLabelRenderer}
              labelLine={false}
            >
              {pieData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
          </PieChart>
        );
      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart() || <div />}
      </ResponsiveContainer>
    </div>
  );
};

export default ChartRenderer;
