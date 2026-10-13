/**
 * Design Tokens for Tejas Canvassing Merchant UI based on the visual design reference:
 * - Brand Crimson Red: #C22424 / #B91C1C
 * - Soft Red / Tint: #FEF2F2
 * - Pure White: #FFFFFF
 * - Clean Off-White Background: #F9FAFB / #F8F9FA
 * - Charcoal Headings & Body: #111827
 * - Muted Grey Subtitles: #6B7280
 * - Clean Card Borders: #E5E7EB
 * - In Stock Green: #16A34A
 * - Confirmed Badge: #DCFCE7 / #15803D
 * - Dispatched Blue: #EFF6FF / #1D4ED8
 */

export const THEME_COLORS = {
  brandRed: '#C22424',
  brandRedHover: '#A81C1C',
  brandRedLight: '#FEF2F2',
  white: '#FFFFFF',
  offWhite: '#F9FAFB',
  charcoal: '#111827',
  mutedGrey: '#6B7280',
  border: '#E5E7EB',
  inStockGreen: '#16A34A',
  confirmedGreen: '#15803D',
  dispatchedBlue: '#1D4ED8',
} as const;

export const MERCHANT_CONTAINER = "w-full max-w-md mx-auto px-4 py-3 font-sans text-[#111827]";
