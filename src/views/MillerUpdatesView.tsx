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
  Phone
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
  billNo?: string;
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

export default function MillerUpdatesView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active view mode: 'stream' (Real-time Ingest Feed) vs 'chat' (Miller Chat Desk)
  const [activeTab, setActiveTab] = useState<'stream' | 'chat'>('stream');

  // Miller Ingest Feed State
  // Standalone updates stream for Miller Updates (App B feed - decoupled from this app's placed_orders)
  const [rawUpdates, setRawUpdates] = useState<MillerUpdateItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLiveConnected, setIsLiveConnected] = useState(true);

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

  // Fetch updates from backend API & local cache
  const fetchBackendUpdates = async () => {
    try {
      const res = await fetch('/api/integration/miller-updates');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.updates)) {
          setRawUpdates(data.updates);
          localStorage.setItem('miller_updates', JSON.stringify(data.updates));
          if (typeof data.unreadCount === 'number') {
            localStorage.setItem('miller_updates_unread_count', String(data.unreadCount));
          }
          window.dispatchEvent(new CustomEvent('miller-updates-changed'));
        }
      }
    } catch (err) {
      console.warn('Backend miller-updates poll notice:', err);
    }
  };

  // Load orders and chats
  const loadOrdersAndChats = async () => {
    setIsLoading(true);
    try {
      // 1. Local updates cache (App B updates)
      const cachedUpdates = localStorage.getItem('miller_updates');
      if (cachedUpdates) {
        try {
          setRawUpdates(JSON.parse(cachedUpdates));
        } catch {}
      }

      // 2. Fetch from remote updates collection (App B updates feed - decoupled from this app's orders)
      const remoteUpdates = await getCollectionDocs('miller_updates').catch(() => []);
      if (remoteUpdates && remoteUpdates.length > 0) {
        setRawUpdates(prev => {
          const merged = new Map<string, MillerUpdateItem>();
          prev.forEach(u => merged.set(u.id, u));
          remoteUpdates.forEach(u => merged.set(u.id, u));
          const list = Array.from(merged.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
          localStorage.setItem('miller_updates', JSON.stringify(list));
          return list;
        });
      }

      // 4. Fetch backend API
      await fetchBackendUpdates();

      // 5. Load Chat Messages
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
          const sorted = Array.from(map.values()).sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          );
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
          setRawUpdates(JSON.parse(cached));
        } catch {}
      }
    };

    window.addEventListener('storage', handleSync);
    window.addEventListener('miller-updates-changed', handleSync);

    return () => {
      unsubscribeUpdates();
      clearInterval(pollInterval);
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('miller-updates-changed', handleSync);
    };
  }, []);

  // Updates stream from incoming App B webhook/events (standalone, decoupled from this app's orders)
  const allUpdatesStream = useMemo(() => {
    return [...rawUpdates].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [rawUpdates]);

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

    return {
      totalToday: todayUpdates.length > 0 ? todayUpdates.length : allUpdatesStream.slice(0, 15).length,
      isFallbackTotal: todayUpdates.length === 0,
      billsCount: billsUploaded.length,
      todayBillsCount: todayBills.length,
      trucksCount: trucksLoaded.length,
      todayTrucksCount: todayTrucks.length,
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

    // Update mills with activities from App B feeds (decoupled from this app's orders)
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
  }, [rawUpdates, customMessages]);

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

    // Timeline messages constructed exclusively from App B updates
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
            text: `Acknowledged Purchase Order #${update.poNumber} (Application B).`,
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
            dispatchDate: update.loadingDate || (update.timestamp ? update.timestamp.split('T')[0] : ''),
            dispatchNotes: `Lorry ${update.vehicleNumber || ''} dispatched with ${update.loadedQuantity || 0} QTLS.`,
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
  }, [currentMill, rawUpdates, customMessages]);

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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Updates Today */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0f1113] border border-slate-200 dark:border-white/5 shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-secondary">
                  Total Updates Today
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
                  {summaryStats.isFallbackTotal ? 'recent updates' : 'events today'}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-400 dark:text-neutral-500">
                {allUpdatesStream.length} total fulfillment records recorded
              </p>
              <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-red-500/5 group-hover:scale-125 transition-transform duration-500" />
            </div>

            {/* New Bills Uploaded */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0f1113] border border-slate-200 dark:border-white/5 shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-secondary">
                  New Bills Uploaded
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
                Authentic Mill Tax Invoices verified & attached
              </p>
              <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-emerald-500/5 group-hover:scale-125 transition-transform duration-500" />
            </div>

            {/* Trucks Loaded Today */}
            <div className="p-4 rounded-2xl bg-white dark:bg-[#0f1113] border border-slate-200 dark:border-white/5 shadow-xs relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-secondary">
                  Trucks Loaded Today
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
                Loaded at mill yard • En route directly to consignee shop
              </p>
              <div className="absolute -right-4 -bottom-4 w-20 h-20 rounded-full bg-blue-500/5 group-hover:scale-125 transition-transform duration-500" />
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

                      return (
                        <tr
                          key={item.id}
                          className={cn(
                            "hover:bg-slate-50/60 dark:hover:bg-white/[0.02] transition-colors",
                            isUnread && "bg-red-500/[0.03] dark:bg-red-500/[0.05]"
                          )}
                        >
                          {/* Column 1: Timestamp */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {isUnread && (
                                <span className="w-2 h-2 rounded-full bg-red-600 shrink-0 animate-ping" title="New update" />
                              )}
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {formatDateTime(item.timestamp)}
                                </p>
                                <span className="text-[10px] text-slate-400 dark:text-neutral-500 font-mono">
                                  {item.id.startsWith('synth') ? 'Synced' : 'Webhook Ingest'}
                                </span>
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
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-black font-mono bg-slate-100 dark:bg-white/10 text-slate-800 dark:text-white border border-slate-200 dark:border-white/5">
                                #{item.poNumber}
                              </span>
                              {item.subOrderNo && (
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-black font-mono bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                  {item.subOrderNo}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Column 4: Buyer / Destination */}
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white leading-tight">
                                {item.buyerName || 'Authorized Consignee'}
                              </p>
                              <span className="text-[10px] text-slate-400 dark:text-secondary flex items-center gap-1">
                                <span>Shop / Consignee Hub</span>
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
                            <div className="p-4 rounded-2xl bg-white dark:bg-surface-container border border-slate-200 dark:border-white/5 shadow-xs space-y-2 w-full max-w-md">
                              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-white/5">
                                <span className="text-xs font-black text-red-600 dark:text-red-400">
                                  Official PO #{msg.poData.id}
                                </span>
                                <span className="text-[10px] font-bold text-slate-500">
                                  {msg.poData.totalVolume} QTLS
                                </span>
                              </div>
                              <p className="text-xs font-bold text-slate-800 dark:text-white">
                                {msg.poData.product || 'Commercial Grain Batch'}
                              </p>
                              <div className="text-[11px] text-slate-500 space-y-0.5">
                                <p>Rate: ₹{msg.poData.rate || 0}/QTL</p>
                                <p>Destination: {msg.poData.destination || 'Consignee Shop'}</p>
                              </div>
                            </div>
                          )}

                          {msg.type === 'ack' && (
                            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs font-bold space-y-1">
                              <div className="flex items-center gap-1.5 font-black text-emerald-600 dark:text-emerald-400">
                                <CheckCheck className="w-4 h-4" />
                                <span>PO Confirmed & Acknowledged</span>
                              </div>
                              <p>{msg.text}</p>
                            </div>
                          )}

                          {msg.type === 'dispatch' && (
                            <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs font-bold space-y-1.5">
                              <div className="flex items-center gap-1.5 font-black text-blue-600 dark:text-blue-400">
                                <Truck className="w-4 h-4" />
                                <span>Lorry Dispatched: {msg.vehicleNo}</span>
                              </div>
                              {msg.driverPhone && (
                                <p className="text-[11px] font-mono">Driver Contact: {msg.driverPhone}</p>
                              )}
                              <p className="text-[11px]">{msg.dispatchNotes}</p>
                            </div>
                          )}

                          {msg.type === 'bill' && msg.subBills && (
                            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs font-bold space-y-2">
                              <div className="flex items-center gap-1.5 font-black text-emerald-600 dark:text-emerald-400">
                                <FileText className="w-4 h-4" />
                                <span>Authentic Mill Tax Invoices Uploaded</span>
                              </div>
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
