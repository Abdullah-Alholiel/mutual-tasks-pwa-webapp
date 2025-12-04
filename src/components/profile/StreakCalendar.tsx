import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Flame, Trophy } from 'lucide-react';
import { currentUser } from '@/lib/mockData';

export const StreakCalendar = () => {
  // Generate last 7 weeks of days
  const generateDays = () => {
    const days = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get the start of the week (Sunday)
    const startOfWeek = new Date(today);
    const dayOfWeek = startOfWeek.getDay(); // 0 = Sunday
    startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek - (7 * 6)); // Go back 6 weeks
    
    // Generate 49 days (7 weeks)
    for (let i = 0; i < 49; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);
      
      // Mock completion intensity (0-4)
      const intensity = Math.random() > 0.3 ? Math.floor(Math.random() * 4) + 1 : 0;
      
      days.push({
        date,
        intensity,
        count: intensity > 0 ? Math.floor(Math.random() * 5) + 1 : 0,
        dayOfWeek: date.getDay()
      });
    }
    
    return days;
  };

  const days = generateDays();
  const weeks: typeof days[] = [];
  
  // Group into weeks of 7 days
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const getIntensityColor = (intensity: number) => {
    if (intensity === 0) return 'bg-muted';
    if (intensity === 1) return 'bg-primary/20';
    if (intensity === 2) return 'bg-primary/40';
    if (intensity === 3) return 'bg-primary/60';
    return 'bg-primary';
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
              <div className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-accent/10">
                <Flame className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-accent" />
                <div className="text-right">
                  <div className="text-[9px] sm:text-xs text-muted-foreground">Current</div>
                  <div className="text-sm sm:text-lg font-bold text-accent">{currentUser.stats.currentStreak}</div>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-muted">
                <Trophy className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-foreground" />
                <div className="text-right">
                  <div className="text-[9px] sm:text-xs text-muted-foreground">Best</div>
                  <div className="text-sm sm:text-lg font-bold text-foreground">{currentUser.stats.longestStreak}</div>
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
                    
                    {week.map((day, dayIndex) => (
                      <motion.div
                        key={dayIndex}
                        whileHover={{ scale: 1.1 }}
                        className="group relative flex items-center justify-center"
                      >
                        <div
                          className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg ${getIntensityColor(
                            day.intensity
                          )} transition-colors cursor-pointer flex items-center justify-center`}
                          title={`${day.date.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'long', 
                            day: 'numeric' 
                          })} - ${day.count} ${day.count === 1 ? 'task' : 'tasks'}`}
                        >
                          {day.intensity > 0 && (
                            <span className="text-[10px] sm:text-xs font-medium text-primary-foreground">
                              {day.count}
                            </span>
                          )}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-popover border border-border rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          <div className="text-xs font-medium">
                            {day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {day.count} {day.count === 1 ? 'task' : 'tasks'}
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
