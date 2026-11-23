// ============================================================================
// Sentry Error Tracking Configuration
// ============================================================================
// Centralized error tracking for production environments.
// Requires SENTRY_DSN environment variable to be set.
// ============================================================================

import * as Sentry from "@sentry/react";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const SENTRY_ENVIRONMENT = import.meta.env.MODE as string | undefined;

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

// Privacy (PDPL): identity goes to Sentry as the user id ONLY. Email and other
// PII must never reach a third party (worker request D-20261122-08, run 25).
export const setUser = (user: { id: string; email?: string; username?: string }) => {
  if (SENTRY_DSN) {
    // Accept legacy callers that pass email/username, but send id only.
    Sentry.setUser({ id: user.id });
  }
};

export const clearUser = () => {
  if (SENTRY_DSN) {
    Sentry.setUser(null);
  }
};
