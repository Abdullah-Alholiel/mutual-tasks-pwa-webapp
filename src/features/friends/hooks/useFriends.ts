
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDatabaseClient } from '@/db';
import { useCurrentUser } from '@/features/auth/useCurrentUser';
import { toast } from 'sonner';

const db = getDatabaseClient();

export function useFriends() {
    const { data: user } = useCurrentUser();
    const userId = user?.id;

    return useQuery({
        queryKey: ['friends', userId],
        queryFn: async () => {
            if (!userId) return [];
            return db.friends.getFriends(userId);
        },
        enabled: !!userId,
    });
}

export function useFriend(friendId: number) {
    return useQuery({
        queryKey: ['friend', friendId],
        queryFn: async () => {
            if (!friendId) return null;
            return db.users.getById(friendId);
        },
        enabled: !!friendId,
    });
}

export function useAddFriend() {
    const queryClient = useQueryClient();
    const { data: user } = useCurrentUser();
    const userId = user?.id;

    return useMutation({
        mutationFn: async (handle: string) => {
            if (!userId) throw new Error('User not authenticated');
            return db.friends.addFriend(userId, handle);
        },
        onSuccess: (data) => {
            if (data.success) {
                toast.success(data.message);
                queryClient.invalidateQueries({ queryKey: ['friends', userId] });
            } else {
                toast.error(data.message);
            }
        },
        onError: (error) => {
            console.error('Failed to add friend:', error);
            toast.error('Failed to add friend. Please try again.');
        },
    });
}

export function useRemoveFriend() {
    const queryClient = useQueryClient();
    const { data: user } = useCurrentUser();
    const userId = user?.id;

    return useMutation({
        mutationFn: async (friendId: number) => {
            if (!userId) throw new Error('User not authenticated');
            return db.friends.removeFriend(userId, friendId);
        },
        onSuccess: () => {
            toast.success('Friend removed');
            queryClient.invalidateQueries({ queryKey: ['friends', userId] });
        },
        onError: (error) => {
            console.error('Failed to remove friend:', error);
            toast.error('Failed to remove friend');
        },
    });
}

export function useFriendRequests() {
    const { data: user } = useCurrentUser();
    const userId = user?.id;

    return useQuery({
        queryKey: ['friendRequests', userId],
        queryFn: async () => {
            if (!userId) return [];
            return db.friends.getFriendRequests(userId);
        },
        enabled: !!userId,
    });
}

export function useRespondToRequest() {
    const queryClient = useQueryClient();
    const { data: user } = useCurrentUser();
    const userId = user?.id;

    return useMutation({
        mutationFn: async ({ requestId, action }: { requestId: number; action: 'accept' | 'reject' }) => {
            if (!userId) throw new Error('User not authenticated');
            return db.friends.respondToRequest(userId, requestId, action);
        },
        onSuccess: () => {
            // Invalidate requests AND friends list (since accepting adds a friend)
            queryClient.invalidateQueries({ queryKey: ['friendRequests', userId] });
            queryClient.invalidateQueries({ queryKey: ['friends', userId] });
            toast.success('Response sent successfully');
        },
        onError: (error) => {
            console.error('Failed to respond to request:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to respond to friend request');
        },
    });
}

export function useCommonProjects(friendId: number) {
    const { data: user } = useCurrentUser();
    const userId = user?.id;

    return useQuery({
        queryKey: ['commonProjects', userId, friendId],
        queryFn: async () => {
            if (!userId) return [];
            return db.friends.getCommonProjects(userId, friendId);
        },
        enabled: !!userId && !!friendId,
    });
}
