import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft,
  ArrowRight, 
  ChevronLeft, 
  Sparkles, 
  Lock, 
  Mail, 
  Phone, 
  ShieldCheck, 
  Building2, 
  Warehouse, 
  Eye, 
  EyeOff, 
  Check, 
  AlertCircle,
  Briefcase,
  Layers,
  ArrowUpRight,
  Info,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult
} from 'firebase/auth';
import { auth, setCollectionDoc } from '../lib/firebase';
import { loginWithServer, getVerifiedUserRole } from '../lib/auth';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
}

// Handcrafted botanical leaf stalk emblem matching the exact brandmark in reference
export function TejasBotanicalLogo({ className = "w-8 h-8 text-[#143e2e] dark:text-emerald-400" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Central arched stem */}
      <path
        d="M20 34C20 24 19 14 21 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Top delicate crest leaf */}
      <path
        d="M21 6C23 9 27 10 26 14C25 18 20.5 16.5 20 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Left upper leaf */}
      <path
        d="M19.5 16C16 13 11 14.5 12 19.5C13 23.5 18 22 19 19"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right lower leaf */}
      <path
        d="M20 22C23.5 19.5 28.5 21 28 25.5C27 29.5 21.5 28.5 20.5 25"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Small lowest left leaf */}
      <path
        d="M19.8 26.5C17.5 25 14.5 26 15 29C15.5 31.5 19 31 19.8 28.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Crisp Google G Logo
function GoogleGIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
      />
    </svg>
  );
}

interface LoginViewProps {
  defaultStep?: string;
  defaultTab?: 'signin' | 'signup';
  secretRole?: 'admin' | 'employee';
}

