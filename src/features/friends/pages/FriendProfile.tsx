
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useFriend, useCommonProjects } from '../hooks/useFriends';
import { calculateLevel } from '@/lib/users/userStatsUtils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trophy, Target, Zap, TrendingUp, ArrowLeft, Users } from 'lucide-react';
import { InlineLoader } from '@/components/ui/loader';
import { getIconByName } from '@/lib/projects/projectIcons';
import { adjustColorOpacity } from '@/lib/colorUtils';

const FriendProfile = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const friendId = Number(id);

    // Hooks
    const { data: friend, isLoading: loadingFriend } = useFriend(friendId);
    const { data: commonProjects = [], isLoading: loadingProjects } = useCommonProjects(friendId);

    if (loadingFriend || !friend) {
        return (
            <div className="h-full bg-background pt-20 flex justify-center">
                <InlineLoader text="Loading profile..." />
            </div>
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
        <div className="h-full overflow-y-auto bg-background pb-20 custom-scrollbar">
            {/* Header */}
            <div className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border/50">
                <div className="max-w-md mx-auto px-4 h-16 flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate('/friends')}
                        className="-ml-2 hover:bg-transparent"
                    >
                        <ArrowLeft className="w-6 h-6" />
                    </Button>
                    <h1 className="text-xl font-bold">Friend Profile</h1>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 py-6 space-y-8">
                {/* Profile Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <Card className="p-6">
                        <div className="flex items-start gap-6">
                            <Avatar className="w-24 h-24 ring-4 ring-border">
                                <AvatarImage src={friend.avatar} alt={friend.name} />
                                <AvatarFallback className="text-2xl">
                                    {friend.name.charAt(0)}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1">
                                <h1 className="text-2xl font-bold mb-1">{friend.name}</h1>
                                <p className="text-muted-foreground mb-4">@{friend.handle}</p>

                                <div className="flex flex-wrap gap-3 mt-4">
                                    <Badge variant="secondary" className="flex items-center gap-2 px-4 py-1.5 text-sm font-bold shadow-sm">
                                        <Trophy className="w-4 h-4 text-accent" />
                                        Level {level}
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    </Card>
                </motion.div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    {statItems.map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <Card className="p-4 flex flex-col items-center text-center gap-2 border-border/40">
                                <div className={`w-10 h-10 rounded-full ${stat.bgColor} flex items-center justify-center shrink-0`}>
                                    <stat.icon className={`w-5 h-5 ${stat.color}`} />
                                </div>
                                <div>
                                    <div className="text-xl font-black">{stat.value}</div>
                                    <div className="text-[10px] uppercase font-bold text-muted-foreground">{stat.label}</div>
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
                                {commonProjects.map((project) => {
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
        </div>
    );
};

export default FriendProfile;
