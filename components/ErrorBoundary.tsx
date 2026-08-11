import React from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackMessage?: string;
}

/**
 * ErrorBoundary: Catches any render-time exceptions in the subtree
 * and displays a recoverable error UI instead of a blank white screen.
 */
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error?.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-charcoal text-white flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center space-y-6 glass-strong rounded-[2rem] p-10">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <AlertTriangle className="w-8 h-8 text-rose-400" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Something went wrong</h2>
              <p className="text-zinc-500 text-sm font-medium">
                {this.props.fallbackMessage || 'A rendering error occurred. Please try again.'}
              </p>
              {this.state.errorMessage && (
                <p className="text-[10px] font-mono text-zinc-700 bg-black/30 rounded-lg px-3 py-2 mt-2 text-left break-all">
                  {this.state.errorMessage}
                </p>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold uppercase tracking-widest hover:bg-indigo-500/30 transition-all"
              >
                <RefreshCcw className="w-3.5 h-3.5" />
                Try Again
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="px-5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-zinc-400 text-xs font-bold uppercase tracking-widest hover:bg-white/[0.07] transition-all"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
