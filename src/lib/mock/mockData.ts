// ============================================================================
// Comprehensive Mock Data - Covers All Use Cases
// ============================================================================
// 
// This mock data is designed to test all application use cases:
// - User registration, profile updates, role changes
// - Project creation, editing, participant management
// - Task creation, acceptance, decline, completion, recovery
// - Notifications for all events
// - Stats and leaderboard scenarios
// - XP scoring with penalties for recovered tasks
// ============================================================================

import {
  User,
  UserStats,
  Project,
  ProjectParticipant,
  Task,
  TaskStatusEntity,
  CompletionLog,
  Notification,
  TaskRecurrence,
  RingColor,
} from '@/types';

// ============================================================================
// Date Helpers
// ============================================================================

const getToday = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

const getYesterday = () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  return yesterday;
};

const getTomorrow = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
};

const getDaysAgo = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getHoursAgo = (hours: number) => {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
};

const today = getToday();
const yesterday = getYesterday();
const tomorrow = getTomorrow();

// ============================================================================
// Users
// ============================================================================

export const currentUser: User = {
  id: 'user_001',
  name: 'Alice Johnson',
  handle: '@alicejohnson',
  email: 'alice.johnson@example.com',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alice',
  timezone: 'America/New_York',
  notificationPreferences: { push: true, email: true },
  createdAt: new Date('2025-11-01T12:00:00'),
  updatedAt: new Date('2025-12-01T12:00:00'),
  stats: {
    userId: 'user_001',
    totalCompletedTasks: 50,
    currentStreak: 5,
    longestStreak: 12,
    totalscore: 1800,
    updatedAt: new Date('2025-12-01T12:30:00'),
  },
};

export const mockUsers: User[] = [
  currentUser,
  {
    id: 'user_002',
    name: 'Bob Smith',
    handle: '@bobsmith',
    email: 'bob.smith@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Bob',
    timezone: 'Europe/London',
    notificationPreferences: { push: true, email: false },
    createdAt: new Date('2025-11-05T10:00:00'),
    updatedAt: new Date('2025-12-01T11:00:00'),
    stats: {
      userId: 'user_002',
      totalCompletedTasks: 30,
      currentStreak: 3,
      longestStreak: 8,
      totalscore: 1200,
      updatedAt: new Date('2025-12-01T11:30:00'),
    },
  },
  {
    id: 'user_003',
    name: 'Charlie Brown',
    handle: '@charliebrown',
    email: 'charlie.brown@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie',
    timezone: 'Asia/Kolkata',
    notificationPreferences: { push: false, email: true },
    createdAt: new Date('2025-11-10T08:00:00'),
    updatedAt: new Date('2025-12-01T10:00:00'),
    stats: {
      userId: 'user_003',
      totalCompletedTasks: 10,
      currentStreak: 1,
      longestStreak: 3,
      totalscore: 500,
      updatedAt: new Date('2025-12-01T10:15:00'),
    },
  },
  {
    id: 'user_004',
    name: 'Diana Prince',
    handle: '@dianaprince',
    email: 'diana.prince@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Diana',
    timezone: 'America/Los_Angeles',
    notificationPreferences: { push: true, email: true },
    createdAt: new Date('2025-11-15T14:00:00'),
    updatedAt: new Date('2025-12-01T09:00:00'),
    stats: {
      userId: 'user_004',
      totalCompletedTasks: 25,
      currentStreak: 7,
      longestStreak: 10,
      totalscore: 950,
      updatedAt: new Date('2025-12-01T09:30:00'),
    },
  },
];

// ============================================================================
// Projects
// ============================================================================

