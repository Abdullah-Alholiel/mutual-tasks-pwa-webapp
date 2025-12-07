// ============================================================================
// Notification Service
// ============================================================================
// Handles creating notifications and sending email notifications via Supabase
// ============================================================================

import type { Notification, Task, Project, User } from '@/types';
import { getDatabaseClient } from '@/db';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();

/**
 * Notification Service
 * Handles creating notifications and sending email notifications via Supabase Edge Functions
 */
export class NotificationService {
  constructor() {}

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
        type: 'task_created', // Using task_created as closest match
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
        type: 'task_created', // Using task_created as closest match
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
        type: 'task_deleted', // Using task_deleted as closest match for declined
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
        type: 'task_created', // Using task_created as closest match
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
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('Supabase not configured. Email notifications disabled.');
      // Still create notification in database
    }

    try {
      const db = getDatabaseClient();
      
      // Create notification in database
      const notification = await db.notifications.create({
        userId: typeof recipient.id === 'string' ? parseInt(recipient.id) : recipient.id,
        type: 'task_completed',
        message: `${completer.name} completed "${task.title}" in ${project.name}`,
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      });

      // Send email via Supabase Edge Function
      if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        try {
          const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
          }
        } catch (error) {
          console.error('Failed to send task completed email:', error);
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

