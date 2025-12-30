import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Flame, Trophy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser, useCurrentUserStats } from '@/features/auth/useCurrentUser';
import { getDatabaseClient } from '@/db';
import { groupCompletionsByDate, calculateIntensity } from '@/lib/users/userStatsUtils';

/**
 * Get date string in YYYY-MM-DD format in the given timezone
 */
const getDateStringInTimezone = (date: Date, timezone: string = 'UTC'): string => {
  return date.toLocaleDateString('en-CA', { timeZone: timezone });
};

export const StreakCalendar = () => {
  const { data: currentUser, isLoading: userLoading } = useCurrentUser();
  const { data: stats, isLoading: statsLoading } = useCurrentUserStats();

  // Fetch completion logs for the current user
  const { data: completionLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['completionLogs', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      const db = getDatabaseClient();
      return await db.users.getCompletionLogs(currentUser.id);
    },
    enabled: !!currentUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  // Group completions by date for heatmap
  const completionsByDate = useMemo(() => {
    if (!currentUser) return new Map<string, number>();
    return groupCompletionsByDate(completionLogs, currentUser.timezone || 'UTC');
  }, [completionLogs, currentUser]);

  // Generate last 7 weeks of days with real completion data
  const days = useMemo(() => {
    if (!currentUser) return [];

    const result = [];
    const timezone = currentUser.timezone || 'UTC';
    const today = new Date();

    // Get the start of the week (Sunday) in the user's timezone
    const startOfWeek = new Date(today);
    const dayOfWeek = startOfWeek.getDay(); // 0 = Sunday
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek - (7 * 6)); // Go back 6 weeks

    // Generate 49 days (7 weeks)
    for (let i = 0; i < 49; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);

      // Get the date string in YYYY-MM-DD format in the user's timezone for lookup
      const dateStr = getDateStringInTimezone(date, timezone);

      // Get actual completion count for this day
      const count = completionsByDate.get(dateStr) || 0;
      const intensity = calculateIntensity(count);

      result.push({
        date,
        intensity,
        count,
        dayOfWeek: date.getDay()
      });
    }

    return result;
  }, [completionsByDate, currentUser]);

  // Group into weeks of 7 days
  const weeks = useMemo(() => {
    const result: typeof days[] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  const getIntensityColor = (intensity: number) => {
    if (intensity === 0) return 'bg-muted';
    if (intensity === 1) return 'bg-primary/20';
    if (intensity === 2) return 'bg-primary/40';
    if (intensity === 3) return 'bg-primary/60';
    return 'bg-primary';
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  if (userLoading || statsLoading || logsLoading || !currentUser || !stats) {
    return (
      <Card className="p-4 sm:p-6">
        <div className="h-48 flex items-center justify-center">
          <p className="text-muted-foreground">Loading stats...</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 sm:p-6 overflow-x-hidden">
      <div className="flex flex-col items-center">
        {/* Content Container - responsive width */}
        <div className="w-full max-w-[18.75rem] sm:max-w-[26rem]">
          {/* Header - responsive layout */}
          <div className="flex items-center justify-between gap-2 sm:gap-4 mb-4 sm:mb-6">
            <div className="flex-shrink-0">
              <h3 className="text-base sm:text-lg font-semibold mb-1">Activity & Streaks</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">Your completion heatmap</p>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
              <div className="flex items-center justify-between w-20 sm:w-32 gap-1.5 sm:gap-2 px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-accent/10">
                <Flame className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-accent" />
                <div className="text-right">
                  <div className="text-[9px] sm:text-xs text-muted-foreground">Current</div>
                  <div className="text-sm sm:text-lg font-bold text-accent">{stats.currentStreak}</div>
                </div>
              </div>

              <div className="flex items-center justify-between w-20 sm:w-32 gap-1.5 sm:gap-2 px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-muted">
                <Trophy className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-foreground" />
                <div className="text-right">
                  <div className="text-[9px] sm:text-xs text-muted-foreground">Best</div>
                  <div className="text-sm sm:text-lg font-bold text-foreground">{stats.longestStreak}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Grid - compact on mobile */}
          <div className="space-y-1.5 sm:space-y-2 w-full">
            {/* Day labels */}
            <div className="grid grid-cols-[3rem_2rem_2rem_2rem_2rem_2rem_2rem_2rem] sm:grid-cols-[5rem_2.5rem_2.5rem_2.5rem_2.5rem_2.5rem_2.5rem_2.5rem] gap-1 sm:gap-2 w-full">
              <div /> {/* Spacer */}
              {dayNames.map((dayName) => (
                <div key={dayName} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center">
                  <span className="text-[10px] sm:text-xs text-muted-foreground font-medium">{dayName}</span>
                </div>
              ))}
            </div>

            {/* Weeks */}
            <div className="space-y-1.5 sm:space-y-2 w-full">
              {weeks.map((week, weekIndex) => {
                const weekStart = week[0].date;
                const month = weekStart.toLocaleDateString('en-US', { month: 'short' });
                const day = weekStart.getDate();

                return (
                  <div
                    key={weekIndex}
                    className="grid grid-cols-[3rem_2rem_2rem_2rem_2rem_2rem_2rem_2rem] sm:grid-cols-[5rem_2.5rem_2.5rem_2.5rem_2.5rem_2.5rem_2.5rem_2.5rem] gap-1 sm:gap-2 items-center w-full"
                  >
                    <div className="flex items-center">
                      <span className="text-[10px] sm:text-xs text-muted-foreground whitespace-nowrap">
                        {weekIndex === weeks.length - 1 ? 'This week' : `${month} ${day}`}
                      </span>
                    </div>

                    {week.map((dayData, dayIndex) => (
                      <motion.div
                        key={dayIndex}
                        whileHover={{ scale: 1.1 }}
                        className="group relative flex items-center justify-center"
                      >
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${getIntensityColor(
                            dayData.intensity
                          )} transition-colors cursor-pointer flex items-center justify-center`}
                          title={`${dayData.date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            month: 'long',
                            day: 'numeric'
                          })} - ${dayData.count} ${dayData.count === 1 ? 'task' : 'tasks'}`}
                        >
                          {dayData.intensity > 0 && (
                            <span className="text-[10px] sm:text-xs font-medium text-primary-foreground">
                              {dayData.count}
                            </span>
                          )}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          <div className="text-xs font-medium">
                            {dayData.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {dayData.count} {dayData.count === 1 ? 'task' : 'tasks'} completed
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center justify-end gap-1.5 sm:gap-2 mt-3 sm:mt-4 text-[10px] sm:text-xs text-muted-foreground pt-2">
              <span>Less</span>
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-muted" />
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-primary/20" />
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-primary/40" />
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-primary/60" />
              <div className="w-3 h-3 sm:w-4 sm:h-4 rounded bg-primary" />
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
