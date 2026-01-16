import { getDatabaseClient } from '@/db';
import type { NotificationType } from '@/types';

export async function notifyTaskDeleted(
  projectId: number,
  deleterId: number,
  taskTitle: string
): Promise<void> {
  const db = getDatabaseClient();
  
  const project = await db.projects.getById(projectId);
  if (!project?.participantRoles) {
    console.warn('[Notification] No project or participant roles found');
    return;
  }
  
  const participantIds = project.participantRoles
    .filter(pp => pp.userId !== deleterId && !pp.removedAt)
    .map(pp => pp.userId);
  
  if (participantIds.length === 0) {
    console.warn('[Notification] No participants to notify');
    return;
  }
  
  const deleter = await db.users.getById(deleterId);
  if (!deleter) {
    console.warn('[Notification] Deleter user not found');
    return;
  }
  
  const message = `${deleter.name} deleted "${taskTitle}"`;
  
  const notifications = participantIds.map(userId => ({
    userId,
    type: 'task_deleted' as NotificationType,
    message,
    projectId,
    taskId: undefined,
    isRead: false,
    emailSent: false,
  }));
  
  await db.notifications.createMany(notifications);
  console.log('[Notification] Created', notifications.length, 'task_deleted notifications');
}

export async function notifyTaskCreated(
  taskId: number,
  projectId: number,
  creatorId: number
): Promise<void> {
  const db = getDatabaseClient();
  
  const [task, project] = await Promise.all([
    db.tasks.getById(taskId),
    db.projects.getById(projectId),
  ]);
  
  if (!project?.participantRoles) {
    console.warn('[Notification] No project or participant roles found');
    return;
  }
  
  if (!task) {
    console.warn('[Notification] Task not found');
    return;
  }
  
  const creator = await db.users.getById(creatorId);
  if (!creator) {
    console.warn('[Notification] Creator user not found');
    return;
  }
  
  const participantIds = project.participantRoles
    .filter(pp => pp.userId !== creatorId && !pp.removedAt)
    .map(pp => pp.userId);
  
  if (participantIds.length === 0) {
    console.warn('[Notification] No participants to notify');
    return;
  }
  
  const message = `${creator.name} created "${task.title}" in ${project.name}`;
  
  const notifications = participantIds.map(userId => ({
    userId,
    type: 'task_created' as NotificationType,
    message,
    projectId,
    taskId: task.id,
    isRead: false,
    emailSent: false,
  }));
  
  await db.notifications.createMany(notifications);
  console.log('[Notification] Created', notifications.length, 'task_created notifications');
}

export async function notifyTaskCompleted(
  taskId: number,
  projectId: number,
  completerId: number
): Promise<void> {
  const db = getDatabaseClient();
  
  const [task, project] = await Promise.all([
    db.tasks.getById(taskId),
    db.projects.getById(projectId),
  ]);
  
  if (!project?.participantRoles) {
    console.warn('[Notification] No project or participant roles found');
    return;
  }
  
  if (!task) {
    console.warn('[Notification] Task not found');
    return;
  }
  
  const completer = await db.users.getById(completerId);
  if (!completer) {
    console.warn('[Notification] Completer user not found');
    return;
  }
  
  const participantIds = project.participantRoles
    .filter(pp => pp.userId !== completerId && !pp.removedAt)
    .map(pp => pp.userId);
  
  if (participantIds.length === 0) {
    console.warn('[Notification] No participants to notify');
    return;
  }
  
  const message = `${completer.name} completed "${task.title}" in ${project.name}`;
  
  const notifications = participantIds.map(userId => ({
    userId,
    type: 'task_completed' as NotificationType,
    message,
    projectId,
    taskId: task.id,
    isRead: false,
    emailSent: false,
  }));
  
  await db.notifications.createMany(notifications);
  console.log('[Notification] Created', notifications.length, 'task_completed notifications');
}

export async function notifyTaskUpdated(
  taskId: number,
  projectId: number,
  updaterId: number
): Promise<void> {
  const db = getDatabaseClient();
  
  const [task, project] = await Promise.all([
    db.tasks.getById(taskId),
    db.projects.getById(projectId),
  ]);
  
  if (!project?.participantRoles) {
    console.warn('[Notification] No project or participant roles found');
    return;
  }
  
  if (!task) {
    console.warn('[Notification] Task not found');
    return;
  }
  
  const updater = await db.users.getById(updaterId);
  if (!updater) {
    console.warn('[Notification] Updater user not found');
    return;
  }
  
  const participantIds = project.participantRoles
    .filter(pp => pp.userId !== updaterId && !pp.removedAt)
    .map(pp => pp.userId);
  
  if (participantIds.length === 0) {
    console.warn('[Notification] No participants to notify');
    return;
  }
  
  const message = `${updater.name} updated "${task.title}" in ${project.name}`;
  
  const notifications = participantIds.map(userId => ({
    userId,
    type: 'task_updated' as NotificationType,
    message,
    projectId,
    taskId: task.id,
    isRead: false,
    emailSent: false,
  }));
  
  await db.notifications.createMany(notifications);
  console.log('[Notification] Created', notifications.length, 'task_updated notifications');
}
