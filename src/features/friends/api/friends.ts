
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Friend, User, Project, ProjectParticipant, UserStats } from '@/types';
import { transformUserRow, transformUserStatsRow, toStringId, type UserRow, type UserStatsRow, toProjectRow, transformProjectRow, type ProjectRow } from '@/db/transformers';
import type { NotificationsRepository } from '@/features/notifications/api/notifications';

export class FriendsRepository {
    private notifications: NotificationsRepository;

    constructor(private supabase: SupabaseClient, notificationsRepo: NotificationsRepository) {
        this.notifications = notificationsRepo;
    }

    /**
     * Get all friends for a user
     * Returns a list of Friend objects with the 'friend' property populated with User details
     */
    async getFriends(userId: number): Promise<Friend[]> {
        const { data, error } = await this.supabase
            .from('friends')
            .select(`
        *,
        friend:users!friend_id(*)
      `)
            .eq('user_id', toStringId(userId))
            .eq('status', 'accepted');

        if (error) {
            console.error('Error fetching friends:', error);
            return [];
        }

        // Also fetch the inverse relationships (where I am the friend_id)
        const { data: inverseData, error: inverseError } = await this.supabase
            .from('friends')
            .select(`
        *,
        friend:users!user_id(*)
      `)
            .eq('friend_id', toStringId(userId))
            .eq('status', 'accepted');

        if (inverseError) {
            console.error('Error fetching inverse friends:', inverseError);
            return [];
        }

        const allFriends = [...(data || []), ...(inverseData || [])];

        // Deduplicate by friend ID (just in case)
        const uniqueFriendsMap = new Map();

        // We need to fetch stats for these friends to show on the leaderboard
        const friendIds = allFriends.map(row => {
            // If I am user_id, friend is friend_id.
            // If I am friend_id, friend is user_id.
            // The query above already populates 'friend' correctly based on the join?
            // Wait, for the inverse query, we joined on user_id, but aliased it as friend?
            // Supabase join syntax: friend:users!user_id
            return row.friend.id;
        });

        if (friendIds.length === 0) return [];

        const { data: statsData } = await this.supabase
            .from('user_stats')
            .select('*')
            .in('user_id', friendIds.map(toStringId));

        const statsMap = new Map<number, UserStats>();
        if (statsData) {
            statsData.forEach((row: UserStatsRow) => {
                const stats = transformUserStatsRow(row);
                statsMap.set(stats.userId, stats);
            });
        }

        return allFriends.map(row => {
            // Normalize the friend object
            const friendUserRow = row.friend as UserRow;
            const friendId = Number(friendUserRow.id);
            const friendUser = transformUserRow(friendUserRow, statsMap.get(friendId));

            return {
                id: Number(row.id),
                userId: userId,
                friendId: friendId,
                status: row.status,
                createdAt: new Date(row.created_at),
                friend: friendUser,
                isInitiator: row.user_id == userId
            };
        });
    }

