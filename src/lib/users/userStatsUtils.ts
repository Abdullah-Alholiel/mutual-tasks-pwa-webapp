// ============================================================================
// User Stats Utilities - Calculate User Statistics from Completion Logs
// ============================================================================
// 
// This file provides utilities to calculate user statistics from completion logs.
// All stats are derived from actual user activity, ensuring accurate numbers.
// ============================================================================

import type { CompletionLog, UserStats } from '@/types';

/**
 * Normalize a date to start of day in the given timezone
 * Returns a date string in YYYY-MM-DD format
 */
const normalizeToStartOfDay = (date: Date, timezone: string = 'UTC'): string => {
  // Create a date string in the user's timezone using YYYY-MM-DD format
  const dateStr = date.toLocaleDateString('en-CA', { timeZone: timezone }); // YYYY-MM-DD format
  return dateStr;
};

/**
 * Get unique dates from completion logs (normalized to start of day)
 */
const getUniqueDates = (logs: CompletionLog[], timezone: string = 'UTC'): Set<string> => {
  const dates = new Set<string>();
  logs.forEach(log => {
    const dateStr = normalizeToStartOfDay(new Date(log.createdAt), timezone);
    dates.add(dateStr);
  });
  return dates;
};

/**
 * Calculate current streak - consecutive days with at least one completion
 * starting from today or yesterday (if no completion today yet)
 */
export const calculateCurrentStreak = (
  logs: CompletionLog[],
  timezone: string = 'UTC'
): number => {
  if (logs.length === 0) return 0;

  const uniqueDates = getUniqueDates(logs, timezone);
  if (uniqueDates.size === 0) return 0;

  // Sort dates in descending order (most recent first)
  const sortedDates = Array.from(uniqueDates).sort((a, b) => b.localeCompare(a));
  
  const todayStr = normalizeToStartOfDay(new Date(), timezone);
  
  // Calculate yesterday in the same timezone
  const todayDate = new Date();
  const yesterdayDate = new Date(todayDate);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = normalizeToStartOfDay(yesterdayDate, timezone);

  // Streak must start from today or yesterday
  const mostRecentDate = sortedDates[0];
  if (mostRecentDate !== todayStr && mostRecentDate !== yesterdayStr) {
    return 0; // Streak is broken
  }

  // Count consecutive days
  let streak = 0;
  const currentDate = mostRecentDate === todayStr ? new Date() : new Date();
  if (mostRecentDate === yesterdayStr) {
    currentDate.setDate(currentDate.getDate() - 1);
  }
  
  for (const dateStr of sortedDates) {
    const expectedDateStr = normalizeToStartOfDay(currentDate, timezone);
    
    if (dateStr === expectedDateStr) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (dateStr < expectedDateStr) {
      // Gap in dates - streak is broken
      break;
    }
    // If dateStr > expectedDateStr, we might have duplicate processing, skip
  }

  return streak;
};

/**
 * Calculate longest streak - the longest consecutive days with completions
 * in the user's history
 */
export const calculateLongestStreak = (
  logs: CompletionLog[],
  timezone: string = 'UTC'
): number => {
  if (logs.length === 0) return 0;

  const uniqueDates = getUniqueDates(logs, timezone);
  if (uniqueDates.size === 0) return 0;

  // Sort dates in ascending order
  const sortedDates = Array.from(uniqueDates).sort();
  
  let longestStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    
    // Calculate difference in days
    const diffTime = currDate.getTime() - prevDate.getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      // Consecutive day
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      // Gap in days - reset streak
      currentStreak = 1;
    }
  }

  return longestStreak;
};

/**
 * Calculate total completed tasks from completion logs
 */
export const calculateTotalCompletedTasks = (logs: CompletionLog[]): number => {
  return logs.length;
};

/**
 * Calculate total score (XP) from completion logs
 */
export const calculateTotalScore = (logs: CompletionLog[]): number => {
  return logs.reduce((sum, log) => sum + (log.xpEarned || 0), 0);
};

/**
 * Calculate all user stats from completion logs
 */
export const calculateUserStatsFromLogs = (
  userId: number,
  logs: CompletionLog[],
  timezone: string = 'UTC'
): Omit<UserStats, 'updatedAt'> => {
  return {
    userId,
    totalCompletedTasks: calculateTotalCompletedTasks(logs),
    totalscore: calculateTotalScore(logs),
    currentStreak: calculateCurrentStreak(logs, timezone),
    longestStreak: calculateLongestStreak(logs, timezone),
  };
};

/**
 * Group completion logs by date (for activity heatmap)
 * Returns a map of date string (YYYY-MM-DD) to completion count
 * Dates are normalized to the user's timezone
 */
export const groupCompletionsByDate = (
  logs: CompletionLog[],
  timezone: string = 'UTC'
): Map<string, number> => {
  const dateCountMap = new Map<string, number>();
  
  logs.forEach(log => {
    const dateStr = normalizeToStartOfDay(new Date(log.createdAt), timezone);
    dateCountMap.set(dateStr, (dateCountMap.get(dateStr) || 0) + 1);
  });
  
  return dateCountMap;
};

/**
 * Calculate intensity level for activity heatmap (0-4)
 * - 0 completions = intensity 0
 * - 1-2 completions = intensity 1
 * - 3-4 completions = intensity 2
 * - 5-6 completions = intensity 3
 * - 7+ completions = intensity 4
 */
export const calculateIntensity = (count: number): number => {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
};

/**
 * Calculate user level from total XP (score)
 * Uses simple linear progression: each level requires 2000 XP
 * - Level 1: 0-1999 XP
 * - Level 2: 2000-3999 XP
 * - Level 3: 4000-5999 XP
 * - Level 4: 6000-7999 XP
 * - Level 5: 8000-9999 XP
 * - etc.
 * 
 * Formula: level = floor(XP / 2000) + 1
 * 
 * @param totalXP - Total XP (totalscore) from user stats
 * @returns User level (minimum 1)
 */
export const calculateLevel = (totalXP: number): number => {
  if (totalXP < 0) return 1;
  // Simple linear formula: each level requires 2000 XP
  const level = Math.floor(totalXP / 2000) + 1;
  return Math.max(1, level); // Ensure minimum level of 1
};

/**
 * Calculate total XP required to reach the next level
 * 
 * @param currentLevel - Current user level
 * @returns Total XP required to reach the next level
 */
export const getXPForNextLevel = (currentLevel: number): number => {
  // Each level requires 2000 XP, so next level requires (currentLevel * 2000) total XP
  return currentLevel * 2000;
};

/**
 * Calculate XP progress in current level
 * 
 * @param totalXP - Current total XP
 * @param currentLevel - Current user level
 * @returns Object with current XP in level and XP needed for next level
 */
export const getLevelProgress = (totalXP: number, currentLevel: number): {
  currentXPInLevel: number;
  xpNeededForNextLevel: number;
} => {
  // XP required to start current level = (currentLevel - 1) * 2000
  const xpForCurrentLevelStart = (currentLevel - 1) * 2000;
  // XP required to reach next level = currentLevel * 2000
  const xpForNextLevel = currentLevel * 2000;
  
  // Current XP in this level = totalXP - XP needed to start current level
  const currentXPInLevel = Math.max(0, totalXP - xpForCurrentLevelStart);
  // XP needed to reach next level = XP for next level - totalXP
  const xpNeededForNextLevel = Math.max(0, xpForNextLevel - totalXP);
  
  return {
    currentXPInLevel,
    xpNeededForNextLevel,
  };
};

