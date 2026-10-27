import React, { useState, useRef } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle,
  Loader2, 
  Users, 
  MapPin, 
  Phone, 
  Building2, 
  Search,
  Filter,
  Check,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { parseMerchantsFromWorkbook, ParsedMerchant } from '../utils/merchantExcelParser';
import { cn } from '../lib/utils';

interface ExcelMerchantImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (importedMerchants: ParsedMerchant[], mode: 'merge' | 'replace') => void;
  existingCount?: number;
}

export default function ExcelMerchantImportModal({
  isOpen,
  onClose,
  onImportComplete,
  existingCount = 0
}: ExcelMerchantImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedMerchants, setParsedMerchants] = useState<ParsedMerchant[]>([]);
  const [selectedMandi, setSelectedMandi] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) processFile(selected);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) processFile(dropped);
  };

  const processFile = async (f: File) => {
    setErrorMsg(null);
    setFile(f);
    setLoading(true);

    try {
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const merchants = parseMerchantsFromWorkbook(wb, existingCount);

      if (merchants.length === 0) {
        setErrorMsg('No merchant or buyer records could be identified in this Excel file. Ensure the sheet has firm names, places/roads, and contact information.');
        setParsedMerchants([]);
      } else {
        setParsedMerchants(merchants);
      }
    } catch (err: any) {
      console.error('Failed to parse merchant file:', err);
      setErrorMsg(`Error reading spreadsheet: ${err.message || 'Invalid or corrupted Excel file.'}`);
      setParsedMerchants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadBuiltInDirectory = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const { default: directory } = await import('../data/merchants_directory.json');
      setParsedMerchants(directory as ParsedMerchant[]);
      setFile(new File([""], "All Merchants.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    } catch (err: any) {
      console.error('Failed to load built-in merchant directory:', err);
      setErrorMsg(`Error loading preloaded directory: ${err?.message || 'Failed'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmImport = () => {
    if (parsedMerchants.length === 0) return;
    setIsSuccess(true);
    setTimeout(() => {
      onImportComplete(parsedMerchants, importMode);
      setIsSuccess(false);
      onClose();
    }, 600);
  };

  // Region breakdown
  const regions = Array.from(new Set(parsedMerchants.map(m => m.mandi).filter(Boolean))).sort();

  // Filtered view
  const filtered = parsedMerchants.filter(m => {
    if (selectedMandi !== 'all' && m.mandi !== selectedMandi) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.road.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        m.gstin.toLowerCase().includes(q) ||
        m.mandi.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-surface-container-high border border-outline-variant/30 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-on-surface">
        {/* Header */}
        <div className="p-6 border-b border-outline-variant/20 flex items-center justify-between bg-surface-container/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-inner">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight">Import Buyers & Merchants</h2>
              <p className="text-xs text-secondary mt-0.5">Bulk upload institutional buyer profiles, roads, GSTINs, and contacts from Excel (.xlsx / .xls)</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-9 h-9 rounded-full hover:bg-surface-variant flex items-center justify-center text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Upload Dropzone */}
          {!file && (
            <>
              <div 
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-primary/30 hover:border-primary/60 bg-primary/5 hover:bg-primary/10 transition-all rounded-3xl p-10 flex flex-col items-center justify-center text-center cursor-pointer group"
              >
                <input 
                  ref={fileInputRef} 
                  type="file" 
                  accept=".xlsx,.xls" 
                  onChange={handleFileChange} 
                  className="hidden" 
                />
                <div className="w-16 h-16 rounded-3xl bg-primary/15 text-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-primary/10">
                  <Upload className="w-8 h-8" />
                </div>
                <h3 className="text-base font-black tracking-tight mb-1">Click to browse or drag & drop Excel workbook</h3>
                <p className="text-xs text-secondary max-w-md mb-3">
                  Supports multi-sheet regional directories (e.g. <code>All Merchants.xlsx</code>) as well as flat buyer summaries. Auto-detects firm names, GSTINs, roads, and phone numbers.
                </p>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-primary/20 text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                  Automatic Multi-Sheet Card & Table Parser
                </span>
              </div>

              <div className="flex items-center justify-center pt-2">
                <button
                  type="button"
                  onClick={handleLoadBuiltInDirectory}
                  className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-surface-container-high border border-outline-variant/30 text-on-surface hover:border-primary/50 hover:bg-surface-variant transition-all text-xs font-black shadow-sm cursor-pointer group"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                  <span>Load Preloaded Mandi Directory (547 Verified Merchants from All Merchants.xlsx)</span>
                </button>
              </div>
            </>
          )}

          {/* Loading State */}
          {loading && (
            <div className="py-16 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
              <p className="text-sm font-bold">Scanning sheets & parsing buyer credentials...</p>
              <p className="text-xs text-secondary mt-1">Extracting roads, GSTIN numbers, and phone records across regions</p>
            </div>
          )}

          {/* Error Message */}
          {errorMsg && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold">{errorMsg}</p>
                <button 
                  onClick={() => { setFile(null); setErrorMsg(null); }}
                  className="text-xs underline font-bold mt-2 hover:opacity-80 cursor-pointer"
                >
                  Choose another file
                </button>
              </div>
            </div>
          )}

          {/* Parsed Results Overview & Preview */}
          {!loading && parsedMerchants.length > 0 && (
            <div className="space-y-5 animate-fade-in">
              {/* File details bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-surface-container/60 border border-outline-variant/20">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-black text-on-surface truncate max-w-xs">{file?.name}</p>
                    <p className="text-[11px] text-secondary">
                      <span className="font-bold text-primary">{parsedMerchants.length}</span> unique buyers detected across <span className="font-bold text-primary">{regions.length}</span> regions
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-secondary">
                    <span>Import Mode:</span>
                    <select
                      value={importMode}
                      onChange={(e) => setImportMode(e.target.value as any)}
                      className="px-3 py-1.5 rounded-xl bg-surface-container-high border border-outline-variant/30 text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                    >
                      <option value="merge">Merge with existing buyers</option>
                      <option value="replace">Replace buyer directory</option>
                    </select>
                  </div>

                  <button
                    onClick={() => { setFile(null); setParsedMerchants([]); }}
                    className="px-3 py-1.5 text-xs font-bold text-secondary hover:text-on-surface hover:bg-surface-variant rounded-xl transition-colors cursor-pointer"
                  >
                    Change File
                  </button>
                </div>
              </div>

              {/* Filters Bar */}
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <div className="relative flex-1 w-full">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
                  <input
                    type="text"
                    placeholder="Search by shop name, road, mobile, or GSTIN..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-container border border-outline-variant/20 text-xs text-on-surface focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Filter className="w-4 h-4 text-secondary shrink-0" />
                  <select
                    value={selectedMandi}
                    onChange={(e) => setSelectedMandi(e.target.value)}
                    className="flex-1 sm:flex-none px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant/20 text-xs font-bold text-on-surface focus:outline-none focus:border-primary"
                  >
                    <option value="all">All Regions ({parsedMerchants.length})</option>
                    {regions.map(r => (
                      <option key={r} value={r}>
                        {r} ({parsedMerchants.filter(m => m.mandi === r).length})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Table Preview */}
              <div className="border border-outline-variant/20 rounded-2xl overflow-hidden bg-surface-container/30">
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead className="sticky top-0 bg-surface-container-high border-b border-outline-variant/20 text-[11px] font-black uppercase tracking-wider text-secondary z-10">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Buyer / Shop Name</th>
                        <th className="py-2.5 px-3">Mandi / Region</th>
                        <th className="py-2.5 px-3">Road / Area</th>
                        <th className="py-2.5 px-3">Contact</th>
                        <th className="py-2.5 px-3">Phone / Mobile</th>
                        <th className="py-2.5 px-3">GSTIN</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 font-medium">
                      {filtered.slice(0, 100).map((b, idx) => (
                        <tr key={b.id || idx} className="hover:bg-primary/5 transition-colors">
                          <td className="py-2 px-3 text-secondary text-[11px] font-mono">{idx + 1}</td>
                          <td className="py-2 px-3 font-bold text-on-surface">{b.name}</td>
                          <td className="py-2 px-3">
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary">
                              {b.mandi}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-secondary">{b.road || '—'}</td>
                          <td className="py-2 px-3 text-secondary">{b.contact || b.name}</td>
                          <td className="py-2 px-3 font-mono text-secondary">{b.phone || '—'}</td>
                          <td className="py-2 px-3 font-mono text-[11px] text-secondary">{b.gstin || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {filtered.length > 100 && (
                  <div className="p-2.5 text-center text-[11px] text-secondary border-t border-outline-variant/10 bg-surface-container/50">
                    Showing first 100 of {filtered.length} matching buyers. All {parsedMerchants.length} will be imported.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-outline-variant/20 flex items-center justify-between bg-surface-container/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-outline-variant/30 text-xs font-bold text-secondary hover:text-on-surface hover:bg-surface-variant transition-colors cursor-pointer"
          >
            Cancel
          </button>

          {parsedMerchants.length > 0 && (
            <button
              onClick={handleConfirmImport}
              disabled={isSuccess}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-white shadow-lg transition-all cursor-pointer btn-tactile",
                isSuccess 
                  ? "bg-emerald-600 shadow-emerald-500/20" 
                  : "bg-primary hover:opacity-90 shadow-primary/20 active:scale-95"
              )}
            >
              {isSuccess ? (
                <>
                  <Check className="w-4 h-4" />
                  Imported!
                </>
              ) : (
                <>
                  <span>Import {parsedMerchants.length} Buyers</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
