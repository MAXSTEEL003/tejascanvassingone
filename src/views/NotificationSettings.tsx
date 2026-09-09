import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  Mail, 
  Smartphone, 
  AlertTriangle, 
  CreditCard, 
  Package, 
  ShieldCheck, 
  Settings,
  Save,
  CheckCircle2,
  Building2,
  Phone,
  FileText,
  MapPin,
  User,
  Home,
  Briefcase,
  Send,
  MessageSquare,
  RefreshCw,
  Check,
  ExternalLink,
  Clock,
  Terminal,
  AlertCircle,
  Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { auth, getCollectionDocs, setCollectionDoc } from '../lib/firebase';
import { generateSupplierPOEmailHtml } from '../utils/poEmailTemplate';

interface NotificationSetting {
  id: string;
  title: string;
  description: string;
  email: boolean;
  push: boolean;
  whatsapp: boolean;
  icon: React.ElementType;
  urgent?: boolean;
}

interface DispatchLog {
  id: string;
  type: 'email' | 'whatsapp';
  to: string;
  recipientName?: string;
  subject?: string;
  status: 'sent' | 'simulated_success' | 'failed';
  timestamp: string;
  summary: string;
  details?: any;
}

const initialSettings: NotificationSetting[] = [
  {
    id: 'order_updates',
    title: 'Order Status Updates',
    description: 'Real-time alerts when your order is packed, shipped, or delivered.',
    email: true,
    push: true,
    whatsapp: true,
    icon: Package
  },
  {
    id: 'low_stock',
    title: 'Low Stock Warnings',
    description: 'Critical alerts when commodity inventory levels drop below threshold.',
    email: true,
    push: true,
    whatsapp: true,
    icon: AlertTriangle,
    urgent: true
  },
  {
    id: 'payment_reminders',
    title: 'Payment Reconciliation',
    description: 'Notifications for pending bank transfers and proof verifications.',
    email: true,
    push: false,
    whatsapp: true,
    icon: CreditCard
  },
  {
    id: 'security_alerts',
    title: 'Security & Access',
    description: 'New login attempts and stakeholder role modifications.',
    email: true,
    push: true,
    whatsapp: true,
    icon: ShieldCheck
  }
];

