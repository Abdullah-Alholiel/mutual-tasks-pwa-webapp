// ============================================================================
// Tasks Database Module - Task CRUD Operations
// ============================================================================

import type { Task, TaskRecurrence } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  transformTaskRow,
  transformTaskRecurrenceRow,
  toTaskRow,
  toStringId,
  type TaskRow,
  type TaskRecurrenceRow,
} from './transformers';
import { TaskStatusRepository } from './taskStatus';

export class TasksRepository {
  constructor(
    private supabase: SupabaseClient,
    private taskStatusRepo: TaskStatusRepository
  ) {}

  /**
   * Get a task by ID with statuses and recurrence
   */
  async getById(id: number): Promise<Task | null> {
    const { data, error } = await this.supabase
      .from('tasks')
      .select('*')
      .eq('id', toStringId(id))
      .single();

    if (error || !data) return null;

    const [taskStatuses, recurrence] = await Promise.all([
      this.taskStatusRepo.getByTaskId(id),
      this.getRecurrence(id),
    ]);

    return transformTaskRow(data as TaskRow, taskStatuses, recurrence || undefined);
  }

  /**
   * Get all tasks with optional filters
   */
  async getAll(filters?: {
    projectId?: number;
    creatorId?: number;
    userId?: number; // Tasks assigned to user
  }): Promise<Task[]> {
    let query = this.supabase.from('tasks').select('*');

    if (filters?.projectId !== undefined) {
      query = query.eq('project_id', toStringId(filters.projectId));
    }

    if (filters?.creatorId !== undefined) {
      query = query.eq('creator_id', toStringId(filters.creatorId));
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error || !data) return [];

    // If filtering by userId, filter tasks that have status for that user
    let tasks = data as TaskRow[];
    if (filters?.userId !== undefined) {
      const taskIds = tasks.map((t) => Number(t.id));
      const statuses = await this.taskStatusRepo.getByTaskIds(taskIds);
      const userTaskIds = new Set(
        statuses.filter((s) => s.userId === filters.userId).map((s) => s.taskId)
      );
      tasks = tasks.filter((t) => userTaskIds.has(Number(t.id)));
    }

    // Fetch statuses and recurrences for all tasks
    const taskIds = tasks.map((t) => Number(t.id));
    const [allStatuses, allRecurrences] = await Promise.all([
      this.taskStatusRepo.getByTaskIds(taskIds),
      this.getRecurrencesForTasks(taskIds),
    ]);

    return tasks.map((row: TaskRow) => {
      const taskId = Number(row.id);
      const taskStatuses = allStatuses.filter((s) => s.taskId === taskId);
      const recurrence = allRecurrences.find((r) => r.taskId === taskId);
      return transformTaskRow(row, taskStatuses, recurrence);
    });
  }

  /**
   * Create a new task
   */
  async create(taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const row = toTaskRow(taskData);
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('tasks')
      .insert({
        ...row,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;

    const task = transformTaskRow(data as TaskRow);
    return task;
  }

  /**
   * Update an existing task
   */
  async update(id: number, taskData: Partial<Task>): Promise<Task> {
    const row = toTaskRow(taskData);
    row.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('tasks')
      .update(row)
      .eq('id', toStringId(id))
      .select()
      .single();

    if (error) throw error;

    const [taskStatuses, recurrence] = await Promise.all([
      this.taskStatusRepo.getByTaskId(id),
      this.getRecurrence(id),
    ]);

    return transformTaskRow(data as TaskRow, taskStatuses, recurrence || undefined);
  }

  /**
   * Delete a task
   */
  async delete(id: number): Promise<void> {
    // Delete related records first
    await this.taskStatusRepo.deleteByTaskId(id);
    await this.supabase.from('task_recurrences').delete().eq('task_id', toStringId(id));
    await this.supabase.from('completion_logs').delete().eq('task_id', toStringId(id));

    const { error } = await this.supabase.from('tasks').delete().eq('id', toStringId(id));

    if (error) throw error;
  }

  /**
   * Get task recurrence
   */
  async getRecurrence(taskId: number): Promise<TaskRecurrence | null> {
    const { data, error } = await this.supabase
      .from('task_recurrences')
      .select('*')
      .eq('task_id', toStringId(taskId))
      .single();

    if (error || !data) return null;
    return transformTaskRecurrenceRow(data as TaskRecurrenceRow);
  }

  /**
   * Get recurrences for multiple tasks
   */
  async getRecurrencesForTasks(taskIds: number[]): Promise<TaskRecurrence[]> {
    if (taskIds.length === 0) return [];

    const { data, error } = await this.supabase
      .from('task_recurrences')
      .select('*')
      .in('task_id', taskIds.map(toStringId));

    if (error || !data) return [];
    return data.map((row: TaskRecurrenceRow) => transformTaskRecurrenceRow(row));
  }

  /**
   * Create or update task recurrence
   */
  async upsertRecurrence(recurrence: Omit<TaskRecurrence, 'id'>): Promise<TaskRecurrence> {
    const row = {
      task_id: toStringId(recurrence.taskId),
      recurrence_pattern: recurrence.recurrencePattern,
      recurrence_interval: recurrence.recurrenceInterval,
      next_occurrence: recurrence.nextOccurrence.toISOString(),
      end_of_recurrence: recurrence.endOfRecurrence?.toISOString() || null,
    };

    const { data, error } = await this.supabase
      .from('task_recurrences')
      .upsert(row, {
        onConflict: 'task_id',
      })
      .select()
      .single();

    if (error) throw error;
    return transformTaskRecurrenceRow(data as TaskRecurrenceRow);
  }

  /**
   * Delete task recurrence
   */
  async deleteRecurrence(taskId: number): Promise<void> {
    const { error } = await this.supabase
      .from('task_recurrences')
      .delete()
      .eq('task_id', toStringId(taskId));

    if (error) throw error;
  }
}

