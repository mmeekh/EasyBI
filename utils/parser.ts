import { DataPoint, ColumnInfo } from '../types';

const splitWithQuotes = (line: string, separator: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === separator && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
};

export const parseRawData = (input: string): {
  data: DataPoint[];
  columns: ColumnInfo[];
  rawRowCount: number;
  skippedRows: number;
} => {
  const trimmed = input.trim();
  if (!trimmed) {
    return { data: [], columns: [], rawRowCount: 0, skippedRows: 0 };
  }

  const rows = trimmed
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r);

  if (rows.length < 2) {
    return { data: [], columns: [], rawRowCount: 0, skippedRows: 0 };
  }

  const firstLine = rows[0];
  const separator = firstLine.includes('\t') ? '\t' : ',';

  const headers = splitWithQuotes(firstLine, separator)
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  const rawDataLines = rows.slice(1);
  let skippedRows = 0;
  const data: DataPoint[] = [];

  rawDataLines.forEach((rowStr) => {
    if (!rowStr) {
      skippedRows++;
      return;
    }

    const values = splitWithQuotes(rowStr, separator);
    const obj: DataPoint = {};
    let hasValue = false;

    headers.forEach((header, index) => {
      if (index < values.length) {
        const rawVal = values[index].trim();
        if (rawVal !== '') {
          hasValue = true;
        }
        const num = parseFloat(rawVal.replace(/,/g, ''));
        obj[header] = !isNaN(num) && rawVal !== '' ? num : rawVal;
      }
    });

    if (hasValue) {
      data.push(obj);
    } else {
      skippedRows++;
    }
  });

  const columns: ColumnInfo[] = headers.map((key) => {
    let numberCount = 0;
    const checkLimit = Math.min(data.length, 5);

    for (let i = 0; i < checkLimit; i++) {
      if (typeof data[i][key] === 'number') {
        numberCount++;
      }
    }

    const type = numberCount > checkLimit / 2 ? 'number' : 'string';
    return { key, type, label: key };
  });

  return {
    data,
    columns,
    rawRowCount: rawDataLines.length,
    skippedRows,
  };
};
