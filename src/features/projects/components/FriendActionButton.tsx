import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { useAddFriend, useFriendRequests, useFriends } from '@/features/friends/hooks/useFriends';
import { cn } from '@/lib/utils';
import { Clock, Loader2, UserCheck, UserPlus } from 'lucide-react';
import React from 'react';
import type { User } from '@/types';

interface FriendActionButtonProps {
    user: User;
    className?: string;
}

export const FriendActionButton = ({ user, className }: FriendActionButtonProps) => {
    const { user: currentUser } = useAuth();

    // Isolate hooks per component instance
    const { data: friends } = useFriends();
    const { data: friendRequests } = useFriendRequests();
    const addFriendMutation = useAddFriend();

    const isCurrentUser = currentUser && user.id === currentUser.id;

    if (!currentUser || isCurrentUser) return null;

    const isFriend = friends?.some(f => (f.friendId === user.id || f.userId === user.id) && f.status === 'accepted');

    const pendingRequest = friendRequests?.find(req =>
        (req.userId === user.id && req.friendId === currentUser.id) ||
        (req.userId === currentUser.id && req.friendId === user.id)
    );

    const isOutgoingRequest = pendingRequest?.isInitiator === true;
    const isIncomingRequest = pendingRequest?.isInitiator === false;
    const hasPendingRequest = !!pendingRequest;

    const handleAddFriendClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (user.handle) {
            addFriendMutation.mutate(user.handle);
        }
    };

    return (
        <Button
            variant="ghost"
            size="icon"
            className={cn(
                "h-8 w-8 transition-all shrink-0",
                isFriend
                    ? "bg-green-500/10 text-green-500 cursor-default hover:bg-green-500/20"
                    : hasPendingRequest
                        ? "bg-muted text-muted-foreground cursor-default"
                        : "bg-primary/10 text-primary hover:bg-primary/20",
                addFriendMutation.isPending && "opacity-50 cursor-wait",
                className
            )}
            onClick={(e) => {
                if (!isFriend && !hasPendingRequest && !addFriendMutation.isPending) {
                    handleAddFriendClick(e);
                }
            }}
            disabled={isFriend || hasPendingRequest || addFriendMutation.isPending}
            title={isFriend ? "Friends" : isOutgoingRequest ? "Request Sent" : isIncomingRequest ? "Request Received (Check Inbox)" : "Add Friend"}
        >
            {addFriendMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : isFriend ? (
                <UserCheck className="w-4 h-4" />
            ) : hasPendingRequest ? (
                <Clock className="w-4 h-4" />
            ) : (
                <UserPlus className="w-4 h-4" />
            )}
        </Button>
    );
};
