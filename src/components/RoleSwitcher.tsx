import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, ShoppingBag, Briefcase, Warehouse, ChevronDown, Check } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function RoleSwitcher({ className }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [role, setRole] = useState(() => {
    try {
      return localStorage.getItem('userRole') || 'merchant';
    } catch {
      return 'merchant';
    }
  });

  useEffect(() => {
    const syncRole = () => {
      try {
        setRole(localStorage.getItem('userRole') || 'merchant');
      } catch {}
    };
    window.addEventListener('storage', syncRole);
    window.addEventListener('role-changed', syncRole);
    return () => {
      window.removeEventListener('storage', syncRole);
      window.removeEventListener('role-changed', syncRole);
    };
  }, []);

  const switchRole = (newRole: 'merchant' | 'admin' | 'employee') => {
    setIsOpen(false);
    if (newRole === role) return;

    try {
      localStorage.setItem('userRole', newRole);
      if (newRole === 'merchant') {
        localStorage.setItem('userName', 'V.K FOODS');
      } else if (newRole === 'employee') {
        localStorage.setItem('userName', 'Praveen (Dispatch Staff)');
      } else {
        localStorage.setItem('userName', 'Tejas Canvassing');
      }
      window.dispatchEvent(new Event('role-changed'));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.warn('Storage sync issue:', e);
    }

    // Direct to the authorized screen for each role
    if (newRole === 'merchant') {
      navigate('/store');
    } else if (newRole === 'employee') {
      navigate('/inventory');
    } else {
      navigate('/dashboard');
    }
  };

  const rolesConfig = [
    {
      id: 'merchant',
      label: 'Merchant (Buyer)',
      sub: 'Access Rice Store & Orders (No Dashboard)',
      icon: ShoppingBag,
      color: 'text-emerald-700 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10'
    },
    {
      id: 'admin',
      label: 'Admin (Broker/Owner)',
      sub: 'Full Dashboard, Ledgers & Approvals (No Store)',
      icon: Briefcase,
      color: 'text-amber-700 dark:text-amber-400',
      bgColor: 'bg-amber-500/10'
    },
    {
      id: 'employee',
      label: 'Employee (Warehouse)',
      sub: 'Inventory & Pending Loadings (No Store)',
      icon: Warehouse,
      color: 'text-blue-700 dark:text-blue-400',
      bgColor: 'bg-blue-500/10'
    }
  ];

  const currentConfig = rolesConfig.find(r => r.id === role) || rolesConfig[0];

  return (
    <div className={cn("relative inline-block text-left font-sans", className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border shadow-sm",
          role === 'merchant'
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/25 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100/50"
            : role === 'employee'
            ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500/25 text-blue-800 dark:text-blue-300 hover:bg-blue-100/50"
            : "bg-amber-50 dark:bg-amber-950/40 border-amber-500/25 text-amber-800 dark:text-amber-300 hover:bg-amber-100/50"
        )}
        title="Switch user role"
      >
        <span className="flex items-center gap-1.5">
          <currentConfig.icon className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Viewing as:</span>
          <span className="font-extrabold">{role === 'merchant' ? 'Merchant' : role === 'employee' ? 'Staff' : 'Admin'}</span>
        </span>
        <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-50 bg-transparent"
              onClick={() => setIsOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-[#151310] border border-amber-900/15 dark:border-amber-950/40 shadow-2xl z-50 p-2 text-stone-900 dark:text-stone-100"
            >
              <div className="px-3 py-2 border-b border-stone-100 dark:border-stone-800">
                <p className="text-[10px] font-black uppercase tracking-widest text-stone-400 dark:text-stone-500">
                  Role-Based Access Control
                </p>
                <p className="text-[11px] text-stone-600 dark:text-stone-300 mt-0.5">
                  Store is exclusive to Merchants. Dashboard is exclusive to Admin.
                </p>
              </div>

              <div className="py-1 space-y-1">
                {rolesConfig.map((r) => {
                  const isSelected = r.id === role;
                  return (
                    <button
                      key={r.id}
                      onClick={() => switchRole(r.id as any)}
                      className={cn(
                        "w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 cursor-pointer",
                        isSelected
                          ? "bg-stone-100 dark:bg-stone-800/80 font-bold"
                          : "hover:bg-stone-50 dark:hover:bg-stone-800/40"
                      )}
                    >
                      <div className={cn("p-2 rounded-lg shrink-0 mt-0.5", r.bgColor, r.color)}>
                        <r.icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-stone-900 dark:text-stone-100">
                            {r.label}
                          </span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />}
                        </div>
                        <p className="text-[10px] text-stone-500 dark:text-stone-400 leading-tight mt-0.5">
                          {r.sub}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
