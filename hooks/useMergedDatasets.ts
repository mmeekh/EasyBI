import { useMemo } from 'react';
import { mergeDatasets } from '../utils/merger';
import { Dataset } from '../types';

export const useMergedDatasets = (
  datasets: Dataset[],
  selectedColumns: Record<string, string[]>,
  activeCategories: string[]
) => {
  const mergedDataset = useMemo(() => {
    return mergeDatasets(datasets, selectedColumns);
  }, [datasets, selectedColumns]);

  const filteredMergedDataset = useMemo(() => {
    if (!activeCategories.length) return mergedDataset;
    const categoryCol = mergedDataset.columns.find((c) => c.type === 'string') || mergedDataset.columns[0];
    if (!categoryCol) return mergedDataset;

    const key = categoryCol.key;
    const filteredData = mergedDataset.data.filter((row) => {
      const raw = row[key];
      if (raw === undefined || raw === null) return false;
      const str = String(raw);
      return activeCategories.includes(str);
    });

    return { ...mergedDataset, data: filteredData };
  }, [activeCategories, mergedDataset]);

  const allDatasets = useMemo(() => {
    return [...datasets, filteredMergedDataset];
  }, [datasets, filteredMergedDataset]);

  return { mergedDataset, filteredMergedDataset, allDatasets };
};

