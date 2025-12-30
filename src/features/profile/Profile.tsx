import { AppLayout } from '@/layout/AppLayout';
import { StreakCalendar } from './components/StreakCalendar';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Target, Zap, TrendingUp, LogOut } from 'lucide-react';
import { InlineLoader } from '@/components/ui/loader';
import { useNavigate } from 'react-router-dom';
import { getUserProjects } from '@/lib/projects/projectUtils';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/features/auth/useAuth';
import { useCurrentUser, useCurrentUserStats } from '../auth/useCurrentUser';
import { useProjects, useUserProjectsWithStats } from '@/features/projects/hooks/useProjects';
import { useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { calculateLevel } from '@/lib/users/userStatsUtils';

interface ProfileProps {
  isInternalSlide?: boolean;
  isActive?: boolean;
}

const Profile = ({ isInternalSlide, isActive = true }: ProfileProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user: authUser, logout } = useAuth();
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const { data: userStats, isLoading: statsLoading } = useCurrentUserStats();
  const { data: userProjects = [], isLoading: projectsLoading } = useUserProjectsWithStats();

  // Force refresh stats when profile page loads (only once)
  useEffect(() => {
    if (currentUser?.id) {
      // Invalidate and refetch stats to ensure they're up-to-date
      queryClient.invalidateQueries({ queryKey: ['user', 'current', 'stats', currentUser.id] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'with-stats', currentUser.id] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]); // Only run when user ID changes

  // Calculate overall total score from user stats
  const overallTotalScore = userStats?.totalscore || 0;

  // Calculate user level using realistic leveling formula
  const userLevel = useMemo(() => calculateLevel(overallTotalScore), [overallTotalScore]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully', {
        description: 'See you soon!'
      });
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  const stats = [
    {
      icon: Trophy,
      label: 'Overall Score',
      value: overallTotalScore,
      color: 'text-accent',
      bgColor: 'bg-accent/10'
    },
    {
      icon: Target,
      label: 'Completed',
      value: userStats?.totalCompletedTasks || 0,
      color: 'text-success',
      bgColor: 'bg-success/10'
    },
    {
      icon: Zap,
      label: 'Current Streak',
      value: userStats?.currentStreak || 0,
      color: 'text-primary',
      bgColor: 'bg-primary/10'
    },
    {
      icon: TrendingUp,
      label: 'Best Streak',
      value: userStats?.longestStreak || 0,
      color: 'text-foreground',
      bgColor: 'bg-muted'
    }
  ];

  if (!currentUser) {
    return (
      <InlineLoader text="Loading profile..." />
    );
  }

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto w-full">
      {/* Profile Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="p-6">
          <div className="flex items-start gap-6">
            <Avatar className="w-24 h-24 ring-4 ring-border">
              <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
              <AvatarFallback className="text-2xl">
                {currentUser.name.charAt(0)}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1">
              <h1 className="text-2xl font-bold mb-1">{currentUser.name}</h1>
              <p className="text-muted-foreground mb-4">{currentUser.handle}</p>

              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Trophy className="w-3 h-3" />
                  Level {userLevel}
                </Badge>
                <Badge variant="outline">
                  {userProjects.length} active projects
                </Badge>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                  <stat.icon className={`w-5 h-5 ${stat.color}`} />
                </div>
                <div>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <div className="text-xs text-muted-foreground">{stat.label}</div>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Streak Calendar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <StreakCalendar />
      </motion.div>

      {/* Active Projects */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">Active Projects</h3>
          <div className="space-y-3">
            {userProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center gap-4 p-4 rounded-xl hover:bg-muted/30 transition-all cursor-pointer border border-border/40 group"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 shadow-sm"
                  style={{ backgroundColor: `${project.color}10` }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: project.color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate text-foreground text-sm group-hover:text-primary transition-colors">{project.name}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/60">
                      {project.completedTasks || 0}/{project.totalTasks || 0} tasks
                    </div>
                    <div className="h-0.5 w-0.5 rounded-full bg-muted-foreground/30" />
                    <div className="text-[10px] font-bold text-primary/80">
                      {project.progress || 0}%
                    </div>
                  </div>
                </div>
                {/* Minimal Sparkline-like progress */}
                <div className="shrink-0 w-16">
                  <div className="w-full bg-muted/40 rounded-full h-1 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${project.progress || 0}%` }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Logout Button - Mobile Only */}
      {isMobile && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="pb-8"
        >
          <Button
            onClick={handleLogout}
            variant="destructive"
            className="w-full"
            size="lg"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </motion.div>
      )}
    </div>
  );
};

export default Profile;
