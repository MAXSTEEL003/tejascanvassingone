import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  PhoneCall,
  Building2,
  Truck,
  FileText,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Search,
  Filter,
  Check,
  CheckCheck,
  Info,
  X,
  ChevronRight,
  RefreshCw,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  ChevronDown,
  Radio,
  FileCheck,
  ShieldCheck,
  Printer,
  Copy,
  Layers,
  Sparkles,
  Phone,
  Calendar,
  MapPin
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR, getRegisteredSuppliers } from '../lib/utils';
import { getCollectionDocs, setCollectionDoc, subscribeCollectionDocs } from '../lib/firebase';
import { resolveSupplierProfile, printPoDocument } from '../utils/poEmailTemplate';
import { resolveSubOrderNumber, resolveGroupedPoNumber } from '../utils/orderOperations';

export interface MillerUpdateItem {
  id: string;
  type: 'BILL_UPLOADED' | 'TRUCK_LOADED' | 'PO_ACCEPTED';
  poNumber: string;
  subOrderNo?: string;
  buyerName?: string;
  billNo?: string;
  billUrl?: string;
  fileName?: string;
  millerName: string;
  vehicleNumber?: string;
  driverPhone?: string;
  weighbridgeSlip?: string;
  loadedQuantity?: number;
  loadingDate?: string;
  loadingNumber?: string;
  loadingId?: string;
  status?: string;
  timestamp: string; // ISO string
  read?: boolean;
  createdAt?: string;
  rawPayload?: any;
}

export interface ChatMessage {
  id: string;
  millName: string;
  sender: 'tejas' | 'hq' | 'miller' | 'system';
  senderName: string;
  type: 'text' | 'po' | 'ack' | 'reverse_ack' | 'dispatch' | 'bill' | 'system';
  text?: string;
  poId?: string;
  timestamp: string; // ISO string
  poData?: any;
  vehicleNo?: string;
  driverPhone?: string;
  dispatchDate?: string;
  dispatchNotes?: string;
  loadedQuantity?: number;
  weighbridgeSlip?: string;
  loadingNumber?: string;
  billNo?: string;
  subOrderNo?: string;
  buyerName?: string;
  photoUrl?: string;
  subBills?: Array<{ buyer: string; billNo: string; photoUrl: string }>;
  status?: 'sent' | 'delivered' | 'read';
}

/**
 * Format timestamp strictly as DD/MM/YYYY hh:mm A
 */
function formatDateTime(dateVal: any): string {
  if (!dateVal) return '--';
  try {
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return String(dateVal);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${day}/${month}/${year} ${strHours}:${minutes} ${ampm}`;
  } catch {
    return String(dateVal);
  }
}

/**
 * Resolves relative URLs (e.g. from App B / Keshar Kali) to complete accessible URLs
 */
function resolveBillDocumentUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  const appBBase = 'https://kesharkali.vercel.app';
  return `${appBBase}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
}

export interface ResolvedSubOrder {
  subOrderNo: string;
  buyerName: string;
  productName: string;
  quantity: number;
  rate: number;
  amount: number;
  unloadingPoint: string;
  billNo?: string;
  billUrl?: string;
  status: string;
}

/**
 * Robust date parser converting diverse formats ("2026-11-21", "21-Nov-2026", "21/11/2026", Timestamps) to epoch ms
 */
export function parseDateToTime(val: any): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'object') {
    if (typeof val.toDate === 'function') {
      try {
        const d = val.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d.getTime();
      } catch {}
    }
    if (typeof val.seconds === 'number') {
      return val.seconds * 1000;
    }
  }

  const str = String(val).trim();
  if (!str) return 0;

  // 1. DD-MMM-YYYY or DD/MMM/YYYY e.g. "21-Nov-2026", "09-Nov-2026"
  const dMmmYMatch = str.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})$/i);
  if (dMmmYMatch) {
    const months: Record<string, number> = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const day = parseInt(dMmmYMatch[1], 10);
    const mStr = dMmmYMatch[2].toLowerCase();
    const mIdx = months[mStr];
    let yr = parseInt(dMmmYMatch[3], 10);
    if (yr < 100) yr += 2000;
    if (mIdx !== undefined && !isNaN(day) && !isNaN(yr)) {
      return new Date(yr, mIdx, day, 12, 0, 0).getTime();
    }
  }

  // 2. YYYY-MM-DD or YYYY-MM-DD HH:mm:ss
  const ymdMatch = str.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const [, y, m, d] = ymdMatch.map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).getTime();
  }

  // 3. DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch.map(Number);
    return new Date(y, m - 1, d, 12, 0, 0).getTime();
  }

  const parsed = new Date(str).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Returns formatted PO Placed date string and timestamp for chronological sorting
 */
export function getPlacedDateInfo(item: MillerUpdateItem, matchedOrder?: any): {
  placedDateStr: string;
  timestampMs: number;
} {
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const formatMs = (ms: number) => {
    const d = new Date(ms);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = MONTHS[d.getMonth()] || 'Nov';
    const yr = d.getFullYear();
    return `${day}-${mon}-${yr}`;
  };

  // 1. Matched Order placed date from App A
  if (matchedOrder?.date) {
    const ms = parseDateToTime(matchedOrder.date);
    if (ms > 0) return { placedDateStr: formatMs(ms), timestampMs: ms };
  }

  // 2. Raw payload poDate from App B
  const rawDate = item.rawPayload?.poDate || item.rawPayload?.order_date || item.rawPayload?.po_date || item.rawPayload?.orderDate || item.rawPayload?.orderAcceptanceDate;
  if (rawDate) {
    const ms = parseDateToTime(rawDate);
    if (ms > 0) return { placedDateStr: formatMs(ms), timestampMs: ms };
  }

  // 3. Matched order createdAt
  if (matchedOrder?.createdAt) {
    const ms = parseDateToTime(matchedOrder.createdAt);
    if (ms > 0) return { placedDateStr: formatMs(ms), timestampMs: ms };
  }

  // 4. Item timestamp fallback
  const fallbackMs = parseDateToTime(item.timestamp || item.createdAt);
  if (fallbackMs > 0) {
    return { placedDateStr: formatMs(fallbackMs), timestampMs: fallbackMs };
  }

  return { placedDateStr: '--', timestampMs: 0 };
}

/**
 * Resolves all constituent sub-orders for a PO
 */
export function getSubOrdersForPO(item: MillerUpdateItem, matchedOrder?: any): ResolvedSubOrder[] {
  // 1. Check matchedOrder.originalOrders
  if (matchedOrder && Array.isArray(matchedOrder.originalOrders) && matchedOrder.originalOrders.length > 0) {
    return matchedOrder.originalOrders.map((so: any, idx: number) => {
      const subNo = so.supplierSubOrderNo || so.subOrderNo || resolveSubOrderNumber(so, idx, matchedOrder.supplier || item.millerName);
      const qty = parseFloat(so.qty) || parseFloat(so.totalQty) || 0;
      const rate = parseFloat(so.rate) || 0;
      const amount = parseFloat(so.amount) || parseFloat(so.totalAmount) || Math.round(qty * rate);
      return {
        subOrderNo: subNo || `SUB-${idx + 1}`,
        buyerName: String(so.buyer || matchedOrder.buyer || item.buyerName || 'Consignee').trim(),
        productName: String(so.product || matchedOrder.product || 'Rice Brand').trim(),
        quantity: qty,
        rate,
        amount,
        unloadingPoint: String(so.unloadingPoint || so.destination || matchedOrder.destination || 'shop').trim(),
        billNo: so.actualSupplierBillNo || so.billNo || item.billNo || undefined,
        billUrl: so.billUrl || so.billPhotoUrl || item.billUrl || undefined,
        status: so.status || item.status || 'Accepted',
      };
    });
  }

  // 2. Check item.rawPayload.subOrders
  const rawSubs = item.rawPayload?.subOrders || item.rawPayload?.sub_orders;
  if (Array.isArray(rawSubs) && rawSubs.length > 0) {
    return rawSubs.map((so: any, idx: number) => {
      const subNo = so.subOrderNo || so.sub_order_no || resolveSubOrderNumber(so, idx, item.millerName);
      const qty = parseFloat(so.orderedQuantity ?? so.ordered_quantity ?? so.qty ?? 0);
      const rate = parseFloat(so.rate || 0);
      const amount = parseFloat(so.amount || Math.round(qty * rate) || 0);
      return {
        subOrderNo: subNo || `SUB-${idx + 1}`,
        buyerName: String(so.buyerName || so.buyer_name || item.buyerName || 'Consignee').trim(),
        productName: String(so.productName || so.product_name || 'Rice Brand').trim(),
        quantity: qty,
        rate,
        amount,
        unloadingPoint: String(so.deliveryLocation || so.delivery_location || so.unloadingPoint || 'shop').trim(),
        billNo: so.billNo || so.bill_no || item.billNo || undefined,
        billUrl: so.billUrl || so.bill_url || item.billUrl || undefined,
        status: so.status || item.status || 'Accepted',
      };
    });
  }

  // 3. Fallback to single sub-order
  const singleQty = matchedOrder?.totalVolume || matchedOrder?.qty || item.loadedQuantity || item.rawPayload?.orderedQuantity || 0;
  const singleRate = matchedOrder?.rate || item.rawPayload?.agreedRate || 0;
  return [{
    subOrderNo: item.subOrderNo || matchedOrder?.subOrderNo || `SUB-01`,
    buyerName: item.buyerName || matchedOrder?.buyer || 'Authorized Consignee',
    productName: matchedOrder?.product || item.rawPayload?.productName || 'Rice Brand',
    quantity: parseFloat(singleQty) || 0,
    rate: parseFloat(singleRate) || 0,
    amount: Math.round((parseFloat(singleQty) || 0) * (parseFloat(singleRate) || 0)),
    unloadingPoint: matchedOrder?.destination || 'shop',
    billNo: item.billNo || matchedOrder?.billNo || undefined,
    billUrl: item.billUrl || matchedOrder?.billUrl || undefined,
    status: item.status || 'Accepted',
  }];
}

