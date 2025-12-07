// ============================================================================
// Task Email Notification Utilities
// ============================================================================
// Uses Supabase Edge Functions to send emails
// ============================================================================

import { getDatabaseClient } from '@/db';

import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';

const SUPABASE_URL = getSupabaseUrl();
const SUPABASE_ANON_KEY = getSupabaseAnonKey();

/**
 * Send task creation email notifications to project participants
 */
export async function notifyTaskCreated(
  taskId: number,
  projectId: number,
  creatorId: number
): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn('Supabase not configured. Email notifications disabled.');
    return;
  }

  try {
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
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
          console.error(`Failed to send email to ${participant.email}`);
        }
      } catch (error) {
        console.error(`Error sending email to ${participant.email}:`, error);
      }
    });

    await Promise.all(emailPromises);
  } catch (error) {
    console.error('Error sending task creation emails:', error);
    // Don't throw - email failures shouldn't block task creation
  }
}
