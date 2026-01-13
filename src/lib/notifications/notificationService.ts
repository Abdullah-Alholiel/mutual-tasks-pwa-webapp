// ============================================================================
// Notification Service
// ============================================================================
// Handles creating notifications, sending email notifications via Supabase,
// and triggering push notifications via OneSignal
// ============================================================================

import type { Notification, Task, Project, User } from '@/types';
import { getDatabaseClient } from '@/db';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';
import { sendPushNotification } from '@/lib/onesignal/pushNotificationApi';

/**
 * Get Supabase URL lazily (called inside functions, not at module load)
 * This ensures environment variables are available in Vite
 */
function getSupabaseUrlLazy(): string {
  const url = getSupabaseUrl();
  if (!url) {
    console.warn('Supabase URL not configured. Email notifications disabled.');
    throw new Error(
      'Supabase URL not configured. Please set VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in your .env file.'
    );
  }
  // Ensure URL doesn't have trailing slash
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Get Supabase Anon Key lazily (called inside functions, not at module load)
 * This ensures environment variables are available in Vite
 */
function getSupabaseAnonKeyLazy(): string {
  const key = getSupabaseAnonKey();
  if (!key) {
    console.warn('Supabase Anon Key not configured. Email notifications disabled.');
    throw new Error(
      'Supabase Anon Key not configured. Please set VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
    );
  }
  return key;
}

/**
 * Notification Service
 * Handles creating notifications and sending email notifications via Supabase Edge Functions
 */
export class NotificationService {
  constructor() { }

  /**
   * Send task initiated notification and email
   * Note: Task creation emails are handled separately via notifyTaskCreated in taskEmailNotifications.ts
   * This method creates in-app notifications and triggers push notifications
   */
  async notifyTaskCreated(
    task: Task,
    project: Project,
    creator: User,
    recipient: User
  ): Promise<Notification | null> {
    try {
      const db = getDatabaseClient();
      const message = `${creator.name} created "${task.title}" in ${project.name}`;
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'project_joined', // Fallback as 'task_created' not in DB enum yet
        message,
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });

      // Send push notification (fire and forget)
      sendPushNotification({
        externalUserId: recipient.id,
        title: 'New Task',
        message,
        url: `/projects/${project.id}`,
        data: { taskId: task.id, projectId: project.id },
      }).catch(err => console.warn('Push notification failed:', err));

      return notification;
    } catch (error) {
      console.error('Failed to create task created notification:', error);
      return null;
    }
  }

  /**
   * Send task accepted notification and push
   */
  async notifyTaskAccepted(
    task: Task,
    project: Project,
    accepter: User,
    recipient: User
  ): Promise<Notification | null> {
    try {
      const db = getDatabaseClient();
      const message = `${accepter.name} accepted "${task.title}" in ${project.name}`;
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'project_joined',
        message,
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });

      sendPushNotification({
        externalUserId: recipient.id,
        title: 'Task Accepted',
        message,
        url: `/projects/${project.id}`,
      }).catch(err => console.warn('Push notification failed:', err));

      return notification;
    } catch (error) {
      console.error('Failed to create task accepted notification:', error);
      return null;
    }
  }

  /**
   * Send task declined notification and push
   */
  async notifyTaskDeclined(
    task: Task,
    project: Project,
    decliner: User,
    recipient: User
  ): Promise<Notification | null> {
    try {
      const db = getDatabaseClient();
      const message = `${decliner.name} declined "${task.title}" in ${project.name}`;
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'project_joined',
        message,
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });

      sendPushNotification({
        externalUserId: recipient.id,
        title: 'Task Declined',
        message,
        url: `/projects/${project.id}`,
      }).catch(err => console.warn('Push notification failed:', err));

      return notification;
    } catch (error) {
      console.error('Failed to create task declined notification:', error);
      return null;
    }
  }

  /**
   * Send task time proposed notification and push
   */
  async notifyTaskTimeProposed(
    task: Task,
    project: Project,
    proposer: User,
    recipient: User,
    _proposedDate: Date
  ): Promise<Notification | null> {
    try {
      const db = getDatabaseClient();
      const message = `${proposer.name} proposed a new time for "${task.title}" in ${project.name}`;
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'project_joined',
        message,
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });

      sendPushNotification({
        externalUserId: recipient.id,
        title: 'Time Proposed',
        message,
        url: `/projects/${project.id}`,
      }).catch(err => console.warn('Push notification failed:', err));

      return notification;
    } catch (error) {
      console.error('Failed to create task time proposed notification:', error);
      return null;
    }
  }

  /**
   * Send task completed notification and email via Supabase Edge Function
   */
  async notifyTaskCompleted(
    task: Task,
    project: Project,
    completer: User,
    recipient: User
  ): Promise<Notification | null> {
    try {
      const db = getDatabaseClient();

      // Create notification in database
      const message = `${completer.name} completed "${task.title}" in ${project.name}`;
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'project_joined',
        message,
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });

      // Send push notification (fire and forget)
      sendPushNotification({
        externalUserId: recipient.id,
        title: 'Task Completed! 🎉',
        message,
        url: `/projects/${project.id}`,
      }).catch(err => console.warn('Push notification failed:', err));

      // Send email via Supabase Edge Function
      // Get Supabase configuration lazily (when function is called, not at module load)
      try {
        const supabaseUrl = getSupabaseUrlLazy();
        const supabaseAnonKey = getSupabaseAnonKeyLazy();

        const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            type: 'task-completed',
            to: recipient.email,
            task: {
              id: task.id,
              title: task.title,
              description: task.description,
              dueDate: task.dueDate,
            },
            project: {
              id: project.id,
              name: project.name,
            },
            completer: {
              id: completer.id,
              name: completer.name,
              email: completer.email,
            },
            recipient: {
              id: recipient.id,
              name: recipient.name,
              email: recipient.email,
            },
          }),
        });

        if (response.ok && notification.id) {
          await db.notifications.markEmailSent(typeof notification.id === 'string' ? parseInt(notification.id) : notification.id);
          // Update notification object
          notification.emailSent = true;
        } else {
          const errorText = await response.text();
          console.error(`Failed to send task completed email to ${recipient.email}:`, response.status, errorText);
        }
      } catch (emailError) {
        // Only log warning if it's a configuration error (which we've already logged)
        if (emailError instanceof Error && emailError.message.includes('not configured')) {
          // Configuration error already logged in lazy getters
        } else {
          console.error('Failed to send task completed email:', emailError);
        }
      }

      return notification;
    } catch (error) {
      console.error('Failed to create task completed notification:', error);
      return null;
    }
  }

  /**
   * Send project joined notification and push
   */
  async notifyProjectJoined(
    project: Project,
    joiner: User,
    recipient: User
  ): Promise<Notification | null> {
    try {
      const db = getDatabaseClient();
      const message = `${joiner.name} joined "${project.name}"`;
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'project_joined',
        message,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });

      sendPushNotification({
        externalUserId: recipient.id,
        title: 'New Member',
        message,
        url: `/projects/${project.id}`,
      }).catch(err => console.warn('Push notification failed:', err));

      return notification;
    } catch (error) {
      console.error('Failed to create project joined notification:', error);
      return null;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

