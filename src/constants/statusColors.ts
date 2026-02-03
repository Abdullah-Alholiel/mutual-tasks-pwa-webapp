// ============================================================================
// Status Colors Constants - Single Source of Truth
// ============================================================================
// Standardized colors for all status indicators throughout the application
// Used for: task status, rings, badges, toasts, notifications
// ============================================================================

export const STATUS_COLORS = {
  // Core status colors
  success: '#10B981',      // Completed tasks, successful operations
  warning: '#FCD34D',      // Pending, recovered, late completion, warnings
  error: '#EF4444',        // Errors, deleted, overdue, destructive actions
  pending: '#FCD34D',      // Pending tasks (same as warning)

  // Extended status colors
  archived: '#64748B',     // Archived items, muted text
  purple: '#8B5CF6',       // Purple accent for special features

  // UI colors
  info: '#1D4ED8',         // Information, primary actions
  manager: '#1D4ED8',      // Manager role badge
  owner: '#FCD34D',        // Owner role badge (yellow/gold)

  // Ring colors for task completion indicators
  ring: {
    green: '#10B981',      // On-time completion
    yellow: '#FCD34D',     // Late/tardy completion
    red: '#EF4444',        // Expired, archived
    none: 'transparent',   // No ring
  },

  // Toast colors
  toast: {
    success: '#10B981',
    error: '#EF4444',
    warning: '#FCD34D',
    info: '#1D4ED8',
  },

  // Notification icon colors
  notification: {
    taskCreated: '#1D4ED8',
    taskCompleted: '#10B981',
    taskRecovered: '#FCD34D',
    taskDeleted: '#EF4444',
    taskOverdue: '#EF4444',
    projectJoined: '#1D4ED8',
    friendRequest: '#8B5CF6',
    friendAccepted: '#10B981',
    streakReminder: '#FCD34D',
  },
} as const;

export type StatusColor = (typeof STATUS_COLORS)[keyof typeof STATUS_COLORS];
export type RingColorType = keyof typeof STATUS_COLORS.ring;
export type ToastColorType = keyof typeof STATUS_COLORS.toast;
export type NotificationColorType = keyof typeof STATUS_COLORS.notification;

// Utility functions for accessing status colors
export const getStatusColor = (color: StatusColor): string => color as string;
export const getRingColor = (ring: RingColorType): string => STATUS_COLORS.ring[ring] as string;
export const getToastColor = (type: ToastColorType): string => STATUS_COLORS.toast[type] as string;
export const getNotificationColor = (type: NotificationColorType): string => STATUS_COLORS.notification[type] as string;

// CSS variable names for use in Tailwind config
export const STATUS_CSS_VARS = {
  success: 'hsl(var(--status-success))',
  warning: 'hsl(var(--status-warning))',
  error: 'hsl(var(--status-error))',
  pending: 'hsl(var(--status-pending))',
  archived: 'hsl(var(--status-archived))',
  purple: 'hsl(var(--status-purple))',
  info: 'hsl(var(--status-info))',
};
