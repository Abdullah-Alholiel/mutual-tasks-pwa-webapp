
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
                queryClient.invalidateQueries({ queryKey: ['friendRequests', userId] });
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

export function useCancelRequest() {
    const queryClient = useQueryClient();
    const { data: user } = useCurrentUser();
    const userId = user?.id;

    return useMutation({
        mutationFn: async (friendId: number) => {
            if (!userId) throw new Error('User not authenticated');
            return db.friends.cancelRequest(userId, friendId);
        },
        onSuccess: () => {
            toast.success('Friend request canceled');
            queryClient.invalidateQueries({ queryKey: ['friendRequests', userId] });
            // Also invalidate friends queries just in case
            queryClient.invalidateQueries({ queryKey: ['friends', userId] });
        },
        onError: (error) => {
            console.error('Failed to cancel request:', error);
            toast.error('Failed to cancel friend request');
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
        // Realtime subscription (useFriendRequestsRealtime) handles instant updates
        // Keep refetchOnWindowFocus for manual refresh scenarios
        refetchOnWindowFocus: true,
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

export function useSearchUsers(query: string) {
    return useQuery({
        queryKey: ['searchUsers', query],
        queryFn: async () => {
            if (!query || query.length < 2) return [];
            return db.friends.searchUsers(query);
        },
        enabled: !!query && query.length >= 2,
        staleTime: 1000 * 60 * 1, // cache for 1 minute
    });
}
