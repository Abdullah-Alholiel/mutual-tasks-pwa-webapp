// ============================================================================
// Task Email Notification Utilities
// ============================================================================
// Uses Supabase Edge Functions to send emails
// Also creates in-app notifications for task events
// ============================================================================

import { getDatabaseClient } from '@/db';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';
import type { NotificationType } from '@/types';
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
 * Send task creation email notifications to project participants
 */
export async function notifyTaskCreated(
  taskId: number,
  projectId: number,
  creatorId: number
): Promise<void> {
  try {
    // Get Supabase configuration lazily (when function is called, not at module load)
    const supabaseUrl = getSupabaseUrlLazy();
    const supabaseAnonKey = getSupabaseAnonKeyLazy();

    const db = getDatabaseClient();

    // Get task, project, creator, and participants
    const [task, project, creator] = await Promise.all([
      db.tasks.getById(taskId),
      db.projects.getById(projectId),
      db.users.getById(creatorId),
    ]);

    if (!task || !project || !creator) {
      console.error('Failed to fetch task, project, or creator data');
      return;
    }

    // Get project participants (excluding creator)
    const projectData = await db.projects.getById(projectId);
    if (!projectData || !projectData.participantRoles) {
      return;
    }

    const participants = projectData.participantRoles
      .filter((pp) => pp.userId !== creatorId && !pp.removedAt)
      .map((pp) => pp.userId);

    if (participants.length === 0) {
      return; // No participants to notify
    }

    // Get participant user details
    const participantUsers = await db.users.getByIds(participants);

    // Create in-app notifications for all participants
    const message = `${creator.name} created "${task.title}" in ${project.name}`;

    // 1. In-app notifications
    try {
      console.log('[Notification] Creating in-app notifications for:', participantUsers.map(u => u.id));

      const inAppNotifications = participantUsers.map(participant => ({
        userId: typeof participant.id === 'string' ? parseInt(participant.id) : participant.id,
        type: 'task_created' as NotificationType,
        message,
        taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
        projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
        isRead: false,
        emailSent: false,
      }));

      await db.notifications.createMany(inAppNotifications);
      console.log('[Notification] ✅ In-app notifications created');
    } catch (notifError) {
      console.error('[Notification] ❌ Failed to create in-app notifications:', notifError);
      // Continue to push notifications even if in-app fails
    }

    // 2. Push notifications
    try {
      console.log('[Notification] Sending push notifications to:', participantUsers.map(u => u.id));

      // Send push notifications to all participants
      participantUsers.forEach(participant => {
        sendPushNotification({
          externalUserId: participant.id,
          title: 'New Task',
          message,
          url: `/projects/${project.id}`,
          data: { taskId: task.id, projectId: project.id },
        }).catch((err) => {
          console.error('[Notification] Failed individual push send:', err);
        });
      });
    } catch (pushError) {
      console.error('[Notification] ❌ Failed to initiate push notifications:', pushError);
    }

    // Send email to each participant via Supabase Edge Function
    const emailPromises = participantUsers.map(async (participant) => {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            type: 'task-created',
            to: participant.email,
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
            creator: {
              id: creator.id,
              name: creator.name,
              email: creator.email,
            },
            recipient: {
              id: participant.id,
              name: participant.name,
              email: participant.email,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to send email to ${participant.email}:`, response.status, errorText);
        }
      } catch (error) {
        console.error(`Error sending email to ${participant.email}:`, error);
      }
    });

    await Promise.all(emailPromises);
  } catch (error) {
    // Only log warning if it's a configuration error (which we've already logged)
    if (error instanceof Error && error.message.includes('not configured')) {
      // Configuration error already logged in lazy getters
      return;
    }
    console.error('Error sending task creation emails:', error);
    // Don't throw - email failures shouldn't block task creation
  }
}

/**
 * Send task completion notifications to project participants
 * Creates in-app notifications for all other participants
 */
export async function notifyTaskCompleted(
  taskId: number,
  projectId: number,
  completerId: number
): Promise<void> {
  try {
    const db = getDatabaseClient();

    // Get task, project, completer
    const [task, project, completer] = await Promise.all([
      db.tasks.getById(taskId),
      db.projects.getById(projectId),
      db.users.getById(completerId),
    ]);

    if (!task || !project || !completer) {
      console.error('Failed to fetch task, project, or completer data');
      return;
    }

    // Get project participants (excluding completer)
    const projectData = await db.projects.getById(projectId);
    if (!projectData || !projectData.participantRoles) {
      return;
    }

    const participants = projectData.participantRoles
      .filter((pp) => pp.userId !== completerId && !pp.removedAt)
      .map((pp) => pp.userId);

    if (participants.length === 0) {
      return; // No participants to notify
    }

    // Get participant user details
    const participantUsers = await db.users.getByIds(participants);

    // Create in-app notifications for all participants
    const message = `${completer.name} completed "${task.title}" in ${project.name}`;
    const inAppNotifications = participantUsers.map(participant => ({
      userId: typeof participant.id === 'string' ? parseInt(participant.id) : participant.id,
      type: 'task_completed' as NotificationType,
      message,
      taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
      projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
      isRead: false,
      emailSent: false,
    }));

    await db.notifications.createMany(inAppNotifications);

    // Send push notifications to all participants
    participantUsers.forEach(participant => {
      sendPushNotification({
        externalUserId: participant.id,
        title: 'Task Completed! 🎉',
        message,
        url: `/projects/${project.id}`,
      }).catch(() => { /* silent fail */ });
    });

    // Optionally send emails (if configured)
    try {
      const supabaseUrl = getSupabaseUrlLazy();
      const supabaseAnonKey = getSupabaseAnonKeyLazy();

      // Send email to each participant
      const emailPromises = participantUsers.map(async (participant) => {
        try {
          const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'apikey': supabaseAnonKey,
            },
            body: JSON.stringify({
              type: 'task-completed',
              to: participant.email,
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
                id: participant.id,
                name: participant.name,
                email: participant.email,
              },
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to send email to ${participant.email}:`, response.status, errorText);
          }
        } catch (error) {
          console.error(`Error sending email to ${participant.email}:`, error);
        }
      });

      await Promise.all(emailPromises);
    } catch (emailError) {
      // Email sending is optional, don't fail the main flow
      if (!(emailError instanceof Error && emailError.message.includes('not configured'))) {
        console.error('Error sending task completion emails:', emailError);
      }
    }
  } catch (error) {
    console.error('Error in notifyTaskCompleted:', error);
  }
}

