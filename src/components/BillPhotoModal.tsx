import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  Trash2, 
  Download, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  FileText, 
  Check, 
  AlertCircle,
  Eye,
  Clipboard,
  Sparkles,
  CheckCircle2,
  FileImage,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';

interface BillPhotoModalProps {
  isOpen: boolean;
  onClose: () => void;
  row: any;
  rowIndex: number;
  onSavePhoto: (photoDataUrl: string) => void;
  onRemovePhoto: () => void;
}

// Generate an authentic sample rice mill consignment tax invoice for instant testing
function generateSampleBillImage(row: any): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background Paper Texture
  ctx.fillStyle = '#FBF9F5';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Outer Border
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#2D3748';
  ctx.strokeRect(40, 40, 1120, 1520);
  ctx.strokeRect(46, 46, 1108, 1508);

  // Header Title
  ctx.fillStyle = '#1A202C';
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TAX INVOICE / CONSIGNMENT BILL', 600, 110);

  ctx.font = 'bold 28px serif';
  ctx.fillStyle = '#1B4D3E';
  const supplier = row?.millerName || 'SRI LAKSHMI SRINIVASA MODERN RICE MILL';
  ctx.fillText(supplier.toUpperCase(), 600, 160);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#4A5568';
  ctx.fillText('Industrial Area, Miryalguda, Nalgonda Dist, Telangana - 508207', 600, 195);
  ctx.fillText('GSTIN: 36AAACL2410M1Z5 | FSSAI Lic: 13618014000329', 600, 225);

  // Horizontal Divider
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.moveTo(50, 250);
  ctx.lineTo(1150, 250);
  ctx.stroke();

  // Invoice Details Left & Right
  ctx.textAlign = 'left';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#1A202C';
  const billNum = row?.billNo || 'TM-4821';
  const billDate = row?.date || new Date().toISOString().split('T')[0];
  ctx.fillText(`BILL NO: ${billNum}`, 80, 295);
  ctx.fillText(`DATE: ${billDate}`, 80, 330);
  ctx.fillText(`TRUCK NO: ${row?.truckNo || 'TS-08-UB-4912'}`, 80, 365);

  ctx.fillText(`BUYER / CONSIGNEE:`, 650, 295);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#1E3A8A';
  ctx.fillText(row?.partyName || 'BALAJI TRADING CO.', 650, 330);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#4A5568';
  ctx.fillText(`Destination: ${row?.area || 'HYDERABAD (SANATHNAGAR)'}`, 650, 365);

  // Table Header
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(70, 420, 1060, 50);
  ctx.strokeRect(70, 420, 1060, 50);

  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#1A202C';
  ctx.fillText('SL', 90, 452);
  ctx.fillText('DESCRIPTION OF GOODS', 160, 452);
  ctx.fillText('BAGS', 560, 452);
  ctx.fillText('QTY (QTL)', 690, 452);
  ctx.fillText('RATE (₹)', 850, 452);
  ctx.fillText('AMOUNT (₹)', 990, 452);

  // Table Row 1
  ctx.strokeRect(70, 470, 1060, 380);
  ctx.font = '19px sans-serif';
  ctx.fillText('01', 95, 520);
  ctx.fillText(`${row?.brand || 'SONA MASOORI RAW RICE'} (HMT)`, 160, 520);
  ctx.fillText('HSN Code: 10063010', 160, 555);
  ctx.fillText(String(row?.bags || '520'), 575, 520);
  ctx.fillText(String(row?.qty || '260.00'), 705, 520);
  ctx.fillText(String(row?.rate || '3850.00'), 860, 520);
  
  const grossAmt = row?.amount || '1001000.00';
  ctx.textAlign = 'right';
  ctx.fillText(formatINR(grossAmt), 1100, 520);

  // Vertical column separators inside table
  ctx.beginPath();
  [140, 530, 660, 810, 960].forEach(x => {
    ctx.moveTo(x, 420);
    ctx.lineTo(x, 850);
  });
  ctx.stroke();

  // Summary / Deductions Block
  ctx.textAlign = 'left';
  ctx.strokeRect(70, 850, 1060, 350);
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(71, 851, 1058, 348);

  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(`Gross Amount:`, 650, 890);
  ctx.textAlign = 'right';
  ctx.fillText(`₹ ${formatINR(grossAmt)}`, 1100, 890);

  ctx.textAlign = 'left';
  ctx.fillText(`Less: L/H Charges:`, 650, 925);
  ctx.textAlign = 'right';
  ctx.fillText(`(-) ₹ ${formatINR(row?.lh || '0.00')}`, 1100, 925);

  ctx.textAlign = 'left';
  ctx.fillText(`Less: C/C Charges:`, 650, 960);
  ctx.textAlign = 'right';
  ctx.fillText(`(-) ₹ ${formatINR(row?.cc || '0.00')}`, 1100, 960);

  ctx.textAlign = 'left';
  ctx.fillText(`Less: TDS (0.1%):`, 650, 995);
  ctx.textAlign = 'right';
  ctx.fillText(`(-) ₹ ${formatINR(row?.tds || '0.00')}`, 1100, 995);

  // Net Amount Box
  ctx.fillStyle = '#1E293B';
  ctx.fillRect(630, 1030, 480, 60);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('NET PAYABLE:', 650, 1068);
  ctx.textAlign = 'right';
  const net = row?.netAmt || grossAmt;
  ctx.fillText(`₹ ${formatINR(net)}`, 1090, 1068);

  // Stamp & Signature watermark
  ctx.save();
  ctx.translate(900, 1340);
  ctx.rotate(-0.08);
  ctx.strokeStyle = '#1E3A8A';
  ctx.lineWidth = 3;
  ctx.strokeRect(-120, -45, 240, 90);
  ctx.fillStyle = '#1E3A8A';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SRI LAKSHMI RICE MILL', 0, -15);
  ctx.font = 'italic 18px cursive';
  ctx.fillText('Authorized Signatory', 0, 15);
  ctx.font = '12px sans-serif';
  ctx.fillText('VERIFIED & STAMPED', 0, 35);
  ctx.restore();

  // Footer notes
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748B';
  ctx.font = '14px sans-serif';
  ctx.fillText('1. Goods once sold will not be taken back.', 80, 1420);
  ctx.fillText('2. Weight and quality checked at mill weighbridge.', 80, 1445);
  ctx.fillText('3. Subject to Miryalguda Jurisdiction only.', 80, 1470);

  return canvas.toDataURL('image/jpeg', 0.88);
}

