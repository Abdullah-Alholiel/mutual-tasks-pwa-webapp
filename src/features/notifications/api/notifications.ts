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
   */
  async create(
    notificationData: Omit<Notification, 'id' | 'createdAt'>
  ): Promise<Notification> {
    const row = toNotificationRow(notificationData);
    const now = new Date().toISOString();

    const { data, error } = await this.supabase
      .from('notifications')
      .insert({
        ...row,
        created_at: now,
      })
      .select()
      .single();

    if (error) throw error;
    return transformNotificationRow(data as NotificationRow);
  }

  /**
   * Create multiple notifications (for bulk notifications)
   */
  async createMany(
    notificationsData: Omit<Notification, 'id' | 'createdAt'>[]
  ): Promise<Notification[]> {
    if (notificationsData.length === 0) return [];

    const now = new Date().toISOString();
    const rows = notificationsData.map((notification) => ({
      ...toNotificationRow(notification),
      created_at: now,
    }));

    const { data, error } = await this.supabase
      .from('notifications')
      .insert(rows)
      .select();

    if (error) throw error;
    return data.map((row: NotificationRow) => transformNotificationRow(row));
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


