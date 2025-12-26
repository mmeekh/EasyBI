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
    id: 'global-sales',
    label: 'Global Sales',
    name: 'Global Sales Pulse',
    text: `Date\tCountry\tCity\tSegment\tOrders\tRevenue\tProfit\tReturns
2025-01-05\tUnited States\tNew York\tRetail\t120\t18500\t4200\t5
2025-01-12\tUnited States\tLos Angeles\tOnline\t98\t14200\t3100\t3
2025-01-19\tUnited Kingdom\tLondon\tRetail\t142\t21400\t5200\t6
2025-01-26\tGermany\tBerlin\tWholesale\t110\t17600\t3900\t4
2025-02-02\tFrance\tParis\tRetail\t135\t19800\t4600\t5
2025-02-09\tTurkey\tIstanbul\tOnline\t105\t16200\t3500\t2
2025-02-16\tSpain\tMadrid\tRetail\t150\t23200\t5400\t7
2025-02-23\tItaly\tRome\tWholesale\t118\t15400\t2900\t4
2025-03-02\tCanada\tToronto\tRetail\t128\t17100\t4100\t3
2025-03-09\tUnited Arab Emirates\tDubai\tOnline\t96\t14900\t3300\t2`,
  },
  {
    id: 'marketing-geo',
    label: 'Marketing Geo',
    name: 'Marketing Geo Performance',
    text: `Week\tCountry\tCity\tChannel\tSpend\tClicks\tConversions\tROAS
2025-W01\tUnited States\tSan Francisco\tSearch\t5200\t14800\t720\t4.2
2025-W02\tUnited States\tChicago\tSocial\t3100\t9200\t380\t3.1
2025-W03\tUnited Kingdom\tLondon\tEmail\t900\t2600\t180\t5.4
2025-W04\tGermany\tBerlin\tAffiliate\t2100\t4100\t240\t3.8
2025-W05\tIndia\tMumbai\tSearch\t2800\t8600\t410\t4.0
2025-W06\tIndia\tDelhi\tSocial\t2400\t7200\t330\t3.6
2025-W07\tJapan\tTokyo\tDisplay\t1900\t5200\t190\t2.9
2025-W08\tAustralia\tSydney\tSearch\t2300\t6100\t260\t3.5
2025-W09\tBrazil\tSao Paulo\tSocial\t1700\t4800\t210\t3.0
2025-W10\tSouth Africa\tCape Town\tEmail\t750\t2100\t140\t4.8`,
  },
  {
    id: 'ops-inventory',
    label: 'Ops & Inventory',
    name: 'Operations & Inventory',
    text: `Month\tWarehouseCity\tSupplierCountry\tCategory\tUnitsIn\tUnitsOut\tDefectRate\tShippingCost
Jan\tIstanbul\tChina\tElectronics\t5200\t4800\t1.8\t8400
Feb\tAnkara\tGermany\tHome\t4100\t3900\t1.2\t6200
Mar\tIzmir\tUnited States\tApparel\t4600\t4300\t2.1\t7100
Apr\tBerlin\tItaly\tElectronics\t5400\t5000\t1.5\t8600
May\tParis\tSpain\tHome\t4300\t4100\t1.1\t6400
Jun\tLondon\tNetherlands\tBeauty\t3900\t3700\t1.4\t5900
Jul\tRome\tTurkey\tApparel\t4700\t4500\t1.9\t7200
Aug\tMadrid\tFrance\tElectronics\t5100\t4700\t1.6\t7900
Sep\tToronto\tCanada\tHome\t4200\t4000\t1.3\t6100
Oct\tDubai\tUnited Arab Emirates\tBeauty\t3800\t3600\t1.7\t5600`,
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
