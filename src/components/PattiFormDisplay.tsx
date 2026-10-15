import React from 'react';
import { 
  CheckSquare, 
  Square,
  CheckCircle2
} from 'lucide-react';
import { PattiRecordItem, formatNumberForPdf } from '../utils/pattiBookManager';
import { cn } from '../lib/utils';

interface PattiFormDisplayProps {
  patti: PattiRecordItem;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onInspect?: (patti: PattiRecordItem) => void;
  compact?: boolean;
  theme?: 'parchment' | 'clean';
}

/**
 * Format any date string into standard DD/MM/YYYY format as shown in physical Patti
 */
function formatDateDMY(val: string | undefined): string {
  if (!val) return '-';
  const clean = String(val).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) return clean;
  const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(clean);
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  }
  return clean || '-';
}

/**
 * Indian currency format with comma separators: e.g. 2,01,600.00
 */
function formatRupeesINR(val: number | null | undefined): string {
  if (val === undefined || val === null) return '0.00';
  const num = Number(val || 0);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatQtyINR(val: number | null | undefined): string {
  if (val === undefined || val === null) return '-';
  const num = Number(val || 0);
  if (isNaN(num) || num <= 0) return '-';
  return num % 1 === 0
    ? num.toLocaleString('en-IN', { maximumFractionDigits: 0 })
    : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatRateINR(val: number | null | undefined): string {
  if (val === undefined || val === null) return '-';
  const num = Number(val || 0);
  if (isNaN(num) || num <= 0) return '-';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

/**
 * Pixel-accurate representation of the physical Patti form from Tejas Canvassing.
 * Matches the reference register layout:
 * - Header: Orange TC rounded square badge + "TEJAS CANVASSING" in bold orange
 * - Dashed horizontal divider
 * - Form Table with light grey borders:
 *   - MILLERNAME | PARTYNAME | BILL NO (8 slots) | ARRIVALDT (8 slots)
 *   - RATE / QTY with light-blue highlighted Gross Amount box
 *   - Deductibles (LORRYHIRE, DISCOUNT/TDS, SELLERCOM, SHORTAGE, Q-DIFF)
 *   - Right-side Banking (CHQ AM, CHQ NO, CHQ DT, BANK)
 *   - Bottom row: TOTAL DEDUCTIBLES (soft red/pink box) | REMARKS
 */
export default function PattiFormDisplay({
  patti,
  isSelected = false,
  onToggleSelect,
  onInspect,
  compact = false
}: PattiFormDisplayProps) {
  // Build 8 bill slots
  const bills = Array(8).fill('-');
  if (patti.billNo && patti.billNo.length > 0) {
    patti.billNo.forEach((b, i) => {
      if (i < 8 && b) bills[i] = b;
    });
  } else if (patti.rawBillNo) {
    const parts = patti.rawBillNo.split(/[,/ ]+/).filter(Boolean);
    parts.forEach((b, i) => {
      if (i < 8) bills[i] = b;
    });
  }

  // Arrival date formatted as DD/MM/YYYY
  const arrivalFormatted = formatDateDMY(patti.arrivalDt || patti.date);

  return (
    <div 
      onClick={() => onInspect && onInspect(patti)}
      className={cn(
        "relative rounded-xl sm:rounded-2xl bg-white border transition-all duration-150 select-text font-sans text-slate-900 shadow-xs flex flex-col justify-between",
        isSelected 
          ? "border-amber-500 ring-2 ring-amber-500/30" 
          : "border-slate-300 hover:border-slate-400",
        compact ? "p-2 sm:p-2.5 text-[9.5px]" : "p-2.5 sm:p-3 text-[10.5px]"
      )}
    >
      {/* 1. HEADER: Orange TC Icon + TEJAS CANVASSING */}
      <div className="flex items-center justify-between pb-1.5">
        <div className="flex items-center gap-2">
          {/* Orange TC Rounded Badge */}
          <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-[#ea580c] flex items-center justify-center text-white font-black text-[9px] sm:text-[10px] tracking-tight shrink-0 shadow-2xs">
            TC
          </div>
          {/* Bold Orange Company Name */}
          <span className="font-black text-[#ea580c] tracking-wide text-xs sm:text-[13px] uppercase">
            TEJAS CANVASSING
          </span>
        </div>

        {/* Selection Checkbox & Export Status */}
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {patti.exportStatus === 'exported' && (
            <span className="hidden sm:inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
              <CheckCircle2 className="w-2.5 h-2.5" />
              <span>EXPORTED</span>
            </span>
          )}

          {onToggleSelect && (
            <button
              type="button"
              onClick={() => onToggleSelect(patti.id)}
              className={cn(
                "p-0.5 rounded cursor-pointer transition-colors",
                isSelected ? "text-amber-600" : "text-slate-400 hover:text-slate-600"
              )}
              title={isSelected ? "Deselect for A4 PDF" : "Select for A4 PDF"}
            >
              {isSelected ? <CheckSquare className="w-4 h-4 text-amber-600" /> : <Square className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Dashed Horizontal Dividing Line */}
      <div className="border-b border-dashed border-slate-300 mb-1.5" />

      {/* 2. PHYSICAL FORM DATA GRID */}
      <div className="border border-slate-300 rounded overflow-hidden bg-white text-[8.5px] sm:text-[9.5px] leading-tight">
        <table className="w-full border-collapse table-fixed text-[8.5px] sm:text-[9.5px]">
          <colgroup>
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '10%' }} />
          </colgroup>
          <tbody>
            {/* ROW 1: MILLERNAME */}
            <tr className="border-b border-slate-300">
              <td colSpan={2} className="font-extrabold uppercase bg-slate-50/90 text-slate-700 px-1.5 py-1 border-r border-slate-300 tracking-wider text-center">
                MILLERNAME
              </td>
              <td colSpan={8} className="font-extrabold text-slate-900 px-2 py-1 uppercase tracking-wide text-left truncate">
                {patti.millerName || '-'}
              </td>
            </tr>

            {/* ROW 2: PARTYNAME */}
            <tr className="border-b border-slate-300">
              <td colSpan={2} className="font-extrabold uppercase bg-slate-50/90 text-slate-700 px-1.5 py-1 border-r border-slate-300 tracking-wider text-center">
                PARTYNAME
              </td>
              <td colSpan={8} className="font-extrabold text-slate-900 px-2 py-1 uppercase tracking-wide text-left truncate">
                {patti.partyName || '-'}
              </td>
            </tr>

            {/* ROW 3: BILL NO (8 slots) */}
            <tr className="border-b border-slate-300 text-center">
              <td colSpan={2} className="font-extrabold uppercase bg-slate-50/90 text-slate-700 px-1.5 py-1 border-r border-slate-300 tracking-wider text-center">
                BILL NO
              </td>
              {bills.map((b, idx) => (
                <td 
                  key={idx} 
                  className={cn(
                    "px-0.5 py-1 font-bold text-slate-800 text-center truncate",
                    idx < 7 && "border-r border-slate-300",
                    idx === 0 && "font-black"
                  )}
                >
                  {b}
                </td>
              ))}
            </tr>

            {/* ROW 4: ARRIVALDT (Date in 1st slot, dashes in remaining) */}
            <tr className="border-b border-slate-300 text-center">
              <td colSpan={2} className="font-extrabold uppercase bg-slate-50/90 text-slate-700 px-1.5 py-1 border-r border-slate-300 tracking-wider text-center">
                ARRIVALDT
              </td>
              <td colSpan={2} className="px-1 py-1 font-bold text-slate-800 text-center border-r border-slate-300">
                {arrivalFormatted}
              </td>
              {Array(6).fill('-').map((d, idx) => (
                <td 
                  key={idx} 
                  className={cn(
                    "px-0.5 py-1 text-slate-400 text-center",
                    idx < 5 && "border-r border-slate-300"
                  )}
                >
                  {d}
                </td>
              ))}
            </tr>

            {/* ROW 5: RATE / QTY + GROSS AMOUNT (Light blue highlight) */}
            <tr className="border-b border-slate-300 text-center">
              <td colSpan={2} className="font-extrabold uppercase bg-slate-50/90 text-slate-700 px-1.5 py-1 border-r border-slate-300 tracking-wider text-center">
                RATE / QTY
              </td>
              <td colSpan={1} className="px-1 py-1 font-extrabold text-slate-900 border-r border-slate-300 text-center font-mono">
                {patti.rate > 0 ? (patti.rate).toFixed(2) : '-'}
              </td>
              <td colSpan={1} className="px-0.5 py-1 font-bold text-slate-400 border-r border-slate-300 text-center">
                x
              </td>
              <td colSpan={1} className="px-1 py-1 font-extrabold text-slate-900 border-r border-slate-300 text-center font-mono">
                {formatQtyINR(patti.qty)}
              </td>
              <td colSpan={3} className="px-2 py-1 font-black text-sky-950 bg-[#e0f2fe] text-center font-mono text-[10.5px] sm:text-[11.5px] tracking-tight border-r border-slate-300">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[7.5px] sm:text-[8px] font-black text-sky-800/80 uppercase tracking-wider">GROSS:</span>
                  <span className="font-extrabold">{formatRupeesINR(patti.grossAmount)}</span>
                </div>
              </td>
              <td colSpan={2} className="bg-slate-50/70 border-r border-slate-300 text-[7.5px] font-black uppercase tracking-wider text-slate-400 text-center py-1">
                SETTLEMENT DETAILS
              </td>
            </tr>

            {/* ROW 6: LORRYHIRE & CHQ AM */}
            <tr className="border-b border-slate-300">
              <td colSpan={2} className="font-medium underline uppercase bg-slate-50/90 text-slate-700 px-1.5 py-0.5 border-r border-slate-300 tracking-wider text-center">
                LORRYHIRE
              </td>
              <td colSpan={1} className="px-1 py-0.5 font-bold text-slate-800 text-center border-r border-slate-300 font-mono">
                {patti.lorrySmall > 0 ? formatRupeesINR(patti.lorrySmall) : '-'}
              </td>
              <td colSpan={1} className="border-r border-slate-300 text-slate-300 text-center">
                -
              </td>
              <td colSpan={1} className="border-r border-slate-300 text-slate-300 text-center">
                -
              </td>
              <td colSpan={3} className="px-2 py-0.5 font-black text-rose-700 bg-rose-500/[0.06] text-center border-r border-slate-300 font-mono text-[10px] sm:text-[11px] tracking-tight">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[7.5px] sm:text-[8px] font-black text-rose-600/80 uppercase tracking-wider">TOTAL DED:</span>
                  <span className="font-extrabold">{patti.expensesSum > 0 ? formatRupeesINR(patti.expensesSum) : '0.00'}</span>
                </div>
              </td>
              <td colSpan={1} className="font-extrabold uppercase bg-slate-50/90 text-slate-700 px-1 py-0.5 border-r border-slate-300 text-center tracking-wider text-[8px]">
                CHQ AM
              </td>
              <td colSpan={1} className="px-1 py-0.5 text-slate-800 text-center font-mono font-bold truncate">
                {patti.chqAm > 0 ? formatRupeesINR(patti.chqAm) : '-'}
              </td>
            </tr>

            {/* ROW 7: DISCOUNT / TDS & CHQ NO */}
            <tr className="border-b border-slate-300">
              <td colSpan={2} className="font-medium underline uppercase bg-slate-50/90 text-slate-700 px-1.5 py-0.5 border-r border-slate-300 tracking-wider text-center leading-none">
                <span className="block">DISCOUNT / TDS</span>
                <span className="text-[7.5px] text-slate-400 font-normal">
                  ({patti.discountPct || '0%'})
                </span>
              </td>
              <td colSpan={1} className="px-1 py-0.5 font-bold text-slate-800 text-center border-r border-slate-300 font-mono">
                {patti.discountPct || '0%'}
              </td>
              <td colSpan={1} className="px-0.5 py-0.5 font-bold text-rose-600 text-center border-r border-slate-300 font-mono truncate">
                {patti.discountAmount > 0 ? formatRupeesINR(patti.discountAmount) : '0.00'}
              </td>
              <td colSpan={1} className="border-r border-slate-300 text-slate-300 text-center">
                -
              </td>
              <td colSpan={3} className="px-2 py-0.5 font-black text-emerald-900 bg-[#dcfce7] text-center border-r border-slate-300 font-mono text-[10.5px] sm:text-[11.5px] tracking-tight">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[7.5px] sm:text-[8px] font-black text-emerald-700 uppercase tracking-wider">NET AMT:</span>
                  <span className="font-black text-emerald-950">{patti.netAmount > 0 ? formatRupeesINR(patti.netAmount) : '0.00'}</span>
                </div>
              </td>
              <td colSpan={1} className="font-extrabold uppercase bg-slate-50/90 text-slate-700 px-1 py-0.5 border-r border-slate-300 text-center tracking-wider text-[8px]">
                CHQ NO
              </td>
              <td colSpan={1} className="px-1 py-0.5 text-slate-800 text-center font-mono font-semibold truncate">
                {patti.chqNo || '-'}
              </td>
            </tr>

            {/* ROW 8: SELLERCOM & CHQ DT */}
            <tr className="border-b border-slate-300">
              <td colSpan={2} className="font-medium underline uppercase bg-slate-50/90 text-slate-700 px-1.5 py-0.5 border-r border-slate-300 tracking-wider text-center">
                SELLERCOM
              </td>
              <td colSpan={1} className="px-1 py-0.5 font-bold text-slate-800 text-center border-r border-slate-300 font-mono">
                {patti.sellerCom > 0 ? formatRupeesINR(patti.sellerCom) : '-'}
              </td>
              <td colSpan={2} className="border-r border-slate-300 text-slate-300 text-center">
                -
              </td>
              <td colSpan={3} className="px-2 py-0.5 font-black text-blue-800 bg-blue-500/[0.05] text-center border-r border-slate-300 font-mono text-[10px] sm:text-[11px] tracking-tight">
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[7.5px] sm:text-[8px] font-black text-blue-600/80 uppercase tracking-wider">CHQ PAID:</span>
                  <span className="font-extrabold">{patti.chqAm > 0 ? formatRupeesINR(patti.chqAm) : '0.00'}</span>
                </div>
              </td>
              <td colSpan={1} className="font-extrabold uppercase bg-slate-50/90 text-slate-700 px-1 py-0.5 border-r border-slate-300 text-center tracking-wider text-[8px]">
                CHQ DT
              </td>
              <td colSpan={1} className="px-1 py-0.5 text-slate-800 text-center font-mono font-semibold text-[8px] truncate">
                {patti.chqDt ? formatDateDMY(patti.chqDt) : (patti.clearedDate ? formatDateDMY(patti.clearedDate) : '-')}
              </td>
            </tr>

            {/* ROW 9: SHORTAGE & BANK */}
            <tr className="border-b border-slate-300">
              <td colSpan={2} className="font-extrabold underline uppercase bg-slate-50/90 text-rose-600 px-1.5 py-0.5 border-r border-slate-300 tracking-wider text-center">
                SHORTAGE
              </td>
              <td colSpan={1} className="px-1 py-0.5 font-bold text-slate-800 text-center border-r border-slate-300 font-mono">
                {patti.manualShortage > 0 ? formatRupeesINR(patti.manualShortage) : '0'}
              </td>
              <td colSpan={2} className="border-r border-slate-300 text-slate-300 text-center">
                -
              </td>
              <td colSpan={3} className={cn(
                "px-2 py-0.5 font-black text-center border-r border-slate-300 font-mono text-[10px] sm:text-[11px] tracking-tight",
                patti.shortageDelta >= 0 ? "text-emerald-900 bg-[#e6f9f0]" : "text-rose-700 bg-rose-50"
              )}>
                <div className="flex items-center justify-center gap-1.5">
                  <span className="text-[7.5px] sm:text-[8px] font-black opacity-80 uppercase tracking-wider">SHORTAGE Δ:</span>
                  <span className="font-extrabold">{formatRupeesINR(patti.shortageDelta)}</span>
                </div>
              </td>
              <td colSpan={1} className="font-extrabold uppercase bg-slate-50/90 text-slate-700 px-1 py-0.5 border-r border-slate-300 text-center tracking-wider text-[8px]">
                BANK
              </td>
              <td colSpan={1} className="px-1 py-0.5 text-slate-800 text-center text-[8px] truncate font-medium">
                {patti.bank || '-'}
              </td>
            </tr>

            {/* ROW 10: Q-DIFF */}
            <tr className="border-b border-slate-300">
              <td colSpan={2} className="font-extrabold uppercase bg-slate-50/90 text-slate-700 px-1.5 py-0.5 border-r border-slate-300 tracking-wider text-center">
                Q-DIFF
              </td>
              <td colSpan={1} className="px-1 py-0.5 font-bold text-slate-800 text-center border-r border-slate-300 font-mono">
                {patti.qDiff > 0 ? formatRupeesINR(patti.qDiff) : '0'}
              </td>
              <td colSpan={7} className="text-slate-300 text-center">
                -
              </td>
            </tr>

            {/* ROW 11: TOTAL DEDUCTIBLES (Pink/red highlight) & REMARKS */}
            <tr>
              <td colSpan={2} className="font-black uppercase bg-slate-50/90 text-slate-700 px-1.5 py-1 border-r border-slate-300 tracking-tighter text-center text-[8px] sm:text-[8.5px]">
                TOTAL DEDUCTIBLES
              </td>
              <td colSpan={2} className="px-2 py-1 font-black text-rose-700 bg-[#fee2e2] text-center font-mono border-r border-slate-300 text-[9.5px] sm:text-[10.5px] truncate">
                {formatRupeesINR(patti.expensesSum)}
              </td>
              <td colSpan={1} className="font-black uppercase bg-slate-50/90 text-slate-500 px-1 py-1 border-r border-slate-300 text-center tracking-wider text-[7.5px]">
                REMARKS:
              </td>
              <td colSpan={5} className="px-2 py-1 text-slate-700 italic text-left truncate text-[8.5px] sm:text-[9.5px] font-semibold">
                {patti.remarks || '-'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
