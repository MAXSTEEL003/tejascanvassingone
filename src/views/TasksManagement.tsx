import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  User, 
  Tag, 
  X, 
  Building2, 
  Truck, 
  Bell, 
  CalendarDays, 
  CalendarRange, 
  ListTodo, 
  CheckSquare, 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Check,
  MapPin,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import SearchableSelect from '../components/SearchableSelect';
import { getCollectionDocs, syncCollection } from '../lib/firebase';

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
  colorBg?: string;
  colorText?: string;
  colorBorder?: string;
}

const employeeList = [
  'Vikram Singh',
  'Ananya Sharma',
  'Sarah Joseph',
  'Robert Chen',
  'Amit Patel',
  'Priya Nair'
];

const categoryList = [
  'Work Task',
  'Reminder',
  'Meeting',
  'Dispatch',
  'Payment Followup',
  'Quality Check'
];

const CATEGORY_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'Work Task': { bg: 'bg-blue-500/10 dark:bg-blue-500/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-500/30', dot: 'bg-blue-500' },
  'Reminder': { bg: 'bg-amber-500/10 dark:bg-amber-500/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-500/30', dot: 'bg-amber-500' },
  'Meeting': { bg: 'bg-purple-500/10 dark:bg-purple-500/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-500/30', dot: 'bg-purple-500' },
  'Dispatch': { bg: 'bg-emerald-500/10 dark:bg-emerald-500/20', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-500/30', dot: 'bg-emerald-500' },
  'Payment Followup': { bg: 'bg-rose-500/10 dark:bg-rose-500/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-500/30', dot: 'bg-rose-500' },
  'Quality Check': { bg: 'bg-indigo-500/10 dark:bg-indigo-500/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-500/30', dot: 'bg-indigo-500' },
};

const defaultSeedSchedules: ScheduleItem[] = [];

