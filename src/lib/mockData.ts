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
  TaskAssignment,
  AssignmentStatus,
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
    description: 'A comprehensive project for managing the marketing campaign for 2025 Q1.',
    icon: '📊',
    color: '#FF5733',
    ownerId: 'user_001',
    isPublic: true,
    totalTasks: 20,
    createdAt: new Date('2025-11-15T13:00:00'),
    updatedAt: new Date('2025-12-01T13:00:00'),
    participants: [mockUsers[0], mockUsers[1], mockUsers[2]],
    completedTasks: 12,
    progress: 0.6,
  },
  {
    id: 'project_002',
    name: 'Product Launch 2025',
    description: 'Planning and executing the launch of the new product line in 2025.',
    icon: '🚀',
    color: '#4CAF50',
    ownerId: 'user_002',
    isPublic: false,
    totalTasks: 15,
    createdAt: new Date('2025-11-20T14:00:00'),
    updatedAt: new Date('2025-12-01T14:00:00'),
    participants: [mockUsers[1], mockUsers[0]],
    completedTasks: 8,
    progress: 0.53,
  },
  {
    id: 'project_003',
    name: 'Website Redesign',
    description: 'A project to redesign the company website with modern UI/UX.',
    icon: '🎨',
    color: '#3F51B5',
    ownerId: 'user_003',
    isPublic: true,
    totalTasks: 10,
    createdAt: new Date('2025-11-25T14:30:00'),
    updatedAt: new Date('2025-12-01T14:30:00'),
    participants: [mockUsers[2], mockUsers[3]], // Removed user_001 so it shows as public
    completedTasks: 3,
    progress: 0.3,
  },
  {
    id: 'project_005',
    name: 'Open Source Contribution',
    description: 'A public project for contributing to open source projects together.',
    icon: '🌐',
    color: '#9C27B0',
    ownerId: 'user_002',
    isPublic: true,
    totalTasks: 5,
    createdAt: new Date('2025-11-30T09:00:00'),
    updatedAt: new Date('2025-12-01T09:00:00'),
    participants: [mockUsers[1], mockUsers[2]], // Does not include currentUser (user_001)
    completedTasks: 2,
    progress: 0.4,
  },
  {
    id: 'project_004',
    name: 'Daily Fitness Challenge',
    description: '30-day fitness accountability challenge with daily workouts.',
    icon: '💪',
    color: '#E91E63',
    ownerId: 'user_001',
    isPublic: false,
    totalTasks: 30,
    createdAt: new Date('2025-11-28T10:00:00'),
    updatedAt: new Date('2025-12-01T10:00:00'),
    participants: [mockUsers[0], mockUsers[3]],
    completedTasks: 5,
    progress: 0.17,
  },
];

// ============================================================================
// Project Participants
// ============================================================================

