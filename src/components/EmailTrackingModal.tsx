import React, { useState, useEffect } from 'react';
import { 
  X, 
  Mail, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  ShieldCheck, 
  Eye, 
  RefreshCw, 
  Copy, 
  Check, 
  Send, 
  ExternalLink, 
  FileText, 
  AlertCircle,
  Loader2,
  Terminal,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export type PoEmailStatus = 
  | 'Queued'
  | 'Sending'
  | 'Sent'
  | 'Delivered'
  | 'Bounced/Failed'
  | 'Delivery unconfirmed'
  | 'Acknowledged'
  | 'Opened';

export interface PoEmailTimelineEvent {
  event: string;
  timestamp: string;
  details: string;
  source: 'backend' | 'gmail_api' | 'supplier' | 'tracker';
}

export interface PoEmailTrackingRecord {
  orderId: string;
  poRef: string;
  supplierName: string;
  recipientEmail: string;
  status: PoEmailStatus;
  queuedAt: string;
  sentAt?: string;
  deliveredAt?: string;
  bouncedAt?: string;
  acknowledgedAt?: string;
  acknowledgedByIp?: string;
  firstOpenedAt?: string;
  lastOpenedAt?: string;
  openCount: number;
  attempts: number;
  maxAttempts: number;
  gmailMessageId?: string;
  threadId?: string;
  failureReason?: string;
  bounceDiagnostics?: string;
  pdfFilename?: string;
  pdfSizeBytes?: number;
  timeline: PoEmailTimelineEvent[];
  lastUpdated: string;
  acknowledgementUrl?: string;
  notes?: string;
}

interface EmailTrackingModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
  onRefresh?: () => void;
}

export const getStatusBadgeConfig = (status: PoEmailStatus | string) => {
  switch (status) {
    case 'Acknowledged':
      return {
        label: 'Acknowledged',
        icon: ShieldCheck,
        bg: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
        dot: 'bg-emerald-500',
        desc: 'Supplier explicitly confirmed receipt through the secure acknowledgement mechanism.'
      };
    case 'Delivered':
      return {
        label: 'Delivered',
        icon: CheckCircle2,
        bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
        dot: 'bg-emerald-500',
        desc: 'A reliable delivery event or provider report confirms delivery.'
      };
    case 'Sent':
      return {
        label: 'Sent (Accepted)',
        icon: Send,
        bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        dot: 'bg-blue-500',
        desc: 'Gmail API accepted email for sending. Note: acceptance does not prove inbox delivery.'
      };
    case 'Delivery unconfirmed':
      return {
        label: 'Delivery Unconfirmed',
        icon: Clock,
        bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30',
        dot: 'bg-amber-500',
        desc: 'The email was sent, but no reliable delivery evidence is available. Awaiting delivery proof or supplier acknowledgement.'
      };
    case 'Bounced/Failed':
      return {
        label: 'Bounced / Failed',
        icon: AlertTriangle,
        bg: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25',
        dot: 'bg-red-500',
        desc: 'The message could not be delivered, or a permanent failure was reported by Mailer-Daemon.'
      };
    case 'Sending':
      return {
        label: 'Sending...',
        icon: Loader2,
        bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
        dot: 'bg-blue-500 animate-ping',
        desc: 'The backend is actively processing and transmitting the message via Gmail API OAuth 2.0.'
      };
    case 'Opened':
      return {
        label: 'Opened (Approximate)',
        icon: Eye,
        bg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
        dot: 'bg-purple-500',
        desc: 'Open tracking is approximate and may be affected or blocked by email client privacy features (e.g. Apple Mail Privacy).'
      };
    case 'Queued':
    default:
      return {
        label: 'Queued',
        icon: Clock,
        bg: 'bg-neutral-500/10 text-neutral-600 dark:text-neutral-400 border-neutral-500/20',
        dot: 'bg-neutral-400',
        desc: 'Waiting in dispatch queue to be processed by Gmail API.'
      };
  }
};

