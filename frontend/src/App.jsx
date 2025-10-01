import { useCallback, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import Plot from 'react-plotly.js';
import Plotly from 'plotly.js-dist-min';
import { Responsive, WidthProvider } from 'react-grid-layout';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5050';

const aggregationOptions = [
  { value: '', label: 'None' },
  { value: 'sum', label: 'Sum' },
  { value: 'mean', label: 'Average' },
  { value: 'max', label: 'Max' },
  { value: 'min', label: 'Min' },
  { value: 'count', label: 'Count' }
];

const createEmptyLayouts = () => ({
  lg: [],
  md: [],
  sm: [],
  xs: [],
  xxs: []
});

function App() {
  const [isDragging, setIsDragging] = useState(false);
  const [datasetId, setDatasetId] = useState(null);
  const [columns, setColumns] = useState([]);
  const [previewRows, setPreviewRows] = useState([]);
  const [rowCount, setRowCount] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedChartType, setSelectedChartType] = useState('bar');
  const [selectedXAxis, setSelectedXAxis] = useState('');
  const [selectedYAxis, setSelectedYAxis] = useState('');
  const [aggregation, setAggregation] = useState('');
  const [charts, setCharts] = useState([]);
  const [layouts, setLayouts] = useState(() => createEmptyLayouts());
  const [statusMessage, setStatusMessage] = useState('Drop an Excel or CSV file to begin.');
  const [loading, setLoading] = useState(false);

  const dashboardRef = useRef(null);
  const chartRefs = useRef({});

  const numericColumns = useMemo(
    () => columns.filter((column) => column.dtype === 'numeric').map((column) => column.name),
    [columns]
  );

  const allColumnNames = useMemo(() => columns.map((column) => column.name), [columns]);

  const resetDashboard = useCallback(() => {
    setCharts([]);
    setLayouts(createEmptyLayouts());
  }, []);

  const handleFile = useCallback(
    async (file) => {
      if (!file) return;
      setLoading(true);
      setStatusMessage('Uploading file...');
      const formData = new FormData();
      formData.append('file', file);

      try {
        const uploadResponse = await axios.post(`${API_BASE}/upload-excel`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const { datasetId: newDatasetId, columns: uploadedColumns, preview, rowCount: count } =
          uploadResponse.data;

        const uploadedColumnNames = uploadedColumns.map((column) => column.name);
        const uploadedNumericColumns = uploadedColumns
          .filter((column) => column.dtype === 'numeric')
          .map((column) => column.name);

        setDatasetId(newDatasetId);
        setColumns(uploadedColumns);
        setPreviewRows(preview);
        setRowCount(count);
        resetDashboard();
        setStatusMessage('Generating chart suggestions...');

        const suggestResponse = await axios.post(`${API_BASE}/suggest-charts`, {
          columns: uploadedColumns
        });

        setSuggestions(suggestResponse.data.suggestions);
        setSelectedChartType(suggestResponse.data.suggestions[0] || 'bar');
        setSelectedXAxis(uploadedColumnNames[0] || '');
        setSelectedYAxis(uploadedNumericColumns[0] || uploadedColumnNames[0] || '');
        setStatusMessage('Data uploaded successfully. Configure your charts below.');
      } catch (error) {
        console.error(error);
        const message = error?.response?.data?.detail || 'Failed to upload file. Please try again.';
        setStatusMessage(message);
      } finally {
        setLoading(false);
      }
    },
    [resetDashboard]
  );

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      setIsDragging(false);
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0];
        handleFile(file);
        event.dataTransfer.clearData();
      }
    },
    [handleFile]
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((event) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const onFileInputChange = useCallback(
    (event) => {
      const file = event.target.files?.[0];
      handleFile(file);
    },
    [handleFile]
  );

  const addChart = useCallback(async () => {
    if (!datasetId) {
      setStatusMessage('Please upload data before generating charts.');
      return;
    }

    if (!selectedChartType) {
      setStatusMessage('Select a chart type.');
      return;
    }

    if (!selectedYAxis) {
      setStatusMessage('Select a metric column.');
      return;
    }

    if (selectedChartType !== 'kpi' && !selectedXAxis) {
      setStatusMessage('Select a column for the X axis.');
      return;
    }

    try {
      setLoading(true);
      setStatusMessage('Generating chart...');
      const response = await axios.post(`${API_BASE}/generate-chart`, {
        datasetId,
        chartType: selectedChartType,
        xAxis: selectedChartType === 'kpi' ? undefined : selectedXAxis,
        yAxis: selectedYAxis,
        aggregation: aggregation || undefined
      });

      const chartId = `chart-${Date.now()}`;
      const layoutItem = {
        i: chartId,
        x: (charts.length * 2) % 12,
        y: Infinity,
        w: 4,
        h: selectedChartType === 'kpi' ? 2 : 3
      };

      const newChart = {
        id: chartId,
        config: response.data,
        chartType: selectedChartType,
        title: response.data.layout?.title || 'Chart'
      };

      setCharts((prev) => [...prev, newChart]);
      setLayouts((prev) => ({
        lg: [...prev.lg, layoutItem],
        md: [...prev.md, layoutItem],
        sm: [...prev.sm, { ...layoutItem, w: 6 }],
        xs: [...prev.xs, { ...layoutItem, w: 4 }],
        xxs: [...prev.xxs, { ...layoutItem, w: 2 }]
      }));
      setStatusMessage('Chart added to dashboard.');
    } catch (error) {
      console.error(error);
      const message = error?.response?.data?.detail || 'Unable to generate chart.';
      setStatusMessage(message);
    } finally {
      setLoading(false);
    }
  }, [aggregation, charts.length, datasetId, selectedChartType, selectedXAxis, selectedYAxis]);

  const removeChart = useCallback((chartId) => {
    setCharts((prev) => prev.filter((chart) => chart.id !== chartId));
    setLayouts((prev) => ({
      lg: prev.lg.filter((item) => item.i !== chartId),
      md: prev.md.filter((item) => item.i !== chartId),
      sm: prev.sm.filter((item) => item.i !== chartId),
      xs: prev.xs.filter((item) => item.i !== chartId),
      xxs: prev.xxs.filter((item) => item.i !== chartId)
    }));
  }, []);

  const exportChartAsPng = useCallback(async (chartId) => {
    const graphDiv = chartRefs.current[chartId];
    if (!graphDiv) {
      setStatusMessage('Chart not ready for export yet.');
      return;
    }
    try {
      await Plotly.downloadImage(graphDiv, { format: 'png', filename: chartId });
      setStatusMessage('Chart exported as PNG.');
    } catch (error) {
      console.error(error);
      setStatusMessage('Failed to export chart.');
    }
  }, []);

  const exportDashboardAsPdf = useCallback(async () => {
    if (!dashboardRef.current) {
      setStatusMessage('Dashboard is empty.');
      return;
    }
    try {
      const canvas = await html2canvas(dashboardRef.current, {
        backgroundColor: '#ffffff',
        scale: 2
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('l', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const imgWidth = canvas.width * ratio;
      const imgHeight = canvas.height * ratio;
      const marginX = (pageWidth - imgWidth) / 2;
      const marginY = (pageHeight - imgHeight) / 2;
      pdf.addImage(imgData, 'PNG', marginX, marginY, imgWidth, imgHeight);
      pdf.save('easybi-dashboard.pdf');
      setStatusMessage('Dashboard exported as PDF.');
    } catch (error) {
      console.error(error);
      setStatusMessage('Failed to export dashboard.');
    }
  }, []);

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>EasyBI</h1>
        <section>
          <h2>Upload Data</h2>
          <div
            className={`dropzone ${isDragging ? 'dragging' : ''}`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <p>{loading ? 'Processing...' : statusMessage}</p>
            <label className="upload-button">
              <input type="file" accept=".csv,.xlsx" onChange={onFileInputChange} />
              Choose File
            </label>
          </div>
        </section>

        <section>
          <h2>Charts</h2>
          <div className="form-group">
            <label htmlFor="chartType">Chart Type</label>
            <select
              id="chartType"
              value={selectedChartType}
              onChange={(event) => setSelectedChartType(event.target.value)}
            >
              {['bar', 'line', 'pie', 'kpi'].map((type) => (
                <option key={type} value={type}>
                  {type.toUpperCase()}
                </option>
              ))}
            </select>
            {suggestions.length > 0 && (
              <p className="suggestions">Suggested: {suggestions.join(', ')}</p>
            )}
          </div>

          {selectedChartType !== 'kpi' && (
            <div className="form-group">
              <label htmlFor="xAxis">X Axis</label>
              <select id="xAxis" value={selectedXAxis} onChange={(event) => setSelectedXAxis(event.target.value)}>
                <option value="">Select column</option>
                {allColumnNames.map((column) => (
                  <option key={column} value={column}>
                    {column}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="yAxis">{selectedChartType === 'kpi' ? 'Metric' : 'Y Axis'}</label>
            <select id="yAxis" value={selectedYAxis} onChange={(event) => setSelectedYAxis(event.target.value)}>
              <option value="">Select column</option>
              {numericColumns.map((column) => (
                <option key={column} value={column}>
                  {column}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="aggregation">Aggregation</label>
            <select
              id="aggregation"
              value={aggregation}
              onChange={(event) => setAggregation(event.target.value)}
            >
              {aggregationOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button className="primary" onClick={addChart} disabled={loading || !datasetId}>
            Add Chart
          </button>
        </section>

        <section>
          <h2>Export</h2>
          <button onClick={exportDashboardAsPdf} disabled={charts.length === 0}>
            Export Dashboard as PDF
          </button>
        </section>
      </aside>

      <main className="content">
        <section className="data-preview">
          <h2>Data Preview</h2>
          {previewRows.length > 0 ? (
            <>
              <p>
                Showing first {previewRows.length} of {rowCount} rows.
              </p>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      {columns.map((column) => (
                        <th key={column.name}>
                          {column.name}
                          <span className="dtype">{column.dtype}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        {columns.map((column) => (
                          <td key={column.name}>{row[column.name] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="empty">Upload a dataset to see the preview.</p>
          )}
        </section>

        <section className="dashboard" ref={dashboardRef}>
          <h2>Dashboard</h2>
          {charts.length === 0 ? (
            <p className="empty">No charts added yet. Use the sidebar to create your first chart.</p>
          ) : (
            <ResponsiveGridLayout
              className="layout"
              layouts={layouts}
              rowHeight={120}
              cols={{ lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 }}
              onLayoutChange={(currentLayout, allLayouts) => setLayouts(allLayouts)}
              draggableHandle=".panel-header"
            >
              {charts.map((chart) => (
                <div key={chart.id} className="chart-panel">
                  <div className="panel-header">
                    <h3>{chart.title}</h3>
                    <div className="panel-actions">
                      <button onClick={() => exportChartAsPng(chart.id)}>PNG</button>
                      <button onClick={() => removeChart(chart.id)}>Remove</button>
                    </div>
                  </div>
                  <Plot
                    data={chart.config.data}
                    layout={{
                      ...chart.config.layout,
                      autosize: true,
                      margin: { l: 40, r: 20, t: 60, b: 40 },
                      paper_bgcolor: '#f9fafb',
                      plot_bgcolor: '#ffffff'
                    }}
                    useResizeHandler
                    style={{ width: '100%', height: '100%' }}
                    onInitialized={(figure, graphDiv) => {
                      chartRefs.current[chart.id] = graphDiv;
                    }}
                    onUpdate={(figure, graphDiv) => {
                      chartRefs.current[chart.id] = graphDiv;
                    }}
                    config={{ displayModeBar: true, responsive: true }}
                  />
                </div>
              ))}
            </ResponsiveGridLayout>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
