// ============================================================================
// Notifications Database Module - Notification CRUD Operations
// ============================================================================

import type { Notification } from '@/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  transformNotificationRow,
  toNotificationRow,
  toStringId,
  type NotificationRow,
} from '../../../db/transformers';

export class NotificationsRepository {
  constructor(private supabase: SupabaseClient) { }

  // L5 RLS: the 10s dedup pre-check is a SELECT on the RECIPIENT's rows.
  // Under scoped policies (004) the actor cannot read another user's
  // notifications, so for cross-user sends that query can never match.
  // This in-memory cache restores the guard the DB dedup used to provide
  // within one browser session (double-click / rapid double-send); the
  // DB dedup below still covers self-addressed notifications. Cross-device
  // duplicates remain possible under scoped RLS — disclosed in the PR and
  // run report; a server-side dedup is part of the follow-up design.
  private static recentSends: { key: string; ts: number }[] = [];
  private static RECENT_WINDOW_MS = 10000;

  private static isRecentDuplicate(userId: number | string, type: string, message: string, projectId?: number | null, taskId?: number | null): boolean {
    const key = `${userId}|${type}|${projectId ?? '-'}|${taskId ?? '-'}|${message ?? ''}`;
    const now = Date.now();
    NotificationsRepository.recentSends = NotificationsRepository.recentSends.filter(r => now - r.ts < NotificationsRepository.RECENT_WINDOW_MS);
    if (NotificationsRepository.recentSends.some(r => r.key === key)) return true;
    NotificationsRepository.recentSends.push({ key, ts: now });
    return false;
  }

  /**
   * Get a notification by ID
   */
  async getById(id: number): Promise<Notification | null> {
    const { data, error } = await this.supabase
      .from('notifications')
      .select('*')
      .eq('id', toStringId(id))
      .single();

    if (error || !data) return null;
    return transformNotificationRow(data as NotificationRow);
  }

  /**
   * Get all notifications for a user with optional filters
   */
  async getByUserId(
    userId: number,
    filters?: {
      isRead?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<Notification[]> {
    let query = this.supabase
      .from('notifications')
      .select('*')
      .eq('user_id', toStringId(userId));

    if (filters?.isRead !== undefined) {
      query = query.eq('is_read', filters.isRead);
    }

    query = query.order('created_at', { ascending: false });

    if (filters?.limit !== undefined) {
      query = query.limit(filters.limit);
    }

    if (filters?.offset !== undefined) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 50) - 1);
    }

    const { data, error } = await query;

