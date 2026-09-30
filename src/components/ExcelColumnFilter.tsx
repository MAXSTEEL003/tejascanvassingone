import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Filter, 
  Search, 
  X, 
  Check, 
  CheckSquare, 
  Square, 
  ArrowUpAZ, 
  ArrowDownZA, 
  ArrowUp10, 
  ArrowDown01,
  RotateCcw,
  Calendar,
  Hash,
  Type,
  ChevronDown
} from 'lucide-react';
import { ColumnConfig } from '../views/ArrivalEntry';
import { cn } from '../lib/utils';

export interface FilterCondition {
  operator?: string;
  value?: string;
  value2?: string;
  selectedValues?: string[];
}

interface ExcelColumnFilterProps {
  column: ColumnConfig;
  activeFilter?: FilterCondition;
  dataset: any[];
  isOpen: boolean;
  onClose: () => void;
  onApply: (filter: FilterCondition | null) => void;
  onSort?: (direction: 'asc' | 'desc') => void;
  currentSort?: 'asc' | 'desc' | null;
  parseAnyDate: (val: any) => Date | null;
  formatDateToDDMMYYYY: (val: any) => string;
  getDaysPendingNum: (row: any) => number;
}

export default function ExcelColumnFilter({
  column,
  activeFilter,
  dataset,
  isOpen,
  onClose,
  onApply,
  onSort,
  currentSort,
  parseAnyDate,
  formatDateToDDMMYYYY,
  getDaysPendingNum
}: ExcelColumnFilterProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Column data category
  const category: 'text' | 'number' | 'date' = useMemo(() => {
    if (column.type === 'date') return 'date';
    if (column.type === 'number' || column.type === 'calc') return 'number';
    return 'text';
  }, [column.type]);

  // Extract unique values from active dataset
  const uniqueValues = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number; sortVal: any }>();

    dataset.forEach(row => {
      if (!row) return;
      let rawVal: any;
      if (column.id === 'noOfDays') {
        rawVal = getDaysPendingNum(row);
      } else {
        rawVal = row[column.id];
      }

      const isBlank = rawVal === undefined || rawVal === null || String(rawVal).trim() === '';
      const key = isBlank ? '__BLANK__' : String(rawVal).trim();

      let label = key;
      if (isBlank) {
        label = '(Blanks)';
      } else if (column.type === 'date') {
        label = formatDateToDDMMYYYY(rawVal);
      } else if (column.id === 'noOfDays') {
        label = `${rawVal} Days`;
      }

      const existing = map.get(key);
      if (existing) {
        existing.count++;
      } else {
        map.set(key, {
          key,
          label,
          count: 1,
          sortVal: isBlank ? (category === 'number' ? -Infinity : '~~~~~') : rawVal
        });
      }
    });

    const list = Array.from(map.values());
    list.sort((a, b) => {
      if (a.key === '__BLANK__') return 1;
      if (b.key === '__BLANK__') return -1;

      if (category === 'number') {
        const numA = parseFloat(String(a.key).replace(/,/g, ''));
        const numB = parseFloat(String(b.key).replace(/,/g, ''));
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
      }

      if (category === 'date') {
        const dateA = parseAnyDate(a.key)?.getTime() || 0;
        const dateB = parseAnyDate(b.key)?.getTime() || 0;
        if (dateA && dateB) return dateA - dateB;
      }

      return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
    });

    return list;
  }, [dataset, column.id, column.type, category, parseAnyDate, formatDateToDDMMYYYY, getDaysPendingNum]);

  // Draft Filter state
  const [operator, setOperator] = useState<string>('none');
  const [val1, setVal1] = useState<string>('');
  const [val2, setVal2] = useState<string>('');
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [searchInValues, setSearchInValues] = useState<string>('');
  const [isRuleSectionOpen, setIsRuleSectionOpen] = useState(false);

  // Initialize draft state whenever popup opens or activeFilter changes
  useEffect(() => {
    if (isOpen) {
      if (activeFilter) {
        setOperator(activeFilter.operator || 'none');
        setVal1(activeFilter.value || '');
        setVal2(activeFilter.value2 || '');
        if (activeFilter.operator && activeFilter.operator !== 'none') {
          setIsRuleSectionOpen(true);
        }
        if (activeFilter.selectedValues && Array.isArray(activeFilter.selectedValues)) {
          setSelectedKeys(new Set(activeFilter.selectedValues));
        } else {
          setSelectedKeys(new Set(uniqueValues.map(v => v.key)));
        }
      } else {
        setOperator('none');
        setVal1('');
        setVal2('');
        setSelectedKeys(new Set(uniqueValues.map(v => v.key)));
        setIsRuleSectionOpen(false);
      }
      setSearchInValues('');
    }
  }, [isOpen, activeFilter, uniqueValues]);

  // Close on Escape or click outside
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered unique values based on search
  const visibleUniqueValues = useMemo(() => {
    if (!searchInValues.trim()) return uniqueValues;
    const q = searchInValues.trim().toLowerCase();
    return uniqueValues.filter(v => v.label.toLowerCase().includes(q));
  }, [uniqueValues, searchInValues]);

  // Select All visible
  const handleSelectAll = () => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      visibleUniqueValues.forEach(v => next.add(v.key));
      return next;
    });
  };

  // Clear All visible
  const handleClearAll = () => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      visibleUniqueValues.forEach(v => next.delete(v.key));
      return next;
    });
  };

  // Toggle individual key
  const handleToggleKey = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Commit Apply
  const handleApply = () => {
    const isRuleActive = operator !== 'none' && (
      operator === 'blank' || 
      operator === 'notBlank' || 
      val1.trim() !== ''
    );

    const allSelected = uniqueValues.length > 0 && uniqueValues.every(v => selectedKeys.has(v.key));

    if (!isRuleActive && allSelected) {
      onApply(null);
    } else {
      onApply({
        operator: isRuleActive ? operator : undefined,
        value: isRuleActive ? val1.trim() : undefined,
        value2: isRuleActive && operator === 'between' ? val2.trim() : undefined,
        selectedValues: allSelected ? undefined : Array.from(selectedKeys)
      });
    }
    onClose();
  };

  // Clear Filter for this column
  const handleClearFilter = () => {
    onApply(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      onClick={(e) => e.stopPropagation()}
      className="absolute top-11 right-0 bg-surface border border-outline-variant rounded-2xl shadow-2xl z-50 w-72 sm:w-80 text-left normal-case tracking-normal text-on-surface p-3 font-sans border-t-2 border-t-primary animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-outline-variant/30">
        <div className="flex items-center gap-1.5 overflow-hidden">
          {category === 'date' ? (
            <Calendar className="w-3.5 h-3.5 text-primary shrink-0" />
          ) : category === 'number' ? (
            <Hash className="w-3.5 h-3.5 text-primary shrink-0" />
          ) : (
            <Type className="w-3.5 h-3.5 text-primary shrink-0" />
          )}
          <span className="text-xs font-black uppercase text-on-surface truncate">
            {column.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-secondary hover:text-on-surface hover:bg-surface-container transition-colors cursor-pointer"
          title="Close filter menu"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Sorting Shortcuts */}
      {onSort && (
        <div className="grid grid-cols-2 gap-1.5 mb-2 pb-2 border-b border-outline-variant/30">
          <button
            onClick={() => onSort('asc')}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer",
              currentSort === 'asc' 
                ? "bg-primary text-on-primary shadow-xs" 
                : "bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface"
            )}
          >
            {category === 'date' ? (
              <>
                <Calendar className="w-3 h-3" />
                <span>Oldest to Newest</span>
              </>
            ) : category === 'number' ? (
              <>
                <ArrowUp10 className="w-3 h-3" />
                <span>Smallest to Largest</span>
              </>
            ) : (
              <>
                <ArrowUpAZ className="w-3 h-3" />
                <span>Sort A to Z</span>
              </>
            )}
          </button>
          <button
            onClick={() => onSort('desc')}
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer",
              currentSort === 'desc' 
                ? "bg-primary text-on-primary shadow-xs" 
                : "bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface"
            )}
          >
            {category === 'date' ? (
              <>
                <Calendar className="w-3 h-3" />
                <span>Newest to Oldest</span>
              </>
            ) : category === 'number' ? (
              <>
                <ArrowDown01 className="w-3 h-3" />
                <span>Largest to Smallest</span>
              </>
            ) : (
              <>
                <ArrowDownZA className="w-3 h-3" />
                <span>Sort Z to A</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Filter by Condition Accordion */}
      <div className="mb-2">
        <button
          type="button"
          onClick={() => setIsRuleSectionOpen(!isRuleSectionOpen)}
          className="w-full flex items-center justify-between py-1 text-[11px] font-black uppercase text-secondary hover:text-on-surface cursor-pointer"
        >
          <span className="flex items-center gap-1">
            <Filter className="w-3 h-3 text-primary" />
            Filter by Condition {operator !== 'none' && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </span>
          <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isRuleSectionOpen && "rotate-180")} />
        </button>

        {isRuleSectionOpen && (
          <div className="mt-1.5 p-2 bg-surface-container-low rounded-xl border border-outline-variant/40 space-y-2">
            <div>
              <label className="text-[10px] font-bold text-secondary uppercase block mb-1">Operator</label>
              <select
                value={operator}
                onChange={(e) => setOperator(e.target.value)}
                className="w-full px-2 py-1.5 bg-surface border border-outline-variant rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
              >
                <option value="none">-- None (No Rule) --</option>
                
                {category === 'text' && (
                  <>
                    <option value="equals">Equals</option>
                    <option value="notEquals">Does Not Equal</option>
                    <option value="contains">Contains</option>
                    <option value="notContains">Does Not Contain</option>
                    <option value="startsWith">Begins With</option>
                    <option value="endsWith">Ends With</option>
                    <option value="blank">Blank</option>
                    <option value="notBlank">Non-blank</option>
                  </>
                )}

                {category === 'number' && (
                  <>
                    <option value="equals">Equals</option>
                    <option value="notEquals">Does Not Equal</option>
                    <option value="gt">Greater Than (&gt;)</option>
                    <option value="lt">Less Than (&lt;)</option>
                    <option value="gte">Greater Than or Equal (&ge;)</option>
                    <option value="lte">Less Than or Equal (&le;)</option>
                    <option value="between">Between</option>
                    <option value="blank">Blank</option>
                    <option value="notBlank">Non-blank</option>
                  </>
                )}

                {category === 'date' && (
                  <>
                    <option value="equals">Equals</option>
                    <option value="before">Before</option>
                    <option value="after">After</option>
                    <option value="onOrBefore">On or Before</option>
                    <option value="onOrAfter">On or After</option>
                    <option value="between">Between</option>
                    <option value="blank">Blank</option>
                    <option value="notBlank">Non-blank</option>
                  </>
                )}
              </select>
            </div>

            {operator !== 'none' && operator !== 'blank' && operator !== 'notBlank' && (
              <div className="space-y-1.5">
                <input
                  type={category === 'date' ? 'date' : category === 'number' ? 'number' : 'text'}
                  placeholder={operator === 'between' ? (category === 'date' ? 'Start Date' : 'Min Value') : 'Value...'}
                  value={val1}
                  onChange={(e) => setVal1(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-surface border border-outline-variant rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                />

                {operator === 'between' && (
                  <input
                    type={category === 'date' ? 'date' : category === 'number' ? 'number' : 'text'}
                    placeholder={category === 'date' ? 'End Date' : 'Max Value'}
                    value={val2}
                    onChange={(e) => setVal2(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-surface border border-outline-variant rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter by Values (Unique Checkbox List) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-black text-secondary uppercase">
            Filter by values ({selectedKeys.size}/{uniqueValues.length})
          </label>
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <button
              type="button"
              onClick={handleSelectAll}
              className="text-primary hover:underline cursor-pointer"
            >
              Select All
            </button>
            <span className="text-secondary/40">•</span>
            <button
              type="button"
              onClick={handleClearAll}
              className="text-secondary hover:text-rose-500 cursor-pointer"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Search Within Filter Values */}
        <div className="relative flex items-center">
          <Search className="w-3 h-3 text-secondary absolute left-2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search values..."
            value={searchInValues}
            onChange={(e) => setSearchInValues(e.target.value)}
            className="w-full pl-7 pr-6 py-1 bg-surface-container border border-outline-variant rounded-lg text-xs font-medium placeholder:text-secondary/50 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchInValues && (
            <button
              onClick={() => setSearchInValues('')}
              className="absolute right-1.5 text-secondary hover:text-on-surface p-0.5"
            >
              <X className="w-2.5 h-2.5" />
            </button>
          )}
        </div>

        {/* Checkbox List */}
        <div className="max-h-40 overflow-y-auto border border-outline-variant/30 rounded-xl bg-surface-container-low/50 divide-y divide-outline-variant/20 p-1">
          {visibleUniqueValues.length === 0 ? (
            <div className="py-4 text-center text-xs text-secondary italic">
              No matching values
            </div>
          ) : (
            visibleUniqueValues.map((item) => {
              const isChecked = selectedKeys.has(item.key);
              return (
                <label
                  key={item.key}
                  className="flex items-center justify-between px-2 py-1 hover:bg-surface-container rounded-lg cursor-pointer text-xs select-none transition-colors"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => handleToggleKey(item.key)}
                      className="sr-only"
                    />
                    {isChecked ? (
                      <CheckSquare className="w-3.5 h-3.5 text-primary shrink-0" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-secondary/40 shrink-0" />
                    )}
                    <span className={cn(
                      "truncate font-medium text-xs",
                      item.key === '__BLANK__' ? "italic text-secondary" : "text-on-surface"
                    )}>
                      {item.label}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-secondary/60 shrink-0">
                    {item.count}
                  </span>
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="mt-3 pt-2 border-t border-outline-variant/30 flex items-center justify-between">
        <button
          type="button"
          onClick={handleClearFilter}
          className="px-2.5 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-500/10 rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
        >
          Clear Filter
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-3.5 py-1 bg-primary hover:bg-primary-hover text-on-primary text-xs font-bold rounded-lg uppercase tracking-wider shadow-xs transition-colors cursor-pointer flex items-center gap-1"
          >
            <Check className="w-3 h-3" />
            <span>Apply</span>
          </button>
        </div>
      </div>
    </div>
  );
}
