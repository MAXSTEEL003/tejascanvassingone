import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { ShieldCheck, Lock, ArrowRight } from 'lucide-react';
import { auth } from './lib/firebase';
import { getVerifiedUserRole } from './lib/auth';
import { CartProvider } from './context/CartContext';
import { ErrorBoundary } from './components/ErrorBoundary';

import LoginView from './views/LoginView';
import AboutView from './views/AboutView';
import TejasExperienceView from './views/TejasExperienceView';
import StoreManagement from './views/StoreManagement';
import OrdersDashboard from './views/OrdersDashboard';
import ProductInventory from './views/ProductInventory';
import PlacedOrders from './views/PlacedOrders';
import OrderDetails from './views/OrderDetails';
import UsersManagement from './views/UsersManagement';
import AnalyticsDashboard from './views/AnalyticsDashboard';
import TasksManagement from './views/TasksManagement';
import CheckoutView from './views/CheckoutView';
import PaymentTracking from './views/PaymentTracking';
import NotificationSettings from './views/NotificationSettings';
import PattiView from './views/PattiView';
import ArrivalEntry from './views/ArrivalEntry';
import LedgerManagement from './views/LedgerManagement';
import PendingLoadings from './views/PendingLoadings';
import BrokerageView from './views/BrokerageView';
import BagView from './views/BagView';
import ProfileView from './views/ProfileView';
import MainLayout from './layout/MainLayout';



function getStorageItem(key: string): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return localStorage.getItem(key);
    }
  } catch (e) {
    console.warn(`Unable to read localStorage key "${key}":`, e);
  }
  return null;
}

