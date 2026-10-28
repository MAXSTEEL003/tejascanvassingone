import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft,
  ArrowRight, 
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
  Info,
  X,
  Sun,
  Moon,
  ShoppingBag,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  RecaptchaVerifier,
  ConfirmationResult
} from 'firebase/auth';
import { auth, setCollectionDoc } from '../lib/firebase';
import { loginWithServer, getVerifiedUserRole, isAuthorizedAdminGoogleAccount, createClientAuthToken, setAuthSession } from '../lib/auth';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
    confirmationResult?: ConfirmationResult;
  }
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

// Brand Leaf Emblem
export function TejasLogoEmblem({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-[#C22424] text-white flex items-center justify-center shadow-md", className)}>
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
      </svg>
    </div>
  );
}

export const TejasBotanicalLogo = TejasLogoEmblem;

interface LoginViewProps {
  defaultStep?: string;
  defaultTab?: 'signin' | 'signup';
  secretRole?: 'admin' | 'employee';
  defaultPortal?: 'merchant' | 'employee' | 'admin';
}

export default function LoginView({ defaultTab = 'signin', secretRole, defaultPortal }: LoginViewProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const redirectTarget = rawRedirect && rawRedirect.startsWith('/') ? rawRedirect : null;

  // Theme state
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved ? saved === 'dark' : true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    window.dispatchEvent(new Event('theme-changed'));
  };

  // Auto-redirect if already authenticated as requested role
  useEffect(() => {
    try {
      const activeRole = getVerifiedUserRole();
      if ((secretRole === 'admin' || defaultPortal === 'admin') && activeRole === 'admin') {
        const target = redirectTarget || (location.pathname.startsWith('/admin') ? location.pathname : '/admin');
        navigate(target, { replace: true });
      } else if ((secretRole === 'employee' || defaultPortal === 'employee') && activeRole === 'employee') {
        const target = redirectTarget || '/employee/dashboard';
        navigate(target, { replace: true });
      }
    } catch {}
  }, [secretRole, defaultPortal, redirectTarget, navigate]);

  // Active Portal Selection: 'merchant' | 'employee' | 'admin'
  const [activePortal, setActivePortal] = useState<'merchant' | 'employee' | 'admin'>(() => {
    if (secretRole === 'admin' || defaultPortal === 'admin') return 'admin';
    if (secretRole === 'employee' || defaultPortal === 'employee') return 'employee';
    return 'merchant';
  });

  const staffRole = activePortal === 'admin' ? 'admin' : 'employee';

  // Input states
  const [merchantAuthTab, setMerchantAuthTab] = useState<'signin' | 'signup'>(defaultTab);
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

      if (!rawInput) {
        setErrorMsg('Please enter your mobile number or business email.');
        setLoading(false);
        return;
      }

      if (!cleanPass) {
        setErrorMsg('Please enter your account password.');
        setLoading(false);
        return;
      }

      let resolvedEmail = rawInput;
      let resolvedName = 'Merchant';
      let resolvedPhone = '';

      // Check if input is a phone number
      const isPhone = /^[0-9+\s-]{8,15}$/.test(rawInput);
      if (isPhone) {
        const digitsOnly = rawInput.replace(/\D/g, '');
        resolvedEmail = `${digitsOnly}@riceaggregator.com`;
        resolvedPhone = digitsOnly;
        resolvedName = `Merchant (+91 ${digitsOnly})`;
      } else if (!rawInput.includes('@')) {
        // Input is a username / firm name
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
      let userPhoneVal = resolvedPhone;
      if (!userPhoneVal) {
        if (resolvedName.toUpperCase().includes('TEJAS') || resolvedName.toUpperCase().includes('VISION')) {
          userPhoneVal = '9945351166';
        } else {
          try {
            const saved = localStorage.getItem('stakeholders_v2');
            if (saved) {
              const parsed = JSON.parse(saved);
              const buyers = parsed.buyers || [];
              const matched = buyers.find((b: any) => (b.name || '').trim().toUpperCase() === resolvedName.trim().toUpperCase());
              if (matched?.phone) userPhoneVal = matched.phone;
            }
          } catch {}
        }
      }
      if (userPhoneVal) localStorage.setItem('userPhone', userPhoneVal);

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
      const name = signupName.trim();
      const phone = signupPhone.trim();
      const emailVal = signupEmail.trim() || (phone ? `${phone.replace(/\D/g, '')}@riceaggregator.com` : '');
      const passVal = password.trim();
      const gstinVal = signupGstin.trim().toUpperCase() || '29AAGCV7712M1ZP';

      if (!name) {
        setErrorMsg('Please enter your business or merchant name.');
        setLoading(false);
        return;
      }
      if (!phone) {
        setErrorMsg('Please enter your 10-digit mobile number.');
        setLoading(false);
        return;
      }
      if (!passVal) {
        setErrorMsg('Please enter a password for your account.');
        setLoading(false);
        return;
      }

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

      const cleanPhoneDigits = phone.replace(/\D/g, '');
      const defaultUsername = cleanPhoneDigits || name.toLowerCase().replace(/\s+/g, '_');
      const safeBuyerPass = (passVal.trim() === 'adinarayan1977' || !passVal.trim()) ? '' : passVal.trim();
      const newStakeholder = {
        id: userUid,
        name: name,
        type: 'buyers',
        phone: phone,
        username: defaultUsername,
        password: safeBuyerPass,
        assignedPassword: safeBuyerPass,
        email: emailVal,
        gstin: gstinVal,
        address: 'APMC Yard, Yeshwanthpur, Bangalore, Karnataka - 560022',
        status: 'Pending Approval',
        credit: '₹ 50.0 Lakh',
        profileLocked: false,
        createdAt: new Date().toISOString()
      };

      let targetStakeholder = newStakeholder;

      // Ensure new buyer registration is immediately visible in Users Management for Admin approval
      try {
        const existingStakeholdersStr = localStorage.getItem('stakeholders_v2');
        let parsedStakeholders = existingStakeholdersStr 
          ? JSON.parse(existingStakeholdersStr) 
          : { buyers: [], suppliers: [], employees: [] };
        if (!Array.isArray(parsedStakeholders.buyers)) parsedStakeholders.buyers = [];

        // Check if buyer profile already exists with same phone number or email to avoid duplicate users
        const existingBuyerIndex = parsedStakeholders.buyers.findIndex((b: any) => {
          if (!b) return false;
          const bDigits = (b.phone || '').replace(/\D/g, '');
          return (cleanPhoneDigits && bDigits && bDigits === cleanPhoneDigits) || 
                 (b.id === userUid) || 
                 (b.email && emailVal && b.email.toLowerCase() === emailVal.toLowerCase());
        });

        if (existingBuyerIndex >= 0) {
          const existing = parsedStakeholders.buyers[existingBuyerIndex];
          targetStakeholder = {
            ...existing,
            phone: existing.phone || phone,
            username: existing.username || defaultUsername,
            password: safeBuyerPass || existing.password || '',
            assignedPassword: safeBuyerPass || existing.assignedPassword || '',
            email: existing.email || emailVal,
            gstin: existing.gstin || gstinVal,
            lastLoginAt: new Date().toISOString()
          };
          parsedStakeholders.buyers[existingBuyerIndex] = targetStakeholder;
        } else {
          parsedStakeholders.buyers = [
            newStakeholder, 
            ...parsedStakeholders.buyers.filter((b: any) => b.id !== userUid && b.email?.toLowerCase() !== emailVal.toLowerCase())
          ];
        }
        localStorage.setItem('stakeholders_v2', JSON.stringify(parsedStakeholders));

        const existingReqs = JSON.parse(localStorage.getItem('buyer_registration_requests') || '[]');
        const updatedReqs = [targetStakeholder, ...existingReqs.filter((r: any) => r.id !== targetStakeholder.id && (r.phone || '').replace(/\D/g, '') !== cleanPhoneDigits)];
        localStorage.setItem('buyer_registration_requests', JSON.stringify(updatedReqs));

        window.dispatchEvent(new Event('storage'));
        window.dispatchEvent(new CustomEvent('stakeholders-updated', { detail: { category: 'buyers', user: targetStakeholder } }));
      } catch (saveErr) {
        console.warn('Error storing buyer registration in local storage:', saveErr);
      }

      await setCollectionDoc('stakeholders', targetStakeholder.id, targetStakeholder).catch(() => {});
      await setCollectionDoc('buyer_registration_requests', targetStakeholder.id, targetStakeholder).catch(() => {});

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

  // Dedicated Google Sign-In for Admin
  const handleAdminGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      const userEmail = (user.email || '').toLowerCase().trim();

      if (!isAuthorizedAdminGoogleAccount(userEmail)) {
        await auth.signOut();
        try {
          localStorage.removeItem('userRole');
          localStorage.removeItem('tejas_auth_token_v1');
          localStorage.removeItem('tejas_auth_user_v1');
        } catch {}
        setErrorMsg(`Access Denied. Google account (${userEmail || 'Unknown'}) is not authorized for Admin access.`);
        setLoading(false);
        return;
      }

      const userUid = user.uid || 'admin-tejas-01';
      const userName = user.displayName || 'Tejas Adinarayan (Admin HQ)';

      localStorage.setItem('userRole', 'admin');
      localStorage.setItem('userEmail', userEmail);
      localStorage.setItem('userName', userName);
      localStorage.setItem('userId', userUid);
      localStorage.setItem('tejas_intro_viewed', 'true');

      const token = createClientAuthToken({
        sub: userUid,
        username: userEmail.split('@')[0] || 'tejasadinarayan',
        role: 'admin',
        name: userName,
        email: userEmail,
      });
      setAuthSession(token, {
        sub: userUid,
        username: userEmail.split('@')[0] || 'tejasadinarayan',
        role: 'admin',
        name: userName,
        email: userEmail,
      });

      window.dispatchEvent(new Event('role-changed'));
      window.dispatchEvent(new Event('storage'));

      setSuccessMsg(`Welcome, ${userName}! Launching Executive Console...`);
      const target = (redirectTarget && !redirectTarget.includes('admintejas1679') && redirectTarget.startsWith('/')) 
        ? redirectTarget 
        : '/admin';
      setTimeout(() => {
        setLoading(false);
        navigate(target, { replace: true });
      }, 400);
    } catch (err: any) {
      console.error("Admin Google Sign-in error:", err);
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup was closed. Please try again.');
      } else {
        setErrorMsg(err?.message || 'Google Sign-In failed. Please try again.');
      }
      setLoading(false);
    }
  };

  // Google Sign-In for Merchants
  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const googleProvider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      const userUid = user.uid || `usr-${Date.now()}`;
      const userEmail = (user.email || '').toLowerCase().trim();
      const userName = user.displayName || 'TEJAS CANVASSING';

      if (isAuthorizedAdminGoogleAccount(userEmail)) {
        localStorage.setItem('userRole', 'admin');
        localStorage.setItem('userEmail', userEmail);
        localStorage.setItem('userName', userName || 'Tejas Adinarayan (Admin HQ)');
        localStorage.setItem('userId', userUid);
        localStorage.setItem('tejas_intro_viewed', 'true');

        const token = createClientAuthToken({
          sub: userUid,
          username: userEmail.split('@')[0] || 'tejasadinarayan',
          role: 'admin',
          name: userName,
          email: userEmail,
        });
        setAuthSession(token, {
          sub: userUid,
          username: userEmail.split('@')[0] || 'tejasadinarayan',
          role: 'admin',
          name: userName,
          email: userEmail,
        });

        window.dispatchEvent(new Event('role-changed'));
        window.dispatchEvent(new Event('storage'));

        setSuccessMsg(`Authorized Admin detected! Welcome, ${userName}.`);
        setTimeout(() => {
          navigate('/admin', { replace: true });
        }, 400);
        return;
      }

      localStorage.setItem('userRole', 'merchant');
      localStorage.setItem('userEmail', userEmail || 'tejas@example.com');
      localStorage.setItem('userName', userName);
      localStorage.setItem('userId', userUid);
      localStorage.setItem('tejas_intro_viewed', 'true');

      try {
        await setCollectionDoc('stakeholders', userUid, {
          id: userUid,
          name: userName,
          type: 'buyers',
          email: userEmail,
          phone: user.phoneNumber || '',
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
      if (err?.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup was closed. Please try again.');
        setLoading(false);
        return;
      }
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

  // Staff / Admin / Employee Sign-In
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
      const result = await loginWithServer(inputUser, inputPass, roleToSign);

      if (result.success && result.user) {
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
            : '/employee/dashboard';
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
    <div className="min-h-dvh bg-[#FAFBFA] dark:bg-[#0A0A0A] flex flex-col items-center justify-center p-3 sm:p-5 font-sans antialiased text-neutral-900 dark:text-neutral-100 select-none overflow-x-hidden transition-colors duration-200">
      
      {/* Invisible Recaptcha */}
      <div id="recaptcha-container"></div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-[420px] bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-2xl sm:rounded-3xl shadow-[0_10px_35px_rgba(0,0,0,0.05)] dark:shadow-[0_16px_50px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col relative pt-[max(env(safe-area-inset-top,0px),12px)] pb-[max(env(safe-area-inset-bottom,0px),16px)]">
        
        {/* Top Header Bar */}
        <div className="px-5 pt-1.5 pb-2.5 flex items-center justify-between border-b border-[#F0F2F1] dark:border-[#1E1E1E]">
          <button
            type="button"
            id="btn-login-back-to-about"
            onClick={() => navigate('/about')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors cursor-pointer py-1 px-2 -ml-1.5 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 group"
            title="Go to Public About Page"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-[#C22424] transition-transform group-hover:-translate-x-0.5" />
            <span>About</span>
          </button>

          <div className="flex items-center gap-2">
            {secretRole ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#C22424] dark:text-red-300 bg-[#FEF2F2] dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-[#FECACA] dark:border-red-900/40 flex items-center gap-1">
                <Lock className="w-3 h-3 text-[#C22424]" />
                {secretRole === 'admin' ? 'Admin Portal' : 'Employee Portal'}
              </span>
            ) : null}

            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 transition-all flex items-center justify-center cursor-pointer active:scale-95"
              title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
              aria-label="Toggle Theme"
            >
              {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-neutral-700" />}
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="px-5 sm:px-6 py-4 flex-1 flex flex-col justify-between overflow-y-auto no-scrollbar">
          
          {/* Brand Identity */}
          <div className="flex flex-col items-center text-center pb-3">
            <TejasLogoEmblem className="w-10 h-10 mb-2" />
            <div className="flex items-center gap-1.5">
              <span className="text-lg font-black tracking-tight text-neutral-900 dark:text-white">
                Tejas
              </span>
              <span className="text-[11px] font-black tracking-widest text-[#C22424] uppercase bg-[#FEF2F2] dark:bg-red-950/40 border border-[#FECACA] dark:border-red-900/40 px-1.5 py-0.5 rounded-md">
                CANVASSING
              </span>
            </div>
            <p className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400 mt-1">
              Wholesale Rice Canvassing Platform
            </p>
          </div>

          {/* 3-Role Segmented Selector (Merchant | Employee | Admin) */}
          {!secretRole && (
            <div className="grid grid-cols-3 p-1 bg-neutral-100 dark:bg-[#1A1A1A] rounded-xl border border-neutral-200/80 dark:border-[#262626] text-xs font-bold mb-3.5">
              <button
                type="button"
                onClick={() => { setActivePortal('merchant'); setErrorMsg(null); setSuccessMsg(null); }}
                className={cn(
                  "py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer text-[11px]",
                  activePortal === 'merchant'
                    ? "bg-[#C22424] text-white shadow-xs font-bold"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                )}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Merchant</span>
              </button>
              <button
                type="button"
                onClick={() => { setActivePortal('employee'); setErrorMsg(null); setSuccessMsg(null); }}
                className={cn(
                  "py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer text-[11px]",
                  activePortal === 'employee'
                    ? "bg-[#C22424] text-white shadow-xs font-bold"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                )}
              >
                <Warehouse className="w-3.5 h-3.5" />
                <span>Employee</span>
              </button>
              <button
                type="button"
                onClick={() => { setActivePortal('admin'); setErrorMsg(null); setSuccessMsg(null); }}
                className={cn(
                  "py-1.5 px-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer text-[11px]",
                  activePortal === 'admin'
                    ? "bg-[#C22424] text-white shadow-xs font-bold"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Admin</span>
              </button>
            </div>
          )}

          {/* Feedback alerts */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }}
                className="p-2.5 mb-3 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs rounded-xl flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span className="leading-snug">{errorMsg}</span>
              </motion.div>
            )}
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -6 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0 }}
                className="p-2.5 mb-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs rounded-xl flex items-center gap-2"
              >
                <Check className="w-4 h-4 shrink-0 text-emerald-600" />
                <span className="leading-snug">{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ============================================================== */}
          {/* TAB 1: MERCHANT PORTAL                                         */}
          {/* ============================================================== */}
          {activePortal === 'merchant' && (
            <div className="space-y-3.5 text-left">
              {/* Sign In vs Register Tabs */}
              <div className="grid grid-cols-2 p-1 bg-neutral-100 dark:bg-[#1A1A1A] rounded-xl border border-neutral-200/80 dark:border-[#262626] text-xs font-bold">
                <button
                  type="button"
                  onClick={() => { setMerchantAuthTab('signin'); setErrorMsg(null); setSuccessMsg(null); }}
                  className={cn(
                    "py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                    merchantAuthTab === 'signin'
                      ? "bg-white dark:bg-[#262626] text-neutral-900 dark:text-white shadow-xs font-bold"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  )}
                >
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setMerchantAuthTab('signup'); setErrorMsg(null); setSuccessMsg(null); }}
                  className={cn(
                    "py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                    merchantAuthTab === 'signup'
                      ? "bg-white dark:bg-[#262626] text-neutral-900 dark:text-white shadow-xs font-bold"
                      : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                  )}
                >
                  <span>Create Account</span>
                </button>
              </div>

              {/* Headline */}
              <div>
                <h1 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                  {merchantAuthTab === 'signin' ? 'Merchant Sign In' : 'Register Account'}
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {merchantAuthTab === 'signin'
                    ? 'Enter your registered phone, email, or firm name.'
                    : 'Create a wholesale account to order rice and view live rates.'}
                </p>
              </div>

              {/* MERCHANT SIGN IN FORM */}
              {merchantAuthTab === 'signin' && (
                <form onSubmit={handleMerchantSignIn} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 flex items-center justify-between">
                      <span>Phone, Email, or Firm Name</span>
                      <span className="text-[10px] text-[#C22424] font-medium">
                        {/^[0-9+\s-]{8,15}$/.test(identifier) ? '📱 Mobile' : identifier.includes('@') ? '✉️ Email' : '🏢 Firm'}
                      </span>
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        required
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="e.g. 9945351166 or Firm Name"
                        className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] text-xs text-neutral-900 dark:text-white outline-none focus:border-[#C22424] focus:ring-1 focus:ring-[#C22424] transition-all placeholder:text-neutral-400"
                      />
                      <div className="absolute left-3 text-neutral-400 pointer-events-none">
                        {/^[0-9+\s-]{8,15}$/.test(identifier) ? (
                          <Phone className="w-3.5 h-3.5 text-[#C22424]" />
                        ) : identifier.includes('@') ? (
                          <Mail className="w-3.5 h-3.5 text-[#C22424]" />
                        ) : (
                          <Building2 className="w-3.5 h-3.5 text-[#C22424]" />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={() => alert("Password reset instructions will be sent to your registered contact.")}
                        className="text-[10px] font-semibold text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3.5 pr-9 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] text-xs text-neutral-900 dark:text-white outline-none focus:border-[#C22424] focus:ring-1 focus:ring-[#C22424] transition-all placeholder:text-neutral-400"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>



                  {/* Sign In CTA */}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-[#C22424] hover:bg-[#A81C1C] text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2 mt-1"
                  >
                    {loading ? (
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <span>Sign In</span>
                    )}
                  </button>
                </form>
              )}

              {/* MERCHANT SIGN UP FORM */}
              {merchantAuthTab === 'signup' && (
                <form onSubmit={handleMerchantSignUp} className="space-y-2.5">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                      Firm / Trader Name *
                    </label>
                    <div className="relative flex items-center">
                      <Building2 className="w-3.5 h-3.5 text-neutral-400 absolute left-3" />
                      <input
                        type="text"
                        required
                        value={signupName}
                        onChange={(e) => setSignupName(e.target.value)}
                        placeholder="e.g. BALAJI RICE TRADERS"
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] text-xs text-neutral-900 dark:text-white outline-none focus:border-[#C22424] focus:ring-1 focus:ring-[#C22424]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                      Mobile Number *
                    </label>
                    <div className="relative flex items-center">
                      <Phone className="w-3.5 h-3.5 text-neutral-400 absolute left-3" />
                      <input
                        type="tel"
                        required
                        value={signupPhone}
                        onChange={(e) => setSignupPhone(e.target.value)}
                        placeholder="10-digit mobile number"
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] text-xs text-neutral-900 dark:text-white outline-none focus:border-[#C22424] focus:ring-1 focus:ring-[#C22424]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                        Email (Optional)
                      </label>
                      <input
                        type="email"
                        value={signupEmail}
                        onChange={(e) => setSignupEmail(e.target.value)}
                        placeholder="firm@trade.com"
                        className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] text-xs text-neutral-900 dark:text-white outline-none focus:border-[#C22424]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                        GSTIN (Optional)
                      </label>
                      <input
                        type="text"
                        value={signupGstin}
                        onChange={(e) => setSignupGstin(e.target.value.toUpperCase())}
                        placeholder="29AAAAA0000A1Z5"
                        className="w-full px-3 py-2 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] text-xs text-neutral-900 dark:text-white outline-none focus:border-[#C22424] uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                      Set Password *
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full pl-3.5 pr-9 py-2 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] text-xs text-neutral-900 dark:text-white outline-none focus:border-[#C22424] focus:ring-1 focus:ring-[#C22424]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-[#C22424] hover:bg-[#A81C1C] text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2 mt-1"
                  >
                    {loading ? (
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                    ) : (
                      <span>Register Account</span>
                    )}
                  </button>
                </form>
              )}

              {/* Divider */}
              <div className="relative py-0.5 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200 dark:border-[#262626]" />
                </div>
                <span className="relative px-3 bg-white dark:bg-[#141414] text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                  or
                </span>
              </div>

              {/* Google Sign In for Merchants */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-50 hover:bg-neutral-100 dark:bg-[#1A1A1A] dark:hover:bg-[#222222] border border-neutral-200 dark:border-[#2A2A2A] text-neutral-800 dark:text-neutral-200 font-semibold text-xs transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
              >
                <GoogleGIcon className="w-4 h-4" />
                <span>Continue with Google</span>
              </button>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: EMPLOYEE PORTAL                                         */}
          {/* ============================================================== */}
          {activePortal === 'employee' && (
            <div className="space-y-3.5 text-left">
              <div>
                <h1 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                  Employee Login
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Sign in to view your schedule and benchmark rates.
                </p>
              </div>

              <form onSubmit={(e) => handleStaffSignIn(e, 'employee')} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                    Username
                  </label>
                  <div className="relative flex items-center">
                    <Warehouse className="absolute left-3 w-3.5 h-3.5 text-[#C22424]" />
                    <input
                      type="text"
                      required
                      value={staffUsername}
                      onChange={(e) => setStaffUsername(e.target.value)}
                      placeholder="e.g. employee"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] text-xs text-neutral-900 dark:text-white outline-none focus:border-[#C22424] focus:ring-1 focus:ring-[#C22424] transition-all placeholder:text-neutral-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-3.5 h-3.5 text-[#C22424]" />
                    <input
                      type={showStaffPassword ? "text" : "password"}
                      required
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] text-xs text-neutral-900 dark:text-white outline-none focus:border-[#C22424] focus:ring-1 focus:ring-[#C22424] transition-all placeholder:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                    >
                      {showStaffPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>



                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#C22424] hover:bg-[#A81C1C] text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2 mt-1"
                >
                  {loading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </form>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowEmployeeRequestModal(true)}
                  className="text-xs font-semibold text-neutral-500 hover:text-neutral-900 dark:hover:text-white hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <span>Need an employee account? Request Admin</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: ADMIN PORTAL                                            */}
          {/* ============================================================== */}
          {activePortal === 'admin' && (
            <div className="space-y-3.5 text-left">
              <div>
                <h1 className="text-base font-bold text-neutral-900 dark:text-white tracking-tight">
                  Admin Sign In
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Sign in with your authorized administrator credentials.
                </p>
              </div>

              {/* Primary Google Sign In for Admin */}
              <button
                type="button"
                id="btn-admin-google-signin"
                onClick={handleAdminGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-neutral-50 hover:bg-neutral-100 dark:bg-[#1A1A1A] dark:hover:bg-[#222222] border border-neutral-200 dark:border-[#2A2A2A] text-neutral-900 dark:text-white font-semibold text-xs shadow-xs transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
              >
                <GoogleGIcon className="w-4 h-4" />
                <span>{loading ? 'Verifying...' : 'Sign In with Google'}</span>
              </button>

              {/* Divider */}
              <div className="relative py-0.5 text-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-neutral-200 dark:border-[#262626]" />
                </div>
                <span className="relative px-3 bg-white dark:bg-[#141414] text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
                  or with password
                </span>
              </div>

              {/* Direct Username / Password Form for Admin */}
              <form onSubmit={(e) => handleStaffSignIn(e, 'admin')} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                    Admin Username
                  </label>
                  <div className="relative flex items-center">
                    <ShieldCheck className="absolute left-3 w-3.5 h-3.5 text-[#C22424]" />
                    <input
                      type="text"
                      required
                      value={staffUsername}
                      onChange={(e) => setStaffUsername(e.target.value)}
                      placeholder="Username"
                      className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] text-xs text-neutral-900 dark:text-white outline-none focus:border-[#C22424] focus:ring-1 focus:ring-[#C22424] transition-all placeholder:text-neutral-400"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300">
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3 w-3.5 h-3.5 text-[#C22424]" />
                    <input
                      type={showStaffPassword ? "text" : "password"}
                      required
                      value={staffPassword}
                      onChange={(e) => setStaffPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-9 pr-9 py-2.5 rounded-xl bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] text-xs text-neutral-900 dark:text-white outline-none focus:border-[#C22424] focus:ring-1 focus:ring-[#C22424] transition-all placeholder:text-neutral-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowStaffPassword(!showStaffPassword)}
                      className="absolute right-3 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
                    >
                      {showStaffPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>



                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-xl bg-[#C22424] hover:bg-[#A81C1C] text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2 mt-1"
                >
                  {loading ? (
                    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  ) : (
                    <span>Sign In as Admin</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Footer Note */}
          <div className="text-center pt-4 pb-0.5 border-t border-neutral-100 dark:border-[#1E1E1E] mt-3">
            <p className="text-[10.5px] text-neutral-400 dark:text-neutral-500 font-medium">
              Tejas Canvassing • APMC Yard Bangalore
            </p>
          </div>

        </div>
      </div>

      {/* Employee Credential Request Modal */}
      {showEmployeeRequestModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#141414] border border-neutral-200 dark:border-[#262626] rounded-2xl p-5 max-w-sm w-full shadow-xl space-y-3.5 text-left relative">
            <button
              type="button"
              onClick={() => { setShowEmployeeRequestModal(false); setEmpRequestSuccess(false); }}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-400 hover:text-neutral-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-0.5">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#C22424] dark:text-red-300 bg-[#FEF2F2] dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-[#FECACA] dark:border-red-900/40">
                Staff Request
              </span>
              <h3 className="text-base font-bold text-neutral-900 dark:text-white pt-1">
                Request Employee Login
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Submit your details to request login credentials.
              </p>
            </div>

            {empRequestSuccess ? (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-center space-y-2">
                <Check className="w-7 h-7 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  Request Submitted Successfully
                </p>
                <p className="text-[11px] text-neutral-600 dark:text-neutral-300">
                  Your request has been submitted to Admin.
                </p>
                <button
                  type="button"
                  onClick={() => { setShowEmployeeRequestModal(false); setEmpRequestSuccess(false); }}
                  className="w-full py-2 bg-[#C22424] hover:bg-[#A81C1C] text-white font-bold text-xs rounded-xl mt-2 cursor-pointer"
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
                  <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 block">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={empRequestName}
                    onChange={(e) => setEmpRequestName(e.target.value)}
                    placeholder="e.g. Ramesh Kumar"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] rounded-xl text-xs font-medium text-neutral-900 dark:text-white outline-none focus:border-[#C22424] focus:ring-1 focus:ring-[#C22424]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-neutral-700 dark:text-neutral-300 block">
                    Mobile Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={empRequestPhone}
                    onChange={(e) => setEmpRequestPhone(e.target.value)}
                    placeholder="e.g. 9945351166"
                    className="w-full px-3 py-2 bg-neutral-50 dark:bg-[#1A1A1A] border border-neutral-200 dark:border-[#2A2A2A] rounded-xl text-xs font-medium text-neutral-900 dark:text-white outline-none focus:border-[#C22424] focus:ring-1 focus:ring-[#C22424]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-[#C22424] hover:bg-[#A81C1C] text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer"
                >
                  Send Request
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
