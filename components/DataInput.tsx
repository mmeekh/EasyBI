import React, { useState, useCallback } from 'react';
import { ArrowRight, FileSpreadsheet, FileText, ChevronLeft } from 'lucide-react';
import { ColumnType, Dataset } from '../types';
import { parseExcelFile, ParsedSheet } from '../utils/excel';
import { parseRawData } from '../utils/parser';
import { buildDatasetFromTable, ColumnDraft, ColumnMapping, ImportReport, inferColumnDrafts, ParsedTable } from '../utils/tabular';
import { useToast } from './ToastProvider';

interface DataInputProps {
  onDataParsed?: (rawText: string, name: string) => void; 
  onDatasetsLoaded?: (datasets: Dataset[], reports?: ImportReport[]) => void;
  isModal?: boolean;
  onCancel?: () => void;
}

interface DatasetDraft {
  id: string;
  name: string;
  table: ParsedTable;
  columns: ColumnDraft[];
  mapping: ColumnMapping[];
}

const SAMPLE_DATASETS = [
  {
    id: 'monthly-finance',
    label: 'Monthly Finance',
    name: 'Monthly Financials',
    text: `Month\tRevenue\tExpenses\tCustomers
Jan\t12500\t8000\t120
Feb\t15000\t8500\t145
Mar\t11000\t7800\t110
Apr\t18000\t9200\t160
May\t22000\t10500\t200
Jun\t25000\t11000\t240
Jul\t23000\t9800\t210
Aug\t19500\t9300\t190
Sep\t20500\t9900\t205
Oct\t24000\t11200\t230
Nov\t26000\t12500\t250
Dec\t31000\t14000\t320`,
  },
  {
    id: 'regional-orders',
    label: 'Regional Orders',
    name: 'Regional Orders',
    text: `Date\tRegion\tOrders\tReturns\tAvgOrderValue
2025-01-05\tNorth\t120\t6\t84.5
2025-01-12\tSouth\t98\t4\t92.0
2025-01-19\tEast\t142\t10\t76.3
2025-01-26\tWest\t110\t7\t88.9
2025-02-02\tNorth\t135\t8\t90.2
2025-02-09\tSouth\t105\t5\t95.1
2025-02-16\tEast\t150\t12\t73.8
2025-02-23\tWest\t118\t6\t86.7`,
  },
  {
    id: 'channel-performance',
    label: 'Channel Performance',
    name: 'Channel Performance',
    text: `Channel\tSpend\tClicks\tConversions\tRevenue
Search\t$4200\t12500\t620\t18500
Social\t$3100\t9800\t410\t12400
Email\t$800\t2600\t210\t6400
Affiliate\t$1900\t4300\t260\t9100
Display\t$1500\t5200\t140\t5600
Referral\t$600\t1800\t95\t3200`,
  },
];

