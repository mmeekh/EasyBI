import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { CATEGORY_PALETTES } from '../constants';
import { AggregationType, ChartConfig, ChartType, DataPoint, LabelDensity } from '../types';
import { geoEquirectangular, geoPath } from 'd3-geo';
import { feature as topojsonFeature, mesh as topojsonMesh } from 'topojson-client';
import worldAtlas from 'world-atlas/countries-50m.json';
import { resolveLocation } from '../utils/geo';
import {
  formatNumber,
  parseNumberValue,
  shortenLabel,
  formatCategoryLabel,
  estimateTextWidth,
  getLabelThreshold,
  hashString,
  pickPalette,
  AXIS_ABBREVIATIONS,
  splitLabelInTwo,
  formatAxisLabel
} from './charts/utils';

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
const MIN_PIE_LABEL_HEIGHT = 100;
const MIN_PIE_LABEL_WIDTH = 140;
const MAP_WIDTH = 1000;
const MAP_HEIGHT = 520;

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
  const categoryPalette = useMemo(
    () => pickPalette(`${metricKey}|${categoryKey}`, chartColors),
    [categoryKey, chartColors, metricKey],
  );
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

  const kpiDisplayValue = useMemo(() => formatNumber(aggregatedValue), [aggregatedValue]);

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

  const categoryColorMap = useMemo(() => {
    if (type !== 'pie' && type !== 'bar') return new Map<string, string>();
    const categories = chartData
      .map((row) => row[categoryKey])
      .filter((value): value is string | number => value !== undefined && value !== null)
      .map((value) => String(value));
    const unique = Array.from(new Set(categories)).sort((a, b) => (a as any).localeCompare(b));
    const map = new Map<string, string>();
    unique.forEach((category, index) => {
      map.set(category as string, categoryPalette[index % categoryPalette.length]);
    });
    return map;
  }, [categoryKey, categoryPalette, chartData, type, colors]);

  const axisFontSize =
    containerSize.width > 0 && containerSize.width < 240
      ? 8
      : labelDensity === 'dense'
        ? 9
        : 10;

  const yAxisWidth = useMemo(() => {
    if (type === 'pie' || type === 'geo') return 0;

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
    if (type === 'pie' || type === 'geo') {
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
    const baseLimit =
      containerSize.width > 0 && containerSize.width < 220
        ? 5
        : containerSize.width > 0 && containerSize.width < 260
          ? 6
          : 10;
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

    const perTick = labels.length > 0 ? availableWidth / labels.length : 0;
    let angle = 0;
    let height = 26;
    let tickMargin = 6;
    let textAnchor: 'end' | 'middle' = 'middle';
    let effectiveInterval: number | 'preserveStartEnd' = interval;

    if (perTick > 0 && labelWidth > perTick) {
      angle = -35;
      height = 38;
      tickMargin = 10;
      textAnchor = 'end';
    }
    if (perTick > 0 && labelWidth > perTick * 1.3) {
      angle = -65;
      height = 48;
      tickMargin = 12;
      textAnchor = 'end';
    }
    if (perTick > 0 && labelWidth > perTick * 1.6) {
      angle = -90;
      height = 56;
      tickMargin = 12;
      textAnchor = 'end';
    }
    // Always show all labels if they are rotated to fit
    if (angle !== 0) {
      effectiveInterval = 0;
    }

    return {
      height,
      interval: effectiveInterval,
      angle,
      textAnchor,
      tickMargin,
      maxLabelLength,
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
    const isCompact =
      effectiveWidth > 0 &&
      effectiveHeight > 0 &&
      (effectiveWidth < minWidth || effectiveHeight < minHeight);
    // Force labels to appear for export consistency if explicitly requested
    const allowLabels = true;

    if (!allowLabels) {
      return () => null;
    }

    const maxNameLength = isCompact ? 8 : labelDensity === 'dense' ? 10 : 14;
    const fontSize = isCompact ? 10 : labelDensity === 'dense' ? 10 : 12;
    const threshold = 0;

    return (props: any) => {
      const {
        cx,
        cy,
        midAngle,
        outerRadius,
        name,
        value,
        percent,
      } = props;

      if (typeof percent === 'number' && percent > 0 && percent < threshold) {
        return null;
      }

      const numericValue = typeof value === 'number' ? value : Number(value);
      const labelValue = Number.isNaN(numericValue)
        ? String(value ?? '')
        : formatNumber(numericValue);
      const rawName = name === undefined || name === null ? '' : String(name);
      const formattedName = formatCategoryLabel(rawName);
      const loweredName = formattedName.toLowerCase();
      const preferredName = AXIS_ABBREVIATIONS[loweredName] || formattedName;

      if (!labelValue && !preferredName) return null;

      const offset = isCompact ? 10 : 14;
      const cos = Math.cos(-midAngle * RADIAN);
      const sin = Math.sin(-midAngle * RADIAN);
      const lineStart = outerRadius + 2;
      const lineEnd = outerRadius + 10;
      const sx = cx + lineStart * cos;
      const sy = cy + lineStart * sin;
      const ex = cx + lineEnd * cos;
      const ey = cy + lineEnd * sin;
      const tx = cx + (lineEnd + offset) * cos;
      const ty = cy + (lineEnd + offset) * sin;
      const anchor = cos >= 0 ? 'start' : 'end';
      const outsideName = shortenLabel(preferredName, maxNameLength + 2);

      return (
        <g pointerEvents="none">
          <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="#94a3b8" strokeWidth={1} />
          <text
            x={tx}
            y={ty}
            fill="#334155"
            fontWeight={600}
            fontSize={fontSize}
            textAnchor={anchor}
            dominantBaseline="middle"
          >
            {outsideName && (
              <tspan x={tx} dy="-0.2em">
                {outsideName}
              </tspan>
            )}
            <tspan x={tx} dy={outsideName ? '1.1em' : '0'}>
              {labelValue}
            </tspan>
          </text>
        </g>
      );
    };
  }, [chartColors, chartData, containerSize.height, containerSize.width, height, labelDensity, metricKey, type]);

  const geoSummary = useMemo(() => {
    if (type !== 'geo' || !data || data.length === 0) {
      return { points: [], unknownCount: 0 };
    }

    const totals = new Map<string, { value: number; lat: number; lon: number }>();
    const unknownLocations = new Set<string>();
    data.forEach((row) => {
      const rawLocation = row[categoryKey];
      if (rawLocation === undefined || rawLocation === null) return;

      const rawValue = row[metricKey];
      const numericValue = parseNumberValue(rawValue);
      const value = numericValue === null ? 1 : numericValue;
      const locationLabel = String(rawLocation);
      const resolved = resolveLocation(locationLabel);
      if (!resolved) {
        unknownLocations.add(locationLabel);
        return;
      }
      const existing = totals.get(resolved.name);
      if (existing) {
        totals.set(resolved.name, { ...existing, value: existing.value + value });
      } else {
        totals.set(resolved.name, { value, lat: resolved.lat, lon: resolved.lon });
      }
    });

    const points: { name: string; lat: number; lon: number; value: number }[] = [];
    totals.forEach((payload, name) => {
      points.push({ name, lat: payload.lat, lon: payload.lon, value: payload.value });
    });

    return { points, unknownCount: unknownLocations.size };
  }, [categoryKey, data, metricKey, type]);

  const geoShapes = useMemo(() => {
    const world = worldAtlas as any;
    if (!world?.objects?.countries) {
      return { countries: null, borders: null };
    }
    const countries = topojsonFeature(world, world.objects.countries);
    const borders = topojsonMesh(world, world.objects.countries, (a: any, b: any) => a !== b);
    return { countries, borders };
  }, []);

  const geoProjection = useMemo(() => {
    if (!geoShapes.countries) return null;
    return geoEquirectangular().fitSize([MAP_WIDTH, MAP_HEIGHT], geoShapes.countries as any);
  }, [geoShapes]);

  const geoPathGenerator = useMemo(() => {
    if (!geoProjection) return null;
    return geoPath(geoProjection as any);
  }, [geoProjection]);

  const geoPaths = useMemo(() => {
    if (!geoPathGenerator || !geoShapes.countries) {
      return { landPath: '', borderPath: '' };
    }
    return {
      landPath: geoPathGenerator(geoShapes.countries as any) || '',
      borderPath: geoShapes.borders ? geoPathGenerator(geoShapes.borders as any) || '' : '',
    };
  }, [geoPathGenerator, geoShapes]);

  const geoPoints = useMemo(() => {
    if (!geoProjection) return [];
    return geoSummary.points
      .map((point) => {
        const coords = geoProjection([point.lon, point.lat]);
        if (!coords) return null;
        return { ...point, x: coords[0], y: coords[1] };
      })
      .filter((point): point is { name: string; lat: number; lon: number; value: number; x: number; y: number } =>
        Boolean(point),
      );
  }, [geoProjection, geoSummary.points]);

  const hasChartData =
    type === 'pie' || type === 'bar'
      ? chartData.length > 0
      : type === 'geo'
        ? geoSummary.points.length > 0
        : data && data.length > 0;
  const hasContainerSize = containerSize.width > 0 && containerSize.height > 0;

  // Common XAxis props
  const renderXAxisTick = useMemo(() => {
    return (props: any) => {
      const rawValue = props?.payload?.value ?? '';
      const formatted = formatCategoryLabel(String(rawValue));
      const { text, lines } = formatAxisLabel(formatted, xAxisConfig.angle, xAxisConfig.maxLabelLength);
      const baseX = props.x;
      const baseY = props.y;

      if (lines.length > 0) {
        return (
          <text
            x={baseX}
            y={baseY}
            fill="#64748b"
            fontSize={axisFontSize}
            fontWeight={600}
            textAnchor={xAxisConfig.textAnchor}
            transform={`rotate(${xAxisConfig.angle}, ${baseX}, ${baseY})`}
          >
            {lines.map((line, index) => (
              <tspan key={`${line}-${index}`} x={baseX} dy={index === 0 ? '0' : '1.1em'}>
                {line}
              </tspan>
            ))}
          </text>
        );
      }

      return (
        <text
          x={baseX}
          y={baseY}
          fill="#64748b"
          fontSize={axisFontSize}
          fontWeight={600}
          textAnchor={xAxisConfig.textAnchor}
          transform={`rotate(${xAxisConfig.angle}, ${baseX}, ${baseY})`}
        >
          {text}
        </text>
      );
    };
  }, [axisFontSize, xAxisConfig]);

  const kpiFontSize = useMemo(() => {
    const minSide = Math.min(containerSize.width, containerSize.height);
    if (!Number.isFinite(minSide) || minSide <= 0) return null;
    const baseSize = Math.max(28, Math.min(minSide * 0.64, 120));
    const maxWidth = Math.max(0, containerSize.width - 12);
    if (!kpiDisplayValue || maxWidth <= 0) return baseSize;
    const estimatedWidth = estimateTextWidth(kpiDisplayValue, baseSize);
    if (estimatedWidth <= maxWidth) return baseSize;
    const scaled = Math.floor(baseSize * (maxWidth / estimatedWidth));
    return Math.max(24, Math.min(baseSize, scaled));
  }, [containerSize.height, containerSize.width, kpiDisplayValue]);

  if (!hasChartData) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-xs text-center px-3">
        No data to display. Check your source selection or filters.
      </div>
    );
  }

  const xAxisProps = {
    dataKey: categoryKey,
    tick: renderXAxisTick,
    axisLine: false,
    tickLine: false,
    height: xAxisConfig.height,
    interval: xAxisConfig.interval,
    tickMargin: xAxisConfig.tickMargin,
    minTickGap: labelDensity === 'sparse' ? 16 : 10,
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
      case 'kpi':
        const mode: AggregationType = aggregation || 'sum';
        const indicator =
          mode === 'avg' ? 'AVG' : mode === 'min' ? 'MIN' : mode === 'max' ? 'MAX' : mode === 'count' ? 'COUNT' : '';
        return (
          <div
            className="flex flex-col h-full w-full justify-between py-2 px-3"
            style={{ containerType: 'size' } as React.CSSProperties}
          >
            <div className="h-4 flex items-center justify-end">
              {indicator && (
                <span className="text-[10px] font-semibold tracking-wide text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                  {indicator}
                </span>
              )}
            </div>
            <div className="flex-1 flex items-center justify-center min-h-0 w-full overflow-hidden">
              <span
                className="font-bold tracking-tight leading-none whitespace-nowrap"
                style={{
                  color: primaryColor,
                  fontSize: kpiFontSize ? `${kpiFontSize}px` : 'clamp(28px, 8vw, 120px)'
                }}
              >
                {kpiDisplayValue}
              </span>
            </div>
          </div>
        );
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
                <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3} />
                <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
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
            <Bar dataKey={metricKey} fill={primaryColor} radius={[4, 4, 0, 0]} animationDuration={1000}>
              {chartData.map((entry, index) => {
                const category = entry[categoryKey];
                const color =
                  (category !== undefined && category !== null
                    ? categoryColorMap.get(String(category))
                    : undefined) || categoryPalette[index % categoryPalette.length];
                return <Cell key={`bar-cell-${index}`} fill={color} />;
              })}
            </Bar>
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
              outerRadius="72%"
              paddingAngle={2}
              dataKey={metricKey}
              nameKey={categoryKey}
              label={pieLabelRenderer}
              labelLine={false}
            >
              {pieData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    (entry[categoryKey] !== undefined && entry[categoryKey] !== null
                      ? categoryColorMap.get(String(entry[categoryKey]))
                      : undefined) || categoryPalette[index % categoryPalette.length]
                  }
                />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
          </PieChart>
        );
      case 'geo':
        const mapWidth = containerSize.width > 0 ? containerSize.width : MAP_WIDTH;
        const mapHeight = containerSize.height > 0 ? containerSize.height : MAP_HEIGHT;
        const points = geoPoints;
        const values = points.map((point) => point.value);
        const minValue = values.length > 0 ? Math.min(...values) : 0;
        const maxValue = values.length > 0 ? Math.max(...values) : 0;
        const range = maxValue - minValue || 1;
        const labelLimit = labelDensity === 'dense' ? 6 : labelDensity === 'balanced' ? 4 : 2;
        const labelCandidates = [...points]
          .sort((a, b) => b.value - a.value)
          .slice(0, Math.min(points.length, labelLimit))
          .map((point) => point.name);
        const labelSet = new Set(labelCandidates);
        const showLabelText =
          (containerSize.width === 0 || containerSize.width > 240) &&
          (containerSize.height === 0 || containerSize.height > 160);

        const projection = geoProjection && containerSize.width > 0 && containerSize.height > 0
          ? geoEquirectangular().fitSize([mapWidth, mapHeight], geoShapes.countries as any)
          : geoProjection;
        const pathGenerator = projection ? geoPath(projection as any) : null;
        const landPath = pathGenerator && geoShapes.countries ? pathGenerator(geoShapes.countries as any) || '' : '';
        const borderPath = pathGenerator && geoShapes.borders ? pathGenerator(geoShapes.borders as any) || '' : '';
        const renderedPoints = projection
          ? geoSummary.points
            .map((point) => {
              const coords = projection([point.lon, point.lat]);
              if (!coords) return null;
              return { ...point, x: coords[0], y: coords[1] };
            })
            .filter((point): point is { name: string; lat: number; lon: number; value: number; x: number; y: number } =>
              Boolean(point),
            )
          : points;

        return (
          <div className="relative w-full h-full">
            <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-full">
              <defs>
                <linearGradient id="mapGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f8fafc" />
                  <stop offset="100%" stopColor="#eef2f7" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width={mapWidth} height={mapHeight} fill="url(#mapGradient)" />
              <g stroke="#e2e8f0" strokeWidth="1">
                {Array.from({ length: 7 }).map((_, index) => {
                  const x = ((index + 1) / 8) * mapWidth;
                  return <line key={`v-${index}`} x1={x} y1={0} x2={x} y2={mapHeight} />;
                })}
                {Array.from({ length: 3 }).map((_, index) => {
                  const y = ((index + 1) / 4) * mapHeight;
                  return <line key={`h-${index}`} x1={0} y1={y} x2={mapWidth} y2={y} />;
                })}
              </g>
              <g fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.7">
                {landPath && <path d={landPath} />}
              </g>
              {borderPath && (
                <path d={borderPath} fill="none" stroke="#cbd5e1" strokeWidth="0.4" opacity="0.7" />
              )}
              <g>
                {renderedPoints.map((point) => {
                  const size = 4 + (Math.sqrt(point.value - minValue + 1) / Math.sqrt(range + 1)) * 8;
                  return (
                    <g key={`${point.name}-${point.lat}-${point.lon}`}>
                      <circle cx={point.x} cy={point.y} r={size} fill={primaryColor} opacity={0.82}>
                        <title>{`${point.name}: ${formatNumber(point.value)}`}</title>
                      </circle>
                      {showLabelText && labelSet.has(point.name) && (
                        <text
                          x={point.x + size + 4}
                          y={point.y + 4}
                          fontSize={10}
                          fontWeight={600}
                          fill="#475569"
                        >
                          {point.name}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
            {geoSummary.unknownCount > 0 && containerSize.width > 220 && (
              <div className="absolute bottom-2 right-2 text-[10px] text-gray-500 bg-white/80 px-2 py-1 rounded shadow-sm">
                {geoSummary.unknownCount} location{geoSummary.unknownCount > 1 ? 's' : ''} not mapped
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className={`w-full h-full ${type === 'pie' ? 'overflow-visible' : ''}`}>
      {type === 'geo' ? (
        hasContainerSize ? (
          renderChart()
        ) : (
          <div className="w-full h-full" />
        )
      ) : type === 'kpi' ? (
        renderChart()
      ) : hasContainerSize ? (
        <ResponsiveContainer width="100%" height="100%">
          {renderChart() || <div />}
        </ResponsiveContainer>
      ) : (
        <div className="w-full h-full" />
      )}
    </div>
  );
};

export default ChartRenderer;
