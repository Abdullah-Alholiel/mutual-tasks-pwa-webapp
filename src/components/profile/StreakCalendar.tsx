import { Card } from '@/components/ui/card';
import { motion } from 'framer-motion';
import { Flame, Trophy } from 'lucide-react';
import { currentUser } from '@/lib/mockData';

export const StreakCalendar = () => {
  // Generate last 7 weeks of days
  const generateDays = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 48; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      
      // Mock completion intensity (0-4)
      const intensity = Math.random() > 0.3 ? Math.floor(Math.random() * 4) + 1 : 0;
      
      days.push({
        date,
        intensity,
        count: intensity > 0 ? Math.floor(Math.random() * 5) + 1 : 0
      });
    }
    
    return days;
  };

  const days = generateDays();
  const weeks: typeof days[] = [];
  
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
          <div className="flex gap-1 text-xs text-muted-foreground justify-end mb-2">
            <span className="w-10 text-center">Mon</span>
            <span className="w-10 text-center">Wed</span>
            <span className="w-10 text-center">Fri</span>
            <span className="w-10 text-center">Sun</span>
          </div>
          
          <div className="flex gap-2">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="flex flex-col gap-2">
                {week.map((day, dayIndex) => (
                  <motion.div
                    key={`${weekIndex}-${dayIndex}`}
                    whileHover={{ scale: 1.2 }}
                    className="group relative"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg ${getIntensityColor(
                        day.intensity
                      )} transition-colors cursor-pointer`}
                    />
                    
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
            ))}
          </div>

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
