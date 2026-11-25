import { TC_COMPANY_LOGO_BASE64 } from "./logoBase64";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sanitizeSupplierName } from '../lib/utils';
import { formatPoDate, resolveBuyerProfile } from './poEmailTemplate';
import { resolveSubOrderNumber, resolveGroupedPoNumber } from './orderOperations';

// Robust constructor resolution across browser Vite, Node.js ESM/CJS, and tsx test runners
const jsPdfConstructor: typeof jsPDF = 
  (jsPDF as any)?.jsPDF || 
  (jsPDF as any)?.default?.jsPDF || 
  (jsPDF as any)?.default || 
  jsPDF;

const applyAutoTable: typeof autoTable = 
  (autoTable as any)?.default || 
  autoTable;

/**
 * Builds the official jsPDF Purchase Order document matching the exact
 * production layout of PO_TC-3425_Tejas_Canvassing.pdf.
 * 
 * Reused everywhere (browser download, print view, email attachment generator)
 * to guarantee 100% design and data parity.
 */
export function buildPoPdfDocument(order: any, subOrders: any[] = []): jsPDF {
  const doc = new jsPdfConstructor({ orientation: 'p', unit: 'mm', format: 'a4' });
  const supplierName = sanitizeSupplierName(order?.supplier || order?.origin, 'DIRECT MILL');
  const poRef = resolveGroupedPoNumber(order);
  const dateFormatted = formatPoDate(order?.date);
  
  // Header Logo (Official Company Symbol)
  try {
    doc.addImage(TC_COMPANY_LOGO_BASE64, 'PNG', 14, 11, 14, 14, undefined, 'FAST');
  } catch (err) {
    console.warn('[poPdfGenerator] Failed to embed official company logo:', err);
    doc.setFillColor(194, 36, 36);
    doc.roundedRect(14, 11, 14, 14, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('TC', 17.5, 20);
  }

  // Brand Name
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TEJAS CANVASSING', 31, 16.5);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Bangalore Grain Brokerage & Supply Chain Logistics', 31, 21.5);
  doc.text('APMC Yard, Yeshwanthpur, Bangalore - 560022', 31, 25.5);

  // Right PO Info
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PURCHASE ORDER', 196, 16.5, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(29, 78, 216);
  doc.text(`Grouped PO: ${poRef}`, 196, 21.5, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${dateFormatted}`, 196, 26, { align: 'right' });

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.4);
  doc.line(14, 30, 196, 30);

  // Supplier Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`DEAR ${supplierName.toUpperCase()},`, 14, 37.5);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text("Today's consolidated orders issued under trade authorization:", 14, 42.5);

  const itemsList = (subOrders && subOrders.length > 0)
    ? subOrders
    : (order?.originalOrders && order.originalOrders.length > 0)
      ? order.originalOrders
      : [order];

  // Table Data
  const tableData = itemsList.map((sub: any, sIdx: number) => {
    const buyerName = sub.buyer || order?.buyer || 'Authorized Merchant';
    const profile = resolveBuyerProfile(buyerName);
    const subDate = formatPoDate(sub.date || order?.date);
    const subOrderNo = resolveSubOrderNumber(sub, sIdx, order?.supplier || supplierName);
    const product = (sub.product || order?.product || 'KESHAR KALI').toUpperCase();
    const qty = `${sub.qty !== undefined ? sub.qty : 80}`;
    const rate = `${sub.rate !== undefined ? sub.rate : 8400}`;
    const loadingLines = [
      `Loading: ${sub.loadingDays !== undefined ? sub.loadingDays : 0}d`,
      `Unload: ${sub.unloadingPoint || 'shop'}`
    ];
    if (sub.remarks && String(sub.remarks).trim()) {
      loadingLines.push(`Remarks: ${String(sub.remarks).trim()}`);
    }
    const loading = loadingLines.join('\n');

    const buyerLines = [
      buyerName,
      profile.address,
      `GSTIN: ${profile.gstin} | Ph: ${profile.phone}`
    ];
    if (profile.email) {
      buyerLines.push(`Email: ${profile.email}`);
    }
    const buyerDetails = buyerLines.join('\n');

    const dateCol = subOrderNo ? `${subDate}\n[ ${subOrderNo} ]` : subDate;

    return [dateCol, buyerDetails, product, qty, rate, loading];
  });

  applyAutoTable(doc, {
    margin: { left: 14, right: 14 },
    startY: 46,
    head: [['DATE', 'BUYER & CONSIGNEE DETAILS', 'PRODUCT', 'QTY (QTL)', 'RATE (RS)', 'LOGISTICS']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 9.5,
      halign: 'left'
    },
    styles: {
      fontSize: 8.5,
      textColor: [15, 23, 42],
      cellPadding: 2.5,
      valign: 'top',
      lineColor: [203, 213, 225],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 26 },
      1: { cellWidth: 62 },
      2: { cellWidth: 30 },
      3: { cellWidth: 18, halign: 'right' },
      4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 26 }
    }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 150;

  // Total Volume
  const totalQty = itemsList.reduce((sum: number, s: any) => sum + (parseFloat(s.qty) || 0), 0);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`Total Consolidated Volume: ${totalQty} Quintals`, 14, finalY + 8);

  // Terms
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('Terms & Logistics Protocol: Goods must conform to standard moisture and grain analysis. Delivery to consignee address.', 14, finalY + 14);

  // Signatures
  doc.setDrawColor(203, 213, 225);
  doc.line(14, finalY + 36, 75, finalY + 36);
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Authorized Signatory (TEJAS CANVASSING)', 14, finalY + 41);

  return doc;
}

/**
 * Standard filename conforming to business requirements:
 * e.g. PO_TC-3425_Tejas_Canvassing.pdf
 */
export function getPoPdfFileName(order: any): string {
  const poRef = resolveGroupedPoNumber(order);
  return `PO_${poRef}_Tejas_Canvassing.pdf`;
}

/**
 * Generates the clean base64 payload (raw, without data URI header)
 * for Gmail API RFC 2822 attachment serialization.
 */
export function generatePoPdfBase64(order: any, subOrders: any[] = []): string {
  const doc = buildPoPdfDocument(order, subOrders);
  const dataUri = doc.output('datauristring');
  const base64Index = dataUri.indexOf(';base64,');
  if (base64Index !== -1) {
    return dataUri.substring(base64Index + 8);
  }
  return dataUri;
}