export const mockProjectParticipants: ProjectParticipant[] = [
  // Project 001 - Marketing Campaign (Public)
  {
    projectId: 'project_001',
    userId: 'user_001',
    role: 'owner',
    addedAt: new Date('2025-11-15T13:00:00'),
    removedAt: undefined,
    user: mockUsers[0],
  },
  {
    projectId: 'project_001',
    userId: 'user_002',
    role: 'manager',
    addedAt: new Date('2025-11-15T13:05:00'),
    removedAt: undefined,
    user: mockUsers[1],
  },
  {
    projectId: 'project_001',
    userId: 'user_003',
    role: 'participant',
    addedAt: new Date('2025-11-15T13:10:00'),
    removedAt: undefined,
    user: mockUsers[2],
  },
  // Project 002 - Product Launch (Private)
  {
    projectId: 'project_002',
    userId: 'user_002',
    role: 'owner',
    addedAt: new Date('2025-11-20T14:00:00'),
    removedAt: undefined,
    user: mockUsers[1],
  },
  {
    projectId: 'project_002',
    userId: 'user_001',
    role: 'manager',
    addedAt: new Date('2025-11-20T14:05:00'),
    removedAt: undefined,
    user: mockUsers[0],
  },
  // Project 003 - Website Redesign (Public)
  {
    projectId: 'project_003',
    userId: 'user_003',
    role: 'owner',
    addedAt: new Date('2025-11-25T14:30:00'),
    removedAt: undefined,
    user: mockUsers[2],
  },
  {
    projectId: 'project_003',
    userId: 'user_004',
    role: 'participant',
    addedAt: new Date('2025-11-25T14:40:00'),
    removedAt: undefined,
    user: mockUsers[3],
  },
  // Project 005 - Open Source Contribution (Public)
  {
    projectId: 'project_005',
    userId: 'user_002',
    role: 'owner',
    addedAt: new Date('2025-11-30T09:00:00'),
    removedAt: undefined,
    user: mockUsers[1],
  },
  {
    projectId: 'project_005',
    userId: 'user_003',
    role: 'participant',
    addedAt: new Date('2025-11-30T09:05:00'),
    removedAt: undefined,
    user: mockUsers[2],
  },
  // Project 004 - Daily Fitness (Private)
  {
    projectId: 'project_004',
    userId: 'user_001',
    role: 'owner',
    addedAt: new Date('2025-11-28T10:00:00'),
    removedAt: undefined,
    user: mockUsers[0],
  },
  {
    projectId: 'project_004',
    userId: 'user_004',
    role: 'participant',
    addedAt: new Date('2025-11-28T10:05:00'),
    removedAt: undefined,
    user: mockUsers[3],
  },
];

// ============================================================================
// Tasks
// ============================================================================