function setStorageItem(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, value);
    }
  } catch (e) {
    console.warn(`Unable to write localStorage key "${key}":`, e);
  }
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!getVerifiedUserRole();
  });

  useEffect(() => {
    const handleAuth = () => {
      setIsAuthenticated(!!getVerifiedUserRole());
    };
    window.addEventListener('storage', handleAuth);
    window.addEventListener('role-changed', handleAuth);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const verifiedRole = getVerifiedUserRole();
      setIsAuthenticated(!!user || !!verifiedRole);
    });
    return () => {
      window.removeEventListener('storage', handleAuth);
      window.removeEventListener('role-changed', handleAuth);
      unsubscribe();
    };
  }, []);

  const targetPath = location.pathname;
  const adminRoutes = ['/admin', '/admintejas1679', '/dashboard', '/users', '/analytics', '/payments', '/settings', '/patti', '/ledger'];
  const staffRoutes = ['/inventory', '/arrival-entry', '/pending-loadings', '/tasks', '/schedule'];

  // If accessing an admin route, pass to AdminOnlyRoute (which enforces authenticated admin access)
  if (adminRoutes.some(r => targetPath.startsWith(r))) {
    return <>{children}</>;
  }

  // If accessing a staff/operations route, pass to StaffOnlyRoute (which enforces authenticated employee/admin)
  if (staffRoutes.some(r => targetPath.startsWith(r))) {
    return <>{children}</>;
  }

  // If not authenticated, redirect merchant routes to login
  if (!isAuthenticated) {
    if (targetPath === '/store' || targetPath === '/shop' || targetPath === '/checkout' || targetPath === '/placed-orders' || targetPath === '/my-orders' || targetPath === '/brokerage' || targetPath === '/bag' || targetPath === '/cart' || targetPath === '/profile' || targetPath.startsWith('/order/')) {
      return <Navigate to={`/login?redirect=${encodeURIComponent(targetPath + location.search)}`} replace />;
    }
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [role, setRole] = useState(() => {
    const verified = getVerifiedUserRole();
    if (verified === 'admin') return 'admin';
    if (typeof window !== 'undefined' && localStorage.getItem('userRole') === 'admin') return 'admin';
    return verified;
  });

  useEffect(() => {
    const handleSync = () => {
      const verified = getVerifiedUserRole();
      if (verified === 'admin' || localStorage.getItem('userRole') === 'admin') {
        setRole('admin');
      } else {
        setRole(verified);
      }
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('role-changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('role-changed', handleSync);
    };
  }, []);

  // Admin access strictly requires a properly authenticated admin user
  if (role !== 'admin' && (typeof window === 'undefined' || localStorage.getItem('userRole') !== 'admin')) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-3xl p-6 sm:p-8 border border-stone-200 dark:border-stone-800 shadow-2xl text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
            Admin Authentication Required
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 mb-6">
            Access to this executive console is restricted. Please sign in with verified Admin HQ credentials.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                window.location.href = `/admintejas1679?redirect=${encodeURIComponent(location.pathname)}`;
              }}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-800 to-amber-700 hover:from-emerald-700 hover:to-amber-600 text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              <span>Sign In with Admin Password</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function StaffOnlyRoute({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [role, setRole] = useState(() => getVerifiedUserRole());

  useEffect(() => {
    const handleSync = () => {
      setRole(getVerifiedUserRole());
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('role-changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('role-changed', handleSync);
    };
  }, []);

  // Employee or Admin role required
  if (role !== 'employee' && role !== 'admin') {
    return <Navigate to={`/employee1977?redirect=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <>{children}</>;
}

// Dedicated route component for /admintejas1679: if not authenticated as admin, renders the Admin LoginView
function AdminSecretRoute() {
  const [role, setRole] = useState(() => {
    const verified = getVerifiedUserRole();
    if (verified === 'admin' || (typeof window !== 'undefined' && localStorage.getItem('userRole') === 'admin')) return 'admin';
    return verified;
  });

  useEffect(() => {
    const handleSync = () => {
      const verified = getVerifiedUserRole();
      if (verified === 'admin' || localStorage.getItem('userRole') === 'admin') {
        setRole('admin');
      } else {
        setRole(verified);
      }
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('role-changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('role-changed', handleSync);
    };
  }, []);

  if (role === 'admin' || (typeof window !== 'undefined' && localStorage.getItem('userRole') === 'admin')) {
    return <Navigate to="/admin" replace />;
  }

  return <LoginView secretRole="admin" />;
}

function AdminPortalRoute() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const redirectTarget = searchParams.get('redirect');
  const role = getVerifiedUserRole();

  if (role === 'admin') {
    const destination = redirectTarget && redirectTarget.startsWith('/') ? redirectTarget : '/dashboard';
    return <Navigate to={destination} replace />;
  }

  return <LoginView defaultStep="login" secretRole="admin" />;
}

function RootRedirect() {
  const role = getVerifiedUserRole();
  // First time users or users without an active session go directly to Merchant Login
  if (!role) {
    return <Navigate to="/login" replace />;
  }
  if (role === 'merchant') {
    return <Navigate to="/store" replace />;
  } else if (role === 'employee') {
    return <Navigate to="/inventory" replace />;
  } else {
    return <Navigate to="/admin" replace />;
  }
}

export default function App() {
  useEffect(() => {
    const saved = getStorageItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      setStorageItem('theme', 'light');
    }

    // Automatic local cache purge & deep sanitization to remove stale data
    try {
      const keysToScrub: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) keysToScrub.push(key);
      }

      keysToScrub.forEach(key => {
        // Specifically fix user profile keys
        if (key === 'userName') {
          const val = localStorage.getItem('userName') || '';
          if (val.toUpperCase().includes('V.K') || val.toUpperCase().includes('VK FOODS')) {
            localStorage.setItem('userName', 'Authorized Merchant');
          }
        } else if (key === 'merchant_delivery_locations') {
          const val = localStorage.getItem(key) || '';
          if (val.toUpperCase().includes('V.K') || val.toUpperCase().includes('VK FOODS') || val.toUpperCase().includes('ANNAPURNA')) {
            localStorage.removeItem(key);
          }
        } else {
          const val = localStorage.getItem(key) || '';
          if (val.toUpperCase().includes('V.K FOODS') || val.toUpperCase().includes('VK FOODS') || val.toUpperCase().includes('ANNAPURNA')) {
            const safeToPurgeKeys = [
              'arrival_entry_data_v4',
              'arrival_entry_sheets_v4',
              'placed_orders',
              'procurement_requests',
              'ledgers',
              'product_inventory',
              'stakeholders_v2',
              'users_stakeholders',
              'patti_history',
              'cart',
              'store_cart',
              'cart_items',
              'merchant_delivery_locations',
              'selected_delivery_location_id',
              'local_orders'
            ];
            if (safeToPurgeKeys.includes(key)) {
              localStorage.removeItem(key);
            }
          }
        }
      });

      const DEPLOYMENT_RESET_KEY = 'prod_deploy_clean_v5_purge_legacy';
      if (!localStorage.getItem(DEPLOYMENT_RESET_KEY)) {
        const keysToPurge = [
          'arrival_entry_data_v4',
          'arrival_entry_sheets_v4',
          'placed_orders',
          'procurement_requests',
          'ledgers',
          'product_inventory',
          'stakeholders_v2',
          'users_stakeholders',
          'patti_history',
          'deleted_product_inventory_ids',
          'deleted_procurement_ids',
          'deleted_ledger_ids',
          'deleted_stakeholder_ids',
          'pending_loadings_cleared_all',
          'cleared_pending_loadings',
          'placed_orders_cleared_all',
          'ledger_cleared_all',
          'just_placed_order',
          'schedule_events',
          'merchant_delivery_locations',
          'selected_delivery_location_id',
          'user_wishlist',
          'store_cart',
          'cart_items',
          'cart',
          'local_orders',
          'tejas_hero_slides',
          'tejas_ticker_messages',
          'tejas_rate_list_graphic',
          'tejas_hero_product_id'
        ];
        keysToPurge.forEach(k => localStorage.removeItem(k));

        const currUser = localStorage.getItem('userName');
        if (currUser && (currUser.toUpperCase().includes('V.K') || currUser.toUpperCase().includes('VK FOODS'))) {
          localStorage.setItem('userName', 'Authorized Merchant');
        }

        localStorage.setItem(DEPLOYMENT_RESET_KEY, 'true');
      }
    } catch (e) {
      console.warn('Silent error during localStorage purge:', e);
    }
  }, []);

  return (
    <ErrorBoundary>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<AboutView />} />
            <Route path="/about" element={<AboutView />} />
            <Route path="/intro" element={<AboutView />} />
            <Route path="/onboarding" element={<AboutView />} />
            <Route path="/journey" element={<Navigate to="/about" replace />} />
            <Route path="/experience" element={<Navigate to="/about" replace />} />
            <Route path="/login" element={<LoginView defaultTab="signin" />} />
            <Route path="/signup" element={<LoginView defaultTab="signup" />} />
            <Route path="/employee1977" element={<LoginView secretRole="employee" />} />
            <Route path="/employee-login" element={<LoginView secretRole="employee" />} />
            <Route path="/employee" element={<LoginView secretRole="employee" />} />
            
            <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>
              <Route path="/admin" element={<AdminOnlyRoute><OrdersDashboard /></AdminOnlyRoute>} />
              <Route path="/admintejas1679" element={<AdminSecretRoute />} />
              <Route path="/store" element={<StoreManagement />} />
              <Route path="/shop" element={<StoreManagement />} />
              <Route path="/bag" element={<BagView />} />
              <Route path="/cart" element={<Navigate to="/bag" replace />} />
              <Route path="/profile" element={<ProfileView />} />
              <Route path="/dashboard" element={<AdminOnlyRoute><OrdersDashboard /></AdminOnlyRoute>} />
              <Route path="/inventory" element={<StaffOnlyRoute><ProductInventory /></StaffOnlyRoute>} />
              <Route path="/placed-orders" element={<PlacedOrders />} />
              <Route path="/my-orders" element={<PlacedOrders forceMerchantView={true} />} />
              <Route path="/brokerage" element={<BrokerageView />} />
              <Route path="/order/:id" element={<OrderDetails />} />
              <Route path="/users" element={<AdminOnlyRoute><UsersManagement /></AdminOnlyRoute>} />
              <Route path="/analytics" element={<AdminOnlyRoute><AnalyticsDashboard /></AdminOnlyRoute>} />
              <Route path="/tasks" element={<StaffOnlyRoute><TasksManagement /></StaffOnlyRoute>} />
              <Route path="/schedule" element={<StaffOnlyRoute><TasksManagement /></StaffOnlyRoute>} />
              <Route path="/checkout" element={<CheckoutView />} />
              <Route path="/payments" element={<AdminOnlyRoute><PaymentTracking /></AdminOnlyRoute>} />
              <Route path="/settings" element={<AdminOnlyRoute><NotificationSettings /></AdminOnlyRoute>} />
              <Route path="/patti" element={<AdminOnlyRoute><PattiView /></AdminOnlyRoute>} />
              <Route path="/arrival-entry" element={<StaffOnlyRoute><ArrivalEntry /></StaffOnlyRoute>} />
              <Route path="/ledger" element={<AdminOnlyRoute><LedgerManagement /></AdminOnlyRoute>} />
              <Route path="/pending-loadings" element={<StaffOnlyRoute><PendingLoadings /></StaffOnlyRoute>} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </ErrorBoundary>
  );
}
