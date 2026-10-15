import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  BookOpen, 
  Search, 
  Filter, 
  Calendar, 
  Download, 
  Eye, 
  CheckCircle2, 
  Clock, 
  ArrowUpDown, 
  RefreshCw, 
  Printer, 
  FileText, 
  Sparkles, 
  X, 
  Layers, 
  ChevronRight, 
  ChevronLeft, 
  ChevronDown, 
  CheckSquare, 
  Square, 
  History, 
  Building2, 
  User, 
  CreditCard, 
  AlertCircle,
  FileCheck2,
  Trash2,
  ExternalLink,
  SlidersHorizontal,
  FolderDown,
  Info,
  ListFilter,
  Check,
  Maximize2,
  Grid2X2,
  Rows4
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  PattiRecordItem, 
  PattiExportRecord,
  PattiPdfLayout,
  getClearedPattiRecords, 
  recordPattiExport, 
  generatePattiBookPdf, 
  generateSinglePattiPdf,
  getLocalExportHistory,
  formatCurrencyForPdf,
  formatNumberForPdf
} from '../utils/pattiBookManager';
import PattiDigitalBook from '../components/PattiDigitalBook';
import PattiFormDisplay from '../components/PattiFormDisplay';
import { cn, formatINR } from '../lib/utils';
import { normalizeDate } from '../utils/dateUtils';

