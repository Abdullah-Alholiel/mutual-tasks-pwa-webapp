// @ts-nocheck
// ============================================================================
// Supabase Edge Function: Send Email via MailJet
// ============================================================================
// Note: This file runs on Deno runtime, not Node.js. TypeScript errors are expected
// in the IDE but will work correctly when deployed to Supabase Edge Functions.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Helper to escape HTML to prevent XSS
function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Common styles for consistency
const styles = {
  body: "font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 0;",
  container: "max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);",
  header: "text-align: center; padding: 40px 0 20px;",
  logo: "width: 48px; height: 48px; margin-bottom: 16px; border-radius: 12px;",
  brandName: "font-size: 24px; font-weight: 700; color: #111827; margin: 0; letter-spacing: -0.5px;",
  content: "padding: 0 40px 40px;",
  greeting: "font-size: 20px; font-weight: 600; color: #111827; margin-bottom: 24px;",
  paragraph: "font-size: 16px; color: #4B5563; margin-bottom: 24px; line-height: 1.6;",
  buttonContainer: "text-align: center; margin: 32px 0;",
  button: "background-color: #1D4ED8; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 12px; font-weight: 600; font-size: 16px; display: inline-block; box-shadow: 0 4px 6px rgba(29, 78, 216, 0.2);",
  copyLinkContainer: "background-color: #F3F4F6; border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; margin-top: 32px;",
  copyLinkLabel: "font-size: 12px; font-weight: 600; color: #6B7280; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;",
  copyLinkValue: "font-family: monospace; font-size: 14px; color: #1D4ED8; word-break: break-all; margin: 0; background: #fff; padding: 10px; border-radius: 8px; border: 1px solid #E5E7EB;",
  footer: "background-color: #f9fafb; padding: 32px 40px; text-align: center; border-top: 1px solid #f3f4f6;",
  slogan: "font-size: 14px; color: #6B7280; font-weight: 500; font-style: italic; margin-bottom: 16px;",
  copyright: "font-size: 12px; color: #9CA3AF; margin: 0;",
};

// Component: Header with Logo
const EmailHeader = ({ appUrl }: { appUrl: string }) => `
  <div style="${styles.header}">
    <img src="${appUrl}/masked-icon.svg" alt="Momentum Logo" style="${styles.logo}" />
    <h1 style="${styles.brandName}">Momentum</h1>
  </div>
`;

// Component: Footer with Slogan
const EmailFooter = () => `
  <div style="${styles.footer}">
    <p style="${styles.slogan}">"Accomplish more, together"</p>
    <p style="${styles.copyright}">
      &copy; ${new Date().getFullYear()} Momentum. All rights reserved.
    </p>
  </div>
`;

