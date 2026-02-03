// ============================================================================
// ErrorBoundary Component - React Error Boundary for Production
// ============================================================================
// Catches React component errors and displays a fallback UI
// Prevents white screens and provides graceful degradation
// ============================================================================

import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error);
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="w-16 h-16 mb-4 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Something went wrong
          </h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            An unexpected error occurred. Please try again or reload the page.
          </p>
          <div className="flex gap-3">
            <Button onClick={this.handleRetry} variant="default">
              Try Again
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// ============================================================================
// Page Error Boundary - Specialized for page-level errors
// ============================================================================

interface PageErrorBoundaryProps {
  children: ReactNode;
  title?: string;
}

export function PageErrorBoundary({ children, title }: PageErrorBoundaryProps) {
  return (
    <ErrorBoundary
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center">
          <div className="w-20 h-20 mb-6 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            {title || 'Page Error'}
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md">
            We encountered an error while loading this page. This might be a
            temporary issue. Please try again or return to the home page.
          </p>
          <div className="flex gap-4">
            <Button onClick={() => window.location.reload()} variant="default">
              Refresh Page
            </Button>
            <Button
              onClick={() => (window.location.href = '/')}
              variant="outline"
            >
              Go Home
            </Button>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

// ============================================================================
// Async Error Boundary - For async operations
// ============================================================================

interface AsyncErrorBoundaryProps {
  children: ReactNode;
  onError?: (error: Error) => void;
  errorMessage?: string;
}

export function AsyncErrorBoundary({
  children,
  onError,
  errorMessage = 'An error occurred while loading data',
}: AsyncErrorBoundaryProps) {
  return (
    <ErrorBoundary
      onError={(error) => {
        console.error('[AsyncErrorBoundary] Error:', error);
        onError?.(error);
      }}
      fallback={
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <div className="w-12 h-12 mb-3 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-6 h-6 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <p className="text-muted-foreground text-sm">{errorMessage}</p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
