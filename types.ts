export interface DataPoint {
  [key: string]: string | number;
}

export interface ColumnInfo {
  key: string;
  type: 'string' | 'number';
  label: string;
}

export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'kpi';
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface Dataset {
  id: string;
  name: string;
  data: DataPoint[];
  columns: ColumnInfo[];
}

export interface Dashboard {
  id: string;
  name: string;
  items: DashboardItem[];
}

export interface DashboardItem {
  id: string;
  datasetId: string; // Link to specific dataset
  title: string;
  metricKey: string;
  categoryKey: string;
  chartType: ChartType;
  colorTheme: string; 
  customColor?: string; // New: Override color for specific item
   aggregation?: AggregationType;
  colSpan?: number;
  rowSpan?: number;
}

export interface ColorTheme {
  id: string;
  name: string;
  colors: string[];
  background: string;
}
