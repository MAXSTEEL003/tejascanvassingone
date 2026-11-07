import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Building2, 
  Package, 
  MessageSquare, 
  Send, 
  Clock, 
  CheckCircle2, 
  Truck, 
  Phone, 
  FileText, 
  Upload, 
  X, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  AlertTriangle, 
  RotateCw, 
  RotateCcw,
  Undo2,
  ZoomIn, 
  ZoomOut, 
  RefreshCw, 
  LogOut, 
  ChevronRight, 
  ChevronDown, 
  Sparkles, 
  ShieldCheck, 
  Calendar, 
  DollarSign, 
  Coins, 
  TrendingUp, 
  Layers, 
  Printer,
  ExternalLink,
  MapPin,
  Check,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR, getRegisteredSuppliers, sanitizeSupplierName, getDeletedPlacedOrderIds } from '../lib/utils';
import { getVerifiedUserRole, performSecureLogout, getCurrentMillerName } from '../lib/auth';
import { getCollectionDocs, setCollectionDoc, autoCreateArrivalEntryForIncomingLog } from '../lib/firebase';
import { OperationalPO, fetchOperationalOrders, formatQtl } from '../utils/orderOperations';
import { generateSupplierPOA4PrintHtml, printPoDocument } from '../utils/poEmailTemplate';

// Generate an authentic sample rice mill tax invoice for instant testing (supports custom suborder params)
function generateSampleMillInvoice(
  millName: string, 
  poNo: string, 
  billNo: string,
  buyerName?: string,
  grainDesc?: string,
  qty?: number,
  rate?: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // Background Paper Texture
  ctx.fillStyle = '#FCFAF7';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Borders
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#1E293B';
  ctx.strokeRect(40, 40, 1120, 1520);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = '#94A3B8';
  ctx.strokeRect(48, 48, 1104, 1504);

  // Header Title
  ctx.fillStyle = '#0F172A';
  ctx.font = 'bold 34px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CONSIGNMENT TAX INVOICE', 600, 110);

  ctx.font = 'bold 28px serif';
  ctx.fillStyle = '#B45309';
  ctx.fillText(millName.toUpperCase(), 600, 160);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText('Ex-Mill Processing Unit • Rice Aggregator & Trade Partner', 600, 195);
  ctx.fillText('GSTIN: 36AAACB1234F1Z9 | FSSAI Lic: 10019044001234', 600, 225);

  // Horizontal Line
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.moveTo(50, 250);
  ctx.lineTo(1150, 250);
  ctx.stroke();

  // Invoice Details
  ctx.textAlign = 'left';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#1E293B';
  ctx.fillText(`BILL / INVOICE NO: ${billNo}`, 80, 295);
  ctx.fillText(`DATE: ${new Date().toLocaleDateString('en-GB')}`, 80, 330);
  ctx.fillText(`PURCHASE ORDER REF: ${poNo}`, 80, 365);

  ctx.textAlign = 'right';
  ctx.fillText('COMMISSION BROKER:', 1120, 295);
  ctx.font = 'bold 20px sans-serif';
  ctx.fillStyle = '#B45309';
  ctx.fillText('TEJAS CANVASSING', 1120, 325);
  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText('APMC Yard, Bangalore • Karnataka', 1120, 355);

  // Table Header
  ctx.fillStyle = '#F1F5F9';
  ctx.fillRect(80, 420, 1040, 50);
  ctx.strokeStyle = '#CBD5E1';
  ctx.strokeRect(80, 420, 1040, 50);

  ctx.textAlign = 'left';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText('SL', 100, 452);
  ctx.fillText('GRAIN / VARIETY DESCRIPTION', 160, 452);
  ctx.fillText('CONSIGNEE (BUYER)', 540, 452);
  ctx.textAlign = 'right';
  ctx.fillText('QUANTITY', 880, 452);
  ctx.fillText('RATE (₹)', 1000, 452);
  ctx.fillText('AMOUNT (₹)', 1100, 452);

  // Values
  const effectiveBuyer = (buyerName || 'AUTHORIZED BUYER (CONSIGNEE)').toUpperCase();
  const effectiveGrain = (grainDesc || 'KESHAR KALI RAW RICE (SORTEX CLEANED)').toUpperCase();
  const effectiveQty = qty && qty > 0 ? qty : 600;
  const effectiveRate = rate && rate > 0 ? rate : 9949;
  const effectiveAmt = effectiveQty * effectiveRate;

  // Row
  ctx.font = '15px sans-serif';
  ctx.fillStyle = '#1E293B';
  ctx.textAlign = 'left';
  ctx.fillText('1.', 100, 510);
  ctx.fillText(effectiveGrain.length > 34 ? `${effectiveGrain.slice(0, 34)}...` : effectiveGrain, 160, 510);
  ctx.fillText(effectiveBuyer.length > 28 ? `${effectiveBuyer.slice(0, 28)}...` : effectiveBuyer, 540, 510);
  ctx.textAlign = 'right';
  ctx.fillText(`${effectiveQty.toFixed(2)} QTLS`, 880, 510);
  ctx.fillText(`₹ ${effectiveRate.toLocaleString('en-IN')}`, 1000, 510);
  ctx.fillText(`₹ ${effectiveAmt.toLocaleString('en-IN')}`, 1100, 510);

  // Bottom Notice
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#E2E8F0';
  ctx.strokeRect(80, 1300, 1040, 160);

  ctx.textAlign = 'left';
  ctx.font = 'bold 15px sans-serif';
  ctx.fillStyle = '#0F172A';
  ctx.fillText('DECLARATION & DISPATCH TERMS:', 100, 1335);
  ctx.font = '14px sans-serif';
  ctx.fillStyle = '#64748B';
  ctx.fillText('1. Goods dispatched as per agreed trade specification through Tejas Canvassing.', 100, 1370);
  ctx.fillText('2. Weight and quality certified at mill dispatch weighbridge prior to transit loading.', 100, 1400);
  ctx.fillText('3. Digitally acknowledged & uploaded via Tejas Canvassing Miller Portal.', 100, 1430);

  return canvas.toDataURL('image/jpeg', 0.88);
}

