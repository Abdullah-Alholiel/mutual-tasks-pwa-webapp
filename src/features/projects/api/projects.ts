// ============================================================================
// Projects Database Module - Project CRUD Operations
// ============================================================================

import type { Project, ProjectParticipant } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  transformProjectRow,
  transformProjectParticipantRow,
  transformUserRow,
  toProjectRow,
  toNumberId,
  toStringId,
  type ProjectRow,
  type ProjectParticipantRow,
} from '../../../db/transformers';

export class ProjectsRepository {
  constructor(private supabase: SupabaseClient) { }

  /**
   * Get a project by ID with participants
   */
  async getById(id: number): Promise<Project | null> {
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', toStringId(id))
      .maybeSingle();

    if (error || !data) return null;

    const participants = await this.getParticipants(id);
    return transformProjectRow(data as ProjectRow, participants);
  }

  /**
   * Get all projects with optional filters
   */
  async getAll(filters?: {
    userId?: number;
    isPublic?: boolean;
    ownerId?: number;
  }): Promise<Project[]> {
    let query = this.supabase.from('projects').select('*');

    if (filters?.isPublic !== undefined) {
      query = query.eq('is_public', filters.isPublic);
    }

    if (filters?.ownerId !== undefined) {
      query = query.eq('owner_id', toStringId(filters.ownerId));
    }

    if (filters?.userId !== undefined) {
      // Get projects where user is owner or participant
      const participantProjects = await this.supabase
        .from('project_participants')
        .select('project_id')
        .eq('user_id', toStringId(filters.userId))
        .is('removed_at', null);

      const projectIds = participantProjects.data?.map((p) => p.project_id) || [];
      query = query.or(
        `owner_id.eq.${toStringId(filters.userId)},id.in.(${projectIds.join(',')})`
      );
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error || !data) return [];

    // Fetch participants for all projects
    const projectIds = data.map((row: ProjectRow) => row.id);
    const allParticipants = await this.getParticipantsForProjects(projectIds);

    return data.map((row: ProjectRow) => {
      const participants = allParticipants.filter(
        (p) => p.projectId === Number(row.id)
      );
      return transformProjectRow(row, participants);
    });
  }