export default function EmailTrackingModal({
  order,
  isOpen,
  onClose,
  onRefresh,
}: EmailTrackingModalProps) {
  const [record, setRecord] = useState<PoEmailTrackingRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingBounces, setCheckingBounces] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const orderId = order?.id || '';

  const fetchRecord = async () => {
    if (!orderId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/po-tracking/${encodeURIComponent(orderId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.record) setRecord(data.record);
      }
    } catch (e) {
      console.warn("Could not fetch PO tracking record:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && orderId) {
      fetchRecord();
    }
  }, [isOpen, orderId]);

  if (!isOpen) return null;

  const currentStatus: PoEmailStatus = record?.status || (order?.purchaseOrderSent ? 'Sent' : 'Queued');
  const badgeConfig = getStatusBadgeConfig(currentStatus);
  const StatusIcon = badgeConfig.icon;

  const recipientEmail = record?.recipientEmail || order?.sellerEmail || '';
  const remarksStr = order?.remarks || (order?.originalOrders && order?.originalOrders[0]?.remarks) || 'Standard dispatch';
  const gmailComposeUrl = recipientEmail 
    ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&cc=nani@tejasc.in&su=${encodeURIComponent(`Tejas Canvassing: Purchase Order ${orderId} - ${record?.supplierName || order?.supplier || 'Supplier'}`)}&body=${encodeURIComponent(`Official Purchase Order ${orderId}\nSupplier: ${record?.supplierName || order?.supplier || 'Supplier'}\nTotal: ${order?.total || ''}\nRemarks: ${remarksStr}\n\nPlease confirm delivery.`)}` 
    : '';

  const handleCopyAckLink = () => {
    if (!record?.acknowledgementUrl) return;
    navigator.clipboard.writeText(record.acknowledgementUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCheckBounces = async () => {
    try {
      setCheckingBounces(true);
      setFeedbackMessage(null);
      const res = await fetch('/api/po-tracking/check-bounces');
      const data = await res.json();
      if (data.success) {
        setFeedbackMessage(`Mailbox checked. Bounces found: ${data.bouncesFound}`);
        fetchRecord();
        if (onRefresh) onRefresh();
      } else {
        setFeedbackMessage(data.error || 'Bounce check failed');
      }
    } catch (e: any) {
      setFeedbackMessage(e?.message || 'Error checking bounces');
    } finally {
      setCheckingBounces(false);
    }
  };

  const handleRetrySending = async () => {
    if (!orderId) return;
    try {
      setRetrying(true);
      setFeedbackMessage(null);
      const res = await fetch(`/api/po-tracking/${encodeURIComponent(orderId)}/retry`, {
        method: 'POST',
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFeedbackMessage("Retry transmitted to Gmail API successfully!");
        fetchRecord();
        if (onRefresh) onRefresh();
      } else {
        setFeedbackMessage(data.error || "Retry transmission failed.");
      }
    } catch (e: any) {
      setFeedbackMessage(e?.message || "Error initiating retry.");
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <motion.div 
        initial={{ scale: 0.96, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 10 }}
        className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans"
      >
        {/* Header */}
        <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-start justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Mail className="w-4 h-4" />
              </div>
              <h2 className="text-lg font-black tracking-tight">Purchase Order Email Tracking</h2>
            </div>
            <p className="text-xs text-neutral-500 font-medium">
              Real-time audit log, Gmail API acceptance, and supplier receipt acknowledgement.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          
          {feedbackMessage && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl text-blue-800 dark:text-blue-300 font-medium flex items-center justify-between">
              <span>{feedbackMessage}</span>
              <button onClick={() => setFeedbackMessage(null)} className="text-xs font-bold underline ml-2">Dismiss</button>
            </div>
          )}

          {/* Status Header Banner */}
          <div className="p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Current Email Status</div>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border",
                  badgeConfig.bg
                )}>
                  <StatusIcon className={cn("w-3.5 h-3.5", currentStatus === 'Sending' && "animate-spin")} />
                  <span>{badgeConfig.label}</span>
                </span>
                <span className="text-neutral-400 font-mono text-[11px]">• Ref: {record?.poRef || order?.id}</span>
              </div>
            </div>

            <div className="text-right sm:text-right text-neutral-500 text-[11px]">
              <div>Attempts: <strong className="text-neutral-800 dark:text-neutral-200">{record?.attempts || 1} of 3</strong></div>
              <div>Last Update: <strong className="text-neutral-800 dark:text-neutral-200">{record?.lastUpdated ? new Date(record.lastUpdated).toLocaleTimeString() : 'Just now'}</strong></div>
            </div>
          </div>

          <div className="p-3 bg-neutral-100/70 dark:bg-neutral-800/60 rounded-xl text-[11px] text-neutral-600 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700/60 leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
            <span>{badgeConfig.desc}</span>
          </div>

          {/* Key Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
              <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Assigned Supplier</span>
              <p className="font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                {record?.supplierName || order?.supplier || 'Supplier'}
              </p>
              <p className="text-neutral-500 font-mono text-[11px]">
                {record?.recipientEmail || order?.sellerEmail || 'supplier@email.com'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
              <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Sender Account (OAuth 2.0)</span>
              <p className="font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                nani@tejasc.in
              </p>
              <p className="text-neutral-500 text-[11px]">
                Official Google Workspace Gmail API
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
              <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Gmail Message Identifier</span>
              <p className="font-mono text-neutral-700 dark:text-neutral-300 text-[11px] truncate">
                {record?.gmailMessageId ? `${record.gmailMessageId}` : '(Awaiting Gmail Dispatch)'}
              </p>
              {record?.threadId && (
                <p className="text-neutral-400 font-mono text-[10px] truncate">Thread: {record.threadId}</p>
              )}
            </div>

            <div className="p-3.5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-1">
              <span className="text-neutral-400 text-[10px] uppercase font-bold tracking-wider">Attached Document</span>
              <div className="flex items-center gap-1.5 font-bold text-neutral-900 dark:text-neutral-100 text-xs">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span className="truncate">{record?.pdfFilename || `PO_${order?.id}_Tejas_Canvassing.pdf`}</span>
              </div>
              <p className="text-neutral-400 text-[10px]">
                {record?.pdfSizeBytes ? `${(record.pdfSizeBytes / 1024).toFixed(1)} KB` : 'Dynamic PDF Document'}
              </p>
            </div>
          </div>

          {/* Supplier Acknowledgement Card */}
          <div className="p-4 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-xs text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>Supplier Acknowledgement Status</span>
              </span>
              {record?.acknowledgedAt ? (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 font-bold text-[10px] border border-emerald-500/30">
                  Confirmed on {new Date(record.acknowledgedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-bold text-[10px] border border-amber-500/30">
                  Awaiting Confirmation
                </span>
              )}
            </div>

            {record?.acknowledgementUrl && (
              <div className="flex items-center gap-2 pt-1">
                <input 
                  type="text" 
                  readOnly 
                  value={record.acknowledgementUrl} 
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg text-[10px] font-mono text-neutral-600 dark:text-neutral-400 select-all"
                />
                <button
                  type="button"
                  onClick={handleCopyAckLink}
                  className="px-3 py-1.5 bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                  title="Copy direct acknowledgement link for supplier"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Audit Timeline */}
          <div className="space-y-3">
            <h3 className="font-black text-xs uppercase tracking-wider text-neutral-400 flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Audit Timeline & Evidence Trail</span>
            </h3>

            <div className="relative pl-6 border-l-2 border-neutral-200 dark:border-neutral-800 space-y-4 py-1">
              {(record?.timeline && record.timeline.length > 0) ? (
                record.timeline.map((event, idx) => (
                  <div key={idx} className="relative">
                    <div className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white dark:border-neutral-900 shadow-sm" />
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-bold text-neutral-900 dark:text-neutral-100 text-xs">{event.event}</p>
                      <span className="text-[10px] text-neutral-400 font-mono shrink-0">
                        {new Date(event.timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
                      </span>
                    </div>
                    <p className="text-neutral-600 dark:text-neutral-400 text-[11px] mt-0.5 leading-relaxed">
                      {event.details}
                    </p>
                    <span className="inline-block mt-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                      Source: {event.source}
                    </span>
                  </div>
                ))
              ) : (
                <div className="relative">
                  <div className="absolute -left-[31px] top-0.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white dark:border-neutral-900 shadow-sm" />
                  <p className="font-bold text-neutral-900 dark:text-neutral-100 text-xs">Order Placed & Queued</p>
                  <p className="text-neutral-500 text-[11px] mt-0.5">
                    Order registered. Generating purchase order documents for automated dispatch.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCheckBounces}
              disabled={checkingBounces}
              className="px-3.5 py-2 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", checkingBounces && "animate-spin")} />
              <span>{checkingBounces ? "Checking Mailbox..." : "Check for Bounces"}</span>
            </button>

            {recipientEmail && (
              <a
                href={gmailComposeUrl}
                target="_blank"
                rel="noreferrer"
                onClick={async () => {
                  if (orderId) {
                    await fetch(`/api/po-tracking/${encodeURIComponent(orderId)}/mark-sent`, { method: 'POST' }).catch(() => {});
                    fetchRecord();
                    if (onRefresh) onRefresh();
                  }
                }}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                title={`Send PO email to ${recipientEmail} via Gmail Web`}
              >
                <Send className="w-3.5 h-3.5" />
                <span>Open & Send via Gmail</span>
              </a>
            )}

            {currentStatus === 'Bounced/Failed' && (
              <button
                type="button"
                onClick={handleRetrySending}
                disabled={retrying}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{retrying ? "Retrying..." : "Retry Sending"}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-xl font-bold text-xs hover:opacity-90 transition-opacity cursor-pointer ml-auto"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
