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
    <Card className="p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold mb-1">Activity & Streaks</h3>
            <p className="text-sm text-muted-foreground">Your completion heatmap</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-accent/10">
              <Flame className="w-5 h-5 text-accent" />
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Current</div>
                <div className="text-lg font-bold text-accent">{currentUser.stats.currentStreak}</div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted">
              <Trophy className="w-5 h-5 text-foreground" />
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Best</div>
                <div className="text-lg font-bold text-foreground">{currentUser.stats.longestStreak}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="space-y-2">
          {/* Day labels */}
          <div className="flex gap-2 pl-12">
            {dayNames.map((dayName) => (
              <div key={dayName} className="flex-1 text-center">
                <span className="text-xs text-muted-foreground font-medium">{dayName}</span>
              </div>
            ))}
          </div>
          
          {/* Weeks */}
          <div className="space-y-2">
            {weeks.map((week, weekIndex) => {
              const weekStart = week[0].date;
              const month = weekStart.toLocaleDateString('en-US', { month: 'short' });
              const day = weekStart.getDate();
              
              return (
                <div key={weekIndex} className="flex gap-2 items-center">
                  {/* Week label */}
                  <div className="w-10 shrink-0">
                    <span className="text-xs text-muted-foreground">
                      {weekIndex === weeks.length - 1 ? 'This week' : `${month} ${day}`}
                    </span>
                  </div>
                  
                  {/* Week days */}
                  <div className="flex-1 grid grid-cols-7 gap-2">
                    {week.map((day, dayIndex) => (
                      <motion.div
                        key={dayIndex}
                        whileHover={{ scale: 1.1 }}
                        className="group relative"
                      >
                        <div
                          className={`w-10 h-10 rounded-lg ${getIntensityColor(
                            day.intensity
                          )} transition-colors cursor-pointer flex items-center justify-center`}
                          title={`${day.date.toLocaleDateString('en-US', { 
                            weekday: 'long', 
                            month: 'long', 
                            day: 'numeric' 
                          })} - ${day.count} ${day.count === 1 ? 'task' : 'tasks'}`}
                        >
                          {day.intensity > 0 && (
                            <span className="text-xs font-medium text-primary-foreground">
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
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-4 text-xs text-muted-foreground">
            <span>Less</span>
            <div className="w-4 h-4 rounded bg-muted" />
            <div className="w-4 h-4 rounded bg-primary/20" />
            <div className="w-4 h-4 rounded bg-primary/40" />
            <div className="w-4 h-4 rounded bg-primary/60" />
            <div className="w-4 h-4 rounded bg-primary" />
            <span>More</span>
          </div>
        </div>
      </div>
    </Card>
  );
};
