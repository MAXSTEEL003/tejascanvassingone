import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getVerifiedUserRole } from './lib/auth';
import { AdminRoute, StaffRoute, MerchantRoute } from './components/RouteGuards';
import { CartProvider } from './context/CartContext';
import { ErrorBoundary } from './components/ErrorBoundary';

import LoginView from './views/LoginView';
import AboutView from './views/AboutView';
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



// Dedicated route component for Admin Portal:
// If unauthenticated as admin, renders the clean bookmark-friendly Admin LoginView.
// If authenticated as admin, renders MainLayout with OrdersDashboard.
// If authenticated as employee or merchant, immediately redirects to their respective portals.
function AdminPortalRoute() {
  const [role, setRole] = useState<'admin' | 'employee' | 'merchant' | null>(() => getVerifiedUserRole());

  useEffect(() => {
    const handleSync = () => setRole(getVerifiedUserRole());
    window.addEventListener('storage', handleSync);
    window.addEventListener('role-changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('role-changed', handleSync);
    };
  }, []);

  if (role === 'admin') {
    return <MainLayout />;
  }

  if (role === 'employee') {
    return <Navigate to="/inventory" replace />;
  }

  if (role === 'merchant') {
    return <Navigate to="/store" replace />;
  }

  return <LoginView secretRole="admin" />;
}

export default function App() {
  // Support custom admin subdomain (admin.tejascanvassing.com)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && window.location.hostname === 'admin.tejascanvassing.com') {
        if (window.location.pathname === '/' || window.location.pathname === '/about') {
          window.location.replace('/admin');
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    const saved = getStorageItem('theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
      setStorageItem('theme', 'light');
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
            <Route path="/admintejas1679" element={<Navigate to="/admin" replace />} />
            <Route path="/employee1977" element={<LoginView secretRole="employee" />} />
            <Route path="/employee-login" element={<LoginView secretRole="employee" />} />
            <Route path="/employee" element={<LoginView secretRole="employee" />} />
            
            {/* Dedicated Admin Portal Route (Clean Google Sign-In when logged out, Executive Console when logged in) */}
            <Route element={<AdminPortalRoute />}>
              <Route path="/admin" element={<OrdersDashboard />} />
              <Route path="/dashboard" element={<OrdersDashboard />} />
            </Route>

            {/* Admin-Only Secure Routes */}
            <Route element={<AdminRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/placed-orders" element={<PlacedOrders />} />
                <Route path="/order/:id" element={<OrderDetails />} />
                <Route path="/users" element={<UsersManagement />} />
                <Route path="/analytics" element={<AnalyticsDashboard />} />
                <Route path="/payments" element={<PaymentTracking />} />
                <Route path="/settings" element={<NotificationSettings />} />
                <Route path="/patti" element={<PattiView />} />
                <Route path="/ledger" element={<LedgerManagement />} />
                <Route path="/pending-loadings" element={<PendingLoadings />} />
              </Route>
            </Route>

            {/* Operations Staff Routes (Staff + Admin supervisor) */}
            <Route element={<StaffRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/inventory" element={<ProductInventory />} />
                <Route path="/tasks" element={<TasksManagement />} />
                <Route path="/schedule" element={<TasksManagement />} />
                <Route path="/arrival-entry" element={<ArrivalEntry />} />
              </Route>
            </Route>

            {/* Merchant Public Catalog (Merchant + Unauthenticated Public, Admin/Staff redirected) */}
            <Route element={<MerchantRoute allowPublic={true} />}>
              <Route element={<MainLayout />}>
                <Route path="/store" element={<StoreManagement />} />
                <Route path="/shop" element={<StoreManagement />} />
              </Route>
            </Route>

            {/* Merchant-Only Authenticated Routes (Requires Merchant Login) */}
            <Route element={<MerchantRoute allowPublic={false} />}>
              <Route element={<MainLayout />}>
                <Route path="/bag" element={<BagView />} />
                <Route path="/cart" element={<Navigate to="/bag" replace />} />
                <Route path="/profile" element={<ProfileView />} />
                <Route path="/my-orders" element={<PlacedOrders forceMerchantView={true} />} />
                <Route path="/brokerage" element={<BrokerageView />} />
                <Route path="/checkout" element={<CheckoutView />} />
              </Route>
            </Route>

            {/* Global Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </ErrorBoundary>
  );
}
