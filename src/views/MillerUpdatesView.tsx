import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  Paperclip,
  PhoneCall,
  Share2,
  Building2,
  Truck,
  FileText,
  CheckCircle2,
  Clock,
  RotateCcw,
  Download,
  Eye,
  Printer,
  Search,
  Filter,
  Check,
  CheckCheck,
  Info,
  X,
  ChevronRight,
  Sparkles,
  RefreshCw,
  ArrowLeft,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR, getRegisteredSuppliers } from '../lib/utils';
import { getCollectionDocs, setCollectionDoc } from '../lib/firebase';
import { resolveSupplierProfile, printPoDocument } from '../utils/poEmailTemplate';

export interface ChatMessage {
  id: string;
  millName: string;
  sender: 'tejas' | 'hq' | 'miller' | 'system';
  senderName: string;
  type: 'text' | 'po' | 'ack' | 'reverse_ack' | 'dispatch' | 'bill' | 'system';
  text?: string;
  poId?: string;
  timestamp: string; // ISO string
  // Payload for PO cards
  poData?: any;
  // Payload for dispatch lorry cards
  vehicleNo?: string;
  driverPhone?: string;
  dispatchDate?: string;
  dispatchNotes?: string;
  // Payload for bill invoice cards
  billNo?: string;
  buyerName?: string;
  photoUrl?: string;
  subBills?: Array<{ buyer: string; billNo: string; photoUrl: string }>;
  // Status
  status?: 'sent' | 'delivered' | 'read';
}

