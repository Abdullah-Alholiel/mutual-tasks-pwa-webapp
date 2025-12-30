// ============================================================================
// Notification Service
// ============================================================================
// Handles creating notifications and sending email notifications via Supabase
// ============================================================================

import type { Notification, Task, Project, User } from '@/types';
import { getDatabaseClient } from '@/db';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';

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
   * This method creates in-app notifications only
   */
  async notifyTaskInitiated(
    task: Task,
    project: Project,
    initiator: User,
    recipient: User
  ): Promise<Notification | null> {
    try {
      const db = getDatabaseClient();
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'project_joined', // Fallback as 'task_created' not in DB enum yet
        message: `${initiator.name} initiated "${task.title}" in ${project.name}`,
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });
      return notification;
    } catch (error) {
      console.error('Failed to create task initiated notification:', error);
      return null;
    }
  }

  /**
   * Send task accepted notification and email
   * Creates in-app notification only (no email template available)
   */
  async notifyTaskAccepted(
    task: Task,
    project: Project,
    accepter: User,
    recipient: User
  ): Promise<Notification | null> {
    try {
      const db = getDatabaseClient();
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'project_joined', // Fallback as 'task_created' not in DB enum yet
        message: `${accepter.name} accepted "${task.title}" in ${project.name}`,
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });
      return notification;
    } catch (error) {
      console.error('Failed to create task accepted notification:', error);
      return null;
    }
  }

  /**
   * Send task declined notification and email
   * Creates in-app notification only (no email template available)
   */
  async notifyTaskDeclined(
    task: Task,
    project: Project,
    decliner: User,
    recipient: User
  ): Promise<Notification | null> {
    try {
      const db = getDatabaseClient();
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'project_joined', // Fallback as 'task_deleted' not in DB enum yet
        message: `${decliner.name} declined "${task.title}" in ${project.name}`,
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });
      return notification;
    } catch (error) {
      console.error('Failed to create task declined notification:', error);
      return null;
    }
  }

  /**
   * Send task time proposed notification and email
   * Creates in-app notification only (no email template available)
   */
  async notifyTaskTimeProposed(
    task: Task,
    project: Project,
    proposer: User,
    recipient: User,
    proposedDate: Date
  ): Promise<Notification | null> {
    try {
      const db = getDatabaseClient();
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'project_joined', // Fallback as 'task_created' not in DB enum yet
        message: `${proposer.name} proposed a new time for "${task.title}" in ${project.name}`,
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });
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
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'project_joined', // Fallback as 'task_completed' not in DB enum yet
        message: `${completer.name} completed "${task.title}" in ${project.name}`,
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });

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
   * Send project joined notification
   * Creates in-app notification only
   */
  async notifyProjectJoined(
    project: Project,
    joiner: User,
    recipient: User
  ): Promise<Notification | null> {
    try {
      const db = getDatabaseClient();
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'project_joined',
        message: `${joiner.name} joined "${project.name}"`,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });
      return notification;
    } catch (error) {
      console.error('Failed to create project joined notification:', error);
      return null;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

