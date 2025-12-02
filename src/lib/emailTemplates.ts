import { Task, Project, User } from '@/types';

/**
 * Email Templates for Momentum App
 * These templates are designed to work with open-source email services like:
 * - Resend (resend.com)
 * - SendGrid
 * - Mailgun
 * - Nodemailer with SMTP
 */

export interface EmailData {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Magic Link Email Template
 */
export const createMagicLinkEmail = (
  email: string,
  magicLink: string,
  userName?: string
): EmailData => {
  const greeting = userName ? `Hi ${userName},` : 'Hi there,';
  
  return {
    to: email,
    subject: 'Sign in to Momentum',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sign in to Momentum</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Momentum</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Collaborative Tasks</p>
          </div>
          
          <div style="background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #1a1a1a; margin-top: 0;">${greeting}</h2>
            
            <p style="color: #666; font-size: 16px;">
              Click the button below to sign in to your Momentum account. This link will expire in 15 minutes.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Sign In to Momentum
              </a>
            </div>
            
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="color: #0EA5E9; font-size: 14px; word-break: break-all;">
              ${magicLink}
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; margin: 0;">
              If you didn't request this link, you can safely ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Momentum. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `${greeting}\n\nClick the link below to sign in to your Momentum account:\n\n${magicLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't request this link, you can safely ignore this email.`
  };
};

/**
 * Task Initiated Email Template
 */
export const createTaskInitiatedEmail = (
  recipient: User,
  task: Task,
  project: Project,
  initiator: User
): EmailData => {
  const dueDateText = task.originalDueDate 
    ? new Date(task.originalDueDate).toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : 'No due date set';
  
  return {
    to: recipient.email,
    subject: `${initiator.name} wants to collaborate on "${task.title}"`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0;">New Task Request</h1>
          </div>
          
          <div style="background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #666;">
              Hi <strong>${recipient.name}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #666;">
              <strong>${initiator.name}</strong> has initiated a new task and wants to collaborate with you!
            </p>
            
            <div style="background: #f8f9fa; border-left: 4px solid #0EA5E9; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin-top: 0; color: #1a1a1a;">${task.title}</h3>
              ${task.description ? `<p style="color: #666; margin: 10px 0;">${task.description}</p>` : ''}
              <div style="margin-top: 15px;">
                <p style="margin: 5px 0; color: #666;"><strong>Project:</strong> ${project.name}</p>
                <p style="margin: 5px 0; color: #666;"><strong>Due Date:</strong> ${dueDateText}</p>
                ${task.type === 'habit' && task.recurrencePattern ? `<p style="margin: 5px 0; color: #666;"><strong>Recurrence:</strong> ${task.recurrencePattern}</p>` : ''}
              </div>
            </div>
            
            <p style="font-size: 16px; color: #666;">
              You can accept, decline, or propose a different time for this task in the Momentum app.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.VITE_APP_URL || 'https://momentum.app'}/" 
                 style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                View Task in Momentum
              </a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${recipient.name},\n\n${initiator.name} has initiated a new task: "${task.title}" in project "${project.name}".\n\nDue Date: ${dueDateText}\n\nView it in the Momentum app to accept, decline, or propose a different time.`
  };
};

/**
 * Task Accepted Email Template
 */
export const createTaskAcceptedEmail = (
  recipient: User,
  task: Task,
  project: Project,
  accepter: User
): EmailData => {
  return {
    to: recipient.email,
    subject: `${accepter.name} accepted "${task.title}"`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0;">Task Accepted! 🎉</h1>
          </div>
          
          <div style="background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #666;">
              Hi <strong>${recipient.name}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #666;">
              Great news! <strong>${accepter.name}</strong> has accepted the task <strong>"${task.title}"</strong> in <strong>${project.name}</strong>.
            </p>
            
            <p style="font-size: 16px; color: #666;">
              You're now both committed to completing this task together. Let's build momentum! 💪
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.VITE_APP_URL || 'https://momentum.app'}/" 
                 style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                View Task
              </a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${recipient.name},\n\n${accepter.name} has accepted the task "${task.title}" in "${project.name}".\n\nView it in the Momentum app!`
  };
};

/**
 * Task Declined Email Template
 */
export const createTaskDeclinedEmail = (
  recipient: User,
  task: Task,
  project: Project,
  decliner: User
): EmailData => {
  return {
    to: recipient.email,
    subject: `${decliner.name} declined "${task.title}"`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #F59E0B; border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0;">Task Declined</h1>
          </div>
          
          <div style="background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #666;">
              Hi <strong>${recipient.name}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #666;">
              <strong>${decliner.name}</strong> has declined the task <strong>"${task.title}"</strong> in <strong>${project.name}</strong>.
            </p>
            
            <p style="font-size: 16px; color: #666;">
              You can create a new task or modify this one if needed.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.VITE_APP_URL || 'https://momentum.app'}/" 
                 style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                View Project
              </a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${recipient.name},\n\n${decliner.name} has declined the task "${task.title}" in "${project.name}".`
  };
};

