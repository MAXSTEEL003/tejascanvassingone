import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, PieChart as PieIcon, BarChart as BarIcon, 
  Download, Calendar, Filter, Sparkles, User, Award, Globe, FileUp, 
  FileText, Package, Activity, Loader2, Info, AlertTriangle, 
  ArrowDownRight, ArrowUpRight, ShieldAlert, ChevronDown, RefreshCw, 
  Layers, Users, Building, Percent, Landmark, HelpCircle, CheckCircle2, 
  ChevronRight, BarChart3, Search, Play, CreditCard, ShieldCheck, 
  MapPin, Eye, ArrowRight, Coins, Briefcase, Undo2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend 
} from 'recharts';
import * as XLSX from 'xlsx';
import { cn, formatINR } from '../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getCollectionDocs, syncCollection } from '../lib/firebase';
import { 
  PRELOADED_TRANSACTIONS, RiceTransaction, normalizeExcelData, 
  runBIAnalytics, getMonthYearLabel, BIResults, formatDateToISO, parseAnyDate 
} from '../lib/analyticsEngine';

const COLORS = ['#d4af37', '#93000b', '#f2ca50', '#b45309', '#e9c349', '#78350f', '#f59e0b', '#3c2f00'];

function isRealArrivalRow(r: any): boolean {
  if (!r || typeof r !== 'object') return false;
  const hasParty = !!(r.partyName && String(r.partyName).trim());
  const hasMiller = !!(r.millerName && String(r.millerName).trim());
  const hasBill = !!(r.billNo && String(r.billNo).trim() !== '' && String(r.billNo).trim() !== '1042');
  const hasQty = !!(r.qty && parseFloat(r.qty) > 0);
  const hasNet = !!(r.netAmt && parseFloat(r.netAmt) > 0);
  const hasAmount = !!(r.amount && parseFloat(r.amount) > 0);
  return hasParty || hasMiller || hasBill || hasQty || hasNet || hasAmount;
}