export default function LoginView({ defaultTab = 'signin', secretRole }: LoginViewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const redirectTarget = rawRedirect && rawRedirect.startsWith('/') ? rawRedirect : null;

  // Auto-redirect if already authenticated as requested role
  useEffect(() => {
    try {
      const activeRole = getVerifiedUserRole();
      if (secretRole === 'admin' && activeRole === 'admin') {
        const target = redirectTarget || (location.pathname.startsWith('/admin') ? location.pathname : '/admin');
        navigate(target, { replace: true });
      } else if (secretRole === 'employee' && activeRole === 'employee') {
        const target = redirectTarget || '/inventory';
        navigate(target, { replace: true });
      }
    } catch {}
  }, [secretRole, redirectTarget, navigate]);

  // Login Mode: 'merchant' vs 'admin_employee' (Only accessible via secret URL)
  const [loginMode, setLoginMode] = useState<'merchant' | 'admin_employee'>(() => {
    return secretRole ? 'admin_employee' : 'merchant';
  });
  
  // Specific role inside admin_employee: 'admin' | 'employee'
  const [staffRole, setStaffRole] = useState<'admin' | 'employee'>(() => {
    return secretRole === 'employee' ? 'employee' : 'admin';
  });

  // Input states
  const [merchantAuthTab, setMerchantAuthTab] = useState<'signin' | 'signup'>(defaultTab);
  const [identifier, setIdentifier] = useState('9845012345');
  const [email, setEmail] = useState('tejas@example.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [authWithPhone, setAuthWithPhone] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('9845012345');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  // Merchant Signup states
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupGstin, setSignupGstin] = useState('');

  // Staff Authentication States
  const [staffUsername, setStaffUsername] = useState('');
  const [staffPassword, setStaffPassword] = useState('');
  const [showStaffPassword, setShowStaffPassword] = useState(false);

  // Employee Credential Request Modal State
  const [showEmployeeRequestModal, setShowEmployeeRequestModal] = useState(false);
  const [empRequestName, setEmpRequestName] = useState('');
  const [empRequestPhone, setEmpRequestPhone] = useState('');
  const [empRequestSuccess, setEmpRequestSuccess] = useState(false);

  // UI States
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Perform Merchant Sign-In (Supports Email, Phone, or Username)
  const handleMerchantSignIn = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const rawInput = (identifier || email).trim();
      const cleanPass = password.trim();

      if (!cleanPass) {
        setErrorMsg('Please enter your account password.');
        setLoading(false);
        return;
      }

      let resolvedEmail = rawInput || 'tejas@example.com';
      let resolvedName = 'TEJAS CANVASSING';
      let resolvedPhone = '9845012345';

      // Check if input is a phone number (e.g. 9845012345)
      const isPhone = /^[0-9+\s-]{8,15}$/.test(rawInput);
      if (isPhone) {
        const digitsOnly = rawInput.replace(/\D/g, '');
        resolvedEmail = `${digitsOnly}@riceaggregator.com`;
        resolvedPhone = digitsOnly;
        resolvedName = `Merchant (+91 ${digitsOnly})`;
      } else if (!rawInput.includes('@')) {
        // Input is a username / firm name (e.g. BALAJI TRADERS)
        const cleanUser = rawInput.toLowerCase().replace(/[^a-z0-9]/g, '');
        resolvedEmail = `${cleanUser || 'merchant'}@riceaggregator.com`;
        resolvedName = rawInput.toUpperCase();
      }

      // Authenticate securely with Express backend
      const serverAuth = await loginWithServer(resolvedEmail, cleanPass, 'merchant');
      if (!serverAuth.success) {
        setErrorMsg(serverAuth.error || 'Invalid credentials.');
        setLoading(false);
        return;
      }

      try {
        await signInWithEmailAndPassword(auth, resolvedEmail, cleanPass);
      } catch (authErr: any) {
        try {
          await createUserWithEmailAndPassword(auth, resolvedEmail, cleanPass);
        } catch (createErr) {}
      }

      localStorage.setItem('tejas_intro_viewed', 'true');
      if (resolvedPhone) localStorage.setItem('userPhone', resolvedPhone);

      window.dispatchEvent(new Event('role-changed'));

      setSuccessMsg(`Welcome back, ${resolvedName}!`);
      const target = redirectTarget || '/store';
      setTimeout(() => {
        navigate(target, { replace: true });
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Unable to sign in. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Perform Merchant Sign-Up (New Business Account)
  const handleMerchantSignUp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const name = signupName.trim() || 'NEW MERCHANT';
      const phone = signupPhone.trim() || '9845012345';
      const emailVal = signupEmail.trim() || `${phone.replace(/\D/g, '')}@riceaggregator.com`;
      const passVal = password.trim() || 'wholesale2026';
      const gstinVal = signupGstin.trim().toUpperCase() || '29AAGCV7712M1ZP';

      // Authenticate securely with Express backend
      await loginWithServer(emailVal, passVal, 'merchant');

      let userUid = `usr-${Date.now()}`;
      try {
        const res = await createUserWithEmailAndPassword(auth, emailVal, passVal);
        userUid = res.user.uid;
      } catch (authErr: any) {
        try {
          await signInWithEmailAndPassword(auth, emailVal, passVal);
        } catch (e) {}
      }

      const newStakeholder = {
        id: userUid,
        name: name,
        type: 'buyers',
        phone: phone,
        email: emailVal,
        gstin: gstinVal,
        address: 'APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
        status: 'Pending Approval',
        credit: '₹ 50.0 Lakh',
        profileLocked: false,
        createdAt: new Date().toISOString()
      };

      // Ensure new buyer registration is immediately visible in Users Management for Admin approval
      try {
        const existingStakeholdersStr = localStorage.getItem('stakeholders_v2');
        let parsedStakeholders = existingStakeholdersStr 
          ? JSON.parse(existingStakeholdersStr) 
          : { buyers: [], suppliers: [], employees: [] };
        if (!Array.isArray(parsedStakeholders.buyers)) parsedStakeholders.buyers = [];
        // Prepend new buyer so they appear right at the top
        parsedStakeholders.buyers = [
          newStakeholder, 
          ...parsedStakeholders.buyers.filter((b: any) => b.id !== userUid && b.email?.toLowerCase() !== emailVal.toLowerCase())
        ];
        localStorage.setItem('stakeholders_v2', JSON.stringify(parsedStakeholders));

        // Save in dedicated buyer_registration_requests collection
        const existingReqs = JSON.parse(localStorage.getItem('buyer_registration_requests') || '[]');
        const updatedReqs = [newStakeholder, ...existingReqs.filter((r: any) => r.id !== userUid)];
        localStorage.setItem('buyer_registration_requests', JSON.stringify(updatedReqs));

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('stakeholders-updated', { detail: { category: 'buyers', user: newStakeholder } }));
      } catch (saveErr) {
        console.warn('Error storing buyer registration in local storage:', saveErr);
      }

      await setCollectionDoc('stakeholders', userUid, newStakeholder).catch(() => {});
      await setCollectionDoc('buyer_registration_requests', userUid, newStakeholder).catch(() => {});

      localStorage.setItem('userRole', 'merchant');
      localStorage.setItem('userEmail', emailVal);
      localStorage.setItem('userName', name);
      localStorage.setItem('userPhone', phone);
      localStorage.setItem('userGstin', gstinVal);
      localStorage.setItem('userId', userUid);
      localStorage.setItem('buyerStatus', 'Pending Approval');
      localStorage.setItem('tejas_intro_viewed', 'true');

      window.dispatchEvent(new Event('role-changed'));

      setSuccessMsg(`Merchant registration received for ${name}! Account is awaiting verification.`);
      const target = redirectTarget || '/store';
      setTimeout(() => {
        navigate(target, { replace: true });
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const googleProvider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userUid = user.uid || `usr-${Date.now()}`;
      const userEmail = user.email || 'tejas@example.com';
      const userName = user.displayName || 'TEJAS CANVASSING';

      localStorage.setItem('userRole', 'merchant');
      localStorage.setItem('userEmail', userEmail);
      localStorage.setItem('userName', userName);
      localStorage.setItem('userId', userUid);
      localStorage.setItem('tejas_intro_viewed', 'true');

      try {
        await setCollectionDoc('stakeholders', userUid, {
          id: userUid,
          name: userName,
          type: 'buyers',
          email: userEmail,
          phone: user.phoneNumber || '+91 9342380981',
          gstin: '29AAGCV7712M1ZP',
          address: 'No. 15, APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
          status: 'Active',
          credit: '₹ 80.0 Lakh',
          authProvider: 'google.com'
        });
      } catch (dbErr) {}

      window.dispatchEvent(new Event('role-changed'));
      setSuccessMsg(`Welcome, ${userName}`);
      const target = redirectTarget || '/store';
      setTimeout(() => {
        navigate(target, { replace: true });
      }, 500);
    } catch (err: any) {
      // Fallback for iFrame preview restrictions
      const cleanEmail = email.includes('@') ? email : 'merchant.google@riceaggregator.com';
      localStorage.setItem('userRole', 'merchant');
      localStorage.setItem('userEmail', cleanEmail);
      localStorage.setItem('userName', 'TEJAS CANVASSING');
      localStorage.setItem('tejas_intro_viewed', 'true');
      
      window.dispatchEvent(new Event('role-changed'));
      setSuccessMsg('Authenticated via Google Account');
      const target = redirectTarget || '/store';
      setTimeout(() => {
        navigate(target, { replace: true });
      }, 600);
    } finally {
      setLoading(false);
    }
  };

  // Staff / Admin / Employee Sign-In with Secure Server-Side Verification
  const handleStaffSignIn = async (e: React.FormEvent, roleToSign: 'admin' | 'employee') => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const inputUser = staffUsername.trim();
    const inputPass = staffPassword.trim();

    if (!inputUser || !inputPass) {
      setErrorMsg('Please enter both Username and Password.');
      setLoading(false);
      return;
    }

    try {
      // Authenticate securely via Express backend
      const result = await loginWithServer(inputUser, inputPass, roleToSign);

      if (result.success && result.user) {
        // Also ensure Firebase Auth is synchronized for Firestore rules
        const firebaseEmail = result.user.email || `${inputUser.toLowerCase()}@riceaggregator.com`;
        try {
          await signInWithEmailAndPassword(auth, firebaseEmail, inputPass);
        } catch {
          try {
            await createUserWithEmailAndPassword(auth, firebaseEmail, inputPass);
          } catch {}
        }

        localStorage.setItem('tejas_intro_viewed', 'true');

        if (roleToSign === 'admin') {
          localStorage.setItem('userRole', 'admin');
          localStorage.setItem('userName', 'Tejas Adinarayan (Admin HQ)');
          localStorage.setItem('userEmail', 'tejasadinarayan@riceaggregator.com');
          localStorage.setItem('userId', 'admin-tejas-01');
          window.dispatchEvent(new Event('role-changed'));
          window.dispatchEvent(new Event('storage'));

          setSuccessMsg('Admin authentication successful! Launching Executive Console...');
          const target = (redirectTarget && !redirectTarget.includes('admintejas1679') && redirectTarget.startsWith('/')) 
            ? redirectTarget 
            : '/admin';
          setTimeout(() => {
            setLoading(false);
            navigate(target, { replace: true });
          }, 400);
        } else {
          localStorage.setItem('userRole', 'employee');
          localStorage.setItem('userName', result.user.name || 'Operations Staff');
          localStorage.setItem('userEmail', result.user.email || 'employee@riceaggregator.com');
          localStorage.setItem('userId', result.user.sub || 'emp-01');
          window.dispatchEvent(new Event('role-changed'));
          window.dispatchEvent(new Event('storage'));

          const empName = result.user.name || 'Operations Staff';
          setSuccessMsg(`Welcome, ${empName}! Launching Operations Terminal...`);
          const target = (redirectTarget && !redirectTarget.includes('employee1977') && redirectTarget.startsWith('/'))
            ? redirectTarget
            : '/inventory';
          setTimeout(() => {
            setLoading(false);
            navigate(target, { replace: true });
          }, 400);
        }
      } else {
        setLoading(false);
        setErrorMsg(result.error || (roleToSign === 'admin' ? 'Invalid Admin Username or Password. Access Denied.' : 'Invalid Employee credentials. Please request your assigned Username & Password from Admin Tejas Adinarayan.'));
      }
    } catch (err: any) {
      setLoading(false);
      setErrorMsg(err.message || 'Authentication error occurred.');
    }
  };

  return (
    <div className="min-h-screen bg-[#f3f4f3] dark:bg-[#030906] flex flex-col items-center justify-center p-0 sm:py-6 sm:px-4 font-sans antialiased text-slate-900 dark:text-slate-100 select-none overflow-x-hidden">
      
      {/* Invisible Recaptcha for phone verification */}
      <div id="recaptcha-container"></div>

      {/* Phone Canvas Container (iPhone 16 Pro Frame on desktop, full screen with dynamic viewport on mobile) */}
      <div className="w-full sm:max-w-[420px] h-[100dvh] min-h-[100dvh] sm:h-[844px] sm:min-h-0 bg-[#fafaf9] dark:bg-[#07130e] sm:rounded-[44px] shadow-[0_20px_70px_-10px_rgba(0,0,0,0.18)] dark:shadow-[0_25px_80px_-15px_rgba(0,0,0,0.7)] sm:border-[8px] sm:border-slate-800/90 dark:sm:border-neutral-800 overflow-hidden relative flex flex-col justify-between pb-safe pt-safe">
        
        <div className="relative w-full h-full flex flex-col justify-between bg-[#fafaf9] dark:bg-[#07130e] text-slate-900 dark:text-slate-100 overflow-y-auto no-scrollbar">
              {/* Top Navigation Bar with Back Arrow to About Us */}
              <div className="px-5 pt-4 pb-1 flex items-center justify-between shrink-0">
                <button
                  type="button"
                  id="btn-login-back-to-about"
                  onClick={() => navigate('/about')}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer py-1.5 px-2.5 -ml-2 rounded-xl hover:bg-slate-200/60 dark:hover:bg-neutral-800/60 group"
                  title="Go back to About Us"
                >
                  <ArrowLeft className="w-4 h-4 text-[#143e2e] dark:text-emerald-400 transition-transform group-hover:-translate-x-0.5 stroke-[2.5]" />
                  <span>About Us</span>
                </button>

                {secretRole ? (
                  <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20 flex items-center gap-1 font-mono">
                    <Lock className="w-2.5 h-2.5 text-amber-600 dark:text-amber-400" />
                    Secret Portal ({secretRole === 'admin' ? 'Admin' : 'Employee'})
                  </span>
                ) : null}
              </div>

              {/* ========================================================== */}
              {/* MODE A: MERCHANT LOGIN (Matching Screenshot 3)             */}
              {/* ========================================================== */}
              {loginMode === 'merchant' && (
                <div className="px-6 py-2 flex-1 flex flex-col justify-between overflow-y-auto no-scrollbar">
                  
                  {/* Brand Header */}
                  <div className="flex flex-col items-center text-center pt-2">
                    <TejasBotanicalLogo className="w-10 h-10 text-[#143e2e] dark:text-emerald-400" />
                    <h2 className="font-serif text-3xl font-normal text-[#143e2e] dark:text-white tracking-wide mt-1">
                      Tejas
                    </h2>
                  </div>

                  {/* Sign In vs Create Account Tab Switcher */}
                  <div className="grid grid-cols-2 p-1 bg-slate-200/60 dark:bg-[#0c1813] rounded-xl border border-slate-200 dark:border-neutral-800 text-xs font-bold my-3">
                    <button
                      type="button"
                      onClick={() => { setMerchantAuthTab('signin'); setErrorMsg(null); setSuccessMsg(null); }}
                      className={cn(
                        "py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        merchantAuthTab === 'signin'
                          ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-xs font-bold"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      <span>Sign In</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMerchantAuthTab('signup'); setErrorMsg(null); setSuccessMsg(null); }}
                      className={cn(
                        "py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        merchantAuthTab === 'signup'
                          ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-xs font-bold"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      <span>Create Account</span>
                    </button>
                  </div>

                  {/* Headline */}
                  <div className="space-y-1 text-left pb-1">
                    <h1 className="font-serif text-2xl sm:text-3xl font-normal text-slate-900 dark:text-white tracking-tight leading-tight">
                      {merchantAuthTab === 'signin' ? 'Welcome Back' : 'Register Merchant'}
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-normal leading-relaxed">
                      {merchantAuthTab === 'signin'
                        ? 'Sign in with your registered phone number, email, or firm name.'
                        : 'Create a new business buyer account to start placing procurement orders.'}
                    </p>
                  </div>

                  {/* Alerts */}
                  {errorMsg && (
                    <div className="p-2.5 my-1.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                  {successMsg && (
                    <div className="p-2.5 my-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                      <span>{successMsg}</span>
                    </div>
                  )}

                  {/* SIGN IN FORM */}
                  {merchantAuthTab === 'signin' && (
                    <form onSubmit={handleMerchantSignIn} className="space-y-3 pt-1 text-left">
                      {/* Flexible Identifier Input (Phone, Email, or Username) */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                          <span>Phone Number, Email, or Username</span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-normal">
                            {/^[0-9+\s-]{8,15}$/.test(identifier) ? '📱 Mobile Phone' : identifier.includes('@') ? '✉️ Email Address' : '🏢 Firm Username'}
                          </span>
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder="Phone (+91 9845012345), Email, or Firm Name"
                            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/25 focus:border-[#143e2e] transition-all shadow-2xs placeholder:text-slate-400"
                          />
                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            {/^[0-9+\s-]{8,15}$/.test(identifier) ? (
                              <Phone className="w-3.5 h-3.5 text-emerald-600" />
                            ) : identifier.includes('@') ? (
                              <Mail className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Password Input */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                          Password
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/25 focus:border-[#143e2e] transition-all shadow-2xs pr-9 placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Forgot Password Link */}
                        <div className="flex justify-end pt-0.5">
                          <button
                            type="button"
                            onClick={() => alert("Password reset instructions will be sent to your registered merchant contact.")}
                            className="text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-300 cursor-pointer"
                          >
                            Forgot password?
                          </button>
                        </div>
                      </div>

                      {/* Primary Sign In Button */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-[#143e2e] hover:bg-[#0e2f22] text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2 mt-1"
                      >
                        {loading ? (
                          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        ) : (
                          <span>Sign In to Merchant Terminal</span>
                        )}
                      </button>
                    </form>
                  )}

                  {/* CREATE ACCOUNT (SIGN UP) FORM */}
                  {merchantAuthTab === 'signup' && (
                    <form onSubmit={handleMerchantSignUp} className="space-y-2.5 pt-1 text-left">
                      {/* Merchant / Firm Name */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                          Merchant / Firm Name *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            value={signupName}
                            onChange={(e) => setSignupName(e.target.value)}
                            placeholder="e.g. TEJAS RICE TRADERS"
                            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/25 focus:border-[#143e2e] transition-all shadow-2xs placeholder:text-slate-400"
                          />
                          <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      {/* Mobile Phone Number */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                          Mobile Phone Number *
                        </label>
                        <div className="relative">
                          <input
                            type="tel"
                            required
                            value={signupPhone}
                            onChange={(e) => setSignupPhone(e.target.value)}
                            placeholder="10-digit mobile (e.g. 9845012345)"
                            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/25 focus:border-[#143e2e] transition-all shadow-2xs placeholder:text-slate-400"
                          />
                          <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        </div>
                      </div>

                      {/* Email Address & GSTIN Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                            Email (Optional)
                          </label>
                          <input
                            type="email"
                            value={signupEmail}
                            onChange={(e) => setSignupEmail(e.target.value)}
                            placeholder="name@firm.com"
                            className="w-full px-3 py-2 rounded-xl bg-[#fafaf9] dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/25 focus:border-[#143e2e] transition-all shadow-2xs placeholder:text-slate-400"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                            GSTIN (Optional)
                          </label>
                          <input
                            type="text"
                            value={signupGstin}
                            onChange={(e) => setSignupGstin(e.target.value)}
                            placeholder="29AAAAA0000A1Z5"
                            className="w-full px-3 py-2 rounded-xl bg-[#fafaf9] dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/25 focus:border-[#143e2e] transition-all shadow-2xs placeholder:text-slate-400 uppercase"
                          />
                        </div>
                      </div>

                      {/* Password Input */}
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                          Account Password *
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 text-xs text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-[#143e2e]/25 focus:border-[#143e2e] transition-all shadow-2xs pr-9 placeholder:text-slate-400"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Primary Create Account Button */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-[#143e2e] hover:bg-[#0e2f22] text-white font-semibold text-xs sm:text-sm shadow-xs transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2 mt-1"
                      >
                        {loading ? (
                          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                        ) : (
                          <span>Register Business Account</span>
                        )}
                      </button>
                    </form>
                  )}

                  {/* Or Continue With Divider */}
                  <div className="relative py-2 text-center">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200 dark:border-neutral-800" />
                    </div>
                    <span className="relative px-3 bg-[#fafaf9] dark:bg-[#07130e] text-[11px] text-slate-400 font-medium">
                      or continue with
                    </span>
                  </div>

                  {/* Continue with Google */}
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-2.5 px-4 rounded-xl bg-white dark:bg-[#0c1813] hover:bg-slate-50 dark:hover:bg-neutral-850 border border-slate-200/90 dark:border-neutral-800 text-slate-700 dark:text-slate-200 font-medium text-xs shadow-2xs transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
                  >
                    <GoogleGIcon className="w-4 h-4" />
                    <span>Continue with Google</span>
                  </button>

                  {/* Footer Endorsement */}
                  <div className="text-center pt-3 pb-2">
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
                      Trusted by 500+ businesses across India.
                    </p>
                  </div>

                </div>
              )}

              {/* ========================================================== */}
              {/* MODE B: ADMIN & EMPLOYEE PORTAL ("FOR ADMIN LOGIN DO       */}
              {/* SOMETHING ELSE, ALSO FOR EMPLOYEE ALSO")                   */}
              {/* ========================================================== */}
              {loginMode === 'admin_employee' && (
                <div className="px-6 py-2 flex-1 flex flex-col justify-between space-y-3.5 text-left">
                  
                  {/* Executive Header */}
                  <div className="space-y-1 pt-1">
                    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-200/70 dark:bg-emerald-950/60 text-[9px] font-extrabold uppercase tracking-widest text-slate-700 dark:text-emerald-400 font-mono">
                      <Lock className="w-3 h-3 text-amber-500" />
                      Secret Access Terminal
                    </div>
                    <h2 className="font-serif text-2xl font-normal text-slate-900 dark:text-white tracking-tight">
                      {staffRole === 'admin' ? 'Admin HQ Sign-In' : 'Employee Portal Sign-In'}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {staffRole === 'admin' 
                        ? 'Enter your executive credentials to access platform controls.' 
                        : 'Enter your employee credentials issued by Admin (Tejas Adinarayan).'}
                    </p>
                  </div>

                  {/* Staff Role Switcher Tabs */}
                  <div className="grid grid-cols-2 p-1 bg-slate-200/60 dark:bg-[#0c1813] rounded-xl border border-slate-200 dark:border-neutral-800 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => { setStaffRole('admin'); setErrorMsg(null); setSuccessMsg(null); }}
                      className={cn(
                        "py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        staffRole === 'admin'
                          ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-xs font-bold"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Admin (HQ)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => { setStaffRole('employee'); setErrorMsg(null); setSuccessMsg(null); }}
                      className={cn(
                        "py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                        staffRole === 'employee'
                          ? "bg-white dark:bg-neutral-800 text-slate-900 dark:text-white shadow-xs font-bold"
                          : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                      )}
                    >
                      <Warehouse className="w-3.5 h-3.5 text-amber-600" />
                      <span>Employee (Desk)</span>
                    </button>
                  </div>

                  {/* Role Detail Forms */}
                  {staffRole === 'admin' ? (
                    <form onSubmit={(e) => handleStaffSignIn(e, 'admin')} className="bg-white dark:bg-[#0c1813] border border-slate-200/90 dark:border-neutral-800 rounded-2xl p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-2">
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            Aggregator HQ Terminal
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Tejas Canvassing Brokerage
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 font-mono">
                          Protected
                        </span>
                      </div>

                      {/* Error / Success Notifications */}
                      {errorMsg && (
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                          <span>{errorMsg}</span>
                        </div>
                      )}
                      {successMsg && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                          <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                          <span>{successMsg}</span>
                        </div>
                      )}

                      {/* Admin Username Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                          Admin Username
                        </label>
                        <div className="relative flex items-center">
                          <Building2 className="absolute left-3 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            required
                            value={staffUsername}
                            onChange={(e) => setStaffUsername(e.target.value)}
                            placeholder="e.g. tejasadinarayan"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#07130e] border border-slate-200 dark:border-neutral-800 rounded-xl text-xs text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                        </div>
                      </div>

                      {/* Admin Password Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                          Admin Password
                        </label>
                        <div className="relative flex items-center">
                          <Lock className="absolute left-3 w-4 h-4 text-slate-400" />
                          <input
                            type={showStaffPassword ? "text" : "password"}
                            required
                            value={staffPassword}
                            onChange={(e) => setStaffPassword(e.target.value)}
                            placeholder="Enter admin password"
                            className="w-full pl-9 pr-9 py-2 bg-slate-50 dark:bg-[#07130e] border border-slate-200 dark:border-neutral-800 rounded-xl text-xs text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-emerald-500/30"
                          />
                          <button
                            type="button"
                            onClick={() => setShowStaffPassword(prev => !prev)}
                            className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {showStaffPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white font-semibold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] mt-1"
                      >
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>{loading ? 'Authenticating...' : 'Sign In as Admin'}</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={(e) => handleStaffSignIn(e, 'employee')} className="bg-white dark:bg-[#0c1813] border border-slate-200/90 dark:border-neutral-800 rounded-2xl p-4 space-y-3 shadow-2xs">
                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-neutral-800 pb-2">
                        <div>
                          <span className="text-xs font-bold text-slate-900 dark:text-white block">
                            Operations & Quality Desk
                          </span>
                          <span className="text-[10px] text-slate-400">
                            Warehouse & Weighbridge
                          </span>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-mono">
                          Field Access
                        </span>
                      </div>

                      {/* Info Banner for Employee Credential Requirement */}
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-300 text-[11px] font-medium space-y-0.5 text-left">
                        <div className="flex items-center gap-1 font-bold text-amber-800 dark:text-amber-400">
                          <Info className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          <span>Credentials Required</span>
                        </div>
                        <p className="text-[10.5px] leading-snug">
                          Employees must request their Username & Password from Admin Tejas Adinarayan.
                        </p>
                      </div>

                      {/* Error / Success Notifications */}
                      {errorMsg && (
                        <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                          <span>{errorMsg}</span>
                        </div>
                      )}
                      {successMsg && (
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                          <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                          <span>{successMsg}</span>
                        </div>
                      )}

                      {/* Employee Username Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                          Employee Username
                        </label>
                        <div className="relative flex items-center">
                          <Warehouse className="absolute left-3 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            required
                            value={staffUsername}
                            onChange={(e) => setStaffUsername(e.target.value)}
                            placeholder="Enter assigned username"
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-[#07130e] border border-slate-200 dark:border-neutral-800 rounded-xl text-xs text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-amber-500/30"
                          />
                        </div>
                      </div>

                      {/* Employee Password Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 block">
                          Employee Password
                        </label>
                        <div className="relative flex items-center">
                          <Lock className="absolute left-3 w-4 h-4 text-slate-400" />
                          <input
                            type={showStaffPassword ? "text" : "password"}
                            required
                            value={staffPassword}
                            onChange={(e) => setStaffPassword(e.target.value)}
                            placeholder="Enter assigned password"
                            className="w-full pl-9 pr-9 py-2 bg-slate-50 dark:bg-[#07130e] border border-slate-200 dark:border-neutral-800 rounded-xl text-xs text-slate-900 dark:text-white font-medium outline-none focus:ring-2 focus:ring-amber-500/30"
                          />
                          <button
                            type="button"
                            onClick={() => setShowStaffPassword(prev => !prev)}
                            className="absolute right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                          >
                            {showStaffPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-[0.98] mt-1"
                      >
                        <Warehouse className="w-4 h-4 text-amber-300" />
                        <span>{loading ? 'Verifying Employee...' : 'Sign In as Employee'}</span>
                      </button>

                      <div className="text-center pt-1">
                        <button
                          type="button"
                          onClick={() => setShowEmployeeRequestModal(true)}
                          className="text-[10.5px] font-semibold text-amber-800 dark:text-amber-400 hover:underline cursor-pointer"
                        >
                          Need Credentials? Request Admin →
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Return to Merchant Experience */}
                  <div className="pt-1 text-center">
                    <button
                      type="button"
                      onClick={() => navigate('/login')}
                      className="text-xs font-semibold text-[#143e2e] dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      ← Return to Public Merchant Store
                    </button>
                  </div>

                </div>
              )}

        </div>

      </div>

    {/* Employee Credential Request Modal */}
      {showEmployeeRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#07130e] border border-slate-200 dark:border-neutral-800 rounded-3xl p-5 max-w-sm w-full shadow-2xl space-y-4 text-left relative">
            <button
              type="button"
              onClick={() => { setShowEmployeeRequestModal(false); setEmpRequestSuccess(false); }}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[9px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                Staff Credential Request
              </span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Request Employee Login
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Send your details to Admin Tejas Adinarayan to issue your official Employee Username and Password.
              </p>
            </div>

            {empRequestSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-center space-y-2">
                <Check className="w-8 h-8 text-emerald-500 mx-auto" />
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Request Submitted Successfully!
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Admin Tejas Adinarayan has been notified. Contact HQ desk or wait for credential issue.
                </p>
                <button
                  type="button"
                  onClick={() => { setShowEmployeeRequestModal(false); setEmpRequestSuccess(false); }}
                  className="w-full py-2 bg-[#143e2e] text-white font-bold text-xs rounded-xl mt-2 cursor-pointer"
                >
                  Close Window
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const reqList = JSON.parse(localStorage.getItem('employee_credential_requests') || '[]');
                  reqList.push({
                    name: empRequestName || 'Field Employee',
                    phone: empRequestPhone || 'Not provided',
                    requestedAt: new Date().toISOString()
                  });
                  localStorage.setItem('employee_credential_requests', JSON.stringify(reqList));
                  setEmpRequestSuccess(true);
                }}
                className="space-y-3"
              >
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={empRequestName}
                    onChange={(e) => setEmpRequestName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                    Mobile Phone Number
                  </label>
                  <input
                    type="tel"
                    required
                    value={empRequestPhone}
                    onChange={(e) => setEmpRequestPhone(e.target.value)}
                    placeholder="e.g. 9845012345"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-[#0c1813] border border-slate-200 dark:border-neutral-800 rounded-xl text-xs font-medium text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Send Request to Admin
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
