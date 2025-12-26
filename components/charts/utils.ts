import { CATEGORY_PALETTES } from '../../constants';
import { LabelDensity } from '../../types';

export const formatNumber = (num: number): string => {
    if (num === undefined || num === null || isNaN(num)) return '0';
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
};

export const parseNumberValue = (raw: unknown): number | null => {
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

export const shortenLabel = (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    const sliceLength = Math.max(0, maxLength - 3);
    return `${text.slice(0, sliceLength)}...`;
};

export const formatCategoryLabel = (label: string): string => {
    if (!label) return '';
    const trimmed = label.trim();
    if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(trimmed)) {
        return trimmed.slice(5);
    }
    return trimmed;
};

export const estimateTextWidth = (text: string, fontSize: number): number => text.length * fontSize * 0.56;

export const getLabelThreshold = (density: LabelDensity): number => {
    if (density === 'sparse') return 0.1;
    if (density === 'balanced') return 0.06;
    return 0;
};

export const hashString = (value: string): number => {
    let hash = 0;
    for (let i = 0; i < value.length; i += 1) {
        hash = (hash << 5) - hash + value.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

export const pickPalette = (seed: string, fallback: string[]) => {
    // Always return the fallback (active theme) colors to ensure consistency
    return fallback;
};

export const AXIS_ABBREVIATIONS: Record<string, string> = {
    'united states': 'U.S.',
    'united states of america': 'U.S.',
    'united kingdom': 'U.K.',
    'united arab emirates': 'UAE',
};

export const toAcronym = (label: string): string => {
    const words = label.split(/\s+/).filter(Boolean);
    if (words.length <= 1) return label;
    return words.map((word) => word[0]?.toUpperCase() || '').join('.') + '.';
};

export const splitLabelInTwo = (label: string): string[] => {
    const words = label.split(/\s+/).filter(Boolean);
    if (words.length <= 1) {
        const mid = Math.ceil(label.length / 2);
        return [label.slice(0, mid), label.slice(mid)];
    }
    if (words.length === 2) return [words[0], words[1]];
    const midIndex = Math.ceil(words.length / 2);
    return [words.slice(0, midIndex).join(' '), words.slice(midIndex).join(' ')];
};

export const formatAxisLabel = (label: string, angle: number, maxLength: number) => {
    const lowered = label.toLowerCase();
    if (AXIS_ABBREVIATIONS[lowered]) {
        return { text: AXIS_ABBREVIATIONS[lowered], lines: [] as string[] };
    }
    if (angle <= -65 && label.length > maxLength) {
        return { text: toAcronym(label), lines: [] as string[] };
    }
    if (angle === 0 && label.length > maxLength + 2 && label.includes(' ')) {
        return { text: '', lines: splitLabelInTwo(label) };
    }
    return { text: shortenLabel(label, maxLength), lines: [] as string[] };
};

export const getReadableTextColor = (fill: string): string => {
    const normalized = fill.trim();
    if (!normalized.startsWith('#')) return '#1f2937';
    const hex = normalized.length === 4
        ? `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`
        : normalized;
    if (hex.length !== 7) return '#1f2937';
    const r = Number.parseInt(hex.slice(1, 3), 16);
    const g = Number.parseInt(hex.slice(3, 5), 16);
    const b = Number.parseInt(hex.slice(5, 7), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return '#1f2937';
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance < 0.5 ? '#f8fafc' : '#1f2937';
};
