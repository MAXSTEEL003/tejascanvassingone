/**
 * Tejas Canvassing WhatsApp Dispatch Service
 * Handles real-time auto-dispatching of order notifications via Meta WhatsApp Cloud API
 */

import { getValidAuthToken, getAuthUser } from './auth';

export interface WhatsAppOrderNotificationParams {
  to?: string;
  phone?: string;
  buyerName?: string;
  brand?: string;
  qty?: string | number;
  rate?: string | number;
  orderId?: string;
  poNumber?: string;
  customMessage?: string;
  authToken?: string;
}

export interface WhatsAppDispatchResult {
  success: boolean;
  status: number;
  deliveryStatus?: 'Accepted' | 'Delivered' | 'Failed' | 'Pending';
  errorCode?: string | number;
  message?: string;
  messageId?: string;
  gateway?: string;
  directUrl?: string;
  error?: string;
  metaResponse?: any;
}

/**
 * Format phone number strictly to 12-digit Indian format (e.g. 919876543210).
 * Returns empty string if missing or invalid; NEVER uses fabricated fallbacks.
 */
export function formatIndianWhatsAppPhone(rawPhone?: string): string {
  if (!rawPhone) return '';
  const digits = String(rawPhone).replace(/[^0-9]/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length > 10) {
    const last10 = digits.slice(-10);
    return `91${last10}`;
  }
  return '';
}

/**
 * Validates if the phone number is a valid 12-digit Indian phone (e.g. 91 + 10 digits starting with 6-9)
 */
export function isValidIndianPhone(rawPhone?: string): boolean {
  const formatted = formatIndianWhatsAppPhone(rawPhone);
  return /^91[6-9]\d{9}$/.test(formatted);
}

/**
 * Clean product name removing bracketed package sizing (e.g. "Keshar Kali (26kg Bag)" -> "Keshar Kali").
 * Returns clean name or empty string; NEVER uses fabricated fallbacks.
 */