export default function MillerUpdatesView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active view mode: 'stream' (Real-time Ingest Feed) vs 'chat' (Miller Chat Desk)
  const [activeTab, setActiveTab] = useState<'stream' | 'chat'>('stream');

  // Miller Ingest Feed State
  // Standalone updates stream for Miller Updates (App B feed)
  const [rawUpdates, setRawUpdates] = useState<MillerUpdateItem[]>(() => {
    try {
      const cached = localStorage.getItem('miller_updates');
      if (cached) {
        const parsed = JSON.parse(cached);
        const filtered = (parsed || []).filter(
          (u: any) => u && u.poNumber !== 'TC-5693' && !u.poNumber?.includes('5693')
        );
        return filtered.sort((a: any, b: any) => {
          const timeA = getPlacedDateInfo(a).timestampMs;
          const timeB = getPlacedDateInfo(b).timestampMs;
          if (timeB !== timeA) return timeB - timeA;
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });
      }
    } catch {}
    return [];
  });
  // Placed orders loaded strictly to display rich PO details in Mill Chat Desk and cross-link App B acceptances
  const [orders, setOrders] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem('placed_orders');
      if (cached) {
        return JSON.parse(cached) || [];
      }
    } catch {}
    return [];
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(true);
  const [isSyncingAppB, setIsSyncingAppB] = useState(false);

  // Filters for Activity Stream
  const [streamFilter, setStreamFilter] = useState<'all' | 'bills' | 'loadings' | 'acceptances'>('all');
  const [streamSearch, setStreamSearch] = useState('');
  const [selectedMillerFilter, setSelectedMillerFilter] = useState<string>('all');

  // In-App Bill Preview Modal
  const [viewingBillModal, setViewingBillModal] = useState<{
    isOpen: boolean;
    billUrl: string;
    billNo?: string;
    fileName?: string;
    poNumber?: string;
    subOrderNo?: string;
    buyerName?: string;
    millerName?: string;
    timestamp?: string;
  } | null>(null);

  const [billZoom, setBillZoom] = useState(1);
  const [billRotation, setBillRotation] = useState(0);

  // Chat state
  const [customMessages, setCustomMessages] = useState<ChatMessage[]>([]);
  const [selectedMillName, setSelectedMillName] = useState<string>('');
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatStatusFilter, setChatStatusFilter] = useState<'all' | 'needs_ack' | 'dispatched' | 'has_bill'>('all');
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  // Helper: Normalize supplier name for reliable matching
  const normalizeSupplier = (name: string) => {
    return (name || '')
      .trim()
      .toUpperCase()
      .replace(/\s*\(LLC\)/gi, '')
      .replace(/RICE\s*(MILL|MILLS|AND|AGRO|INDUSTRIES|ENTERPRISES|PVT|LTD|CORP)*/gi, '')
      .replace(/[^A-Z0-9]/g, '');
  };

  // Helper to filter out synthetic test data (e.g., test order TC-5693)
  const filterOutTestData = (list: MillerUpdateItem[]): MillerUpdateItem[] => {
    return (list || []).filter(
      u => u && u.poNumber !== 'TC-5693' && !u.poNumber?.includes('5693') && !u.id?.includes('5693')
    );
  };

  // Fetch updates from backend API & local cache
  const fetchBackendUpdates = async () => {
    try {
      const res = await fetch('/api/integration/miller-updates');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.updates)) {
          const cleaned = filterOutTestData(data.updates);
          if (cleaned.length > 0) {
            setRawUpdates(prev => {
              const map = new Map<string, MillerUpdateItem>();
              prev.forEach(u => map.set(u.id, u));
              cleaned.forEach(u => map.set(u.id, u));
              const merged = filterOutTestData(Array.from(map.values())).sort((a, b) => {
                const timeA = getPlacedDateInfo(a).timestampMs;
                const timeB = getPlacedDateInfo(b).timestampMs;
                if (timeB !== timeA) return timeB - timeA;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
              });
              localStorage.setItem('miller_updates', JSON.stringify(merged));
              return merged;
            });
            if (typeof data.unreadCount === 'number') {
              localStorage.setItem('miller_updates_unread_count', String(data.unreadCount));
            }
            window.dispatchEvent(new CustomEvent('miller-updates-changed'));
          }
        }
      }
    } catch (err) {
      console.warn('Backend miller-updates poll notice:', err);
    }
  };

  // Sync accepted orders, loadings, and bills from App B (Keshar Kali Supplier Portal)
  // Implements dual-channel sync (Server endpoint + Direct CORS client fallback)
  const triggerAppBSync = async (isManual = false) => {
    try {
      if (isManual) setIsSyncingAppB(true);

      let syncedCount = 0;
      let loadingsCount = 0;
      let billsCount = 0;

      // 1. Attempt backend proxy sync first
      try {
        const res = await fetch('/api/integration/sync-app-b', { method: 'POST' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            syncedCount = data.countAccepted || 0;
            loadingsCount = data.countLoadings || 0;
            billsCount = data.countBills || 0;
            await fetchBackendUpdates();
          }
        }
      } catch (e) {
        console.warn('Backend sync route notice, proceeding with direct client-side sync:', e);
      }

      // 2. Direct client-side sync (App B kesharkali.vercel.app has Access-Control-Allow-Origin: *)
      try {
        const appBUrl = 'https://kesharkali.vercel.app';
        const poRes = await fetch(`${appBUrl}/api/purchase-orders`);
        if (poRes.ok) {
          const poData = await poRes.json();
          const pos = (poData?.purchaseOrders || []).filter(
            (p: any) => p && p.po_number && p.po_number !== 'TC-5693' && !p.po_number.includes('5693')
          );

          const clientUpdates: MillerUpdateItem[] = [];
          for (const po of pos) {
            if (po.is_accepted === 1) {
              const poNumber = String(po.po_number).trim();
              const updateId = `appb_accept_${poNumber}`;
              const millerName =
                po.notes && po.notes.includes('Supplier:')
                  ? po.notes.split('Supplier:')[1].trim()
                  : 'Bhagwathi Rice and Agro Industries';
              const buyerName = po.customer_name || po.customer_name_text || 'Authorized Consignee';
              const updateRecord: MillerUpdateItem = {
                id: updateId,
                type: 'PO_ACCEPTED',
                poNumber,
                subOrderNo: po.sub_order_no || undefined,
                buyerName,
                millerName,
                status: 'Accepted',
                timestamp: po.accepted_at || po.updated_at || po.created_at || new Date().toISOString(),
                read: false,
                createdAt: new Date().toISOString(),
                rawPayload: {
                  source: 'APP_B_DIRECT_SYNC',
                  appB_poId: po.id,
                  customerName: buyerName,
                  orderedQuantity: po.ordered_quantity,
                  productName: po.product_name,
                  subOrders: po.sub_orders || [],
                },
              };
              clientUpdates.push(updateRecord);

              // Non-blocking Firestore persistence
              setCollectionDoc('miller_updates', updateRecord.id, updateRecord).catch(() => {});
            }
          }

          if (clientUpdates.length > 0) {
            syncedCount = Math.max(syncedCount, clientUpdates.length);
            setRawUpdates(prev => {
              const map = new Map<string, MillerUpdateItem>();
              prev.forEach(u => map.set(u.id, u));
              clientUpdates.forEach(u => map.set(u.id, u));
              const merged = filterOutTestData(Array.from(map.values())).sort((a, b) => {
                const timeA = getPlacedDateInfo(a).timestampMs;
                const timeB = getPlacedDateInfo(b).timestampMs;
                if (timeB !== timeA) return timeB - timeA;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
              });
              localStorage.setItem('miller_updates', JSON.stringify(merged));
              return merged;
            });
            window.dispatchEvent(new CustomEvent('miller-updates-changed'));
          }
        }
      } catch (clientErr) {
        console.warn('Direct client-side PO fetch notice:', clientErr);
      }

      // 3. Direct client-side fetch for loadings from App B
      try {
        const loadRes = await fetch('https://kesharkali.vercel.app/api/loading-register');
        if (loadRes.ok) {
          const loadData = await loadRes.json();
          const loadings = loadData?.loadingEntries || [];
          for (const item of loadings) {
            const poNumber = String(item.po_number || item.poNumber || '').trim();
            if (!poNumber || poNumber === 'TC-5693' || poNumber.includes('5693')) continue;
            loadingsCount++;
            const updateRecord: MillerUpdateItem = {
              id: `appb_load_${item.id || Date.now()}`,
              type: 'TRUCK_LOADED',
              poNumber,
              subOrderNo: item.sub_order_no || item.subOrderNo,
              vehicleNumber: item.vehicle_number || item.vehicleNumber,
              driverPhone: item.driver_phone || item.driverPhone,
              weighbridgeSlip: item.weighbridge_slip || item.weighbridgeSlip,
              loadedQuantity: parseFloat(item.loaded_quantity || item.quantity) || 0,
              loadingDate: item.loading_date,
              loadingNumber: item.loading_number,
              millerName: item.supplier_name || 'Bhagwathi Rice and Agro Industries',
              buyerName: item.customer_name || item.buyer_name,
              timestamp: item.created_at || new Date().toISOString(),
              read: false,
              createdAt: new Date().toISOString(),
              rawPayload: item,
            };
            setRawUpdates(prev => {
              const map = new Map(prev.map(u => [u.id, u]));
              map.set(updateRecord.id, updateRecord);
              return Array.from(map.values());
            });
            setCollectionDoc('miller_updates', updateRecord.id, updateRecord).catch(() => {});
          }
        }
      } catch {}

      // 4. Direct client-side fetch for documents / bills from App B
      try {
        const docRes = await fetch('https://kesharkali.vercel.app/api/documents');
        if (docRes.ok) {
          const docData = await docRes.json();
          const docs = docData?.documents || [];
          for (const d of docs) {
            const poNumber = String(d.po_number || d.poNumber || '').trim();
            if (!poNumber || poNumber === 'TC-5693' || poNumber.includes('5693')) continue;
            billsCount++;
            const updateRecord: MillerUpdateItem = {
              id: `appb_bill_${d.id || Date.now()}`,
              type: 'BILL_UPLOADED',
              poNumber,
              subOrderNo: d.sub_order_no || d.subOrderNo,
              billNo: d.bill_no || d.billNo,
              billUrl: d.file_url || d.billUrl || d.url,
              fileName: d.file_name || d.fileName || `mill_bill_${d.bill_no || 'doc'}.pdf`,
              buyerName: d.customer_name || d.buyerName,
              millerName: d.supplier_name || 'Bhagwathi Rice and Agro Industries',
              timestamp: d.uploaded_at || d.created_at || new Date().toISOString(),
              read: false,
              createdAt: new Date().toISOString(),
              rawPayload: d,
            };
            setRawUpdates(prev => {
              const map = new Map(prev.map(u => [u.id, u]));
              map.set(updateRecord.id, updateRecord);
              return Array.from(map.values());
            });
            setCollectionDoc('miller_updates', updateRecord.id, updateRecord).catch(() => {});
          }
        }
      } catch {}

      if (isManual) {
        showToast(
          `✓ App B Synced: ${syncedCount} accepted POs, ${loadingsCount} loadings, ${billsCount} bills.`
        );
      }
    } catch (e) {
      console.warn('App B sync error:', e);
      if (isManual) {
        showToast('App B sync completed with local cached updates.');
      }
    } finally {
      if (isManual) setIsSyncingAppB(false);
    }
  };

  // Load orders and chats
  const loadOrdersAndChats = async () => {
    setIsLoading(true);
    try {
      // 1. Local updates cache (App B updates) - purge any test entries
      const cachedUpdates = localStorage.getItem('miller_updates');
      if (cachedUpdates) {
        try {
          const parsed = JSON.parse(cachedUpdates);
          const cleaned = filterOutTestData(parsed);
          if (cleaned.length > 0) {
            setRawUpdates(prev => {
              const map = new Map<string, MillerUpdateItem>();
              prev.forEach(u => map.set(u.id, u));
              cleaned.forEach(u => map.set(u.id, u));
              return filterOutTestData(Array.from(map.values())).sort((a, b) => {
                const timeA = getPlacedDateInfo(a).timestampMs;
                const timeB = getPlacedDateInfo(b).timestampMs;
                if (timeB !== timeA) return timeB - timeA;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
              });
            });
          }
          if (cleaned.length !== parsed.length) {
            localStorage.setItem('miller_updates', JSON.stringify(cleaned));
          }
        } catch {}
      }

      // 2. Fetch from remote updates collection (App B updates feed)
      const remoteUpdates = await getCollectionDocs('miller_updates').catch(() => []);
      if (remoteUpdates && remoteUpdates.length > 0) {
        setRawUpdates(prev => {
          const merged = new Map<string, MillerUpdateItem>();
          prev.forEach(u => merged.set(u.id, u));
          remoteUpdates.forEach(u => merged.set(u.id, u));
          const list = filterOutTestData(Array.from(merged.values())).sort((a, b) => {
            const timeA = getPlacedDateInfo(a).timestampMs;
            const timeB = getPlacedDateInfo(b).timestampMs;
            if (timeB !== timeA) return timeB - timeA;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          });
          localStorage.setItem('miller_updates', JSON.stringify(list));
          return list;
        });
      }

      // 3. Fetch Placed Orders strictly for displaying rich PO views in the Chat Desk
      const localOrders = localStorage.getItem('placed_orders');
      if (localOrders) {
        try {
          setOrders(JSON.parse(localOrders));
        } catch {}
      }
      const remoteOrders = await getCollectionDocs('placed_orders').catch(() => []);
      if (remoteOrders && remoteOrders.length > 0) {
        setOrders(remoteOrders);
        localStorage.setItem('placed_orders', JSON.stringify(remoteOrders));
      }

      // 4. Fetch backend API
      await fetchBackendUpdates();

      // 5. Trigger seamless background sync with App B
      triggerAppBSync(false).catch(() => {});

      // 6. Load Chat Messages
      const localChats = localStorage.getItem('miller_chats');
      if (localChats) {
        setCustomMessages(JSON.parse(localChats));
      }
      const remoteChats = await getCollectionDocs('miller_chats').catch(() => []);
      if (remoteChats && remoteChats.length > 0) {
        setCustomMessages(remoteChats);
        localStorage.setItem('miller_chats', JSON.stringify(remoteChats));
      }
    } catch (err) {
      console.error('Error loading data for Miller Updates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Real-time synchronization listeners
  useEffect(() => {
    loadOrdersAndChats();

    // 1. Subscribe to Firestore miller_updates real-time collection changes
    const unsubscribeUpdates = subscribeCollectionDocs('miller_updates', (docs) => {
      if (docs && docs.length > 0) {
        setRawUpdates(prev => {
          const map = new Map<string, MillerUpdateItem>();
          prev.forEach(u => map.set(u.id, u));
          docs.forEach(u => map.set(u.id, u as MillerUpdateItem));
          const sorted = filterOutTestData(Array.from(map.values())).sort((a, b) => {
            const timeA = getPlacedDateInfo(a).timestampMs;
            const timeB = getPlacedDateInfo(b).timestampMs;
            if (timeB !== timeA) return timeB - timeA;
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
          });
          localStorage.setItem('miller_updates', JSON.stringify(sorted));
          return sorted;
        });
        window.dispatchEvent(new CustomEvent('miller-updates-changed'));
      }
    });

    // 2. Periodic poll to server endpoint (every 5 seconds)
    const pollInterval = setInterval(() => {
      fetchBackendUpdates();
    }, 5000);

    // 3. Window events
    const handleSync = () => {
      const cached = localStorage.getItem('miller_updates');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          const cleaned = filterOutTestData(parsed);
          if (cleaned.length > 0) {
            setRawUpdates(prev => {
              const map = new Map<string, MillerUpdateItem>();
              prev.forEach(u => map.set(u.id, u));
              cleaned.forEach(u => map.set(u.id, u));
              return filterOutTestData(Array.from(map.values())).sort((a, b) => {
                const timeA = getPlacedDateInfo(a).timestampMs;
                const timeB = getPlacedDateInfo(b).timestampMs;
                if (timeB !== timeA) return timeB - timeA;
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
              });
            });
          }
        } catch {}
      }
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('miller-updates-changed', handleSync);
    window.addEventListener('placed-orders-updated', loadOrdersAndChats);

    return () => {
      unsubscribeUpdates();
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('miller-updates-changed', handleSync);
      window.removeEventListener('placed-orders-updated', loadOrdersAndChats);
    };
  }, []);

  // Updates stream from incoming App B webhook/events (standalone, authentic App B events, test data purged)
  // Chronologically sorted by PO Placed Date (newest placed on top)
  const allUpdatesStream = useMemo(() => {
    return filterOutTestData(rawUpdates).sort((a, b) => {
      const matchedA = orders.find(o =>
        resolveGroupedPoNumber(o) === a.poNumber ||
        String(o.id) === a.poNumber ||
        (o.id && String(o.id).includes(a.poNumber))
      );
      const matchedB = orders.find(o =>
        resolveGroupedPoNumber(o) === b.poNumber ||
        String(o.id) === b.poNumber ||
        (o.id && String(o.id).includes(b.poNumber))
      );
      const timeA = getPlacedDateInfo(a, matchedA).timestampMs;
      const timeB = getPlacedDateInfo(b, matchedB).timestampMs;
      if (timeB !== timeA) return timeB - timeA;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [rawUpdates, orders]);

  // Compute Summary Statistics
  const summaryStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];

    const isToday = (ts: string) => {
      try {
        return new Date(ts).toISOString().split('T')[0] === todayStr;
      } catch {
        return false;
      }
    };

    const todayUpdates = allUpdatesStream.filter(u => isToday(u.timestamp));
    const billsUploaded = allUpdatesStream.filter(u => u.type === 'BILL_UPLOADED');
    const todayBills = billsUploaded.filter(u => isToday(u.timestamp));
    const trucksLoaded = allUpdatesStream.filter(u => u.type === 'TRUCK_LOADED');
    const todayTrucks = trucksLoaded.filter(u => isToday(u.timestamp));
    const acceptedOrders = allUpdatesStream.filter(u => u.type === 'PO_ACCEPTED');
    const todayAccepted = acceptedOrders.filter(u => isToday(u.timestamp));

    return {
      totalToday: todayUpdates.length > 0 ? todayUpdates.length : allUpdatesStream.length,
      isFallbackTotal: todayUpdates.length === 0,
      billsCount: billsUploaded.length,
      todayBillsCount: todayBills.length,
      trucksCount: trucksLoaded.length,
      todayTrucksCount: todayTrucks.length,
      acceptancesCount: acceptedOrders.length,
      todayAcceptancesCount: todayAccepted.length,
      unreadCount: allUpdatesStream.filter(u => !u.read).length,
    };
  }, [allUpdatesStream]);

  // Distinct millers for dropdown filter
  const distinctMillers = useMemo(() => {
    const set = new Set<string>();
    allUpdatesStream.forEach(u => {
      if (u.millerName) set.add(u.millerName.trim());
    });
    return Array.from(set).sort();
  }, [allUpdatesStream]);

  // Filtered stream items
  const filteredStream = useMemo(() => {
    return allUpdatesStream.filter(u => {
      // Type pill filter
      if (streamFilter === 'bills' && u.type !== 'BILL_UPLOADED') return false;
      if (streamFilter === 'loadings' && u.type !== 'TRUCK_LOADED') return false;
      if (streamFilter === 'acceptances' && u.type !== 'PO_ACCEPTED') return false;

      // Miller filter
      if (selectedMillerFilter !== 'all') {
        if (normalizeSupplier(u.millerName) !== normalizeSupplier(selectedMillerFilter)) {
          return false;
        }
      }

      // Search query
      if (streamSearch.trim()) {
        const q = streamSearch.toLowerCase().trim();
        const matchPo = String(u.poNumber || '').toLowerCase().includes(q);
        const matchSub = String(u.subOrderNo || '').toLowerCase().includes(q);
        const matchMiller = String(u.millerName || '').toLowerCase().includes(q);
        const matchBuyer = String(u.buyerName || '').toLowerCase().includes(q);
        const matchVehicle = String(u.vehicleNumber || '').toLowerCase().includes(q);
        const matchBill = String(u.billNo || '').toLowerCase().includes(q);
        const matchSlip = String(u.weighbridgeSlip || '').toLowerCase().includes(q);
        const matchPhone = String(u.driverPhone || '').toLowerCase().includes(q);

        if (!matchPo && !matchSub && !matchMiller && !matchBuyer && !matchVehicle && !matchBill && !matchSlip && !matchPhone) {
          return false;
        }
      }

      return true;
    });
  }, [allUpdatesStream, streamFilter, selectedMillerFilter, streamSearch]);

  // Action: Mark all updates as read
  const handleMarkAllRead = async () => {
    try {
      await fetch('/api/integration/miller-updates/mark-all-read', { method: 'POST' });
      setRawUpdates(prev => prev.map(u => ({ ...u, read: true })));
      localStorage.setItem('miller_updates_unread_count', '0');
      window.dispatchEvent(new CustomEvent('miller-updates-changed'));
      showToast('✓ All mill updates marked as read.');
    } catch {
      setRawUpdates(prev => prev.map(u => ({ ...u, read: true })));
    }
  };

  // Action: Open in-app bill preview modal
  const handleViewBill = (update: MillerUpdateItem) => {
    const rawUrl = update.billUrl || '';
    const resolved = resolveBillDocumentUrl(rawUrl);

    setViewingBillModal({
      isOpen: true,
      billUrl: resolved,
      billNo: update.billNo || `BIL-${update.poNumber}`,
      fileName: update.fileName || `mill_bill_${update.billNo || 'doc'}.pdf`,
      poNumber: update.poNumber,
      subOrderNo: update.subOrderNo,
      buyerName: update.buyerName,
      millerName: update.millerName,
      timestamp: update.timestamp,
    });
    setBillZoom(1);
    setBillRotation(0);
  };

  // Keyboard shortcut: close bill modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setViewingBillModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute directory of Millers for the Chat Desk tab
  const millersDirectory = useMemo(() => {
    const registered = getRegisteredSuppliers();
    const millsMap = new Map<string, {
      id: string;
      name: string;
      code: string;
      phone: string;
      email: string;
      address: string;
      orders: any[];
      lastActivityTime: number;
      pendingAckCount: number;
      dispatchedCount: number;
      hasBillsCount: number;
      snippet: string;
    }>();

    registered.forEach(s => {
      const profile = resolveSupplierProfile(s.name);
      millsMap.set(s.name.trim().toUpperCase(), {
        id: s.id,
        name: s.name,
        code: s.code || '',
        phone: s.phone || profile.phone || '',
        email: s.email || profile.email || '',
        address: profile.address || '',
        orders: [],
        lastActivityTime: 0,
        pendingAckCount: 0,
        dispatchedCount: 0,
        hasBillsCount: 0,
        snippet: 'Channel initialized with Tejas Canvassing'
      });
    });

    // Populate each mill's issued orders from placed_orders so POs are visible in the chat desk
    orders.forEach(order => {
      const supplier = String(order.supplier || order.millerName || '').trim();
      if (!supplier) return;
      const normSup = normalizeSupplier(supplier);
      for (const [key, millObj] of millsMap.entries()) {
        if (normalizeSupplier(key) === normSup || key.includes(normSup) || normSup.includes(key)) {
          millObj.orders.push(order);
          const oTime = new Date(order.date || order.createdAt || Date.now()).getTime();
          if (oTime > millObj.lastActivityTime) {
            millObj.lastActivityTime = oTime;
            millObj.snippet = `PO #${resolveGroupedPoNumber(order)} issued (${order.product || 'Rice Brand'})`;
          }
          if (!order.isAcknowledged) {
            millObj.pendingAckCount++;
          }
          break;
        }
      }
    });

    // Update mills with activities from App B feeds
    rawUpdates.forEach(update => {
      const millName = update.millerName || '';
      if (!millName) return;
      const normMill = normalizeSupplier(millName);
      for (const [key, millObj] of millsMap.entries()) {
        if (normalizeSupplier(key) === normMill || key.includes(normMill) || normMill.includes(key)) {
          const uTime = new Date(update.timestamp).getTime();
          if (uTime > millObj.lastActivityTime) {
            millObj.lastActivityTime = uTime;
            if (update.type === 'TRUCK_LOADED') {
              millObj.snippet = `🚚 Lorry: ${update.vehicleNumber || 'Dispatched'} (PO #${update.poNumber})`;
              millObj.dispatchedCount++;
            } else if (update.type === 'BILL_UPLOADED') {
              millObj.snippet = `🧾 Mill Invoice attached for PO #${update.poNumber}`;
              millObj.hasBillsCount++;
            } else if (update.type === 'PO_ACCEPTED') {
              millObj.snippet = `✅ Acknowledged PO #${update.poNumber}`;
            }
          }
        }
      }
    });

    customMessages.forEach(msg => {
      const normMsgMill = normalizeSupplier(msg.millName);
      for (const [key, millObj] of millsMap.entries()) {
        if (normalizeSupplier(key) === normMsgMill) {
          const msgTime = new Date(msg.timestamp).getTime();
          if (msgTime > millObj.lastActivityTime) {
            millObj.lastActivityTime = msgTime;
            millObj.snippet = (msg.sender === 'tejas' || msg.sender === 'hq') ? `Tejas: ${msg.text || 'Message'}` : `${msg.text || 'Update'}`;
          }
        }
      }
    });

    const list = Array.from(millsMap.values());
    return list.sort((a, b) => {
      if (a.pendingAckCount !== b.pendingAckCount) return b.pendingAckCount - a.pendingAckCount;
      return b.lastActivityTime - a.lastActivityTime;
    });
  }, [orders, rawUpdates, customMessages]);

  useEffect(() => {
    const urlMill = searchParams.get('mill');
    if (urlMill) {
      setSelectedMillName(urlMill);
    } else if (!selectedMillName && millersDirectory.length > 0) {
      setSelectedMillName(millersDirectory[0].name);
    }
  }, [millersDirectory, searchParams, selectedMillName]);

  const currentMill = useMemo(() => {
    if (!selectedMillName) return millersDirectory[0] || null;
    const norm = normalizeSupplier(selectedMillName);
    return millersDirectory.find(m => normalizeSupplier(m.name) === norm) || millersDirectory[0] || null;
  }, [selectedMillName, millersDirectory]);

  const filteredMillersForChat = useMemo(() => {
    return millersDirectory.filter(m => {
      const matchSearch =
        m.name.toLowerCase().includes(chatSearchQuery.toLowerCase()) ||
        m.code.toLowerCase().includes(chatSearchQuery.toLowerCase()) ||
        m.phone.includes(chatSearchQuery);

      if (!matchSearch) return false;
      if (chatStatusFilter === 'needs_ack') return m.pendingAckCount > 0;
      if (chatStatusFilter === 'dispatched') return m.dispatchedCount > 0;
      if (chatStatusFilter === 'has_bill') return m.hasBillsCount > 0;
      return true;
    });
  }, [millersDirectory, chatSearchQuery, chatStatusFilter]);

  const timelineMessages = useMemo(() => {
    if (!currentMill) return [];
    const messages: ChatMessage[] = [];
    const normSelected = normalizeSupplier(currentMill.name);

    // 1. Synthesize PO cards for current mill (restoring original PO view)
    currentMill.orders.forEach(order => {
      const baseDate = order.date ? new Date(order.date).toISOString() : (order.createdAt || new Date().toISOString());
      const subOrders = Array.isArray(order.originalOrders) && order.originalOrders.length > 0
        ? order.originalOrders
        : [{
            id: 'sub-0',
            buyer: order.buyer || 'Direct Consignee',
            product: order.product || 'Rice Brand',
            brand: order.brand || order.product || 'Rice Brand',
            qty: order.qty || order.totalVolume || 600,
            rate: order.rate || 8000,
            unloadingPoint: order.unloadingPoint || 'shop'
          }];

      const totalVolume = subOrders.reduce((s: number, sub: any) => s + (parseFloat(sub.qty) || 0), 0);
      const poNum = resolveGroupedPoNumber(order);

      // Check if this PO was accepted via App B
      const isAcceptedByAppB = rawUpdates.some(
        u => u.type === 'PO_ACCEPTED' && (
          u.poNumber === poNum ||
          u.poNumber === String(order.id) ||
          (u.poNumber && String(order.id).includes(u.poNumber))
        )
      );

      // A) PO Issued Bubble (From Tejas)
      messages.push({
        id: `po-issue-${order.id}`,
        millName: currentMill.name,
        sender: 'tejas',
        senderName: 'Tejas Canvassing',
        type: 'po',
        poId: poNum || String(order.id),
        timestamp: baseDate,
        poData: {
          ...order,
          poNumber: poNum || String(order.id),
          subOrders,
          totalVolume,
          isAcceptedByAppB: isAcceptedByAppB || order.isAcknowledged
        },
        status: 'read'
      });
    });

    // 2. Timeline messages from App B updates
    rawUpdates.forEach(update => {
      const normMill = normalizeSupplier(update.millerName || '');
      if (normMill === normSelected || currentMill.name.toUpperCase().includes(normMill) || normMill.includes(currentMill.name.toUpperCase())) {
        if (update.type === 'PO_ACCEPTED') {
          messages.push({
            id: `upd-ack-${update.id}`,
            millName: currentMill.name,
            sender: 'miller',
            senderName: currentMill.name,
            type: 'ack',
            poId: update.poNumber,
            timestamp: update.timestamp,
            text: `We acknowledge receipt and have accepted Purchase Order #${update.poNumber} (Application B).`,
            status: 'read'
          });
        } else if (update.type === 'TRUCK_LOADED') {
          messages.push({
            id: `upd-disp-${update.id}`,
            millName: currentMill.name,
            sender: 'miller',
            senderName: currentMill.name,
            type: 'dispatch',
            poId: update.poNumber,
            timestamp: update.timestamp,
            vehicleNo: update.vehicleNumber,
            driverPhone: update.driverPhone || '',
            loadedQuantity: update.loadedQuantity,
            weighbridgeSlip: update.weighbridgeSlip,
            loadingNumber: update.loadingNumber,
            subOrderNo: update.subOrderNo,
            dispatchDate: update.loadingDate || (update.timestamp ? update.timestamp.split('T')[0] : ''),
            dispatchNotes: `Lorry ${update.vehicleNumber || ''} loaded with ${update.loadedQuantity || 0} QTLS and dispatched directly from mill yard.`,
            status: 'read'
          });
        } else if (update.type === 'BILL_UPLOADED') {
          messages.push({
            id: `upd-bill-${update.id}`,
            millName: currentMill.name,
            sender: 'miller',
            senderName: currentMill.name,
            type: 'bill',
            poId: update.poNumber,
            subOrderNo: update.subOrderNo,
            buyerName: update.buyerName,
            timestamp: update.timestamp,
            billNo: update.billNo,
            photoUrl: update.billUrl,
            status: 'read'
          });
        }
      }
    });

    customMessages.forEach(msg => {
      if (normalizeSupplier(msg.millName) === normSelected) {
        messages.push(msg);
      }
    });

    return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [currentMill, orders, rawUpdates, customMessages]);

  useEffect(() => {
    if (activeTab === 'chat') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [timelineMessages, activeTab]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || !currentMill) return;

    setIsSending(true);
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      millName: currentMill.name,
      sender: 'tejas',
      senderName: 'Tejas Canvassing',
      type: 'text',
      text,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    try {
      const updatedChats = [...customMessages, newMsg];
      setCustomMessages(updatedChats);
      localStorage.setItem('miller_chats', JSON.stringify(updatedChats));
      await setCollectionDoc('miller_chats', newMsg.id, newMsg);
      window.dispatchEvent(new CustomEvent('miller-chat-updated'));
      window.dispatchEvent(new Event('storage'));
      setInputText('');
      showToast('✓ Message sent to mill.');
    } catch (err) {
      console.error('Error sending message to mill:', err);
      showToast('⚠️ Message saved locally.');
    } finally {
      setIsSending(false);
    }
  };

  const handleOpenWhatsApp = () => {
    if (!currentMill?.phone) {
      alert(`No phone number configured for ${currentMill?.name || 'this mill'}.`);
      return;
    }
    const cleanPhone = currentMill.phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    const defaultText = encodeURIComponent(`Namaste ${currentMill.name}, updates regarding pending purchase orders from Tejas Canvassing.`);
    window.open(`https://wa.me/${phoneWithCountry}?text=${defaultText}`, '_blank');
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-on-surface font-sans antialiased overflow-hidden">
      {/* ============================================================ */}
      {/* TOP BAR & TAB SELECTOR                                        */}
      {/* ============================================================ */}
      <header className="px-5 py-3.5 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#0c0d0e]/95 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-red-500 to-amber-600 text-white flex items-center justify-center shadow-md shadow-red-500/20">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-black text-lg text-slate-900 dark:text-white tracking-tight">
                Miller Live Ingest & Dispatch Updates
              </h1>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Webhook Active
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-secondary font-medium">
              Direct Mill-Yard Fulfillment • Loading = Shipment En Route to Consignee Shop • No Godowns
            </p>
          </div>
        </div>

        {/* View mode toggle & Actions */}
        <div className="flex items-center gap-2">
          {/* Tab buttons */}
          <div className="p-1 bg-slate-100 dark:bg-surface-container rounded-xl flex items-center border border-slate-200 dark:border-white/5">
            <button
              type="button"
              onClick={() => setActiveTab('stream')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-2",
                activeTab === 'stream'
                  ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-secondary hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <Radio className="w-3.5 h-3.5 text-red-500" />
              <span>Real-Time Stream</span>
              {summaryStats.unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-red-600 text-white">
                  {summaryStats.unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('chat')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer flex items-center gap-2",
                activeTab === 'chat'
                  ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-secondary hover:text-slate-900 dark:hover:text-white"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
              <span>Mill Chat Desk</span>
            </button>
          </div>

          {/* App B Live Sync Trigger */}
          <button
            type="button"
            onClick={() => triggerAppBSync(true)}
            disabled={isSyncingAppB}
            className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
            title="Sync accepted purchase orders, attached bills, and lorry dispatches from App B"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isSyncingAppB && "animate-spin")} />
            <span>{isSyncingAppB ? "Syncing App B..." : "Sync App B"}</span>
          </button>

          {activeTab === 'stream' && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surface-container dark:hover:bg-surface-container-high text-slate-700 dark:text-secondary text-xs font-bold border border-slate-200 dark:border-white/5 transition-colors cursor-pointer flex items-center gap-1.5"
              title="Mark all updates as read"
            >
              <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Mark All Read</span>
            </button>
          )}

          <button
            type="button"
            onClick={loadOrdersAndChats}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surface-container dark:hover:bg-surface-container-high text-slate-700 dark:text-secondary transition-colors cursor-pointer"
            title="Refresh stream"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin text-red-600")} />
          </button>
        </div>
      </header>

      {/* ============================================================ */}
      {/* TAB 1: REAL-TIME STREAM & TABLE (PRIMARY INGEST FEED)        */}
      {/* ============================================================ */}
      {activeTab === 'stream' && (
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* 1. Header & Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Updates Today */}
            <div
              onClick={() => setStreamFilter('all')}
              className={cn(
                "p-4 rounded-2xl border shadow-xs relative overflow-hidden group cursor-pointer transition-all",
                streamFilter === 'all'
                  ? "bg-red-500/10 border-red-500/40 ring-2 ring-red-500/20"
                  : "bg-white dark:bg-[#0f1113] border-slate-200 dark:border-white/5 hover:border-red-500/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-secondary">
                  Real-Time Updates
                </span>
                <div className="w-8 h-8 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <Radio className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                  {summaryStats.totalToday}
                </span>
                <span className="text-xs font-bold text-slate-500 dark:text-secondary">
                  {summaryStats.isFallbackTotal ? 'recent' : 'today'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">
                {allUpdatesStream.length} total App B events received
              </p>
              <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-red-500/5 group-hover:scale-125 transition-transform duration-500" />
            </div>

            {/* Attached Bills */}
            <div
              onClick={() => setStreamFilter('bills')}
              className={cn(
                "p-4 rounded-2xl border shadow-xs relative overflow-hidden group cursor-pointer transition-all",
                streamFilter === 'bills'
                  ? "bg-emerald-500/10 border-emerald-500/40 ring-2 ring-emerald-500/20"
                  : "bg-white dark:bg-[#0f1113] border-slate-200 dark:border-white/5 hover:border-emerald-500/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-secondary">
                  Attached Bills
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <FileText className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                  {summaryStats.billsCount} Bills
                </span>
                {summaryStats.todayBillsCount > 0 && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                    +{summaryStats.todayBillsCount} today
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">
                Mill tax invoices attached by App B
              </p>
              <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-emerald-500/5 group-hover:scale-125 transition-transform duration-500" />
            </div>

            {/* Created Loadings */}
            <div
              onClick={() => setStreamFilter('loadings')}
              className={cn(
                "p-4 rounded-2xl border shadow-xs relative overflow-hidden group cursor-pointer transition-all",
                streamFilter === 'loadings'
                  ? "bg-blue-500/10 border-blue-500/40 ring-2 ring-blue-500/20"
                  : "bg-white dark:bg-[#0f1113] border-slate-200 dark:border-white/5 hover:border-blue-500/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-secondary">
                  Created Loadings
                </span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Truck className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-blue-600 dark:text-blue-400 tracking-tight">
                  {summaryStats.trucksCount} Vehicles
                </span>
                {summaryStats.todayTrucksCount > 0 && (
                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                    +{summaryStats.todayTrucksCount} today
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">
                Loaded at mill weighbridge by App B
              </p>
              <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-blue-500/5 group-hover:scale-125 transition-transform duration-500" />
            </div>

            {/* Accepted Orders */}
            <div
              onClick={() => setStreamFilter('acceptances')}
              className={cn(
                "p-4 rounded-2xl border shadow-xs relative overflow-hidden group cursor-pointer transition-all",
                streamFilter === 'acceptances'
                  ? "bg-purple-500/10 border-purple-500/40 ring-2 ring-purple-500/20"
                  : "bg-white dark:bg-[#0f1113] border-slate-200 dark:border-white/5 hover:border-purple-500/30"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-secondary">
                  Accepted Orders
                </span>
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-2xl sm:text-3xl font-black text-purple-600 dark:text-purple-400 tracking-tight">
                  {summaryStats.acceptancesCount} POs
                </span>
                {summaryStats.todayAcceptancesCount > 0 && (
                  <span className="text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                    +{summaryStats.todayAcceptancesCount} today
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">
                Confirmed & accepted by mills in App B
              </p>
              <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-purple-500/5 group-hover:scale-125 transition-transform duration-500" />
            </div>
          </div>

          {/* 2. Controls & Quick Filter Pills */}
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0f1113] border border-slate-200 dark:border-white/5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* Quick Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'all', label: 'All Updates', count: allUpdatesStream.length },
                  { id: 'bills', label: 'Bills & Invoices', count: summaryStats.billsCount },
                  { id: 'loadings', label: 'Vehicle Loadings', count: summaryStats.trucksCount },
                  { id: 'acceptances', label: 'PO Acceptances', count: allUpdatesStream.filter(u => u.type === 'PO_ACCEPTED').length },
                ].map(pill => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setStreamFilter(pill.id as any)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2",
                      streamFilter === pill.id
                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs"
                        : "bg-slate-100 hover:bg-slate-200 dark:bg-surface-container dark:hover:bg-surface-container-high text-slate-700 dark:text-secondary"
                    )}
                  >
                    <span>{pill.label}</span>
                    <span className={cn(
                      "px-1.5 py-0.2 rounded-full text-[10px]",
                      streamFilter === pill.id
                        ? "bg-white/20 dark:bg-slate-900/20"
                        : "bg-slate-200 dark:bg-white/10"
                    )}>
                      {pill.count}
                    </span>
                  </button>
                ))}
              </div>

              {/* Miller selector filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 dark:text-secondary hidden sm:inline">Miller:</span>
                <select
                  value={selectedMillerFilter}
                  onChange={(e) => setSelectedMillerFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-surface-container border border-slate-200 dark:border-white/5 text-xs font-bold text-slate-800 dark:text-on-surface outline-none cursor-pointer"
                >
                  <option value="all">All Millers / Units ({distinctMillers.length})</option>
                  {distinctMillers.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 dark:text-secondary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by PO #, Sub-PO (e.g. BRI-0003), Buyer, Vehicle No, Bill # or Weighbridge Slip..."
                value={streamSearch}
                onChange={(e) => setStreamSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-secondary outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
              />
              {streamSearch && (
                <button
                  type="button"
                  onClick={() => setStreamSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* DEDICATED VIEW: ATTACHED BILLS (APP B) */}
          {streamFilter === 'bills' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      Attached Bills & Mill Invoices from App B ({filteredStream.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-secondary">
                      Authentic supplier tax invoices attached for direct consignment shipments.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStream.length === 0 ? (
                  <div className="col-span-full p-8 text-center bg-white dark:bg-[#0f1113] rounded-2xl border border-slate-200 dark:border-white/5 text-slate-400">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-xs">No attached bills found</p>
                  </div>
                ) : (
                  filteredStream.map(item => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-white dark:bg-[#0f1113] border border-emerald-500/20 shadow-xs space-y-3 hover:border-emerald-500/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white font-mono font-black text-xs shadow-xs">
                          BILL #{item.billNo || 'INVOICE'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {formatDateTime(item.timestamp)}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase text-slate-400 dark:text-secondary">Consignee Buyer</span>
                        <p className="font-black text-sm text-slate-900 dark:text-white leading-tight">
                          {item.buyerName || 'Authorized Consignee'}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 text-[11px]">
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 font-bold">PO Number</span>
                          <p className="font-mono font-bold text-slate-800 dark:text-white">#{item.poNumber}</p>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase text-slate-400 font-bold">Sub-Order</span>
                          <p className="font-mono font-bold text-amber-600 dark:text-amber-400">{item.subOrderNo || '--'}</p>
                        </div>
                        <div className="col-span-2 pt-1 border-t border-slate-200/50 dark:border-white/5">
                          <span className="text-[10px] uppercase text-slate-400 font-bold">Milling Partner</span>
                          <p className="font-bold text-slate-700 dark:text-secondary truncate">{item.millerName}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleViewBill(item)}
                          className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Bill</span>
                        </button>
                        {item.billUrl && (
                          <a
                            href={resolveBillDocumentUrl(item.billUrl)}
                            download={item.fileName || `Mill_Bill_${item.billNo || 'doc'}.pdf`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-700 dark:text-white cursor-pointer transition-colors"
                            title="Download invoice document"
                          >
                            <Download className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* DEDICATED VIEW: CREATED LOADINGS (APP B) */}
          {streamFilter === 'loadings' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center font-black">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      Created Loadings by App B ({filteredStream.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-secondary">
                      Vehicle dispatches loaded at mill weighbridge en route directly to buyer shops.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStream.length === 0 ? (
                  <div className="col-span-full p-8 text-center bg-white dark:bg-[#0f1113] rounded-2xl border border-slate-200 dark:border-white/5 text-slate-400">
                    <Truck className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-xs">No vehicle loadings recorded yet</p>
                  </div>
                ) : (
                  filteredStream.map(item => (
                    <div
                      key={item.id}
                      className="p-4 rounded-2xl bg-white dark:bg-[#0f1113] border border-blue-500/20 shadow-xs space-y-3 hover:border-blue-500/40 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-1 rounded-xl bg-blue-600 text-white font-mono font-black text-xs shadow-xs tracking-wider">
                          {item.vehicleNumber || 'LORRY ASSIGNED'}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-blue-700 dark:text-blue-300 font-mono text-[10px] font-bold">
                          {item.loadingNumber || item.loadingId || 'DIRECT'}
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between pt-1 border-b border-slate-100 dark:border-white/5 pb-2">
                        <div>
                          <span className="text-[10px] font-black uppercase text-slate-400 dark:text-secondary">Loaded Quantity</span>
                          <p className="text-2xl font-black text-blue-600 dark:text-blue-400 font-sans">
                            {item.loadedQuantity || 0} <span className="text-xs font-bold text-slate-400 dark:text-secondary">QTLS</span>
                          </p>
                        </div>
                        {item.weighbridgeSlip && (
                          <div className="text-right">
                            <span className="text-[10px] font-black uppercase text-slate-400 dark:text-secondary">Weighbridge Slip</span>
                            <p className="font-mono font-bold text-slate-900 dark:text-white text-xs">{item.weighbridgeSlip}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">PO Reference:</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-white">#{item.poNumber}</span>
                        </div>
                        {item.subOrderNo && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Sub-Order:</span>
                            <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{item.subOrderNo}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Mill Facility:</span>
                          <span className="font-bold text-slate-700 dark:text-secondary truncate max-w-[180px]">{item.millerName}</span>
                        </div>
                        {item.loadingDate && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Loading Date:</span>
                            <span className="font-medium text-slate-600 dark:text-neutral-300">{item.loadingDate}</span>
                          </div>
                        )}
                      </div>

                      {item.driverPhone && (
                        <div className="pt-2 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Driver Contact</span>
                          <a
                            href={`tel:${item.driverPhone.replace(/[^0-9+]/g, '')}`}
                            className="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            {item.driverPhone}
                          </a>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* DEDICATED VIEW: ACCEPTED ORDERS (APP B) */}
          {streamFilter === 'acceptances' && (
            <div className="space-y-3">
              <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900 dark:text-white">
                      Orders Accepted by App B ({filteredStream.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-secondary">
                      Purchase Orders acknowledged and confirmed for milling & dispatch by milling partners.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredStream.length === 0 ? (
                  <div className="col-span-full p-8 text-center bg-white dark:bg-[#0f1113] rounded-2xl border border-slate-200 dark:border-white/5 text-slate-400">
                    <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-bold text-xs">No accepted orders recorded yet</p>
                  </div>
                ) : (
                  filteredStream.map(item => {
                    const matchedOrder = orders.find(o =>
                      resolveGroupedPoNumber(o) === item.poNumber ||
                      String(o.id) === item.poNumber ||
                      (o.id && String(o.id).includes(item.poNumber))
                    );
                    const placedInfo = getPlacedDateInfo(item, matchedOrder);
                    const subOrders = getSubOrdersForPO(item, matchedOrder);
                    const totalSubQty = subOrders.reduce((sum, s) => sum + s.quantity, 0);

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-white dark:bg-[#0f1113] border border-purple-500/20 shadow-xs space-y-3 hover:border-purple-500/40 transition-colors"
                      >
                        {/* 1. Header: PO Number & Placed Date on Left, Mill Confirmed Badge on Right */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="px-2.5 py-1 rounded-xl bg-purple-600 text-white font-mono font-black text-xs shadow-xs">
                              PO #{item.poNumber}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-lg border border-slate-200 dark:border-white/5">
                              <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                              <span>Placed: <strong className="font-black text-slate-900 dark:text-white">{placedInfo.placedDateStr}</strong></span>
                            </span>
                          </div>
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                            <span>Mill Confirmed: {formatDateTime(item.timestamp)}</span>
                          </span>
                        </div>

                        {/* 2. Milling Facility */}
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-black uppercase text-slate-400 dark:text-secondary">Milling Facility</span>
                          <p className="font-bold text-sm text-slate-900 dark:text-white">
                            {item.millerName}
                          </p>
                        </div>

                        {/* 3. Summary Overview */}
                        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/5 space-y-1.5 text-[11px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Total Volume:</span>
                            <span className="font-black text-slate-900 dark:text-white">
                              {(matchedOrder?.totalVolume || matchedOrder?.qty || item.rawPayload?.orderedQuantity || totalSubQty)} QTLS
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Product:</span>
                            <span className="font-semibold text-slate-800 dark:text-neutral-200">
                              {matchedOrder?.product || item.rawPayload?.productName || 'Keshar Kali'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Sub-Orders Count:</span>
                            <span className="font-mono font-bold text-purple-600 dark:text-purple-400">
                              {subOrders.length} {subOrders.length === 1 ? 'sub-order' : 'sub-orders'}
                            </span>
                          </div>
                        </div>

                        {/* 4. Sub-orders Breakdown (Per PO) */}
                        <div className="space-y-1.5 pt-1 border-t border-slate-100 dark:border-white/5">
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400">
                            <span>Sub-Orders Breakdown ({subOrders.length})</span>
                            <span>Destination</span>
                          </div>
                          <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                            {subOrders.map((sub, sIdx) => (
                              <div
                                key={sIdx}
                                className="p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 text-[11px] space-y-1"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="px-1.5 py-0.5 rounded-md font-mono font-black text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 shrink-0">
                                      {sub.subOrderNo}
                                    </span>
                                    <span className="font-bold text-slate-900 dark:text-white truncate">
                                      {sub.buyerName}
                                    </span>
                                  </div>
                                  <span className="font-mono font-black text-slate-800 dark:text-slate-200 shrink-0">
                                    {sub.quantity} QTL
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-neutral-400">
                                  <span className="truncate">
                                    {sub.productName} • ₹{formatINR(sub.rate)}/QTL
                                  </span>
                                  <span className="capitalize px-1.5 py-0.2 rounded bg-slate-200/50 dark:bg-white/5 font-semibold text-[10px]">
                                    {sub.unloadingPoint || 'shop'}
                                  </span>
                                </div>
                                {sub.billNo && (
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <FileCheck className="w-3 h-3" />
                                    <span>Mill Bill #{sub.billNo}</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 5. Footer: Open in Chat Desk */}
                        <div className="flex items-center justify-end pt-1 border-t border-slate-100 dark:border-white/5">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMillName(item.millerName);
                              setActiveTab('chat');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/10 dark:hover:bg-white/20 text-slate-800 dark:text-white font-bold text-xs cursor-pointer flex items-center gap-1.5 transition-colors"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                            <span>Open in Chat Desk</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* 3. Miller Updates Activity Table / Stream */}
          <div className="rounded-2xl bg-white dark:bg-[#0f1113] border border-slate-200 dark:border-white/5 shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-red-600 dark:text-red-400" />
                <h2 className="font-black text-sm text-slate-900 dark:text-white tracking-tight">
                  Live Fulfillment Ingest Stream
                </h2>
                <span className="text-xs text-slate-400 dark:text-secondary">
                  ({filteredStream.length} items)
                </span>
              </div>
              <span className="text-[11px] font-bold text-slate-400 dark:text-secondary">
                Auto-updating • No reload required
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/80 dark:bg-white/[0.02] border-b border-slate-200 dark:border-white/5 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-secondary">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Miller / Unit</th>
                    <th className="py-3 px-4">PO # & Sub-PO</th>
                    <th className="py-3 px-4">Buyer / Destination</th>
                    <th className="py-3 px-4">Update Type</th>
                    <th className="py-3 px-4">Vehicle / Slip</th>
                    <th className="py-3 px-4 text-right">Bill Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.03]">
                  {filteredStream.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400 dark:text-secondary space-y-2">
                        <Radio className="w-8 h-8 mx-auto opacity-30 animate-pulse" />
                        <p className="font-bold">No updates match the selected filters</p>
                        <p className="text-[11px]">Inbound webhook events from Milling Partner will appear here immediately.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStream.map((item) => {
                      const isUnread = !item.read;
                      const matchedOrder = orders.find(o =>
                        resolveGroupedPoNumber(o) === item.poNumber ||
                        String(o.id) === item.poNumber ||
                        (o.id && String(o.id).includes(item.poNumber))
                      );
                      const placedInfo = getPlacedDateInfo(item, matchedOrder);
                      const subOrders = getSubOrdersForPO(item, matchedOrder);

                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors",
                            isUnread && "bg-red-500/[0.03] dark:bg-red-500/[0.05]"
                          )}
                        >
                          {/* Column 1: Placed Date & Accepted Timestamp */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-red-600 shrink-0 animate-ping" title="New update" />
                              )}
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                                  <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                                  <span>Placed: {placedInfo.placedDateStr}</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                                  <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                                  <span>Accepted: {formatDateTime(item.timestamp)}</span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Column 2: Miller / Unit */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-surface-container flex items-center justify-center shrink-0 text-slate-700 dark:text-white font-black text-[11px]">
                                <Building2 className="w-3.5 h-3.5 text-amber-600" />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white leading-tight">
                                  {item.millerName || 'Bhagwathi Rice'}
                                </p>
                                <span className="text-[10px] text-slate-400 dark:text-secondary uppercase tracking-wider font-semibold">
                                  Milling Unit
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Column 3: PO # & Sub-PO */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5 flex-wrap max-w-[220px]">
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black font-mono bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white border border-slate-200 dark:border-white/5">
                                #{item.poNumber}
                              </span>
                              {subOrders.length > 0 ? (
                                subOrders.length <= 2 ? (
                                  subOrders.map((so, sIdx) => (
                                    <span key={sIdx} className="px-1.5 py-0.5 rounded text-[10px] font-black font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                      {so.subOrderNo}
                                    </span>
                                  ))
                                ) : (
                                  <>
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-black font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                      {subOrders[0].subOrderNo}
                                    </span>
                                    <span
                                      title={subOrders.map(s => `${s.subOrderNo} (${s.buyerName})`).join(', ')}
                                      className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/5 cursor-help"
                                    >
                                      +{subOrders.length - 1} subs
                                    </span>
                                  </>
                                )
                              ) : item.subOrderNo ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-black font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                  {item.subOrderNo}
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* Column 4: Buyer / Destination */}
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white leading-tight">
                                {subOrders.length > 1
                                  ? `${subOrders[0].buyerName} (+${subOrders.length - 1} buyers)`
                                  : (item.buyerName || (subOrders[0]?.buyerName) || 'Authorized Consignee')}
                              </p>
                              <span className="text-[10px] text-slate-400 dark:text-secondary flex items-center gap-1">
                                <span>{subOrders.length > 1 ? 'Multiple Delivery Destinations' : (subOrders[0]?.unloadingPoint || 'Shop / Consignee Hub')}</span>
                              </span>
                            </div>
                          </td>

                          {/* Column 5: Update Type Badge */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {item.type === 'BILL_UPLOADED' && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
                                <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                                <span>Mill Bill #{item.billNo || 'Uploaded'}</span>
                              </div>
                            )}

                            {item.type === 'TRUCK_LOADED' && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20">
                                <Truck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                                <span>{item.vehicleNumber || 'Truck Loaded'}</span>
                                {item.loadedQuantity ? (
                                  <span className="text-[10px] opacity-80">• {item.loadedQuantity} QTL</span>
                                ) : null}
                              </div>
                            )}

                            {item.type === 'PO_ACCEPTED' && (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                                <span>PO Accepted • Confirmed by Mill</span>
                              </div>
                            )}
                          </td>

                          {/* Column 6: Vehicle / Slip */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            {item.weighbridgeSlip || item.driverPhone || item.vehicleNumber ? (
                              <div className="space-y-0.5">
                                {item.weighbridgeSlip && (
                                  <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-slate-800 dark:text-white">
                                    <span className="text-[10px] uppercase text-slate-400">Slip:</span>
                                    <span>{item.weighbridgeSlip}</span>
                                  </div>
                                )}
                                {item.driverPhone && (
                                  <a
                                    href={`tel:${item.driverPhone.replace(/[^0-9+]/g, '')}`}
                                    className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-mono"
                                  >
                                    <Phone className="w-3 h-3" />
                                    <span>{item.driverPhone}</span>
                                  </a>
                                )}
                                {!item.weighbridgeSlip && !item.driverPhone && item.vehicleNumber && (
                                  <span className="text-[11px] font-mono text-slate-600 dark:text-secondary">
                                    {item.vehicleNumber}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-300 dark:text-neutral-700 font-mono">--</span>
                            )}
                          </td>

                          {/* Column 7: Bill Action */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {item.billUrl || item.billNo ? (
                              <button
                                type="button"
                                onClick={() => handleViewBill(item)}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                                title="Open authentic mill tax invoice preview"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View Bill</span>
                              </button>
                            ) : (
                              <span className="text-slate-300 dark:text-neutral-700 font-mono pr-4">--</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MILL COMMUNICATION & WHATSAPP CHAT DESK               */}
      {/* ============================================================ */}
      {activeTab === 'chat' && (
        <div className="flex-1 flex overflow-hidden">
          {/* LEFT COLUMN: MILL DIRECTORY */}
          <aside className="w-80 sm:w-96 border-r border-slate-200 dark:border-white/10 flex flex-col bg-white dark:bg-[#0c0d0e] shrink-0">
            <div className="p-3.5 border-b border-slate-200 dark:border-white/10 space-y-3 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-black text-sm text-slate-900 dark:text-white tracking-tight">Miller Channels</h2>
                  <p className="text-[10px] text-slate-500 dark:text-secondary font-medium">WhatsApp Dispatch Channel</p>
                </div>
                <button
                  type="button"
                  onClick={loadOrdersAndChats}
                  disabled={isLoading}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-surface-container dark:hover:bg-surface-container-high text-secondary cursor-pointer transition-colors"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-red-600")} />
                </button>
              </div>

              {/* Search bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search mill by name, code or phone..."
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-neutral-900 border border-slate-200 dark:border-white/10 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-red-500"
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'needs_ack', label: 'Needs Ack' },
                  { id: 'dispatched', label: 'Dispatched' },
                  { id: 'has_bill', label: 'Has Bills' }
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setChatStatusFilter(f.id as any)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0",
                      chatStatusFilter === f.id
                        ? "bg-red-600 text-white shadow-xs"
                        : "bg-slate-100 dark:bg-surface-container text-slate-600 dark:text-secondary hover:text-slate-900 dark:hover:text-white"
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mills List */}
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/[0.03]">
              {filteredMillersForChat.length === 0 ? (
                <div className="p-8 text-center text-slate-400 dark:text-secondary space-y-2">
                  <Building2 className="w-8 h-8 mx-auto opacity-30" />
                  <p className="text-xs font-bold">No mills found</p>
                </div>
              ) : (
                filteredMillersForChat.map((mill) => {
                  const isSelected = currentMill?.name === mill.name;
                  const initials = mill.name
                    .split(' ')
                    .filter(Boolean)
                    .slice(0, 2)
                    .map(w => w[0])
                    .join('')
                    .toUpperCase() || 'M';

                  return (
                    <div
                      key={mill.id || mill.name}
                      onClick={() => {
                        setSelectedMillName(mill.name);
                        setSearchParams({ mill: mill.name });
                      }}
                      className={cn(
                        "p-3 flex items-start gap-3 cursor-pointer transition-all border-l-4",
                        isSelected
                          ? "bg-slate-100 dark:bg-surface-container/70 border-l-red-600 shadow-xs"
                          : "hover:bg-slate-50 dark:hover:bg-white/[0.02] border-l-transparent"
                      )}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-red-500/20 border border-amber-500/30 flex items-center justify-center font-black text-xs text-amber-700 dark:text-amber-400 shrink-0">
                        {initials}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-bold text-xs text-slate-900 dark:text-white truncate">{mill.name}</h3>
                          {mill.lastActivityTime > 0 && (
                            <span className="text-[10px] text-slate-400 dark:text-secondary shrink-0 ml-1">
                              {new Date(mill.lastActivityTime).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-secondary truncate mt-0.5">
                          {mill.snippet}
                        </p>

                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {mill.pendingAckCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-black">
                              {mill.pendingAckCount} Needs Ack
                            </span>
                          )}
                          {mill.dispatchedCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[9px] font-black">
                              {mill.dispatchedCount} Dispatched
                            </span>
                          )}
                          {mill.hasBillsCount > 0 && (
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[9px] font-black">
                              {mill.hasBillsCount} Invoices
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* RIGHT COLUMN: ACTIVE MILL CHAT & DISPATCH DESK */}
          <main className="flex-1 flex flex-col bg-slate-50 dark:bg-neutral-950 overflow-hidden">
            {currentMill ? (
              <>
                {/* Chat Header */}
                <div className="p-3 px-4 border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c0d0e] flex items-center justify-between shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center font-black text-xs shrink-0">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="font-black text-sm text-slate-900 dark:text-white">{currentMill.name}</h2>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-secondary">
                        <span>{currentMill.phone || 'Direct Mill Yard'}</span>
                        <span>•</span>
                        <span>App B Direct Feed</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleOpenWhatsApp}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>WhatsApp Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowInfoDrawer(!showInfoDrawer)}
                      className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-surface-container text-slate-700 dark:text-secondary cursor-pointer"
                      title="Mill Details"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Timeline Messages Stream */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {timelineMessages.length === 0 ? (
                    <div className="py-20 text-center text-slate-400 dark:text-secondary space-y-2">
                      <MessageSquare className="w-10 h-10 mx-auto opacity-30" />
                      <p className="font-bold">No activity yet with {currentMill.name}</p>
                      <p className="text-xs">Issue a Purchase Order or send a message below to start coordination.</p>
                    </div>
                  ) : (
                    timelineMessages.map((msg) => {
                      const isMe = msg.sender === 'tejas' || msg.sender === 'hq';

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex flex-col max-w-xl",
                            isMe ? "ml-auto items-end" : "mr-auto items-start"
                          )}
                        >
                          <div className="text-[10px] font-bold text-slate-400 dark:text-secondary mb-1 px-1">
                            {msg.senderName} • {formatDateTime(msg.timestamp)}
                          </div>

                          {/* Message Types */}
                          {msg.type === 'text' && (
                            <div className={cn(
                              "p-3 rounded-2xl text-xs font-semibold leading-relaxed shadow-xs",
                              isMe
                                ? "bg-red-600 text-white rounded-tr-none"
                                : "bg-white dark:bg-surface-container text-slate-900 dark:text-white border border-slate-200 dark:border-white/5 rounded-tl-none"
                            )}>
                              {msg.text}
                            </div>
                          )}

                          {msg.type === 'po' && msg.poData && (
                            <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-white/10 shadow-md overflow-hidden">
                              {/* PO Card Header */}
                              <div className="px-4 py-2.5 bg-red-600 text-white flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <FileText className="w-4 h-4" />
                                  <span className="font-mono font-black text-xs uppercase tracking-wider">
                                    PURCHASE ORDER #{msg.poId}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {msg.poData.isAcceptedByAppB && (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-white/20 text-white flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 text-emerald-300" />
                                      Accepted by App B
                                    </span>
                                  )}
                                  <span className="text-[10px] font-bold opacity-90">
                                    {msg.poData.date || 'Issued'}
                                  </span>
                                </div>
                              </div>

                              {/* PO Card Body */}
                              <div className="p-4 space-y-3 text-xs">
                                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                                  <div>
                                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-secondary">Consolidated Volume</span>
                                    <p className="text-xl font-black text-slate-900 dark:text-white font-sans">
                                      {(msg.poData.totalVolume || msg.poData.qty || 0).toFixed(2)}{' '}
                                      <span className="text-xs font-bold text-slate-400 dark:text-secondary">QTLS</span>
                                    </p>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-black uppercase text-slate-400 dark:text-secondary">Loading Terms</span>
                                    <p className="font-bold text-slate-800 dark:text-on-surface">{msg.poData.loadingDays || 5} Days</p>
                                  </div>
                                </div>

                                {/* Sub-orders List */}
                                <div className="space-y-1.5">
                                  <span className="text-[10px] font-black uppercase text-slate-400 dark:text-secondary tracking-wider">
                                    Sub-Orders ({msg.poData.subOrders?.length || 1})
                                  </span>
                                  {msg.poData.subOrders?.map((sub: any, sIdx: number) => (
                                    <div key={sIdx} className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                                      <div>
                                        <p className="font-bold text-slate-900 dark:text-white text-xs leading-tight">{sub.buyer}</p>
                                        <p className="text-[10px] text-red-600 dark:text-red-400 font-semibold">{sub.brand || sub.product || 'Rice Brand'}</p>
                                      </div>
                                      <div className="text-right">
                                        <p className="font-black font-sans text-xs text-slate-900 dark:text-white">
                                          {(parseFloat(sub.qty) || 0).toFixed(2)} QTLS
                                        </p>
                                        <p className="text-[10px] text-slate-500 dark:text-secondary font-mono">
                                          ₹{formatINR(sub.rate || 0)} / QTL
                                        </p>
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                {/* Actions inside PO Card */}
                                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => printPoDocument(msg.poData.supplier || currentMill?.name || 'DIRECT MILL', msg.poData, msg.poData.subOrders || [])}
                                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-surface-container hover:bg-slate-200 dark:hover:bg-surface-container-high text-slate-700 dark:text-secondary hover:text-slate-900 dark:hover:text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                    >
                                      <Printer className="w-3 h-3" />
                                      <span>Print PDF</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => navigate('/placed-orders')}
                                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-surface-container hover:bg-slate-200 dark:hover:bg-surface-container-high text-slate-700 dark:text-secondary hover:text-slate-900 dark:hover:text-white font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      <span>Orders Desk</span>
                                    </button>
                                  </div>

                                  <div className="flex items-center gap-1 text-[10px] text-slate-400 dark:text-secondary font-mono">
                                    <span>{formatDateTime(msg.timestamp)}</span>
                                    <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {msg.type === 'ack' && (
                            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-xs font-bold space-y-1.5 w-full max-w-md">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-black text-emerald-600 dark:text-emerald-400">
                                  <CheckCheck className="w-4 h-4" />
                                  <span>PO Confirmed & Accepted (App B)</span>
                                </div>
                                {msg.poId && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-600 text-white font-mono">
                                    #{msg.poId}
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] leading-relaxed font-normal">{msg.text || `Milling unit confirmed receipt and accepted Purchase Order #${msg.poId}.`}</p>
                            </div>
                          )}

                          {msg.type === 'dispatch' && (
                            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 text-xs font-bold space-y-2 w-full max-w-md">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-black text-blue-600 dark:text-blue-400">
                                  <Truck className="w-4 h-4" />
                                  <span>Lorry Loaded & Dispatched (App B)</span>
                                </div>
                                <span className="px-2 py-0.5 rounded-md bg-blue-600 text-white font-mono font-black text-[11px]">
                                  {msg.vehicleNo}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 p-2 rounded-xl bg-blue-500/5 text-[11px]">
                                <div>
                                  <span className="text-[9px] uppercase text-blue-500 dark:text-blue-400 font-bold">Loaded Qty</span>
                                  <p className="font-black text-blue-900 dark:text-white">{msg.loadedQuantity || '18'} QTLS</p>
                                </div>
                                <div>
                                  <span className="text-[9px] uppercase text-blue-500 dark:text-blue-400 font-bold">Weighbridge Slip</span>
                                  <p className="font-mono font-bold text-blue-900 dark:text-white">{msg.weighbridgeSlip || '--'}</p>
                                </div>
                                {msg.driverPhone && (
                                  <div className="col-span-2 flex items-center justify-between pt-1 border-t border-blue-500/20">
                                    <span className="text-[9px] uppercase text-blue-500 dark:text-blue-400 font-bold">Driver Phone</span>
                                    <a
                                      href={`tel:${msg.driverPhone.replace(/[^0-9+]/g, '')}`}
                                      className="font-mono font-bold text-blue-600 dark:text-blue-300 hover:underline flex items-center gap-1"
                                    >
                                      <Phone className="w-3 h-3" />
                                      {msg.driverPhone}
                                    </a>
                                  </div>
                                )}
                              </div>

                              {msg.dispatchNotes && (
                                <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">{msg.dispatchNotes}</p>
                              )}
                            </div>
                          )}

                          {msg.type === 'bill' && (
                            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold space-y-2.5 w-full max-w-md">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-black text-emerald-600 dark:text-emerald-400">
                                  <FileText className="w-4 h-4" />
                                  <span>Authentic Mill Tax Invoice Attached</span>
                                </div>
                                {msg.billNo && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono font-black text-[11px]">
                                    Bill #{msg.billNo}
                                  </span>
                                )}
                              </div>

                              {msg.subBills && msg.subBills.length > 0 ? (
                                <div className="space-y-1.5">
                                  {msg.subBills.map((sb, sbIdx) => (
                                    <div key={sbIdx} className="flex items-center justify-between p-2 rounded-xl bg-white/60 dark:bg-black/30 border border-emerald-500/20">
                                      <div>
                                        <p className="text-[11px] font-black text-slate-900 dark:text-white">
                                          Bill #{sb.billNo}
                                        </p>
                                        <span className="text-[10px] text-slate-500">{sb.buyer}</span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleViewBill({
                                          id: `sb-${sb.billNo}`,
                                          type: 'BILL_UPLOADED',
                                          poNumber: msg.poId || '',
                                          buyerName: sb.buyer,
                                          billNo: sb.billNo,
                                          billUrl: sb.photoUrl,
                                          millerName: currentMill.name,
                                          timestamp: msg.timestamp,
                                          read: true
                                        })}
                                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-bold cursor-pointer hover:bg-emerald-700"
                                      >
                                        View Bill
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="p-2.5 rounded-xl bg-white/60 dark:bg-black/30 border border-emerald-500/20 flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-xs font-black text-slate-900 dark:text-white">
                                      {msg.buyerName ? `${msg.buyerName}` : `PO #${msg.poId}`}
                                    </p>
                                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono">
                                      {msg.subOrderNo ? `Sub-Order: ${msg.subOrderNo}` : `Invoice attached`}
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleViewBill({
                                      id: msg.id,
                                      type: 'BILL_UPLOADED',
                                      poNumber: msg.poId || '',
                                      subOrderNo: msg.subOrderNo,
                                      buyerName: msg.buyerName,
                                      billNo: msg.billNo,
                                      billUrl: msg.photoUrl,
                                      millerName: currentMill.name,
                                      timestamp: msg.timestamp,
                                      read: true
                                    })}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer hover:bg-emerald-700 flex items-center gap-1.5 shadow-xs"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View Bill</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Message Input Box */}
                <div className="p-3 border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c0d0e] flex items-center gap-2">
                  <input
                    type="text"
                    placeholder={`Message ${currentMill.name}...`}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 px-4 py-2 rounded-xl bg-slate-100 dark:bg-surface-container border border-slate-200 dark:border-white/5 text-xs font-bold text-slate-900 dark:text-white placeholder:text-slate-400 outline-none focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleSendMessage()}
                    disabled={isSending || !inputText.trim()}
                    className="p-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold cursor-pointer disabled:opacity-40 transition-all"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 text-center text-slate-400">
                <p>Select a milling unit to view the communication channel.</p>
              </div>
            )}
          </main>

          {/* RIGHT SIDE DRAWER: MILL PROFILE & DETAILS */}
          <AnimatePresence>
            {showInfoDrawer && currentMill && (
              <motion.aside
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 320, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                className="border-l border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c0d0e] flex flex-col shrink-0 overflow-hidden shadow-2xl z-20"
              >
                <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                  <h3 className="font-black text-xs uppercase tracking-wider text-slate-900 dark:text-white">Mill Profile</h3>
                  <button
                    type="button"
                    onClick={() => setShowInfoDrawer(false)}
                    className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-500 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
                  <div className="text-center pb-3 border-b border-slate-200 dark:border-white/10 space-y-1.5">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 font-black text-base flex items-center justify-center mx-auto shadow-inner">
                      {currentMill.name.slice(0, 2).toUpperCase()}
                    </div>
                    <h4 className="font-black text-sm text-slate-900 dark:text-white">{currentMill.name}</h4>
                    <p className="text-[11px] text-slate-500 dark:text-secondary">{currentMill.address || 'APMC Registered Hub'}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 dark:text-secondary">Supplier Code</span>
                      <p className="font-mono font-black text-slate-900 dark:text-white">{currentMill.code || 'SUP-DIRECT'}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 dark:text-secondary">Dispatch Contact</span>
                      <p className="font-bold text-slate-900 dark:text-white">{currentMill.phone || 'Not configured'}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 dark:text-secondary">Email</span>
                      <p className="font-bold text-slate-900 dark:text-white truncate">{currentMill.email || 'orders@mill.com'}</p>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-100 dark:border-white/5 space-y-1">
                      <span className="text-[10px] font-black uppercase text-slate-400 dark:text-secondary">Total POs Issued</span>
                      <p className="text-lg font-black text-red-600 dark:text-red-400 font-sans">{currentMill.orders?.length || 0}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/miller?mill=${encodeURIComponent(currentMill.name)}`)}
                    className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" />
                    <span>Open Miller Portal View</span>
                  </button>
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ============================================================ */}
      {/* IN-APP BILL PREVIEW MODAL (PDF & IMAGE SUPPORT)              */}
      {/* ============================================================ */}
      <AnimatePresence>
        {viewingBillModal && viewingBillModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-4xl w-full p-4 sm:p-5 shadow-2xl space-y-3 flex flex-col max-h-[94vh]"
            >
              {/* Modal Header with Invoice Metadata */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-sm text-white">
                        Mill Tax Invoice / Consignment Bill
                      </h3>
                      {viewingBillModal.billNo && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-mono text-xs font-black border border-emerald-500/30">
                          #{viewingBillModal.billNo}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-400 font-medium">
                      {viewingBillModal.millerName || 'Milling Unit'} • {formatDateTime(viewingBillModal.timestamp)}
                    </p>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setBillZoom(z => Math.max(0.6, z - 0.2))}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillZoom(z => Math.min(2.5, z + 0.2))}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillRotation(r => (r + 90) % 360)}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                    title="Rotate 90°"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <a
                    href={viewingBillModal.billUrl}
                    download={viewingBillModal.fileName || `Mill-Invoice-${viewingBillModal.billNo || 'doc'}.pdf`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer inline-flex items-center gap-1.5 ml-1"
                    title="Download Bill Document"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setViewingBillModal(null)}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white cursor-pointer ml-1"
                    title="Close (Esc)"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Metadata Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-2.5 rounded-xl bg-neutral-800/50 border border-neutral-800 text-[11px]">
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">PO Reference</span>
                  <p className="font-mono font-bold text-white">#{viewingBillModal.poNumber || '--'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Sub-Order</span>
                  <p className="font-mono font-bold text-amber-400">{viewingBillModal.subOrderNo || '--'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Buyer Consignee</span>
                  <p className="font-bold text-white truncate">{viewingBillModal.buyerName || 'Authorized Buyer'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-neutral-400 font-bold uppercase">Supplier Mill</span>
                  <p className="font-bold text-emerald-400 truncate">{viewingBillModal.millerName || '--'}</p>
                </div>
              </div>

              {/* Document Canvas / PDF Embed */}
              <div className="flex-1 overflow-auto rounded-2xl bg-black/60 p-3 flex items-center justify-center min-h-[360px] sm:min-h-[480px]">
                {viewingBillModal.billUrl.toLowerCase().endsWith('.pdf') ? (
                  <iframe
                    src={viewingBillModal.billUrl}
                    title="Mill Invoice PDF Preview"
                    className="w-full h-full min-h-[460px] rounded-xl border border-neutral-800 bg-white"
                  />
                ) : (
                  <img
                    src={viewingBillModal.billUrl}
                    alt="Authentic Mill Invoice Document"
                    style={{
                      transform: `scale(${billZoom}) rotate(${billRotation}deg)`,
                      transition: 'transform 0.2s ease-out'
                    }}
                    className="max-h-[65vh] object-contain rounded-lg shadow-2xl"
                    onError={(e) => {
                      (e.target as any).style.display = 'none';
                      const parent = (e.target as any).parentNode;
                      if (parent && !parent.querySelector('.fallback-msg')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'fallback-msg text-center text-neutral-400 p-6 space-y-2';
                        fallback.innerHTML = `<p class="font-bold">Document attached: ${viewingBillModal.fileName || 'Mill Tax Invoice'}</p><p class="text-xs">Click the Download button above to view or download.</p>`;
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-neutral-900 text-white text-xs font-bold shadow-xl border border-neutral-700 flex items-center gap-2"
          >
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
