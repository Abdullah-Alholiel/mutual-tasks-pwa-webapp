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
  TaskStatusUserStatus,
  TimingStatus,
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
    dueDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
    createdAt: getHoursAgo(12),
    updatedAt: getHoursAgo(12),
  },
  {
    id: 'task_002', // due today active
    projectId: 'project_001',
    creatorId: 'user_001',
    title: 'Draft email copy',
    description: 'Two subject lines, one CTA.',
    type: 'one_off',
    dueDate: today,
    createdAt: getHoursAgo(8),
    updatedAt: getHoursAgo(2),
  },
  {
    id: 'task_003', // past, archived for some, completed for creator
    projectId: 'project_001',
    creatorId: 'user_002',
    title: 'Review competitor analysis',
    description: 'Flag top three offers.',
    type: 'one_off',
    dueDate: getYesterday(),
    createdAt: getDaysAgo(3),
    updatedAt: getDaysAgo(1),
  },
  {
    id: 'task_004', // recovered by current user
    projectId: 'project_001',
    creatorId: 'user_003',
    title: 'QA UTM tagging',
    description: 'Validate UTMs across journey.',
    type: 'one_off',
    dueDate: getDaysAgo(2),
    createdAt: getDaysAgo(4),
    updatedAt: getHoursAgo(1),
  },
  // Project 002
  {
    id: 'task_005', // upcoming tomorrow
    projectId: 'project_002',
    creatorId: 'user_002',
    title: 'Finalize launch deck',
    description: 'Add pricing slide',
    type: 'one_off',
    dueDate: tomorrow,
    createdAt: getHoursAgo(6),
    updatedAt: getHoursAgo(6),
  },
  {
    id: 'task_006', // recovered but not completed (other user archived)
    projectId: 'project_002',
    creatorId: 'user_001',
    title: 'Record demo video',
    description: '2 min loom, include CTA',
    type: 'one_off',
    dueDate: getDaysAgo(2),
    createdAt: getDaysAgo(4),
    updatedAt: getHoursAgo(3),
  },
  // Project 003
  {
    id: 'task_007', // completed today by owner
    projectId: 'project_003',
    creatorId: 'user_003',
    title: 'Wireframe hero',
    description: 'Mobile + desktop',
    type: 'one_off',
    dueDate: today,
    createdAt: getDaysAgo(2),
    updatedAt: getHoursAgo(1),
  },
  {
    id: 'task_008', // upcoming habit
    projectId: 'project_003',
    creatorId: 'user_003',
    title: 'Daily accessibility sweep',
    description: 'Lighthouse + axe',
    type: 'habit',
    recurrencePattern: 'Daily',
    dueDate: tomorrow,
    createdAt: getDaysAgo(5),
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
    recurrencePattern: 'Daily',
    dueDate: today,
    createdAt: getDaysAgo(10),
    updatedAt: getHoursAgo(1),
  },
  {
    id: 'task_010', // habit future
    projectId: 'project_004',
    creatorId: 'user_001',
    title: 'Evening meditation',
    description: '10 minutes mindfulness.',
    type: 'habit',
    recurrencePattern: 'Daily',
    dueDate: tomorrow,
    createdAt: getDaysAgo(10),
    updatedAt: getHoursAgo(1),
  },
];

// ============================================================================
// Task Status Entities (Per-user task status)
// ============================================================================

