import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: (string | Option)[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  allowCustom?: boolean;
}

export default function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = 'Select option...',
  className,
  disabled,
  allowCustom = false
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Normalize options array to standard Option[]
  const normalizedOptions: Option[] = React.useMemo(() => {
    return options.map(opt => {
      if (typeof opt === 'string') {
        return { value: opt, label: opt };
      }
      return opt;
    });
  }, [options]);

  // Find the label for the currently selected value
  const selectedLabel = React.useMemo(() => {
    const found = normalizedOptions.find(opt => opt.value === value);
    return found ? found.label : value;
  }, [normalizedOptions, value]);

  // Keep search in sync with standard input value when focused
  useEffect(() => {
    if (isOpen) {
      setSearch('');
    } else {
      setSearch(selectedLabel || '');
    }
  }, [isOpen, selectedLabel]);

  const filteredOptions = React.useMemo(() => {
    const query = (search || '').toLowerCase().trim();
    if (!query) return normalizedOptions;
    return normalizedOptions.filter(opt =>
      String(opt?.label || '').toLowerCase().includes(query) ||
      String(opt?.value || '').toLowerCase().includes(query)
    );
  }, [normalizedOptions, search]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [search]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (option: Option) => {
    onChange(option.value);
    setSearch(option.label);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        setHighlightedIndex(prev => 
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        e.preventDefault();
        break;
      case 'ArrowUp':
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
        e.preventDefault();
        break;
      case 'Enter':
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        } else if (search.trim()) {
          // Fallback / custom typing option: allow accepting custom filter if appropriate
          const exactMatch = normalizedOptions.find(opt => String(opt?.label || '').toLowerCase() === (search || '').toLowerCase());
          if (exactMatch) {
            handleSelect(exactMatch);
          } else {
            onChange(search);
            setIsOpen(false);
          }
        }
        e.preventDefault();
        break;
      case 'Escape':
        setIsOpen(false);
        e.preventDefault();
        break;
      case 'Tab':
        setIsOpen(false);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      <div 
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }
        }}
        className={cn(
          "relative flex items-center w-full bg-surface-container-low border border-outline-variant/30 rounded-2xl cursor-pointer transition-all focus-within:ring-2 focus-within:ring-primary/20",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none"
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : selectedLabel}
          onChange={(e) => {
            if (!isOpen) setIsOpen(true);
            setSearch(e.target.value);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full bg-transparent px-5 py-3 pr-12 text-sm font-bold outline-none border-none text-on-surface placeholder:text-secondary/40 rounded-2xl"
        />
        
        <div className="absolute right-4 flex items-center gap-1">
          {(!disabled && value) && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
                setSearch('');
              }}
              className="p-1 text-secondary/40 hover:text-secondary transition-all"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={cn("w-4 h-4 text-secondary/70 transition-transform duration-200 pointer-events-none", isOpen && "rotate-180")} />
        </div>
      </div>

      <AnimatePresence>
        {isOpen && !disabled && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 z-50 mt-2 max-h-60 overflow-y-auto rounded-2xl bg-surface border border-outline-variant/50 shadow-2xl p-2 scrollbar-thin"
          >
            {filteredOptions.length === 0 ? (
              allowCustom && search.trim() ? (
                <div 
                  className="px-4 py-3 text-xs text-secondary/70 italic font-semibold text-center cursor-pointer hover:bg-primary/5 hover:text-primary rounded-xl"
                  onClick={() => {
                    onChange(search.trim());
                    setIsOpen(false);
                  }}
                >
                  Choose custom option: "{search.trim()}"
                </div>
              ) : (
                <div className="px-4 py-3 text-xs text-secondary/50 font-bold text-center">
                  No matching options registered
                </div>
              )
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <div
                    key={option.value}
                    onClick={() => handleSelect(option)}
                    className={cn(
                      "flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold cursor-pointer transition-all",
                      isSelected ? "bg-primary text-on-primary" : "text-on-surface hover:bg-on-background/5",
                      isHighlighted && !isSelected && "bg-primary/5 text-primary"
                    )}
                  >
                    <span>{option.label}</span>
                    {isSelected && <Check className="w-4 h-4" />}
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
