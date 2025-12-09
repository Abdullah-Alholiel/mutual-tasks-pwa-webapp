// ============================================================================
// Projects Database Module - Project CRUD Operations
// ============================================================================

import type { Project, ProjectParticipant } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  transformProjectRow,
  transformProjectParticipantRow,
  toProjectRow,
  toStringId,
  type ProjectRow,
  type ProjectParticipantRow,
} from '../../../db/transformers';

export class ProjectsRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get a project by ID with participants
   */
  async getById(id: number): Promise<Project | null> {
    const { data, error } = await this.supabase
      .from('projects')
      .select('*')
      .eq('id', toStringId(id))
      .single();

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
    const row = toProjectRow(projectData);
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

    if (error) throw error;

    // Add owner as participant
    if (projectData.ownerId) {
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
   */
  async delete(id: number): Promise<void> {
    // Delete related records first (cascade should handle this, but being explicit)
    await this.supabase.from('project_participants').delete().eq('project_id', toStringId(id));
    await this.supabase.from('tasks').delete().eq('project_id', toStringId(id));

    const { error } = await this.supabase.from('projects').delete().eq('id', toStringId(id));

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
    return data.map((row: ProjectParticipantRow) => transformProjectParticipantRow(row));
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
    return data.map((row: ProjectParticipantRow) => transformProjectParticipantRow(row));
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
      .insert({
        project_id: toStringId(projectId),
        user_id: toStringId(userId),
        role,
        added_at: now,
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
   * Remove a participant from a project
   */
  async removeParticipant(projectId: number, userId: number): Promise<void> {
    const { error } = await this.supabase
      .from('project_participants')
      .update({ removed_at: new Date().toISOString() })
      .eq('project_id', toStringId(projectId))
      .eq('user_id', toStringId(userId));

    if (error) throw error;
  }
}