export const mockTaskStatuses: TaskStatusEntity[] = [
  // task_001 upcoming future
  { id: 'ts_001_a', taskId: 'task_001', userId: 'user_001', status: 'Upcoming', effectiveDueDate: mockTasks[0].dueDate, createdAt: getHoursAgo(12), updatedAt: getHoursAgo(12) },
  { id: 'ts_001_b', taskId: 'task_001', userId: 'user_002', status: 'Upcoming', effectiveDueDate: mockTasks[0].dueDate, createdAt: getHoursAgo(12), updatedAt: getHoursAgo(12) },
  // task_002 active today
  { id: 'ts_002_a', taskId: 'task_002', userId: 'user_001', status: 'Active', effectiveDueDate: today, createdAt: getHoursAgo(8), updatedAt: getHoursAgo(2) },
  { id: 'ts_002_b', taskId: 'task_002', userId: 'user_002', status: 'Active', effectiveDueDate: today, createdAt: getHoursAgo(8), updatedAt: getHoursAgo(2) },
  // task_003 past: creator completed, others archived
  { id: 'ts_003_a', taskId: 'task_003', userId: 'user_002', status: 'Completed', effectiveDueDate: mockTasks[2].dueDate, ringColor: 'green', timingStatus: 'on_time', createdAt: getDaysAgo(3), updatedAt: getDaysAgo(1) },
  { id: 'ts_003_b', taskId: 'task_003', userId: 'user_001', status: 'Archived', effectiveDueDate: mockTasks[2].dueDate, archivedAt: getDaysAgo(1), ringColor: 'red', timingStatus: 'late', createdAt: getDaysAgo(3), updatedAt: getDaysAgo(1) },
  { id: 'ts_003_c', taskId: 'task_003', userId: 'user_003', status: 'Archived', effectiveDueDate: mockTasks[2].dueDate, archivedAt: getDaysAgo(1), ringColor: 'red', timingStatus: 'late', createdAt: getDaysAgo(3), updatedAt: getDaysAgo(1) },
  // task_004 recovered by user_001, archived for others
  { id: 'ts_004_a', taskId: 'task_004', userId: 'user_001', status: 'Recovered', effectiveDueDate: mockTasks[3].dueDate, recoveredAt: getHoursAgo(1), archivedAt: getDaysAgo(1), ringColor: 'yellow', timingStatus: 'late', createdAt: getDaysAgo(4), updatedAt: getHoursAgo(1) },
  { id: 'ts_004_b', taskId: 'task_004', userId: 'user_003', status: 'Archived', effectiveDueDate: mockTasks[3].dueDate, archivedAt: getDaysAgo(1), ringColor: 'red', timingStatus: 'late', createdAt: getDaysAgo(4), updatedAt: getDaysAgo(1) },
  // task_005 upcoming tomorrow (project_002)
  { id: 'ts_005_a', taskId: 'task_005', userId: 'user_002', status: 'Upcoming', effectiveDueDate: mockTasks[4].dueDate, ringColor: 'none', timingStatus: 'on_time', createdAt: getHoursAgo(6), updatedAt: getHoursAgo(6) },
  { id: 'ts_005_b', taskId: 'task_005', userId: 'user_001', status: 'Upcoming', effectiveDueDate: mockTasks[4].dueDate, ringColor: 'none', timingStatus: 'on_time', createdAt: getHoursAgo(6), updatedAt: getHoursAgo(6) },
  // task_006 recovered vs archived split
  { id: 'ts_006_a', taskId: 'task_006', userId: 'user_001', status: 'Recovered', effectiveDueDate: mockTasks[5].dueDate, recoveredAt: getHoursAgo(3), archivedAt: getDaysAgo(1), ringColor: 'yellow', timingStatus: 'late', createdAt: getDaysAgo(4), updatedAt: getHoursAgo(3) },
  { id: 'ts_006_b', taskId: 'task_006', userId: 'user_002', status: 'Archived', effectiveDueDate: mockTasks[5].dueDate, archivedAt: getDaysAgo(1), ringColor: 'red', timingStatus: 'late', createdAt: getDaysAgo(4), updatedAt: getDaysAgo(1) },
  // task_007 completed today by owner
  { id: 'ts_007_a', taskId: 'task_007', userId: 'user_003', status: 'Completed', effectiveDueDate: mockTasks[6].dueDate, ringColor: 'green', timingStatus: 'on_time', createdAt: getDaysAgo(2), updatedAt: getHoursAgo(1) },
  { id: 'ts_007_b', taskId: 'task_007', userId: 'user_004', status: 'Active', effectiveDueDate: mockTasks[6].dueDate, ringColor: 'none', timingStatus: 'on_time', createdAt: getDaysAgo(2), updatedAt: getHoursAgo(1) },
  // task_008 habit upcoming
  { id: 'ts_008_a', taskId: 'task_008', userId: 'user_003', status: 'Upcoming', effectiveDueDate: mockTasks[7].dueDate, ringColor: 'none', timingStatus: 'on_time', createdAt: getDaysAgo(5), updatedAt: getHoursAgo(2) },
  { id: 'ts_008_b', taskId: 'task_008', userId: 'user_004', status: 'Upcoming', effectiveDueDate: mockTasks[7].dueDate, ringColor: 'none', timingStatus: 'on_time', createdAt: getDaysAgo(5), updatedAt: getHoursAgo(2) },
  // task_009 habit today active
  { id: 'ts_009_a', taskId: 'task_009', userId: 'user_001', status: 'Active', effectiveDueDate: mockTasks[8].dueDate, ringColor: 'none', timingStatus: 'on_time', createdAt: getDaysAgo(10), updatedAt: getHoursAgo(1) },
  { id: 'ts_009_b', taskId: 'task_009', userId: 'user_004', status: 'Active', effectiveDueDate: mockTasks[8].dueDate, ringColor: 'none', timingStatus: 'on_time', createdAt: getDaysAgo(10), updatedAt: getHoursAgo(1) },
  // task_010 habit future
  { id: 'ts_010_a', taskId: 'task_010', userId: 'user_001', status: 'Upcoming', effectiveDueDate: mockTasks[9].dueDate, ringColor: 'none', timingStatus: 'on_time', createdAt: getDaysAgo(10), updatedAt: getHoursAgo(1) },
  { id: 'ts_010_b', taskId: 'task_010', userId: 'user_004', status: 'Upcoming', effectiveDueDate: mockTasks[9].dueDate, ringColor: 'none', timingStatus: 'on_time', createdAt: getDaysAgo(10), updatedAt: getHoursAgo(1) },
];

