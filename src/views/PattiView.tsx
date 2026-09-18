import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  Download, 
  History,
  AlertCircle,
  FileText,
  Save,
  Trash2,
  Sliders,
  Settings,
  ShieldAlert,
  ClipboardList,
  Palette,
  CheckCircle2,
  BookOpen,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

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

interface PattiHistoryItem extends PattiFormData {
  id: string;
  timestamp: string;
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
  <div className={cn("border-r border-b p-2 flex items-center justify-center text-[10px] font-black uppercase tracking-wider text-center", borderClass, bgClass, className)}>
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

export default function PattiView() {
  const [formData, setFormData] = useState<PattiFormData>({
    millerName: '',
    partyName: '',
    billNo: ['', '', '', '', '', '', '', ''],
    arrivalDt: '',
    rateQty: '0',
    rateRate: '0',
    rateAmount: '0',
    lorrySmall: '0',
    discountPct: '0',
    discountAmount: '0',
    sellerCom: '0',
    manualShortage: '0',
    qDiff: '0',
    expensesSum: '0',
    netAmount: '0',
    chqAm: '0',
    chqNo: '',
    chqDt: '',
    bank: '',
    remarks: '',
    shortageDelta: '0'
  });

  const [history, setHistory] = useState<PattiHistoryItem[]>([]);
  const [isManualDiscount, setIsManualDiscount] = useState(false);
  const [copied, setCopied] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);

  // Print Configuration Options
  const [printColorMode, setPrintColorMode] = useState<'classic' | 'sapphire' | 'mono'>('classic');
  const [showLetterhead, setShowLetterhead] = useState(true);
  const [showStamp, setShowStamp] = useState(true);
  const [showSignatures, setShowSignatures] = useState(true);
  const [showTerms, setShowTerms] = useState(true);
  const [isPrintPanelVisible, setIsPrintPanelVisible] = useState(true);

  const [printConfig, setPrintConfig] = useState({
    gstin: '03AABCR1234F1ZP',
    address: 'Depot No. 4, Commercial Complex, Punjab, India',
    phone: '+91 98881-22334',
    pattiNo: 'PATTI-' + Math.floor(100000 + Math.random() * 900000),
    terms: 'SUBJECT TO DEPOT JURISDICTION. WEIGHTS REGISTERED ON THE COMPUTERIZED WEIGHBRIDGE SYSTEM APPLY. BROKER COMMISSIONS AS APPLICABLE.',
    signatureTitle1: 'Prepared By (Broker)',
    signatureTitle2: 'Verified Surveyor',
    signatureTitle3: 'Depot Manager'
  });

  // Load history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('patti_history');
      if (saved) {
        setHistory(JSON.parse(saved));
      }
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Load prefill from localStorage if available
  useEffect(() => {
    const prefillStr = localStorage.getItem('patti_prefill');
    if (prefillStr) {
      try {
        const prefill = JSON.parse(prefillStr);
        setIsManualDiscount(true);
        setFormData(prev => ({
          ...prev,
          millerName: prefill.millerName || '',
          partyName: prefill.partyName || '',
          arrivalDt: prefill.arrivalDt || '',
          rateQty: String(prefill.rateQty || '0'),
          rateRate: String(prefill.rateRate || '0'),
          rateAmount: String(prefill.rateAmount || '0'),
          lorrySmall: String(prefill.lorrySmall || '0'),
          discountPct: String(prefill.discountPct || '0'),
          discountAmount: String(prefill.discountAmount || '0'),
          sellerCom: String(prefill.sellerCom || '0'),
          manualShortage: String(prefill.manualShortage || '0'),
          qDiff: String(prefill.qDiff || '0'),
          expensesSum: String(prefill.expensesSum || '0'),
          netAmount: String(prefill.netAmount || '0'),
          chqAm: String(prefill.chqAm || '0'),
          chqNo: prefill.chqNo || '',
          chqDt: prefill.chqDt || '',
          bank: prefill.bank || '',
          remarks: prefill.remarks || '',
          billNo: prefill.billNo ? [...prefill.billNo, '', '', '', '', '', '', '',''].slice(0, 8) : (prefill.billNumber ? [prefill.billNumber, '', '', '', '', '', '', ''] : ['', '', '', '', '', '', '', ''])
        }));
        if (prefill.pattiNo || prefill.billNumber) {
          setPrintConfig(pc => ({ 
            ...pc, 
            pattiNo: prefill.pattiNo || `PATTI-${prefill.billNumber}` 
          }));
        }
        // Delay deletion slightly to support development environments with double synchronous mounting (React 18 Strict Mode).
        setTimeout(() => {
          localStorage.removeItem('patti_prefill');
        }, 500);
      } catch (e) {
        console.error("Failed to parse patti_prefill localStorage", e);
      }
    }
  }, []);