export default function PattiBookView() {
  // Primary state
  const [records, setRecords] = useState<PattiRecordItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'cleared' | 'today' | 'history'>('today');
  const [viewMode, setViewMode] = useState<'book' | 'table'>('book');
  
  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  // Filtering & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMiller, setSelectedMiller] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'exported'>('all');
  const [dateRangePreset, setDateRangePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  
  // Sorting
  const [sortBy, setSortBy] = useState<'miller_asc' | 'miller_desc' | 'date_desc' | 'date_asc' | 'bill_asc' | 'amount_desc'>('miller_asc');
  const [separatePagesPerMiller, setSeparatePagesPerMiller] = useState<boolean>(false);
  
  // Layout option for PDF export & Digital Register: '2x2' | '1x4'
  const [pdfLayout, setPdfLayout] = useState<PattiPdfLayout>(() => {
    try {
      const saved = localStorage.getItem('patti_book_view_layout');
      if (saved === '1x4' || saved === '2x2') return saved;
    } catch (_) {}
    return '2x2';
  });

  // Export History
  const [exportHistory, setExportHistory] = useState<PattiExportRecord[]>([]);
  
  // Modals & Previews
  const [previewSinglePatti, setPreviewSinglePatti] = useState<PattiRecordItem | null>(null);
  const [isBulkPreviewOpen, setIsBulkPreviewOpen] = useState<boolean>(false);
  const [previewTargetRecords, setPreviewTargetRecords] = useState<PattiRecordItem[]>([]);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewTotalPages, setPreviewTotalPages] = useState<number>(1);
  const [previewCurrentPage, setPreviewCurrentPage] = useState<number>(1);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccessMessage, setExportSuccessMessage] = useState<string | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState<boolean>(false);

  // Logo base64 cache
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  // Today's date in canonical ISO YYYY-MM-DD
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Preload logo for sharp PDF embedding
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 64;
        canvas.height = img.naturalHeight || 64;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          setLogoBase64(canvas.toDataURL('image/png'));
        }
      } catch (e) {
        console.warn('Could not load logo as base64 for PDF, using vector fallback', e);
      }
    };
    img.src = '/logo.png';
  }, []);

  // Load Cleared Payments & Export History
  const loadPattiData = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getClearedPattiRecords();
      setRecords(data);
      const history = getLocalExportHistory();
      setExportHistory(history);
    } catch (err) {
      console.error('Failed loading Patti Book cleared records:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPattiData();

    const handleRegistryUpdated = () => loadPattiData();
    window.addEventListener('patti-registry-updated', handleRegistryUpdated);
    window.addEventListener('patti-export-recorded', handleRegistryUpdated);
    window.addEventListener('storage', handleRegistryUpdated);

    return () => {
      window.removeEventListener('patti-registry-updated', handleRegistryUpdated);
      window.removeEventListener('patti-export-recorded', handleRegistryUpdated);
      window.removeEventListener('storage', handleRegistryUpdated);
    };
  }, [loadPattiData]);

  // Unique millers for filter dropdown
  const uniqueMillers = useMemo(() => {
    const set = new Set<string>();
    records.forEach(r => {
      if (r.millerName && r.millerName.trim()) set.add(r.millerName.trim());
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [records]);

  // Today's records
  const todaysRecords = useMemo(() => {
    return records.filter(r => r.clearedDate === todayIso);
  }, [records, todayIso]);

  // Filtered Records based on current controls
  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // 1. Tab filter
      if (activeTab === 'today') {
        if (r.clearedDate !== todayIso) return false;
      }

      // 2. Export Status filter
      if (statusFilter !== 'all') {
        if (r.exportStatus !== statusFilter) return false;
      }

      // 3. Miller filter
      if (selectedMiller !== 'all') {
        if (r.millerName.trim().toLowerCase() !== selectedMiller.trim().toLowerCase()) {
          return false;
        }
      }

      // 4. Date range filter (applied when in All Cleared tab)
      if (activeTab === 'cleared') {
        if (dateRangePreset === 'today') {
          if (r.clearedDate !== todayIso) return false;
        } else if (dateRangePreset === 'yesterday') {
          const yest = new Date();
          yest.setDate(yest.getDate() - 1);
          const yestIso = yest.toISOString().split('T')[0];
          if (r.clearedDate !== yestIso) return false;
        } else if (dateRangePreset === 'week') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          const weekIso = weekAgo.toISOString().split('T')[0];
          if (r.clearedDate < weekIso) return false;
        } else if (dateRangePreset === 'month') {
          const monthAgo = new Date();
          monthAgo.setDate(monthAgo.getDate() - 30);
          const monthIso = monthAgo.toISOString().split('T')[0];
          if (r.clearedDate < monthIso) return false;
        } else if (dateRangePreset === 'custom') {
          if (customStartDate && r.clearedDate < customStartDate) return false;
          if (customEndDate && r.clearedDate > customEndDate) return false;
        }
      }

      // 5. Search Query (Miller, Party, Bill, Cheque)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesMiller = r.millerName.toLowerCase().includes(q);
        const matchesParty = r.partyName.toLowerCase().includes(q);
        const matchesBill = r.rawBillNo.toLowerCase().includes(q) || r.billNo.some(b => b.toLowerCase().includes(q));
        const matchesChq = r.chqNo.toLowerCase().includes(q) || String(r.chqAm).includes(q);
        if (!matchesMiller && !matchesParty && !matchesBill && !matchesChq) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Sorting: Miller alphabetically first, then clearance date and bill number
      if (sortBy === 'miller_asc') {
        const c = a.millerName.localeCompare(b.millerName);
        if (c !== 0) return c;
        return b.clearedAt - a.clearedAt;
      }
      if (sortBy === 'miller_desc') {
        const c = b.millerName.localeCompare(a.millerName);
        if (c !== 0) return c;
        return b.clearedAt - a.clearedAt;
      }
      if (sortBy === 'date_desc') {
        return b.clearedAt - a.clearedAt;
      }
      if (sortBy === 'date_asc') {
        return a.clearedAt - b.clearedAt;
      }
      if (sortBy === 'bill_asc') {
        return a.rawBillNo.localeCompare(b.rawBillNo);
      }
      if (sortBy === 'amount_desc') {
        return b.netAmount - a.netAmount;
      }
      return 0;
    });
  }, [records, activeTab, statusFilter, selectedMiller, dateRangePreset, customStartDate, customEndDate, searchQuery, sortBy, todayIso]);

  // Selected records list
  const selectedRecords = useMemo(() => {
    return records.filter(r => selectedIds.has(r.id)).sort((a, b) => {
      const c = a.millerName.localeCompare(b.millerName);
      if (c !== 0) return c;
      return b.clearedAt - a.clearedAt;
    });
  }, [records, selectedIds]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const todayCount = todaysRecords.length;
    const awaitingCount = records.filter(r => r.exportStatus !== 'exported').length;
    const totalCount = records.length;
    const selectedCount = selectedRecords.length;
    const totalSelectedAmount = selectedRecords.reduce((acc, r) => acc + (r.netAmount || 0), 0);

    return {
      todayCount,
      awaitingCount,
      totalCount,
      selectedCount,
      totalSelectedAmount
    };
  }, [todaysRecords, records, selectedRecords]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllMatching = () => {
    const next = new Set(selectedIds);
    filteredRecords.forEach(r => next.add(r.id));
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Synchronized Layout Switcher (updates localStorage, register view, and regenerates bulk preview if open)
  const handleLayoutChange = useCallback(async (newLayout: PattiPdfLayout) => {
    setPdfLayout(newLayout);
    try {
      localStorage.setItem('patti_book_view_layout', newLayout);
    } catch (_) {}

    if (isBulkPreviewOpen && previewTargetRecords.length > 0) {
      setIsExporting(true);
      try {
        const result = await generatePattiBookPdf({
          records: previewTargetRecords,
          separatePagesPerMiller,
          logoDataUrl: logoBase64,
          layout: newLayout
        });
        setPreviewPdfUrl(result.blobUrl);
        setPreviewTotalPages(result.totalPages);
        setPreviewCurrentPage(1);
      } catch (err: any) {
        console.error('Failed regenerating Patti PDF preview:', err);
      } finally {
        setIsExporting(false);
      }
    }
  }, [isBulkPreviewOpen, previewTargetRecords, separatePagesPerMiller, logoBase64]);

  // Open Multi-Page PDF Preview Modal (Steps 2-4)
  const handleOpenBulkPreview = async (recordsToPreview: PattiRecordItem[], overrideLayout?: PattiPdfLayout) => {
    if (recordsToPreview.length === 0) {
      alert('Please select at least one cleared Patti to generate a document.');
      return;
    }

    const layoutToUse = overrideLayout || pdfLayout;
    setPreviewTargetRecords(recordsToPreview);
    setIsExporting(true);
    setIsBulkPreviewOpen(true);

    try {
      const result = await generatePattiBookPdf({
        records: recordsToPreview,
        separatePagesPerMiller,
        logoDataUrl: logoBase64,
        layout: layoutToUse
      });

      setPreviewPdfUrl(result.blobUrl);
      setPreviewTotalPages(result.totalPages);
      setPreviewCurrentPage(1);
    } catch (err: any) {
      console.error('Failed generating Patti PDF preview:', err);
      alert(`Could not generate PDF: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Confirm and Download PDF (Steps 5-6)
  const handleConfirmAndDownload = async () => {
    const targetRecords = previewTargetRecords.length > 0 ? previewTargetRecords : selectedRecords;
    if (targetRecords.length === 0) return;
    setIsExporting(true);

    try {
      const result = await generatePattiBookPdf({
        records: targetRecords,
        separatePagesPerMiller,
        logoDataUrl: logoBase64,
        layout: pdfLayout
      });

      // Clean anchor download (never blocked by popup blockers)
      const link = document.createElement('a');
      link.href = result.blobUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Record export in audit history (does NOT alter financial balances)
      await recordPattiExport(targetRecords, separatePagesPerMiller, pdfLayout);

      const layoutName = pdfLayout === '1x4' ? '1×4 Stack' : '2×2 Grid';
      setExportSuccessMessage(`Downloaded ${result.filename} (${targetRecords.length} Pattis across ${result.totalPages} pages in ${layoutName} layout)`);
      setIsBulkPreviewOpen(false);
      handleClearSelection();
      await loadPattiData();

      setTimeout(() => setExportSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error('Download error:', err);
      alert(`Download failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Single Patti Download
  const handleDownloadSinglePatti = async (patti: PattiRecordItem) => {
    try {
      const result = await generateSinglePattiPdf(patti, logoBase64);
      const link = document.createElement('a');
      link.href = result.blobUrl;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      await recordPattiExport([patti], false, pdfLayout);
      setExportSuccessMessage(`Downloaded ${result.filename}`);
      await loadPattiData();
      setTimeout(() => setExportSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed downloading single patti:', err);
      alert(`Download failed: ${err.message || 'Unknown error'}`);
    }
  };

  // Past Export Reprint
  const handleReprintHistory = async (exportRecord: PattiExportRecord) => {
    try {
      const targetPattis = records.filter(r => exportRecord.pattiIds.includes(r.id));
      if (targetPattis.length === 0) {
        alert('Historical records could not be resolved from active transaction archive.');
        return;
      }

      const result = await generatePattiBookPdf({
        records: targetPattis,
        separatePagesPerMiller: exportRecord.separatePagesPerMiller,
        logoDataUrl: logoBase64,
        layout: exportRecord.layout || '2x2'
      });

      const link = document.createElement('a');
      link.href = result.blobUrl;
      link.download = exportRecord.filename || `Reprint_${exportRecord.exportId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportSuccessMessage(`Reprinted ${exportRecord.filename}`);
      setTimeout(() => setExportSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Reprint error:', err);
      alert(`Reprint failed: ${err.message || 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-[#07130d] text-slate-900 dark:text-slate-100 p-3 sm:p-6 lg:p-8 space-y-6 admin-font font-sf">
      {/* Feedback Alert Toast */}
      <AnimatePresence>
        {exportSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-semibold text-sm border border-emerald-400/40"
          >
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{exportSuccessMessage}</span>
            <button onClick={() => setExportSuccessMessage(null)} className="ml-2 hover:opacity-75">
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header Card */}
      <div className="bg-white/85 dark:bg-[#0d1e15]/80 backdrop-blur-xl border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-amber-500/20">
            TC
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">
                Digital Patti Book
              </h1>
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                Interactive Mandi Register & A4 4-Up PDF
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              Authentic rice brokerage settlement ledger. Browse cleared payments in the physical digital book register, review details, and export clean 4-Up A4 documents.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10">
            <button
              type="button"
              onClick={() => setViewMode('book')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                viewMode === 'book'
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Register Book</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                viewMode === 'table'
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              )}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Audit Table</span>
            </button>
          </div>

          {/* PDF & Register Layout Switcher */}
          <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10" title="Choose Layout (2×2 Grid or 1×4 Stack)">
            <button
              type="button"
              onClick={() => handleLayoutChange('2x2')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                pdfLayout === '2x2'
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
              title="2x2 Grid Layout (4 slips per A4 page)"
            >
              <Grid2X2 className="w-3.5 h-3.5" />
              <span>2×2</span>
            </button>
            <button
              type="button"
              onClick={() => handleLayoutChange('1x4')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                pdfLayout === '1x4'
                  ? "bg-amber-500 text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              )}
              title="1x4 Stack Layout (4 full-width slips per A4 page)"
            >
              <Rows4 className="w-3.5 h-3.5" />
              <span>1×4</span>
            </button>
          </div>

          <button
            onClick={loadPattiData}
            disabled={isLoading}
            className="btn-tactile flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-white/[0.04] text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 transition-all cursor-pointer"
            title="Refresh cleared transactions"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            <span>Sync</span>
          </button>

          {/* Generate PDF CTA */}
          <button
            onClick={() => handleOpenBulkPreview(selectedRecords)}
            disabled={selectedRecords.length === 0 || isExporting}
            className={cn(
              "btn-tactile flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md",
              selectedRecords.length > 0
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-amber-500/20 hover:scale-[1.02]"
                : "bg-slate-200 dark:bg-white/5 text-slate-400 dark:text-slate-600 cursor-not-allowed"
            )}
          >
            <Printer className="w-4 h-4" />
            <span>Generate Patti PDF ({selectedRecords.length}) • {pdfLayout === '1x4' ? '1×4' : '2×2'}</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white/70 dark:bg-[#0d1e15]/60 border border-slate-200/70 dark:border-white/10 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Today's Cleared</span>
            <Calendar className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {summaryMetrics.todayCount}
          </div>
          <span className="text-[10px] text-slate-400">Marked cleared today</span>
        </div>

        <div className="bg-white/70 dark:bg-[#0d1e15]/60 border border-slate-200/70 dark:border-white/10 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Awaiting Export</span>
            <Clock className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-black text-rose-600 dark:text-rose-400">
            {summaryMetrics.awaitingCount}
          </div>
          <span className="text-[10px] text-slate-400">Unprinted vouchers</span>
        </div>

        <div className="bg-white/70 dark:bg-[#0d1e15]/60 border border-slate-200/70 dark:border-white/10 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Cleared</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {summaryMetrics.totalCount}
          </div>
          <span className="text-[10px] text-slate-400">Total settlement history</span>
        </div>

        <div className="bg-white/70 dark:bg-[#0d1e15]/60 border border-slate-200/70 dark:border-white/10 rounded-2xl p-4 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider">Export Batches</span>
            <History className="w-4 h-4 text-sky-500" />
          </div>
          <div className="text-xl font-black text-slate-900 dark:text-white">
            {exportHistory.length}
          </div>
          <span className="text-[10px] text-slate-400">Past reprint batches</span>
        </div>
      </div>

      {/* Tab Navigation Strip */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('today')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
              activeTab === 'today'
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5"
            )}
          >
            <Calendar className="w-4 h-4" />
            <span>Today's Cleared ({todaysRecords.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('cleared')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
              activeTab === 'cleared'
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5"
            )}
          >
            <BookOpen className="w-4 h-4" />
            <span>All Cleared Payments ({records.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2",
              activeTab === 'history'
                ? "bg-amber-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-white/5"
            )}
          >
            <History className="w-4 h-4" />
            <span>Export History ({exportHistory.length})</span>
          </button>
        </div>

        {/* Setting Toggle: Separate Pages Per Miller */}
        <label className="hidden md:flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={separatePagesPerMiller}
            onChange={(e) => setSeparatePagesPerMiller(e.target.checked)}
            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
          />
          <span>Start new page for each miller</span>
        </label>
      </div>

      {/* MAIN CONTENT AREA */}
      {activeTab === 'history' ? (
        /* EXPORT HISTORY TAB */
        <div className="bg-white/80 dark:bg-[#0d1e15]/70 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Patti Export Archive & Reprints
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Audit trail of previously issued Patti documents. Reprint anytime without duplicating financial records.
              </p>
            </div>
          </div>

          {exportHistory.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <History className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">No exported batches recorded yet.</p>
              <p className="text-xs mt-1">When you generate and download a Patti PDF, it will appear here for reprint.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-100/50 dark:bg-white/[0.02] text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4">Export Date & Time</th>
                    <th className="py-3 px-4">File Name</th>
                    <th className="py-3 px-4">Records Included</th>
                    <th className="py-3 px-4">Pages</th>
                    <th className="py-3 px-4">Format</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {exportHistory.map((h) => (
                    <tr key={h.exportId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-slate-600 dark:text-slate-400">
                        {new Date(h.exportedAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                        {h.filename}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-amber-600 dark:text-amber-400 font-mono">
                          {h.recordCount} Pattis
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono">
                        {h.pagesCount} A4 Pages
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300">
                          {h.layout === '1x4' ? '1×4 Stack' : '2×2 Grid'} • {h.separatePagesPerMiller ? 'Per-Miller Pages' : 'Continuous'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleReprintHistory(h)}
                          className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 font-bold hover:bg-amber-500/20 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Reprint PDF</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* CLEARED PAYMENTS ACTIVE WORKSPACE (TODAY OR ALL CLEARED) */
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white/80 dark:bg-[#0d1e15]/70 border border-slate-200/80 dark:border-white/10 rounded-3xl p-4 sm:p-5 shadow-sm space-y-3.5">
            <div className="flex flex-col md:flex-row md:items-center gap-3">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Miller, Party, Bill No, Cheque No..."
                  className="w-full pl-10 pr-4 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.03] outline-none focus:border-amber-500"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Miller Filter Dropdown */}
              <div className="w-full md:w-56">
                <select
                  value={selectedMiller}
                  onChange={(e) => setSelectedMiller(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#07130d] outline-none focus:border-amber-500 font-semibold cursor-pointer"
                >
                  <option value="all">All Millers ({uniqueMillers.length})</option>
                  {uniqueMillers.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div className="w-full md:w-44">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#07130d] outline-none focus:border-amber-500 font-semibold cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Awaiting Export</option>
                  <option value="exported">Previously Exported</option>
                </select>
              </div>

              {/* Sort By Dropdown */}
              <div className="w-full md:w-48">
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#07130d] outline-none focus:border-amber-500 font-semibold cursor-pointer"
                >
                  <option value="miller_asc">Miller (A to Z)</option>
                  <option value="miller_desc">Miller (Z to A)</option>
                  <option value="date_desc">Clearance Date (Newest)</option>
                  <option value="date_asc">Clearance Date (Oldest)</option>
                  <option value="bill_asc">Bill Number</option>
                  <option value="amount_desc">Amount (Highest)</option>
                </select>
              </div>
            </div>

            {/* Date Presets (Visible on All Cleared tab) */}
            {activeTab === 'cleared' && (
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-slate-100 dark:border-white/5 text-xs">
                <span className="text-[11px] font-bold text-slate-400 uppercase mr-1">Date Range:</span>
                {(['all', 'today', 'yesterday', 'week', 'month', 'custom'] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setDateRangePreset(preset)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer capitalize",
                      dateRangePreset === preset
                        ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-black font-bold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5"
                    )}
                  >
                    {preset === 'week' ? 'Past 7 Days' : preset === 'month' ? 'Past 30 Days' : preset}
                  </button>
                ))}

                {dateRangePreset === 'custom' && (
                  <div className="flex items-center gap-2 ml-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs bg-transparent"
                    />
                    <span className="text-slate-400">to</span>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2 py-1 rounded-lg border border-slate-200 dark:border-white/10 text-xs bg-transparent"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Ribbon & Selection Summary Bar */}
          <div className="bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAllMatching}
                className="btn-tactile text-xs font-bold text-amber-800 dark:text-amber-400 hover:underline flex items-center gap-1.5 cursor-pointer"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                Select All Matching ({filteredRecords.length})
              </button>

              {selectedIds.size > 0 && (
                <>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <button
                    onClick={handleClearSelection}
                    className="btn-tactile text-xs font-bold text-rose-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Clear Selection ({selectedIds.size})
                  </button>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {selectedRecords.length > 0 && (
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Selected: </span>
                  <span className="text-amber-600 dark:text-amber-400 font-extrabold">{selectedRecords.length}</span>
                  <span className="text-slate-400 ml-2">({Math.ceil(selectedRecords.length / 4)} A4 Pages)</span>
                </div>
              )}

              {/* Export All Filtered button */}
              <button
                onClick={() => handleOpenBulkPreview(filteredRecords)}
                disabled={filteredRecords.length === 0}
                className="btn-tactile flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-300 text-xs font-bold hover:bg-amber-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <FolderDown className="w-3.5 h-3.5" />
                <span>Export All Filtered ({filteredRecords.length})</span>
              </button>
            </div>
          </div>

          {/* DUAL WORKSPACE: BOOK VIEW OR TABLE VIEW */}
          {viewMode === 'book' ? (
            /* 1. INTERACTIVE DIGITAL BOOK REGISTER WORKSPACE */
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left/Center: The Digital Book */}
              <div className="xl:col-span-8 2xl:col-span-9 bg-white/40 dark:bg-black/20 p-2 sm:p-4 rounded-3xl border border-slate-200/60 dark:border-white/5">
                <PattiDigitalBook
                  records={filteredRecords}
                  selectedIds={selectedIds}
                  onToggleSelect={handleToggleSelect}
                  onInspectPatti={setPreviewSinglePatti}
                  onOpenExportModal={() => handleOpenBulkPreview(selectedRecords)}
                  isLoading={isLoading}
                  layout={pdfLayout}
                  onLayoutChange={handleLayoutChange}
                />
              </div>

              {/* Right: Quick Selection & Navigation Drawer Panel */}
              <div className="xl:col-span-4 2xl:col-span-3 bg-white/90 dark:bg-[#0d1e15]/80 border border-slate-200/80 dark:border-white/10 rounded-3xl p-4 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/10">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Selection Panel
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {selectedIds.size} of {filteredRecords.length} Selected
                    </span>
                  </div>
                  {selectedIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => handleOpenBulkPreview(selectedRecords)}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 text-white text-[11px] font-bold shadow-xs hover:bg-amber-600 cursor-pointer flex items-center gap-1"
                    >
                      <Printer className="w-3 h-3" />
                      <span>PDF</span>
                    </button>
                  )}
                </div>

                {/* List of matching cleared items */}
                <div className="space-y-1.5 max-h-[620px] overflow-y-auto pr-1 scrollbar-thin">
                  {filteredRecords.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 text-xs">
                      No cleared payments in current filter.
                    </div>
                  ) : (
                    filteredRecords.map((r) => {
                      const isSelected = selectedIds.has(r.id);
                      return (
                        <div
                          key={r.id}
                          onClick={() => handleToggleSelect(r.id)}
                          className={cn(
                            "p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between gap-2",
                            isSelected
                              ? "bg-amber-500/10 dark:bg-amber-500/5 border-amber-500/50 shadow-2xs"
                              : "bg-slate-50/70 dark:bg-white/[0.02] border-slate-200/70 dark:border-white/5 hover:border-slate-300"
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by parent onClick
                              className="w-3.5 h-3.5 rounded text-amber-500 focus:ring-amber-400 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate text-[11px]">
                                {r.millerName}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {r.partyName} • {r.billNo[0] || r.rawBillNo || 'Bill'}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-[11px] text-emerald-600 dark:text-emerald-400">
                              ₹{formatINR(r.netAmount)}
                            </div>
                            <span className="text-[9px] text-slate-400">
                              {r.clearedDate}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          ) : (
            /* 2. STRUCTURED TABULAR AUDIT MATRIX VIEW */
            <div className="bg-white/90 dark:bg-[#0d1e15]/80 border border-slate-200/80 dark:border-white/10 rounded-3xl shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="py-20 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 opacity-50" />
                  <p className="text-xs font-semibold">Loading cleared transactions...</p>
                </div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-20 text-center text-slate-400">
                  <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-bold text-slate-700 dark:text-slate-300">No matching cleared payments found</p>
                  <p className="text-xs mt-1">Payments marked as cleared in the payment workflow will appear here for review and Patti PDF generation.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.02] text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-3 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={filteredRecords.length > 0 && filteredRecords.every(r => selectedIds.has(r.id))}
                            onChange={(e) => {
                              if (e.target.checked) handleSelectAllMatching();
                              else handleClearSelection();
                            }}
                            className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                          />
                        </th>
                        <th className="py-3 px-3">Miller (Supplier)</th>
                        <th className="py-3 px-3">Party (Buyer)</th>
                        <th className="py-3 px-3">Bill No.</th>
                        <th className="py-3 px-3">Arrival Dt</th>
                        <th className="py-3 px-3">Cleared Dt</th>
                        <th className="py-3 px-3 text-right">Net Amount</th>
                        <th className="py-3 px-3 text-right">Cheque Amt</th>
                        <th className="py-3 px-3 text-center">Export Status</th>
                        <th className="py-3 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {filteredRecords.map((r) => {
                        const isSelected = selectedIds.has(r.id);
                        return (
                          <tr
                            key={r.id}
                            className={cn(
                              "hover:bg-slate-50/80 dark:hover:bg-white/[0.02] transition-colors",
                              isSelected && "bg-amber-500/[0.06] dark:bg-amber-500/[0.04]"
                            )}
                          >
                            <td className="py-3 px-3 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelect(r.id)}
                                className="w-4 h-4 rounded text-amber-500 focus:ring-amber-400 cursor-pointer"
                              />
                            </td>
                            <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                              <div className="truncate max-w-[180px]">{r.millerName}</div>
                            </td>
                            <td className="py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">
                              <div className="truncate max-w-[180px]">{r.partyName}</div>
                            </td>
                            <td className="py-3 px-3 font-mono text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                              {r.billNo.filter(Boolean).join(', ') || r.rawBillNo || '-'}
                            </td>
                            <td className="py-3 px-3 text-slate-500 dark:text-slate-400">
                              {r.arrivalDt || r.date || '-'}
                            </td>
                            <td className="py-3 px-3 text-amber-600 dark:text-amber-400 font-semibold">
                              {r.clearedDate || '-'}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{formatINR(r.netAmount)}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-semibold text-slate-900 dark:text-white">
                              ₹{formatINR(r.chqAm)}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {r.exportStatus === 'exported' ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Exported ({r.exportCount})
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/25">
                                  <Clock className="w-3 h-3" />
                                  Awaiting Export
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => setPreviewSinglePatti(r)}
                                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 transition-all cursor-pointer"
                                  title="Inspect Patti Details"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => handleDownloadSinglePatti(r)}
                                  className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-500/15 transition-all cursor-pointer"
                                  title="Download One Patti"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: MULTI-PAGE A4 2x2 PDF PREVIEW & CONFIRMATION (STEPS 3-6) */}
      <AnimatePresence>
        {isBulkPreviewOpen && previewPdfUrl && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#07130d] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 flex items-center justify-center shrink-0">
                    <Printer className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      Patti Book A4 Document Preview
                      <span className="text-xs font-semibold text-slate-500">
                        ({(previewTargetRecords.length > 0 ? previewTargetRecords : selectedRecords).length} Pattis • {previewTotalPages} Pages)
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      {pdfLayout === '1x4'
                        ? '1×4 vertical stack layout (4 full-width slips per A4 page with shared Tejas Canvassing header).'
                        : 'Standard 2×2 grid layout (4 slips per A4 page with shared Tejas Canvassing header).'
                      }
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end md:self-auto">
                  {/* Layout Option Pills in Preview Modal */}
                  <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-white/[0.05] border border-slate-200 dark:border-white/10" title="Switch PDF Layout">
                    <button
                      type="button"
                      onClick={() => handleLayoutChange('2x2')}
                      disabled={isExporting}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        pdfLayout === '2x2'
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                      title="2x2 Grid Layout (4 slips per A4 page)"
                    >
                      <Grid2X2 className="w-3.5 h-3.5" />
                      <span>2×2 Grid</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLayoutChange('1x4')}
                      disabled={isExporting}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                        pdfLayout === '1x4'
                          ? "bg-amber-500 text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                      title="1x4 Stack Layout (4 full-width slips per A4 page)"
                    >
                      <Rows4 className="w-3.5 h-3.5" />
                      <span>1×4 Stack</span>
                    </button>
                  </div>

                  <button
                    onClick={() => setIsBulkPreviewOpen(false)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* PDF Viewer / Document Preview Body */}
              <div className="flex-1 bg-slate-100/70 dark:bg-black/50 p-4 overflow-hidden flex flex-col items-center justify-center min-h-[480px]">
                <iframe
                  src={`${previewPdfUrl}#page=1&zoom=page-fit`}
                  title="Patti Book PDF Preview"
                  className="w-full h-full min-h-[500px] border border-slate-300 dark:border-white/10 rounded-2xl shadow-inner bg-white"
                />
              </div>

              {/* Modal Footer with Explicit Action Buttons */}
              <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50 dark:bg-[#0d1e15]">
                <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                  <Info className="w-4 h-4 text-amber-500 shrink-0" />
                  <span>
                    Downloading will record the export in audit history without altering any financial balances.
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setIsBulkPreviewOpen(false)}
                    className="btn-tactile px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-all cursor-pointer"
                  >
                    Return to Selection
                  </button>

                  <button
                    onClick={handleConfirmAndDownload}
                    disabled={isExporting}
                    className="btn-tactile flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-600/20 hover:scale-[1.02] transition-all cursor-pointer"
                  >
                    {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    <span>Confirm & Download PDF</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL 2: FULL FLAT PATTI DETAILED INSPECTION MODAL */}
      <AnimatePresence>
        {previewSinglePatti && (
          <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-[#0d1e15] border border-slate-200 dark:border-white/10 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden p-6 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/15 text-amber-600 flex items-center justify-center font-black text-xs">
                    TC
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Physical Patti Inspector
                    </h3>
                    <p className="text-[10px] text-slate-500">
                      High-fidelity 16-field mandi settlement verification
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setPreviewSinglePatti(null)}
                  className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer text-slate-400"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Render the full 16-field physical form */}
              <div className="max-h-[70vh] overflow-y-auto pr-1">
                <PattiFormDisplay
                  patti={previewSinglePatti}
                  isSelected={selectedIds.has(previewSinglePatti.id)}
                  onToggleSelect={handleToggleSelect}
                  theme="clean"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-white/10 text-xs">
                <button
                  type="button"
                  onClick={() => handleToggleSelect(previewSinglePatti.id)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer flex items-center gap-1.5",
                    selectedIds.has(previewSinglePatti.id)
                      ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300"
                      : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300"
                  )}
                >
                  {selectedIds.has(previewSinglePatti.id) ? <Check className="w-3.5 h-3.5 text-amber-600" /> : <PlusIcon className="w-3.5 h-3.5" />}
                  <span>{selectedIds.has(previewSinglePatti.id) ? 'Selected for A4 PDF' : 'Select for A4 PDF'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPreviewSinglePatti(null)}
                    className="btn-tactile px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      handleDownloadSinglePatti(previewSinglePatti);
                      setPreviewSinglePatti(null);
                    }}
                    className="btn-tactile flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-md hover:bg-amber-600 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Single</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlusIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
