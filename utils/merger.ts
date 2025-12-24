import { Dataset, DataPoint, ColumnInfo } from '../types';

export const mergeDatasets = (datasets: Dataset[], selection: Record<string, string[]>): Dataset => {
  const mergedId = 'merged-dataset';
  const selectedDsIds = Object.keys(selection).filter(id => selection[id] && selection[id].length > 0);

  if (selectedDsIds.length === 0) {
    return { id: mergedId, name: 'Merged View', data: [], columns: [] };
  }

  // Find max length to iterate (row count)
  let maxLength = 0;
  const targetDatasets = datasets.filter(d => selectedDsIds.includes(d.id));
  targetDatasets.forEach(d => {
    if (d.data.length > maxLength) maxLength = d.data.length;
  });

  const newColumns: ColumnInfo[] = [];
  const columnKeyMap: Record<string, string> = {}; // "dsId-originalKey" -> "uniqueNewKey"

  // 1. Build Columns & Handle Collisions
  targetDatasets.forEach(ds => {
    const selectedKeys = selection[ds.id] || [];
    selectedKeys.forEach(key => {
        const originalCol = ds.columns.find(c => c.key === key);
        if(!originalCol) return;

        // Check for key collision in our new list
        // If multiple datasets are selected, we often want to prefix to avoid confusion, 
        // unless it's a common key like "Date" or "Month" which might be redundant if perfectly matching,
        // but for safety in this MVP, we prefix if there's any ambiguity.
        
        let newKey = key;
        const isCollision = newColumns.some(c => c.key === newKey);
        
        // If there is a collision OR if we just want to be explicit when multiple sources exist:
        // We prefix with dataset name.
        if (isCollision || targetDatasets.length > 1) {
            newKey = `${ds.name}: ${originalCol.label}`;
        }
        
        // Ensure strictly unique if user names datasets same way (edge case)
        let suffix = 2;
        while(newColumns.some(c => c.key === newKey)) {
            newKey = `${ds.name}: ${originalCol.label} (${suffix++})`;
        }

        columnKeyMap[`${ds.id}-${key}`] = newKey;
        newColumns.push({ 
            ...originalCol, 
            key: newKey, 
            label: newKey // Display label is the unique key
        });
    });
  });

  // 2. Build Data
  const newData: DataPoint[] = [];
  for(let i=0; i < maxLength; i++) {
    const row: DataPoint = {};
    targetDatasets.forEach(ds => {
        const srcRow = ds.data[i] || {};
        const selectedKeys = selection[ds.id] || [];
        selectedKeys.forEach(key => {
            const newKey = columnKeyMap[`${ds.id}-${key}`];
            if(newKey) {
                // If the source row doesn't have data, it becomes undefined (empty in chart)
                row[newKey] = srcRow[key];
            }
        });
    });
    newData.push(row);
  }

  return {
    id: mergedId,
    name: 'Merged Data',
    data: newData,
    columns: newColumns
  };
};