  // Set up dynamic color scheme configurations
  const colors = {
    classic: {
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
    },
    sapphire: {
      border: 'border-slate-300 dark:border-slate-800',
      textMain: 'text-slate-900 dark:text-slate-100',
      labelBg: 'bg-slate-50 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400',
      primaryText: 'text-blue-600 dark:text-blue-400',
      netBg: 'bg-sky-500/[0.04] text-sky-600 dark:text-sky-400 font-black',
      dedBg: 'bg-slate-500/[0.04] text-slate-600 dark:text-slate-400 font-bold',
      accentBg: 'bg-indigo-500/[0.02] text-indigo-600 dark:text-indigo-400',
      borderExact: '#cbd5e1',
      badgeBorder: 'border-sky-500/25',
      badgeText: 'text-sky-600',
      logoBg: 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white'
    },
    mono: {
      border: 'border-black dark:border-white',
      textMain: 'text-black dark:text-white',
      labelBg: 'bg-neutral-200 dark:bg-neutral-800 text-black dark:text-white',
      primaryText: 'text-black dark:text-white font-black',
      netBg: 'bg-neutral-100 dark:bg-neutral-900 text-black dark:text-white font-black border-2 border-black dark:border-white',
      dedBg: 'bg-neutral-50 dark:bg-neutral-900 text-black dark:text-white font-bold',
      accentBg: 'bg-transparent text-black dark:text-white',
      borderExact: '#000000',
      badgeBorder: 'border-black',
      badgeText: 'text-black',
      logoBg: 'bg-black text-white border border-white'
    }
  }[printColorMode];

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
      // Prevent redundant state updates if values already match
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
  }, [formData.rateQty, formData.rateRate, formData.arrivalDt, formData.chqDt, formData.lorrySmall, formData.sellerCom, formData.manualShortage, formData.qDiff, formData.chqAm, formData.discountPct, isManualDiscount]);

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
      // Fallback
      alert('Failed to copy. Please check browser permissions.');
    });
  };

  const convertOklchAndOklabColorInString = (val: string): string => {
    if (!val || typeof val !== 'string') {
      return val;
    }

    let result = val;

    // 1. Process OKLCH
    if (result.includes('oklch')) {
      result = result.replace(/oklch\(([^)]+)\)/gi, (match, innerText) => {
        const parts = innerText.split(/[\s,\/]+/).filter((p: string) => p.trim() !== '');
        if (parts.length < 3) return match;

        const parseOklchValue = (v: string, max: number): number => {
          if (v.endsWith('%')) {
            return (parseFloat(v) / 100) * max;
          }
          return parseFloat(v);
        };

        const L = isNaN(parseOklchValue(parts[0], 1)) ? 0 : parseOklchValue(parts[0], 1);
        const C = isNaN(parseOklchValue(parts[1], 1)) ? 0 : parseOklchValue(parts[1], 1);
        let H_str = parts[2] || '0';
        if (H_str.endsWith('deg')) {
          H_str = H_str.slice(0, -3);
        }
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

        const f = (c: number) => {
          return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
        };

        const r = Math.round(Math.max(0, Math.min(1, f(rL))) * 255);
        const g = Math.round(Math.max(0, Math.min(1, f(gL))) * 255);
        const b = Math.round(Math.max(0, Math.min(1, f(bL))) * 255);

        if (alpha === 1) {
          return `rgb(${r}, ${g}, ${b})`;
        } else {
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
      });
    }

    // 2. Process OKLAB
    if (result.includes('oklab')) {
      result = result.replace(/oklab\(([^)]+)\)/gi, (match, innerText) => {
        const parts = innerText.split(/[\s,\/]+/).filter((p: string) => p.trim() !== '');
        if (parts.length < 3) return match;

        const parseOklabValue = (v: string, max: number): number => {
          if (v.endsWith('%')) {
            return (parseFloat(v) / 100) * max;
          }
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

        const f = (c: number) => {
          return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
        };

        const r = Math.round(Math.max(0, Math.min(1, f(rL))) * 255);
        const g = Math.round(Math.max(0, Math.min(1, f(gL))) * 255);
        const b = Math.round(Math.max(0, Math.min(1, f(bL))) * 255);

        if (alpha === 1) {
          return `rgb(${r}, ${g}, ${b})`;
        } else {
          return `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }
      });
    }

    return result;
  };

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

  const exportPDF = async () => {
    const element = document.getElementById('patti-ledger-form');
    if (element) {
      const originalGetComputedStyle = window.getComputedStyle;

      // Patch the window computed style temporarily
      window.getComputedStyle = createComputedStyleProxy(window) as any;

      try {
        const canvas = await html2canvas(element, {
          scale: 4, 
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            // Also patch cloned document window computed style
            if (clonedDoc.defaultView) {
              clonedDoc.defaultView.getComputedStyle = createComputedStyleProxy(clonedDoc.defaultView) as any;
            }

            // Convert OKLCH/OKLAB in style elements
            clonedDoc.querySelectorAll('style').forEach(styleTag => {
              if (styleTag.textContent) {
                styleTag.textContent = convertOklchAndOklabColorInString(styleTag.textContent);
              }
            });

            // Convert OKLCH/OKLAB in stylesheets rules
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

            const clonedEl = clonedDoc.getElementById('patti-ledger-form');
            if (clonedEl) {
              const originalElContainer = document.getElementById('patti-ledger-form')!;
              
              clonedEl.style.fontFamily = 'Arial, sans-serif';
              clonedEl.style.color = '#000000';
              clonedEl.style.backgroundColor = '#ffffff';

              // Map all colors to inline RGB properties recursively to guarantee no oklch/oklab leak
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

                // Tailwind backup utilities
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
        
        const imgData = canvas.toDataURL('image/png', 1.0);
        
        // A4 Dimensions in landscape: 297mm x 210mm
        const pdf = new jsPDF('l', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        const imgProps = pdf.getImageProperties(imgData);
        const margin = 8;
        const width = pdfWidth - (margin * 2);
        const height = (imgProps.height * width) / imgProps.width;
        
        let finalHeight = height;
        let finalWidth = width;
        if (finalHeight > (pdfHeight - margin * 2)) {
          finalHeight = pdfHeight - margin * 2;
          finalWidth = (imgProps.width * finalHeight) / imgProps.height;
        }

        const x = (pdfWidth - finalWidth) / 2;
        const y = (pdfHeight - finalHeight) / 2;
        
        pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight, undefined, 'FAST');
        pdf.save(`Patti_Receipt_${formData.partyName || 'Trade'}_${printConfig.pattiNo}.pdf`);
      } catch (error) {
        console.error('PDF Export Error:', error);
        alert('Export failed due to browser canvas constraints. Use the print (Ctrl+P) option as a high-fidelity alternative.');
      } finally {
        window.getComputedStyle = originalGetComputedStyle;
      }
    }
  };

  const copyPattiAsImage = async () => {
    const element = document.getElementById('patti-ledger-form');
    if (element) {
      const originalGetComputedStyle = window.getComputedStyle;

      // Patch the window computed style temporarily
      window.getComputedStyle = createComputedStyleProxy(window) as any;

      try {
        const canvas = await html2canvas(element, {
          scale: 4, 
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

            const clonedEl = clonedDoc.getElementById('patti-ledger-form');
            if (clonedEl) {
              const originalElContainer = document.getElementById('patti-ledger-form')!;
              
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
              alert('Could not copy image automatically. Use secure backup download or web print option!');
            });
          }
        }, 'image/png');
      } catch (error) {
        console.error('Copy Image Error:', error);
        alert('Failed to copy. Use secure backup download or print instead.');
      } finally {
        window.getComputedStyle = originalGetComputedStyle;
      }
    }
  };

  const resetForm = () => {
    setFormData({
      millerName: '',
      partyName: '',
      billNo: ['', '', '', '', '', '', '', ''],
      arrivalDt: '',
      rateQty: '0',
      rateRate: '0',
      rateAmount: '0',
      lorrySmall: '0',
      discountPct: '0',
      discountAmount: '0',
      sellerCom: '0',
      manualShortage: '0',
      qDiff: '0',
      expensesSum: '0',
      netAmount: '0',
      chqAm: '0',
      chqNo: '',
      chqDt: '',
      bank: '',
      remarks: '',
      shortageDelta: '0'
    });
    setIsManualDiscount(false);
  };

  const commitEntry = () => {
    const newItem: PattiHistoryItem = {
      ...formData,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString()
    };
    const newHistory = [newItem, ...history].slice(0, 50); // Keep last 50
    setHistory(newHistory);
    localStorage.setItem('patti_history', JSON.stringify(newHistory));
    alert('Ledger Patti note saved in history cache successfully!');
  };

  const loadHistoryItem = (item: PattiHistoryItem) => {
    const { id, timestamp, ...data } = item;
    setFormData(data);
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const clearHistory = () => {
    if (confirm('Permanently purge entire saved Patti history ledger?')) {
      setHistory([]);
      localStorage.removeItem('patti_history');
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-6xl mx-auto relative">
      {/* Dynamic print-media style override */}
      <style>{`
        @media print {
          /* Auto hide sidebar, navigation header, control panel and history during paper printing */
          header, 
          aside, 
          .no-print, 
          .print-settings-ctrl, 
          #sidebar, 
          #navbar,
          nav {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
          
          /* Force page margins reset */
          @page {
            size: landscape;
            margin: 0.8cm;
          }

          body, html {
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          main {
            margin-left: 0 !important;
            padding-top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            background: #ffffff !important;
          }

          /* Ensure the ledger matches landscape paper perfectly */
          #patti-ledger-form {
            border: 2px solid ${colors.borderExact} !important;
            box-shadow: none !important;
            background: #ffffff !important;
            margin: 0 !important;
            padding: 1.5rem !important;
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 8px !important;
            text-shadow: none !important;
          }
          
          /* Clean form elements */
          input, select {
            border: none !important;
            background: transparent !important;
            color: #000000 !important;
            -webkit-appearance: none !important;
            -moz-appearance: none !important;
            appearance: none !important;
            font-size: 13px !important;
          }
        }
      `}</style>

      {/* Top Title Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 no-print">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-primary">
            <ClipboardList className="w-5 h-5" />
            <span className="text-xs font-black uppercase tracking-widest">DEPOT LOGISTICS TERMINAL</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight font-sans">Physical Ledger Emulation</h1>
          <p className="text-secondary text-sm font-medium italic opacity-80">Replicating trade verification receipts with strict compliance standards.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => setIsPrintPanelVisible(!isPrintPanelVisible)}
            className="flex items-center gap-2 px-5 py-2.5 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 border border-outline-variant/50 rounded-xl hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer"
          >
            <Sliders className="w-3.5 h-3.5 text-secondary" />
            Print Settings
          </button>
          <button 
            onClick={copyPattiToClipboard}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-lg transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer ${
              copied 
                ? 'bg-emerald-600 text-white shadow-emerald-500/20 animate-pulse' 
                : 'bg-indigo-600 text-white shadow-indigo-500/20 hover:opacity-95'
            }`}
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 animate-bounce" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copied ? 'Copied Details!' : 'Copy Text'}
          </button>
          <button 
            onClick={copyPattiAsImage}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-lg transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer ${
              copiedImage 
                ? 'bg-emerald-600 text-white shadow-emerald-500/20 animate-pulse' 
                : 'bg-teal-600 text-white shadow-teal-500/20 hover:opacity-95'
            }`}
          >
            {copiedImage ? (
              <CheckCircle2 className="w-4 h-4 animate-bounce" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {copiedImage ? 'Copied Image!' : 'Copy as Image'}
          </button>
          <button 
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900 text-white dark:bg-neutral-50 dark:text-black rounded-xl shadow-lg hover:opacity-95 transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print Receipt
          </button>
          <button 
            onClick={exportPDF}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl shadow-lg shadow-primary/20 hover:opacity-95 transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>

      {/* Dynamic Print Configuration Dashboard */}
      <AnimatePresence>
        {isPrintPanelVisible && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-surface-container-lowest/80 border border-outline-variant/60 rounded-3xl p-6 shadow-xl no-print space-y-6 overflow-hidden text-left"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-outline-variant/30 pb-4">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Patti Print & Receipt customizer</h3>
                  <p className="text-secondary text-[11px] font-semibold">Tweak receipt templates, billing metadata, and verify layout properties.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-surface-container rounded-xl p-1 border border-outline-variant/20">
                <span className="text-[9px] font-black text-secondary px-2 uppercase tracking-wide">COLOR THEME:</span>
                {(['classic', 'sapphire', 'mono'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setPrintColorMode(mode)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                      printColorMode === mode 
                        ? "bg-primary text-white shadow-sm" 
                        : "text-secondary hover:text-on-surface"
                    )}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Column 1: Document Metadata */}
              <div className="space-y-3.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                  <BookOpen className="w-3 h-3" /> Billing Details
                </p>
                
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-secondary uppercase">Commercial Patti reference</label>
                  <input 
                    type="text" 
                    value={printConfig.pattiNo}
                    onChange={(e) => setPrintConfig({...printConfig, pattiNo: e.target.value})}
                    className="w-full bg-surface-container border border-outline-variant/35 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:border-primary outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-secondary uppercase">Trade Depot GSTIN</label>
                  <input 
                    type="text" 
                    value={printConfig.gstin}
                    onChange={(e) => setPrintConfig({...printConfig, gstin: e.target.value})}
                    className="w-full bg-surface-container border border-outline-variant/35 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:border-primary outline-none"
                  />
                </div>
              </div>

              {/* Column 2: Header Contacts */}
              <div className="space-y-3.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                  <Sliders className="w-3 h-3" /> Depot Contact & Signatures
                </p>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-secondary uppercase">Depot address</label>
                  <input 
                    type="text" 
                    value={printConfig.address}
                    onChange={(e) => setPrintConfig({...printConfig, address: e.target.value})}
                    className="w-full bg-surface-container border border-outline-variant/35 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:border-primary outline-none"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-secondary uppercase">Surveyor Signatory Title</label>
                  <input 
                    type="text" 
                    value={printConfig.signatureTitle2}
                    onChange={(e) => setPrintConfig({...printConfig, signatureTitle2: e.target.value})}
                    className="w-full bg-surface-container border border-outline-variant/35 rounded-xl px-3 py-2 text-xs font-bold text-on-surface focus:border-primary outline-none"
                  />
                </div>
              </div>

              {/* Column 3: Component Visibility Switches */}
              <div className="bg-surface-container/45 border border-outline-variant/40 rounded-2xl p-4.5 space-y-3.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-secondary">Toggle layout nodes</p>
                
                <div className="grid grid-cols-2 gap-3.5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={showLetterhead}
                      onChange={(e) => setShowLetterhead(e.target.checked)}
                      className="rounded border-outline-variant/60 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-secondary">Depot Header</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={showStamp}
                      onChange={(e) => setShowStamp(e.target.checked)}
                      className="rounded border-outline-variant/60 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-secondary">Audit Stamp</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={showSignatures}
                      onChange={(e) => setShowSignatures(e.target.checked)}
                      className="rounded border-outline-variant/60 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-secondary">Signatures Block</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      checked={showTerms}
                      onChange={(e) => setShowTerms(e.target.checked)}
                      className="rounded border-outline-variant/60 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                    <span className="text-[11px] font-semibold text-secondary">T&C Footer</span>
                  </label>
                </div>

                <div className="pt-2 border-t border-outline-variant/20">
                  <p className="text-[8px] font-black text-secondary uppercase tracking-widest leading-relaxed">
                    💡 TIP: Set browser print options to <span className="text-primary font-black">Landscape</span> orientation, set margins to <span className="text-primary font-black">None</span>, and check <span className="text-primary font-black">Background graphics</span> for best result.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Emulated Ledger Receipt Container */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        id="patti-ledger-form"
        className="bg-white dark:bg-[#080808] rounded-3xl border-2 border-neutral-300 dark:border-neutral-800 shadow-2xl overflow-hidden p-6 sm:p-8"
      >
        {/* Print Layout Header */}
        {showLetterhead && (
          <div className="mb-6 pb-6 border-b border-dashed border-neutral-300 dark:border-neutral-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 text-left">
            <div className="flex items-center gap-3.5">
              <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg p-0.5 shrink-0 shadow-sm", colors.logoBg)}>
                GM
              </div>
              <div>
                <h2 className={cn("text-xl font-bold tracking-tight uppercase leading-none pb-1", colors.primaryText)}>
                  GrainMart depot
                </h2>
                <p className="text-[9px] font-black text-secondary tracking-widest uppercase">Procurement Logistics & Commercial Accounts Division</p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:flex md:flex-col gap-x-6 gap-y-1 text-left md:text-right font-mono text-[9px] text-neutral-500 dark:text-neutral-400">
              <p><span className="font-bold">PATTI REF:</span> <span className="text-neutral-900 dark:text-neutral-100 font-extrabold select-all">{printConfig.pattiNo}</span></p>
              <p><span className="font-bold">GSTIN:</span> <span className="text-neutral-900 dark:text-neutral-100 font-black">{printConfig.gstin}</span></p>
              <p><span className="font-bold">PHONE:</span> <span>{printConfig.phone}</span></p>
              <p className="col-span-2 md:col-span-1"><span className="font-bold">DEPOT:</span> <span>{printConfig.address}</span></p>
            </div>
          </div>
        )}

        {/* Audit status Ribbon & Verification Stamp */}
        <div className="flex justify-between items-center mb-4 text-left">
          <div className="flex items-center gap-2">
            <span className={cn("w-2.5 h-2.5 rounded-full animate-pulse", printColorMode === 'mono' ? 'bg-black' : 'bg-amber-500')} />
            <span className={cn("text-[9px] font-black tracking-widest uppercase", colors.primaryText)}>
              Physical Patti verification statement & weightment ledger
            </span>
          </div>
          {showStamp && (
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
          )}
        </div>

        {/* The Precise physical matrix form */}
        <div className={cn("border-t border-l grid grid-cols-10 transition-colors", colors.border, colors.textMain)}>
          
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
              className="w-full h-full bg-transparent p-1 text-[10px] font-black outline-none border-none appearance-none text-center"
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

        {/* Dynamic Verification Signatures Pad */}
        {showSignatures && (
          <div className="mt-8 pt-6 border-t border-dashed border-neutral-300 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="space-y-1">
              <div className="h-10 border-b border-dashed border-neutral-300 dark:border-neutral-700 w-3/4 mx-auto" />
              <span className="text-[9px] font-black text-secondary uppercase tracking-widest block pt-1.5">{printConfig.signatureTitle1}</span>
            </div>
            <div className="space-y-1">
              <div className="h-10 border-b border-dashed border-neutral-300 dark:border-neutral-700 w-3/4 mx-auto" />
              <span className="text-[9px] font-black text-secondary uppercase tracking-widest block pt-1.5">{printConfig.signatureTitle2}</span>
            </div>
            <div className="space-y-1">
              <div className="h-10 border-b border-dashed border-neutral-300 dark:border-neutral-700 w-3/4 mx-auto" />
              <span className="text-[9px] font-black text-secondary uppercase tracking-widest block pt-1.5">{printConfig.signatureTitle3}</span>
            </div>
          </div>
        )}

        {/* Dynamic Terms Footer */}
        {showTerms && (
          <div className="mt-8 pt-4 border-t border-neutral-200 dark:border-neutral-800 text-center">
            <p className="text-[8px] text-neutral-400 font-bold tracking-wider uppercase max-w-2xl mx-auto">
              {printConfig.terms}
            </p>
          </div>
        )}
      </motion.div>

      {/* Preservation & Form actions */}
      <div className="liquid-glass p-8 rounded-3xl premium-border flex flex-wrap items-center justify-between gap-8 no-print">
         <div className="flex items-center gap-4 text-left">
            <div className="p-3 bg-primary/5 rounded-2xl">
               <CheckCircle2 className="w-6 h-6 text-primary" />
            </div>
            <div>
               <p className="text-xs font-black uppercase tracking-widest text-neutral-800 dark:text-neutral-200">Preservation Integrity Node</p>
               <p className="text-sm text-secondary font-semibold">Verify form calculations then cache this statement dynamically inside temporal sandbox.</p>
            </div>
         </div>
         <div className="flex flex-wrap gap-4">
            <button 
              onClick={copyPattiToClipboard}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer ${
                copied 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20' 
                  : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:opacity-95'
              }`}
            >
               {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
               {copied ? 'Copied!' : 'Copy Summary'}
            </button>
            <button 
              onClick={copyPattiAsImage}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer ${
                copiedImage 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 animate-pulse' 
                  : 'bg-teal-600 text-white shadow-lg shadow-teal-500/20 hover:opacity-95'
              }`}
            >
               {copiedImage ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
               {copiedImage ? 'Copied Image' : 'Copy as Image'}
            </button>
            <button 
              onClick={commitEntry}
              className="flex items-center gap-2 px-8 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-95 transition-all active:scale-95 shadow-lg shadow-primary/20 cursor-pointer"
            >
               <Save className="w-4 h-4" />
               Save to History
            </button>
            <button 
              onClick={resetForm}
              className="flex items-center gap-2 px-8 py-3 bg-rose-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-rose-200 hover:bg-rose-700 transition-all active:scale-95 cursor-pointer"
            >
               <Trash2 className="w-4 h-4" />
               Purge Form
            </button>
         </div>
      </div>

      {/* History Section */}
      <div className="space-y-6 no-print pb-20 text-left">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
             <History className="w-6 h-6 text-primary" />
             <h2 className="text-xl font-black uppercase tracking-tight">Recent Patti Statements</h2>
          </div>
          {history.length > 0 && (
            <button 
              onClick={clearHistory}
              className="text-xs font-bold text-rose-500 hover:text-rose-600 transition-colors uppercase tracking-widest cursor-pointer"
            >
              Clear All
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="bg-surface-container-low/50 rounded-3xl p-12 text-center border-2 border-dashed border-outline-variant/30">
            <FileText className="w-12 h-12 text-outline-variant mx-auto mb-4" />
            <p className="text-secondary font-medium">No previous statements preserved. Cache your first Patti verification sheet to see history logs.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map((item) => (
              <motion.div 
                key={item.id}
                whileHover={{ y: -4 }}
                className="bg-white dark:bg-[#111] p-6 rounded-3xl border border-outline-variant/30 shadow-xl cursor-pointer hover:border-primary/50 group interactive-card"
                onClick={() => loadHistoryItem(item)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="space-y-0.5">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest">
                      {(() => {
                        const d = new Date(item.timestamp);
                        if (!isNaN(d.getTime())) {
                          const day = d.getDate();
                          const monthNames = [
                            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
                          ];
                          const m = monthNames[d.getMonth()];
                          const yyyy = d.getFullYear();
                          return `${day}-${m}-${yyyy}`;
                        }
                        return '';
                      })()}
                    </p>
                    <h3 className="font-bold truncate max-w-[150px]">
                      {item.partyName || 'Untitled Party'}
                    </h3>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Net Amount</p>
                    <p className="text-lg font-extrabold text-rose-600 dark:text-rose-400">₹{formatINR(item.netAmount)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/20">
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-40 tracking-tighter">Miller</p>
                    <p className="text-xs font-bold truncate">{item.millerName || '-'}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase opacity-40 tracking-tighter">Bill No</p>
                    <p className="text-xs font-bold truncate">{item.billNo[0] || '-'}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