export default function BillPhotoModal({
  isOpen,
  onClose,
  row,
  rowIndex,
  onSavePhoto,
  onRemovePhoto
}: BillPhotoModalProps) {
  const [activeTab, setActiveTab] = useState<'view' | 'upload'>('view');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [capturedDraft, setCapturedDraft] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isConfirmingRemove, setIsConfirmingRemove] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const standardFileInputRef = useRef<HTMLInputElement | null>(null);

  const currentPhoto = row?.billPhoto || null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Initialize or reset view on open/change
  useEffect(() => {
    if (isOpen) {
      setZoomLevel(1);
      setRotation(0);
      setCapturedDraft(null);
      setIsConfirmingRemove(false);
      setIsDraggingOver(false);
      if (currentPhoto) {
        setActiveTab('view');
      } else {
        setActiveTab('upload');
      }
    }
  }, [isOpen, rowIndex]);

  // Keyboard shortcut listener (Escape to close, Ctrl+V to paste)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = async (event) => {
              const res = event.target?.result as string;
              if (res) {
                const compressed = await compressImage(res);
                setCapturedDraft(compressed);
                setActiveTab('view');
                showToast('Image pasted from clipboard!');
              }
            };
            reader.readAsDataURL(blob);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('paste', handlePaste);
    };
  }, [isOpen, onClose]);

  // Compress image before saving to maintain optimal performance
  const compressImage = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      if (result) {
        const compressed = await compressImage(result);
        setCapturedDraft(compressed);
        setActiveTab('view');
        showToast('Bill document selected! Click Save to apply.');
      }
      if (e.target) e.target.value = '';
    };
    reader.onerror = () => {
      showToast('Failed to read image file.');
      if (e.target) e.target.value = '';
    };
    reader.readAsDataURL(file);
  };

  const handleLoadSampleBill = () => {
    const sample = generateSampleBillImage(row);
    setCapturedDraft(sample);
    setActiveTab('view');
    showToast('Loaded sample tax invoice!');
  };

  const handleDownload = () => {
    const photoToDownload = capturedDraft || currentPhoto;
    if (!photoToDownload) return;

    const link = document.createElement('a');
    link.href = photoToDownload;
    const cleanBillNo = row?.billNo ? String(row.billNo).replace(/[^a-zA-Z0-9_-]/g, '') : 'Document';
    const cleanParty = row?.partyName ? String(row.partyName).replace(/[^a-zA-Z0-9_-]/g, '') : 'Party';
    link.download = `Bill_Document_${cleanBillNo}_${cleanParty}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Download started.');
  };

  const handleConfirmSave = (andClose: boolean = false) => {
    if (capturedDraft) {
      onSavePhoto(capturedDraft);
      setCapturedDraft(null);
      if (andClose) {
        onClose();
      } else {
        setActiveTab('view');
        showToast('Bill document saved successfully!');
      }
    }
  };

  const handleExecuteRemove = () => {
    onRemovePhoto();
    setCapturedDraft(null);
    setIsConfirmingRemove(false);
    setActiveTab('upload');
    showToast('Bill document removed.');
  };

  const handleClipboardPasteClick = async () => {
    if (navigator.clipboard && navigator.clipboard.read) {
      try {
        const clipboardItems = await navigator.clipboard.read();
        for (const item of clipboardItems) {
          const imageType = item.types.find(type => type.startsWith('image/'));
          if (imageType) {
            const blob = await item.getType(imageType);
            const reader = new FileReader();
            reader.onload = async (ev) => {
              const res = ev.target?.result as string;
              if (res) {
                const compressed = await compressImage(res);
                setCapturedDraft(compressed);
                setActiveTab('view');
                showToast('Image pasted from clipboard!');
              }
            };
            reader.readAsDataURL(blob);
            return;
          }
        }
        showToast('No image in clipboard. Copy an invoice image or press Ctrl+V.');
      } catch {
        showToast('Press Ctrl+V on your keyboard to paste the bill photo.');
      }
    } else {
      showToast('Press Ctrl+V on your keyboard to paste the bill photo.');
    }
  };

  if (!isOpen) return null;

  const activePhoto = capturedDraft || currentPhoto;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 sm:p-6 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface rounded-2xl border border-outline-variant/40 shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute top-16 left-1/2 -translate-x-1/2 z-60 bg-neutral-900/95 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-xl border border-white/10 flex items-center gap-2 backdrop-blur-md"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal Header */}
        <div className="bg-surface-container-low px-5 py-3.5 border-b border-outline-variant/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-on-surface">
                  Bill Document — Row #{rowIndex + 1}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  Desktop Invoice Attachment
                </span>
              </div>
              <p className="text-xs text-secondary opacity-80 flex flex-wrap items-center gap-2 mt-0.5">
                {row?.billNo && <span className="font-bold text-on-surface">Bill #{row.billNo}</span>}
                {row?.partyName && <span>• Buyer: <strong className="text-on-surface">{row.partyName}</strong></span>}
                {row?.millerName && <span>• Supplier: <strong className="text-on-surface">{row.millerName}</strong></span>}
                {row?.netAmt && <span>• Net: ₹ {formatINR(row.netAmt)}</span>}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-xl transition-all cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Controls */}
        <div className="bg-surface px-5 py-2.5 border-b border-outline-variant/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            {(currentPhoto || capturedDraft) && (
              <button
                type="button"
                onClick={() => setActiveTab('view')}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer",
                  activeTab === 'view'
                    ? "bg-primary text-white shadow-sm"
                    : "text-secondary hover:text-on-surface hover:bg-surface-container-high"
                )}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Document</span>
                {capturedDraft && (
                  <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Unsaved changes" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'upload'
                  ? "bg-primary text-white shadow-sm"
                  : "text-secondary hover:text-on-surface hover:bg-surface-container-high"
              )}
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{currentPhoto ? 'Upload / Replace File' : 'Upload / Attach File'}</span>
            </button>
          </div>

          {/* Viewer adjustments when looking at an image */}
          {activeTab === 'view' && activePhoto && (
            <div className="flex items-center gap-1 bg-surface-container-low px-2 py-1 rounded-xl border border-outline-variant/30">
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.max(0.6, prev - 0.2))}
                className="p-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container-high cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[10px] font-mono font-bold text-secondary w-9 text-center select-none">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel(prev => Math.min(3.5, prev + 0.2))}
                className="p-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container-high cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setRotation(prev => (prev + 90) % 360)}
                className="p-1 rounded text-secondary hover:text-on-surface hover:bg-surface-container-high ml-1 cursor-pointer"
                title="Rotate 90°"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoomLevel(1);
                  setRotation(0);
                }}
                className="text-[10px] font-bold text-primary hover:underline px-1 cursor-pointer"
              >
                Reset
              </button>
              <div className="w-px h-3 bg-outline-variant/50 mx-0.5" />
              <button
                type="button"
                onClick={() => setIsConfirmingRemove(true)}
                className="p-1 rounded text-rose-600 hover:bg-rose-500/10 cursor-pointer transition-all"
                title="Remove Document"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-5 bg-neutral-100/50 dark:bg-neutral-950/50 flex flex-col items-center justify-center min-h-[400px]">
          
          {/* TAB 1: VIEW ATTACHED BILL */}
          {activeTab === 'view' && (
            <div className="w-full flex-1 flex flex-col items-center justify-center">
              {activePhoto ? (
                <div className="w-full flex-1 flex flex-col items-center justify-center">
                  {capturedDraft && (
                    <div className="mb-2 px-3 py-1 bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 rounded-full text-xs font-bold flex items-center gap-1.5 shadow-xs">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>New Bill loaded — Click &quot;Save Document&quot; to apply to entry</span>
                    </div>
                  )}

                  <div className="overflow-auto max-h-[56vh] w-full rounded-xl border border-outline-variant/30 bg-black/5 dark:bg-black/40 flex items-center justify-center p-3 shadow-inner">
                    <img
                      src={activePhoto}
                      alt={`Bill for #${row?.billNo || 'Document'}`}
                      className="max-h-[50vh] object-contain transition-transform duration-150 rounded shadow-md select-none"
                      style={{
                        transform: `scale(${zoomLevel}) rotate(${rotation}deg)`
                      }}
                    />
                  </div>

                  <div className="mt-2.5 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setActiveTab('upload')}
                      className="text-xs text-primary hover:underline font-bold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-primary/10 transition-all cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Replace with different file</span>
                    </button>
                    <span className="text-secondary/40">•</span>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingRemove(true)}
                      className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-bold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-rose-500/10 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove bill document</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-10 flex flex-col items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-neutral-200 dark:bg-neutral-800 flex items-center justify-center text-secondary">
                    <FileImage className="w-7 h-7" />
                  </div>
                  <h3 className="text-sm font-black text-on-surface">No Bill Document Attached Yet</h3>
                  <p className="text-xs text-secondary max-w-sm">
                    Select a file from your computer, paste an invoice image from clipboard, or load a sample bill to test.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('upload')}
                    className="mt-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-md cursor-pointer hover:bg-primary/90"
                  >
                    Select File to Attach
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: UPLOAD & ATTACH (DESKTOP OPTIMIZED) */}
          {activeTab === 'upload' && (
            <div className="w-full max-w-lg flex flex-col items-center justify-center gap-4 py-4">
              {/* Primary Drag & Drop / File Browser Card */}
              <label
                htmlFor="bill-standard-file-input"
                onDragOver={(e) => { 
                  e.preventDefault(); 
                  e.stopPropagation(); 
                  setIsDraggingOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingOver(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                      const res = ev.target?.result as string;
                      if (res) {
                        const compressed = await compressImage(res);
                        setCapturedDraft(compressed);
                        setActiveTab('view');
                        showToast('Dropped image loaded!');
                      }
                    };
                    reader.readAsDataURL(file);
                  }
                }}
                className={cn(
                  "w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all text-center group shadow-sm select-none",
                  isDraggingOver 
                    ? "border-primary bg-primary/10 scale-[1.01]" 
                    : "border-outline-variant hover:border-primary bg-surface hover:bg-primary/5"
                )}
              >
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-105 transition-transform shadow-xs">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-black text-on-surface">Click to Browse or Drag &amp; Drop Bill</h3>
                  <p className="text-xs text-secondary mt-1 max-w-xs mx-auto">
                    Select JPG, PNG, WEBP invoices, bilty slips, or weighbridge receipts from your computer
                  </p>
                </div>
                
                <span className="mt-2 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl shadow-sm group-hover:brightness-110 pointer-events-none">
                  Choose File from Desktop
                </span>
              </label>

              {/* Desktop Instant Actions: Clipboard & Sample Generator */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Paste from Clipboard */}
                <button
                  type="button"
                  onClick={handleClipboardPasteClick}
                  className="px-4 py-3 bg-surface hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-bold text-on-surface flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs hover:border-primary/50"
                  title="Paste copied screenshot or image from clipboard"
                >
                  <Clipboard className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <div className="text-left">
                    <div className="font-bold">Paste from Clipboard</div>
                    <div className="text-[10px] text-secondary font-normal">Press Ctrl+V anywhere</div>
                  </div>
                </button>

                {/* Sample Invoice Generator */}
                <button
                  type="button"
                  onClick={handleLoadSampleBill}
                  className="px-4 py-3 bg-surface hover:bg-surface-container-high border border-outline-variant rounded-xl text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs hover:border-amber-500/50"
                  title="Generate a realistic sample Tax Invoice with this row's details"
                >
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <div className="text-left">
                    <div className="font-bold">Generate Sample Bill</div>
                    <div className="text-[10px] text-amber-600/80 dark:text-amber-400/80 font-normal">Auto-fills row details</div>
                  </div>
                </button>
              </div>

              <div className="text-[11px] text-secondary/70 italic text-center">
                This column stores consignment tax invoices, arrival receipts, and bilty slips for this entry.
              </div>
            </div>
          )}

          {/* Hidden File Input connected with label */}
          <input
            ref={standardFileInputRef}
            id="bill-standard-file-input"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/jpg"
            onChange={handleFileSelected}
            className="sr-only"
          />
        </div>

        {/* Modal Footer Actions */}
        <div className="bg-surface-container-low px-5 py-3 border-t border-outline-variant/40 flex items-center justify-between gap-3">
          {/* Left Side: Remove & Download Actions */}
          <div className="flex items-center gap-2">
            {isConfirmingRemove ? (
              <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-700/70 px-2.5 py-1 rounded-xl shadow-xs">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  Delete document?
                </span>
                <button
                  type="button"
                  onClick={handleExecuteRemove}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1"
                  title="Confirm permanent deletion"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Yes, Delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsConfirmingRemove(false)}
                  className="px-2 py-1 bg-surface hover:bg-surface-container-high text-secondary rounded-lg text-xs font-semibold border border-outline-variant/50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              (currentPhoto || capturedDraft) && (
                <button
                  type="button"
                  onClick={() => setIsConfirmingRemove(true)}
                  className="px-3.5 py-2 text-rose-600 hover:text-white hover:bg-rose-600 dark:hover:bg-rose-700 bg-rose-500/10 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border border-rose-500/30 cursor-pointer shadow-2xs active:scale-95"
                  title="Remove this bill document from entry"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Document</span>
                </button>
              )
            )}

            {activePhoto && !isConfirmingRemove && (
              <button
                type="button"
                onClick={handleDownload}
                className="px-3 py-2 text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                title="Download Document to PC"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download</span>
              </button>
            )}
          </div>

          {/* Right Side: Save, Discard, or Done */}
          <div className="flex items-center gap-2">
            {capturedDraft ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setCapturedDraft(null);
                    if (currentPhoto) {
                      setActiveTab('view');
                    } else {
                      setActiveTab('upload');
                    }
                  }}
                  className="px-3.5 py-2 bg-surface hover:bg-surface-container-high text-secondary rounded-xl text-xs font-bold border border-outline-variant transition-all cursor-pointer"
                >
                  Discard
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmSave(false)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 cursor-pointer"
                  title="Save bill document to table"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Document</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleConfirmSave(true)}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  title="Save and close modal"
                >
                  <Check className="w-4 h-4" />
                  <span>Save &amp; Close</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold transition-all border border-outline-variant/50 cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
