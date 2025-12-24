import { Dispatch, SetStateAction, useEffect } from 'react';
import { Dataset, Dashboard } from '../types';

interface UseDashboardPersistenceParams {
  datasets: Dataset[];
  dashboards: Dashboard[];
  selectedColumns: Record<string, string[]>;
  activeDashboardId: string;
  activeThemeId: string;
  activeCategories: string[];
  setDatasets: Dispatch<SetStateAction<Dataset[]>>;
  setDashboards: Dispatch<SetStateAction<Dashboard[]>>;
  setSelectedColumns: Dispatch<SetStateAction<Record<string, string[]>>>;
  setActiveDashboardId: Dispatch<SetStateAction<string>>;
  setActiveThemeId: Dispatch<SetStateAction<string>>;
  setActiveCategories: Dispatch<SetStateAction<string[]>>;
  showToast: (options: { type: 'success' | 'error' | 'info'; message: string }) => void;
}

export const useDashboardPersistence = (params: UseDashboardPersistenceParams) => {
  const {
    datasets,
    dashboards,
    selectedColumns,
    activeDashboardId,
    activeThemeId,
    activeCategories,
    setDatasets,
    setDashboards,
    setSelectedColumns,
    setActiveDashboardId,
    setActiveThemeId,
    setActiveCategories,
    showToast,
  } = params;

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = window.localStorage.getItem('simpledash_state_v1');
      if (!stored) return;
      const parsed = JSON.parse(stored) as {
        datasets?: Dataset[];
        dashboards?: Dashboard[];
        selectedColumns?: Record<string, string[]>;
        activeDashboardId?: string;
        activeThemeId?: string;
        activeCategories?: string[];
      };

      if (parsed.datasets && Array.isArray(parsed.datasets)) {
        setDatasets(parsed.datasets);
      }
      if (parsed.dashboards && Array.isArray(parsed.dashboards)) {
        setDashboards(parsed.dashboards);
      }
      if (parsed.selectedColumns) {
        setSelectedColumns(parsed.selectedColumns);
      }
      if (parsed.activeDashboardId) {
        setActiveDashboardId(parsed.activeDashboardId);
      }
      if (parsed.activeThemeId) {
        setActiveThemeId(parsed.activeThemeId);
      }
      if (parsed.activeCategories && Array.isArray(parsed.activeCategories)) {
        setActiveCategories(parsed.activeCategories);
      }

      if (parsed.datasets && parsed.datasets.length > 0) {
        showToast({
          type: 'info',
          message: `Restored ${parsed.datasets.length} dataset(s) and ${parsed.dashboards?.length ?? 0} dashboard(s) from last session.`,
        });
      }
    } catch (e) {
      console.error('Failed to restore saved dashboard state', e);
    }
  }, [setActiveDashboardId, setActiveCategories, setActiveThemeId, setDashboards, setDatasets, setSelectedColumns, showToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (datasets.length === 0 && dashboards.length === 0) {
      window.localStorage.removeItem('simpledash_state_v1');
      return;
    }

    const stateToPersist = {
      datasets,
      dashboards,
      selectedColumns,
      activeDashboardId,
      activeThemeId,
      activeCategories,
    };

    try {
      window.localStorage.setItem('simpledash_state_v1', JSON.stringify(stateToPersist));
    } catch (e) {
      console.error('Failed to persist dashboard state', e);
    }
  }, [activeCategories, activeDashboardId, activeThemeId, dashboards, datasets, selectedColumns]);
};