export const mockProjects: Project[] = [
  {
    id: 'project_001',
    name: 'Marketing Campaign 2025',
    description: 'Q1 omni-channel campaign with shared ownership.',
    icon: '📊',
    color: '#FF5733',
    ownerId: 'user_001',
    isPublic: true,
    totalTasks: 8,
    createdAt: new Date('2025-11-15T13:00:00'),
    updatedAt: today,
    participants: [mockUsers[0], mockUsers[1], mockUsers[2]],
    completedTasks: 3,
    progress: 0.38,
  },
  {
    id: 'project_002',
    name: 'Product Launch 2025',
    description: 'Launch GTM with recovered/archived edge cases.',
    icon: '🚀',
    color: '#4CAF50',
    ownerId: 'user_002',
    isPublic: false,
    totalTasks: 5,
    createdAt: new Date('2025-11-20T14:00:00'),
    updatedAt: today,
    participants: [mockUsers[1], mockUsers[0]],
    completedTasks: 1,
    progress: 0.2,
  },
  {
    id: 'project_003',
    name: 'Website Redesign',
    description: 'Public project, mix of upcoming and habits.',
    icon: '🎨',
    color: '#3F51B5',
    ownerId: 'user_003',
    isPublic: true,
    totalTasks: 4,
    createdAt: new Date('2025-11-25T14:30:00'),
    updatedAt: today,
    participants: [mockUsers[2], mockUsers[3]],
    completedTasks: 1,
    progress: 0.25,
  },
  {
    id: 'project_004',
    name: 'Daily Fitness Challenge',
    description: 'Private habit-heavy project.',
    icon: '💪',
    color: '#E91E63',
    ownerId: 'user_001',
    isPublic: false,
    totalTasks: 3,
    createdAt: new Date('2025-11-28T10:00:00'),
    updatedAt: today,
    participants: [mockUsers[0], mockUsers[3]],
    completedTasks: 1,
    progress: 0.33,
  },
];

// ============================================================================
// Project Participants
// ============================================================================

export const mockProjectParticipants: ProjectParticipant[] = [
  // Project 001
  { projectId: 'project_001', userId: 'user_001', role: 'owner', addedAt: new Date('2025-11-15T13:00:00'), user: mockUsers[0] },
  { projectId: 'project_001', userId: 'user_002', role: 'manager', addedAt: new Date('2025-11-15T13:05:00'), user: mockUsers[1] },
  { projectId: 'project_001', userId: 'user_003', role: 'participant', addedAt: new Date('2025-11-15T13:10:00'), user: mockUsers[2] },
  // Project 002
  { projectId: 'project_002', userId: 'user_002', role: 'owner', addedAt: new Date('2025-11-20T14:00:00'), user: mockUsers[1] },
  { projectId: 'project_002', userId: 'user_001', role: 'participant', addedAt: new Date('2025-11-20T14:05:00'), user: mockUsers[0] },
  // Project 003
  { projectId: 'project_003', userId: 'user_003', role: 'owner', addedAt: new Date('2025-11-25T14:30:00'), user: mockUsers[2] },
  { projectId: 'project_003', userId: 'user_004', role: 'participant', addedAt: new Date('2025-11-25T14:40:00'), user: mockUsers[3] },
  // Project 004
  { projectId: 'project_004', userId: 'user_001', role: 'owner', addedAt: new Date('2025-11-28T10:00:00'), user: mockUsers[0] },
  { projectId: 'project_004', userId: 'user_004', role: 'participant', addedAt: new Date('2025-11-28T10:05:00'), user: mockUsers[3] },
];

// ============================================================================
// Tasks
// ============================================================================

