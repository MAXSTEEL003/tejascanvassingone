import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CreditCard,
  Calendar,
  Building2,
  User,
  FileText,
  DollarSign,
  CheckCircle2,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Receipt,
  Scale
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR, formatDateToDDMMYYYY } from '../lib/utils';

export interface PaymentEntryData {
  amount: number;
  chqNo: string;
  chqDt: string;
  bank: string;
  status: 'Cleared' | 'Not Cleared';
  shortage?: number;
  tds?: number;
  diffIn?: number;
  lh?: number;
  cc?: number;
  remarks?: string;
}

interface ArrivalPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: any;
  rowIndex: number;
  onSavePayment: (data: PaymentEntryData) => void;
  onNavigateToPayments?: () => void;
}

const COMMON_BANKS = [
  'HDFC Bank',
  'State Bank of India (SBI)',
  'ICICI Bank',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Canara Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'Union Bank of India',
  'Federal Bank',
  'IDFC First Bank',
  'IndusInd Bank',
  'RTGS / NEFT Online',
  'UPI / QR Code',
  'Cash Payment'
];

export default function ArrivalPaymentModal({
  isOpen,
  onClose,
  row,
  rowIndex,
  onSavePayment,
  onNavigateToPayments
}: ArrivalPaymentModalProps) {
  // Base Calculations from Row
  const rawQty = parseFloat(row?.qty) || 0;
  const rawRate = parseFloat(row?.rate) || 0;
  const rawGross = parseFloat(row?.amount) || (rawQty * rawRate) || 0;
  const rawNet = parseFloat(row?.netAmt) || rawGross;

  // Form States
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [refNo, setRefNo] = useState<string>('');
  const [bankName, setBankName] = useState<string>('');
  const [paymentStatus, setPaymentStatus] = useState<'Cleared' | 'Not Cleared'>('Cleared');

  // Deduction States
  const [showDeductions, setShowDeductions] = useState<boolean>(false);
  const [shortage, setShortage] = useState<string>('0');
  const [tds, setTds] = useState<string>('0');
  const [diffIn, setDiffIn] = useState<string>('0');
  const [lh, setLh] = useState<string>('0');
  const [cc, setCc] = useState<string>('0');
  const [remarks, setRemarks] = useState<string>('');

  // Sync state whenever modal opens or row changes
  useEffect(() => {
    if (row && isOpen) {
      const existingChqAm = row.chqAm !== undefined && row.chqAm !== null && String(row.chqAm).trim() !== ''
        ? parseFloat(String(row.chqAm).replace(/,/g, ''))
        : null;

      const initialAmt = (existingChqAm && existingChqAm > 0)
        ? String(existingChqAm)
        : (rawNet > 0 ? String(rawNet) : (rawGross > 0 ? String(rawGross) : ''));

      setPaymentAmount(initialAmt);
      setPaymentDate(row.chqDt ? String(row.chqDt) : new Date().toISOString().split('T')[0]);
      setRefNo(row.chqNo ? String(row.chqNo) : '');
      setBankName(row.bank ? String(row.bank) : '');

      const isAlreadyCleared = /^(cleared|clear|paid)$/i.test(String(row.noOfDayRec || '').trim());
      setPaymentStatus(isAlreadyCleared ? 'Cleared' : 'Cleared');

      setShortage(row.shortage !== undefined && row.shortage !== null ? String(row.shortage) : '0');
      setTds(row.tds !== undefined && row.tds !== null ? String(row.tds) : '0');
      setDiffIn(row.diffIn !== undefined && row.diffIn !== null ? String(row.diffIn) : '0');
      setLh(row.lh !== undefined && row.lh !== null ? String(row.lh) : '0');
      setCc(row.cc !== undefined && row.cc !== null ? String(row.cc) : '0');

      // Auto-expand deductions if row already has any deduction
      if (
        (parseFloat(row.shortage) || 0) > 0 ||
        (parseFloat(row.tds) || 0) > 0 ||
        (parseFloat(row.diffIn) || 0) > 0
      ) {
        setShowDeductions(true);
      } else {
        setShowDeductions(false);
      }
    }
  }, [row, isOpen, rawNet, rawGross]);

  // Recalculated Net Amount based on deductions
  const dynamicNetAmount = useMemo(() => {
    const s = parseFloat(shortage) || 0;
    const t = parseFloat(tds) || 0;
    const d = parseFloat(diffIn) || 0;
    const l = parseFloat(lh) || 0;
    const c = parseFloat(cc) || 0;
    return Math.max(0, rawGross - l - c - t - s - d);
  }, [rawGross, shortage, tds, diffIn, lh, cc]);

  if (!isOpen || !row) return null;

  const isAlreadyCleared = /^(cleared|clear|paid)$/i.test(String(row.noOfDayRec || '').trim());

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmt = parseFloat(paymentAmount) || 0;

    onSavePayment({
      amount: numericAmt,
      chqNo: refNo.trim(),
      chqDt: paymentDate,
      bank: bankName.trim(),
      status: paymentStatus,
      shortage: parseFloat(shortage) || 0,
      tds: parseFloat(tds) || 0,
      diffIn: parseFloat(diffIn) || 0,
      lh: parseFloat(lh) || 0,
      cc: parseFloat(cc) || 0,
      remarks: remarks.trim()
    });
  };

  const handleRevertToPending = () => {
    onSavePayment({
      amount: 0,
      chqNo: '',
      chqDt: '',
      bank: '',
      status: 'Not Cleared'
    });
  };

  const setFullAmount = () => {
    setPaymentAmount(String(dynamicNetAmount > 0 ? dynamicNetAmount : rawNet));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/70 backdrop-blur-sm select-none">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ duration: 0.2 }}
        className="bg-surface dark:bg-neutral-900 border border-outline-variant/60 rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden text-on-surface"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-outline-variant/40 bg-gradient-to-r from-emerald-600/10 via-teal-600/5 to-transparent flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-on-surface">
                  Take Payment Entry
                </h2>
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border",
                  isAlreadyCleared
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                )}>
                  {isAlreadyCleared ? 'Cleared' : 'Pending'}
                </span>
              </div>
              <p className="text-xs text-secondary">
                Auto-syncs columns in Arrival Entry and posts directly to Payments
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Invoice Summary Card */}
          <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 space-y-3">
            <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-secondary uppercase tracking-wider">
                  Bill Reference
                </span>
                <span className="text-xs font-mono font-black px-2 py-0.5 bg-surface rounded-lg border border-outline-variant/50 text-primary">
                  #{row.billNo || 'N/A'}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-secondary">
                Arrival: {formatDateToDDMMYYYY(row.date) || 'N/A'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-secondary block">Buyer (Party)</span>
                <span className="font-bold text-on-surface truncate block" title={row.partyName}>
                  {row.partyName || 'Not Assigned'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-secondary block">Supplier (Miller)</span>
                <span className="font-bold text-on-surface truncate block" title={row.millerName}>
                  {row.millerName || 'Not Assigned'}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-secondary block">Weight & Rate</span>
                <span className="font-mono font-bold text-on-surface">
                  {rawQty} QTLS @ ₹{formatINR(rawRate)}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-secondary block">Net Bill Amount (Due)</span>
                <span className="font-mono font-black text-emerald-700 dark:text-emerald-400 text-sm">
                  ₹ {formatINR(dynamicNetAmount > 0 ? dynamicNetAmount : rawNet)}
                </span>
              </div>
            </div>
          </div>

          {/* Form */}
          <form id="arrival-payment-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Amount and Full Fill Button */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Received / Settled Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={setFullAmount}
                  className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline uppercase tracking-wider cursor-pointer"
                >
                  Fill Full (₹ {formatINR(dynamicNetAmount > 0 ? dynamicNetAmount : rawNet)})
                </button>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-secondary font-mono text-sm">
                  ₹
                </span>
                <input
                  type="number"
                  step="any"
                  required
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl pl-8 pr-4 py-2.5 text-sm font-mono font-black text-on-surface outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 shadow-inner"
                />
              </div>
              {parseFloat(paymentAmount) > 0 && (
                <div className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-bold pl-1">
                  In Words: ₹ {formatINR(parseFloat(paymentAmount) || 0)}
                </div>
              )}
            </div>

            {/* Date and Cheque/UTR Reference */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                  Payment / Chq Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-on-surface outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-emerald-600" />
                  Chq / DD / UTR Ref No
                </label>
                <input
                  type="text"
                  placeholder="e.g. UTR / NEFT / Cheque No"
                  value={refNo}
                  onChange={(e) => setRefNo(e.target.value)}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2.5 text-xs font-mono font-bold text-on-surface outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                />
              </div>
            </div>

            {/* Bank Name / Payment Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                Bank Name / Payment Channel
              </label>
              <input
                type="text"
                list="arrival-payment-bank-list"
                placeholder="Select or enter bank name (e.g. HDFC Bank, RTGS, SBI)"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl px-3 py-2.5 text-xs font-bold text-on-surface outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
              />
              <datalist id="arrival-payment-bank-list">
                {COMMON_BANKS.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            {/* Deductions & Adjustments Accordion */}
            <div className="border border-outline-variant/50 rounded-2xl overflow-hidden bg-surface-container-lowest">
              <button
                type="button"
                onClick={() => setShowDeductions(!showDeductions)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-bold text-secondary hover:text-on-surface bg-surface-container-low transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Scale className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Deductions & Adjustments (Shortage, TDS, Diff In)</span>
                  {(parseFloat(shortage) > 0 || parseFloat(tds) > 0 || parseFloat(diffIn) > 0) && (
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  )}
                </div>
                {showDeductions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showDeductions && (
                <div className="p-4 space-y-3 border-t border-outline-variant/40 bg-surface">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-secondary">
                        Shortage (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={shortage}
                        onChange={(e) => setShortage(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/60 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-secondary">
                        TDS (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={tds}
                        onChange={(e) => setTds(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/60 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-secondary">
                        Diff In (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={diffIn}
                        onChange={(e) => setDiffIn(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/60 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-secondary">
                        Lorry Hire (LH) (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={lh}
                        onChange={(e) => setLh(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/60 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-secondary">
                        Commission (CC) (₹)
                      </label>
                      <input
                        type="number"
                        step="any"
                        value={cc}
                        onChange={(e) => setCc(e.target.value)}
                        className="w-full bg-surface-container-low border border-outline-variant/60 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-on-surface outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Status Radio Pills */}
            <div className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-wider text-secondary">
                Settlement Status to Apply
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPaymentStatus('Cleared')}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                    paymentStatus === 'Cleared'
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20"
                      : "bg-surface-container-low text-secondary border-outline-variant hover:bg-surface-container"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark as Cleared</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentStatus('Not Cleared')}
                  className={cn(
                    "p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer",
                    paymentStatus === 'Not Cleared'
                      ? "bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-600/20"
                      : "bg-surface-container-low text-secondary border-outline-variant hover:bg-surface-container"
                  )}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Partial / Not Cleared</span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-outline-variant/40 bg-surface-container-low flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {isAlreadyCleared && (
              <button
                type="button"
                onClick={handleRevertToPending}
                className="px-3 py-2 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer"
                title="Clear payment fields and reset row to pending"
              >
                Revert to Pending
              </button>
            )}
            {onNavigateToPayments && (
              <button
                type="button"
                onClick={onNavigateToPayments}
                className="text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Payments Page</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-secondary hover:bg-surface-container border border-outline-variant/60 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="arrival-payment-form"
              className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-lg shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save & Apply Payment</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

