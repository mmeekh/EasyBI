import { ChartConfig, ColorTheme } from './types';

export const THEMES: ColorTheme[] = [
  {
    id: 'corporate',
    name: 'Corporate Blue',
    colors: ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe'],
    background: '#ffffff'
  },
  {
    id: 'emerald',
    name: 'Emerald Growth',
    colors: ['#059669', '#10b981', '#34d399', '#6ee7b7', '#a7f3d0'],
    background: '#ffffff'
  },
  {
    id: 'sunset',
    name: 'Sunset Vibes',
    colors: ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa'],
    background: '#fff7ed'
  },
  {
    id: 'bordo',
    name: 'Bordeaux Power',
    colors: ['#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#ef4444'],
    background: '#fff5f5'
  },
  {
    id: 'colorblind',
    name: 'CVD Safe',
    colors: ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#CC79A7'],
    background: '#ffffff'
  },
  {
    id: 'contrast',
    name: 'High Contrast',
    colors: ['#111827', '#1d4ed8', '#dc2626', '#16a34a', '#f59e0b'],
    background: '#ffffff'
  },
  {
    id: 'purple',
    name: 'Modern Purple',
    colors: ['#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
    background: '#ffffff'
  },
  {
    id: 'dark',
    name: 'Dark Mode',
    colors: ['#60a5fa', '#34d399', '#f472b6', '#a78bfa', '#fbbf24'],
    background: '#1e293b'
  }
];

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  sortBy: 'none',
  sortOrder: 'desc',
  topN: 0,
  groupOther: false,
  otherThreshold: 5,
  labelDensity: 'balanced',
  pieLabelPlacement: 'outside',
  kpiAutoScale: true,
};

export const CHART_TYPES = [
  { type: 'line', label: 'Trend' },
  { type: 'bar', label: 'Comparison' },
  { type: 'pie', label: 'Distribution' },
  { type: 'geo', label: 'Map' }
] as const;

export const CATEGORY_PALETTES = [
  {
    id: 'ocean',
    name: 'Ocean',
    colors: ['#0f4c81', '#1b6ca8', '#2e8bc0', '#4ea5d9', '#6fbfe8', '#98d7f1', '#c3ecf8', '#e6f7fb'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    colors: ['#9a3412', '#c2410c', '#ea580c', '#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5'],
  },
  {
    id: 'meadow',
    name: 'Meadow',
    colors: ['#14532d', '#166534', '#15803d', '#16a34a', '#22c55e', '#4ade80', '#86efac', '#bbf7d0'],
  },
  {
    id: 'berry',
    name: 'Berry',
    colors: ['#4c1d95', '#5b21b6', '#6d28d9', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe'],
  },
  {
    id: 'slate',
    name: 'Slate',
    colors: ['#1f2937', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5f5', '#e2e8f0', '#f1f5f9'],
  },
];
