import { ColumnInfo, ColumnType, DataPoint, Dataset } from '../types';

export interface ParseReport {
  rawRowCount: number;
  parsedRowCount: number;
  skippedRows: number;
  rowLengthMismatches: number;
  emptyHeaderCount: number;
  duplicateHeaders: string[];
}

export interface ParsedTable {
  headers: string[];
  rows: string[][];
  report: ParseReport;
}

export interface ColumnDraft {
  key: string;
  label: string;
  type: ColumnType;
  sampleValues: string[];
  invalidNumberCount: number;
  invalidDateCount: number;
}

export interface ColumnMapping {
  key: string;
  label: string;
  type: ColumnType;
  include: boolean;
}

export interface ImportReport extends ParseReport {
  invalidNumberColumns: Record<string, number>;
  invalidDateColumns: Record<string, number>;
}

const normalizeHeader = (header: string, index: number): string => {
  const trimmed = header.trim();
  return trimmed.length > 0 ? trimmed : `Column ${index + 1}`;
};

const normalizeHeaders = (headers: string[]): { headers: string[]; emptyHeaderCount: number; duplicateHeaders: string[] } => {
  const seen = new Map<string, number>();
  const duplicateHeaders: string[] = [];
  let emptyHeaderCount = 0;

  const normalized = headers.map((header, index) => {
    const base = normalizeHeader(header, index);
    if (base === `Column ${index + 1}` && header.trim() === '') {
      emptyHeaderCount += 1;
    }
    const currentCount = seen.get(base) || 0;
    if (currentCount > 0) {
      duplicateHeaders.push(base);
    }
    seen.set(base, currentCount + 1);
    return currentCount > 0 ? `${base} (${currentCount + 1})` : base;
  });

  return { headers: normalized, emptyHeaderCount, duplicateHeaders };
};

const normalizeCell = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

const parseNumberValue = (raw: string): number | null => {
  if (!raw) return null;
  const normalized = raw
    .replace(/\s/g, '')
    .replace(/[,$\u20AC\u00A3\u20BA\u20BD\u00A5]/g, '')
    .replace(/\((.*)\)/, '-$1')
    .replace(/%$/, '');
  const num = Number(normalized.replace(/,/g, ''));
  return Number.isFinite(num) ? num : null;
};

const parseDateValue = (raw: string): number | null => {
  if (!raw) return null;
  if (!/[a-zA-Z]|[\/\-.]/.test(raw)) return null;
  const parsed = Date.parse(raw);
  return Number.isNaN(parsed) ? null : parsed;
};

export const parseRowsToTable = (rawHeaders: string[], rawRows: unknown[][]): ParsedTable => {
  const { headers, emptyHeaderCount, duplicateHeaders } = normalizeHeaders(
    rawHeaders.map((h) => normalizeCell(h)),
  );

  let skippedRows = 0;
  let rowLengthMismatches = 0;
  const rows: string[][] = [];

  rawRows.forEach((row) => {
    const normalizedRow = row.map((cell) => normalizeCell(cell));
    if (normalizedRow.length !== headers.length) {
      rowLengthMismatches += 1;
    }
    const paddedRow = headers.map((_, index) => normalizedRow[index] ?? '');
    const hasValue = paddedRow.some((value) => value !== '');
    if (!hasValue) {
      skippedRows += 1;
      return;
    }
    rows.push(paddedRow);
  });

  return {
    headers,
    rows,
    report: {
      rawRowCount: rawRows.length,
      parsedRowCount: rows.length,
      skippedRows,
      rowLengthMismatches,
      emptyHeaderCount,
      duplicateHeaders,
    },
  };
};