    if (error || !data) return [];
    return data.map((row: NotificationRow) => transformNotificationRow(row));
  }

  /**
   * Get unread notification count for a user
   */
  async getUnreadCount(userId: number): Promise<number> {
    const { count, error } = await this.supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', toStringId(userId))
      .eq('is_read', false);

    if (error) return 0;
    return count || 0;
  }

  /**
   * Create a new notification
   * Includes deduplication to prevent identical notifications within 10 seconds
   */
  async create(
    notificationData: Omit<Notification, 'id' | 'createdAt'>
  ): Promise<Notification | null> {
    const row = toNotificationRow(notificationData);
    const now = new Date();
    const nowIso = now.toISOString();
    const tenSecondsAgo = new Date(now.getTime() - 10000).toISOString();

    // In-memory guard first (works for cross-user sends under scoped RLS —
    // see the recentSends note on the class).
    if (NotificationsRepository.isRecentDuplicate(notificationData.userId, notificationData.type, notificationData.message ?? '', notificationData.projectId ?? null, notificationData.taskId ?? null)) {
      console.debug('[NotificationsRepo] Skipping in-session duplicate notification:', {
        userId: notificationData.userId,
        type: notificationData.type,
      });
      return null;
    }

    // Deduplication: Check for a recent duplicate
    let query = this.supabase
      .from('notifications')
      .select('id')
      .eq('user_id', row.user_id)
      .eq('type', row.type)
      .eq('message', row.message)
      .gte('created_at', tenSecondsAgo)
      .limit(1);

    // Add optional project_id filter if present
    if (row.project_id !== undefined && row.project_id !== null) {
      query = query.eq('project_id', row.project_id);
    } else {
      query = query.is('project_id', null);
    }

    // Add optional task_id filter if present
    if (row.task_id !== undefined && row.task_id !== null) {
      query = query.eq('task_id', row.task_id);
    } else {
      query = query.is('task_id', null);
    }

    const { data: existingDuplicates, error: checkError } = await query;

    if (checkError) {
      console.warn('[NotificationsRepo] Deduplication check failed:', checkError.message);
      // Continue with creation if check fails
    } else if (existingDuplicates && existingDuplicates.length > 0) {
      console.debug('[NotificationsRepo] ⚠️ Skipping duplicate notification:', {
        userId: notificationData.userId,
        type: notificationData.type,
        message: notificationData.message.substring(0, 50) + '...',
      });
      return null; // Return null to indicate skipped duplicate
    }

    const { error } = await this.supabase
      .from('notifications')
      .insert({
        ...row,
        created_at: nowIso,
      });

    // NOTE (L5 RLS): no `.select()` here. Notifications are written for OTHER
    // users; with RETURNING, Postgres also applies the SELECT policy to the
    // new row, which is invisible to the actor -> hard failure. Callers
    // (sendNotification, createInAppNotification) ignore the returned row.
    if (error) throw error;
    return null;
  }

  /**
   * Create multiple notifications (for bulk notifications)
   * Includes deduplication to prevent identical notifications within 10 seconds
   */
  async createMany(
    notificationsData: Omit<Notification, 'id' | 'createdAt'>[]
  ): Promise<Notification[]> {
    if (notificationsData.length === 0) return [];

    const now = new Date();
    const nowIso = now.toISOString();
    const tenSecondsAgo = new Date(now.getTime() - 10000).toISOString();

    // Deduplication: Check for recently created duplicates
    const deduplicatedNotifications: Omit<Notification, 'id' | 'createdAt'>[] = [];

    for (const notification of notificationsData) {
      // Build a query to check for a recent duplicate
      let query = this.supabase
        .from('notifications')
        .select('id')
        .eq('user_id', toStringId(notification.userId))
        .eq('type', notification.type)
        .eq('message', notification.message)
        .gte('created_at', tenSecondsAgo)
        .limit(1);

      // Add optional project_id filter if present
      if (notification.projectId !== undefined && notification.projectId !== null) {
        query = query.eq('project_id', toStringId(notification.projectId));
      } else {
        query = query.is('project_id', null);
      }

      // Add optional task_id filter if present
      if (notification.taskId !== undefined && notification.taskId !== null) {
        query = query.eq('task_id', toStringId(notification.taskId));
      } else {
        query = query.is('task_id', null);
      }

      const { data: existingDuplicates, error: checkError } = await query;

      if (checkError) {
        console.warn('[NotificationsRepo] Deduplication check failed:', checkError.message);
        // If check fails, include the notification anyway to avoid data loss
        deduplicatedNotifications.push(notification);
        continue;
      }

      if (existingDuplicates && existingDuplicates.length > 0) {
        console.debug('[NotificationsRepo] ⚠️ Skipping duplicate notification:', {
          userId: notification.userId,
          type: notification.type,
          message: notification.message.substring(0, 50) + '...',
        });
        continue; // Skip this duplicate
      }

      deduplicatedNotifications.push(notification);
    }

    if (deduplicatedNotifications.length === 0) {
      console.log('[NotificationsRepo] All notifications were duplicates, nothing to insert.');
      return [];
    }

    console.log('[NotificationsRepo] After deduplication:', deduplicatedNotifications.length, 'of', notificationsData.length, 'notifications to create.');

    const rows = deduplicatedNotifications.map((notification) => ({
      ...toNotificationRow(notification),
      created_at: nowIso,
    }));

    console.log('[NotificationsRepo] createMany - Input rows:', JSON.stringify(rows, null, 2));

    const { error } = await this.supabase
      .from('notifications')
      .insert(rows);

    // NOTE (L5 RLS): no `.select()` here — same reason as create(): rows are
    // written for OTHER users and would fail the SELECT-policy leg of
    // RETURNING. Callers ignore the returned rows.
    if (error) {
      console.error('[NotificationsRepo] createMany - ERROR:', error);
      throw error;
    }

    console.log('[NotificationsRepo] ✅ createMany succeeded:', rows.length, 'notifications created');
    return [];
  }

  /**
   * Update an existing notification
   */
  async update(
    id: number,
    notificationData: Partial<Notification>
  ): Promise<Notification> {
    const row = toNotificationRow(notificationData);

    const { data, error } = await this.supabase
      .from('notifications')
      .update(row)
      .eq('id', toStringId(id))
      .select()
      .single();

    if (error) throw error;
    return transformNotificationRow(data as NotificationRow);
  }

  /**
   * Mark a notification as read
   */
  async markAsRead(id: number): Promise<void> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', toStringId(id));

    if (error) throw error;
  }

  /**
   * Mark all notifications as read for a user
   */
  async markAllAsRead(userId: number): Promise<void> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', toStringId(userId))
      .eq('is_read', false);

    if (error) throw error;
  }

  /**
   * Mark notification as email sent
   */
  async markEmailSent(id: number): Promise<void> {
    const { error } = await this.supabase
      .from('notifications')
      .update({ email_sent: true })
      .eq('id', toStringId(id));

    if (error) throw error;
  }

  /**
   * Delete a notification
   */
  async delete(id: number): Promise<void> {
    const { error } = await this.supabase
      .from('notifications')
      .delete()
      .eq('id', toStringId(id));

    if (error) throw error;
  }

  /**
   * Delete all notifications for a user
   */
  async deleteByUserId(userId: number): Promise<void> {
    const { error } = await this.supabase
      .from('notifications')
      .delete()
      .eq('user_id', toStringId(userId));

    if (error) throw error;
  }

  /**
   * Delete multiple notifications
   */
  async deleteMany(ids: number[]): Promise<void> {
    if (ids.length === 0) return;
    const { error } = await this.supabase
      .from('notifications')
      .delete()
      .in('id', ids.map(toStringId));

    if (error) throw error;
  }

  /**
   * Delete old read notifications (cleanup)
   */
  async deleteOldRead(olderThanDays: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { data, error } = await this.supabase
      .from('notifications')
      .delete()
      .eq('is_read', true)
      .lt('created_at', cutoffDate.toISOString())
      .select();

    if (error) throw error;
    return data?.length || 0;
  }
}


