import { useState, useMemo, useEffect } from 'react';
import { THEMES } from '../constants';
import { useToast } from '../components/ToastProvider';
import { useMergedDatasets } from './useMergedDatasets';
import { useDashboardPersistence } from './useDashboardPersistence';
import { AggregationType, ChartConfig, ChartType, Dashboard, DashboardItem, Dataset, ProjectState } from '../types';
import { buildDatasetFromTable, ColumnMapping, ImportReport, inferColumnDrafts } from '../utils/tabular';
import { parseRawData } from '../utils/parser';

export const useDashboardController = () => {
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [dashboards, setDashboards] = useState<Dashboard[]>([]);
    const [selectedColumns, setSelectedColumns] = useState<Record<string, string[]>>({});
    const [activeDashboardId, setActiveDashboardId] = useState<string>('');
    const [activeThemeId, setActiveThemeId] = useState<string>('corporate');
    const [showDataModal, setShowDataModal] = useState(false);
    const [activeCategories, setActiveCategories] = useState<string[]>([]);

    const { showToast } = useToast();

    const activeThemeConfig = useMemo(
        () => THEMES.find((t) => t.id === activeThemeId) || THEMES[0],
        [activeThemeId]
    );

    const { mergedDataset, filteredMergedDataset, allDatasets } = useMergedDatasets(
        datasets,
        selectedColumns,
        activeCategories
    );

    useDashboardPersistence({
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
    });

    useEffect(() => {
        if (datasets.length > 0 && dashboards.length === 0) {
            const newDash: Dashboard = { id: 'dash-1', name: 'Main Dashboard', items: [] };
            setDashboards([newDash]);
            setActiveDashboardId(newDash.id);
        }
    }, [datasets, dashboards]);

    const addDataset = (newDataset: Dataset) => {
        setDatasets((prev) => [...prev, newDataset]);
        setSelectedColumns((prev) => ({
            ...prev,
            [newDataset.id]: newDataset.columns.map((c) => c.key),
        }));
        setShowDataModal(false);
    };

    const handleDataParsed = (rawText: string, name: string) => {
        const table = parseRawData(rawText);
        if (table.rows.length === 0 || table.headers.length === 0) {
            showToast({
                type: 'error',
                message: 'Could not parse data. Please check the format (headers + rows).',
            });
            return;
        }

        const columnDrafts = inferColumnDrafts(table);
        const mapping: ColumnMapping[] = columnDrafts.map((col) => ({
            key: col.key,
            label: col.label,
            type: col.type,
            include: true,
        }));

        const { dataset, report } = buildDatasetFromTable(name, table, mapping);
        if (dataset.data.length === 0 || dataset.columns.length === 0) {
            showToast({
                type: 'error',
                message: 'No usable rows or columns found after parsing.',
            });
            return;
        }
        addDataset(dataset);
        showToast({
            type: 'success',
            message: `Parsed ${report.parsedRowCount} rows and ${dataset.columns.length} columns. Skipped ${report.skippedRows} of ${report.rawRowCount} data rows.`,
        });
    };

    const handleDatasetsLoaded = (newDatasets: Dataset[], reports?: ImportReport[]) => {
        newDatasets.forEach((d) => addDataset(d));
        const totalRows = newDatasets.reduce((sum, ds) => sum + ds.data.length, 0);
        const totalCols = newDatasets.reduce((sum, ds) => Math.max(sum, ds.columns.length), 0);
        const warningTypes = reports
            ? reports.reduce((sum, report) => {
                  let count = 0;
                  if (report.rowLengthMismatches > 0) count += 1;
                  if (report.emptyHeaderCount > 0) count += 1;
                  if (report.duplicateHeaders.length > 0) count += 1;
                  if (Object.values(report.invalidNumberColumns).some((v) => v > 0)) count += 1;
                  if (Object.values(report.invalidDateColumns).some((v) => v > 0)) count += 1;
                  return sum + count;
              }, 0)
            : 0;

        if (newDatasets.length > 0) {
            showToast({
                type: warningTypes > 0 ? 'info' : 'success',
                message: `Imported ${newDatasets.length} dataset(s) with ~${totalRows} rows and up to ${totalCols} columns.${warningTypes > 0 ? ` ${warningTypes} warning type(s) detected.` : ''}`,
            });
        }
        setShowDataModal(false);
    };

    const handleColumnToggle = (datasetId: string, columnKey: string) => {
        setSelectedColumns(prev => {
            const current = prev[datasetId] || [];
            const exists = current.includes(columnKey);
            let newCols;
            if (exists) {
                newCols = current.filter(c => c !== columnKey);
            } else {
                newCols = [...current, columnKey];
            }
            return { ...prev, [datasetId]: newCols };
        });
    };

    const handleDatasetToggle = (datasetId: string, allKeys: string[], shouldSelect: boolean) => {
        setSelectedColumns(prev => ({
            ...prev,
            [datasetId]: shouldSelect ? allKeys : []
        }));
    };

    const handleAddChart = (metricKey: string, chartType: ChartType, title: string, aggregation?: AggregationType) => {
        if (!activeDashboardId) return;
        const dataset = filteredMergedDataset;
        const categoryCol = dataset.columns.find(c => c.type === 'string' || c.type === 'date') || dataset.columns[0];
        const colSpan = chartType === 'kpi' ? 2 : 4;
        const rowSpan = chartType === 'kpi' ? 1 : 2;
        const defaultChartConfig: ChartConfig = {
            sortBy: 'none',
            sortOrder: 'desc',
            topN: 0,
            groupOther: false,
            otherThreshold: 5,
            labelDensity: 'balanced',
        };

        const newItem: DashboardItem = {
            id: Math.random().toString(36).substr(2, 9),
            datasetId: dataset.id,
            title,
            metricKey,
            categoryKey: categoryCol?.key || '',
            chartType,
            colorTheme: activeThemeId,
            aggregation: chartType === 'kpi' ? aggregation || 'sum' : undefined,
            chartConfig: chartType === 'kpi' ? undefined : defaultChartConfig,
            colSpan,
            rowSpan
        };

        setDashboards(prev => prev.map(d => {
            if (d.id === activeDashboardId) {
                return { ...d, items: [...d.items, newItem] };
            }
            return d;
        }));
    };

    const updateDashboardItems = (items: DashboardItem[]) => {
        setDashboards(prev => prev.map(d => {
            if (d.id === activeDashboardId) {
                return { ...d, items };
            }
            return d;
        }));
    };

    const handleAddDashboard = () => {
        const newDash: Dashboard = {
            id: Math.random().toString(36).substr(2, 9),
            name: `Dashboard ${dashboards.length + 1}`,
            items: []
        };
        setDashboards(prev => [...prev, newDash]);
        setActiveDashboardId(newDash.id);
    };

    const handleRenameDashboard = (id: string, newName: string) => {
        setDashboards(prev => prev.map(d => d.id === id ? { ...d, name: newName } : d));
    };

    const handleDeleteDashboard = (id: string, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        if (dashboards.length <= 1) {
            showToast({
                type: 'error',
                message: 'You must have at least one dashboard.',
            });
            return;
        }

        const remaining = dashboards.filter(d => d.id !== id);
        setDashboards(remaining);
        if (activeDashboardId === id && remaining[0]) {
            setActiveDashboardId(remaining[0].id);
        }
        showToast({
            type: 'success',
            message: 'Dashboard deleted.',
        });
    };

    const handleGlobalThemeChange = (themeId: string) => {
        setActiveThemeId(themeId);
        setDashboards(prev => prev.map(d => {
            if (d.id === activeDashboardId) {
                const resetItems = d.items.map(item => ({ ...item, customColor: undefined }));
                return { ...d, items: resetItems };
            }
            return d;
        }));
    };

    const buildProjectState = (): ProjectState => ({
        version: 2,
        datasets,
        dashboards,
        selectedColumns,
        activeDashboardId,
        activeThemeId,
        activeCategories,
    });

    const importProjectState = (state: ProjectState) => {
        if (!state || !Array.isArray(state.datasets) || !Array.isArray(state.dashboards)) {
            showToast({
                type: 'error',
                message: 'Invalid project file. Please check the JSON format.',
            });
            return;
        }

        setDatasets(state.datasets);
        setDashboards(state.dashboards);
        setSelectedColumns(state.selectedColumns || {});
        setActiveDashboardId(state.activeDashboardId || state.dashboards[0]?.id || '');
        setActiveThemeId(state.activeThemeId || 'corporate');
        setActiveCategories(state.activeCategories || []);

        showToast({
            type: 'success',
            message: `Imported ${state.datasets.length} dataset(s) and ${state.dashboards.length} dashboard(s).`,
        });
    };

    return {
        datasets,
        dashboards,
        selectedColumns,
        activeDashboardId,
        activeThemeId,
        showDataModal,
        activeCategories,
        activeThemeConfig,
        mergedDataset,
        filteredMergedDataset,
        allDatasets,
        setActiveDashboardId,
        setActiveThemeId,
        setShowDataModal,
        setActiveCategories,
        handleDataParsed,
        handleDatasetsLoaded,
        handleColumnToggle,
        handleDatasetToggle,
        handleAddChart,
        updateDashboardItems,
        handleAddDashboard,
        handleRenameDashboard,
        handleDeleteDashboard,
        handleGlobalThemeChange,
        buildProjectState,
        importProjectState,
    };
};
