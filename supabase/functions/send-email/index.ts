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
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { type, to, magicLink, userName, task, project, creator, recipient } = await req.json();

    const apiKey = Deno.env.get('MailJet_API_Key') || Deno.env.get('MAILJET_API_KEY') || '';
    const apiSecret = Deno.env.get('MailJet_API_Secret') || Deno.env.get('MAILJET_API_SECRET') || '';
    const fromEmail = Deno.env.get('MailJet_From_Email') || Deno.env.get('MAILJET_FROM_EMAIL') || 'noreply@momentum.app';
    const fromName = Deno.env.get('MailJet_From_Name') || Deno.env.get('MAILJET_FROM_NAME') || 'Momentum';

    if (!apiKey || !apiSecret) {
      console.warn('MailJet credentials not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let emailData: { subject: string; html: string; text: string };

    if (type === 'signup') {
      const greeting = userName ? `Hi ${userName},` : 'Hi there,';
      emailData = {
        subject: 'Welcome to Momentum! Complete your signup',
        html: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Momentum! 🎉</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Collaborative Tasks</p>
              </div>
              <div style="background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h2 style="color: #1a1a1a; margin-top: 0;">${greeting}</h2>
                <p style="color: #666; font-size: 16px;">Thank you for signing up! Click the button below to verify your email and complete your registration. This link will expire in 15 minutes.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Complete Signup</a>
                </div>
                <p style="color: #999; font-size: 14px; margin-top: 30px;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="color: #0EA5E9; font-size: 14px; word-break: break-all;">${magicLink}</p>
              </div>
            </body>
          </html>
        `,
        text: `${greeting}\n\nThank you for signing up! Click the link below to verify your email:\n\n${magicLink}\n\nThis link will expire in 15 minutes.`,
      };
    } else if (type === 'signin') {
      const greeting = userName ? `Hi ${userName},` : 'Hi there,';
      emailData = {
        subject: 'Sign in to Momentum',
        html: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
                <h1 style="color: white; margin: 0; font-size: 28px;">Momentum</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Collaborative Tasks</p>
              </div>
              <div style="background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <h2 style="color: #1a1a1a; margin-top: 0;">${greeting}</h2>
                <p style="color: #666; font-size: 16px;">Click the button below to sign in to your Momentum account. This link will expire in 15 minutes.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${magicLink}" style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">Sign In to Momentum</a>
                </div>
                <p style="color: #999; font-size: 14px; margin-top: 30px;">If the button doesn't work, copy and paste this link into your browser:</p>
                <p style="color: #0EA5E9; font-size: 14px; word-break: break-all;">${magicLink}</p>
              </div>
            </body>
          </html>
        `,
        text: `${greeting}\n\nClick the link below to sign in:\n\n${magicLink}\n\nThis link will expire in 15 minutes.`,
      };
    } else if (type === 'task-created') {
      const appUrl = Deno.env.get('VITE_APP_URL') || 'https://momentum.app';
      const taskUrl = `${appUrl}/projects/${project.id}`;
      emailData = {
        subject: `New task: "${task.title}" in ${project.name}`,
        html: `
          <!DOCTYPE html>
          <html>
            <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
                <h1 style="color: white; margin: 0; font-size: 28px;">New Task Created! 📝</h1>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">${project.name}</p>
              </div>
              <div style="background: #fff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <p style="font-size: 16px; color: #666;">Hi <strong>${recipient.name}</strong>,</p>
                <p style="font-size: 16px; color: #666;"><strong>${creator.name}</strong> has created a new task in <strong>${project.name}</strong>:</p>
                <div style="background: #f5f5f5; border-left: 4px solid #0EA5E9; padding: 15px; margin: 20px 0; border-radius: 4px;">
                  <h3 style="margin: 0 0 10px 0; color: #1a1a1a; font-size: 18px;">${task.title}</h3>
                  ${task.description ? `<p style="margin: 0; color: #666; font-size: 14px;">${task.description}</p>` : ''}
                  <p style="margin: 10px 0 0 0; color: #999; font-size: 12px;">Due: ${new Date(task.dueDate || task.due_date).toLocaleDateString()}</p>
                </div>
                <p style="font-size: 16px; color: #666;">You're a participant in this project, so this task has been assigned to you. Click below to view and get started!</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${taskUrl}" style="display: inline-block; background: linear-gradient(135deg, #0EA5E9 0%, #3B82F6 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">View Task</a>
                </div>
              </div>
            </body>
          </html>
        `,
        text: `Hi ${recipient.name},\n\n${creator.name} has created a new task "${task.title}" in ${project.name}.\n\n${task.description ? `Description: ${task.description}\n\n` : ''}Due: ${new Date(task.dueDate || task.due_date).toLocaleDateString()}\n\nView the task: ${taskUrl}`,
      };
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid email type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send via MailJet
    const auth = btoa(`${apiKey}:${apiSecret}`);
    const response = await fetch('https://api.mailjet.com/v3.1/send', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Messages: [
          {
            From: { Email: fromEmail, Name: fromName },
            To: [{ Email: to }],
            Subject: emailData.subject,
            HTMLPart: emailData.html,
            TextPart: emailData.text,
          },
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('MailJet error:', error);
      throw new Error(`MailJet API error: ${response.status}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
