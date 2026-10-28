import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Calendar, 
  CalendarClock,
  CheckCircle2, 
  Clock, 
  Search, 
  Filter, 
  User, 
  MapPin, 
  Building2, 
  Warehouse, 
  RefreshCw, 
  Check, 
  ArrowRight, 
  TrendingUp, 
  Tag, 
  Package, 
  LogOut, 
  ShieldCheck, 
  Sparkles, 
  Inbox, 
  Lock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatINR } from '../lib/utils';
import { getCollectionDocs, syncCollection, setCollectionDoc } from '../lib/firebase';
import { performSecureLogout } from '../lib/auth';

interface EmployeePortalProps {
  defaultTab?: 'schedule' | 'rates' | 'profile';
}

export interface ScheduleItem {
  id: string;
  title: string;
  category: 'Work Task' | 'Reminder' | 'Meeting' | 'Dispatch' | 'Payment Followup' | 'Quality Check';
  date: string; // YYYY-MM-DD
  time: string; // e.g. "09:30 AM"
  assignee: string;
  priority: 'High' | 'Medium' | 'Low';
  status: 'Pending' | 'In Progress' | 'Completed';
  description?: string;
  location?: string;
}

export interface BrandProduct {
  id: string;
  name: string;
  category?: string;
  price: number;
  stock?: number;
  unit?: string;
  bagSize?: string;
  grade?: string;
  supplier?: string;
  origin?: string;
  status?: string;
  moisture?: string;
  brokenPercentage?: string;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'Work Task': { 
    bg: 'bg-blue-50 dark:bg-blue-950/40', 
    text: 'text-blue-700 dark:text-blue-300', 
    border: 'border-blue-200 dark:border-blue-900/50' 
  },
  'Reminder': { 
    bg: 'bg-amber-50 dark:bg-amber-950/40', 
    text: 'text-amber-700 dark:text-amber-300', 
    border: 'border-amber-200 dark:border-amber-900/50' 
  },
  'Meeting': { 
    bg: 'bg-purple-50 dark:bg-purple-950/40', 
    text: 'text-purple-700 dark:text-purple-300', 
    border: 'border-purple-200 dark:border-purple-900/50' 
  },
  'Dispatch': { 
    bg: 'bg-emerald-50 dark:bg-emerald-950/40', 
    text: 'text-emerald-700 dark:text-emerald-300', 
    border: 'border-emerald-200 dark:border-emerald-900/50' 
  },
  'Payment Followup': { 
    bg: 'bg-rose-50 dark:bg-rose-950/40', 
    text: 'text-rose-700 dark:text-rose-300', 
    border: 'border-rose-200 dark:border-rose-900/50' 
  },
  'Quality Check': { 
    bg: 'bg-indigo-50 dark:bg-indigo-950/40', 
    text: 'text-indigo-700 dark:text-indigo-300', 
    border: 'border-indigo-200 dark:border-indigo-900/50' 
  },
};

