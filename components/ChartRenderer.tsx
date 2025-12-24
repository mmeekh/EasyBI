import React, { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { AggregationType, ChartType, DataPoint } from '../types';

interface ChartRendererProps {
  type: ChartType;
  data: DataPoint[];
  metricKey: string;
  categoryKey: string;
  colors: string[];
  customColor?: string; // Allow single color override
  height?: number; 
  aggregation?: AggregationType;
}

const formatNumber = (num: number): string => {
  if (num === undefined || num === null || isNaN(num)) return '0';
  if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toLocaleString();
};

const ChartRenderer: React.FC<ChartRendererProps> = ({
  type,
  data,
  metricKey,
  categoryKey,
  colors,
  customColor,
  aggregation,
}) => {
  const primaryColor = customColor || colors[0];
  const chartColors = customColor ? [customColor, ...colors.slice(1)] : colors;
  
  const aggregatedValue = useMemo(() => {
    if (type !== 'kpi' || !data) return 0;

    const mode: AggregationType = aggregation || 'sum';
    const numbers: number[] = [];

    data.forEach((point) => {
      const val = point[metricKey];
      if (val === undefined || val === null) return;
      let num = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
      if (!isNaN(num)) {
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

  if (!data || data.length === 0) {
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
    tick: { fontSize: 10, fill: '#64748b' },
    axisLine: false,
    tickLine: false,
    height: 20,
    interval: 'preserveStartEnd' as const
  };

  const yAxisProps = {
    tick: { fontSize: 10, fill: '#64748b' },
    axisLine: false,
    tickLine: false,
    width: 30,
    tickFormatter: (val: any) => formatNumber(val as number)
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return (
          <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
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
          <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis {...xAxisProps} />
            <YAxis {...yAxisProps} />
            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
            <Bar dataKey={metricKey} fill={primaryColor} radius={[4, 4, 0, 0]} animationDuration={1000} />
          </BarChart>
        );
      case 'pie':
        const pieData = data.slice(0, 8); 
        return (
          <PieChart>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius="50%" outerRadius="80%" paddingAngle={2} dataKey={metricKey} nameKey={categoryKey}>
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
    <ResponsiveContainer width="100%" height="100%">
      {renderChart() || <div />}
    </ResponsiveContainer>
  );
};

export default ChartRenderer;
