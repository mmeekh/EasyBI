import React, { useState, useCallback } from 'react';
import { ArrowRight, FileSpreadsheet, FileText } from 'lucide-react';
import { Dataset } from '../types';
import { parseExcelFile } from '../utils/excel';
import { useToast } from './ToastProvider';

interface DataInputProps {
  onDataParsed: (rawText: string, name: string) => void; 
  onDatasetsLoaded?: (datasets: Dataset[]) => void;
  isModal?: boolean;
  onCancel?: () => void;
}

const DataInput: React.FC<DataInputProps> = ({ onDataParsed, onDatasetsLoaded, isModal = false, onCancel }) => {
  const [text, setText] = useState('');
  const [name, setName] = useState('New Dataset');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { showToast } = useToast();

  const handleProcessText = () => {
    if (text.trim()) {
      // Legacy support for text
      onDataParsed(text, name);
    }
  };

  const handlePasteSample = () => {
    const sample = `Month\tRevenue\tExpenses\tCustomers
Jan\t12500\t8000\t120
Feb\t15000\t8500\t145
Mar\t11000\t7800\t110
Apr\t18000\t9200\t160
May\t22000\t10500\t200
Jun\t25000\t11000\t240`;
    setText(sample);
    setName("Monthly Financials");
  };

  const processFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    setIsLoading(true);
    const file = files[0];
    const fileName = file.name.split('.')[0];
    
    try {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const newDatasets = await parseExcelFile(file);
        if (onDatasetsLoaded && newDatasets.length > 0) {
          onDatasetsLoaded(newDatasets);
        }
      } else {
        // Assume text/csv
        const text = await file.text();
        onDataParsed(text, fileName);
      }
      showToast({
        type: 'success',
        message: `Imported "${file.name}" successfully.`,
      });
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
           <button 
             onClick={handlePasteSample}
             className="absolute bottom-4 right-4 text-xs text-blue-500 hover:text-blue-700 font-medium bg-white px-3 py-1 rounded shadow-sm border border-blue-100"
           >
             Paste Sample Data
           </button>
        )}
      </div>

      <div className="flex justify-end gap-3">
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-6 py-3 rounded-xl font-medium text-gray-600 hover:bg-gray-100 transition-all"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleProcessText}
          disabled={!text.trim()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-semibold transition-all shadow-lg hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transform hover:-translate-y-0.5"
        >
          {isModal ? 'Import Text' : 'Analyze Text'} <ArrowRight size={20} />
        </button>
      </div>
    </div>
  );
};

export default DataInput;
