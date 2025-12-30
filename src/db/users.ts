// ============================================================================
// Users Database Module - User CRUD Operations
// ============================================================================

import type { User, UserStats, CompletionLog } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  transformUserRow,
  transformUserStatsRow,
  transformCompletionLogRow,
  toUserRow,
  toStringId,
  type UserRow,
  type UserStatsRow,
  type CompletionLogRow,
} from './transformers';
import { calculateUserStatsFromLogs } from '@/lib/users/userStatsUtils';

export class UsersRepository {
  constructor(private supabase: SupabaseClient) { }

  /**
   * Get a user by ID
   */
  async getById(id: number): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', toStringId(id))
      .maybeSingle();

    if (error || !data) return null;

    const stats = await this.getStats(id);
    return transformUserRow(data as UserRow, stats || undefined);
  }

  /**
   * Get user statistics
   */
  async getStats(userId: number): Promise<UserStats | null> {
    const { data, error } = await this.supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', toStringId(userId))
      .maybeSingle();

    if (error || !data) return null;
    return transformUserStatsRow(data as UserStatsRow);
  }

  /**
   * Get multiple users by IDs
   */
  async getByIds(ids: number[]): Promise<User[]> {
    if (ids.length === 0) return [];

    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .in('id', ids.map(toStringId));

    if (error || !data) return [];

    // Fetch stats for all users
    const statsMap = new Map<number, UserStats>();
    const statsData = await this.supabase
      .from('user_stats')
      .select('*')
      .in('user_id', ids.map(toStringId));

    if (statsData.data) {
      statsData.data.forEach((row: UserStatsRow) => {
        const stats = transformUserStatsRow(row);
        statsMap.set(stats.userId, stats);
      });
    }

    return data.map((row: UserRow) => {
      const userId = Number(row.id);
      return transformUserRow(row, statsMap.get(userId));
    });
  }

  /**
   * Create a new user
   */
  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const row = toUserRow(userData);
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('users')
      .insert({
        ...row,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error) throw error;

    // Create initial user stats
    await this.supabase.from('user_stats').insert({
      user_id: data.id,
      total_completed_tasks: 0,
      current_streak: 0,
      longest_streak: 0,
      totalscore: 0,
      updated_at: now,
    });

    return transformUserRow(data as UserRow);
  }

  /**
   * Update an existing user
   */
  async update(id: number, userData: Partial<User>): Promise<User> {
    const row = toUserRow(userData);
    row.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('users')
      .update(row)
      .eq('id', toStringId(id))
      .select()
      .single();

    if (error) throw error;
    return transformUserRow(data as UserRow);
  }

  /**
   * Delete a user (soft delete by setting removed_at)
   */
  async delete(id: number): Promise<void> {
    const { error } = await this.supabase
      .from('users')
      .update({ removed_at: new Date().toISOString() })
      .eq('id', toStringId(id));

    if (error) throw error;
  }

  /**
   * Update user statistics
   */
  async updateStats(userId: number, stats: Partial<UserStats>): Promise<UserStats> {
    const row: Partial<UserStatsRow> = {};
    if (stats.totalCompletedTasks !== undefined) {
      row.total_completed_tasks = stats.totalCompletedTasks;
    }
    if (stats.currentStreak !== undefined) {
      row.current_streak = stats.currentStreak;
    }
    if (stats.longestStreak !== undefined) {
      row.longest_streak = stats.longestStreak;
    }
    if (stats.totalscore !== undefined) {
      row.totalscore = stats.totalscore;
    }
    row.updated_at = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('user_stats')
      .update(row)
      .eq('user_id', toStringId(userId))
      .select()
      .maybeSingle();

    if (error) throw error;
    return transformUserStatsRow(data as UserStatsRow);
  }

  /**
   * Get a user by email
   */
  async getByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (error || !data) return null;

    const userId = Number((data as UserRow).id);
    const stats = await this.getStats(userId);
    return transformUserRow(data as UserRow, stats || undefined);
  }

  /**
   * Get a user by handle
   * Handles are stored in the database without @ prefix and may have mixed case
   * This method performs case-insensitive search and handles @ prefix
   */
  async getByHandle(handle: string): Promise<User | null> {
    // Remove @ prefix and normalize for consistent matching
    const handleWithoutAt = handle.startsWith('@') ? handle.slice(1) : handle;
    const normalizedHandle = handleWithoutAt.trim().toLowerCase();

    // Most robust search: Check for both 'handle' and '@handle' case-insensitively
    // This handles legacy data (with @) and new data (without @) across any casing
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .or(`handle.ilike.${normalizedHandle},handle.ilike.@${normalizedHandle}`)
      .maybeSingle();

    if (error || !data) return null;

    const userId = Number((data as UserRow).id);
    const stats = await this.getStats(userId);
    return transformUserRow(data as UserRow, stats || undefined);
  }

  /**
   * Search users by handle or email
   */
  async search(query: string): Promise<User[]> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .or(`handle.ilike.%${query}%,email.ilike.%${query}%,name.ilike.%${query}%`)
      .limit(20);

    if (error || !data) return [];
    return data.map((row: UserRow) => transformUserRow(row));
  }

  /**
   * Recalculate user stats from completion logs
   * Fetches all completion logs for the user and recalculates stats
   */
  async recalculateStats(userId: number, timezone: string = 'UTC'): Promise<UserStats> {
    // Fetch all completion logs for the user
    const { data: logsData, error: logsError } = await this.supabase
      .from('completion_logs')
      .select('*')
      .eq('user_id', toStringId(userId))
      .order('created_at', { ascending: false });

    if (logsError) {
      console.error('Failed to fetch completion logs for stats recalculation:', logsError);
      throw logsError;
    }

    const logs: CompletionLog[] = (logsData || []).map((row: CompletionLogRow) =>
      transformCompletionLogRow(row)
    );

    // Calculate stats from logs
    const calculatedStats = calculateUserStatsFromLogs(userId, logs, timezone);

    // Update stats in database
    const now = new Date().toISOString();
    const { data: updatedStats, error: updateError } = await this.supabase
      .from('user_stats')
      .upsert({
        user_id: toStringId(userId),
        total_completed_tasks: calculatedStats.totalCompletedTasks,
        current_streak: calculatedStats.currentStreak,
        longest_streak: calculatedStats.longestStreak,
        totalscore: calculatedStats.totalscore,
        updated_at: now,
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update user stats:', updateError);
      throw updateError;
    }

    return transformUserStatsRow(updatedStats as UserStatsRow);
  }

  /**
   * Get all completion logs for a user (for StreakCalendar)
   */
  async getCompletionLogs(userId: number): Promise<CompletionLog[]> {
    const { data, error } = await this.supabase
      .from('completion_logs')
      .select('*')
      .eq('user_id', toStringId(userId))
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row: CompletionLogRow) => transformCompletionLogRow(row));
  }
}