export const mockTasks: Task[] = [
  // Project 001
  {
    id: 'task_001', // upcoming, future
    projectId: 'project_001',
    creatorId: 'user_001',
    title: 'Design new banner',
    description: 'Hero and retargeting variants.',
    type: 'one_off',
    recurrencePattern: undefined,
    dueDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000), // 4 days from today
    createdAt: getHoursAgo(2),
    updatedAt: getHoursAgo(2),
  },
  {
    id: 'task_002', // due today active
    projectId: 'project_001',
    creatorId: 'user_001',
    title: 'Write campaign copy',
    description: 'Write the copy for the email campaign.',
    type: 'habit',
    recurrencePattern: 'daily',
    dueDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
    createdAt: getHoursAgo(5),
    updatedAt: getHoursAgo(1),
  },
  {
    id: 'task_003', // past, archived for some, completed for creator
    projectId: 'project_001',
    creatorId: 'user_002',
    title: 'Review competitor analysis',
    description: 'Flag top three offers.',
    type: 'one_off',
    recurrencePattern: undefined,
    dueDate: yesterday,
    createdAt: getDaysAgo(2),
    updatedAt: getHoursAgo(3),
  },
  {
    id: 'task_004', // recovered by current user
    projectId: 'project_001',
    creatorId: 'user_003',
    title: 'QA UTM tagging',
    description: 'Validate UTMs across journey.',
    type: 'one_off',
    recurrencePattern: undefined,
    dueDate: today,
    createdAt: getHoursAgo(4),
    updatedAt: getHoursAgo(3),
  },
  // Project 002
  {
    id: 'task_005', // upcoming tomorrow
    projectId: 'project_002',
    creatorId: 'user_002',
    title: 'Finalize launch deck',
    description: 'Add pricing slide',
    type: 'one_off',
    recurrencePattern: undefined,
    dueDate: yesterday,
    createdAt: getDaysAgo(3),
    updatedAt: getDaysAgo(1),
  },
  {
    id: 'task_006', // recovered but not completed (other user archived)
    projectId: 'project_002',
    creatorId: 'user_001',
    title: 'Record demo video',
    description: '2 min loom, include CTA',
    type: 'one_off',
    recurrencePattern: undefined,
    dueDate: getDaysAgo(2),
    createdAt: getDaysAgo(3),
    updatedAt: getHoursAgo(2),
  },
  // Project 004 (habits mix)
  {
    id: 'task_009', // habit today active
    projectId: 'project_004',
    creatorId: 'user_001',
    title: 'Morning workout',
    description: '30 minutes cardio/strength.',
    type: 'habit',
    recurrencePattern: 'daily',
    dueDate: today,
    createdAt: getDaysAgo(5),
    updatedAt: getHoursAgo(1),
  },
  {
    id: 'task_010', // habit future
    projectId: 'project_004',
    creatorId: 'user_001',
    title: 'Evening meditation',
    description: '10 minutes mindfulness.',
    type: 'habit',
    recurrencePattern: 'daily',
    dueDate: today,
    createdAt: getDaysAgo(4),
    updatedAt: getHoursAgo(6),
  },
];

// ============================================================================
// Task Status Entities (Per-user task status)
// ============================================================================

