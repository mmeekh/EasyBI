export interface DataPoint {
  [key: string]: string | number | null;
}

export type ColumnType = 'string' | 'number' | 'date';

export interface ColumnInfo {
  key: string;
  type: ColumnType;
  label: string;
}

export type ChartType = 'line' | 'bar' | 'area' | 'pie' | 'kpi' | 'geo';
export type AggregationType = 'sum' | 'avg' | 'min' | 'max' | 'count';
export type LabelDensity = 'sparse' | 'balanced' | 'dense';
export type SortBy = 'none' | 'value' | 'name';
export type SortOrder = 'asc' | 'desc';

export interface ChartConfig {
  sortBy?: SortBy;
  sortOrder?: SortOrder;
  topN?: number;
  groupOther?: boolean;
  otherThreshold?: number;
  labelDensity?: LabelDensity;
  pieLabelPlacement?: 'outside' | 'auto';
  kpiAutoScale?: boolean;
}

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
  chartConfig?: ChartConfig;
  colSpan?: number;
  rowSpan?: number;
}

export interface ColorTheme {
  id: string;
  name: string;
  colors: string[];
  background: string;
}

export interface ProjectState {
  version: number;
  datasets: Dataset[];
  dashboards: Dashboard[];
  selectedColumns: Record<string, string[]>;
  activeDashboardId: string;
  activeThemeId: string;
  activeCategories: string[];
  activeCategoryKey?: string;
}
