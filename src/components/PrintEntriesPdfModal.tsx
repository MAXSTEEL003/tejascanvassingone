import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  FileDown, 
  Calendar, 
  User, 
  Building2, 
  Filter, 
  CheckCircle2, 
  Layers, 
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OperationalPO, formatQtl } from '../utils/orderOperations';
import { formatINR } from '../lib/utils';

interface PrintEntriesPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: 'pending_loadings' | 'po_ledger';
  title: string;
  entries: OperationalPO[];
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function PrintEntriesPdfModal({
  isOpen,
  onClose,
  reportType,
  title,
  entries
}: PrintEntriesPdfModalProps) {
  const [selectedBuyer, setSelectedBuyer] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  // Extract unique buyers with count
  const buyerOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(e => {
      const b = (e.buyer || '').trim();
      if (b) counts[b] = (counts[b] || 0) + 1;
    });
    return Object.keys(counts)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ name, count: counts[name] }));
  }, [entries]);

  // Extract unique suppliers with count
  const supplierOptions = useMemo(() => {
    const counts: Record<string, number> = {};
    entries.forEach(e => {
      const s = (e.supplier || '').trim();
      if (s) counts[s] = (counts[s] || 0) + 1;
    });
    return Object.keys(counts)
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({ name, count: counts[name] }));
  }, [entries]);

  // Extract unique months from timestamps
  const monthOptions = useMemo(() => {
    const monthsMap: Record<string, { label: string; count: number; timestamp: number }> = {};
    entries.forEach(e => {
      if (e.dateTimestamp) {
        const d = new Date(e.dateTimestamp);
        const y = d.getFullYear();
        const m = d.getMonth();
        const key = `${y}-${String(m + 1).padStart(2, '0')}`;
        const label = `${MONTH_NAMES[m]} ${y}`;
        if (!monthsMap[key]) {
          monthsMap[key] = { label, count: 0, timestamp: new Date(y, m, 1).getTime() };
        }
        monthsMap[key].count += 1;
      }
    });
    return Object.entries(monthsMap)
      .sort((a, b) => b[1].timestamp - a[1].timestamp)
      .map(([key, val]) => ({ key, label: val.label, count: val.count }));
  }, [entries]);

  // Filtered rows based on modal selections
  const matchingEntries = useMemo(() => {
    return entries.filter(e => {
      // Buyer filter
      if (selectedBuyer !== 'all') {
        if ((e.buyer || '').trim().toLowerCase() !== selectedBuyer.trim().toLowerCase()) {
          return false;
        }
      }

      // Supplier filter
      if (selectedSupplier !== 'all') {
        if ((e.supplier || '').trim().toLowerCase() !== selectedSupplier.trim().toLowerCase()) {
          return false;
        }
      }

      // Month filter
      if (selectedMonth !== 'all') {
        if (e.dateTimestamp) {
          const d = new Date(e.dateTimestamp);
          const y = d.getFullYear();
          const m = d.getMonth();
          const key = `${y}-${String(m + 1).padStart(2, '0')}`;
          if (key !== selectedMonth) return false;
        } else {
          return false;
        }
      }

      return true;
    }).sort((a, b) => b.dateTimestamp - a.dateTimestamp);
  }, [entries, selectedBuyer, selectedSupplier, selectedMonth]);

  // Computed summary metrics
  const summaryMetrics = useMemo(() => {
    let totalPoQtl = 0;
    let totalArrivalQtl = 0;
    let totalPendingQtl = 0;
    let totalEstimatedValue = 0;

    matchingEntries.forEach(e => {
      const poQ = e.poQtl || 0;
      const arrQ = e.arrivalQtl || 0;
      const pendQ = Math.max(0, poQ - arrQ);
      const rate = e.rate || 0;

      totalPoQtl += poQ;
      totalArrivalQtl += arrQ;
      totalPendingQtl += pendQ;

      if (reportType === 'pending_loadings') {
        totalEstimatedValue += pendQ * rate;
      } else {
        totalEstimatedValue += poQ * rate;
      }
    });

    return {
      count: matchingEntries.length,
      totalPoQtl,
      totalArrivalQtl,
      totalPendingQtl,
      totalEstimatedValue
    };
  }, [matchingEntries, reportType]);

  // Generate and download/print the PDF
  const handleGeneratePdf = () => {
    if (matchingEntries.length === 0) return;
    setIsGenerating(true);

    try {
      // Create A4 Landscape PDF for optimal table presentation
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      // Brand Theme Colors
      const isPending = reportType === 'pending_loadings';
      const headerColor: [number, number, number] = isPending ? [159, 18, 57] : [30, 41, 59]; // Rose-900 or Slate-800
      const accentColor: [number, number, number] = isPending ? [225, 29, 72] : [217, 119, 6]; // Rose-600 or Amber-600

      // 1. Top Header Banner
      doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
      doc.rect(0, 0, pageWidth, 26, 'F');

      // Decorative Accent Line
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(0, 26, pageWidth, 1.5, 'F');

      // Title & Firm Header
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('TEJAS CANVASSING', 12, 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Agricultural Commission Agent & B2B Grain Aggregator • APMC Yard, Yeshwanthpur, Bangalore - 560022', 12, 16);
      doc.text('Phone: +91 98450 12345 / +91 93423 80981 | GSTIN: 29AAGCV7712M1ZP', 12, 21);

      // Report Title Badge (Right-aligned in header)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      const reportNameText = isPending ? 'PENDING LOADINGS REPORT' : 'PURCHASE ORDER LEDGER';
      doc.text(reportNameText, pageWidth - 12, 11, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      const genDate = new Date();
      doc.text(`Generated: ${genDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${genDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, pageWidth - 12, 17, { align: 'right' });
      doc.text(`Official System Audit Trail`, pageWidth - 12, 22, { align: 'right' });

      // 2. Filter Summary Bar (Below banner)
      doc.setFillColor(248, 250, 252); // Slate-50
      doc.rect(0, 27.5, pageWidth, 10, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.line(0, 37.5, pageWidth, 37.5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(51, 65, 85);

      const buyerLabel = selectedBuyer === 'all' ? 'All Buyers' : selectedBuyer;
      const supplierLabel = selectedSupplier === 'all' ? 'All Suppliers' : selectedSupplier;
      const monthObj = monthOptions.find(m => m.key === selectedMonth);
      const monthLabel = selectedMonth === 'all' ? 'All Months' : (monthObj ? monthObj.label : selectedMonth);

      const filterSummaryText = `Buyer: ${buyerLabel}   |   Supplier: ${supplierLabel}   |   Month: ${monthLabel}   |   Matching Records: ${matchingEntries.length}`;
      doc.text(filterSummaryText, 12, 34);

      // 3. Define Table Columns & Data
      let headers: string[] = [];
      let bodyData: any[][] = [];
      let footData: any[][] = [];

      if (isPending) {
        headers = [
          'Sr.',
          'Date',
          'PO Number',
          'Buyer Name',
          'Supplier / Miller',
          'Brand / Variety',
          'PO Qtl',
          'Pending Qtl',
          'Rate (₹)',
          'Est. Pending (₹)',
          'Status'
        ];

        bodyData = matchingEntries.map((e, idx) => {
          const pendQ = Math.max(0, (e.poQtl || 0) - (e.arrivalQtl || 0));
          const estAmt = pendQ * (e.rate || 0);

          return [
            String(idx + 1),
            e.dateShort || e.date || '-',
            e.poNumber || '-',
            e.buyer || '-',
            e.supplier || '-',
            e.brand || '-',
            (e.poQtl || 0).toFixed(2),
            pendQ.toFixed(2),
            e.rate > 0 ? `₹${e.rate.toFixed(2)}` : '-',
            estAmt > 0 ? `₹${formatINR(estAmt)}` : '-',
            e.status || 'Pending Loading'
          ];
        });

        footData = [
          [
            'TOTAL',
            `${matchingEntries.length} POs`,
            '',
            '',
            '',
            '',
            summaryMetrics.totalPoQtl.toFixed(2),
            summaryMetrics.totalPendingQtl.toFixed(2),
            '',
            `₹${formatINR(summaryMetrics.totalEstimatedValue)}`,
            ''
          ]
        ];
      } else {
        headers = [
          'Sr.',
          'Date',
          'PO Number',
          'Buyer Name',
          'Supplier / Miller',
          'Brand / Variety',
          'PO Qtl',
          'Arrived Qtl',
          'Diff Qtl',
          'Rate (₹)',
          'Total Amount (₹)',
          'Status'
        ];

        bodyData = matchingEntries.map((e, idx) => {
          const poQ = e.poQtl || 0;
          const arrQ = e.arrivalQtl || 0;
          const diff = arrQ - poQ;
          const amt = poQ * (e.rate || 0);

          return [
            String(idx + 1),
            e.dateShort || e.date || '-',
            e.poNumber || '-',
            e.buyer || '-',
            e.supplier || '-',
            e.brand || '-',
            poQ.toFixed(2),
            arrQ.toFixed(2),
            diff !== 0 ? (diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)) : '0.00',
            e.rate > 0 ? `₹${e.rate.toFixed(2)}` : '-',
            amt > 0 ? `₹${formatINR(amt)}` : '-',
            e.status || 'Active'
          ];
        });

        footData = [
          [
            'TOTAL',
            `${matchingEntries.length} POs`,
            '',
            '',
            '',
            '',
            summaryMetrics.totalPoQtl.toFixed(2),
            summaryMetrics.totalArrivalQtl.toFixed(2),
            (summaryMetrics.totalArrivalQtl - summaryMetrics.totalPoQtl).toFixed(2),
            '',
            `₹${formatINR(summaryMetrics.totalEstimatedValue)}`,
            ''
          ]
        ];
      }

      // 4. Render Table with autoTable
      autoTable(doc, {
        startY: 40,
        head: [headers],
        body: bodyData,
        foot: footData,
        theme: 'striped',
        headStyles: {
          fillColor: headerColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: 2,
          halign: 'left'
        },
        bodyStyles: {
          fontSize: 7,
          cellPadding: 2,
          textColor: [30, 41, 59]
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 7.5,
          cellPadding: 2.5
        },
        columnStyles: isPending ? {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 20 },
          2: { cellWidth: 22, fontStyle: 'bold' },
          3: { cellWidth: 42 },
          4: { cellWidth: 42 },
          5: { cellWidth: 30 },
          6: { cellWidth: 20, halign: 'right' },
          7: { cellWidth: 22, halign: 'right', fontStyle: 'bold', textColor: [190, 18, 60] },
          8: { cellWidth: 20, halign: 'right' },
          9: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
          10: { cellWidth: 24, halign: 'center' },
        } : {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 20 },
          2: { cellWidth: 22, fontStyle: 'bold' },
          3: { cellWidth: 40 },
          4: { cellWidth: 40 },
          5: { cellWidth: 28 },
          6: { cellWidth: 18, halign: 'right' },
          7: { cellWidth: 18, halign: 'right' },
          8: { cellWidth: 18, halign: 'right' },
          9: { cellWidth: 18, halign: 'right' },
          10: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
          11: { cellWidth: 22, halign: 'center' },
        },
        didDrawPage: (data) => {
          // Footer on each page
          const str = `Page ${data.pageNumber}`;
          doc.setFontSize(7);
          doc.setTextColor(148, 163, 184);
          doc.text(str, pageWidth - 14, pageHeight - 6, { align: 'right' });
          doc.text('Tejas Canvassing • Confidential Commercial Document', 12, pageHeight - 6);
        }
      });

      // 5. Output PDF (Save & Open Preview Window)
      const cleanBuyer = selectedBuyer === 'all' ? 'AllBuyers' : selectedBuyer.replace(/[^a-zA-Z0-9]/g, '_');
      const cleanMonth = selectedMonth === 'all' ? 'AllMonths' : selectedMonth;
      const fileName = `${reportType === 'pending_loadings' ? 'Pending_Loadings' : 'PO_Ledger'}_${cleanBuyer}_${cleanMonth}.pdf`;

      // Trigger file download
      doc.save(fileName);

      // Open printable view in new browser tab
      try {
        const blobUrl = doc.output('bloburl');
        if (blobUrl) {
          window.open(blobUrl, '_blank');
        }
      } catch (previewErr) {
        console.warn('Could not open preview tab:', previewErr);
      }

      setSuccessFeedback(`PDF successfully generated: ${fileName}`);
      setTimeout(() => {
        setSuccessFeedback(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error generating PDF report:', err);
      alert(`Could not generate PDF: ${err?.message || 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18 }}
          className="bg-white dark:bg-[#141414] border border-slate-200 dark:border-neutral-800 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 dark:border-neutral-800/80 flex items-center justify-between bg-slate-50/50 dark:bg-neutral-900/40">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-2xl flex items-center justify-center font-black",
                reportType === 'pending_loadings' 
                  ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" 
                  : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
              )}>
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                  Print {title} as PDF
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Select criteria below to generate a formatted commercial PDF statement.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body / Filter Configuration */}
          <div className="p-6 overflow-y-auto space-y-5 text-left">

            {/* Filter Controls Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              
              {/* 1. Buyer Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Select Buyer</span>
                </label>
                <select
                  value={selectedBuyer}
                  onChange={(e) => setSelectedBuyer(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white font-medium outline-none focus:border-amber-500 transition-all cursor-pointer"
                >
                  <option value="all">All Buyers ({buyerOptions.length})</option>
                  {buyerOptions.map(b => (
                    <option key={b.name} value={b.name}>
                      {b.name} ({b.count} orders)
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Supplier Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Select Supplier</span>
                </label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white font-medium outline-none focus:border-amber-500 transition-all cursor-pointer"
                >
                  <option value="all">All Suppliers ({supplierOptions.length})</option>
                  {supplierOptions.map(s => (
                    <option key={s.name} value={s.name}>
                      {s.name} ({s.count} orders)
                    </option>
                  ))}
                </select>
              </div>

              {/* 3. Month Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  <span>Select Month</span>
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white font-medium outline-none focus:border-amber-500 transition-all cursor-pointer"
                >
                  <option value="all">All Months ({monthOptions.length})</option>
                  {monthOptions.map(m => (
                    <option key={m.key} value={m.key}>
                      {m.label} ({m.count} records)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Live Filter Summary Card */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-neutral-900/60 border border-slate-200/80 dark:border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  Statement Summary Preview
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white dark:bg-neutral-800 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-white/10">
                  {summaryMetrics.count} Matching Orders
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="p-2.5 bg-white dark:bg-neutral-800/80 rounded-xl border border-slate-100 dark:border-neutral-700/60">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">PO Quantity</span>
                  <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                    {summaryMetrics.totalPoQtl.toFixed(2)} <span className="text-[10px] font-medium text-slate-400">QTL</span>
                  </span>
                </div>

                {reportType === 'po_ledger' ? (
                  <div className="p-2.5 bg-white dark:bg-neutral-800/80 rounded-xl border border-slate-100 dark:border-neutral-700/60">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Arrived Qtl</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {summaryMetrics.totalArrivalQtl.toFixed(2)} <span className="text-[10px] font-medium text-slate-400">QTL</span>
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-white dark:bg-neutral-800/80 rounded-xl border border-slate-100 dark:border-neutral-700/60">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Pending Qtl</span>
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono">
                      {summaryMetrics.totalPendingQtl.toFixed(2)} <span className="text-[10px] font-medium text-slate-400">QTL</span>
                    </span>
                  </div>
                )}

                <div className="p-2.5 bg-white dark:bg-neutral-800/80 rounded-xl border border-slate-100 dark:border-neutral-700/60 sm:col-span-2">
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    {reportType === 'pending_loadings' ? 'Est. Pending Value' : 'Total Trade Value'}
                  </span>
                  <span className="text-sm font-black text-slate-900 dark:text-white font-mono">
                    ₹ {formatINR(summaryMetrics.totalEstimatedValue)}
                  </span>
                </div>
              </div>

              {/* Sample preview entries */}
              {matchingEntries.length > 0 ? (
                <div className="pt-2 border-t border-slate-200/60 dark:border-neutral-800/80">
                  <span className="text-[10.5px] font-semibold text-slate-500 block mb-1.5">
                    Sample entries included in this print:
                  </span>
                  <div className="space-y-1">
                    {matchingEntries.slice(0, 3).map(e => (
                      <div key={e.id} className="text-xs text-slate-600 dark:text-slate-300 flex items-center justify-between font-mono bg-white dark:bg-neutral-800/40 p-1.5 rounded-lg border border-slate-100 dark:border-neutral-800">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{e.poNumber} • {e.buyer}</span>
                        <span>{e.poQtl} QTL @ ₹{e.rate}</span>
                      </div>
                    ))}
                    {matchingEntries.length > 3 && (
                      <span className="text-[10px] text-slate-400 italic block pt-0.5">
                        + {matchingEntries.length - 3} more entries will be printed in the tabular PDF.
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>No entries match the selected buyer, supplier, and month combination.</span>
                </div>
              )}
            </div>

            {/* Success Feedback banner */}
            {successFeedback && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successFeedback}</span>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-4 bg-slate-50/80 dark:bg-neutral-900/80 border-t border-slate-100 dark:border-neutral-800/80 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setSelectedBuyer('all');
                setSelectedSupplier('all');
                setSelectedMonth('all');
              }}
              className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 font-bold transition-colors cursor-pointer"
            >
              Reset Filters
            </button>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-neutral-700 transition-all cursor-pointer"
              >
                Close
              </button>

              <button
                type="button"
                disabled={isGenerating || matchingEntries.length === 0}
                onClick={handleGeneratePdf}
                className={cn(
                  "px-5 py-2 rounded-xl text-white font-bold text-xs shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed",
                  reportType === 'pending_loadings'
                    ? "bg-rose-600 hover:bg-rose-700"
                    : "bg-slate-900 hover:bg-slate-800 dark:bg-amber-600 dark:hover:bg-amber-700"
                )}
              >
                {isGenerating ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Compiling PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    <span>Download & Print PDF ({matchingEntries.length})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
