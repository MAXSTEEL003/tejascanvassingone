import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './lib/firebase';
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
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return !!getStorageItem('userRole');
  });

  useEffect(() => {
    const handleAuth = () => {
      setIsAuthenticated(!!getStorageItem('userRole'));
    };
    window.addEventListener('storage', handleAuth);
    window.addEventListener('role-changed', handleAuth);
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      const hasRole = !!getStorageItem('userRole');
      setIsAuthenticated(!!user || hasRole);
    });
    return () => {
      window.removeEventListener('storage', handleAuth);
      window.removeEventListener('role-changed', handleAuth);
      unsubscribe();
    };
  }, []);

  if (!isAuthenticated) {
    return <Navigate to="/about" replace />;
  }

  return <>{children}</>;
}

function AdminOnlyRoute({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState(() => {
    try {
      return getStorageItem('userRole') || 'admin';
    } catch {
      return 'admin';
    }
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        setRole(getStorageItem('userRole') || 'admin');
      } catch {}
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('role-changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('role-changed', handleSync);
    };
  }, []);

  if (role === 'merchant') {
    return <Navigate to="/store" replace />;
  }
  if (role === 'employee') {
    return <Navigate to="/inventory" replace />;
  }
  return <>{children}</>;
}

function StaffOnlyRoute({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState(() => {
    try {
      return getStorageItem('userRole') || 'admin';
    } catch {
      return 'admin';
    }
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        setRole(getStorageItem('userRole') || 'admin');
      } catch {}
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('role-changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('role-changed', handleSync);
    };
  }, []);

  if (role === 'merchant') {
    return <Navigate to="/store" replace />;
  }
  return <>{children}</>;
}

function RootRedirect() {
  const role = getStorageItem('userRole');
  // First time users or users without an active session start at About Us
  if (!role) {
    return <Navigate to="/about" replace />;
  }
  if (role === 'merchant') {
    return <Navigate to="/store" replace />;
  } else if (role === 'employee') {
    return <Navigate to="/inventory" replace />;
  } else {
    return <Navigate to="/dashboard" replace />;
  }
}

export default function App() {
  useEffect(() => {
    const saved = getStorageItem('theme');
    if (!saved || saved === 'dark') {
      document.documentElement.classList.add('dark');
      setStorageItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Automatic local cache purge for production deployment readiness
    const DEPLOYMENT_RESET_KEY = 'prod_deploy_clean_v3';
    if (!localStorage.getItem(DEPLOYMENT_RESET_KEY)) {
      const keysToPurge = [
        'arrival_entry_data_v4',
        'arrival_entry_sheets_v4',
        'placed_orders',
        'procurement_requests',
        'ledgers',
        'product_inventory',
        'stakeholders_v2',
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
        'tejas_hero_slides',
        'tejas_ticker_messages',
        'tejas_rate_list_graphic',
        'tejas_hero_product_id'
      ];
      keysToPurge.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(DEPLOYMENT_RESET_KEY, 'true');
    }
  }, []);

  return (
    <ErrorBoundary>
      <CartProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginView defaultStep="login" />} />
            <Route path="/admintejas1679" element={<LoginView defaultStep="login" secretRole="admin" />} />
            <Route path="/employee1977" element={<LoginView defaultStep="login" secretRole="employee" />} />
            <Route path="/intro" element={<LoginView defaultStep="splash" />} />
            <Route path="/onboarding" element={<LoginView defaultStep="onboarding" />} />
            <Route path="/about" element={<AboutView />} />
            
            <Route element={<PrivateRoute><MainLayout /></PrivateRoute>}>
              <Route path="/store" element={<StoreManagement />} />
              <Route path="/dashboard" element={<AdminOnlyRoute><OrdersDashboard /></AdminOnlyRoute>} />
              <Route path="/inventory" element={<StaffOnlyRoute><ProductInventory /></StaffOnlyRoute>} />
              <Route path="/placed-orders" element={<PlacedOrders />} />
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
              <Route path="/" element={<RootRedirect />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </ErrorBoundary>
  );
}
