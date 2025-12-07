// ============================================================================
// MailJet Email Service Implementation
// ============================================================================

import { EmailData, EmailService } from '../emailTemplates';

export class MailJetEmailService implements EmailService {
  private apiKey: string;
  private apiSecret: string;
  private fromEmail: string;
  private fromName: string;

  constructor() {
    // Support both MailJet_API_Key and MailJet_API_Secret format
    this.apiKey = process.env.MailJet_API_Key || process.env.MAILJET_API_KEY || '';
    this.apiSecret = process.env.MailJet_API_Secret || process.env.MAILJET_API_SECRET || '';
    this.fromEmail = process.env.MailJet_From_Email || process.env.MAILJET_FROM_EMAIL || 'noreply@momentum.app';
    this.fromName = process.env.MailJet_From_Name || process.env.MAILJET_FROM_NAME || 'Momentum';

    if (!this.apiKey || !this.apiSecret) {
      console.warn(
        '⚠️ MailJet API credentials not found. Email sending will fail in production.'
      );
      console.warn('⚠️ Please set MailJet_API_Key and MailJet_API_Secret environment variables.');
    }
  }

  async sendEmail(emailData: EmailData): Promise<void> {
    if (!this.apiKey || !this.apiSecret) {
      // In development, log the email instead of failing
      if (process.env.NODE_ENV === 'development') {
        console.log('📧 Email would be sent (MailJet not configured):', {
          to: emailData.to,
          subject: emailData.subject,
          preview: emailData.text?.substring(0, 100) + '...',
        });
        return;
      }
      throw new Error('MailJet API credentials not configured');
    }

    try {
      // MailJet API v3.1 Send Email
      const response = await fetch('https://api.mailjet.com/v3.1/send', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.apiKey}:${this.apiSecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          Messages: [
            {
              From: {
                Email: this.fromEmail,
                Name: this.fromName,
              },
              To: [
                {
                  Email: emailData.to,
                },
              ],
              Subject: emailData.subject,
              HTMLPart: emailData.html,
              TextPart: emailData.text || emailData.html.replace(/<[^>]*>/g, ''),
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `MailJet API error: ${response.status} ${response.statusText}. ${JSON.stringify(errorData)}`
        );
      }

      const result = await response.json();
      console.log('✅ Email sent via MailJet:', result);
    } catch (error) {
      console.error('❌ Failed to send email via MailJet:', error);
      throw error;
    }
  }
}
