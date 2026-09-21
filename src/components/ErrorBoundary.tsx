import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught runtime error caught by boundary:', error, errorInfo);
  }

  private handleReset = () => {
    try {
      sessionStorage.clear();
    } catch (e) {}
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleClearAllAndReload = () => {
    try {
      sessionStorage.clear();
      // Keep essential login info, reset temporary caches
      const userRole = localStorage.getItem('userRole');
      const userName = localStorage.getItem('userName');
      const theme = localStorage.getItem('theme');
      
      localStorage.clear();
      if (userRole) localStorage.setItem('userRole', userRole);
      if (userName) localStorage.setItem('userName', userName);
      if (theme) localStorage.setItem('theme', theme);
    } catch (e) {}
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public override render() {
    if (this.state.hasError) {
      const isRateLimit = this.state.error?.message?.toLowerCase().includes('quota') || 
                          this.state.error?.message?.toLowerCase().includes('resource') ||
                          this.state.error?.message?.toLowerCase().includes('rate');

      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-50 dark:bg-neutral-950 text-slate-900 dark:text-neutral-100 font-sans">
          <div className="max-w-md w-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7" />
            </div>

            <div>
              <h2 className="text-xl font-black text-slate-900 dark:text-neutral-100 tracking-tight">
                {isRateLimit ? 'Database Limit Exceeded' : 'Application Recovered'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-neutral-400 mt-2 leading-relaxed">
                {isRateLimit 
                  ? 'Firestore requests hit temporary rate limits. The app is falling back to local cached data automatically.' 
                  : (this.state.error?.message || 'A temporary display issue occurred while rendering this page.')}
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold rounded-xl text-xs transition-all shadow-md cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>

              <button
                onClick={this.handleClearAllAndReload}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 active:scale-[0.98] text-slate-700 dark:text-neutral-300 font-bold rounded-xl text-xs transition-all border border-slate-200 dark:border-neutral-700 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-slate-500 dark:text-neutral-400" />
                Clear Local Cache & Reset
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

