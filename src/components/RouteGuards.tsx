import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getVerifiedUserRole } from '../lib/auth';

/**
 * AdminRoute: Strictly guards routes meant exclusively for Administrator.
 * - If role === 'admin': grants access.
 * - If role === 'employee': redirects to /inventory (staff portal).
 * - If role === 'merchant': redirects to /store (merchant portal).
 * - If unauthenticated: redirects to /login?portal=admin.
 */
export function AdminRoute() {
  const [role, setRole] = useState<'admin' | 'employee' | 'merchant' | null>(() => getVerifiedUserRole());
  const location = useLocation();

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
    return <Outlet />;
  }

  if (role === 'employee') {
    return <Navigate to="/inventory" replace />;
  }

  if (role === 'merchant') {
    return <Navigate to="/store" replace />;
  }

  return <Navigate to="/login?portal=admin" state={{ from: location }} replace />;
}

/**
 * StaffRoute: Strictly guards routes meant for Operations Staff (and Admin supervisors).
 * - If role === 'employee' || role === 'admin': grants access.
 * - If role === 'merchant': redirects to /store.
 * - If unauthenticated: redirects to /login?portal=employee.
 */
export function StaffRoute() {
  const [role, setRole] = useState<'admin' | 'employee' | 'merchant' | null>(() => getVerifiedUserRole());
  const location = useLocation();

  useEffect(() => {
    const handleSync = () => setRole(getVerifiedUserRole());
    window.addEventListener('storage', handleSync);
    window.addEventListener('role-changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('role-changed', handleSync);
    };
  }, []);

  if (role === 'employee' || role === 'admin') {
    return <Outlet />;
  }

  if (role === 'merchant') {
    return <Navigate to="/store" replace />;
  }

  return <Navigate to="/login?portal=employee" state={{ from: location }} replace />;
}

/**
 * MerchantRoute: Strictly guards routes meant for Buyers/Merchants.
 * - If role === 'merchant': grants access.
 * - If role === 'admin': redirects to /admin (admin must not enter merchant state).
 * - If role === 'employee': redirects to /inventory (staff must not enter merchant state).
 * - If unauthenticated: allows public catalog when allowPublic is true, otherwise redirects to /login?portal=merchant.
 */
export function MerchantRoute({ allowPublic = false }: { allowPublic?: boolean }) {
  const [role, setRole] = useState<'admin' | 'employee' | 'merchant' | null>(() => getVerifiedUserRole());
  const location = useLocation();

  useEffect(() => {
    const handleSync = () => setRole(getVerifiedUserRole());
    window.addEventListener('storage', handleSync);
    window.addEventListener('role-changed', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('role-changed', handleSync);
    };
  }, []);

  // Admin cannot accidentally enter merchant application state
  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  // Staff cannot accidentally enter merchant application state
  if (role === 'employee') {
    return <Navigate to="/inventory" replace />;
  }

  if (role === 'merchant' || allowPublic) {
    return <Outlet />;
  }

  return <Navigate to="/login?portal=merchant" state={{ from: location }} replace />;
}