export const mockTaskStatuses: TaskStatusEntity[] = [
  // Task 001: Initiated - Alice (creator) can complete, Bob needs to accept
  {
    id: 'status_001',
    taskId: 'task_001',
    userId: 'user_001',
    status: 'active',
    dueDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
    createdAt: getHoursAgo(2),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'none',
    updatedAt: getHoursAgo(2),
  },
  {
    id: 'status_002',
    taskId: 'task_001',
    userId: 'user_002',
    status: 'active',
    dueDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
    createdAt: getHoursAgo(2),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'none',
    updatedAt: getHoursAgo(2),
  },
  {
    id: 'status_002b',
    taskId: 'task_001',
    userId: 'user_003',
    status: 'active',
    dueDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
    createdAt: getHoursAgo(2),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'none',
    updatedAt: getHoursAgo(2),
  },
  // Task 002: In progress - all participants
  {
    id: 'status_003',
    taskId: 'task_002',
    userId: 'user_001',
    status: 'active',
    dueDate: tomorrow,
    createdAt: getHoursAgo(5),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'none',
    updatedAt: getHoursAgo(1),
  },
  {
    id: 'status_004',
    taskId: 'task_002',
    userId: 'user_002',
    status: 'active',
    dueDate: tomorrow,
    createdAt: getHoursAgo(5),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'none',
    updatedAt: getHoursAgo(4),
  },
  {
    id: 'status_004b',
    taskId: 'task_002',
    userId: 'user_003',
    status: 'active',
    dueDate: tomorrow,
    createdAt: getHoursAgo(5),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'none',
    updatedAt: getHoursAgo(4),
  },
  // Task 003: Completed - on time (green ring)
  {
    id: 'status_005',
    taskId: 'task_003',
    userId: 'user_002',
    status: 'completed',
    dueDate: yesterday,
    createdAt: getDaysAgo(2),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'green',
    updatedAt: getHoursAgo(3),
  },
  {
    id: 'status_006',
    taskId: 'task_003',
    userId: 'user_001',
    status: 'completed',
    dueDate: yesterday,
    createdAt: getDaysAgo(2),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'green',
    updatedAt: getHoursAgo(3),
  },
  // Task 004: Active task - all project participants (project_003: user_003 owner, user_004 participant)
  {
    id: 'status_007',
    taskId: 'task_004',
    userId: 'user_003',
    status: 'active',
    dueDate: today,
    createdAt: getHoursAgo(4),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'none',
    updatedAt: getHoursAgo(4),
  },
  {
    id: 'status_008',
    taskId: 'task_004',
    userId: 'user_004',
    status: 'active',
    dueDate: today,
    createdAt: getHoursAgo(4),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'none',
    updatedAt: getHoursAgo(4),
  },
  // Task 005: Expired - can be recovered
  {
    id: 'status_009',
    taskId: 'task_005',
    userId: 'user_002',
    status: 'active',
    dueDate: yesterday,
    createdAt: getDaysAgo(3),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'none',
    updatedAt: getDaysAgo(1),
  },
  {
    id: 'status_010',
    taskId: 'task_005',
    userId: 'user_001',
    status: 'archived',
    dueDate: yesterday,
    createdAt: getDaysAgo(3),
    archivedAt: getDaysAgo(1),
    recoveredAt: undefined,
    ringColor: 'red',
    updatedAt: getDaysAgo(1),
  },
  {
    id: 'status_010b',
    taskId: 'task_005',
    userId: 'user_003',
    status: 'archived',
    dueDate: yesterday,
    createdAt: getDaysAgo(3),
    archivedAt: getDaysAgo(1),
    recoveredAt: undefined,
    ringColor: 'red',
    updatedAt: getDaysAgo(1),
  },
  // Task 006: Recovered task - yellow ring, half XP (USE CASE: Recovering an Expired Task)
  // project_002: user_002 (owner), user_001 (manager)
  {
    id: 'status_011',
    taskId: 'task_006',
    userId: 'user_001',
    status: 'active',
    dueDate: getDaysAgo(2),
    createdAt: getDaysAgo(3),
    archivedAt: getDaysAgo(1),
    recoveredAt: getHoursAgo(2),
    ringColor: 'yellow',
    updatedAt: getHoursAgo(2),
  },
  {
    id: 'status_011b',
    taskId: 'task_006',
    userId: 'user_002',
    status: 'active',
    dueDate: getDaysAgo(2),
    createdAt: getDaysAgo(3),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'none',
    updatedAt: getDaysAgo(3),
  },
  // Task 007: Completed habit - on time
  {
    id: 'status_012',
    taskId: 'task_007',
    userId: 'user_001',
    status: 'completed',
    dueDate: today,
    createdAt: getDaysAgo(5),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'green',
    updatedAt: getHoursAgo(1),
  },
  {
    id: 'status_013',
    taskId: 'task_007',
    userId: 'user_004',
    status: 'completed',
    dueDate: today,
    createdAt: getDaysAgo(5),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'green',
    updatedAt: getHoursAgo(1),
  },
  // Task 008: In progress habit
  {
    id: 'status_014',
    taskId: 'task_008',
    userId: 'user_001',
    status: 'active',
    dueDate: today,
    createdAt: getDaysAgo(4),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'none',
    updatedAt: getHoursAgo(6),
  },
  {
    id: 'status_015',
    taskId: 'task_008',
    userId: 'user_004',
    status: 'active',
    dueDate: today,
    createdAt: getDaysAgo(4),
    archivedAt: undefined,
    recoveredAt: undefined,
    ringColor: 'none',
    updatedAt: getHoursAgo(6),
  },
];

mockTasks.forEach(task => {
  task.taskStatus = mockTaskStatuses.filter(ts => ts.taskId === task.id);
});

// ============================================================================
// Completion Logs
// ============================================================================

