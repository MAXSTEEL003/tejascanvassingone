/**
 * Reliable PO Email Dispatch Client
 * 
 * Coordinates multi-path email transmission for Purchase Orders:
 * Path 1: Backend API (/api/dispatch-po) using verified SMTP (nani@tejasc.in / smtp.gmail.com:465)
 * Path 2: Direct Client-Side Gmail API REST transmission if backend is unavailable (e.g. static hosting)
 *         and an active Google session token exists.
 * Fallback: If both fail, cleanly marks status as 'Queued' (never falsely marks 'Sent')
 *           and provides direct Gmail Web Compose URL.
 */

export interface DispatchPoPayload {
  to: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
  orderId: string;
  poNumber?: string;
  batchId?: string;
  supplierName: string;
  orderDetails?: any;
}

export interface DispatchPoResult {
  success: boolean;
  isLiveSent: boolean;
  status: 'Sent' | 'Queued' | 'Failed';
  messageId?: string;
  method?: 'backend_smtp' | 'backend_gmail' | 'client_gmail_api';
  error?: string;
  gmailComposeUrl?: string;
}

/**
 * Encodes string to Base64URL for Gmail API format
 */
function base64UrlEncode(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch {
    return btoa(unescape(encodeURIComponent(str)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

/**
 * Builds standard MIME RFC 2822 email payload
 */
function buildMimeMessage(options: {
  to: string;
  cc?: string;
  from?: string;
  subject: string;
  html: string;
  text?: string;
}): string {
  const boundary = `tc_boundary_${Date.now()}`;
  const encodedSubject = `=?UTF-8?B?${btoa(unescape(encodeURIComponent(options.subject)))}?=`;
  const cleanTo = options.to.trim();
  const cleanCc = (options.cc || '').trim();
  const effectiveSender = options.from || 'nani@tejasc.in';

  const headers = [
    `From: "Tejas Canvassing" <${effectiveSender}>`,
    `To: ${cleanTo}`,
    cleanCc ? `Cc: ${cleanCc}` : null,
    `Subject: ${encodedSubject}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean).join('\r\n');

  const textPart = [
    `--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    options.text || "Official Purchase Order from Tejas Canvassing",
    ``,
  ].join('\r\n');

  const htmlPart = [
    `--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: 8bit`,
    ``,
    options.html,
    ``,
    `--${boundary}--`,
    ``
  ].join('\r\n');

  return [headers, '', textPart, htmlPart].join('\r\n');
}

/**
 * Dispatches a PO Email using backend SMTP first, with graceful client-side Gmail API fallback
 */
export async function dispatchPurchaseOrderEmail(payload: DispatchPoPayload): Promise<DispatchPoResult> {
  const recipientEmail = (payload.to || '').trim();
  const poRef = payload.poNumber || payload.batchId || payload.orderId;
  const adminSender = payload.from || (typeof window !== 'undefined' ? localStorage.getItem('companyEmail') : null) || 'nani@tejasc.in';
  const ccEmails = ['tejasadinarayan@gmail.com', 'nani@tejasc.in'].filter(e => e.toLowerCase() !== recipientEmail.toLowerCase()).join(', ');

  const composeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&cc=${encodeURIComponent(ccEmails)}&su=${encodeURIComponent(payload.subject)}&body=${encodeURIComponent(payload.text || `Official Purchase Order ${poRef}\nSupplier: ${payload.supplierName}\n\nPlease review attached order particulars.`)}`;

  if (!recipientEmail || !recipientEmail.includes('@')) {
    return {
      success: false,
      isLiveSent: false,
      status: 'Queued',
      error: 'Recipient email is invalid or missing.',
      gmailComposeUrl: composeUrl,
    };
  }

  const clientToken = typeof window !== 'undefined' 
    ? (localStorage.getItem('google_access_token') || sessionStorage.getItem('google_access_token'))
    : null;

  // Path 1: Dispatch via Backend API endpoint (/api/dispatch-po)
  try {
    const res = await fetch('/api/dispatch-po', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        to: recipientEmail,
        from: adminSender,
        subject: payload.subject,
        html: payload.html,
        htmlContent: payload.html,
        text: payload.text,
        textContent: payload.text,
        batchId: poRef,
        poNumber: poRef,
        orderId: payload.orderId,
        supplierName: payload.supplierName,
        orderDetails: payload.orderDetails,
        accessToken: clientToken || undefined
      })
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (data.success && (data.isLiveSent || data.status === 'Sent' || data.messageId)) {
        return {
          success: true,
          isLiveSent: true,
          status: 'Sent',
          messageId: data.messageId || data.gmailMessageId,
          method: 'backend_smtp',
          gmailComposeUrl: composeUrl
        };
      }
    }
    // If backend returned HTML (SPA rewrite fallback) or failed with error status, proceed to client fallback
  } catch (apiErr: any) {
    console.warn('[PO Email Dispatch] Backend API unreachable, checking client fallback:', apiErr?.message || apiErr);
  }

  // Path 2: Direct Client-Side Gmail API REST transmission
  if (clientToken) {
    try {
      const mime = buildMimeMessage({
        to: recipientEmail,
        cc: ccEmails,
        from: adminSender,
        subject: payload.subject,
        html: payload.html,
        text: payload.text
      });

      const raw = base64UrlEncode(mime);
      const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${clientToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw })
      });

      if (gmailRes.ok) {
        const gmailData = await gmailRes.json();
        return {
          success: true,
          isLiveSent: true,
          status: 'Sent',
          messageId: gmailData.id,
          method: 'client_gmail_api',
          gmailComposeUrl: composeUrl
        };
      } else {
        const errJson = await gmailRes.json().catch(() => ({}));
        if (gmailRes.status === 401 || errJson.error?.code === 401) {
          // Token expired, clear from storage
          try {
            localStorage.removeItem('google_access_token');
            sessionStorage.removeItem('google_access_token');
          } catch {}
        }
        console.warn('[PO Email Dispatch] Client Gmail API error:', errJson?.error?.message || gmailRes.statusText);
      }
    } catch (clientErr: any) {
      console.warn('[PO Email Dispatch] Client Gmail API transmission failed:', clientErr?.message || clientErr);
    }
  }

  // Both paths exhausted without live delivery confirmation
  return {
    success: false,
    isLiveSent: false,
    status: 'Queued',
    error: 'Live automatic dispatch was not confirmed. Please click "Send PO Email" or "Open in Gmail" to dispatch.',
    gmailComposeUrl: composeUrl
  };
}