  /**
   * Create a new project
   */
  async create(projectData: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>): Promise<Project> {
    console.log('[ProjectsRepository] Creating project:', JSON.stringify(projectData, null, 2));

    const row = toProjectRow(projectData);
    console.log('[ProjectsRepository] Transformed to row:', JSON.stringify(row, null, 2));

    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('projects')
      .insert({
        ...row,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) {
      console.error('[ProjectsRepository] Create project error:', error);
      throw error;
    }

    console.log('[ProjectsRepository] Project created successfully:', data);

    // Add owner as participant
    if (projectData.ownerId) {
      console.log('[ProjectsRepository] Adding owner as participant:', projectData.ownerId);
      await this.addParticipant(Number(data.id), projectData.ownerId, 'owner');
    }

    return transformProjectRow(data as ProjectRow);
  }

  /**
   * Update an existing project
   */
  async update(id: number, projectData: Partial<Project>): Promise<Project> {
    const row = toProjectRow(projectData);
    row.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('projects')
      .update(row)
      .eq('id', toStringId(id))
      .select()
      .single();

    if (error) throw error;

    const participants = await this.getParticipants(id);
    return transformProjectRow(data as ProjectRow, participants);
  }

  /**
   * Delete a project
   *
   * Delete order matters: the live schema's FKs are ON DELETE NO ACTION
   * (migrations 001-003; 004's CASCADE is built but owner-apply is pending),
   * so grandchildren must be cleared before tasks, and tasks before the
   * project. The previous order (participants -> tasks -> project) left
   * task_statuses/completion_logs rows behind, so ANY project containing a
   * completed task failed to delete with 23503 (L4d acceptance suite, run 28;
   * live-probed via REST before the fix). Errors on the child clears are
   * thrown now — a silently half-deleted project is worse than a loud failure.
   */
  async delete(id: number): Promise<void> {
    const sid = toStringId(id);

    // 0. This project's task ids (children of the project, parents of the
    //    grandchildren cleared below).
    const { data: taskRows, error: idsErr } = await this.supabase
      .from('tasks')
      .select('id')
      .eq('project_id', sid);
    if (idsErr) throw idsErr;
    const taskIds = (taskRows ?? []).map((r: { id: number | string }) => r.id);

    // 1. Grandchildren of tasks (deepest first: logs/statuses/recurrence).
    //    Post-004 the DB cascade makes these no-ops; pre-004 (today) they are
    //    required for rows the caller can see. NOT a full safety net: under
    //    004 scoped policies a multi-member project still hides other
    //    participants' rows from this client (the deletes silently skip
    //    them) — only 004's task-child CASCADE removes those, at the tasks
    //    delete below. Under today's allow-all prod policies every clear
    //    reaches every row, so the order alone fixes the 23503.
    if (taskIds.length > 0) {
      const { error: logsErr } = await this.supabase
        .from('completion_logs')
        .delete()
        .in('task_id', taskIds);
      if (logsErr) throw logsErr;

      const { error: statusErr } = await this.supabase
        .from('task_statuses')
        .delete()
        .in('task_id', taskIds);
      if (statusErr) throw statusErr;

      const { error: recErr } = await this.supabase
        .from('task_recurrence')
        .delete()
        .in('task_id', taskIds);
      if (recErr) throw recErr;

      const { error: notifTaskErr } = await this.supabase
        .from('notifications')
        .delete()
        .in('task_id', taskIds);
      if (notifTaskErr) throw notifTaskErr;
    }

    // 2. Notifications referencing the project directly
    const { error: notifProjErr } = await this.supabase
      .from('notifications')
      .delete()
      .eq('project_id', sid);
    if (notifProjErr) throw notifProjErr;

    // 3. Tasks, then participants, then the project itself
    const { error: tasksErr } = await this.supabase.from('tasks').delete().eq('project_id', sid);
    if (tasksErr) throw tasksErr;

    const { error: partErr } = await this.supabase.from('project_participants').delete().eq('project_id', sid);
    if (partErr) throw partErr;

    const { error } = await this.supabase.from('projects').delete().eq('id', sid);
    if (error) throw error;
  }

  /**
   * Get project participants
   */
  async getParticipants(projectId: number): Promise<ProjectParticipant[]> {
    const { data, error } = await this.supabase
      .from('project_participants')
      .select('*')
      .eq('project_id', toStringId(projectId))
      .is('removed_at', null)
      .order('added_at', { ascending: true });

    if (error || !data) return [];

    const participants = data.map((row: ProjectParticipantRow) => transformProjectParticipantRow(row));

    // Fetch user data for each participant
    const userIds = participants.map(p => p.userId);
    if (userIds.length > 0) {
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .in('id', userIds.map(toStringId));

      if (!userError && userData) {
        const userMap = new Map(userData.map((u: Record<string, unknown>) => [toNumberId(u.id), transformUserRow(u)]));
        participants.forEach(p => {
          p.user = userMap.get(p.userId);
        });
      }
    }

    return participants;
  }

  /**
   * Get participants for multiple projects
   */
  async getParticipantsForProjects(projectIds: string[]): Promise<ProjectParticipant[]> {
    if (projectIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from('project_participants')
      .select('*')
      .in('project_id', projectIds)
      .is('removed_at', null);

    if (error || !data) return [];

    const participants = data.map((row: ProjectParticipantRow) => transformProjectParticipantRow(row));

    // Fetch user data for each participant
    const userIds = [...new Set(participants.map(p => p.userId))];
    if (userIds.length > 0) {
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .in('id', userIds.map(toStringId));

      if (!userError && userData) {
        const userMap = new Map(userData.map((u: Record<string, unknown>) => [toNumberId(u.id), transformUserRow(u)]));
        participants.forEach(p => {
          p.user = userMap.get(p.userId);
        });
      }
    }

    return participants;
  }

  /**
   * Add a participant to a project
   */
  async addParticipant(
    projectId: number,
    userId: number,
    role: ProjectParticipant['role'] = 'participant'
  ): Promise<ProjectParticipant> {
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('project_participants')
      .upsert({
        project_id: toStringId(projectId),
        user_id: toStringId(userId),
        role,
        added_at: now,
        removed_at: null, // Clear removed_at if it was set
      })
      .select()
      .single();

    if (error) throw error;
    return transformProjectParticipantRow(data as ProjectParticipantRow);
  }

  /**
   * Update participant role
   */
  async updateParticipantRole(
    projectId: number,
    userId: number,
    role: ProjectParticipant['role']
  ): Promise<ProjectParticipant> {
    const { data, error } = await this.supabase
      .from('project_participants')
      .update({ role })
      .eq('project_id', toStringId(projectId))
      .eq('user_id', toStringId(userId))
      .select()
      .single();

    if (error) throw error;
    return transformProjectParticipantRow(data as ProjectParticipantRow);
  }

  /**
   * Remove a participant from a project (Soft Delete)
   */
  async removeParticipant(projectId: number, userId: number): Promise<void> {
    const now = new Date().toISOString();

    // Perform soft delete by setting removed_at
    const { error } = await this.supabase
      .from('project_participants')
      .update({
        removed_at: now,
        role: 'participant' // Reset role to participant to avoid zombie managers/owners if they rejoin
      })
      .eq('project_id', toStringId(projectId))
      .eq('user_id', toStringId(userId));

    if (error) throw error;
  }
}


