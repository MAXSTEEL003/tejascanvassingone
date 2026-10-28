import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getVerifiedUserRole } from './lib/auth';
import { AdminRoute, StaffRoute, MerchantRoute } from './components/RouteGuards';
import { CartProvider } from './context/CartContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import PageFallback from './components/PageFallback';
import MainLayout from './layout/MainLayout';

// High-performance Lazy Loaded Views
const LoginView = lazy(() => import('./views/LoginView'));
const AboutView = lazy(() => import('./views/AboutView'));
const StoreManagement = lazy(() => import('./views/StoreManagement'));
const OrdersDashboard = lazy(() => import('./views/OrdersDashboard'));
const ProductInventory = lazy(() => import('./views/ProductInventory'));
const PlacedOrders = lazy(() => import('./views/PlacedOrders'));
const OrderDetails = lazy(() => import('./views/OrderDetails'));
const UsersManagement = lazy(() => import('./views/UsersManagement'));
const AnalyticsDashboard = lazy(() => import('./views/AnalyticsDashboard'));
const TasksManagement = lazy(() => import('./views/TasksManagement'));
const CheckoutView = lazy(() => import('./views/CheckoutView'));
const PaymentTracking = lazy(() => import('./views/PaymentTracking'));
const NotificationSettings = lazy(() => import('./views/NotificationSettings'));
const PattiView = lazy(() => import('./views/PattiView'));
const PattiBookView = lazy(() => import('./views/PattiBookView'));
const ArrivalEntry = lazy(() => import('./views/ArrivalEntry'));
const LedgerManagement = lazy(() => import('./views/LedgerManagement'));
const PendingLoadings = lazy(() => import('./views/PendingLoadings'));
const BrokerageView = lazy(() => import('./views/BrokerageView'));
const BagView = lazy(() => import('./views/BagView'));
const ProfileView = lazy(() => import('./views/ProfileView'));
const EmployeePortalView = lazy(() => import('./views/EmployeePortalView'));
const AcknowledgeReceiptView = lazy(() => import('./views/AcknowledgeReceiptView'));



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
    return <Navigate to="/employee/dashboard" replace />;
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
          <Suspense fallback={<PageFallback />}>
            <Routes>
              <Route path="/" element={<AboutView />} />
            <Route path="/about" element={<AboutView />} />
            <Route path="/intro" element={<AboutView />} />
            <Route path="/onboarding" element={<AboutView />} />
            <Route path="/journey" element={<Navigate to="/about" replace />} />
            <Route path="/experience" element={<Navigate to="/about" replace />} />
            <Route path="/acknowledge-po" element={<AcknowledgeReceiptView />} />
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
                <Route path="/patti-book" element={<PattiBookView />} />
                <Route path="/ledger" element={<LedgerManagement />} />
                <Route path="/pending-loadings" element={<PendingLoadings />} />
                <Route path="/arrival-entry" element={<ArrivalEntry />} />
              </Route>
            </Route>

            {/* Operations Staff Routes (Staff + Admin supervisor) */}
            <Route element={<StaffRoute />}>
              <Route element={<MainLayout />}>
                <Route path="/employee" element={<EmployeePortalView defaultTab="schedule" />} />
                <Route path="/employee/dashboard" element={<EmployeePortalView defaultTab="schedule" />} />
                <Route path="/employee/schedule" element={<EmployeePortalView defaultTab="schedule" />} />
                <Route path="/employee/rates" element={<EmployeePortalView defaultTab="rates" />} />
                <Route path="/employee/profile" element={<EmployeePortalView defaultTab="profile" />} />
                <Route path="/employee/orders" element={<Navigate to="/employee/schedule" replace />} />
                <Route path="/employee/dispatch" element={<Navigate to="/employee/schedule" replace />} />
                <Route path="/inventory" element={<ProductInventory />} />
                <Route path="/tasks" element={<TasksManagement />} />
                <Route path="/schedule" element={<TasksManagement />} />
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
        </Suspense>
      </BrowserRouter>
      </CartProvider>
    </ErrorBoundary>
  );
}
