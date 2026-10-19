import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { sanitizeSupplierName } from '../lib/utils';
import { formatPoDate, resolveBuyerProfile } from './poEmailTemplate';

/**
 * Builds the official jsPDF Purchase Order document matching the exact
 * production layout of PO_TC-3425_Tejas_Canvassing.pdf.
 * 
 * Reused everywhere (browser download, print view, email attachment generator)
 * to guarantee 100% design and data parity.
 */
export function buildPoPdfDocument(order: any, subOrders: any[] = []): jsPDF {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const supplierName = sanitizeSupplierName(order?.supplier || order?.origin, 'DIRECT MILL');
  const poRef = order?.id || 'PO-BATCH';
  const dateFormatted = formatPoDate(order?.date);
  
  // Header Logo (TC Blue Square)
  doc.setFillColor(0, 132, 255);
  doc.roundedRect(14, 12, 12, 12, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('TC', 16.5, 20);

  // Brand Name
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text('TEJAS CANVASSING', 30, 18);
  doc.setFontSize(10.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text('Bangalore Grain Brokerage & Supply Chain Logistics • APMC Yard, Yeshwanthpur, Bangalore', 30, 23);

  // Right PO Info
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text('PURCHASE ORDER', 196, 17, { align: 'right' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(30, 41, 59);
  doc.text(`PO Ref: ${poRef}`, 196, 22, { align: 'right' });
  doc.text(`Date: ${dateFormatted}`, 196, 27, { align: 'right' });

  // Divider
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.5);
  doc.line(14, 32, 196, 32);

  // Supplier Info
  doc.setFontSize(12.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(`DEAR ${supplierName.toUpperCase()},`, 14, 40);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text("Today's consolidated orders issued under trade authorization:", 14, 45);

  const itemsList = (subOrders && subOrders.length > 0)
    ? subOrders
    : (order?.originalOrders && order.originalOrders.length > 0)
      ? order.originalOrders
      : [order];

  // Table Data
  const tableData = itemsList.map((sub: any) => {
    const buyerName = sub.buyer || order?.buyer || 'Authorized Merchant';
    const profile = resolveBuyerProfile(buyerName);
    const subDate = formatPoDate(sub.date || order?.date);
    const product = (sub.product || order?.product || 'KESHAR KALI').toUpperCase();
    const qty = `${sub.qty !== undefined ? sub.qty : 80}`;
    const rate = `${sub.rate !== undefined ? sub.rate : 8400}`;
    const loading = `Loading Days: ${sub.loadingDays !== undefined ? sub.loadingDays : 0}\nUnloading: ${sub.unloadingPoint || 'shop'}`;
    const buyerDetails = `${buyerName}\n${profile.address}\nGSTIN: ${profile.gstin} | Ph: ${profile.phone}`;

    return [subDate, buyerDetails, product, qty, rate, loading];
  });

  autoTable(doc, {
    startY: 49,
    head: [['DATE', 'BUYER & CONSIGNEE DETAILS', 'PRODUCT', 'QTY (QTL)', 'RATE (RS)', 'LOGISTICS']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [241, 245, 249],
      textColor: [15, 23, 42],
      fontStyle: 'bold',
      fontSize: 10.5,
      halign: 'left'
    },
    styles: {
      fontSize: 10,
      textColor: [15, 23, 42],
      cellPadding: 3,
      valign: 'top',
      lineColor: [203, 213, 225],
      lineWidth: 0.2
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 70 },
      2: { cellWidth: 32 },
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

  doc.line(135, finalY + 36, 196, finalY + 36);
  doc.text('Physical Ledger Filing / Acknowledgement', 135, finalY + 41);

  // Footer note
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text('This official purchase order document serves as an authentic trade ledger copy generated by TEJAS CANVASSING.', 105, 287, { align: 'center' });

  return doc;
}

/**
 * Standard filename conforming to business requirements:
 * e.g. PO_TC-3425_Tejas_Canvassing.pdf
 */
export function getPoPdfFileName(order: any): string {
  const poRef = order?.id || 'PO-BATCH';
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