export default function AnalyticsDashboard() {
  const [loading, setLoading] = useState(true);
  const [rawTransactions, setRawTransactions] = useState<RiceTransaction[]>([]);
  const [arrivalSheets, setArrivalSheets] = useState<Array<{ id: string; name: string; count: number }>>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('all');
  const [isArrivalSource, setIsArrivalSource] = useState<boolean>(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'executive' | 'buyers' | 'millers' | 'pricing' | 'forecasting'>('executive');
  
  // Interactive Scorecard Selections
  const [selectedScorecardBuyer, setSelectedScorecardBuyer] = useState<string>('');
  const [buyerSegmentFilter, setBuyerSegmentFilter] = useState<string>('all');
  const [buyerSearchTerm, setBuyerSearchTerm] = useState<string>('');

  // Comprehensive Real-time Filters
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedBuyer, setSelectedBuyer] = useState<string>('all');
  const [selectedMiller, setSelectedMiller] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedArea, setSelectedArea] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [minQty, setMinQty] = useState<number>(0);
  const [maxQty, setMaxQty] = useState<number>(1500);
  const [minRate, setMinRate] = useState<number>(0);
  const [maxRate, setMaxRate] = useState<number>(12000);

  // Load Arrival Entry records across all sheets & Firestore, map to RiceTransaction structure
  const loadAndMergeRecords = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch multi-sheet arrival entries
      let sheets: Array<{ id: string; name: string; data: any[] }> = [];
      try {
        const storedSheets = localStorage.getItem('arrival_entry_sheets_v4');
        if (storedSheets) {
          const parsed = JSON.parse(storedSheets);
          if (Array.isArray(parsed) && parsed.length > 0) {
            sheets = parsed;
          }
        }
      } catch (e) {
        console.warn("Failed parsing arrival_entry_sheets_v4:", e);
      }

      // Fallback to legacy single sheet if sheets is empty
      if (sheets.length === 0) {
        try {
          const legacyData = localStorage.getItem('arrival_entry_data_v4');
          if (legacyData) {
            const parsed = JSON.parse(legacyData);
            if (Array.isArray(parsed) && parsed.length > 0) {
              sheets = [{ id: 'sheet-1', name: 'All Arrivals (Main)', data: parsed }];
            }
          }
        } catch (e) {}
      }

      // 2. Fetch cloud arrival entries
      let cloudArrivals: any[] = [];
      try {
        cloudArrivals = await getCollectionDocs('arrival_entries');
      } catch (e) {
        console.warn("Could not fetch cloud arrival entries:", e);
      }

      // 3. Compile all arrival entries across all sheets
      const allArrivalRows: Array<{ row: any; sheetId: string; sheetName: string }> = [];
      const sheetSummaries: Array<{ id: string; name: string; count: number }> = [];

      // If we have local multi-sheets
      if (sheets.length > 0) {
        sheets.forEach(sheet => {
          let sheetValidCount = 0;
          if (Array.isArray(sheet.data)) {
            sheet.data.forEach(row => {
              if (isRealArrivalRow(row)) {
                allArrivalRows.push({ row, sheetId: sheet.id, sheetName: sheet.name });
                sheetValidCount++;
              }
            });
          }
          sheetSummaries.push({ id: sheet.id, name: sheet.name, count: sheetValidCount });
        });
      }

      // Incorporate any cloud rows that might not be in local sheets
      if (Array.isArray(cloudArrivals) && cloudArrivals.length > 0) {
        const existingIds = new Set(allArrivalRows.map(r => r.row.id || `${r.sheetId}-${r.row.billNo}`));
        cloudArrivals.forEach(cRow => {
          const cId = cRow.id || `${cRow.sheetId || 'sheet-1'}-${cRow.billNo}`;
          if (isRealArrivalRow(cRow) && !existingIds.has(cId)) {
            const sheetId = cRow.sheetId || 'sheet-cloud';
            const sheetName = cRow.sheetName || 'Cloud Arrivals';
            allArrivalRows.push({ row: cRow, sheetId, sheetName });
            const sSum = sheetSummaries.find(s => s.id === sheetId);
            if (sSum) {
              sSum.count++;
            } else {
              sheetSummaries.push({ id: sheetId, name: sheetName, count: 1 });
            }
          }
        });
      }

      // 4. Map Arrival rows to RiceTransaction[]
      const dbTransactions: RiceTransaction[] = allArrivalRows.map(({ row, sheetId, sheetName }, idx) => {
        const qty = parseFloat(row.qty) || parseFloat(row.quantity) || 0;
        const rate = parseFloat(row.rate) || 0;
        const grossAmount = parseFloat(row.amount) || (qty * rate) || 0;
        const lh = parseFloat(row.lh) || parseFloat(row.lH) || 0;
        const cc = parseFloat(row.cc) || parseFloat(row.cC) || 0;
        const tds = parseFloat(row.tds) || 0;
        const shortage = parseFloat(row.shortage) || 0;
        const diffIn = parseFloat(row.diffIn) || parseFloat(row.difference) || 0;
        const chqAm = parseFloat(row.chqAm) || parseFloat(row.chequeAmt) || 0;
        
        const calculatedNet = grossAmount - lh - cc - tds - shortage + diffIn;
        const netAmt = parseFloat(row.netAmt) || (calculatedNet > 0 ? calculatedNet : grossAmount) || grossAmount;

        const isCleared = (String(row.noOfDayRec || '').toLowerCase().includes('clear') || 
                           String(row.status || '').toLowerCase().includes('clear') || 
                           (chqAm > 0 && chqAm >= netAmt * 0.9));

        const arrivalDate = formatDateToISO(row.date || row.arrivalDt);
        const chequeDate = row.chqDt ? formatDateToISO(row.chqDt) : '';

        let paymentReceivedDays = 0;
        if (isCleared) {
          if (chequeDate && arrivalDate) {
            const arrT = new Date(arrivalDate).getTime();
            const chqT = new Date(chequeDate).getTime();
            paymentReceivedDays = Math.max(0, Math.floor((chqT - arrT) / 86400000));
          } else {
            const parsedRec = parseFloat(row.noOfDayRec);
            paymentReceivedDays = !isNaN(parsedRec) && parsedRec > 0 ? parsedRec : 15;
          }
        } else {
          if (arrivalDate) {
            paymentReceivedDays = Math.max(0, Math.floor((Date.now() - new Date(arrivalDate).getTime()) / 86400000));
          } else {
            paymentReceivedDays = parseInt(row.noOfDays, 10) || 30;
          }
        }

        const buyer = String(row.partyName || row.buyerName || row.party || "GENERAL BUYER").trim().toUpperCase();
        const miller = String(row.millerName || row.millName || row.supplier || "ANNAPURNA RICE & AGRO INDUSTRIES").trim();
        const brand = String(row.variety || row.brand || row.item || "Standard Rice").trim();
        const area = String(row.area || row.placeArea || row.place || "General").trim();
        const place = String(row.place || row.millerPlace || "").trim();

        return {
          id: row.id || `ARR-${sheetId}-${row.billNo || idx}`,
          date: arrivalDate,
          sheetId,
          sheetName,
          millerName: miller,
          placeArea: area,
          millerPlace: place,
          buyerArea: area,
          brand,
          buyerName: buyer,
          numberOfDays: parseInt(row.noOfDays, 10) || 30,
          paymentReceivedDays,
          billNumber: String(row.billNo || row.billNumber || `BILL-${idx}`).trim(),
          quantity: qty,
          rate,
          amount: grossAmount,
          loadingCharges: lh,
          commission: cc,
          tds,
          shortage,
          seller: row.seller || "Tejas Canvassing",
          difference: diffIn,
          netAmount: netAmt,
          chequeAmount: isCleared ? (chqAm || netAmt) : chqAm,
          paymentDate: chequeDate,
          bank: String(row.bank || '').trim(),
          paymentStatus: isCleared ? 'Cleared' : 'Pending'
        };
      });

      setArrivalSheets(sheetSummaries);

      if (dbTransactions.length > 0) {
        setRawTransactions(dbTransactions);
        setIsArrivalSource(true);
        setLastSyncTime(new Date().toLocaleTimeString());
      } else {
        // In production mode, show clean 0 state when no records exist
        setRawTransactions([]);
        setIsArrivalSource(true);
        setLastSyncTime(new Date().toLocaleTimeString());
      }
    } catch (err) {
      console.error("Failed loading Arrival Entry data into analytics:", err);
      setRawTransactions([]);
      setIsArrivalSource(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAndMergeRecords();

    const handleArrivalUpdate = () => {
      loadAndMergeRecords();
    };

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key && e.key.includes('arrival_entry')) {
        loadAndMergeRecords();
      }
    };

    const handleFocus = () => {
      loadAndMergeRecords();
    };

    window.addEventListener('arrival-entry-updated', handleArrivalUpdate);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('arrival-entry-updated', handleArrivalUpdate);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // ----------------------------------------------------------------------
  // DYNAMIC FILTER ENTITIES
  // ----------------------------------------------------------------------
  const filterOptions = useMemo(() => {
    const months = new Set<string>();
    const buyers = new Set<string>();
    const millers = new Set<string>();
    const brands = new Set<string>();
    const areas = new Set<string>();

    rawTransactions.forEach(t => {
      months.add(getMonthYearLabel(t.date));
      if (t.buyerName) buyers.add(t.buyerName);
      if (t.millerName) millers.add(t.millerName);
      if (t.brand) brands.add(t.brand);
      if (t.placeArea) areas.add(t.placeArea);
    });

    const sortMonthLabel = (a: string, b: string) => {
      const dateA = new Date(a.replace(/([A-Z]+)-(\d+)/, '$1 1, $2'));
      const dateB = new Date(b.replace(/([A-Z]+)-(\d+)/, '$1 1, $2'));
      return dateB.getTime() - dateA.getTime();
    };

    return {
      months: Array.from(months).sort(sortMonthLabel),
      buyers: Array.from(buyers).sort(),
      millers: Array.from(millers).sort(),
      brands: Array.from(brands).sort(),
      areas: Array.from(areas).sort()
    };
  }, [rawTransactions]);

  // ----------------------------------------------------------------------
  // REACTIVE TRANSACTION FILTERING
  // ----------------------------------------------------------------------
  const filteredTransactions = useMemo(() => {
    return rawTransactions.filter(t => {
      if (selectedSheet !== 'all' && t.sheetId !== selectedSheet) return false;
      if (selectedMonth !== 'all' && getMonthYearLabel(t.date) !== selectedMonth) return false;
      if (selectedBuyer !== 'all' && t.buyerName !== selectedBuyer) return false;
      if (selectedMiller !== 'all' && t.millerName !== selectedMiller) return false;
      if (selectedBrand !== 'all' && t.brand !== selectedBrand) return false;
      if (selectedArea !== 'all' && t.placeArea !== selectedArea) return false;
      if (selectedStatus !== 'all' && t.paymentStatus !== selectedStatus) return false;
      if (t.quantity < minQty || t.quantity > maxQty) return false;
      if (t.rate < minRate || t.rate > maxRate) return false;
      return true;
    });
  }, [rawTransactions, selectedSheet, selectedMonth, selectedBuyer, selectedMiller, selectedBrand, selectedArea, selectedStatus, minQty, maxQty, minRate, maxRate]);

  // ----------------------------------------------------------------------
  // COMPUTE DYNAMIC BI INSIGHTS & GRAPHS
  // ----------------------------------------------------------------------
  const bi = useMemo(() => {
    return runBIAnalytics(filteredTransactions);
  }, [filteredTransactions]);

  // Set default scorecard buyer once loaded
  useEffect(() => {
    if (bi.buyerLeaderboard.length > 0 && !selectedScorecardBuyer) {
      setSelectedScorecardBuyer(bi.buyerLeaderboard[0].name);
    }
  }, [bi.buyerLeaderboard]);

  const scorecardBuyerDetails = useMemo(() => {
    if (!selectedScorecardBuyer) return null;
    return bi.buyerLeaderboard.find(b => b.name === selectedScorecardBuyer) || null;
  }, [selectedScorecardBuyer, bi.buyerLeaderboard]);

  // Filtered scorecard transactions
  const scorecardBuyerTransactions = useMemo(() => {
    if (!selectedScorecardBuyer) return [];
    return filteredTransactions.filter(t => t.buyerName === selectedScorecardBuyer);
  }, [selectedScorecardBuyer, filteredTransactions]);

  // Reset all filters to default
  const handleResetFilters = () => {
    setSelectedSheet('all');
    setSelectedMonth('all');
    setSelectedBuyer('all');
    setSelectedMiller('all');
    setSelectedBrand('all');
    setSelectedArea('all');
    setSelectedStatus('all');
    setMinQty(0);
    setMaxQty(1500);
    setMinRate(0);
    setMaxRate(12000);
    setBuyerSegmentFilter('all');
    setBuyerSearchTerm('');
  };

  // ----------------------------------------------------------------------
  // SPREADSHEET (XLSX) IMPORT HANDLER
  // ----------------------------------------------------------------------
  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result as string;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const parsedRows = XLSX.utils.sheet_to_json(ws);
        
        if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
          alert("The selected spreadsheet has no valid data rows.");
          return;
        }

        const normalized = normalizeExcelData(parsedRows);
        
        // Convert to arrival entry row schema
        const newArrivalRows = normalized.map((n, idx) => ({
          id: `row-imported-${Date.now()}-${idx}`,
          billNo: n.billNumber,
          date: n.date,
          partyName: n.buyerName,
          variety: n.brand,
          brand: n.brand,
          qty: n.quantity,
          rate: n.rate,
          amount: n.amount,
          lh: n.loadingCharges,
          lH: n.loadingCharges,
          cc: n.commission,
          cC: n.commission,
          tds: n.tds,
          shortage: n.shortage,
          seller: n.seller,
          diffIn: n.difference,
          difference: n.difference,
          netAmt: n.netAmount,
          noOfDays: n.numberOfDays,
          noOfDayRec: n.paymentStatus === 'Cleared' ? 'Cleared' : 'Not Cleared',
          millerName: n.millerName,
          placeArea: n.placeArea,
          area: n.placeArea,
          place: n.millerPlace,
          chqAm: n.chequeAmount,
          chequeAmt: n.chequeAmount,
          chqDt: n.paymentDate,
          paymentDate: n.paymentDate,
          bank: n.bank,
          status: n.paymentStatus,
          lastUpdated: Date.now()
        }));

        // Retrieve existing sheets or create a new sheet for the import
        const existingSheets = JSON.parse(localStorage.getItem('arrival_entry_sheets_v4') || '[]');
        const importedSheetId = `sheet-import-${Date.now()}`;
        const importedSheetName = wsname || `Imported ${new Date().toLocaleDateString()}`;
        
        const updatedSheets = [
          ...existingSheets,
          {
            id: importedSheetId,
            name: importedSheetName,
            data: newArrivalRows
          }
        ];

        localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(updatedSheets));
        localStorage.setItem('arrival_entry_data_v4', JSON.stringify(newArrivalRows));
        
        try {
          window.dispatchEvent(new CustomEvent('arrival-entry-updated'));
        } catch (err) {}

        // Sync with Firestore if available
        await syncCollection('arrival_entries', newArrivalRows).catch(console.warn);
        
        // Reload State
        await loadAndMergeRecords();
        alert(`Successfully imported ${newArrivalRows.length} records into Arrival Entry sheets. Analytics recomputed instantly!`);
      } catch (err) {
        console.error("Error during import parsing:", err);
        alert("Failed to parse this Excel sheet. Please verify standard rice column formats.");
      }
    };
    reader.readAsBinaryString(file);
  };

  // ----------------------------------------------------------------------
  // ENTERPRISE EXPORT TO PDF BRIEFING
  // ----------------------------------------------------------------------
  const handleExportPDF = () => {
    const doc = new jsPDF();
    const primaryColor = [147, 0, 11]; // deep crimson
    const darkSlate = [44, 44, 44]; // charcoal
    const textGray = [100, 100, 100];

    // Page 1 header banner
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(0, 0, 210, 36, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("TEJAS CANVASSING • ENTERPRISE INTEL REPORT", 14, 15);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.text(`Consolidated BI Intelligence briefing: ${selectedMonth === 'all' ? 'ALL RECORDED MONTHS' : selectedMonth}`, 14, 23);
    doc.text(`Generated: ${new Date().toLocaleString()} | Dynamic Filtering Enabled`, 14, 29);

    doc.setFontSize(8);
    doc.text("CONFIDENTIAL DECISION SUPPORT SYSTEM", 142, 10);

    // Section 1: executive KPIs
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("1. EXECUTIVE PERFORMANCE SUMMARY", 14, 48);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const summaryText = `This briefing compiles active transaction pipelines representing ${bi.transactions.length} reconciled rice trading operations. The aggregate capital flow analyzed stands at INR ${formatINR(bi.totalSales)} with a net trade volume of ${bi.totalQuantity.toLocaleString()} Quintals (QTLS). Weighted system pricing averages ₹${formatINR(bi.avgSellingPrice)} per QTL across all brands, showcasing a collection efficiency rate of ${bi.collectionEfficiency.toFixed(1)}%.`;
    const summaryLines = doc.splitTextToSize(summaryText, 182);
    doc.text(summaryLines, 14, 54);

    // Key metrics grid
    const startY = 74;
    const boxWidth = 58;
    const boxHeight = 22;

    // Box 1: Revenue
    doc.setFillColor(248, 250, 252);
    doc.rect(14, startY, boxWidth, boxHeight, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.rect(14, startY, boxWidth, boxHeight, 'S');
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("GROSS SALES VOLUME", 18, startY + 6);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setFontSize(10);
    doc.text(`₹ ${formatINR(bi.totalSales)}`, 18, startY + 14);

    // Box 2: Volume
    doc.setFillColor(248, 250, 252);
    doc.rect(14 + boxWidth + 4, startY, boxWidth, boxHeight, 'F');
    doc.rect(14 + boxWidth + 4, startY, boxWidth, boxHeight, 'S');
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(7.5);
    doc.text("TOTAL QUANTITY (QTLS)", 14 + boxWidth + 8, startY + 6);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.setFontSize(10);
    doc.text(`${bi.totalQuantity.toLocaleString()} QTLS`, 14 + boxWidth + 8, startY + 14);

    // Box 3: Collection Day Average
    doc.setFillColor(248, 250, 252);
    doc.rect(14 + (boxWidth * 2) + 8, startY, boxWidth, boxHeight, 'F');
    doc.rect(14 + (boxWidth * 2) + 8, startY, boxWidth, boxHeight, 'S');
    doc.setTextColor(textGray[0], textGray[1], textGray[2]);
    doc.setFontSize(7.5);
    doc.text("AVG COLLECTION TIMELINE", 14 + (boxWidth * 2) + 12, startY + 6);
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.setFontSize(10);
    doc.text(`${bi.avgPaymentCollectionTime} Days`, 14 + (boxWidth * 2) + 12, startY + 14);

    // Section 2: AI Observations
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("2. EXECUTIVE STRATEGIC ANALYSIS & RECOMMENDATIONS", 14, 108);

    let listY = 114;
    bi.insights.forEach((ins, idx) => {
      doc.setFillColor(idx % 2 === 0 ? 147 : 200, idx % 2 === 0 ? 0 : 150, idx % 2 === 0 ? 11 : 60);
      doc.rect(14, listY, 3, 14, 'F');

      doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.text(`[${ins.category.toUpperCase()}] ${ins.title}`, 20, listY + 4);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(textGray[0], textGray[1], textGray[2]);
      doc.text(ins.desc, 20, listY + 8.5);

      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Rec: ${ins.recommendation}`, 20, listY + 12.5);

      listY += 17;
    });

    // Section 3: Brand Performance Table
    doc.setTextColor(darkSlate[0], darkSlate[1], darkSlate[2]);
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("3. BRAND COMMODITY PROFILE BREAKDOWN", 14, listY + 4);

    const brandTableData = bi.brandSales.map(b => [
      b.name,
      `${b.qty.toLocaleString()} QTLS`,
      `₹ ${formatINR(b.avgRate)}`,
      `₹ ${formatINR(b.revenue)}`,
      `${b.pct}%`
    ]);

    autoTable(doc, {
      startY: listY + 8,
      head: [['Rice Brand', 'Volume Sold', 'Avg Rate / QTL', 'Gross Revenue (INR)', 'Market Share %']],
      body: brandTableData,
      theme: 'grid',
      headStyles: { fillColor: '#93000b', textColor: '#ffffff', fontStyle: 'bold' },
      styles: { fontSize: 8 },
      margin: { left: 14, right: 14 }
    });

    // Save PDF
    doc.save(`TejasCanvassing_BI_Report_${selectedMonth.replace('-', '_')}.pdf`);
  };

  // ----------------------------------------------------------------------
  // ENTERPRISE EXPORT TO EXCEL WORKBOOK
  // ----------------------------------------------------------------------
  const handleExportExcel = () => {
    // 1. Transactions Sheet
    const txnsData = filteredTransactions.map(t => ({
      'Date': t.date,
      'Bill Number': t.billNumber,
      'Buyer Name': t.buyerName,
      'Miller Name': t.millerName,
      'Area': t.placeArea,
      'Brand': t.brand,
      'Quantity (QTLS)': t.quantity,
      'Rate/Qtl': t.rate,
      'Loading (L.H.)': t.loadingCharges,
      'Commission (C.C.)': t.commission,
      'Net Amount': t.netAmount,
      'Payment Days': t.paymentReceivedDays,
      'Bank': t.bank,
      'Status': t.paymentStatus
    }));

    // 2. Buyer Leaderboard Sheet
    const buyersData = bi.buyerLeaderboard.map(b => ({
      'Buyer Name': b.name,
      'Gross Purchase (INR)': b.totalPurchases,
      'Volume (QTLS)': b.qty,
      'Frequency (Bills)': b.frequency,
      'Avg Bill Size': b.avgBillSize,
      'Avg Payment Delay (Days)': b.delay,
      'Outstanding Amount': b.outstanding,
      'Customer Segment': b.segment
    }));

    // 3. Miller performance
    const millersData = bi.millerPerformance.map(m => ({
      'Miller Name': m.name,
      'Total Sales Generated': m.revenue,
      'Volume Handled (QTLS)': m.qty,
      'Average Rate/Qtl': m.avgRate,
      'Repeat Buyer Accounts': m.repeatBuyers,
      'Bill Count': m.count
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txnsData), "Transaction Corridor");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(buyersData), "Buyer Intelligence");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(millersData), "Miller Performance Matrix");
    XLSX.writeFile(wb, `TejasCanvassing_BI_Ledger_${selectedMonth}.xlsx`);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[65vh] gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-[#93000b]" />
        <p className="text-gray-500 text-xs font-black uppercase tracking-wider animate-pulse">Compiling Enterprise Data Aggregation...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto text-gray-900 dark:text-amber-100 bg-slate-50/50 dark:bg-[#0a0a0a] min-h-screen">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-gray-200 dark:border-neutral-800">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#93000b] dark:text-amber-400 uppercase tracking-widest">
            <span className="w-2 h-2 rounded-full bg-[#93000b] dark:bg-amber-400 animate-ping" />
            Live BI System Online
          </div>
          <h1 className="text-3xl font-black tracking-tight text-gray-950 dark:text-amber-100 flex items-center gap-2">
            Tejas Canvassing <span className="text-xs font-medium text-gray-400 dark:text-amber-400/80 bg-gray-200/60 dark:bg-amber-500/10 px-2 py-0.5 rounded-lg border border-gray-300/40 dark:border-amber-500/20">v2.0 BI Platform</span>
          </h1>
          <p className="text-gray-500 dark:text-amber-200/70 text-sm italic font-medium">
            World-Class Decision Support Dashboard for Enterprise Rice Trading Operations.
          </p>
        </div>

        {/* TOP LEVEL CONTROLS */}
        <div className="flex flex-wrap items-center gap-3">
          {/* XLS Upload Handler */}
          <label className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-[#121212] hover:bg-slate-50 dark:hover:bg-[#1a1a1a] border border-slate-200 dark:border-amber-500/20 text-gray-800 dark:text-amber-100 rounded-xl shadow-sm text-xs font-black tracking-widest uppercase cursor-pointer transition-all">
            <FileUp className="w-4 h-4 text-[#93000b] dark:text-amber-400" />
            Import Excel
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportExcel} />
          </label>

          {/* Export PDF */}
          <button 
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-4 py-2 bg-[#93000b]/10 dark:bg-amber-500/10 text-[#93000b] dark:text-amber-300 hover:bg-[#93000b]/15 rounded-xl text-xs font-black tracking-widest uppercase transition-all"
          >
            <FileText className="w-4 h-4" />
            PDF Briefing
          </button>

          {/* Export Excel */}
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-amber-500 text-white dark:text-black hover:bg-gray-850 dark:hover:bg-amber-400 rounded-xl text-xs font-black tracking-widest uppercase shadow-md transition-all"
          >
            <Download className="w-4 h-4" />
            Export BI Ledger
          </button>
        </div>
      </div>

      {/* SOURCE OF DATA STATUS BANNER */}
      <div className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 rounded-2xl border transition-all shadow-sm",
        isArrivalSource 
          ? "bg-gradient-to-r from-emerald-500/10 via-amber-500/5 to-emerald-500/10 border-emerald-500/30 dark:border-emerald-500/20"
          : "bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 border-amber-500/30 dark:border-amber-500/20"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-xl text-black shadow-sm flex-shrink-0 font-bold",
            isArrivalSource ? "bg-emerald-500 text-white" : "bg-amber-500 text-black"
          )}>
            <Package className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-gray-900 dark:text-amber-100">
                {isArrivalSource ? "🌾 Arrival Entry Intelligence Engine" : "⚡ Enterprise Demo Dataset"}
              </h4>
              <span className={cn(
                "text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider",
                isArrivalSource 
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800"
                  : "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800"
              )}>
                {isArrivalSource ? "Live Synchronized" : "Starter Demo"}
              </span>
            </div>
            <p className="text-[11px] text-gray-600 dark:text-amber-200/80 font-medium">
              {isArrivalSource 
                ? `Analytics is computed directly from ${rawTransactions.length} verified trade records across ${arrivalSheets.length || 1} sheet(s). Last synced: ${lastSyncTime}.`
                : `Showing the preloaded enterprise trade dataset. Add or manage sheets in Arrival Entry to view your custom analytics!`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          <button
            onClick={() => loadAndMergeRecords()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#181818] hover:bg-slate-100 dark:hover:bg-[#222] text-gray-800 dark:text-amber-200 text-xs font-bold rounded-xl border border-slate-200 dark:border-amber-500/20 shadow-sm transition-all cursor-pointer"
            title="Re-fetch and synchronize Arrival Entry data"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#93000b] dark:text-amber-400" />
            <span>Sync Live Arrivals</span>
          </button>
        </div>
      </div>

      {/* MULTI-DIMENSIONAL FILTER RAIL */}
      <div className="bg-white dark:bg-[#121212] rounded-3xl border border-gray-200/80 dark:border-amber-500/20 p-5 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1.5 h-full bg-[#93000b] dark:bg-amber-500" />
        
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-black uppercase tracking-wider text-gray-400 dark:text-amber-400/80 flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#93000b] dark:text-amber-400" />
            Active Filter Rail
          </h2>
          <button 
            onClick={handleResetFilters}
            className="text-[10px] font-black text-[#93000b] dark:text-amber-400 hover:underline uppercase flex items-center gap-1"
          >
            <Undo2 className="w-3 h-3" />
            Clear Filters
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3">
          
          {/* Arrival Sheet Filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 dark:text-amber-300/80 uppercase">Arrival Sheet</label>
            <div className="relative">
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-amber-500/20 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-gray-800 dark:text-amber-100 appearance-none focus:outline-none focus:border-[#93000b] dark:focus:border-amber-400 truncate"
              >
                <option value="all" className="bg-white dark:bg-[#121212]">ALL SHEETS (Consolidated)</option>
                {arrivalSheets.map(s => (
                  <option key={s.id} value={s.id} className="bg-white dark:bg-[#121212]">
                    {s.name} ({s.count} rows)
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-amber-400/60 pointer-events-none" />
            </div>
          </div>

          {/* Month/Timeline filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 dark:text-amber-300/80 uppercase">Timeline Month</label>
            <div className="relative">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-amber-500/20 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-gray-800 dark:text-amber-100 appearance-none focus:outline-none focus:border-[#93000b] dark:focus:border-amber-400"
              >
                <option value="all" className="bg-white dark:bg-[#121212]">ALL MONTHS</option>
                {filterOptions.months.map(m => (
                  <option key={m} value={m} className="bg-white dark:bg-[#121212]">{m}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-amber-400/60 pointer-events-none" />
            </div>
          </div>

          {/* Buyer filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 dark:text-amber-300/80 uppercase">Filter Buyer</label>
            <div className="relative">
              <select
                value={selectedBuyer}
                onChange={(e) => setSelectedBuyer(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-amber-500/20 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-gray-800 dark:text-amber-100 appearance-none focus:outline-none focus:border-[#93000b] dark:focus:border-amber-400"
              >
                <option value="all" className="bg-white dark:bg-[#121212]">ALL BUYERS</option>
                {filterOptions.buyers.map(b => (
                  <option key={b} value={b} className="bg-white dark:bg-[#121212]">{b}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-amber-400/60 pointer-events-none" />
            </div>
          </div>

          {/* Miller filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 dark:text-amber-300/80 uppercase">Filter Miller Name</label>
            <div className="relative">
              <select
                value={selectedMiller}
                onChange={(e) => setSelectedMiller(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-amber-500/20 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-gray-800 dark:text-amber-100 appearance-none focus:outline-none focus:border-[#93000b] dark:focus:border-amber-400"
              >
                <option value="all" className="bg-white dark:bg-[#121212]">ALL MILLERS</option>
                {filterOptions.millers.map(m => (
                  <option key={m} value={m} className="bg-white dark:bg-[#121212]">{m}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-amber-400/60 pointer-events-none" />
            </div>
          </div>

          {/* Brand filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 dark:text-amber-300/80 uppercase">Filter Brand</label>
            <div className="relative">
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-amber-500/20 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-gray-800 dark:text-amber-100 appearance-none focus:outline-none focus:border-[#93000b] dark:focus:border-amber-400"
              >
                <option value="all" className="bg-white dark:bg-[#121212]">ALL BRANDS</option>
                {filterOptions.brands.map(b => (
                  <option key={b} value={b} className="bg-white dark:bg-[#121212]">{b}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-amber-400/60 pointer-events-none" />
            </div>
          </div>

          {/* Area filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 dark:text-amber-300/80 uppercase">Place / Area</label>
            <div className="relative">
              <select
                value={selectedArea}
                onChange={(e) => setSelectedArea(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-amber-500/20 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-gray-800 dark:text-amber-100 appearance-none focus:outline-none focus:border-[#93000b] dark:focus:border-amber-400"
              >
                <option value="all" className="bg-white dark:bg-[#121212]">ALL AREAS</option>
                {filterOptions.areas.map(a => (
                  <option key={a} value={a} className="bg-white dark:bg-[#121212]">{a}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-amber-400/60 pointer-events-none" />
            </div>
          </div>

          {/* Status filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 dark:text-amber-300/80 uppercase">Payment Status</label>
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-amber-500/20 rounded-xl pl-3 pr-8 py-2 text-xs font-bold text-gray-800 dark:text-amber-100 appearance-none focus:outline-none focus:border-[#93000b] dark:focus:border-amber-400"
              >
                <option value="all" className="bg-white dark:bg-[#121212]">Cleared & Pending</option>
                <option value="Cleared" className="bg-white dark:bg-[#121212]">Cleared Bills Only</option>
                <option value="Pending" className="bg-white dark:bg-[#121212]">Outstanding / Pending</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-amber-400/60 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Numerical range sub-sliders */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-100 dark:border-amber-500/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-[#181818] px-4 py-2.5 rounded-xl border border-slate-200/50 dark:border-amber-500/20">
            <span className="text-[10px] font-black text-gray-500 dark:text-amber-300/80 uppercase whitespace-nowrap">Quantity Threshold</span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input 
                type="number" 
                value={minQty} 
                onChange={e => setMinQty(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-16 bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-neutral-700 text-gray-800 dark:text-amber-100 text-center rounded-lg py-1 text-xs font-bold focus:outline-none focus:border-[#93000b] dark:focus:border-amber-400"
                placeholder="Min Qty"
              />
              <span className="text-gray-400 dark:text-amber-400/60 text-xs">to</span>
              <input 
                type="number" 
                value={maxQty} 
                onChange={e => setMaxQty(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20 bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-neutral-700 text-gray-800 dark:text-amber-100 text-center rounded-lg py-1 text-xs font-bold focus:outline-none focus:border-[#93000b] dark:focus:border-amber-400"
                placeholder="Max Qty"
              />
              <span className="text-[10px] font-bold text-gray-400 dark:text-amber-400/60 uppercase">QTLS</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 dark:bg-[#181818] px-4 py-2.5 rounded-xl border border-slate-200/50 dark:border-amber-500/20">
            <span className="text-[10px] font-black text-gray-500 dark:text-amber-300/80 uppercase whitespace-nowrap">Pricing Rate Filter</span>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <input 
                type="number" 
                value={minRate} 
                onChange={e => setMinRate(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20 bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-neutral-700 text-gray-800 dark:text-amber-100 text-center rounded-lg py-1 text-xs font-bold focus:outline-none focus:border-[#93000b] dark:focus:border-amber-400"
                placeholder="Min Price"
              />
              <span className="text-gray-400 dark:text-amber-400/60 text-xs">to</span>
              <input 
                type="number" 
                value={maxRate} 
                onChange={e => setMaxRate(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-24 bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-neutral-700 text-gray-800 dark:text-amber-100 text-center rounded-lg py-1 text-xs font-bold focus:outline-none focus:border-[#93000b] dark:focus:border-amber-400"
                placeholder="Max Price"
              />
              <span className="text-[10px] font-bold text-gray-400 dark:text-amber-400/60 uppercase">₹/Qtl</span>
            </div>
          </div>
        </div>
      </div>

      {/* TABS WORKSPACE SELECTOR */}
      <div className="flex overflow-x-auto gap-1 bg-slate-200/60 dark:bg-[#121212] p-1.5 rounded-2xl border border-slate-300/40 dark:border-amber-500/20">
        <button
          onClick={() => setActiveTab('executive')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase whitespace-nowrap transition-all flex-1 justify-center cursor-pointer",
            activeTab === 'executive' 
              ? "bg-white dark:bg-[#f2ca50] text-[#93000b] dark:text-black shadow-sm font-black" 
              : "text-gray-600 dark:text-amber-200/70 hover:text-gray-900 dark:hover:text-amber-100 hover:bg-white/40 dark:hover:bg-neutral-800"
          )}
        >
          <BarChart3 className="w-4 h-4" />
          📊 Business Overview
        </button>
        <button
          onClick={() => setActiveTab('buyers')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase whitespace-nowrap transition-all flex-1 justify-center cursor-pointer",
            activeTab === 'buyers' 
              ? "bg-white dark:bg-[#f2ca50] text-[#93000b] dark:text-black shadow-sm font-black" 
              : "text-gray-600 dark:text-amber-200/70 hover:text-gray-900 dark:hover:text-amber-100 hover:bg-white/40 dark:hover:bg-neutral-800"
          )}
        >
          <Users className="w-4 h-4" />
          👥 Customers & Payments
        </button>
        <button
          onClick={() => setActiveTab('millers')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase whitespace-nowrap transition-all flex-1 justify-center cursor-pointer",
            activeTab === 'millers' 
              ? "bg-white dark:bg-[#f2ca50] text-[#93000b] dark:text-black shadow-sm font-black" 
              : "text-gray-600 dark:text-amber-200/70 hover:text-gray-900 dark:hover:text-amber-100 hover:bg-white/40 dark:hover:bg-neutral-800"
          )}
        >
          <Building className="w-4 h-4" />
          🌾 Suppliers & Brands
        </button>
        <button
          onClick={() => setActiveTab('pricing')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase whitespace-nowrap transition-all flex-1 justify-center cursor-pointer",
            activeTab === 'pricing' 
              ? "bg-white dark:bg-[#f2ca50] text-[#93000b] dark:text-black shadow-sm font-black" 
              : "text-gray-600 dark:text-amber-200/70 hover:text-gray-900 dark:hover:text-amber-100 hover:bg-white/40 dark:hover:bg-neutral-800"
          )}
        >
          <Coins className="w-4 h-4" />
          💰 Sales & Rates
        </button>
        <button
          onClick={() => setActiveTab('forecasting')}
          className={cn(
            "flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black tracking-wider uppercase whitespace-nowrap transition-all flex-1 justify-center cursor-pointer",
            activeTab === 'forecasting' 
              ? "bg-white dark:bg-[#f2ca50] text-[#93000b] dark:text-black shadow-sm font-black" 
              : "text-gray-600 dark:text-amber-200/70 hover:text-gray-900 dark:hover:text-amber-100 hover:bg-white/40 dark:hover:bg-neutral-800"
          )}
        >
          <Sparkles className="w-4 h-4" />
          🔮 Future Estimator
        </button>
      </div>

      {/* MAIN DYNAMIC CONTENT SWITCHER */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.2 }}
          className="space-y-8"
        >
          {filteredTransactions.length === 0 ? (
            <div className="bg-white dark:bg-[#121212] rounded-3xl border border-gray-200 dark:border-amber-500/20 p-12 text-center flex flex-col items-center justify-center gap-4">
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-full border border-amber-100 dark:border-amber-900/40">
                <AlertTriangle className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-lg font-black text-gray-900 dark:text-amber-100 uppercase tracking-tight">No Matching Records Found</h3>
              <p className="text-gray-500 dark:text-amber-200/70 text-sm max-w-md font-medium">
                The current interactive filters have returned zero records. Clear or adjust your slider limits to populate the dashboard metrics.
              </p>
              <button 
                onClick={handleResetFilters}
                className="px-6 py-2.5 bg-[#93000b] dark:bg-amber-500 text-white dark:text-black rounded-xl text-xs font-black uppercase tracking-widest hover:opacity-95 transition-all shadow-md cursor-pointer"
              >
                Reset Dashboard Filters
              </button>
            </div>
          ) : (
            <>
              {/* ====================================================================== */}
              {/* TAB 1: EXECUTIVE WORKSPACE */}
              {/* ====================================================================== */}
              {activeTab === 'executive' && (
                <div className="space-y-8">
                  {/* SIMPLE ENGLISH EXPLANATION CARD */}
                  <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/15 rounded-2xl border border-amber-500/20 dark:border-amber-500/30 p-5 flex gap-4 items-start shadow-sm hover:shadow-md transition-all">
                    <div className="p-2.5 bg-amber-500 text-black rounded-xl shadow-md flex-shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                        💡 Simple Explanation: What does this screen show?
                      </h4>
                      <p className="text-xs text-amber-900/85 dark:text-amber-100/90 leading-relaxed font-semibold">
                        This is your business's main scorecard. It shows how much total money you made (<span className="text-[#93000b] dark:text-amber-400 font-black">Gross Sales</span>), the total amount of rice you sold (<span className="text-blue-600 dark:text-sky-400 font-black">Total Quantity</span>), the average rate you sold it for, and how much of your money is collected versus still pending (<span className="text-emerald-600 dark:text-emerald-400 font-black">Collection Efficiency</span>). The charts below show your sales over time, and the AI observations give you quick suggestions to grow your business.
                      </p>
                    </div>
                  </div>
                  
                  {/* KPI CARD CONTAINER */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* KPI 1: Gross Sales */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
                      transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
                      className="liquid-glass p-5 rounded-2xl premium-border shadow-sm space-y-2 relative overflow-hidden interactive-card"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-gray-400 dark:text-amber-400/80 uppercase tracking-wider">Gross Revenue (INR)</span>
                        <div className="p-1.5 bg-rose-50 dark:bg-amber-500/10 rounded-lg text-[#93000b] dark:text-amber-400">
                          <TrendingUp className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black text-gray-900 dark:text-amber-100">₹{formatINR(bi.totalSales)}</h3>
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                            bi.revenueGrowthMoM >= 0 ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                          )}>
                            {bi.revenueGrowthMoM >= 0 ? '+' : ''}{bi.revenueGrowthMoM.toFixed(1)}% MoM
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-amber-300/60">vs Previous Period</span>
                        </div>
                      </div>
                    </motion.div>

                    {/* KPI 2: Total Volume */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
                      transition={{ duration: 0.48, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
                      className="liquid-glass p-5 rounded-2xl premium-border shadow-sm space-y-2 relative overflow-hidden interactive-card"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-gray-400 dark:text-amber-400/80 uppercase tracking-wider">Total Quantity Sold</span>
                        <div className="p-1.5 bg-blue-50 dark:bg-amber-500/10 rounded-lg text-blue-600 dark:text-amber-400">
                          <Package className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black text-gray-900 dark:text-amber-100">{bi.totalQuantity.toLocaleString()} QTLS</h3>
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                            bi.quantityGrowthMoM >= 0 ? "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400" : "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400"
                          )}>
                            {bi.quantityGrowthMoM >= 0 ? '+' : ''}{bi.quantityGrowthMoM.toFixed(1)}% Qty
                          </span>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-amber-300/60">aggregated volume</span>
                        </div>
                      </div>
                    </motion.div>

                    {/* KPI 3: Avg Selling Price */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
                      transition={{ duration: 0.48, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
                      className="liquid-glass p-5 rounded-2xl premium-border shadow-sm space-y-2 relative overflow-hidden interactive-card"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-gray-400 dark:text-amber-400/80 uppercase tracking-wider">Weighted Avg Price</span>
                        <div className="p-1.5 bg-amber-50 dark:bg-amber-500/10 rounded-lg text-amber-600 dark:text-amber-400">
                          <Coins className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black text-gray-900 dark:text-amber-100">₹{formatINR(bi.avgSellingPrice)} / QTL</h3>
                        <div className="flex items-center gap-1.5 border-t border-slate-100 dark:border-amber-500/10 pt-1">
                          <span className="text-[10px] font-bold text-gray-400 dark:text-amber-300/60">Across {bi.countBrands} distinct brand catalogs</span>
                        </div>
                      </div>
                    </motion.div>

                    {/* KPI 4: Outstanding Receivables */}
                    <motion.div 
                      initial={{ opacity: 0, y: 20, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      whileHover={{ y: -5, transition: { duration: 0.22, ease: "easeOut" } }}
                      transition={{ duration: 0.48, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="liquid-glass p-5 rounded-2xl premium-border shadow-sm space-y-2 relative overflow-hidden interactive-card"
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-[10px] font-black text-gray-400 dark:text-amber-400/80 uppercase tracking-wider">Collection Efficiency</span>
                        <div className="p-1.5 bg-emerald-50 dark:bg-amber-500/10 rounded-lg text-emerald-600 dark:text-amber-400">
                          <Landmark className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-2xl font-black text-gray-900 dark:text-amber-100">{bi.collectionEfficiency.toFixed(1)}%</h3>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-black text-red-600 dark:text-rose-400">₹{formatINR(bi.outstandingPayments)} Pending</span>
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* SALES & VOLUMETRIC GRAPH GRID */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    
                    {/* Main Line graph of Sales History */}
                    <motion.div 
                      initial={{ opacity: 0, y: 22, scale: 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="lg:col-span-8 liquid-glass p-6 rounded-3xl premium-border shadow-sm space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-black text-gray-900 dark:text-amber-100 uppercase tracking-tight">Market Revenue Timeline</h3>
                          <p className="text-xs text-gray-400 dark:text-amber-200/70 font-medium italic">Gross sales volume calculated over the selected active filters.</p>
                        </div>
                        <div className="flex gap-4 text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-amber-300/80">
                          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#93000b] dark:bg-amber-400" />Revenue (INR)</span>
                        </div>
                      </div>
                      <div className="h-72 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} initialDimension={{ width: 300, height: 200 }}>
                          <AreaChart data={bi.forecast.timeline.filter(t => !t.name.includes('FC'))}>
                            <defs>
                              <linearGradient id="gradientRev" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f2ca50" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#f2ca50" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#d0c5af' }} dy={8} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#d0c5af' }} tickFormatter={v => `₹${v >= 100000 ? (v/100000).toFixed(1)+'L' : v}`} />
                            <Tooltip formatter={v => [`₹ ${formatINR(Number(v))}`, 'Total Revenue']} contentStyle={{ backgroundColor: '#181818', borderColor: '#333', color: '#f2ca50', borderRadius: '12px' }} />
                            <Area type="monotone" dataKey="revenue" stroke="#f2ca50" strokeWidth={3} fillOpacity={1} fill="url(#gradientRev)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.div>

                    {/* Quick Donut Chart of Brands */}
                    <motion.div 
                      initial={{ opacity: 0, y: 22, scale: 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
                      className="lg:col-span-4 liquid-glass p-6 rounded-3xl premium-border shadow-sm flex flex-col justify-between"
                    >
                      <div className="space-y-1">
                        <h3 className="text-base font-black text-gray-900 dark:text-amber-100 uppercase tracking-tight">Brand Demand Index</h3>
                        <p className="text-xs text-gray-400 dark:text-amber-200/70 font-medium">Percentage distribution of volume sold by catalog brand.</p>
                      </div>
                      <div className="h-44 my-4 flex items-center justify-center w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} initialDimension={{ width: 200, height: 180 }}>
                          <PieChart>
                            <Pie
                              data={bi.brandSales}
                              cx="50%"
                              cy="50%"
                              innerRadius={48}
                              outerRadius={68}
                              paddingAngle={4}
                              dataKey="revenue"
                            >
                              {bi.brandSales.map((entry, idx) => (
                                <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={v => `₹ ${formatINR(Number(v))}`} contentStyle={{ backgroundColor: '#181818', borderColor: '#333', color: '#f2ca50', borderRadius: '12px' }} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                        {bi.brandSales.slice(0, 4).map((b, idx) => (
                          <div key={b.name} className="flex items-center justify-between text-xs bg-slate-50/50 dark:bg-[#181818] p-2 rounded-xl border border-slate-100 dark:border-amber-500/15">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                              <span className="font-bold text-gray-700 dark:text-amber-200 truncate max-w-[120px]">{b.name}</span>
                            </div>
                            <span className="font-black text-gray-900 dark:text-amber-100">{b.pct}%</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </div>

                  {/* AI OBSERVATIONS PANEL */}
                  <motion.div 
                    initial={{ opacity: 0, y: 22, scale: 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
                    className="liquid-glass rounded-3xl premium-border p-6 shadow-sm space-y-4"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-[#93000b] dark:text-amber-400" />
                      <h3 className="text-base font-black text-gray-950 dark:text-amber-100 uppercase tracking-tight">AI Executive Observations & Insights</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {bi.insights.map((ins, idx) => (
                        <motion.div 
                          key={idx}
                          initial={{ opacity: 0, y: 16, scale: 0.985 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          whileHover={{ y: -4, transition: { duration: 0.2, ease: "easeOut" } }}
                          transition={{ duration: 0.44, delay: 0.35 + idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
                          className={cn(
                            "liquid-glass p-4 rounded-2xl border flex flex-col justify-between gap-3 relative overflow-hidden interactive-card",
                            ins.status === 'critical' ? "border-rose-200 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/20" :
                            ins.status === 'warning' ? "border-amber-200 dark:border-amber-900/40 bg-amber-50/20 dark:bg-amber-950/20" : "border-emerald-200 dark:border-amber-500/30 bg-emerald-50/20 dark:bg-amber-500/10"
                          )}
                        >
                          <div className="space-y-1.5 z-10">
                            <div className="flex items-center justify-between">
                              <span className={cn(
                                "text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                ins.category === 'Opportunity' ? "bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30" :
                                ins.category === 'Risk' ? "bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800" : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                              )}>
                                {ins.category}
                              </span>
                            </div>
                            <h4 className="text-xs font-black text-gray-900 dark:text-amber-100 leading-snug">{ins.title}</h4>
                            <p className="text-[11px] text-gray-500 dark:text-amber-200/70 font-medium leading-relaxed">{ins.desc}</p>
                          </div>
                          <div className="pt-2 border-t border-dashed border-gray-200 dark:border-amber-500/20 space-y-1 z-10">
                            <span className="text-[9px] font-black uppercase tracking-wider text-[#93000b] dark:text-amber-400 flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> Actionable Strategy Directive
                            </span>
                            <p className="text-[10px] text-gray-600 dark:text-amber-200/80 italic font-semibold leading-relaxed">"{ins.recommendation}"</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}

              {/* ====================================================================== */}
              {/* TAB 2: BUYER INTELLIGENCE */}
              {/* ====================================================================== */}
              {activeTab === 'buyers' && (
                <div className="space-y-6">
                  {/* SIMPLE ENGLISH EXPLANATION CARD */}
                  <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/15 rounded-2xl border border-amber-500/20 dark:border-amber-500/30 p-5 flex gap-4 items-start shadow-sm hover:shadow-md transition-all">
                    <div className="p-2.5 bg-amber-500 text-black rounded-xl shadow-md flex-shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                        💡 Simple Explanation: What does this screen show?
                      </h4>
                      <p className="text-xs text-amber-900/85 dark:text-amber-100/90 leading-relaxed font-semibold">
                        This screen lists your buyers (the customers buying rice from you). You can instantly see who is your biggest customer, who owes you money, and who has overdue bills. <span className="text-[#93000b] dark:text-amber-400 font-black">Click on any buyer name</span> in the list to open their interactive, automated report card on the right!
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* LEFT: LEADERBOARD & LIST */}
                  <div className="lg:col-span-7 bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-200/80 dark:border-amber-500/20 shadow-sm space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-black text-gray-950 dark:text-amber-100 uppercase tracking-tight">Buyer Performance Leaderboard</h3>
                        <p className="text-xs text-gray-400 dark:text-amber-200/70 font-medium">Automatic sorting based on overall purchase volume value.</p>
                      </div>
                      <div className="relative w-full sm:w-48">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-amber-400/60" />
                        <input
                          type="text"
                          value={buyerSearchTerm}
                          onChange={e => setBuyerSearchTerm(e.target.value)}
                          placeholder="Search counterparties..."
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-amber-500/20 rounded-xl text-xs font-bold text-gray-700 dark:text-amber-100 focus:outline-none focus:border-[#93000b] dark:focus:border-amber-400"
                        />
                      </div>
                    </div>

                    {/* SEGMENT QUICK FILTERS */}
                    <div className="flex flex-wrap gap-1.5 pb-2 border-b border-slate-100 dark:border-amber-500/20">
                      {['all', 'Loyal', 'Returning', 'New', 'High-Risk', 'Dormant'].map(seg => {
                        const count = bi.buyerLeaderboard.filter(b => seg === 'all' || b.segment === seg).length;
                        return (
                          <button
                            key={seg}
                            onClick={() => setBuyerSegmentFilter(seg)}
                            className={cn(
                              "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                              buyerSegmentFilter === seg 
                                ? "bg-[#93000b] dark:bg-amber-500 text-white dark:text-black" 
                                : "bg-slate-100 dark:bg-[#181818] text-gray-500 dark:text-amber-200/70 hover:bg-slate-200 dark:hover:bg-amber-500/20"
                            )}
                          >
                            {seg === 'all' ? 'All Segments' : seg} ({count})
                          </button>
                        );
                      })}
                    </div>

                    {/* TABLE */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-amber-500/20 text-[10px] font-black uppercase text-gray-400 dark:text-amber-400/70">
                            <th className="pb-3 pr-2">Rank</th>
                            <th className="pb-3">Counterparty</th>
                            <th className="pb-3 text-right">Gross Purchase</th>
                            <th className="pb-3 text-right">Quantity (QTLS)</th>
                            <th className="pb-3 text-center">Delay</th>
                            <th className="pb-3">Segment</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-amber-500/10">
                          {bi.buyerLeaderboard
                            .filter(b => buyerSegmentFilter === 'all' || b.segment === buyerSegmentFilter)
                            .filter(b => (b.name || '').toLowerCase().includes((buyerSearchTerm || '').toLowerCase()))
                            .map((buyer, idx) => {
                              const isSelected = selectedScorecardBuyer === buyer.name;
                              return (
                                <tr 
                                  key={buyer.name}
                                  onClick={() => setSelectedScorecardBuyer(buyer.name)}
                                  className={cn(
                                    "hover:bg-slate-50/80 dark:hover:bg-amber-500/10 cursor-pointer transition-all",
                                    isSelected && "bg-slate-50 dark:bg-amber-500/20 font-black border-l-4 border-l-[#93000b] dark:border-l-amber-400"
                                  )}
                                >
                                  <td className="py-3.5 pl-2 text-xs font-black text-gray-400 dark:text-amber-400/60">#{idx + 1}</td>
                                  <td className="py-3.5">
                                    <div className="flex flex-col">
                                      <span className="text-xs font-black text-gray-900 dark:text-amber-100">{buyer.name}</span>
                                      <span className="text-[10px] font-semibold text-gray-400 dark:text-amber-300/60">{buyer.frequency} orders logged</span>
                                    </div>
                                  </td>
                                  <td className="py-3.5 text-right text-xs font-black text-gray-900 dark:text-amber-100">₹{formatINR(buyer.totalPurchases)}</td>
                                  <td className="py-3.5 text-right text-xs font-bold text-gray-600 dark:text-amber-200/80">{buyer.qty.toLocaleString()}</td>
                                  <td className="py-3.5 text-center">
                                    <span className={cn(
                                      "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                      buyer.delay > 40 ? "bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400" : "bg-emerald-50 dark:bg-amber-500/10 text-emerald-600 dark:text-amber-400"
                                    )}>
                                      {buyer.delay} days
                                    </span>
                                  </td>
                                  <td className="py-3.5">
                                    <span className={cn(
                                      "text-[9px] font-black uppercase px-2 py-0.5 rounded-md border",
                                      buyer.segment === 'Loyal' ? "bg-emerald-50 dark:bg-amber-500/10 text-emerald-600 dark:text-amber-300 border-emerald-200 dark:border-amber-500/30" :
                                      buyer.segment === 'High-Risk' ? "bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800 animate-pulse" :
                                      buyer.segment === 'New' ? "bg-blue-50 dark:bg-sky-950 text-blue-600 dark:text-sky-300 border-blue-200 dark:border-sky-800" : "bg-slate-100 dark:bg-[#181818] text-gray-600 dark:text-amber-300/80 border-slate-200 dark:border-amber-500/20"
                                    )}>
                                      {buyer.segment}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* RIGHT: BUYER SCORECARD */}
                  <div className="lg:col-span-5 space-y-6">
                    {scorecardBuyerDetails ? (
                      <div className="bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-200/80 dark:border-amber-500/20 shadow-sm space-y-6 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-[#93000b]/[0.02] rounded-full blur-xl" />
                        
                        {/* Title header */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black text-gray-400 dark:text-amber-400/80 uppercase tracking-widest block">Detailed Profile Scorecard</span>
                          <h3 className="text-xl font-black text-gray-950 dark:text-amber-100 tracking-tight">{scorecardBuyerDetails.name}</h3>
                          
                          <div className="flex flex-wrap gap-2 items-center">
                            <span className={cn(
                              "text-[9px] font-black uppercase px-2 py-0.5 rounded-md border",
                              scorecardBuyerDetails.segment === 'Loyal' ? "bg-emerald-50 dark:bg-amber-500/10 text-emerald-600 dark:text-amber-300 border-emerald-200 dark:border-amber-500/30" :
                              scorecardBuyerDetails.segment === 'High-Risk' ? "bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800" : "bg-slate-100 dark:bg-[#181818] text-gray-600 dark:text-amber-300/80 border-slate-200 dark:border-amber-500/20"
                            )}>
                              {scorecardBuyerDetails.segment} Account
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-amber-300/80 font-bold">Reliability Index: {scorecardBuyerDetails.delay <= 30 ? 'HIGH' : scorecardBuyerDetails.delay <= 45 ? 'AVERAGE' : 'RISK'}</span>
                          </div>
                        </div>

                        {/* Financial metrics block */}
                        <div className="grid grid-cols-2 gap-4 bg-slate-50 dark:bg-[#181818] p-4 rounded-2xl border border-slate-100 dark:border-amber-500/20">
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-black text-gray-400 dark:text-amber-400/80 uppercase">Gross Procurement</span>
                            <h4 className="text-base font-black text-gray-900 dark:text-amber-100">₹{formatINR(scorecardBuyerDetails.totalPurchases)}</h4>
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-[9px] font-black text-gray-400 dark:text-amber-400/80 uppercase">Volume Canalized</span>
                            <h4 className="text-base font-black text-gray-900 dark:text-amber-100">{scorecardBuyerDetails.qty.toLocaleString()} QTLS</h4>
                          </div>
                          <div className="space-y-0.5 pt-2 border-t border-slate-200/60 dark:border-amber-500/10">
                            <span className="text-[9px] font-black text-gray-400 dark:text-amber-400/80 uppercase">Outstanding Balance</span>
                            <h4 className={cn("text-base font-black", scorecardBuyerDetails.outstanding > 0 ? "text-red-600 dark:text-rose-400" : "text-gray-900 dark:text-amber-100")}>
                              ₹{formatINR(scorecardBuyerDetails.outstanding)}
                            </h4>
                          </div>
                          <div className="space-y-0.5 pt-2 border-t border-slate-200/60 dark:border-amber-500/10">
                            <span className="text-[9px] font-black text-gray-400 dark:text-amber-400/80 uppercase">Avg Pay Timeline</span>
                            <h4 className="text-base font-black text-gray-900 dark:text-amber-100">{scorecardBuyerDetails.delay} Days</h4>
                          </div>
                        </div>

                        {/* Preferred variables analysis */}
                        <div className="space-y-3">
                          <h4 className="text-xs font-black text-gray-900 dark:text-amber-100 uppercase tracking-wider">Trading Behavior Analysis</h4>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-xs text-gray-600 dark:text-amber-200/80 font-semibold">
                              <span>Preferred Brand:</span>
                              <span className="font-bold text-gray-900 dark:text-amber-100">{scorecardBuyerTransactions[0]?.brand || 'KK Brand'}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-600 dark:text-amber-200/80 font-semibold">
                              <span>Primary Procuring Area:</span>
                              <span className="font-bold text-gray-900 dark:text-amber-100">{scorecardBuyerTransactions[0]?.placeArea || 'Gadchiroli'}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs text-gray-600 dark:text-amber-200/80 font-semibold">
                              <span>Canvassed Miller Partner:</span>
                              <span className="font-bold text-[#93000b] dark:text-amber-400">{scorecardBuyerTransactions[0]?.millerName || 'Sri Rama Rice Mill'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Custom action guideline */}
                        <div className="p-4 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-amber-500/20 rounded-2xl space-y-1">
                          <div className="flex items-center gap-1.5 text-xs font-black text-[#93000b] dark:text-amber-400 uppercase">
                            <Info className="w-3.5 h-3.5" />
                            Canvassing Strategy Directive
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-amber-200/80 leading-relaxed font-semibold">
                            {scorecardBuyerDetails.segment === 'Loyal' && `Maintain current credit terms at ${scorecardBuyerDetails.delay} days. Lock in pricing contracts directly for winter shipments.`}
                            {scorecardBuyerDetails.segment === 'High-Risk' && `Outstanding balance of ₹${formatINR(scorecardBuyerDetails.outstanding)} is critical. Require a 40% upfront deposit before approving subsequent truck dispatches.`}
                            {scorecardBuyerDetails.segment === 'New' && `Offer introductory credit threshold extension of up to ₹5L to stimulate purchase frequency.`}
                            {(scorecardBuyerDetails.segment === 'Returning' || scorecardBuyerDetails.segment === 'Dormant') && `Engage via direct canvasser call focusing on pricing rebates for HMT or KK Brand.`}
                          </p>
                        </div>

                        {/* Recent transaction list inside scorecard */}
                        <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-amber-500/10">
                          <h4 className="text-xs font-black text-gray-900 dark:text-amber-100 uppercase tracking-wider">Recent Orders Log ({scorecardBuyerTransactions.length})</h4>
                          <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                            {scorecardBuyerTransactions.map(t => (
                              <div key={t.id} className="flex justify-between items-center text-xs bg-slate-50/50 dark:bg-[#181818] p-2.5 rounded-xl border border-slate-100 dark:border-amber-500/15">
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-black text-gray-900 dark:text-amber-100">{t.brand}</span>
                                    <span className="text-[9px] text-gray-400 dark:text-amber-400/60 font-mono">#{t.billNumber}</span>
                                  </div>
                                  <span className="text-[10px] text-gray-400 dark:text-amber-400/60 font-bold">{t.date} | {t.quantity} QTLS</span>
                                </div>
                                <span className="font-black text-gray-900 dark:text-amber-100">₹{formatINR(t.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-[#121212] p-8 rounded-3xl border border-gray-200 dark:border-amber-500/20 text-center text-gray-400 dark:text-amber-400/60 font-bold text-xs">
                        Select a buyer counterparty to load their BI scorecards.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

              {/* ====================================================================== */}
              {/* TAB 3: COMMODITY & MILLER PERFORMANCE */}
              {/* ====================================================================== */}
              {activeTab === 'millers' && (
                <div className="space-y-8">
                  {/* SIMPLE ENGLISH EXPLANATION CARD */}
                  <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/15 rounded-2xl border border-amber-500/20 dark:border-amber-500/30 p-5 flex gap-4 items-start shadow-sm hover:shadow-md transition-all">
                    <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md flex-shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                        💡 Simple Explanation: What does this screen show?
                      </h4>
                      <p className="text-xs text-amber-900/85 dark:text-amber-100/90 leading-relaxed font-semibold">
                        This screen shows where your rice comes from (your suppliers/millers) and which brands of rice are selling the most. It helps you see which miller provides the most rice and which varieties are your absolute best-sellers so you can buy more of them.
                      </p>
                    </div>
                  </div>
                  
                  {/* BRANDS ANALYTICS MATRIX */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Brand Leaderboard & Velocity */}
                    <div className="lg:col-span-7 bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-200/80 dark:border-amber-500/20 shadow-sm space-y-6">
                      <div>
                        <h3 className="text-base font-black text-gray-950 dark:text-amber-100 uppercase tracking-tight">Commodity Brand Analytics Matrix</h3>
                        <p className="text-xs text-gray-400 dark:text-amber-200/70 font-medium">Automatic sorting based on overall purchase volume value.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="bg-slate-50 dark:bg-[#181818] p-4 rounded-2xl border border-slate-100 dark:border-amber-500/20 space-y-1">
                          <span className="text-[9px] font-black text-gray-400 dark:text-amber-400/80 uppercase">Fastest Growing Brand</span>
                          <h4 className="text-sm font-black text-[#93000b] dark:text-amber-400">{bi.brandSales[0]?.name || 'KK Brand'}</h4>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-amber-300/60">Leading Sales Share</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-[#181818] p-4 rounded-2xl border border-slate-100 dark:border-amber-500/20 space-y-1">
                          <span className="text-[9px] font-black text-gray-400 dark:text-amber-400/80 uppercase">Highest Price Corridor</span>
                          <h4 className="text-sm font-black text-gray-900 dark:text-amber-100">
                            {(bi.brandSales.reduce((prev: any, current: any) => ((prev?.avgRate || 0) > (current?.avgRate || 0)) ? prev : current, bi.brandSales[0] || {}) as any)?.name || 'Royal Basmati'}
                          </h4>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-amber-300/60">Premium Rate Profile</span>
                        </div>
                        <div className="bg-slate-50 dark:bg-[#181818] p-4 rounded-2xl border border-slate-100 dark:border-amber-500/20 space-y-1">
                          <span className="text-[9px] font-black text-gray-400 dark:text-amber-400/80 uppercase">Most Consistent Grade</span>
                          <h4 className="text-sm font-black text-gray-900 dark:text-amber-100">HMT Sona</h4>
                          <span className="text-[10px] font-bold text-gray-400 dark:text-amber-300/60">Steady volume inflow</span>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-100 dark:border-amber-500/20 text-[10px] font-black uppercase text-gray-400 dark:text-amber-400/80">
                              <th className="pb-3 pr-2">Brand Catalog</th>
                              <th className="pb-3 text-right">Gross Sales (INR)</th>
                              <th className="pb-3 text-right">Volume (QTLS)</th>
                              <th className="pb-3 text-right">Avg Price / QTL</th>
                              <th className="pb-3 text-right">Market Share</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-amber-500/10">
                            {bi.brandSales.map((brand, idx) => (
                              <tr key={brand.name} className="hover:bg-slate-50/50 dark:hover:bg-amber-500/10 transition-all">
                                <td className="py-3.5">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                    <span className="text-xs font-black text-gray-900 dark:text-amber-100">{brand.name}</span>
                                  </div>
                                </td>
                                <td className="py-3.5 text-right text-xs font-black text-gray-900 dark:text-amber-100">₹{formatINR(brand.revenue)}</td>
                                <td className="py-3.5 text-right text-xs font-bold text-gray-600 dark:text-amber-200/80">{brand.qty.toLocaleString()} QTLS</td>
                                <td className="py-3.5 text-right text-xs font-bold text-gray-600 dark:text-amber-200/80">₹{formatINR(brand.avgRate)}</td>
                                <td className="py-3.5 text-right text-xs font-black text-[#93000b] dark:text-amber-400">{brand.pct}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Miller Performance Matrix */}
                    <div className="lg:col-span-5 bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-200/80 dark:border-amber-500/20 shadow-sm space-y-6">
                      <div>
                        <h3 className="text-base font-black text-gray-950 dark:text-amber-100 uppercase tracking-tight">Miller Performance Matrix</h3>
                        <p className="text-xs text-gray-400 dark:text-amber-200/70 font-medium">Rankings by volume dispatch capacity and active buyer count.</p>
                      </div>

                      <div className="space-y-3">
                        {bi.millerPerformance.map((miller, idx) => (
                          <div key={miller.name} className="p-4 bg-slate-50/60 dark:bg-[#181818] rounded-2xl border border-slate-100 dark:border-amber-500/20 space-y-2 hover:bg-slate-50 dark:hover:bg-amber-500/10 transition-all">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-gray-400 dark:text-amber-400/60">#{idx + 1}</span>
                                <span className="text-xs font-black text-gray-900 dark:text-amber-100">{miller.name}</span>
                              </div>
                              <span className="text-[10px] font-black text-[#93000b] dark:text-amber-400 bg-[#93000b]/5 dark:bg-amber-500/10 px-2 py-0.5 rounded">
                                {miller.repeatBuyers} Buyer Accounts
                              </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-slate-200/50 dark:border-amber-500/10">
                              <div className="space-y-0.5">
                                <span className="text-[9px] font-bold text-gray-400 dark:text-amber-400/80 uppercase">Gross Sales</span>
                                <p className="text-xs font-black text-gray-900 dark:text-amber-100">₹{formatINR(miller.revenue)}</p>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-[9px] font-bold text-gray-400 dark:text-amber-400/80 uppercase">Dispatched</span>
                                <p className="text-xs font-bold text-gray-600 dark:text-amber-200/80">{miller.qty.toLocaleString()} QTL</p>
                              </div>
                              <div className="space-y-0.5">
                                <span className="text-[9px] font-bold text-gray-400 dark:text-amber-400/80 uppercase">Avg rate</span>
                                <p className="text-xs font-bold text-gray-600 dark:text-amber-200/80">₹{formatINR(miller.avgRate)}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ====================================================================== */}
              {/* TAB 4: PRICING & PAYMENT INTELLIGENCE */}
              {/* ====================================================================== */}
              {activeTab === 'pricing' && (
                <div className="space-y-8">
                  {/* SIMPLE ENGLISH EXPLANATION CARD */}
                  <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/15 rounded-2xl border border-amber-500/20 dark:border-amber-500/30 p-5 flex gap-4 items-start shadow-sm hover:shadow-md transition-all">
                    <div className="p-2.5 bg-amber-500 text-black rounded-xl shadow-md flex-shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                        💡 Simple Explanation: What does this screen show?
                      </h4>
                      <p className="text-xs text-amber-900/85 dark:text-amber-100/90 leading-relaxed font-semibold">
                        This screen shows how cash is flowing through your business. You can see the cash that is cleared and ready to use versus the money that is still pending or delayed. The charts group your orders by their selling rates and show which regional areas consume the most rice.
                      </p>
                    </div>
                  </div>
                  
                  {/* PRICING ANALYSIS BANNER */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Price Range Distribution */}
                    <div className="lg:col-span-8 bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-200/80 dark:border-amber-500/20 shadow-sm space-y-6">
                      <div>
                        <h3 className="text-base font-black text-gray-950 dark:text-amber-100 uppercase tracking-tight">Rate Corridor & Order Frequency</h3>
                        <p className="text-xs text-gray-400 dark:text-amber-200/70 font-medium">Number of major billing arrivals grouped by rate corridors (₹/Qtl).</p>
                      </div>

                      <div className="h-64 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} initialDimension={{ width: 300, height: 200 }}>
                          <BarChart data={bi.priceDistribution}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                            <XAxis dataKey="range" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#d0c5af' }} dy={8} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#d0c5af' }} allowDecimals={false} />
                            <Tooltip cursor={{ fill: '#1f1f1f' }} contentStyle={{ backgroundColor: '#181818', borderColor: '#333', color: '#f2ca50', borderRadius: '12px' }} />
                            <Bar dataKey="count" fill="#f2ca50" radius={[4, 4, 0, 0]} barSize={44} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Price Volatility & Place Analysis */}
                    <div className="lg:col-span-4 bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-200/80 dark:border-amber-500/20 shadow-sm space-y-6">
                      <div className="space-y-1">
                        <h3 className="text-base font-black text-gray-950 dark:text-amber-100 uppercase tracking-tight">Pricing Intelligence</h3>
                        <p className="text-xs text-gray-400 dark:text-amber-200/70 font-medium">Statistical variance and market volatility indicators.</p>
                      </div>

                      <div className="bg-slate-50 dark:bg-[#181818] p-5 rounded-2xl border border-slate-100 dark:border-amber-500/20 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500 dark:text-amber-200/70">Volatility Index:</span>
                          <span className="text-xs font-black text-[#93000b] dark:text-amber-400 bg-[#93000b]/5 dark:bg-amber-500/10 px-2.5 py-0.5 rounded-full">
                            ±₹{bi.priceVolatility} / QTL
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500 dark:text-amber-200/70">Average Rate:</span>
                          <span className="text-xs font-black text-gray-900 dark:text-amber-100">₹{formatINR(bi.avgSellingPrice)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500 dark:text-amber-200/70">Fastest Settlement:</span>
                          <span className="text-xs font-black text-emerald-600 dark:text-amber-400">{bi.paymentStats.fastestPaying}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-500 dark:text-amber-200/70">Longest Settlement Delay:</span>
                          <span className="text-xs font-black text-rose-600 dark:text-rose-400 truncate max-w-[150px]">{bi.paymentStats.slowestPaying}</span>
                        </div>
                      </div>

                      <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 rounded-2xl flex gap-3 items-start">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <span className="text-xs font-black text-amber-800 dark:text-amber-200 uppercase tracking-wider block">Margin Volatility Warning</span>
                          <p className="text-[11px] text-amber-700 dark:text-amber-100/90 leading-relaxed font-semibold">
                            With volatility index at ₹{bi.priceVolatility}, rate spreads across direct mill purchase are wide. Pre-sell orders only when mill backing rates are locked.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* REGIONAL MARKET CONCENTRATION */}
                  <div className="bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-200/80 dark:border-amber-500/20 shadow-sm space-y-4">
                    <div>
                      <h3 className="text-base font-black text-gray-950 dark:text-amber-100 uppercase tracking-tight">Regional Market Concentration (Place / Area)</h3>
                      <p className="text-xs text-gray-400 dark:text-amber-200/70 font-medium">Bento performance rankings across regional rice consumption areas.</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {bi.regionalAnalysis.map((reg, idx) => (
                        <div key={reg.area} className="p-4 bg-slate-50 dark:bg-[#181818] hover:bg-slate-100/50 dark:hover:bg-amber-500/10 rounded-2xl border border-slate-200/60 dark:border-amber-500/20 flex flex-col justify-between gap-4 transition-all">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-gray-900 dark:text-amber-100 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[#93000b] dark:text-amber-400" /> {reg.area}
                            </span>
                            <span className="text-[10px] text-gray-400 dark:text-amber-400/60 font-bold">Rank #{idx+1}</span>
                          </div>

                          <div className="space-y-1">
                            <span className="text-[9px] font-black text-gray-400 dark:text-amber-400/80 uppercase">Gross Sales Invoiced</span>
                            <h4 className="text-lg font-black text-gray-950 dark:text-amber-100">₹{formatINR(reg.revenue)}</h4>
                            <div className="flex justify-between items-center text-[10px] text-gray-400 dark:text-amber-300/80 font-bold pt-1 border-t border-slate-200/40 dark:border-amber-500/10">
                              <span>Volume Sold:</span>
                              <span className="font-semibold text-gray-700 dark:text-amber-200">{reg.qty.toLocaleString()} QTLS</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-gray-400 dark:text-amber-300/80 font-bold">
                              <span>Avg Pricing Rate:</span>
                              <span className="font-semibold text-gray-700 dark:text-amber-200">₹{formatINR(reg.avgRate)}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-gray-400 dark:text-amber-300/80 font-bold">
                              <span>Active Buyer Accounts:</span>
                              <span className="font-semibold text-[#93000b] dark:text-amber-400">{reg.buyersCount}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ====================================================================== */}
              {/* TAB 5: FORECASTING & RISKS */}
              {/* ====================================================================== */}
              {activeTab === 'forecasting' && (
                <div className="space-y-8">
                  {/* SIMPLE ENGLISH EXPLANATION CARD */}
                  <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 dark:from-amber-500/20 dark:to-orange-500/15 rounded-2xl border border-amber-500/20 dark:border-amber-500/30 p-5 flex gap-4 items-start shadow-sm hover:shadow-md transition-all">
                    <div className="p-2.5 bg-amber-500 text-black rounded-xl shadow-md flex-shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-amber-950 dark:text-amber-200 uppercase tracking-wider flex items-center gap-1.5">
                        💡 Simple Explanation: What does this screen show?
                      </h4>
                      <p className="text-xs text-amber-900/85 dark:text-amber-100/90 leading-relaxed font-semibold">
                        This screen estimates your future sales and highlights any credit risks (like late payments). It predicts what your sales might look like next month based on past trends, and flags which bills are past their due dates so you can contact those buyers.
                      </p>
                    </div>
                  </div>
                  
                  {/* FORECAST METRICS BLOCK */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    
                    {/* Timeline forecast line graph */}
                    <div className="lg:col-span-8 bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-200/80 dark:border-amber-500/20 shadow-sm space-y-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-base font-black text-gray-950 dark:text-amber-100 uppercase tracking-tight">Revenue Timeline & August Projection</h3>
                          <p className="text-xs text-gray-400 dark:text-amber-200/70 font-medium italic">Predictive projection using seasonal linear-weighted calculations.</p>
                        </div>
                        <span className="text-[10px] font-black text-[#93000b] dark:text-amber-400 bg-[#93000b]/5 dark:bg-amber-500/10 px-3 py-1 rounded-full uppercase border border-[#93000b]/10 dark:border-amber-500/20 animate-pulse">
                          Predictive Model Active
                        </span>
                      </div>

                      <div className="h-64 w-full min-w-0">
                        <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} initialDimension={{ width: 300, height: 200 }}>
                          <AreaChart data={bi.forecast.timeline}>
                            <defs>
                              <linearGradient id="gradientFC" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#f2ca50" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#f2ca50" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#262626" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#d0c5af' }} dy={8} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 700, fill: '#d0c5af' }} tickFormatter={v => `₹${v >= 100000 ? (v/100000).toFixed(1)+'L' : v}`} />
                            <Tooltip formatter={v => `₹ ${formatINR(Number(v))}`} contentStyle={{ backgroundColor: '#181818', borderColor: '#333', color: '#f2ca50', borderRadius: '12px' }} />
                            <Area type="monotone" dataKey="revenue" stroke="#f2ca50" strokeWidth={3} fillOpacity={1} fill="url(#gradientFC)" strokeDasharray="5 5" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    {/* Forecast KPI cards */}
                    <div className="lg:col-span-4 bg-white dark:bg-[#121212] p-6 rounded-3xl border border-gray-200/80 dark:border-amber-500/20 shadow-sm space-y-4">
                      <h3 className="text-base font-black text-gray-950 dark:text-amber-100 uppercase tracking-tight">{bi.forecast.nextMonthName} Metrics Projections</h3>
                      
                      <div className="space-y-3">
                        {/* Expected Sales */}
                        <div className="p-3.5 bg-slate-50 dark:bg-[#181818] rounded-2xl border border-slate-100 dark:border-amber-500/20 space-y-1">
                          <span className="text-[9px] font-black text-gray-400 dark:text-amber-400/80 uppercase">Projected Sales Volume</span>
                          <h4 className="text-base font-black text-gray-900 dark:text-amber-100">₹{formatINR(bi.forecast.expectedRevenue)}</h4>
                          <span className="text-[10px] text-gray-400 dark:text-amber-300/60 font-bold">Confidence interval: ₹{formatINR(bi.forecast.expectedRevenueConfidence[0])} - ₹{formatINR(bi.forecast.expectedRevenueConfidence[1])}</span>
                        </div>

                        {/* Expected Quantity */}
                        <div className="p-3.5 bg-slate-50 dark:bg-[#181818] rounded-2xl border border-slate-100 dark:border-amber-500/20 space-y-1">
                          <span className="text-[9px] font-black text-gray-400 dark:text-amber-400/80 uppercase">Projected Quantity QTLS</span>
                          <h4 className="text-base font-black text-gray-900 dark:text-amber-100">{bi.forecast.expectedQuantity.toLocaleString()} QTLS</h4>
                          <span className="text-[10px] text-gray-400 dark:text-amber-300/60 font-bold">Confidence interval: {bi.forecast.expectedQuantityConfidence[0]} - {bi.forecast.expectedQuantityConfidence[1]} QTLS</span>
                        </div>

                        {/* Expected Rate */}
                        <div className="p-3.5 bg-slate-50 dark:bg-[#181818] rounded-2xl border border-slate-100 dark:border-amber-500/20 space-y-1">
                          <span className="text-[9px] font-black text-gray-400 dark:text-amber-400/80 uppercase">Projected Weighted Rate</span>
                          <h4 className="text-base font-black text-gray-900 dark:text-amber-100">₹{formatINR(bi.forecast.expectedRate)} / QTL</h4>
                          <span className="text-[10px] text-gray-400 dark:text-amber-300/60 font-bold">Confidence interval: ₹{bi.forecast.expectedRateConfidence[0]} - ₹{bi.forecast.expectedRateConfidence[1]}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* RISK MONITOR PANEL */}
                  <div className="bg-white dark:bg-[#121212] rounded-3xl border border-gray-200 dark:border-amber-500/20 p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-5 h-5 text-red-600 dark:text-rose-400 animate-pulse" />
                      <h3 className="text-base font-black text-gray-950 dark:text-amber-100 uppercase tracking-tight">Active Enterprise Risk Radar</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {/* Risk 1 */}
                      <div className="p-4 bg-rose-50/20 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 rounded-2xl space-y-3">
                        <span className="text-[9px] font-black uppercase text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800">Payment default risk</span>
                        <h4 className="text-xs font-black text-gray-900 dark:text-amber-100">High Credit Aging Delay Detected</h4>
                        <p className="text-[11px] text-gray-500 dark:text-amber-200/70 font-semibold leading-relaxed">
                          Consolidated cash flow shows that slow paying counterparties are average delaying payment dates to {bi.avgPaymentCollectionTime} days. This puts operational capital at risk.
                        </p>
                        <p className="text-[10px] text-[#93000b] dark:text-amber-400 italic font-semibold pt-1 border-t border-rose-100 dark:border-rose-900/30">
                          Rec: Set maximum credit limits at 30 days and enforce check payments.
                        </p>
                      </div>

                      {/* Risk 2 */}
                      <div className="p-4 bg-amber-50/20 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl space-y-3">
                        <span className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800">Revenue Concentration Risk</span>
                        <h4 className="text-xs font-black text-gray-900 dark:text-amber-100">Single Brand Domination Warning</h4>
                        <p className="text-[11px] text-gray-500 dark:text-amber-200/70 font-semibold leading-relaxed">
                          {bi.brandSales[0]?.name || 'KK Brand'} catalog accounts for {bi.brandSales[0]?.pct || 40}% of net procurement revenue, creating heavy reliance on single miller dispatches.
                        </p>
                        <p className="text-[10px] text-[#93000b] dark:text-amber-400 italic font-semibold pt-1 border-t border-amber-100 dark:border-amber-900/30">
                          Rec: Increase canvassing efforts for HMT Sona and Royal Basmati catalogs.
                        </p>
                      </div>

                      {/* Risk 3 */}
                      <div className="p-4 bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-amber-500/20 rounded-2xl space-y-3">
                        <span className="text-[9px] font-black uppercase text-gray-700 dark:text-amber-300 bg-slate-100 dark:bg-amber-500/10 px-2 py-0.5 rounded border border-slate-300 dark:border-amber-500/20">Price Volatility Risk</span>
                        <h4 className="text-xs font-black text-gray-900 dark:text-amber-100">Regional Rate Corridor Spread Wide</h4>
                        <p className="text-[11px] text-gray-500 dark:text-amber-200/70 font-semibold leading-relaxed">
                          Rate corridor spreads span up to ₹{bi.priceVolatility} per QTL between northern Gondia millers and local Nagpur warehouses, compressing net broker margins.
                        </p>
                        <p className="text-[10px] text-gray-600 dark:text-amber-300 italic font-semibold pt-1 border-t border-slate-200 dark:border-amber-500/20">
                          Rec: Establish forward dispatch rate locking with key suppliers.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
