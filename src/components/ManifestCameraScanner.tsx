import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  X, 
  RefreshCw, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Sparkles, 
  RotateCcw, 
  Sliders, 
  ArrowRight, 
  Loader2, 
  Check, 
  Maximize2, 
  Truck, 
  Building2, 
  Hash, 
  Scale, 
  ReceiptIndianRupee,
  Layers,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';

export interface ParsedManifestData {
  date?: string;
  millerName?: string;
  place?: string;
  brand?: string;
  partyName?: string;
  area?: string;
  billNo?: string;
  qty?: number | string;
  rate?: number | string;
  amount?: number | string;
  lh?: number | string;
  cc?: number | string;
  tds?: number | string;
  shortage?: number | string;
  diffIn?: number | string;
  netAmt?: number | string;
  noOfDayRec?: string;
  truckNo?: string;
  purchaseOrderNo?: string;
  billPhoto?: string;
  confidence?: number;
  detectedDocType?: string;
  summary?: string;
}

interface ManifestCameraScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (data: ParsedManifestData, targetMode: 'new' | 'current') => void;
  hasSelectedRow: boolean;
  selectedRowIndex?: number;
  knownSuppliers?: string[];
  knownBuyers?: string[];
  knownBrands?: string[];
}

export default function ManifestCameraScanner({
  isOpen,
  onClose,
  onApply,
  hasSelectedRow,
  selectedRowIndex,
  knownSuppliers = [],
  knownBuyers = [],
  knownBrands = []
}: ManifestCameraScannerProps) {
  // Mode: 'camera' | 'preview' | 'parsing' | 'review'
  const [mode, setMode] = useState<'camera' | 'preview' | 'parsing' | 'review'>('camera');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [parsingProgress, setParsingProgress] = useState<string>('');
  const [parseError, setParseError] = useState<string | null>(null);

  // Editable parsed fields
  const [formData, setFormData] = useState<ParsedManifestData>({
    date: new Date().toISOString().split('T')[0],
    millerName: '',
    place: 'MIRYALGUDA',
    brand: 'KESHAR KALI',
    partyName: '',
    area: '4TH BLOCK',
    billNo: '',
    qty: '',
    rate: '',
    amount: '',
    lh: '',
    cc: '',
    tds: '',
    shortage: '',
    diffIn: '',
    netAmt: '',
    noOfDayRec: 'Not Cleared',
    truckNo: '',
    purchaseOrderNo: '',
    confidence: 0.9,
    detectedDocType: 'Paper Transport Manifest',
    summary: ''
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop camera tracks cleanly
  const stopCamera = useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {}
      });
      setCameraStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [cameraStream]);

  // Start camera with requested facing mode
  const startCamera = useCallback(async (facing: 'environment' | 'user' = 'environment') => {
    stopCamera();
    setCameraError(null);

    try {
      // First try preferred high-definition constraints
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          },
          audio: false
        });
      } catch (hdErr) {
        // Fallback to generic constraints if ideal constraints fail
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      }

      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(e => console.warn("Video play error:", e));
      }
    } catch (err: any) {
      console.warn("Camera access failed:", err);
      let errMsg = "Camera access was denied or is not available on this device.";
      if (err.name === 'NotAllowedError') {
        errMsg = "Camera permission was not granted. Please allow camera permissions in your browser or upload an image instead.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errMsg = "No camera hardware was detected. Please upload a picture of your paper manifest.";
      }
      setCameraError(errMsg);
    }
  }, [stopCamera]);

  // Manage camera lifecycle when modal opens / closes / facing changes
  useEffect(() => {
    if (isOpen && (mode === 'camera')) {
      startCamera(cameraFacing);
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, mode, cameraFacing, startCamera, stopCamera]);

  // Handle capture snapshot from live video stream
  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    stopCamera();
    setMode('preview');
  };

  // Handle local file selection / photo upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setCapturedImage(dataUrl);
        stopCamera();
        setMode('preview');
      }
    };
    reader.readAsDataURL(file);
  };

  // Flip camera between environment (rear) and user (front)
  const toggleFacingMode = () => {
    setCameraFacing(prev => prev === 'environment' ? 'user' : 'environment');
  };

  // Trigger AI parsing request to /api/scan-manifest
  const runParser = async (imageSrc: string) => {
    setMode('parsing');
    setParseError(null);
    setParsingProgress('Connecting to Gemini AI Optical Recognition Engine...');

    try {
      setParsingProgress('Scanning paper layout, extracting consignor, consignee & line items...');

      const response = await fetch('/api/scan-manifest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageSrc,
          mimeType: 'image/jpeg'
        })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to parse shipment manifest.');
      }

      setParsingProgress('Finalizing structured ledger fields and calculations...');

      const parsed: ParsedManifestData = result.manifest || {};

      // Match known suppliers or buyers if fuzzy matched
      let resolvedSupplier = parsed.millerName || '';
      if (knownSuppliers.length > 0 && resolvedSupplier) {
        const found = knownSuppliers.find(s => 
          s.toLowerCase().includes(resolvedSupplier.toLowerCase()) || 
          resolvedSupplier.toLowerCase().includes(s.toLowerCase())
        );
        if (found) resolvedSupplier = found;
      }

      let resolvedBuyer = parsed.partyName || '';
      if (knownBuyers.length > 0 && resolvedBuyer) {
        const found = knownBuyers.find(b => 
          b.toLowerCase().includes(resolvedBuyer.toLowerCase()) || 
          resolvedBuyer.toLowerCase().includes(b.toLowerCase())
        );
        if (found) resolvedBuyer = found;
      }

      let resolvedBrand = parsed.brand || '';
      if (knownBrands.length > 0 && resolvedBrand) {
        const found = knownBrands.find(br => 
          br.toLowerCase().includes(resolvedBrand.toLowerCase()) || 
          resolvedBrand.toLowerCase().includes(br.toLowerCase())
        );
        if (found) resolvedBrand = found;
      }

      // Format date
      let finalDate = parsed.date || new Date().toISOString().split('T')[0];
      if (!/^\d{4}-\d{2}-\d{2}$/.test(finalDate)) {
        finalDate = new Date().toISOString().split('T')[0];
      }

      // Compute amounts if needed
      const qtyNum = Number(parsed.qty) || 0;
      const rateNum = Number(parsed.rate) || 0;
      let amtNum = Number(parsed.amount) || (qtyNum * rateNum);
      const lhNum = Number(parsed.lh) || 0;
      const ccNum = Number(parsed.cc) || 0;
      const tdsNum = Number(parsed.tds) || 0;
      const shortageNum = Number(parsed.shortage) || 0;
      const diffInNum = Number(parsed.diffIn) || 0;
      let netAmtNum = Number(parsed.netAmt) || (amtNum + lhNum + ccNum - tdsNum - shortageNum + diffInNum);

      setFormData({
        date: finalDate,
        millerName: resolvedSupplier || parsed.millerName || '',
        place: parsed.place || 'MIRYALGUDA',
        brand: resolvedBrand || parsed.brand || 'KESHAR KALI',
        partyName: resolvedBuyer || parsed.partyName || '',
        area: parsed.area || '4TH BLOCK',
        billNo: parsed.billNo ? String(parsed.billNo).replace(/^(bill|inv|lr|tc)[-.\s]*/i, '') : '',
        qty: qtyNum > 0 ? qtyNum : '',
        rate: rateNum > 0 ? rateNum : '',
        amount: amtNum > 0 ? amtNum : '',
        lh: lhNum !== 0 ? lhNum : '',
        cc: ccNum !== 0 ? ccNum : '',
        tds: tdsNum !== 0 ? tdsNum : '',
        shortage: shortageNum !== 0 ? shortageNum : '',
        diffIn: diffInNum !== 0 ? diffInNum : '',
        netAmt: netAmtNum > 0 ? netAmtNum : '',
        noOfDayRec: parsed.noOfDayRec || 'Not Cleared',
        truckNo: parsed.truckNo || '',
        purchaseOrderNo: parsed.purchaseOrderNo || '',
        confidence: parsed.confidence || 0.94,
        detectedDocType: parsed.detectedDocType || 'Paper Manifest / Bilty',
        summary: parsed.summary || 'Paper manifest successfully parsed and mapped to the arrival ledger.'
      });

      setMode('review');
    } catch (err: any) {
      console.error("Manifest scan failure:", err);
      setParseError(err.message || 'Could not parse document. Please check image sharpness or lighting.');
      setMode('preview');
    }
  };

  // Re-calculate totals when qty or rate changes
  const handleFieldChange = (field: keyof ParsedManifestData, val: any) => {
    setFormData(prev => {
      const next = { ...prev, [field]: val };
      if (field === 'qty' || field === 'rate') {
        const q = Number(field === 'qty' ? val : next.qty) || 0;
        const r = Number(field === 'rate' ? val : next.rate) || 0;
        if (q > 0 && r > 0) {
          const calculatedGross = Math.round(q * r);
          next.amount = calculatedGross;
          const lh = Number(next.lh) || 0;
          const cc = Number(next.cc) || 0;
          const tds = Number(next.tds) || 0;
          const shortage = Number(next.shortage) || 0;
          const diffIn = Number(next.diffIn) || 0;
          next.netAmt = Math.round(calculatedGross + lh + cc - tds - shortage + diffIn);
        }
      } else if (['amount', 'lh', 'cc', 'tds', 'shortage', 'diffIn'].includes(field)) {
        const gross = Number(next.amount) || 0;
        const lh = Number(next.lh) || 0;
        const cc = Number(next.cc) || 0;
        const tds = Number(next.tds) || 0;
        const shortage = Number(next.shortage) || 0;
        const diffIn = Number(next.diffIn) || 0;
        next.netAmt = Math.round(gross + lh + cc - tds - shortage + diffIn);
      }
      return next;
    });
  };

  // Load a built-in realistic demo manifest simulation image (for instant testing without needing paper)
  const loadDemoManifest = () => {
    // Generate a high-contrast mockup invoice on canvas
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background paper
    ctx.fillStyle = '#FAF9F6';
    ctx.fillRect(0, 0, 900, 1200);

    // Border
    ctx.strokeStyle = '#222222';
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 840, 1140);

    // Header
    ctx.fillStyle = '#1A1A1A';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('LORRY RECEIPT / DELIVERY MANIFEST', 180, 80);

    ctx.font = 'normal 16px Arial';
    ctx.fillText('ANNAPURNA RICE & AGRO INDUSTRIES', 60, 130);
    ctx.font = '14px Arial';
    ctx.fillText('Industrial Area, Miryalguda, Nalgonda Dist.', 60, 155);
    ctx.fillText('GSTIN: 36AAACA1234F1Z5 | Phone: +91 98480 12345', 60, 180);

    ctx.strokeRect(60, 210, 780, 100);
    ctx.font = 'bold 15px Arial';
    ctx.fillText('Manifest / Bilty No: MNF-2026-8842', 80, 245);
    ctx.fillText('Date: 04-Sep-2026', 560, 245);
    ctx.fillText('Vehicle / Lorry No: AP-24-TX-9941', 80, 285);
    ctx.fillText('PO Reference: PO-AUG-902', 560, 285);

    // Consignee box
    ctx.strokeRect(60, 330, 780, 100);
    ctx.fillText('Consignee (Buyer / Party): V.K FOODS', 80, 365);
    ctx.font = 'normal 14px Arial';
    ctx.fillText('Delivery Area: 4TH BLOCK, Main Commercial Market, Bangalore', 80, 395);

    // Table header
    ctx.fillStyle = '#EEEEEE';
    ctx.fillRect(60, 460, 780, 40);
    ctx.strokeRect(60, 460, 780, 40);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('Item / Commodity Description', 80, 485);
    ctx.fillText('Bags', 400, 485);
    ctx.fillText('Weight (Qtls)', 500, 485);
    ctx.fillText('Rate (₹/Qtl)', 630, 485);
    ctx.fillText('Amount (₹)', 740, 485);

    // Table row
    ctx.strokeRect(60, 500, 780, 120);
    ctx.font = 'normal 14px Arial';
    ctx.fillText('KESHAR KALI (Premium Sortex Rice)', 80, 540);
    ctx.fillText('520 Bags', 400, 540);
    ctx.fillText('260.00 QTLS', 500, 540);
    ctx.fillText('₹ 3,850.00', 630, 540);
    ctx.font = 'bold 14px Arial';
    ctx.fillText('₹ 10,01,000', 740, 540);

    // Financial totals
    ctx.strokeRect(500, 640, 340, 200);
    ctx.font = 'normal 14px Arial';
    ctx.fillText('Gross Value:', 520, 675);
    ctx.fillText('₹ 10,01,000', 730, 675);

    ctx.fillText('Loading / Hamali (L.H.):', 520, 710);
    ctx.fillText('₹ 2,600', 730, 710);

    ctx.fillText('Commission / Brokerage:', 520, 745);
    ctx.fillText('₹ 5,200', 730, 745);

    ctx.fillText('TDS Deduction:', 520, 780);
    ctx.fillText('₹ 1,001', 730, 780);

    ctx.fillStyle = '#E8F5E9';
    ctx.fillRect(500, 840, 340, 50);
    ctx.strokeRect(500, 840, 340, 50);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Net Amount Payable:', 520, 872);
    ctx.fillText('₹ 10,07,799', 720, 872);

    // Signature stamp
    ctx.font = 'italic 14px Arial';
    ctx.fillText('Authorized Weighbridge & Trade Dispatch In-charge', 80, 980);
    ctx.font = 'bold 12px Arial';
    ctx.fillText('[ Verified Computer Generated Transport Challan ]', 80, 1010);

    const demoDataUrl = canvas.toDataURL('image/jpeg', 0.95);
    setCapturedImage(demoDataUrl);
    stopCamera();
    runParser(demoDataUrl);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-surface rounded-2xl border border-outline-variant/40 shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden relative"
      >
        {/* Header Bar */}
        <div className="bg-surface-container-low px-5 py-4 border-b border-outline-variant/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black tracking-tight text-on-surface">
                  Paper Manifest Camera Scanner
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                  AI Optical Parser
                </span>
              </div>
              <p className="text-xs text-secondary opacity-70">
                Scan bills, bilty slips, weighbridge slips, or delivery challans directly into the Arrival Ledger
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-lg transition-all"
            title="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Switch between Camera, Preview, Parsing, and Review */}
        <div className="flex-1 overflow-y-auto p-5">
          {/* STEP 1: CAMERA LIVE FEED */}
          {mode === 'camera' && (
            <div className="flex flex-col items-center gap-4">
              {cameraError ? (
                <div className="w-full max-w-lg p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-center flex flex-col items-center gap-4 my-8">
                  <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-600 flex items-center justify-center">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-rose-700 uppercase tracking-wider">Camera Unavailable</h3>
                    <p className="text-xs text-secondary mt-1">{cameraError}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
                    <button
                      onClick={() => startCamera(cameraFacing)}
                      className="px-4 py-2 bg-surface text-on-surface border border-outline-variant rounded-xl text-xs font-bold hover:bg-surface-container-high transition-all flex items-center gap-2"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Try Again
                    </button>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all flex items-center gap-2 shadow-md shadow-primary/20"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Upload Photo / File
                    </button>
                    <button
                      onClick={loadDemoManifest}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-md shadow-emerald-600/20"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Try Demo Bilty
                    </button>
                  </div>
                </div>
              ) : (
                <div className="w-full flex flex-col items-center">
                  {/* Viewfinder Window */}
                  <div className="relative w-full max-w-xl aspect-[4/3] bg-black rounded-2xl overflow-hidden border-2 border-primary/30 shadow-2xl flex items-center justify-center group">
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                      autoPlay
                    />

                    {/* Viewfinder targeting bracket corners */}
                    <div className="absolute inset-8 pointer-events-none border-2 border-dashed border-white/40 rounded-xl flex flex-col justify-between p-2">
                      <div className="flex justify-between">
                        <div className="w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
                        <div className="w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
                      </div>
                      
                      {/* Scanning laser effect */}
                      <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_8px_#10b981] animate-pulse" />

                      <div className="flex justify-between">
                        <div className="w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
                        <div className="w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />
                      </div>
                    </div>

                    {/* Alignment Guide Instruction Banner */}
                    <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
                      <span className="bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border border-white/10 flex items-center gap-1.5 shadow-lg">
                        <Maximize2 className="w-3 h-3 text-emerald-400" />
                        Align Paper Manifest Inside Frame
                      </span>
                    </div>

                    {/* Quick switch camera button */}
                    <button
                      onClick={toggleFacingMode}
                      className="absolute bottom-3 right-3 p-2.5 bg-black/60 backdrop-blur-md hover:bg-black/80 text-white rounded-xl border border-white/20 transition-all active:scale-95 shadow-lg"
                      title="Switch Front/Back Camera"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Camera Controls Bar */}
                  <div className="flex flex-wrap items-center justify-center gap-4 mt-6">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold border border-outline-variant transition-all flex items-center gap-2"
                      title="Upload an existing photo of a manifest"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Photo
                    </button>

                    {/* Primary Shutter Button */}
                    <button
                      onClick={capturePhoto}
                      className="px-8 py-3.5 bg-primary text-white hover:bg-primary/95 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-primary/30 flex items-center gap-3 active:scale-95 ring-4 ring-primary/20 hover:ring-primary/40"
                    >
                      <Camera className="w-5 h-5 animate-pulse" />
                      Capture & Parse Manifest
                    </button>

                    {/* Instant Demo Manifest Button */}
                    <button
                      onClick={loadDemoManifest}
                      className="px-4 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                      title="Run with a sample rice manifest without camera"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-500" />
                      Load Sample Bilty
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 2: PREVIEW CAPTURED PHOTO BEFORE PARSING */}
          {mode === 'preview' && capturedImage && (
            <div className="flex flex-col items-center gap-5">
              <div className="relative w-full max-w-lg aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-outline-variant shadow-xl flex items-center justify-center">
                <img
                  src={capturedImage}
                  alt="Captured Manifest"
                  className="w-full h-full object-contain"
                />
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md text-white px-3 py-1 rounded-full text-[10px] font-bold border border-white/20">
                  Ready to Extract
                </div>
              </div>

              {parseError && (
                <div className="w-full max-w-lg p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{parseError}</span>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setCapturedImage(null);
                    setMode('camera');
                  }}
                  className="px-4 py-2.5 bg-surface-container-high hover:bg-surface-container-highest text-on-surface rounded-xl text-xs font-bold border border-outline-variant transition-all flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  Retake Photo
                </button>
                <button
                  onClick={() => runParser(capturedImage)}
                  className="px-6 py-2.5 bg-primary text-white hover:bg-primary/90 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Analyze with Gemini AI
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PARSING PROGRESS SPINNER */}
          {mode === 'parsing' && (
            <div className="py-14 flex flex-col items-center justify-center text-center gap-4">
              <div className="relative w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/30 flex items-center justify-center text-primary shadow-xl">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
              </div>
              <div>
                <h3 className="text-base font-black text-on-surface tracking-tight">
                  Scanning Paper Manifest...
                </h3>
                <p className="text-xs text-secondary max-w-md mt-1 font-medium">
                  {parsingProgress || 'Processing visual document through Gemini 3.8 Flash OCR...'}
                </p>
              </div>
              <div className="w-64 h-1.5 bg-surface-container-high rounded-full overflow-hidden mt-2">
                <div className="w-1/2 h-full bg-primary rounded-full animate-pulse" />
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & VERIFY EXTRACTED FIELDS */}
          {mode === 'review' && (
            <div className="flex flex-col gap-5">
              {/* Extraction Confidence & Summary Banner */}
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-center shrink-0 mt-0.5">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-emerald-800 dark:text-emerald-200 uppercase tracking-wider">
                        {formData.detectedDocType || 'Paper Manifest Parsed'}
                      </span>
                      <span className="text-[10px] font-black px-1.5 py-0.5 bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded">
                        {Math.round((formData.confidence || 0.95) * 100)}% Match
                      </span>
                    </div>
                    <p className="text-xs text-secondary mt-0.5 font-medium">
                      {formData.summary || 'Please verify the extracted values below before injecting into the arrival ledger.'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    onClick={() => setMode('camera')}
                    className="px-3 py-1.5 text-[11px] font-bold text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-lg border border-outline-variant/50 transition-all flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Scan Another
                  </button>
                </div>
              </div>

              {/* Two column layout: Image thumbnail + editable form */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Scanned Image Preview Thumbnail */}
                {capturedImage && (
                  <div className="lg:col-span-4 flex flex-col gap-2">
                    <span className="text-[10px] font-black text-secondary uppercase tracking-wider">
                      Scanned Document Snapshot
                    </span>
                    <div className="w-full aspect-[3/4] rounded-xl overflow-hidden border border-outline-variant bg-black/40 relative shadow-inner">
                      <img
                        src={capturedImage}
                        alt="Scanned manifest"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute bottom-2 left-2 right-2 bg-black/70 backdrop-blur-md px-2.5 py-1.5 rounded-lg text-[10px] text-white/90 flex items-center justify-between">
                        <span>Vehicle: {formData.truckNo || 'Not specified'}</span>
                        <span>{formData.date}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Form Fields Grid */}
                <div className={cn("flex flex-col gap-4", capturedImage ? "lg:col-span-8" : "lg:col-span-12")}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Date */}
                    <div>
                      <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1">
                        Arrival / Invoice Date
                      </label>
                      <input
                        type="date"
                        value={formData.date || ''}
                        onChange={e => handleFieldChange('date', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-surface-container-low border border-outline-variant rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* Bill / Bilty No */}
                    <div>
                      <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Bill / Bilty / Manifest No</span>
                        <span className="text-emerald-600 text-[9px]">Extracted</span>
                      </label>
                      <input
                        type="text"
                        value={formData.billNo || ''}
                        placeholder="e.g. 1042 or MNF-8842"
                        onChange={e => handleFieldChange('billNo', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-surface-container-low border border-outline-variant rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* Supplier / Miller */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1">
                        Supplier / Miller (Consignor)
                      </label>
                      <input
                        type="text"
                        value={formData.millerName || ''}
                        placeholder="e.g. ANNAPURNA RICE & AGRO INDUSTRIES"
                        onChange={e => handleFieldChange('millerName', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-surface-container-low border border-outline-variant rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* Supplier Place */}
                    <div>
                      <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1">
                        Origin Place / Market
                      </label>
                      <input
                        type="text"
                        value={formData.place || ''}
                        placeholder="e.g. MIRYALGUDA"
                        onChange={e => handleFieldChange('place', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-surface-container-low border border-outline-variant rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* Brand / Quality */}
                    <div>
                      <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1">
                        Brand / Rice Variety
                      </label>
                      <input
                        type="text"
                        value={formData.brand || ''}
                        placeholder="e.g. KESHAR KALI, 1121 Sella"
                        onChange={e => handleFieldChange('brand', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-surface-container-low border border-outline-variant rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* Buyer / Party Name */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1">
                        Buyer / Party Name (Consignee)
                      </label>
                      <input
                        type="text"
                        value={formData.partyName || ''}
                        placeholder="e.g. V.K FOODS"
                        onChange={e => handleFieldChange('partyName', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-surface-container-low border border-outline-variant rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* Buyer Area (Shop) */}
                    <div>
                      <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1">
                        Buyer Area (Shop)
                      </label>
                      <input
                        type="text"
                        value={formData.area || ''}
                        placeholder="e.g. 4TH BLOCK"
                        onChange={e => handleFieldChange('area', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-surface-container-low border border-outline-variant rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* Purchase Order / Contract No */}
                    <div>
                      <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1">
                        PO / Contract Ref No
                      </label>
                      <input
                        type="text"
                        value={formData.purchaseOrderNo || ''}
                        placeholder="e.g. PO-AUG-902"
                        onChange={e => handleFieldChange('purchaseOrderNo', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-surface-container-low border border-outline-variant rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* Quantity (QTLS) */}
                    <div>
                      <label className="block text-[10px] font-black text-primary uppercase tracking-wider mb-1 flex items-center justify-between">
                        <span>Quantity (QTLS)</span>
                        <span className="text-[9px] font-normal text-secondary">Quintals</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.qty || ''}
                        placeholder="e.g. 260.00"
                        onChange={e => handleFieldChange('qty', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-black text-primary bg-surface-container-low border border-primary/30 rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* Rate */}
                    <div>
                      <label className="block text-[10px] font-black text-primary uppercase tracking-wider mb-1">
                        Rate (₹ / Qtl)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.rate || ''}
                        placeholder="e.g. 3850"
                        onChange={e => handleFieldChange('rate', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-black text-primary bg-surface-container-low border border-primary/30 rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* Gross Amount */}
                    <div>
                      <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1">
                        Gross Amount (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.amount || ''}
                        placeholder="Auto-calculated"
                        onChange={e => handleFieldChange('amount', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-surface-container-low border border-outline-variant rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* L.H. (Loading/Hamali) */}
                    <div>
                      <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1">
                        L.H. Charges (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.lh || ''}
                        placeholder="0"
                        onChange={e => handleFieldChange('lh', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-surface-container-low border border-outline-variant rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* C.C. (Commission) */}
                    <div>
                      <label className="block text-[10px] font-black text-secondary uppercase tracking-wider mb-1">
                        C.C. / Comm (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.cc || ''}
                        placeholder="0"
                        onChange={e => handleFieldChange('cc', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-bold bg-surface-container-low border border-outline-variant rounded-xl focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    {/* Net Amount */}
                    <div>
                      <label className="block text-[10px] font-black text-emerald-600 uppercase tracking-wider mb-1">
                        Net Amount Payable (₹)
                      </label>
                      <input
                        type="number"
                        value={formData.netAmt || ''}
                        placeholder="Net sum"
                        onChange={e => handleFieldChange('netAmt', e.target.value)}
                        className="w-full px-3 py-2 text-xs font-black text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-xl focus:ring-1 focus:ring-emerald-500 outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions Bar */}
        <div className="bg-surface-container-low px-5 py-4 border-t border-outline-variant/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-secondary">
            {mode === 'camera' && (
              <span className="flex items-center gap-1.5 opacity-80">
                <HelpCircle className="w-3.5 h-3.5 text-primary" />
                Hold manifest steady in good lighting for maximum OCR accuracy
              </span>
            )}
            {mode === 'review' && (
              <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ready to commit to Arrival Ledger
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="px-4 py-2 text-xs font-bold text-secondary hover:text-on-surface hover:bg-surface-container-high rounded-xl transition-all"
            >
              Cancel
            </button>

            {mode === 'review' && (
              <>
                {hasSelectedRow && selectedRowIndex !== undefined && (
                  <button
                    onClick={() => {
                      onApply({ ...formData, billPhoto: capturedImage || undefined }, 'current');
                      stopCamera();
                      onClose();
                    }}
                    className="px-4 py-2 bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant rounded-xl text-xs font-bold transition-all flex items-center gap-2"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Fill Row #{selectedRowIndex + 1}
                  </button>
                )}

                <button
                  onClick={() => {
                    onApply({ ...formData, billPhoto: capturedImage || undefined }, 'new');
                    stopCamera();
                    onClose();
                  }}
                  className="px-5 py-2.5 bg-primary text-white hover:bg-primary/90 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-primary/25 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Insert as New Arrival Row
                </button>
              </>
            )}
          </div>
        </div>

        {/* Hidden File Input for Image Upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileUpload}
          className="hidden"
        />
      </motion.div>
    </div>
  );
}
