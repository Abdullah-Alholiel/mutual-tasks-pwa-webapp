// ============================================================================
// Sessions Database Module - User Session Management
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { toStringId } from './transformers';

export interface Session {
  id: number;
  userId: number;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  lastAccessedAt: Date;
}

export class SessionsRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a new session
   */
  async create(data: {
    userId: number;
    token: string;
    expiresAt: Date;
  }): Promise<Session> {
    const now = new Date().toISOString();
    const { data: result, error } = await this.supabase
      .from('sessions')
      .insert({
        user_id: data.userId,
        token: data.token,
        expires_at: data.expiresAt.toISOString(),
        created_at: now,
        last_accessed_at: now,
      })
      .select()
      .single();

    if (error) throw error;
    return this.transformRow(result);
  }

  /**
   * Find session by token
   */
  async findByToken(token: string): Promise<Session | null> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('token', token)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) return null;
    return this.transformRow(data);
  }

  /**
   * Get user ID from session token
   */
  async getUserIdFromToken(token: string): Promise<number | null> {
    const session = await this.findByToken(token);
    return session?.userId || null;
  }

  /**
   * Update last accessed time
   */
  async updateLastAccessed(token: string): Promise<void> {
    const { error } = await this.supabase
      .from('sessions')
      .update({ last_accessed_at: new Date().toISOString() })
      .eq('token', token);

    if (error) throw error;
  }

  /**
   * Extend session expiry
   */
  async extendExpiry(token: string, newExpiresAt: Date): Promise<void> {
    const { error } = await this.supabase
      .from('sessions')
      .update({
        expires_at: newExpiresAt.toISOString(),
        last_accessed_at: new Date().toISOString(),
      })
      .eq('token', token);

    if (error) throw error;
  }

  /**
   * Delete session (logout)
   */
  async delete(token: string): Promise<void> {
    const { error } = await this.supabase
      .from('sessions')
      .delete()
      .eq('token', token);

    if (error) throw error;
  }

  /**
   * Delete all sessions for a user
   */
  async deleteAllForUser(userId: number): Promise<void> {
    const { error } = await this.supabase
      .from('sessions')
      .delete()
      .eq('user_id', toStringId(userId));

    if (error) throw error;
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpired(): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from('sessions')
      .delete()
      .lt('expires_at', now);

    if (error) throw error;
  }

  /**
   * Transform database row to Session interface
   */
  private transformRow(row: any): Session {
    return {
      id: row.id,
      userId: row.user_id,
      token: row.token,
      expiresAt: new Date(row.expires_at),
      createdAt: new Date(row.created_at),
      lastAccessedAt: new Date(row.last_accessed_at),
    };
  }
}
