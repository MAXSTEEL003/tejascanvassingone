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
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-neutral-950 text-neutral-100 font-sans">
          <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-2xl p-6 shadow-2xl text-center space-y-5">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div>
              <h2 className="text-xl font-bold text-neutral-100">
                {isRateLimit ? 'Database Limit Exceeded' : 'Application Recovered'}
              </h2>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                {isRateLimit 
                  ? 'Firestore requests hit temporary rate limits. The app is falling back to local cached data automatically.' 
                  : (this.state.error?.message || 'A temporary display issue occurred while rendering this page.')}
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <button
                onClick={this.handleReset}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs transition-colors shadow-lg shadow-emerald-950/40"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Application
              </button>

              <button
                onClick={this.handleClearAllAndReload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium rounded-xl text-xs transition-colors border border-neutral-700"
              >
                <Trash2 className="w-4 h-4 text-neutral-400" />
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

