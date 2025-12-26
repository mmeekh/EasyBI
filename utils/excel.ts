import { ParsedTable, parseRowsToTable } from './tabular';

export interface ParsedSheet {
  name: string;
  table: ParsedTable;
}

export const parseExcelFile = async (file: File): Promise<ParsedSheet[]> => {
  const XLSXModule = await import('xlsx');
  const XLSX = 'default' in XLSXModule ? XLSXModule.default : XLSXModule;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheets: ParsedSheet[] = [];

        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (!jsonData || jsonData.length < 2) return;

          const headerRow = (jsonData[0] || []) as unknown[];
          const headers = headerRow.map((value) => String(value ?? '').trim());
          const rows = jsonData.slice(1) as unknown[][];
          const table = parseRowsToTable(headers, rows);

          if (table.headers.length > 0 && table.rows.length > 0) {
            sheets.push({ name: sheetName, table });
          }
        });

        resolve(sheets);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
