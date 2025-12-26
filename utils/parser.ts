import { ParsedTable, parseRowsToTable } from './tabular';

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

export const parseRawData = (input: string): ParsedTable => {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      headers: [],
      rows: [],
      report: {
        rawRowCount: 0,
        parsedRowCount: 0,
        skippedRows: 0,
        rowLengthMismatches: 0,
        emptyHeaderCount: 0,
        duplicateHeaders: [],
      },
    };
  }

  const rows = trimmed
    .split(/\r?\n/)
    .map((r) => r.trim())
    .filter((r) => r);

  if (rows.length < 2) {
    return {
      headers: [],
      rows: [],
      report: {
        rawRowCount: 0,
        parsedRowCount: 0,
        skippedRows: 0,
        rowLengthMismatches: 0,
        emptyHeaderCount: 0,
        duplicateHeaders: [],
      },
    };
  }

  const firstLine = rows[0];
  const separator = firstLine.includes('\t') ? '\t' : ',';

  const headers = splitWithQuotes(firstLine, separator).map((h) => h.trim());
  const rawDataLines = rows.slice(1);
  const rawRows = rawDataLines.map((rowStr) => splitWithQuotes(rowStr, separator));

  return parseRowsToTable(headers, rawRows);
};
