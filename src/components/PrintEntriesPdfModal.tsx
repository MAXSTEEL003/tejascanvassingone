import React, { useState, useMemo } from 'react';
import { 
  X, 
  Printer, 
  FileDown, 
  Calendar, 
  User, 
  Building2, 
  CheckCircle2, 
  Sparkles,
  AlertCircle,
  ArrowUpDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { OperationalPO } from '../utils/orderOperations';
import { cn, formatINR } from '../lib/utils';

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

// Consistent Indian number formatting for quantities, rates, and amounts.
const numberFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatNumber(value: number | null | undefined): string {
  const numericValue = Number(value ?? 0);
  return Number.isFinite(numericValue) ? numberFormatter.format(numericValue) : '0.00';
}

function formatRupees(value: number | null | undefined): string {
  return `₹${formatNumber(value)}`;
}

// Helper to siphon and compact long miller/supplier corporate names
function compactMillerName(rawName: any, maxLen: number = 20): string {
  if (!rawName) return '-';
  let name = String(rawName).trim();
  if (!name || name === '-') return '-';

  // 1. Strip redundant corporate entity suffixes
  name = name.replace(/\b(private\s+limited|pvt\.?\s*ltd\.?|limited|ltd\.?|llp|inc\.?)\b/gi, '').trim();

  // 2. Siphon common grain milling qualifiers into clean short tokens
  name = name.replace(/\b(modern\s+rice\s+mills?|parboiled\s+rice\s+mills?|boiled\s+rice\s+mills?|raw\s+rice\s+mills?|rice\s+mills?|paddy\s+&\s+rice\s+mills?|rice\s+mill)\b/gi, 'Mill').trim();
  name = name.replace(/\b(agro\s+industries|agro\s+foods?|agro\s+products?|agro\s+tech)\b/gi, 'Agro').trim();
  name = name.replace(/\b(food\s+products?|foods?|food\s+processing)\b/gi, 'Foods').trim();
  name = name.replace(/\b(trading\s+co(mpany)?|traders?)\b/gi, 'Traders').trim();
  name = name.replace(/\b(corporation|corp\.?)\b/gi, 'Corp').trim();
  name = name.replace(/\b(industries|industry)\b/gi, 'Ind.').trim();
  name = name.replace(/\b(enterprises|enterprise)\b/gi, 'Ent.').trim();

  // 3. Remove excess whitespace and trailing punctuation
  name = name.replace(/\s+/g, ' ').replace(/[-.,\s]+$/, '').trim();

  // 4. Siphon / truncate neatly if still exceeding maximum length
  if (name.length > maxLen) {
    name = name.slice(0, maxLen).trim() + '…';
  }

  return name || String(rawName).trim();
}

export default function PrintEntriesPdfModal({
  isOpen,
  onClose,
  reportType,
  title,
  entries
}: PrintEntriesPdfModalProps) {
  const [selectedBuyer, setSelectedBuyer] = useState<string>('all');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('all');
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<'buyer_asc' | 'buyer_desc' | 'date_desc' | 'amount_desc' | 'qty_desc'>('buyer_asc');
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

      // Month filter (multi-month or all)
      if (selectedMonths.length > 0) {
        if (e.dateTimestamp) {
          const d = new Date(e.dateTimestamp);
          const y = d.getFullYear();
          const m = d.getMonth();
          const key = `${y}-${String(m + 1).padStart(2, '0')}`;
          if (!selectedMonths.includes(key)) return false;
        } else {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortOrder === 'buyer_asc') {
        const nameA = String(a.buyer || '').trim().toUpperCase();
        const nameB = String(b.buyer || '').trim().toUpperCase();
        if (nameA !== nameB) return nameA.localeCompare(nameB);
      } else if (sortOrder === 'buyer_desc') {
        const nameA = String(a.buyer || '').trim().toUpperCase();
        const nameB = String(b.buyer || '').trim().toUpperCase();
        if (nameA !== nameB) return nameB.localeCompare(nameA);
      } else if (sortOrder === 'amount_desc') {
        const valA = reportType === 'pending_loadings'
          ? Math.max(0, (a.poQtl || 0) - (a.arrivalQtl || 0)) * (a.rate || 0)
          : (a.poQtl || 0) * (a.rate || 0);
        const valB = reportType === 'pending_loadings'
          ? Math.max(0, (b.poQtl || 0) - (b.arrivalQtl || 0)) * (b.rate || 0)
          : (b.poQtl || 0) * (b.rate || 0);
        if (valB !== valA) return valB - valA;
      } else if (sortOrder === 'qty_desc') {
        const qA = a.poQtl || 0;
        const qB = b.poQtl || 0;
        if (qB !== qA) return qB - qA;
      }
      const aTime = Number.isFinite(new Date(a.dateTimestamp || 0).getTime())
        ? new Date(a.dateTimestamp || 0).getTime()
        : 0;
      const bTime = Number.isFinite(new Date(b.dateTimestamp || 0).getTime())
        ? new Date(b.dateTimestamp || 0).getTime()
        : 0;
      return bTime - aTime;
    });
  }, [entries, selectedBuyer, selectedSupplier, selectedMonths, sortOrder, reportType]);

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
      // Create A4 Portrait PDF for standard printing and archiving
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = doc.internal.pageSize.getWidth(); // 210mm

      // Brand Theme Colors
      const isPending = reportType === 'pending_loadings';
      const headerColor: [number, number, number] = isPending ? [159, 18, 57] : [15, 23, 42]; // Rose-900 or Slate-900
      const accentColor: [number, number, number] = isPending ? [225, 29, 72] : [190, 24, 93]; // Rose-600 or Ruby-600

      // 1. Top Header Banner (210mm x 24mm)
      doc.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
      doc.rect(0, 0, pageWidth, 24, 'F');

      // Decorative Accent Line
      doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.rect(0, 23, pageWidth, 1.2, 'F');

      // Title & Firm Header
      doc.setTextColor(241, 245, 249);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.text('TEJAS CANVASSING • COMMODITY BROKERAGE', 7, 7.5);

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14.5);
      const reportNameText = isPending ? 'PENDING LOADINGS STATEMENT' : 'PURCHASE ORDER LEDGER STATEMENT';
      doc.text(reportNameText, 7, 15);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(226, 232, 240);
      doc.text('APMC Yard, Yeshwanthpur, Bangalore - 560022 • Phone: +91 98450 12345 • GSTIN: 29AAGCV7712M1ZP', 7, 20.5);

      // Report Audit Badge (Right-aligned in header)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('OFFICIAL AUDIT REPORT', 203, 10.5, { align: 'right' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.8);
      doc.setTextColor(226, 232, 240);
      const genDate = new Date();
      doc.text(`Generated: ${genDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} ${genDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 203, 16, { align: 'right' });
      doc.text('Strictly Confidential', 203, 20.5, { align: 'right' });

      // 2. Filter Summary Card (Soft slate-50 background, 196mm wide)
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(7, 26.5, 196, 11.5, 1.2, 1.2, 'FD');

      const buyerLabel = selectedBuyer === 'all' ? 'All Buyers' : selectedBuyer;
      const supplierLabel = selectedSupplier === 'all' ? 'All Suppliers' : selectedSupplier;
      const monthLabel = selectedMonths.length === 0
        ? 'All Recorded Months'
        : selectedMonths.map(k => {
            const mObj = monthOptions.find(m => m.key === k);
            return mObj ? mObj.label : k;
          }).join(', ');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.8);
      doc.setTextColor(15, 23, 42);
      const line1 = `Buyer: ${buyerLabel}   |   Supplier: ${supplierLabel}   |   Month: ${monthLabel}`;
      doc.text(line1, 10, 31.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.2);
      doc.setTextColor(51, 65, 85);
      const sortLabel = sortOrder === 'buyer_asc'
        ? 'Buyer Name (A to Z)'
        : sortOrder === 'buyer_desc'
        ? 'Buyer Name (Z to A)'
        : sortOrder === 'amount_desc'
        ? 'Value (Highest)'
        : sortOrder === 'qty_desc'
        ? 'Quantity (Highest)'
        : 'Date (Newest)';
      const line2 = `Sort: ${sortLabel}   |   Matching Records: ${matchingEntries.length}   |   Total PO Qtl: ${formatNumber(summaryMetrics.totalPoQtl)}   |   Total Value: Rs. ${formatNumber(summaryMetrics.totalEstimatedValue)}`;
      doc.text(line2, 10, 35.8);

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
          'Arrived Qtl',
          'Pending Qtl',
          'Rate (Rs)',
          'Est. Pending (Rs)',
          'Status'
        ];

        bodyData = matchingEntries.map((e, idx) => {
          const poQ = e.poQtl || 0;
          const arrQ = e.arrivalQtl || 0;
          const pendQ = Math.max(0, poQ - arrQ);
          const diff = arrQ - poQ;
          const estAmt = pendQ * (e.rate || 0);

          let pendingDisplay = '0.00';
          if (arrQ > poQ) {
            pendingDisplay = `+${formatNumber(diff)}`;
          } else if (arrQ < poQ) {
            pendingDisplay = formatNumber(pendQ);
          }

          let statusDisplay = e.status || 'Pending';
          if (arrQ > poQ) {
            statusDisplay = 'Excess Arrived';
          } else if (arrQ === 0) {
            statusDisplay = 'Pending Load';
          } else if (arrQ < poQ) {
            statusDisplay = 'Partial Load';
          } else {
            statusDisplay = 'Fulfilled';
          }

          return [
            String(idx + 1),
            e.dateShort || e.date || '-',
            e.poNumber || '-',
            e.buyer || '-',
            compactMillerName(e.supplier, 24),
            e.brand || '-',
            formatNumber(poQ),
            formatNumber(arrQ),
            pendingDisplay,
            e.rate > 0 ? formatNumber(e.rate) : '-',
            estAmt > 0 ? formatNumber(estAmt) : '-',
            statusDisplay
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
            formatNumber(summaryMetrics.totalPoQtl),
            formatNumber(summaryMetrics.totalArrivalQtl),
            formatNumber(summaryMetrics.totalPendingQtl),
            '',
            formatNumber(summaryMetrics.totalEstimatedValue),
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
          'Rate (Rs)',
          'Total Amount (Rs)',
          'Status'
        ];

        bodyData = matchingEntries.map((e, idx) => {
          const poQ = e.poQtl || 0;
          const arrQ = e.arrivalQtl || 0;
          const diff = arrQ - poQ;
          const amt = poQ * (e.rate || 0);

          let statusDisplay = e.status || 'Active';
          if (arrQ > poQ) {
            statusDisplay = 'Excess Arrived';
          } else if (arrQ === 0) {
            statusDisplay = 'Pending Load';
          } else if (arrQ < poQ) {
            statusDisplay = 'Partial Arrival';
          } else if (poQ > 0 && arrQ === poQ) {
            statusDisplay = 'Fulfilled';
          }

          return [
            String(idx + 1),
            e.dateShort || e.date || '-',
            e.poNumber || '-',
            e.buyer || '-',
            compactMillerName(e.supplier, 24),
            e.brand || '-',
            formatNumber(poQ),
            formatNumber(arrQ),
            diff !== 0 ? (diff > 0 ? `+${formatNumber(diff)}` : formatNumber(diff)) : '0.00',
            e.rate > 0 ? formatNumber(e.rate) : '-',
            amt > 0 ? formatNumber(amt) : '-',
            statusDisplay
          ];
        });

        const totalDiff = summaryMetrics.totalArrivalQtl - summaryMetrics.totalPoQtl;
        footData = [
          [
            'TOTAL',
            `${matchingEntries.length} POs`,
            '',
            '',
            '',
            '',
            formatNumber(summaryMetrics.totalPoQtl),
            formatNumber(summaryMetrics.totalArrivalQtl),
            totalDiff !== 0 ? (totalDiff > 0 ? `+${formatNumber(totalDiff)}` : formatNumber(totalDiff)) : '0.00',
            '',
            formatNumber(summaryMetrics.totalEstimatedValue),
            ''
          ]
        ];
      }

      // 4. Render Table with autoTable
      autoTable(doc, {
        startY: 40.5,
        head: [headers],
        body: bodyData,
        foot: footData,
        theme: 'grid',
        headStyles: {
          fillColor: headerColor,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 7.2,
          cellPadding: { top: 2.2, bottom: 2.2, left: 0.8, right: 0.8 },
          lineColor: [51, 65, 85],
          lineWidth: 0.1,
          valign: 'middle',
          overflow: 'ellipsize'
        },
        bodyStyles: {
          fontSize: 7.0,
          cellPadding: { top: 1.6, bottom: 1.6, left: 0.8, right: 0.8 },
          textColor: [15, 23, 42],
          valign: 'middle',
          overflow: 'ellipsize', // Forces all entries strictly onto 1 row
          lineColor: [226, 232, 240],
          lineWidth: 0.1
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        },
        footStyles: {
          fillColor: [241, 245, 249],
          textColor: [15, 23, 42],
          fontStyle: 'bold',
          fontSize: 7.2,
          cellPadding: { top: 2.0, bottom: 2.0, left: 0.8, right: 0.8 },
          lineColor: [203, 213, 225],
          lineWidth: 0.15,
          valign: 'middle'
        },
        columnStyles: isPending ? {
          0: { cellWidth: 7, halign: 'center' }, // Sr.
          1: { cellWidth: 15, halign: 'center' }, // Date
          2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, // PO Number
          3: { cellWidth: 29, halign: 'left', fontStyle: 'bold' }, // Buyer Name
          4: { cellWidth: 25, halign: 'left' }, // Supplier / Miller
          5: { cellWidth: 16, halign: 'left' }, // Brand / Variety
          6: { cellWidth: 13, halign: 'right' }, // PO Qtl
          7: { cellWidth: 13, halign: 'right' }, // Arrived Qtl
          8: { cellWidth: 13, halign: 'right', fontStyle: 'bold' }, // Pending Qtl
          9: { cellWidth: 13, halign: 'right' }, // Rate (Rs)
          10: { cellWidth: 19, halign: 'right', fontStyle: 'bold' }, // Est. Pending (Rs)
          11: { cellWidth: 15, halign: 'center' }, // Status
        } : {
          0: { cellWidth: 7, halign: 'center' }, // Sr.
          1: { cellWidth: 15, halign: 'center' }, // Date
          2: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, // PO Number
          3: { cellWidth: 29, halign: 'left', fontStyle: 'bold' }, // Buyer Name
          4: { cellWidth: 25, halign: 'left' }, // Supplier / Miller
          5: { cellWidth: 16, halign: 'left' }, // Brand / Variety
          6: { cellWidth: 13, halign: 'right' }, // PO Qtl
          7: { cellWidth: 13, halign: 'right' }, // Arrived Qtl
          8: { cellWidth: 13, halign: 'right', fontStyle: 'bold' }, // Diff Qtl
          9: { cellWidth: 13, halign: 'right' }, // Rate (Rs)
          10: { cellWidth: 19, halign: 'right', fontStyle: 'bold' }, // Total Amount (Rs)
          11: { cellWidth: 15, halign: 'center' }, // Status
        },
        didParseCell: (data) => {
          const colIdx = data.column.index;
          if ([0, 1, 2, 11].includes(colIdx)) {
            data.cell.styles.halign = 'center';
          } else if ([3, 4, 5].includes(colIdx)) {
            data.cell.styles.halign = 'left';
          } else if ([6, 7, 8, 9, 10].includes(colIdx)) {
            data.cell.styles.halign = 'right';
          }

          if (data.section === 'body') {
            const item = matchingEntries[data.row.index];
            if (item) {
              const poQ = item.poQtl || 0;
              const arrQ = item.arrivalQtl || 0;
              const diff = arrQ - poQ;

              // Arrived Qtl (col 7): Green if excess, Red if less, Green if exact fulfilled
              if (colIdx === 7) {
                if (arrQ > poQ) {
                  data.cell.styles.textColor = [16, 185, 129]; // GREEN for excess
                  data.cell.styles.fontStyle = 'bold';
                } else if (arrQ < poQ) {
                  data.cell.styles.textColor = [225, 29, 72]; // RED for less
                  data.cell.styles.fontStyle = 'bold';
                } else if (poQ > 0) {
                  data.cell.styles.textColor = [16, 185, 129]; // GREEN for fulfilled
                  data.cell.styles.fontStyle = 'bold';
                }
              }

              // Column 8: Diff Qtl (PO Ledger) or Pending Qtl (Pending Loadings)
              if (colIdx === 8) {
                if (isPending) {
                  // In Pending Loadings: if excess arrived, show green; if shortfall/pending, show red
                  if (arrQ > poQ) {
                    data.cell.styles.textColor = [16, 185, 129]; // GREEN for excess
                    data.cell.styles.fontStyle = 'bold';
                  } else if (arrQ < poQ) {
                    data.cell.styles.textColor = [225, 29, 72]; // RED for shortfall
                    data.cell.styles.fontStyle = 'bold';
                  } else {
                    data.cell.styles.textColor = [16, 185, 129]; // GREEN (0 pending)
                  }
                } else {
                  // In PO Ledger: if excess diff > 0 -> green; if less diff < 0 -> red
                  if (diff > 0) {
                    data.cell.styles.textColor = [16, 185, 129]; // GREEN
                    data.cell.styles.fontStyle = 'bold';
                  } else if (diff < 0) {
                    data.cell.styles.textColor = [225, 29, 72]; // RED
                    data.cell.styles.fontStyle = 'bold';
                  }
                }
              }

              // Status (col 11): Green if excess/fulfilled, Red if pending/partial
              if (colIdx === 11) {
                if (arrQ > poQ) {
                  data.cell.styles.textColor = [16, 185, 129]; // GREEN
                  data.cell.styles.fontStyle = 'bold';
                } else if (arrQ < poQ) {
                  data.cell.styles.textColor = [225, 29, 72]; // RED
                  data.cell.styles.fontStyle = 'bold';
                } else if (poQ > 0) {
                  data.cell.styles.textColor = [16, 185, 129]; // GREEN
                  data.cell.styles.fontStyle = 'bold';
                }
              }
            }
          } else if (data.section === 'foot') {
            if (isPending) {
              if (colIdx === 8 && summaryMetrics.totalPendingQtl > 0) {
                data.cell.styles.textColor = [225, 29, 72]; // RED for total pending
              }
            } else {
              const totalDiff = summaryMetrics.totalArrivalQtl - summaryMetrics.totalPoQtl;
              if (colIdx === 8) {
                if (totalDiff > 0) {
                  data.cell.styles.textColor = [16, 185, 129]; // GREEN
                } else if (totalDiff < 0) {
                  data.cell.styles.textColor = [225, 29, 72]; // RED
                }
              }
            }
          }
        },
        didDrawPage: (data) => {
          // Subtle footer rule
          doc.setDrawColor(203, 213, 225);
          doc.line(7, 290, 203, 290);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(71, 85, 105);
          doc.text('TEJAS CANVASSING | Confidential Commercial Document', 7, 294);
          doc.text(`Page ${data.pageNumber}`, 203, 294, { align: 'right' });
        },
        tableWidth: 196,
        margin: { left: 7, right: 7, bottom: 12 }
      });

      // 5. Output PDF (Save & Open Preview Window)
      const cleanBuyer = selectedBuyer === 'all' ? 'AllBuyers' : selectedBuyer.replace(/[^a-zA-Z0-9]/g, '_');
      const cleanMonth = selectedMonths.length === 0 ? 'AllMonths' : selectedMonths.join('_');
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

              {/* 3. Month Selector with multi-select capability */}
              <div className="space-y-1.5 sm:col-span-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Select Month(s)</span>
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {selectedMonths.length === 0 ? 'All Months' : `${selectedMonths.length} Selected`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setSelectedMonths([])}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer",
                      selectedMonths.length === 0
                        ? "bg-amber-500 text-white border-amber-500 shadow-xs"
                        : "bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                    )}
                  >
                    All Months
                  </button>
                  {monthOptions.map(m => {
                    const isSelected = selectedMonths.includes(m.key);
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => {
                          setSelectedMonths(prev => {
                            if (prev.includes(m.key)) {
                              return prev.filter(k => k !== m.key);
                            } else {
                              return [...prev, m.key];
                            }
                          });
                        }}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5",
                          isSelected
                            ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 font-bold shadow-xs"
                            : "bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                        )}
                      >
                        <span>{m.label}</span>
                        <span className={cn(
                          "text-[10px] px-1 py-0.2 rounded-full",
                          isSelected ? "bg-amber-500 text-white font-bold" : "bg-slate-100 dark:bg-neutral-700 text-slate-500 dark:text-slate-400"
                        )}>
                          {m.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 4. Sort Order Selector */}
              <div className="space-y-1.5 sm:col-span-3">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    <span>Print Sort Order</span>
                  </label>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                    {sortOrder === 'buyer_asc' ? 'Buyer Name (A to Z) [Ascending]' : sortOrder === 'buyer_desc' ? 'Buyer Name (Z to A)' : sortOrder === 'amount_desc' ? 'Trade Value (Highest)' : 'Date (Newest)'}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => setSortOrder('buyer_asc')}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left flex items-center justify-between",
                      sortOrder === 'buyer_asc'
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 shadow-xs"
                        : "bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
                    )}
                  >
                    <span>🔤 Buyer (A to Z)</span>
                    {sortOrder === 'buyer_asc' && <span className="text-[10px] text-amber-600 font-black">✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOrder('buyer_desc')}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left flex items-center justify-between",
                      sortOrder === 'buyer_desc'
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 shadow-xs"
                        : "bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
                    )}
                  >
                    <span>🔤 Buyer (Z to A)</span>
                    {sortOrder === 'buyer_desc' && <span className="text-[10px] text-amber-600 font-black">✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOrder('date_desc')}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left flex items-center justify-between",
                      sortOrder === 'date_desc'
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 shadow-xs"
                        : "bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
                    )}
                  >
                    <span>📅 Date (Newest)</span>
                    {sortOrder === 'date_desc' && <span className="text-[10px] text-amber-600 font-black">✓</span>}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortOrder('amount_desc')}
                    className={cn(
                      "px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left flex items-center justify-between",
                      sortOrder === 'amount_desc'
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 shadow-xs"
                        : "bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
                    )}
                  >
                    <span>💰 Value (Highest)</span>
                    {sortOrder === 'amount_desc' && <span className="text-[10px] text-amber-600 font-black">✓</span>}
                  </button>
                </div>
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
                    {formatNumber(summaryMetrics.totalPoQtl)} <span className="text-[10px] font-medium text-slate-400">QTL</span>
                  </span>
                </div>

                {reportType === 'po_ledger' ? (
                  <div className="p-2.5 bg-white dark:bg-neutral-800/80 rounded-xl border border-slate-100 dark:border-neutral-700/60">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Arrived Qtl</span>
                    <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">
                      {formatNumber(summaryMetrics.totalArrivalQtl)} <span className="text-[10px] font-medium text-slate-400">QTL</span>
                    </span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-white dark:bg-neutral-800/80 rounded-xl border border-slate-100 dark:border-neutral-700/60">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Pending Qtl</span>
                    <span className="text-sm font-black text-rose-600 dark:text-rose-400 font-mono">
                      {formatNumber(summaryMetrics.totalPendingQtl)} <span className="text-[10px] font-medium text-slate-400">QTL</span>
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
                        <span>{formatNumber(e.poQtl)} QTL @ {formatRupees(e.rate)}</span>
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
                setSelectedMonths([]);
                setSortOrder('buyer_asc');
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
