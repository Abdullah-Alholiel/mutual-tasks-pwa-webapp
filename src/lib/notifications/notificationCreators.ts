import { getDatabaseClient } from '@/db';
import type { NotificationType } from '@/types';

interface CreateNotificationParams {
  userId: number;
  type: NotificationType;
  message: string;
  projectId?: number;
  taskId?: number;
}

export async function createInAppNotification({
  userId,
  type,
  message,
  projectId,
  taskId,
}: CreateNotificationParams): Promise<void> {
  const db = getDatabaseClient();
  
  await db.notifications.create({
    userId,
    type,
    message,
    projectId,
    taskId,
    isRead: false,
    emailSent: false,
  });
}

export async function notifyParticipantsAboutTaskDeletion({
  projectId,
  deleterId,
  deleterName,
  taskTitle,
  participantUserIds,
}: {
  projectId: number;
  deleterId: number;
  deleterName: string;
  taskTitle: string;
  participantUserIds: number[];
}): Promise<void> {
  const db = getDatabaseClient();
  const message = `${deleterName} deleted "${taskTitle}"`;
  
  const notifications = participantUserIds
    .filter(userId => userId !== deleterId)
    .map(userId => ({
      userId,
      type: 'task_deleted' as NotificationType,
      message,
      projectId,
      taskId: undefined,
      isRead: false,
      emailSent: false,
    }));
  
  if (notifications.length > 0) {
    await db.notifications.createMany(notifications);
  }
}
