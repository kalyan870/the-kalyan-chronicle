import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Broadsheet UI boundary caught error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f7f3ea] text-[#161513] flex items-center justify-center p-6">
          <div className="max-w-md w-full border-2 border-[#2b2925] bg-[#fcfaf4] p-6 space-y-4">
            <p className="text-xs uppercase tracking-widest text-[#8b261d] font-medium">
              Pressroom Recovery Notice
            </p>
            <h1 className="font-display text-2xl font-bold">
              The Kalyan Chronicle encountered a display interruption
            </h1>
            <p className="text-sm text-[#524e46] leading-relaxed">
              An unexpected error interrupted rendering this section. Reload the broadsheet to restore the latest edition.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="bg-[#8b261d] px-4 py-2 text-xs font-medium text-[#FCF9F5] hover:bg-[#701D16] transition-colors cursor-pointer"
            >
              Reload Edition
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
