import React from 'react';
import { X, Eye, EyeOff, Columns3, Check, RotateCcw } from 'lucide-react';

interface ColumnVisibilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  columns: Array<{ id: string; label: string; group?: string }>;
  hiddenColIds: Set<string>;
  onToggleColumn: (colId: string) => void;
  onShowAll: () => void;
  onResetDefaults: () => void;
}

export default function ColumnVisibilityModal({
  isOpen,
  onClose,
  columns,
  hiddenColIds,
  onToggleColumn,
  onShowAll,
  onResetDefaults
}: ColumnVisibilityModalProps) {
  if (!isOpen) return null;

  // Group columns by category
  const groups: Record<string, typeof columns> = {};
  columns.forEach(col => {
    const grp = col.group || 'Other';
    if (!groups[grp]) groups[grp] = [];
    groups[grp].push(col);
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-surface border border-outline-variant rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-outline-variant flex items-center justify-between bg-surface-container-low">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Columns3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-on-surface">Column Visibility</h3>
              <p className="text-[11px] text-secondary">Show or hide specific columns on your workspace grid</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto space-y-4 scrollbar-thin scrollbar-thumb-outline-variant">
          <div className="flex items-center justify-between pb-2 border-b border-outline-variant/30 text-xs">
            <span className="text-secondary font-medium">
              {columns.length - hiddenColIds.size} of {columns.length} columns visible
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onShowAll}
                className="text-[11px] font-bold text-primary hover:underline"
              >
                Show All
              </button>
              <span className="text-secondary/40">|</span>
              <button
                type="button"
                onClick={onResetDefaults}
                className="text-[11px] font-bold text-secondary hover:text-on-surface flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" /> Reset
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {Object.entries(groups).map(([groupName, groupCols]) => (
              <div key={groupName} className="space-y-1.5">
                <span className="text-[10px] font-black uppercase text-secondary tracking-widest pl-1">
                  {groupName}
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {groupCols.map(col => {
                    const isVisible = !hiddenColIds.has(col.id);
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => onToggleColumn(col.id)}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl text-left border text-xs transition-all ${
                          isVisible
                            ? 'bg-surface-container border-outline-variant text-on-surface font-bold'
                            : 'bg-surface-container-lowest border-transparent text-secondary/50 hover:bg-surface-container-low'
                        }`}
                      >
                        <span className="truncate pr-2">{col.label}</span>
                        {isVisible ? (
                          <Eye className="w-3.5 h-3.5 text-primary shrink-0" />
                        ) : (
                          <EyeOff className="w-3.5 h-3.5 text-secondary/40 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-outline-variant bg-surface-container-low flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-primary text-on-primary rounded-xl text-xs font-bold uppercase tracking-wider hover:bg-primary-hover shadow-md shadow-primary/20"
          >
            Apply
          </button>
        </div>

      </div>
    </div>
  );
}
