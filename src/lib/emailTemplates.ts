import type { Task, Project, User } from '@/types';

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
 * Sign In Email Template
 */
export const createSigninEmail = (
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
          <div style="background: linear-gradient(135deg, #1D4ED8 0%, #1D4ED8 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
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
                 style="display: inline-block; background: linear-gradient(135deg, #1D4ED8 0%, #1D4ED8 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Sign In to Momentum
              </a>
            </div>
            
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="color: #1D4ED8; font-size: 14px; word-break: break-all;">
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
 * Sign Up Email Template
 */
export const createSignupEmail = (
  email: string,
  magicLink: string,
  userName?: string
): EmailData => {
  const greeting = userName ? `Hi ${userName},` : 'Hi there,';

  return {
    to: email,
    subject: 'Welcome to Momentum! Complete your signup',
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to Momentum</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1D4ED8 0%, #1D4ED8 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Momentum! 🎉</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Collaborative Tasks</p>
          </div>
          
          <div style="background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #1a1a1a; margin-top: 0;">${greeting}</h2>
            
            <p style="color: #666; font-size: 16px;">
              Thank you for signing up! Click the button below to verify your email and complete your registration. This link will expire in 15 minutes.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLink}" 
                 style="display: inline-block; background: linear-gradient(135deg, #1D4ED8 0%, #1D4ED8 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Complete Signup
              </a>
            </div>
            
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="color: #1D4ED8; font-size: 14px; word-break: break-all;">
              ${magicLink}
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; margin: 0;">
              If you didn't create an account, you can safely ignore this email.
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Momentum. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `${greeting}\n\nThank you for signing up! Click the link below to verify your email and complete your registration:\n\n${magicLink}\n\nThis link will expire in 15 minutes.\n\nIf you didn't create an account, you can safely ignore this email.`
  };
};

/**
 * Task Created Email Template
 */
export const createTaskCreatedEmail = (
  recipient: User,
  task: Task,
  project: Project,
  creator: User
): EmailData => {
  // Support both Vite and Next.js environment variables
  const appUrl =
    (typeof window !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_APP_URL) ||
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_URL) ||
    'https://social-momentum.netlify.app';
  const taskUrl = `${appUrl}/projects/${project.id}`;

  return {
    to: recipient.email,
    subject: `New task: "${task.title}" in ${project.name}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Task Created</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #1D4ED8 0%, #1D4ED8 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
            <h1 style="color: white; margin: 0; font-size: 28px;">New Task Created! 📝</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${project.name}</p>
          </div>
          
          <div style="background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <p style="font-size: 16px; color: #666;">
              Hi <strong>${recipient.name}</strong>,
            </p>
            
            <p style="font-size: 16px; color: #666;">
              <strong>${creator.name}</strong> has created a new task in <strong>${project.name}</strong>:
            </p>
            
            <div style="background: #f5f5f5; border-left: 4px solid #1D4ED8; padding: 15px; margin: 20px 0; border-radius: 4px;">
              <h3 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 18px;">${task.title}</h3>
              ${task.description ? `<p style="margin: 0; color: #666; font-size: 14px;">${task.description}</p>` : ''}
              <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">
                Due: ${new Date(task.dueDate).toLocaleDateString()}
              </p>
            </div>
            
            <p style="font-size: 16px; color: #666;">
              You're a participant in this project, so this task has been assigned to you. Click below to view and get started!
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${taskUrl}" 
                 style="display: inline-block; background: linear-gradient(135deg, #1D4ED8 0%, #1D4ED8 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                View Task
              </a>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
            <p>© ${new Date().getFullYear()} Momentum. All rights reserved.</p>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${recipient.name},\n\n${creator.name} has created a new task "${task.title}" in ${project.name}.\n\n${task.description ? `Description: ${task.description}\n\n` : ''}Due: ${new Date(task.dueDate).toLocaleDateString()}\n\nView the task: ${taskUrl}`
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
  const allCompleted = task.taskStatus?.length
    ? task.taskStatus.every(ts => ts.status === 'completed')
    : false;

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
          <div style="background: #10B981; border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
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
              ${allCompleted
        ? '🎊 Amazing! Both of you have completed this task. Great teamwork!'
        : 'Keep up the momentum! Complete your part to finish this task together.'}
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${(typeof window !== 'undefined' && typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL) || (typeof process !== 'undefined' && process.env?.VITE_APP_URL) || (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_URL) || 'https://social-momentum.netlify.app'}/" 
                 style="display: inline-block; background: linear-gradient(135deg, #1D4ED8 0%, #1D4ED8 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600;">
                View Task
              </a>
            </div>
          </div>
        </body>
      </html>
    `,
    text: `Hi ${recipient.name},\n\n${completer.name} has completed "${task.title}" in "${project.name}".\n\n${allCompleted ? 'Both of you have completed this task!' : 'Complete your part to finish together!'}`
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
    //     from: 'Momentum <momentum.pwa@gmail.com>',
    //     to: emailData.to,
    //     subject: emailData.subject,
    //     html: emailData.html,
    //     text: emailData.text,
    //   }),
    // });
  }
}