export default function NotificationSettings() {
  const [activeTab, setActiveTab] = useState<'profile' | 'notifications' | 'dispatch_test'>('dispatch_test');
  const [settings, setSettings] = useState(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Profile Form States
  const [businessName, setBusinessName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [gstin, setGstin] = useState('');
  const [address, setAddress] = useState('');
  const [stateVal, setStateVal] = useState('Karnataka');
  const [mandi, setMandi] = useState('Yeshwanthpur');
  
  // Extra requested details
  const [pan, setPan] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNo, setAccountNo] = useState('');
  const [ifsc, setIfsc] = useState('');
  
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [showProfileSuccess, setShowProfileSuccess] = useState(false);

  // Added state for payment notification selection
  const [placedOrders, setPlacedOrders] = useState(() => {
    return JSON.parse(localStorage.getItem('placed_orders') || '[]');
  });
  const [selectedOrderForNotif, setSelectedOrderForNotif] = useState('');
  const [isSendingNotif, setIsSendingNotif] = useState(false);

  // --- Dispatch Test Bench States ---
  const [testSupplierEmail, setTestSupplierEmail] = useState('contact@annapurnarice.com');
  const [testPoNumber, setTestPoNumber] = useState('TC-9801');
  const [testPhone, setTestPhone] = useState('9945351166');
  const [testRecipientName, setTestRecipientName] = useState('V.K FOODS');
  const [testMessageTemplate, setTestMessageTemplate] = useState<'po' | 'indent' | 'arrival' | 'custom'>('po');
  const [testMessageText, setTestMessageText] = useState(
    'Hello V.K FOODS,\n\nYour Purchase Order TC-9801 for 24 QTLS (KESHAR KALI) has been successfully dispatched to supplier ANNAPURNA RICE & AGRO INDUSTRIES.\n\nArrival ETA: 3-5 business days at APMC Yard, Bangalore.\n\nTejas Canvassing Brokerage Desk'
  );
  const [isSendingTestPo, setIsSendingTestPo] = useState(false);
  const [isSendingTestWa, setIsSendingTestWa] = useState(false);
  const [testFeedback, setTestFeedback] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [directWaLink, setDirectWaLink] = useState('');
  const [directMailLink, setDirectMailLink] = useState('');
  const [directGmailLink, setDirectGmailLink] = useState('');
  const [dispatchHistory, setDispatchHistory] = useState<DispatchLog[]>([]);
  const [gatewayStatus, setGatewayStatus] = useState<{ smtp: boolean; twilio: boolean }>({ smtp: false, twilio: false });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const role = localStorage.getItem('userRole') || 'admin';
  const isMerchant = role === 'merchant';

  // Load history from backend
  const fetchHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/dispatch-history');
      if (res.ok) {
        const data = await res.json();
        setDispatchHistory(data.logs || data.history || []);
        if (data.configured) {
          setGatewayStatus(data.configured);
        }
      }
    } catch (err) {
      console.warn('Could not fetch dispatch history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const [purgeFeedback, setPurgeFeedback] = useState<string | null>(null);

  const handleSanitizeLocalData = () => {
    try {
      const keysToPurge = [
        'placed_orders',
        'procurement_requests',
        'arrival_entry_sheets_v4',
        'arrival_entry_data_v4',
        'product_inventory',
        'deleted_product_inventory_ids',
        'stakeholders_v2',
        'deleted_stakeholder_ids',
        'store_cart',
        'user_wishlist',
        'tejas_intro_viewed'
      ];
      keysToPurge.forEach(k => localStorage.removeItem(k));
      window.dispatchEvent(new Event('storage'));
      setPurgeFeedback('Local mock/test cache successfully sanitized! The web app will now rely strictly on live Cloud Firestore data.');
      setTimeout(() => setPurgeFeedback(null), 5000);
    } catch (e: any) {
      setPurgeFeedback(`Error sanitizing local storage: ${e?.message || e}`);
    }
  };

  const handleFullFactoryReset = () => {
    if (confirm('Are you sure you want to perform a Full Factory Reset? This will clear all browser storage and return the web app to a fresh production state.')) {
      try {
        localStorage.clear();
        window.location.href = '/about';
      } catch (e: any) {
        console.error('Factory reset failed:', e);
      }
    }
  };

  useEffect(() => {
    if (activeTab === 'dispatch_test') {
      fetchHistory();
    }
  }, [activeTab]);

  // Update direct links when test message or phone changes
  useEffect(() => {
    const cleanDigits = testPhone.replace(/[^0-9]/g, '');
    const waDigits = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    setDirectWaLink(`https://api.whatsapp.com/send?phone=${waDigits}&text=${encodeURIComponent(testMessageText)}`);
    
    const poSubject = `Purchase Order ${testPoNumber} - Tejas Canvassing`;
    setDirectMailLink(`mailto:${encodeURIComponent(testSupplierEmail)}?subject=${encodeURIComponent(poSubject)}&body=${encodeURIComponent(testMessageText)}`);
    setDirectGmailLink(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(testSupplierEmail)}&su=${encodeURIComponent(poSubject)}&body=${encodeURIComponent(testMessageText)}`);
  }, [testPhone, testMessageText, testSupplierEmail, testPoNumber]);

  // Handle template change
  const handleTemplateSelect = (template: 'po' | 'indent' | 'arrival' | 'custom') => {
    setTestMessageTemplate(template);
    if (template === 'po') {
      setTestMessageText(
        `Hello ${testRecipientName},\n\nYour Purchase Order ${testPoNumber} for 24 QTLS (KESHAR KALI) has been successfully dispatched to supplier ANNAPURNA RICE & AGRO INDUSTRIES.\n\nArrival ETA: 3-5 business days at APMC Yard, Bangalore.\n\nTejas Canvassing Brokerage Desk`
      );
    } else if (template === 'indent') {
      setTestMessageText(
        `Hello ${testRecipientName},\n\nYour active procurement indent #${testPoNumber} has been successfully registered on the Tejas Canvassing platform!\n\n🌾 Brand Specification: KESHAR KALI\n⚖️ Requested Qty: 24 QTLS\n🏢 Targeted Supplier: ANNAPURNA RICE & AGRO INDUSTRIES\n\nOur brokerage desk is grouping your request.`
      );
    } else if (template === 'arrival') {
      setTestMessageText(
        `Good news ${testRecipientName}!\n\nYour shipment for Order ${testPoNumber} (24 QTLS KESHAR KALI) has arrived at APMC Yard, Bangalore and is ready for gate lifting.\n\nKindly complete invoice settlement.\n- Tejas Canvassing`
      );
    }
  };

  const handleSendTestPO = async () => {
    setIsSendingTestPo(true);
    setTestFeedback(null);
    try {
      const emailHtml = generateSupplierPOEmailHtml(
        'ANNAPURNA RICE & AGRO INDUSTRIES',
        { id: testPoNumber, date: new Date() },
        [{
          id: testPoNumber,
          buyer: testRecipientName || 'V.K FOODS',
          product: 'KESHAR KALI',
          qty: 80,
          rate: 8400,
          date: new Date(),
          loadingDays: 0,
          unloadingPoint: 'shop'
        }]
      );

      const res = await fetch('/api/dispatch-po', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: testSupplierEmail,
          from: localStorage.getItem('userEmail') || 'tejasadinarayan@gmail.com',
          supplierName: 'Annapurna Rice & Agro Industries',
          subject: `TEST PURCHASE ORDER - ${testPoNumber} - Tejas Canvassing`,
          html: emailHtml,
          batchId: testPoNumber
        })
      });

      const data = await res.json();
      setTestFeedback({
        type: 'success',
        text: `PO Transmission Result: ${data.message || 'Dispatched successfully'} (Status: ${data.status || 'OK'})`
      });
      fetchHistory();
    } catch (err: any) {
      setTestFeedback({
        type: 'error',
        text: `Failed to dispatch PO: ${err.message || 'Unknown network error'}`
      });
    } finally {
      setIsSendingTestPo(false);
    }
  };

  const [lastWaResult, setLastWaResult] = useState<any>(null);
  const [sandboxCode, setSandboxCode] = useState<string>('');
  const [showTwilioConfig, setShowTwilioConfig] = useState<boolean>(false);
  const [customSid, setCustomSid] = useState<string>('');
  const [customToken, setCustomToken] = useState<string>('');
  const [customSender, setCustomSender] = useState<string>('+14155238886');
  const [isVerifyingTwilio, setIsVerifyingTwilio] = useState<boolean>(false);
  const [twilioVerifyFeedback, setTwilioVerifyFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleVerifyAndSaveTwilio = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customSid.trim() || !customToken.trim()) return;
    setIsVerifyingTwilio(true);
    setTwilioVerifyFeedback(null);
    try {
      const res = await fetch('/api/update-twilio-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountSid: customSid.trim(),
          authToken: customToken.trim(),
          whatsappNumber: customSender.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTwilioVerifyFeedback({
          type: 'success',
          text: data.message || 'Twilio credentials verified and connected successfully!'
        });
        setGatewayStatus(prev => ({ ...prev, twilio: true }));
        fetchHistory();
      } else {
        setTwilioVerifyFeedback({
          type: 'error',
          text: data.error || 'Twilio authentication failed. Please check your Account SID and Auth Token on console.twilio.com'
        });
      }
    } catch (err: any) {
      setTwilioVerifyFeedback({
        type: 'error',
        text: `Network error verifying credentials: ${err.message || 'Unknown error'}`
      });
    } finally {
      setIsVerifyingTwilio(false);
    }
  };

  const handleSendTestWhatsApp = async () => {
    setIsSendingTestWa(true);
    setTestFeedback(null);
    setLastWaResult(null);
    try {
      const payload: any = {
        to: testPhone,
        buyerName: testRecipientName,
        message: testMessageText
      };

      if (customSid.trim() && customToken.trim()) {
        payload.accountSid = customSid.trim();
        payload.authToken = customToken.trim();
        payload.fromSender = customSender.trim();
      }

      const res = await fetch('/api/dispatch-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      setLastWaResult(data);
      if (res.ok && data.success) {
        if (data.isLiveSent) {
          setTestFeedback({
            type: 'success',
            text: `WhatsApp Delivered via Twilio Gateway! (SID: ${data.messageSid || 'OK'})`
          });
        } else {
          setTestFeedback({
            type: 'success',
            text: `WhatsApp dispatch recorded & direct link generated! Add Twilio credentials below to transmit live messages automatically.`
          });
        }
      } else {
        setTestFeedback({
          type: 'error',
          text: `Twilio Error (${data.code || res.status}): ${data.error || data.message || 'Dispatch failed'}`
        });
        if (data.code === 20003 || data.isAuthError) {
          setShowTwilioConfig(true);
        }
      }
      if (data.directUrl) setDirectWaLink(data.directUrl);
      fetchHistory();
    } catch (err: any) {
      setTestFeedback({
        type: 'error',
        text: `Failed to dispatch WhatsApp: ${err.message || 'Unknown network error'}`
      });
    } finally {
      setIsSendingTestWa(false);
    }
  };

  // Load registered profile from Firestore
  useEffect(() => {
    async function loadProfile() {
      try {
        const userEmail = localStorage.getItem('userEmail') || auth.currentUser?.email || '';
        const currentUid = auth.currentUser?.uid;
        
        // Initial fallbacks
        setBusinessName(localStorage.getItem('userName') || 'V.K FOODS');
        setPhone(localStorage.getItem('userPhone') || '9945351166');
        setContactEmail(userEmail || 'merchant.test@riceaggregator.com');
        setGstin('29AAGCV7712M1ZP');
        setAddress('No. 15, APMC Yard, Yeshwanthpur, Bangalore');
        setPan('ABCDE1234F');
        setBankName('State Bank of India');
        setAccountNo('34520987112');
        setIfsc('SBIN0007823');

        const docs = await getCollectionDocs('stakeholders').catch(() => []);
        if (docs && docs.length > 0) {
          const found = docs.find((d: any) => 
            (currentUid && d.id === currentUid) || 
            (userEmail && d.email?.toLowerCase() === userEmail.toLowerCase())
          );
          if (found) {
            setBusinessName(found.name || '');
            setPhone(found.phone || '');
            setContactEmail(found.email || userEmail || '');
            setGstin(found.gstin || '');
            setAddress(found.address || '');
            setStateVal(found.state || 'Karnataka');
            setMandi(found.mandi || 'Yeshwanthpur');
            
            if (found.pan) setPan(found.pan);
            if (found.bankName) setBankName(found.bankName);
            if (found.accountNo) setAccountNo(found.accountNo);
            if (found.ifsc) setIfsc(found.ifsc);
          }
        }
      } catch (err) {
        console.warn('Could not load profile from Firestore:', err);
      }
    }
    loadProfile();
  }, []);

  const handleSendPaymentNotif = () => {
    if (!selectedOrderForNotif) return;
    setIsSendingNotif(true);
    setTimeout(() => {
      setIsSendingNotif(false);
      setShowSuccess(true);
      setSelectedOrderForNotif('');
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1500);
  };

  const toggleSetting = (id: string, channel: 'email' | 'push' | 'whatsapp') => {
    setSettings(prev => prev.map(s => 
      s.id === id ? { ...s, [channel]: !s[channel] } : s
    ));
  };

  const handleSaveNotificationSettings = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    }, 1200);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const currentUid = auth.currentUser?.uid || `usr-${Date.now()}`;
      const stakeholderData = {
        id: currentUid,
        name: businessName,
        type: 'buyers', // acts as merchant/buyer in system
        phone: phone,
        email: contactEmail,
        gstin: gstin,
        address: address,
        state: stateVal,
        mandi: mandi,
        status: 'Active',
        credit: '₹ 80.0 Lakh',
        pan: pan,
        bankName: bankName,
        accountNo: accountNo,
        ifsc: ifsc,
        updatedAt: new Date().toISOString()
      };

      // 1. Sync directly to Firestore stakeholders
      await setCollectionDoc('stakeholders', currentUid, stakeholderData);

      // 2. Dual write local states
      localStorage.setItem('userName', businessName);
      localStorage.setItem('userPhone', phone);
      localStorage.setItem('userEmail', contactEmail);

      // 3. Sync stakeholders list local copy dual-write
      const localStakeholders = JSON.parse(localStorage.getItem('stakeholders_v2') || 'null');
      if (localStakeholders) {
        let updatedBuyers = localStakeholders.buyers || [];
        // Remove matching document
        updatedBuyers = updatedBuyers.filter((b: any) => 
          b.id !== currentUid && b.email?.toLowerCase() !== (contactEmail || '').toLowerCase()
        );
        updatedBuyers.push(stakeholderData);
        localStakeholders.buyers = updatedBuyers;
        localStorage.setItem('stakeholders_v2', JSON.stringify(localStakeholders));
      }

      setShowProfileSuccess(true);
      setTimeout(() => setShowProfileSuccess(false), 3500);
    } catch (err) {
      console.error('Error saving profile information:', err);
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="px-4 py-6 sm:p-8 space-y-6 sm:space-y-8 max-w-4xl mx-auto pb-24">
      {/* Title & Description Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 pb-2 border-b border-outline-variant/30">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Settings className={cn("w-8 h-8", isMerchant ? "text-emerald-600 dark:text-emerald-400" : "text-primary")} />
            Control Hub
          </h1>
          <p className="text-secondary text-sm font-medium">Configure commercial stakeholder accounts and transaction pipes.</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/30 self-start md:self-end overflow-x-auto w-full sm:w-auto scrollbar-none">
          <button
            onClick={() => setActiveTab('dispatch_test')}
            className={cn(
              "flex-1 sm:flex-none justify-center whitespace-nowrap px-4 py-2.5 sm:px-5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 sm:gap-2",
              activeTab === 'dispatch_test' 
                ? cn("bg-white dark:bg-surface-container shadow-sm text-emerald-600 dark:text-emerald-400 font-black")
                : "text-secondary hover:text-on-surface"
            )}
          >
            <MessageSquare className="w-3.5 h-3.5 text-current shrink-0" />
            PO & WhatsApp Dispatcher
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={cn(
              "flex-1 sm:flex-none justify-center whitespace-nowrap px-4 py-2.5 sm:px-5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 sm:gap-2",
              activeTab === 'profile' 
                ? cn("bg-white dark:bg-surface-container shadow-sm", isMerchant ? "text-emerald-600 dark:text-emerald-400" : "text-primary")
                : "text-secondary hover:text-on-surface"
            )}
          >
            <Building2 className="w-3.5 h-3.5 text-current shrink-0" />
            Profile Specs
          </button>
          <button
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "flex-1 sm:flex-none justify-center whitespace-nowrap px-4 py-2.5 sm:px-5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 sm:gap-2",
              activeTab === 'notifications' 
                ? cn("bg-white dark:bg-surface-container shadow-sm", isMerchant ? "text-emerald-600 dark:text-emerald-400" : "text-primary")
                : "text-secondary hover:text-on-surface"
            )}
          >
            <Bell className="w-3.5 h-3.5 text-current shrink-0" />
            Alerts Settings
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'profile' ? (
          <motion.div 
            key="profile-tab"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {showProfileSuccess && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-bold text-sm shadow-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Required details saved! Information is successfully pushed to the Cloud Database.</span>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-6">
              {/* Card 1: Primary Merchant Details */}
              <div className="liquid-glass p-8 rounded-3xl premium-border space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-outline-variant/30">
                  <div className={cn("p-3 rounded-2xl", isMerchant ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary")}>
                    <Building2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg">Merchant & Business Registry</h3>
                    <p className="text-secondary text-xs font-medium">Primary identification used across orders and logistics chains.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary px-1">Business Name</label>
                    <input 
                      type="text" 
                      required
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      className={cn("w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 transition-all", isMerchant ? "focus:ring-emerald-500/20 focus:border-emerald-500" : "focus:ring-primary/20")}
                      placeholder="e.g. V.K FOODS"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary px-1">Registered Phone</label>
                    <input 
                      type="tel" 
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className={cn("w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 transition-all font-mono", isMerchant ? "focus:ring-emerald-500/20 focus:border-emerald-500" : "focus:ring-primary/20")}
                      placeholder="e.g. +91 98450 12345"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary px-1">Contact Email</label>
                    <input 
                      type="email" 
                      required
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      className={cn("w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 transition-all font-mono", isMerchant ? "focus:ring-emerald-500/20 focus:border-emerald-500" : "focus:ring-primary/20")}
                      placeholder="e.g. buyer@grainhub.com"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary px-1">GSTIN (Tax Identification)</label>
                    <input 
                      type="text" 
                      required
                      value={gstin}
                      onChange={(e) => setGstin(e.target.value.toUpperCase())}
                      className={cn("w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 transition-all font-mono", isMerchant ? "focus:ring-emerald-500/20 focus:border-emerald-500" : "focus:ring-primary/20")}
                      placeholder="e.g. 29AAGCV7712M1ZP"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary px-1">PAN Card Number</label>
                    <input 
                      type="text" 
                      required
                      value={pan}
                      onChange={(e) => setPan(e.target.value.toUpperCase())}
                      className={cn("w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 transition-all font-mono", isMerchant ? "focus:ring-emerald-500/20 focus:border-emerald-500" : "focus:ring-primary/20")}
                      placeholder="e.g. ABCDE1234F"
                    />
                  </div>
                </div>
              </div>

              {/* Card 2: Physical & Market Parameters */}
              <div className="liquid-glass p-8 rounded-3xl premium-border space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-outline-variant/30">
                  <div className={cn("p-3 rounded-2xl", isMerchant ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary")}>
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg">Marketplace Coordinates</h3>
                    <p className="text-secondary text-xs font-medium">Marketplace physical point of verification for grain handovers.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary px-1">Assigned State</label>
                    <select
                      value={stateVal}
                      onChange={(e) => setStateVal(e.target.value)}
                      className={cn("w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 transition-all", isMerchant ? "focus:ring-emerald-500/20 focus:border-emerald-500" : "focus:ring-primary/20")}
                    >
                      <option value="Karnataka">Karnataka</option>
                      <option value="Punjab">Punjab</option>
                      <option value="Haryana">Haryana</option>
                      <option value="Uttar Pradesh">Uttar Pradesh</option>
                      <option value="Madhya Pradesh">Madhya Pradesh</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary px-1">Local Market Yard Name</label>
                    <input 
                      type="text" 
                      required
                      value={mandi}
                      onChange={(e) => setMandi(e.target.value)}
                      className={cn("w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 transition-all", isMerchant ? "focus:ring-emerald-500/20 focus:border-emerald-500" : "focus:ring-primary/20")}
                      placeholder="e.g. Yeshwanthpur Yards"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary px-1">Complete Commercial Billing & Shipping Address</label>
                    <textarea 
                      required
                      rows={3}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className={cn("w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 transition-all leading-relaxed", isMerchant ? "focus:ring-emerald-500/20 focus:border-emerald-500" : "focus:ring-primary/20")}
                      placeholder="e.g. No. 15, APMC Yard, Yeshwanthpur Industrial Area, Bangalore - 560022"
                    />
                  </div>
                </div>
              </div>

              {/* Card 3: Financial Settlements */}
              <div className="liquid-glass p-8 rounded-3xl premium-border space-y-6">
                <div className="flex items-center gap-4 pb-4 border-b border-outline-variant/30">
                  <div className={cn("p-3 rounded-2xl", isMerchant ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-primary/10 text-primary")}>
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg">Financial Settlements</h3>
                    <p className="text-secondary text-xs font-medium">Required details for auto-generating digital payout RTGS and bank proof submissions.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary px-1">Beneficiary Bank Name</label>
                    <input 
                      type="text" 
                      required
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className={cn("w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 transition-all", isMerchant ? "focus:ring-emerald-500/20 focus:border-emerald-500" : "focus:ring-primary/20")}
                      placeholder="e.g. State Bank of India"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary px-1">Account Number</label>
                    <input 
                      type="text" 
                      required
                      value={accountNo}
                      onChange={(e) => setAccountNo(e.target.value)}
                      className={cn("w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 transition-all font-mono", isMerchant ? "focus:ring-emerald-500/20 focus:border-emerald-500" : "focus:ring-primary/20")}
                      placeholder="e.g. 50100412345678"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary px-1">Bank IFSC Code</label>
                    <input 
                      type="text" 
                      required
                      value={ifsc}
                      onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                      className={cn("w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 transition-all font-mono", isMerchant ? "focus:ring-emerald-500/20 focus:border-emerald-500" : "focus:ring-primary/20")}
                      placeholder="e.g. SBIN0007823"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className={cn(
                    "flex items-center gap-2 px-8 py-3.5 text-white rounded-xl shadow-lg transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50 cursor-pointer active:scale-95 hover:opacity-90",
                    isMerchant 
                      ? "bg-emerald-600 shadow-emerald-500/20" 
                      : "bg-primary shadow-primary/20"
                  )}
                >
                  {isSavingProfile ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save & Push Details
                </button>
              </div>
            </form>
          </motion.div>
        ) : activeTab === 'notifications' ? (
          <motion.div 
            key="notif-tab"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            <AnimatePresence>
              {showSuccess && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-600 dark:text-emerald-400 font-bold text-sm shadow-sm"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Alert channels updated successfully.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Payment Notification Dispatcher */}
            {(role === 'admin' || role === 'officer') && (
              <div className="liquid-glass p-8 rounded-3xl premium-border space-y-6">
                 <div className="flex items-center gap-4">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                       <CreditCard className="w-6 h-6" />
                    </div>
                    <div>
                       <h3 className="font-black text-lg">Payment Proof Request</h3>
                       <p className="text-xs text-secondary font-medium italic">Dispatch a priority notification to a buyer for pending payment.</p>
                    </div>
                 </div>

                 <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 space-y-2">
                       <label className="text-[10px] font-black uppercase tracking-widest text-secondary px-1">Select Active Batch/Order</label>
                       <select 
                         value={selectedOrderForNotif}
                         onChange={(e) => setSelectedOrderForNotif(e.target.value)}
                         className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none cursor-pointer focus:ring-2 focus:ring-primary/20 transition-all font-mono"
                       >
                          <option value="">-- Choose Order --</option>
                          {placedOrders.map((o: any) => (
                             <option key={o.id} value={o.id}>{o.id} - {o.buyer} ({o.total})</option>
                          ))}
                          {placedOrders.length === 0 && <option disabled>No active placed orders found</option>}
                       </select>
                    </div>
                    <div className="md:w-48 flex items-end">
                       <button 
                         onClick={handleSendPaymentNotif}
                         disabled={!selectedOrderForNotif || isSendingNotif}
                         className="w-full bg-on-background text-background py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-30 disabled:cursor-not-allowed group"
                       >
                         {isSendingNotif ? (
                            <div className="flex items-center justify-center gap-2">
                               <div className="w-3 h-3 border-2 border-background/30 border-t-background rounded-full animate-spin" />
                               Encrypting...
                            </div>
                         ) : (
                            "Send Request"
                         )}
                       </button>
                    </div>
                 </div>
              </div>
            )}

            <div className="space-y-4">
              {settings.map((setting) => (
                <div 
                  key={setting.id}
                  className="liquid-glass p-6 rounded-3xl premium-border flex flex-col md:flex-row md:items-center justify-between gap-6"
                >
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "p-3 rounded-2xl",
                      setting.urgent ? "bg-rose-500/10 text-rose-500" : "bg-primary/5 text-primary"
                    )}>
                      <setting.icon className="w-6 h-6" />
                    </div>
                    <div className="space-y-0.5">
                      <h3 className="font-black text-base">{setting.title}</h3>
                      <p className="text-xs text-secondary font-medium leading-relaxed max-w-sm">
                        {setting.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="grid grid-cols-3 gap-1 bg-surface-container-low p-1.5 rounded-2xl border border-outline-variant/30">
                      {(['email', 'push', 'whatsapp'] as const).map((channel) => (
                        <button
                          key={channel}
                          onClick={() => toggleSetting(setting.id, channel)}
                          className={cn(
                            "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all",
                            setting[channel] 
                              ? "bg-white dark:bg-surface-container text-primary shadow-sm border border-outline-variant/30" 
                              : "text-secondary hover:text-on-surface opacity-40 hover:opacity-100"
                          )}
                        >
                          {channel === 'email' && <Mail className="w-4 h-4" />}
                          {channel === 'push' && <Bell className="w-4 h-4" />}
                          {channel === 'whatsapp' && <MessageSquare className="w-4 h-4 text-emerald-600" />}
                          <span className="text-[9px] font-black uppercase tracking-widest">{channel}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-on-background p-8 rounded-3xl text-background space-y-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Settings className="w-32 h-32" />
              </div>
              <div className="relative z-10 space-y-2">
                <h4 className="text-xl font-black tracking-tight">Global Suppress</h4>
                <p className="text-sm text-background/60 font-medium max-w-md">
                  Instantly silence all non-critical notifications across all devices with a single master switch.
                </p>
              </div>
              <div className="pt-4 flex items-center justify-between border-t border-white/10">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-background/10 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-background" />
                   </div>
                   <div>
                      <p className="text-xs font-black uppercase tracking-widest text-background">Master Silence</p>
                      <p className="text-[10px] text-background/40">Status: Currently Disabled</p>
                   </div>
                </div>
                <button 
                  type="button"
                  onClick={handleSaveNotificationSettings}
                  className="px-6 py-2 bg-white text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-white/90 active:scale-95 transition-all"
                >
                   Toggle Suppression
                </button>
              </div>
            </div>

            {/* Production Deployment & Data Sanitizer Terminal */}
            <div className="liquid-glass p-8 rounded-3xl border border-rose-500/20 shadow-xl space-y-6 text-left">
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-500/10 text-rose-500 rounded-2xl">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg text-on-surface">Production Deployment & Data Sanitizer</h3>
                    <p className="text-xs text-secondary font-medium">Prepare the web application for production launch by purging local test mock data.</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Production Prep
                </span>
              </div>

              {purgeFeedback && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-2xl text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>{purgeFeedback}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/30 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-on-surface">
                    1. Sanitize Local Storage Cache
                  </h4>
                  <p className="text-[11px] text-secondary leading-relaxed">
                    Clears mock orders, local indents, and test overrides from browser storage while maintaining your active login session. Forces all views to pull live data from Cloud Firestore.
                  </p>
                  <button
                    type="button"
                    onClick={handleSanitizeLocalData}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Sanitize Local Cache</span>
                  </button>
                </div>

                <div className="p-5 bg-surface-container-low rounded-2xl border border-outline-variant/30 space-y-3">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-on-surface">
                    2. Full Production Factory Reset
                  </h4>
                  <p className="text-[11px] text-secondary leading-relaxed">
                    Wipes all local browser storage completely and redirects to the landing intro page. Recommended immediately prior to handing off the URL to end users.
                  </p>
                  <button
                    type="button"
                    onClick={handleFullFactoryReset}
                    className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs active:scale-95 flex items-center justify-center gap-2"
                  >
                    <AlertTriangle className="w-4 h-4" />
                    <span>Full Factory Reset</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="dispatch-test-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="space-y-6"
          >
            {/* Feedback alert */}
            <AnimatePresence>
              {testFeedback && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className={cn(
                    "p-4 rounded-2xl border flex items-start gap-3 text-xs font-bold shadow-sm",
                    testFeedback.type === 'success' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300" :
                    testFeedback.type === 'error' ? "bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-300" :
                    "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-300"
                  )}
                >
                  {testFeedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                  <div className="flex-1">{testFeedback.text}</div>
                  <button onClick={() => setTestFeedback(null)} className="text-[10px] uppercase font-black opacity-60 hover:opacity-100">Dismiss</button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Gateway Connectivity Diagnostic Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={cn(
                "p-5 rounded-3xl border flex items-start gap-3.5 transition-all",
                gatewayStatus.smtp 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  : "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-300"
              )}>
                <div className={cn(
                  "p-2.5 rounded-2xl shrink-0 mt-0.5",
                  gatewayStatus.smtp ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300" : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                )}>
                  <Mail className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-black text-xs uppercase tracking-wider">SMTP PO Email Gateway</h4>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                      gatewayStatus.smtp ? "bg-emerald-600 text-white" : "bg-amber-500/30 text-amber-800 dark:text-amber-200"
                    )}>
                      {gatewayStatus.smtp ? 'Live Relay Active' : 'Simulation & Direct Mode'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-relaxed font-medium">
                    {gatewayStatus.smtp 
                      ? 'Connected to your SMTP server. Automated POs are delivered directly to real supplier inboxes.'
                      : 'Running in simulation mode. Dispatches are logged in the audit trail, and you can 1-click launch Gmail / Mail clients to send immediately.'}
                  </p>
                </div>
              </div>

              <div className={cn(
                "p-5 rounded-3xl border flex items-start gap-3.5 transition-all",
                gatewayStatus.twilio 
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                  : "bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-300"
              )}>
                <div className={cn(
                  "p-2.5 rounded-2xl shrink-0 mt-0.5",
                  gatewayStatus.twilio ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300" : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                )}>
                  <MessageSquare className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-black text-xs uppercase tracking-wider">Twilio WhatsApp Gateway</h4>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest",
                      gatewayStatus.twilio ? "bg-emerald-600 text-white" : "bg-blue-500/30 text-blue-800 dark:text-blue-200"
                    )}>
                      {gatewayStatus.twilio ? 'Live WhatsApp Active' : 'Direct App / Web Mode'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-80 leading-relaxed font-medium">
                    {gatewayStatus.twilio 
                      ? 'Connected to Twilio. Real automated WhatsApp alerts are dispatched directly to buyer devices.'
                      : 'Running in direct trigger mode. Dispatches are logged, and 1-click WhatsApp (wa.me) allows instant real-world delivery.'}
                  </p>
                </div>
              </div>
            </div>

            {/* SECTION 1: WhatsApp Notification Dispatcher */}
            <div className="liquid-glass p-6 sm:p-8 rounded-3xl premium-border space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg">Test WhatsApp Message Dispatcher</h3>
                    <p className="text-xs text-secondary font-medium">Verify instant WhatsApp message dispatch to any buyer phone number.</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Live Gateway
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                    Recipient Mobile Number (10 Digits)
                  </label>
                  <input
                    type="tel"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="e.g. 9945351166"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 text-on-surface"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                    Recipient Business / Buyer Name
                  </label>
                  <input
                    type="text"
                    value={testRecipientName}
                    onChange={(e) => setTestRecipientName(e.target.value)}
                    placeholder="e.g. V.K FOODS"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-bold outline-none focus:ring-2 focus:ring-emerald-500/20 text-on-surface"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                  Select Notification Template
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'po', label: 'PO Dispatched' },
                    { id: 'indent', label: 'Indent Registered' },
                    { id: 'arrival', label: 'Shipment Arrival' },
                    { id: 'custom', label: 'Custom Text' }
                  ].map(tmpl => (
                    <button
                      key={tmpl.id}
                      type="button"
                      onClick={() => handleTemplateSelect(tmpl.id as any)}
                      className={cn(
                        "py-2 px-3 rounded-xl text-[11px] font-bold transition-all border text-center",
                        testMessageTemplate === tmpl.id
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-surface-container-low text-secondary border-outline-variant/30 hover:text-on-surface"
                      )}
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                  Message Payload Body
                </label>
                <textarea
                  rows={4}
                  value={testMessageText}
                  onChange={(e) => setTestMessageText(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant rounded-xl p-4 text-xs font-mono font-medium outline-none focus:ring-2 focus:ring-emerald-500/20 text-on-surface leading-relaxed resize-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <a
                  href={directWaLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/20 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all no-underline cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  Launch Direct WhatsApp to {testPhone} (Instant)
                </a>

                <button
                  type="button"
                  disabled={isSendingTestWa || !testPhone}
                  onClick={handleSendTestWhatsApp}
                  className="px-5 py-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSendingTestWa ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                      Sending via Twilio...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 text-emerald-600" />
                      Send via Twilio Automated API
                    </>
                  )}
                </button>
              </div>

              {/* Twilio Sandbox & Diagnostic Helper Panel */}
              <div className="p-4 sm:p-5 rounded-2xl bg-surface-container-low border border-outline-variant/40 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-black uppercase tracking-wider text-on-surface">
                    Twilio Sandbox & WhatsApp Delivery Guide
                  </h4>
                </div>

                <p className="text-[11px] text-secondary leading-relaxed font-medium">
                  Twilio's sender number <code className="px-1.5 py-0.5 bg-surface-container-highest rounded text-on-surface font-mono font-bold">+1 415 523 8886</code> operates in <strong>Twilio Sandbox Mode</strong>. To receive automated backend WhatsApp messages on a test device:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/30 space-y-2">
                    <p className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[9px] font-black flex items-center justify-center">1</span>
                      Join Twilio Sandbox on WhatsApp
                    </p>
                    <p className="text-[10px] text-secondary leading-normal">
                      Send your Twilio Sandbox keyword (found in your Twilio Console, e.g. <code className="text-on-surface font-bold font-mono">join &lt;your-code&gt;</code>) to <strong className="text-on-surface">+1 415 523 8886</strong> on WhatsApp once.
                    </p>
                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="text"
                        placeholder="e.g. join gentle-lion"
                        value={sandboxCode}
                        onChange={(e) => setSandboxCode(e.target.value)}
                        className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-2.5 py-1.5 text-[11px] font-mono outline-none"
                      />
                      <a
                        href={`https://wa.me/14155238886?text=${encodeURIComponent(sandboxCode || 'join')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all no-underline shrink-0"
                      >
                        Join Sandbox
                      </a>
                    </div>
                  </div>

                  <div className="p-3 bg-surface-container rounded-xl border border-outline-variant/30 space-y-2">
                    <p className="text-[11px] font-bold text-on-surface flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[9px] font-black flex items-center justify-center">2</span>
                      Instant 1-Click WhatsApp (No Sandbox)
                    </p>
                    <p className="text-[10px] text-secondary leading-normal">
                      Click the green <strong>"Launch Direct WhatsApp"</strong> button above. It opens WhatsApp immediately with the trade payload and recipient phone number pre-filled, bypassing all Sandbox requirements.
                    </p>
                  </div>
                </div>

                {/* Twilio Credential Management & Auth Recovery Card */}
                <div className="p-4 bg-surface-container rounded-2xl border border-outline-variant/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg">
                        <Key className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs font-black uppercase tracking-wider text-on-surface">
                        Twilio API Credentials & Auth Config
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTwilioConfig(!showTwilioConfig)}
                      className="text-[10px] font-bold text-primary hover:underline"
                    >
                      {showTwilioConfig ? 'Hide Credentials Form' : 'Update / Verify Credentials'}
                    </button>
                  </div>

                  {showTwilioConfig && (
                    <form onSubmit={handleVerifyAndSaveTwilio} className="space-y-3 pt-2 border-t border-outline-variant/30">
                      <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 text-[11px] text-purple-900 dark:text-purple-200 space-y-1">
                        <p className="font-bold flex items-center gap-1.5">
                          <span>How to get your active Twilio credentials:</span>
                        </p>
                        <ol className="list-decimal list-inside space-y-0.5 text-[10px] opacity-90">
                          <li>Open <a href="https://console.twilio.com" target="_blank" rel="noopener noreferrer" className="font-bold underline text-primary">console.twilio.com</a> in your browser.</li>
                          <li>In the <strong>"Account Info"</strong> section on your dashboard, copy your <strong>Account SID</strong> and click <strong>"Show"</strong> next to <strong>Auth Token</strong>.</li>
                          <li>Paste both below and click <strong>"Verify & Connect Credentials"</strong> to establish live cellular connectivity.</li>
                        </ol>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">
                            Account SID (AC...) or API Key SID (SK...)
                          </label>
                          <input
                            type="text"
                            value={customSid}
                            onChange={(e) => setCustomSid(e.target.value)}
                            placeholder="ACxxxxxxxx... or SKxxxxxxxx..."
                            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs font-mono font-bold outline-none text-on-surface"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-secondary block">
                            Auth Token or API Key Secret
                          </label>
                          <input
                            type="password"
                            value={customToken}
                            onChange={(e) => setCustomToken(e.target.value)}
                            placeholder="Primary Auth Token or API Key Secret"
                            className="w-full bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-xs font-mono font-bold outline-none text-on-surface"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 pt-1">
                        <div className="text-[10px] text-secondary">
                          Sender: <code className="font-mono font-bold text-on-surface">{customSender}</code>
                        </div>
                        <button
                          type="submit"
                          disabled={isVerifyingTwilio || !customSid || !customToken}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          {isVerifyingTwilio ? (
                            <>
                              <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                              Verifying with Twilio...
                            </>
                          ) : (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Verify & Connect Credentials
                            </>
                          )}
                        </button>
                      </div>

                      {twilioVerifyFeedback && (
                        <div className={cn(
                          "p-2.5 rounded-lg text-[11px] font-medium border flex items-center gap-2",
                          twilioVerifyFeedback.type === 'success' 
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                            : "bg-red-500/10 border-red-500/30 text-red-800 dark:text-red-200"
                        )}>
                          {twilioVerifyFeedback.type === 'success' ? <Check className="w-4 h-4 shrink-0 text-emerald-600" /> : <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />}
                          <span>{twilioVerifyFeedback.text}</span>
                        </div>
                      )}
                    </form>
                  )}
                </div>

                {lastWaResult && (
                  <div className={cn(
                    "p-3 rounded-xl border text-[11px] font-mono",
                    lastWaResult.success 
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300"
                      : "bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-200"
                  )}>
                    <div className="flex items-center justify-between font-bold pb-1">
                      <span>Last WhatsApp API Call Response:</span>
                      <span className={cn(
                        "uppercase text-[9px] px-1.5 py-0.5 rounded font-black",
                        lastWaResult.success ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300" : "bg-red-500/20 text-red-700 dark:text-red-300"
                      )}>
                        {lastWaResult.status || (lastWaResult.success ? "SUCCESS" : "ERROR")}
                      </span>
                    </div>
                    <div>{lastWaResult.message || lastWaResult.error}</div>
                    {lastWaResult.messageSid && (
                      <div className="mt-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                        Twilio Message SID: {lastWaResult.messageSid}
                      </div>
                    )}
                    {(lastWaResult.code || lastWaResult.error) && !lastWaResult.success && (
                      <div className="mt-2 text-[10px] opacity-90 space-y-1.5 pt-1 border-t border-red-500/20">
                        {lastWaResult.code && <div>Twilio Error Code: <strong>{lastWaResult.code}</strong></div>}
                        {lastWaResult.isContentSidError && (
                          <div className="p-2.5 rounded-lg bg-surface-container border border-red-500/30 text-on-surface space-y-2 mt-1">
                            <p className="font-bold text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5" />
                              2 Quick Solutions to Deliver This Message:
                            </p>
                            <div className="flex flex-wrap gap-2 pt-1">
                              <a
                                href={lastWaResult.directUrl || directWaLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all no-underline flex items-center gap-1.5 shadow-sm"
                              >
                                <ExternalLink className="w-3 h-3" />
                                1. Launch Direct WhatsApp (Instant)
                              </a>
                              <a
                                href={`https://wa.me/14155238886?text=${encodeURIComponent(sandboxCode || 'join')}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all no-underline flex items-center gap-1.5 shadow-sm"
                              >
                                <MessageSquare className="w-3 h-3" />
                                2. Activate 24h Sandbox Window
                              </a>
                            </div>
                          </div>
                        )}
                        {lastWaResult.moreInfo && (
                          <div className="pt-0.5">
                            Documentation: <a href={lastWaResult.moreInfo} target="_blank" rel="noopener noreferrer" className="underline font-bold">{lastWaResult.moreInfo}</a>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: Automated Purchase Order Email Test */}
            <div className="liquid-glass p-6 sm:p-8 rounded-3xl premium-border space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-outline-variant/30">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-lg">Test Automated Purchase Order (SMTP)</h3>
                    <p className="text-xs text-secondary font-medium">Verify compilation and transmission of supplier POs.</p>
                  </div>
                </div>
                <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-full text-[10px] font-black uppercase tracking-wider">
                  SMTP Relay
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                    Supplier Recipient Email
                  </label>
                  <input
                    type="email"
                    value={testSupplierEmail}
                    onChange={(e) => setTestSupplierEmail(e.target.value)}
                    placeholder="e.g. supplier@ricemill.com"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-secondary block">
                    PO Batch Reference Number
                  </label>
                  <input
                    type="text"
                    value={testPoNumber}
                    onChange={(e) => setTestPoNumber(e.target.value)}
                    placeholder="e.g. TC-9801"
                    className="w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 text-xs font-mono font-bold outline-none focus:ring-2 focus:ring-primary/20 text-on-surface"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={isSendingTestPo || !testSupplierEmail}
                  onClick={handleSendTestPO}
                  className="px-6 py-3 bg-primary hover:bg-primary/95 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-primary/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSendingTestPo ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Transmitting PO via SMTP...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Dispatch via Server SMTP
                    </>
                  )}
                </button>

                <a
                  href={directGmailLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all no-underline"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Launch Gmail Web (Pre-filled PO)
                </a>

                <a
                  href={directMailLink}
                  className="px-4 py-3 bg-surface-container-high hover:bg-surface-container-highest text-on-surface border border-outline-variant/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all no-underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Default Mail Client (mailto:)
                </a>
              </div>
            </div>

            {/* SECTION 3: Live Transmission History Log */}
            <div className="liquid-glass p-6 sm:p-8 rounded-3xl premium-border space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant/30">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-secondary/10 rounded-2xl text-secondary">
                    <Terminal className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-black text-base">Live Transmission History & Audit Logs</h3>
                    <p className="text-[11px] text-secondary">Recent automated PO and phone dispatches from the backend.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={fetchHistory}
                  disabled={isLoadingHistory}
                  className="p-2 bg-surface-container-low hover:bg-surface-container rounded-xl text-secondary hover:text-on-surface transition-all border border-outline-variant/30 flex items-center gap-1.5 text-xs font-bold cursor-pointer"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", isLoadingHistory && "animate-spin")} />
                  Refresh
                </button>
              </div>

              {dispatchHistory.length === 0 ? (
                <div className="py-12 text-center text-secondary space-y-2">
                  <p className="text-xs font-bold">No dispatches recorded yet in current session.</p>
                  <p className="text-[11px]">Use the test tools above or place an order to trigger automated dispatches.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {dispatchHistory.map((item) => (
                    <div
                      key={item.id}
                      className="p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-xl shrink-0 mt-0.5",
                          item.type === 'email' ? "bg-primary/10 text-primary" :
                          item.type === 'whatsapp' ? "bg-emerald-500/10 text-emerald-600" :
                          "bg-blue-500/10 text-blue-600"
                        )}>
                          {item.type === 'email' ? <Mail className="w-4 h-4" /> :
                           item.type === 'whatsapp' ? <MessageSquare className="w-4 h-4" /> :
                           <Smartphone className="w-4 h-4" />}
                        </div>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-black uppercase tracking-wider text-[10px] text-on-surface">
                              {item.type}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-on-surface">
                              {item.to}
                            </span>
                            {item.recipientName && (
                              <span className="text-[10px] text-secondary">
                                ({item.recipientName})
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-secondary font-medium line-clamp-1">
                            {item.summary}
                          </p>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center sm:items-end justify-between shrink-0 gap-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider",
                          item.status === 'sent' ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" :
                          item.status === 'simulated_success' ? "bg-blue-500/10 text-blue-600 border border-blue-500/20" :
                          "bg-rose-500/10 text-rose-600 border border-rose-500/20"
                        )}>
                          {item.status === 'simulated_success' ? 'Simulated Log' : item.status}
                        </span>
                        <span className="text-[9px] text-secondary font-mono">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
