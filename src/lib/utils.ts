import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(amount: number | string | undefined | null) {
  if (amount === undefined || amount === null || amount === '') return '';
  
  let sign = '';
  let input = String(amount).trim();
  
  if (input.startsWith('+')) {
    sign = '+ ';
    input = input.substring(1).trim();
  } else if (input.startsWith('-')) {
    sign = '- ';
    input = input.substring(1).trim();
  }

  const numericAmount = parseFloat(input.replace(/[₹, ]/g, ""));
  
  if (isNaN(numericAmount)) return String(amount);

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: input.includes('.') ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(numericAmount);

  return sign + formatted;
}
