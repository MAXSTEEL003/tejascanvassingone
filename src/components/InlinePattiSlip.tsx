import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Copy, 
  CheckCircle2, 
  ExternalLink, 
  X,
  ClipboardList
} from 'lucide-react';
import { cn, formatINR } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import html2canvas from 'html2canvas';

interface InlinePattiSlipProps {
  txn: any;
  onOpenFullPatti?: (txn: any) => void;
  onClose?: () => void;
}

interface PattiFormData {
  millerName: string;
  partyName: string;
  billNo: string[];
  arrivalDt: string;
  rateQty: string;
  rateRate: string;
  rateAmount: string; // E5
  lorrySmall: string; // B6
  discountPct: string; // Selected %
  discountAmount: string; // B7
  sellerCom: string; // B8
  manualShortage: string; // B9
  qDiff: string; // B10
  expensesSum: string; // B11
  netAmount: string; // E11
  chqAm: string; // I6
  chqNo: string; // I7
  chqDt: string; // I8
  bank: string; // I9
  remarks: string; // D10
  shortageDelta: string; // E9 (Calculated delta)
}

const LabelCell = ({ 
  children, 
  className,
  borderClass = "border-neutral-300 dark:border-neutral-800",
  bgClass = "bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400"
}: { 
  children: React.ReactNode, 
  className?: string,
  borderClass?: string,
  bgClass?: string
}) => (
  <div className={cn("border-r border-b p-2 flex items-center justify-center text-[10px] font-black uppercase tracking-wider text-center select-none", borderClass, bgClass, className)}>
    {children}
  </div>
);

const InputCell: React.FC<{ 
  value: string, 
  onChange: (v: string) => void, 
  className?: string, 
  readOnly?: boolean,
  borderClass?: string,
  activeTextClass?: string,
  readOnlyBgClass?: string
}> = ({ 
  value, 
  onChange, 
  className, 
  readOnly,
  borderClass = "border-neutral-300 dark:border-neutral-800",
  activeTextClass = "text-neutral-900 dark:text-neutral-100",
  readOnlyBgClass = "bg-neutral-50/50 dark:bg-neutral-900/50 text-primary"
}) => (
  <div className={cn("border-r border-b h-full", borderClass, className)}>
    <input 
      type="text" 
      value={value}
      onChange={(e) => !readOnly && onChange(e.target.value)}
      readOnly={readOnly}
      className={cn(
        "w-full h-full bg-transparent p-2 text-sm font-semibold outline-none text-center placeholder:text-neutral-400",
        readOnly ? readOnlyBgClass : activeTextClass
      )}
    />
  </div>
);

// Safe converter for OKLCH and OKLAB colors to standard RGB strings for html2canvas
function convertOklchAndOklabColorInString(val: string): string {
  if (!val || typeof val !== 'string') return val;

  let result = val;

  if (result.includes('oklch')) {
    result = result.replace(/oklch\(([^)]+)\)/gi, (match, innerText) => {
      const parts = innerText.split(/[\s,\/]+/).filter((p: string) => p.trim() !== '');
      if (parts.length < 3) return match;

      const parseOklchValue = (v: string, max: number): number => {
        if (v.endsWith('%')) return (parseFloat(v) / 100) * max;
        return parseFloat(v);
      };

      const L = isNaN(parseOklchValue(parts[0], 1)) ? 0 : parseOklchValue(parts[0], 1);
      const C = isNaN(parseOklchValue(parts[1], 1)) ? 0 : parseOklchValue(parts[1], 1);
      let H_str = parts[2] || '0';
      if (H_str.endsWith('deg')) H_str = H_str.slice(0, -3);
      const H = isNaN(parseFloat(H_str)) ? 0 : parseFloat(H_str);
      const alpha = parts[3] !== undefined ? parseOklchValue(parts[3], 1) : 1;

      const hRad = (H * Math.PI) / 180;
      const oa = C * Math.cos(hRad);
      const ob = C * Math.sin(hRad);

      const l_ = L + 0.3963377774 * oa + 0.2158037573 * ob;
      const m_ = L - 0.1055613458 * oa - 0.0638541728 * ob;
      const s_ = L - 0.0894841775 * oa - 1.2914855480 * ob;

      const l = l_ * l_ * l_;
      const m = m_ * m_ * m_;
      const s = s_ * s_ * s_;

      const rL = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
      const gL = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
      const bL = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

      const f = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
      const r = Math.round(Math.max(0, Math.min(1, f(rL))) * 255);
      const g = Math.round(Math.max(0, Math.min(1, f(gL))) * 255);
      const b = Math.round(Math.max(0, Math.min(1, f(bL))) * 255);

      return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
  }

  if (result.includes('oklab')) {
    result = result.replace(/oklab\(([^)]+)\)/gi, (match, innerText) => {
      const parts = innerText.split(/[\s,\/]+/).filter((p: string) => p.trim() !== '');
      if (parts.length < 3) return match;

      const parseOklabValue = (v: string, max: number): number => {
        if (v.endsWith('%')) return (parseFloat(v) / 100) * max;
        return parseFloat(v);
      };

      const ok_L = isNaN(parseOklabValue(parts[0], 1)) ? 0 : parseOklabValue(parts[0], 1);
      const ok_a = isNaN(parseOklabValue(parts[1], 1)) ? 0 : parseOklabValue(parts[1], 1);
      const ok_b = isNaN(parseOklabValue(parts[2], 1)) ? 0 : parseOklabValue(parts[2], 1);
      const alpha = parts[3] !== undefined ? parseOklabValue(parts[3], 1) : 1;

      const l_ = ok_L + 0.3963377774 * ok_a + 0.2158037573 * ok_b;
      const m_ = ok_L - 0.1055613458 * ok_a - 0.0638541728 * ok_b;
      const s_ = ok_L - 0.0894841775 * ok_a - 1.2914855480 * ok_b;

      const l = l_ * l_ * l_;
      const m = m_ * m_ * m_;
      const s = s_ * s_ * s_;

      const rL = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
      const gL = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
      const bL = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;

      const f = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);
      const r = Math.round(Math.max(0, Math.min(1, f(rL))) * 255);
      const g = Math.round(Math.max(0, Math.min(1, f(gL))) * 255);
      const b = Math.round(Math.max(0, Math.min(1, f(bL))) * 255);

      return alpha === 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
  }

  return result;
}

const createComputedStyleProxy = (win: Window) => {
  const orig = win.getComputedStyle;
  return function (elt: Element, pseudoElt?: string | null) {
    const style = orig.call(win, elt, pseudoElt);
    if (!style) return style;

    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function (propertyName: string) {
            const rawVal = target.getPropertyValue(propertyName);
            if (typeof rawVal === 'string' && (rawVal.includes('oklch') || rawVal.includes('oklab'))) {
              return convertOklchAndOklabColorInString(rawVal);
            }
            return rawVal;
          };
        }

        const val = target[prop as any];
        if (typeof val === 'function') {
          return val.bind(target);
        }

        if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
          return convertOklchAndOklabColorInString(val);
        }
        return val;
      }
    });
  };
};

