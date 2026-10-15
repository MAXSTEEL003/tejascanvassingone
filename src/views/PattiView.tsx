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
  Copy,
  Loader2,
  Image as ImageIcon
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
  readOnlyBgClass?: string,
  placeholder?: string
}> = ({ 
  value, 
  onChange, 
  className, 
  readOnly,
  borderClass = "border-neutral-300 dark:border-neutral-800",
  activeTextClass = "text-neutral-900 dark:text-neutral-100",
  readOnlyBgClass = "bg-neutral-50/50 dark:bg-neutral-900/50 text-primary",
  placeholder
}) => (
  <div className={cn("border-r border-b h-10 flex items-center justify-center", borderClass, className)}>
    <input 
      type="text" 
      value={value}
      onChange={(e) => !readOnly && onChange(e.target.value)}
      readOnly={readOnly}
      placeholder={placeholder}
      className={cn(
        "w-full h-full bg-transparent px-1.5 text-xs font-mono font-black tabular-nums outline-none text-center placeholder:text-neutral-400 tracking-tight leading-normal",
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
  const [isCapturingImage, setIsCapturingImage] = useState(false);
  const [imageScale, setImageScale] = useState<2 | 3>(3);
  const [copyNotification, setCopyNotification] = useState<{ type: 'success' | 'fallback' | 'error'; message: string } | null>(null);

  // Print Configuration Options
  const [printColorMode, setPrintColorMode] = useState<'classic' | 'sapphire' | 'mono'>('classic');
  const [showLetterhead, setShowLetterhead] = useState(true);
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
          sellerCom: (prefill.sellerCom && parseFloat(prefill.sellerCom) > 0) ? String(prefill.sellerCom) : '0',
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
    const formattedBills = formData.billNo.filter(b => String(b ?? '').trim() !== '').join(', ') || 'N/A';
    
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
Seller Com : ${parseFloat(formData.sellerCom) > 0 ? `₹${parseFloat(formData.sellerCom).toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : '-'}
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
Generated via TEJAS CANVASSING Terminal.`;

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

  const generatePattiCanvas = async (scale: number = imageScale): Promise<HTMLCanvasElement | null> => {
    const element = document.getElementById('patti-ledger-form');
    if (!element) return null;

    // 1. Wait for document fonts to finish loading
    if (document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch (e) {
        console.warn('Font loading wait warning:', e);
      }
    }

    // 2. Short RAF delay to ensure any pending React layout or input paint completes
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 60)));

    const originalGetComputedStyle = window.getComputedStyle;
    window.getComputedStyle = createComputedStyleProxy(window) as any;

    try {
      const canvas = await html2canvas(element, {
        scale: scale, 
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        onclone: (clonedDoc) => {
          // Force light mode on cloned document for clean print/image output
          clonedDoc.documentElement.classList.remove('dark');
          clonedDoc.body.classList.remove('dark');
          clonedDoc.documentElement.style.colorScheme = 'light';
          clonedDoc.body.style.backgroundColor = '#ffffff';

          if (clonedDoc.defaultView) {
            clonedDoc.defaultView.getComputedStyle = createComputedStyleProxy(clonedDoc.defaultView) as any;
          }

          // Sanitize OKLCH in style tags
          clonedDoc.querySelectorAll('style').forEach(styleTag => {
            if (styleTag.textContent) {
              styleTag.textContent = convertOklchAndOklabColorInString(styleTag.textContent);
            }
          });

          // Sanitize stylesheets rules
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
            
            // Standardize container dimensions to landscape desktop A4 proportion
            clonedEl.style.width = '1040px';
            clonedEl.style.minWidth = '1040px';
            clonedEl.style.maxWidth = '1040px';
            clonedEl.style.margin = '0 auto';
            clonedEl.style.padding = '28px';
            clonedEl.style.boxShadow = 'none';
            clonedEl.style.borderRadius = '12px';
            clonedEl.style.border = `2px solid ${colors.borderExact || '#d4d4d4'}`;
            clonedEl.style.backgroundColor = '#ffffff';
            clonedEl.style.color = '#000000';
            clonedEl.style.fontFamily = '"Geist", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

            // Ensure inner grid is completely expanded without horizontal scrolling
            const scrollContainer = clonedEl.querySelector('.overflow-x-auto');
            if (scrollContainer && scrollContainer instanceof HTMLElement) {
              scrollContainer.style.overflow = 'visible';
              scrollContainer.style.padding = '0';
              scrollContainer.style.margin = '0';
            }

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

              // Replace input elements with clean text divs to eliminate native form clipping
              if (originalNode instanceof HTMLInputElement && clonedNode instanceof HTMLInputElement) {
                const parent = clonedNode.parentNode;
                if (parent) {
                  const textDiv = clonedDoc.createElement('div');
                  let displayText = originalNode.value || '';
                  
                  if (originalNode.type === 'date' && displayText) {
                    const parts = displayText.split('-');
                    if (parts.length === 3) {
                      displayText = `${parts[2]}/${parts[1]}/${parts[0]}`;
                    }
                  }

                  const isCentered = originalNode.classList.contains('text-center') || style?.textAlign === 'center';
                  const isNumeric = originalNode.classList.contains('font-mono') ||
                                    originalNode.classList.contains('tabular-nums') ||
                                    (!isNaN(Number(displayText.replace(/[,₹ \-]/g, ''))) && displayText.length > 0);
                  
                  textDiv.style.width = '100%';
                  textDiv.style.height = '100%';
                  textDiv.style.minHeight = '38px';
                  textDiv.style.display = 'flex';
                  textDiv.style.alignItems = 'center';
                  textDiv.style.justifyContent = isCentered ? 'center' : 'flex-start';
                  textDiv.style.textAlign = isCentered ? 'center' : 'left';
                  textDiv.style.padding = isCentered ? '0 4px' : '0 16px';
                  textDiv.style.boxSizing = 'border-box';
                  textDiv.style.color = '#000000';
                  textDiv.style.backgroundColor = 'transparent';
                  textDiv.style.fontWeight = style?.fontWeight || '800';
                  textDiv.style.lineHeight = 'normal';
                  textDiv.style.overflow = 'visible';

                  textDiv.style.fontFamily = isNumeric 
                    ? '"Consolas", "Courier New", monospace' 
                    : '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

                  let baseFontSize = parseFloat(style?.fontSize || '13');
                  if (isNaN(baseFontSize) || baseFontSize <= 0) baseFontSize = 13;

                  if (displayText.length > 25) {
                    textDiv.style.fontSize = '9.5px';
                  } else if (displayText.length > 18) {
                    textDiv.style.fontSize = '11px';
                  } else if (displayText.length > 13) {
                    textDiv.style.fontSize = '12px';
                  } else {
                    textDiv.style.fontSize = `${baseFontSize}px`;
                  }

                  if (!displayText) {
                    if (originalNode.placeholder && (originalNode.placeholder.includes('MILLER') || originalNode.placeholder.includes('PARTY'))) {
                      textDiv.textContent = originalNode.placeholder;
                      textDiv.style.color = '#9ca3af';
                      textDiv.style.fontWeight = '500';
                    } else {
                      textDiv.textContent = '—';
                      textDiv.style.color = '#d1d5db';
                    }
                  } else {
                    textDiv.textContent = displayText;
                  }

                  parent.replaceChild(textDiv, clonedNode);
                  return;
                }
              }

              // Replace select elements with clean percentage text
              if (originalNode instanceof HTMLSelectElement && clonedNode instanceof HTMLSelectElement) {
                const parent = clonedNode.parentNode;
                if (parent) {
                  const textDiv = clonedDoc.createElement('div');
                  const opt = originalNode.options[originalNode.selectedIndex];
                  const optText = opt ? opt.text : `${(parseFloat(originalNode.value || '0') * 100).toFixed(0)}%`;

                  textDiv.textContent = optText;
                  textDiv.style.width = '100%';
                  textDiv.style.height = '100%';
                  textDiv.style.display = 'flex';
                  textDiv.style.alignItems = 'center';
                  textDiv.style.justifyContent = 'center';
                  textDiv.style.textAlign = 'center';
                  textDiv.style.color = '#000000';
                  textDiv.style.fontFamily = '"Geist Mono", monospace';
                  textDiv.style.fontVariantNumeric = 'tabular-nums';
                  textDiv.style.fontSize = '11px';
                  textDiv.style.fontWeight = '900';
                  textDiv.style.boxSizing = 'border-box';

                  parent.replaceChild(textDiv, clonedNode);
                  return;
                }
              }

              // Numeric formatting optimization for high-density amount cells
              if (clonedNode.classList && (clonedNode.classList.contains('font-mono') || clonedNode.classList.contains('tabular-nums'))) {
                const text = (clonedNode.textContent || '').trim();
                if (text.length > 13) {
                  clonedNode.style.fontSize = '10.5px';
                  clonedNode.style.letterSpacing = '-0.025em';
                } else if (text.length > 10) {
                  clonedNode.style.fontSize = '11.5px';
                  clonedNode.style.letterSpacing = '-0.015em';
                }
              }

              // Tailwind utility color mapping for reliable contrast in cloned canvas
              const classList = clonedNode.classList;
              if (classList) {
                if (classList.contains('text-rose-600') || classList.contains('text-rose-500')) clonedNode.style.color = '#dc2626';
                if (classList.contains('text-emerald-600') || classList.contains('text-emerald-500')) clonedNode.style.color = '#059669';
                if (classList.contains('text-sky-600') || classList.contains('text-sky-500')) clonedNode.style.color = '#0284c7';
                if (classList.contains('text-blue-600') || classList.contains('text-blue-500')) clonedNode.style.color = '#2563eb';
                if (classList.contains('text-indigo-600')) clonedNode.style.color = '#4f46e5';
                if (classList.contains('text-amber-600') || classList.contains('text-amber-500')) clonedNode.style.color = '#d97706';
                
                if (classList.contains('bg-rose-500/[0.03]') || classList.contains('bg-rose-50')) {
                  clonedNode.style.backgroundColor = '#fff1f2';
                }
                if (classList.contains('bg-emerald-500/[0.04]') || classList.contains('bg-emerald-50')) {
                  clonedNode.style.backgroundColor = '#ecfdf5';
                }
                if (classList.contains('bg-sky-500/[0.04]') || classList.contains('bg-sky-50')) {
                  clonedNode.style.backgroundColor = '#f0f9ff';
                }
                if (classList.contains('bg-blue-500/[0.02]')) {
                  clonedNode.style.backgroundColor = '#eff6ff';
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
      return canvas;
    } finally {
      window.getComputedStyle = originalGetComputedStyle;
    }
  };

  const exportPDF = async () => {
    try {
      const canvas = await generatePattiCanvas(3);
      if (!canvas) {
        alert('Export failed to render canvas.');
        return;
      }
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      // A4 Dimensions in portrait: 210mm x 297mm
      const pdf = new jsPDF('p', 'mm', 'a4');
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
      alert('Export failed due to browser constraints. Use the print (Ctrl+P) option as a high-fidelity alternative.');
    }
  };

  const downloadPattiAsImage = async () => {
    if (isCapturingImage) return;
    setIsCapturingImage(true);
    try {
      const canvas = await generatePattiCanvas(imageScale);
      if (!canvas) {
        alert('Could not render document canvas. Please try again.');
        return;
      }
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        alert('Failed to encode PNG image.');
        return;
      }
      const filename = `Patti_Ledger_${(formData.partyName || 'Statement').replace(/[^a-zA-Z0-9_-]/g, '_')}_${printConfig.pattiNo}.png`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setCopyNotification({
        type: 'success',
        message: `Downloaded ${imageScale}× Ultra-HD PNG (${filename})!`
      });
      setTimeout(() => setCopyNotification(null), 3500);
    } catch (err) {
      console.error('Download PNG Error:', err);
      alert('Failed to download image. Try web print or PDF export instead.');
    } finally {
      setIsCapturingImage(false);
    }
  };

  const copyPattiAsImage = async () => {
    if (isCapturingImage) return;
    setIsCapturingImage(true);
    try {
      const canvas = await generatePattiCanvas(imageScale);
      if (!canvas) {
        alert('Could not render document canvas. Please try again.');
        return;
      }

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (!blob) {
        alert('Failed to encode PNG image.');
        return;
      }

      let copiedToClipboard = false;

      // Attempt high-fidelity Clipboard Item write
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        try {
          const item = new ClipboardItem({ 'image/png': blob });
          await navigator.clipboard.write([item]);
          copiedToClipboard = true;
        } catch (clipErr) {
          console.warn('Direct clipboard write failed, utilizing automatic download fallback:', clipErr);
        }
      }

      if (copiedToClipboard) {
        setCopiedImage(true);
        setCopyNotification({
          type: 'success',
          message: `Copied ${imageScale}× Ultra-HD image to clipboard! Ready to paste into WhatsApp, Email, or Slack.`
        });
        setTimeout(() => {
          setCopiedImage(false);
          setCopyNotification(null);
        }, 3500);
      } else {
        // Fallback: download PNG directly
        const filename = `Patti_Ledger_${(formData.partyName || 'Statement').replace(/[^a-zA-Z0-9_-]/g, '_')}_${printConfig.pattiNo}.png`;
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        setCopyNotification({
          type: 'fallback',
          message: 'Clipboard write restricted by browser. High-resolution PNG saved to Downloads!'
        });
        setTimeout(() => setCopyNotification(null), 4000);
      }
    } catch (error) {
      console.error('Copy Image Error:', error);
      alert('Failed to generate image. Please use web print (Ctrl+P) or PDF export.');
    } finally {
      setIsCapturingImage(false);
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
            disabled={isCapturingImage}
            title="Copy crisp lossless PNG image to clipboard for WhatsApp/Email"
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl shadow-lg transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer btn-tactile ${
              isCapturingImage
                ? 'bg-teal-700 text-white cursor-wait opacity-80'
                : copiedImage 
                  ? 'bg-emerald-600 text-white shadow-emerald-500/20 animate-pulse' 
                  : 'bg-teal-600 text-white shadow-teal-500/20 hover:opacity-95'
            }`}
          >
            {isCapturingImage ? (
              <Loader2 className="w-4 h-4 animate-spin text-teal-200" />
            ) : copiedImage ? (
              <CheckCircle2 className="w-4 h-4 animate-bounce text-emerald-200" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
            {isCapturingImage ? `Capturing ${imageScale}× HD...` : copiedImage ? 'Copied Image!' : 'Copy as Image'}
          </button>
          <button 
            onClick={downloadPattiAsImage}
            disabled={isCapturingImage}
            title="Download lossless PNG directly to your computer"
            className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl shadow-lg shadow-sky-500/20 transition-all font-black uppercase text-[10px] tracking-widest cursor-pointer btn-tactile disabled:opacity-50"
          >
            <ImageIcon className="w-4 h-4" />
            Download PNG
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
            className="bg-surface-container-lowest/80 border border-outline-variant/60 rounded-3xl p-5 shadow-xl no-print overflow-hidden text-left"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Settings className="w-5 h-5 text-primary" />
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider">Patti Print & Receipt customizer</h3>
                  <p className="text-secondary text-[11px] font-semibold">Tweak color themes and export resolution.</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-surface-container rounded-xl p-1 border border-outline-variant/20">
                  <span className="text-[9px] font-black text-secondary px-2 uppercase tracking-wide">IMAGE DPI:</span>
                  {([2, 3] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setImageScale(s)}
                      className={cn(
                        "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                        imageScale === s 
                          ? "bg-teal-600 text-white shadow-sm" 
                          : "text-secondary hover:text-on-surface"
                      )}
                    >
                      {s}× {s === 3 ? '(300 DPI Ultra)' : '(Standard)'}
                    </button>
                  ))}
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
                TC
              </div>
              <div>
                <h2 className={cn("text-xl font-bold tracking-tight uppercase leading-none pb-1", colors.primaryText)}>
                  TEJAS CANVASSING
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

        {/* Ribbon */}
        <div className="flex justify-between items-center mb-4 text-left">
          <div className="flex items-center gap-2">
            <span className={cn("w-2.5 h-2.5 rounded-full animate-pulse", printColorMode === 'mono' ? 'bg-black' : 'bg-amber-500')} />
            <span className={cn("text-[9px] font-black tracking-widest uppercase", colors.primaryText)}>
              Physical Patti verification statement & weightment ledger
            </span>
          </div>
        </div>

        {/* The Precise physical matrix form */}
        <div className="overflow-x-auto pb-2 -mx-2 sm:mx-0 px-2 sm:px-0">
          <div className={cn("border-t border-l grid grid-cols-10 transition-colors min-w-[720px]", colors.border, colors.textMain)}>
          
          {/* Row 1: MILLERNAME */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10">MILLERNAME</LabelCell>
          <div className={cn("col-span-8 border-r border-b h-10 flex items-center", colors.border)}>
            <input 
              type="text" 
              value={formData.millerName}
              onChange={(e) => updateField('millerName', e.target.value)}
              className="w-full h-full px-4 text-sm font-black uppercase outline-none bg-transparent leading-normal"
              placeholder="ENTER MILLER TRADE DESIGNATION"
            />
          </div>

          {/* Row 2: PARTYNAME */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10">PARTYNAME</LabelCell>
          <div className={cn("col-span-8 border-r border-b h-10 flex items-center", colors.border)}>
            <input 
              type="text" 
              value={formData.partyName}
              onChange={(e) => updateField('partyName', e.target.value)}
              className="w-full h-full px-4 text-sm font-black uppercase outline-none bg-transparent leading-normal"
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
          <div className={cn("col-span-2 border-r border-b h-10 flex items-center justify-center", colors.border)}>
            <input 
              type="date" 
              value={formData.arrivalDt}
              onChange={(e) => updateField('arrivalDt', e.target.value)}
              className="w-full h-full bg-transparent px-2 text-xs font-mono font-black tabular-nums outline-none text-center leading-normal"
            />
          </div>
          <div className={cn("col-span-6 border-r border-b h-10", colors.border)} />

          {/* Row 5: RATE (Qty, Rate, Amount) */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10">RATE / QTY</LabelCell>
          <InputCell value={formData.rateQty} onChange={(v) => updateField('rateQty', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-1 text-[8px] font-bold">X</LabelCell>
          <InputCell value={formData.rateRate} onChange={(v) => updateField('rateRate', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />
          <div className={cn("col-span-3 border-r border-b h-10 flex items-center justify-center px-2 text-sm font-mono font-black tabular-nums tracking-tight", colors.border, colors.accentBg)}>
            <span className="text-[10px] font-black text-blue-600/70 dark:text-blue-400/70 mr-1.5 uppercase tracking-wider">GROSS:</span>
            <span className="text-blue-700 dark:text-blue-300 font-extrabold">{formatINR(formData.rateAmount)}</span>
          </div>
          <div className={cn("col-span-2 border-r border-b h-10 flex items-center justify-center text-[9px] font-black uppercase tracking-widest text-neutral-400 bg-neutral-50/50 dark:bg-neutral-900/50", colors.border)}>
            SETTLEMENT DETAILS
          </div>

          {/* Row 6: LORRYHIRE / DEDUCT SUM / CHQ AM */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10 underline font-medium">LORRYHIRE</LabelCell>
          <InputCell value={formData.lorrySmall} onChange={(v) => updateField('lorrySmall', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />
          <div className={cn("col-span-1 border-r border-b h-10", colors.border)} />
          <div className={cn("col-span-1 border-r border-b h-10", colors.border)} />
          <div className={cn("col-span-3 border-r border-b h-10 flex items-center justify-center px-2 text-sm font-mono font-black tabular-nums tracking-tight", colors.border, colors.dedBg)}>
            <span className="text-[10px] font-black text-rose-500/80 mr-1.5 uppercase tracking-wider">TOTAL DED:</span>
            <span className="font-extrabold">{formatINR(formData.expensesSum)}</span>
          </div>
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-1 text-[9px]">CHQ AM</LabelCell>
          <InputCell value={formData.chqAm} onChange={(v) => updateField('chqAm', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />

          {/* Row 7: DISCOUNT / TDS / NET AM / CHQ NO */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10 underline font-medium">DISCOUNT / TDS ({(parseFloat(formData.discountPct)*100).toFixed(2)}%)</LabelCell>
          <div className={cn("col-span-1 border-r border-b h-10 flex items-center justify-center relative", colors.border)}>
            <select 
              value={formData.discountPct}
              onChange={(e) => { setIsManualDiscount(true); updateField('discountPct', e.target.value); }}
              className="w-full h-full bg-transparent p-1 text-[11px] font-mono font-black tabular-nums outline-none border-none appearance-none text-center cursor-pointer leading-normal"
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
          <div className={cn("col-span-1 border-r border-b h-10 flex items-center justify-center text-xs font-mono font-black tabular-nums tracking-tight px-1 truncate text-rose-600 dark:text-rose-400", colors.border)}>
            {formatINR(formData.discountAmount)}
          </div>
          <div className={cn("col-span-1 border-r border-b h-10", colors.border)} />
          <div className={cn("col-span-3 border-r border-b h-10 flex items-center justify-center px-2 text-sm font-mono font-black tabular-nums tracking-tight", colors.border, colors.netBg)}>
            <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 mr-1.5 uppercase tracking-wider">NET AMT:</span>
            <span className="text-emerald-700 dark:text-emerald-300 font-extrabold">{formatINR(formData.netAmount)}</span>
          </div>
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-1 text-[9px]">CHQ NO</LabelCell>
          <InputCell value={formData.chqNo} onChange={(v) => updateField('chqNo', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />

          {/* Row 8: SELLERCOM / CHQ DT */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10 underline font-medium">SELLERCOM</LabelCell>
          <InputCell 
            value={formData.sellerCom} 
            onChange={(v) => updateField('sellerCom', v)} 
            placeholder="0"
            className="col-span-1" 
            borderClass={colors.border} 
            activeTextClass={parseFloat(formData.sellerCom) > 0 ? colors.textMain : "text-neutral-400 dark:text-neutral-500"} 
          />
          <div className={cn("col-span-2 border-r border-b h-10", colors.border)} />
          <div className={cn("col-span-3 border-r border-b h-10 flex items-center justify-center px-2 text-sm font-mono font-bold tabular-nums tracking-tight text-blue-600 dark:text-blue-400", colors.border, colors.accentBg)}>
            <span className="text-[10px] font-black text-blue-500 mr-1.5 uppercase tracking-wider">CHQ PAID:</span>
            <span className="font-extrabold">{formatINR(formData.chqAm)}</span>
          </div>
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-1 text-[9px]">CHQ DT</LabelCell>
          <div className={cn("col-span-1 border-r border-b h-10 flex items-center justify-center", colors.border)}>
            <input 
              type="date" 
              value={formData.chqDt}
              onChange={(e) => updateField('chqDt', e.target.value)}
              className="w-full h-full bg-transparent px-1 text-[11px] font-mono font-bold tabular-nums outline-none text-center leading-normal"
            />
          </div>

          {/* Row 9: SHORTAGE / BANK */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10 underline font-medium text-rose-600">SHORTAGE</LabelCell>
          <InputCell value={formData.manualShortage} onChange={(v) => updateField('manualShortage', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />
          <div className={cn("col-span-2 border-r border-b h-10", colors.border)} />
          <div className={cn(
            "col-span-3 border-r border-b h-10 flex items-center justify-center px-2 text-sm font-mono font-black tabular-nums tracking-tight",
            colors.border,
            parseFloat(formData.shortageDelta) >= 0 ? "text-emerald-600 bg-emerald-500/[0.04]" : "text-rose-600 bg-rose-500/[0.04]"
          )}>
            <span className="text-[10px] font-black opacity-80 mr-1.5 uppercase tracking-wider">SHORTAGE Δ:</span>
            <span className="font-extrabold">{formatINR(formData.shortageDelta)}</span>
          </div>
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-1 text-[9px]">BANK</LabelCell>
          <InputCell value={formData.bank} onChange={(v) => updateField('bank', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />

          {/* Row 10: Q-DIFF */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-10">Q-DIFF</LabelCell>
          <InputCell value={formData.qDiff} onChange={(v) => updateField('qDiff', v)} className="col-span-1" borderClass={colors.border} activeTextClass={colors.textMain} />
          <div className={cn("col-span-7 border-r border-b h-10", colors.border)} />

          {/* Row 11: TOTAL / REMARKS */}
          <LabelCell borderClass={colors.border} bgClass={colors.labelBg} className="col-span-2 h-12 font-black uppercase tracking-tighter">TOTAL DEDUCTIBLES</LabelCell>
          <div className={cn("col-span-2 border-r border-b text-sm font-mono font-black tabular-nums tracking-normal px-2 truncate flex items-center justify-center", colors.border, colors.dedBg)}>
            {formatINR(formData.expensesSum)}
          </div>
          <div className={cn("col-span-1 border-r border-b px-2 flex items-center justify-center text-[9px] font-black uppercase text-neutral-400 border-r", colors.border)}>
            Remarks:
          </div>
          <div className={cn("col-span-5 border-r border-b h-12 flex items-center", colors.border)}>
            <input 
              type="text" 
              value={formData.remarks}
              onChange={(e) => updateField('remarks', e.target.value)}
              className="w-full h-full px-3 text-xs font-bold outline-none bg-transparent placeholder:text-neutral-400 leading-normal"
              placeholder="WRITE ARBITRAGE NOTES OR REMARK ENTRY..."
            />
          </div>

          </div>
        </div>
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
              disabled={isCapturingImage}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer btn-tactile ${
                isCapturingImage
                  ? 'bg-teal-700 text-white cursor-wait opacity-80'
                  : copiedImage 
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 animate-pulse' 
                    : 'bg-teal-600 text-white shadow-lg shadow-teal-500/20 hover:opacity-95'
              }`}
            >
               {isCapturingImage ? <Loader2 className="w-4 h-4 animate-spin text-teal-200" /> : copiedImage ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
               {isCapturingImage ? `Capturing ${imageScale}×...` : copiedImage ? 'Copied Image' : 'Copy as Image'}
            </button>
            <button 
              onClick={downloadPattiAsImage}
              disabled={isCapturingImage}
              className="flex items-center gap-2 px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-sky-500/20 cursor-pointer btn-tactile disabled:opacity-50"
            >
               <ImageIcon className="w-4 h-4" />
               Download PNG
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

      {/* Floating Notification Toast */}
      <AnimatePresence>
        {copyNotification && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={cn(
              "fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl border text-xs sm:text-sm font-black backdrop-blur-xl select-none",
              copyNotification.type === 'success' 
                ? "bg-neutral-900/95 dark:bg-neutral-100/95 text-white dark:text-neutral-900 border-emerald-500/50 shadow-emerald-500/20"
                : "bg-neutral-900/95 dark:bg-neutral-100/95 text-white dark:text-neutral-900 border-amber-500/50 shadow-amber-500/20"
            )}
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{copyNotification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
