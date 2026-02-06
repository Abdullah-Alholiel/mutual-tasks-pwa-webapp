import { notificationService } from '@/lib/notifications/notificationService';

export const notifyTaskCreated = notificationService.notifyTaskCreated.bind(notificationService);
export const notifyTaskCompleted = notificationService.notifyTaskCompleted.bind(notificationService);
export const notifyTaskUpdated = notificationService.notifyTaskUpdated.bind(notificationService);
export const notifyTaskDeleted = notificationService.notifyTaskDeleted.bind(notificationService);
export const notifyTaskRecovered = notificationService.notifyTaskRecovered.bind(notificationService);
export const notifyProjectUpdated = notificationService.notifyProjectUpdated.bind(notificationService);