// Date & Timing helpers to clearly separate current vs future tasks (tomorrow, 1 week later, etc.)
export const getRelativeDateStr = (daysOffset: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export interface TimingInfo {
  isCurrent: boolean;
  label: string;
  badgeClass: string;
  daysDiff: number;
  formattedDate: string;
  relativeDateText: string;
}

export function getTimingInfo(dateStr: string, status?: string): TimingInfo {
  if (!dateStr) {
    return {
      isCurrent: true,
      label: 'Today',
      badgeClass: 'bg-red-50 text-[#C22424] border-red-200 dark:bg-red-950/60 dark:text-red-300',
      daysDiff: 0,
      formattedDate: 'Today',
      relativeDateText: 'Today'
    };
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const parts = dateStr.split('-');
  let target: Date;
  if (parts.length === 3) {
    target = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  } else {
    target = new Date(dateStr);
    target.setHours(0, 0, 0, 0);
  }

  const diffTime = target.getTime() - today.getTime();
  const daysDiff = Math.round(diffTime / (1000 * 60 * 60 * 24));

  const formattedDate = target.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });

  if (status === 'In Progress') {
    return {
      isCurrent: true,
      label: 'Active Now',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300',
      daysDiff,
      formattedDate,
      relativeDateText: 'Active Today'
    };
  }

  if (daysDiff < 0) {
    if (status === 'Completed') {
      return {
        isCurrent: true,
        label: 'Completed',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400',
        daysDiff,
        formattedDate,
        relativeDateText: `${formattedDate} (Done)`
      };
    }
    return {
      isCurrent: true,
      label: 'Overdue',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300',
      daysDiff,
      formattedDate,
      relativeDateText: `${Math.abs(daysDiff)}d overdue`
    };
  }

  if (daysDiff === 0) {
    return {
      isCurrent: true,
      label: 'Due Today',
      badgeClass: 'bg-red-50 text-[#C22424] border-red-200 dark:bg-red-950/60 dark:text-red-300',
      daysDiff: 0,
      formattedDate: `Today (${formattedDate})`,
      relativeDateText: 'Due Today'
    };
  }

  if (daysDiff === 1) {
    return {
      isCurrent: false,
      label: 'Tomorrow',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300',
      daysDiff: 1,
      formattedDate: `Tomorrow (${formattedDate})`,
      relativeDateText: 'Tomorrow'
    };
  }

  if (daysDiff >= 2 && daysDiff <= 6) {
    return {
      isCurrent: false,
      label: `In ${daysDiff} Days`,
      badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300',
      daysDiff,
      formattedDate,
      relativeDateText: `In ${daysDiff} days (${formattedDate})`
    };
  }

  if (daysDiff >= 7 && daysDiff <= 13) {
    return {
      isCurrent: false,
      label: daysDiff === 7 ? '1 Week Later' : `Next Week (${daysDiff}d)`,
      badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300',
      daysDiff,
      formattedDate,
      relativeDateText: daysDiff === 7 ? '1 Week Later' : `Next Week (${daysDiff} days later)`
    };
  }

  const weeks = Math.round(daysDiff / 7);
  return {
    isCurrent: false,
    label: `In ${weeks} Weeks`,
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300',
    daysDiff,
    formattedDate,
    relativeDateText: `${weeks} weeks later (${formattedDate})`
  };
}

const defaultSeedSchedules: ScheduleItem[] = [
  {
    id: 'SCH-101',
    title: 'Verify 1121 Sella Batch #992 Moisture & Quality',
    category: 'Quality Check',
    date: getRelativeDateStr(0), // Today
    time: '09:30 AM',
    assignee: 'Vikram Singh',
    priority: 'High',
    status: 'In Progress',
    description: 'Perform moisture test (<12%) and inspect chalky grain percentage before warehouse storage.',
    location: 'Warehouse Bay #4, Gate 2'
  },
  {
    id: 'SCH-102',
    title: 'Inspect Unloading of Sona Masoori (260 QTLS)',
    category: 'Work Task',
    date: getRelativeDateStr(0), // Today
    time: '11:00 AM',
    assignee: 'Vikram Singh',
    priority: 'High',
    status: 'Pending',
    description: 'Count bags against physical weighbridge slip and verify packaging intactness.',
    location: 'Central Grain Godown Shed #2'
  },
  {
    id: 'SCH-103',
    title: 'Match Weighbridge Slip with Mill Manifest',
    category: 'Quality Check',
    date: getRelativeDateStr(1), // Tomorrow
    time: '02:30 PM',
    assignee: 'Vikram Singh',
    priority: 'Medium',
    status: 'Pending',
    description: 'Reconcile gross and tare weights on gross slip with lorry driver copy.',
    location: 'Weighbridge Desk'
  },
  {
    id: 'SCH-104',
    title: 'Scheduled Fumigation & Monsoon Tarpaulin Audit (Next Week)',
    category: 'Work Task',
    date: getRelativeDateStr(7), // 1 Week Later
    time: '10:00 AM',
    assignee: 'Vikram Singh',
    priority: 'High',
    status: 'Pending',
    description: 'Check tarpaulin covers on bay stacks 14 to 22 for water leak prevention.',
    location: 'Central Grain Warehouse Shed #3'
  },
  {
    id: 'SCH-105',
    title: 'Quarterly Physical Lot Inventory Count',
    category: 'Work Task',
    date: getRelativeDateStr(10), // 10 days later
    time: '03:00 PM',
    assignee: 'Vikram Singh',
    priority: 'Low',
    status: 'Pending',
    description: 'Periodic count of milled stock vs physical tally sheets.',
    location: 'APMC Yard Godown #1'
  }
];

