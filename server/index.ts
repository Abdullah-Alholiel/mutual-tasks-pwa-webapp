/**
 * API Server for VPS Deployment
 * 
 * Replaces Netlify serverless functions for Coolify deployment.
 * In production: serves the built Vite frontend as static files
 * and provides API routes for the functions that were on Netlify.
 * 
 * Routes:
 *   POST /api/ai-generated-description  → calls n8n webhook
 *   POST /api/ai-generate-project       → calls n8n webhook
 *   POST /api/ai-confirm-usage          → increments AI usage counter
 *   POST /api/send-push-notification    → sends via OneSignal
 */

import express from 'express';
import cors from 'cors';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.API_PORT || 3001;

// ── Middleware ──────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'authorization', 'x-user-timezone'],
}));
app.use(express.json());

// ── Helpers (from netlify/functions/shared/utils.ts) ───────
const AI_USAGE_LIMITS = {
  project_generation: 3,
  description_generation: 10,
} as const;

type AIUsageType = keyof typeof AI_USAGE_LIMITS;

function getTodayDate(timezone: string = 'UTC'): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
}

function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    global: { headers: { 'apikey': key } },
  });
}

async function verifyMagicLinkSession(token: string): Promise<number | null> {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;
  return data.user_id;
}

async function checkRateLimit(
  supabaseAdmin: SupabaseClient,
  userId: number,
  usageType: AIUsageType,
  timezone: string = 'UTC'
): Promise<{ allowed: boolean; remaining: number; limit: number; used: number }> {
  const today = getTodayDate(timezone);
  const limit = AI_USAGE_LIMITS[usageType];

  const { data, error } = await supabaseAdmin
    .from('ai_usage_logs')
    .select('count')
    .eq('user_id', userId)
    .eq('usage_type', usageType)
    .eq('usage_date', today)
    .maybeSingle();

  if (error) {
    console.error('[AI Rate Limit] Failed:', error.message);
    return { allowed: false, remaining: 0, limit, used: 0 };
  }

  const used = data?.count ?? 0;
  return {
    allowed: used < limit,
    remaining: Math.max(0, limit - used),
    limit,
    used,
  };
}

async function incrementUsage(
  supabaseAdmin: SupabaseClient,
  userId: number,
  usageType: AIUsageType,
  timezone: string = 'UTC'
): Promise<void> {
  const today = getTodayDate(timezone);
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('ai_usage_logs')
    .select('id, count')
    .eq('user_id', userId)
    .eq('usage_type', usageType)
    .eq('usage_date', today)
    .maybeSingle();

  if (fetchError) throw new Error('Failed to check usage record');

  if (existing) {
    const { error: updateError } = await supabaseAdmin
      .from('ai_usage_logs')
      .update({ count: existing.count + 1, updated_at: new Date().toISOString() })
      .eq('id', existing.id);
    if (updateError) throw new Error('Failed to update usage count');
  } else {
    const { error: insertError } = await supabaseAdmin
      .from('ai_usage_logs')
      .insert({ user_id: userId, usage_type: usageType, usage_date: today, count: 1 });
    if (insertError) throw new Error('Failed to record usage');
  }
}

function extractSessionToken(req: express.Request): string | null {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !typeof authHeader === 'string' || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
}

// ── Routes ─────────────────────────────────────────────────

/**
 * POST /api/ai-generated-description
 * Calls n8n webhook to generate a task/project description via AI.
 */
app.post('/api/ai-generated-description', async (req, res) => {
  const { title, type = 'task' } = req.body;
  const timezone = req.headers['x-user-timezone'] as string || 'UTC';

  if (!title?.trim()) {
    res.status(400).json({ error: 'Missing required parameter: title' });
    return;
  }

  const sessionToken = extractSessionToken(req);
  if (!sessionToken) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    return;
  }

  const userId = await verifyMagicLinkSession(sessionToken);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const rateLimit = await checkRateLimit(supabaseAdmin, userId, 'description_generation', timezone);

  if (!rateLimit.allowed) {
    res.set('X-RateLimit-Remaining', '0');
    res.set('X-RateLimit-Limit', String(rateLimit.limit));
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: `You've used all ${rateLimit.limit} AI generations for today. Try again tomorrow!`,
      limit: rateLimit.limit,
      remaining: 0,
    });
    return;
  }

  const n8nUrl = process.env.N8N_DESCRIPTION_WEBHOOK_URL;
  if (!n8nUrl) {
    res.status(500).json({ error: 'Server configuration error: Missing Description Webhook URL' });
    return;
  }

  const secretKey = process.env.x_momentum_secret;

  try {
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-momentum-secret': secretKey || '',
        'x_momentum_secret': secretKey || '',
      },
      body: JSON.stringify({ title: title.trim(), project_title: title.trim(), type }),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[AI Description] n8n error:', response.status);
      res.status(502).json({ error: 'AI service unavailable' });
      return;
    }

    const responseText = await response.text();
    if (!responseText?.trim()) {
      res.status(204).send('');
      return;
    }

    try {
      await incrementUsage(supabaseAdmin, userId, 'description_generation', timezone);
    } catch (e) {
      console.error('[AI Description] Failed to increment usage:', e);
    }

    res.set('X-RateLimit-Limit', String(rateLimit.limit));
    res.set('X-RateLimit-Remaining', String(rateLimit.remaining - 1));
    res.set('X-RateLimit-Reset', String(Date.now() + 86400000));
    res.status(200).send(responseText);
  } catch (error) {
    console.error('[AI Description] Error:', error);
    res.status(500).json({ error: 'Failed to generate description' });
  }
});

