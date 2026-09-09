import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { 
  ShoppingCart, 
  Package, 
  Box, 
  Users, 
  ClipboardList, 
  HelpCircle, 
  LogOut,
  Calendar,
  Warehouse,
  BarChart3,
  Store,
  CreditCard,
  CloudUpload,
  ShieldCheck,
  Bell,
  Calculator,
  FileSpreadsheet,
  BookOpen,
  Clock,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';

const navItems = [
  { icon: ShoppingCart, label: 'Dashboard', path: '/dashboard', roles: ['admin', 'officer'] },
  { icon: Package, label: 'Placed Orders', path: '/placed-orders', roles: ['admin', 'officer'] },
  { icon: Warehouse, label: 'Inventory', path: '/inventory', roles: ['admin', 'officer', 'employee'] },
  { icon: FileSpreadsheet, label: 'Arrival Entry', path: '/arrival-entry', roles: ['admin', 'officer'] },
  { icon: CreditCard, label: 'Payments', path: '/payments', roles: ['admin', 'officer'] },
  { icon: BookOpen, label: 'Ledger', path: '/ledger', roles: ['admin', 'officer'] },
  { icon: Clock, label: 'Pending Loadings', path: '/pending-loadings', roles: ['admin', 'officer', 'employee'] },
  { icon: Calculator, label: 'Patti Ledger', path: '/patti', roles: ['admin', 'officer'] },
  { icon: Users, label: 'Users', path: '/users', roles: ['admin', 'officer'] },
  { icon: BarChart3, label: 'Analytics', path: '/analytics', roles: ['admin', 'officer'] },
  { icon: Calendar, label: 'Schedule', path: '/schedule', roles: ['admin', 'officer', 'employee'] },
  { icon: Bell, label: 'Settings', path: '/settings', roles: ['admin', 'officer'] },
];

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
}

export default function Sidebar({ isCollapsed, setIsCollapsed }: SidebarProps) {
  const navigate = useNavigate();
  const role = localStorage.getItem('userRole') || 'admin';

  const filteredNavItems = navItems.filter(item => item.roles.includes(role));

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('userRole');
      navigate('/about');
    } catch (err) {
      console.error('Logout error:', err);
      // Fallback redirection
      localStorage.removeItem('userRole');
      navigate('/about');
    }
  };

  return (
    <aside className={cn(
      "border-r border-outline-variant bg-surface backdrop-blur-2xl flex flex-col h-full py-4 fixed left-0 top-0 bottom-0 transition-all duration-300",
      "z-50 md:translate-x-0",
      "max-md:z-[60] max-md:w-64",
      isCollapsed ? "max-md:-translate-x-full w-20" : "max-md:translate-x-0 w-64"
    )}>
      {/* Floating Collapse Toggle */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        className="absolute top-6 -right-3 w-6 h-6 rounded-full bg-surface-container-high border border-outline-variant shadow-md hidden md:flex items-center justify-center text-secondary hover:text-primary transition-all hover:scale-110 z-50 cursor-pointer"
        title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
      >
        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
      </button>

      <div 
        className={cn(
          "mb-8 flex items-center gap-3 transition-all duration-300 cursor-pointer overflow-hidden",
          isCollapsed ? "px-5 justify-center" : "px-6"
        )} 
        onClick={() => {
          const r = localStorage.getItem('userRole');
          if (r === 'merchant') navigate('/store');
          else if (r === 'employee') navigate('/inventory');
          else navigate('/dashboard');
        }}
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#f2ca50] to-[#d4af37] flex items-center justify-center text-[#3c2f00] font-bold shrink-0 shadow-[0_0_12px_rgba(242,202,80,0.25)]">
          <Warehouse className="w-6 h-6" />
        </div>
        {!isCollapsed && (
          <div className="whitespace-nowrap transition-all duration-300">
            <h2 className="text-xl font-bold text-primary font-display leading-tight">Procurement</h2>
            <p className="text-[10px] uppercase tracking-widest text-secondary font-bold">Logistics Mgmt</p>
          </div>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-3 overflow-y-auto">
        {filteredNavItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={isCollapsed ? item.label : undefined}
            className={({ isActive }) => cn(
              "flex items-center rounded-lg transition-all duration-300 relative group overflow-hidden",
              isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3",
              isActive 
                ? "bg-primary/5 text-primary font-bold nav-active-glow" 
                : "text-secondary hover:bg-surface-container hover:text-on-surface"
            )}
          >
            <item.icon className={cn(
              "w-5 h-5 transition-transform duration-300 shrink-0",
              "group-hover:scale-110 group-active:scale-95"
            )} />
            {!isCollapsed && <span className="text-sm tracking-tight whitespace-nowrap">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="px-3 mt-auto pt-4 border-t border-outline-variant">
        <button 
          title={isCollapsed ? "Support" : undefined}
          className={cn(
            "w-full flex items-center text-secondary hover:bg-surface-container rounded-lg transition-all",
            isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3"
          )}
        >
          <HelpCircle className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">Support</span>}
        </button>
        <button 
          onClick={handleLogout}
          title={isCollapsed ? "Logout" : undefined}
          className={cn(
            "w-full flex items-center text-secondary hover:bg-surface-container hover:text-rose-600 rounded-lg transition-all",
            isCollapsed ? "justify-center px-0 py-3" : "gap-3 px-4 py-3"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
