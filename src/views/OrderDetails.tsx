import React, { useState } from 'react';
import { 
  ChevronLeft, 
  Package, 
  Truck, 
  FileText, 
  CheckCircle, 
  TrendingUp, 
  Download, 
  AlertCircle, 
  ShieldCheck, 
  Clock, 
  History, 
  ArrowRight,
  ExternalLink,
  Plus,
  CreditCard,
  DollarSign
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';

interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  status: 'Clearing' | 'Verified' | 'Flagged';
}

export default function OrderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [payments, setPayments] = useState<PaymentRecord[]>([
    { id: '1', date: '2023-10-24', amount: 2000000, method: 'NEFT/RTGS', status: 'Verified' },
    { id: '2', date: '2023-10-25', amount: 1000000, method: 'IMPS', status: 'Verified' },
    { id: '3', date: '2023-10-26', amount: 1349000, method: 'CHQ #445621', status: 'Verified' },
  ]);

  const [showAddPayment, setShowAddPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({ amount: '', method: 'Bank Transfer' });

  const [notified, setNotified] = useState(false);
  const grandTotal = 4349000;

  // Calculate actual sum
  const actualReceived = payments.reduce((sum, p) => sum + p.amount, 0);
  const delta = actualReceived - grandTotal;

  const handleNotifySupplier = () => {
    setNotified(true);
    alert(`Notification sent to Global Grain Suppliers Ltd.\nAmount: ₹${formatINR(actualReceived)}\nStatus: ${delta >= 0 ? 'Fully Paid' : 'Partial Payment'}`);
  };

  const handleAddPayment = () => {
    if (!newPayment.amount || isNaN(Number(newPayment.amount))) return;
    
    const record: PaymentRecord = {
      id: Math.random().toString(36).substr(2, 9),
      date: new Date().toISOString().split('T')[0],
      amount: Number(newPayment.amount),
      method: newPayment.method,
      status: 'Clearing'
    };

    setPayments([...payments, record]);
    setShowAddPayment(false);
    setNewPayment({ amount: '', method: 'Bank Transfer' });
  };

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-surface-container rounded-full transition-colors order-first"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
               <h1 className="text-3xl font-black tracking-tight">{id}</h1>
               <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-[10px] font-black tracking-widest uppercase">IN TRANSIT</span>
               {notified && (
                 <motion.span 
                   initial={{ scale: 0 }} 
                   animate={{ scale: 1 }}
                   className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[10px] font-black tracking-widest uppercase"
                 >
                    <CheckCircle className="w-3 h-3" />
                    Supplier Notified
                 </motion.span>
               )}
            </div>
            <p className="text-secondary font-medium text-sm">Placed on Oct 24, 2023 • Expected by Nov 08</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button 
            onClick={() => navigate('/ledger')}
            className="flex items-center gap-2 px-6 py-3 bg-white dark:bg-surface-container-low border border-outline-variant/30 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-surface-container transition-all active:scale-95"
          >
            <History className="w-4 h-4" />
            Audit Log
          </button>
          <button 
            onClick={handleNotifySupplier}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all active:scale-95",
              notified 
                ? "bg-white dark:bg-surface-container text-secondary border border-outline-variant/30 opacity-50 cursor-not-allowed" 
                : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100"
            )}
            disabled={notified}
          >
            <CheckCircle className="w-4 h-4" />
            {notified ? 'Supplier Emailed' : 'Notify Supplier: Payment Received'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-8">
           {/* Payment Reconciliation Module */}
           <section className="liquid-glass p-8 rounded-3xl premium-border space-y-8">
              <div className="flex items-center justify-between">
                 <div className="space-y-1">
                    <h3 className="text-xl font-black uppercase tracking-tight">Financial Reconciliation</h3>
                    <p className="text-[10px] text-secondary font-black uppercase tracking-widest flex items-center gap-1.5">
                       <Clock className="w-3 h-3" />
                       Real-time multi-payment ledger
                    </p>
                 </div>
                 <div className={cn(
                    "flex items-center gap-2 px-4 py-1.5 rounded-full border transition-colors",
                    delta >= 0 
                      ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                      : "bg-surface-container text-secondary border-outline-variant/30"
                 )}>
                    <ShieldCheck className={cn("w-4 h-4", delta >= 0 ? "text-emerald-500" : "text-primary")} />
                    <span className="text-[10px] font-black uppercase tracking-widest">
                       {delta >= 0 ? "Account Balanced" : "Awaiting Balance"}
                    </span>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                 <div className="space-y-3">
                    <label className="label-caps px-1">Order Value</label>
                    <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/30 group hover:border-primary/20 transition-all">
                       <div className="flex items-baseline gap-1 underline decoration-primary/20">
                          <span className="text-sm font-black opacity-30">₹</span>
                          <span className="text-2xl font-black">{formatINR(grandTotal)}</span>
                       </div>
                    </div>
                 </div>
                 
                 <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="label-caps text-primary">Funds Received</label>
                      <button 
                        onClick={() => setShowAddPayment(true)}
                        className="p-1 hover:bg-primary/10 rounded-lg transition-colors text-primary"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-5 bg-primary/5 border border-primary/20 rounded-2xl group transition-all">
                       <div className="flex items-baseline gap-1">
                          <span className="text-sm font-black text-primary/50">₹</span>
                          <span className="text-2xl font-black text-primary">{formatINR(actualReceived)}</span>
                       </div>
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className={cn(
                       "label-caps px-1",
                       delta < 0 ? "text-rose-500" : delta > 0 ? "text-emerald-600" : "text-secondary"
                    )}>
                       {delta < 0 ? "Outstanding Balance" : delta > 0 ? "Payment Overkill" : "Ledger Matched"}
                    </label>
                    <div className={cn(
                       "p-5 rounded-2xl border flex items-center justify-between h-[70px]",
                       delta < 0 ? "bg-rose-50/50 border-rose-100 text-rose-600" : 
                       delta > 0 ? "bg-emerald-50/50 border-emerald-100 text-emerald-600" : 
                       "bg-surface-container-low border-outline-variant/30 text-secondary"
                    )}>
                       <div className="flex items-baseline gap-1">
                          <span className="text-sm font-black opacity-30">₹</span>
                          <span className="text-2xl font-black">{Math.abs(delta).toLocaleString()}</span>
                       </div>
                       {delta !== 0 && (
                          <div className={cn(
                             "w-8 h-8 rounded-xl flex items-center justify-center shadow-sm",
                             delta < 0 ? "bg-rose-100 text-rose-600" : "bg-emerald-100 text-emerald-600"
                          )}>
                             {delta < 0 ? <AlertCircle className="w-5 h-5" /> : <TrendingUp className="w-5 h-5" />}
                          </div>
                       )}
                    </div>
                 </div>
              </div>

              {/* Individual Payments Recorder */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-widest text-secondary">Payment History</h4>
                  <p className="text-[10px] font-bold text-outline-variant">{payments.length} Records found</p>
                </div>
                
                <div className="space-y-2">
                  <AnimatePresence mode="popLayout">
                    {payments.map((p) => (
                      <motion.div 
                        key={p.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center justify-between p-4 bg-white dark:bg-black/20 rounded-xl border border-outline-variant/30 hover:border-primary/30 transition-all group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center">
                            <CreditCard className="w-5 h-5 text-secondary" />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-on-surface">{p.method}</p>
                            <p className="text-[10px] text-secondary font-medium">{p.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="text-right">
                              <p className="text-xs font-black text-on-surface">₹{formatINR(p.amount)}</p>
                              <p className={cn(
                                "text-[10px] font-black uppercase tracking-[0.1em]",
                                p.status === 'Verified' ? "text-emerald-500" : "text-amber-500"
                              )}>{p.status}</p>
                           </div>
                           <button 
                            onClick={() => setPayments(payments.filter(pay => pay.id !== p.id))}
                            className="p-2 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all"
                           >
                              <AlertCircle className="w-4 h-4" />
                           </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {showAddPayment && (
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-6 bg-primary/5 rounded-2xl border-2 border-dashed border-primary/30 space-y-4"
                    >
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Amount (₹)</label>
                          <input 
                            type="number"
                            value={newPayment.amount}
                            onChange={(e) => setNewPayment({...newPayment, amount: e.target.value})}
                            className="w-full bg-white dark:bg-black p-3 rounded-xl border border-primary/20 outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold"
                            placeholder="0.00"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Payment Channel</label>
                          <select 
                            value={newPayment.method}
                            onChange={(e) => setNewPayment({...newPayment, method: e.target.value})}
                            className="w-full bg-white dark:bg-black p-3 rounded-xl border border-primary/20 outline-none focus:ring-4 focus:ring-primary/10 transition-all text-sm font-bold"
                          >
                            <option>Bank Transfer</option>
                            <option>Cheque Deposit</option>
                            <option>Cash Receipt</option>
                            <option>Demand Draft</option>
                          </select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-3">
                        <button 
                          onClick={() => setShowAddPayment(false)}
                          className="px-4 py-2 text-[10px] font-black uppercase text-secondary hover:text-on-surface transition-colors"
                        >
                          Discard
                        </button>
                        <button 
                          onClick={handleAddPayment}
                          className="px-6 py-2 bg-primary text-white rounded-lg text-[10px] font-black uppercase shadow-lg shadow-primary/20 active:scale-95 transition-all"
                        >
                          Record Payment
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-6 border-t border-outline-variant/30">
                 <div className="flex gap-4">
                    <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-primary transition-colors">
                       <History className="w-4 h-4" />
                       Full Statement
                    </button>
                    <button className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-secondary hover:text-primary transition-colors">
                       <Download className="w-4 h-4" />
                       Receipt Template
                    </button>
                 </div>
                 {!showAddPayment && (
                    <button 
                      onClick={() => setShowAddPayment(true)}
                      className="flex items-center gap-2 px-6 py-2.5 bg-on-background text-background rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 shadow-xl transition-all active:scale-95"
                    >
                       <Plus className="w-3.5 h-3.5" />
                       Add Installment
                    </button>
                 )}
              </div>
           </section>

           {/* Logistics & Tracking Progress */}
           <section className="liquid-glass p-8 rounded-3xl premium-border space-y-10">
              <div className="flex items-center justify-between">
                 <h3 className="text-xl font-black uppercase tracking-tight">Logistics Pipeline</h3>
                 <button className="flex items-center gap-1.5 text-[10px] font-black text-primary uppercase tracking-widest hover:underline">
                    Live Telemetry <ExternalLink className="w-3 h-3" />
                 </button>
              </div>

              <div className="flex justify-between relative px-2">
                 {/* Connection Lines Background */}
                 <div className="absolute top-5 left-0 w-full h-[2px] bg-surface-container-high z-0" />
                 <div 
                    className="absolute top-5 left-0 h-[2px] bg-primary transition-all duration-1000 z-0" 
                    style={{ width: '50%' }} // Static for example, could be 0, 25, 50, 75, 100
                 />

                 {[
                    { label: 'Booking', date: 'Oct 24', done: true, current: false },
                    { label: 'Mulling', date: 'Oct 25', done: true, current: false },
                    { label: 'Transit', date: 'Oct 26', done: true, current: true },
                    { label: 'Port', date: 'Est. Nov 02', done: false, current: false },
                    { label: 'Handoff', date: 'Est. Nov 08', done: false, current: false },
                 ].map((step, i) => (
                    <div key={i} className="flex flex-col items-center flex-1 relative z-10">
                       <div className={cn(
                          "w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-sm",
                          step.done ? "bg-primary text-white" : "bg-surface-container text-secondary border border-outline-variant",
                          step.current && "ring-4 ring-primary/20 scale-110"
                       )}>
                          {step.done ? <CheckCircle className="w-5 h-5" /> : <Package className="w-5 h-5 opacity-40" />}
                       </div>
                       <div className="mt-4 text-center">
                          <p className={cn(
                             "text-[10px] font-black uppercase tracking-widest",
                             step.done ? "text-on-surface" : "text-secondary"
                          )}>
                             {step.label}
                          </p>
                          <p className="text-[10px] text-secondary font-medium mt-0.5">{step.date}</p>
                       </div>
                       {step.current && (
                          <div className="absolute -top-12 bg-on-background text-background px-3 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap animate-bounce">
                             In Progress
                             <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-on-background rotate-45" />
                          </div>
                       )}
                    </div>
                 ))}
              </div>

              <div className="bg-surface-container-low p-6 rounded-2xl border border-outline-variant/30 flex items-center justify-between group hover:bg-surface-container transition-all">
                 <div className="flex items-center gap-6">
                    <div className="w-14 h-14 bg-white dark:bg-black rounded-2xl shadow-sm flex items-center justify-center premium-border group-hover:scale-105 transition-transform">
                       <Truck className="w-7 h-7 text-primary" />
                    </div>
                    <div>
                       <h4 className="font-black text-base tracking-tight">Consignment at Mundra Port Terminal 4</h4>
                       <p className="body-sm text-secondary flex items-center gap-1.5 mt-1">
                          <Clock className="w-3.5 h-3.5" />
                          Gate entry recorded: Today, 14:22 GMT
                       </p>
                    </div>
                 </div>
                 <button className="p-3 bg-white dark:bg-surface-container rounded-xl shadow-sm border border-outline-variant/30 hover:border-primary/40 transition-all group/btn">
                    <ArrowRight className="w-5 h-5 text-secondary group-hover/btn:translate-x-1 transition-transform" />
                 </button>
              </div>
           </section>

           {/* Items Table */}
           <section className="liquid-glass rounded-2xl overflow-hidden">
              <div className="p-8 border-b border-outline-variant">
                 <h3 className="text-lg font-black">Consignment Manifest</h3>
              </div>
              <table className="w-full text-left border-collapse">
                 <thead>
                    <tr className="bg-surface-container-low/50 text-[10px] font-black text-secondary tracking-widest uppercase">
                       <th className="p-6">Product Item</th>
                       <th className="p-6 text-right">Quantity</th>
                       <th className="p-6 text-right">Unit Rate</th>
                       <th className="p-6 text-right">Subtotal</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-outline-variant/30 font-medium">
                    <tr className="hover:bg-primary/5 transition-all text-sm">
                       <td className="p-6 flex items-center gap-4 px-2">
                          <img src="https://lh3.googleusercontent.com/aida-public/AB6AXuCpHEoiR_bmJYNTHenMI5d2vZraDO_09XGz7Yqz--EWBHif1AVbnBNwk6OzrRe8dekw2wcPF-p3RNjG1q4GG6qo9k1nnkwY37RFNU02qbT5rptImUdz4cWOm1Fq_4UtvGOpNKBacCQxPgKbl1p3sZJ9Acn1QyEIumsavj_O4_rMV7MAD3gSXcrEpuc7CysnvFM1bi312mlXUGXn5Dagql1-zNjlqbUNFZrS3i8xDrZWEm9AaMQt8X3lA5lgnDelxD3szg4_ylHFTCMB" alt="" className="w-10 h-10 rounded-lg object-cover" />
                          <span>1121 Sella Rice (Grade A)</span>
                       </td>
                       <td className="p-6 text-right font-black">500.00 QTLS</td>
                       <td className="p-6 text-right text-secondary">₹ 8,450.00</td>
                       <td className="p-6 text-right font-black">₹ {formatINR(4225000)}</td>
                    </tr>
                 </tbody>
              </table>
              <div className="p-8 bg-surface-container-low/30 border-t border-outline-variant flex flex-col items-end gap-2">
                 <div className="flex justify-between w-64 text-sm font-medium">
                    <span className="text-secondary">Subtotal</span>
                    <span className="text-on-surface font-black">₹ {formatINR(4225000)}</span>
                 </div>
                 <div className="flex justify-between w-64 text-sm font-medium">
                    <span className="text-secondary">Inspection & Tax</span>
                    <span className="text-on-surface font-black">₹ {formatINR(124000)}</span>
                 </div>
                 <div className="flex justify-between w-64 pt-4 border-t border-outline-variant mt-2">
                    <span className="font-black text-secondary">GRAND TOTAL</span>
                    <span className="text-xl font-black text-primary">₹ {formatINR(4349000)}</span>
                 </div>
              </div>
           </section>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-8">
           <div className="liquid-glass p-8 rounded-2xl flex flex-col gap-6">
              <h3 className="text-lg font-black">Counterparties</h3>
              <div className="space-y-6">
                 <div>
                    <p className="text-[10px] font-black text-secondary tracking-widest uppercase mb-3">Origin Supplier</p>
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-black text-xs">GS</div>
                       <div>
                          <p className="text-sm font-bold">Global Grain Suppliers Ltd.</p>
                          <p className="text-xs text-secondary">Amritsar, India</p>
                       </div>
                    </div>
                 </div>
                 <div className="w-full h-px bg-outline-variant/30" />
                 <div>
                    <p className="text-[10px] font-black text-secondary tracking-widest uppercase mb-3">Final Buyer</p>
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-xs border border-primary/20">RH</div>
                       <div>
                          <p className="text-sm font-bold">Rice House Ind. (LLC)</p>
                          <p className="text-xs text-secondary">Dubai, UAE</p>
                       </div>
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-on-background p-8 rounded-2xl text-white space-y-6">
              <h3 className="text-lg font-black">Documentation</h3>
              <div className="space-y-4">
                 {[
                    { label: 'Bill of Lading', size: '1.2 MB' },
                    { label: 'Certificate of Origin', size: '0.8 MB' },
                    { label: 'Phytosanitary Certificate', size: '2.1 MB' },
                    { label: 'Commercial Invoice', size: '0.5 MB' },
                 ].map((doc, i) => (
                    <button key={i} className="w-full flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all text-left">
                       <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 opacity-40" />
                          <div>
                             <p className="text-xs font-bold">{doc.label}</p>
                             <p className="text-[10px] opacity-40 font-black">{doc.size}</p>
                          </div>
                       </div>
                       <Download className="w-4 h-4 opacity-40" />
                    </button>
                 ))}
              </div>
              <button className="w-full py-4 bg-primary text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-xl shadow-black/20">
                 Request Additional Logs
              </button>
           </div>
        </div>
      </div>
    </div>
  );
}
