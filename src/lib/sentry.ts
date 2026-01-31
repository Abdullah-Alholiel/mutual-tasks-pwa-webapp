// ============================================================================
// Sentry Error Tracking Configuration
// ============================================================================
// Centralized error tracking for production environments.
// Requires SENTRY_DSN environment variable to be set.
// ============================================================================

import * as Sentry from "@sentry/react";

const SENTRY_DSN = (import.meta as any).env?.VITE_SENTRY_DSN;
const SENTRY_ENVIRONMENT = (import.meta as any).env?.MODE;

// Initialize Sentry only in production or if DSN is explicitly provided
export const initializeSentry = () => {
  if (SENTRY_DSN && SENTRY_ENVIRONMENT === 'production') {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENVIRONMENT,
      tracesSampleRate: 0.1, // Capture 10% of transactions for performance monitoring
      beforeSend(event, hint) {
        // Filter out client-side errors that are not actionable
        if (event.exception) {
          const error = hint.originalException;

          // Ignore network errors in development
          if (error instanceof Error) {
            if (error.message.includes('Network request failed') ||
                error.message.includes('Failed to fetch') ||
                error.message.includes('ChunkLoadError')) {
              return null;
            }
          }
        }
        return event;
      },
    });

    console.log('[Sentry] Initialized successfully');
  } else {
    console.log('[Sentry] Skipping initialization (no DSN or not production)');
  }
};

export const captureException = (error: Error, context?: Record<string, unknown>) => {
  if (SENTRY_DSN) {
    Sentry.captureException(error, {
      contexts: context ? { custom: context } : undefined,
    });
  }
};

export const captureMessage = (message: string, level: Sentry.SeverityLevel = 'info') => {
  if (SENTRY_DSN) {
    Sentry.captureMessage(message, level);
  }
};

export const setUser = (user: { id: string; email?: string; username?: string }) => {
  if (SENTRY_DSN) {
    Sentry.setUser(user);
  }
};

export const clearUser = () => {
  if (SENTRY_DSN) {
    Sentry.setUser(null);
  }
};
