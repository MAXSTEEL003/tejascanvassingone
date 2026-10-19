import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  Building2, 
  Mail, 
  ShieldCheck, 
  Loader2,
  Calendar,
  ExternalLink
} from 'lucide-react';

interface PoSummary {
  poRef: string;
  supplierName: string;
  recipientEmail: string;
  status: string;
  queuedAt?: string;
  sentAt?: string;
  acknowledgedAt?: string;
  isAlreadyAcknowledged: boolean;
}

export default function AcknowledgeReceiptView() {
  const [searchParams] = useSearchParams();
  const po = searchParams.get('po') || '';
  const token = searchParams.get('t') || '';
  const dateStr = searchParams.get('d') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PoSummary | null>(null);
  const [notes, setNotes] = useState('');
  const [acknowledgedSuccess, setAcknowledgedSuccess] = useState(false);
  const [confirmedTime, setConfirmedTime] = useState<string | null>(null);

  useEffect(() => {
    if (!po || !token || !dateStr) {
      setError('Invalid or incomplete acknowledgement link. Missing verification parameters.');
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/acknowledge-po-details?po=${encodeURIComponent(po)}&t=${encodeURIComponent(token)}&d=${encodeURIComponent(dateStr)}`);
        const data = await res.json();

        if (res.ok && data.success) {
          setSummary(data);
          if (data.isAlreadyAcknowledged) {
            setAcknowledgedSuccess(true);
            setConfirmedTime(data.acknowledgedAt);
          }
        } else {
          setError(data.error || 'This acknowledgement link is invalid or has expired.');
        }
      } catch (err: any) {
        setError(err?.message || 'Could not connect to verification server. Please check your internet connection.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [po, token, dateStr]);

  const handleConfirmReceipt = async () => {
    if (!po || !token || !dateStr) return;

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/acknowledge-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          po,
          t: token,
          d: dateStr,
          notes: notes.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setAcknowledgedSuccess(true);
        setConfirmedTime(data.acknowledgedAt || new Date().toISOString());
      } else {
        setError(data.error || 'Failed to record acknowledgement. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error while recording acknowledgement.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between p-4 sm:p-6 md:p-8 font-sans">
      <div className="max-w-lg w-full mx-auto my-auto">
        
        {/* Brand Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center font-black text-lg border border-white/30">
                TC
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight">TEJAS CANVASSING</h1>
                <p className="text-xs text-blue-100">Official Supplier Order Desk • Bangalore</p>
              </div>
            </div>
            <div className="hidden sm:block text-right text-xs text-blue-100">
              <div>Secure Protocol</div>
              <div className="font-mono text-[11px] opacity-80">v2.4-OAuth</div>
            </div>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="py-12 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium">Validating cryptographic order credentials...</p>
              </div>
            ) : error ? (
              <div className="text-center py-6">
                <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-3">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h2 className="text-base font-bold text-slate-900 mb-2">Verification Notice</h2>
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3 mb-4 leading-relaxed">
                  {error}
                </p>
                <p className="text-xs text-slate-500">
                  If you believe this is an error, please contact Tejas Canvassing directly at{' '}
                  <a href="mailto:nani@tejasc.in" className="text-blue-600 font-medium underline">
                    nani@tejasc.in
                  </a>.
                </p>
              </div>
            ) : acknowledgedSuccess ? (
              <div className="text-center py-4">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-4 border border-emerald-200 shadow-sm animate-in zoom-in-95 duration-200">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 mb-2">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>RECEIPT CONFIRMED</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">
                  Purchase Order Receipt Acknowledged
                </h2>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                  Thank you! Receipt of Purchase Order <strong className="text-slate-900">{summary?.poRef}</strong> has been officially confirmed on behalf of <strong className="text-slate-900">{summary?.supplierName}</strong>.
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs text-slate-700 space-y-2 mb-6">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-slate-500">PO Reference</span>
                    <span className="font-mono font-bold text-slate-900">{summary?.poRef}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-slate-500">Assigned Supplier</span>
                    <span className="font-semibold text-slate-900">{summary?.supplierName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-slate-500">Supplier Mailbox</span>
                    <span className="text-slate-900">{summary?.recipientEmail}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500">Confirmed At</span>
                    <span className="font-medium text-emerald-700">
                      {confirmedTime ? new Date(confirmedTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'Confirmed'} IST
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 text-left text-xs text-blue-900 flex items-start space-x-2">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                  <span>The logistics desk at Tejas Canvassing has been automatically notified and will track loading dispatch.</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="mb-6">
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200 mb-2">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Awaiting Mill Confirmation</span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Confirm Purchase Order Receipt
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Please verify and acknowledge that your mill has received the trade specifications and purchase order PDF.
                  </p>
                </div>

                {/* PO Specification Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-5 space-y-2.5 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Purchase Order No.</span>
                    <span className="font-mono font-bold text-blue-600 text-sm">{summary?.poRef}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Supplier / Miller</span>
                    <span className="font-semibold text-slate-900">{summary?.supplierName}</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Recipient Email</span>
                    <span className="text-slate-700">{summary?.recipientEmail}</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-500 font-medium">Transmitted Date</span>
                    <span className="text-slate-700">
                      {summary?.sentAt ? new Date(summary.sentAt).toLocaleDateString('en-IN') : 'Today'}
                    </span>
                  </div>
                </div>

                {/* Optional Note Field */}
                <div className="mb-5">
                  <label htmlFor="ack-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Loading Date or Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    id="ack-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Loading scheduled for tomorrow 2 PM..."
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                </div>

                {/* Big Explicit Confirmation Button */}
                <button
                  type="button"
                  onClick={handleConfirmReceipt}
                  disabled={submitting}
                  className="w-full py-3.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Recording Acknowledgement...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>Acknowledge Receipt</span>
                    </>
                  )}
                </button>

                <p className="text-[11px] text-center text-slate-400 mt-3">
                  Clicking confirms receipt of purchase order documents by an authorized mill representative.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-slate-400">
          <p>© {new Date().getFullYear()} Tejas Canvassing • APMC Yard, Yeshwanthpur, Bangalore</p>
          <p className="mt-1">
            Questions? Contact <a href="mailto:nani@tejasc.in" className="text-blue-600 hover:underline">nani@tejasc.in</a>
          </p>
        </div>

      </div>
    </div>
  );
}