export const mockTasks: Task[] = [
  // Task 1: Initiated task - waiting for acceptance (USE CASE: Updating Task Status)
  {
    id: 'task_001',
    projectId: 'project_001',
    creatorId: 'user_001',
    title: 'Design new banner',
    description: 'Create a banner for the upcoming marketing campaign.',
    type: 'one_off',
    recurrencePattern: undefined,
    originalDueDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000), // 4 days from today
    status: 'active',
    initiatedAt: getHoursAgo(2),
    completedAt: undefined,
    createdAt: getHoursAgo(2),
    updatedAt: getHoursAgo(2),
  },
  // Task 2: In progress - accepted by all (USE CASE: Completing a Task)
  {
    id: 'task_002',
    projectId: 'project_001',
    creatorId: 'user_001',
    title: 'Write campaign copy',
    description: 'Write the copy for the email campaign.',
    type: 'habit',
    recurrencePattern: 'daily',
    originalDueDate: new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
    status: 'active',
    initiatedAt: getHoursAgo(5),
    completedAt: undefined,
    createdAt: getHoursAgo(5),
    updatedAt: getHoursAgo(1),
  },
  // Task 3: Completed task - on time (USE CASE: Completing a Task - green ring)
  {
    id: 'task_003',
    projectId: 'project_002',
    creatorId: 'user_002',
    title: 'Research market trends',
    description: 'Conduct research on the latest market trends for product launch.',
    type: 'one_off',
    recurrencePattern: undefined,
    originalDueDate: yesterday,
    status: 'completed',
    initiatedAt: getDaysAgo(2),
    completedAt: getHoursAgo(3),
    createdAt: getDaysAgo(2),
    updatedAt: getHoursAgo(3),
  },
  // Task 4: Declined task - archived with red ring (USE CASE: Updating Task Status - decline)
  {
    id: 'task_004',
    projectId: 'project_003',
    creatorId: 'user_003',
    title: 'Draft website layout',
    description: 'Create the first draft of the new website layout.',
    type: 'one_off',
    recurrencePattern: undefined,
    originalDueDate: today,
    status: 'active',
    initiatedAt: getHoursAgo(4),
    completedAt: undefined,
    createdAt: getHoursAgo(4),
    updatedAt: getHoursAgo(3),
  },
  // Task 5: Archived task - can be recovered (USE CASE: Recovering an Archived Task)
  {
    id: 'task_005',
    projectId: 'project_001',
    creatorId: 'user_002',
    title: 'Review competitor analysis',
    description: 'Review and analyze competitor marketing strategies.',
    type: 'one_off',
    recurrencePattern: undefined,
    originalDueDate: yesterday,
    status: 'archived',
    initiatedAt: getDaysAgo(3),
    completedAt: undefined,
    createdAt: getDaysAgo(3),
    updatedAt: getDaysAgo(1),
  },
  // Task 6: Recovered task - yellow ring, half XP (USE CASE: Recovering an Expired Task)
  {
    id: 'task_006',
    projectId: 'project_002',
    creatorId: 'user_001',
    title: 'Prepare launch presentation',
    description: 'Create presentation slides for product launch.',
    type: 'one_off',
    recurrencePattern: undefined,
    originalDueDate: getDaysAgo(2),
    status: 'active',
    initiatedAt: getDaysAgo(3),
    completedAt: undefined,
    createdAt: getDaysAgo(3),
    updatedAt: getHoursAgo(2),
  },
  // Task 7: Daily habit - completed today (USE CASE: Completing a Task)
  {
    id: 'task_007',
    projectId: 'project_004',
    creatorId: 'user_001',
    title: 'Morning workout',
    description: '30 minutes of cardio or strength training.',
    type: 'habit',
    recurrencePattern: 'daily',
    originalDueDate: today,
    status: 'completed',
    initiatedAt: getDaysAgo(5),
    completedAt: getHoursAgo(1),
    createdAt: getDaysAgo(5),
    updatedAt: getHoursAgo(1),
  },
  // Task 8: Task with recurrence pattern
  {
    id: 'task_008',
    projectId: 'project_004',
    creatorId: 'user_001',
    title: 'Evening meditation',
    description: '10 minutes of mindfulness meditation.',
    type: 'habit',
    recurrencePattern: 'daily',
    originalDueDate: today,
    status: 'active',
    initiatedAt: getDaysAgo(4),
    completedAt: undefined,
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
    effectiveDueDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
    initiatedAt: getHoursAgo(2),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'none',
    createdAt: getHoursAgo(2),
    updatedAt: getHoursAgo(2),
  },
  {
    id: 'status_002',
    taskId: 'task_001',
    userId: 'user_002',
    status: 'active',
    effectiveDueDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
    initiatedAt: getHoursAgo(2),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'none',
    createdAt: getHoursAgo(2),
    updatedAt: getHoursAgo(2),
  },
  {
    id: 'status_002b',
    taskId: 'task_001',
    userId: 'user_003',
    status: 'active',
    effectiveDueDate: new Date(today.getTime() + 4 * 24 * 60 * 60 * 1000),
    initiatedAt: getHoursAgo(2),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'none',
    createdAt: getHoursAgo(2),
    updatedAt: getHoursAgo(2),
  },
  // Task 002: In progress - all participants
  {
    id: 'status_003',
    taskId: 'task_002',
    userId: 'user_001',
    status: 'active',
    effectiveDueDate: tomorrow,
    initiatedAt: getHoursAgo(5),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'none',
    createdAt: getHoursAgo(5),
    updatedAt: getHoursAgo(1),
  },
  {
    id: 'status_004',
    taskId: 'task_002',
    userId: 'user_002',
    status: 'active',
    effectiveDueDate: tomorrow,
    initiatedAt: getHoursAgo(5),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'none',
    createdAt: getHoursAgo(5),
    updatedAt: getHoursAgo(4),
  },
  {
    id: 'status_004b',
    taskId: 'task_002',
    userId: 'user_003',
    status: 'active',
    effectiveDueDate: tomorrow,
    initiatedAt: getHoursAgo(5),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'none',
    createdAt: getHoursAgo(5),
    updatedAt: getHoursAgo(4),
  },
  // Task 003: Completed - on time (green ring)
  {
    id: 'status_005',
    taskId: 'task_003',
    userId: 'user_002',
    status: 'completed',
    effectiveDueDate: yesterday,
    initiatedAt: getDaysAgo(2),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'green',
    createdAt: getDaysAgo(2),
    updatedAt: getHoursAgo(3),
  },
  {
    id: 'status_006',
    taskId: 'task_003',
    userId: 'user_001',
    status: 'completed',
    effectiveDueDate: yesterday,
    initiatedAt: getDaysAgo(2),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'green',
    createdAt: getDaysAgo(2),
    updatedAt: getHoursAgo(3),
  },
  // Task 004: Active task - all project participants (project_003: user_003 owner, user_004 participant)
  {
    id: 'status_007',
    taskId: 'task_004',
    userId: 'user_003',
    status: 'active',
    effectiveDueDate: today,
    initiatedAt: getHoursAgo(4),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'none',
    createdAt: getHoursAgo(4),
    updatedAt: getHoursAgo(4),
  },
  {
    id: 'status_008',
    taskId: 'task_004',
    userId: 'user_004',
    status: 'active',
    effectiveDueDate: today,
    initiatedAt: getHoursAgo(4),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'none',
    createdAt: getHoursAgo(4),
    updatedAt: getHoursAgo(4),
  },
  // Task 005: Expired - can be recovered
  {
    id: 'status_009',
    taskId: 'task_005',
    userId: 'user_002',
    status: 'active',
    effectiveDueDate: yesterday,
    initiatedAt: getDaysAgo(3),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'late',
    ringColor: 'none',
    createdAt: getDaysAgo(3),
    updatedAt: getDaysAgo(1),
  },
  {
    id: 'status_010',
    taskId: 'task_005',
    userId: 'user_001',
    status: 'archived',
    effectiveDueDate: yesterday,
    initiatedAt: getDaysAgo(3),
    archivedAt: getDaysAgo(1),
    recoveredAt: undefined,
    timingStatus: 'late',
    ringColor: 'red',
    createdAt: getDaysAgo(3),
    updatedAt: getDaysAgo(1),
  },
  {
    id: 'status_010b',
    taskId: 'task_005',
    userId: 'user_003',
    status: 'archived',
    effectiveDueDate: yesterday,
    initiatedAt: getDaysAgo(3),
    archivedAt: getDaysAgo(1),
    recoveredAt: undefined,
    timingStatus: 'late',
    ringColor: 'red',
    createdAt: getDaysAgo(3),
    updatedAt: getDaysAgo(1),
  },
  // Task 006: Recovered task - yellow ring, half XP (USE CASE: Recovering an Expired Task)
  // project_002: user_002 (owner), user_001 (manager)
  {
    id: 'status_011',
    taskId: 'task_006',
    userId: 'user_001',
    status: 'active',
    effectiveDueDate: getDaysAgo(2),
    initiatedAt: getDaysAgo(3),
    archivedAt: getDaysAgo(1),
    recoveredAt: getHoursAgo(2),
    timingStatus: 'late',
    ringColor: 'yellow',
    createdAt: getDaysAgo(3),
    updatedAt: getHoursAgo(2),
  },
  {
    id: 'status_011b',
    taskId: 'task_006',
    userId: 'user_002',
    status: 'active',
    effectiveDueDate: getDaysAgo(2),
    initiatedAt: getDaysAgo(3),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'late',
    ringColor: 'none',
    createdAt: getDaysAgo(3),
    updatedAt: getDaysAgo(3),
  },
  // Task 007: Completed habit - on time
  {
    id: 'status_012',
    taskId: 'task_007',
    userId: 'user_001',
    status: 'completed',
    effectiveDueDate: today,
    initiatedAt: getDaysAgo(5),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'green',
    createdAt: getDaysAgo(5),
    updatedAt: getHoursAgo(1),
  },
  {
    id: 'status_013',
    taskId: 'task_007',
    userId: 'user_004',
    status: 'completed',
    effectiveDueDate: today,
    initiatedAt: getDaysAgo(5),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'green',
    createdAt: getDaysAgo(5),
    updatedAt: getHoursAgo(1),
  },
  // Task 008: In progress habit
  {
    id: 'status_014',
    taskId: 'task_008',
    userId: 'user_001',
    status: 'active',
    effectiveDueDate: today,
    initiatedAt: getDaysAgo(4),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'none',
    createdAt: getDaysAgo(4),
    updatedAt: getHoursAgo(6),
  },
  {
    id: 'status_015',
    taskId: 'task_008',
    userId: 'user_004',
    status: 'active',
    effectiveDueDate: today,
    initiatedAt: getDaysAgo(4),
    archivedAt: undefined,
    recoveredAt: undefined,
    timingStatus: 'on_time',
    ringColor: 'none',
    createdAt: getDaysAgo(4),
    updatedAt: getHoursAgo(6),
  },
];

