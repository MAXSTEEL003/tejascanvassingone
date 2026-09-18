import { sanitizeSupplierName } from '../lib/utils';

export interface BuyerProfileData {
  address: string;
  gstin: string;
  phone: string;
  email: string;
}

export const DEFAULT_BUYER_PROFILES: Record<string, BuyerProfileData> = {};

export const resolveBuyerProfile = (buyerName: string): BuyerProfileData => {
  const norm = (buyerName || '').trim().toUpperCase()
    .replace(/\s*\(LLC\)/gi, '')
    .replace(/\.$/, '');

  try {
    const saved = localStorage.getItem('stakeholders_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      const buyers = parsed.buyers || [];
      const matched = buyers.find((b: any) => {
        const bName = (b.name || '').trim().toUpperCase();
        return bName === norm || bName.includes(norm) || norm.includes(bName);
      });
      if (matched && (matched.address || matched.gstin || matched.email)) {
        return {
          address: matched.address || '88th Main, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
          gstin: matched.gstin || '29AAUBJ618M1Z8',
          phone: matched.phone || '9840618506',
          email: matched.email || `${norm.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
        };
      }
    }
  } catch (e) {}

  if (DEFAULT_BUYER_PROFILES[norm]) {
    return DEFAULT_BUYER_PROFILES[norm];
  }

  for (const k of Object.keys(DEFAULT_BUYER_PROFILES)) {
    if (norm.includes(k) || k.includes(norm)) {
      return DEFAULT_BUYER_PROFILES[k];
    }
  }

  return {
    address: '88th Main, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
    gstin: '29AAUBJ618M1Z8',
    phone: '9840618506',
    email: `${norm.toLowerCase().replace(/[^a-z0-9]/g, '') || 'buyer'}@gmail.com`,
  };
};

export const resolveSupplierProfile = (supplierName: string): { email: string; phone: string } => {
  const norm = (supplierName || '').trim().toUpperCase()
    .replace(/\s*\(LLC\)/gi, '')
    .replace(/\.$/, '');

  try {
    const saved = localStorage.getItem('stakeholders_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      const suppliers = parsed.suppliers || [];
      const matched = suppliers.find((s: any) => {
        const sNorm = (s.name || '').trim().toUpperCase()
          .replace(/\s*\(LLC\)/gi, '')
          .replace(/\.$/, '');
        return sNorm === norm || sNorm.includes(norm) || norm.includes(sNorm);
      });
      if (matched) {
        return {
          email: matched.email || (matched.name ? `${matched.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com` : 'supplier@gmail.com'),
          phone: matched.phone || '9440188941'
        };
      }
    }
  } catch (e) {
    console.warn("Error resolving dynamic supplier profile from localStorage:", e);
  }

  const lookup: Record<string, { email: string; phone: string }> = {
    'SRI SAI TEJA RICE TECH': { email: 'saitejaricetech@gmail.com', phone: '9440188941' },
    'SRI SAI TEJA': { email: 'saitejaricetech@gmail.com', phone: '9440188941' },
    'RUDRA AGRO MILLS': { email: 'rudraagro@gmail.com', phone: '9840192831' },
    'BHARAT GRAIN EXPORTS': { email: 'bharatgrains@gmail.com', phone: '9740112938' },
    'DECCAN MILLERS': { email: 'deccanmillers@gmail.com', phone: '9940177263' }
  };

  if (lookup[norm]) return lookup[norm];
  for (const k of Object.keys(lookup)) {
    if (norm.includes(k) || k.includes(norm)) return lookup[k];
  }
  return {
    email: `${norm.toLowerCase().replace(/[^a-z0-9]/g, '') || 'supplier'}@gmail.com`,
    phone: '9440188941'
  };
};

export const formatPoDate = (dateVal: any): string => {
  if (!dateVal) {
    const d = new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${monthNames[d.getMonth()]}-${d.getFullYear()}`;
  }

  const clean = String(dateVal).trim();
  if (/^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(clean)) {
    return clean;
  }

  let parsed: Date;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [dd, mm, yyyy] = clean.split('/');
    parsed = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  } else {
    parsed = new Date(clean);
  }

  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${monthNames[parsed.getMonth()]}-${parsed.getFullYear()}`;
  }

  return clean;
};

/**
 * Generates the EXACT HTML layout requested by the user:
 * - TC Blue Square Logo + "Tejas Canvassing" & "Bangalore" header
 * - Divider line
 * - "DEAR [SUPPLIER NAME],"
 * - "Today's orders:"
 * - Tabular grid: [DATE | BUYER | PRODUCT | QTY (QUINTALS) | RATE (PER QTL.) | DETAILS]
 * - Footer protocol text
 */
export const generateSupplierPOEmailHtml = (
  supplierName: string,
  order: any,
  subOrders: any[]
): string => {
  const normSupplier = sanitizeSupplierName(supplierName, 'DIRECT MILL').toUpperCase();

  const itemsList = (subOrders && subOrders.length > 0)
    ? subOrders
    : [{
        id: order?.id || 'PO-1',
        buyer: order?.buyer || 'Authorized Merchant',
        product: order?.product || order?.items?.replace(/\(\d+.*$/, '').trim() || 'KESHAR KALI',
        qty: parseFloat(order?.qty || order?.items?.match(/\d+/)?.[0] || '80'),
        rate: parseFloat(order?.rate || '8400') || 8400,
        date: order?.date || new Date(),
        loadingDays: order?.loadingDays !== undefined ? order.loadingDays : 0,
        unloadingPoint: order?.unloadingPoint || 'shop',
      }];

  const tableRowsHtml = itemsList.map((sub: any) => {
    const buyerName = sub.buyer || order?.buyer || 'Authorized Merchant';
    const profile = resolveBuyerProfile(buyerName);
    const dateFormatted = formatPoDate(sub.date || order?.date);
    const product = (sub.product || order?.product || 'KESHAR KALI').toUpperCase();
    const qty = sub.qty !== undefined ? sub.qty : 80;
    const rate = sub.rate !== undefined ? sub.rate : 8400;
    const loadingDays = sub.loadingDays !== undefined ? sub.loadingDays : 0;
    const unloadingPoint = sub.unloadingPoint || 'shop';

    return `
      <tr style="background-color: #ffffff;">
        <td style="padding: 12px 14px; border: 1px solid #e5e7eb; vertical-align: top; color: #374151; font-weight: 500; font-size: 12px; white-space: nowrap;">
          ${dateFormatted}
        </td>
        <td style="padding: 12px 14px; border: 1px solid #e5e7eb; vertical-align: top; text-align: left;">
          <div style="font-weight: 700; font-size: 13px; color: #111827; text-transform: uppercase; margin-bottom: 4px;">${buyerName}</div>
          <div style="font-size: 11px; color: #64748b; line-height: 1.4; margin-bottom: 8px;">${profile.address}</div>
          <div style="border-top: 1px solid #f1f5f9; padding-top: 6px; font-size: 11px; color: #374151; line-height: 1.5;">
            <div><strong>GSTIN:</strong> ${profile.gstin}</div>
            <div><strong>Phone:</strong> ${profile.phone}</div>
            <div><strong>Email:</strong> <a href="mailto:${profile.email}" style="color: #0070f3; text-decoration: none;">${profile.email}</a></div>
          </div>
        </td>
        <td style="padding: 12px 14px; border: 1px solid #e5e7eb; vertical-align: top; font-weight: 700; color: #111827; text-transform: uppercase; font-size: 12px;">
          ${product}
        </td>
        <td style="padding: 12px 14px; border: 1px solid #e5e7eb; vertical-align: top; text-align: right; font-weight: 700; color: #111827; font-size: 12px;">
          ${qty}
        </td>
        <td style="padding: 12px 14px; border: 1px solid #e5e7eb; vertical-align: top; text-align: right; font-weight: 700; color: #111827; font-size: 12px;">
          ${rate}
        </td>
        <td style="padding: 12px 14px; border: 1px solid #e5e7eb; vertical-align: top; text-align: left; font-size: 11px; color: #374151; line-height: 1.5;">
          <div>No of days for loading: <strong style="color: #0070f3;">${loadingDays}</strong></div>
          <div style="margin-top: 4px;">Unloading Point: <strong>${unloadingPoint}</strong></div>
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Purchase Order - Tejas Canvassing</title>
</head>
<body style="margin: 0; padding: 20px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <div style="max-width: 850px; margin: 0 auto; background: #ffffff; padding: 28px 32px; color: #1e293b; border-radius: 8px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    
    <!-- Top Header: Logo + Brand -->
    <div style="display: table; width: 100%; border-bottom: 1px solid #e5e7eb; padding-bottom: 18px; margin-bottom: 24px;">
      <div style="display: table-cell; vertical-align: middle; width: 50px;">
        <div style="background-color: #0084ff; color: #ffffff; font-weight: 800; font-size: 20px; width: 44px; height: 44px; line-height: 44px; text-align: center; border-radius: 6px; font-family: sans-serif;">TC</div>
      </div>
      <div style="display: table-cell; vertical-align: middle; padding-left: 14px;">
        <div style="font-size: 19px; font-weight: 700; color: #0f172a; line-height: 1.2;">Tejas Canvassing</div>
        <div style="font-size: 12px; color: #64748b; margin-top: 2px;">Bangalore</div>
      </div>
    </div>

    <!-- Salutation & Greeting -->
    <div style="margin-bottom: 22px;">
      <div style="font-size: 13.5px; font-weight: 700; color: #0f172a; letter-spacing: 0.2px; text-transform: uppercase; margin-bottom: 6px;">DEAR ${normSupplier},</div>
      <div style="font-size: 13px; font-weight: 600; color: #64748b;">Today's orders:</div>
    </div>

    <!-- Exact Tabular Order Specification -->
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; font-size: 11.5px; margin-bottom: 22px;">
      <thead>
        <tr style="background-color: #f3f4f6; color: #374151;">
          <th style="padding: 12px 14px; border: 1px solid #e5e7eb; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; width: 14%;">DATE</th>
          <th style="padding: 12px 14px; border: 1px solid #e5e7eb; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; width: 38%;">BUYER</th>
          <th style="padding: 12px 14px; border: 1px solid #e5e7eb; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; width: 16%;">PRODUCT</th>
          <th style="padding: 12px 14px; border: 1px solid #e5e7eb; text-align: right; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; width: 11%;">QTY<br/>(QUINTALS)</th>
          <th style="padding: 12px 14px; border: 1px solid #e5e7eb; text-align: right; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; width: 11%;">RATE (PER<br/>QTL.)</th>
          <th style="padding: 12px 14px; border: 1px solid #e5e7eb; text-align: left; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; width: 16%;">DETAILS</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
    </table>

    <!-- Footer Notice -->
    <div style="border-top: 1px solid #f1f5f9; padding-top: 14px; font-size: 11px; color: #64748b; font-style: italic;">
      This transaction confirmation was dynamically encoded and transmitted securely under Tejas Canvassing authorization protocols.
    </div>

  </div>
</body>
</html>
  `.trim();
};

/**
 * Generates an A4 Print-Optimized HTML document for physical paper filing and documentation
 */
export const generateSupplierPOA4PrintHtml = (
  supplierName: string,
  order: any,
  subOrders: any[]
): string => {
  const normSupplier = sanitizeSupplierName(supplierName, 'DIRECT MILL').toUpperCase();

  const itemsList = (subOrders && subOrders.length > 0)
    ? subOrders
    : [{
        id: order?.id || 'PO-1',
        buyer: order?.buyer || 'Authorized Merchant',
        product: order?.product || order?.items?.replace(/\(\d+.*$/, '').trim() || 'KESHAR KALI',
        qty: parseFloat(order?.qty || order?.items?.match(/\d+/)?.[0] || '80'),
        rate: parseFloat(order?.rate || '8400') || 8400,
        date: order?.date || new Date(),
        loadingDays: order?.loadingDays !== undefined ? order.loadingDays : 0,
        unloadingPoint: order?.unloadingPoint || 'shop',
      }];

  const totalQty = itemsList.reduce((sum: number, item: any) => sum + (parseFloat(item.qty) || 0), 0);

  const tableRowsHtml = itemsList.map((sub: any) => {
    const buyerName = sub.buyer || order?.buyer || 'Authorized Merchant';
    const profile = resolveBuyerProfile(buyerName);
    const dateFormatted = formatPoDate(sub.date || order?.date);
    const product = (sub.product || order?.product || 'KESHAR KALI').toUpperCase();
    const qty = sub.qty !== undefined ? sub.qty : 80;
    const rate = sub.rate !== undefined ? sub.rate : 8400;
    const loadingDays = sub.loadingDays !== undefined ? sub.loadingDays : 0;
    const unloadingPoint = sub.unloadingPoint || 'shop';

    return `
      <tr style="page-break-inside: avoid; break-inside: avoid;">
        <td style="padding: 10px 12px; border: 1px solid #1f2937; vertical-align: top; font-size: 11px; font-weight: 600; white-space: nowrap;">
          ${dateFormatted}
        </td>
        <td style="padding: 10px 12px; border: 1px solid #1f2937; vertical-align: top; text-align: left;">
          <div style="font-weight: 800; font-size: 12.5px; color: #000000; text-transform: uppercase; margin-bottom: 3px;">${buyerName}</div>
          <div style="font-size: 10px; color: #374151; line-height: 1.35; margin-bottom: 6px;">${profile.address}</div>
          <div style="border-top: 1px dashed #9ca3af; padding-top: 5px; font-size: 9.5px; color: #111827; line-height: 1.45;">
            <div><strong>GSTIN:</strong> ${profile.gstin}</div>
            <div><strong>Phone:</strong> ${profile.phone} &nbsp;|&nbsp; <strong>Email:</strong> ${profile.email}</div>
          </div>
        </td>
        <td style="padding: 10px 12px; border: 1px solid #1f2937; vertical-align: top; font-weight: 800; color: #000000; text-transform: uppercase; font-size: 11.5px;">
          ${product}
        </td>
        <td style="padding: 10px 12px; border: 1px solid #1f2937; vertical-align: top; text-align: right; font-weight: 800; color: #000000; font-size: 12px;">
          ${qty}
        </td>
        <td style="padding: 10px 12px; border: 1px solid #1f2937; vertical-align: top; text-align: right; font-weight: 800; color: #000000; font-size: 12px;">
          ${rate}
        </td>
        <td style="padding: 10px 12px; border: 1px solid #1f2937; vertical-align: top; text-align: left; font-size: 10px; color: #111827; line-height: 1.45;">
          <div>Loading Days: <strong>${loadingDays}</strong></div>
          <div style="margin-top: 2px;">Unloading: <strong>${unloadingPoint}</strong></div>
        </td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>PO_${order?.id || 'DOCUMENT'}_TEJAS_CANVASSING</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 15mm 15mm 15mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 11px;
      line-height: 1.4;
    }
    .a4-container {
      width: 100%;
      max-width: 210mm;
      margin: 0 auto;
      background: #ffffff;
      padding: 4mm 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #1f2937;
    }
    th, td {
      border: 1px solid #1f2937;
    }
    @media screen {
      body {
        background: #e2e8f0;
        padding: 24px;
      }
      .a4-container {
        background: #ffffff;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0,0,0,0.15);
      }
      .screen-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        margin-bottom: 20px;
        max-width: 210mm;
        margin-left: auto;
        margin-right: auto;
      }
      .btn {
        padding: 8px 16px;
        border-radius: 6px;
        font-weight: 700;
        font-size: 12px;
        cursor: pointer;
        border: none;
      }
      .btn-primary {
        background: #0084ff;
        color: #ffffff;
      }
      .btn-secondary {
        background: #64748b;
        color: #ffffff;
      }
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .screen-actions {
        display: none !important;
      }
      .a4-container {
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
    }
  </style>
</head>
<body>

  <div class="screen-actions">
    <button class="btn btn-secondary" onclick="window.close()">Close</button>
    <button class="btn btn-primary" onclick="window.print()">Print A4 Sheet (Ctrl+P)</button>
  </div>

  <div class="a4-container">
    
    <!-- Top Header & Business Details -->
    <div style="display: table; width: 100%; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;">
      <div style="display: table-cell; vertical-align: middle; width: 50px;">
        <div style="background-color: #0084ff; color: #ffffff; font-weight: 900; font-size: 22px; width: 46px; height: 46px; line-height: 46px; text-align: center; border-radius: 6px; font-family: sans-serif;">TC</div>
      </div>
      <div style="display: table-cell; vertical-align: middle; padding-left: 14px;">
        <div style="font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px; line-height: 1.1;">Tejas Canvassing</div>
        <div style="font-size: 11px; color: #475569; margin-top: 2px; font-weight: 500;">
          Bangalore Grain Brokerage &amp; Supply Chain Logistics &bull; APMC Yard, Yeshwanthpur, Bangalore
        </div>
      </div>
      <div style="display: table-cell; vertical-align: middle; text-align: right; width: 220px;">
        <div style="font-size: 13px; font-weight: 800; color: #0f172a;">PURCHASE ORDER</div>
        <div style="font-size: 10.5px; color: #334155; margin-top: 2px;">PO Ref: <strong style="font-family: monospace;">${order?.id || 'PO-BATCH'}</strong></div>
        <div style="font-size: 10px; color: #64748b; margin-top: 1px;">Date: <strong>${formatPoDate(order?.date || new Date())}</strong></div>
      </div>
    </div>

    <!-- Salutation & Summary Banner -->
    <div style="display: table; width: 100%; margin-bottom: 14px; background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 4px; padding: 10px 14px;">
      <div style="display: table-cell; vertical-align: middle;">
        <div style="font-size: 12.5px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
          SUPPLIER: ${normSupplier}
        </div>
        <div style="font-size: 10.5px; color: #475569; margin-top: 2px;">
          Subject: <strong>Today's orders</strong> &nbsp;&bull;&nbsp; Type: <strong>Consolidated Procurement Order</strong>
        </div>
      </div>
      <div style="display: table-cell; vertical-align: middle; text-align: right; font-size: 11px; font-weight: 700; color: #0f172a;">
        Total Qty: <span style="font-size: 13px; color: #0084ff;">${totalQty} QTLS</span>
      </div>
    </div>

    <!-- Orders Tabular Table -->
    <table style="margin-bottom: 16px;">
      <thead>
        <tr style="background-color: #e5e7eb; color: #111827;">
          <th style="padding: 9px 10px; text-align: left; font-weight: 800; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; width: 13%;">DATE</th>
          <th style="padding: 9px 10px; text-align: left; font-weight: 800; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; width: 40%;">BUYER</th>
          <th style="padding: 9px 10px; text-align: left; font-weight: 800; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; width: 16%;">PRODUCT</th>
          <th style="padding: 9px 10px; text-align: right; font-weight: 800; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; width: 11%;">QTY (QUINTALS)</th>
          <th style="padding: 9px 10px; text-align: right; font-weight: 800; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; width: 10%;">RATE (PER QTL.)</th>
          <th style="padding: 9px 10px; text-align: left; font-weight: 800; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.3px; width: 10%;">DETAILS</th>
        </tr>
      </thead>
      <tbody>
        ${tableRowsHtml}
      </tbody>
      <tfoot>
        <tr style="background-color: #f3f4f6; font-weight: 800; font-size: 11.5px;">
          <td colspan="3" style="padding: 8px 12px; border: 1px solid #1f2937; text-align: right; text-transform: uppercase;">
            Total Consolidated Quantity:
          </td>
          <td style="padding: 8px 12px; border: 1px solid #1f2937; text-align: right;">
            ${totalQty} QTLS
          </td>
          <td colspan="2" style="padding: 8px 12px; border: 1px solid #1f2937; text-align: right; font-size: 10.5px; color: #475569;">
            Filing Copy &bull; Official Trade Record
          </td>
        </tr>
      </tfoot>
    </table>

    <!-- Filing Signatures & Physical Office Stamp Box -->
    <div style="margin-top: 24px; border: 1px solid #94a3b8; border-radius: 4px; padding: 14px 18px; background-color: #ffffff; page-break-inside: avoid; break-inside: avoid;">
      <div style="font-size: 10.5px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 6px; margin-bottom: 14px;">
        Physical Documentation &amp; Office Filing Authorization
      </div>
      
      <div style="display: table; width: 100%;">
        <div style="display: table-cell; width: 33%; vertical-align: top; padding-right: 15px;">
          <div style="font-size: 9.5px; color: #64748b; font-weight: 600; text-transform: uppercase;">Prepared / Dispatched By:</div>
          <div style="margin-top: 36px; border-top: 1px solid #1e293b; font-size: 10px; font-weight: 700; color: #0f172a; padding-top: 4px;">
            Tejas Canvassing Operations
          </div>
        </div>

        <div style="display: table-cell; width: 33%; vertical-align: top; padding-right: 15px; padding-left: 15px;">
          <div style="font-size: 9.5px; color: #64748b; font-weight: 600; text-transform: uppercase;">Brokerage / Audit Approval:</div>
          <div style="margin-top: 36px; border-top: 1px solid #1e293b; font-size: 10px; font-weight: 700; color: #0f172a; padding-top: 4px;">
            Authorized Signatory &amp; Stamp
          </div>
        </div>

        <div style="display: table-cell; width: 34%; vertical-align: top; padding-left: 15px;">
          <div style="font-size: 9.5px; color: #64748b; font-weight: 600; text-transform: uppercase;">Physical Ledger Filing:</div>
          <div style="margin-top: 36px; border-top: 1px solid #1e293b; font-size: 10px; font-weight: 700; color: #0f172a; padding-top: 4px;">
            File No: ____________ / Date: ________
          </div>
        </div>
      </div>
    </div>

    <!-- Official Footer Note -->
    <div style="margin-top: 16px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #64748b; text-align: center; font-style: italic;">
      This official purchase order is generated under Tejas Canvassing authorization protocol. Printed document serves as an authentic trade ledger copy.
    </div>

  </div>

</body>
</html>
  `.trim();
};

/**
 * Triggers direct browser printing of the A4 formatted PO document with robust fallback
 */
export const printPoDocument = (
  supplierName: string,
  order: any,
  subOrders: any[]
): void => {
  const printableHtml = generateSupplierPOA4PrintHtml(supplierName, order, subOrders);
  
  // 1. Try opening a clean printable window or popup
  try {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.open();
      printWindow.document.write(printableHtml);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (e) {
          console.warn("Print window print call:", e);
        }
      }, 500);
      return;
    }
  } catch (e) {
    console.warn("Popup blocked or iframe restriction:", e);
  }

  // 2. Fallback: Blob URL + Iframe
  try {
    const blob = new Blob([printableHtml], { type: 'text/html;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    
    const printFrame = document.createElement('iframe');
    printFrame.style.position = 'fixed';
    printFrame.style.left = '-9999px';
    printFrame.style.top = '-9999px';
    printFrame.style.width = '1024px';
    printFrame.style.height = '1448px';
    printFrame.style.border = '0';
    printFrame.src = blobUrl;
    document.body.appendChild(printFrame);

    printFrame.onload = () => {
      setTimeout(() => {
        try {
          printFrame.contentWindow?.focus();
          printFrame.contentWindow?.print();
        } catch (err) {
          console.error("Frame print failed, opening blob:", err);
          window.open(blobUrl, '_blank');
        } finally {
          setTimeout(() => {
            if (document.body.contains(printFrame)) {
              document.body.removeChild(printFrame);
            }
            URL.revokeObjectURL(blobUrl);
          }, 5000);
        }
      }, 600);
    };
  } catch (err) {
    console.error("Print PO Document error:", err);
  }
};

/**
 * Generates an elegant order confirmation email HTML for Buyers
 */
export const generateBuyerConfirmationEmailHtml = (
  buyerName: string,
  order: any,
  items: any[] = []
): string => {
  const normBuyer = (buyerName || order?.buyer || 'Valued Merchant').toUpperCase();
  const orderId = order?.id || 'TC-ORDER';
  const orderDate = formatPoDate(order?.date || new Date());
  const supplierName = sanitizeSupplierName(order?.supplier || 'Assigned Rice Mill', 'DIRECT MILL');
  
  const itemsList = (items && items.length > 0)
    ? items
    : [{
        product: order?.product || order?.items || 'Premium Rice Variety',
        qty: parseFloat(order?.qty || '80'),
        rate: parseFloat(order?.rate || '8400') || 8400,
        total: order?.total || '₹ 6,72,000'
      }];

  const rowsHtml = itemsList.map((item: any) => {
    const pName = (item.product || item.name || 'Premium Rice').toUpperCase();
    const q = parseFloat(item.qty || '0');
    const r = parseFloat(item.rate || item.price || '0');
    const tot = item.total || `₹ ${(q * r).toLocaleString('en-IN')}`;
    return `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #1e293b;">${pName}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0f766e;">${q} QTLS</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; color: #475569;">₹ ${r.toLocaleString('en-IN')}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: bold; color: #0f766e;">${tot}</td>
      </tr>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Order Confirmation - ${orderId}</title>
</head>
<body style="margin: 0; padding: 24px; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1e293b;">
  <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06);">
    <div style="background-color: #143e2e; padding: 24px 28px; color: #ffffff;">
      <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; opacity: 0.85; margin-bottom: 4px;">Tejas Canvassing • Order Confirmation</div>
      <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px;">Order Registered: ${orderId}</h1>
      <div style="margin-top: 6px; font-size: 12px; opacity: 0.9;">Date of Indent: ${orderDate}</div>
    </div>
    <div style="padding: 24px 28px;">
      <p style="font-size: 14px; line-height: 1.6; margin-top: 0;">
        Hello <strong>${normBuyer}</strong>,<br>
        Your grain procurement order <strong>${orderId}</strong> has been registered on the <strong>Tejas Canvassing</strong> network.
      </p>
      <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 12px;">
        <div style="margin-bottom: 8px;"><strong>Assigned Miller/Supplier:</strong> ${supplierName}</div>
        <div style="margin-bottom: 8px;"><strong>Delivery Destination:</strong> ${order?.destination || order?.address || 'APMC Yard, Bangalore'}</div>
        <div><strong>Expected Transit Window:</strong> 3-5 business days upon mill gate dispatch</div>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px;">
        <thead>
          <tr style="background-color: #f8fafc; text-align: left; text-transform: uppercase; font-size: 10px; letter-spacing: 1px; color: #64748b;">
            <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1;">Specification</th>
            <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: right;">Quantity</th>
            <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: right;">Rate / QTL</th>
            <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: right;">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div style="margin-top: 24px; padding: 16px; background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; font-size: 12px; color: #065f46;">
        <strong>✓ Brokerage Dispatch Notice:</strong> The official Purchase Order has been transmitted to ${supplierName}. You will receive automatic SMS and WhatsApp updates as loading begins.
      </div>
      <div style="margin-top: 24px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #f1f5f9; padding-top: 16px;">
        Tejas Canvassing • Wholesale Grain Brokerage Desk • Phone: +91 98450 12345
      </div>
    </div>
  </div>
</body>
</html>
  `.trim();
};

