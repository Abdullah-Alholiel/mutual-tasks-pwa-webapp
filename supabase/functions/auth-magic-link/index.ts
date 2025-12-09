// @ts-nocheck
// ============================================================================
// Supabase Edge Function: Magic Link Authentication
// ============================================================================
// Handles magic link generation, verification, and session creation
// Note: This file runs on Deno runtime, not Node.js. TypeScript errors are expected
// in the IDE but will work correctly when deployed to Supabase Edge Functions.
// ============================================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Session expiration: 2 months
const SESSION_EXPIRY_DAYS = 60;
const SESSION_EXPIRY_MS = SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

// Magic link expiration: 15 minutes
const MAGIC_LINK_EXPIRY_MS = 15 * 60 * 1000;

/**
 * Get the application URL based on environment
 * Priority:
 * 1. APP_URL environment variable (set in Supabase Edge Function secrets) - recommended
 * 2. VITE_APP_URL environment variable (fallback for compatibility)
 * 3. Auto-detect from Supabase URL (fallback for development)
 * 
 * Production: https://mutualtask-pwa.netlify.app
 * Development: http://localhost:8080
 */
function getAppUrl(): string {
  // Priority 1: Check APP_URL (recommended - set in Supabase secrets)
  const appUrl = Deno.env.get('APP_URL');
  if (appUrl) {
    return appUrl;
  }

  // Priority 2: Check VITE_APP_URL (for backward compatibility)
  const viteAppUrl = Deno.env.get('VITE_APP_URL');
  if (viteAppUrl) {
    return viteAppUrl;
  }

  // Priority 3: Auto-detect from Supabase URL (fallback for local development)
  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  
  // If Supabase URL is a production URL (contains .supabase.co and not localhost)
  const isProduction = supabaseUrl.includes('.supabase.co') && 
                      !supabaseUrl.includes('localhost') &&
                      !supabaseUrl.includes('127.0.0.1');

  // Return production URL if in production, otherwise development URL
  return isProduction 
    ? 'https://mutualtask-pwa.netlify.app'
    : 'http://localhost:8080';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { action, ...data } = await req.json();

    // Generate secure random token
    const generateToken = (): string => {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
    };

    if (action === 'request-login') {
      const { email } = data;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(
          JSON.stringify({ error: 'Valid email address is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user exists
      const { data: user, error: userError } = await supabaseClient
        .from('users')
        .select('id, name, email')
        .eq('email', email)
        .single();

      if (userError || !user) {
        return new Response(
          JSON.stringify({ error: 'User not found. Please sign up first.' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate magic link token
      const token = generateToken();
      const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);

      // Store magic link
      const { error: linkError } = await supabaseClient
        .from('magic_links')
        .insert({
          token,
          user_id: user.id,
          email,
          is_signup: false,
          expires_at: expiresAt.toISOString(),
        });

      if (linkError) throw linkError;

      // Call email function to send magic link
      // Get app URL: check environment variable first, then detect from Supabase URL
      const appUrl = getAppUrl();
      const magicLink = `${appUrl}/auth/verify?token=${token}`;

      // Invoke email function
      try {
        const { data: emailData, error: emailError } = await supabaseClient.functions.invoke('send-email', {
          body: {
            type: 'signin',
            to: email,
            magicLink,
            userName: user.name,
          },
        });

        if (emailError) {
          // Try to extract response body for better error details
          let errorDetails: any = {
            message: emailError.message,
            context: emailError.context,
          };
          
          // If context contains a Response, try to read its body
          if (emailError.context?.response) {
            try {
              const responseBody = await emailError.context.response.text();
              try {
                errorDetails.responseBody = JSON.parse(responseBody);
              } catch {
                errorDetails.responseBody = responseBody;
              }
            } catch {
              // Ignore if we can't read the response
            }
          }
          
          console.error('Failed to send email:', errorDetails);
          // Log the error but don't fail the request - magic link is still valid
        } else {
          console.log('Email sent successfully:', emailData);
        }
      } catch (emailErr: any) {
        console.error('Exception while sending email:', {
          error: emailErr,
          message: emailErr instanceof Error ? emailErr.message : String(emailErr),
          stack: emailErr instanceof Error ? emailErr.stack : undefined,
          context: emailErr?.context,
          response: emailErr?.context?.response ? {
            status: emailErr.context.response.status,
            statusText: emailErr.context.response.statusText,
          } : undefined,
        });
        // Don't fail the request if email fails - magic link is still valid
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Magic link sent to your email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'request-signup') {
      const { email, name, handle } = data;

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(
          JSON.stringify({ error: 'Valid email address is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!name || !handle) {
        return new Response(
          JSON.stringify({ error: 'Name and handle are required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if user already exists
      const { data: existingUser } = await supabaseClient
        .from('users')
        .select('id')
        .or(`email.eq.${email},handle.eq.${handle}`)
        .limit(1);

      if (existingUser && existingUser.length > 0) {
        return new Response(
          JSON.stringify({ error: 'User with this email or handle already exists' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Generate magic link token
      const token = generateToken();
      const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MS);

      // Store magic link with signup data
      const { error: linkError } = await supabaseClient
        .from('magic_links')
        .insert({
          token,
          email,
          is_signup: true,
          signup_name: name,
          signup_handle: handle,
          expires_at: expiresAt.toISOString(),
        });

      if (linkError) throw linkError;

      // Call email function to send magic link
      // Get app URL: check environment variable first, then detect from Supabase URL
      const appUrl = getAppUrl();
      const magicLink = `${appUrl}/auth/verify?token=${token}`;

      // Invoke email function
      try {
        const { data: emailData, error: emailError } = await supabaseClient.functions.invoke('send-email', {
          body: {
            type: 'signup',
            to: email,
            magicLink,
            userName: name,
          },
        });

        if (emailError) {
          // Try to extract response body for better error details
          let errorDetails: any = {
            message: emailError.message,
            context: emailError.context,
          };
          
          // If context contains a Response, try to read its body
          if (emailError.context?.response) {
            try {
              const responseBody = await emailError.context.response.text();
              try {
                errorDetails.responseBody = JSON.parse(responseBody);
              } catch {
                errorDetails.responseBody = responseBody;
              }
            } catch {
              // Ignore if we can't read the response
            }
          }
          
          console.error('Failed to send email:', errorDetails);
          // Log the error but don't fail the request - magic link is still valid
        } else {
          console.log('Email sent successfully:', emailData);
        }
      } catch (emailErr: any) {
        console.error('Exception while sending email:', {
          error: emailErr,
          message: emailErr instanceof Error ? emailErr.message : String(emailErr),
          stack: emailErr instanceof Error ? emailErr.stack : undefined,
          context: emailErr?.context,
          response: emailErr?.context?.response ? {
            status: emailErr.context.response.status,
            statusText: emailErr.context.response.statusText,
          } : undefined,
        });
        // Don't fail the request if email fails - magic link is still valid
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Magic link sent to your email' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify') {
      const { token } = data;

      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Invalid token' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get magic link
      const { data: magicLink, error: linkError } = await supabaseClient
        .from('magic_links')
        .select('*')
        .eq('token', token)
        .is('used_at', null)
        .single();

      if (linkError || !magicLink) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired magic link' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if expired
      if (new Date(magicLink.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: 'Magic link has expired' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let userId: number;

      if (magicLink.is_signup) {
        // Create new user
        if (!magicLink.signup_name || !magicLink.signup_handle) {
          return new Response(
            JSON.stringify({ error: 'Missing user information' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate avatar URL
        const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(magicLink.signup_name)}&background=0EA5E9&color=fff`;

        const { data: newUser, error: userError } = await supabaseClient
          .from('users')
          .insert({
            name: magicLink.signup_name,
            handle: magicLink.signup_handle,
            email: magicLink.email,
            avatar,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          })
          .select()
          .single();

        if (userError) throw userError;
        userId = newUser.id;

        // Create user stats
        await supabaseClient.from('user_stats').insert({
          user_id: userId,
          total_completed_tasks: 0,
          current_streak: 0,
          longest_streak: 0,
          totalscore: 0,
        });
      } else {
        userId = magicLink.user_id;
      }

      // Mark magic link as used
      await supabaseClient
        .from('magic_links')
        .update({ used_at: new Date().toISOString() })
        .eq('token', token);

      // Create session
      const sessionToken = generateToken();
      const sessionExpiresAt = new Date(Date.now() + SESSION_EXPIRY_MS);

      const { error: sessionError } = await supabaseClient
        .from('sessions')
        .insert({
          user_id: userId,
          token: sessionToken,
          expires_at: sessionExpiresAt.toISOString(),
          last_accessed_at: new Date().toISOString(),
        });

      if (sessionError) throw sessionError;

      // Return session token (client will store in cookie/localStorage)
      return new Response(
        JSON.stringify({
          success: true,
          sessionToken,
          expiresAt: sessionExpiresAt.toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

