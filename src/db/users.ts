// ============================================================================
// Users Database Module - User CRUD Operations
// ============================================================================

import type { User, UserStats } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  transformUserRow,
  transformUserStatsRow,
  toUserRow,
  toStringId,
  type UserRow,
  type UserStatsRow,
} from './transformers';

export class UsersRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Get a user by ID
   */
  async getById(id: number): Promise<User | null> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', toStringId(id))
      .single();

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
      .single();

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
      .single();

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
      .single();

    if (error || !data) return null;

    const userId = Number((data as UserRow).id);
    const stats = await this.getStats(userId);
    return transformUserRow(data as UserRow, stats || undefined);
  }

  /**
   * Get a user by handle
   */
  async getByHandle(handle: string): Promise<User | null> {
    // Normalize handle: ensure it starts with @ and is lowercase
    const normalizedHandle = handle.startsWith('@') ? handle.toLowerCase() : `@${handle.toLowerCase()}`;

    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('handle', normalizedHandle)
      .single();

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
}

