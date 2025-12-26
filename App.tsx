import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, RefreshCw, X, LayoutTemplate, Plus, ChevronDown, ChevronLeft, ChevronRight, Database } from 'lucide-react';

import DataInput from './components/DataInput';
import SuggestionPanel from './components/SuggestionPanel';
import DashboardGrid from './components/DashboardGrid';
import { RotatingCoin } from './components/RotatingCoin';
import { useToast } from './components/ToastProvider';
import { useDashboardController } from './hooks/useDashboardController';
import { THEMES } from './constants';
import { getContrastRatio } from './utils/color';

const App: React.FC = () => {
  const {
    datasets,
    dashboards,
    selectedColumns,
    activeDashboardId,
    activeThemeId,
    showDataModal,
    activeCategories,
    activeThemeConfig,
    mergedDataset,
    allDatasets,
    setActiveDashboardId,
    setShowDataModal,
    setActiveCategories,
    handleDatasetsLoaded,
    handleColumnToggle,
    handleDatasetToggle,
    handleAddChart,
    updateDashboardItems,
    handleAddDashboard,
    handleRenameDashboard,
    handleDeleteDashboard,
    handleGlobalThemeChange,
    applyDashboardLayout,
    buildProjectState,
    importProjectState,
  } = useDashboardController();

  const [isThemeOpen, setIsThemeOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const dashboardRef = useRef<HTMLDivElement>(null);
  const projectImportInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const activeDashboard = dashboards.find((d) => d.id === activeDashboardId);

  type ExportFormat = 'png' | 'jpeg' | 'jpg' | 'pdf';

  const handleExport = async (format: ExportFormat) => {
    if (!dashboardRef.current || isExporting) return;
    setIsExporting(true);
    setIsExportMenuOpen(false);

    try {
      await new Promise((resolve) => setTimeout(resolve, 80));

      const element = dashboardRef.current;
      const exportScale = Math.min(2, window.devicePixelRatio || 1);

      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const canvas = await html2canvas(element, {
        scale: exportScale,
        backgroundColor: activeThemeConfig.background || '#fff',
        logging: false,
        useCORS: true,
      });

      const baseName = `SimpleDash-${new Date().toISOString().slice(0, 10)}`;

      if (format === 'pdf') {
        const jsPDFModule = await import('jspdf');
        const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF;
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const pdf = new jsPDF('landscape', 'pt', 'a4');
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
        const imgWidth = canvas.width * ratio;
        const imgHeight = canvas.height * ratio;
        const x = (pageWidth - imgWidth) / 2;
        const y = (pageHeight - imgHeight) / 2;

        pdf.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);
        pdf.save(`${baseName}.pdf`);
      } else {
        const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
        const quality = format === 'png' ? undefined : 0.95;
        const dataUrl =
          format === 'png'
            ? canvas.toDataURL(mimeType)
            : canvas.toDataURL(mimeType, quality as number);

        const link = document.createElement('a');
        link.download = `${baseName}.${format}`;
        link.href = dataUrl;
        link.click();
      }

      showToast({
        type: 'success',
        message:
          format === 'pdf'
            ? 'Dashboard exported as PDF.'
            : `Dashboard exported as ${format.toUpperCase()}.`,
      });
    } catch (err) {
      console.error(err);
      showToast({
        type: 'error',
        message: 'Export failed. Please try again.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportProject = () => {
    const projectState = buildProjectState();
    const baseName = `SimpleDash-Project-${new Date().toISOString().slice(0, 10)}`;
    const blob = new Blob([JSON.stringify(projectState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${baseName}.json`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setIsExportMenuOpen(false);
    showToast({
      type: 'success',
      message: 'Project exported as JSON.',
    });
  };

  const handleImportProject = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      importProjectState(parsed);
    } catch (err) {
      console.error(err);
      showToast({
        type: 'error',
        message: 'Failed to import project JSON.',
      });
    } finally {
      if (projectImportInputRef.current) {
        projectImportInputRef.current.value = '';
      }
    }
  };

  // Empty State / Welcome
  if (datasets.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="min-h-screen flex flex-col bg-gray-50 text-slate-800 font-sans"
      >
        <header className="bg-white border-b border-gray-200 px-8 h-16 flex items-center gap-3">
          <div className="p-1">
            <RotatingCoin size={40} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-gray-900">SimpleDash</h1>
        </header>
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-gray-50 to-gray-100">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-8"
          >
            <img
              src="qq.png"
              alt="SimpleDash Logo"
              className="w-20 h-20 object-contain drop-shadow-md"
            />
          </motion.div>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <DataInput onDatasetsLoaded={handleDatasetsLoaded} />
          </motion.div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-slate-800 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <RotatingCoin size={32} />
              <h1 className="text-xl font-bold tracking-tight text-gray-900 hidden sm:block">SimpleDash</h1>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto max-w-xl no-scrollbar">
              <AnimatePresence mode='popLayout'>
                {dashboards.map((dash) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    key={dash.id}
                    onClick={() => setActiveDashboardId(dash.id)}
                    className={`group flex items-center gap-2 px-4 py-2 rounded-t-lg border-b-2 cursor-pointer transition-all whitespace-nowrap text-sm font-medium ${activeDashboardId === dash.id
                        ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    <LayoutTemplate size={14} />
                    {dash.name}
                    {dashboards.length > 1 && (
                      <button
                        onClick={(e) => handleDeleteDashboard(dash.id, e)}
                        className="opacity-0 group-hover:opacity-100 hover:text-red-500 p-0.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <button
                onClick={handleAddDashboard}
                className="p-2 text-gray-400 hover:text-blue-600 rounded-full hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 relative">
            <button
              onClick={() => setIsThemeOpen(!isThemeOpen)}
              className="w-8 h-8 rounded-full shadow-md hover:shadow-lg transition-transform hover:scale-105 active:scale-95 border-2 border-white ring-1 ring-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              style={{
                background:
                  'linear-gradient(135deg, #f472b6, #ef4444, #eab308, #22c55e, #3b82f6, #a855f7)',
              }}
              title="Global Theme"
            />

            <AnimatePresence>
              {isThemeOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsThemeOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-12 right-10 bg-white p-4 rounded-xl shadow-xl border border-gray-100 z-50 w-64"
                  >
                    <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">
                      Global Theme
                    </h3>
                    <div className="grid grid-cols-1 gap-2">
                      {THEMES.map((theme) => {
                        const contrast = getContrastRatio(theme.background, '#0f172a');
                        const contrastLabel = contrast >= 4.5 ? 'AA' : 'Low';

                        return (
                          <button
                            key={theme.id}
                            onClick={() => {
                              handleGlobalThemeChange(theme.id);
                              setIsThemeOpen(false);
                            }}
                            className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors w-full ${activeThemeId === theme.id ? 'bg-blue-50/50 ring-1 ring-blue-100' : ''
                              }`}
                          >
                            <div
                              className="w-8 h-8 rounded-full shadow-sm"
                              style={{
                                background: `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})`,
                              }}
                            />
                            <span className="text-sm font-medium text-gray-700">{theme.name}</span>
                            <span
                              className={`ml-auto text-[10px] font-semibold px-1.5 py-0.5 rounded ${contrastLabel === 'AA'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-amber-50 text-amber-700'
                                }`}
                              title={`Contrast ratio ${contrast.toFixed(2)}:1`}
                            >
                              {contrastLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                </>
              )}
            </AnimatePresence>

            <div className="h-6 w-px bg-gray-200 mx-1"></div>

            <div className="relative">
              <button
                onClick={() => !isExporting && setIsExportMenuOpen((prev) => !prev)}
                disabled={isExporting}
                className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-md disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {isExporting ? <RefreshCw className="animate-spin" size={16} /> : <Download size={16} />}
                <span className="hidden sm:inline">Export</span>
                <ChevronDown size={14} className="hidden sm:inline" />
              </button>

              <AnimatePresence>
                {isExportMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-200 z-40"
                  >
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                        Export format
                      </p>
                    </div>
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      onClick={() => handleExport('png')}
                    >
                      PNG (High quality)
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      onClick={() => handleExport('jpeg')}
                    >
                      JPEG
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      onClick={() => handleExport('pdf')}
                    >
                      PDF
                    </button>
                    <div className="px-3 py-2 border-t border-gray-100">
                      <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                        Project
                      </p>
                    </div>
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      onClick={handleExportProject}
                    >
                      Project JSON
                    </button>
                    <button
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                      onClick={() => {
                        setIsExportMenuOpen(false);
                        projectImportInputRef.current?.click();
                      }}
                    >
                      Import JSON
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <input
                ref={projectImportInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleImportProject}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-64px)]">
        <motion.div
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className={`bg-white border-r border-gray-200 flex flex-col z-20 shadow-md transition-all duration-300 ${isSidebarCollapsed ? 'w-20' : 'w-80'}`}
        >
          <div className={`p-4 border-b border-gray-100 bg-gray-50/50 ${isSidebarCollapsed ? 'flex flex-col items-center gap-3' : ''}`}>
            <div className={`w-full flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
              {!isSidebarCollapsed && (
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                  Workspace
                </h2>
              )}
              <button
                onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
              </button>
            </div>
            {!isSidebarCollapsed && (
              <div className="flex items-center justify-between text-sm text-gray-600 mt-2">
                <span>
                  {datasets.length} Source{datasets.length !== 1 ? 's' : ''}
                </span>
                <span>
                  {dashboards.length} Dashboard{dashboards.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>
          {isSidebarCollapsed ? (
            <div className="flex-1 flex flex-col items-center gap-4 py-4">
              <div className="flex flex-col items-center gap-2 text-xs text-gray-500">
                <Database size={18} className="text-blue-500" />
                <span>{datasets.length}</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-xs text-gray-500">
                <LayoutTemplate size={18} className="text-purple-500" />
                <span>{dashboards.length}</span>
              </div>
              <button
                onClick={() => setShowDataModal(true)}
                className="mt-auto mb-2 flex items-center justify-center w-10 h-10 rounded-full border border-dashed border-gray-300 text-gray-400 hover:text-blue-600 hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                title="Add data"
              >
                <Plus size={18} />
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <SuggestionPanel
                datasets={datasets}
                mergedDataset={mergedDataset}
                selectedColumns={selectedColumns}
                onColumnToggle={handleColumnToggle}
                onDatasetToggle={handleDatasetToggle}
                onAddChart={handleAddChart}
                activeThemeId={activeThemeId}
                onAddNewData={() => setShowDataModal(true)}
                activeCategories={activeCategories}
                onCategoryFilterChange={setActiveCategories}
                onApplyLayout={applyDashboardLayout}
              />
            </div>
          )}
        </motion.div>

        <div
          className="flex-1 overflow-y-auto relative custom-scrollbar"
          style={{ backgroundColor: activeThemeConfig.background }}
        >
          <div className="max-w-7xl mx-auto min-h-full">
            {activeDashboard && (
              <motion.div
                key={activeDashboard.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="px-8 pt-8">
                  <input
                    value={activeDashboard.name}
                    onChange={(e) => handleRenameDashboard(activeDashboard.id, e.target.value)}
                    className="text-3xl font-bold text-gray-800 bg-transparent border-none focus:ring-0 focus:outline-none placeholder-gray-300 w-full"
                    placeholder="Dashboard Name"
                  />
                  <p className="text-gray-500 mt-1">
                    Drag and drop to rearrange. Double click titles to rename.
                  </p>
                </div>
                <DashboardGrid
                  items={activeDashboard.items}
                  datasets={allDatasets}
                  themeId={activeThemeId}
                  onItemsChange={updateDashboardItems}
                  dashboardRef={dashboardRef}
                />
              </motion.div>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showDataModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-800">Import New Dataset</h2>
                <button
                  onClick={() => setShowDataModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X size={24} />
                </button>
              </div>
              <div className="p-6">
                <DataInput
                  onDatasetsLoaded={handleDatasetsLoaded}
                  isModal={true}
                  onCancel={() => setShowDataModal(false)}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