export default function MillerUpdatesView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State: Orders & Millers
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customMessages, setCustomMessages] = useState<ChatMessage[]>([]);
  const [selectedMillName, setSelectedMillName] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs_ack' | 'dispatched' | 'has_bill'>('all');

  // Chat message input
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showInfoDrawer, setShowInfoDrawer] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Full-screen Bill Preview Modal
  const [viewingBillModal, setViewingBillModal] = useState<{
    isOpen: boolean;
    photoUrl: string;
    title: string;
    billNo?: string;
  } | null>(null);
  const [billZoom, setBillZoom] = useState(1);
  const [billRotation, setBillRotation] = useState(0);

  // Success toast
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

  // Load all placed orders
  const loadOrdersAndChats = async () => {
    setIsLoading(true);
    try {
      // 1. Load Placed Orders (local + remote)
      const localOrders = localStorage.getItem('placed_orders');
      if (localOrders) {
        setOrders(JSON.parse(localOrders));
      }
      const remoteOrders = await getCollectionDocs('placed_orders');
      if (remoteOrders && remoteOrders.length > 0) {
        setOrders(remoteOrders);
        localStorage.setItem('placed_orders', JSON.stringify(remoteOrders));
      }

      // 2. Load Custom Chat Messages
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
      console.error('Error loading orders and chats for Miller Updates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrdersAndChats();

    const handleSync = () => loadOrdersAndChats();
    window.addEventListener('storage', handleSync);
    window.addEventListener('placed-orders-updated', handleSync);
    window.addEventListener('miller-chat-updated', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('placed-orders-updated', handleSync);
      window.removeEventListener('miller-chat-updated', handleSync);
    };
  }, []);

  // Compute directory of Millers
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

    // 1. Seed from registered suppliers
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

    // 2. Associate placed orders to mills
    orders.forEach(order => {
      const rawSup = (order.supplier || 'DIRECT MILL').trim();
      const normOrder = normalizeSupplier(rawSup);

      // Match with known mill
      let matchedKey: string | null = null;
      for (const [key] of millsMap.entries()) {
        if (normalizeSupplier(key) === normOrder || key.includes(normOrder) || normOrder.includes(key)) {
          matchedKey = key;
          break;
        }
      }

      if (!matchedKey) {
        const profile = resolveSupplierProfile(rawSup);
        matchedKey = rawSup.toUpperCase();
        millsMap.set(matchedKey, {
          id: `sup-${matchedKey.replace(/\s+/g, '-').toLowerCase()}`,
          name: rawSup,
          code: '',
          phone: profile.phone || '',
          email: profile.email || '',
          address: profile.address || '',
          orders: [],
          lastActivityTime: 0,
          pendingAckCount: 0,
          dispatchedCount: 0,
          hasBillsCount: 0,
          snippet: 'Direct Mill'
        });
      }

      const millObj = millsMap.get(matchedKey)!;
      millObj.orders.push(order);

      // Update counters
      if (!order.isAcknowledged) {
        millObj.pendingAckCount++;
      }
      if (order.truckNo || order.vehicleNo) {
        millObj.dispatchedCount++;
      }
      if (order.actualSupplierBillNo || order.billPhoto || order.billPhotoUrl || (order.supplierBillPhotos && Object.keys(order.supplierBillPhotos).length > 0)) {
        millObj.hasBillsCount++;
      }

      // Check date timestamp
      const orderDateMs = order.date ? new Date(order.date).getTime() : 0;
      if (orderDateMs > millObj.lastActivityTime) {
        millObj.lastActivityTime = orderDateMs;
        if (order.truckNo || order.vehicleNo) {
          millObj.snippet = `🚚 Lorry: ${order.truckNo || order.vehicleNo} (PO #${order.id})`;
        } else if (order.actualSupplierBillNo || order.billPhoto || order.billPhotoUrl) {
          millObj.snippet = `🧾 Mill Invoice attached for PO #${order.id}`;
        } else if (order.isAcknowledged) {
          millObj.snippet = `✅ Acknowledged PO #${order.id}`;
        } else {
          millObj.snippet = `📄 New PO #${order.id} issued (${order.qty || order.totalVolume || 600} QTLS)`;
        }
      }
    });

    // 3. Check custom chat messages for snippet & last activity
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
    // Sort: mills with recent activity or pending ack on top
    return list.sort((a, b) => {
      if (a.pendingAckCount !== b.pendingAckCount) return b.pendingAckCount - a.pendingAckCount;
      return b.lastActivityTime - a.lastActivityTime;
    });
  }, [orders, customMessages]);

  // Set default selected mill from URL param or first item
  useEffect(() => {
    const urlMill = searchParams.get('mill');
    if (urlMill) {
      setSelectedMillName(urlMill);
    } else if (!selectedMillName && millersDirectory.length > 0) {
      setSelectedMillName(millersDirectory[0].name);
    }
  }, [millersDirectory, searchParams, selectedMillName]);

  // Current active mill data
  const currentMill = useMemo(() => {
    if (!selectedMillName) return millersDirectory[0] || null;
    const norm = normalizeSupplier(selectedMillName);
    return millersDirectory.find(m => normalizeSupplier(m.name) === norm) || millersDirectory[0] || null;
  }, [selectedMillName, millersDirectory]);

  // Filtered millers list for left search
  const filteredMillers = useMemo(() => {
    return millersDirectory.filter(m => {
      const matchSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.phone.includes(searchQuery);

      if (!matchSearch) return false;

      if (statusFilter === 'needs_ack') return m.pendingAckCount > 0;
      if (statusFilter === 'dispatched') return m.dispatchedCount > 0;
      if (statusFilter === 'has_bill') return m.hasBillsCount > 0;

      return true;
    });
  }, [millersDirectory, searchQuery, statusFilter]);

  // Generate WhatsApp Timeline for currentMill
  const timelineMessages = useMemo(() => {
    if (!currentMill) return [];

    const messages: ChatMessage[] = [];
    const normSelected = normalizeSupplier(currentMill.name);

    // 1. Synthesize timeline events from POs
    currentMill.orders.forEach(order => {
      const baseDate = order.date ? new Date(order.date).toISOString() : new Date().toISOString();
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

      // A) PO Issued Bubble (From Tejas)
      messages.push({
        id: `po-issue-${order.id}`,
        millName: currentMill.name,
        sender: 'tejas',
        senderName: 'Tejas Canvassing',
        type: 'po',
        poId: String(order.id),
        timestamp: baseDate,
        poData: {
          ...order,
          subOrders,
          totalVolume
        },
        status: 'read'
      });

      // B) PO Acknowledgment Bubble (From Mill)
      if (order.isAcknowledged) {
        messages.push({
          id: `po-ack-${order.id}`,
          millName: currentMill.name,
          sender: 'miller',
          senderName: currentMill.name,
          type: 'ack',
          poId: String(order.id),
          timestamp: order.acknowledgedAt || new Date(new Date(baseDate).getTime() + 15 * 60000).toISOString(),
          text: `We acknowledge receipt of Purchase Order #${order.id}. Order is booked for loading as per schedule.`,
          status: 'read'
        });
      }

      // C) Lorry Dispatch Bubble (From Mill)
      if (order.truckNo || order.vehicleNo) {
        messages.push({
          id: `po-disp-${order.id}`,
          millName: currentMill.name,
          sender: 'miller',
          senderName: currentMill.name,
          type: 'dispatch',
          poId: String(order.id),
          timestamp: order.dispatchedAt || new Date(new Date(baseDate).getTime() + 45 * 60000).toISOString(),
          vehicleNo: order.truckNo || order.vehicleNo,
          driverPhone: order.driverPhone || '',
          dispatchDate: order.dispatchedAt ? order.dispatchedAt.split('T')[0] : order.date,
          dispatchNotes: order.dispatchNotes || 'Lorry loaded and dispatched from mill weighbridge.',
          status: 'read'
        });
      }

      // D) Actual Bill Upload Bubble (From Mill)
      const subBillsWithAttachments: Array<{ buyer: string; billNo: string; photoUrl: string }> = [];

      // Sub-orders bills
      subOrders.forEach((sub: any, sIdx: number) => {
        const subKey = String(sub.id || sub.buyer || `sub-${sIdx}`);
        const sBillNo = sub.actualSupplierBillNo || sub.billNo || (order.supplierBillNos && order.supplierBillNos[subKey]) || '';
        const sPhoto = sub.billPhoto || sub.billPhotoUrl || sub.billAttachment || (order.supplierBillPhotos && order.supplierBillPhotos[subKey]) || null;
        if (sPhoto) {
          subBillsWithAttachments.push({
            buyer: sub.buyer || 'Consignee',
            billNo: sBillNo || `BIL-${order.id}`,
            photoUrl: sPhoto
          });
        }
      });

      // Main bill
      const mainBillNo = order.actualSupplierBillNo || order.billNo;
      const mainPhoto = order.billPhoto || order.billPhotoUrl || order.billAttachment;

      if (mainPhoto && subBillsWithAttachments.length === 0) {
        subBillsWithAttachments.push({
          buyer: order.buyer || 'Consignee',
          billNo: mainBillNo || `BIL-${order.id}`,
          photoUrl: mainPhoto
        });
      }

      if (subBillsWithAttachments.length > 0) {
        messages.push({
          id: `po-bill-${order.id}`,
          millName: currentMill.name,
          sender: 'miller',
          senderName: currentMill.name,
          type: 'bill',
          poId: String(order.id),
          timestamp: order.dispatchedAt || new Date(new Date(baseDate).getTime() + 50 * 60000).toISOString(),
          subBills: subBillsWithAttachments,
          status: 'read'
        });
      }
    });

    // 2. Add custom chat messages for this mill
    customMessages.forEach(msg => {
      if (normalizeSupplier(msg.millName) === normSelected) {
        messages.push(msg);
      }
    });

    // 3. Sort chronologically ascending
    return messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }, [currentMill, customMessages]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timelineMessages]);

  // Action: Send custom message from Admin to Mill
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

      // Persist to Firestore
      await setCollectionDoc('miller_chats', newMsg.id, newMsg);

      // Broadcast update
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

  // Action: Quick prompt triggers
  const handleQuickPrompt = (promptText: string) => {
    handleSendMessage(promptText);
  };

  // Action: Open Real WhatsApp link
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
    <div className="flex h-[calc(100vh-4rem)] bg-surface dark:bg-neutral-950 text-on-surface font-sans antialiased overflow-hidden">
      {/* ============================================================ */}
      {/* LEFT COLUMN: MILL DIRECTORY & WHATSAPP CHAT LIST             */}
      {/* ============================================================ */}
      <aside className="w-80 sm:w-96 border-r border-outline-variant/30 flex flex-col bg-surface-container-lowest/60 dark:bg-neutral-900/60 shrink-0">
        {/* Left Header */}
        <div className="p-3.5 border-b border-outline-variant/20 space-y-3 bg-surface/90 dark:bg-neutral-900/90 backdrop-blur-md">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-black text-sm text-on-surface tracking-tight">Miller Updates</h2>
                <p className="text-[10px] text-secondary font-medium">WhatsApp Dispatch Channel</p>
              </div>
            </div>

            <button
              type="button"
              onClick={loadOrdersAndChats}
              disabled={isLoading}
              title="Refresh mill activity"
              className="p-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface cursor-pointer transition-colors"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin text-primary")} />
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-secondary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search mill by name, code or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-surface dark:bg-neutral-900 border border-outline-variant/30 text-xs font-bold text-on-surface placeholder:text-secondary outline-none focus:border-primary"
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
                onClick={() => setStatusFilter(f.id as any)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0",
                  statusFilter === f.id
                    ? "bg-primary text-on-primary shadow-xs"
                    : "bg-surface-container text-secondary hover:text-on-surface"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mills List */}
        <div className="flex-1 overflow-y-auto divide-y divide-outline-variant/10">
          {filteredMillers.length === 0 ? (
            <div className="p-8 text-center text-secondary space-y-2">
              <Building2 className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-xs font-bold">No mills found</p>
            </div>
          ) : (
            filteredMillers.map((mill) => {
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
                      ? "bg-surface-container/70 border-l-primary shadow-xs"
                      : "border-l-transparent hover:bg-surface-container/40"
                  )}
                >
                  {/* Mill Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-primary/10 border border-primary/20 text-primary font-black text-xs flex items-center justify-center shadow-inner">
                      {initials}
                    </div>
                    {mill.orders.length > 0 && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-surface" />
                    )}
                  </div>

                  {/* Mill Details & Snippet */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-black text-xs text-on-surface truncate">
                        {mill.name}
                      </h4>
                      {mill.code && (
                        <span className="font-mono text-[9px] font-bold text-secondary bg-surface-container px-1 rounded">
                          {mill.code}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-secondary truncate mt-0.5">
                      {mill.snippet}
                    </p>

                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[9px] font-mono text-secondary">
                        {mill.orders.length} PO{mill.orders.length !== 1 ? 's' : ''}
                      </span>

                      {mill.pendingAckCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20 text-[9px] font-black">
                          {mill.pendingAckCount} Need Ack
                        </span>
                      )}

                      {mill.dispatchedCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 text-[9px] font-black">
                          {mill.dispatchedCount} In Transit
                        </span>
                      )}

                      {mill.hasBillsCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-black">
                          ✓ Bills
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

      {/* ============================================================ */}
      {/* RIGHT COLUMN: WHATSAPP CONVERSATION THREAD                   */}
      {/* ============================================================ */}
      <main className="flex-1 flex flex-col bg-[#efeae2] dark:bg-[#0b141a] overflow-hidden relative">
        {currentMill ? (
          <>
            {/* WhatsApp Top Header Bar */}
            <header className="px-4 py-3 bg-surface/95 dark:bg-neutral-900/95 backdrop-blur-md border-b border-outline-variant/30 flex items-center justify-between gap-3 shadow-xs shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 text-primary font-black text-xs flex items-center justify-center shrink-0">
                  {currentMill.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-sm text-on-surface truncate">
                      {currentMill.name}
                    </h3>
                    {currentMill.code && (
                      <span className="text-[10px] font-mono font-bold bg-surface-container px-1.5 py-0.5 rounded text-secondary">
                        {currentMill.code}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online • Synced with Miller Portal {currentMill.phone ? `• ${currentMill.phone}` : ''}
                  </p>
                </div>
              </div>

              {/* Right Action Icons */}
              <div className="flex items-center gap-2 shrink-0">
                {currentMill.phone && (
                  <a
                    href={`tel:${currentMill.phone}`}
                    className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface transition-colors"
                    title={`Call Mill: ${currentMill.phone}`}
                  >
                    <PhoneCall className="w-4 h-4 text-emerald-600" />
                  </a>
                )}

                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer flex items-center gap-1.5"
                  title="Open in WhatsApp Web / App"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </button>

                {/* Preview Miller Portal */}
                <button
                  type="button"
                  onClick={() => navigate(`/miller?mill=${encodeURIComponent(currentMill.name)}`)}
                  className="px-2.5 py-1.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-secondary hover:text-on-surface font-bold text-xs transition-colors cursor-pointer flex items-center gap-1.5"
                  title="Open this mill in the Miller Portal view"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Open Miller View</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowInfoDrawer(!showInfoDrawer)}
                  className="p-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface transition-colors cursor-pointer"
                  title="View Mill Info & Trade Terms"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* WhatsApp Chat Canvas */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* WhatsApp Encrypted Security Notice */}
              <div className="max-w-md mx-auto p-2.5 rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/20 text-center space-y-0.5 shadow-2xs">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-800 dark:text-amber-300 flex items-center justify-center gap-1">
                  <span>🔒</span> Tejas Canvassing & Miller Direct Channel
                </p>
                <p className="text-[10px] text-amber-900/80 dark:text-amber-200/80 font-medium leading-relaxed">
                  POs placed for {currentMill.name} appear here instantly. Lorry dispatches, driver numbers, and mill invoice copies are synced live.
                </p>
              </div>

              {/* Day Divider Chip */}
              <div className="text-center my-3">
                <span className="px-3 py-1 rounded-lg bg-surface/80 dark:bg-neutral-800/80 backdrop-blur-xs text-[10px] font-black uppercase tracking-widest text-secondary shadow-2xs border border-outline-variant/20">
                  TODAY'S OPERATIONS & UPDATES
                </span>
              </div>

              {/* Chat Timeline Stream */}
              {timelineMessages.length === 0 ? (
                <div className="p-12 text-center text-secondary space-y-3">
                  <MessageSquare className="w-12 h-12 mx-auto opacity-30" />
                  <h4 className="font-black text-sm text-on-surface">No updates yet for {currentMill.name}</h4>
                  <p className="text-xs max-w-sm mx-auto">
                    When you place a purchase order for this mill, or send a message below, it will appear here in WhatsApp format.
                  </p>
                </div>
              ) : (
                timelineMessages.map((msg) => {
                  const isTejas = msg.sender === 'tejas' || msg.sender === 'hq';
                  const timeFormatted = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                  // 1. PURCHASE ORDER ISSUED CARD (From Tejas)
                  if (msg.type === 'po' && msg.poData) {
                    const po = msg.poData;
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-lg w-full rounded-2xl bg-surface dark:bg-neutral-900 border border-outline-variant/30 shadow-md overflow-hidden">
                          {/* PO Card Header */}
                          <div className="px-4 py-2.5 bg-primary text-on-primary flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4" />
                              <span className="font-mono font-black text-xs uppercase tracking-wider">
                                PURCHASE ORDER #{msg.poId}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold opacity-90">
                              Issued {po.date || 'Today'}
                            </span>
                          </div>

                          {/* PO Card Body */}
                          <div className="p-4 space-y-3 text-xs">
                            <div className="flex items-center justify-between border-b border-outline-variant/15 pb-2">
                              <div>
                                <span className="text-[10px] font-black uppercase text-secondary">Consolidated Volume</span>
                                <p className="text-xl font-black text-primary font-sans">
                                  {(po.totalVolume || po.qty || 600).toFixed(2)}{' '}
                                  <span className="text-xs font-bold text-secondary">QTLS</span>
                                </p>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] font-black uppercase text-secondary">Loading Terms</span>
                                <p className="font-bold text-on-surface">{po.loadingDays || 5} Days</p>
                              </div>
                            </div>

                            {/* Sub-orders List */}
                            <div className="space-y-1.5">
                              <span className="text-[10px] font-black uppercase text-secondary tracking-wider">
                                Sub-Orders ({po.subOrders?.length || 1})
                              </span>
                              {po.subOrders?.map((sub: any, sIdx: number) => (
                                <div key={sIdx} className="p-2 rounded-xl bg-surface-container flex items-center justify-between gap-2">
                                  <div>
                                    <p className="font-bold text-on-surface text-xs leading-tight">{sub.buyer}</p>
                                    <p className="text-[10px] text-primary font-semibold">{sub.brand || sub.product || 'Rice Brand'}</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-black font-sans text-xs">
                                      {(parseFloat(sub.qty) || 0).toFixed(2)} QTLS
                                    </p>
                                    <p className="text-[10px] text-secondary font-mono">
                                      ₹{formatINR(sub.rate || 0)} / QTL
                                    </p>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Actions inside PO Card */}
                            <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant/15">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => printPoDocument(po.supplier || currentMill?.name || 'DIRECT MILL', po, po.subOrders || [])}
                                  className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                >
                                  <Printer className="w-3 h-3" />
                                  <span>Print PDF</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => navigate('/placed-orders')}
                                  className="px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-secondary hover:text-on-surface font-bold text-[10px] cursor-pointer flex items-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Orders Desk</span>
                                </button>
                              </div>

                              <div className="flex items-center gap-1 text-[10px] text-secondary font-mono">
                                <span>{timeFormatted}</span>
                                <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 2. PO ACKNOWLEDGED BUBBLE (From Mill)
                  if (msg.type === 'ack') {
                    return (
                      <div key={msg.id} className="flex justify-start">
                        <div className="max-w-md rounded-2xl rounded-tl-xs bg-white dark:bg-[#202c33] p-3.5 shadow-md border border-emerald-500/30 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                              <CheckCircle2 className="w-4 h-4" />
                            </span>
                            <div>
                              <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                                PO #{msg.poId} Acknowledged
                              </p>
                              <p className="text-[10px] text-secondary">
                                Mill confirmed receipt and loading schedule
                              </p>
                            </div>
                          </div>
                          <p className="text-xs text-on-surface leading-relaxed pl-8">
                            {msg.text}
                          </p>
                          <div className="text-right text-[10px] text-secondary font-mono pt-1">
                            {timeFormatted}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 3. LORRY DISPATCH BUBBLE (From Mill)
                  if (msg.type === 'dispatch') {
                    return (
                      <div key={msg.id} className="flex justify-start">
                        <div className="max-w-md rounded-2xl rounded-tl-xs bg-white dark:bg-[#202c33] p-4 shadow-md border border-blue-500/30 space-y-2.5">
                          <div className="flex items-center justify-between border-b border-outline-variant/15 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-xl bg-blue-500/15 text-blue-600 flex items-center justify-center shrink-0">
                                <Truck className="w-4 h-4" />
                              </span>
                              <div>
                                <p className="text-xs font-black text-blue-700 dark:text-blue-400">
                                  Lorry Dispatched • PO #{msg.poId}
                                </p>
                                <p className="text-[10px] text-secondary font-medium">
                                  Date: {msg.dispatchDate || 'Today'}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Vehicle & Driver Box */}
                          <div className="p-3 rounded-xl bg-surface-container space-y-2">
                            <div>
                              <span className="text-[10px] font-black uppercase text-secondary">Vehicle / Lorry No</span>
                              <p className="font-mono font-black text-sm text-on-surface tracking-wider">
                                {msg.vehicleNo}
                              </p>
                            </div>

                            {msg.driverPhone && (
                              <div className="flex items-center justify-between pt-1 border-t border-outline-variant/15">
                                <div>
                                  <span className="text-[9px] font-black uppercase text-secondary">Driver Contact</span>
                                  <p className="text-xs font-bold text-on-surface font-mono">{msg.driverPhone}</p>
                                </div>
                                <a
                                  href={`tel:${msg.driverPhone}`}
                                  className="px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-black flex items-center gap-1 cursor-pointer"
                                >
                                  <PhoneCall className="w-3 h-3" />
                                  <span>Call Driver</span>
                                </a>
                              </div>
                            )}

                            {msg.dispatchNotes && (
                              <p className="text-[11px] text-secondary italic pt-1">
                                "{msg.dispatchNotes}"
                              </p>
                            )}
                          </div>

                          <div className="text-right text-[10px] text-secondary font-mono">
                            {timeFormatted}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 4. ACTUAL MILL INVOICE UPLOAD BUBBLE (From Mill)
                  if (msg.type === 'bill' && msg.subBills && msg.subBills.length > 0) {
                    return (
                      <div key={msg.id} className="flex justify-start">
                        <div className="max-w-md rounded-2xl rounded-tl-xs bg-white dark:bg-[#202c33] p-4 shadow-md border border-emerald-500/30 space-y-3">
                          <div className="flex items-center justify-between border-b border-outline-variant/15 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="w-7 h-7 rounded-xl bg-emerald-500/15 text-emerald-600 flex items-center justify-center shrink-0">
                                <FileText className="w-4 h-4" />
                              </span>
                              <div>
                                <p className="text-xs font-black text-emerald-700 dark:text-emerald-400">
                                  Actual Mill Invoices Attached
                                </p>
                                <p className="text-[10px] text-secondary font-medium">
                                  PO #{msg.poId} • {msg.subBills.length} Bill{msg.subBills.length > 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Sub-order Bills Gallery */}
                          <div className="space-y-2">
                            {msg.subBills.map((bill, bIdx) => (
                              <div
                                key={bIdx}
                                className="p-2.5 rounded-xl bg-surface-container flex items-center justify-between gap-3"
                              >
                                <div
                                  onClick={() => setViewingBillModal({
                                    isOpen: true,
                                    photoUrl: bill.photoUrl,
                                    title: `Mill Bill • ${bill.buyer}`,
                                    billNo: bill.billNo
                                  })}
                                  className="flex items-center gap-2.5 cursor-pointer group min-w-0"
                                >
                                  <img
                                    src={bill.photoUrl}
                                    alt="Bill Thumbnail"
                                    className="w-12 h-12 rounded-lg object-contain bg-black/10 dark:bg-black/30 border border-outline-variant/30 shrink-0 group-hover:scale-105 transition-transform"
                                  />
                                  <div className="min-w-0">
                                    <p className="font-black text-xs text-on-surface truncate">{bill.buyer}</p>
                                    <p className="font-mono text-[11px] text-emerald-600 font-bold">
                                      Invoice: {bill.billNo || 'Attached'}
                                    </p>
                                    <span className="text-[9px] text-secondary group-hover:underline">Click to view full bill</span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setViewingBillModal({
                                    isOpen: true,
                                    photoUrl: bill.photoUrl,
                                    title: `Mill Bill • ${bill.buyer}`,
                                    billNo: bill.billNo
                                  })}
                                  className="p-2 rounded-lg bg-surface-container-high hover:bg-surface-container text-secondary hover:text-on-surface cursor-pointer shrink-0"
                                  title="View Document"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="text-right text-[10px] text-secondary font-mono">
                            {timeFormatted}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // 5. REGULAR TEXT MESSAGE
                  return (
                    <div key={msg.id} className={cn("flex", isTejas ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-md rounded-2xl p-3.5 shadow-sm space-y-1",
                          isTejas
                            ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-neutral-900 dark:text-neutral-100 rounded-tr-xs"
                            : "bg-white dark:bg-[#202c33] text-neutral-900 dark:text-neutral-100 rounded-tl-xs"
                        )}
                      >
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <div className="flex items-center justify-end gap-1 text-[9px] text-secondary font-mono">
                          <span>{timeFormatted}</span>
                          {isTejas && <CheckCheck className="w-3.5 h-3.5 text-blue-500" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div ref={chatBottomRef} />
            </div>

            {/* Quick Action Prompt Chips */}
            <div className="px-4 py-2 bg-surface/90 dark:bg-neutral-900/90 border-t border-outline-variant/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <span className="text-[10px] font-black uppercase text-secondary tracking-wider shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-primary" />
                Quick Prompts:
              </span>
              {[
                '🚚 Please share vehicle and driver mobile number for loading',
                '🧾 Kindly attach the signed mill invoice copy here',
                '⏳ Please update the estimated dispatch schedule',
                '💰 Payment has been verified & cleared via RTGS'
              ].map((prompt, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => handleQuickPrompt(prompt)}
                  className="px-2.5 py-1 rounded-full bg-surface-container hover:bg-surface-container-high border border-outline-variant/30 text-secondary hover:text-on-surface text-[10px] font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Bottom Message Input Bar */}
            <footer className="p-3 bg-surface/95 dark:bg-neutral-900/95 border-t border-outline-variant/30 flex items-center gap-2.5 shrink-0">
              <input
                type="text"
                placeholder={`Type a message to ${currentMill.name}...`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="flex-1 px-4 py-2.5 rounded-2xl bg-surface-container border border-outline-variant/30 text-xs font-medium text-on-surface placeholder:text-secondary outline-none focus:border-primary"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={isSending || !inputText.trim()}
                className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-md transition-all active:scale-95 disabled:opacity-40"
                title="Send Message"
              >
                <Send className="w-4 h-4 ml-0.5" />
              </button>
            </footer>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8 text-center text-secondary">
            <div className="space-y-2">
              <Building2 className="w-12 h-12 mx-auto opacity-30" />
              <h3 className="font-black text-sm text-on-surface">Select a Mill</h3>
              <p className="text-xs">Choose a mill from the left directory to open its WhatsApp dispatch desk.</p>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* RIGHT SIDE DRAWER: MILL INFORMATION & TRADE PROFILE          */}
      {/* ============================================================ */}
      <AnimatePresence>
        {showInfoDrawer && currentMill && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 320, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-outline-variant/30 bg-surface dark:bg-neutral-900 flex flex-col shrink-0 overflow-hidden shadow-2xl z-20"
          >
            <div className="p-4 border-b border-outline-variant/20 flex items-center justify-between">
              <h3 className="font-black text-xs uppercase tracking-wider text-on-surface">Mill Profile</h3>
              <button
                type="button"
                onClick={() => setShowInfoDrawer(false)}
                className="p-1 rounded-lg hover:bg-surface-container text-secondary cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
              <div className="text-center pb-3 border-b border-outline-variant/15 space-y-1.5">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 text-primary font-black text-base flex items-center justify-center mx-auto shadow-inner">
                  {currentMill.name.slice(0, 2).toUpperCase()}
                </div>
                <h4 className="font-black text-sm text-on-surface">{currentMill.name}</h4>
                <p className="text-[11px] text-secondary">{currentMill.address || 'APMC Registered Hub'}</p>
              </div>

              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-surface-container space-y-1">
                  <span className="text-[10px] font-black uppercase text-secondary">Supplier Code</span>
                  <p className="font-mono font-black text-on-surface">{currentMill.code || 'SUP-DIRECT'}</p>
                </div>

                <div className="p-3 rounded-xl bg-surface-container space-y-1">
                  <span className="text-[10px] font-black uppercase text-secondary">Dispatch Contact</span>
                  <p className="font-bold text-on-surface">{currentMill.phone || 'Not configured'}</p>
                </div>

                <div className="p-3 rounded-xl bg-surface-container space-y-1">
                  <span className="text-[10px] font-black uppercase text-secondary">Email</span>
                  <p className="font-bold text-on-surface truncate">{currentMill.email || 'orders@mill.com'}</p>
                </div>

                <div className="p-3 rounded-xl bg-surface-container space-y-1">
                  <span className="text-[10px] font-black uppercase text-secondary">Total POs Issued</span>
                  <p className="text-lg font-black text-primary font-sans">{currentMill.orders.length}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => navigate(`/miller?mill=${encodeURIComponent(currentMill.name)}`)}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-on-primary font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Eye className="w-4 h-4" />
                <span>Open Miller Portal View</span>
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ============================================================ */}
      {/* FULL-SCREEN BILL VIEWER MODAL                                */}
      {/* ============================================================ */}
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
                  {viewingBillModal.title} {viewingBillModal.billNo ? `(${viewingBillModal.billNo})` : ''}
                </span>

                <div className="flex items-center gap-2">
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
                    href={viewingBillModal.photoUrl}
                    download={`Invoice-${viewingBillModal.billNo || 'document'}.jpg`}
                    className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer ml-1"
                    title="Download Bill Image"
                  >
                    <Download className="w-4 h-4" />
                  </a>
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