mockTasks.forEach(task => {
  task.taskStatuses = mockTaskStatuses.filter(ts => ts.taskId === task.id);
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
    completedAt: getDaysAgo(1),
    difficultyRating: 4,
    timingStatus: 'on_time',
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
    timingStatus: 'on_time',
    recoveredCompletion: false,
    penaltyApplied: false,
    xpEarned: 300,
    createdAt: getHoursAgo(1),
  },
  // Historical streak sample
  {
    id: 'cl_009_yesterday',
    userId: 'user_001',
    taskId: 'task_009',
    completedAt: getDaysAgo(1),
    difficultyRating: 3,
    timingStatus: 'on_time',
    recoveredCompletion: false,
    penaltyApplied: false,
    xpEarned: 300,
    createdAt: getDaysAgo(1),
  },
];

// ============================================================================
// Notifications
// ============================================================================

export const mockNotifications: Notification[] = [
  // Task initiated notification
  {
    id: 'notification_001',
    userId: 'user_002',
    type: 'task_initiated',
    message: 'Alice Johnson initiated "Design new banner" in Marketing Campaign 2025',
    taskId: 'task_001',
    projectId: 'project_001',
    createdAt: getHoursAgo(2),
    isRead: false,
    emailSent: true,
  },
  // Task accepted notification
  {
    id: 'notification_002',
    userId: 'user_001',
    type: 'task_accepted',
    message: 'Bob Smith accepted "Write campaign copy"',
    taskId: 'task_002',
    projectId: 'project_001',
    createdAt: getHoursAgo(4),
    isRead: false,
    emailSent: false,
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
  // Task declined notification
  {
    id: 'notification_004',
    userId: 'user_003',
    type: 'task_declined',
    message: 'Alice Johnson declined "Draft website layout"',
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
      const hasStatus = task.taskStatuses?.some(ts => ts.userId === userId);
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
    task => task.creatorId === userId || task.taskStatuses?.some(ts => ts.userId === userId)
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
    const userStatus = task.taskStatuses?.find(ts => ts.userId === userId);
    return userStatus?.status === 'Archived';
  });
};

/**
 * Get archived tasks that can be recovered
 */
export const getExpiredTasks = (userId: string): Task[] => {
  return mockTasks.filter(task => {
    // General task status only includes 'active' and 'upcoming'
    // Check user's task status instead
    const userStatus = task.taskStatuses?.find(ts => ts.userId === userId);
    return userStatus && (userStatus.status === 'Archived' || userStatus.archivedAt);
  });
};