export const inferColumnDrafts = (table: ParsedTable, sampleSize = 50): ColumnDraft[] => {
  const { headers, rows } = table;

  return headers.map((key, index) => {
    const sampleValues: string[] = [];
    let numericCount = 0;
    let dateCount = 0;
    let nonEmptyCount = 0;
    let invalidNumberCount = 0;
    let invalidDateCount = 0;

    for (let i = 0; i < rows.length && nonEmptyCount < sampleSize; i += 1) {
      const value = rows[i][index];
      if (!value) continue;
      nonEmptyCount += 1;

      const num = parseNumberValue(value);
      if (num !== null) {
        numericCount += 1;
      } else if (parseDateValue(value) !== null) {
        dateCount += 1;
      }

      if (sampleValues.length < 3 && !sampleValues.includes(value)) {
        sampleValues.push(value);
      }
    }

    let type: ColumnType = 'string';
    if (nonEmptyCount > 0) {
      const numericRatio = numericCount / nonEmptyCount;
      const dateRatio = dateCount / nonEmptyCount;
      if (numericRatio >= 0.7 && numericRatio >= dateRatio) {
        type = 'number';
      } else if (dateRatio >= 0.6) {
        type = 'date';
      }
    }

    rows.forEach((row) => {
      const value = row[index];
      if (!value) return;
      if (type === 'number' && parseNumberValue(value) === null) {
        invalidNumberCount += 1;
      }
      if (type === 'date' && parseDateValue(value) === null) {
        invalidDateCount += 1;
      }
    });

    return {
      key,
      label: key,
      type,
      sampleValues,
      invalidNumberCount,
      invalidDateCount,
    };
  });
};

const castValue = (raw: string, type: ColumnType): string | number | null => {
  if (raw === '') return null;
  if (type === 'number') {
    return parseNumberValue(raw);
  }
  if (type === 'date') {
    return raw;
  }
  return raw;
};

export const buildDatasetFromTable = (
  name: string,
  table: ParsedTable,
  mapping: ColumnMapping[],
): { dataset: Dataset; report: ImportReport } => {
  const invalidNumberColumns: Record<string, number> = {};
  const invalidDateColumns: Record<string, number> = {};
  const usedLabels = new Map<string, number>();

  const resolvedMapping = mapping
    .map((col, index) => ({ ...col, sourceIndex: index }))
    .filter((col) => col.include)
    .map((col) => {
      const baseLabel = col.label.trim() || col.key;
      const currentCount = usedLabels.get(baseLabel) || 0;
      const resolvedLabel = currentCount > 0 ? `${baseLabel} (${currentCount + 1})` : baseLabel;
      usedLabels.set(baseLabel, currentCount + 1);
      return { ...col, label: resolvedLabel };
    });

  const columns: ColumnInfo[] = resolvedMapping.map((col) => ({
    key: col.label,
    label: col.label,
    type: col.type,
  }));

  const data: DataPoint[] = [];
  let skippedRows = 0;

  table.rows.forEach((row) => {
    const obj: DataPoint = {};
    let hasValue = false;

    resolvedMapping.forEach((col) => {
      const raw = row[col.sourceIndex] ?? '';
      const value = castValue(raw, col.type);

      if (value !== null && value !== '') {
        hasValue = true;
      }

      if (col.type === 'number') {
        if (value === null && raw !== '') {
          invalidNumberColumns[col.label] = (invalidNumberColumns[col.label] || 0) + 1;
        }
        obj[col.label] = value;
      } else if (col.type === 'date') {
        if (raw && parseDateValue(raw) === null) {
          invalidDateColumns[col.label] = (invalidDateColumns[col.label] || 0) + 1;
        }
        obj[col.label] = raw || null;
      } else {
        obj[col.label] = raw || null;
      }
    });

    if (hasValue) {
      data.push(obj);
    } else {
      skippedRows += 1;
    }
  });

  return {
    dataset: {
      id: Math.random().toString(36).substr(2, 9),
      name: name || 'Dataset',
      data,
      columns,
    },
    report: {
      ...table.report,
      skippedRows: table.report.skippedRows + skippedRows,
      parsedRowCount: data.length,
      invalidNumberColumns,
      invalidDateColumns,
    },
  };
};
