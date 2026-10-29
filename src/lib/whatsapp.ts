/**
 * Tejas Canvassing WhatsApp Dispatch Service
 * Handles real-time auto-dispatching of order notifications via Meta WhatsApp Cloud API
 */

export interface WhatsAppOrderNotificationParams {
  to?: string;
  buyerName?: string;
  brand?: string;
  qty?: string | number;
  rate?: string | number;
  orderId?: string;
  poNumber?: string;
  customMessage?: string;
}

export interface WhatsAppDispatchResult {
  success: boolean;
  messageId?: string;
  gateway?: string;
  directUrl?: string;
  error?: string;
}

/**
 * Format phone number strictly to 12-digit Indian format (e.g. 919945351166)
 */
export function formatIndianWhatsAppPhone(rawPhone?: string): string {
  if (!rawPhone) return '919945351166';
  const digits = String(rawPhone).replace(/[^0-9]/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length > 10) return `91${digits.slice(-10)}`;
  return '919945351166';
}

/**
 * Clean product name removing bracketed package sizing (e.g. "Keshar Kali (26kg Bag)" -> "Keshar Kali")
 */
export function sanitizeBrandName(product?: string): string {
  if (!product) return 'keshar kali';
  return product
    .replace(/\(\d+.*?\)/g, '')
    .replace(/[\[\]]/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .trim() || 'keshar kali';
}

/**
 * Automatically dispatch Meta WhatsApp order placement notification
 */
export async function dispatchOrderPlacedWhatsApp(
  params: WhatsAppOrderNotificationParams
): Promise<WhatsAppDispatchResult> {
  const targetPhone = formatIndianWhatsAppPhone(params.to);
  const cleanBuyer = String(params.buyerName || 'Valued Merchant').replace(/[\r\n\t]+/g, ' ').trim() || 'Valued Merchant';
  const cleanBrand = sanitizeBrandName(params.brand);
  const cleanQty = String(params.qty || '40').replace(/[^0-9.]/g, '').trim() || '40';
  const cleanRate = String(params.rate || '10000').replace(/[^0-9.]/g, '').trim() || '10000';
  const orderRef = params.orderId || params.poNumber || 'TC-ORDER';

  const defaultMessage = `Hello ${cleanBuyer},\n\nOrder placed successfully.\n\nBrand: ${cleanBrand}\nQuantity: ${cleanQty} QTL\nRate: ₹${cleanRate}/QTL\n\nThank you,\nTejas Canvassing`;
  const messageBody = params.customMessage || defaultMessage;

  console.log(`[WhatsApp Auto-Dispatch] Sending order notification to ${targetPhone} for ${cleanBuyer} (Order ${orderRef})...`);

  try {
    const res = await fetch('/api/dispatch-whatsapp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        to: targetPhone,
        buyerName: cleanBuyer,
        brand: cleanBrand,
        qty: cleanQty,
        rate: cleanRate,
        orderId: orderRef,
        poNumber: orderRef,
        message: messageBody,
        templateName: 'order_notify',
        templateId: '1016669984165776',
        templateParams: [cleanBuyer, cleanBrand, cleanQty, cleanRate],
        languageCode: 'en'
      })
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && (data.success || data.messageId)) {
      console.log(`[WhatsApp Auto-Dispatch] Delivered successfully to ${targetPhone}! Message ID: ${data.messageId || 'sent'}`);
      return {
        success: true,
        messageId: data.messageId,
        gateway: data.gateway || 'meta_whatsapp',
        directUrl: data.directUrl
      };
    } else {
      console.warn(`[WhatsApp Auto-Dispatch] Backend returned notice:`, data);
      return {
        success: false,
        error: data.error || data.message || 'Notification queued',
        directUrl: data.directUrl
      };
    }
  } catch (err: any) {
    console.error(`[WhatsApp Auto-Dispatch] Network dispatch error:`, err?.message || err);
    const directUrl = `https://api.whatsapp.com/send?phone=${targetPhone}&text=${encodeURIComponent(messageBody)}`;
    return {
      success: false,
      error: err?.message || 'Network error',
      directUrl
    };
  }
}
