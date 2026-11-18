import React from 'react';

export default function PageFallback() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-8 text-center select-none bg-[#0a0806] text-[#f6f1e6] transition-opacity duration-300">
      <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 shadow-[0_0_24px_rgba(217,164,65,0.2)]">
        <img
          src="/logo.png"
          alt="Tejas Canvassing"
          className="w-10 h-10 object-contain drop-shadow"
        />
        {/* Smooth gentle rotating ring instead of glitchy animate-ping */}
        <div className="absolute -inset-1 rounded-2xl border border-amber-500/30 animate-[spin_8s_linear_infinite] pointer-events-none" />
      </div>

      <div className="mt-5 flex items-center gap-2 text-xs font-mono font-medium uppercase tracking-[0.24em] text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <span>Loading...</span>
      </div>
    </div>
  );
}
