// ============================================================================
// Browser Notification Service - Native Browser Notification Management
// ============================================================================
// Handles requesting permissions, showing notifications, and managing state
//
// Purpose:
// - Abstraction layer for the native Browser Notification API
// - Centralized management of notification permissions
// - Error handling and graceful degradation when not supported
//
// Browser Support:
// - Chrome, Firefox, Edge, Safari (with user permission)
// - Not supported in private/incognito mode on some browsers
// - Always check isSupported() before using notification features
//
// Usage:
// 1. Check if supported: browserNotificationService.isSupported()
// 2. Check current permission: browserNotificationService.getPermission()
// 3. Request permission (on user action): browserNotificationService.requestPermission()
// 4. Show notification: browserNotificationService.showNotification(notification)
//
// Note: Most browsers require user interaction before requesting permission
// Requesting permission proactively (without user gesture) may be blocked
// ============================================================================

import type { Notification } from '@/types';

/**
 * Notification Permission Status
 * Maps to the native Notification.permission API
 *
 * - GRANTED: User has explicitly allowed notifications
 * - DENIED: User has explicitly blocked notifications
 * - DEFAULT: User hasn't made a choice yet (or permission was reset)
 */
export enum NotificationPermission {
  GRANTED = 'granted',
  DENIED = 'denied',
  DEFAULT = 'default',
}

/**
 * BrowserNotificationService
 *
 * Singleton service for managing native browser notifications.
 * Provides a consistent interface across different browsers and
 * handles permission states and error cases gracefully.
 *
 * Features:
 * - Support detection for feature detection
 * - Permission state management
 * - Notification display with error handling
 * - Prevent duplicate permission requests
 */
class BrowserNotificationService {
  /**
   * Flag to prevent multiple permission requests
   * Browsers typically only allow one permission prompt
   * Once denied, user must manually enable in settings
   */
  private permissionRequested = false;

  /**
   * Check if the current browser supports notifications
   *
   * @returns true if notifications are supported, false otherwise
   *
   * @example
   * if (browserNotificationService.isSupported()) {
   *   // Safe to use notification APIs
   * }
   */
  isSupported(): boolean {
    return 'Notification' in window;
  }

  /**
   * Get the current permission status
   *
   * @returns The current permission state (granted, denied, or default)
   *
   * @example
   * const permission = browserNotificationService.getPermission();
   * if (permission === NotificationPermission.GRANTED) {
   *   // Can show notifications
   * }
   */
  getPermission(): NotificationPermission {
    if (!this.isSupported()) return NotificationPermission.DEFAULT;
    return Notification.permission as NotificationPermission;
  }

  /**
   * Request notification permission from the user
   *
   * IMPORTANT: Call this in response to a user action (button click)
   * Proactive calls may be blocked by browsers
   *
   * @returns Promise resolving to the permission result
   *
   * @example
   * // In a button click handler:
   * const handleEnableNotifications = async () => {
   *   const permission = await browserNotificationService.requestPermission();
   *   if (permission === NotificationPermission.GRANTED) {
   *     // Show success message
   *   }
   * };
   */
  async requestPermission(): Promise<NotificationPermission> {
    // Exit early if not supported
    if (!this.isSupported()) return NotificationPermission.DEFAULT;

    // Return current state if already requested
    // Prevents multiple prompts which browsers block anyway
    if (this.permissionRequested) {
      return this.getPermission();
    }

    // Mark as requested (even if it fails, we don't retry)
    this.permissionRequested = true;

    // If permission is already set (granted or denied), return current state
    if (this.getPermission() !== NotificationPermission.DEFAULT) {
      return this.getPermission();
    }

    // Request permission from user
    // This triggers the browser's native permission dialog
    return new Promise((resolve) => {
      Notification.requestPermission().then((permission) => {
        resolve(permission as NotificationPermission);
      });
    });
  }

  /**
   * Show a browser notification for a notification item
   *
   * @param notification - The notification object containing message and metadata
   * @returns true if notification was shown successfully, false otherwise
   *
   * @example
   * browserNotificationService.showNotification(newNotification);
   */
  showNotification(notification: Notification): boolean {
    // Exit early if not supported
    if (!this.isSupported()) return false;

    const permission = this.getPermission();

    // Only show if permission is granted
    if (permission === NotificationPermission.GRANTED) {
      try {
        new window.Notification('Mutual Tasks', {
          body: notification.message,
          icon: '/icons/icon-192x192.png',
          tag: `notification-${notification.id}`,
          requireInteraction: false,
          silent: false,
        });
        return true;
      } catch (error) {
        console.warn('[BrowserNotification] Failed to show notification:', error);
        return false;
      }
    }

    // Permission not granted - notification not shown
    return false;
  }

  /**
   * Quick check if notifications can be shown
   * Combines support check and permission check
   *
   * @returns true if notifications can be shown, false otherwise
   *
   * @example
   * if (browserNotificationService.canShowNotifications()) {
   *   // User will see browser notifications
   * }
   */
  canShowNotifications(): boolean {
    return this.isSupported() && this.getPermission() === NotificationPermission.GRANTED;
  }

  /**
   * Check if permission has been requested
   * Useful for UI state (e.g., disable button after request)
   *
   * @returns true if permission has been requested
   */
  isPermissionRequested(): boolean {
    return this.permissionRequested;
  }
}

// Export singleton instance for use throughout the application
export const browserNotificationService = new BrowserNotificationService();

// Export class for testing or custom instantiation
export default BrowserNotificationService;
