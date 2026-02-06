import { notificationService } from '@/lib/notifications/notificationService';

export const notifyTaskCreated = (taskId: number, projectId: number, creatorId: number) =>
    notificationService.notifyTaskCreated(taskId, projectId, creatorId);

export const notifyTaskCompleted = (taskId: number, projectId: number, completerId: number) =>
    notificationService.notifyTaskCompleted(taskId, projectId, completerId);

export const notifyTaskUpdated = (taskId: number, projectId: number, updaterId: number) =>
    notificationService.notifyTaskUpdated(taskId, projectId, updaterId);

export const notifyTaskDeleted = (projectId: number, deleterId: number, taskTitle: string) =>
    notificationService.notifyTaskDeleted(projectId, deleterId, taskTitle);

export const notifyTaskRecovered = (taskId: number, projectId: number, recovererId: number) =>
    notificationService.notifyTaskRecovered(taskId, projectId, recovererId);

export const notifyProjectCreated = (projectId: number, ownerId: number) =>
    notificationService.notifyProjectCreated(projectId, ownerId);

export const notifyProjectDeleted = (ownerId: number, projectName: string, participantIds: number[]) =>
    notificationService.notifyProjectDeleted(ownerId, projectName, participantIds);

export const notifyProjectUpdated = (projectId: number, updaterId: number) =>
    notificationService.notifyProjectUpdated(projectId, updaterId);

export const notifyProjectJoined = (projectId: number, joinerId: number, count?: number) =>
    notificationService.notifyProjectJoined(projectId, joinerId, count);

export const notifyRoleChanged = (projectId: number, updaterId: number, targetUserId: number, role: string) =>
    notificationService.notifyRoleChanged(projectId, updaterId, targetUserId, role);