export function sanitizeBrandName(product?: string): string {
  if (!product) return '';
  return product
    .replace(/\(\d+.*?\)/g, '')
    .replace(/[\[\]]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim();
}

/**
 * Automatically dispatch Meta WhatsApp order placement notification
 */
export async function dispatchOrderPlacedWhatsApp(
  params: WhatsAppOrderNotificationParams
): Promise<WhatsAppDispatchResult> {
  const targetPhone = formatIndianWhatsAppPhone(params.to || params.phone);
  if (!targetPhone || targetPhone.length !== 12) {
    return {
      success: false,
      status: 400,
      deliveryStatus: 'Failed',
      errorCode: 'INVALID_PHONE_NUMBER',
      error: `Invalid or missing buyer phone number: "${params.to || params.phone || ''}". Must be a valid 10-digit Indian mobile.`,
      message: 'Invalid phone number'
    };
  }

  const cleanBuyer = String(params.buyerName || '').replace(/[\r\n\t]+/g, ' ').trim();
  if (!cleanBuyer) {
    return {
      success: false,
      status: 400,
      errorCode: 'MISSING_BUYER_NAME',
      error: 'Buyer name is required for order notification.',
      message: 'Missing buyer name'
    };
  }

  const cleanBrand = sanitizeBrandName(params.brand);
  if (!cleanBrand) {
    return {
      success: false,
      status: 400,
      errorCode: 'MISSING_BRAND',
      error: 'Product brand is required for order notification.',
      message: 'Missing product brand'
    };
  }

  const numQty = parseFloat(String(params.qty || '').replace(/[^0-9.]/g, ''));
  if (isNaN(numQty) || numQty <= 0) {
    return {
      success: false,
      status: 400,
      errorCode: 'INVALID_QUANTITY',
      error: `Order quantity must be a positive number (got "${params.qty}").`,
      message: 'Invalid quantity'
    };
  }

  const numRate = parseFloat(String(params.rate || '').replace(/[^0-9.]/g, ''));
  if (isNaN(numRate) || numRate <= 0) {
    return {
      success: false,
      status: 400,
      errorCode: 'INVALID_RATE',
      error: `Order rate must be a positive number (got "${params.rate}").`,
      message: 'Invalid rate'
    };
  }

  const orderRef = String(params.orderId || params.poNumber || '').trim();
  if (!orderRef) {
    return {
      success: false,
      status: 400,
      errorCode: 'MISSING_ORDER_REF',
      error: 'Order reference / PO number is required.',
      message: 'Missing order reference'
    };
  }

  const cleanQtyStr = String(numQty);
  const cleanRateStr = String(numRate);

  const defaultMessage = `Hello ${cleanBuyer},\n\nOrder placed successfully.\n\nBrand: ${cleanBrand}\nQuantity: ${cleanQtyStr} QTL\nRate: ₹${cleanRateStr}/QTL\n\nThank you,\nTejas Canvassing`;
  const messageBody = params.customMessage || defaultMessage;

  console.log(`[WhatsApp Auto-Dispatch] Sending order notification to ${targetPhone} for ${cleanBuyer} (Order ${orderRef})...`);

  try {
    const authToken = params.authToken || await getValidAuthToken();
    if (!authToken) {
      console.warn('[WhatsApp Auto-Dispatch] Missing valid Admin authentication session token.');
      return {
        success: false,
        status: 401,
        deliveryStatus: 'Failed',
        errorCode: 'AUTH_REQUIRED',
        error: 'Admin authentication required. Please sign in with an authorized Admin account to dispatch customer WhatsApp notifications.',
        message: 'Admin authentication required. Please sign in with an authorized Admin account to dispatch customer WhatsApp notifications.'
      };
    }

    const currentUser = getAuthUser();
    const adminUserEmail = currentUser?.email || (typeof window !== 'undefined' ? (localStorage.getItem('userEmail') || 'nani@tejasc.in') : 'nani@tejasc.in');

    const headers: Record<string, string> = { 
      'Content-Type': 'application/json',
      'x-requested-path': '/api/dispatch-whatsapp',
      'x-admin-email': adminUserEmail,
      'Authorization': `Bearer ${authToken}`
    };

    const res = await fetch('/api/dispatch-whatsapp?_path=/api/dispatch-whatsapp', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to: targetPhone,
        buyerName: cleanBuyer,
        brand: cleanBrand,
        qty: cleanQtyStr,
        rate: cleanRateStr,
        orderId: orderRef,
        poNumber: orderRef,
        message: messageBody,
        templateParams: [cleanBuyer, cleanBrand, cleanQtyStr, cleanRateStr]
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      console.log(`[WhatsApp Auto-Dispatch] Notification accepted by Meta API for ${targetPhone}! Message ID: ${data.messageId || 'sent'}`);
      return {
        success: true,
        status: res.status,
        deliveryStatus: 'Accepted',
        messageId: data.messageId,
        gateway: data.gateway || 'meta_whatsapp',
        directUrl: data.directUrl,
        message: data.message || 'WhatsApp notification accepted by Meta Cloud API',
        metaResponse: data.metaResponse
      };
    } else {
      let errorMsg = data.error || data.message || `WhatsApp dispatch failed with HTTP ${res.status}`;
      if (res.status === 401 || errorMsg.toLowerCase().includes('unauthorized') || errorMsg.toLowerCase().includes('admin privileges')) {
        errorMsg = 'Admin authentication required. Please sign in with an authorized Admin account to dispatch customer WhatsApp notifications.';
      }
      const errorCode = data.errorCode || data.metaResponse?.error?.code || (res.status === 401 ? 'UNAUTHORIZED' : (res.status >= 500 ? 'SERVER_ERROR' : 'DISPATCH_FAILED'));
      console.warn(`[WhatsApp Auto-Dispatch] Backend/Meta returned error (HTTP ${res.status}, code ${errorCode}):`, errorMsg);
      return {
        success: false,
        status: res.status,
        deliveryStatus: 'Failed',
        errorCode,
        error: errorMsg,
        message: errorMsg,
        directUrl: data.directUrl,
        metaResponse: data.metaResponse
      };
    }
  } catch (err: any) {
    console.error(`[WhatsApp Auto-Dispatch] Network dispatch error:`, err?.message || err);
    const directUrl = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(messageBody)}`;
    return {
      success: false,
      status: 0,
      deliveryStatus: 'Failed',
      errorCode: 'NETWORK_ERROR',
      error: err?.message || 'Network error communicating with WhatsApp dispatch endpoint',
      message: err?.message || 'Network error',
      directUrl
    };
  }
}
