import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth/useAuth';
import { useAddFriend, useFriendRequests, useFriends, useCancelRequest } from '@/features/friends/hooks/useFriends';
import { cn } from '@/lib/utils';
import { Clock, Loader2, UserCheck, UserPlus, X } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import React, { useState } from 'react';
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
    const cancelRequestMutation = useCancelRequest();

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

    const handleCancelRequest = (e: React.MouseEvent) => {
        e.stopPropagation();
        cancelRequestMutation.mutate(user.id);
    };

    const buttonContent = (
        <Button
            variant="ghost"
            size="icon"
            className={cn(
                "h-8 w-8 transition-all shrink-0",
                isFriend
                    ? "bg-green-500/10 text-green-500 cursor-default hover:bg-green-500/20"
                    : hasPendingRequest
                        ? "bg-muted text-muted-foreground"
                        : "bg-primary/10 text-primary hover:bg-primary/20",
                (addFriendMutation.isPending || cancelRequestMutation.isPending) && "opacity-50 cursor-wait",
                className
            )}
            onClick={(e) => {
                if (isFriend || addFriendMutation.isPending || cancelRequestMutation.isPending || isOutgoingRequest) return;

                if (!hasPendingRequest) {
                    handleAddFriendClick(e);
                }
            }}
            disabled={isFriend || addFriendMutation.isPending || cancelRequestMutation.isPending || isIncomingRequest}
            title={
                isFriend ? "Friends"
                    : isOutgoingRequest ? "Request Sent"
                        : isIncomingRequest ? "Request Received"
                            : "Add Friend"
            }
        >
            {(addFriendMutation.isPending || cancelRequestMutation.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : isFriend ? (
                <UserCheck className="w-4 h-4" />
            ) : isOutgoingRequest ? (
                <Clock className="w-4 h-4" />
            ) : isIncomingRequest ? (
                <Clock className="w-4 h-4" />
            ) : (
                <UserPlus className="w-4 h-4" />
            )}
        </Button>
    );

    if (isOutgoingRequest) {
        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    {buttonContent}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        onClick={(e) => {
                            e.stopPropagation();
                            cancelRequestMutation.mutate(user.id);
                        }}
                        className="text-destructive focus:text-destructive cursor-pointer"
                    >
                        <X className="w-4 h-4 mr-2" />
                        Cancel Request
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        );
    }

    return buttonContent;
};