export default function InlinePattiSlip({ txn, onOpenFullPatti, onClose }: InlinePattiSlipProps) {
  const navigate = useNavigate();
  const formId = `patti-ledger-form-${String(txn.id || 'slip').replace(/[^a-zA-Z0-9]/g, '-')}`;

  // Extract raw source row matching arrival columns
  const rawRow = txn.rawRow || txn.matchingArrival || {};

  const getVal = (keys: string[], fallback: string = ''): string => {
    const sources = [rawRow, txn];
    for (const src of sources) {
      if (!src) continue;
      for (const k of keys) {
        if (k in src && src[k] !== null && src[k] !== undefined && String(src[k]).trim() !== '') {
          return String(src[k]);
        }
      }
    }
    return fallback;
  };

  const initialMiller = getVal(['millerName', 'miller', 'supplier'], txn.supplier || '');
  const initialParty = getVal(['partyName', 'party', 'buyer'], txn.buyer || '');
  const initialArrivalDt = getVal(['date', 'arrivalDt', 'arrival_date'], txn.date || new Date().toISOString().split('T')[0]);
  const initialQty = getVal(['qty', 'rateQty', 'quantity'], String(txn.qty || '100'));
  const initialRate = getVal(['rate', 'rateRate', 'price'], String(txn.rate || '4200'));

  const initialLorrySmall = getVal(['lh', 'lorrySmall', 'lorry_hire', 'freight'], '0');
  const initialSellerCom = getVal(['cc', 'sellerCom', 'commission'], '0');
  const initialShortage = getVal(['shortage', 'manualShortage', 'shortage_val'], String(txn.shortage || '0'));
  const initialQDiff = getVal(['diffIn', 'qDiff', 'diff_in', 'quality_difference'], '0');
  const initialChqAm = getVal(['chqAm', 'chq_am', 'cheque_amount', 'chequeAmount'], String(txn.chqAm || '0'));
  const initialChqNo = getVal(['chqNo', 'chq_no', 'cheque_no', 'chequeNumber'], txn.chqNo || '');
  const initialChqDt = getVal(['chqDt', 'chq_dt', 'cheque_date', 'chequeDate'], txn.chqDt || '');
  const initialBank = getVal(['bank', 'bank_name'], txn.bank || '');
  const initialRemarks = getVal(['remarks'], '');

  // 8 Bill numbers initialization matching PattiView
  const rawBillNumber = getVal(['billNo', 'bill_no', 'billNumber'], txn.billNo || txn.id || '');
  let initialBills = ['', '', '', '', '', '', '', ''];
  if (Array.isArray(rawRow.billNo)) {
    initialBills = [...rawRow.billNo, '', '', '', '', '', '', ''].slice(0, 8);
  } else if (rawBillNumber) {
    const parts = String(rawBillNumber).split(/[, ]+/).filter(Boolean);
    for (let i = 0; i < 8; i++) {
      initialBills[i] = parts[i] || '';
    }
  }

  // Calculate gross amount & initial discount percentage
  const numQty = parseFloat(initialQty) || 0;
  const numRate = parseFloat(initialRate) || 0;
  const initialGross = numQty * numRate;

  let initialDiscountPct = '0';
  let initialIsManual = false;
  const explicitTds = getVal(['tds', 'discountAmount', 'discount'], '');
  if (explicitTds && parseFloat(explicitTds) > 0 && initialGross > 0) {
    initialDiscountPct = String((parseFloat(explicitTds) / initialGross).toFixed(6));
    initialIsManual = true;
  } else if (initialArrivalDt && initialChqDt) {
    const start = new Date(initialArrivalDt);
    const end = new Date(initialChqDt);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 14) initialDiscountPct = '0.04';
      else if (diffDays <= 28) initialDiscountPct = '0.03';
      else if (diffDays <= 42) initialDiscountPct = '0.02';
      else if (diffDays <= 56) initialDiscountPct = '0.01';
    }
  } else if (txn.daysOutstanding) {
    const days = txn.daysOutstanding;
    if (days <= 14) initialDiscountPct = '0.04';
    else if (days <= 28) initialDiscountPct = '0.03';
    else if (days <= 42) initialDiscountPct = '0.02';
    else if (days <= 56) initialDiscountPct = '0.01';
  }

  const [formData, setFormData] = useState<PattiFormData>({
    millerName: initialMiller,
    partyName: initialParty,
    billNo: initialBills,
    arrivalDt: initialArrivalDt,
    rateQty: initialQty,
    rateRate: initialRate,
    rateAmount: initialGross.toFixed(2),
    lorrySmall: initialLorrySmall,
    discountPct: initialDiscountPct,
    discountAmount: '0',
    sellerCom: initialSellerCom,
    manualShortage: initialShortage,
    qDiff: initialQDiff,
    expensesSum: '0',
    netAmount: '0',
    chqAm: initialChqAm,
    chqNo: initialChqNo,
    chqDt: initialChqDt,
    bank: initialBank,
    remarks: initialRemarks,
    shortageDelta: '0'
  });

  const [isManualDiscount, setIsManualDiscount] = useState<boolean>(initialIsManual);
  const [copied, setCopied] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  // Exact configuration matching PattiView
  const printConfig = {
    gstin: '03AABCR1234F1ZP',
    address: 'Depot No. 4, Commercial Complex, Punjab, India',
    phone: '+91 98881-22334',
    pattiNo: `PATTI-${String(rawBillNumber || txn.id || Math.floor(100000 + Math.random() * 900000)).replace(/[^a-zA-Z0-9]/g, '').slice(-8)}`,
    terms: 'SUBJECT TO DEPOT JURISDICTION. WEIGHTS REGISTERED ON THE COMPUTERIZED WEIGHBRIDGE SYSTEM APPLY. BROKER COMMISSIONS AS APPLICABLE.',
    signatureTitle1: 'Prepared By (Broker)',
    signatureTitle2: 'Verified Surveyor',
    signatureTitle3: 'Depot Manager'
  };

  // Exact color mapping from PattiView.tsx (Classic Theme)
  const colors = {
    border: 'border-neutral-300 dark:border-neutral-800',
    textMain: 'text-neutral-900 dark:text-neutral-100',
    labelBg: 'bg-neutral-100 dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400',
    primaryText: 'text-amber-600 dark:text-amber-400',
    netBg: 'bg-emerald-500/[0.04] text-emerald-600 dark:text-emerald-400 font-black',
    dedBg: 'bg-rose-500/[0.03] text-rose-600 dark:text-rose-400 font-bold',
    accentBg: 'bg-blue-500/[0.02] text-blue-600 dark:text-blue-400',
    borderExact: '#d4d4d4',
    badgeBorder: 'border-emerald-500/25',
    badgeText: 'text-emerald-600',
    logoBg: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white'
  };

  // Calculation Engine matching PattiView.tsx exactly
  useEffect(() => {
    // 1. Calculate Amount (E5)
    const qty = parseFloat(formData.rateQty) || 0;
    const rate = parseFloat(formData.rateRate) || 0;
    const amount = qty * rate;

    // 2. Calculate Days Difference for Auto-Discount
    let autoPct = 0;
    if (formData.arrivalDt && formData.chqDt) {
      const start = new Date(formData.arrivalDt);
      const end = new Date(formData.chqDt);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        const diffTime = end.getTime() - start.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 14) autoPct = 0.04;
        else if (diffDays <= 28) autoPct = 0.03;
        else if (diffDays <= 42) autoPct = 0.02;
        else if (diffDays <= 56) autoPct = 0.01;
      }
    } else if (txn.daysOutstanding) {
      const days = txn.daysOutstanding;
      if (days <= 14) autoPct = 0.04;
      else if (days <= 28) autoPct = 0.03;
      else if (days <= 42) autoPct = 0.02;
      else if (days <= 56) autoPct = 0.01;
    }

    const currentPct = isManualDiscount ? parseFloat(formData.discountPct) : autoPct;
    const discountAmount = Math.round((amount * currentPct) * 100) / 100;

    // 3. Calculate Expenses Sum
    const l = parseFloat(formData.lorrySmall) || 0;
    const s = parseFloat(formData.sellerCom) || 0;
    const ms = parseFloat(formData.manualShortage) || 0;
    const q = parseFloat(formData.qDiff) || 0;
    const expensesSum = l + discountAmount + s + ms + q;

    // 4. Calculate Net Amount (E7/E11)
    const netAmount = amount - expensesSum;

    // 5. Calculate Shortage Delta (E9) = Cheque - Net Amount
    const chq = parseFloat(formData.chqAm) || 0;
    const delta = chq - netAmount;

    setFormData(prev => {
      if (
        prev.rateAmount === amount.toFixed(2) &&
        prev.discountPct === currentPct.toString() &&
        prev.discountAmount === discountAmount.toFixed(2) &&
        prev.expensesSum === expensesSum.toFixed(2) &&
        prev.netAmount === netAmount.toFixed(2) &&
        prev.shortageDelta === delta.toFixed(2)
      ) return prev;

      return {
        ...prev,
        rateAmount: amount.toFixed(2),
        discountPct: currentPct.toString(),
        discountAmount: discountAmount.toFixed(2),
        expensesSum: expensesSum.toFixed(2),
        netAmount: netAmount.toFixed(2),
        shortageDelta: delta.toFixed(2)
      };
    });
  }, [
    formData.rateQty, 
    formData.rateRate, 
    formData.arrivalDt, 
    formData.chqDt, 
    formData.lorrySmall, 
    formData.sellerCom, 
    formData.manualShortage, 
    formData.qDiff, 
    formData.chqAm, 
    formData.discountPct, 
    isManualDiscount,
    txn.daysOutstanding
  ]);

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const updateArrayField = (field: 'billNo', index: number, value: string) => {
    setFormData(prev => {
      const newArr = [...prev[field]];
      newArr[index] = value;
      return { ...prev, [field]: newArr };
    });
  };

  // Exact ASCII summary format matching PattiView
  const copyPattiToClipboard = () => {
    const formattedBills = formData.billNo.filter(b => b.trim() !== '').join(', ') || 'N/A';
    
    const summary = `===========================================
        PATTI LEDGER RECEIPT SUMMARY
===========================================
Patti Ref  : ${printConfig.pattiNo}
GSTIN      : ${printConfig.gstin}
Depot      : ${printConfig.address}
Phone      : ${printConfig.phone}

-------------------------------------------
Miller Name: ${formData.millerName || 'N/A'}
Party Name : ${formData.partyName || 'N/A'}
Date       : ${formData.arrivalDt || 'N/A'}
Bill/Lorry No(s): ${formattedBills}

-------------------------------------------
TRANSACTION METRICS
-------------------------------------------
Quantity   : ${formData.rateQty} Bags / Metric Units
Rate       : ₹${formData.rateRate} per unit
Gross Amt  : ₹${parseFloat(formData.rateAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}

-------------------------------------------
DEDUCTIONS & EXPENSES
-------------------------------------------
Lorry Small: ₹${parseFloat(formData.lorrySmall).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Discount   : ₹${parseFloat(formData.discountAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} (${(parseFloat(formData.discountPct) * 100).toFixed(0)}%)
Seller Com : ₹${parseFloat(formData.sellerCom).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Shortage   : ₹${parseFloat(formData.manualShortage).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Q-Diff     : ₹${parseFloat(formData.qDiff).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
-------------------------------------------
Total Ded. : ₹${parseFloat(formData.expensesSum).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Net Amount : ₹${parseFloat(formData.netAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}

-------------------------------------------
SETTLEMENT & BANKING
-------------------------------------------
Cheque Amt : ₹${parseFloat(formData.chqAm).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Cheque No  : ${formData.chqNo || 'N/A'}
Cheque Date: ${formData.chqDt || 'N/A'}
Bank Name  : ${formData.bank || 'N/A'}
-------------------------------------------
Shortage Delta: ₹${parseFloat(formData.shortageDelta).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
Remarks    : ${formData.remarks || 'None'}

-------------------------------------------
Terms      : ${printConfig.terms}
===========================================
Generated via GrainMart B2B Depot Terminal.`;

    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      alert('Failed to copy. Please check browser permissions.');
    });
  };

  // Exact high-fidelity Copy as Image matching PattiView
  const copyPattiAsImage = async () => {
    const element = document.getElementById(formId);
    if (element) {
      const originalGetComputedStyle = window.getComputedStyle;
      window.getComputedStyle = createComputedStyleProxy(window) as any;

      try {
        const canvas = await html2canvas(element, {
          scale: 3, 
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            if (clonedDoc.defaultView) {
              clonedDoc.defaultView.getComputedStyle = createComputedStyleProxy(clonedDoc.defaultView) as any;
            }

            clonedDoc.querySelectorAll('style').forEach(styleTag => {
              if (styleTag.textContent) {
                styleTag.textContent = convertOklchAndOklabColorInString(styleTag.textContent);
              }
            });

            try {
              const sheets = Array.from(clonedDoc.styleSheets);
              sheets.forEach((sheet: any) => {
                try {
                  const rules = sheet.cssRules || sheet.rules;
                  if (rules) {
                    for (let i = 0; i < rules.length; i++) {
                      const rule = rules[i];
                      if (rule.style) {
                        for (let j = 0; j < rule.style.length; j++) {
                          const propName = rule.style[j];
                          const propVal = rule.style.getPropertyValue(propName);
                          if (propVal && (propVal.includes('oklch') || propVal.includes('oklab'))) {
                            rule.style.setProperty(propName, convertOklchAndOklabColorInString(propVal));
                          }
                        }
                      }
                    }
                  }
                } catch (err) {}
              });
            } catch (e) {}

            const clonedEl = clonedDoc.getElementById(formId);
            if (clonedEl) {
              const originalElContainer = document.getElementById(formId)!;
              clonedEl.style.fontFamily = 'Arial, sans-serif';
              clonedEl.style.color = '#000000';
              clonedEl.style.backgroundColor = '#ffffff';

              const propsToConvert = [
                'color',
                'backgroundColor',
                'borderColor',
                'borderTopColor',
                'borderBottomColor',
                'borderLeftColor',
                'borderRightColor',
                'boxShadow',
                'outlineColor',
                'fill',
                'stroke'
              ];

              const convertTree = (originalNode: HTMLElement, clonedNode: HTMLElement) => {
                const style = originalGetComputedStyle(originalNode);
                if (style) {
                  for (const prop of propsToConvert) {
                    const val = style[prop as any];
                    if (typeof val === 'string' && (val.includes('oklch') || val.includes('oklab'))) {
                      clonedNode.style[prop as any] = convertOklchAndOklabColorInString(val);
                    }
                  }
                }

                if (originalNode instanceof HTMLInputElement && clonedNode instanceof HTMLInputElement) {
                  clonedNode.value = originalNode.value;
                  clonedNode.style.color = '#000000';
                  clonedNode.style.fontWeight = 'bold';
                  clonedNode.style.backgroundColor = 'transparent';
                  clonedNode.style.border = 'none';
                  clonedNode.style.opacity = '1';
                }
                if (originalNode instanceof HTMLSelectElement && clonedNode instanceof HTMLSelectElement) {
                  clonedNode.value = originalNode.value;
                  clonedNode.style.color = '#000000';
                  clonedNode.style.fontWeight = 'bold';
                  clonedNode.style.backgroundColor = 'transparent';
                  clonedNode.style.border = 'none';
                  clonedNode.style.opacity = '1';
                }

                const classList = clonedNode.classList;
                if (classList) {
                  if (classList.contains('text-rose-600')) clonedNode.style.color = '#e11d48';
                  if (classList.contains('text-emerald-600')) clonedNode.style.color = '#059669';
                  if (classList.contains('text-sky-600')) clonedNode.style.color = '#0284c7';
                  if (classList.contains('text-blue-600')) clonedNode.style.color = '#2563eb';
                  if (classList.contains('text-indigo-600')) clonedNode.style.color = '#4f46e5';
                  if (classList.contains('text-amber-600')) clonedNode.style.color = '#ea580c';
                  
                  if (classList.contains('bg-rose-500/[0.03]') || classList.contains('bg-rose-50')) {
                    clonedNode.style.backgroundColor = '#fff1f2';
                  }
                  if (classList.contains('bg-emerald-500/[0.04]') || classList.contains('bg-emerald-50')) {
                    clonedNode.style.backgroundColor = '#ecfdf5';
                  }
                  if (classList.contains('bg-sky-500/[0.04]') || classList.contains('bg-sky-50')) {
                    clonedNode.style.backgroundColor = '#f0f9ff';
                  }
                  if (classList.contains('bg-neutral-100')) {
                    clonedNode.style.backgroundColor = '#f5f5f5';
                  }
                }

                const originalChildren = Array.from(originalNode.children) as HTMLElement[];
                const clonedChildren = Array.from(clonedNode.children) as HTMLElement[];
                for (let i = 0; i < originalChildren.length; i++) {
                  if (clonedChildren[i]) {
                    convertTree(originalChildren[i], clonedChildren[i]);
                  }
                }
              };

              convertTree(originalElContainer, clonedEl);
            }
          }
        });

        canvas.toBlob((blob) => {
          if (blob) {
            const item = new ClipboardItem({ 'image/png': blob });
            navigator.clipboard.write([item]).then(() => {
              setCopiedImage(true);
              setTimeout(() => setCopiedImage(false), 2050);
            }).catch(err => {
              console.error('Clipboard write error:', err);
              // Fallback download if clipboard is restricted
              const link = document.createElement('a');
              link.download = `Patti_Receipt_${formData.partyName || 'Trade'}_${printConfig.pattiNo}.png`;
              link.href = canvas.toDataURL('image/png');
              link.click();
              setCopiedImage(true);
              setTimeout(() => setCopiedImage(false), 2050);
            });
          }
        }, 'image/png');
      } catch (error) {
        console.error('Copy Image Error:', error);
        alert('Failed to copy. Please use the Print or Full Ledger option.');
      } finally {
        window.getComputedStyle = originalGetComputedStyle;
      }
    }
  };

  const handlePrint = () => {
    const el = document.getElementById(formId);
    if (!el) return;

    const printWin = window.open('', '', 'width=1100,height=800');
    if (printWin) {
      printWin.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Patti Receipt - ${printConfig.pattiNo}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @page { size: landscape; margin: 0.8cm; }
              body { background: #ffffff !important; color: #000000 !important; font-family: Arial, sans-serif; padding: 10px; }
              input, select { border: none !important; background: transparent !important; color: #000000 !important; }
              #${formId} { border: 2px solid #000000 !important; box-shadow: none !important; }
            </style>
          </head>
          <body>
            <div>${el.outerHTML}</div>
            <script>
              setTimeout(() => {
                window.print();
                window.close();
              }, 400);
            </script>
          </body>
        </html>
      `);
      printWin.document.close();
    } else {
      window.print();
    }
  };

  const handleOpenFull = () => {
    if (onOpenFullPatti) {
      onOpenFullPatti(txn);
    } else {
      const prefill = {
        ...formData,
        pattiNo: printConfig.pattiNo,
        billNumber: rawBillNumber
      };
      localStorage.setItem('patti_prefill', JSON.stringify(prefill));
      navigate('/patti');
    }
  };

  return (
    <div className="bg-neutral-50/70 dark:bg-neutral-950/70 p-4 sm:p-6 border-t border-b border-outline-variant/30 space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <ClipboardList className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              Physical Patti Ledger Statement
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400">
                {printConfig.pattiNo}
              </span>
            </h4>
            <p className="text-[11px] font-semibold text-secondary">
              Replicating exact physical mandi ledger matrix for trade entry {txn.id}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Copy Text */}
          <button 
            onClick={copyPattiToClipboard}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer shadow-sm",
              copied 
                ? 'bg-emerald-600 text-white shadow-emerald-500/20 animate-pulse' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
            )}
          >
            {copied ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied Details!' : 'Copy Text'}
          </button>

          {/* Copy as Image */}
          <button 
            onClick={copyPattiAsImage}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer shadow-sm",
              copiedImage 
                ? 'bg-emerald-600 text-white shadow-emerald-500/20 animate-pulse' 
                : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-500/20'
            )}
          >
            {copiedImage ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedImage ? 'Copied Image!' : 'Copy as Image'}
          </button>

          {/* Print Receipt */}
          <button 
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-neutral-900 text-white dark:bg-neutral-50 dark:text-black rounded-xl shadow-sm hover:opacity-95 transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Receipt
          </button>

          {/* Open Full Patti */}
          <button 
            onClick={handleOpenFull}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-white rounded-xl shadow-sm shadow-primary/20 hover:opacity-95 transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Full Ledger
          </button>

          {/* Collapse */}
          {onClose && (
            <button 
              onClick={onClose}
              className="p-1.5 rounded-xl text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-all cursor-pointer"
              title="Close expanded Patti slip"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Emulated Ledger Receipt Container (Exact replica of PattiView #patti-ledger-form) */}
      <div 
        id={formId}
        className="bg-white dark:bg-[#080808] rounded-3xl border-2 border-neutral-300 dark:border-neutral-800 shadow-xl overflow-hidden p-6 sm:p-8 select-text"
      >
        {/* Print Layout Header */}
        <div className="mb-6 pb-6 border-b border-dashed border-neutral-300 dark:border-neutral-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-left">
          <div className="flex items-center gap-3.5">
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg p-0.5 shrink-0 shadow-sm", colors.logoBg)}>
              GM
            </div>
            <div>
              <h2 className={cn("text-xl font-bold tracking-tight uppercase leading-none pb-1", colors.primaryText)}>
                GrainMart depot
              </h2>
              <p className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 tracking-widest uppercase">
                Procurement Logistics & Commercial Accounts Division
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:flex md:flex-col gap-x-6 gap-y-1 text-left md:text-right font-mono text-[9px] text-neutral-500 dark:text-neutral-400">
            <p><span className="font-bold">PATTI REF:</span> <span className="text-neutral-900 dark:text-neutral-100 font-extrabold select-all">{printConfig.pattiNo}</span></p>
            <p><span className="font-bold">GSTIN:</span> <span className="text-neutral-900 dark:text-neutral-100 font-black">{printConfig.gstin}</span></p>
            <p><span className="font-bold">PHONE:</span> <span>{printConfig.phone}</span></p>
            <p className="col-span-2 md:col-span-1"><span className="font-bold">DEPOT:</span> <span>{printConfig.address}</span></p>
          </div>
        </div>

        {/* Audit status Ribbon & Verification Stamp */}
        <div className="flex justify-between items-center mb-4 text-left">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full animate-pulse bg-amber-500" />
            <span className={cn("text-[9px] font-black tracking-widest uppercase", colors.primaryText)}>
              Physical Patti verification statement & weightment ledger
            </span>
          </div>
          <div className={cn(
            "h-14 w-14 border border-dashed rounded-full flex items-center justify-center shrink-0 rotate-12 transition-transform hover:scale-105 select-none",
            colors.badgeBorder,
            colors.accentBg
          )}>
            <div className={cn("text-[7.5px] font-black uppercase tracking-tighter text-center leading-none", colors.badgeText)}>
              verified<br/>
              &<br/>
              audited
            </div>
          </div>
        </div>

        {/* The Precise physical matrix form (10 Column Grid) */}
        <div className="w-full overflow-x-auto pb-2">
          <div className={cn("min-w-[620px] border-t border-l grid grid-cols-10 transition-colors", colors.border, colors.textMain)}>
          
          {/* Row 1: MILLERNAME */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10">MILLERNAME</LabelCell>
          <div className={cn("col-span-8 border-r border-b h-10", colors.border)}>
            <input 
              type="text" 
              value={formData.millerName}
              onChange={(e) => updateField('millerName', e.target.value)}
              className="w-full h-full px-4 text-sm font-black uppercase outline-none bg-transparent"
              placeholder="ENTER MILLER TRADE DESIGNATION"
            />
          </div>

          {/* Row 2: PARTYNAME */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10">PARTYNAME</LabelCell>
          <div className={cn("col-span-8 border-r border-b h-10", colors.border)}>
            <input 
              type="text" 
              value={formData.partyName}
              onChange={(e) => updateField('partyName', e.target.value)}
              className="w-full h-full px-4 text-sm font-black uppercase outline-none bg-transparent"
              placeholder="ENTER CO-PARTNER / BUYER PARTY"
            />
          </div>

          {/* Row 3: BILL NO */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10">BILL NO</LabelCell>
          {formData.billNo.map((val: string, i: number) => (
            <InputCell 
              key={`bill-${i}`} 
              value={val} 
              onChange={(v: string) => updateArrayField('billNo', i, v)} 
              className="col-span-1" 
              borderClass={colors.border}
              activeTextClass={colors.textMain}
            />
          ))}

          {/* Row 4: ARRIVALDT */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10">ARRIVALDT</LabelCell>
          <div className={cn("col-span-2 border-r border-b", colors.border)}>
            <input 
              type="date" 
              value={formData.arrivalDt}
              onChange={(e) => updateField('arrivalDt', e.target.value)}
              className="w-full h-full bg-transparent p-2 text-xs font-bold outline-none text-center"
            />
          </div>
          <div className={cn("col-span-6 border-r border-b h-10", colors.border)} />

          {/* Row 5: RATE (Qty, Rate, Amount) */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10">RATE / QTY</LabelCell>
          <InputCell value={formData.rateQty} onChange={(v) => updateField('rateQty', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-1 text-[8px] font-bold">X</LabelCell>
          <InputCell value={formData.rateRate} onChange={(v) => updateField('rateRate', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />
          <InputCell value={formData.rateAmount} onChange={() => {}} className={cn("col-span-1 text-center font-bold", colors.accentBg)} readOnly borderClass={colors.border} readOnlyBgClass="bg-opacity-10 text-blue-600 dark:text-blue-400 font-bold" />
          <div className={cn("col-span-4 border-r border-b h-10", colors.border)} />

          {/* Row 6: LORRYHIRE / DEDUCT SUM / CHQ AM */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10 underline font-medium">LORRYHIRE</LabelCell>
          <InputCell value={formData.lorrySmall} onChange={(v) => updateField('lorrySmall', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />
          <div className={cn("col-span-1 border-r border-b", colors.border)} />
          <div className={cn("col-span-1 border-r border-b", colors.border)} />
          <div className={cn("col-span-1 border-r border-b flex items-center justify-center text-xs font-black", colors.border, colors.dedBg)}>
            {formatINR(formData.expensesSum)}
          </div>
          <div className={cn("col-span-2 border-r border-b", colors.border)} />
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-1 text-[9px]">CHQ AM</LabelCell>
          <InputCell value={formData.chqAm} onChange={(v) => updateField('chqAm', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />

          {/* Row 7: DISCOUNT / TDS / NET AM / CHQ NO */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10 underline font-medium">DISCOUNT / TDS ({(parseFloat(formData.discountPct)*100).toFixed(2)}%)</LabelCell>
          <div className={cn("col-span-1 border-r border-b flex relative", colors.border)}>
            <select 
              value={formData.discountPct}
              onChange={(e) => { setIsManualDiscount(true); updateField('discountPct', e.target.value); }}
              className="w-full h-full bg-transparent p-1 text-[10px] font-black outline-none border-none appearance-none text-center cursor-pointer"
            >
              <option value="0">0%</option>
              <option value="0.01">1%</option>
              <option value="0.02">2%</option>
              <option value="0.03">3%</option>
              <option value="0.04">4%</option>
              {!['0', '0.01', '0.02', '0.03', '0.04'].includes(formData.discountPct) && (
                <option value={formData.discountPct}>{(parseFloat(formData.discountPct)*100).toFixed(2)}%</option>
              )}
            </select>
            {!isManualDiscount && <span className="absolute -top-1 -right-1 w-2 h-2 bg-emerald-500 rounded-full" title="Auto-calculated" />}
          </div>
          <div className={cn("col-span-1 border-r border-b flex items-center justify-center text-xs font-black text-rose-600 dark:text-rose-400", colors.border)}>
            {formatINR(formData.discountAmount)}
          </div>
          <div className={cn("col-span-1 border-r border-b", colors.border)} />
          <div className={cn("col-span-1 border-r border-b flex items-center justify-center text-sm font-black", colors.border, colors.netBg)}>
            {formatINR(formData.netAmount)}
          </div>
          <div className={cn("col-span-2 border-r border-b", colors.border)} />
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-1 text-[9px]">CHQ NO</LabelCell>
          <InputCell value={formData.chqNo} onChange={(v) => updateField('chqNo', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />

          {/* Row 8: SELLERCOM / CHQ DT */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10 underline font-medium">SELLERCOM</LabelCell>
          <InputCell value={formData.sellerCom} onChange={(v) => updateField('sellerCom', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />
          <div className={cn("col-span-2 border-r border-b", colors.border)} />
          <div className={cn("col-span-1 border-r border-b flex items-center justify-center text-xs font-bold text-blue-600 dark:text-blue-400", colors.border)}>
            {formatINR(formData.chqAm)}
          </div>
          <div className={cn("col-span-2 border-r border-b", colors.border)} />
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-1 text-[9px]">CHQ DT</LabelCell>
          <div className={cn("col-span-1 border-r border-b", colors.border)}>
            <input 
              type="date" 
              value={formData.chqDt}
              onChange={(e) => updateField('chqDt', e.target.value)}
              className="w-full h-full bg-transparent p-2 text-xs font-bold outline-none text-center"
            />
          </div>

          {/* Row 9: SHORTAGE / BANK */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10 underline font-medium text-rose-600">SHORTAGE</LabelCell>
          <InputCell value={formData.manualShortage} onChange={(v) => updateField('manualShortage', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />
          <div className={cn("col-span-2 border-r border-b", colors.border)} />
          <div className={cn(
            "col-span-1 border-r border-b flex items-center justify-center text-sm font-black",
            colors.border,
            parseFloat(formData.shortageDelta) >= 0 ? "text-emerald-600 bg-emerald-500/[0.04]" : "text-rose-600 bg-rose-500/[0.04]"
          )}>
            {formatINR(formData.shortageDelta)}
          </div>
          <div className={cn("col-span-2 border-r border-b", colors.border)} />
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-1 text-[9px]">BANK</LabelCell>
          <InputCell value={formData.bank} onChange={(v) => updateField('bank', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />

          {/* Row 10: Q-DIFF */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10">Q-DIFF</LabelCell>
          <InputCell value={formData.qDiff} onChange={(v) => updateField('qDiff', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />
          <div className={cn("col-span-7 border-r border-b h-10", colors.border)} />

          {/* Row 11: TOTAL / REMARKS */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-12 font-black uppercase tracking-tighter">TOTAL DEDUCTIBLES</LabelCell>
          <div className={cn("col-span-1 border-r border-b text-sm font-black flex items-center justify-center", colors.border, colors.dedBg)}>
            {formatINR(formData.expensesSum)}
          </div>
          <div className={cn("col-span-1 border-r border-b px-2 flex items-center text-[8px] font-black uppercase text-neutral-400 border-r", colors.border)}>
            Remarks:
          </div>
          <div className={cn("col-span-6 border-r border-b h-12", colors.border)}>
            <input 
              type="text" 
              value={formData.remarks}
              onChange={(e) => updateField('remarks', e.target.value)}
              className="w-full h-full px-4 text-xs font-semibold outline-none bg-transparent"
              placeholder="WRITE ARBITRAGE NOTES OR REMARK ENTRY..."
            />
          </div>
        </div>
        </div>

        {/* Dynamic Verification Signatures Pad */}
        <div className="mt-8 pt-6 border-t border-dashed border-neutral-300 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
          <div className="space-y-1">
            <div className="h-10 border-b border-dashed border-neutral-300 dark:border-neutral-700 w-3/4 mx-auto" />
            <span className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block pt-1.5">{printConfig.signatureTitle1}</span>
          </div>
          <div className="space-y-1">
            <div className="h-10 border-b border-dashed border-neutral-300 dark:border-neutral-700 w-3/4 mx-auto" />
            <span className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block pt-1.5">{printConfig.signatureTitle2}</span>
          </div>
          <div className="space-y-1">
            <div className="h-10 border-b border-dashed border-neutral-300 dark:border-neutral-700 w-3/4 mx-auto" />
            <span className="text-[9px] font-black text-neutral-500 dark:text-neutral-400 uppercase tracking-widest block pt-1.5">{printConfig.signatureTitle3}</span>
          </div>
        </div>

        {/* Dynamic Terms Footer */}
        <div className="mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-800 text-center">
          <p className="text-[8px] text-neutral-400 font-bold tracking-wider uppercase max-w-2xl mx-auto">
            {printConfig.terms}
          </p>
        </div>
      </div>
    </div>
  );
}
