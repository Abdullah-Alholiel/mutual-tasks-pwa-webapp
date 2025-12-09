// ============================================================================
// TaskStatus Database Module - TaskStatus CRUD Operations
// ============================================================================

import type { TaskStatusEntity } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  transformTaskStatusRow,
  toTaskStatusRow,
  toStringId,
  type TaskStatusRow,
} from '../../../db/transformers';

export class TaskStatusRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get task status by ID
   */
  async getById(id: number): Promise<TaskStatusEntity | null> {
    const { data, error } = await this.supabase
      .from('task_statuses')
      .select('*')
      .eq('id', toStringId(id))
      .single();

    if (error || !data) return null;
    return transformTaskStatusRow(data as TaskStatusRow);
  }

  /**
   * Get all task statuses for a specific task
   */
  async getByTaskId(taskId: number): Promise<TaskStatusEntity[]> {
    const { data, error } = await this.supabase
      .from('task_statuses')
      .select('*')
      .eq('task_id', toStringId(taskId))
      .order('created_at', { ascending: true });

    if (error || !data) return [];
    return data.map((row: TaskStatusRow) => transformTaskStatusRow(row));
  }

  /**
   * Get task statuses for multiple tasks
   */
  async getByTaskIds(taskIds: number[]): Promise<TaskStatusEntity[]> {
    if (taskIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from('task_statuses')
      .select('*')
      .in('task_id', taskIds.map(toStringId));

    if (error || !data) return [];
    return data.map((row: TaskStatusRow) => transformTaskStatusRow(row));
  }

  /**
   * Get task status for a specific user and task
   */
  async getByTaskAndUser(taskId: number, userId: number): Promise<TaskStatusEntity | null> {
    const { data, error } = await this.supabase
      .from('task_statuses')
      .select('*')
      .eq('task_id', toStringId(taskId))
      .eq('user_id', toStringId(userId))
      .single();

    if (error || !data) return null;
    return transformTaskStatusRow(data as TaskStatusRow);
  }

  /**
   * Get all task statuses for a specific user
   */
  async getByUserId(userId: number): Promise<TaskStatusEntity[]> {
    const { data, error } = await this.supabase
      .from('task_statuses')
      .select('*')
      .eq('user_id', toStringId(userId))
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: TaskStatusRow) => transformTaskStatusRow(row));
  }

  /**
   * Create a new task status
   */
  async create(
    statusData: Omit<TaskStatusEntity, 'id'>
  ): Promise<TaskStatusEntity> {
    const row = toTaskStatusRow(statusData);

    const { data, error } = await this.supabase
      .from('task_statuses')
      .insert(row)
      .select()
      .single();

    if (error) throw error;
    return transformTaskStatusRow(data as TaskStatusRow);
  }

  /**
   * Create multiple task statuses (for assigning task to multiple users)
   */
  async createMany(
    statusesData: Omit<TaskStatusEntity, 'id'>[]
  ): Promise<TaskStatusEntity[]> {
    if (statusesData.length === 0) return [];

    const rows = statusesData.map((status) => toTaskStatusRow(status));

    const { data, error } = await this.supabase
      .from('task_statuses')
      .insert(rows)
      .select();

    if (error) throw error;
    return data.map((row: TaskStatusRow) => transformTaskStatusRow(row));
  }

  /**
   * Update an existing task status
   */
  async update(
    id: number,
    statusData: Partial<TaskStatusEntity>
  ): Promise<TaskStatusEntity> {
    const row = toTaskStatusRow(statusData);

    const { data, error } = await this.supabase
      .from('task_statuses')
      .update(row)
      .eq('id', toStringId(id))
      .select()
      .single();

    if (error) throw error;
    return transformTaskStatusRow(data as TaskStatusRow);
  }

  /**
   * Update task status by task and user (upsert pattern)
   */
  async updateByTaskAndUser(
    taskId: number,
    userId: number,
    statusData: Partial<TaskStatusEntity>
  ): Promise<TaskStatusEntity> {
    const row = toTaskStatusRow(statusData);

    // Try to update first
    const { data: updateData, error: updateError } = await this.supabase
      .from('task_statuses')
      .update(row)
      .eq('task_id', toStringId(taskId))
      .eq('user_id', toStringId(userId))
      .select()
      .single();

    if (updateError && updateError.code !== 'PGRST116') {
      // PGRST116 = no rows updated, try insert
      const { data: insertData, error: insertError } = await this.supabase
        .from('task_statuses')
        .insert({
          ...row,
          task_id: toStringId(taskId),
          user_id: toStringId(userId),
        })
        .select()
        .single();

      if (insertError) throw insertError;
      return transformTaskStatusRow(insertData as TaskStatusRow);
    }

    if (updateError) throw updateError;
    return transformTaskStatusRow(updateData as TaskStatusRow);
  }

  /**
   * Delete a task status
   */
  async delete(id: number): Promise<void> {
    const { error } = await this.supabase
      .from('task_statuses')
      .delete()
      .eq('id', toStringId(id));

    if (error) throw error;
  }

  /**
   * Delete all task statuses for a task
   */
  async deleteByTaskId(taskId: number): Promise<void> {
    const { error } = await this.supabase
      .from('task_statuses')
      .delete()
      .eq('task_id', toStringId(taskId));

    if (error) throw error;
  }

  /**
   * Delete task status for a specific user and task
   */
  async deleteByTaskAndUser(taskId: number, userId: number): Promise<void> {
    const { error } = await this.supabase
      .from('task_statuses')
      .delete()
      .eq('task_id', toStringId(taskId))
      .eq('user_id', toStringId(userId));

    if (error) throw error;
  }
}