// Component: Copy Link Section (for Auth emails)
const CopyLinkSection = ({ link, label }: { link: string, label: string }) => `
  <div style="${styles.copyLinkContainer}">
    <div style="${styles.copyLinkLabel}">${label}</div>
    <div style="${styles.copyLinkValue}">${link}</div>
    <p style="font-size: 12px; color: #6B7280; margin-top: 8px; text-align: center;">
      If the button above doesn't work, copy this link into your browser.
    </p>
  </div>
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const bodyText = await req.text();
    if (!bodyText || bodyText.trim() === '') {
      return new Response(
        JSON.stringify({ success: false, error: 'Empty request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const requestBody = JSON.parse(bodyText);
    const { type, to, magicLink, userName, project, creator, deleter, recipient } = requestBody;

    if (!type || !to) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields: type and to' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('MailJet_API_Key') || Deno.env.get('MAILJET_API_KEY') || '';
    const apiSecret = Deno.env.get('MailJet_API_Secret') || Deno.env.get('MAILJET_API_SECRET') || '';
    const fromEmail = Deno.env.get('MailJet_From_Email') || Deno.env.get('MAILJET_FROM_EMAIL') || 'momentum.pwa@gmail.com';
    const fromName = 'Momentum';
    const appUrl = Deno.env.get('VITE_APP_URL') || Deno.env.get('APP_URL') || 'https://social-momentum.netlify.app';

    if (!apiKey || !apiSecret) {
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let emailData: { subject: string; html: string; text: string };

    // =========================================================================
    // TEMPLATE: Sign Up
    // =========================================================================
    if (type === 'signup') {
      const safeUserName = escapeHtml(userName);
      const greeting = safeUserName ? `Hi ${safeUserName},` : 'Hello,';
      const safeMagicLink = escapeHtml(magicLink);

      emailData = {
        subject: 'Welcome to Momentum',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="${styles.body}">
              <div style="${styles.container}">
                ${EmailHeader({ appUrl })}
                
                <div style="${styles.content}">
                  <h2 style="${styles.greeting}">${greeting}</h2>
                  
                  <p style="${styles.paragraph}">
                    Welcome to Momentum! We're excited to have you on board.
                  </p>
                  
                  <p style="${styles.paragraph}">
                    Please verify your email address to get started. This link is valid for 15 minutes.
                  </p>
                  
                  <div style="${styles.buttonContainer}">
                    <a href="${safeMagicLink}" style="${styles.button}">Verify Email</a>
                  </div>

                  ${CopyLinkSection({ link: safeMagicLink, label: 'Verification Link' })}
                </div>
                
                ${EmailFooter()}
              </div>
            </body>
          </html>
        `,
        text: `${greeting}\n\nWelcome to Momentum! Please verify your email address to get started.\n\nVerify Link: ${magicLink}\n\nThis link is valid for 15 minutes.`,
      };
    }
    // =========================================================================
    // TEMPLATE: Sign In
    // =========================================================================
    else if (type === 'signin') {
      const safeUserName = escapeHtml(userName);
      const greeting = safeUserName ? `Hi ${safeUserName},` : 'Hello,';
      const safeMagicLink = escapeHtml(magicLink);

      emailData = {
        subject: 'Sign in to Momentum',
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="${styles.body}">
              <div style="${styles.container}">
                ${EmailHeader({ appUrl })}
                
                <div style="${styles.content}">
                  <h2 style="${styles.greeting}">${greeting}</h2>
                  
                  <p style="${styles.paragraph}">
                    We received a request to sign in to your Momentum account.
                  </p>
                  
                  <div style="${styles.buttonContainer}">
                    <a href="${safeMagicLink}" style="${styles.button}">Sign In</a>
                  </div>

                  ${CopyLinkSection({ link: safeMagicLink, label: 'Sign-in Link' })}

                  <p style="${styles.paragraph}">
                     This link is only valid for 15 minutes. If you didn't request this, you can safely ignore this email.
                  </p>
                </div>
                
                ${EmailFooter()}
              </div>
            </body>
          </html>
        `,
        text: `${greeting}\n\nSign in to Momentum by clicking the link below:\n\n${magicLink}\n\nThis link is valid for 15 minutes. If you didn't request this, ignore this email.`,
      };
    }
    // =========================================================================
    // TEMPLATE: Project Created
    // =========================================================================
    else if (type === 'project-created') {
      if (!project || !recipient) {
        throw new Error('Missing fields for project-created');
      }

      const safeProjectName = escapeHtml(project.name);
      const safeRecipientName = escapeHtml(recipient.name);
      // Link to the project page
      const projectUrl = `${appUrl}/projects/${project.id}`;

      emailData = {
        subject: `Project created: ${safeProjectName}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="${styles.body}">
              <div style="${styles.container}">
                ${EmailHeader({ appUrl })}
                
                <div style="${styles.content}">
                  <h2 style="${styles.greeting}">Hi ${safeRecipientName},</h2>
                  
                  <p style="${styles.paragraph}">
                    You've successfully created the project <strong>"${safeProjectName}"</strong>.
                  </p>
                  
                  <p style="${styles.paragraph}">
                    Ready to get started? Add your first task or invite your team.
                  </p>
                  
                  <div style="${styles.buttonContainer}">
                    <a href="${projectUrl}" style="${styles.button}">View Project</a>
                  </div>
                </div>
                
                ${EmailFooter()}
              </div>
            </body>
          </html>
        `,
        text: `Hi ${safeRecipientName},\n\nYou've successfully created the project "${safeProjectName}".\n\nView project: ${projectUrl}`,
      };
    }
    // =========================================================================
    // TEMPLATE: Project Deleted
    // =========================================================================
    else if (type === 'project-deleted') {
      if (!project || !deleter || !recipient) {
        throw new Error('Missing fields for project-deleted');
      }

      const safeProjectName = escapeHtml(project.name);
      const safeDeleterName = escapeHtml(deleter.name);
      const safeRecipientName = escapeHtml(recipient.name);

      emailData = {
        subject: `Project deleted: ${safeProjectName}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
            </head>
            <body style="${styles.body}">
              <div style="${styles.container}">
                ${EmailHeader({ appUrl })}
                
                <div style="${styles.content}">
                  <h2 style="${styles.greeting}">Hi ${safeRecipientName},</h2>
                  
                  <p style="${styles.paragraph}">
                    The project <strong>"${safeProjectName}"</strong> has been deleted by <strong>${safeDeleterName}</strong>.
                  </p>
                  
                  <p style="${styles.paragraph}">
                    This project is no longer accessible.
                  </p>
                </div>
                
                ${EmailFooter()}
              </div>
            </body>
          </html>
        `,
        text: `Hi ${safeRecipientName},\n\nThe project "${safeProjectName}" has been deleted by ${safeDeleterName}.`,
      };
    }
    else {
      return new Response(
        JSON.stringify({ error: 'Invalid or unsupported email type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send via MailJet
    const auth = btoa(`${apiKey}:${apiSecret}`);
    const mailjetPayload = {
      Messages: [
        {
          From: { Email: fromEmail, Name: fromName },
          To: [{ Email: to }],
          Subject: emailData.subject,
          HTMLPart: emailData.html,
          TextPart: emailData.text,
        },
      ],
    };

    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(mailjetPayload),
    });

    const responseData = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('MailJet API error:', response.status, responseData);
      return new Response(
        JSON.stringify({ success: false, error: 'MailJet API error', details: responseData }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, mailjetResponse: responseData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

