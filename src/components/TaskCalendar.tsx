"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCalendarProps {
  onDateChange?: (date: Date | undefined) => void;
  selectedDate?: Date | undefined;
}

// Spring animation configuration for premium micro-interactions
const springConfig = {
  type: "spring" as const,
  stiffness: 400,
  damping: 30,
  mass: 0.8
};

export const TaskCalendar = ({ onDateChange, selectedDate: externalSelectedDate }: TaskCalendarProps) => {
  const [internalDate, setInternalDate] = useState<Date | undefined>(externalSelectedDate);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const selectedDate = externalSelectedDate ?? internalDate;
  const hasInitializedRef = useRef(false);

  const weekDates = useMemo(() => {
    const dates: Date[] = [];
    // Monday = 1 ... Sunday = 7 (7 days)
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentDate);
      const dayOfWeek = currentDate.getDay(); // 0=Sun, 1=Mon ...
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      date.setDate(currentDate.getDate() + mondayOffset + i);
      date.setHours(0, 0, 0, 0);
      dates.push(date);
    }
    return dates;
  }, [currentDate]);

  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);

  // Auto-center today on component mount (only once)
  useEffect(() => {
    if (!hasInitializedRef.current) {
      const todayIndex = weekDates.findIndex(date => isSameDay(date, today));
      if (todayIndex !== -1) {
        const centerOffset = Math.floor(weekDates.length / 2);
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() - (todayIndex - centerOffset));
        setCurrentDate(targetDate);
        hasInitializedRef.current = true;
      }
    }
  }, [today, weekDates]);

  const handleDateChange = (date: Date) => {
    setInternalDate(date);
    onDateChange?.(date);
  };

  const handleGoToToday = () => {
    // Always clear selection and navigate view to today's week
    setInternalDate(undefined);
    onDateChange?.(undefined);
    setCurrentDate(new Date());
  };

  // Today button is "active" only when no date is selected (user is on default today view)
  const isTodayButtonActive = !selectedDate;

  const handlePrevWeek = () => {
    setCurrentDate((prev: Date) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() - 7);
      return newDate;
    });
  };

  const handleNextWeek = () => {
    setCurrentDate((prev: Date) => {
      const newDate = new Date(prev);
      newDate.setDate(prev.getDate() + 7);
      return newDate;
    });
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return date1.toDateString() === date2.toDateString();
  };

  const formatDateShort = (date: Date) => {
    // getDay(): 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
    const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    return days[date.getDay()];
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="w-full"
    >
      <div className="bg-card/60 border border-border/40 rounded-2xl px-3 py-2.5">
        {/* Top row: month left, today button right */}
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </span>
          <motion.button
            type="button"
            onClick={handleGoToToday}
            whileTap={{ scale: 0.93 }}
            transition={springConfig}
            className={cn(
              "h-5.5 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 transition-colors",
              isTodayButtonActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-muted-foreground hover:bg-muted"
            )}
            aria-label="Go to today"
          >
            <Sun className="w-2.5 h-2.5" />
            Today
          </motion.button>
        </div>

        {/* Days row: arrow + 7 days + arrow */}
        <div className="flex items-center gap-1">
          <motion.button
            type="button"
            onClick={handlePrevWeek}
            whileTap={{ scale: 0.9 }}
            transition={springConfig}
            className="h-8 w-6 shrink-0 rounded-lg hover:bg-muted/50 flex items-center justify-center transition-colors"
            aria-label="Previous week"
          >
            <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.button>

          <div className="grid grid-cols-7 gap-0.5 flex-1">
            {weekDates.map((date, index) => {
              const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
              const isToday = isSameDay(date, today);
              const dayLetter = formatDateShort(date);
              const dayNumber = date.getDate();
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;

              return (
                <motion.button
                  key={date.toISOString()}
                  type="button"
                  onClick={() => handleDateChange(date)}
                  whileTap={{ scale: 0.93 }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    ...springConfig,
                    delay: 0.3 + (index * 0.03)
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center py-1.5 rounded-xl transition-all duration-200 relative",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : isWeekend
                        ? "text-muted-foreground/60 hover:bg-muted/40"
                        : "hover:bg-muted/50"
                  )}
                  aria-label={`${dayLetter} ${dayNumber}${isToday ? ', today' : ''}${isSelected ? ', selected' : ''}`}
                  aria-pressed={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleDateChange(date);
                    }
                  }}
                >
                  <span className={cn(
                    "text-[9px] font-semibold uppercase leading-none mb-0.5",
                    isSelected
                      ? "text-primary-foreground/80"
                      : isToday
                        ? "text-primary/70"
                        : "text-muted-foreground/60"
                  )}>
                    {dayLetter}
                  </span>
                  <span className={cn(
                    "text-[13px] font-bold leading-none",
                    !isSelected && isToday && "text-primary"
                  )}>
                    {dayNumber}
                  </span>

                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={springConfig}
                      className="absolute inset-0 rounded-xl bg-gradient-to-b from-white/15 to-transparent pointer-events-none"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>

          <motion.button
            type="button"
            onClick={handleNextWeek}
            whileTap={{ scale: 0.9 }}
            transition={springConfig}
            className="h-8 w-6 shrink-0 rounded-lg hover:bg-muted/50 flex items-center justify-center transition-colors"
            aria-label="Next week"
          >
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.button>
        </div>

        {/* Selected date label */}
        <AnimatePresence mode="wait">
          {selectedDate && (
            <motion.p
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ duration: 0.15 }}
              className="text-center text-[10px] text-muted-foreground font-medium pt-2 border-t border-border/30"
            >
              {selectedDate.toLocaleDateString("en-US", {
                weekday: "long",
                month: "short",
                day: "numeric",
              })}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default TaskCalendar;