/**
 * POST /api/ai-generate-project
 * Calls n8n webhook to generate a project via AI.
 */
app.post('/api/ai-generate-project', async (req, res) => {
  const { title, type = 'project' } = req.body;
  const timezone = req.headers['x-user-timezone'] as string || 'UTC';

  if (!title?.trim()) {
    res.status(400).json({ error: 'Missing required parameter: title' });
    return;
  }

  const sessionToken = extractSessionToken(req);
  if (!sessionToken) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    return;
  }

  const userId = await verifyMagicLinkSession(sessionToken);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    return;
  }

  const supabaseAdmin = getSupabaseAdmin();
  const rateLimit = await checkRateLimit(supabaseAdmin, userId, 'project_generation', timezone);

  if (!rateLimit.allowed) {
    res.set('X-RateLimit-Remaining', '0');
    res.set('X-RateLimit-Limit', String(rateLimit.limit));
    res.status(429).json({
      error: 'Rate limit exceeded',
      message: `You've used all ${rateLimit.limit} AI project generations for today.`,
      limit: rateLimit.limit,
      remaining: 0,
    });
    return;
  }

  const n8nUrl = process.env.N8N_PROJECT_WEBHOOK_URL;
  if (!n8nUrl) {
    res.status(500).json({ error: 'Server configuration error: Missing Project Webhook URL' });
    return;
  }

  const secretKey = process.env.x_momentum_secret;

  try {
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-momentum-secret': secretKey || '',
        'x_momentum_secret': secretKey || '',
      },
      body: JSON.stringify({ title: title.trim(), project_title: title.trim(), type }),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[AI Project] n8n error:', response.status);
      res.status(502).json({ error: 'AI service unavailable' });
      return;
    }

    const responseText = await response.text();
    if (!responseText?.trim()) {
      res.status(204).send('');
      return;
    }

    try {
      await incrementUsage(supabaseAdmin, userId, 'project_generation', timezone);
    } catch (e) {
      console.error('[AI Project] Failed to increment usage:', e);
    }

    res.set('X-RateLimit-Limit', String(rateLimit.limit));
    res.set('X-RateLimit-Remaining', String(rateLimit.remaining - 1));
    res.set('X-RateLimit-Reset', String(Date.now() + 86400000));
    res.status(200).send(responseText);
  } catch (error) {
    console.error('[AI Project] Error:', error);
    res.status(500).json({ error: 'Failed to generate project' });
  }
});

/**
 * POST /api/ai-confirm-usage
 * Manually increments AI usage counter for a user.
 */
app.post('/api/ai-confirm-usage', async (req, res) => {
  const { usageType } = req.body;
  const timezone = req.headers['x-user-timezone'] as string || 'UTC';

  const sessionToken = extractSessionToken(req);
  if (!sessionToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const userId = await verifyMagicLinkSession(sessionToken);
  if (!userId) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    return;
  }

  if (!usageType || !(usageType in AI_USAGE_LIMITS)) {
    res.status(400).json({ error: 'Invalid usage type' });
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    await incrementUsage(supabaseAdmin, userId, usageType as AIUsageType, timezone);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('[AI Confirm] Error:', error);
    res.status(500).json({ error: 'Failed to confirm usage' });
  }
});

/**
 * POST /api/send-push-notification
 * Sends a push notification via OneSignal.
 */
app.post('/api/send-push-notification', async (req, res) => {
  const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
  const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

  if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
    res.status(500).json({ error: 'Push notification service not configured' });
    return;
  }

  const { externalUserId, title, message, url, icon, data } = req.body;

  if (!externalUserId || !title || !message) {
    res.status(400).json({ error: 'Missing required fields: externalUserId, title, message' });
    return;
  }

  try {
    const payload = {
      app_id: ONESIGNAL_APP_ID,
      include_aliases: { external_id: [String(externalUserId)] },
      target_channel: 'push',
      headings: { en: title },
      contents: { en: message },
      ...(url && { url }),
      small_icon: icon || '/icons/icon-192x192.png',
      large_icon: icon || '/icons/icon-192x192.png',
      ...(data && { data }),
      ios_badgeType: 'Increase',
      ios_badgeCount: 1,
    };

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = JSON.parse(await response.text());

    if (!response.ok) {
      console.error('[Push] OneSignal error:', response.status, result);
      res.status(response.status).json({ error: 'Failed to send push notification', details: result });
      return;
    }

    if (result.errors?.includes('All included players are not subscribed')) {
      res.status(200).json({
        success: false,
        error: 'No subscription found for user',
        externalUserId,
      });
      return;
    }

    res.status(200).json({ success: true, id: result.id, recipients: result.recipients });
  } catch (error) {
    console.error('[Push] Error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Health check ───────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Serve static frontend in production ────────────────────
const staticPath = path.join(__dirname, '../dist');
app.use(express.static(staticPath));
app.get('*', (_req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// ── Start ──────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`Static files from: ${staticPath}`);
});
