import { ColorTheme } from './types';

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

export const CHART_TYPES = [
  { type: 'line', label: 'Trend' },
  { type: 'bar', label: 'Comparison' },
  { type: 'pie', label: 'Distribution' }
] as const;
