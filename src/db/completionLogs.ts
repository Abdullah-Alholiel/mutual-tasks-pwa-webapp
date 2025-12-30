// ============================================================================
// CompletionLogs Database Module - CompletionLog CRUD Operations
// ============================================================================

import type { CompletionLog } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  transformCompletionLogRow,
  toCompletionLogRow,
  toStringId,
  type CompletionLogRow,
} from './transformers';

export class CompletionLogsRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get a completion log by ID
   */
  async getById(id: number): Promise<CompletionLog | null> {
    const { data, error } = await this.supabase
      .from('completion_logs')
      .select('*')
      .eq('id', toStringId(id))
      .single();

    if (error || !data) return null;
    return transformCompletionLogRow(data as CompletionLogRow);
  }

  /**
   * Get all completion logs with optional filters
   */
  async getAll(filters?: {
    userId?: number;
    taskId?: number;
    limit?: number;
  }): Promise<CompletionLog[]> {
    let query = this.supabase.from('completion_logs').select('*');

    if (filters?.userId !== undefined) {
      query = query.eq('user_id', toStringId(filters.userId));
    }

    if (filters?.taskId !== undefined) {
      query = query.eq('task_id', toStringId(filters.taskId));
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit !== undefined) {
      query = query.limit(filters.limit);
    }

    const { data, error } = await query;

    if (error || !data) return [];
    return data.map((row: CompletionLogRow) => transformCompletionLogRow(row));
  }

  /**
   * Get completion log for a specific user and task
   */
  async getByTaskAndUser(taskId: number, userId: number): Promise<CompletionLog | null> {
    const { data, error } = await this.supabase
      .from('completion_logs')
      .select('*')
      .eq('task_id', toStringId(taskId))
      .eq('user_id', toStringId(userId))
      .single();

    if (error || !data) return null;
    return transformCompletionLogRow(data as CompletionLogRow);
  }

  /**
   * Check if a task is completed by a user
   */
  async isCompleted(taskId: number, userId: number): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('completion_logs')
      .select('id')
      .eq('task_id', toStringId(taskId))
      .eq('user_id', toStringId(userId))
      .limit(1)
      .single();

    return !error && data !== null;
  }

  /**
   * Create a new completion log
   */
  async create(
    logData: Omit<CompletionLog, 'id' | 'createdAt'>
  ): Promise<CompletionLog> {
    const row = toCompletionLogRow(logData);
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('completion_logs')
      .insert({
        ...row,
        created_at: now,
      })
      .select()
      .single();

    if (error) throw error;
    return transformCompletionLogRow(data as CompletionLogRow);
  }

  /**
   * Update an existing completion log
   */
  async update(id: number, logData: Partial<CompletionLog>): Promise<CompletionLog> {
    const row = toCompletionLogRow(logData);

    const { data, error } = await this.supabase
      .from('completion_logs')
      .update(row)
      .eq('id', toStringId(id))
      .select()
      .single();

    if (error) throw error;
    return transformCompletionLogRow(data as CompletionLogRow);
  }

  /**
   * Delete a completion log
   */
  async delete(id: number): Promise<void> {
    const { error } = await this.supabase
      .from('completion_logs')
      .delete()
      .eq('id', toStringId(id));

    if (error) throw error;
  }

  /**
   * Delete all completion logs for a task
   */
  async deleteByTaskId(taskId: number): Promise<void> {
    const { error } = await this.supabase
      .from('completion_logs')
      .delete()
      .eq('task_id', toStringId(taskId));

    if (error) throw error;
  }

  /**
   * Get user's completion statistics
   */
  async getUserStats(userId: number): Promise<{
    totalCompletions: number;
    totalXP: number;
    averageDifficulty: number;
  }> {
    const { data, error } = await this.supabase
      .from('completion_logs')
      .select('xp_earned, difficulty_rating')
      .eq('user_id', toStringId(userId));

    if (error || !data) {
      return {
        totalCompletions: 0,
        totalXP: 0,
        averageDifficulty: 0,
      };
    }

    const totalCompletions = data.length;
    const totalXP = data.reduce((sum, log) => sum + (log.xp_earned || 0), 0);
    const difficulties = data
      .map((log) => log.difficulty_rating)
      .filter((d): d is number => d !== null);
    const averageDifficulty =
      difficulties.length > 0
        ? difficulties.reduce((sum, d) => sum + d, 0) / difficulties.length
        : 0;

    return {
      totalCompletions,
      totalXP,
      averageDifficulty,
    };
  }
}


