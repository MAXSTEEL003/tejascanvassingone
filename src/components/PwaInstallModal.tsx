import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, Share, PlusSquare, CheckCircle2, X, Smartphone, Sparkles, Monitor } from 'lucide-react';

interface PwaInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PwaInstallModal({ isOpen, onClose }: PwaInstallModalProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalledSuccess, setIsInstalledSuccess] = useState(false);

  useEffect(() => {
    // Check if running in standalone PWA mode
    const isStandaloneMode = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(isStandaloneMode);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(iosDevice);

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalledSuccess(true);
        setDeferredPrompt(null);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.95 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-surface border border-outline-variant rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden text-on-surface font-sans"
        >
          {/* Header Banner */}
          <div className="relative bg-gradient-to-br from-[#143e2e] via-[#0d2a1f] to-[#07110c] p-6 text-white overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Smartphone className="w-36 h-36" />
            </div>
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 rounded-2xl">
                <Sparkles className="w-6 h-6 text-emerald-400" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-full border border-emerald-500/30">
                PWA Application
              </span>
            </div>

            <h3 className="text-xl font-bold tracking-tight">Add to Home Screen</h3>
            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
              Install Tejas Wholesale Rice Procurement for instant offline access & full-screen mobile experience.
            </p>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5 bg-surface max-h-[75vh] overflow-y-auto">
            {isStandalone || isInstalledSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">App Already Installed!</h4>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                    Tejas Wholesale Rice Procurement is active on your Home Screen.
                  </p>
                </div>
              </div>
            ) : isIOS ? (
              /* iOS Safari Guided Steps */
              <div className="space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <Smartphone className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span>iOS Safari Instructions (iPhone / iPad):</span>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-container-low border border-outline-variant/60">
                    <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                      1
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-on-surface flex items-center gap-1.5">
                        Tap the Share button
                        <Share className="w-4 h-4 text-blue-500 inline" />
                      </p>
                      <p className="text-secondary mt-0.5">
                        Located at the bottom center of your Safari toolbar (box with upward arrow).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-container-low border border-outline-variant/60">
                    <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                      2
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-on-surface flex items-center gap-1.5">
                        Select 'Add to Home Screen'
                        <PlusSquare className="w-4 h-4 text-emerald-500 inline" />
                      </p>
                      <p className="text-secondary mt-0.5">
                        Scroll down the menu options and tap <strong className="text-on-surface">'Add to Home Screen'</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-2xl bg-surface-container-low border border-outline-variant/60">
                    <div className="w-7 h-7 rounded-xl bg-primary/10 text-primary font-bold flex items-center justify-center text-xs shrink-0 mt-0.5">
                      3
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-on-surface">Tap 'Add' in Top Right</p>
                      <p className="text-secondary mt-0.5">
                        Confirm by clicking <strong className="text-on-surface">'Add'</strong> to launch the web app right from your home screen.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : deferredPrompt ? (
              /* Chrome/Android Direct Prompt Button */
              <div className="space-y-4 text-center">
                <p className="text-xs text-secondary">
                  Click below to trigger instant browser installation directly on your device.
                </p>
                <button
                  onClick={handleInstallClick}
                  className="w-full py-3.5 px-4 bg-primary text-on-primary font-bold text-sm rounded-2xl hover:opacity-95 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Install App Now
                </button>
              </div>
            ) : (
              /* Generic Android/Desktop fallback */
              <div className="space-y-3">
                <div className="p-3 bg-surface-container-low border border-outline-variant/60 rounded-2xl flex items-start gap-3 text-xs">
                  <Monitor className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-on-surface">Desktop or Android Chrome</p>
                    <p className="text-secondary mt-0.5">
                      Tap the browser menu <strong className="text-on-surface">⋮</strong> in top right, then select <strong className="text-on-surface">'Add to Home screen'</strong> or <strong className="text-on-surface">'Install App'</strong>.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <button
              onClick={onClose}
              className="w-full py-2.5 bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
