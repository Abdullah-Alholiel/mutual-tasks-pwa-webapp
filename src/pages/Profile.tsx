import { AppLayout } from '@/components/layout/AppLayout';
import { StreakCalendar } from '@/components/profile/StreakCalendar';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Target, Zap, TrendingUp, LogOut } from 'lucide-react';
import { getUserProjects } from '@/lib/projectUtils';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentUser, useCurrentUserStats } from '@/hooks/useCurrentUser';
import { useProjects } from '@/hooks/useProjects';
import { useMemo } from 'react';

const Profile = () => {
  const isMobile = useIsMobile();
  const { user: authUser, logout } = useAuth();
  const { data: currentUser } = useCurrentUser();
  const { data: userStats } = useCurrentUserStats();
  const { data: allProjects = [] } = useProjects();
  
  // Use utility to get user projects
  const userProjects = useMemo(() => 
    currentUser ? getUserProjects(allProjects, currentUser.id) : [],
    [allProjects, currentUser]
  );

  // Calculate overall total score from user stats
  const overallTotalScore = userStats?.totalscore || 0;

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
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading profile...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
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
                    Level {Math.floor(overallTotalScore / 50) + 1}
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
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${project.color}15` }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: project.color }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{project.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {project.completedTasks || 0}/{project.totalTasks || 0} tasks completed
                    </div>
                  </div>
                  <div className="text-sm font-medium text-muted-foreground">
                    {project.totalTasks > 0 
                      ? `${Math.round(((project.completedTasks || 0) / project.totalTasks) * 100)}%`
                      : '0%'}
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
    </AppLayout>
  );
};

export default Profile;
