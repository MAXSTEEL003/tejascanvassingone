import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { getVerifiedUserRole } from './lib/auth';
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
function AdminPortalRoute() {
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      const verified = getVerifiedUserRole();
      return verified === 'admin' || (typeof window !== 'undefined' && localStorage.getItem('userRole') === 'admin');
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const handleSync = () => {
      try {
        const verified = getVerifiedUserRole();
        setIsAdmin(verified === 'admin' || localStorage.getItem('userRole') === 'admin');
      } catch {
        setIsAdmin(false);
      }
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('role-changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('role-changed', handleSync);
    };
  }, []);

  if (isAdmin) {
    return <MainLayout />;
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
            <Route path="/admintejas1679" element={<Navigate to="/admin" replace />} />
            <Route path="/employee1977" element={<LoginView secretRole="employee" />} />
            <Route path="/employee-login" element={<LoginView secretRole="employee" />} />
            <Route path="/employee" element={<LoginView secretRole="employee" />} />
            
            {/* Dedicated Admin Portal Route (Clean Google Sign-In when logged out, Executive Console when logged in) */}
            <Route element={<AdminPortalRoute />}>
              <Route path="/admin" element={<OrdersDashboard />} />
              <Route path="/dashboard" element={<OrdersDashboard />} />
            </Route>

            <Route element={<MainLayout />}>
              <Route path="/store" element={<StoreManagement />} />
              <Route path="/shop" element={<StoreManagement />} />
              <Route path="/bag" element={<BagView />} />
              <Route path="/cart" element={<Navigate to="/bag" replace />} />
              <Route path="/profile" element={<ProfileView />} />
              <Route path="/inventory" element={<ProductInventory />} />
              <Route path="/placed-orders" element={<PlacedOrders />} />
              <Route path="/my-orders" element={<PlacedOrders forceMerchantView={true} />} />
              <Route path="/brokerage" element={<BrokerageView />} />
              <Route path="/order/:id" element={<OrderDetails />} />
              <Route path="/users" element={<UsersManagement />} />
              <Route path="/analytics" element={<AnalyticsDashboard />} />
              <Route path="/tasks" element={<TasksManagement />} />
              <Route path="/schedule" element={<TasksManagement />} />
              <Route path="/checkout" element={<CheckoutView />} />
              <Route path="/payments" element={<PaymentTracking />} />
              <Route path="/settings" element={<NotificationSettings />} />
              <Route path="/patti" element={<PattiView />} />
              <Route path="/arrival-entry" element={<ArrivalEntry />} />
              <Route path="/ledger" element={<LedgerManagement />} />
              <Route path="/pending-loadings" element={<PendingLoadings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </CartProvider>
    </ErrorBoundary>
  );
}