/**
 * Send task recovery notification to project participants
 */
export async function notifyTaskRecovered(
  taskId: number,
  projectId: number,
  recovererId: number
): Promise<void> {
  try {
    const db = getDatabaseClient();

    const [task, project, recoverer] = await Promise.all([
      db.tasks.getById(taskId),
      db.projects.getById(projectId),
      db.users.getById(recovererId),
    ]);

    if (!task || !project || !recoverer) {
      return;
    }

    const projectData = await db.projects.getById(projectId);
    if (!projectData || !projectData.participantRoles) {
      return;
    }

    const participants = projectData.participantRoles
      .filter((pp) => pp.userId !== recovererId && !pp.removedAt)
      .map((pp) => pp.userId);

    if (participants.length === 0) {
      return;
    }

    const participantUsers = await db.users.getByIds(participants);

    // Create in-app notifications
    const message = `${recoverer.name} recovered "${task.title}" in ${project.name}`;
    const inAppNotifications = participantUsers.map(participant => ({
      userId: typeof participant.id === 'string' ? parseInt(participant.id) : participant.id,
      type: 'task_recovered' as NotificationType,
      message,
      taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
      projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
      isRead: false,
      emailSent: false,
    }));

    await db.notifications.createMany(inAppNotifications);

    // Send push notifications
    participantUsers.forEach(participant => {
      sendPushNotification({
        externalUserId: participant.id,
        title: 'Task Recovered',
        message,
        url: `/projects/${project.id}`,
      }).catch(() => { /* silent fail */ });
    });
  } catch (error) {
    console.error('Error in notifyTaskRecovered:', error);
  }
}

/**
 * Send project update notification to project participants
 */
export async function notifyProjectUpdated(
  projectId: number,
  updaterId: number
): Promise<void> {
  try {
    const db = getDatabaseClient();

    const [project, updater] = await Promise.all([
      db.projects.getById(projectId),
      db.users.getById(updaterId),
    ]);

    if (!project || !updater) {
      return;
    }

    const projectData = await db.projects.getById(projectId);
    if (!projectData || !projectData.participantRoles) {
      return;
    }

    const participants = projectData.participantRoles
      .filter((pp) => pp.userId !== updaterId && !pp.removedAt)
      .map((pp) => pp.userId);

    if (participants.length === 0) {
      return;
    }

    const participantUsers = await db.users.getByIds(participants);

    // Create in-app notifications
    const inAppNotifications = participantUsers.map(participant => ({
      userId: typeof participant.id === 'string' ? parseInt(participant.id) : participant.id,
      type: 'project_updated' as NotificationType,
      message: `${updater.name} updated the project "${project.name}" details`,
      projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
      isRead: false,
      emailSent: false,
    }));

    await db.notifications.createMany(inAppNotifications);
  } catch (error) {
    console.error('Error in notifyProjectUpdated:', error);
  }
}

/**
 * Send task update notification to project participants
 */
export async function notifyTaskUpdated(
  taskId: number,
  projectId: number,
  updaterId: number
): Promise<void> {
  try {
    const db = getDatabaseClient();

    const [task, project, updater] = await Promise.all([
      db.tasks.getById(taskId),
      db.projects.getById(projectId),
      db.users.getById(updaterId),
    ]);

    if (!task || !project || !updater) {
      return;
    }

    const projectData = await db.projects.getById(projectId);
    if (!projectData || !projectData.participantRoles) {
      return;
    }

    const participants = projectData.participantRoles
      .filter((pp) => pp.userId !== updaterId && !pp.removedAt)
      .map((pp) => pp.userId);

    if (participants.length === 0) {
      return;
    }

    const participantUsers = await db.users.getByIds(participants);

    // Create in-app notifications
    const message = `${updater.name} updated the task "${task.title}" in ${project.name}`;
    const inAppNotifications = participantUsers.map(participant => ({
      userId: typeof participant.id === 'string' ? parseInt(participant.id) : participant.id,
      type: 'task_updated' as NotificationType,
      message,
      taskId: typeof task.id === 'string' ? parseInt(task.id) : task.id,
      projectId: typeof project.id === 'string' ? parseInt(project.id) : project.id,
      isRead: false,
      emailSent: false,
    }));

    await db.notifications.createMany(inAppNotifications);

    // Send push notifications
    participantUsers.forEach(participant => {
      sendPushNotification({
        externalUserId: participant.id,
        title: 'Task Updated',
        message,
        url: `/projects/${project.id}`,
      }).catch(() => { /* silent fail */ });
    });
  } catch (error) {
    console.error('Error in notifyTaskUpdated:', error);
  }
}