// Populate taskStatuses in tasks
mockTasks.forEach(task => {
  task.taskStatuses = mockTaskStatuses.filter(ts => ts.taskId === task.id);
});

// ============================================================================
// Completion Logs
// ============================================================================

export const mockCompletionLogs: CompletionLog[] = [
  // Task 003: Completed on time - full XP
  {
    id: 'completion_log_001',
    userId: 'user_002',
    taskId: 'task_003',
    completedAt: getHoursAgo(3),
    difficultyRating: 4,
    timingStatus: 'on_time',
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
    timingStatus: 'on_time',
    recoveredCompletion: false,
    penaltyApplied: false,
    xpEarned: 400,
    createdAt: getHoursAgo(3),
  },
  // Task 007: Completed habit on time
  {
    id: 'completion_log_003',
    userId: 'user_001',
    taskId: 'task_007',
    completedAt: getHoursAgo(1),
    difficultyRating: 3,
    timingStatus: 'on_time',
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
    timingStatus: 'on_time',
    recoveredCompletion: false,
    penaltyApplied: false,
    xpEarned: 300,
    createdAt: getHoursAgo(1),
  },
  // Historical completions for streak calculation
  {
    id: 'completion_log_005',
    userId: 'user_001',
    taskId: 'task_007',
    completedAt: getDaysAgo(1),
    difficultyRating: 3,
    timingStatus: 'on_time',
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
    timingStatus: 'on_time',
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
    timingStatus: 'on_time',
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
    timingStatus: 'on_time',
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
  {
    id: 'recurrence_001',
    taskId: 'task_002',
    recurrencePattern: 'daily',
    recurrenceInterval: 1,
    nextOccurrence: tomorrow,
    endOfRecurrence: new Date('2025-12-31T23:59:59'),
  },
  {
    id: 'recurrence_002',
    taskId: 'task_007',
    recurrencePattern: 'daily',
    recurrenceInterval: 1,
    nextOccurrence: tomorrow,
    endOfRecurrence: new Date('2025-12-31T23:59:59'),
  },
  {
    id: 'recurrence_003',
    taskId: 'task_008',
    recurrencePattern: 'daily',
    recurrenceInterval: 1,
    nextOccurrence: tomorrow,
    endOfRecurrence: new Date('2025-12-31T23:59:59'),
  },
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
 * Get tasks for today - filters by originalDueDate matching today
 */
export const getTodayTasks = (userId?: string): Task[] => {
  return mockTasks.filter(task => {
    const dueDate = new Date(task.originalDueDate);
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
    return userStatus?.status === 'archived';
  });
};

/**
 * Get archived tasks that can be recovered
 */
export const getExpiredTasks = (userId: string): Task[] => {
  return mockTasks.filter(task => {
    if (task.status !== 'archived') return false;
    const userStatus = task.taskStatuses?.find(ts => ts.userId === userId);
    return userStatus && userStatus.status === 'archived';
  });
};