export default function TasksManagement() {
  const role = localStorage.getItem('userRole') || 'admin';
  const isEmployee = role === 'employee';

  const [schedules, setSchedules] = useState<ScheduleItem[]>(() => {
    const local = localStorage.getItem('schedule_events');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error("Error parsing schedule_events:", e);
      }
    }
    return defaultSeedSchedules;
  });

  // Date Navigation State
  const [currentDate, setCurrentDate] = useState<Date>(new Date()); // July 28, 2026
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day' | 'agenda'>('month');
  
  // Filters
  const [selectedAssignee, setSelectedAssignee] = useState<string>(isEmployee ? 'Vikram Singh' : 'all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState<boolean>(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleItem | null>(null);
  const [expandedDateStr, setExpandedDateStr] = useState<string | null>(null);

  // New Event Form
  const [newEvent, setNewEvent] = useState<Partial<ScheduleItem>>({
    title: '',
    category: 'Work Task',
    date: '2026-07-28',
    time: '10:00 AM',
    assignee: isEmployee ? 'Vikram Singh' : employeeList[0],
    priority: 'Medium',
    status: 'Pending',
    description: '',
    location: ''
  });

  // Sync state to local storage & cloud
  useEffect(() => {
    localStorage.setItem('schedule_events', JSON.stringify(schedules));
    syncCollection('schedules', schedules).catch(() => {});
  }, [schedules]);

  // Load cloud schedules on mount
  useEffect(() => {
    getCollectionDocs('schedules').then(docs => {
      if (Array.isArray(docs) && docs.length > 0) {
        setSchedules(docs as ScheduleItem[]);
      }
    }).catch(() => {});
  }, []);

  // Format YYYY-MM-DD
  const formatYMD = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const todayStr = formatYMD(new Date());

  // Filter schedules
  const filteredSchedules = schedules.filter(item => {
    // Assignee filter
    if (selectedAssignee !== 'all' && item.assignee !== selectedAssignee) return false;
    // Category filter
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchAssignee = item.assignee.toLowerCase().includes(q);
      const matchCategory = item.category.toLowerCase().includes(q);
      const matchDesc = (item.description || '').toLowerCase().includes(q);
      if (!matchTitle && !matchAssignee && !matchCategory && !matchDesc) return false;
    }
    return true;
  });

  // Today's schedule for active employee filter
  const todaysSchedule = filteredSchedules.filter(item => item.date === todayStr);

  // Month navigation helpers
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleSaveNewEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title?.trim()) return;

    const created: ScheduleItem = {
      id: `SCH-${Math.floor(100 + Math.random() * 900)}`,
      title: newEvent.title.trim(),
      category: (newEvent.category as any) || 'Work Task',
      date: newEvent.date || todayStr,
      time: newEvent.time || '10:00 AM',
      assignee: newEvent.assignee || employeeList[0],
      priority: (newEvent.priority as any) || 'Medium',
      status: (newEvent.status as any) || 'Pending',
      description: newEvent.description || '',
      location: newEvent.location || ''
    };

    setSchedules([created, ...schedules]);
    setIsAddModalOpen(false);
    setNewEvent({
      title: '',
      category: 'Work Task',
      date: todayStr,
      time: '10:00 AM',
      assignee: isEmployee ? 'Vikram Singh' : employeeList[0],
      priority: 'Medium',
      status: 'Pending',
      description: '',
      location: ''
    });
  };

  const handleToggleStatus = (id: string) => {
    setSchedules(prev => prev.map(item => {
      if (item.id === id) {
        const nextStatus = item.status === 'Completed' ? 'Pending' : item.status === 'Pending' ? 'In Progress' : 'Completed';
        return { ...item, status: nextStatus };
      }
      return item;
    }));
  };

  const handleDeleteEvent = (id: string) => {
    setSchedules(prev => prev.filter(item => item.id !== id));
    setIsDetailModalOpen(false);
    setSelectedEvent(null);
  };

  // Calendar Month Matrix Calculation
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed
  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

  // Month days
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const calendarGridCells = [];

  // Prev month padding cells
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const prevDate = new Date(year, month - 1, daysInPrevMonth - i);
    calendarGridCells.push({
      dateObj: prevDate,
      dateStr: formatYMD(prevDate),
      dayNum: daysInPrevMonth - i,
      isCurrentMonth: false,
      isToday: formatYMD(prevDate) === todayStr
    });
  }

  // Current month cells
  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(year, month, d);
    const dStr = formatYMD(curDate);
    calendarGridCells.push({
      dateObj: curDate,
      dateStr: dStr,
      dayNum: d,
      isCurrentMonth: true,
      isToday: dStr === todayStr
    });
  }

  // Next month padding cells to fill 35 or 42 grid slots
  const remainingSlots = (calendarGridCells.length > 35 ? 42 : 35) - calendarGridCells.length;
  for (let n = 1; n <= remainingSlots; n++) {
    const nextDate = new Date(year, month + 1, n);
    calendarGridCells.push({
      dateObj: nextDate,
      dateStr: formatYMD(nextDate),
      dayNum: n,
      isCurrentMonth: false,
      isToday: formatYMD(nextDate) === todayStr
    });
  }

  // Week View calculation (7 days surrounding currentDate)
  const getWeekDays = (baseDate: Date) => {
    const days = [];
    const curr = new Date(baseDate);
    const first = curr.getDate() - curr.getDay(); // First day is Sunday
    for (let i = 0; i < 7; i++) {
      const d = new Date(curr.setDate(first + i));
      days.push({
        dateObj: new Date(d),
        dateStr: formatYMD(d),
        dayNum: d.getDate(),
        dayName: d.toLocaleString('default', { weekday: 'short' }),
        isToday: formatYMD(d) === todayStr
      });
    }
    return days;
  };

  const weekDays = getWeekDays(currentDate);

  return (
    <div className="p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-outline-variant/30 pb-4 sm:pb-6">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-2xl bg-primary/10 text-primary font-bold shrink-0">
              <Calendar className="w-5 h-5 sm:w-6 sm:h-6" />
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2 flex-wrap">
                <span>{isEmployee ? "Your Work Schedule & Reminders" : "Work Schedule & Calendar"}</span>
                <span className="text-[9px] sm:text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary uppercase font-bold tracking-widest font-mono shrink-0">
                  Mobile Optimized
                </span>
              </h1>
              <p className="text-secondary text-xs sm:text-sm font-medium">
                {isEmployee 
                  ? "Track your assigned daily tasks, reminders, dispatches, and meetings." 
                  : "Google Calendar style view for managing staff tasks, reminders, dispatches, and meetings."}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto w-full sm:w-auto">
          <button 
            onClick={() => {
              setNewEvent(prev => ({ ...prev, date: todayStr }));
              setIsAddModalOpen(true);
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all text-xs sm:text-sm font-black uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            <span>Add Schedule / Reminder</span>
          </button>
        </div>
      </div>

      {/* TODAY'S FOCUS & REMINDERS BANNER */}
      <div className="p-3.5 sm:p-5 rounded-3xl bg-gradient-to-r from-primary/10 via-amber-500/5 to-purple-500/10 border border-primary/20 dark:border-primary/30 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-primary/10 pb-3">
          <div className="flex items-center gap-2.5 text-left">
            <div className="p-2 rounded-xl bg-primary text-white shadow-md shrink-0">
              <Bell className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-black text-neutral-900 dark:text-neutral-100 flex items-center gap-2 flex-wrap">
                <span>Today's Work ({new Date().toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' })})</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                  {todaysSchedule.length} Items
                </span>
              </h3>
              <p className="text-[11px] sm:text-xs text-neutral-600 dark:text-neutral-400">
                {isEmployee 
                  ? `Hi ${selectedAssignee !== 'all' ? selectedAssignee : 'Team'}, here are your urgent tasks queued for today.` 
                  : `Showing active tasks and reminders queued for today across team members.`}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setNewEvent({ title: '', category: 'Reminder', date: todayStr, assignee: selectedAssignee !== 'all' ? selectedAssignee : employeeList[0], priority: 'High', status: 'Pending' });
              setIsAddModalOpen(true);
            }}
            className="self-start sm:self-auto text-xs font-black text-primary hover:underline flex items-center gap-1 bg-white dark:bg-neutral-900 px-3 py-1.5 rounded-xl border border-primary/20 shadow-sm shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            + Quick Reminder
          </button>
        </div>

        {todaysSchedule.length === 0 ? (
          <div className="text-xs text-neutral-500 dark:text-neutral-400 italic py-2 text-left">
            No work or reminders scheduled for today. Click "+ Quick Reminder" above to add one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
            {todaysSchedule.map((item) => {
              const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['Work Task'];
              const isDone = item.status === 'Completed';

              return (
                <div 
                  key={item.id}
                  className={cn(
                    "p-3 rounded-2xl border bg-white dark:bg-neutral-900 flex items-start gap-3 transition-all text-left shadow-sm group hover:border-primary/40 active:bg-primary/5",
                    isDone && "opacity-60 bg-neutral-50 dark:bg-neutral-950"
                  )}
                >
                  <button 
                    onClick={() => handleToggleStatus(item.id)}
                    className={cn(
                      "mt-0.5 w-7 h-7 sm:w-6 sm:h-6 rounded-xl sm:rounded-lg border-2 flex items-center justify-center shrink-0 transition-all active:scale-90",
                      isDone 
                        ? "bg-emerald-500 border-emerald-500 text-white" 
                        : "border-neutral-300 dark:border-neutral-700 hover:border-primary text-transparent"
                    )}
                    title={isDone ? "Mark as Pending" : "Mark as Completed"}
                  >
                    <Check className="w-4 h-4 stroke-[3]" />
                  </button>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className={cn("px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border", style.bg, style.text, style.border)}>
                        {item.category}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-neutral-500 dark:text-neutral-400">
                        ⏰ {item.time}
                      </span>
                    </div>

                    <h4 
                      onClick={() => {
                        setSelectedEvent(item);
                        setIsDetailModalOpen(true);
                      }}
                      className={cn(
                        "text-xs sm:text-sm font-bold leading-tight line-clamp-2 cursor-pointer hover:text-primary transition-colors",
                        isDone && "line-through text-neutral-400"
                      )}
                    >
                      {item.title}
                    </h4>

                    <div className="flex items-center justify-between text-[10px] text-neutral-500 dark:text-neutral-400 pt-1">
                      <span className="flex items-center gap-1 font-semibold truncate">
                        <User className="w-3 h-3 text-primary shrink-0" />
                        <span className="truncate">{item.assignee}</span>
                      </span>
                      <span className={cn(
                        "font-black uppercase tracking-widest text-[8px] px-1.5 py-0.2 rounded shrink-0",
                        item.priority === 'High' ? 'text-rose-600 bg-rose-500/10' : item.priority === 'Medium' ? 'text-amber-600 bg-amber-500/10' : 'text-emerald-600 bg-emerald-500/10'
                      )}>
                        {item.priority}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CALENDAR TOOLBAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-surface-container-low/80 p-3 sm:p-4 rounded-3xl border border-outline-variant/30">
        
        {/* Date Navigation & View Mode */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-1 bg-surface border border-outline-variant/40 rounded-2xl p-1 shadow-sm">
              <button 
                onClick={handlePrev}
                className="p-2 hover:bg-surface-container rounded-xl text-secondary hover:text-on-surface transition-all active:scale-90"
                title="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button 
                onClick={handleToday}
                className="px-3 py-1.5 font-extrabold text-xs text-primary hover:bg-primary/5 rounded-xl transition-all uppercase tracking-wider"
              >
                Today
              </button>
              <button 
                onClick={handleNext}
                className="p-2 hover:bg-surface-container rounded-xl text-secondary hover:text-on-surface transition-all active:scale-90"
                title="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <h2 className="text-base sm:text-lg md:text-xl font-black tracking-tight font-display text-on-surface text-left">
              {monthName}
            </h2>
          </div>

          {/* View Switcher Tabs (Scrollable on mobile) */}
          <div className="flex items-center p-1 bg-surface border border-outline-variant/40 rounded-2xl shadow-sm text-xs font-bold overflow-x-auto no-scrollbar w-full sm:w-auto">
            {(['month', 'week', 'day', 'agenda'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "flex-1 sm:flex-none px-3 py-1.5 rounded-xl capitalize transition-all whitespace-nowrap text-center min-w-[60px]",
                  viewMode === mode 
                    ? "bg-primary text-white shadow-sm font-black" 
                    : "text-secondary hover:text-on-surface hover:bg-surface-container"
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2.5 w-full lg:w-auto">
          {/* Employee Filter */}
          <div className="w-full sm:w-44">
            <SearchableSelect
              options={[
                { value: 'all', label: '👥 All Staff Members' },
                ...employeeList.map(emp => ({ value: emp, label: `👤 ${emp}` }))
              ]}
              value={selectedAssignee}
              onChange={(val) => setSelectedAssignee(val || 'all')}
              placeholder="Filter Employee"
            />
          </div>

          {/* Category Filter */}
          <div className="w-full sm:w-40">
            <SearchableSelect
              options={[
                { value: 'all', label: '🏷️ All Categories' },
                ...categoryList.map(cat => ({ value: cat, label: cat }))
              ]}
              value={selectedCategory}
              onChange={(val) => setSelectedCategory(val || 'all')}
              placeholder="Category"
            />
          </div>

          {/* Search Box */}
          <div className="relative w-full sm:w-auto sm:flex-1 sm:min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" />
            <input 
              type="text" 
              placeholder="Search schedule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-surface border border-outline-variant/40 rounded-2xl py-2.5 pl-9 pr-3 text-xs font-medium focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
        </div>
      </div>

      {/* VIEW RENDERERS */}
      {viewMode === 'month' && (
        <div className="bg-surface border border-outline-variant/40 rounded-3xl overflow-hidden shadow-xl">
          {/* Mobile Tap Guide */}
          <div className="sm:hidden bg-primary/10 text-primary text-[11px] font-bold py-1.5 px-3 text-center border-b border-primary/20 flex items-center justify-center gap-1">
            <span>💡 Tap any date below to enlarge & check work details</span>
          </div>

          {/* Weekday Header */}
          <div className="grid grid-cols-7 border-b border-outline-variant/40 bg-surface-container-low text-center text-[10px] sm:text-xs font-black uppercase tracking-widest text-secondary py-2 sm:py-3">
            <div><span className="sm:hidden">S</span><span className="hidden sm:inline">Sun</span></div>
            <div><span className="sm:hidden">M</span><span className="hidden sm:inline">Mon</span></div>
            <div><span className="sm:hidden">T</span><span className="hidden sm:inline">Tue</span></div>
            <div><span className="sm:hidden">W</span><span className="hidden sm:inline">Wed</span></div>
            <div><span className="sm:hidden">T</span><span className="hidden sm:inline">Thu</span></div>
            <div><span className="sm:hidden">F</span><span className="hidden sm:inline">Fri</span></div>
            <div><span className="sm:hidden">S</span><span className="hidden sm:inline">Sat</span></div>
          </div>

          {/* Month Grid Cells */}
          <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-outline-variant/20">
            {calendarGridCells.map((cell, idx) => {
              const dayEvents = filteredSchedules.filter(item => item.date === cell.dateStr);

              return (
                <div 
                  key={idx}
                  onClick={() => {
                    // Clicking on a date expands it to show work in detail
                    setExpandedDateStr(cell.dateStr);
                  }}
                  className={cn(
                    "min-h-[72px] sm:min-h-[120px] p-1 sm:p-2 flex flex-col justify-between sm:justify-start transition-all group relative cursor-pointer hover:bg-primary/5 active:bg-primary/15 hover:border-primary/40",
                    !cell.isCurrentMonth && "bg-surface-container-lowest/40 opacity-50",
                    cell.isToday && "bg-primary/5 ring-2 ring-primary ring-inset font-bold"
                  )}
                >
                  {/* Top Cell Header */}
                  <div className="flex items-center justify-between mb-1 pointer-events-none">
                    <span className={cn(
                      "w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-black font-mono transition-all",
                      cell.isToday ? "bg-primary text-white shadow-md" : "text-on-surface"
                    )}>
                      {cell.dayNum}
                    </span>

                    {dayEvents.length > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Mobile Task Dots Indicator (< sm) */}
                  {dayEvents.length > 0 && (
                    <div className="sm:hidden flex items-center justify-center gap-1 my-1">
                      {dayEvents.slice(0, 3).map((item, i) => {
                        const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['Work Task'];
                        return (
                          <span 
                            key={i} 
                            className={cn("w-2 h-2 rounded-full", style.dot || "bg-primary")} 
                          />
                        );
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[8px] font-bold text-secondary">+</span>
                      )}
                    </div>
                  )}

                  {/* Desktop Event Chips (>= sm) */}
                  <div className="hidden sm:block space-y-1 overflow-y-auto max-h-[110px] scrollbar-thin pr-0.5">
                    {dayEvents.map((item) => {
                      const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['Work Task'];
                      const isDone = item.status === 'Completed';

                      return (
                        <div 
                          key={item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(item);
                            setIsDetailModalOpen(true);
                          }}
                          className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-bold border transition-all text-left flex items-center gap-1.5 shadow-2xs hover:scale-[1.02] cursor-pointer",
                            style.bg, style.text, style.border,
                            isDone && "line-through opacity-50 bg-neutral-200 dark:bg-neutral-800"
                          )}
                          title={`${item.time} - ${item.title} (${item.assignee})`}
                        >
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", style.dot)} />
                          <span className="font-mono text-[9px] shrink-0 opacity-80">{item.time}</span>
                          <span className="truncate font-black">{item.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* WEEK VIEW */}
      {viewMode === 'week' && (
        <div className="bg-surface border border-outline-variant/40 rounded-3xl overflow-hidden shadow-xl p-4">
          <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
            {weekDays.map((day) => {
              const dayEvents = filteredSchedules.filter(item => item.date === day.dateStr);

              return (
                <div 
                  key={day.dateStr}
                  onClick={() => setExpandedDateStr(day.dateStr)}
                  className={cn(
                    "p-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest flex flex-col gap-3 min-h-[300px] cursor-pointer hover:border-primary/50 transition-all",
                    day.isToday && "ring-2 ring-primary bg-primary/5"
                  )}
                >
                  <div className="flex items-center justify-between border-b border-outline-variant/30 pb-2">
                    <div>
                      <span className="text-[10px] font-black uppercase text-secondary tracking-widest">{day.dayName}</span>
                      <h4 className={cn("text-base font-black font-mono", day.isToday ? "text-primary" : "text-on-surface")}>
                        {day.dayNum}
                      </h4>
                    </div>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {dayEvents.length === 0 ? (
                      <span className="text-[10px] text-secondary italic">No events</span>
                    ) : (
                      dayEvents.map((item) => {
                        const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['Work Task'];
                        return (
                          <div 
                            key={item.id}
                            onClick={() => {
                              setSelectedEvent(item);
                              setIsDetailModalOpen(true);
                            }}
                            className={cn(
                              "p-2.5 rounded-xl border text-xs font-medium space-y-1 cursor-pointer transition-all hover:scale-[1.02] text-left shadow-sm",
                              style.bg, style.text, style.border
                            )}
                          >
                            <div className="flex justify-between items-center text-[9px] font-mono font-bold">
                              <span>{item.time}</span>
                              <span className="uppercase tracking-widest">{item.priority}</span>
                            </div>
                            <p className="font-bold text-xs leading-tight line-clamp-2">{item.title}</p>
                            <div className="flex items-center gap-1 text-[10px] opacity-80 pt-1">
                              <User className="w-3 h-3" />
                              <span className="truncate">{item.assignee}</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div className="bg-surface border border-outline-variant/40 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant/30 pb-4">
            <div>
              <h3 className="text-xl font-black text-on-surface">
                Schedule for {currentDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </h3>
              <p className="text-xs text-secondary">
                {filteredSchedules.filter(item => item.date === formatYMD(currentDate)).length} events scheduled
              </p>
            </div>
            <button 
              onClick={() => {
                setNewEvent(prev => ({ ...prev, date: formatYMD(currentDate) }));
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-xl text-xs font-bold uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>

          <div className="space-y-3">
            {filteredSchedules.filter(item => item.date === formatYMD(currentDate)).length === 0 ? (
              <div className="text-center py-12 text-secondary italic text-sm">
                No work items or reminders scheduled for this specific day.
              </div>
            ) : (
              filteredSchedules
                .filter(item => item.date === formatYMD(currentDate))
                .map((item) => {
                  const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['Work Task'];
                  const isDone = item.status === 'Completed';

                  return (
                    <div 
                      key={item.id}
                      className={cn(
                        "p-4 rounded-2xl border bg-surface-container-lowest flex items-start justify-between gap-4 transition-all text-left shadow-sm hover:border-primary/40",
                        isDone && "opacity-60"
                      )}
                    >
                      <div className="flex items-start gap-3 flex-1">
                        <button 
                          onClick={() => handleToggleStatus(item.id)}
                          className={cn(
                            "mt-1 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all",
                            isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-outline-variant hover:border-primary text-transparent"
                          )}
                        >
                          <Check className="w-4 h-4 stroke-[3]" />
                        </button>

                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border", style.bg, style.text, style.border)}>
                              {item.category}
                            </span>
                            <span className="text-xs font-mono font-bold text-secondary">{item.time}</span>
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                              item.priority === 'High' ? 'text-rose-600 bg-rose-500/10' : item.priority === 'Medium' ? 'text-amber-600 bg-amber-500/10' : 'text-emerald-600 bg-emerald-500/10'
                            )}>
                              {item.priority} Priority
                            </span>
                          </div>

                          <h4 
                            onClick={() => {
                              setSelectedEvent(item);
                              setIsDetailModalOpen(true);
                            }}
                            className={cn("text-base font-bold cursor-pointer hover:text-primary transition-colors", isDone && "line-through text-secondary")}
                          >
                            {item.title}
                          </h4>

                          {item.description && (
                            <p className="text-xs text-secondary line-clamp-2">{item.description}</p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-secondary pt-2">
                            <span className="flex items-center gap-1 font-semibold">
                              <User className="w-3.5 h-3.5 text-primary" />
                              Assignee: {item.assignee}
                            </span>
                            {item.location && (
                              <span className="flex items-center gap-1 font-semibold">
                                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                                {item.location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setSelectedEvent(item);
                            setIsDetailModalOpen(true);
                          }}
                          className="px-3 py-1.5 rounded-xl border border-outline-variant text-xs font-bold hover:bg-surface-container"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      )}

      {/* AGENDA / LIST VIEW */}
      {viewMode === 'agenda' && (
        <div className="bg-surface border border-outline-variant/40 rounded-3xl p-6 shadow-xl space-y-4">
          <h3 className="text-lg font-black text-on-surface border-b border-outline-variant/30 pb-3 text-left">
            Agenda Schedule View ({filteredSchedules.length} Items)
          </h3>

          <div className="space-y-3">
            {filteredSchedules.length === 0 ? (
              <div className="text-center py-12 text-secondary italic">No schedule items match your search or filters.</div>
            ) : (
              filteredSchedules.map((item) => {
                const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['Work Task'];
                const isDone = item.status === 'Completed';

                return (
                  <div 
                    key={item.id}
                    className={cn(
                      "p-4 rounded-2xl border bg-surface-container-lowest flex flex-col md:flex-row md:items-center justify-between gap-4 text-left shadow-sm hover:border-primary/40",
                      isDone && "opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <button 
                        onClick={() => handleToggleStatus(item.id)}
                        className={cn(
                          "mt-1 w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all",
                          isDone ? "bg-emerald-500 border-emerald-500 text-white" : "border-outline-variant hover:border-primary text-transparent"
                        )}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </button>

                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border", style.bg, style.text, style.border)}>
                            {item.category}
                          </span>
                          <span className="text-xs font-mono font-bold text-primary">{item.date} • {item.time}</span>
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                            item.priority === 'High' ? 'text-rose-600 bg-rose-500/10' : item.priority === 'Medium' ? 'text-amber-600 bg-amber-500/10' : 'text-emerald-600 bg-emerald-500/10'
                          )}>
                            {item.priority} Priority
                          </span>
                        </div>

                        <h4 
                          onClick={() => {
                            setSelectedEvent(item);
                            setIsDetailModalOpen(true);
                          }}
                          className={cn("text-base font-bold cursor-pointer hover:text-primary transition-colors", isDone && "line-through text-secondary")}
                        >
                          {item.title}
                        </h4>

                        <div className="flex items-center gap-4 text-xs text-secondary pt-1">
                          <span className="flex items-center gap-1 font-semibold">
                            <User className="w-3.5 h-3.5 text-primary" />
                            {item.assignee}
                          </span>
                          {item.location && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-rose-500" />
                              {item.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => {
                          setSelectedEvent(item);
                          setIsDetailModalOpen(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-xs font-bold"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ADD NEW SCHEDULE / REMINDER MODAL */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                <div className="flex items-center gap-2 text-left">
                  <div className="p-2 rounded-xl bg-primary text-white">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-on-surface">Add Schedule / Reminder</h3>
                    <p className="text-xs text-secondary">Assign a work item or reminder to team staff.</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsAddModalOpen(false)}
                  className="p-2 hover:bg-surface-container rounded-full transition-colors text-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveNewEvent} className="p-6 space-y-4 text-left">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Task / Reminder Title *</label>
                  <input 
                    autoFocus
                    required
                    type="text" 
                    placeholder="e.g. Check Quality for Batch #102 or Call Buyer" 
                    value={newEvent.title}
                    onChange={(e) => setNewEvent({...newEvent, title: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/60 rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Category</label>
                    <SearchableSelect
                      options={categoryList}
                      value={newEvent.category || 'Work Task'}
                      onChange={(val) => setNewEvent({...newEvent, category: val as any})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Assignee (Employee)</label>
                    <SearchableSelect
                      options={employeeList}
                      value={newEvent.assignee || employeeList[0]}
                      onChange={(val) => setNewEvent({...newEvent, assignee: val})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Scheduled Date</label>
                    <input 
                      type="date" 
                      value={newEvent.date}
                      onChange={(e) => setNewEvent({...newEvent, date: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/60 rounded-2xl px-4 py-2.5 text-xs font-bold font-mono outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Scheduled Time</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 10:30 AM"
                      value={newEvent.time}
                      onChange={(e) => setNewEvent({...newEvent, time: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/60 rounded-2xl px-4 py-2.5 text-xs font-bold font-mono outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Priority Level</label>
                    <SearchableSelect
                      options={[
                        { value: 'High', label: 'High Priority' },
                        { value: 'Medium', label: 'Medium Priority' },
                        { value: 'Low', label: 'Low Priority' }
                      ]}
                      value={newEvent.priority || 'Medium'}
                      onChange={(val) => setNewEvent({...newEvent, priority: val as any})}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Location / Gate</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Bay #4 or Gate 2"
                      value={newEvent.location}
                      onChange={(e) => setNewEvent({...newEvent, location: e.target.value})}
                      className="w-full bg-surface-container-low border border-outline-variant/60 rounded-2xl px-4 py-2.5 text-xs font-bold outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Description / Special Notes</label>
                  <textarea 
                    rows={2}
                    placeholder="Provide additional instructions for staff..."
                    value={newEvent.description}
                    onChange={(e) => setNewEvent({...newEvent, description: e.target.value})}
                    className="w-full bg-surface-container-low border border-outline-variant/60 rounded-2xl p-3 text-xs font-medium outline-none"
                  />
                </div>

                <div className="pt-3">
                  <button 
                    type="submit"
                    className="w-full bg-primary text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
                  >
                    Save & Deploy To Calendar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EVENT DETAIL & EDIT DRAWER */}
      <AnimatePresence>
        {isDetailModalOpen && selectedEvent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface border border-outline-variant rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-left"
            >
              <div className="p-5 border-b border-outline-variant flex justify-between items-center bg-surface-container-low">
                <div className="flex items-center gap-2">
                  <span className={cn(
                    "px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border",
                    (CATEGORY_STYLES[selectedEvent.category] || CATEGORY_STYLES['Work Task']).bg,
                    (CATEGORY_STYLES[selectedEvent.category] || CATEGORY_STYLES['Work Task']).text
                  )}>
                    {selectedEvent.category}
                  </span>
                  <span className="text-xs font-mono font-bold text-secondary">ID: {selectedEvent.id}</span>
                </div>
                <button 
                  onClick={() => setIsDetailModalOpen(false)}
                  className="p-1.5 hover:bg-surface-container rounded-full text-secondary"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <h3 className="text-lg font-black text-on-surface leading-tight">
                    {selectedEvent.title}
                  </h3>
                  <p className="text-xs font-mono font-bold text-primary mt-1">
                    📅 {selectedEvent.date} • ⏰ {selectedEvent.time}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-surface-container-low border border-outline-variant/40 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-secondary font-bold">Assignee:</span>
                    <span className="font-black text-on-surface flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-primary" />
                      {selectedEvent.assignee}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-secondary font-bold">Priority:</span>
                    <span className={cn(
                      "font-black uppercase text-[10px] px-2 py-0.5 rounded",
                      selectedEvent.priority === 'High' ? 'text-rose-600 bg-rose-500/10' : 'text-amber-600 bg-amber-500/10'
                    )}>
                      {selectedEvent.priority} Priority
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-secondary font-bold">Status:</span>
                    <span className={cn(
                      "font-black text-xs uppercase",
                      selectedEvent.status === 'Completed' ? 'text-emerald-600' : 'text-primary'
                    )}>
                      {selectedEvent.status}
                    </span>
                  </div>

                  {selectedEvent.location && (
                    <div className="flex justify-between items-center pt-1 border-t border-outline-variant/30">
                      <span className="text-secondary font-bold">Location:</span>
                      <span className="font-bold text-on-surface">{selectedEvent.location}</span>
                    </div>
                  )}
                </div>

                {selectedEvent.description && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-secondary">Description / Notes</label>
                    <p className="p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-medium text-on-surface leading-relaxed">
                      {selectedEvent.description}
                    </p>
                  </div>
                )}

                <div className="flex items-center gap-3 pt-2">
                  <button 
                    onClick={() => handleToggleStatus(selectedEvent.id)}
                    className={cn(
                      "flex-1 py-3 rounded-2xl font-black text-xs uppercase tracking-wider shadow-md transition-all",
                      selectedEvent.status === 'Completed' 
                        ? "bg-amber-500 text-white hover:bg-amber-600" 
                        : "bg-emerald-600 text-white hover:bg-emerald-700"
                    )}
                  >
                    {selectedEvent.status === 'Completed' ? 'Mark As Pending' : '✓ Mark As Completed'}
                  </button>

                  <button 
                    onClick={() => handleDeleteEvent(selectedEvent.id)}
                    className="p-3 rounded-2xl bg-rose-500/10 text-rose-600 hover:bg-rose-600 hover:text-white transition-all text-xs font-bold"
                    title="Delete event"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* EXPANDED DATE WORK INSPECTOR MODAL */}
      <AnimatePresence>
        {expandedDateStr && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-surface border border-outline-variant/60 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden text-left"
            >
              {/* Modal Header */}
              <div className="p-5 md:p-6 border-b border-outline-variant/40 bg-surface-container-low flex items-center justify-between gap-4 shrink-0">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-primary/10 text-primary">
                      <Calendar className="w-5 h-5" />
                    </span>
                    <h3 className="text-lg md:text-xl font-black text-on-surface tracking-tight">
                      {new Date(expandedDateStr + 'T00:00:00').toLocaleDateString('default', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </h3>
                  </div>
                  <p className="text-xs text-secondary font-medium pl-9">
                    Enlarged view for checking scheduled work, dispatches, & reminders
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      const d = new Date(expandedDateStr + 'T00:00:00');
                      setCurrentDate(d);
                      setViewMode('day');
                      setExpandedDateStr(null);
                    }}
                    className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all text-xs font-bold"
                  >
                    View in Day Timeline
                  </button>
                  <button 
                    onClick={() => setExpandedDateStr(null)}
                    className="p-2 hover:bg-surface-container rounded-full text-secondary hover:text-on-surface transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body: Large Work Item Cards */}
              <div className="p-5 md:p-6 overflow-y-auto space-y-4 flex-1">
                {(() => {
                  const dayItems = filteredSchedules.filter(item => item.date === expandedDateStr);
                  const completedCount = dayItems.filter(i => i.status === 'Completed').length;

                  if (dayItems.length === 0) {
                    return (
                      <div className="py-12 text-center space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center mx-auto text-secondary">
                          <CheckCircle2 className="w-6 h-6" />
                        </div>
                        <h4 className="text-base font-bold text-on-surface">No work scheduled for this date</h4>
                        <p className="text-xs text-secondary max-w-sm mx-auto">
                          There are no tasks, reminders, or staff assignments logged for {expandedDateStr}.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {/* Summary Stats Header */}
                      <div className="flex items-center justify-between p-3 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 text-xs font-bold">
                        <span className="text-secondary">
                          Total Scheduled Work: <strong className="text-on-surface">{dayItems.length}</strong>
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-extrabold">
                            ✓ {completedCount} Done
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-extrabold">
                            ⏳ {dayItems.length - completedCount} Pending
                          </span>
                        </div>
                      </div>

                      {/* Work Cards */}
                      <div className="space-y-3">
                        {dayItems.map((item) => {
                          const style = CATEGORY_STYLES[item.category] || CATEGORY_STYLES['Work Task'];
                          const isDone = item.status === 'Completed';

                          return (
                            <div 
                              key={item.id}
                              className={cn(
                                "p-4 md:p-5 rounded-2xl border bg-surface-container-lowest transition-all text-left shadow-sm hover:border-primary/50 space-y-3",
                                isDone && "opacity-75 bg-surface-container-low/50"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  <button 
                                    onClick={() => handleToggleStatus(item.id)}
                                    className={cn(
                                      "mt-0.5 w-6 h-6 rounded-lg border flex items-center justify-center shrink-0 transition-all",
                                      isDone ? "bg-emerald-600 border-emerald-600 text-white" : "border-outline-variant hover:border-primary text-transparent"
                                    )}
                                    title={isDone ? "Mark as pending" : "Mark as completed"}
                                  >
                                    <Check className="w-4 h-4 stroke-[3]" />
                                  </button>

                                  <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className={cn(
                                        "px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border",
                                        style.bg, style.text, style.border
                                      )}>
                                        {item.category}
                                      </span>
                                      <span className="text-xs font-mono font-bold text-primary bg-primary/5 px-2 py-0.5 rounded-md">
                                        ⏰ {item.time}
                                      </span>
                                      <span className={cn(
                                        "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded",
                                        item.priority === 'High' ? 'text-rose-600 bg-rose-500/10' : item.priority === 'Medium' ? 'text-amber-600 bg-amber-500/10' : 'text-emerald-600 bg-emerald-500/10'
                                      )}>
                                        {item.priority} Priority
                                      </span>
                                    </div>

                                    <h4 className={cn(
                                      "text-base md:text-lg font-black text-on-surface leading-snug pt-1",
                                      isDone && "line-through text-neutral-400"
                                    )}>
                                      {item.title}
                                    </h4>

                                    {item.description && (
                                      <p className="text-xs md:text-sm text-secondary font-medium leading-relaxed pt-1 bg-surface-container-low/60 p-3 rounded-xl border border-outline-variant/20">
                                        {item.description}
                                      </p>
                                    )}

                                    <div className="flex items-center gap-4 text-xs font-semibold text-secondary pt-2 flex-wrap">
                                      <span className="flex items-center gap-1 bg-surface-container-low px-2.5 py-1 rounded-lg">
                                        <User className="w-3.5 h-3.5 text-primary" />
                                        Assignee: <strong className="text-on-surface">{item.assignee}</strong>
                                      </span>
                                      {item.location && (
                                        <span className="flex items-center gap-1 bg-surface-container-low px-2.5 py-1 rounded-lg">
                                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                                          Location: <strong className="text-on-surface">{item.location}</strong>
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <button 
                                  onClick={() => {
                                    setSelectedEvent(item);
                                    setIsDetailModalOpen(true);
                                  }}
                                  className="p-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-secondary hover:text-on-surface transition-all shrink-0"
                                  title="Edit or inspect details"
                                >
                                  <Sparkles className="w-4 h-4 text-primary" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-outline-variant/40 bg-surface-container-low flex justify-between items-center shrink-0">
                <span className="text-xs text-secondary font-medium">
                  Press outside or click close to dismiss
                </span>
                <button 
                  onClick={() => setExpandedDateStr(null)}
                  className="px-5 py-2 bg-on-surface text-surface rounded-xl text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all"
                >
                  Close View
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
