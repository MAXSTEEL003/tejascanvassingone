import React from 'react';

export default function PageFallback() {
  return (
    <div className="min-h-[50vh] w-full flex flex-col items-center justify-center p-8 text-center select-none">
      <div className="relative flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-sm">
        <img
          src="/logo.png"
          alt="Tejas Canvassing"
          className="w-9 h-9 object-contain"
        />
        <div className="absolute inset-0 rounded-2xl border-2 border-amber-500/30 animate-ping pointer-events-none" />
      </div>
      <div className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        Loading...
      </div>
    </div>
  );
}

