import { Dispatch, SetStateAction, useEffect } from 'react';
import { Dataset, Dashboard, ProjectState } from '../types';
import { clearPersistedState, loadPersistedState, savePersistedState } from '../utils/persistence';

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
    let isMounted = true;

    const restore = async () => {
      try {
        const parsed = await loadPersistedState();
        if (!parsed || !isMounted) return;

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
    };

    void restore();
    return () => {
      isMounted = false;
    };
  }, [setActiveDashboardId, setActiveCategories, setActiveThemeId, setDashboards, setDatasets, setSelectedColumns, showToast]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (datasets.length === 0 && dashboards.length === 0) {
      void clearPersistedState();
      return;
    }

    const stateToPersist: ProjectState = {
      version: 2,
      datasets,
      dashboards,
      selectedColumns,
      activeDashboardId,
      activeThemeId,
      activeCategories,
    };

    void savePersistedState(stateToPersist);
  }, [activeCategories, activeDashboardId, activeThemeId, dashboards, datasets, selectedColumns]);
};
