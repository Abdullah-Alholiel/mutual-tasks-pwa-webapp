import { useState, useEffect } from 'react';
import { Loader } from '@/components/ui/loader';
import { motion } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { useFriends, useAddFriend, useRemoveFriend, useFriendRequests, useRespondToRequest, useSearchUsers } from '../hooks/useFriends';
import { FriendActionButton } from '@/features/projects/components/FriendActionButton';
import { useCurrentUser, useCurrentUserStats } from '@/features/auth/useCurrentUser';
import { calculateLevel } from '@/lib/users/userStatsUtils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Trophy, UserPlus, Search, ArrowLeft, Crown, Medal, UserMinus, MoreHorizontal, Inbox, Check, X, ArrowUpDown } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface FriendsPageProps {
    isInternalSlide?: boolean;
    isActive?: boolean;
}

const FriendsPage = ({ isInternalSlide = false, isActive = true }: FriendsPageProps) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { data: currentUser } = useCurrentUser();
    const { data: currentUserStats } = useCurrentUserStats();

    // Hooks
    const { data: friends = [], isLoading } = useFriends();
    const { data: allRequests = [], isLoading: isLoadingRequests } = useFriendRequests();
    // Only show incoming requests in the inbox
    const requests = allRequests.filter(req => !req.isInitiator);
    const { mutate: addFriend, isPending: isAdding } = useAddFriend();
    const { mutate: removeFriend } = useRemoveFriend();
    const { mutate: respondToRequest } = useRespondToRequest();

    const [handle, setHandle] = useState('');
    const [debouncedHandle, setDebouncedHandle] = useState('');
    const [requestsOpen, setRequestsOpen] = useState(false);
    const [sortBy, setSortBy] = useState<'score' | 'handle'>('score');

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedHandle(handle);
        }, 500);
        return () => clearTimeout(timer);
    }, [handle]);

    const { data: searchResults = [], isLoading: isSearching } = useSearchUsers(debouncedHandle);

    // Sort results alphabetically
    const sortedSearchResults = [...searchResults].sort((a, b) => a.name.localeCompare(b.name));

    // Check for navigation state to open requests modal
    useEffect(() => {
        if (location.state?.openRequests) {
            setRequestsOpen(true);
        }
    }, [location.state]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // Trigger generic search if needed, but the effect handles it
    };

    const handleClearSearch = () => {
        setHandle('');
        setDebouncedHandle('');
    };

    const handleRemoveFriend = (friendId: number, friendName: string, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent navigation
        if (confirm(`Are you sure you want to remove ${friendName} from your friends?`)) {
            removeFriend(friendId);
        }
    };

    const handleRespondBase = (requestId: number, action: 'accept' | 'reject') => {
        respondToRequest({ requestId, action });
    };

    const leaderboardItems = [
        ...(currentUser ? [{
            id: -1, // special ID for self
            user: currentUser,
            stats: currentUserStats,
            isSelf: true,
            friendshipId: 0
        }] : []),
        ...friends.map(f => ({
            id: f.friendId,
            user: f.friend!,
            stats: f.friend?.stats,
            isSelf: false,
            friendshipId: f.id
        }))
    ].filter(item => item.user); // safety filter

    // Sort leaderboard
    const sortedLeaderboard = leaderboardItems.sort((a, b) => {
        if (sortBy === 'score') {
            const scoreA = a.stats?.totalscore || 0;
            const scoreB = b.stats?.totalscore || 0;
            return scoreB - scoreA;
        } else {
            return a.user.name.localeCompare(b.user.name);
        }
    });

    const getRankIcon = (index: number) => {
        if (index === 0) return <Crown className="w-5 h-5 text-yellow-500 fill-yellow-500" />;
        if (index === 1) return <Medal className="w-5 h-5 text-gray-400 fill-gray-400" />;
        if (index === 2) return <Medal className="w-5 h-5 text-amber-600 fill-amber-600" />;
        return <span className="text-muted-foreground font-bold w-5 text-center">{index + 1}</span>;
    };

    // Helper to strip @ from handle for display
    const formatHandle = (handle: string) => {
        if (!handle) return '';
        const clean = handle.replace(/^@+/, '');
        return `@${clean}`;
    };

    return (
        <div className={`flex flex-col ${isInternalSlide ? 'h-full' : 'min-h-screen bg-background'}`}>
            {/* Header - Only show back button when not an internal slide */}
            {!isInternalSlide && (
                <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50 shrink-0">
                    <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate('/profile')}
                                className="-ml-2 hover:bg-transparent"
                            >
                                <ArrowLeft className="w-6 h-6" />
                            </Button>
                            <h1 className="text-xl font-bold">Friends</h1>
                        </div>

                        {/* Requests Button */}
                        <Dialog open={requestsOpen} onOpenChange={setRequestsOpen}>
                            <DialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="relative">
                                    <Inbox className="w-6 h-6" />
                                    {requests.length > 0 && (
                                        <Badge className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive p-0 text-[10px]">
                                            {requests.length}
                                        </Badge>
                                    )}
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                                <DialogHeader>
                                    <DialogTitle>Friend Requests</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 max-h-[60vh] overflow-y-auto py-2">
                                    {isLoadingRequests ? (
                                        <div className="flex justify-center py-4">
                                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                        </div>
                                    ) : requests.length === 0 ? (
                                        <div className="text-center py-8 text-muted-foreground">
                                            No pending requests
                                        </div>
                                    ) : (
                                        requests.map((req) => (
                                            <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={req.friend?.avatar} />
                                                        <AvatarFallback>{req.friend?.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <p className="font-semibold text-sm">{req.friend?.name}</p>
                                                        <p className="text-xs text-muted-foreground">{formatHandle(req.friend?.handle || '')}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                                                        onClick={() => handleRespondBase(req.id, 'accept')}
                                                    >
                                                        <Check className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={() => handleRespondBase(req.id, 'reject')}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </div>
            )}

            {/* Internal Slide Header - Simpler, no back button */}
            {isInternalSlide && (
                <div className="flex items-center justify-between mb-6">
                    <motion.h1
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="text-3xl font-bold"
                    >
                        Friends
                    </motion.h1>
                    <Dialog open={requestsOpen} onOpenChange={setRequestsOpen}>
                        <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="relative">
                                <Inbox className="w-6 h-6" />
                                {requests.length > 0 && (
                                    <Badge className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive p-0 text-[10px]">
                                        {requests.length}
                                    </Badge>
                                )}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Friend Requests</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 max-h-[60vh] overflow-y-auto py-2">
                                {isLoadingRequests ? (
                                    <div className="flex justify-center py-4">
                                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                                    </div>
                                ) : requests.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No pending requests
                                    </div>
                                ) : (
                                    requests.map((req) => (
                                        <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                                            <div className="flex items-center gap-3">
                                                <Avatar>
                                                    <AvatarImage src={req.friend?.avatar} />
                                                    <AvatarFallback>{req.friend?.name.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <p className="font-semibold text-sm">{req.friend?.name}</p>
                                                    <p className="text-xs text-muted-foreground">{formatHandle(req.friend?.handle || '')}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
                                                    onClick={() => handleRespondBase(req.id, 'accept')}
                                                >
                                                    <Check className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleRespondBase(req.id, 'reject')}
                                                >
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            )}

            <div className={isInternalSlide ? 'flex-1' : 'flex-1 overflow-y-auto custom-scrollbar'}>
                <div className={`space-y-8 ${isInternalSlide ? '' : 'max-w-md mx-auto px-4 py-6 pb-10'}`}>
                    {/* Add Friend Section */}
                    <section className="space-y-4">
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">Find Friends</h2>
                        <Card className="p-2 border-border/50 shadow-sm">
                            <form onSubmit={handleSearch} className="flex gap-2">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search by name or handle..."
                                        value={handle}
                                        onChange={(e) => setHandle(e.target.value)}
                                        className="pl-9 pr-8 h-11 bg-transparent border-none focus-visible:ring-0"
                                    />
                                    {handle && (
                                        <button
                                            type="button"
                                            onClick={handleClearSearch}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                    {isSearching && !handle && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                        </div>
                                    )}
                                </div>
                            </form>
                        </Card>

                        {/* Search Results */}
                        {debouncedHandle.length >= 2 && (
                            <div className="space-y-2">
                                {sortedSearchResults.length === 0 && !isSearching ? (
                                    <div className="text-center py-4 text-muted-foreground text-sm">
                                        No users found.
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {sortedSearchResults.map((user) => (
                                            <div
                                                key={user.id}
                                                className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-card hover:bg-muted/30 transition-colors cursor-pointer"
                                                onClick={() => navigate(`/friends/${user.id}`)}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Avatar>
                                                        <AvatarImage src={user.avatar} />
                                                        <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-semibold text-sm">{user.name}</div>
                                                        <div className="text-xs text-muted-foreground">{formatHandle(user.handle)}</div>
                                                    </div>
                                                </div>
                                                <div onClick={(e) => e.stopPropagation()}>
                                                    <FriendActionButton user={user} className="h-8 shadow-none" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Leaderboard Section - Hide if searching */}
                    {debouncedHandle.length < 2 && (
                        <section className="space-y-4">
                            <div className="flex items-center justify-between px-1">
                                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Leaderboard</h2>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs font-medium text-accent hover:text-accent hover:bg-accent/10 px-2">
                                            {sortBy === 'score' ? <Trophy className="w-3.5 h-3.5" /> : <ArrowUpDown className="w-3.5 h-3.5" />}
                                            <span>Ranked by {sortBy === 'score' ? 'Score' : 'Name'}</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => setSortBy('score')} className="cursor-pointer">
                                            <Trophy className="w-4 h-4 mr-2" />
                                            Score
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setSortBy('handle')} className="cursor-pointer">
                                            <ArrowUpDown className="w-4 h-4 mr-2" />
                                            Name
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>

                            {isLoading ? (
                                <Loader text="Loading leaderboard..." className="py-12" />
                            ) : sortedLeaderboard.length === 0 ? (
                                <div className="text-center py-12 px-4 rounded-2xl bg-muted/30 border border-dashed border-border">
                                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                                        <UserPlus className="w-6 h-6 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-semibold mb-1">No friends yet</h3>
                                    <p className="text-muted-foreground text-sm max-w-[200px] mx-auto">
                                        Add friends by their username to see them on the leaderboard!
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {sortedLeaderboard.map((item, index) => {
                                        const { user, stats, isSelf } = item;
                                        const score = stats?.totalscore || 0;
                                        const level = calculateLevel(score);

                                        return (
                                            <motion.div
                                                key={isSelf ? 'self' : item.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                onClick={() => !isSelf && navigate(`/friends/${item.id}`)}
                                            >
                                                <div
                                                    className={`group relative bg-card border rounded-2xl p-4 transition-all duration-300 hover:shadow-md cursor-pointer flex items-center gap-4 ${isSelf ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/20' : 'border-border/50 hover:bg-muted/40'}`}
                                                >
                                                    {/* Rank */}
                                                    <div className="flex items-center justify-center w-6 shrink-0">
                                                        {getRankIcon(index)}
                                                    </div>

                                                    {/* Avatar */}
                                                    <div className="relative shrink-0">
                                                        <Avatar className="w-12 h-12 ring-2 ring-border/50 group-hover:ring-primary/30 transition-all">
                                                            <AvatarImage src={user.avatar} />
                                                            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 shadow-sm ring-1 ring-border/20">
                                                            <div className="w-4 h-4 rounded-full gradient-accent flex items-center justify-center text-[9px] font-bold text-white">
                                                                {level}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className={`font-semibold truncate transition-colors ${isSelf ? 'text-primary' : 'text-foreground/90 group-hover:text-primary'}`}>
                                                                {user.name} {isSelf && '(You)'}
                                                            </h3>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground truncate">
                                                            {formatHandle(user.handle)}
                                                        </p>
                                                    </div>

                                                    {/* Score */}
                                                    <div className="text-right shrink-0">
                                                        <div className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                                                            {score.toLocaleString()}
                                                        </div>
                                                    </div>

                                                    {/* Actions (Only for friends) */}
                                                    {!isSelf && (
                                                        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                                                            <DropdownMenu>
                                                                <DropdownMenuTrigger asChild>
                                                                    <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-muted-foreground hover:text-destructive">
                                                                        <MoreHorizontal className="w-4 h-4" />
                                                                    </Button>
                                                                </DropdownMenuTrigger>
                                                                <DropdownMenuContent align="end">
                                                                    <DropdownMenuItem
                                                                        className="text-destructive focus:text-destructive cursor-pointer"
                                                                        onClick={(e) => handleRemoveFriend(item.id, user.name, e as any)}
                                                                    >
                                                                        <UserMinus className="w-4 h-4 mr-2" />
                                                                        Remove Friend
                                                                    </DropdownMenuItem>
                                                                </DropdownMenuContent>
                                                            </DropdownMenu>
                                                        </div>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            )}
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FriendsPage;
