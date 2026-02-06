import { getDatabaseClient } from '@/db';
import type { NotificationType } from '@/types';

interface CreateNotificationParams {
  userId: number;
  type: NotificationType;
  message: string;
  projectId?: number;
  taskId?: number;
}

/**
 * Standard utility to create an in-app notification in the database
 */
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
