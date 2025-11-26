import { Notification, Task, Project, User } from '@/types';
import {
  createTaskInitiatedEmail,
  createTaskAcceptedEmail,
  createTaskDeclinedEmail,
  createTaskTimeProposedEmail,
  createTaskCompletedEmail,
  EmailService,
  MockEmailService
} from './emailTemplates';

/**
 * Notification Service
 * Handles creating notifications and sending email notifications
 */
export class NotificationService {
  private emailService: EmailService;

  constructor(emailService?: EmailService) {
    this.emailService = emailService || new MockEmailService();
  }

  /**
   * Send task initiated notification and email
   */
  async notifyTaskInitiated(
    task: Task,
    project: Project,
    initiator: User,
    recipient: User
  ): Promise<Notification> {
    const notification: Notification = {
      id: `n${Date.now()}-${Math.random()}`,
      userId: recipient.id,
      type: 'task_initiated',
      message: `${initiator.name} initiated "${task.title}" in ${project.name}`,
      taskId: task.id,
      projectId: project.id,
      createdAt: new Date(),
      isRead: false,
      emailSent: false
    };

    // Send email
    try {
      const email = createTaskInitiatedEmail(recipient, task, project, initiator);
      await this.emailService.sendEmail(email);
      notification.emailSent = true;
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }

    return notification;
  }

  /**
   * Send task accepted notification and email
   */
  async notifyTaskAccepted(
    task: Task,
    project: Project,
    accepter: User,
    recipient: User
  ): Promise<Notification> {
    const notification: Notification = {
      id: `n${Date.now()}-${Math.random()}`,
      userId: recipient.id,
      type: 'task_accepted',
      message: `${accepter.name} accepted "${task.title}" in ${project.name}`,
      taskId: task.id,
      projectId: project.id,
      createdAt: new Date(),
      isRead: false,
      emailSent: false
    };

    try {
      const email = createTaskAcceptedEmail(recipient, task, project, accepter);
      await this.emailService.sendEmail(email);
      notification.emailSent = true;
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }

    return notification;
  }

  /**
   * Send task declined notification and email
   */
  async notifyTaskDeclined(
    task: Task,
    project: Project,
    decliner: User,
    recipient: User
  ): Promise<Notification> {
    const notification: Notification = {
      id: `n${Date.now()}-${Math.random()}`,
      userId: recipient.id,
      type: 'task_declined',
      message: `${decliner.name} declined "${task.title}" in ${project.name}`,
      taskId: task.id,
      projectId: project.id,
      createdAt: new Date(),
      isRead: false,
      emailSent: false
    };

    try {
      const email = createTaskDeclinedEmail(recipient, task, project, decliner);
      await this.emailService.sendEmail(email);
      notification.emailSent = true;
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }

    return notification;
  }

  /**
   * Send task time proposed notification and email
   */
  async notifyTaskTimeProposed(
    task: Task,
    project: Project,
    proposer: User,
    recipient: User,
    proposedDate: Date
  ): Promise<Notification> {
    const notification: Notification = {
      id: `n${Date.now()}-${Math.random()}`,
      userId: recipient.id,
      type: 'task_time_proposed',
      message: `${proposer.name} proposed a new time for "${task.title}" in ${project.name}`,
      taskId: task.id,
      projectId: project.id,
      createdAt: new Date(),
      isRead: false,
      emailSent: false
    };

    try {
      const email = createTaskTimeProposedEmail(recipient, task, project, proposer, proposedDate);
      await this.emailService.sendEmail(email);
      notification.emailSent = true;
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }

    return notification;
  }

  /**
   * Send task completed notification and email
   */
  async notifyTaskCompleted(
    task: Task,
    project: Project,
    completer: User,
    recipient: User
  ): Promise<Notification> {
    const notification: Notification = {
      id: `n${Date.now()}-${Math.random()}`,
      userId: recipient.id,
      type: 'task_completed',
      message: `${completer.name} completed "${task.title}" in ${project.name}`,
      taskId: task.id,
      projectId: project.id,
      createdAt: new Date(),
      isRead: false,
      emailSent: false
    };

    try {
      const email = createTaskCompletedEmail(recipient, task, project, completer);
      await this.emailService.sendEmail(email);
      notification.emailSent = true;
    } catch (error) {
      console.error('Failed to send email notification:', error);
    }

    return notification;
  }

  /**
   * Send project joined notification
   */
  async notifyProjectJoined(
    project: Project,
    joiner: User,
    recipient: User
  ): Promise<Notification> {
    const notification: Notification = {
      id: `n${Date.now()}-${Math.random()}`,
      userId: recipient.id,
      type: 'project_joined',
      message: `${joiner.name} joined "${project.name}"`,
      projectId: project.id,
      createdAt: new Date(),
      isRead: false,
      emailSent: false
    };

    return notification;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();

