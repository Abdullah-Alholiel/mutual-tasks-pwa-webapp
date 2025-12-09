// ============================================================================
// Magic Links Database Module - Magic Link Token Operations
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { toStringId } from './transformers';

export interface MagicLink {
  id: number;
  token: string;
  userId: number | null;
  email: string;
  isSignup: boolean;
  signupName: string | null;
  signupHandle: string | null;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

export class MagicLinksRepository {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Create a new magic link token
   */
  async create(data: {
    token: string;
    email: string;
    isSignup: boolean;
    userId?: number;
    signupName?: string;
    signupHandle?: string;
    expiresAt: Date;
  }): Promise<MagicLink> {
    const { data: result, error } = await this.supabase
      .from('magic_links')
      .insert({
        token: data.token,
        email: data.email,
        is_signup: data.isSignup,
        user_id: data.userId || null,
        signup_name: data.signupName || null,
        signup_handle: data.signupHandle || null,
        expires_at: data.expiresAt.toISOString(),
        used_at: null,
      })
      .select()
      .single();

    if (error) throw error;
    return this.transformRow(result);
  }

  /**
   * Find magic link by token (for verification)
   */
  async findByToken(token: string): Promise<MagicLink | null> {
    const { data, error } = await this.supabase
      .from('magic_links')
      .select('*')
      .eq('token', token)
      .is('used_at', null)
      .single();

    if (error || !data) return null;
    
    const magicLink = this.transformRow(data);
    
    // Check if expired
    if (magicLink.expiresAt < new Date()) {
      return null;
    }

    return magicLink;
  }

  /**
   * Mark magic link as used
   */
  async markAsUsed(token: string): Promise<void> {
    const { error } = await this.supabase
      .from('magic_links')
      .update({ used_at: new Date().toISOString() })
      .eq('token', token);

    if (error) throw error;
  }

  /**
   * Clean up expired magic links (can be called periodically)
   */
  async cleanupExpired(): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.supabase
      .from('magic_links')
      .delete()
      .lt('expires_at', now);

    if (error) throw error;
  }

  /**
   * Transform database row to MagicLink interface
   */
  private transformRow(row: any): MagicLink {
    return {
      id: row.id,
      token: row.token,
      userId: row.user_id,
      email: row.email,
      isSignup: row.is_signup,
      signupName: row.signup_name,
      signupHandle: row.signup_handle,
      expiresAt: new Date(row.expires_at),
      usedAt: row.used_at ? new Date(row.used_at) : null,
      createdAt: new Date(row.created_at),
    };
  }
}

