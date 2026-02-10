import { getDatabaseClient } from '@/db';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';
import type { NotificationType } from '@/types';
import { sendPushNotification } from '@/lib/onesignal/pushNotificationApi';
import { getNotificationMessage } from './notificationMessages';

/**
 * Configuration for which channels to notify on for each notification type
 */
const NOTIFICATION_CHANNELS: Record<NotificationType, { inApp: boolean; push: boolean; email: boolean }> = {
  task_created: { inApp: true, push: true, email: false },
  task_completed: { inApp: true, push: true, email: false },
  task_recovered: { inApp: true, push: true, email: false },
  task_deleted: { inApp: true, push: true, email: false },
  task_updated: { inApp: true, push: true, email: false },
  task_overdue: { inApp: true, push: true, email: false },
  project_joined: { inApp: true, push: true, email: false },
  project_updated: { inApp: true, push: true, email: false },
  project_created: { inApp: true, push: true, email: true },
  project_deleted: { inApp: true, push: true, email: true },
  role_changed: { inApp: true, push: true, email: false },
  friend_request: { inApp: true, push: true, email: false },
  friend_accepted: { inApp: true, push: true, email: false },
  streak_reminder: { inApp: true, push: true, email: false },
};

/**
 * Base function to send a notification across multiple channels
 */
async function sendNotification({
  userId,
  type,
  data,
  taskId,
  projectId,
  metadata = {},
}: {
  userId: number;
  type: NotificationType;
  data: { userName?: string; taskTitle?: string; projectName?: string; role?: string; streakCount?: number; count?: number };
  taskId?: number;
  projectId?: number;
  metadata?: any;
}) {
  const channels = NOTIFICATION_CHANNELS[type];
  const message = getNotificationMessage(type, data);
  const db = getDatabaseClient();

  // 1. In-App Notification
  if (channels.inApp) {
    try {
      await db.notifications.create({
        userId,
        type: type === 'project_created' || type === 'project_deleted' ? 'project_joined' : type, // Fallback if DB enum is strict
        message,
        taskId,
        projectId,
        isRead: false,
        emailSent: false,
      });
    } catch (err) {
      console.error(`[Notification] Failed to create in-app notification for user ${userId}:`, err);
    }
  }

  // 2. Push Notification
  if (channels.push) {
    sendPushNotification({
      externalUserId: userId,
      title: 'Momentum',
      message,
      url: projectId ? `/projects/${projectId}` : undefined,
      data: { taskId, projectId, ...metadata },
    }).catch(err => console.warn(`[Notification] Push failed for user ${userId}:`, err));
  }

  // 3. Email Notification
  if (channels.email) {
    try {
      const supabaseUrl = getSupabaseUrl()?.endsWith('/') ? getSupabaseUrl()?.slice(0, -1) : getSupabaseUrl();
      const supabaseAnonKey = getSupabaseAnonKey();

      if (supabaseUrl && supabaseAnonKey) {
        // Fetch recipient email
        const recipient = await db.users.getById(userId);
        if (recipient?.email) {
          fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
              'apikey': supabaseAnonKey,
            },
            body: JSON.stringify({
              type: type.replace('_', '-'),
              to: recipient.email,
              message,
              data: { ...data, taskId, projectId },
            }),
          }).catch(err => console.error(`[Notification] Email failed for user ${userId}:`, err));
        }
      }
    } catch (err) {
      console.error(`[Notification] Error initiating email for user ${userId}:`, err);
    }
  }
}

/**
 * Unified Notification Service
 */
