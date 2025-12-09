// ============================================================================
// Task Email Notification Utilities
// ============================================================================
// Uses Supabase Edge Functions to send emails
// ============================================================================

import { getDatabaseClient } from '@/db';

import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';

/**
 * Get Supabase URL lazily (called inside functions, not at module load)
 * This ensures environment variables are available in Vite
 */
function getSupabaseUrlLazy(): string {
  const url = getSupabaseUrl();
  if (!url) {
    console.warn('Supabase URL not configured. Email notifications disabled.');
    throw new Error(
      'Supabase URL not configured. Please set VITE_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in your .env file.'
    );
  }
  // Ensure URL doesn't have trailing slash
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Get Supabase Anon Key lazily (called inside functions, not at module load)
 * This ensures environment variables are available in Vite
 */
function getSupabaseAnonKeyLazy(): string {
  const key = getSupabaseAnonKey();
  if (!key) {
    console.warn('Supabase Anon Key not configured. Email notifications disabled.');
    throw new Error(
      'Supabase Anon Key not configured. Please set VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env file.'
    );
  }
  return key;
}

/**
 * Send task creation email notifications to project participants
 */
export async function notifyTaskCreated(
  taskId: number,
  projectId: number,
  creatorId: number
): Promise<void> {
  try {
    // Get Supabase configuration lazily (when function is called, not at module load)
    const supabaseUrl = getSupabaseUrlLazy();
    const supabaseAnonKey = getSupabaseAnonKeyLazy();

    const db = getDatabaseClient();

    // Get task, project, creator, and participants
    const [task, project, creator] = await Promise.all([
      db.tasks.getById(taskId),
      db.projects.getById(projectId),
      db.users.getById(creatorId),
    ]);

    if (!task || !project || !creator) {
      console.error('Failed to fetch task, project, or creator data');
      return;
    }

    // Get project participants (excluding creator)
    const projectData = await db.projects.getById(projectId);
    if (!projectData || !projectData.participantRoles) {
      return;
    }

    const participants = projectData.participantRoles
      .filter((pp) => pp.userId !== creatorId && !pp.removedAt)
      .map((pp) => pp.userId);

    if (participants.length === 0) {
      return; // No participants to notify
    }

    // Get participant user details
    const participantUsers = await db.users.getByIds(participants);

    // Send email to each participant via Supabase Edge Function
    const emailPromises = participantUsers.map(async (participant) => {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({
            type: 'task-created',
            to: participant.email,
            task: {
              id: task.id,
              title: task.title,
              description: task.description,
              dueDate: task.dueDate,
            },
            project: {
              id: project.id,
              name: project.name,
            },
            creator: {
              id: creator.id,
              name: creator.name,
              email: creator.email,
            },
            recipient: {
              id: participant.id,
              name: participant.name,
              email: participant.email,
            },
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Failed to send email to ${participant.email}:`, response.status, errorText);
        }
      } catch (error) {
        console.error(`Error sending email to ${participant.email}:`, error);
      }
    });

    await Promise.all(emailPromises);
  } catch (error) {
    // Only log warning if it's a configuration error (which we've already logged)
    if (error instanceof Error && error.message.includes('not configured')) {
      // Configuration error already logged in lazy getters
      return;
    }
    console.error('Error sending task creation emails:', error);
    // Don't throw - email failures shouldn't block task creation
  }
}

