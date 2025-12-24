import * as XLSX from 'xlsx';
import { Dataset, DataPoint, ColumnInfo } from '../types';

export const parseExcelFile = async (file: File): Promise<Dataset[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        const datasets: Dataset[] = [];

        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          // Convert sheet to JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) return; // Skip empty sheets

          const headers = jsonData[0] as string[];
          const rows = jsonData.slice(1) as any[][];

          const dataPoints: DataPoint[] = rows.map(row => {
            const obj: DataPoint = {};
            headers.forEach((header, index) => {
              if (index < row.length) {
                obj[header] = row[index];
              }
            });
            return obj;
          });

          // Analyze columns
          const columns: ColumnInfo[] = headers.map(key => {
            let numberCount = 0;
            let checkLimit = Math.min(dataPoints.length, 10);
            
            for (let i = 0; i < checkLimit; i++) {
              const val = dataPoints[i][key];
              if (typeof val === 'number') {
                numberCount++;
              }
            }
            
            const type = numberCount > checkLimit / 2 ? 'number' : 'string';
            return { key, type, label: key };
          });

          if (columns.length > 0) {
            datasets.push({
              id: Math.random().toString(36).substr(2, 9),
              name: sheetName,
              data: dataPoints,
              columns: columns
            });
          }
        });

        resolve(datasets);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};