const DataInput: React.FC<DataInputProps> = ({ onDataParsed, onDatasetsLoaded, isModal = false, onCancel }) => {
  const [text, setText] = useState('');
  const [name, setName] = useState('New Dataset');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [drafts, setDrafts] = useState<DatasetDraft[] | null>(null);
  const { showToast } = useToast();

  const createDraft = (datasetName: string, table: ParsedTable): DatasetDraft => {
    const columns = inferColumnDrafts(table);
    const mapping = columns.map((col) => ({
      key: col.key,
      label: col.label,
      type: col.type,
      include: true,
    }));

    return {
      id: Math.random().toString(36).substr(2, 9),
      name: datasetName,
      table,
      columns,
      mapping,
    };
  };

  const handleProcessText = () => {
    if (text.trim()) {
      const table = parseRawData(text);
      if (table.rows.length === 0 || table.headers.length === 0) {
        showToast({
          type: 'error',
          message: 'Could not parse data. Please check the format (headers + rows).',
        });
        return;
      }
      setDrafts([createDraft(name, table)]);
    }
  };

  const handlePasteSample = (sample: typeof SAMPLE_DATASETS[number]) => {
    setText(sample.text);
    setName(sample.name);
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsLoading(true);
    const file = files[0];
    const fileName = file.name.split('.')[0];
    
    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const sheets = await parseExcelFile(file);
        if (sheets.length === 0) {
          showToast({
            type: 'error',
            message: 'No usable sheets found in the Excel file.',
          });
          return;
        }
        const nextDrafts = sheets.map((sheet: ParsedSheet) => createDraft(sheet.name, sheet.table));
        setDrafts(nextDrafts);
      } else {
        // Assume text/csv
        const fileText = await file.text();
        const table = parseRawData(fileText);
        if (table.rows.length === 0 || table.headers.length === 0) {
          showToast({
            type: 'error',
            message: 'Could not parse data. Please check the format (headers + rows).',
          });
          return;
        }
        setDrafts([createDraft(fileName, table)]);
      }
    } catch (e) {
      console.error('Error reading file', e);
      showToast({
        type: 'error',
        message: 'Error reading file. Please check the format.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, []);

  const handleDraftUpdate = (draftId: string, updater: (draft: DatasetDraft) => DatasetDraft) => {
    setDrafts((prev) => {
      if (!prev) return prev;
      return prev.map((draft) => (draft.id === draftId ? updater(draft) : draft));
    });
  };

  const handleImportDrafts = () => {
    if (!drafts || drafts.length === 0) return;
    const datasets: Dataset[] = [];
    const reports: ImportReport[] = [];

    drafts.forEach((draft) => {
      const { dataset, report } = buildDatasetFromTable(draft.name, draft.table, draft.mapping);
      if (dataset.columns.length > 0 && dataset.data.length > 0) {
        datasets.push(dataset);
        reports.push(report);
      }
    });

    if (datasets.length === 0) {
      showToast({
        type: 'error',
        message: 'No usable rows or columns found after mapping.',
      });
      return;
    }

    if (onDatasetsLoaded) {
      onDatasetsLoaded(datasets, reports);
    } else if (onDataParsed && datasets.length === 1) {
      onDataParsed(text, name);
    }

    setDrafts(null);
    setText('');
    setName('New Dataset');
  };

  const renderTypeSelect = (value: ColumnType, onChange: (next: ColumnType) => void) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ColumnType)}
      className="col-span-3 text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
    >
      <option value="string">Text</option>
      <option value="number">Number</option>
      <option value="date">Date</option>
    </select>
  );

  const renderDraftReview = () => {
    if (!drafts) return null;

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-800">Review & Map Columns</h3>
            <p className="text-xs text-gray-500 mt-1">
              Check inferred types, rename columns, and toggle what to import.
            </p>
          </div>
          <button
            onClick={() => setDrafts(null)}
            className="flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            <ChevronLeft size={14} /> Back
          </button>
        </div>

        {drafts.map((draft) => (
          <div key={draft.id} className="border border-gray-200 rounded-xl p-4 bg-white shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <label className="text-xs font-semibold text-gray-500">Dataset</label>
              <input
                value={draft.name}
                onChange={(e) =>
                  handleDraftUpdate(draft.id, (current) => ({
                    ...current,
                    name: e.target.value,
                  }))
                }
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              />
              <span className="text-[11px] text-gray-400">
                {draft.table.report.parsedRowCount} rows
              </span>
            </div>

            <div className="flex flex-wrap gap-2 text-[11px] text-gray-500 mb-3">
              {draft.table.report.skippedRows > 0 && (
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                  {draft.table.report.skippedRows} empty rows skipped
                </span>
              )}
              {draft.table.report.rowLengthMismatches > 0 && (
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                  {draft.table.report.rowLengthMismatches} row length mismatches
                </span>
              )}
              {draft.table.report.emptyHeaderCount > 0 && (
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                  {draft.table.report.emptyHeaderCount} empty headers auto-named
                </span>
              )}
              {draft.table.report.duplicateHeaders.length > 0 && (
                <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
                  {draft.table.report.duplicateHeaders.length} duplicate headers renamed
                </span>
              )}
            </div>

            <div className="grid grid-cols-12 gap-2 text-[11px] text-gray-400 uppercase tracking-wide px-2 mb-2">
              <span className="col-span-1">Use</span>
              <span className="col-span-4">Column</span>
              <span className="col-span-3">Type</span>
              <span className="col-span-4">Sample</span>
            </div>

            <div className="space-y-2">
              {draft.mapping.map((col, index) => {
                const sample = draft.columns[index]?.sampleValues.join(', ') || '-';
                const inferredType = draft.columns[index]?.type;
                const invalidHint =
                  col.type === inferredType
                    ? col.type === 'number'
                      ? draft.columns[index]?.invalidNumberCount
                      : col.type === 'date'
                        ? draft.columns[index]?.invalidDateCount
                        : 0
                    : 0;

                return (
                  <div key={col.key} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="checkbox"
                      checked={col.include}
                      onChange={(e) =>
                        handleDraftUpdate(draft.id, (current) => ({
                          ...current,
                          mapping: current.mapping.map((entry, idx) =>
                            idx === index ? { ...entry, include: e.target.checked } : entry,
                          ),
                        }))
                      }
                      className="col-span-1 h-4 w-4 text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    />
                    <input
                      value={col.label}
                      onChange={(e) =>
                        handleDraftUpdate(draft.id, (current) => ({
                          ...current,
                          mapping: current.mapping.map((entry, idx) =>
                            idx === index ? { ...entry, label: e.target.value } : entry,
                          ),
                        }))
                      }
                      className="col-span-4 text-xs border border-gray-200 rounded px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                    />
                    {renderTypeSelect(col.type, (nextType) =>
                      handleDraftUpdate(draft.id, (current) => ({
                        ...current,
                        mapping: current.mapping.map((entry, idx) =>
                          idx === index ? { ...entry, type: nextType } : entry,
                        ),
                      })),
                    )}
                    <div className="col-span-4 text-xs text-gray-400 truncate" title={sample}>
                      {sample}
                      {invalidHint ? (
                        <span className="ml-2 text-[10px] text-amber-600 font-semibold">
                          {invalidHint} non-{col.type}
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="flex justify-end gap-3">
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              Cancel
            </button>
          )}
          <button
            onClick={handleImportDrafts}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            Import Data <ArrowRight size={20} />
          </button>
        </div>
      </div>
    );
  };

  if (drafts) {
    return (
      <div
        className={`w-full max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow-xl border border-gray-100 ${isModal ? 'h-auto shadow-none border-0 p-0' : ''}`}
      >
        {renderDraftReview()}
      </div>
    );
  }

  return (
    <div className={`w-full max-w-3xl mx-auto p-6 bg-white rounded-2xl shadow-xl border border-gray-100 ${isModal ? 'h-auto shadow-none border-0 p-0' : ''}`}>
      {!isModal && (
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Add Your Data</h2>
          <p className="text-gray-500 mt-2">Paste text or drop an Excel file.</p>
        </div>
      )}

      {/* Drag & Drop Zone */}
      <div 
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={`relative mb-6 border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center p-8 text-center
          ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'}
        `}
      >
        {isLoading ? (
           <div className="animate-pulse flex flex-col items-center">
             <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
             <span className="text-blue-600 font-medium">Processing Data...</span>
           </div>
        ) : (
          <>
             <div className="flex gap-4 mb-3 text-gray-400">
                <FileSpreadsheet size={32} />
                <FileText size={32} />
             </div>
             <p className="text-sm font-medium text-gray-700">
               Drag & Drop Excel (.xlsx) or CSV files here
             </p>
             <p className="text-xs text-gray-400 mt-1">or click to browse</p>
             <input 
               type="file" 
               accept=".csv,.txt,.xlsx,.xls" 
               onChange={(e) => processFiles(e.target.files)}
               className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
             />
          </>
        )}
      </div>

      <div className="flex items-center gap-4 my-4">
        <div className="h-px bg-gray-200 flex-1"></div>
        <span className="text-xs font-semibold text-gray-400 uppercase">OR PASTE TEXT</span>
        <div className="h-px bg-gray-200 flex-1"></div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Dataset Name</label>
        <input 
          type="text" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-2 border border-gray-200 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 outline-none"
          placeholder="e.g. Sales Data Q1"
        />
      </div>

      <div className="relative mb-6">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste columns from Excel/Sheets (Ctrl+V)..."
          className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm resize-none transition-all"
        />
        {text.length === 0 && (
          <div className="absolute bottom-4 right-4 flex flex-col items-end gap-2">
            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
              Sample datasets
            </span>
            <div className="flex flex-col gap-1">
              {SAMPLE_DATASETS.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => handlePasteSample(sample)}
                  className="text-[11px] text-blue-600 hover:text-blue-700 font-medium bg-white px-3 py-1 rounded shadow-sm border border-blue-100 hover:border-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleProcessText}
          disabled={!text.trim()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          {isModal ? 'Review Text' : 'Analyze Text'} <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default DataInput;
