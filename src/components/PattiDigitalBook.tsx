import React, { useState, useEffect, useCallback } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2, 
  BookOpen, 
  Layers, 
  Sparkles, 
  SlidersHorizontal, 
  CheckSquare, 
  Square, 
  Printer, 
  Volume2,
  VolumeX,
  Grid2X2,
  Rows4
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { PattiRecordItem, PattiPdfLayout } from '../utils/pattiBookManager';
import PattiFormDisplay from './PattiFormDisplay';
import { cn } from '../lib/utils';

interface PattiDigitalBookProps {
  records: PattiRecordItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onInspectPatti: (patti: PattiRecordItem) => void;
  onOpenExportModal: () => void;
  isLoading?: boolean;
  layout?: PattiPdfLayout;
  onLayoutChange?: (layout: PattiPdfLayout) => void;
}

export default function PattiDigitalBook({
  records,
  selectedIds,
  onToggleSelect,
  onInspectPatti,
  onOpenExportModal,
  isLoading = false,
  layout,
  onLayoutChange
}: PattiDigitalBookProps) {
  // Layout option in digital mandi register: '2x2' (Book spread) or '1x4' (Vertical stack)
  const [layoutMode, setLayoutMode] = useState<PattiPdfLayout>(() => {
    if (layout) return layout;
    try {
      const saved = localStorage.getItem('patti_book_view_layout');
      return (saved === '1x4' ? '1x4' : '2x2');
    } catch {
      return '2x2';
    }
  });

  // Sync external layout prop if supplied
  useEffect(() => {
    if (layout && layout !== layoutMode) {
      setLayoutMode(layout);
    }
  }, [layout]);

  const handleSwitchLayout = (mode: PattiPdfLayout) => {
    setLayoutMode(mode);
    try {
      localStorage.setItem('patti_book_view_layout', mode);
    } catch {}
    if (onLayoutChange) {
      onLayoutChange(mode);
    }
  };

  // Current spread index (each spread contains 4 Pattis: 2 on Left Page + 2 on Right Page in 2x2, or 4 stacked in 1x4)
  const [spreadIndex, setSpreadIndex] = useState<number>(0);
  const [direction, setDirection] = useState<number>(0); // 1 = forward, -1 = backward
  const [zoomLevel, setZoomLevel] = useState<number>(100);
  const [isSinglePageMobile, setIsSinglePageMobile] = useState<boolean>(false);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(false);
  const [showThumbnails, setShowThumbnails] = useState<boolean>(true);

  // Responsive layout detection
  useEffect(() => {
    const handleResize = () => {
      setIsSinglePageMobile(window.innerWidth < 840);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Items per spread: 4 on desktop (2 per page), 2 on mobile (single page of 2) for 2x2; in 1x4, always 4 items per folio
  const itemsPerSpread = (isSinglePageMobile && layoutMode === '2x2') ? 2 : 4;
  const totalSpreads = Math.max(1, Math.ceil(records.length / itemsPerSpread));

  // Reset spread index if filtered records shrink
  useEffect(() => {
    if (spreadIndex >= totalSpreads) {
      setSpreadIndex(Math.max(0, totalSpreads - 1));
    }
  }, [totalSpreads, spreadIndex]);

  // Page turn sound synth
  const playPageTurnSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.14);
    } catch {}
  }, [soundEnabled]);

  const handleNextSpread = useCallback(() => {
    if (spreadIndex < totalSpreads - 1) {
      setDirection(1);
      setSpreadIndex(prev => prev + 1);
      playPageTurnSound();
    }
  }, [spreadIndex, totalSpreads, playPageTurnSound]);

  const handlePrevSpread = useCallback(() => {
    if (spreadIndex > 0) {
      setDirection(-1);
      setSpreadIndex(prev => prev - 1);
      playPageTurnSound();
    }
  }, [spreadIndex, playPageTurnSound]);

  // Keyboard navigation (ArrowLeft & ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        handleNextSpread();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        handlePrevSpread();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNextSpread, handlePrevSpread]);

  // Extract 4 records for the 2-page spread
  const baseIdx = spreadIndex * itemsPerSpread;
  const patti1 = records[baseIdx + 0] || null; // Left Page Top
  const patti2 = records[baseIdx + 1] || null; // Left Page Bottom
  const patti3 = !isSinglePageMobile ? (records[baseIdx + 2] || null) : null; // Right Page Top
  const patti4 = !isSinglePageMobile ? (records[baseIdx + 3] || null) : null; // Right Page Bottom

  const displayedCount = [patti1, patti2, patti3, patti4].filter(Boolean).length;

  return (
    <div className="flex flex-col items-center w-full select-none">
      {/* 1. TOP TOOLBAR */}
      <div className="w-full max-w-6xl flex flex-col md:flex-row md:items-center justify-between pb-2.5 mb-2 border-b border-slate-200/80 dark:border-white/10 gap-2 text-xs">
        {/* Folio and Spread indicator + Layout Switcher */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px]">
            Digital Mandi Register
          </span>
          <span className="text-slate-300 dark:text-slate-700">|</span>

          {/* Interactive Layout Switcher (2*2 vs 1*4) */}
          <div className="flex items-center bg-slate-100 dark:bg-white/10 p-0.5 rounded-lg border border-slate-200/80 dark:border-white/10">
            <button
              type="button"
              onClick={() => handleSwitchLayout('2x2')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                layoutMode === '2x2'
                  ? "bg-amber-500 text-white shadow-xs font-black"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              )}
              title="2×2 Grid View (2-Page Book Spread)"
            >
              <Grid2X2 className="w-3.5 h-3.5" />
              <span>2×2 Grid</span>
            </button>
            <button
              type="button"
              onClick={() => handleSwitchLayout('1x4')}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer",
                layoutMode === '1x4'
                  ? "bg-amber-500 text-white shadow-xs font-black"
                  : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              )}
              title="1×4 Stack View (Vertical Mandi Register Folio)"
            >
              <Rows4 className="w-3.5 h-3.5" />
              <span>1×4 Stack</span>
            </button>
          </div>

          <span className="text-slate-300 dark:text-slate-700">|</span>
          <span className="font-mono font-bold text-slate-600 dark:text-slate-400 text-[11px]">
            {layoutMode === '1x4' ? 'Sheet' : 'Spread'} {spreadIndex + 1} of {totalSpreads} ({records.length > 0 ? `${baseIdx + 1}–${Math.min(records.length, baseIdx + itemsPerSpread)} of ${records.length} Pattis` : '0 Pattis'})
          </span>
        </div>

        {/* Zoom & Audio Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 self-end md:self-auto">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={cn(
              "p-1.5 rounded-lg border transition-all cursor-pointer",
              soundEnabled 
                ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300" 
                : "border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600"
            )}
            title={soundEnabled ? "Mute sound" : "Enable page-turn sound"}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          {/* Motion Toggle */}
          <button
            type="button"
            onClick={() => setReducedMotion(!reducedMotion)}
            className={cn(
              "px-2 py-1 rounded-lg border text-[10px] font-bold transition-all cursor-pointer hidden sm:flex items-center gap-1",
              reducedMotion
                ? "bg-slate-900 text-white dark:bg-amber-500 dark:text-black border-transparent"
                : "border-slate-200 dark:border-white/10 text-slate-500 hover:bg-slate-100"
            )}
          >
            <span>Motion: {reducedMotion ? 'Off' : 'On'}</span>
          </button>

          {/* Zoom Out */}
          <button
            type="button"
            onClick={() => setZoomLevel(prev => Math.max(75, prev - 10))}
            disabled={zoomLevel <= 75}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>

          <span className="text-[10px] font-mono font-bold text-slate-500 w-8 text-center">
            {zoomLevel}%
          </span>

          {/* Zoom In */}
          <button
            type="button"
            onClick={() => setZoomLevel(prev => Math.min(125, prev + 10))}
            disabled={zoomLevel >= 125}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          {/* Reset Zoom */}
          <button
            type="button"
            onClick={() => setZoomLevel(100)}
            className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
            title="Fit to view (100%)"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          {/* Thumbnails Toggle */}
          <button
            type="button"
            onClick={() => setShowThumbnails(!showThumbnails)}
            className={cn(
              "p-1.5 rounded-lg border transition-all cursor-pointer",
              showThumbnails
                ? "bg-amber-500/15 border-amber-500 text-amber-700 dark:text-amber-300"
                : "border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600"
            )}
            title="Toggle thumbnails carousel"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. THE REALISTIC DIGITAL REGISTER (SUPPORTING BOTH 2x2 BOOK SPREAD & 1x4 VERTICAL STACK) */}
      <div 
        className="relative w-full flex items-center justify-center py-2 sm:py-4 transition-transform duration-200 origin-top overflow-visible"
        style={{ transform: `scale(${zoomLevel / 100})` }}
      >
        {/* PREVIOUS SPREAD BUTTON (<) on outer left page margin */}
        {spreadIndex > 0 && (
          <button
            type="button"
            onClick={handlePrevSpread}
            className="absolute -left-2 sm:-left-3 lg:-left-5 top-1/2 -translate-y-1/2 z-40 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#1c130d] border-2 border-[#d4af37] text-[#d4af37] shadow-2xl flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95"
            title="Previous page spread"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </button>
        )}

        {/* NEXT SPREAD BUTTON (>) on outer right page margin */}
        {spreadIndex < totalSpreads - 1 && (
          <button
            type="button"
            onClick={handleNextSpread}
            className="absolute -right-2 sm:-right-3 lg:-right-5 top-1/2 -translate-y-1/2 z-40 w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#1c130d] border-2 border-[#d4af37] text-[#d4af37] shadow-2xl flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95"
            title="Next page spread"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2.5]" />
          </button>
        )}

        {/* OPTION A: 1×4 VERTICAL REGISTER FOLIO (SINGLE COLUMN 4-SLIP STACK) */}
        {layoutMode === '1x4' ? (
          <div 
            className="relative w-full max-w-4xl rounded-3xl p-3 sm:p-5 shadow-2xl bg-gradient-to-b from-[#241710] via-[#1a100a] to-[#120a06] border-4 border-[#3a251a]"
            style={{
              boxShadow: '0 25px 60px -15px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.1)'
            }}
          >
            <div 
              className="relative rounded-2xl overflow-hidden bg-[#faf8f4] border border-[#d8c8b4] p-3 sm:p-5 space-y-4 shadow-xl"
              style={{
                backgroundImage: 'radial-gradient(#e5d8c3 0.6px, transparent 0.6px)',
                backgroundSize: '20px 20px'
              }}
            >
              {/* Folio Header Banner */}
              <div className="flex items-center justify-between pb-2.5 border-b border-[#dfd3c1] text-xs">
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded shadow-2xs">
                    FOLIO #{spreadIndex + 1}
                  </span>
                  <span className="font-extrabold text-[#3a251a] tracking-wide text-xs uppercase">
                    1×4 Vertical Mandi Register
                  </span>
                </div>
                <span className="text-[10px] font-mono text-slate-500 font-bold bg-white/60 px-2 py-0.5 rounded border border-slate-200">
                  4 Slips Per Sheet
                </span>
              </div>

              {/* 4 Vertical Slips in Stack */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`folio-stack-${spreadIndex}`}
                  initial={reducedMotion ? { opacity: 1 } : { opacity: 0.85, y: direction > 0 ? 15 : -15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reducedMotion ? { opacity: 1 } : { opacity: 0.5, y: direction > 0 ? -15 : 15 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="space-y-4"
                >
                  {[patti1, patti2, patti3, patti4].map((patti, idx) => (
                    <div key={idx} className="w-full">
                      {patti ? (
                        <PattiFormDisplay
                          patti={patti}
                          isSelected={selectedIds.has(patti.id)}
                          onToggleSelect={onToggleSelect}
                          onInspect={onInspectPatti}
                        />
                      ) : (
                        <div className="h-28 border-2 border-dashed border-slate-300 rounded-xl flex items-center justify-center p-4 text-slate-400 text-center gap-3 bg-white/40">
                          <BookOpen className="w-6 h-6 opacity-30 text-amber-600" />
                          <div className="text-left">
                            <span className="font-bold text-xs text-slate-600 block">Empty Register Slot #{idx + 1}</span>
                            <span className="text-[10px] text-slate-400">Available for next settlement</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        ) : (
          /* OPTION B: 2×2 DUAL-PAGE BOOK SPREAD (2 ON LEFT, 2 ON RIGHT) */
          <div 
            className="relative w-full max-w-6xl rounded-3xl p-3 sm:p-5 shadow-2xl bg-gradient-to-b from-[#241710] via-[#1a100a] to-[#120a06] border-4 border-[#3a251a]"
            style={{
              boxShadow: '0 25px 60px -15px rgba(0,0,0,0.8), inset 0 2px 4px rgba(255,255,255,0.1)'
            }}
          >
            {/* STACKED PAPER DECK & INNER BOOK SPREAD */}
            <div 
              className="relative rounded-2xl overflow-hidden bg-[#faf8f4] border border-[#d8c8b4]"
              style={{
                boxShadow: isSinglePageMobile 
                  ? '0 10px 30px rgba(0,0,0,0.5)' 
                  : '-8px 0 0 #f0e6d8, -14px 0 0 #e4d7c5, 8px 0 0 #f0e6d8, 14px 0 0 #e4d7c5, 0 20px 45px -10px rgba(0,0,0,0.6)'
              }}
            >
              {/* TWO-PAGE SPREAD CONTAINER */}
              <div className={cn(
                "relative grid",
                isSinglePageMobile ? "grid-cols-1" : "grid-cols-2 divide-x divide-[#dfd3c1]"
              )}>
                {/* CENTER SPINE CREASE SHADOW (Vertical shadow down the middle fold) */}
                {!isSinglePageMobile && (
                  <div 
                    className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-14 pointer-events-none z-20"
                    style={{
                      background: 'linear-gradient(to right, rgba(0,0,0,0.22) 0%, rgba(0,0,0,0.04) 40%, transparent 50%, rgba(0,0,0,0.04) 60%, rgba(0,0,0,0.22) 100%)'
                    }}
                  />
                )}

                {/* LEFT PAGE: CONTAINS 2 PATTIS (TOP & BOTTOM) */}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`left-spread-${spreadIndex}`}
                    initial={reducedMotion ? { opacity: 1 } : { opacity: 0.85, rotateY: direction > 0 ? -8 : 8, transformOrigin: 'right center' }}
                    animate={{ opacity: 1, rotateY: 0 }}
                    exit={reducedMotion ? { opacity: 1 } : { opacity: 0.5, rotateY: direction > 0 ? 8 : -8 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="p-3 sm:p-5 lg:p-6 bg-[#faf8f4] flex flex-col justify-between gap-4 sm:gap-5 relative"
                    style={{
                      backgroundImage: 'radial-gradient(#e5d8c3 0.6px, transparent 0.6px)',
                      backgroundSize: '20px 20px'
                    }}
                  >
                    {/* Left Page Top Patti (Patti 1) */}
                    <div className="flex-1">
                      {patti1 ? (
                        <PattiFormDisplay
                          patti={patti1}
                          isSelected={selectedIds.has(patti1.id)}
                          onToggleSelect={onToggleSelect}
                          onInspect={onInspectPatti}
                        />
                      ) : (
                        <div className="h-full min-h-[260px] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-6 text-slate-400 text-center">
                          <BookOpen className="w-8 h-8 mb-2 opacity-30 text-amber-600" />
                          <span className="font-bold text-xs text-slate-600">Empty Register Slot</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Cleared payments appear here</span>
                        </div>
                      )}
                    </div>

                    {/* Left Page Bottom Patti (Patti 2) */}
                    <div className="flex-1">
                      {patti2 ? (
                        <PattiFormDisplay
                          patti={patti2}
                          isSelected={selectedIds.has(patti2.id)}
                          onToggleSelect={onToggleSelect}
                          onInspect={onInspectPatti}
                        />
                      ) : (
                        <div className="h-full min-h-[260px] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-6 text-slate-400 text-center">
                          <BookOpen className="w-8 h-8 mb-2 opacity-30 text-amber-600" />
                          <span className="font-bold text-xs text-slate-600">Empty Register Slot</span>
                          <span className="text-[10px] text-slate-400 mt-0.5">Available for next settlement</span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                </AnimatePresence>

                {/* RIGHT PAGE: CONTAINS 2 PATTIS (TOP & BOTTOM) - Visible on tablet/desktop */}
                {!isSinglePageMobile && (
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={`right-spread-${spreadIndex}`}
                      initial={reducedMotion ? { opacity: 1 } : { opacity: 0.85, rotateY: direction > 0 ? 8 : -8, transformOrigin: 'left center' }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      exit={reducedMotion ? { opacity: 1 } : { opacity: 0.5, rotateY: direction > 0 ? -8 : 8 }}
                      transition={{ duration: 0.25, ease: 'easeOut' }}
                      className="p-3 sm:p-5 lg:p-6 bg-[#faf8f4] flex flex-col justify-between gap-4 sm:gap-5 relative"
                      style={{
                        backgroundImage: 'radial-gradient(#e5d8c3 0.6px, transparent 0.6px)',
                        backgroundSize: '20px 20px'
                      }}
                    >
                      {/* Right Page Top Patti (Patti 3) */}
                      <div className="flex-1">
                        {patti3 ? (
                          <PattiFormDisplay
                            patti={patti3}
                            isSelected={selectedIds.has(patti3.id)}
                            onToggleSelect={onToggleSelect}
                            onInspect={onInspectPatti}
                          />
                        ) : (
                          <div className="h-full min-h-[260px] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-6 text-slate-400 text-center">
                            <BookOpen className="w-8 h-8 mb-2 opacity-30 text-amber-600" />
                            <span className="font-bold text-xs text-slate-600">Empty Register Slot</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">End of current batch</span>
                          </div>
                        )}
                      </div>

                      {/* Right Page Bottom Patti (Patti 4) */}
                      <div className="flex-1">
                        {patti4 ? (
                          <PattiFormDisplay
                            patti={patti4}
                            isSelected={selectedIds.has(patti4.id)}
                            onToggleSelect={onToggleSelect}
                            onInspect={onInspectPatti}
                          />
                        ) : (
                          <div className="h-full min-h-[260px] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center p-6 text-slate-400 text-center">
                            <BookOpen className="w-8 h-8 mb-2 opacity-30 text-amber-600" />
                            <span className="font-bold text-xs text-slate-600">Volume Concluded</span>
                            <span className="text-[10px] text-slate-400 mt-0.5">Ready for A4 4-Up export</span>
                            {selectedIds.size > 0 && (
                              <button
                                type="button"
                                onClick={onOpenExportModal}
                                className="mt-3 px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-bold shadow-md hover:bg-amber-600 cursor-pointer"
                              >
                                Export A4 PDF ({selectedIds.size})
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. SPREAD THUMBNAILS CAROUSEL */}
      {showThumbnails && records.length > 0 && (
        <div className="w-full max-w-6xl mt-3 p-3 rounded-2xl bg-white/70 dark:bg-[#0d1e15]/60 border border-slate-200/80 dark:border-white/10 shadow-2xs">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span>Register {layoutMode === '1x4' ? 'Sheets' : 'Spreads'} ({totalSpreads} {layoutMode === '1x4' ? 'Sheets' : 'Spreads'} • 4 Pattis per sheet)</span>
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Click any thumbnail to jump</span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {Array.from({ length: totalSpreads }).map((_, sIdx) => {
              const isCurrent = sIdx === spreadIndex;
              const r1 = records[sIdx * itemsPerSpread + 0];
              const r2 = records[sIdx * itemsPerSpread + 1];
              const r3 = !isSinglePageMobile || layoutMode === '1x4' ? records[sIdx * itemsPerSpread + 2] : null;
              const r4 = !isSinglePageMobile || layoutMode === '1x4' ? records[sIdx * itemsPerSpread + 3] : null;

              return (
                <button
                  key={sIdx}
                  type="button"
                  onClick={() => {
                    setDirection(sIdx > spreadIndex ? 1 : -1);
                    setSpreadIndex(sIdx);
                    playPageTurnSound();
                  }}
                  className={cn(
                    "shrink-0 p-1.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col items-center gap-1 min-w-[120px]",
                    isCurrent
                      ? "bg-amber-500/15 border-amber-500 shadow-xs ring-1 ring-amber-500"
                      : "bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/10 hover:bg-slate-100"
                  )}
                >
                  {/* Mini Preview Box: 1x4 vertical bars or 2x2 quadrants */}
                  {layoutMode === '1x4' ? (
                    <div className="w-20 h-14 rounded-md bg-[#faf8f4] border border-[#d8c8b4] p-1 flex flex-col justify-between gap-0.5 shadow-2xs">
                      {[r1, r2, r3, r4].map((r, i) => (
                        <div key={i} className="h-2 rounded bg-white border border-slate-200 overflow-hidden text-[6px] px-1 text-slate-600 truncate font-mono leading-none flex items-center">
                          {r?.millerName?.split(' ')[0] || '-'}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="w-20 h-14 rounded-md bg-[#faf8f4] border border-[#d8c8b4] p-1 grid grid-cols-2 gap-1 shadow-2xs">
                      <div className="rounded bg-white border border-slate-200 overflow-hidden text-[6.5px] p-0.5 text-slate-600 truncate font-mono">
                        {r1?.millerName?.split(' ')[0] || '-'}
                      </div>
                      <div className="rounded bg-white border border-slate-200 overflow-hidden text-[6.5px] p-0.5 text-slate-600 truncate font-mono">
                        {r3?.millerName?.split(' ')[0] || '-'}
                      </div>
                      <div className="rounded bg-white border border-slate-200 overflow-hidden text-[6.5px] p-0.5 text-slate-600 truncate font-mono">
                        {r2?.millerName?.split(' ')[0] || '-'}
                      </div>
                      <div className="rounded bg-white border border-slate-200 overflow-hidden text-[6.5px] p-0.5 text-slate-600 truncate font-mono">
                        {r4?.millerName?.split(' ')[0] || '-'}
                      </div>
                    </div>
                  )}

                  <span className={cn(
                    "text-[10px] font-bold",
                    isCurrent ? "text-amber-700 dark:text-amber-400 font-extrabold" : "text-slate-500"
                  )}>
                    {layoutMode === '1x4' ? 'Sheet' : 'Spread'} #{sIdx + 1}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
