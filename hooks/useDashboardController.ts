import { useState, useMemo, useEffect } from 'react';
import { parseRawData } from '../utils/parser';
import { THEMES } from '../constants';
import { useToast } from '../components/ToastProvider';
import { useMergedDatasets } from './useMergedDatasets';
import { useDashboardPersistence } from './useDashboardPersistence';
import { AggregationType, Dataset, Dashboard, DashboardItem, ChartType } from '../types';

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
        const { data: parsedData, columns: parsedCols, rawRowCount, skippedRows } = parseRawData(rawText);
        if (parsedData.length > 0) {
            addDataset({
                id: Math.random().toString(36).substr(2, 9),
                name: name || `Dataset ${datasets.length + 1}`,
                data: parsedData,
                columns: parsedCols,
            });
            showToast({
                type: 'success',
                message: `Parsed ${parsedData.length} rows and ${parsedCols.length} columns. Skipped ${skippedRows} of ${rawRowCount} data rows.`,
            });
        } else {
            showToast({
                type: 'error',
                message: 'Could not parse data. Please check the format (headers + rows).',
            });
        }
    };

    const handleDatasetsLoaded = (newDatasets: Dataset[]) => {
        newDatasets.forEach((d) => addDataset(d));
        const totalRows = newDatasets.reduce((sum, ds) => sum + ds.data.length, 0);
        const totalCols = newDatasets.reduce((sum, ds) => Math.max(sum, ds.columns.length), 0);
        if (newDatasets.length > 0) {
            showToast({
                type: 'success',
                message: `Imported ${newDatasets.length} sheet(s) with ~${totalRows} rows and up to ${totalCols} columns.`,
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
        const categoryCol = dataset.columns.find(c => c.type === 'string') || dataset.columns[0];
        const colSpan = chartType === 'kpi' ? 2 : 4;
        const rowSpan = chartType === 'kpi' ? 1 : 2;

        const newItem: DashboardItem = {
            id: Math.random().toString(36).substr(2, 9),
            datasetId: dataset.id,
            title,
            metricKey,
            categoryKey: categoryCol?.key || '',
            chartType,
            colorTheme: activeThemeId,
            aggregation: chartType === 'kpi' ? aggregation || 'sum' : undefined,
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
    };
};
