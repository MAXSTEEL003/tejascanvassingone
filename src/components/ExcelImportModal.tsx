import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  AlertTriangle, 
  CheckCircle2, 
  ArrowRight, 
  ChevronRight, 
  RefreshCw, 
  Loader2, 
  Database,
  Layers,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  TARGET_COLUMNS, 
  detectColumnMapping, 
  validateImportDataset, 
  executeChunkedBatchImport,
  parseDate,
  formatDateToDisplayLong,
  DetectedColumn, 
  ImportValidationSummary,
  ImportProgress
} from '../utils/excelImportEngine';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSheetId: string;
  currentSheetName: string;
  onImportComplete: (importedRows: any[], mode: 'overwrite' | 'append', targetSheetName?: string) => void;
}

export default function ExcelImportModal({
  isOpen,
  onClose,
  currentSheetId,
  currentSheetName,
  onImportComplete
}: ExcelImportModalProps) {
  const [step, setStep] = useState<'upload' | 'sheets' | 'mapping' | 'preview' | 'importing' | 'completed'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawMatrix, setRawMatrix] = useState<any[][]>([]);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [detectedColumns, setDetectedColumns] = useState<DetectedColumn[]>([]);
  const [validationSummary, setValidationSummary] = useState<ImportValidationSummary | null>(null);
  const [importMode, setImportMode] = useState<'overwrite' | 'append'>('append');
  
  // Progress tracking
  const [progress, setProgress] = useState<ImportProgress>({
    total: 0,
    processed: 0,
    successful: 0,
    rejected: 0,
    currentBatch: 0,
    totalBatches: 0,
    percent: 0,
    status: 'idle',
    errors: []
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const buffer = evt.target?.result as ArrayBuffer;
        const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);

        if (wb.SheetNames.length === 1) {
          processSheet(wb, wb.SheetNames[0]);
        } else {
          setSelectedSheet(wb.SheetNames[0]);
          setStep('sheets');
        }
      } catch (err) {
        alert('Failed to parse Excel workbook. Please ensure the file is not corrupted.');
      }
    };
    reader.readAsArrayBuffer(selected);
  };

  const processSheet = (wb: XLSX.WorkBook, sheetName: string) => {
    setSelectedSheet(sheetName);
    const ws = wb.Sheets[sheetName];
    // Read as 2D array to preserve position-based duplicate columns (e.g. AREA col B vs AREA col D)
    const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];

    if (!rawData || rawData.length === 0) {
      alert(`Sheet "${sheetName}" is empty.`);
      return;
    }

    // Robust Header detection: inspect first 15 rows to find the row with the most ledger header keywords
    const headerRegex = /^(date|dt|party|buyer|shop|cust|miller|suppl|mill|bill|inv|qty|qtl|bags|weight|rate|price|amt|amount|net|area|place|brand|status|days|rec|bank|chq|po|order|lh|cc|tds|commission|broker|truck)/i;
    
    let bestHeaderIdx = 0;
    let maxKeywordMatches = 0;
    const scanLimit = Math.min(15, rawData.length);

    for (let r = 0; r < scanLimit; r++) {
      const row = rawData[r] || [];
      let matches = 0;
      row.forEach(cell => {
        const text = String(cell || '').trim();
        if (text && headerRegex.test(text)) {
          matches++;
        }
      });
      if (matches > maxKeywordMatches) {
        maxKeywordMatches = matches;
        bestHeaderIdx = r;
      }
    }

    // Fall back to first row with at least 2 non-empty cells if no strong keyword matches found
    let headerIdx = bestHeaderIdx;
    if (maxKeywordMatches < 2) {
      let firstRowWithData = 0;
      while (firstRowWithData < rawData.length) {
        const nonEmptyCount = (rawData[firstRowWithData] || []).filter(v => v !== '' && v !== undefined && String(v).trim() !== '').length;
        if (nonEmptyCount >= 2) {
          headerIdx = firstRowWithData;
          break;
        }
        firstRowWithData++;
      }
    }

    const headers = (rawData[headerIdx] || []).map(v => String(v || '').trim());
    // Data rows are all rows after headerIdx that contain at least one non-empty cell
    const dataRows = rawData.slice(headerIdx + 1).filter(r => 
      Array.isArray(r) && r.some(v => v !== '' && v !== undefined && String(v).trim() !== '')
    );

    setRawHeaders(headers);
    setRawMatrix(dataRows);

    const sample = dataRows.slice(0, 10);
    const detected = detectColumnMapping(headers, sample);
    setDetectedColumns(detected);

    const summary = validateImportDataset(dataRows, detected);
    setValidationSummary(summary);

    setStep('mapping');
  };

  const handleUpdateMapping = (colIndex: number, fieldId: string | null) => {
    const updated = detectedColumns.map(c => {
      if (c.index === colIndex) {
        let newType = c.detectedType;
        if (fieldId === 'date' || fieldId === 'chqDt') {
          newType = 'Date';
        } else if (fieldId) {
          const colDef = TARGET_COLUMNS.find(t => t.id === fieldId);
          if (colDef?.type === 'number') newType = 'Number';
          else if (colDef?.type === 'select') newType = 'Select';
          else if (colDef?.type === 'calc') newType = 'Calc';
          else newType = 'Text';
        }
        return {
          ...c,
          mappedFieldId: fieldId,
          detectedType: newType,
          ignored: fieldId === null,
          warning: undefined
        };
      }
      return c;
    });
    setDetectedColumns(updated);
    if (rawMatrix.length > 0) {
      setValidationSummary(validateImportDataset(rawMatrix, updated));
    }
  };

  const handleToggleIgnore = (colIndex: number) => {
    const updated = detectedColumns.map(c => {
      if (c.index === colIndex) {
        return {
          ...c,
          ignored: !c.ignored
        };
      }
      return c;
    });
    setDetectedColumns(updated);
    if (rawMatrix.length > 0) {
      setValidationSummary(validateImportDataset(rawMatrix, updated));
    }
  };

  const handleStartImport = async () => {
    setStep('importing');
    setProgress({
      total: rawMatrix.length,
      processed: 0,
      successful: 0,
      rejected: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(rawMatrix.length / 150),
      percent: 0,
      status: 'importing',
      errors: []
    });

    try {
      const targetName = selectedSheet || currentSheetName;
      const result = await executeChunkedBatchImport(
        currentSheetId,
        targetName,
        rawMatrix,
        detectedColumns,
        (p) => setProgress(p)
      );

      // Pass the fully normalized, payment-derived, and oldest-to-newest sorted records directly to onImportComplete
      onImportComplete(result.structuredEntries, importMode, targetName);
      setStep('completed');
    } catch (err: any) {
      setProgress(prev => ({
        ...prev,
        status: 'error',
        errorMessage: err?.message || 'Import failed unexpectedly.'
      }));
    }
  };

  const hasWarnings = detectedColumns.some(c => c.warning && !c.ignored);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface border border-outline-variant rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-on-surface">Excel & CSV Import Wizard</h2>
              <p className="text-xs text-secondary font-medium">
                {step === 'upload' && 'Select an Excel (.xlsx, .xls) or CSV ledger file to import'}
                {step === 'sheets' && 'Select the target sheet from your multi-sheet workbook'}
                {step === 'mapping' && 'Review column mappings & position-based disambiguation'}
                {step === 'preview' && 'Review validation summary before committing to Firestore'}
                {step === 'importing' && 'Writing batched records with concurrency control'}
                {step === 'completed' && 'Import completed successfully'}
              </p>
            </div>
          </div>

          {step !== 'importing' && (
            <button 
              onClick={onClose}
              className="p-2 rounded-xl text-secondary hover:text-on-surface hover:bg-surface-container transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-outline-variant">
          
          {/* STEP 1: Upload */}
          {step === 'upload' && (
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant hover:border-primary/50 rounded-2xl p-12 text-center transition-all bg-surface-container-lowest">
              <Upload className="w-12 h-12 text-secondary mb-4 opacity-50" />
              <h3 className="text-sm font-black text-on-surface mb-1">Upload Ledger Spreadsheet</h3>
              <p className="text-xs text-secondary mb-6 max-w-md">
                Supports Excel (.xlsx, .xls) and CSV files. Automatic position-based mapping distinguishes duplicate column names like Miller Area vs Buyer Area.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-primary-hover shadow-lg shadow-primary/20 transition-all cursor-pointer"
              >
                Browse Files
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileSelected}
                className="hidden"
              />
            </div>
          )}

          {/* STEP 2: Sheet Selection (if multi-sheet) */}
          {step === 'sheets' && (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-on-surface flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" /> Select Sheet to Import
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {sheetNames.map(name => {
                  let rowEstimate = 0;
                  try {
                    const ws = workbook?.Sheets[name];
                    if (ws) {
                      const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
                      rowEstimate = raw.filter(r => Array.isArray(r) && r.some(v => v !== '' && v !== undefined && String(v).trim() !== '')).length;
                      if (rowEstimate > 0) rowEstimate = Math.max(1, rowEstimate - 1); // exclude header
                    }
                  } catch {}

                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        if (workbook) processSheet(workbook, name);
                      }}
                      className="p-4 rounded-xl border border-outline-variant hover:border-primary bg-surface-container hover:bg-primary/5 text-left transition-all group"
                    >
                      <span className="text-xs font-black text-on-surface group-hover:text-primary block truncate">
                        {name}
                      </span>
                      <span className="text-[10px] text-secondary font-medium block mt-1">
                        {rowEstimate > 0 ? `~${rowEstimate} data rows • Click to import` : 'Click to import this sheet'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: Column Mapping & Disambiguation */}
          {step === 'mapping' && (
            <div className="space-y-6">
              {hasWarnings && (
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-xs text-on-surface">
                    <p className="font-bold text-amber-700 dark:text-amber-400">Column Mapping Notice</p>
                    <p className="text-secondary mt-0.5">
                      Some columns could not be automatically identified or have duplicate titles. Review the mapped fields below or click "Ignore" to skip unneeded columns.
                    </p>
                  </div>
                </div>
              )}

              <div className="border border-outline-variant rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-surface-container-high border-b border-outline-variant">
                    <tr>
                      <th className="py-2.5 px-3 font-black text-secondary uppercase text-[10px] w-12 text-center">Col</th>
                      <th className="py-2.5 px-3 font-black text-secondary uppercase text-[10px]">Excel Header</th>
                      <th className="py-2.5 px-3 font-black text-secondary uppercase text-[10px] w-28 text-center">Detected Type</th>
                      <th className="py-2.5 px-3 font-black text-secondary uppercase text-[10px]">Sample Values</th>
                      <th className="py-2.5 px-3 font-black text-secondary uppercase text-[10px]">Mapped Ledger Field</th>
                      <th className="py-2.5 px-3 font-black text-secondary uppercase text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {detectedColumns.map(col => {
                      const isArea = col.rawHeader.toUpperCase().includes('AREA') || col.rawHeader.toUpperCase().includes('PLACE');
                      return (
                        <tr 
                          key={col.index} 
                          className={col.ignored ? "bg-surface-container-lowest opacity-50" : "hover:bg-surface-container-low"}
                        >
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-secondary">
                            {String.fromCharCode(65 + col.index)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-bold text-on-surface block">{col.rawHeader}</span>
                            {isArea && (
                              <span className="text-[9px] font-black uppercase text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                Position {col.index + 1} ({col.mappedFieldId === 'place' ? 'Miller Origin' : 'Buyer Area'})
                              </span>
                            )}
                            {col.warning && !col.ignored && (
                              <span className="text-[10px] text-amber-600 block mt-0.5">
                                ⚠️ {col.warning}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {col.detectedType === 'Date' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                Date
                              </span>
                            ) : col.detectedType === 'Number' ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                Number
                              </span>
                            ) : col.detectedType === 'Select' ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30">
                                Select
                              </span>
                            ) : col.detectedType === 'Calc' ? (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                Formula
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-secondary/10 text-secondary border border-outline-variant/30">
                                Text
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-secondary font-mono text-[11px] truncate max-w-[260px]">
                            {col.detectedType === 'Date'
                              ? (col.sampleValues.map(v => `${v} → ${formatDateToDisplayLong(v)}`).join(', ') || '(empty)')
                              : (col.sampleValues.join(', ') || '(empty)')}
                          </td>
                          <td className="py-2.5 px-3">
                            <select
                              value={col.ignored ? 'ignore' : (col.mappedFieldId || 'ignore')}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'ignore') {
                                  handleUpdateMapping(col.index, null);
                                } else {
                                  handleUpdateMapping(col.index, val);
                                }
                              }}
                              disabled={col.ignored}
                              className="w-full bg-surface border border-outline-variant rounded-lg px-2.5 py-1.5 text-xs font-bold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
                            >
                              <option value="ignore">-- Ignore this column --</option>
                              {TARGET_COLUMNS.map(tc => (
                                <option key={tc.id} value={tc.id}>
                                  {tc.label} ({tc.group})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleToggleIgnore(col.index)}
                              className="text-[10px] font-black uppercase text-secondary hover:text-on-surface underline cursor-pointer"
                            >
                              {col.ignored ? 'Restore' : 'Ignore'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: Validation Summary & Mode Confirmation */}
          {step === 'preview' && validationSummary && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border border-outline-variant bg-surface-container">
                  <span className="text-[10px] font-black uppercase text-secondary tracking-widest block">Total Rows Detected</span>
                  <span className="text-2xl font-black text-on-surface mt-1 block">{validationSummary.totalRows.toLocaleString()}</span>
                </div>
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-widest block">Valid Records</span>
                  <span className="text-2xl font-black text-emerald-600 mt-1 block">{validationSummary.validRows.toLocaleString()}</span>
                </div>
                <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                  <span className="text-[10px] font-black uppercase text-amber-600 tracking-widest block">Partial / Incomplete</span>
                  <span className="text-2xl font-black text-amber-600 mt-1 block">{validationSummary.warningRows.toLocaleString()}</span>
                </div>
              </div>

              {/* Import Mode Selection */}
              <div className="p-4 rounded-xl border border-outline-variant bg-surface-container-low space-y-3">
                <span className="text-xs font-black uppercase text-secondary tracking-widest block">Import Destination Behavior</span>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-on-surface">
                    <input
                      type="radio"
                      name="importMode"
                      value="append"
                      checked={importMode === 'append'}
                      onChange={() => setImportMode('append')}
                      className="text-primary focus:ring-primary"
                    />
                    Append to sheet ({selectedSheet || currentSheetName})
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-on-surface">
                    <input
                      type="radio"
                      name="importMode"
                      value="overwrite"
                      checked={importMode === 'overwrite'}
                      onChange={() => setImportMode('overwrite')}
                      className="text-primary focus:ring-primary"
                    />
                    Overwrite sheet ({selectedSheet || currentSheetName})
                  </label>
                </div>
              </div>

              {/* Sample Data Table */}
              <div>
                <span className="text-xs font-black uppercase text-secondary tracking-widest block mb-2">First 5 Sample Records Preview</span>
                <div className="border border-outline-variant rounded-xl overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-surface-container-high border-b border-outline-variant">
                      <tr>
                        {detectedColumns.filter(c => c.mappedFieldId && !c.ignored).map(c => (
                          <th key={c.index} className="py-2 px-3 font-bold text-secondary uppercase text-[9px] whitespace-nowrap">
                            {c.mappedFieldId}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {validationSummary.sampleRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface-container-low">
                          {detectedColumns.filter(c => c.mappedFieldId && !c.ignored).map(c => (
                            <td key={c.index} className="py-2 px-3 text-secondary font-mono text-[10px] whitespace-nowrap">
                              {String(row[c.mappedFieldId!] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Progress Bar & Execution */}
          {step === 'importing' && (
            <div className="space-y-6 py-8 text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mx-auto animate-pulse">
                <Database className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-base font-black text-on-surface mb-1">Importing Records to Firestore</h3>
                <p className="text-xs text-secondary">
                  Writing in controlled chunks of 350 to prevent rate-limit errors...
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-surface-container-highest rounded-full h-3 overflow-hidden border border-outline-variant/30">
                <div 
                  className="bg-primary h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              <div className="flex justify-between items-center text-xs font-mono text-secondary">
                <span>{progress.processed.toLocaleString()} / {progress.total.toLocaleString()} rows</span>
                <span>Batch {progress.currentBatch} of {progress.totalBatches} ({progress.percent}%)</span>
              </div>
            </div>
          )}

          {/* STEP 6: Completion Report */}
          {step === 'completed' && (
            <div className="space-y-6 py-6 text-center max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-lg font-black text-on-surface mb-1">Import Complete!</h3>
                <p className="text-xs text-secondary">
                  Successfully imported ledger data with zero database exceeded errors.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 border border-outline-variant rounded-xl p-4 bg-surface-container-low text-left">
                <div>
                  <span className="text-[10px] font-black uppercase text-secondary block">Expected</span>
                  <span className="text-base font-bold text-on-surface">{progress.total.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-emerald-600 block">Imported</span>
                  <span className="text-base font-bold text-emerald-600">{progress.successful.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-rose-600 block">Errors / Skipped</span>
                  <span className="text-base font-bold text-rose-600">{progress.rejected.toLocaleString()}</span>
                </div>
              </div>

              {progress.errors.length > 0 && (
                <div className="text-left border border-rose-500/20 bg-rose-500/5 rounded-xl p-3 max-h-32 overflow-y-auto text-[11px] font-mono text-rose-600">
                  {progress.errors.map((err, idx) => (
                    <div key={idx}>Row {err.row}: {err.error}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-6 py-3.5 border-t border-outline-variant flex items-center justify-between bg-surface-container-low shrink-0">
          <div>
            {step === 'preview' && (
              <button
                type="button"
                onClick={() => setStep('mapping')}
                className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold text-secondary hover:text-on-surface"
              >
                Back to Column Mapping
              </button>
            )}
            {step === 'mapping' && (
              <button
                type="button"
                onClick={() => setStep('upload')}
                className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold text-secondary hover:text-on-surface"
              >
                Upload Different File
              </button>
            )}
          </div>

          <div className="flex gap-2">
            {step !== 'importing' && step !== 'completed' && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold text-secondary hover:text-on-surface"
              >
                Cancel
              </button>
            )}

            {step === 'mapping' && (
              <button
                type="button"
                onClick={() => setStep('preview')}
                className="px-5 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-primary-hover flex items-center gap-1.5 shadow-md shadow-primary/20"
              >
                Continue to Preview <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {step === 'preview' && (
              <button
                type="button"
                onClick={handleStartImport}
                className="px-6 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 flex items-center gap-1.5 shadow-md shadow-emerald-600/20"
              >
                Confirm & Import Records
              </button>
            )}

            {step === 'completed' && (
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-primary-hover shadow-md shadow-primary/20"
              >
                Done
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
