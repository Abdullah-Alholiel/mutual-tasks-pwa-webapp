// ============================================================================
// Error Handling Utilities - Consistent Error Management
// ============================================================================
// 
// This file provides standardized error handling utilities
// that should be used consistently across all components.
// ============================================================================

import { toast } from '@/components/ui/sonner';

export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
}

/**
 * Handle errors consistently across the application
 * 
 * @param error - Error object or string
 * @param context - Optional context for logging
 * @param showToast - Whether to show toast notification (default: true)
 */
export const handleError = (
  error: unknown,
  context?: string,
  showToast: boolean = true
): void => {
  // Extract error message
  let errorMessage = 'An unexpected error occurred';
  
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === 'string') {
    errorMessage = error;
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String(error.message);
  }

  // Log error in development
  if (import.meta.env.DEV) {
    console.error(`[${context || 'Error'}]`, error);
  }

  // Show toast notification
  if (showToast) {
    toast.error('Error', {
      description: errorMessage,
    });
  }
};

/**
 * Handle async operations with error handling
 * 
 * @param operation - Async function to execute
 * @param context - Optional context for logging
 * @param onSuccess - Optional success callback
 * @param onError - Optional error callback
 */
export const handleAsync = async <T>(
  operation: () => Promise<T>,
  context?: string,
  onSuccess?: (result: T) => void,
  onError?: (error: unknown) => void
): Promise<T | null> => {
  try {
    const result = await operation();
    if (onSuccess) {
      onSuccess(result);
    }
    return result;
  } catch (error) {
    handleError(error, context);
    if (onError) {
      onError(error);
    }
    return null;
  }
};