/**
 * Task Time Proposed Email Template
 */
export const createTaskTimeProposedEmail = (
  recipient: User,
  task: Task,
  project: Project,
  proposer: User,
  proposedDate: Date
): EmailData => {
  const proposedDateText = proposedDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
  
  return {
    to: recipient.email,
    subject: `${proposer.name} proposed a new time for "${task.title}"`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0;">New Time Proposed ⏰</h1>
          </div>
          
          <div style="background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #666;">
              Hi <strong>${recipient.name}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #666;">
              <strong>${proposer.name}</strong> has proposed a new time for the task <strong>"${task.title}"</strong> in <strong>${project.name}</strong>.
            </p>
            
            <div style="background: #f8f9fa; border-left: 4px solid #8B5CF6; padding: 20px; margin: 20px 0; border-radius: 4px;">
              <p style="margin: 0; color: #666;"><strong>Proposed Time:</strong></p>
              <p style="margin: 10px 0 0 0; font-size: 18px; color: #1a1a1a; font-weight: 600;">${proposedDateText}</p>
            </div>
            
            <p style="font-size: 16px; color: #666;">
              You can accept, decline, or propose a different time in the Momentum app.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.VITE_APP_URL || 'https://momentum.app'}/" 
                 style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                Respond to Proposal
              </a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${recipient.name},\n\n${proposer.name} has proposed a new time for "${task.title}": ${proposedDateText}\n\nRespond in the Momentum app.`
  };
};

/**
 * Task Completed Email Template
 */
export const createTaskCompletedEmail = (
  recipient: User,
  task: Task,
  project: Project,
  completer: User
): EmailData => {
  return {
    to: recipient.email,
    subject: `${completer.name} completed "${task.title}"`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0;">Task Completed! 🎉</h1>
          </div>
          
          <div style="background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #666;">
              Hi <strong>${recipient.name}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #666;">
              <strong>${completer.name}</strong> has completed the task <strong>"${task.title}"</strong> in <strong>${project.name}</strong>!
            </p>
            
            <p style="font-size: 16px; color: #666;">
              ${task.status === 'completed'
                ? '🎊 Amazing! Both of you have completed this task. Great teamwork!' 
                : 'Keep up the momentum! Complete your part to finish this task together.'}
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.VITE_APP_URL || 'https://momentum.app'}/" 
                 style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                View Task
              </a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${recipient.name},\n\n${completer.name} has completed "${task.title}" in "${project.name}".\n\n${task.status === 'completed' ? 'Both of you have completed this task!' : 'Complete your part to finish together!'}`
  };
};

/**
 * Email Service Interface
 * This can be implemented with any email service:
 * - Resend: https://resend.com
 * - SendGrid: https://sendgrid.com
 * - Mailgun: https://mailgun.com
 * - Nodemailer: https://nodemailer.com
 */
export interface EmailService {
  sendEmail(emailData: EmailData): Promise<void>;
}

/**
 * Mock Email Service (for development)
 * In production, replace with actual email service implementation
 */
export class MockEmailService implements EmailService {
  async sendEmail(emailData: EmailData): Promise<void> {
    // In development, log the email
    console.log('📧 Email would be sent:', {
      to: emailData.to,
      subject: emailData.subject,
      preview: emailData.text?.substring(0, 100) + '...'
    });
    
    // In production, this would call your email service API
    // Example with Resend:
    // await fetch('https://api.resend.com/emails', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     from: 'Momentum <noreply@momentum.app>',
    //     to: emailData.to,
    //     subject: emailData.subject,
    //     html: emailData.html,
    //     text: emailData.text,
    //   }),
    // });
  }
}