    /**
     * Add a friend by handle
     */
    async addFriend(userId: number, handle: string): Promise<{ success: boolean; message: string }> {
        // 1. Find user by handle
        const handleWithoutAt = handle.startsWith('@') ? handle.slice(1) : handle;
        const { data: friendUser, error: userError } = await this.supabase
            .from('users')
            .select('id, name')
            .or(`handle.ilike.${handleWithoutAt},handle.ilike.@${handleWithoutAt}`)
            .maybeSingle();

        if (userError || !friendUser) {
            return { success: false, message: 'User not found' };
        }

        const friendId = Number(friendUser.id);
        if (friendId === userId) {
            return { success: false, message: 'You cannot add yourself' };
        }

        // 2. Check existing relationship
        const { data: existing, error: checkError } = await this.supabase
            .from('friends')
            .select('*')
            .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`)
            .maybeSingle();

        if (existing) {
            if (existing.status === 'accepted') {
                return { success: false, message: 'Already friends' };
            }
            return { success: false, message: 'Friend request already pending' };
        }

        // 3. Create relationship (Allocating 'pending' status)
        const { error: insertError } = await this.supabase
            .from('friends')
            .insert({
                user_id: toStringId(userId),
                friend_id: toStringId(friendId),
                status: 'pending'
            });

        if (insertError) {
            console.error('Error adding friend:', insertError);
            return { success: false, message: 'Failed to send friend request' };
        }

        // 4. Create Notification for the recipient using NotificationsRepository
        // Fetch sender details for the message
        const { data: sender } = await this.supabase
            .from('users')
            .select('name')
            .eq('id', toStringId(userId))
            .single();

        const senderName = sender?.name || 'Someone';

        try {
            await this.notifications.create({
                userId: friendId,
                type: 'friend_request',
                message: `${senderName} sent you a friend request`,
                isRead: false,
                emailSent: false
            });
        } catch (notifError) {
            console.error('Error sending notification:', notifError);
            return { success: true, message: 'Request sent, but notification failed' };
        }

        return { success: true, message: 'Friend request sent' };
    }

    /**
     * Get pending friend requests for a user
     */
    async getFriendRequests(userId: number): Promise<Friend[]> {
        // Fetch rows where I am the friend_id and status is pending
        const { data, error } = await this.supabase
            .from('friends')
            .select(`
                *,
                friend:users!user_id(*)
            `)
            .eq('friend_id', toStringId(userId))
            .eq('status', 'pending');

        if (error || !data) return [];

        // Transform results
        // We need detailed friend objects. In this case, 'friend' is the requester (user_id).
        return data.map(row => {
            const requesterUserRow = row.friend as UserRow;
            // Basic transform without stats for now (not needed for requests list usually)
            const requester = transformUserRow(requesterUserRow);

            return {
                id: Number(row.id),
                userId: Number(row.user_id), // The requester
                friendId: userId,            // Me
                status: 'pending',
                createdAt: new Date(row.created_at),
                friend: requester,           // The requester details
                isInitiator: false
            };
        });
    }

    /**
     * Respond to a friend request
     */
    async respondToRequest(userId: number, requestId: number, action: 'accept' | 'reject'): Promise<void> {
        // userId is the *current user* (the recipient of the request)
        // requestId comes from the friends table id

        if (action === 'accept') {
            // Update status to accepted
            const { error, data } = await this.supabase
                .from('friends')
                .update({ status: 'accepted' })
                .eq('id', toStringId(requestId))
                .eq('friend_id', toStringId(userId)) // Security check: Ensure I am the recipient
                .select()
                .single();

            if (error) throw error;

            // Notify the requester
            const requesterId = Number(data.user_id);

            // Fetch my name
            const { data: me } = await this.supabase
                .from('users')
                .select('name')
                .eq('id', toStringId(userId))
                .single();

            const myName = me?.name || 'A friend';

            try {
                await this.notifications.create({
                    userId: requesterId,
                    type: 'friend_accepted',
                    message: `${myName} accepted your friend request`,
                    isRead: false,
                    emailSent: false
                });
            } catch (notifError) {
                console.error('Failed to notify sender of acceptance:', notifError);
                throw new Error('Friend accepted, but failed to send notification');
            }

        } else {
            // Reject: Delete the record
            const { error } = await this.supabase
                .from('friends')
                .delete()
                .eq('id', toStringId(requestId))
                .eq('friend_id', toStringId(userId)); // Security check

            if (error) throw error;
        }
    }

    /**
     * Remove a friend
     */
    async removeFriend(userId: number, friendId: number): Promise<void> {
        await this.supabase
            .from('friends')
            .delete()
            .or(`and(user_id.eq.${userId},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${userId})`);
    }

    /**
     * Get common projects between two users
     */
    async getCommonProjects(userId1: number, userId2: number): Promise<Project[]> {
        // This is a bit complex. We need projects where BOTH are participants.
        // 1. Get project IDs for user 1
        const { data: projects1 } = await this.supabase
            .from('project_participants')
            .select('project_id')
            .eq('user_id', toStringId(userId1));

        if (!projects1 || projects1.length === 0) return [];

        const p1Ids = projects1.map(p => p.project_id);

        // 2. Get projects for user 2 that are in p1Ids
        const { data: commonParams } = await this.supabase
            .from('project_participants')
            .select('project_id')
            .eq('user_id', toStringId(userId2))
            .in('project_id', p1Ids);

        if (!commonParams || commonParams.length === 0) return [];

        const commonIds = commonParams.map(p => p.project_id);

        // 3. Fetch full project details
        const { data: projects, error } = await this.supabase
            .from('projects')
            .select('*')
            .in('id', commonIds);

        if (error || !projects) return [];

        return projects.map((row: ProjectRow) => transformProjectRow(row));
    }
}
