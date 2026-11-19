import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  X,
  Send,
  Radio
} from 'lucide-react';
import { getAuthToken, getAuthUser } from '../lib/auth';
import { resolveGroupedPoNumber } from '../utils/orderOperations';

interface SupplierPortalSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any | null;
  onSyncSuccess?: () => void;
}

export default function SupplierPortalSyncModal({
  isOpen,
  onClose,
  order,
  onSyncSuccess,
}: SupplierPortalSyncModalProps) {
  const [record, setRecord] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const poNumber = order ? resolveGroupedPoNumber(order) : '';

  const fetchStatus = async () => {
    if (!poNumber) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/integration/sync-status/${encodeURIComponent(poNumber)}`);
      if (res.ok) {
        const data = await res.json();
        setRecord(data.record || null);
      }
    } catch (e) {
      console.warn("Could not fetch portal sync status:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && poNumber) {
      setFeedback(null);
      fetchStatus();
    }
  }, [isOpen, poNumber]);

  if (!isOpen || !order) return null;

  const currentStatus = record?.status || (order?.supplierPortalSynced ? 'Synced' : 'Pending');
  const portalPoId = record?.portalPoId || order?.supplierPortalPoId;
  const idempotencyKey = record?.idempotencyKey || `SYNC_PO_${poNumber}_V1`;

  const handleTriggerSync = async () => {
    if (!poNumber || syncing) return;
    try {
      setSyncing(true);
      setFeedback(null);
      const token = getAuthToken();
      const adminUser = getAuthUser();

      const res = await fetch('/api/integration/sync-po', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'x-admin-email': adminUser?.email || 'nani@tejasc.in',
        },
        body: JSON.stringify({
          poNumber,
          isManualRetry: true,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setFeedback({
          type: 'success',
          text: data.message || `Successfully synchronized with Keshar Kali Supplier Portal (PO ID: ${data.portalPoId || 'N/A'})`,
        });
        if (data.record) {
          setRecord(data.record);
        } else {
          fetchStatus();
        }
        if (onSyncSuccess) onSyncSuccess();
      } else {
        setFeedback({
          type: 'error',
          text: data.error || data.message || 'Synchronization request failed. Check server logs.',
        });
        fetchStatus();
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        text: err?.message || 'Network error attempting to contact integration service.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(idempotencyKey);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border bg-slate-500/[0.04]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-foreground">
                  Supplier Portal Integration
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/20">
                  {poNumber}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Target: Keshar Kali Supplier Portal (Application B)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-500/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Status Banner */}
          <div className="p-4 rounded-xl border flex items-center justify-between bg-card">
            <div className="flex items-center gap-3">
              {currentStatus === 'Synced' ? (
                <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              ) : currentStatus === 'Failed' ? (
                <div className="w-8 h-8 rounded-lg bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              )}
              <div>
                <div className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">
                  Synchronization State
                </div>
                <div className="text-sm font-black text-foreground flex items-center gap-2">
                  <span>{currentStatus === 'Synced' ? 'Synchronized with Portal' : currentStatus === 'Failed' ? 'Sync Failed / Pending Retry' : 'Pending Synchronization'}</span>
                  {portalPoId && (
                    <span className="text-xs font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      Portal PO #{portalPoId}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={handleTriggerSync}
              disabled={syncing}
              className="btn-tactile inline-flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer shadow-md shadow-purple-600/20"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : currentStatus === 'Synced' ? 'Re-sync' : 'Sync Now'}
            </button>
          </div>

          {/* Feedback Alert */}
          {feedback && (
            <div className={`p-3.5 rounded-xl text-xs flex items-start gap-2.5 border ${
              feedback.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' 
                : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 font-medium leading-relaxed">
                {feedback.text}
              </div>
            </div>
          )}

          {/* Key particulars grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-slate-500/[0.04] border border-border">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-1">
                Supplier / Mill
              </span>
              <span className="font-bold text-foreground truncate block">
                {order.supplier || order.origin || 'Supplier'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-500/[0.04] border border-border">
              <span className="text-muted-foreground block text-[10px] uppercase font-bold tracking-wider mb-1">
                Consolidated Volume
              </span>
              <span className="font-bold text-foreground block">
                {order.qty || '0'} QTL • {order.total || '₹ 0'}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-500/[0.04] border border-border col-span-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground text-[10px] uppercase font-bold tracking-wider">
                  Idempotency Key (Duplicate-Safe)
                </span>
                <button
                  onClick={handleCopyKey}
                  className="text-[10px] text-purple-600 dark:text-purple-400 font-bold hover:underline inline-flex items-center gap-1"
                >
                  {copiedKey ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  {copiedKey ? 'Copied' : 'Copy Key'}
                </button>
              </div>
              <code className="text-[11px] font-mono text-foreground block truncate">
                {idempotencyKey}
              </code>
            </div>
          </div>

          {/* Timeline Audit */}
          <div>
            <h4 className="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Integration Audit Trail
            </h4>

            {record && record.timeline && record.timeline.length > 0 ? (
              <div className="space-y-2 border-l-2 border-purple-500/25 ml-2 pl-4">
                {record.timeline.map((item: any, idx: number) => (
                  <div key={idx} className="relative text-xs">
                    <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-purple-500 border-2 border-card" />
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">{item.event}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>
                    {item.details && (
                      <p className="text-muted-foreground text-[11px] mt-0.5 leading-relaxed">
                        {item.details}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                No integration events recorded yet. Click &quot;Sync Now&quot; to initiate transmission.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-slate-500/[0.02] flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Radio className="w-3 h-3 text-emerald-500 animate-pulse" />
            <span>HMAC-SHA256 Authenticated Protocol</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border hover:bg-slate-500/10 text-foreground font-bold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