export const mockCompletionLogs: CompletionLog[] = [
  // Completed task past
  {
    id: 'cl_003_owner',
    userId: 'user_002',
    taskId: 'task_003',
    completedAt: getHoursAgo(3),
    difficultyRating: 4,
    recoveredCompletion: false,
    penaltyApplied: false,
    xpEarned: 400, // 4 difficulty * 100 base
    createdAt: getHoursAgo(3),
  },
  {
    id: 'completion_log_002',
    userId: 'user_001',
    taskId: 'task_003',
    completedAt: getHoursAgo(3),
    difficultyRating: 4,
    recoveredCompletion: false,
    penaltyApplied: false,
    xpEarned: 400,
    createdAt: getDaysAgo(1),
  },
  // Completed today
  {
    id: 'cl_007_owner',
    userId: 'user_003',
    taskId: 'task_007',
    completedAt: getHoursAgo(1),
    difficultyRating: 3,
    recoveredCompletion: false,
    penaltyApplied: false,
    xpEarned: 300,
    createdAt: getHoursAgo(1),
  },
  {
    id: 'completion_log_004',
    userId: 'user_004',
    taskId: 'task_007',
    completedAt: getHoursAgo(1),
    difficultyRating: 3,
    recoveredCompletion: false,
    penaltyApplied: false,
    xpEarned: 300,
    createdAt: getHoursAgo(1),
  },
  // Historical completions for streak calculation
  {
    id: 'cl_009_yesterday',
    userId: 'user_001',
    taskId: 'task_009',
    completedAt: getDaysAgo(1),
    difficultyRating: 3,
    recoveredCompletion: false,
    penaltyApplied: false,
    xpEarned: 300,
    createdAt: getDaysAgo(1),
  },
  {
    id: 'completion_log_006',
    userId: 'user_001',
    taskId: 'task_007',
    completedAt: getDaysAgo(2),
    difficultyRating: 3,
    recoveredCompletion: false,
    penaltyApplied: false,
    xpEarned: 300,
    createdAt: getDaysAgo(2),
  },
  {
    id: 'completion_log_007',
    userId: 'user_001',
    taskId: 'task_007',
    completedAt: getDaysAgo(3),
    difficultyRating: 3,
    recoveredCompletion: false,
    penaltyApplied: false,
    xpEarned: 300,
    createdAt: getDaysAgo(3),
  },
  {
    id: 'completion_log_008',
    userId: 'user_001',
    taskId: 'task_007',
    completedAt: getDaysAgo(4),
    difficultyRating: 3,
    recoveredCompletion: false,
    penaltyApplied: false,
    xpEarned: 300,
    createdAt: getDaysAgo(4),
  },
];

// ============================================================================
// Notifications
// ============================================================================

export const mockNotifications: Notification[] = [
  // Task created notification
  {
    id: 'notification_001',
    userId: 'user_002',
    type: 'task_created',
    message: 'Alice Johnson created "Design new banner" in Marketing Campaign 2025',
    taskId: 'task_001',
    projectId: 'project_001',
    createdAt: getHoursAgo(2),
    isRead: false,
    emailSent: true,
  },
  // Task completed notification
  {
    id: 'notification_003',
    userId: 'user_001',
    type: 'task_completed',
    message: 'Bob Smith completed "Research market trends"',
    taskId: 'task_003',
    projectId: 'project_002',
    createdAt: getHoursAgo(3),
    isRead: false,
    emailSent: true,
  },
  // Task deleted notification
  {
    id: 'notification_004',
    userId: 'user_003',
    type: 'task_deleted',
    message: 'Alice Johnson deleted "Draft website layout"',
    taskId: 'task_004',
    projectId: 'project_003',
    createdAt: getHoursAgo(3),
    isRead: true,
    emailSent: true,
  },
  // Task recovered notification
  {
    id: 'notification_005',
    userId: 'user_002',
    type: 'task_recovered',
    message: 'Alice Johnson recovered "Prepare launch presentation"',
    taskId: 'task_006',
    projectId: 'project_002',
    createdAt: getHoursAgo(2),
    isRead: false,
    emailSent: false,
  },
  // Project joined notification
  {
    id: 'notification_006',
    userId: 'user_003',
    type: 'project_joined',
    message: 'You were added to "Marketing Campaign 2025"',
    taskId: undefined,
    projectId: 'project_001',
    createdAt: getDaysAgo(15),
    isRead: true,
    emailSent: true,
  },
  // Role changed notification
  {
    id: 'notification_007',
    userId: 'user_002',
    type: 'role_changed',
    message: 'Your role in "Marketing Campaign 2025" was changed to manager',
    taskId: undefined,
    projectId: 'project_001',
    createdAt: getDaysAgo(10),
    isRead: true,
    emailSent: true,
  },
  // Participant removed notification
  {
    id: 'notification_008',
    userId: 'user_004',
    type: 'participant_removed',
    message: 'You were removed from "Website Redesign"',
    taskId: undefined,
    projectId: 'project_003',
    createdAt: getDaysAgo(1),
    isRead: false,
    emailSent: true,
  },
  // Streak reminder notification
  {
    id: 'notification_009',
    userId: 'user_001',
    type: 'streak_reminder',
    message: 'Complete your tasks today to maintain your 5-day streak!',
    taskId: undefined,
    projectId: undefined,
    createdAt: getHoursAgo(1),
    isRead: true,
    emailSent: false,
  },
  // Task overdue notification
  {
    id: 'notification_010',
    userId: 'user_001',
    type: 'task_overdue',
    message: '"Review competitor analysis" is now overdue',
    taskId: 'task_005',
    projectId: 'project_001',
    createdAt: getDaysAgo(1),
    isRead: false,
    emailSent: true,
  },
];

