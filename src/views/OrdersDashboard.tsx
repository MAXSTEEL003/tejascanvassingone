import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, TrendingUp, Activity, ChevronRight, MoreVertical, Package, Truck, AlertCircle, Search, Filter, CheckCircle2, ChevronDown, ChevronUp, Plus, PlusCircle, X, Lock, CreditCard, RefreshCw, Trash2, Loader2, Clock, History, Eye, ArrowUpRight, Archive, Copy, MessageSquare, User, Inbox, Check, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AreaChart, Area, XAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { cn, formatINR, getRegisteredSuppliers, getPrimaryRegisteredSupplier, sanitizeSupplierName } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { getCollectionDocs, syncCollection, setCollectionDoc, deleteCollectionDoc, createLedgerEntriesForOrder, db } from '../lib/firebase';
import { doc, deleteDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import SearchableSelect from '../components/SearchableSelect';
import { generateSupplierPOEmailHtml } from '../utils/poEmailTemplate';
import merchantsDirectory from '../data/merchants_directory.json';


const trendData = [
  { name: 'Mon', value: 1200 },
  { name: 'Tue', value: 1800 },
  { name: 'Wed', value: 1400 },
  { name: 'Thu', value: 2400 },
  { name: 'Fri', value: 2100 },
  { name: 'Sat', value: 2800 },
  { name: 'Sun', value: 2600 },
];

// Default base suppliers and buyers fallback
const DEFAULT_SUPPLIERS: { id: string; name: string }[] = [];

const DEFAULT_BUYERS: { id: string; name: string }[] = (merchantsDirectory as any[]).map((b: any) => ({
  id: b.id || `BUY-${b.name}`,
  name: b.name
}));

const BASE_REGISTERED_PRODUCTS: Record<string, string[]> = {};

const orders: any[] = [];

const ARCHIVED_ACCEPTED_ORDERS: any[] = [];

const BUYER_PROFILES_LOOKUP: Record<string, { email: string; phone: string }> = {
  'TEJAS': { email: 'tejasadinarayan@gmail.com', phone: '9945351166' },
  'TEJAS CANVASSING': { email: 'nani@tejasc.in', phone: '9945351166' },
  'TEJAS ADINARAYAN': { email: 'tejasadinarayan@gmail.com', phone: '9945351166' },
  'VISION STORES': { email: 'visionstores@gmail.com', phone: '9945351166' },
};

const SUPPLIER_PROFILES_LOOKUP: Record<string, { email: string; phone: string }> = {};

const resolveBuyerProfile = (buyerName: string) => {
  const norm = (buyerName || '').trim().toUpperCase()
    .replace(/\s*\(LLC\)/gi, '')
    .replace(/\.$/, '');

  try {
    const saved = localStorage.getItem('stakeholders_v2');
    if (saved) {
      const parsed = JSON.parse(saved);
      const buyers = Array.isArray(parsed.buyers) ? parsed.buyers : [];
      const matched = buyers.find((b: any) => {
        const bNorm = (b.name || '').trim().toUpperCase()
          .replace(/\s*\(LLC\)/gi, '')
          .replace(/\.$/, '');
        return bNorm === norm || bNorm.includes(norm) || norm.includes(bNorm);
      });
      if (matched && matched.phone) {
        const cleanPhone = String(matched.phone).replace(/[^0-9]/g, '');
        return {
          email: matched.email || `${(norm || '').toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
          phone: cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone
        };
      }
    }
  } catch (e) {
    console.warn("Error resolving dynamic buyer profile from localStorage:", e);
  }

  try {
    const regReqs = JSON.parse(localStorage.getItem('buyer_registration_requests') || '[]');
    const matchedReq = regReqs.find((b: any) => {
      const bNorm = (b.name || '').trim().toUpperCase();
      return bNorm === norm || bNorm.includes(norm) || norm.includes(bNorm);
    });
    if (matchedReq && matchedReq.phone) {
      const cleanPhone = String(matchedReq.phone).replace(/[^0-9]/g, '');
      return {
        email: matchedReq.email || `${(norm || '').toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
        phone: cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone
      };
    }
  } catch (e) {}

  // Fallback to verified merchants directory
  const dirMatch = (merchantsDirectory as any[]).find((b: any) => {
    const bNorm = (b.name || '').trim().toUpperCase()
      .replace(/\s*\(LLC\)/gi, '')
      .replace(/\.$/, '');
    return bNorm === norm || bNorm.includes(norm) || norm.includes(bNorm);
  });
  if (dirMatch && dirMatch.phone) {
    const cleanPhone = String(dirMatch.phone).replace(/[^0-9]/g, '');
    return {
      email: dirMatch.email || `${(norm || '').toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
      phone: cleanPhone.length >= 10 ? cleanPhone.slice(-10) : cleanPhone
    };
  }

  if (BUYER_PROFILES_LOOKUP[norm]) return BUYER_PROFILES_LOOKUP[norm];
  for (const k of Object.keys(BUYER_PROFILES_LOOKUP)) {
    if (norm.includes(k) || k.includes(norm)) return BUYER_PROFILES_LOOKUP[k];
  }

  const defaultUserPhone = (localStorage.getItem('userPhone') || localStorage.getItem('testWhatsappPhone') || '9945351166').replace(/[^0-9]/g, '').slice(-10);
  return {
    email: `${(norm || '').toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
    phone: defaultUserPhone
  };
};

export const isPendingApproval = (status?: string): boolean => {
  const s = String(status || '').trim().toLowerCase();
  return !s || 
         s === 'pending approval' || 
         s === 'pending' || 
         s === 'awaiting approval' || 
         s === 'pending confirmation' || 
         s === 'pending batch' || 
         s === 'unassigned' || 
         s === 'draft order' || 
         s === 'draft' ||
         s === 'new' || 
         s === 'submitted';
};

export const normalizeOrder = (raw: any): any => {
  if (!raw || typeof raw !== 'object') return raw;

  const buyer = String(
    raw.buyer ||
    raw.requestedBy ||
    raw.buyerName ||
    raw.partyName ||
    raw.customerName ||
    raw.merchantName ||
    raw.user ||
    'Unassigned'
  ).trim();

  const product = String(
    raw.product ||
    raw.productVariety ||
    raw.variety ||
    raw.brand ||
    raw.items ||
    raw.itemName ||
    'Rice Product'
  ).trim();

  const qty = Number(raw.qty ?? raw.quantity ?? raw.volume ?? raw.totalQty ?? 0);
  const rate = Number(raw.rate ?? raw.pricePerUnit ?? raw.agreedRate ?? raw.price ?? raw.unitPrice ?? 0);

  const urgency = String(raw.urgency || raw.priority || raw.priorityTier || 'Standard').trim();
  const color = raw.color || (urgency === 'Critical' ? 'red' : urgency === 'High' ? 'orange' : 'zinc');

  let initials = raw.initials;
  if (!initials && buyer && buyer !== 'Unassigned') {
    const parts = buyer.split(' ').filter(Boolean);
    initials = parts.map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
  }
  if (!initials) initials = 'UB';

  let date = raw.date || raw.orderDate;
  if (!date && raw.createdAt) {
    try {
      date = new Date(raw.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      date = 'Today';
    }
  }
  if (!date) date = 'Today';

  const rawStatus = String(raw.status || '').trim();
  const status = isPendingApproval(rawStatus) ? 'Pending Approval' : (rawStatus || 'Pending Approval');
  let rawSupplier = raw.supplier || raw.millerName || raw.assignedSupplier || '';
  const supplier = sanitizeSupplierName(rawSupplier, 'Pending');

  let orderType = raw.orderType;
  if (!orderType) {
    if (
      String(raw.id || '').toUpperCase().startsWith('MA-') ||
      raw.isManual === true ||
      raw.source === 'manual'
    ) {
      orderType = 'manual';
    } else {
      orderType = 'store';
    }
  }

  return {
    ...raw,
    id: raw.id,
    orderType,
    buyer,
    product,
    qty,
    rate,
    urgency,
    color,
    initials,
    date,
    status,
    supplier,
    loadingDays: raw.loadingDays !== undefined ? raw.loadingDays : 3,
    unloadingPoint: raw.unloadingPoint || 'shop',
    remarks: raw.remarks !== undefined ? raw.remarks : ''
  };
};

const resolveSupplierProfile = (supplierName: string) => {
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

  if (SUPPLIER_PROFILES_LOOKUP[norm]) return SUPPLIER_PROFILES_LOOKUP[norm];
  for (const k of Object.keys(SUPPLIER_PROFILES_LOOKUP)) {
    if (norm.includes(k) || k.includes(norm)) return SUPPLIER_PROFILES_LOOKUP[k];
  }
  return {
    email: `${norm.toLowerCase().replace(/[^a-z0-9]/g, '') || 'supplier'}@gmail.com`,
    phone: '9440188941'
  };
};

export default function OrdersDashboard() {
  const navigate = useNavigate();
  const { setIsOpen } = useCart();
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectionWarning, setSelectionWarning] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [filterOrderType, setFilterOrderType] = useState<'all' | 'manual' | 'store'>('all');
  const [assignedBatchSupplier, setAssignedBatchSupplier] = useState(() => getPrimaryRegisteredSupplier(''));
  const [autoDispatchStatus, setAutoDispatchStatus] = useState<{
    isSending: boolean;
    progress: number;
    logs: string[];
    currentAction: string;
  } | null>(null);
  
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);
  const [merchantHistoryLoading, setMerchantHistoryLoading] = useState(false);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'orders' | 'payments'>('orders');
  const [showPendingPaymentsOnly, setShowPendingPaymentsOnly] = useState(true);
  const [showArrivedOrdersOnly, setShowArrivedOrdersOnly] = useState(false);
  const [merchantHistory, setMerchantHistory] = useState<{
    orders: any[];
    payments: any[];
    profile: any;
  } | null>(null);

  const [arrivalEntries, setArrivalEntries] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('arrival_entry_data_v4');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    async function loadArrivalEntries() {
      try {
        const localArrivals = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
        const cloudArrivals = await getCollectionDocs('arrival_entries').catch(() => []);
        
        let finalArr = [...localArrivals];
        if (cloudArrivals && cloudArrivals.length > 0) {
          const grid = Array(Math.max(30, cloudArrivals.length, localArrivals.length)).fill(0).map((_, i) => {
            return localArrivals[i] || {};
          });
          cloudArrivals.forEach(row => {
            const idx = parseInt(row.id?.replace('row-', '') || '');
            if (!isNaN(idx) && idx >= 0) {
              const { id, ...cloudRow } = row;
              const localRow = grid[idx];

              const isCloudReal = !!(cloudRow.partyName || cloudRow.millerName || cloudRow.billNo);
              const isLocalReal = !!(localRow && (localRow.partyName || localRow.millerName || localRow.billNo));

              let shouldOverwrite = false;
              if (!isLocalReal && isCloudReal) {
                shouldOverwrite = true;
              } else if (isLocalReal && isCloudReal) {
                const localTime = localRow.lastUpdated ? new Date(localRow.lastUpdated).getTime() : 0;
                const cloudTime = cloudRow.lastUpdated ? new Date(cloudRow.lastUpdated).getTime() : 0;
                if (cloudTime > localTime || !localRow.lastUpdated) {
                  shouldOverwrite = true;
                }
              } else if (!isLocalReal && !isCloudReal) {
                shouldOverwrite = true;
              }

              if (shouldOverwrite) {
                grid[idx] = row;
              }
            }
          });
          finalArr = grid.filter(g => g && Object.keys(g).length > 0);
        }
        setArrivalEntries(finalArr);
      } catch (e) {
        console.warn("Failed to load arrival entries:", e);
      }
    }
    loadArrivalEntries();
  }, []);

  const getOrderBillNo = (orderId: string) => {
    const matchingArrival = arrivalEntries.find(row => 
      row && row.purchaseOrderNo && String(row.purchaseOrderNo).trim() === String(orderId).trim()
    );
    return matchingArrival?.billNo || orderId;
  };

  const handleOpenMerchantModal = async (buyerName: string) => {
    setSelectedMerchant(buyerName);
    setMerchantHistoryLoading(true);
    setActiveHistoryTab('orders');
    setShowPendingPaymentsOnly(true); // Reset to pending only by default
    setShowArrivedOrdersOnly(false); // Reset to all orders initially
    
    let profile: any = { 
      name: buyerName, 
      email: `${(buyerName || '').toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`, 
      phone: resolveBuyerProfile(buyerName).phone ? `+91 ${resolveBuyerProfile(buyerName).phone.replace(/^91/, '')}` : '+91 99453 51166', 
      address: 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022', 
      gstin: '29AAGCV7712M1ZP' 
    };

    try {
      const savedStakeholders = JSON.parse(localStorage.getItem('stakeholders_v2') || '{}');
      const buyers = savedStakeholders.buyers || [];
      const matched = buyers.find((b: any) => b.name?.trim().toUpperCase() === buyerName.trim().toUpperCase());
      if (matched) {
        profile = matched;
      } else {
        const cloudStakeholders = await getCollectionDocs('stakeholders').catch(() => []);
        const matchedCloud = cloudStakeholders.find((b: any) => b.name?.trim().toUpperCase() === buyerName.trim().toUpperCase());
        if (matchedCloud) {
          profile = matchedCloud;
        }
      }
    } catch (e) {
      console.warn("Failed to load profile for merchant:", e);
    }

    let allOrdersList: any[] = [];
    try {
      const localRequests = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
      const cloudRequests = await getCollectionDocs('procurement_requests').catch(() => []);
      const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);
      
      const combined = [...localRequests, ...cloudRequests, ...localPlaced, ...cloudPlaced];
      const unique = Array.from(new Map(combined.map(item => [item.id, item])).values()).map(normalizeOrder);
      allOrdersList = unique;
    } catch (e) {
      console.warn("Failed to load orders for merchant history:", e);
    }

    const merchantOrders = allOrdersList.filter(o => 
      o.buyer && o.buyer.trim().toUpperCase() === buyerName.trim().toUpperCase()
    );

    let merchantPaymentsList: any[] = [];
    try {
      // 1. Fetch physical cargo entries
      const localArrivals = JSON.parse(localStorage.getItem('arrival_entry_data_v4') || '[]');
      const cloudArrivals = await getCollectionDocs('arrival_entries').catch(() => []);
      
      let finalArr = [...localArrivals];
      if (cloudArrivals && cloudArrivals.length > 0) {
        const grid = Array(Math.max(30, cloudArrivals.length, localArrivals.length)).fill(0).map((_, i) => {
          return localArrivals[i] || {};
        });
        cloudArrivals.forEach(row => {
          const idx = parseInt(row.id?.replace('row-', '') || '');
          if (!isNaN(idx) && idx >= 0) {
            const { id, ...cloudRow } = row;
            const localRow = grid[idx];

            const isCloudReal = !!(cloudRow.partyName || cloudRow.millerName || cloudRow.billNo);
            const isLocalReal = !!(localRow && (localRow.partyName || localRow.millerName || localRow.billNo));

            let shouldOverwrite = false;
            if (!isLocalReal && isCloudReal) {
              shouldOverwrite = true;
            } else if (isLocalReal && isCloudReal) {
              const localTime = localRow.lastUpdated ? new Date(localRow.lastUpdated).getTime() : 0;
              const cloudTime = cloudRow.lastUpdated ? new Date(cloudRow.lastUpdated).getTime() : 0;
              if (cloudTime > localTime || !localRow.lastUpdated) {
                shouldOverwrite = true;
              }
            } else if (!isLocalReal && !isCloudReal) {
              shouldOverwrite = true;
            }

            if (shouldOverwrite) {
              grid[idx] = row;
            }
          }
        });
        finalArr = grid.filter(g => g && Object.keys(g).length > 0);
      }

      // 2. Fetch trade orders (placed_orders)
      const localPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const cloudPlaced = await getCollectionDocs('placed_orders').catch(() => []);
      const combinedPlaced = [...localPlaced, ...cloudPlaced];
      const uniquePlaced = Array.from(new Map(combinedPlaced.map(item => [item.id, item])).values());

      // Filter and map consolidated arrived orders/cargo
      const activeArrivals = finalArr.filter(row => row && (row.partyName || row.millerName || row.billNo || row.qty));
      
      const consolidatedPayments = activeArrivals.map((row, index) => {
        // Find matching placed order
        const matchingOrder = uniquePlaced.find((p: any) => {
          if (!p) return false;
          if (row.purchaseOrderNo && String(row.purchaseOrderNo).trim() === String(p.id).trim()) {
            return true;
          }
          if (row.billNo && p.billNo && String(row.billNo).trim().toLowerCase() === String(p.billNo).trim().toLowerCase()) {
            return true;
          }
          const rowParty = String(row.partyName || '').toLowerCase().trim();
          const rowMiller = String(row.millerName || '').toLowerCase().trim();
          const orderBuyer = String(p.buyer || '').toLowerCase().trim();
          const orderSupplier = String(p.supplier || '').toLowerCase().trim();

          if (rowParty && orderBuyer && rowMiller && orderSupplier) {
            const partyMatch = rowParty.includes(orderBuyer) || orderBuyer.includes(rowParty);
            const millerMatch = rowMiller.includes(orderSupplier) || orderSupplier.includes(rowMiller);
            if (partyMatch && millerMatch) {
              return true;
            }
          }
          return false;
        });

        const buyer = row.partyName || matchingOrder?.buyer || 'Not Assigned';

        // Check if this row is for the requested buyer
        if (buyer.trim().toUpperCase() !== buyerName.trim().toUpperCase()) {
          return null;
        }

        const calculatedNet = parseFloat(row.netAmt) || parseFloat(row.amount) || ((parseFloat(row.qty) || 0) * (parseFloat(row.rate) || 0)) || 0;
        const isCleared = row.noOfDayRec === 'Cleared' || (matchingOrder && (matchingOrder.paymentStatus === 'Received' || matchingOrder.paymentStatus === 'Settled'));
        
        let daysOld = 0;
        if (row.date) {
          const arrDate = new Date(row.date);
          if (!isNaN(arrDate.getTime())) {
            arrDate.setHours(0, 0, 0, 0);
            if (isCleared && row.chqDt) {
              const chqDate = new Date(row.chqDt);
              if (!isNaN(chqDate.getTime())) {
                chqDate.setHours(0, 0, 0, 0);
                const diffTime = chqDate.getTime() - arrDate.getTime();
                daysOld = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
              }
            } else {
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const diffTime = today.getTime() - arrDate.getTime();
              daysOld = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
            }
          }
        }

        const cleanId = row.billNo 
          ? String(row.billNo).trim().replace(/^(bill[-.\s]*|bil[-.\s]*|tc[-.\s]*|invoice[-.\s]*)/i, '') 
          : (matchingOrder?.billNo 
              ? String(matchingOrder.billNo).trim().replace(/^(bill[-.\s]*|bil[-.\s]*|tc[-.\s]*|invoice[-.\s]*)/i, '') 
              : (matchingOrder?.id || `PT-${index + 1001}`));

        return {
          id: cleanId,
          date: row.date || matchingOrder?.date || 'N/A',
          product: row.variety || row.brand || matchingOrder?.product || 'Premium Rice',
          qty: parseFloat(row.qty) || 0,
          rate: parseFloat(row.rate) || 0,
          amount: calculatedNet,
          status: isCleared ? 'Cleared' : 'Pending Settlement',
          type: matchingOrder ? 'Trade Order' : 'Physical Cargo',
          daysOld: daysOld
        };
      }).filter((txn): txn is any => txn !== null);

      merchantPaymentsList = consolidatedPayments;
    } catch (e) {
      console.warn("Failed to load payment history:", e);
    }

    setMerchantHistory({
      orders: merchantOrders,
      payments: merchantPaymentsList,
      profile
    });
    setMerchantHistoryLoading(false);
  };

  const [newOrder, setNewOrder] = useState({
    buyer: '',
    phone: '',
    supplier: '',
    product: '',
    qty: '',
    rate: '',
    urgency: 'Standard' as 'Critical' | 'Standard' | 'High',
    loadingDays: 3,
    unloadingPoint: 'shop',
    remarks: ''
  });

  const [editingLogisticsId, setEditingLogisticsId] = useState<string | null>(null);
  const [editLogisticsDays, setEditLogisticsDays] = useState<number>(3);
  const [editLogisticsPoint, setEditLogisticsPoint] = useState<string>('shop');
  const [editLogisticsRemarks, setEditLogisticsRemarks] = useState<string>('');

  const handleSaveOrderLogistics = (orderId: string) => {
    const updated = currentOrders.map(o => {
      if (String(o.id) === String(orderId)) {
        return {
          ...o,
          loadingDays: editLogisticsDays,
          unloadingPoint: editLogisticsPoint,
          remarks: editLogisticsRemarks.trim()
        };
      }
      return o;
    });
    setCurrentOrders(updated);
    try {
      const raw = localStorage.getItem('procurement_requests');
      if (raw) {
        const saved = JSON.parse(raw);
        const nextSaved = saved.map((o: any) => 
          String(o.id) === String(orderId) ? { ...o, loadingDays: editLogisticsDays, unloadingPoint: editLogisticsPoint, remarks: editLogisticsRemarks.trim() } : o
        );
        localStorage.setItem('procurement_requests', JSON.stringify(nextSaved));
      }
      const targetOrder = updated.find(o => String(o.id) === String(orderId));
      if (targetOrder) {
        setCollectionDoc('procurement_requests', orderId, targetOrder).catch(() => {});
      }
    } catch (e) {
      console.warn("Error saving order logistics:", e);
    }
    setEditingLogisticsId(null);
  };

  const [inventoryProducts, setInventoryProducts] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('product_inventory');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((p: any) => p && p.id && !String(p.id).toLowerCase().startsWith('prod-'));
        }
      }
    } catch {}
    return [];
  });
  const [availableSuppliers, setAvailableSuppliers] = useState<{ id: string; name: string }[]>(DEFAULT_SUPPLIERS);
  const [availableBuyers, setAvailableBuyers] = useState<{ id: string; name: string }[]>(DEFAULT_BUYERS);

  // Load registered stakeholders (Suppliers and Buyers)
  useEffect(() => {
    async function loadStakeholders() {
      try {
        const rawDeleted = localStorage.getItem('deleted_stakeholder_ids');
        const deletedIds: string[] = rawDeleted ? JSON.parse(rawDeleted) : [];
        const deletedSet = new Set(
          deletedIds
            .map(id => String(id).trim().toLowerCase().replace(/^#/, ''))
            .filter(id => id !== 'sup-01' && id !== 'buy-01')
        );

        const cached = JSON.parse(localStorage.getItem('stakeholders_v2') || 'null');
        const regSuppliers = JSON.parse(localStorage.getItem('registered_suppliers') || '[]');
        const cloudDocs = await getCollectionDocs('stakeholders').catch(() => []);

        const supMap = new Map<string, { id: string; name: string }>();
        const buyMap = new Map<string, { id: string; name: string }>();

        // Cached local stakeholders
        if (cached) {
          (cached.suppliers || []).forEach((s: any) => {
            if (s && s.name && !deletedSet.has(String(s.id || '').toLowerCase())) {
              supMap.set(s.name.trim().toUpperCase(), { id: s.id || `SUP-${Date.now()}`, name: s.name.trim() });
            }
          });
          (cached.buyers || []).forEach((b: any) => {
            if (b && b.name && !deletedSet.has(String(b.id || '').toLowerCase())) {
              buyMap.set(b.name.trim().toUpperCase(), { id: b.id || `BUY-${Date.now()}`, name: b.name.trim() });
            }
          });
        }

        if (Array.isArray(regSuppliers)) {
          regSuppliers.forEach((s: any) => {
            if (s && s.name && !deletedSet.has(String(s.id || '').toLowerCase())) {
              supMap.set(s.name.trim().toUpperCase(), { id: s.id || `SUP-${Date.now()}`, name: s.name.trim() });
            }
          });
        }

        if (supMap.size > 0) setAvailableSuppliers(Array.from(supMap.values()));
        if (buyMap.size > 0) setAvailableBuyers(Array.from(buyMap.values()));

        // Cloud Firestore stakeholders
        if (cloudDocs && cloudDocs.length > 0) {
          cloudDocs.forEach((d: any) => {
            if (!d || !d.name || deletedSet.has(String(d.id || '').toLowerCase())) return;
            const type = d.type || (d.id?.startsWith('SUP') ? 'suppliers' : 'buyers');
            if (type === 'suppliers') {
              supMap.set(d.name.trim().toUpperCase(), { id: d.id || `SUP-${Date.now()}`, name: d.name.trim() });
            } else if (type === 'buyers') {
              buyMap.set(d.name.trim().toUpperCase(), { id: d.id || `BUY-${Date.now()}`, name: d.name.trim() });
            }
          });
        }

        // Automatically incorporate full 547 APMC merchants directory so all buyers are always available
        try {
          if (Array.isArray(merchantsDirectory) && merchantsDirectory.length > 0) {
            merchantsDirectory.forEach((b: any) => {
              if (b && b.name && !deletedSet.has(String(b.id || '').toLowerCase())) {
                const normName = b.name.trim().toUpperCase();
                if (!buyMap.has(normName)) {
                  buyMap.set(normName, { id: b.id || `BUY-${Date.now()}`, name: b.name.trim() });
                }
              }
            });
            const currentStakeholders = JSON.parse(localStorage.getItem('stakeholders_v2') || '{}');
            if (!currentStakeholders.buyers || currentStakeholders.buyers.length < merchantsDirectory.length) {
              const nextStakeholders = {
                ...currentStakeholders,
                buyers: merchantsDirectory,
                suppliers: currentStakeholders.suppliers || Array.from(supMap.values()),
                employees: currentStakeholders.employees || []
              };
              localStorage.setItem('stakeholders_v2', JSON.stringify(nextStakeholders));
            }
          }
        } catch (e) {
          console.warn("Auto-loading merchants directory in OrdersDashboard:", e);
        }

        // Only incorporate inventory suppliers if no suppliers registered yet
        if (supMap.size === 0) {
          const localInv = JSON.parse(localStorage.getItem('product_inventory') || '[]');
          localInv.forEach((p: any) => {
            if (p && p.supplier && p.supplier.trim()) {
              const norm = p.supplier.trim().toUpperCase();
              if (!supMap.has(norm)) {
                supMap.set(norm, { id: `SUP-INV-${Math.random().toString(36).substr(2, 4)}`, name: p.supplier.trim() });
              }
            }
          });
        }

        const loadedSuppliers = Array.from(supMap.values());
        setAvailableSuppliers(loadedSuppliers);
        setAvailableBuyers(Array.from(buyMap.values()));
        if (loadedSuppliers.length > 0) {
          setAssignedBatchSupplier(loadedSuppliers[0].name);
        }
      } catch (e) {
        console.warn("Failed to load stakeholders in OrdersDashboard:", e);
      }
    }
    loadStakeholders();
  }, []);

  useEffect(() => {
    async function loadInventory() {
      try {
        let deletedSet = new Set<string>();
        try {
          const rawDel = localStorage.getItem('deleted_product_inventory_ids');
          if (rawDel) {
            const arr = JSON.parse(rawDel);
            if (Array.isArray(arr)) {
              arr.forEach(id => {
                const s = String(id).trim().toLowerCase();
                deletedSet.add(s);
                deletedSet.add(s.replace(/^#/, ''));
              });
            }
          }
        } catch (e) {}

        const isDeleted = (p: any) => {
          if (!p || !p.id) return true;
          const pid = String(p.id || '').trim().toLowerCase().replace(/^#/, '');
          const pName = String(p.name || '').trim().toLowerCase();
          if (pid.startsWith('prod-')) return true;
          return deletedSet.has(pid) || deletedSet.has(pName);
        };

        const cloudInv = (await getCollectionDocs('product_inventory').catch(() => []))
          .filter((p: any) => !isDeleted(p));
        const localInv = JSON.parse(localStorage.getItem('product_inventory') || '[]')
          .filter((p: any) => !isDeleted(p));

        const uniqueMap = new Map();
        localInv.forEach((p: any) => {
          if (p && p.id) {
            uniqueMap.set(p.id, p);
          }
        });
        cloudInv.forEach((p: any) => {
          if (p && p.id) {
            const existing = uniqueMap.get(p.id) || {};
            uniqueMap.set(p.id, { ...existing, ...p });
          }
        });
        setInventoryProducts(Array.from(uniqueMap.values()));
      } catch (e) {
        console.warn("Failed to load product inventory in OrdersDashboard:", e);
      }
    }

    loadInventory();

    const handleInventoryChange = () => {
      loadInventory();
    };

    window.addEventListener('storage', handleInventoryChange);
    window.addEventListener('inventory-updated', handleInventoryChange);
    return () => {
      window.removeEventListener('storage', handleInventoryChange);
      window.removeEventListener('inventory-updated', handleInventoryChange);
    };
  }, []);

  // Helper to extract brands strictly registered for a specific supplier
  const getBrandsForSupplier = (supplierName: string): string[] => {
    const rawSupplier = (supplierName || '').trim().toUpperCase();
    if (!rawSupplier) return [];

    const normSupplier = rawSupplier
      .replace(/\s*\(LLC\)/gi, '')
      .replace(/\s*PVT\.?\s*LTD\.?/gi, '')
      .replace(/\s*\(P\)\s*LTD\.?/gi, '')
      .replace(/[^A-Z0-9]/g, '');

    const brandSet = new Set<string>();

    // Get deleted inventory IDs/names
    let deletedSet = new Set<string>();
    try {
      const rawDel = localStorage.getItem('deleted_product_inventory_ids');
      if (rawDel) {
        const arr = JSON.parse(rawDel);
        if (Array.isArray(arr)) {
          arr.forEach(id => {
            const s = String(id).trim().toLowerCase();
            deletedSet.add(s);
            deletedSet.add(s.replace(/^#/, ''));
          });
        }
      }
    } catch (e) {}

    // 1. From dynamic inventoryProducts (products explicitly registered for this supplier)
    const matchingProducts = inventoryProducts.filter(p => {
      if (!p) return false;
      const pid = String(p.id || '').trim().toLowerCase().replace(/^#/, '');
      const pName = String(p.name || '').trim().toLowerCase();
      if (deletedSet.has(pid) || deletedSet.has(pName)) return false;

      const itemSupplier = (p.supplier || '').trim().toUpperCase()
        .replace(/\s*\(LLC\)/gi, '')
        .replace(/\s*PVT\.?\s*LTD\.?/gi, '')
        .replace(/\s*\(P\)\s*LTD\.?/gi, '')
        .replace(/[^A-Z0-9]/g, '');

      if (!itemSupplier) return false;
      return itemSupplier === normSupplier;
    });

    matchingProducts.forEach(p => {
      const brandName = (p.name || p.brand || '').trim();
      if (brandName) brandSet.add(brandName);
    });

    return Array.from(brandSet).sort();
  };

  // Brands available for currently selected supplier in newOrder
  const availableBrands = useMemo(() => {
    if (!newOrder.supplier) return [];
    return getBrandsForSupplier(newOrder.supplier);
  }, [newOrder.supplier, inventoryProducts]);

  // Handler when supplier changes in create order modal
  const handleSupplierChange = (supplierVal: string) => {
    const validBrands = getBrandsForSupplier(supplierVal);
    const isCurrentProductValid = validBrands.some(b => (b || '').toLowerCase() === (newOrder.product || '').toLowerCase());

    setNewOrder(prev => ({
      ...prev,
      supplier: supplierVal,
      product: isCurrentProductValid ? prev.product : '' // Reset product if invalid for new supplier
    }));
  };

  // Helpers to track persistently deleted order IDs
  const getDeletedProcurementIds = (): Set<string> => {
    try {
      const raw = localStorage.getItem('deleted_procurement_ids');
      if (!raw) return new Set();
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return new Set(arr.map((id: string) => String(id).trim().toLowerCase().replace(/^#/, '')));
      }
    } catch (e) {}
    return new Set();
  };

  const addDeletedProcurementIds = (ids: string[]) => {
    try {
      const current = getDeletedProcurementIds();
      ids.forEach(id => {
        const norm = String(id).trim().toLowerCase().replace(/^#/, '');
        if (norm) current.add(norm);
      });
      localStorage.setItem('deleted_procurement_ids', JSON.stringify(Array.from(current)));
    } catch (e) {}
  };

  const removeDeletedProcurementId = (id: string) => {
    try {
      const current = getDeletedProcurementIds();
      const norm = String(id).trim().toLowerCase().replace(/^#/, '');
      if (current.has(norm)) {
        current.delete(norm);
        localStorage.setItem('deleted_procurement_ids', JSON.stringify(Array.from(current)));
      }
    } catch (e) {}
  };

  // Load from localStorage (strictly active procurement requests)
  const [currentOrders, setCurrentOrders] = useState(() => {
    const deletedSet = getDeletedProcurementIds();
    let saved: any[] = [];
    try {
      const raw = localStorage.getItem('procurement_requests');
      saved = raw ? JSON.parse(raw) : [];
    } catch {}

    if (saved.length > 0) {
      localStorage.removeItem('cleared_procurement_requests');
    }

    return saved
      .filter((o: any) => {
        if (!o || !o.id) return false;
        if (
          o.status === 'Approved' || 
          o.status === 'Accepted' || 
          o.status === 'Rejected' || 
          o.status === 'Completed' || 
          o.status === 'Archived' || 
          o.isArchived || 
          String(o.id).startsWith('#ORD-99') || 
          String(o.id).startsWith('TC-0000')
        ) return false;
        const oNorm = String(o.id || '').trim().toLowerCase().replace(/^#/, '');
        return !deletedSet.has(oNorm);
      })
      .map(normalizeOrder);
  });

  // Dynamic statistics calculations
  const activeOrdersCount = currentOrders.length;
  const approvalPendingCount = currentOrders.filter((o: any) => isPendingApproval(o.status)).length;
  const averageQtySold = currentOrders.length > 0 
    ? (currentOrders.reduce((sum: number, o: any) => sum + (Number(o.qty) || 0), 0) / currentOrders.length).toFixed(1) 
    : '0.0';
  const totalPendingPayments = currentOrders
    .filter((o: any) => isPendingApproval(o.status))
    .reduce((sum: number, o: any) => sum + ((Number(o.qty) || 0) * (Number(o.rate) || 0)), 0);

  const stats = [
    { label: 'Active Orders', value: `${activeOrdersCount}`, sub: 'Registered intents', icon: ShoppingCart, color: 'text-primary' },
    { label: 'Approval Pending', value: `${approvalPendingCount}`, sub: 'Awaiting clearance', icon: AlertCircle, color: 'text-amber-500' },
    { label: 'Average Quantity Sold Today', value: `${averageQtySold} QTLS`, sub: 'Per transaction volume', icon: TrendingUp, color: 'text-emerald-500' },
    { label: 'Pending Payments', value: `₹ ${formatINR(totalPendingPayments)}`, sub: 'Outstanding cycle value', icon: CreditCard, color: 'text-blue-500' },
  ];

  // Sync with Firestore in Real-Time for Active Orders, seamlessly merging with local changes
  useEffect(() => {
    let isMounted = true;
    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = onSnapshot(collection(db, 'procurement_requests'), (snapshot) => {
        if (!isMounted) return;
        const deletedSet = getDeletedProcurementIds();
        const cloudOrdersMap = new Map<string, any>();
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (
            data && 
            data.status !== 'Approved' &&
            data.status !== 'Accepted' &&
            data.status !== 'Rejected' && 
            data.status !== 'Completed' && 
            data.status !== 'Archived' && 
            !data.isArchived && 
            !String(doc.id).startsWith('#ORD-99') && 
            !String(doc.id).startsWith('TC-0000')
          ) {
            const rawObj = normalizeOrder({ id: doc.id, ...data });
            const normKey = String(rawObj.id || doc.id).trim().toLowerCase().replace(/^#/, '');
            if (!deletedSet.has(normKey) && !cloudOrdersMap.has(normKey)) {
              cloudOrdersMap.set(normKey, rawObj);
            }
          }
        });

        // Read local storage orders as well to merge
        let localSaved: any[] = [];
        try {
          localSaved = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
        } catch {}

        if (localSaved.length > 0) {
          localStorage.removeItem('cleared_procurement_requests');
        }

        // Merge cloud and local
        const mergedMap = new Map<string, any>();
        // Add cloud orders
        cloudOrdersMap.forEach((ord, key) => mergedMap.set(key, ord));

        // Add local orders that are not in cloud yet
        localSaved.forEach((raw: any) => {
          if (!raw || !raw.id) return;
          const normKey = String(raw.id).trim().toLowerCase().replace(/^#/, '');
          if (deletedSet.has(normKey)) return;
          if (
            raw.status === 'Approved' ||
            raw.status === 'Accepted' ||
            raw.status === 'Rejected' || 
            raw.status === 'Completed' || 
            raw.status === 'Archived' || 
            raw.isArchived
          ) return;
          if (String(raw.id).startsWith('#ORD-99') || String(raw.id).startsWith('TC-0000')) return;

          if (!mergedMap.has(normKey)) {
            mergedMap.set(normKey, normalizeOrder(raw));
          }
        });

        const mergedList = Array.from(mergedMap.values());
        if (mergedList.length > 0 || localStorage.getItem('cleared_procurement_requests') === 'true') {
          setCurrentOrders(mergedList);
          if (mergedList.length > 0) {
            localStorage.setItem('procurement_requests', JSON.stringify(mergedList));
          }
        }
      }, (err) => {
        console.warn('Real-time subscription notice in OrdersDashboard:', err?.message || err);
      });

      if (!isMounted && unsubscribe) {
        unsubscribe();
      }
    } catch (err) {
      console.warn('Real-time subscription setup notice:', err);
    }
    
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Listen for storage & procurement sync events across tabs / components
  useEffect(() => {
    const handleProcurementSync = () => {
      const deletedSet = getDeletedProcurementIds();
      let localSaved: any[] = [];
      try {
        localSaved = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
      } catch {}

      if (localSaved.length > 0) {
        localStorage.removeItem('cleared_procurement_requests');
      }

      setCurrentOrders(prev => {
        const mergedMap = new Map<string, any>();
        prev.forEach(o => {
          if (!o || !o.id) return;
          if (
            o.status === 'Approved' ||
            o.status === 'Accepted' ||
            o.status === 'Rejected' || 
            o.status === 'Completed' || 
            o.status === 'Archived' || 
            o.isArchived
          ) return;
          const normKey = String(o.id).trim().toLowerCase().replace(/^#/, '');
          if (!deletedSet.has(normKey)) mergedMap.set(normKey, o);
        });

        localSaved.forEach((raw: any) => {
          if (!raw || !raw.id) return;
          const normKey = String(raw.id).trim().toLowerCase().replace(/^#/, '');
          if (deletedSet.has(normKey)) return;
          if (
            raw.status === 'Approved' ||
            raw.status === 'Accepted' ||
            raw.status === 'Rejected' || 
            raw.status === 'Completed' || 
            raw.status === 'Archived' || 
            raw.isArchived
          ) return;
          if (String(raw.id).startsWith('#ORD-99') || String(raw.id).startsWith('TC-0000')) return;

          if (!mergedMap.has(normKey)) {
            mergedMap.set(normKey, normalizeOrder(raw));
          }
        });

        return Array.from(mergedMap.values());
      });
    };

    window.addEventListener('storage', handleProcurementSync);
    window.addEventListener('procurement-updated', handleProcurementSync);
    return () => {
      window.removeEventListener('storage', handleProcurementSync);
      window.removeEventListener('procurement-updated', handleProcurementSync);
    };
  }, []);

  useEffect(() => {
    const handleGotoSearch = () => {
      const pendingQuery = sessionStorage.getItem('goto_search_query');
      if (pendingQuery) {
        setSearchQuery(pendingQuery);
        sessionStorage.removeItem('goto_search_query');
      }
    };
    handleGotoSearch(); // check on mount
    window.addEventListener('goto-search-event', handleGotoSearch);
    return () => window.removeEventListener('goto-search-event', handleGotoSearch);
  }, []);

  // Synchronize assigned batch supplier with selected orders
  useEffect(() => {
    if (selectedOrders.length > 0) {
      const firstSelectedId = selectedOrders[0];
      const selectedOrderObj = currentOrders.find(o => o.id === firstSelectedId);
      if (selectedOrderObj) {
        const supplierVal = sanitizeSupplierName(selectedOrderObj.supplier, availableSuppliers[0]?.name || 'DIRECT MILL');
        setAssignedBatchSupplier(supplierVal);
      }
    }
  }, [selectedOrders, currentOrders]);

  const parseCustomDate = (obj: any): number => {
    if (!obj) return 0;
    const dateStr = obj.purchaseOrderSentAt || obj.createdAt || obj.date;
    if (!dateStr) return 0;
    if (typeof dateStr === 'number') return dateStr;
    const parsed = Date.parse(dateStr);
    if (!isNaN(parsed)) return parsed;
    return 0;
  };

  const filteredOrders = useMemo(() => {
    const query = (searchQuery || '').toLowerCase();
    return currentOrders.filter(order => {
      if (!order) return false;
      const buyerStr = typeof order.buyer === 'string' ? order.buyer : '';
      const idStr = typeof order.id === 'string' ? order.id : '';
      const matchesSearch = buyerStr.toLowerCase().includes(query) || 
                           idStr.toLowerCase().includes(query);
      const matchesSupplier = filterSupplier === '' || (order as any).supplier === filterSupplier;
      const matchesProduct = filterProduct === '' || (order as any).product === filterProduct;
      const matchesOrderType = filterOrderType === 'all' || (order as any).orderType === filterOrderType;
      
      return matchesSearch && matchesSupplier && matchesProduct && matchesOrderType;
    }).sort((a, b) => {
      const timeA = parseCustomDate(a);
      const timeB = parseCustomDate(b);
      if (timeA !== timeB) return timeB - timeA;
      return String(b.id || '').localeCompare(String(a.id || ''));
    });
  }, [currentOrders, searchQuery, filterSupplier, filterProduct, filterOrderType]);

  const handleAction = async (id: string, action: 'accept' | 'reject') => {
    setActionLoadingId(id);
    try {
      const nextStatus = action === 'accept' ? 'Approved' : 'Rejected';
      const orderToUpdate = currentOrders.find(o => o.id === id);
      const nowIso = new Date().toISOString();
      const updatedOrder = orderToUpdate 
        ? { 
            ...orderToUpdate, 
            status: nextStatus, 
            isArchived: true, 
            approvedAt: action === 'accept' ? nowIso : undefined, 
            rejectedAt: action === 'reject' ? nowIso : undefined 
          }
        : null;

      // 1. Immediately remove from active currentOrders (Active Procurement Requests)
      const nextOrders = currentOrders.filter(o => o.id !== id);
      setCurrentOrders(nextOrders);
      localStorage.setItem('procurement_requests', JSON.stringify(nextOrders));

      // 2. Add to local archivedOrders list immediately so it is available in Archived Orders
      if (updatedOrder) {
        const normKey = String(updatedOrder.id).trim().toLowerCase().replace(/^#/, '');
        setArchivedOrders(prev => [
          normalizeOrder(updatedOrder),
          ...prev.filter(o => String(o.id).trim().toLowerCase().replace(/^#/, '') !== normKey)
        ]);
      }

      // 3. Persist update to Firestore procurement_requests
      if (updatedOrder) {
        await setCollectionDoc('procurement_requests', id, updatedOrder);
      }

      // 4. If accepted/approved, ALSO save into placed_orders so Placed Orders views show it immediately across all devices
      if (action === 'accept' && updatedOrder) {
        const placedDoc = {
          ...updatedOrder,
          status: 'Approved',
          progress: 35,
          placedAt: nowIso,
          date: updatedOrder.date || (() => {
            const d = new Date();
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${d.getDate()}-${monthNames[d.getMonth()]}-${d.getFullYear()}`;
          })()
        };
        await setCollectionDoc('placed_orders', id, placedDoc);

        // Also add to local placed_orders in localStorage
        try {
          const rawPlaced = localStorage.getItem('placed_orders');
          const currentPlaced = rawPlaced ? JSON.parse(rawPlaced) : [];
          const normKey = String(id).trim().toLowerCase().replace(/^#/, '');
          const filteredPlaced = currentPlaced.filter((p: any) => String(p.id).trim().toLowerCase().replace(/^#/, '') !== normKey);
          localStorage.setItem('placed_orders', JSON.stringify([placedDoc, ...filteredPlaced]));
        } catch {}
      }
    } catch (err) {
      console.error('Failed to update action in database:', err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    setActionLoadingId(id);
    const normKey = String(id).trim().toLowerCase().replace(/^#/, '');

    addDeletedProcurementIds([id]);

    setCurrentOrders(prev => prev.filter(o => {
      const oNorm = String(o.id || '').trim().toLowerCase().replace(/^#/, '');
      return oNorm !== normKey;
    }));

    setSelectedOrders(prev => prev.filter(sId => String(sId).trim().toLowerCase().replace(/^#/, '') !== normKey));

    const savedProc = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
    const updatedProc = savedProc.filter((o: any) => {
      const oNorm = String(o.id || '').trim().toLowerCase().replace(/^#/, '');
      return oNorm !== normKey;
    });
    localStorage.setItem('procurement_requests', JSON.stringify(updatedProc));
    if (updatedProc.length === 0) {
      localStorage.setItem('cleared_procurement_requests', 'true');
    }

    try {
      await deleteCollectionDoc('procurement_requests', id);
    } catch (err) {
      console.error("Failed to delete order from Firestore:", err);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteSelectedOrders = async () => {
    if (selectedOrders.length === 0) return;
    if (!window.confirm(`Are you sure you want to remove the ${selectedOrders.length} selected order(s) from the dashboard?`)) return;

    const selectedNormSet = new Set(selectedOrders.map(s => String(s).trim().toLowerCase().replace(/^#/, '')));

    addDeletedProcurementIds(selectedOrders);

    setCurrentOrders(prev => prev.filter(o => {
      const oNorm = String(o.id || '').trim().toLowerCase().replace(/^#/, '');
      return !selectedNormSet.has(oNorm);
    }));

    const savedProc = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
    const updatedProc = savedProc.filter((o: any) => {
      const oNorm = String(o.id || '').trim().toLowerCase().replace(/^#/, '');
      return !selectedNormSet.has(oNorm);
    });
    localStorage.setItem('procurement_requests', JSON.stringify(updatedProc));
    if (updatedProc.length === 0) {
      localStorage.setItem('cleared_procurement_requests', 'true');
    }

    try {
      await Promise.allSettled(
        selectedOrders.map(id => deleteCollectionDoc('procurement_requests', id))
      );
    } catch (err) {
      console.error("Failed to delete selected orders from Firestore:", err);
    }

    setSelectedOrders([]);
  };

  const handleClearAllOrders = async () => {
    if (currentOrders.length === 0) return;
    if (!window.confirm(`Are you sure you want to remove all ${currentOrders.length} order(s) from the dashboard?`)) return;

    const allIds = currentOrders.map(o => o.id);
    addDeletedProcurementIds(allIds);

    setCurrentOrders([]);
    setSelectedOrders([]);
    localStorage.setItem('procurement_requests', JSON.stringify([]));
    localStorage.setItem('cleared_procurement_requests', 'true');

    try {
      await Promise.allSettled(
        allIds.map(id => deleteCollectionDoc('procurement_requests', id))
      );
    } catch (err) {
      console.error("Failed to clear all orders from Firestore:", err);
    }
  };

  const [isArchivedExpanded, setIsArchivedExpanded] = useState(false);
  const [archivedOrders, setArchivedOrders] = useState<any[]>(() => {
    return ARCHIVED_ACCEPTED_ORDERS.map(o => normalizeOrder({ ...o, status: o.status || 'Accepted', isArchived: true }));
  });
  const [isLoadingArchived, setIsLoadingArchived] = useState(false);
  const [archivedSearchQuery, setArchivedSearchQuery] = useState('');
  const [archivedSupplierFilter, setArchivedSupplierFilter] = useState('');
  const [archivedProductFilter, setArchivedProductFilter] = useState('');
  const [archivedStatusFilter, setArchivedStatusFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [archivedFeedback, setArchivedFeedback] = useState<string | null>(null);
  const [selectedArchivedOrder, setSelectedArchivedOrder] = useState<any | null>(null);

  const fetchArchivedRecords = async (expandAfter = true) => {
    setIsLoadingArchived(true);
    try {
      const cloudRequests = await getCollectionDocs('procurement_requests').catch(() => []);
      const placedOrders = await getCollectionDocs('placed_orders').catch(() => []);
      const rawLocalPlaced = localStorage.getItem('placed_orders');
      let localPlaced: any[] = [];
      if (rawLocalPlaced) {
        try {
          localPlaced = JSON.parse(rawLocalPlaced);
        } catch (e) {}
      }

      const map = new Map<string, any>();

      // 1. Static historical baseline (ARCHIVED_ACCEPTED_ORDERS)
      ARCHIVED_ACCEPTED_ORDERS.forEach(o => {
        if (o && o.id) {
          const normKey = String(o.id).trim().toLowerCase().replace(/^#/, '');
          map.set(normKey, normalizeOrder({
            ...o,
            status: o.status || 'Accepted',
            isArchived: true
          }));
        }
      });

      // 2. Add individual items from placed orders
      [...localPlaced, ...placedOrders].forEach((p: any) => {
        if (p && p.originalOrders && Array.isArray(p.originalOrders)) {
          p.originalOrders.forEach((sub: any) => {
            if (sub && sub.id) {
              const normKey = String(sub.id).trim().toLowerCase().replace(/^#/, '');
              if (!map.has(normKey)) {
                map.set(normKey, normalizeOrder({
                  ...sub,
                  id: sub.id.startsWith('#') ? sub.id : `#${sub.id}`,
                  status: 'Completed',
                  supplier: sanitizeSupplierName(sub.supplier || p.supplier, availableSuppliers[0]?.name || 'DIRECT MILL'),
                  buyer: sub.buyer || p.buyer || availableBuyers[0]?.name || 'General Merchant',
                  date: sub.date || p.date || p.purchaseOrderSentAt || '10-Jun-2026',
                  isArchived: true
                }));
              }
            }
          });
        } else if (p && p.id) {
          const normKey = String(p.id).trim().toLowerCase().replace(/^#/, '');
          if (!map.has(normKey)) {
            map.set(normKey, normalizeOrder({
              id: p.id.startsWith('#') ? p.id : `#${p.id}`,
              buyer: p.buyer || p.buyerName || availableBuyers[0]?.name || 'General Merchant',
              product: p.product || p.variety || 'Mixed Sella',
              qty: p.qty || p.totalQty || 0,
              rate: p.rate || p.pricePerUnit || 0,
              status: 'Completed',
              supplier: sanitizeSupplierName(p.supplier, availableSuppliers[0]?.name || 'DIRECT MILL'),
              date: p.date || p.purchaseOrderSentAt || '10-Jun-2026',
              isArchived: true
            }));
          }
        }
      });

      // 3. Completed, Approved, Accepted, or Rejected requests from cloud & local storage
      cloudRequests.forEach((req: any) => {
        if (req && (
          req.status === 'Approved' ||
          req.status === 'Accepted' ||
          req.status === 'Rejected' ||
          req.status === 'Completed' ||
          req.status === 'Archived' ||
          req.status === 'Settled' ||
          req.isArchived
        )) {
          const normKey = String(req.id).trim().toLowerCase().replace(/^#/, '');
          if (!map.has(normKey)) {
            map.set(normKey, normalizeOrder({
              ...req,
              isArchived: true
            }));
          }
        }
      });

      const list = Array.from(map.values()).sort((a, b) => {
        const timeA = parseCustomDate(a);
        const timeB = parseCustomDate(b);
        if (timeA !== timeB) return timeB - timeA;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });

      setArchivedOrders(list);
      if (expandAfter) {
        setIsArchivedExpanded(true);
      }
      setArchivedFeedback(`Loaded ${list.length} previous & archived records`);
      setTimeout(() => setArchivedFeedback(null), 4000);
    } catch (e) {
      console.error('Error fetching archived records:', e);
      setArchivedFeedback('Loaded historical archives');
      setTimeout(() => setArchivedFeedback(null), 4000);
    } finally {
      setIsLoadingArchived(false);
    }
  };

  const handleToggleArchived = () => {
    if (!isArchivedExpanded) {
      fetchArchivedRecords(true);
    } else {
      setIsArchivedExpanded(false);
    }
  };

  const handleReorderArchivedItem = async (archivedItem: any) => {
    const newOrderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const now = new Date();
    const dateStr = `${now.getDate().toString().padStart(2, '0')}-${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][now.getMonth()]}-${now.getFullYear()}`;
    
    // Purge new ID from deleted set and remove clear flag
    removeDeletedProcurementId(newOrderId);
    localStorage.removeItem('cleared_procurement_requests');

    const clonedOrder = normalizeOrder({
      ...archivedItem,
      id: newOrderId,
      status: 'Pending Approval',
      date: dateStr,
      createdAt: now.toISOString(),
      isArchived: false
    });

    const updated = [clonedOrder, ...currentOrders.filter(o => o && String(o.id).toLowerCase() !== newOrderId.toLowerCase())];
    setCurrentOrders(updated);
    localStorage.setItem('procurement_requests', JSON.stringify(updated));
    await setCollectionDoc('procurement_requests', newOrderId, clonedOrder).catch(() => {});
    
    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('procurement-updated'));

    setArchivedFeedback(`Cloned order ${archivedItem.id} into active intent ${newOrderId}!`);
    setTimeout(() => setArchivedFeedback(null), 4000);
  };

  const filteredArchivedOrders = useMemo(() => {
    const query = (archivedSearchQuery || '').toLowerCase().trim();
    return archivedOrders.filter(order => {
      if (!order) return false;
      const buyerStr = String(order.buyer || '').toLowerCase();
      const idStr = String(order.id || '').toLowerCase();
      const productStr = String(order.product || '').toLowerCase();
      const supplierStr = String(order.supplier || '').toLowerCase();

      const matchesQuery = !query || 
        buyerStr.includes(query) || 
        idStr.includes(query) || 
        productStr.includes(query) || 
        supplierStr.includes(query);

      const matchesSupplier = !archivedSupplierFilter || order.supplier === archivedSupplierFilter;
      const matchesProduct = !archivedProductFilter || order.product === archivedProductFilter;

      const s = String(order.status || '').toLowerCase().trim();
      const isApproved = s === 'approved' || s === 'accepted' || s === 'completed' || s === 'settled';
      const isRejected = s === 'rejected';

      const matchesStatus = 
        archivedStatusFilter === 'all' ? true :
        archivedStatusFilter === 'approved' ? isApproved :
        archivedStatusFilter === 'rejected' ? isRejected : true;

      return matchesQuery && matchesSupplier && matchesProduct && matchesStatus;
    });
  }, [archivedOrders, archivedSearchQuery, archivedSupplierFilter, archivedProductFilter, archivedStatusFilter]);

  const toggleOrder = (id: string) => {
    const order = currentOrders.find(o => o.id === id);
    if (!order) return;

    setSelectedOrders(prev => {
      if (prev.includes(id)) {
        const remaining = prev.filter(item => item !== id);
        if (remaining.length === 0) setSelectionWarning(null);
        return remaining;
      } else {
        if (prev.length > 0) {
          const firstSelected = currentOrders.find(o => prev.includes(o.id));
          const firstSupplier = firstSelected ? (sanitizeSupplierName(firstSelected.supplier, 'DIRECT MILL')) : null;
          const currentSupplier = sanitizeSupplierName(order.supplier, 'DIRECT MILL');
          if (firstSupplier && firstSupplier !== currentSupplier) {
            setSelectionWarning(`Grouping is restricted to a single supplier. Cannot group "${currentSupplier}" with "${firstSupplier}".`);
            return prev;
          }
        }
        setSelectionWarning(null);
        return [...prev, id];
      }
    });
  };

  const handleSelectAll = () => {
    setSelectionWarning(null);
    if (selectedOrders.length > 0) {
      setSelectedOrders([]);
    } else {
      if (filteredOrders.length > 0) {
        const firstSupplier = sanitizeSupplierName(filteredOrders[0].supplier, 'DIRECT MILL');
        const matchingIds = filteredOrders.filter(o => sanitizeSupplierName(o.supplier, 'DIRECT MILL') === firstSupplier).map(o => o.id);
        setSelectedOrders(matchingIds);
        
        const nonMatchingCount = filteredOrders.length - matchingIds.length;
        if (nonMatchingCount > 0) {
          setSelectionWarning(`Auto-selected all ${matchingIds.length} orders for supplier "${firstSupplier}". Disabled ${nonMatchingCount} other entities to enforce same-supplier grouping.`);
        }
      }
    }
  };

  const { totalSelectedQty, totalSelectedAmt } = useMemo(() => {
    let qty = 0;
    let amt = 0;
    const selectedSet = new Set(selectedOrders);
    filteredOrders.forEach(o => {
      if (selectedSet.has(o.id)) {
        const q = Number(o.qty) || 0;
        const r = Number(o.rate) || 0;
        qty += q;
        amt += q * r;
      }
    });
    return { totalSelectedQty: qty, totalSelectedAmt: amt };
  }, [filteredOrders, selectedOrders]);

  const handleGroupAndPlace = () => {
    const selected = filteredOrders.filter(o => selectedOrders.includes(o.id));
    if (selected.length === 0) return;
    
    // Create the grouped order summary
    const batchId = `TC-${Math.floor(1000 + Math.random() * 9000)}`;
    const uniqueBuyers = Array.from(new Set(selected.map((s: any) => s.buyer).filter(Boolean))) as string[];
    const buyerName = uniqueBuyers.length === 1 
      ? uniqueBuyers[0] 
      : `${uniqueBuyers[0]} & ${uniqueBuyers.length - 1} other${uniqueBuyers.length > 2 ? 's' : ''}`;
      
    const avgRate = Number((totalSelectedAmt / (totalSelectedQty || 1)).toFixed(2));
    const firstProduct = selected[0]?.product || 'Premium Rice';
    const firstInitials = selected[0]?.initials || 'CB';
    const firstColor = selected[0]?.color || 'zinc';
    const firstUrgency = selected[0]?.urgency || 'Standard';

    const buyerProfiles = uniqueBuyers.map(b => {
      const prof = resolveBuyerProfile(b);
      const matchedOrder = selected.find(s => (s.buyer || '').trim().toLowerCase() === b.trim().toLowerCase());
      const orderPhone = (matchedOrder?.phone || '').replace(/[^0-9]/g, '');
      const rawFinalPhone = (orderPhone && orderPhone.length >= 10 && orderPhone !== '9845012345' && orderPhone !== '9845000000' && orderPhone !== '919845000000') 
        ? orderPhone 
        : (prof.phone || '').replace(/[^0-9]/g, '');
      const cleanPhone = rawFinalPhone.length >= 10 ? rawFinalPhone.slice(-10) : '9945351166';
      return { name: b, email: prof.email, phone: `91${cleanPhone}` };
    });

    const supplierProfile = resolveSupplierProfile(assignedBatchSupplier);

    const groupedOrder = {
      id: batchId,
      date: (() => {
        const d = new Date();
        const day = d.getDate();
        const monthNames = [
          'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
        const m = monthNames[d.getMonth()];
        const yyyy = d.getFullYear();
        return `${day}-${m}-${yyyy}`;
      })(),
      items: `TC Grouped Orders (${(Number(totalSelectedQty) || 0).toFixed(2)} QTLS)`,
      total: `₹ ${formatINR(totalSelectedAmt)}`,
      status: 'Awaiting Settlement',
      progress: 0,
      origin: 'Consolidated Hub',
      destination: 'Multiple Destinations',
      buyer: buyerName,
      supplier: assignedBatchSupplier,
      originalOrders: selected,
      purchaseOrderSent: true,
      purchaseOrderSentAt: new Date().toISOString(),
      companyEmail: localStorage.getItem('companyEmail') || (localStorage.getItem('userEmail') && localStorage.getItem('userEmail') !== 'tejasadinarayan@gmail.com' ? localStorage.getItem('userEmail') : null) || 'nani@tejasc.in',
      sellerEmail: supplierProfile.email,
      qty: totalSelectedQty,
      rate: avgRate,
      product: firstProduct,
      initials: firstInitials,
      urgency: firstUrgency,
      color: firstColor,
      dispatchedBuyers: buyerProfiles,
    };

    // Initialize Auto Dispatch Simulation Overlay
    setAutoDispatchStatus({
      isSending: true,
      progress: 5,
      logs: [],
      currentAction: "Resolving stakeholder profiles..."
    });

    const isSingleOrder = selected.length === 1;

    // 1. DISPATCH WHATSAPP & SMS TO ALL BUYERS IMMEDIATELY (NO EMAIL SENT ON APPROVAL)
    buyerProfiles.forEach(bp => {
      const buyerOrders = selected.filter(s => (s.buyer || '').trim().toLowerCase() === bp.name.trim().toLowerCase());

      const bpOrder = buyerOrders[0] || groupedOrder;
      const bpBrand = (bpOrder.product || groupedOrder.product || 'keshar kali').replace(/\(\d+.*$/, '').trim();
      const bpQtyNum = buyerOrders.reduce((sum, o) => sum + (Number(o.qty) || 0), 0) || Number(groupedOrder.qty) || 40;
      const bpRateNum = bpOrder.rate || groupedOrder.rate || 10000;

      const buyerWhatsappMsg = `Hello ${bp.name},\n\nOrder placed successfully.\n\nBrand: ${bpBrand}\nQuantity: ${bpQtyNum} QTL\nRate: ₹${bpRateNum}/QTL\n\nThank you,\nTejas Canvassing`;

      fetch('/api/dispatch-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: bp.phone,
          buyerName: bp.name,
          brand: bpBrand,
          qty: String(bpQtyNum),
          rate: String(bpRateNum),
          orderId: groupedOrder.id,
          poNumber: groupedOrder.id,
          message: buyerWhatsappMsg,
          templateName: 'order_notify',
          templateId: '1016669984165776',
          templateParams: [bp.name, bpBrand, String(bpQtyNum), String(bpRateNum)],
          languageCode: 'en'
        })
      })
      .then(res => res.json())
      .then(data => console.log(`[Placed Order WhatsApp Result for ${bp.name}]:`, data))
      .catch(err => console.warn(`WhatsApp dispatch note for ${bp.name}:`, err?.message || err));

      fetch('/api/dispatch-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: bp.phone,
          recipientName: bp.name,
          message: `Tejas Canvassing: Order placed under ${isSingleOrder ? 'PO' : 'Batch PO'} ${groupedOrder.id} (${groupedOrder.qty} QTLS) arriving in 3-5 days.`
        })
      }).catch(err => console.warn(`SMS dispatch note for ${bp.name}:`, err?.message || err));
    });

    // 2. DISPATCH OFFICIAL PURCHASE ORDER EMAIL TO ASSIGNED SUPPLIER (ONLY EMAIL TO SUPPLIER, NO WHATSAPP)
    if (supplierProfile.email) {
      const subOrders = selected.map((s: any) => ({
        id: s.id,
        buyer: s.buyer || 'Authorized Merchant',
        product: (s.product || groupedOrder.product || 'Premium Rice').replace(/\(\d+.*$/, '').trim(),
        qty: Number(s.qty) || 0,
        rate: Number(s.rate) || avgRate,
        date: s.date || groupedOrder.date,
        loadingDays: s.loadingDays !== undefined ? s.loadingDays : 3,
        unloadingPoint: s.unloadingPoint || 'shop',
        remarks: s.remarks || ''
      }));

      const emailHtml = generateSupplierPOEmailHtml(assignedBatchSupplier, groupedOrder, subOrders);
      const poSubject = `Tejas Canvassing: Purchase Order ${groupedOrder.id} - ${assignedBatchSupplier}`;

      fetch('/api/dispatch-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: supplierProfile.email,
          from: localStorage.getItem('companyEmail') || 'nani@tejasc.in',
          cc: localStorage.getItem('companyEmail') || 'nani@tejasc.in',
          subject: poSubject,
          html: emailHtml,
          htmlContent: emailHtml,
          textContent: `Tejas Canvassing: Official Purchase Order ${groupedOrder.id}\n\nDear ${assignedBatchSupplier},\n\nOrder for ${groupedOrder.qty} QTLS has been confirmed. Please find purchase order details enclosed.`,
          batchId: groupedOrder.id,
          poNumber: groupedOrder.id,
          orderId: groupedOrder.id,
          supplierName: assignedBatchSupplier,
          orderDetails: groupedOrder
        })
      })
      .then(res => res.json())
      .then(data => console.log(`Approved Supplier PO Email Result for ${assignedBatchSupplier}:`, data))
      .catch(err => console.warn(`Supplier PO email error for ${assignedBatchSupplier}:`, err?.message || err));
    }

    // Step 1: Profile resolution update (300ms)
    setTimeout(() => {
      setAutoDispatchStatus(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          progress: 25,
          currentAction: "Compiling official purchase order documents..."
        };
      });
    }, 300);

    // Step 2: System allocation & Mill PO Email update (600ms)
    setTimeout(() => {
      setAutoDispatchStatus(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          progress: 55,
          currentAction: "Transmitting official Purchase Order to supplier via Gmail SMTP..."
        };
      });
    }, 600);

    // Step 3: Buyer WhatsApp notifications (900ms)
    setTimeout(() => {
      setAutoDispatchStatus(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          progress: 80,
          currentAction: "Dispatching order confirmations to buyers via WhatsApp CRM gateway..."
        };
      });
    }, 900);

    // Step 4: Notifications completed (1200ms)
    setTimeout(() => {
      setAutoDispatchStatus(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          progress: 100,
          currentAction: "Purchase Order emailed to supplier; buyer confirmations sent!"
        };
      });
    }, 1200);

    // Step 5: Save database state & Redirect (1500ms)
    setTimeout(() => {
      // Save to Placed Orders
      const existingPlaced = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const newPlaced = [groupedOrder, ...existingPlaced];
      localStorage.setItem('placed_orders', JSON.stringify(newPlaced));
      localStorage.setItem('just_placed_order', 'true');
      setCollectionDoc('placed_orders', batchId, groupedOrder);

      // Automatically generate Miller and Shop ledger entries for this purchase order
      createLedgerEntriesForOrder(groupedOrder).catch(err => {
        console.error("Failed to automatically generate commercial ledger entries:", err);
      });

      // Remove from active orders by normalized ID
      const selectedNormSet = new Set(selectedOrders.map(s => String(s).trim().toLowerCase().replace(/^#/, '')));
      
      const remaining = currentOrders.filter(o => {
        const normId = String(o.id || '').trim().toLowerCase().replace(/^#/, '');
        return !selectedNormSet.has(normId);
      });
      setCurrentOrders(remaining);
      
      const savedProc = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
      const filteredProc = savedProc.filter((o: any) => {
        const normId = String(o.id || '').trim().toLowerCase().replace(/^#/, '');
        return !selectedNormSet.has(normId);
      });
      localStorage.setItem('procurement_requests', JSON.stringify(filteredProc));

      // Delete approved requests from Firestore procurement_requests so they do not linger
      const deleteGrouped = async () => {
        try {
          addDeletedProcurementIds(selectedOrders);

          await Promise.allSettled(
            selectedOrders.map(id => deleteCollectionDoc('procurement_requests', id))
          );
        } catch (err) {
          console.error('Failed to delete approved requests from Firestore:', err);
        }
      };
      deleteGrouped();

      setSelectedOrders([]);
      setAutoDispatchStatus(null);
      navigate('/placed-orders');
    }, 1500);
  };

  const handleCreateOrder = () => {
    if (!newOrder.buyer?.trim() || !newOrder.qty || !newOrder.rate || !newOrder.product?.trim()) {
      alert("Please enter Buyer, Product Variety, Volume (Qty), and Rate to create an order.");
      return;
    }

    const saved = JSON.parse(localStorage.getItem('procurement_requests') || '[]');
    
    // Generate a unique collision-free ID that will never conflict with previously deleted IDs
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const maId = `MA-${randomSuffix}`;

    // Purge new ID from deleted set and clear cleared flag
    removeDeletedProcurementId(maId);
    localStorage.removeItem('cleared_procurement_requests');

    const initials = newOrder.buyer.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'TC';
    
    const now = new Date();
    const day = now.getDate();
    const monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    const m = monthNames[now.getMonth()];
    const yyyy = now.getFullYear();
    const dateStr = `${day}-${m}-${yyyy}`;

    const supplierVal = newOrder.supplier ? sanitizeSupplierName(newOrder.supplier, 'DIRECT MILL') : 'DIRECT MILL';

    const buyerProfile = resolveBuyerProfile(newOrder.buyer.trim());
    const rawBuyerPhone = ((newOrder as any).phone || buyerProfile?.phone || localStorage.getItem('userPhone') || '9945351166').replace(/[^0-9]/g, '');
    const cleanBuyerPhone = rawBuyerPhone.length >= 10 ? rawBuyerPhone.slice(-10) : '9945351166';

    const loadingDaysNum = parseInt(String(newOrder.loadingDays), 10);
    const orderToAdd = normalizeOrder({
      id: maId,
      orderType: 'manual',
      isManual: true,
      date: dateStr,
      createdAt: now.toISOString(),
      buyer: newOrder.buyer.trim(),
      supplier: supplierVal,
      product: newOrder.product.trim(),
      initials,
      qty: parseFloat(newOrder.qty) || 0,
      rate: parseFloat(newOrder.rate) || 0,
      urgency: newOrder.urgency || 'Standard',
      status: 'Pending Approval',
      color: newOrder.urgency === 'Critical' ? 'red' : newOrder.urgency === 'High' ? 'orange' : 'zinc',
      phone: cleanBuyerPhone || undefined,
      loadingDays: isNaN(loadingDaysNum) ? 3 : loadingDaysNum,
      unloadingPoint: (newOrder.unloadingPoint || 'shop').trim(),
      remarks: (newOrder.remarks || '').trim()
    });

    const updatedOrders = [orderToAdd, ...currentOrders.filter(o => o && String(o.id).toLowerCase() !== maId.toLowerCase())];
    setCurrentOrders(updatedOrders);
    
    const updatedSaved = [orderToAdd, ...saved.filter((o: any) => o && String(o.id).toLowerCase() !== maId.toLowerCase())];
    localStorage.setItem('procurement_requests', JSON.stringify(updatedSaved));

    // Reset filters so the new order is immediately visible on the table!
    setFilterSupplier('');
    setFilterProduct('');
    setFilterOrderType('all');
    setSearchQuery('');

    setCollectionDoc('procurement_requests', maId, orderToAdd).catch(err => {
      console.warn('Firestore sync notice for manual order (saved locally):', err?.message || err);
    });

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new Event('procurement-updated'));

    setIsCreateModalOpen(false);
    setNewOrder({ buyer: '', phone: '', supplier: '', product: '', qty: '', rate: '', urgency: 'Standard', loadingDays: 3, unloadingPoint: 'shop', remarks: '' });
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto pb-32 admin-font font-sf">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2 border-b border-slate-200/80 dark:border-outline-variant/10">
        <div>
          <h1 className="text-3xl font-sf font-bold tracking-tight text-slate-900 dark:text-on-surface flex items-center gap-2.5">
            Procurement & Orders <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block" />
          </h1>
          <p className="text-slate-500 dark:text-secondary text-xs font-semibold uppercase tracking-wider mt-1">B2B Commodity Dispatch Control & Buyer Intent Management Hub</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {currentOrders.length > 0 && (
            <button
              onClick={handleClearAllOrders}
              className="bg-rose-500/10 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/20 px-4 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All Orders ({currentOrders.length})
            </button>
          )}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-on-primary px-6 py-3.5 sm:px-7 sm:py-3.5 rounded-2xl text-xs sm:text-sm font-black uppercase tracking-wider flex items-center gap-2.5 shadow-xl shadow-primary/25 hover:shadow-primary/40 hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer ring-2 ring-primary/30 ring-offset-2 ring-offset-background"
            title="Create and book a new manual order instantly"
          >
            <PlusCircle className="w-5 h-5 text-on-primary animate-pulse" />
            <span>Create Manual Order</span>
          </button>
          <div className="bg-amber-500/10 dark:bg-primary/5 px-4 py-2.5 rounded-xl border border-amber-500/20 dark:border-primary/15 flex items-center gap-2.5 shadow-sm">
             <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
             <span className="text-[10px] font-black text-amber-700 dark:text-primary uppercase tracking-widest font-mono">Live Node Sync</span>
          </div>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => {
          const iconBgClass = i === 0 ? "bg-amber-500/15 text-amber-700 dark:text-primary border-amber-500/30" :
                              i === 1 ? "bg-amber-500/15 text-amber-700 dark:text-amber-500 border-amber-500/30" :
                              i === 2 ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-500 border-emerald-500/30" :
                                        "bg-blue-500/15 text-blue-700 dark:text-blue-500 border-blue-500/30";
          const glowColor = i === 0 ? "hover:shadow-amber-500/10" :
                            i === 1 ? "hover:shadow-amber-500/10" :
                            i === 2 ? "hover:shadow-emerald-500/10" :
                                      "hover:shadow-blue-500/10";

          const isPaymentCard = stat.label.includes('Payment') || i === 3;

          return (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ y: -4, transition: { duration: 0.2, ease: "easeOut" } }}
              transition={{ 
                duration: 0.45, 
                delay: i * 0.07,
                ease: [0.16, 1, 0.3, 1] 
              }}
              onClick={() => {
                if (isPaymentCard) {
                  navigate('/payments');
                }
              }}
              className={cn(
                "floating-card liquid-glass p-6 rounded-3xl premium-border space-y-4 group interactive-card relative overflow-hidden transition-all duration-300",
                glowColor,
                isPaymentCard && "cursor-pointer hover:border-blue-500/40 hover:shadow-lg active:scale-95"
              )}
              title={isPaymentCard ? "Click to navigate to Payment Tracking" : undefined}
            >
              {/* Ambient radial accent glow */}
              <div className={cn(
                "absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-2xl pointer-events-none opacity-20 transition-opacity group-hover:opacity-40",
                i === 0 ? "bg-amber-500" :
                i === 1 ? "bg-amber-400" :
                i === 2 ? "bg-emerald-500" :
                          "bg-blue-500"
              )} />
              <div className="flex justify-between items-start relative z-10">
                <div className={cn("p-2.5 rounded-2xl w-fit border transition-all duration-300 group-hover:scale-110", iconBgClass)}>
                   <stat.icon className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1">
                  {isPaymentCard && (
                    <ArrowUpRight className="w-4 h-4 text-blue-600 dark:text-blue-500 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  )}
                  <span className="text-[9px] font-bold text-slate-400 dark:text-secondary/30 uppercase tracking-widest font-mono">0{i + 1}</span>
                </div>
              </div>
              <div className="space-y-1">
                 <p className="text-[10px] font-bold text-slate-500 dark:text-secondary/70 uppercase tracking-wider leading-none">{stat.label}</p>
                 <h3 className="text-2xl font-sf font-bold tracking-tight text-slate-900 dark:text-on-surface mt-1 group-hover:text-primary transition-colors">{stat.value}</h3>
                 <p className="text-[11px] font-medium text-slate-500 dark:text-secondary/50 flex items-center justify-between">
                   <span>{stat.sub}</span>
                   {isPaymentCard && <span className="text-blue-600 dark:text-blue-500 font-bold group-hover:underline text-[9.5px]">Track Payments →</span>}
                 </p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="space-y-8">
        {/* Main Table Content - Now full width */}
        <motion.div 
          initial={{ opacity: 0, y: 22, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.52, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
          className="liquid-glass rounded-3xl overflow-hidden premium-border shadow-md"
        >
          <div className="p-6 border-b border-slate-200/80 dark:border-outline-variant/20 space-y-4 bg-slate-50/80 dark:bg-surface-container-low/30 backdrop-blur-md">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-900 dark:text-on-surface flex items-center gap-2">
                     <Activity className="w-4 h-4 text-primary animate-pulse" />
                     Active Procurement Requests
                   </h3>
                   <p className="text-[10px] text-slate-500 dark:text-secondary font-semibold uppercase tracking-wider mt-1">Approve, Reject, or Group Active Indents</p>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-auto flex-wrap sm:flex-nowrap">
                    <button
                      type="button"
                      onClick={() => setIsCreateModalOpen(true)}
                      className="bg-primary hover:bg-primary/90 text-on-primary px-4 py-2.5 sm:px-5 sm:py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md shadow-primary/25 hover:scale-105 active:scale-95 transition-all cursor-pointer shrink-0 ring-1 ring-primary/30"
                      title="Quickly create a manual order right here"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Manual Order</span>
                    </button>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-secondary/65" />
                      <input 
                        type="text" 
                        placeholder="Search buy requests..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-white dark:bg-white/[0.05] border border-slate-200 dark:border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-slate-900 dark:text-on-surface placeholder:text-slate-400 w-48 sm:w-64 shadow-2xs" 
                      />
                    </div>
                </div>
             </div>
             
             {/* Filter Bar */}
             <div className="flex flex-wrap gap-2.5 items-center pt-3 border-t border-slate-200/80 dark:border-outline-variant/10">
                <div className="flex items-center gap-1.5">
                   <Filter className="w-3.5 h-3.5 text-slate-500 dark:text-secondary/60" />
                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-secondary/60">Filter Board:</span>
                </div>
                
                <div className="relative">
                  <select 
                    value={filterSupplier}
                    onChange={(e) => {
                      setFilterSupplier(e.target.value);
                      setFilterProduct('');
                    }}
                    className="bg-white dark:bg-on-surface/[0.04] hover:bg-slate-50 dark:hover:bg-on-surface/[0.07] border border-slate-200 dark:border-outline-variant/20 rounded-xl py-2 pl-3.5 pr-8 text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary/15 transition-all appearance-none text-slate-800 dark:text-on-surface cursor-pointer shadow-2xs"
                  >
                    <option value="">All Mills / Suppliers</option>
                    {availableSuppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-secondary pointer-events-none" />
                </div>

                <div className="relative">
                  <select 
                    value={filterProduct}
                    onChange={(e) => setFilterProduct(e.target.value)}
                    className="bg-white dark:bg-on-surface/[0.04] hover:bg-slate-50 dark:hover:bg-on-surface/[0.07] border border-slate-200 dark:border-outline-variant/20 rounded-xl py-2 pl-3.5 pr-8 text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary/15 transition-all appearance-none text-slate-800 dark:text-on-surface cursor-pointer shadow-2xs"
                  >
                    <option value="">All Rice Products</option>
                    {(filterSupplier 
                      ? getBrandsForSupplier(filterSupplier) 
                      : Array.from(new Set(inventoryProducts.map(p => (p.name || p.brand)?.trim()).filter(Boolean))).sort()
                    ).map(brandName => (
                      <option key={brandName} value={brandName}>{brandName}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-secondary pointer-events-none" />
                </div>

                {/* Order Type Filter: All / Manual / Store */}
                <div className="relative">
                  <select 
                    value={filterOrderType}
                    onChange={(e) => setFilterOrderType(e.target.value as 'all' | 'manual' | 'store')}
                    className="bg-white dark:bg-on-surface/[0.04] hover:bg-slate-50 dark:hover:bg-on-surface/[0.07] border border-slate-200 dark:border-outline-variant/20 rounded-xl py-2 pl-3.5 pr-8 text-[10px] font-bold uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary/15 transition-all appearance-none text-slate-800 dark:text-on-surface cursor-pointer shadow-2xs"
                  >
                    <option value="all">All Order Types</option>
                    <option value="manual">Manual Orders</option>
                    <option value="store">Store Orders</option>
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-secondary pointer-events-none" />
                </div>

                {(filterSupplier || filterProduct || searchQuery || filterOrderType !== 'all') && (
                  <button 
                    onClick={() => { setFilterSupplier(''); setFilterProduct(''); setSearchQuery(''); setFilterOrderType('all'); }}
                    className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-primary/85 bg-primary/10 border border-primary/15 px-3 py-2 rounded-xl transition-all cursor-pointer"
                  >
                    Reset Filters
                  </button>
                )}
             </div>
          </div>
           {selectionWarning && (
             <motion.div 
               initial={{ height: 0, opacity: 0 }}
               animate={{ height: 'auto', opacity: 1 }}
               exit={{ height: 0, opacity: 0 }}
               className="my-4 mx-6 p-4 bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 rounded-2xl text-[11px] font-extrabold uppercase tracking-wider flex items-center justify-between gap-4 shadow-sm"
             >
               <div className="flex items-center gap-3">
                  <AlertCircle className="w-4 h-4 shrink-0 text-orange-500 animate-pulse" />
                  <span>{selectionWarning}</span>
               </div>
               <button onClick={() => setSelectionWarning(null)} className="text-[10px] font-black hover:opacity-80 scale-105 transition-transform bg-orange-500/15 text-orange-600 dark:text-orange-400 px-2 py-1.5 rounded-lg border border-orange-500/20">CONFIRM</button>
              </motion.div>
            )}

           {currentOrders.length > 0 && filteredOrders.length === 0 && (
             <motion.div
               initial={{ opacity: 0, y: -4 }}
               animate={{ opacity: 1, y: 0 }}
               className="my-3 mx-6 p-4 bg-amber-500/10 border border-amber-500/25 text-amber-800 dark:text-amber-300 rounded-2xl text-xs font-semibold flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
             >
               <div className="flex items-center gap-2.5">
                 <Filter className="w-4 h-4 text-amber-600 shrink-0" />
                 <span>
                   <strong>{currentOrders.length} order{currentOrders.length !== 1 ? 's' : ''}</strong> currently active, but hidden by your filter ({[filterSupplier, filterProduct, searchQuery].filter(Boolean).join(', ')}).
                 </span>
               </div>
               <button
                 type="button"
                 onClick={() => { setFilterSupplier(''); setFilterProduct(''); setSearchQuery(''); }}
                 className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[10px] uppercase tracking-wider rounded-xl transition-colors cursor-pointer shrink-0 self-start sm:self-auto"
               >
                 Show All Orders ({currentOrders.length})
               </button>
             </motion.div>
           )}

           <div className="overflow-x-auto">
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="text-[9px] font-black text-secondary/60 uppercase tracking-widest bg-surface-container-low/20">
                  <th className="px-6 py-4 w-12 text-center border-b border-outline-variant/15">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-primary focus:ring-primary/20 accent-primary cursor-pointer transition-all" 
                      checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4 border-b border-outline-variant/15">Buyer Entity Detail</th>
                  <th className="px-6 py-4 border-b border-outline-variant/15">Product Variety</th>
                  <th className="px-6 py-4 text-right border-b border-outline-variant/15 font-mono">Volume (QTLS)</th>
                  <th className="px-6 py-4 text-right border-b border-outline-variant/15 font-mono">Agreed Rate</th>
                  <th className="px-6 py-4 border-b border-outline-variant/15">Priority Tier</th>
                  <th className="px-6 py-4 border-b border-outline-variant/15 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filteredOrders.map((order, idx) => {
                  const firstSelectedOrder = currentOrders.find(o => selectedOrders.includes(o.id));
                  const selectedSupplier = firstSelectedOrder ? sanitizeSupplierName(firstSelectedOrder.supplier, '') : null;
                  const isAccepted = order.status === 'Awaiting Grouping' || order.status === 'Approved' || order.status === 'Accepted';
                  const isSelectionDisabled = selectedSupplier && sanitizeSupplierName(order.supplier, '') !== selectedSupplier;
                  const canBeTicked = isAccepted && !isSelectionDisabled;
                  const isExpanded = expandedOrderId === order.id;

                  return (
                    <React.Fragment key={order.id}>
                      <motion.tr 
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className={cn(
                          "interactive-tr group cursor-pointer",
                          selectedOrders.includes(order.id) && "bg-primary/[0.04] dark:bg-primary/[0.08]",
                          isExpanded && "bg-primary/[0.03] dark:bg-primary/[0.06] border-b border-primary/20",
                          isSelectionDisabled && "opacity-45 select-none hover:bg-transparent pointer-events-none"
                        )}
                      onClick={() => {
                        if (isSelectionDisabled) return;
                        handleOpenMerchantModal(order.buyer);
                      }}
                    >
                      <td className="px-6 py-4.5 w-12 text-center" onClick={(e) => {
                        if (!canBeTicked) {
                          e.preventDefault();
                          e.stopPropagation();
                          return;
                        }
                        e.stopPropagation();
                      }}>
                        <input 
                          type="checkbox" 
                          disabled={!canBeTicked}
                          className={cn(
                            "w-4 h-4 rounded border-neutral-300 dark:border-neutral-700 text-primary focus:ring-primary/20 accent-primary cursor-pointer transition-all",
                            !canBeTicked && "cursor-not-allowed opacity-30 pointer-events-none"
                          )}
                          checked={selectedOrders.includes(order.id)}
                          onChange={() => {
                            if (canBeTicked) toggleOrder(order.id);
                          }}
                        />
                      </td>
                    <td className="px-6 py-4.5">
                      <div className="flex items-center gap-3">
                         <button
                           type="button"
                           onClick={(e) => {
                             e.stopPropagation();
                             setExpandedOrderId(prev => prev === order.id ? null : order.id);
                           }}
                           className="p-1 rounded-lg text-slate-400 hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                           title={expandedOrderId === order.id ? "Collapse specifications" : "Expand specifications"}
                         >
                           <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", expandedOrderId === order.id && "rotate-180 text-primary")} />
                         </button>
                         <div className={cn(
                           "w-10 h-10 rounded-2xl flex items-center justify-center font-black text-[11px] transition-all duration-300 shadow-sm border",
                           selectedOrders.includes(order.id) 
                             ? "bg-primary text-on-primary border-primary shadow-primary/10 scale-105" 
                             : "bg-surface-container border-outline-variant/30 text-neutral-600 dark:text-neutral-400 group-hover:border-primary/40 group-hover:bg-primary/5 group-hover:text-primary"
                         )}>
                            {order.initials}
                         </div>
                         <div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenMerchantModal(order.buyer);
                              }}
                              className="text-left text-xs font-bold text-on-surface hover:text-primary transition-colors hover:underline decoration-dotted block uppercase tracking-wide leading-snug"
                            >
                              {order.buyer}
                            </button>
                            <p className="text-[9px] text-secondary/60 font-black uppercase tracking-widest font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                              <span>{getOrderBillNo(order.id)}</span>
                              <span className="opacity-40">•</span>
                              <span>{order.date}</span>
                              <span className={cn(
                                "px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider inline-flex items-center",
                                order.orderType === 'manual'
                                  ? "bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/25"
                                  : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25"
                              )}>
                                {order.orderType === 'manual' ? 'Manual' : 'Store'}
                              </span>
                            </p>
                         </div>
                      </div>
                    </td>
                    <td className="px-6 py-4.5">
                      {(order as any).product ? (
                        <span className="text-[9px] font-black text-primary uppercase tracking-widest px-2.5 py-1 bg-primary/5 rounded-xl border border-primary/10">
                          {(order as any).product}
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-secondary italic opacity-40">Unspecified</span>
                      )}
                    </td>
                    <td className="px-6 py-4.5 text-right font-mono">
                      <div className="flex flex-col items-end">
                         <span className="font-black text-sm text-on-surface">{(Number(order.qty) || 0).toFixed(2)}</span>
                         <span className="text-[8px] font-black uppercase text-secondary/60 tracking-wider">QTLS</span>
                      </div>
                    </td>
                    <td className="px-6 py-4.5 text-right font-mono font-bold text-xs text-on-surface/90">
                      ₹ {formatINR(order.rate)}
                    </td>
                    <td className="px-6 py-4.5">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border shadow-sm inline-flex items-center gap-1.5",
                        order.color === 'red' ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/20 dark:border-rose-900/30" :
                        order.color === 'orange' ? "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-950/20 dark:border-orange-900/30" :
                        "bg-surface-container text-secondary border-outline-variant/30"
                      )}>
                        <div className={cn("w-1 h-1 rounded-full", 
                          order.color === 'red' ? "bg-rose-500 animate-pulse" : 
                          order.color === 'orange' ? "bg-orange-500" : 
                          "bg-secondary"
                       )} />
                        {order.urgency}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end items-center gap-2">
                         {isPendingApproval(order.status) ? (
                           <>
                              <button 
                                onClick={() => handleAction(order.id, 'accept')}
                                disabled={actionLoadingId === order.id}
                                className="btn-tactile px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-600 text-emerald-600 dark:text-emerald-400 hover:text-white border border-emerald-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1"
                              >
                                {actionLoadingId === order.id && <Loader2 className="w-3 h-3 animate-spin" />}
                                Approve
                              </button>
                              <button 
                                onClick={() => handleAction(order.id, 'reject')}
                                disabled={actionLoadingId === order.id}
                                className="btn-tactile px-3 py-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1"
                              >
                                {actionLoadingId === order.id && <Loader2 className="w-3 h-3 animate-spin" />}
                                Reject
                              </button>
                           </>
                         ) : (
                           <div className="flex items-center gap-1.5">
                             <span className={cn(
                               "text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl border",
                               order.status === 'Approved' || order.status === 'Accepted'
                                 ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300/30"
                                 : "bg-neutral-100 dark:bg-neutral-800 text-neutral-500 border-outline-variant/30"
                             )}>
                                {order.status}
                             </span>
                           </div>
                         )}
                         <button
                           onClick={() => handleDeleteOrder(order.id)}
                           disabled={actionLoadingId === order.id}
                           title="Remove Order"
                           className="btn-tactile p-1.5 bg-rose-500/10 hover:bg-rose-600 text-rose-600 dark:text-rose-400 hover:text-white border border-rose-500/20 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                         >
                           {actionLoadingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                         </button>
                      </div>
                    </td>
                  </motion.tr>

                  {/* Expandable Dropdown Drawer Row */}
                  {isExpanded && (
                    <tr className="table-dropdown-drawer">
                      <td colSpan={7} className="p-0">
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.25, ease: "easeInOut" }}
                          className="overflow-hidden border-y border-amber-500/20 dark:border-primary/20 bg-slate-900/60 dark:bg-black/60 p-6 backdrop-blur-md"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                            <div className="p-4 rounded-2xl bg-white/5 dark:bg-white/[0.03] border border-white/10 space-y-1.5">
                              <div className="flex items-center gap-2 text-xs font-bold text-amber-500">
                                <User className="w-4 h-4" />
                                <span>Buyer Entity</span>
                              </div>
                              <p className="text-sm font-bold text-on-surface uppercase">{order.buyer}</p>
                              <p className="text-[10px] text-secondary/70 font-mono">PO: {getOrderBillNo(order.id)}</p>
                              <p className="text-[10px] text-secondary/70 font-mono">Date: {order.date}</p>
                              <p className="text-[10px] text-secondary/70 font-mono">
                                Type: <span className="font-black uppercase text-primary">{order.orderType === 'manual' ? 'Manual Indent' : 'Store Order'}</span>
                              </p>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/5 dark:bg-white/[0.03] border border-white/10 space-y-1.5">
                              <div className="flex items-center gap-2 text-xs font-bold text-primary">
                                <Package className="w-4 h-4" />
                                <span>Product & Supplier</span>
                              </div>
                              <p className="text-sm font-bold text-on-surface">{(order as any).product || 'Standard Rice'}</p>
                              <p className="text-[10px] text-secondary/70">Mill: {order.supplier || 'DIRECT MILL'}</p>
                              <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                                Tier: {order.urgency}
                              </span>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/5 dark:bg-white/[0.03] border border-white/10 space-y-1.5">
                              <div className="flex items-center gap-2 text-xs font-bold text-emerald-500">
                                <TrendingUp className="w-4 h-4" />
                                <span>Volume & Valuation</span>
                              </div>
                              <p className="text-sm font-black font-mono text-on-surface">
                                {(Number(order.qty) || 0).toFixed(2)} QTLS @ ₹{formatINR(order.rate)}
                              </p>
                              <p className="text-xs font-bold text-emerald-400 font-mono">
                                Gross: ₹ {formatINR((Number(order.qty) || 0) * (Number(order.rate) || 0))}
                              </p>
                              <p className="text-[9px] text-secondary/60">Estimated cargo value</p>
                            </div>

                            <div className="p-4 rounded-2xl bg-white/5 dark:bg-white/[0.03] border border-white/10 space-y-1.5">
                              <div className="flex items-center gap-2 text-xs font-bold text-blue-400">
                                <Activity className="w-4 h-4" />
                                <span>Status Workflow</span>
                              </div>
                              <p className="text-xs font-black uppercase tracking-wider text-on-surface">{order.status}</p>
                              <p className="text-[10px] text-secondary/70">
                                {isAccepted ? 'Ready for purchase order grouping' : 'Pending verification review'}
                              </p>
                            </div>

                            {/* PO Logistics (Loading Days & Unloading Point) */}
                            <div className="p-4 rounded-2xl bg-amber-500/[0.07] dark:bg-amber-500/[0.04] border border-amber-500/25 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-xs font-bold text-amber-500">
                                  <Truck className="w-4 h-4" />
                                  <span>PO Details</span>
                                </div>
                                {editingLogisticsId !== order.id ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingLogisticsId(order.id);
                                      setEditLogisticsDays(order.loadingDays !== undefined ? order.loadingDays : 3);
                                      setEditLogisticsPoint(order.unloadingPoint || 'shop');
                                      setEditLogisticsRemarks(order.remarks || '');
                                    }}
                                    className="p-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-[10px] flex items-center gap-1 font-bold cursor-pointer transition-colors"
                                    title="Edit loading days and unloading point"
                                  >
                                    <Edit3 className="w-3 h-3" />
                                    <span>Edit</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSaveOrderLogistics(order.id)}
                                    className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] flex items-center gap-1 font-bold cursor-pointer shadow-xs transition-colors"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Save</span>
                                  </button>
                                )}
                              </div>

                              {editingLogisticsId === order.id ? (
                                <div className="space-y-2 pt-1">
                                  <div>
                                    <label className="text-[9px] font-bold text-secondary uppercase block">Loading Days:</label>
                                    <input
                                      type="number"
                                      min="0"
                                      max="30"
                                      value={editLogisticsDays}
                                      onChange={(e) => setEditLogisticsDays(parseInt(e.target.value) || 0)}
                                      className="w-20 px-2 py-1 text-xs font-bold bg-white dark:bg-neutral-900 border border-amber-500/40 rounded text-on-surface font-mono"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-secondary uppercase block">Unload Point:</label>
                                    <input
                                      type="text"
                                      value={editLogisticsPoint}
                                      onChange={(e) => setEditLogisticsPoint(e.target.value)}
                                      className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-amber-500/40 rounded text-on-surface"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-secondary uppercase block">Remarks:</label>
                                    <input
                                      type="text"
                                      value={editLogisticsRemarks}
                                      onChange={(e) => setEditLogisticsRemarks(e.target.value)}
                                      placeholder="e.g. 50kg bags, special gate..."
                                      className="w-full px-2 py-1 text-xs bg-white dark:bg-neutral-900 border border-amber-500/40 rounded text-on-surface"
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-secondary">Loading Days:</span>
                                    <strong className="font-mono text-amber-700 dark:text-amber-400 font-bold">{order.loadingDays !== undefined ? order.loadingDays : 3} days</strong>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] text-secondary">Unloading:</span>
                                    <strong className="text-on-surface font-bold capitalize">{order.unloadingPoint || 'shop'}</strong>
                                  </div>
                                  {order.remarks && (
                                    <div className="flex items-start justify-between pt-1 border-t border-amber-500/10 text-[10px]">
                                      <span className="text-secondary shrink-0">Remarks:</span>
                                      <span className="text-on-surface font-medium truncate ml-2 text-right" title={order.remarks}>{order.remarks}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-bold text-secondary uppercase tracking-wider">Quick Actions:</span>
                              <button
                                type="button"
                                onClick={() => handleOpenMerchantModal(order.buyer)}
                                className="btn-tactile px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-on-surface text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-white/10 cursor-pointer"
                              >
                                <User className="w-3.5 h-3.5 text-primary" />
                                Merchant History
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  const buyerProf = resolveBuyerProfile(order.buyer);
                                  const phone = buyerProf?.phone || localStorage.getItem('userPhone') || '9945351166';
                                  const cleanPhone = phone.replace(/[^0-9]/g, '');
                                  const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
                                  const brand = ((order as any).product || 'keshar kali').replace(/\(\d+.*$/, '').trim();
                                  const qty = order.qty || 40;
                                  const rate = order.rate || 10000;
                                  const msg = encodeURIComponent(
                                    `Hello ${order.buyer},\n\nOrder placed successfully.\n\nBrand: ${brand}\nQuantity: ${qty} QTL\nRate: ₹${rate}/QTL\n\nThank you,\nTejas Canvassing`
                                  );
                                  window.open(`https://wa.me/${finalPhone}?text=${msg}`, '_blank');
                                }}
                                className="btn-tactile px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-emerald-500/20 cursor-pointer"
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                                WhatsApp Buyer
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(order.id);
                                  setCopiedId(order.id);
                                  setTimeout(() => setCopiedId(null), 2000);
                                }}
                                className="btn-tactile px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-secondary text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 border border-white/10 cursor-pointer"
                              >
                                {copiedId === order.id ? (
                                  <>
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-emerald-400">Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy ID</span>
                                  </>
                                )}
                              </button>
                            </div>

                            <div className="flex items-center gap-2">
                              {isPendingApproval(order.status) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleAction(order.id, 'accept')}
                                    disabled={actionLoadingId === order.id}
                                    className="btn-tactile px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
                                  >
                                    {actionLoadingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                    Approve Indent
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleAction(order.id, 'reject')}
                                    disabled={actionLoadingId === order.id}
                                    className="btn-tactile px-4 py-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 border border-rose-500/30 disabled:opacity-50 cursor-pointer"
                                  >
                                    {actionLoadingId === order.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                    Reject Indent
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteOrder(order.id)}
                                disabled={actionLoadingId === order.id}
                                className="btn-tactile p-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 transition-colors disabled:opacity-50 cursor-pointer"
                                title="Delete this order"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
                })}
                {filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 dark:bg-primary/10 border border-amber-500/20 dark:border-primary/20 flex items-center justify-center text-primary">
                          <Inbox className="w-7 h-7" />
                        </div>
                        <div className="space-y-1 text-center">
                          <h4 className="text-sm font-bold text-on-surface uppercase tracking-wide">
                            {searchQuery || filterSupplier || filterProduct ? "No matching procurement requests" : "No active procurement intents"}
                          </h4>
                          <p className="text-xs text-secondary/60">
                            {searchQuery || filterSupplier || filterProduct
                              ? "Try clearing your search query or adjusting the supplier/product filter criteria."
                              : "All current trade indents have either been batched into purchase orders or cleared."}
                          </p>
                        </div>
                        <div className="pt-2 flex items-center gap-2">
                          {(searchQuery || filterSupplier || filterProduct) ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSearchQuery('');
                                setFilterSupplier('');
                                setFilterProduct('');
                              }}
                              className="btn-tactile px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              Reset Filters
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsCreateModalOpen(true)}
                              className="btn-tactile px-4 py-2 bg-primary hover:bg-primary/90 text-on-primary rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-2 shadow-sm cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Create Manual Order
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="p-4 bg-surface-container-low/40 border-t border-outline-variant/15 flex flex-col sm:flex-row items-center justify-between gap-3">
             <div className="flex items-center gap-2">
               <span className="text-[11px] font-semibold text-secondary">
                 Active procurement requests: <strong className="text-on-surface font-mono">{filteredOrders.length}</strong>
               </span>
             </div>
             <div className="flex items-center gap-3">
               <button 
                 onClick={handleToggleArchived}
                 disabled={isLoadingArchived}
                 className="inline-flex items-center gap-2 px-4 py-2 bg-secondary/10 hover:bg-secondary/20 text-on-surface border border-outline-variant/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-50"
               >
                 {isLoadingArchived ? (
                   <>
                     <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                     Loading Archives...
                   </>
                 ) : (
                   <>
                     <History className="w-3.5 h-3.5 text-primary" />
                     {isArchivedExpanded ? 'Hide Previous Orders' : `Show Previous & Archived Orders (${archivedOrders.length})`}
                     {isArchivedExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                   </>
                 )}
               </button>
               {archivedFeedback && (
                 <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-fade-in flex items-center gap-1.5">
                   <CheckCircle2 className="w-4 h-4" />
                   {archivedFeedback}
                 </span>
               )}
             </div>
          </div>
        </motion.div>

        {/* Expandable Previous & Archived Orders Section */}
        <AnimatePresence>
          {isArchivedExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -10 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="liquid-glass rounded-3xl overflow-hidden premium-border bg-gradient-to-b from-surface to-surface-dim/30 shadow-lg border-primary/20"
            >
              {/* Header */}
              <div className="p-6 border-b border-outline-variant/20 bg-surface-container-low/50 backdrop-blur-md space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <History className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-black uppercase tracking-widest text-on-surface">
                          Previous & Archived Orders
                        </h3>
                        <span className="text-[10px] font-black uppercase bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-0.5 rounded-full border border-amber-500/20 font-mono">
                          {filteredArchivedOrders.length} Records
                        </span>
                      </div>
                      <p className="text-[10px] text-secondary font-semibold uppercase tracking-wider mt-0.5 opacity-70">
                        Historical accepted, completed, and archived procurement transactions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                      onClick={() => fetchArchivedRecords(true)}
                      disabled={isLoadingArchived}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-on-surface/5 hover:bg-on-surface/10 text-on-surface border border-outline-variant/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      <RefreshCw className={cn("w-3 h-3 text-primary", isLoadingArchived && "animate-spin")} />
                      Sync Cloud Archives
                    </button>
                    <button
                      onClick={() => setIsArchivedExpanded(false)}
                      className="p-1.5 bg-on-surface/5 hover:bg-on-surface/10 text-secondary hover:text-on-surface border border-outline-variant/20 rounded-xl transition-all cursor-pointer"
                      title="Close Previous Orders"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Filter & Search Bar for Archived Orders */}
                <div className="flex flex-wrap gap-2.5 items-center pt-3 border-t border-outline-variant/10">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary/65" />
                    <input 
                      type="text" 
                      placeholder="Search previous orders by ID, buyer, product, mill..." 
                      value={archivedSearchQuery}
                      onChange={(e) => setArchivedSearchQuery(e.target.value)}
                      className="w-full bg-on-surface/5 border border-outline-variant/20 rounded-xl py-2 pl-9 pr-4 text-xs font-bold outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all text-on-surface placeholder:text-secondary/50" 
                    />
                  </div>

                  <div className="relative">
                    <select 
                      value={archivedSupplierFilter}
                      onChange={(e) => setArchivedSupplierFilter(e.target.value)}
                      className="bg-on-surface/[0.04] hover:bg-on-surface/[0.07] border border-outline-variant/20 rounded-xl py-2 pl-3.5 pr-8 text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary/15 transition-all appearance-none text-on-surface cursor-pointer"
                    >
                      <option value="">All Suppliers</option>
                      {availableSuppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary pointer-events-none opacity-60" />
                  </div>

                  {/* Status Filter: All / Approved / Rejected */}
                  <div className="relative">
                    <select 
                      value={archivedStatusFilter}
                      onChange={(e) => setArchivedStatusFilter(e.target.value as 'all' | 'approved' | 'rejected')}
                      className="bg-on-surface/[0.04] hover:bg-on-surface/[0.07] border border-outline-variant/20 rounded-xl py-2 pl-3.5 pr-8 text-[10px] font-black uppercase tracking-wider outline-none focus:ring-2 focus:ring-primary/15 transition-all appearance-none text-on-surface cursor-pointer"
                    >
                      <option value="all">All Statuses (Approved & Rejected)</option>
                      <option value="approved">Approved & Completed</option>
                      <option value="rejected">Rejected Orders</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-secondary pointer-events-none opacity-60" />
                  </div>

                  {(archivedSearchQuery || archivedSupplierFilter || archivedStatusFilter !== 'all') && (
                    <button 
                      onClick={() => { setArchivedSearchQuery(''); setArchivedSupplierFilter(''); setArchivedStatusFilter('all'); }}
                      className="text-[9px] font-black uppercase tracking-widest text-primary hover:text-primary/85 bg-primary/10 border border-primary/15 px-3 py-2 rounded-xl transition-all cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                <table className="w-full text-left border-separate border-spacing-0">
                  <thead className="sticky top-0 z-10">
                    <tr className="text-[9px] font-black text-secondary/70 uppercase tracking-widest bg-surface-container-low/95 backdrop-blur-md border-b border-outline-variant/20 shadow-sm">
                      <th className="px-6 py-3.5 border-b border-outline-variant/15">Order ID & Date</th>
                      <th className="px-6 py-3.5 border-b border-outline-variant/15">Buyer Entity</th>
                      <th className="px-6 py-3.5 border-b border-outline-variant/15">Product & Variety</th>
                      <th className="px-6 py-3.5 text-right border-b border-outline-variant/15 font-mono">Volume (QTLS)</th>
                      <th className="px-6 py-3.5 text-right border-b border-outline-variant/15 font-mono">Rate (₹)</th>
                      <th className="px-6 py-3.5 border-b border-outline-variant/15">Supplier / Mill</th>
                      <th className="px-6 py-3.5 border-b border-outline-variant/15">Status</th>
                      <th className="px-6 py-3.5 border-b border-outline-variant/15 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {filteredArchivedOrders.map((order, idx) => {
                      const val = (Number(order.qty) || 0) * (Number(order.rate) || 0);
                      return (
                        <tr 
                          key={order.id || idx}
                          className="hover:bg-on-surface/[0.02] transition-colors"
                        >
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-on-surface">{order.id}</span>
                            </div>
                            <span className="text-[10px] text-secondary font-medium">{order.date || 'Historical'}</span>
                          </td>
                          <td className="px-6 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-xl bg-secondary/10 flex items-center justify-center font-bold text-[10px] text-secondary">
                                {String(order.buyer || 'VK').slice(0, 2).toUpperCase()}
                              </div>
                              <span className="text-xs font-bold text-on-surface">{order.buyer}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="text-xs font-semibold text-on-surface">{order.product}</span>
                            {order.category && (
                              <p className="text-[9px] text-secondary font-medium">{order.category}</p>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-right font-mono text-xs font-bold text-on-surface">
                            {order.qty} QTLS
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <div className="font-mono text-xs font-bold text-on-surface">₹{order.rate}</div>
                            <div className="text-[9px] font-mono text-secondary">₹{formatINR(val)}</div>
                          </td>
                          <td className="px-6 py-3.5">
                            <span className="text-[11px] font-bold text-secondary uppercase tracking-tight line-clamp-1 max-w-[200px]" title={order.supplier}>
                              {order.supplier}
                            </span>
                          </td>
                          <td className="px-6 py-3.5">
                            {order.status === 'Rejected' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <X className="w-3 h-3" />
                                Rejected
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                {order.status || 'Approved'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleReorderArchivedItem(order)}
                                title="Clone / Re-Order into Active Intents"
                                className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                                Re-Order
                              </button>
                              <button
                                onClick={() => setSelectedArchivedOrder(order)}
                                title="View Full Specifications"
                                className="p-1.5 bg-on-surface/5 hover:bg-on-surface/10 text-secondary hover:text-on-surface border border-outline-variant/20 rounded-xl transition-all cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredArchivedOrders.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-secondary/60 text-xs font-semibold uppercase tracking-wider italic">
                          No archived or previous orders match your filter criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Summary Footer */}
              <div className="p-4 bg-surface-container-low/60 border-t border-outline-variant/15 flex flex-wrap items-center justify-between gap-4 text-xs font-medium text-secondary">
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-secondary/60 block">Total Volume</span>
                    <span className="font-mono font-bold text-on-surface text-sm">
                      {filteredArchivedOrders.reduce((sum, o) => sum + (Number(o.qty) || 0), 0)} QTLS
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-secondary/60 block">Total Historical Value</span>
                    <span className="font-mono font-bold text-emerald-600 text-sm">
                      ₹ {formatINR(filteredArchivedOrders.reduce((sum, o) => sum + ((Number(o.qty) || 0) * (Number(o.rate) || 0)), 0))}
                    </span>
                  </div>
                </div>
                <div className="text-[10px] font-semibold text-secondary/70">
                  Showing {filteredArchivedOrders.length} of {archivedOrders.length} historical records
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trade Volume Section below Active Requests */}
        <div className="grid grid-cols-1 gap-8">
           <motion.div 
             initial={{ opacity: 0, y: 24, scale: 0.99 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             transition={{ duration: 0.52, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
             className="liquid-glass p-8 rounded-3xl premium-border bg-gradient-to-br from-surface to-surface-dim/20 shadow-md"
           >
              <div className="flex justify-between items-center mb-6">
                 <div>
                    <h3 className="font-display font-bold text-base text-on-surface">Weekly Transaction & Volume Flow</h3>
                    <p className="text-[9px] text-secondary font-black uppercase tracking-widest opacity-60">Real-time dynamic system aggregates</p>
                 </div>
                 <div className="flex gap-1.5">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
                       <TrendingUp className="w-4 h-4 text-primary" />
                    </div>
                 </div>
              </div>
              <div className="h-48 w-full min-w-0">
                 <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100} initialDimension={{ width: 300, height: 180 }}>
                    <AreaChart data={trendData}>
                       <defs>
                          <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                             <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15}/>
                             <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                          </linearGradient>
                       </defs>
                       <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-outline-variant)" opacity={0.15} />
                       <XAxis dataKey="name" stroke="var(--color-on-surface)" fontSize={10} tickLine={false} opacity={0.5} />
                       <Tooltip 
                          contentStyle={{ borderRadius: '16px', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', boxShadow: '0 20px 40px rgba(0,0,0,0.08)', padding: '12px' }}
                          labelStyle={{ fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', color: 'var(--color-secondary)' }}
                          itemStyle={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--color-primary)' }}
                       />
                       <Area 
                          type="monotone" 
                          dataKey="value" 
                          stroke="var(--color-primary)" 
                          strokeWidth={3} 
                          fillOpacity={1} 
                          fill="url(#colorVal)" 
                       />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
              <div className="flex justify-between items-center mt-6 pt-6 border-t border-outline-variant/15">
                 <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-secondary/60">Annual Trade Valuation</p>
                    <p className="text-xl font-display font-bold text-emerald-600">₹ 82.4 Cr</p>
                 </div>
                 <button 
                   onClick={() => navigate('/analytics')}
                   className="px-4 py-2 bg-on-background text-background hover:bg-on-background/90 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-95 transition-all shadow-md"
                 >
                    Full Analytics Panel
                 </button>
              </div>
           </motion.div>
        </div>
      </div>

      {/* Batch Action Bar */}
      <AnimatePresence>
        {selectedOrders.length > 0 && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-50"
          >
            <div className="bg-on-background text-background p-6 rounded-3xl shadow-2xl flex flex-wrap items-center justify-between gap-8 border border-white/10 backdrop-blur-xl">
               <div className="flex items-center gap-6">
                  <div className="flex -space-x-3">
                    {selectedOrders.slice(0, 3).map((id, i) => (
                      <div key={id} className="w-10 h-10 rounded-full bg-primary border-2 border-on-background flex items-center justify-center text-[10px] font-black z-20">
                         {currentOrders.find(o => o.id === id)?.initials || '??'}
                      </div>
                    ))}
                    {selectedOrders.length > 3 && (
                      <div className="w-10 h-10 rounded-full bg-surface-container-highest text-on-surface border-2 border-on-background flex items-center justify-center text-[10px] font-black z-10">
                         +{selectedOrders.length - 3}
                      </div>
                    )}
                  </div>
                  <div className="space-y-0.5">
                     <p className="text-[10px] font-black uppercase tracking-widest text-background/40">Selected Assets</p>
                     <div className="flex items-center gap-3">
                       <p className="text-base font-black italic text-background">{(Number(totalSelectedQty) || 0).toFixed(2)} <span className="text-xs non-italic opacity-60 text-background/70">QTLS</span></p>
                       <span className="text-background/20 font-bold">|</span>
                       <p className="text-base font-black text-primary">₹ {formatINR(totalSelectedAmt)}</p>
                     </div>
                  </div>
               </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="space-y-1.5 text-left">
                    <span className="text-[9px] font-black uppercase tracking-widest text-background/40 block">Assigned Supplier</span>
                    <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-2xl px-5 py-3 max-w-[280px]" title="Locked to selected order's supplier.">
                      <Lock className="w-3.5 h-3.5 text-white/50 shrink-0" />
                      <span className="text-xs font-black text-white/95 truncate uppercase tracking-widest">{assignedBatchSupplier || 'Auto-Assigned'}</span>
                    </div>
                  </div>

                  <button 
                    onClick={handleDeleteSelectedOrders}
                    className="bg-rose-600 hover:bg-rose-700 text-white px-5 py-3.5 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-rose-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Selected ({selectedOrders.length})
                  </button>

                  <button 
                    onClick={handleGroupAndPlace}
                    className="bg-primary text-on-primary px-8 py-3.5 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all text-sm group cursor-pointer"
                  >
                    <ShoppingCart className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                    {selectedOrders.length === 1 ? 'Place Single Order' : `Group & Place Orders (${selectedOrders.length})`}
                  </button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Order Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-3xl bg-white dark:bg-neutral-900 p-8 rounded-3xl shadow-2xl premium-border border border-neutral-200 dark:border-neutral-800 text-on-surface"
            >
              {/* Modal Header */}
              <div className="flex justify-between items-start mb-8 pb-4 border-b border-neutral-100 dark:border-neutral-800">
                <div>
                  <h3 className="text-2xl font-black tracking-tight text-neutral-900 dark:text-white">Manual Procurement Entry</h3>
                  <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest mt-1">Authorized Internal Order Booking System</p>
                </div>
                <button 
                  onClick={() => setIsCreateModalOpen(false)}
                  className="p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded-xl transition-all"
                >
                  <X className="w-5 h-5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100" />
                </button>
              </div>

              {/* Form Content in Two Columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                
                {/* Left Column: Commercial & Priority */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-primary mb-4 pb-1 border-b border-neutral-100 dark:border-neutral-800">01. Stakeholders & Urgency</h4>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Buyer Entity</label>
                    <SearchableSelect
                      options={availableBuyers.map(b => b.name)}
                      value={newOrder.buyer}
                      onChange={(val) => {
                        const prof = resolveBuyerProfile(val);
                        setNewOrder(prev => ({
                          ...prev,
                          buyer: val,
                          phone: prof?.phone || prev.phone || ''
                        }));
                      }}
                      placeholder="Select Buyer or enter merchant name..."
                      allowCustom={true}
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Buyer WhatsApp Phone</label>
                      <span className="text-[9px] font-medium text-emerald-600 dark:text-emerald-400">Meta Order Notification</span>
                    </div>
                    <input
                      type="tel"
                      value={newOrder.phone}
                      onChange={(e) => setNewOrder({...newOrder, phone: e.target.value})}
                      placeholder="10-digit mobile (e.g. 9945351166)"
                      className="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-sm font-mono text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Assigned Supplier</label>
                      {newOrder.supplier && (
                        <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                          Supplier Selected
                        </span>
                      )}
                    </div>
                    <SearchableSelect
                      options={availableSuppliers.map(s => s.name)}
                      value={newOrder.supplier}
                      onChange={handleSupplierChange}
                      placeholder="Select Mill/Supplier (or type custom)..."
                      allowCustom={true}
                    />
                  </div>
                </div>

                {/* Right Column: Specifications & Live Financial Calculation */}
                <div className="space-y-6">
                  <div>
                    <h4 className="text-xs font-black uppercase tracking-wider text-primary mb-4 pb-1 border-b border-neutral-100 dark:border-neutral-800">02. Material Specs & Financials</h4>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Brand Name / Product</label>
                      {newOrder.supplier ? (
                        <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full font-mono">
                          {availableBrands.length} Brand{availableBrands.length !== 1 ? 's' : ''} Available
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                          All Varieties
                        </span>
                      )}
                    </div>
                    <SearchableSelect
                      options={
                        newOrder.supplier && availableBrands.length > 0
                          ? availableBrands
                          : Array.from(new Set(inventoryProducts.map(p => (p.name || p.brand)?.trim()).filter(Boolean))).sort()
                      }
                      value={newOrder.product}
                      onChange={(val) => {
                        if (!newOrder.supplier) {
                          const match = inventoryProducts.find(p => (p.name || p.brand)?.trim().toLowerCase() === val.trim().toLowerCase());
                          if (match?.supplier) {
                            setNewOrder(prev => ({ ...prev, product: val, supplier: match.supplier }));
                            return;
                          }
                        }
                        setNewOrder(prev => ({ ...prev, product: val }));
                      }}
                      placeholder={newOrder.supplier ? `Select Brand for ${newOrder.supplier}...` : "Select or type rice variety..."}
                      allowCustom={true}
                    />
                    {newOrder.supplier && (
                      <p className="text-[9px] font-medium text-neutral-500 ml-1">
                        Showing brands for <strong className="text-neutral-700 dark:text-neutral-300">{newOrder.supplier}</strong> (or type custom variety)
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Volume (QTLS)</label>
                      <input 
                        type="number" 
                        placeholder="500.00"
                        value={newOrder.qty}
                        onChange={(e) => setNewOrder({...newOrder, qty: e.target.value})}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-neutral-400 text-neutral-900 dark:text-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-neutral-500 ml-1">Rate (₹/QTLS)</label>
                      <input 
                        type="number" 
                        placeholder="4250"
                        value={newOrder.rate}
                        onChange={(e) => setNewOrder({...newOrder, rate: e.target.value})}
                        className="w-full bg-neutral-50 dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-2xl px-5 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-neutral-400 text-neutral-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Dynamic Real-time Calculation Panel */}
                  <div className="bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/60 dark:border-neutral-800 p-4 rounded-2xl space-y-2.5">
                    <div className="flex justify-between items-center text-[10px] font-bold text-neutral-500 uppercase tracking-widest">
                      <span>Real-time Invoice Estimate</span>
                      <span className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/15">Live</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-neutral-400">
                        {newOrder.qty ? `${newOrder.qty} QTLS` : "0 QTLS"} × {newOrder.rate ? `₹${newOrder.rate}` : "₹0"}
                      </span>
                      <span className="text-xl font-black text-neutral-950 dark:text-white font-mono">
                        ₹ {formatINR((parseFloat(newOrder.qty) || 0) * (parseFloat(newOrder.rate) || 0))}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Section 03: PO Logistics Details (No of days for loading & Unloading Point) */}
                <div className="col-span-1 md:col-span-2 pt-4 border-t border-neutral-200 dark:border-neutral-800">
                  <div className="flex items-center justify-between mb-4 pb-1 border-b border-neutral-100 dark:border-neutral-800">
                    <h4 className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5" />
                      03. Purchase Order Logistics (PO Details)
                    </h4>
                    <span className="text-[10px] text-neutral-500 dark:text-neutral-400 font-semibold">
                      Directly populates the PO &quot;Details&quot; column
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-amber-500/[0.04] dark:bg-amber-500/[0.02] border border-amber-500/20 p-5 rounded-2xl">
                    {/* No of days for loading */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300 ml-1">
                          No of days for loading
                        </label>
                        <span className="text-[9px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-mono">
                          {newOrder.loadingDays} Day{newOrder.loadingDays !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <input 
                          type="number" 
                          min="0"
                          max="30"
                          placeholder="3"
                          value={newOrder.loadingDays}
                          onChange={(e) => setNewOrder({...newOrder, loadingDays: parseInt(e.target.value) || 0})}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-neutral-900 dark:text-white font-mono"
                        />
                        <div className="flex items-center gap-1 flex-wrap">
                          {[1, 2, 3, 5, 7].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setNewOrder({...newOrder, loadingDays: d})}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border cursor-pointer",
                                newOrder.loadingDays === d
                                  ? "bg-primary text-on-primary border-primary shadow-xs"
                                  : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-primary/40"
                              )}
                            >
                              {d}d
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Unloading Point */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300 ml-1">
                          Unloading Point
                        </label>
                        <span className="text-[9px] font-medium text-neutral-500">
                          Destination
                        </span>
                      </div>
                      <div className="space-y-2">
                        <input 
                          type="text" 
                          placeholder="shop, godown, warehouse..."
                          value={newOrder.unloadingPoint}
                          onChange={(e) => setNewOrder({...newOrder, unloadingPoint: e.target.value})}
                          className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-neutral-400 text-neutral-900 dark:text-white"
                        />
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {['shop', 'godown', 'warehouse', 'APMC Yard'].map((pt) => (
                            <button
                              key={pt}
                              type="button"
                              onClick={() => setNewOrder({...newOrder, unloadingPoint: pt})}
                              className={cn(
                                "px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-wider transition-all border cursor-pointer",
                                (newOrder.unloadingPoint || '').toLowerCase() === pt.toLowerCase()
                                  ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                                  : "bg-white dark:bg-neutral-900 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-800 hover:border-amber-500/40"
                              )}
                            >
                              {pt}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Remarks / Excess Details */}
                    <div className="col-span-1 md:col-span-2 space-y-1.5 pt-3 border-t border-amber-500/15">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] font-black uppercase tracking-widest text-neutral-700 dark:text-neutral-300 ml-1">
                          Remarks
                        </label>
                        <span className="text-[9px] text-neutral-400 font-medium">
                          Optional • Notes for PO
                        </span>
                      </div>
                      <input 
                        type="text" 
                        placeholder="e.g. 50kg bags, extra stitches, direct mill loading, specific gate..."
                        value={newOrder.remarks || ''}
                        onChange={(e) => setNewOrder({...newOrder, remarks: e.target.value})}
                        className="w-full bg-white dark:bg-neutral-950 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-2 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-neutral-400 text-neutral-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateOrder}
                  disabled={!newOrder.buyer || !newOrder.qty || !newOrder.rate || !newOrder.product}
                  className="bg-primary hover:bg-primary/95 text-on-primary px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-xl shadow-primary/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale disabled:scale-100 flex items-center gap-2 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm &amp; Book Manual Order</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedMerchant && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMerchant(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-surface border border-outline-variant/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] z-10 text-on-surface"
            >
              {/* Header */}
              <div className="p-6 border-b border-outline-variant/20 flex items-start justify-between bg-surface-container-low">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-lg">
                    {selectedMerchant.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-on-surface flex items-center gap-2">
                      {selectedMerchant}
                      <span className="text-[10px] font-black uppercase bg-primary/10 text-primary px-2.5 py-1 rounded-full tracking-widest leading-none border border-primary/15">B2B Merchant</span>
                    </h3>
                    <p className="text-xs text-secondary mt-1 font-medium flex items-center gap-3">
                      <span>GSTIN: <span className="font-mono font-bold text-on-surface">{merchantHistory?.profile?.gstin || '29AAGCV7712M1ZP'}</span></span>
                      <span className="opacity-30">•</span>
                      <span>Phone: <span className="font-mono font-bold text-on-surface">{merchantHistory?.profile?.phone || '+91 99453 51166'}</span></span>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedMerchant(null)}
                  className="p-2 hover:bg-surface-container rounded-full text-secondary hover:text-on-surface transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Content */}
              {merchantHistoryLoading ? (
                <div className="p-16 flex flex-col items-center justify-center gap-3 text-secondary">
                  <RefreshCw className="w-8 h-8 animate-spin text-primary" />
                  <span className="text-xs font-black uppercase tracking-widest">Loading merchant histories...</span>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Stats Ribbon */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-surface-container-low border border-outline-variant/20 p-4 rounded-2xl text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-secondary">Total Orders</p>
                      <h4 className="text-xl font-black text-on-surface mt-1">{merchantHistory?.orders.length || 0}</h4>
                    </div>
                    <div className="bg-surface-container-low border border-outline-variant/20 p-4 rounded-2xl text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-secondary">Total Arrived Order Qty</p>
                      <h4 className="text-xl font-black text-primary mt-1">
                        {merchantHistory?.orders.filter(o => o.status === 'Arrived').reduce((sum, o) => sum + (Number(o.qty) || 0), 0).toFixed(2)} <span className="text-[10px] uppercase text-secondary font-medium">Qty</span>
                      </h4>
                    </div>
                    <div className="bg-surface-container-low border border-outline-variant/20 p-4 rounded-2xl text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-secondary">Settled Payments</p>
                      <h4 className="text-xl font-black text-emerald-600 mt-1">
                        ₹ {formatINR(merchantHistory?.payments.filter(p => p.status === 'Cleared').reduce((sum, p) => sum + p.amount, 0) || 0)}
                      </h4>
                    </div>
                    <div className="bg-surface-container-low border border-outline-variant/20 p-4 rounded-2xl text-center">
                      <p className="text-[9px] font-black uppercase tracking-widest text-secondary">Outstanding Payments</p>
                      <h4 className="text-xl font-black text-orange-600 mt-1">
                        ₹ {formatINR(merchantHistory?.payments.filter(p => p.status !== 'Cleared').reduce((sum, p) => sum + p.amount, 0) || 0)}
                      </h4>
                    </div>
                  </div>

                  {/* Address Box */}
                  <div className="bg-primary/[0.02] border border-primary/10 p-4 rounded-2xl text-xs">
                    <span className="font-extrabold uppercase text-primary tracking-widest block mb-1 text-[9px]">Registered Shipping Address</span>
                    <span className="text-on-surface/80 font-medium leading-relaxed">{merchantHistory?.profile?.address || 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022'}</span>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-outline-variant/20">
                    <button
                      type="button"
                      onClick={() => setActiveHistoryTab('orders')}
                      className={cn(
                        "flex-1 pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all",
                        activeHistoryTab === 'orders'
                          ? "border-primary text-primary"
                          : "border-transparent text-secondary hover:text-on-surface"
                      )}
                    >
                      Order History ({merchantHistory?.orders.length || 0})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveHistoryTab('payments')}
                      className={cn(
                        "flex-1 pb-3 text-xs font-black uppercase tracking-widest border-b-2 transition-all",
                        activeHistoryTab === 'payments'
                          ? "border-primary text-primary"
                          : "border-transparent text-secondary hover:text-on-surface"
                      )}
                    >
                      Payments to be Collected ({merchantHistory?.payments.filter(p => p.status !== 'Cleared').length || 0})
                    </button>
                  </div>

                  {/* Active Panel */}
                  <div className="min-h-[250px]">
                    {activeHistoryTab === 'orders' ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between bg-surface-container-low/50 p-2.5 rounded-2xl border border-outline-variant/10">
                          <p className="text-[11px] text-secondary font-semibold">
                            Showing {showArrivedOrdersOnly ? 'only arrived' : 'all'} orders for this merchant
                          </p>
                          <button
                            type="button"
                            onClick={() => setShowArrivedOrdersOnly(!showArrivedOrdersOnly)}
                            className={cn(
                              "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all flex items-center gap-1.5",
                              showArrivedOrdersOnly
                                ? "bg-primary text-on-primary border-primary shadow-sm shadow-primary/10"
                                : "bg-surface-container border-outline-variant/30 text-secondary hover:text-on-surface"
                            )}
                          >
                            <span className={cn("w-1.5 h-1.5 rounded-full", showArrivedOrdersOnly ? "bg-on-primary animate-pulse" : "bg-secondary")} />
                            {showArrivedOrdersOnly ? "Arrived Only" : "Show Arrived Only"}
                          </button>
                        </div>

                        {(() => {
                          const ordersToShow = showArrivedOrdersOnly 
                            ? (merchantHistory?.orders || []).filter(o => o.status === 'Arrived')
                            : (merchantHistory?.orders || []);

                          if (ordersToShow.length > 0) {
                            return (
                              <div className="border border-outline-variant/20 rounded-2xl overflow-hidden">
                                <table className="w-full text-left text-xs bg-surface-container-lowest">
                                  <thead>
                                    <tr className="bg-surface-container-low text-secondary font-black uppercase tracking-wider text-[10px]">
                                      <th className="p-4">Order ID</th>
                                      <th className="p-4">Date</th>
                                      <th className="p-4">Product</th>
                                      <th className="p-4 text-right">Volume</th>
                                      <th className="p-4 text-right">Rate</th>
                                      <th className="p-4 text-right">Total</th>
                                      <th className="p-4">Stage</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-outline-variant/10 font-medium text-on-surface">
                                    {ordersToShow.map((o, oIdx) => {
                                      const qty = Number(o.qty) || 0;
                                      const rate = Number(o.rate) || 0;
                                      const totalVal = qty * rate;
                                      return (
                                        <tr key={`${o.id}-${oIdx}`} className="hover:bg-primary/[0.02]">
                                          <td className="p-4 font-mono font-bold">{getOrderBillNo(o.id)}</td>
                                          <td className="p-4 text-secondary">{o.date}</td>
                                          <td className="p-4">
                                            <span className="font-bold text-primary">{o.product || 'Premium Rice'}</span>
                                          </td>
                                          <td className="p-4 text-right font-mono font-bold">{qty.toFixed(2)} QTLS</td>
                                          <td className="p-4 text-right font-mono text-secondary">₹ {formatINR(rate)}</td>
                                          <td className="p-4 text-right font-mono font-black">₹ {formatINR(totalVal)}</td>
                                          <td className="p-4">
                                            <span className={cn(
                                              "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                              o.status === 'Pending Approval' ? "bg-amber-100/85 text-amber-800 border border-amber-300/30" :
                                              o.status === 'Awaiting Grouping' ? "bg-blue-100/85 text-blue-800 border border-blue-300/30" :
                                              o.status === 'Accepted' || o.status === 'Arrived' ? "bg-emerald-100/85 text-emerald-800 border border-emerald-300/30" :
                                              "bg-neutral-100/85 text-neutral-800 border border-neutral-300/30"
                                            )}>
                                              {o.status}
                                            </span>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            );
                          } else {
                            return (
                              <div className="p-12 text-center text-secondary bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/40">
                                <Package className="w-10 h-10 mx-auto text-secondary/40 mb-2" />
                                <p className="text-xs font-bold uppercase tracking-widest">
                                  {showArrivedOrdersOnly ? "No arrived orders found" : "No active orders found"}
                                </p>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {/* Info Banner showing purpose */}
                        <div className="flex items-center justify-between bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/15 p-3 rounded-2xl">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-300">
                              Outstanding payments pending collection for physically arrived cargo & completed trade orders
                            </p>
                          </div>
                        </div>

                        {(() => {
                          const list = merchantHistory?.payments || [];
                          const filtered = list.filter(p => p.status !== 'Cleared');

                          if (filtered.length > 0) {
                            return (
                              <div className="border border-outline-variant/20 rounded-2xl overflow-hidden">
                                <table className="w-full text-left text-xs bg-surface-container-lowest">
                                  <thead>
                                    <tr className="bg-surface-container-low text-secondary font-black uppercase tracking-wider text-[10px]">
                                      <th className="p-4">Bill No</th>
                                      <th className="p-4">Date</th>
                                      <th className="p-4">Type</th>
                                      <th className="p-4">Product/Variety</th>
                                      <th className="p-4 text-right">Volume</th>
                                      <th className="p-4 text-right">Rate</th>
                                      <th className="p-4 text-right">Total Amount</th>
                                      <th className="p-4">Status</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-outline-variant/10 font-medium text-on-surface">
                                    {filtered.map((p, pIdx) => (
                                      <tr key={`${p.id}-${pIdx}`} className="hover:bg-primary/[0.02]">
                                        <td className="p-4 font-mono font-bold">
                                          <span>{p.id}</span>
                                        </td>
                                        <td className="p-4 text-secondary">{p.date}</td>
                                        <td className="p-4">
                                          <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                                            p.type === 'Trade Order' ? "bg-purple-100 text-purple-800" : "bg-blue-100 text-blue-800"
                                          )}>
                                            {p.type || 'Physical Cargo'}
                                          </span>
                                        </td>
                                        <td className="p-4 text-primary font-bold">{p.product}</td>
                                        <td className="p-4 text-right font-mono font-bold">{p.qty.toFixed(2)} QTLS</td>
                                        <td className="p-4 text-right font-mono text-secondary">₹ {formatINR(p.rate)}</td>
                                        <td className="p-4 text-right font-mono font-black text-on-surface">₹ {formatINR(p.amount)}</td>
                                        <td className="p-4 font-black">
                                          <span className={cn(
                                            "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1",
                                            "bg-amber-50 text-amber-600 border border-amber-100"
                                          )}>
                                            <span className="w-1 h-1 rounded-full bg-amber-500" />
                                            {p.status}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          } else {
                            return (
                              <div className="p-12 text-center text-secondary bg-surface-container-low rounded-2xl border border-dashed border-outline-variant/40">
                                <CreditCard className="w-10 h-10 mx-auto text-secondary/40 mb-2" />
                                <p className="text-xs font-bold uppercase tracking-widest">
                                  No pending payments to be collected
                                </p>
                              </div>
                            );
                          }
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="p-4 bg-surface-container-low border-t border-outline-variant/20 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedMerchant(null)}
                  className="px-6 py-2.5 bg-neutral-200 dark:bg-neutral-800 hover:opacity-90 text-[#0e0c0a] dark:text-[#faf8f5] rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Automated Dispatch Overlay */}
      <AnimatePresence>
        {autoDispatchStatus && autoDispatchStatus.isSending && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-lg bg-slate-900 border border-emerald-500/30 p-6 md:p-8 rounded-3xl shadow-2xl shadow-emerald-500/10 font-sans text-slate-100 overflow-hidden"
            >
              {/* Pulse radial background */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />
              
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-black tracking-tight text-white uppercase tracking-wider">Automated Alerts Engine</h3>
                  <p className="text-[10px] text-emerald-400/80 font-mono mt-0.5 uppercase tracking-widest font-black">SYSTEM STATUS: AUTO-DISPATCH ACTIVE</p>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="space-y-2 mb-6 relative z-10">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-300">{autoDispatchStatus.currentAction}</span>
                  <span className="font-mono font-black text-emerald-400">{autoDispatchStatus.progress}%</span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${autoDispatchStatus.progress}%` }}
                    transition={{ duration: 0.3 }}
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
                  />
                </div>
              </div>

              {/* Clean Step Checklist (replacing technical terminal logs code) */}
              <div className="space-y-3 mb-6 bg-slate-950/40 border border-slate-800/80 rounded-2xl p-5 relative z-10 text-xs">
                <div className="text-[10px] uppercase font-black tracking-widest text-slate-500 border-b border-slate-800/40 pb-2.5 mb-3 flex justify-between items-center">
                  <span>DISPATCH PIPELINE STEPS</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" style={{ boxShadow: '0 0 8px #10b981' }} />
                </div>
                
                {/* Step 1 */}
                <div className="flex items-center justify-between py-1 border-b border-slate-900/40">
                  <div className="flex items-center gap-2.5">
                    {autoDispatchStatus.progress >= 25 ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center text-emerald-400 text-[9px] font-bold">✓</div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 animate-pulse flex items-center justify-center text-slate-500 text-[9px] font-mono">•</div>
                    )}
                    <span className={cn("font-medium", autoDispatchStatus.progress >= 25 ? "text-slate-200" : "text-slate-500")}>
                      Resolving Supplier & Buyer database profiles
                    </span>
                  </div>
                  {autoDispatchStatus.progress >= 25 ? (
                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider">Completed</span>
                  ) : (
                    <span className="text-[9px] font-mono text-amber-500 animate-pulse uppercase tracking-wider">Active...</span>
                  )}
                </div>

                {/* Step 2 */}
                <div className="flex items-center justify-between py-1 border-b border-slate-900/40">
                  <div className="flex items-center gap-2.5">
                    {autoDispatchStatus.progress >= 55 ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center text-emerald-400 text-[9px] font-bold">✓</div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-slate-500 text-[9px] font-mono">
                        {autoDispatchStatus.progress >= 25 ? "•" : " "}
                      </div>
                    )}
                    <span className={cn("font-medium", autoDispatchStatus.progress >= 55 ? "text-slate-200" : "text-slate-500")}>
                      Compiling Consolidated Batch PO & Ledger specs
                    </span>
                  </div>
                  {autoDispatchStatus.progress >= 55 ? (
                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider">Completed</span>
                  ) : autoDispatchStatus.progress >= 25 ? (
                    <span className="text-[9px] font-mono text-amber-500 animate-pulse uppercase tracking-wider">Active...</span>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Pending</span>
                  )}
                </div>

                {/* Step 3 */}
                <div className="flex items-center justify-between py-1 border-b border-slate-900/40">
                  <div className="flex items-center gap-2.5">
                    {autoDispatchStatus.progress >= 80 ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center text-emerald-400 text-[9px] font-bold">✓</div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-slate-500 text-[9px] font-mono">
                        {autoDispatchStatus.progress >= 55 ? "•" : " "}
                      </div>
                    )}
                    <span className={cn("font-medium", autoDispatchStatus.progress >= 80 ? "text-slate-200" : "text-slate-500")}>
                      Transmitting Bulk PO to Supplier via SMTP relay
                    </span>
                  </div>
                  {autoDispatchStatus.progress >= 80 ? (
                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider">Completed</span>
                  ) : autoDispatchStatus.progress >= 55 ? (
                    <span className="text-[9px] font-mono text-amber-500 animate-pulse uppercase tracking-wider">Active...</span>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Pending</span>
                  )}
                </div>

                {/* Step 4 */}
                <div className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-2.5">
                    {autoDispatchStatus.progress >= 100 ? (
                      <div className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500 flex items-center justify-center text-emerald-400 text-[9px] font-bold">✓</div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-slate-700 flex items-center justify-center text-slate-500 text-[9px] font-mono">
                        {autoDispatchStatus.progress >= 80 ? "•" : " "}
                      </div>
                    )}
                    <span className={cn("font-medium", autoDispatchStatus.progress >= 100 ? "text-slate-200" : "text-slate-500")}>
                      Dispatching WhatsApp Alerts to Buyers (3-5 Days Arrival)
                    </span>
                  </div>
                  {autoDispatchStatus.progress >= 100 ? (
                    <span className="text-[9px] font-mono text-emerald-400 font-bold uppercase tracking-wider">Completed</span>
                  ) : autoDispatchStatus.progress >= 80 ? (
                    <span className="text-[9px] font-mono text-amber-500 animate-pulse uppercase tracking-wider">Active...</span>
                  ) : (
                    <span className="text-[9px] font-mono text-slate-600 uppercase tracking-wider">Pending</span>
                  )}
                </div>
              </div>

              {/* Secure Delivery Assurance Note */}
              <div className="text-[10px] text-slate-400 flex items-center gap-2 border-t border-slate-800 pt-4 font-medium leading-normal relative z-10">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>We transmit all financial trade items securely via authenticated TLS/SSL SMTP servers and WhatsApp API channels.</span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Archived Order Details Modal */}
      <AnimatePresence>
        {selectedArchivedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedArchivedOrder(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-lg bg-surface border border-outline-variant/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 text-on-surface"
            >
              <div className="p-6 border-b border-outline-variant/20 flex items-start justify-between bg-surface-container-low">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-primary text-base">{selectedArchivedOrder.id}</span>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full border border-emerald-500/20">
                      {selectedArchivedOrder.status || 'Accepted'}
                    </span>
                  </div>
                  <p className="text-xs text-secondary mt-1">Historical Transaction Record</p>
                </div>
                <button
                  onClick={() => setSelectedArchivedOrder(null)}
                  className="p-2 text-secondary hover:text-on-surface bg-on-surface/5 rounded-full transition-all cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3.5 bg-on-surface/[0.03] rounded-2xl border border-outline-variant/15 space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-secondary">Buyer Entity</span>
                    <p className="font-bold text-on-surface text-sm">{selectedArchivedOrder.buyer}</p>
                  </div>
                  <div className="p-3.5 bg-on-surface/[0.03] rounded-2xl border border-outline-variant/15 space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-secondary">Date Placed</span>
                    <p className="font-bold text-on-surface text-sm">{selectedArchivedOrder.date || 'Historical'}</p>
                  </div>
                </div>

                <div className="p-3.5 bg-on-surface/[0.03] rounded-2xl border border-outline-variant/15 space-y-1">
                  <span className="text-[9px] font-black uppercase tracking-widest text-secondary">Supplier / Mill</span>
                  <p className="font-bold text-on-surface">{selectedArchivedOrder.supplier}</p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-on-surface/[0.03] rounded-xl border border-outline-variant/15 space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-secondary">Product</span>
                    <p className="font-bold text-on-surface truncate">{selectedArchivedOrder.product}</p>
                  </div>
                  <div className="p-3 bg-on-surface/[0.03] rounded-xl border border-outline-variant/15 space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-secondary">Volume</span>
                    <p className="font-bold text-on-surface font-mono">{selectedArchivedOrder.qty} QTLS</p>
                  </div>
                  <div className="p-3 bg-on-surface/[0.03] rounded-xl border border-outline-variant/15 space-y-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-secondary">Unit Rate</span>
                    <p className="font-bold text-on-surface font-mono">₹{selectedArchivedOrder.rate}</p>
                  </div>
                </div>

                <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 flex justify-between items-center">
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-800 dark:text-emerald-300">Total Invoice Valuation</span>
                  <span className="font-mono font-black text-lg text-emerald-600 dark:text-emerald-400">
                    ₹ {formatINR((Number(selectedArchivedOrder.qty) || 0) * (Number(selectedArchivedOrder.rate) || 0))}
                  </span>
                </div>
              </div>

              <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low flex justify-end gap-3">
                <button
                  onClick={() => {
                    handleReorderArchivedItem(selectedArchivedOrder);
                    setSelectedArchivedOrder(null);
                  }}
                  className="px-4 py-2.5 bg-primary text-on-primary rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Clone / Re-Order into Active
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Action Button for Instant Manual Order Booking */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-primary hover:bg-primary/95 text-on-primary pl-4 pr-5 py-3.5 rounded-full shadow-2xl shadow-primary/40 border-2 border-white/20 flex items-center gap-2.5 cursor-pointer backdrop-blur-md group"
        title="Create Manual Order Instantly"
      >
        <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform duration-300">
          <Plus className="w-4 h-4 text-white" />
        </div>
        <span className="text-xs font-black uppercase tracking-wider text-white">Create Manual Order</span>
      </motion.button>
    </div>
  );
}