export default function EmployeePortalView({ defaultTab = 'schedule' }: EmployeePortalProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Active sub-tab derived from defaultTab or URL pathname
  const activeTab = useMemo<'schedule' | 'rates' | 'profile'>(() => {
    if (location.pathname.includes('/rates')) return 'rates';
    if (location.pathname.includes('/profile')) return 'profile';
    if (location.pathname.includes('/schedule') || location.pathname.includes('/dashboard')) return 'schedule';
    return defaultTab;
  }, [location.pathname, defaultTab]);

  // Operational State
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);
  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search & Filters for Schedule
  const [taskSearch, setTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'ALL' | 'Pending' | 'In Progress' | 'Completed'>('ALL');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<string>('ALL');
  const [timeframeFilter, setTimeframeFilter] = useState<'ALL' | 'CURRENT' | 'FUTURE'>('ALL');

  // Employee Identity
  const employeeName = localStorage.getItem('userName') || 'Vikram Singh';
  const employeeEmail = localStorage.getItem('userEmail') || 'operations@tejascanvassing.com';
  const employeeId = localStorage.getItem('userId') || 'TC-EMP-01';

  // Helper toast notification
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // 1. Load operational data: schedules and brand rates
  const loadData = async () => {
    try {
      setIsLoading(true);

      // Load schedules
      let loadedSchedules: ScheduleItem[] = [];
      const localSchedStr = localStorage.getItem('schedule_events');
      if (localSchedStr) {
        try {
          const parsed = JSON.parse(localSchedStr);
          if (Array.isArray(parsed) && parsed.length > 0) loadedSchedules = parsed;
        } catch (e) {}
      }

      if (loadedSchedules.length === 0) {
        const cloudSchedules = await getCollectionDocs('schedules').catch(() => []);
        if (Array.isArray(cloudSchedules) && cloudSchedules.length > 0) {
          loadedSchedules = cloudSchedules as ScheduleItem[];
        }
      }

      if (loadedSchedules.length === 0) {
        loadedSchedules = defaultSeedSchedules;
        localStorage.setItem('schedule_events', JSON.stringify(loadedSchedules));
      } else {
        // Upgrade legacy seeds if they don't have future tasks or only contain past dates
        const hasFuture = loadedSchedules.some(s => getTimingInfo(s.date, s.status).daysDiff > 0);
        if (!hasFuture && loadedSchedules.every(s => s.id?.startsWith('SCH-10'))) {
          loadedSchedules = defaultSeedSchedules;
          localStorage.setItem('schedule_events', JSON.stringify(loadedSchedules));
        }
      }
      setSchedules(loadedSchedules);

      // Load products / brand rates
      let loadedProducts: BrandProduct[] = [];
      const cloudProds = await getCollectionDocs('product_inventory').catch(() => []);
      if (Array.isArray(cloudProds) && cloudProds.length > 0) {
        loadedProducts = cloudProds as BrandProduct[];
      } else {
        const localProdsStr = localStorage.getItem('product_inventory');
        if (localProdsStr) {
          try {
            const parsed = JSON.parse(localProdsStr);
            if (Array.isArray(parsed) && parsed.length > 0) loadedProducts = parsed;
          } catch (e) {}
        }
      }

      setProducts(loadedProducts);
    } catch (err) {
      console.warn('Error loading employee portal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update Task Status by Employee (Pending -> In Progress -> Completed)
  const handleUpdateTaskStatus = async (taskId: string, nextStatus: 'Pending' | 'In Progress' | 'Completed') => {
    try {
      const updated = schedules.map(item => {
        if (item.id === taskId) {
          return { ...item, status: nextStatus };
        }
        return item;
      });
      setSchedules(updated);
      localStorage.setItem('schedule_events', JSON.stringify(updated));

      const target = updated.find(i => i.id === taskId);
      if (target) {
        await setCollectionDoc('schedules', taskId, target).catch(() => {});
      }

      showToast(`Task status: "${nextStatus}"`);
    } catch (e) {
      console.error('Failed to update task status:', e);
      showToast('Status updated');
    }
  };

  // Filter Tasks assigned to this employee
  const myAssignedTasks = useMemo(() => {
    const myName = employeeName.toLowerCase().trim();
    return schedules.filter(task => {
      const assignee = (task.assignee || '').toLowerCase().trim();
      const isAssigned = !assignee || assignee.includes(myName) || myName.includes(assignee) || assignee === 'all';
      return isAssigned;
    });
  }, [schedules, employeeName]);

  // Filtered Tasks for Schedule Tab
  const filteredTasks = useMemo(() => {
    return myAssignedTasks.filter(task => {
      if (taskStatusFilter !== 'ALL' && task.status !== taskStatusFilter) return false;
      if (taskCategoryFilter !== 'ALL' && task.category !== taskCategoryFilter) return false;
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase();
        const mTitle = (task.title || '').toLowerCase().includes(q);
        const mDesc = (task.description || '').toLowerCase().includes(q);
        const mLoc = (task.location || '').toLowerCase().includes(q);
        if (!mTitle && !mDesc && !mLoc) return false;
      }
      return true;
    });
  }, [myAssignedTasks, taskStatusFilter, taskCategoryFilter, taskSearch]);

  // Task Statistics
  const taskStats = useMemo(() => {
    const total = myAssignedTasks.length;
    const pending = myAssignedTasks.filter(t => t.status === 'Pending').length;
    const inProgress = myAssignedTasks.filter(t => t.status === 'In Progress').length;
    const completed = myAssignedTasks.filter(t => t.status === 'Completed').length;
    return { total, pending, inProgress, completed };
  }, [myAssignedTasks]);

  // Split into Current vs Future Tasks (Tomorrow, 1 Week Later, etc.)
  const { currentTasks, futureTasks, currentCount, futureCount } = useMemo(() => {
    const current: ScheduleItem[] = [];
    const future: ScheduleItem[] = [];

    filteredTasks.forEach(task => {
      const timing = getTimingInfo(task.date, task.status);
      if (timing.isCurrent) {
        current.push(task);
      } else {
        future.push(task);
      }
    });

    // Sort future tasks chronologically by date
    future.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    let totalCurr = 0;
    let totalFut = 0;
    myAssignedTasks.forEach(task => {
      const timing = getTimingInfo(task.date, task.status);
      if (timing.isCurrent) totalCurr++;
      else totalFut++;
    });

    return { 
      currentTasks: current, 
      futureTasks: future,
      currentCount: totalCurr,
      futureCount: totalFut
    };
  }, [filteredTasks, myAssignedTasks]);

  // Brand Rates (sorted alphabetically)
  const filteredProducts = useMemo(() => {
    return [...products].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [products]);

  const handleSignOut = async () => {
    try {
      await performSecureLogout();
    } catch (e) {
      console.warn('Sign out warning:', e);
    }
    navigate('/login?portal=employee', { replace: true });
  };

  // Render an individual task card with crystal-clear timing badges (Today, Tomorrow, 1 Week Later, etc.)
  const renderTaskCard = (task: ScheduleItem, isFuture = false) => {
    const catStyle = CATEGORY_STYLES[task.category] || CATEGORY_STYLES['Work Task'];
    const isDone = task.status === 'Completed';
    const isInProg = task.status === 'In Progress';
    const timing = getTimingInfo(task.date, task.status);

    return (
      <div
        key={task.id}
        className={cn(
          "bg-white dark:bg-[#141414] border rounded-xl p-2.5 sm:p-3 shadow-2xs transition-all relative overflow-hidden space-y-1.5",
          isDone 
            ? "border-[#E5E7EB] dark:border-[#262626] opacity-75"
            : isFuture
            ? "border-purple-200/80 dark:border-purple-900/40 hover:border-purple-400/60"
            : "border-[#E5E7EB] dark:border-[#262626] hover:border-[#C22424]/40"
        )}
      >
        {/* Top Row: Meta Tags & Timing */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Prominent Timing Pill (Today, Tomorrow, 1 Week Later, etc.) */}
            <span className={cn(
              "text-[9.5px] font-extrabold px-1.5 py-0.2 rounded border shadow-2xs flex items-center gap-0.5",
              timing.badgeClass
            )}>
              {!isFuture ? <Clock className="w-2.5 h-2.5" /> : <CalendarClock className="w-2.5 h-2.5" />}
              <span>{timing.label}</span>
            </span>

            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.2 rounded border",
              catStyle.bg, catStyle.text, catStyle.border
            )}>
              {task.category}
            </span>

            <span className={cn(
              "text-[9px] font-bold px-1.5 py-0.2 rounded border",
              task.priority === 'High' 
                ? "bg-red-50 text-[#C22424] dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-900/40"
                : task.priority === 'Medium'
                ? "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-900/40"
                : "bg-slate-50 text-slate-700 dark:bg-slate-900 dark:text-slate-300 border-slate-200 dark:border-slate-800"
            )}>
              {task.priority}
            </span>
          </div>

          <span className={cn(
            "text-[9px] font-black uppercase tracking-wider px-1.5 py-0.2 rounded border shrink-0",
            isDone 
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400" 
              : isInProg
              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-400"
              : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400"
          )}>
            {task.status}
          </span>
        </div>

        {/* Task Title */}
        <h3 className={cn(
          "text-xs sm:text-[13px] font-bold text-[#111827] dark:text-white leading-snug",
          isDone && "line-through text-[#6B7280]"
        )}>
          {task.title}
        </h3>

        {/* Date and Time Row */}
        <div className="flex items-center gap-2 text-[10.5px] text-[#6B7280] flex-wrap">
          <span className="flex items-center gap-1 font-semibold text-[#111827] dark:text-neutral-200">
            <Calendar className="w-3 h-3 text-[#C22424]" />
            <span>{timing.formattedDate}</span>
          </span>
          {task.time && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-[#6B7280]" />
              <span>{task.time}</span>
            </span>
          )}
          {task.location && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="w-3 h-3 text-[#C22424] shrink-0" />
              <span className="truncate">{task.location}</span>
            </span>
          )}
        </div>

        {/* Future Task Notice */}
        {isFuture && !isDone && (
          <div className="px-2 py-1 rounded-lg bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200/60 dark:border-purple-900/40 text-[10px] text-purple-800 dark:text-purple-300 flex items-center justify-between">
            <span className="font-semibold flex items-center gap-1">
              <CalendarClock className="w-3 h-3 text-purple-600 dark:text-purple-400" />
              <span>Scheduled for {timing.relativeDateText} (Upcoming)</span>
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
              Assigned
            </span>
          </div>
        )}

        {/* Instructions */}
        {task.description && (
          <div className="p-2 rounded-lg bg-[#F9FAFB] dark:bg-neutral-900 border border-[#E5E7EB] dark:border-neutral-800 text-[10.5px] text-[#4B5563] dark:text-[#9CA3AF] leading-relaxed">
            <span className="font-bold text-[#111827] dark:text-white block text-[9px] uppercase tracking-wider">
              Instructions:
            </span>
            {task.description}
          </div>
        )}

        {/* Action Bar */}
        <div className="pt-1.5 border-t border-[#E5E7EB] dark:border-neutral-800 flex items-center justify-between">
          <span className="text-[10px] text-[#6B7280]">
            Assigned by Admin
          </span>

          <div className="flex items-center gap-1">
            {task.status === 'Pending' && (
              <button
                type="button"
                onClick={() => handleUpdateTaskStatus(task.id, 'In Progress')}
                className="px-2.5 py-1 bg-[#FEF2F2] hover:bg-[#FEE2E2] dark:bg-red-950/40 text-[#C22424] dark:text-red-300 border border-[#FECACA] dark:border-red-900/50 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer flex items-center gap-1 active:scale-95"
              >
                <span>Start Task</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}

            {task.status === 'In Progress' && (
              <button
                type="button"
                onClick={() => handleUpdateTaskStatus(task.id, 'Completed')}
                className="px-2.5 py-1 bg-[#C22424] hover:bg-[#A81C1C] text-white rounded-lg text-[10.5px] font-bold transition-all cursor-pointer shadow-2xs flex items-center gap-1 active:scale-95"
              >
                <Check className="w-3 h-3" />
                <span>Mark Done</span>
              </button>
            )}

            {task.status === 'Completed' && (
              <button
                type="button"
                onClick={() => handleUpdateTaskStatus(task.id, 'In Progress')}
                className="px-2 py-0.5 text-[10px] font-medium text-[#6B7280] hover:text-[#111827] dark:hover:text-white underline cursor-pointer"
              >
                Reopen
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-2.5 sm:px-4 py-2 font-sans text-[#111827] dark:text-[#FAFBFA] pb-24 space-y-2.5">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.96 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-[#111827] text-white px-3 py-1.5 rounded-lg shadow-md border border-neutral-700 flex items-center gap-1.5 text-[11px] font-bold"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>



      {/* ============================================================== */}
      {/* 1. COMPACT ASSIGNED WORK / SCHEDULE TAB */}
      {/* ============================================================== */}
      {activeTab === 'schedule' && (
        <div className="space-y-2">
          {/* Ultra-compact 4-column KPI strip */}
          <div className="grid grid-cols-4 gap-1.5">
            <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-xl p-2 text-center shadow-2xs">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#6B7280] block">Total</span>
              <span className="text-sm sm:text-base font-black text-[#111827] dark:text-white">{taskStats.total}</span>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-xl p-2 text-center shadow-2xs">
              <span className="text-[9px] font-bold uppercase tracking-wider text-[#C22424] block">Today/Active</span>
              <span className="text-sm sm:text-base font-black text-[#C22424] dark:text-red-400">{currentCount}</span>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-xl p-2 text-center shadow-2xs">
              <span className="text-[9px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 block">Future</span>
              <span className="text-sm sm:text-base font-black text-purple-600 dark:text-purple-400">{futureCount}</span>
            </div>
            <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-xl p-2 text-center shadow-2xs">
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">Done</span>
              <span className="text-sm sm:text-base font-black text-[#16A34A]">{taskStats.completed}</span>
            </div>
          </div>

          {/* Compact Filter and Search Toolbar */}
          <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-xl p-2 shadow-2xs space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="Search tasks, locations..."
                  className="w-full pl-8 pr-2 py-1 bg-[#F9FAFB] dark:bg-neutral-900 border border-[#E5E7EB] dark:border-[#262626] rounded-lg text-[11px] font-medium focus:outline-none focus:border-[#C22424] dark:text-white"
                />
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {(['ALL', 'Pending', 'In Progress', 'Completed'] as const).map(st => (
                  <button
                    key={st}
                    onClick={() => setTaskStatusFilter(st)}
                    className={cn(
                      "px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap",
                      taskStatusFilter === st
                        ? "bg-[#C22424] text-white shadow-2xs"
                        : "bg-[#F9FAFB] dark:bg-neutral-900 text-[#6B7280] hover:text-[#111827] dark:hover:text-white border border-[#E5E7EB] dark:border-[#262626]"
                    )}
                  >
                    {st === 'ALL' ? 'All' : st === 'In Progress' ? 'Active' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Timeframe Filter Pills: All | Current / Today | Future Tasks */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1 border-t border-[#E5E7EB] dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setTimeframeFilter('ALL')}
                className={cn(
                  "px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap",
                  timeframeFilter === 'ALL'
                    ? "bg-[#C22424] text-white shadow-2xs"
                    : "bg-[#F9FAFB] dark:bg-neutral-900 text-[#6B7280] hover:text-[#111827] dark:hover:text-white border border-[#E5E7EB] dark:border-[#262626]"
                )}
              >
                All Tasks ({currentTasks.length + futureTasks.length})
              </button>

              <button
                type="button"
                onClick={() => setTimeframeFilter('CURRENT')}
                className={cn(
                  "px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1",
                  timeframeFilter === 'CURRENT'
                    ? "bg-[#C22424] text-white shadow-2xs"
                    : "bg-[#F9FAFB] dark:bg-neutral-900 text-[#6B7280] hover:text-[#111827] dark:hover:text-white border border-[#E5E7EB] dark:border-[#262626]"
                )}
              >
                <span>🔥 Current & Today</span>
                <span className={cn(
                  "px-1 py-0.2 rounded-full text-[9px] font-black",
                  timeframeFilter === 'CURRENT' ? "bg-white/20 text-white" : "bg-[#FEF2F2] text-[#C22424] dark:bg-red-950/40 dark:text-red-300"
                )}>
                  {currentTasks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTimeframeFilter('FUTURE')}
                className={cn(
                  "px-2 py-0.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1",
                  timeframeFilter === 'FUTURE'
                    ? "bg-[#C22424] text-white shadow-2xs"
                    : "bg-[#F9FAFB] dark:bg-neutral-900 text-[#6B7280] hover:text-[#111827] dark:hover:text-white border border-[#E5E7EB] dark:border-[#262626]"
                )}
              >
                <span>📅 Future Tasks</span>
                <span className={cn(
                  "px-1 py-0.2 rounded-full text-[9px] font-black",
                  timeframeFilter === 'FUTURE' ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300"
                )}>
                  {futureTasks.length}
                </span>
              </button>
            </div>
          </div>

          {/* Task Sections List */}
          <div className="space-y-3">
            {/* Case: No tasks found at all */}
            {currentTasks.length === 0 && futureTasks.length === 0 && (
              <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-xl p-6 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-[#C22424] mx-auto" />
                <h4 className="text-xs font-bold text-[#111827] dark:text-white">
                  No assigned tasks found
                </h4>
                <p className="text-[10.5px] text-[#6B7280]">
                  {taskSearch || taskStatusFilter !== 'ALL'
                    ? "Try adjusting search or status filters."
                    : "All clear! Tasks assigned by admin will appear here."}
                </p>
              </div>
            )}

            {/* SECTION 1: CURRENT & TODAY'S TASKS */}
            {(timeframeFilter === 'ALL' || timeframeFilter === 'CURRENT') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#C22424] animate-pulse" />
                    <h3 className="text-xs font-bold text-[#111827] dark:text-white uppercase tracking-wider">
                      Current & Today's Tasks
                    </h3>
                    <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-[#FEF2F2] dark:bg-red-950/40 text-[#C22424] dark:text-red-300 border border-[#FECACA] dark:border-red-900/40">
                      {currentTasks.length}
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-[#6B7280]">Due Today & Active</span>
                </div>

                {currentTasks.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-neutral-900/50 border border-[#E5E7EB] dark:border-neutral-800 text-center text-[11px] text-[#6B7280]">
                    No current tasks due today.
                  </div>
                ) : (
                  currentTasks.map(task => renderTaskCard(task, false))
                )}
              </div>
            )}

            {/* SECTION 2: FUTURE SCHEDULED TASKS (TOMORROW, 1 WEEK LATER, ETC.) */}
            {(timeframeFilter === 'ALL' || timeframeFilter === 'FUTURE') && (
              <div className={cn("space-y-1.5", timeframeFilter === 'ALL' && "pt-2 border-t border-[#E5E7EB] dark:border-neutral-800")}>
                <div className="flex items-center justify-between px-1 py-0.5">
                  <div className="flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <h3 className="text-xs font-bold text-[#111827] dark:text-white uppercase tracking-wider">
                      Future Scheduled Tasks
                    </h3>
                    <span className="text-[9.5px] font-black px-1.5 py-0.2 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-900/40">
                      {futureTasks.length}
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-purple-700 dark:text-purple-300">
                    Tomorrow, 1 Week Later & Upcoming
                  </span>
                </div>

                {futureTasks.length === 0 ? (
                  <div className="p-3 rounded-xl bg-[#F9FAFB] dark:bg-neutral-900/50 border border-[#E5E7EB] dark:border-neutral-800 text-center text-[11px] text-[#6B7280]">
                    No future tasks scheduled.
                  </div>
                ) : (
                  futureTasks.map(task => renderTaskCard(task, true))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. COMPACT BRAND RATES TAB (READ-ONLY) */}
      {/* ============================================================== */}
      {activeTab === 'rates' && (
        <div className="space-y-2">


          {/* Compact Brand Rate Cards */}
          <div className="space-y-1.5">
            {filteredProducts.length === 0 ? (
              <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-xl p-6 text-center space-y-1">
                <Inbox className="w-6 h-6 text-[#9CA3AF] mx-auto" />
                <h4 className="text-xs font-bold text-[#111827] dark:text-white">
                  No rice varieties match filter
                </h4>
              </div>
            ) : (
              filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-xl p-2.5 sm:p-3 shadow-2xs hover:border-[#C22424]/40 transition-all space-y-1.5"
                >
                  {/* Row 1: Brand Name, Category, Stock Status */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {prod.category && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-[#C22424] dark:text-red-300 bg-[#FEF2F2] dark:bg-red-950/40 px-1.5 py-0.2 rounded border border-[#FECACA] dark:border-red-900/40 shrink-0">
                          {prod.category}
                        </span>
                      )}
                      <h3 className="text-xs sm:text-[13px] font-bold text-[#111827] dark:text-white truncate">
                        {prod.name}
                      </h3>
                    </div>

                    <span className={cn(
                      "text-[9px] font-bold px-1.5 py-0.2 rounded-full shrink-0 border",
                      prod.status === 'Low Stock'
                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-400"
                        : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-400"
                    )}>
                      {prod.status || 'In Stock'}
                    </span>
                  </div>

                  {/* Row 2: Specs Inline */}
                  <div className="flex items-center gap-2 text-[10.5px] text-[#6B7280] flex-wrap">
                    {prod.grade && (
                      <span className="flex items-center gap-0.5">
                        <Sparkles className="w-2.5 h-2.5 text-[#C22424]" />
                        <span>{prod.grade}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-0.5">
                      <Package className="w-2.5 h-2.5 text-[#C22424]" />
                      <span>{prod.bagSize || '50 KG Bag'}</span>
                    </span>
                    {prod.supplier && (
                      <span className="flex items-center gap-0.5 truncate">
                        <Building2 className="w-2.5 h-2.5 text-[#C22424]" />
                        <span className="truncate">{prod.supplier}</span>
                      </span>
                    )}
                  </div>

                  {/* Row 3: Live Price */}
                  <div className="pt-1.5 border-t border-[#E5E7EB] dark:border-neutral-800 flex items-center justify-between">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[10px] uppercase font-bold text-[#6B7280]">Rate:</span>
                      <span className="text-sm sm:text-base font-black text-[#C22424] dark:text-red-400">
                        ₹{formatINR(prod.price)}
                      </span>
                      <span className="text-[10px] font-bold text-[#6B7280]">/ QTL</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. COMPACT OPERATIONS PROFILE TAB */}
      {/* ============================================================== */}
      {activeTab === 'profile' && (
        <div className="space-y-2">
          {/* Identity Box */}
          <div className="bg-white dark:bg-[#141414] border border-[#E5E7EB] dark:border-[#262626] rounded-xl p-3 shadow-2xs space-y-2.5">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] dark:bg-red-950/40 text-[#C22424] dark:text-red-300 border border-[#FECACA] dark:border-red-900/40 flex items-center justify-center font-black text-base shrink-0">
                {employeeName.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-bold uppercase tracking-wider bg-[#FEF2F2] dark:bg-red-950/60 text-[#C22424] dark:text-red-300 px-1.5 py-0.2 rounded border border-[#FECACA] dark:border-red-900/40">
                    Operations
                  </span>
                  <h2 className="text-xs sm:text-sm font-bold text-[#111827] dark:text-white truncate">
                    {employeeName}
                  </h2>
                </div>
                <p className="text-[10.5px] text-[#6B7280] truncate">
                  ID: {employeeId} • {employeeEmail}
                </p>
              </div>
            </div>

          </div>



          {/* Sign Out Button */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full sm:w-auto px-4 py-1.5 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-[#C22424] dark:text-rose-300 text-xs font-bold rounded-xl transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer border border-rose-200 dark:border-rose-900/50"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