// ============================================================================
// Task Recurrence (for habit tasks)
// ============================================================================

export const mockTaskRecurrences: TaskRecurrence[] = [
  { id: 'rec_008', taskId: 'task_008', recurrencePattern: 'Daily', recurrenceInterval: 1, nextOccurrence: tomorrow, endOfRecurrence: new Date('2025-12-31T23:59:59') },
  { id: 'rec_009', taskId: 'task_009', recurrencePattern: 'Daily', recurrenceInterval: 1, nextOccurrence: tomorrow, endOfRecurrence: new Date('2025-12-31T23:59:59') },
  { id: 'rec_010', taskId: 'task_010', recurrencePattern: 'Daily', recurrenceInterval: 1, nextOccurrence: tomorrow, endOfRecurrence: new Date('2025-12-31T23:59:59') },
];

// Populate recurrence in tasks
mockTasks.forEach(task => {
  if (task.type === 'habit' && task.recurrencePattern) {
    task.recurrence = mockTaskRecurrences.find(r => r.taskId === task.id);
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

export const getUserById = (id: string): User | undefined => {
  return mockUsers.find(user => user.id === id);
};

export const getProjectById = (id: string): Project | undefined => {
  return mockProjects.find(project => project.id === id);
};

export const getTaskById = (id: string): Task | undefined => {
  return mockTasks.find(task => task.id === id);
};

export const getTaskStatusByTaskAndUser = (taskId: string, userId: string): TaskStatusEntity | undefined => {
  return mockTaskStatuses.find(ts => ts.taskId === taskId && ts.userId === userId);
};

/**
 * Map database status to UI-friendly status
 */
// Re-export from taskUtils for backward compatibility
export { mapTaskStatusForUI } from './taskUtils';

/**
 * Get tasks for today - filters by dueDate matching today
 */
export const getTodayTasks = (userId?: string): Task[] => {
  return mockTasks.filter(task => {
    const dueDate = new Date(task.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const isToday = dueDate.getTime() === today.getTime();
    
    if (!isToday) return false;
    
    // If userId provided, filter to tasks visible to that user
    if (userId) {
      const isCreator = task.creatorId === userId;
      const hasStatus = task.taskStatus?.some(ts => ts.userId === userId);
      return isCreator || hasStatus;
    }
    
    return true;
  });
};

/**
 * Get user's tasks
 */
export const getUserTasks = (userId: string): Task[] => {
  return mockTasks.filter(
    task => task.creatorId === userId || task.taskStatus?.some(ts => ts.userId === userId)
  );
};

/**
 * Get project tasks
 */
export const getProjectTasks = (projectId: string): Task[] => {
  return mockTasks.filter(task => task.projectId === projectId);
};

/**
 * Get archived tasks for a user
 */
export const getArchivedTasks = (userId: string): Task[] => {
  return mockTasks.filter(task => {
    const userStatus = task.taskStatus?.find(ts => ts.userId === userId);
    return userStatus?.status === 'archived';
  });
};


