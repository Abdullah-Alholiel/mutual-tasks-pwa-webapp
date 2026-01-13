
import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useFriend, useCommonProjects, useFriends, useAddFriend, useFriendRequests, useCancelRequest, useRemoveFriend } from '../hooks/useFriends';
import { calculateLevel } from '@/lib/users/userStatsUtils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Zap, TrendingUp, ArrowLeft, Users, UserPlus, Loader2, Check, X, Clock, UserCheck, Trash2 } from 'lucide-react';
import { InlineLoader, PageLoader } from '@/components/ui/loader';
import { getIconByName } from '@/lib/projects/projectIcons';
import { adjustColorOpacity } from '@/lib/colorUtils';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useIsMobile } from '@/hooks/use-mobile';
import { Inbox } from '@/features/notifications/Inbox';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { useAuth } from '@/features/auth/useAuth';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const FriendProfile = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const friendId = Number(id);
    const isMobile = useIsMobile();
    const { user } = useAuth();

    // Friend Management Hooks
    const { data: friends } = useFriends();
    const { data: friendRequests } = useFriendRequests();
    const addFriendMutation = useAddFriend();
    const cancelRequestMutation = useCancelRequest();
    const removeFriendMutation = useRemoveFriend();

    // Use real-time notifications hook
    const userId = user ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : null;
    const { notifications, markAsRead, markAllAsRead, deleteAll, deleteList } = useNotifications({
        userId,
        enabled: !!user,
    });

    const handleMarkAsRead = async (notificationId: number) => {
        await markAsRead(notificationId);
    };

    const handleMarkAllAsRead = async () => {
        await markAllAsRead();
    };

    // Hooks
    const { data: friend, isLoading: loadingFriend } = useFriend(friendId);
    const { data: commonProjects = [], isLoading: loadingProjects } = useCommonProjects(friendId);

    // Sort projects alphabetically by name
    const sortedCommonProjects = useMemo(() => {
        return [...commonProjects].sort((a, b) => a.name.localeCompare(b.name));
    }, [commonProjects]);

    const isCurrentUser = user && friend && (Number(user.id) === friend.id);
    const isFriend = friends?.some(f => (f.friendId === friendId || f.userId === friendId) && f.status === 'accepted');
    const hasPendingRequest = friendRequests?.find(req =>
        (req.userId === friendId && req.friendId === Number(user?.id)) ||
        (req.userId === Number(user?.id) && req.friendId === friendId)
    );

    const isOutgoingRequest = hasPendingRequest?.isInitiator === true;
    // We are looking at a profile, so if we are the initiator, it means we sent it to THEM.
    // If hasPendingRequest.isInitiator is TRUE, it means currentUser initiated it (per getFriendRequests logic)

    const handleAddFriend = () => {
        if (friend?.handle) {
            addFriendMutation.mutate(friend.handle);
        }
    };

    const handleCancelRequest = () => {
        if (friend) {
            cancelRequestMutation.mutate(friend.id);
        }
    };

    const handleRemoveFriend = () => {
        if (friend) {
            removeFriendMutation.mutate(friend.id);
        }
    };

    if (loadingFriend || !friend) {
        return (
            <PageLoader text="Loading profile..." />
        );
    }

    const stats = friend.stats || { totalscore: 0, totalCompletedTasks: 0, currentStreak: 0, longestStreak: 0 };
    const level = calculateLevel(stats.totalscore);

    const statItems = [
        {
            icon: Trophy,
            label: 'Overall Score',
            value: stats.totalscore,
            color: 'text-accent',
            bgColor: 'bg-accent/10'
        },
        {
            icon: Target,
            label: 'Completed',
            value: stats.totalCompletedTasks,
            color: 'text-success',
            bgColor: 'bg-success/10'
        },
        {
            icon: Zap,
            label: 'Current Streak',
            value: stats.currentStreak,
            color: 'text-primary',
            bgColor: 'bg-primary/10'
        },
        {
            icon: TrendingUp,
            label: 'Best Streak',
            value: stats.longestStreak,
            color: 'text-foreground',
            bgColor: 'bg-muted'
        }
    ];

    return (
        <div
            className="h-full overflow-y-auto bg-background custom-scrollbar"
            style={{
                paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))'
            }}
        >
            {/* Header */}
            <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
                <div className="max-w-4xl mx-auto px-4 h-16 flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/friends')}
                        className="-ml-2 hover:bg-transparent"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    {isMobile && (
                        <div className="mr-2">
                            <Inbox
                                notifications={notifications}
                                onMarkAsRead={handleMarkAsRead}
                                onMarkAllAsRead={handleMarkAllAsRead}
                                onClearAll={deleteAll}
                                onDeleteList={deleteList}
                            />
                        </div>
                    )}
                    <h1 className="text-xl font-bold flex-1">Friend Profile</h1>
                    {isMobile && <ThemeToggle size="compact" />}
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
                {/* Profile Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="p-6">
                        <div className="flex items-center gap-6">
                            <Avatar className="w-24 h-24 ring-4 ring-border shrink-0">
                                <AvatarImage src={friend.avatar} alt={friend.name} />
                                <AvatarFallback className="text-2xl font-bold">
                                    {friend.name.charAt(0)}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1 space-y-3">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <h1 className="text-2xl font-bold text-foreground">{friend.name}</h1>
                                        <p className="text-muted-foreground text-sm font-medium">{friend.handle}</p>
                                    </div>
                                    {!isCurrentUser && (
                                        <>
                                            {isFriend ? (
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button
                                                            size="sm"
                                                            className="bg-primary/10 text-primary hover:bg-primary/20"
                                                            variant="ghost"
                                                        >
                                                            <span className="flex items-center gap-1">
                                                                <UserCheck className="w-4 h-4" /> <span className="hidden sm:inline">Friends</span>
                                                            </span>
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={handleRemoveFriend}
                                                            className="text-destructive focus:text-destructive cursor-pointer"
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Remove Friend
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            ) : (
                                                <>
                                                    {isOutgoingRequest ? (
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button
                                                                    size="sm"
                                                                    className="bg-muted text-muted-foreground"
                                                                    variant="ghost"
                                                                    disabled={addFriendMutation.isPending || cancelRequestMutation.isPending}
                                                                >
                                                                    {addFriendMutation.isPending || cancelRequestMutation.isPending ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        <span className="flex items-center gap-1">
                                                                            <Clock className="w-4 h-4" /> <span className="hidden sm:inline">Request Sent</span>
                                                                        </span>
                                                                    )}
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem
                                                                    onClick={handleCancelRequest}
                                                                    className="text-destructive focus:text-destructive cursor-pointer"
                                                                >
                                                                    <X className="w-4 h-4 mr-2" />
                                                                    Cancel Request
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            className={hasPendingRequest ? "bg-muted text-muted-foreground" : ""}
                                                            variant={hasPendingRequest ? "ghost" : "default"}
                                                            onClick={handleAddFriend}
                                                            disabled={!!hasPendingRequest || addFriendMutation.isPending}
                                                        >
                                                            {addFriendMutation.isPending ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : hasPendingRequest ? (
                                                                <span className="flex items-center gap-1">
                                                                    <Check className="w-4 h-4" /> <span className="hidden sm:inline">Request Received</span>
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1">
                                                                    <UserPlus className="w-4 h-4" /> <span className="hidden sm:inline">Add Friend</span>
                                                                </span>
                                                            )}
                                                        </Button>
                                                    )}
                                                </>
                                            )}
                                        </>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge variant="outline" className="px-3 py-1.5 rounded-full border-border bg-background">
                                        <Trophy className="w-4 h-4 mr-1.5 text-accent" />
                                        <span className="font-semibold text-foreground">Level {level}</span>
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </Card>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {statItems.map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className="p-5 h-full flex flex-col justify-center border-border/40 hover:border-border/80 transition-colors">
                                <div className="flex flex-col items-center sm:items-start sm:flex-row sm:items-center gap-3">
                                    <div className={`w-11 h-11 rounded-xl ${stat.bgColor} flex items-center justify-center shrink-0`}>
                                        <stat.icon className={`w-6 h-6 ${stat.color}`} />
                                    </div>
                                    <div className="text-center sm:text-left">
                                        <div className="text-2xl font-normal tracking-tight">{stat.value}</div>
                                        <div className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground/80">{stat.label}</div>
                                    </div>
                                </div>
                            </Card>
                        </motion.div>
                    ))}
                </div>

                {/* Common Projects */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                >
                    <Card className="p-4 md:p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="w-5 h-5 text-primary" />
                            <h3 className="text-lg font-bold">Common Projects</h3>
                        </div>

                        {loadingProjects ? (
                            <InlineLoader text="Loading projects..." />
                        ) : commonProjects.length === 0 ? (
                            <div className="text-center py-6 text-muted-foreground text-sm">
                                No common projects found.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {sortedCommonProjects.map((project) => {
                                    const Icon = getIconByName(project.icon || 'Target');
                                    return (
                                        <div
                                            key={project.id}
                                            className="flex items-center gap-4 p-3 rounded-xl border border-border/40 hover:bg-muted/30 transition-colors cursor-pointer"
                                            onClick={() => navigate(`/projects/${project.id}`)}
                                        >
                                            <div
                                                className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                                                style={{ backgroundColor: adjustColorOpacity(project.color || '#3b82f6', 0.1) }}
                                            >
                                                <Icon className="w-5 h-5" style={{ color: project.color || '#3b82f6' }} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold truncate">{project.name}</div>
                                                <div className="text-xs text-muted-foreground truncate">{project.description}</div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </Card>
                </motion.div>
            </div>
        </div >
    );
};

export default FriendProfile;