export default function MillerPortalView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as 'pos' | 'loadings' | 'payments' | 'profile' | 'chat') || 'pos';

  // Role and Mill Resolution
  const userRole = getVerifiedUserRole();
  const registeredSuppliers = useMemo(() => getRegisteredSuppliers(), []);
  
  const [selectedMill, setSelectedMill] = useState<string>(() => {
    const fromAuth = getCurrentMillerName();
    if (fromAuth) return fromAuth;
    const stored = localStorage.getItem('millerName');
    if (stored) return stored;
    return registeredSuppliers[0]?.name || 'BHAGWATI RICE AND AGRO INDUSTRIES';
  });

  const millProfile = useMemo(() => {
    const match = registeredSuppliers.find(s => s.name.toLowerCase() === selectedMill.toLowerCase());
    return {
      name: selectedMill,
      id: match?.id || 'SUP-01',
      code: match?.code || 'BRI-0001',
      phone: match?.phone || '9440188941',
      email: match?.email || `${selectedMill.toLowerCase().replace(/[^a-z0-9]/g, '')}@gmail.com`,
      location: 'Industrial APMC Commercial Hub'
    };
  }, [selectedMill, registeredSuppliers]);

  // State: Orders & POs
  const [orders, setOrders] = useState<any[]>(() => {
    try {
      const raw = localStorage.getItem('placed_orders');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  // State: Operational Loadings
  const [operationalOrders, setOperationalOrders] = useState<OperationalPO[]>([]);
  // State: Arrival Entries / Payment Transactions
  const [arrivalEntries, setArrivalEntries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInputText, setChatInputText] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load chat messages for this mill
  useEffect(() => {
    const loadChats = () => {
      try {
        const raw = localStorage.getItem('miller_chats');
        if (raw) {
          setChatMessages(JSON.parse(raw));
        }
      } catch {}
    };
    loadChats();
    window.addEventListener('miller-chat-updated', loadChats);
    window.addEventListener('storage', loadChats);
    return () => {
      window.removeEventListener('miller-chat-updated', loadChats);
      window.removeEventListener('storage', loadChats);
    };
  }, []);

  const handleSendMillerChat = async () => {
    const text = chatInputText.trim();
    if (!text || !selectedMill) return;
    setIsSendingChat(true);

    const newMsg = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      millName: selectedMill,
      sender: 'miller',
      senderName: selectedMill,
      type: 'text',
      text,
      timestamp: new Date().toISOString(),
      status: 'sent'
    };

    try {
      const current = JSON.parse(localStorage.getItem('miller_chats') || '[]');
      const updated = [...current, newMsg];
      localStorage.setItem('miller_chats', JSON.stringify(updated));
      setChatMessages(updated);
      await setCollectionDoc('miller_chats', newMsg.id, newMsg);
      window.dispatchEvent(new CustomEvent('miller-chat-updated'));
      setChatInputText('');
      setSuccessToast('✓ Message sent to Tejas Canvassing.');
      setTimeout(() => setSuccessToast(null), 2500);
    } catch (err) {
      console.warn('Failed to send chat message:', err);
    } finally {
      setIsSendingChat(false);
    }
  };
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_ack' | 'dispatched' | 'arrived'>('all');

  // Modals
  const [dispatchModalOrder, setDispatchModalOrder] = useState<any | null>(null);
  const [vehicleNoInput, setVehicleNoInput] = useState('');
  const [driverPhoneInput, setDriverPhoneInput] = useState('');
  const [billNoInput, setBillNoInput] = useState('');
  const [dispatchDateInput, setDispatchDateInput] = useState(() => new Date().toISOString().split('T')[0]);
  const [attachedBillPhoto, setAttachedBillPhoto] = useState<string | null>(null);
  const [dispatchNotes, setDispatchNotes] = useState('');
  const [isSavingDispatch, setIsSavingDispatch] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Sub-Order Specific Bills State
  const [subOrderBills, setSubOrderBills] = useState<Record<string, { billNo: string; billPhoto: string | null }>>({});
  const [activeUploadSubKey, setActiveUploadSubKey] = useState<string | null>(null);

  // Full Screen Bill Viewer Modal
  const [viewingBillModal, setViewingBillModal] = useState<{ isOpen: boolean; photoUrl: string; title: string } | null>(null);
  const [billZoom, setBillZoom] = useState(1);
  const [billRotation, setBillRotation] = useState(0);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Cloud Data
  const refreshAllData = async () => {
    try {
      setIsLoading(true);
      const [cloudOrders, ops, cloudArrivals] = await Promise.all([
        getCollectionDocs('placed_orders').catch(() => []),
        fetchOperationalOrders(true).catch(() => []),
        getCollectionDocs('arrival_entries').catch(() => [])
      ]);

      if (Array.isArray(cloudOrders) && cloudOrders.length > 0) {
        setOrders(cloudOrders);
        localStorage.setItem('placed_orders', JSON.stringify(cloudOrders));
      }
      setOperationalOrders(ops);
      setArrivalEntries(cloudArrivals);
    } catch (err) {
      console.warn('Notice loading miller data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAllData();

    const handleSync = () => refreshAllData();
    window.addEventListener('placed-orders-updated', handleSync);
    window.addEventListener('arrival-entry-updated', handleSync);
    window.addEventListener('operational-orders-updated', handleSync);
    window.addEventListener('storage', handleSync);

    return () => {
      window.removeEventListener('placed-orders-updated', handleSync);
      window.removeEventListener('arrival-entry-updated', handleSync);
      window.removeEventListener('operational-orders-updated', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Filter Orders for this specific Mill
  const millOrders = useMemo(() => {
    const deletedPlaced = getDeletedPlacedOrderIds();
    const cleanMillName = selectedMill.toLowerCase().trim();

    return orders.filter(o => {
      if (!o) return false;
      const oId = String(o.id || '').toLowerCase().trim().replace(/^#/, '');
      if (deletedPlaced.has(oId)) return false;

      const oSup = String(o.supplier || o.supplierName || (o.originalOrders && o.originalOrders[0]?.supplier) || '').toLowerCase().trim();
      return oSup === cleanMillName || oSup.includes(cleanMillName) || cleanMillName.includes(oSup);
    }).sort((a, b) => {
      const timeA = new Date(a.date || a.timestamp || 0).getTime();
      const timeB = new Date(b.date || b.timestamp || 0).getTime();
      return timeB - timeA;
    });
  }, [orders, selectedMill]);

  // Filtered Mill Orders based on search & tab
  const filteredMillOrders = useMemo(() => {
    return millOrders.filter(o => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const poId = String(o.id || '').toLowerCase();
        const buyer = String(o.buyer || '').toLowerCase();
        const truck = String(o.truckNo || o.vehicleNo || '').toLowerCase();
        const bill = String(o.actualSupplierBillNo || o.billNo || '').toLowerCase();
        const hasSubMatch = Array.isArray(o.originalOrders) && o.originalOrders.some((s: any) => 
          String(s.buyer || '').toLowerCase().includes(q) || 
          String(s.product || '').toLowerCase().includes(q)
        );

        if (!poId.includes(q) && !buyer.includes(q) && !truck.includes(q) && !bill.includes(q) && !hasSubMatch) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter === 'needs_ack') {
        return !o.isAcknowledged;
      }
      if (statusFilter === 'dispatched') {
        const isDispatched = o.status === 'In Transit' || o.status === 'Dispatched' || Boolean(o.truckNo || o.vehicleNo);
        return isDispatched && o.status !== 'Arrived';
      }
      if (statusFilter === 'arrived') {
        return o.status === 'Arrived';
      }

      return true;
    });
  }, [millOrders, searchQuery, statusFilter]);

  // Pending Loadings for this Mill
  const millPendingLoadings = useMemo(() => {
    const cleanMill = selectedMill.toLowerCase().trim();
    return operationalOrders.filter(po => {
      if (!po) return false;
      const s = String(po.supplier || '').toLowerCase().trim();
      const isMyMill = s === cleanMill || s.includes(cleanMill) || cleanMill.includes(s);
      const isPending = (po.poQtl > po.arrivalQtl) || po.status === 'Pending Loading' || po.status === 'Partial Arrival' || po.arrivalQtl === 0;
      return isMyMill && isPending;
    });
  }, [operationalOrders, selectedMill]);

  // Payments / Settlement Records for this Mill
  const millPayments = useMemo(() => {
    const cleanMill = selectedMill.toLowerCase().trim();
    
    // Scan arrival entries and placed orders
    const records: Array<{
      id: string;
      date: string;
      billNo: string;
      buyer: string;
      qty: number;
      rate: number;
      amount: number;
      isCleared: boolean;
      clearedDate?: string;
      chqNo?: string;
      daysPending?: number;
    }> = [];

    arrivalEntries.forEach((r, idx) => {
      if (!r) return;
      const rMiller = String(r.millerName || '').toLowerCase().trim();
      if (!rMiller.includes(cleanMill) && !cleanMill.includes(rMiller)) return;

      const qty = parseFloat(r.qty) || 0;
      const rate = parseFloat(r.rate) || 0;
      const amount = parseFloat(r.amount || r.netAmt) || (qty * rate);
      const isCleared = r.noOfDayRec === 'Cleared' || r.payment === 'Cleared';
      const arrDate = r.date || '';

      let daysPending = 0;
      if (arrDate && !isCleared) {
        const diff = Date.now() - new Date(arrDate).getTime();
        daysPending = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      }

      records.push({
        id: r.id || `arr-${idx}`,
        date: arrDate,
        billNo: r.billNo || `BIL-${idx + 1}`,
        buyer: r.partyName || r.buyer || 'Authorized Buyer',
        qty,
        rate,
        amount,
        isCleared,
        clearedDate: r.chqDt || r.date,
        chqNo: r.chqNo,
        daysPending
      });
    });

    return records.sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
  }, [arrivalEntries, selectedMill]);

  // Aggregate Payment Metrics
  const paymentStats = useMemo(() => {
    let totalInvoiced = 0;
    let totalCleared = 0;
    let totalOutstanding = 0;
    let totalQty = 0;

    millPayments.forEach(p => {
      totalInvoiced += p.amount;
      totalQty += p.qty;
      if (p.isCleared) totalCleared += p.amount;
      else totalOutstanding += p.amount;
    });

    return { totalInvoiced, totalCleared, totalOutstanding, totalQty };
  }, [millPayments]);

  // Action: Acknowledge PO
  const handleAcknowledgePo = async (order: any) => {
    try {
      const updatedOrder = {
        ...order,
        isAcknowledged: true,
        acknowledgedAt: new Date().toISOString(),
        status: order.status === 'Placed' ? 'Confirmed' : order.status
      };

      // Save to local storage
      const currentOrders = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const updatedList = currentOrders.map((o: any) => o.id === order.id ? updatedOrder : o);
      localStorage.setItem('placed_orders', JSON.stringify(updatedList));
      setOrders(updatedList);

      // Save to Firestore
      await setCollectionDoc('placed_orders', String(order.id), updatedOrder);

      // Sync to operational cache
      try {
        const cached = localStorage.getItem('cached_operational_orders');
        if (cached) {
          const opsList: OperationalPO[] = JSON.parse(cached);
          const targetPo = String(order.id).replace(/^#/, '').toLowerCase();
          const updatedOps = opsList.map(p => {
            if (p.poNumber?.toLowerCase().includes(targetPo)) {
              return {
                ...p,
                rawOrder: { ...p.rawOrder, isAcknowledged: true, acknowledgedAt: updatedOrder.acknowledgedAt, acknowledgedByMiller: true }
              };
            }
            return p;
          });
          localStorage.setItem('cached_operational_orders', JSON.stringify(updatedOps));
        }
      } catch {}

      window.dispatchEvent(new CustomEvent('placed-orders-updated'));
      window.dispatchEvent(new CustomEvent('operational-orders-updated'));
      window.dispatchEvent(new Event('storage'));

      // Log acknowledgment to miller_chats
      try {
        const ackChat = {
          id: `ack-${order.id}-${Date.now()}`,
          millName: selectedMill,
          sender: 'miller',
          senderName: selectedMill,
          type: 'ack',
          poId: String(order.id),
          text: `We acknowledge receipt of Purchase Order #${order.id}. Order is booked for loading as per schedule.`,
          timestamp: new Date().toISOString(),
          status: 'read'
        };
        const currentChats = JSON.parse(localStorage.getItem('miller_chats') || '[]');
        localStorage.setItem('miller_chats', JSON.stringify([...currentChats, ackChat]));
        await setCollectionDoc('miller_chats', ackChat.id, ackChat);
        window.dispatchEvent(new CustomEvent('miller-chat-updated'));
      } catch {}

      setSuccessToast(`✓ PO #${order.id} acknowledged! Tejas Canvassing notified.`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err) {
      console.error('Error acknowledging PO:', err);
      alert('Failed to record acknowledgment. Please try again.');
    }
  };

  // Action: Reverse / Undo PO Acknowledgment
  const handleReverseAcknowledgePo = async (order: any) => {
    if (!window.confirm(`Are you sure you want to reverse the acknowledgment for PO #${order.id}? Status will revert to Awaiting Acknowledgment.`)) {
      return;
    }

    try {
      const updatedOrder = {
        ...order,
        isAcknowledged: false,
        acknowledgedAt: null,
        status: order.status === 'Confirmed' ? 'Placed' : order.status
      };

      // Save to local storage
      const currentOrders = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const updatedList = currentOrders.map((o: any) => o.id === order.id ? updatedOrder : o);
      localStorage.setItem('placed_orders', JSON.stringify(updatedList));
      setOrders(updatedList);

      // Save to Firestore
      await setCollectionDoc('placed_orders', String(order.id), updatedOrder);

      // Sync to operational cache
      try {
        const cached = localStorage.getItem('cached_operational_orders');
        if (cached) {
          const opsList: OperationalPO[] = JSON.parse(cached);
          const targetPo = String(order.id).replace(/^#/, '').toLowerCase();
          const updatedOps = opsList.map(p => {
            if (p.poNumber?.toLowerCase().includes(targetPo)) {
              return {
                ...p,
                rawOrder: { ...p.rawOrder, isAcknowledged: false, acknowledgedAt: null, acknowledgedByMiller: false }
              };
            }
            return p;
          });
          localStorage.setItem('cached_operational_orders', JSON.stringify(updatedOps));
        }
      } catch {}

      window.dispatchEvent(new CustomEvent('placed-orders-updated'));
      window.dispatchEvent(new CustomEvent('operational-orders-updated'));
      window.dispatchEvent(new Event('storage'));

      // Log reverse acknowledgment to miller_chats
      try {
        const revChat = {
          id: `rev-${order.id}-${Date.now()}`,
          millName: selectedMill,
          sender: 'miller',
          senderName: selectedMill,
          type: 'reverse_ack',
          poId: String(order.id),
          text: `Purchase Order #${order.id} acknowledgment reversed by ${selectedMill}. Status reverted to Awaiting Acknowledgment.`,
          timestamp: new Date().toISOString(),
          status: 'read'
        };
        const currentChats = JSON.parse(localStorage.getItem('miller_chats') || '[]');
        localStorage.setItem('miller_chats', JSON.stringify([...currentChats, revChat]));
        await setCollectionDoc('miller_chats', revChat.id, revChat);
        window.dispatchEvent(new CustomEvent('miller-chat-updated'));
      } catch {}

      setSuccessToast(`✓ PO #${order.id} acknowledgment reversed.`);
      setTimeout(() => setSuccessToast(null), 3500);
    } catch (err) {
      console.error('Error reversing acknowledgment:', err);
      alert('Failed to reverse acknowledgment. Please try again.');
    }
  };

  // Action: Open Dispatch & Bill Modal
  const handleOpenDispatchModal = (order: any) => {
    setDispatchModalOrder(order);
    setVehicleNoInput(order.truckNo || order.vehicleNo || '');
    setDriverPhoneInput(order.driverPhone || '');
    setBillNoInput(order.actualSupplierBillNo || order.billNo || '');
    setDispatchDateInput(order.dispatchedAt ? order.dispatchedAt.split('T')[0] : new Date().toISOString().split('T')[0]);
    setAttachedBillPhoto(order.billPhoto || order.billPhotoUrl || order.billAttachment || null);
    setDispatchNotes(order.dispatchNotes || '');
    setActiveUploadSubKey(null);

    const subOrders = Array.isArray(order.originalOrders) && order.originalOrders.length > 0
      ? order.originalOrders
      : [{
          id: 'sub-0',
          buyer: order.buyer || 'Direct Consignee',
          product: order.product || 'Rice Brand',
          brand: order.brand || order.product || 'Rice Brand',
          qty: order.qty || order.totalVolume || 600,
          rate: order.rate || 8000
        }];

    const initialBills: Record<string, { billNo: string; billPhoto: string | null }> = {};
    let hasDistinctSubBills = false;

    subOrders.forEach((sub: any, idx: number) => {
      const subKey = String(sub.id || sub.buyer || `sub-${idx}`);
      const sBillNo = (sub.actualSupplierBillNo || sub.billNo || (order.supplierBillNos && order.supplierBillNos[subKey]) || '').trim();
      const sBillPhoto = sub.billPhoto || sub.billPhotoUrl || sub.billAttachment || (order.supplierBillPhotos && order.supplierBillPhotos[subKey]) || null;
      if (sBillNo || sBillPhoto) hasDistinctSubBills = true;
      initialBills[subKey] = {
        billNo: sBillNo,
        billPhoto: sBillPhoto
      };
    });

    setSubOrderBills(initialBills);
  };

  // Trigger File Picker for a specific Sub-Order
  const handleTriggerSubOrderUpload = (subKey: string) => {
    setActiveUploadSubKey(subKey);
    fileInputRef.current?.click();
  };

  // Generate a distinct branded Tax Invoice for a specific Sub-Order
  const handleGenerateSubOrderInvoice = (subKey: string, sub: any) => {
    if (!dispatchModalOrder) return;
    const existingNo = subOrderBills[subKey]?.billNo?.trim();
    const billNum = existingNo || `BIL-${Math.floor(1000 + Math.random() * 9000)}`;
    const sampleUrl = generateSampleMillInvoice(
      selectedMill,
      dispatchModalOrder.id,
      billNum,
      sub.buyer,
      sub.brand || sub.product,
      parseFloat(sub.qty) || 0,
      parseFloat(sub.rate) || 0
    );

    setSubOrderBills(prev => ({
      ...prev,
      [subKey]: {
        billNo: billNum,
        billPhoto: sampleUrl
      }
    }));

    if (!attachedBillPhoto) {
      setAttachedBillPhoto(sampleUrl);
    }
  };

  // Handle Photo File Upload for Sub-Order Bills
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      alert('File size exceeds 8MB. Please select a smaller photo or document.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl && activeUploadSubKey) {
        setSubOrderBills(prev => ({
          ...prev,
          [activeUploadSubKey]: {
            billNo: prev[activeUploadSubKey]?.billNo || billNoInput || '',
            billPhoto: dataUrl
          }
        }));
        if (!attachedBillPhoto) {
          setAttachedBillPhoto(dataUrl);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Action: Save Dispatch & Bill Attachment (Syncs to Placed Orders & Arrival Entry)
  const handleSaveDispatchDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchModalOrder) return;

    try {
      setIsSavingDispatch(true);

      const cleanVehicle = vehicleNoInput.trim().toUpperCase();
      const cleanDriver = driverPhoneInput.trim();
      const cleanBill = billNoInput.trim().toUpperCase();

      const subOrders = Array.isArray(dispatchModalOrder.originalOrders) && dispatchModalOrder.originalOrders.length > 0
        ? dispatchModalOrder.originalOrders
        : [{
            id: 'sub-0',
            buyer: dispatchModalOrder.buyer || 'Direct Consignee',
            product: dispatchModalOrder.product || 'Rice Brand',
            brand: dispatchModalOrder.brand || dispatchModalOrder.product || 'Rice Brand',
            qty: dispatchModalOrder.qty || dispatchModalOrder.totalVolume || 600,
            rate: dispatchModalOrder.rate || 8000
          }];

      const updatedOriginalOrders = subOrders.map((sub: any, idx: number) => {
        const subKey = String(sub.id || sub.buyer || `sub-${idx}`);
        const sInfo = subOrderBills[subKey];
        const subBillNo = sInfo?.billNo?.trim().toUpperCase() || cleanBill || sub.actualSupplierBillNo || sub.billNo || '';
        const subBillPhoto = sInfo?.billPhoto || attachedBillPhoto || sub.billPhoto || null;

        return {
          ...sub,
          truckNo: cleanVehicle || sub.truckNo,
          vehicleNo: cleanVehicle || sub.vehicleNo,
          actualSupplierBillNo: subBillNo,
          billNo: subBillNo,
          billPhoto: subBillPhoto,
          billPhotoUrl: subBillPhoto,
          billAttachment: subBillPhoto
        };
      });

      const distinctBills = updatedOriginalOrders.map(s => s.actualSupplierBillNo).filter(Boolean);
      const primaryBillNo = cleanBill || (distinctBills.length > 0 ? distinctBills.join(', ') : dispatchModalOrder.billNo);
      const primaryBillPhoto = attachedBillPhoto || updatedOriginalOrders.find(s => s.billPhoto)?.billPhoto || dispatchModalOrder.billPhoto;

      const supplierBillNosMap: Record<string, string> = {};
      const supplierBillPhotosMap: Record<string, string> = {};
      updatedOriginalOrders.forEach((s, idx) => {
        const key = String(s.id || s.buyer || `sub-${idx}`);
        if (s.actualSupplierBillNo) supplierBillNosMap[key] = s.actualSupplierBillNo;
        if (s.billPhoto) supplierBillPhotosMap[key] = s.billPhoto;
      });

      const updatedOrder = {
        ...dispatchModalOrder,
        truckNo: cleanVehicle,
        vehicleNo: cleanVehicle,
        driverPhone: cleanDriver,
        actualSupplierBillNo: primaryBillNo,
        billNo: primaryBillNo,
        billPhoto: primaryBillPhoto,
        billPhotoUrl: primaryBillPhoto,
        billAttachment: primaryBillPhoto,
        supplierBillNos: supplierBillNosMap,
        supplierBillPhotos: supplierBillPhotosMap,
        status: cleanVehicle ? 'In Transit' : dispatchModalOrder.status,
        dispatchedAt: dispatchDateInput,
        dispatchNotes: dispatchNotes.trim(),
        isAcknowledged: true,
        acknowledgedAt: dispatchModalOrder.acknowledgedAt || new Date().toISOString(),
        originalOrders: updatedOriginalOrders
      };

      // 1. Update placed_orders in localStorage & Firestore
      const currentOrders = JSON.parse(localStorage.getItem('placed_orders') || '[]');
      const updatedOrdersList = currentOrders.map((o: any) => o.id === dispatchModalOrder.id ? updatedOrder : o);
      localStorage.setItem('placed_orders', JSON.stringify(updatedOrdersList));
      setOrders(updatedOrdersList);
      await setCollectionDoc('placed_orders', String(dispatchModalOrder.id), updatedOrder);

      // 2. CRITICAL: Sync to Arrival Entry so Admin & Staff immediately see each suborder's specific bill & lorry
      try {
        const rawSheets = localStorage.getItem('arrival_entry_sheets_v4');
        if (rawSheets) {
          const parsedSheets: any[] = JSON.parse(rawSheets);
          let sheetModified = false;

          parsedSheets.forEach(sheet => {
            if (!sheet || !Array.isArray(sheet.data)) return;
            sheet.data.forEach((row: any) => {
              if (!row) return;
              const rPo = String(row.purchaseOrderNo || row.mainPoNo || '').trim().replace(/^#/, '');
              const targetPo = String(dispatchModalOrder.id || '').trim().replace(/^#/, '');
              
              if (rPo && rPo.toLowerCase() === targetPo.toLowerCase()) {
                sheetModified = true;
                if (cleanVehicle) row.truckNo = cleanVehicle;
                if (cleanDriver) row.driverPhone = cleanDriver;
                row.millerName = selectedMill;

                // Match with sub-order by partyName / buyer!
                const rowParty = String(row.partyName || row.buyer || '').trim().toLowerCase();
                const matchedSub = updatedOriginalOrders.find(s => {
                  const b = String(s.buyer || '').trim().toLowerCase();
                  return b && (b === rowParty || b.includes(rowParty) || rowParty.includes(b));
                });

                if (matchedSub && (matchedSub.actualSupplierBillNo || matchedSub.billPhoto)) {
                  if (matchedSub.actualSupplierBillNo) row.billNo = matchedSub.actualSupplierBillNo;
                  if (matchedSub.billPhoto) {
                    row.billPhoto = matchedSub.billPhoto;
                    row.billPhotoUrl = matchedSub.billPhoto;
                  }
                } else {
                  if (cleanBill) row.billNo = cleanBill;
                  if (primaryBillPhoto) {
                    row.billPhoto = primaryBillPhoto;
                    row.billPhotoUrl = primaryBillPhoto;
                  }
                }
              }
            });
          });

          if (sheetModified) {
            localStorage.setItem('arrival_entry_sheets_v4', JSON.stringify(parsedSheets));
            window.dispatchEvent(new CustomEvent('arrival-entry-updated'));
          }
        }
      } catch (err) {
        console.warn('Notice syncing arrival entry sheets:', err);
      }

      // 3. Sync to operational cache so Pending Loadings reflects lorry and bills
      try {
        const cached = localStorage.getItem('cached_operational_orders');
        if (cached) {
          const opsList: OperationalPO[] = JSON.parse(cached);
          const targetPo = String(dispatchModalOrder.id).replace(/^#/, '').toLowerCase();
          const updatedOps = opsList.map(p => {
            if (p.poNumber?.toLowerCase().includes(targetPo)) {
              return {
                ...p,
                billNo: primaryBillNo || p.billNo,
                rawOrder: { 
                  ...p.rawOrder, 
                  truckNo: cleanVehicle, 
                  vehicleNo: cleanVehicle, 
                  driverPhone: cleanDriver,
                  billPhoto: primaryBillPhoto,
                  billPhotoUrl: primaryBillPhoto,
                  originalOrders: updatedOriginalOrders
                }
              };
            }
            return p;
          });
          localStorage.setItem('cached_operational_orders', JSON.stringify(updatedOps));
        }
      } catch {}

      // 4. Dispatch events for real-time reactivity
      window.dispatchEvent(new CustomEvent('placed-orders-updated'));
      window.dispatchEvent(new CustomEvent('operational-orders-updated'));
      window.dispatchEvent(new Event('storage'));

      setDispatchModalOrder(null);
      setSuccessToast(`✓ Dispatch & Sub-order Bills synced successfully with Tejas!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error('Error saving dispatch details:', err);
      alert('Error updating dispatch information. Please check connection and try again.');
    } finally {
      setIsSavingDispatch(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface dark:bg-neutral-950 text-on-surface font-sans antialiased pb-24">
      {/* Top Banner / Mill Switcher Bar */}
      <header className="sticky top-0 z-40 bg-surface/90 dark:bg-neutral-900/90 backdrop-blur-md border-b border-outline-variant/30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
          {/* Mill Identity */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/25 text-primary flex items-center justify-center shrink-0 shadow-inner">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
                  MILLER DISPATCH DESK
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Synced Live
                </span>
              </div>
              
              {/* Mill Identity: Solid Title for Miller, Switcher Dropdown for Admin */}
              <div className="relative mt-0.5 flex items-center gap-1.5">
                {userRole === 'admin' ? (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={selectedMill}
                      onChange={(e) => {
                        setSelectedMill(e.target.value);
                        localStorage.setItem('millerName', e.target.value);
                      }}
                      className="bg-transparent font-black text-sm sm:text-base text-on-surface outline-none cursor-pointer truncate max-w-[280px] sm:max-w-[420px] hover:text-primary transition-colors"
                      title="Switch Mill View (Admin Only)"
                    >
                      {registeredSuppliers.map(s => (
                        <option key={s.id} value={s.name} className="bg-surface dark:bg-neutral-900 text-on-surface font-bold text-xs">
                          {s.name} {s.code ? `(${s.code})` : ''}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-secondary shrink-0 pointer-events-none" />
                  </div>
                ) : (
                  <h2 className="font-black text-sm sm:text-base text-on-surface truncate max-w-[280px] sm:max-w-[420px]">
                    {selectedMill}
                  </h2>
                )}
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={refreshAllData}
              disabled={isLoading}
              title="Refresh Data"
              className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface transition-all cursor-pointer shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin text-primary")} />
            </button>

            {userRole === 'admin' ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/miller-updates')}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  title="Return to WhatsApp Miller Updates Desk"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Miller Updates</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="px-3 py-1.5 rounded-xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 font-bold text-xs shadow-xs hover:opacity-90 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Admin</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  performSecureLogout();
                  navigate('/login?portal=miller');
                }}
                className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 font-bold text-xs border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            )}
          </div>
        </div>

        {/* Tab Navigation Navigation */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 border-t border-outline-variant/20 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'pos' })}
            className={cn(
              "px-4 py-3 text-xs font-black tracking-tight border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer",
              activeTab === 'pos'
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-secondary hover:text-on-surface"
            )}
          >
            <Package className="w-4 h-4" />
            <span>Purchase Orders ({millOrders.length})</span>
            {millOrders.filter(o => !o.isAcknowledged).length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary text-on-primary text-[9px] font-black animate-pulse">
                {millOrders.filter(o => !o.isAcknowledged).length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'loadings' })}
            className={cn(
              "px-4 py-3 text-xs font-black tracking-tight border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer",
              activeTab === 'loadings'
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-secondary hover:text-on-surface"
            )}
          >
            <Truck className="w-4 h-4" />
            <span>Pending Loadings ({millPendingLoadings.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'payments' })}
            className={cn(
              "px-4 py-3 text-xs font-black tracking-tight border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer",
              activeTab === 'payments'
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-secondary hover:text-on-surface"
            )}
          >
            <Coins className="w-4 h-4" />
            <span>Payments & Billing</span>
          </button>

          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'chat' })}
            className={cn(
              "px-4 py-3 text-xs font-black tracking-tight border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer",
              activeTab === 'chat'
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-secondary hover:text-on-surface"
            )}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chat with Tejas</span>
          </button>

          <button
            type="button"
            onClick={() => setSearchParams({ tab: 'profile' })}
            className={cn(
              "px-4 py-3 text-xs font-black tracking-tight border-b-2 transition-all flex items-center gap-2 shrink-0 cursor-pointer",
              activeTab === 'profile'
                ? "border-primary text-primary bg-primary/5"
                : "border-transparent text-secondary hover:text-on-surface"
            )}
          >
            <Building2 className="w-4 h-4" />
            <span>Mill Profile</span>
          </button>
        </div>
      </header>

      {/* Main Tab Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* TAB 1: PURCHASE ORDERS */}
        {activeTab === 'pos' && (
          <div className="space-y-6">
            {/* Top Stat Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-blue-600" />
                  Allocated POs
                </span>
                <p className="text-2xl font-black text-on-surface tracking-tight font-sans">
                  {millOrders.length}
                </p>
                <p className="text-[11px] text-secondary font-medium">Orders issued to this mill</p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-rose-600" />
                  Awaiting Ack
                </span>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tight font-sans">
                  {millOrders.filter(o => !o.isAcknowledged).length}
                </p>
                <p className="text-[11px] text-secondary font-medium">Action required by mill</p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  In Transit
                </span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight font-sans">
                  {millOrders.filter(o => o.status === 'In Transit' || o.truckNo || o.vehicleNo).length}
                </p>
                <p className="text-[11px] text-secondary font-medium">Lorry on the road</p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 shadow-xs space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-purple-600" />
                  Total Volume
                </span>
                <p className="text-2xl font-black text-on-surface tracking-tight font-sans">
                  {millOrders.reduce((sum, o) => {
                    const q = Array.isArray(o.originalOrders) 
                      ? o.originalOrders.reduce((s: number, sub: any) => s + (parseFloat(sub.qty) || 0), 0)
                      : (parseFloat(o.totalVolume || o.qty) || 0);
                    return sum + q;
                  }, 0).toFixed(2)} <span className="text-xs font-black text-secondary">QTLS</span>
                </p>
                <p className="text-[11px] text-secondary font-medium">Consolidated contract weight</p>
              </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-3 bg-surface-container rounded-2xl border border-outline-variant/30 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-secondary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search PO #, Consignee, Lorry, Bill..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-surface dark:bg-neutral-900 border border-outline-variant/40 rounded-xl text-xs font-bold text-on-surface placeholder:text-secondary outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
                {(['all', 'needs_ack', 'dispatched', 'arrived'] as const).map(tabKey => (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => setStatusFilter(tabKey)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap",
                      statusFilter === tabKey
                        ? "bg-primary text-on-primary shadow-xs"
                        : "bg-surface-container-high hover:bg-surface-container text-secondary hover:text-on-surface"
                    )}
                  >
                    {tabKey === 'all' && 'All POs'}
                    {tabKey === 'needs_ack' && 'Needs Ack'}
                    {tabKey === 'dispatched' && 'In Transit'}
                    {tabKey === 'arrived' && 'Arrived'}
                  </button>
                ))}
              </div>
            </div>

            {/* Orders Cards List */}
            {filteredMillOrders.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-surface-container border border-outline-variant/30 space-y-3">
                <Package className="w-12 h-12 text-secondary/40 mx-auto" />
                <h3 className="font-black text-base text-on-surface">No Purchase Orders Found</h3>
                <p className="text-xs text-secondary max-w-sm mx-auto">
                  {searchQuery ? 'No PO matches your search query.' : `No purchase orders have been placed for ${selectedMill} under this filter.`}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredMillOrders.map((order) => {
                  const subOrders = Array.isArray(order.originalOrders) && order.originalOrders.length > 0
                    ? order.originalOrders
                    : [{
                        buyer: order.buyer || 'Direct Consignee',
                        product: order.product || 'KESHAR KALI',
                        qty: order.qty || order.totalVolume || 600,
                        rate: order.rate || 8000,
                        remarks: order.remarks || '',
                        unloadingPoint: order.unloadingPoint || 'shop'
                      }];

                  const totalVolume = subOrders.reduce((s: number, sub: any) => s + (parseFloat(sub.qty) || 0), 0);
                  const isAcknowledged = Boolean(order.isAcknowledged);
                  const hasVehicle = Boolean(order.truckNo || order.vehicleNo);
                  const hasBill = Boolean(order.actualSupplierBillNo || order.billNo);
                  const hasBillPhoto = Boolean(order.billPhoto || order.billPhotoUrl || order.billAttachment);

                  return (
                    <div 
                      key={order.id}
                      className="p-5 rounded-3xl bg-surface-container border border-outline-variant/30 shadow-xs hover:shadow-md transition-all space-y-4"
                    >
                      {/* PO Card Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-outline-variant/20">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-black text-base text-on-surface tracking-tight">
                              PO #{order.id}
                            </span>
                            <span className="text-xs text-secondary font-semibold">
                              • Issued on {order.date || 'Today'}
                            </span>
                            {/* Acknowledgment Badge */}
                            {isAcknowledged ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-black">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                ACKNOWLEDGED BY MILL
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[10px] font-black animate-pulse">
                                <Clock className="w-3 h-3 text-rose-600" />
                                AWAITING ACKNOWLEDGMENT
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-secondary">
                            Delivery Terms: Loading Days: <span className="font-bold text-on-surface">{order.loadingDays || 5} Days</span> • Primary Broker: <span className="font-bold text-on-surface">Tejas Canvassing</span>
                          </p>
                        </div>

                        {/* Top Action Buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {!isAcknowledged ? (
                            <button
                              type="button"
                              onClick={() => handleAcknowledgePo(order)}
                              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              <span>Acknowledge PO</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleReverseAcknowledgePo(order)}
                              title="Reverse acknowledgment back to Awaiting Acknowledgment"
                              className="px-3 py-2 rounded-xl bg-surface dark:bg-neutral-900 hover:bg-rose-500/10 hover:border-rose-500/30 text-secondary hover:text-rose-600 border border-outline-variant/30 font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Reverse Ack</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleOpenDispatchModal(order)}
                            className="btn-tactile px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-black text-xs shadow-md shadow-primary/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                          >
                            <Truck className="w-4 h-4" />
                            <span>{hasVehicle ? 'Update Dispatch / Lorry' : 'Dispatch Lorry & Attach Bill'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => printPoDocument(order.supplier || selectedMill || 'DIRECT MILL', order, subOrders)}
                            title="Print / View Official PO Document"
                            className="p-2 rounded-xl bg-surface-container-high hover:bg-surface-container text-secondary hover:text-on-surface transition-all cursor-pointer"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Sub-Orders Table */}
                      <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface dark:bg-neutral-900/60">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-surface-container-high/60 border-b border-outline-variant/20 text-[10px] font-black uppercase tracking-wider text-secondary">
                              <th className="py-2.5 px-3.5">Consignee (Buyer)</th>
                              <th className="py-2.5 px-3.5">Grain Variety / Brand</th>
                              <th className="py-2.5 px-3.5 text-right">Volume</th>
                              <th className="py-2.5 px-3.5 text-right">Rate Ex-Mill</th>
                              <th className="py-2.5 px-3.5 text-right">Estimated Value</th>
                              <th className="py-2.5 px-3.5">Actual Mill Bill</th>
                              <th className="py-2.5 px-3.5">Destination / Unloading</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-outline-variant/15 font-sans">
                            {subOrders.map((sub: any, sIdx: number) => {
                              const sQty = parseFloat(sub.qty) || 0;
                              const sRate = parseFloat(sub.rate) || 0;
                              const sAmt = sQty * sRate;
                              const subKey = String(sub.id || sub.buyer || `sub-${sIdx}`);
                              const sBillNo = (sub.actualSupplierBillNo || sub.billNo || (order.supplierBillNos && order.supplierBillNos[subKey]) || '').trim();
                              const sBillPhoto = sub.billPhoto || sub.billPhotoUrl || sub.billAttachment || (order.supplierBillPhotos && order.supplierBillPhotos[subKey]) || null;

                              return (
                                <tr key={sIdx} className="hover:bg-surface-container/40 transition-colors">
                                  <td className="py-3 px-3.5 font-bold text-on-surface">
                                    {sub.buyer}
                                  </td>
                                  <td className="py-3 px-3.5 font-bold text-primary">
                                    {sub.product || 'Rice Brand'}
                                  </td>
                                  <td className="py-3 px-3.5 text-right font-black text-on-surface font-sans text-sm tracking-tight">
                                    {sQty.toFixed(2)} <span className="text-[10px] font-bold text-secondary">QTLS</span>
                                  </td>
                                  <td className="py-3 px-3.5 text-right font-bold text-on-surface">
                                    ₹ {formatINR(sRate)}
                                  </td>
                                  <td className="py-3 px-3.5 text-right font-black text-on-surface font-sans">
                                    ₹ {formatINR(sAmt)}
                                  </td>
                                  <td className="py-3 px-3.5">
                                    {sBillPhoto ? (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setViewingBillModal({
                                            isOpen: true,
                                            photoUrl: sBillPhoto,
                                            title: `Mill Bill • ${sub.buyer} (${sBillNo || 'Document'})`
                                          });
                                        }}
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black cursor-pointer transition-all shadow-2xs active:scale-95"
                                        title="Click to view attached invoice copy"
                                      >
                                        <FileText className="w-3 h-3 text-emerald-600" />
                                        <span>{sBillNo || 'View Bill'}</span>
                                      </button>
                                    ) : sBillNo ? (
                                      <span className="font-mono font-black text-xs text-on-surface bg-surface-container px-2 py-0.5 rounded border border-outline-variant/30">
                                        {sBillNo}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-secondary/60 italic">
                                        Pending
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-3.5 text-secondary text-[11px] font-medium">
                                    {sub.unloadingPoint || 'Shop Delivery'} {sub.remarks ? `• ${sub.remarks}` : ''}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Dispatch & Attached Bill Footnote Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        {/* Dispatch Lorry Info */}
                        <div className="p-3 rounded-2xl bg-surface-container-high/40 border border-outline-variant/20 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0">
                              <Truck className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[10px] font-black uppercase tracking-wider text-secondary">
                                Dispatch Vehicle / Lorry
                              </p>
                              <p className="text-xs font-black text-on-surface truncate">
                                {hasVehicle ? (order.truckNo || order.vehicleNo) : 'Not Dispatched Yet'}
                              </p>
                              {order.driverPhone && (
                                <p className="text-[10px] text-secondary font-medium">
                                  Driver Contact: {order.driverPhone}
                                </p>
                              )}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleOpenDispatchModal(order)}
                            className="px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            {hasVehicle ? 'Edit' : '+ Add Lorry'}
                          </button>
                        </div>

                        {/* Actual Mill Bill Info */}
                        <div className="p-3 rounded-2xl bg-surface-container-high/40 border border-outline-variant/20 flex flex-col justify-between gap-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black uppercase tracking-wider text-secondary">
                                  Actual Mill Invoice
                                </p>
                                <p className="text-xs font-black text-on-surface truncate">
                                  {hasBill ? (order.actualSupplierBillNo || order.billNo) : 'No Bill Attached'}
                                </p>
                                <p className="text-[10px] text-secondary font-medium">
                                  {hasBillPhoto ? '✓ Bill Document Shared with Tejas' : 'Pending Upload'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {hasBillPhoto && (
                                <button
                                  type="button"
                                  onClick={() => setViewingBillModal({
                                    isOpen: true,
                                    photoUrl: order.billPhoto || order.billPhotoUrl || order.billAttachment,
                                    title: `Actual Bill: ${order.actualSupplierBillNo || order.billNo || order.id}`
                                  })}
                                  className="px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Bill</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleOpenDispatchModal(order)}
                                className="px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                              >
                                {hasBillPhoto ? 'Manage' : '+ Upload'}
                              </button>
                            </div>
                          </div>

                          {/* Sub-order Bill Badges (if multiple sub-orders exist) */}
                          {subOrders.length > 1 && subOrders.some((s: any) => s.billPhoto || s.billPhotoUrl || s.actualSupplierBillNo) && (
                            <div className="pt-2 border-t border-outline-variant/15 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-black uppercase text-secondary tracking-wider">Sub-Bills:</span>
                              {subOrders.map((sub: any, sIdx: number) => {
                                const subKey = String(sub.id || sub.buyer || `sub-${sIdx}`);
                                const sBillNo = (sub.actualSupplierBillNo || sub.billNo || (order.supplierBillNos && order.supplierBillNos[subKey]) || '').trim();
                                const sPhoto = sub.billPhoto || sub.billPhotoUrl || (order.supplierBillPhotos && order.supplierBillPhotos[subKey]);
                                if (!sBillNo && !sPhoto) return null;

                                return (
                                  <button
                                    key={sIdx}
                                    type="button"
                                    onClick={() => {
                                      if (sPhoto) {
                                        setViewingBillModal({
                                          isOpen: true,
                                          photoUrl: sPhoto,
                                          title: `Mill Bill • ${sub.buyer} (${sBillNo || 'Invoice'})`
                                        });
                                      } else {
                                        handleOpenDispatchModal(order);
                                      }
                                    }}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface border border-outline-variant/30 text-[10px] font-bold text-on-surface hover:border-emerald-500 cursor-pointer transition-colors"
                                  >
                                    <span className="text-secondary max-w-[80px] truncate">{sub.buyer}:</span>
                                    <span className="font-mono text-emerald-600 font-bold">{sBillNo || 'Attached'}</span>
                                    {sPhoto && <Eye className="w-2.5 h-2.5 text-emerald-600 shrink-0" />}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PENDING LOADINGS */}
        {activeTab === 'loadings' && (
          <div className="space-y-6">
            {/* Pending Loadings KPI Header */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-1 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Total PO Volume</span>
                <p className="text-2xl font-black text-on-surface font-sans">
                  {millPendingLoadings.reduce((sum, po) => sum + (po.poQtl || 0), 0).toFixed(2)}{' '}
                  <span className="text-xs font-bold text-secondary">QTLS</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-1 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Arrived / Dispatched</span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-sans">
                  {millPendingLoadings.reduce((sum, po) => sum + (po.arrivalQtl || 0), 0).toFixed(2)}{' '}
                  <span className="text-xs font-bold text-secondary">QTLS</span>
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-1 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-primary">Net Pending to Load</span>
                <p className="text-2xl font-black text-primary font-sans">
                  {millPendingLoadings.reduce((sum, po) => sum + Math.max(0, po.poQtl - (po.arrivalQtl || 0)), 0).toFixed(2)}{' '}
                  <span className="text-xs font-bold text-primary/70">QTLS</span>
                </p>
              </div>
            </div>

            {/* Pending Loadings List */}
            {millPendingLoadings.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-surface-container border border-outline-variant/30 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h3 className="font-black text-base text-on-surface">All Orders Loaded & Clear!</h3>
                <p className="text-xs text-secondary max-w-sm mx-auto">
                  There are no outstanding pending loadings for {selectedMill}. All consignments have been fully dispatched or arrived.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-outline-variant/30 bg-surface-container shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-container-high border-b border-outline-variant/20 text-[10px] font-black uppercase tracking-wider text-secondary">
                      <th className="py-3 px-4">PO Number & Date</th>
                      <th className="py-3 px-4">Consignee (Buyer)</th>
                      <th className="py-3 px-4">Brand / Variety</th>
                      <th className="py-3 px-4 text-right">PO Qty</th>
                      <th className="py-3 px-4 text-right">Loaded Qty</th>
                      <th className="py-3 px-4 text-right">Pending Balance</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/15 font-sans">
                    {millPendingLoadings.map((po) => {
                      const pendingQty = Math.max(0, po.poQtl - (po.arrivalQtl || 0));
                      const matchingPlacedOrder = orders.find(o => String(o.id).replace(/^#/, '').toLowerCase() === po.poNumber.replace(/^#/, '').toLowerCase());

                      return (
                        <tr key={po.id} className="hover:bg-surface-container-high/40 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-on-surface">
                            <div className="flex flex-col">
                              <span>{po.poNumber}</span>
                              <span className="text-[10px] text-secondary font-sans font-normal">{po.date}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 font-bold text-on-surface">
                            {po.buyer}
                          </td>
                          <td className="py-3 px-4 font-bold text-primary">
                            {po.brand}
                          </td>
                          <td className="py-3 px-4 text-right font-black font-sans text-sm">
                            {po.poQtl.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-emerald-600 font-sans">
                            {po.arrivalQtl.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-primary font-sans text-sm">
                            {pendingQty.toFixed(2)} <span className="text-[10px] font-bold">QTLS</span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                              {po.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                if (matchingPlacedOrder) {
                                  handleOpenDispatchModal(matchingPlacedOrder);
                                } else {
                                  alert(`Purchase order ${po.poNumber} details loaded.`);
                                }
                              }}
                              className="btn-tactile px-3 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-bold text-xs shadow-xs transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                            >
                              <Truck className="w-3.5 h-3.5" />
                              <span>Dispatch Lorry</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PAYMENTS & SETTLEMENT */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            {/* Payment KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-1 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Total Billed Volume</span>
                <p className="text-2xl font-black text-on-surface font-sans tracking-tight">
                  {paymentStats.totalQty.toFixed(2)} <span className="text-xs font-bold text-secondary">QTLS</span>
                </p>
                <p className="text-[11px] text-secondary">Total arrival weight recorded</p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-1 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-secondary">Total Invoiced Amount</span>
                <p className="text-2xl font-black text-on-surface font-sans tracking-tight">
                  ₹ {formatINR(paymentStats.totalInvoiced)}
                </p>
                <p className="text-[11px] text-secondary">Gross billed value</p>
              </div>

              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-1 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Cleared / Received
                </span>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-sans tracking-tight">
                  ₹ {formatINR(paymentStats.totalCleared)}
                </p>
                <p className="text-[11px] text-secondary">Payment settled via Cheque/RTGS</p>
              </div>

              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 space-y-1 shadow-xs">
                <span className="text-[10px] font-black uppercase tracking-wider text-rose-700 dark:text-rose-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-600" />
                  Outstanding Due
                </span>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 font-sans tracking-tight">
                  ₹ {formatINR(paymentStats.totalOutstanding)}
                </p>
                <p className="text-[11px] text-secondary">Pending settlement</p>
              </div>
            </div>

            {/* Payments Ledger Table */}
            {millPayments.length === 0 ? (
              <div className="p-12 text-center rounded-3xl bg-surface-container border border-outline-variant/30 space-y-3">
                <Coins className="w-12 h-12 text-secondary/40 mx-auto" />
                <h3 className="font-black text-base text-on-surface">No Payment Records Found</h3>
                <p className="text-xs text-secondary max-w-sm mx-auto">
                  No arrival bills or payment tracking entries have been recorded yet for {selectedMill}.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-3xl border border-outline-variant/30 bg-surface-container shadow-xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-surface-container-high border-b border-outline-variant/20 text-[10px] font-black uppercase tracking-wider text-secondary">
                      <th className="py-3 px-4">Date & Bill No</th>
                      <th className="py-3 px-4">Consignee (Buyer)</th>
                      <th className="py-3 px-4 text-right">Quantity</th>
                      <th className="py-3 px-4 text-right">Rate</th>
                      <th className="py-3 px-4 text-right">Net Bill Amount</th>
                      <th className="py-3 px-4 text-center">Settlement Status</th>
                      <th className="py-3 px-4 text-right">Payment Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/15 font-sans">
                    {millPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-surface-container-high/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-on-surface">
                          <div className="flex flex-col">
                            <span>{p.billNo}</span>
                            <span className="text-[10px] text-secondary font-sans font-normal">{p.date}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold text-on-surface">
                          {p.buyer}
                        </td>
                        <td className="py-3 px-4 text-right font-black font-sans text-sm">
                          {p.qty.toFixed(2)} <span className="text-[10px] font-bold text-secondary">QTLS</span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold text-on-surface">
                          ₹ {formatINR(p.rate)}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-on-surface font-sans text-sm">
                          ₹ {formatINR(p.amount)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {p.isCleared ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              CLEARED
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/20">
                              <Clock className="w-3 h-3 text-rose-600" />
                              OUTSTANDING ({p.daysPending}D)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-secondary text-[11px] font-mono">
                          {p.chqNo ? `CHQ/UTR: ${p.chqNo}` : (p.isCleared ? 'Bank Transfer' : 'Under Payment Terms')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CHAT WITH TEJAS */}
        {activeTab === 'chat' && (
          <div className="max-w-3xl mx-auto rounded-3xl bg-[#efeae2] dark:bg-[#0b141a] border border-outline-variant/30 shadow-md flex flex-col h-[600px] overflow-hidden">
            {/* WhatsApp Header for Miller */}
            <div className="px-4 py-3 bg-surface/95 dark:bg-neutral-900/95 border-b border-outline-variant/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary font-black text-xs flex items-center justify-center shrink-0">
                  TC
                </div>
                <div>
                  <h3 className="font-black text-sm text-on-surface">Tejas Canvassing</h3>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Central APMC Dispatch Desk • Live
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="tel:9876543210"
                  className="px-3 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Call Office</span>
                </a>
              </div>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="max-w-md mx-auto p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-[10px] text-amber-900 dark:text-amber-200">
                🔒 Direct dispatch chat with Tejas Canvassing. Messages and PO updates are synchronized live.
              </div>

              {chatMessages
                .filter(m => (m.millName || '').toUpperCase() === selectedMill.toUpperCase())
                .map((msg) => {
                  const isMine = msg.sender === 'miller';
                  const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-md rounded-2xl p-3 shadow-xs space-y-1 text-xs",
                          isMine
                            ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-neutral-900 dark:text-neutral-100 rounded-tr-xs"
                            : "bg-white dark:bg-[#202c33] text-neutral-900 dark:text-neutral-100 rounded-tl-xs"
                        )}
                      >
                        <span className="text-[9px] font-black uppercase tracking-wider opacity-70 block">
                          {isMine ? 'You (Mill)' : 'Tejas Canvassing'}
                        </span>
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text || (msg.vehicleNo ? `Dispatched Lorry: ${msg.vehicleNo}` : 'Update')}</p>
                        <span className="text-[9px] opacity-60 font-mono block text-right">{time}</span>
                      </div>
                    </div>
                  );
                })}
              <div ref={chatEndRef} />
            </div>

            {/* Message Input */}
            <div className="p-3 bg-surface/95 dark:bg-neutral-900/95 border-t border-outline-variant/30 flex items-center gap-2 shrink-0">
              <input
                type="text"
                placeholder="Type a message to Tejas Canvassing..."
                value={chatInputText}
                onChange={(e) => setChatInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMillerChat();
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-surface-container border border-outline-variant/30 text-xs font-medium text-on-surface placeholder:text-secondary outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={handleSendMillerChat}
                disabled={isSendingChat || !chatInputText.trim()}
                className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-md transition-all active:scale-95 disabled:opacity-40"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </div>
          </div>
        )}

        {/* TAB 4: MILL PROFILE */}
        {activeTab === 'profile' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="p-6 rounded-3xl bg-surface-container border border-outline-variant/30 shadow-xs space-y-6">
              <div className="flex items-center gap-4 pb-4 border-b border-outline-variant/20">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 text-primary flex items-center justify-center shrink-0 shadow-inner">
                  <Building2 className="w-7 h-7" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-on-surface tracking-tight">{millProfile.name}</h2>
                  <p className="text-xs text-secondary font-medium">Registered Ex-Mill Partner with Tejas Canvassing</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-2xl bg-surface dark:bg-neutral-900 border border-outline-variant/30 space-y-1">
                  <p className="text-[10px] font-black uppercase text-secondary">Permanent Supplier Code</p>
                  <p className="font-mono font-black text-sm text-on-surface">{millProfile.code}</p>
                </div>

                <div className="p-4 rounded-2xl bg-surface dark:bg-neutral-900 border border-outline-variant/30 space-y-1">
                  <p className="text-[10px] font-black uppercase text-secondary">Dispatch Contact Phone</p>
                  <p className="font-bold text-sm text-on-surface">{millProfile.phone}</p>
                </div>

                <div className="p-4 rounded-2xl bg-surface dark:bg-neutral-900 border border-outline-variant/30 space-y-1">
                  <p className="text-[10px] font-black uppercase text-secondary">Official Contact Email</p>
                  <p className="font-bold text-sm text-on-surface truncate">{millProfile.email}</p>
                </div>

                <div className="p-4 rounded-2xl bg-surface dark:bg-neutral-900 border border-outline-variant/30 space-y-1">
                  <p className="text-[10px] font-black uppercase text-secondary">Commercial Hub</p>
                  <p className="font-bold text-sm text-on-surface">{millProfile.location}</p>
                </div>
              </div>

              {/* Trade Terms & Conditions */}
              <div className="p-4 rounded-2xl bg-surface-container border border-outline-variant/30 space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-primary">
                  Ex-Mill Partnership Agreement:
                </h4>
                <ul className="text-xs text-secondary space-y-1.5 list-disc pl-4 font-medium">
                  <li>Direct dispatch coordination via Tejas Canvassing centralized APMC desk.</li>
                  <li>Vehicle number and driver contact to be shared upon truck weighment.</li>
                  <li>Actual consignment tax invoice must be attached directly through this portal for instant billing reconciliation.</li>
                  <li>Payment clearance tracked live through Tejas digital payment books upon arrival confirmation.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* DISPATCH LORRY & ATTACH BILL MODAL */}
      <AnimatePresence>
        {dispatchModalOrder && (() => {
          const modalSubOrders = Array.isArray(dispatchModalOrder.originalOrders) && dispatchModalOrder.originalOrders.length > 0
            ? dispatchModalOrder.originalOrders
            : [{
                id: 'sub-0',
                buyer: dispatchModalOrder.buyer || 'Direct Consignee',
                product: dispatchModalOrder.product || 'Rice Brand',
                brand: dispatchModalOrder.brand || dispatchModalOrder.product || 'Rice Brand',
                qty: dispatchModalOrder.qty || dispatchModalOrder.totalVolume || 600,
                rate: dispatchModalOrder.rate || 8000,
                unloadingPoint: dispatchModalOrder.unloadingPoint || 'shop'
              }];

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-surface dark:bg-neutral-900 border border-outline-variant/30 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                  <div className="space-y-0.5">
                    <h3 className="font-black text-base text-on-surface tracking-tight flex items-center gap-2">
                      <Truck className="w-4 h-4 text-primary" />
                      Dispatch Lorry & Attach Mill Bill
                    </h3>
                    <p className="text-xs text-secondary font-medium">
                      PO #{dispatchModalOrder.id} • {selectedMill} • {modalSubOrders.length} Sub-Order{modalSubOrders.length > 1 ? 's' : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDispatchModalOrder(null)}
                    className="p-1.5 rounded-full hover:bg-surface-container text-secondary hover:text-on-surface transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveDispatchDetails} className="space-y-4">
                  {/* Vehicle & Driver Details */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-secondary">
                        Truck / Vehicle Number *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. AP 29 TB 5678"
                        value={vehicleNoInput}
                        onChange={(e) => setVehicleNoInput(e.target.value.toUpperCase())}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 text-xs font-black text-on-surface outline-none focus:border-primary uppercase font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-secondary">
                        Driver Mobile Number *
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 9876543210"
                        value={driverPhoneInput}
                        onChange={(e) => setDriverPhoneInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 text-xs font-black text-on-surface outline-none focus:border-primary font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase text-secondary">
                        Dispatch Date
                      </label>
                      <input
                        type="date"
                        value={dispatchDateInput}
                        onChange={(e) => setDispatchDateInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container border border-outline-variant/30 text-xs font-bold text-on-surface outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Hidden File Input for sub-order uploads */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*,application/pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {/* SEPARATE BILL FOR EACH SUB-ORDER */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase text-secondary flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        Mill Bills For Each Sub-Order ({modalSubOrders.length} {modalSubOrders.length > 1 ? 'Buyers' : 'Buyer'})
                      </label>
                      <span className="text-[10px] text-secondary">
                        Attach individual mill invoice copy for each consignee
                      </span>
                    </div>

                    <div className="space-y-3">
                      {modalSubOrders.map((sub: any, sIdx: number) => {
                        const subKey = String(sub.id || sub.buyer || `sub-${sIdx}`);
                        const sBill = subOrderBills[subKey] || { billNo: '', billPhoto: null };
                        const sQty = parseFloat(sub.qty) || 0;
                        const sRate = parseFloat(sub.rate) || 0;

                        return (
                          <div 
                            key={subKey} 
                            className="p-3.5 rounded-2xl bg-surface-container-high/40 border border-outline-variant/30 space-y-3 hover:border-primary/40 transition-colors"
                          >
                            {/* Suborder Header */}
                            <div className="flex items-center justify-between gap-2 pb-2 border-b border-outline-variant/20">
                              <div className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-mono font-black text-[11px] flex items-center justify-center shrink-0">
                                  {sIdx + 1}
                                </span>
                                <div>
                                  <p className="font-black text-xs text-on-surface leading-tight">
                                    {sub.buyer}
                                  </p>
                                  <p className="text-[10px] text-primary font-bold">
                                    {sub.brand || sub.product || 'Rice Brand'}
                                  </p>
                                </div>
                              </div>

                              <div className="text-right">
                                <p className="font-black text-xs font-mono text-on-surface tracking-tight">
                                  {sQty.toFixed(2)} <span className="text-[9px] text-secondary">QTLS</span>
                                </p>
                                <p className="text-[10px] font-bold text-secondary">
                                  @ ₹{sRate.toLocaleString('en-IN')} / QTL
                                </p>
                              </div>
                            </div>

                            {/* Suborder Bill Input and Attachment */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-black uppercase text-secondary">
                                    Sub-Order Bill / Invoice No *
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleGenerateSubOrderInvoice(subKey, sub)}
                                    className="text-[9px] font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
                                    title="Auto-generate a certified sample bill for this buyer"
                                  >
                                    <Sparkles className="w-2.5 h-2.5" />
                                    Auto-Bill
                                  </button>
                                </div>
                                <input
                                  type="text"
                                  placeholder="e.g. BIL-9481"
                                  value={sBill.billNo}
                                  onChange={(e) => {
                                    const val = e.target.value.toUpperCase();
                                    setSubOrderBills(prev => ({
                                      ...prev,
                                      [subKey]: {
                                        billNo: val,
                                        billPhoto: prev[subKey]?.billPhoto || null
                                      }
                                    }));
                                  }}
                                  className="w-full px-3 py-2 rounded-xl bg-surface dark:bg-neutral-900 border border-outline-variant/30 text-xs font-black text-on-surface outline-none focus:border-primary uppercase font-mono"
                                />
                              </div>

                              {/* Attachment View / Upload */}
                              <div className="space-y-1">
                                <label className="text-[10px] font-black uppercase text-secondary block">
                                  Sub-Order Bill Document
                                </label>

                                {sBill.billPhoto ? (
                                  <div className="p-1.5 rounded-xl bg-surface dark:bg-neutral-900 border border-outline-variant/30 flex items-center justify-between gap-2">
                                    <div 
                                      onClick={() => setViewingBillModal({
                                        isOpen: true,
                                        photoUrl: sBill.billPhoto!,
                                        title: `Bill ${sBill.billNo || ''} • ${sub.buyer}`
                                      })}
                                      className="flex items-center gap-2 cursor-pointer group min-w-0"
                                    >
                                      <img 
                                        src={sBill.billPhoto} 
                                        alt="Thumbnail" 
                                        className="w-9 h-9 rounded-lg object-contain bg-black/5 dark:bg-black/30 border border-outline-variant/30 shrink-0"
                                      />
                                      <div className="min-w-0">
                                        <p className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                          <span className="truncate">Attached</span>
                                        </p>
                                        <p className="text-[9px] text-secondary group-hover:text-primary font-bold underline">
                                          Preview
                                        </p>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => handleTriggerSubOrderUpload(subKey)}
                                        className="px-2.5 py-1 text-[10px] font-bold bg-surface-container hover:bg-surface-container-high rounded-md transition-colors cursor-pointer"
                                      >
                                        Replace
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setSubOrderBills(prev => ({
                                            ...prev,
                                            [subKey]: {
                                              ...prev[subKey],
                                              billPhoto: null
                                            }
                                          }));
                                        }}
                                        className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-md cursor-pointer transition-colors"
                                        title="Remove bill"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleTriggerSubOrderUpload(subKey)}
                                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-outline-variant hover:border-primary bg-surface dark:bg-neutral-900 text-center text-[11px] font-bold text-secondary hover:text-on-surface flex items-center justify-center gap-2 cursor-pointer transition-colors"
                                  >
                                    <Upload className="w-3.5 h-3.5 text-secondary" />
                                    <span>Upload Bill (Image / PDF)</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Optional Dispatch Notes */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase text-secondary">
                      Dispatch Notes / Remarks
                    </label>
                    <textarea
                      rows={2}
                      placeholder="e.g. Dispatched via VRL Logistics, expected arrival tomorrow 10 AM"
                      value={dispatchNotes}
                      onChange={(e) => setDispatchNotes(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-surface-container border border-outline-variant/30 text-xs font-medium text-on-surface outline-none focus:border-primary resize-none"
                    />
                  </div>

                  {/* Form Buttons */}
                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-outline-variant/20">
                    <button
                      type="button"
                      disabled={isSavingDispatch}
                      onClick={() => setDispatchModalOrder(null)}
                      className="px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface font-bold text-xs transition-all cursor-pointer"
                    >
                      Cancel
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingDispatch}
                      className="btn-tactile px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-black text-xs shadow-md shadow-primary/20 transition-all cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                      {isSavingDispatch ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Saving & Syncing...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Save & Share with Tejas</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* FULL SCREEN BILL VIEWER MODAL */}
      <AnimatePresence>
        {viewingBillModal && viewingBillModal.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-4xl w-full p-4 shadow-2xl space-y-3 flex flex-col max-h-[94vh]"
            >
              <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
                <span className="font-bold text-sm text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-400" />
                  {viewingBillModal.title}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setBillZoom(z => Math.max(0.6, z - 0.2))}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                  >
                    <ZoomOut className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillZoom(z => Math.min(2.5, z + 0.2))}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBillRotation(r => (r + 90) % 360)}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingBillModal(null)}
                    className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-white cursor-pointer ml-2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto rounded-2xl bg-black/50 p-4 flex items-center justify-center min-h-[400px]">
                <img
                  src={viewingBillModal.photoUrl}
                  alt="Consignment Bill Document"
                  style={{
                    transform: `scale(${billZoom}) rotate(${billRotation}deg)`,
                    transition: 'transform 0.2s ease-out'
                  }}
                  className="max-h-[70vh] object-contain rounded-lg shadow-2xl"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SUCCESS TOAST NOTIFICATION */}
      <AnimatePresence>
        {successToast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 px-5 py-3 rounded-2xl bg-neutral-900 text-white text-xs font-black shadow-2xl border border-neutral-700 flex items-center gap-2.5"
          >
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span>{successToast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
