# Email Integration Guide

This document explains how to integrate email notifications into the Momentum app using open-source email services.

## Overview

The Momentum app includes a complete email notification system with:
- **Magic link authentication** emails
- **Task notifications** (initiated, accepted, declined, time proposed, completed)
- **Project notifications** (joined)
- Beautiful HTML email templates
- Mock email service for development

## Email Templates

All email templates are located in `src/lib/emailTemplates.ts`:

- `createMagicLinkEmail()` - Authentication magic link
- `createTaskInitiatedEmail()` - New task request
- `createTaskAcceptedEmail()` - Task accepted
- `createTaskDeclinedEmail()` - Task declined
- `createTaskTimeProposedEmail()` - New time proposed
- `createTaskCompletedEmail()` - Task completed

## Integration Options

### Option 1: Resend (Recommended)

[Resend](https://resend.com) is a modern email API with a generous free tier.

**Installation:**
```bash
npm install resend
```

**Implementation:**

Create `src/lib/emailServices/resendService.ts`:

```typescript
import { Resend } from 'resend';
import { EmailData, EmailService } from '../emailTemplates';

export class ResendEmailService implements EmailService {
  private resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async sendEmail(emailData: EmailData): Promise<void> {
    await this.resend.emails.send({
      from: 'Momentum <noreply@yourdomain.com>',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }
}
```

**Usage:**
```typescript
import { NotificationService } from './lib/notificationService';
import { ResendEmailService } from './lib/emailServices/resendService';

const emailService = new ResendEmailService();
export const notificationService = new NotificationService(emailService);
```

### Option 2: SendGrid

[SendGrid](https://sendgrid.com) is a popular email service.

**Installation:**
```bash
npm install @sendgrid/mail
```

**Implementation:**

Create `src/lib/emailServices/sendgridService.ts`:

```typescript
import sgMail from '@sendgrid/mail';
import { EmailData, EmailService } from '../emailTemplates';

export class SendGridEmailService implements EmailService {
  constructor() {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  }

  async sendEmail(emailData: EmailData): Promise<void> {
    await sgMail.send({
      from: 'noreply@yourdomain.com',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }
}
```

### Option 3: Mailgun

[Mailgun](https://mailgun.com) is another excellent option.

**Installation:**
```bash
npm install mailgun.js
```

**Implementation:**

Create `src/lib/emailServices/mailgunService.ts`:

```typescript
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { EmailData, EmailService } from '../emailTemplates';

export class MailgunEmailService implements EmailService {
  private mg: any;

  constructor() {
    const mailgun = new Mailgun(formData);
    this.mg = mailgun.client({
      username: 'api',
      key: process.env.MAILGUN_API_KEY!,
    });
  }

  async sendEmail(emailData: EmailData): Promise<void> {
    await this.mg.messages.create(process.env.MAILGUN_DOMAIN!, {
      from: 'Momentum <noreply@yourdomain.com>',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }
}
```

### Option 4: Nodemailer (SMTP)

For self-hosted email using SMTP.

**Installation:**
```bash
npm install nodemailer
```

**Implementation:**

Create `src/lib/emailServices/nodemailerService.ts`:

```typescript
import nodemailer from 'nodemailer';
import { EmailData, EmailService } from '../emailTemplates';

export class NodemailerEmailService implements EmailService {
  private transporter: any;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  async sendEmail(emailData: EmailData): Promise<void> {
    await this.transporter.sendMail({
      from: 'Momentum <noreply@yourdomain.com>',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html,
      text: emailData.text,
    });
  }
}
```

## Magic Link Authentication

To implement magic link authentication:

1. **Generate a secure token:**
```typescript
import crypto from 'crypto';

function generateMagicLinkToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
```

2. **Store token with expiration:**
```typescript
// In your database
const token = generateMagicLinkToken();
await db.magicLinks.create({
  token,
  userId: user.id,
  expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
});
```

3. **Create magic link URL:**
```typescript
const magicLink = `${process.env.APP_URL}/auth/verify?token=${token}`;
```

4. **Send email:**
```typescript
import { createMagicLinkEmail } from './lib/emailTemplates';
import { emailService } from './lib/emailServices/resendService';

const email = createMagicLinkEmail(user.email, magicLink, user.name);
await emailService.sendEmail(email);
```

5. **Verify token on backend:**
```typescript
// In your API route /api/auth/verify
const magicLink = await db.magicLinks.findOne({ token });
if (!magicLink || magicLink.expiresAt < new Date()) {
  return { error: 'Invalid or expired link' };
}

// Create session and delete token
await createUserSession(magicLink.userId);
await db.magicLinks.delete({ token });
```

## Environment Variables

Add these to your `.env` file:

```env
# Email Service (choose one)
RESEND_API_KEY=re_xxxxx
# OR
SENDGRID_API_KEY=SG.xxxxx
# OR
MAILGUN_API_KEY=xxxxx
MAILGUN_DOMAIN=yourdomain.com
# OR
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# App URL for links in emails
VITE_APP_URL=https://momentum.app
```

## Notification Service Usage

The notification service automatically sends emails when events occur:

```typescript
import { notificationService } from './lib/notificationService';

// When a task is initiated
const notification = await notificationService.notifyTaskInitiated(
  task,
  project,
  initiator,
  recipient
);

// When a task is accepted
await notificationService.notifyTaskAccepted(
  task,
  project,
  accepter,
  recipient
);

// When a task is completed
await notificationService.notifyTaskCompleted(
  task,
  project,
  completer,
  recipient
);
```

## Customization

### Customizing Email Templates

All templates are in `src/lib/emailTemplates.ts`. You can:
- Modify colors and styling
- Add your logo
- Change the layout
- Add custom branding

### Customizing Email Service

Implement the `EmailService` interface:

```typescript
export interface EmailService {
  sendEmail(emailData: EmailData): Promise<void>;
}
```

## Testing

In development, the app uses `MockEmailService` which logs emails to the console. To test with real emails:

1. Set up your email service
2. Replace `MockEmailService` with your implementation
3. Add API keys to `.env`
4. Test with real email addresses

## Production Checklist

- [ ] Set up email service account
- [ ] Configure domain authentication (SPF, DKIM, DMARC)
- [ ] Add API keys to environment variables
- [ ] Replace MockEmailService with production service
- [ ] Test email delivery
- [ ] Set up email monitoring/alerts
- [ ] Configure rate limiting
- [ ] Set up bounce/complaint handling

## Support

For issues or questions:
- Check email service documentation
- Review email service logs
- Test with email service's test mode
- Verify domain authentication