export const notificationService = {
  // Task Events
  async notifyTaskCreated(taskId: number, projectId: number, creatorId: number) {
    const db = getDatabaseClient();
    const [task, project, creator] = await Promise.all([
      db.tasks.getById(taskId),
      db.projects.getById(projectId),
      db.users.getById(creatorId),
    ]);

    if (!task || !project || !creator || !project.participantRoles) return;

    const participants = project.participantRoles
      .filter(pp => pp.userId !== creatorId && !pp.removedAt)
      .map(pp => pp.userId);

    const promises = participants.map(userId =>
      sendNotification({
        userId,
        type: 'task_created',
        data: { userName: creator.name, taskTitle: task.title, projectName: project.name },
        taskId,
        projectId,
      })
    );
    await Promise.all(promises);
  },

  async notifyTaskCompleted(taskId: number, projectId: number, completerId: number) {
    const db = getDatabaseClient();
    const [task, project, completer] = await Promise.all([
      db.tasks.getById(taskId),
      db.projects.getById(projectId),
      db.users.getById(completerId),
    ]);

    if (!task || !project || !completer || !project.participantRoles) return;

    const participants = project.participantRoles
      .filter(pp => pp.userId !== completerId && !pp.removedAt)
      .map(pp => pp.userId);

    const promises = participants.map(userId =>
      sendNotification({
        userId,
        type: 'task_completed',
        data: { userName: completer.name, taskTitle: task.title, projectName: project.name },
        taskId,
        projectId,
      })
    );
    await Promise.all(promises);
  },

  async notifyTaskRecovered(taskId: number, projectId: number, recovererId: number) {
    const db = getDatabaseClient();
    const [task, project, recoverer] = await Promise.all([
      db.tasks.getById(taskId),
      db.projects.getById(projectId),
      db.users.getById(recovererId),
    ]);

    if (!task || !project || !recoverer || !project.participantRoles) return;

    const participants = project.participantRoles
      .filter(pp => pp.userId !== recovererId && !pp.removedAt)
      .map(pp => pp.userId);

    const promises = participants.map(userId =>
      sendNotification({
        userId,
        type: 'task_recovered',
        data: { userName: recoverer.name, taskTitle: task.title, projectName: project.name },
        taskId,
        projectId,
      })
    );
    await Promise.all(promises);
  },

  async notifyTaskDeleted(projectId: number, deleterId: number, taskTitle: string) {
    const db = getDatabaseClient();
    const [project, deleter] = await Promise.all([
      db.projects.getById(projectId),
      db.users.getById(deleterId),
    ]);

    if (!project || !deleter || !project.participantRoles) return;

    const participants = project.participantRoles
      .filter(pp => pp.userId !== deleterId && !pp.removedAt)
      .map(pp => pp.userId);

    const promises = participants.map(userId =>
      sendNotification({
        userId,
        type: 'task_deleted',
        data: { userName: deleter.name, taskTitle, projectName: project.name },
        projectId,
      })
    );
    await Promise.all(promises);
  },

  async notifyTaskUpdated(taskId: number, projectId: number, updaterId: number) {
    const db = getDatabaseClient();
    const [task, project, updater] = await Promise.all([
      db.tasks.getById(taskId),
      db.projects.getById(projectId),
      db.users.getById(updaterId),
    ]);

    if (!task || !project || !updater || !project.participantRoles) return;

    const participants = project.participantRoles
      .filter(pp => pp.userId !== updaterId && !pp.removedAt)
      .map(pp => pp.userId);

    const promises = participants.map(userId =>
      sendNotification({
        userId,
        type: 'task_updated',
        data: { userName: updater.name, taskTitle: task.title, projectName: project.name },
        taskId,
        projectId,
      })
    );
    await Promise.all(promises);
  },

  async notifyTaskOverdue(taskId: number, userId: number) {
    const db = getDatabaseClient();
    const task = await db.tasks.getById(taskId);
    if (!task) return;

    await sendNotification({
      userId,
      type: 'task_overdue',
      data: { taskTitle: task.title },
      taskId,
      projectId: task.projectId,
    });
  },

  // Project Events
  async notifyProjectCreated(projectId: number, ownerId: number) {
    const db = getDatabaseClient();
    const [project, owner] = await Promise.all([
      db.projects.getById(projectId),
      db.users.getById(ownerId),
    ]);

    if (!project || !owner || !project.participantRoles) return;

    const participants = project.participantRoles
      .filter(pp => pp.userId !== ownerId && !pp.removedAt)
      .map(pp => pp.userId);

    const promises = participants.map(userId =>
      sendNotification({
        userId,
        type: 'project_created',
        data: { userName: owner.name, projectName: project.name },
        projectId,
      })
    );
    await Promise.all(promises);
  },

  async notifyProjectDeleted(ownerId: number, projectName: string, participantIds: number[]) {
    const db = getDatabaseClient();
    const owner = await db.users.getById(ownerId);
    if (!owner) return;

    const promises = participantIds
      .filter(id => id !== ownerId)
      .map(userId =>
        sendNotification({
          userId,
          type: 'project_deleted',
          data: { userName: owner.name, projectName },
        })
      );
    await Promise.all(promises);
  },

  async notifyProjectUpdated(projectId: number, updaterId: number) {
    const db = getDatabaseClient();
    const [project, updater] = await Promise.all([
      db.projects.getById(projectId),
      db.users.getById(updaterId),
    ]);

    if (!project || !updater || !project.participantRoles) return;

    const participants = project.participantRoles
      .filter(pp => pp.userId !== updaterId && !pp.removedAt)
      .map(pp => pp.userId);

    const promises = participants.map(userId =>
      sendNotification({
        userId,
        type: 'project_updated',
        data: { userName: updater.name, projectName: project.name },
        projectId,
      })
    );
    await Promise.all(promises);
  },

  async notifyProjectJoined(projectId: number, joinerId: number, count?: number) {
    const db = getDatabaseClient();
    const [project, joiner] = await Promise.all([
      db.projects.getById(projectId),
      db.users.getById(joinerId),
    ]);

    if (!project || !joiner || !project.participantRoles) return;

    const participants = project.participantRoles
      .filter(pp => pp.userId !== joinerId && !pp.removedAt)
      .map(pp => pp.userId);

    // Also notify the joiner themselves
    await sendNotification({
      userId: joinerId,
      type: 'project_joined',
      data: { userName: 'You', projectName: project.name },
      projectId,
    });

    const promises = participants.map(userId =>
      sendNotification({
        userId,
        type: 'project_joined',
        data: { userName: joiner.name, projectName: project.name, count },
        projectId,
      })
    );
    await Promise.all(promises);
  },

  async notifyRoleChanged(projectId: number, updaterId: number, targetUserId: number, role: string) {
    const db = getDatabaseClient();
    try {
      // Only fetch project as we don't need updater/targetUser details for this notification
      const project = await db.projects.getById(projectId);

      if (!project) {
        console.error(`[NotificationService] Project not found: ${projectId}`);
        return;
      }

      await sendNotification({
        userId: targetUserId,
        type: 'role_changed',
        data: { userName: 'You', role, projectName: project.name },
        projectId,
      });
    } catch (error) {
      console.error('[NotificationService] Error in notifyRoleChanged:', error);
    }
  },

  // Friend Events
  async notifyFriendRequest(senderId: number, receiverId: number) {
    const db = getDatabaseClient();
    const sender = await db.users.getById(senderId);
    if (!sender) return;

    await sendNotification({
      userId: receiverId,
      type: 'friend_request',
      data: { userName: sender.name },
    });
  },

  async notifyFriendAccepted(senderId: number, receiverId: number) {
    const db = getDatabaseClient();
    const receiver = await db.users.getById(receiverId);
    if (!receiver) return;

    await sendNotification({
      userId: senderId,
      type: 'friend_accepted',
      data: { userName: receiver.name },
    });
  },

  // Streak Events
  async notifyStreakReminder(userId: number, streakCount: number) {
    await sendNotification({
      userId,
      type: 'streak_reminder',
      data: { streakCount },
    });
  },
};
