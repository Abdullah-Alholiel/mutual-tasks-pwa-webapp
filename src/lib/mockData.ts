import { User, Project, Task, Notification, CompletionLog, TaskAssignment, AssignmentStatus, TaskTimeProposal, ProjectParticipant } from '@/types';

// Helper to create task assignments with proper timestamps
// Handles all assignment statuses including archived/recovered with their special fields
const createAssignment = (
  taskId: string,
  userId: string,
  status: AssignmentStatus,
  effectiveDueDate: Date,
  timestamp?: Date
): TaskAssignment => {
  const now = timestamp || new Date();
  const assignment: TaskAssignment = {
    id: `${taskId}-${userId}`,
    taskId,
    userId,
    status,
    isRequired: true,
    effectiveDueDate: new Date(effectiveDueDate),
    createdAt: now,
    updatedAt: now
  };
  
  // Add archivedAt for archived assignments
  if (status === 'archived') {
    assignment.archivedAt = now;
  }
  
  return assignment;
};

// ============================================================================
// Mock Data - Structured for Database Foundation
// ============================================================================

// Mock current user
export const currentUser: User = {
  id: '1',
  name: 'Alex Chen',
  handle: '@alexchen',
  email: 'alex@momentum.app',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  timezone: 'America/Los_Angeles',
  stats: {
    userId: '1',
    totalCompletedTasks: 47,
    currentStreak: 12,
    longestStreak: 23,
    score: 152
  }
};

// Mock friends
export const mockUsers: User[] = [
  currentUser,
  {
    id: '2',
    name: 'Jordan Smith',
    handle: '@jordansmith',
    email: 'jordan@momentum.app',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan',
    timezone: 'America/New_York',
    stats: {
      userId: '2',
      totalCompletedTasks: 52,
      currentStreak: 15,
      longestStreak: 28,
      score: 168
    }
  },
  {
    id: '3',
    name: 'Sam Rivera',
    handle: '@samrivera',
    email: 'sam@momentum.app',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sam',
    timezone: 'America/Chicago',
    stats: {
      userId: '3',
      totalCompletedTasks: 38,
      currentStreak: 8,
      longestStreak: 15,
      score: 121
    }
  }
];

// Mock projects (normalized for DB, with participants populated for UI)
// All projects include participantRoles to match the project_participants table structure
// Covers: public/private projects, different roles (owner/manager/participant), various progress states
export const mockProjects: Project[] = [
  {
    id: 'p1',
    name: 'Morning Routine',
    description: 'Start each day with intention and energy',
    ownerId: '1',
    participantIds: ['1', '2'], // Normalized for DB
    totalTasksPlanned: 45,
    isPublic: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    color: 'hsl(199, 89%, 48%)',
    // Populated for UI convenience (simulates JOIN from project_participants)
    participants: [currentUser, mockUsers[1]],
    participantRoles: [
      { projectId: 'p1', userId: '1', role: 'owner' },
      { projectId: 'p1', userId: '2', role: 'participant' }
    ],
    completedTasks: 38,
    progress: 38 / 45
  },
  {
    id: 'p2',
    name: 'Fitness Challenge',
    description: '30-day workout accountability',
    ownerId: '1',
    participantIds: ['1', '2', '3'], // Normalized for DB
    totalTasksPlanned: 60,
    isPublic: true,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
    color: 'hsl(142, 76%, 36%)',
    // Populated for UI convenience (simulates JOIN from project_participants)
    participants: [currentUser, mockUsers[1], mockUsers[2]],
    participantRoles: [
      { projectId: 'p2', userId: '1', role: 'owner' },
      { projectId: 'p2', userId: '2', role: 'manager' },
      { projectId: 'p2', userId: '3', role: 'participant' }
    ],
    completedTasks: 47,
    progress: 47 / 60
  },
  {
    id: 'p3',
    name: 'Learning Together',
    description: 'Study and grow together',
    ownerId: '1',
    participantIds: ['1', '3'], // Normalized for DB
    totalTasksPlanned: 30,
    isPublic: false,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
    color: 'hsl(32, 95%, 58%)',
    // Populated for UI convenience (simulates JOIN from project_participants)
    participants: [currentUser, mockUsers[2]],
    participantRoles: [
      { projectId: 'p3', userId: '1', role: 'owner' },
      { projectId: 'p3', userId: '3', role: 'participant' }
    ],
    completedTasks: 18,
    progress: 18 / 30
  },
  // Additional project for testing: Public project user is not part of
  {
    id: 'p4',
    name: 'Community Garden',
    description: 'Collaborative gardening project',
    ownerId: '2',
    participantIds: ['2', '3'],
    totalTasksPlanned: 20,
    isPublic: true,
    createdAt: new Date('2024-01-20'),
    updatedAt: new Date('2024-01-20'),
    color: 'hsl(142, 76%, 36%)',
    participants: [mockUsers[1], mockUsers[2]],
    participantRoles: [
      { projectId: 'p4', userId: '2', role: 'owner' },
      { projectId: 'p4', userId: '3', role: 'participant' }
    ],
    completedTasks: 12,
    progress: 12 / 20
  }
];

// Mock tasks (using new status system, mapped to UI-friendly statuses)
// Using today's date so tasks appear on Today page
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

const today = getToday();
const yesterday = getYesterday();
const withTime = (date: Date, hours: number): Date => {
  const next = new Date(date);
  next.setHours(hours, 0, 0, 0);
  return next;
};

// Mock tasks - all tasks use assignments array (no assigneeId)
// Each task has assignments for all participants, matching task_assignments table
// This comprehensive set covers all use cases for testing:
// - All task statuses: draft, initiated, scheduled, in_progress, completed, cancelled, expired
// - All assignment statuses: invited, active, declined, completed, missed, archived
// - All time proposal statuses: pending, accepted, rejected, cancelled
// - All difficulty ratings: 1-5
// - Both task types: one_off, habit
// - All recurrence patterns: daily, weekly, custom
export const mockTasks: Task[] = [
  // ===== IN PROGRESS TASKS =====
  {
    id: 't1',
    projectId: 'p1',
    creatorId: '1',
    type: 'habit',
    recurrencePattern: 'daily',
    title: 'Morning meditation',
    description: '10 minutes of mindfulness',
    status: 'in_progress',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: withTime(today, 8),
    difficultyRating: 2,
    createdAt: new Date(yesterday),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t1', '1', 'active', withTime(today, 8)),
      createAssignment('t1', '2', 'active', withTime(today, 8))
    ],
    timeProposals: [],
    completions: {
      '1': { completed: true, completedAt: new Date(), difficultyRating: 2 },
      '2': { completed: false }
    }
  },
  {
    id: 't2',
    projectId: 'p2',
    creatorId: '2',
    type: 'one_off',
    title: '30 min cardio',
    description: 'Running or cycling',
    status: 'in_progress',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: withTime(today, 18),
    difficultyRating: 4,
    createdAt: new Date(yesterday),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t2', '1', 'active', withTime(today, 18)),
      createAssignment('t2', '2', 'active', withTime(today, 18))
    ],
    timeProposals: [],
    completions: {
      '1': { completed: false },
      '2': { completed: true, completedAt: new Date(), difficultyRating: 4 }
    }
  },
  {
    id: 't3',
    projectId: 'p1',
    creatorId: '1',
    type: 'habit',
    recurrencePattern: 'daily',
    title: 'Gratitude journaling',
    description: 'Write 3 things you\'re grateful for',
    status: 'initiated',
    initiatedAt: new Date(),
    dueDate: withTime(today, 9),
    difficultyRating: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t3', '1', 'active', withTime(today, 9)),
      createAssignment('t3', '2', 'invited', withTime(today, 9))
    ],
    timeProposals: [],
    completions: {
      '1': { completed: false },
      '2': { completed: false }
    }
  },
  {
    id: 't4',
    projectId: 'p3',
    creatorId: '3',
    type: 'one_off',
    title: 'Read chapter 5',
    description: 'Atomic Habits by James Clear',
    status: 'initiated',
    initiatedAt: new Date(),
    dueDate: withTime(today, 20),
    difficultyRating: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t4', '3', 'active', withTime(today, 20)),
      createAssignment('t4', '1', 'invited', withTime(today, 20))
    ],
    timeProposals: [],
    completions: {
      '1': { completed: false },
      '3': { completed: false }
    }
  },
  {
    id: 't5',
    projectId: 'p2',
    creatorId: '1',
    type: 'habit',
    recurrencePattern: 'weekly',
    title: 'Yoga session',
    description: '45 minutes of yoga practice',
    status: 'scheduled',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: withTime(today, 7),
    difficultyRating: 4,
    createdAt: new Date(yesterday),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t5', '1', 'active', withTime(today, 7)),
      createAssignment('t5', '3', 'active', withTime(today, 7))
    ],
    timeProposals: [
      {
        id: 'tp-t5-1',
        taskId: 't5',
        proposerId: '3',
        proposedDueDate: withTime(today, 10),
        status: 'pending',
        createdAt: new Date(),
        respondedAt: undefined
      }
    ],
    completions: {
      '1': { completed: false },
      '3': { completed: false }
    }
  },
  {
    id: 't6',
    projectId: 'p1',
    creatorId: '2',
    type: 'habit',
    recurrencePattern: 'daily',
    title: 'Cold shower',
    description: '2 minutes cold exposure',
    status: 'completed',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    completedAt: new Date(),
    dueDate: withTime(today, 6),
    difficultyRating: 5,
    createdAt: new Date(yesterday),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t6', '1', 'completed', withTime(today, 6)),
      createAssignment('t6', '2', 'completed', withTime(today, 6))
    ],
    timeProposals: [],
    completions: {
      '1': { completed: true, completedAt: new Date(), difficultyRating: 5 },
      '2': { completed: true, completedAt: new Date(), difficultyRating: 5 }
    }
  },
  
  // ===== ADDITIONAL USE CASES =====
  
  // Draft task (not yet initiated)
  {
    id: 't7',
    projectId: 'p2',
    creatorId: '1',
    type: 'one_off',
    title: 'Plan weekend trip',
    description: 'Research destinations and book accommodations',
    status: 'draft',
    dueDate: withTime(today, 14),
    difficultyRating: 3,
    createdAt: new Date(yesterday),
    updatedAt: new Date(yesterday),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t7', '1', 'active', withTime(today, 14)),
      createAssignment('t7', '2', 'invited', withTime(today, 14))
    ],
    timeProposals: [],
    completions: {
      '1': { completed: false },
      '2': { completed: false }
    }
  },
  
  // Cancelled task
  {
    id: 't8',
    projectId: 'p1',
    creatorId: '1',
    type: 'one_off',
    title: 'Canceled workout session',
    description: 'Had to cancel due to weather',
    status: 'cancelled',
    initiatedAt: new Date(yesterday),
    dueDate: withTime(yesterday, 18),
    difficultyRating: 4,
    createdAt: new Date(yesterday),
    updatedAt: new Date(yesterday),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t8', '1', 'archived', withTime(yesterday, 18)),
      createAssignment('t8', '2', 'declined', withTime(yesterday, 18))
    ],
    timeProposals: [],
    completions: {
      '1': { completed: false },
      '2': { completed: false }
    }
  },
  
  // Expired task (past due date, not completed)
  {
    id: 't9',
    projectId: 'p3',
    creatorId: '3',
    type: 'one_off',
    title: 'Review project proposal',
    description: 'Review and provide feedback',
    status: 'expired',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: withTime(yesterday, 16),
    difficultyRating: 2,
    createdAt: new Date(yesterday),
    updatedAt: new Date(yesterday),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t9', '3', 'missed', withTime(yesterday, 16)),
      createAssignment('t9', '1', 'missed', withTime(yesterday, 16))
    ],
    timeProposals: [],
    completions: {
      '1': { completed: false },
      '3': { completed: false }
    }
  },
  
  // Task with declined assignment
  {
    id: 't10',
    projectId: 'p2',
    creatorId: '1',
    type: 'one_off',
    title: 'Team meeting prep',
    description: 'Prepare agenda and materials',
    status: 'initiated',
    initiatedAt: new Date(),
    dueDate: withTime(today, 15),
    difficultyRating: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t10', '1', 'active', withTime(today, 15)),
      createAssignment('t10', '3', 'declined', withTime(today, 15))
    ],
    timeProposals: [],
    completions: {
      '1': { completed: false },
      '3': { completed: false }
    }
  },
  
  // Task with archived assignment (user archived it for themselves)
  {
    id: 't11',
    projectId: 'p1',
    creatorId: '2',
    type: 'habit',
    recurrencePattern: 'daily',
    title: 'Evening reading',
    description: 'Read for 30 minutes',
    status: 'in_progress',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: withTime(today, 21),
    difficultyRating: 2,
    createdAt: new Date(yesterday),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t11', '2', 'active', withTime(today, 21)),
      {
        ...createAssignment('t11', '1', 'archived', withTime(today, 21)),
        archivedAt: new Date(yesterday)
      }
    ],
    timeProposals: [],
    completions: {
      '1': { completed: false },
      '2': { completed: false }
    }
  },
  
  // Task with accepted time proposal
  {
    id: 't12',
    projectId: 'p3',
    creatorId: '1',
    type: 'one_off',
    title: 'Code review session',
    description: 'Review pull requests together',
    status: 'scheduled',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: withTime(today, 11), // Updated from original due to accepted proposal
    difficultyRating: 3,
    createdAt: new Date(yesterday),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t12', '1', 'active', withTime(today, 11)),
      createAssignment('t12', '3', 'active', withTime(today, 11))
    ],
    timeProposals: [
      {
        id: 'tp-t12-1',
        taskId: 't12',
        proposerId: '3',
        proposedDueDate: withTime(today, 11),
        status: 'accepted',
        createdAt: new Date(yesterday),
        respondedAt: new Date(yesterday)
      }
    ],
    completions: {
      '1': { completed: false },
      '3': { completed: false }
    }
  },
  
  // Task with rejected time proposal
  {
    id: 't13',
    projectId: 'p2',
    creatorId: '2',
    type: 'one_off',
    title: 'Design feedback',
    description: 'Review new design mockups',
    status: 'scheduled',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: withTime(today, 13), // Original time kept (proposal rejected)
    difficultyRating: 3,
    createdAt: new Date(yesterday),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t13', '2', 'active', withTime(today, 13)),
      createAssignment('t13', '1', 'active', withTime(today, 13))
    ],
    timeProposals: [
      {
        id: 'tp-t13-1',
        taskId: 't13',
        proposerId: '1',
        proposedDueDate: withTime(today, 16),
        status: 'rejected',
        createdAt: new Date(yesterday),
        respondedAt: new Date(yesterday)
      }
    ],
    completions: {
      '1': { completed: false },
      '2': { completed: false }
    }
  },
  
  // Task with cancelled time proposal
  {
    id: 't14',
    projectId: 'p1',
    creatorId: '1',
    type: 'one_off',
    title: 'Grocery shopping',
    description: 'Buy ingredients for dinner party',
    status: 'scheduled',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: withTime(today, 12),
    difficultyRating: 1,
    createdAt: new Date(yesterday),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t14', '1', 'active', withTime(today, 12)),
      createAssignment('t14', '2', 'active', withTime(today, 12))
    ],
    timeProposals: [
      {
        id: 'tp-t14-1',
        taskId: 't14',
        proposerId: '2',
        proposedDueDate: withTime(today, 14),
        status: 'cancelled',
        createdAt: new Date(yesterday),
        respondedAt: new Date(yesterday)
      }
    ],
    completions: {
      '1': { completed: false },
      '2': { completed: false }
    }
  },
  
  // Task with difficulty rating 1 (easiest)
  {
    id: 't15',
    projectId: 'p2',
    creatorId: '1',
    type: 'one_off',
    title: 'Send thank you note',
    description: 'Quick email to team',
    status: 'completed',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    completedAt: new Date(yesterday),
    dueDate: withTime(yesterday, 10),
    difficultyRating: 1,
    createdAt: new Date(yesterday),
    updatedAt: new Date(yesterday),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t15', '1', 'completed', withTime(yesterday, 10)),
      createAssignment('t15', '2', 'completed', withTime(yesterday, 10))
    ],
    timeProposals: [],
    completions: {
      '1': { completed: true, completedAt: new Date(yesterday), difficultyRating: 1 },
      '2': { completed: true, completedAt: new Date(yesterday), difficultyRating: 1 }
    }
  },
  
  // Habit task with custom recurrence pattern
  {
    id: 't16',
    projectId: 'p3',
    creatorId: '1',
    type: 'habit',
    recurrencePattern: 'custom',
    title: 'Weekly study session',
    description: 'Study together every Monday and Wednesday',
    status: 'scheduled',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: withTime(today, 19),
    difficultyRating: 4,
    createdAt: new Date(yesterday),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t16', '1', 'active', withTime(today, 19)),
      createAssignment('t16', '3', 'active', withTime(today, 19))
    ],
    timeProposals: [],
    completions: {
      '1': { completed: false },
      '3': { completed: false }
    }
  },
  
  // Task with recovered assignment (user recovered from archived)
  {
    id: 't17',
    projectId: 'p1',
    creatorId: '2',
    type: 'habit',
    recurrencePattern: 'daily',
    title: 'Daily standup',
    description: 'Quick 15-minute sync',
    status: 'in_progress',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: withTime(today, 9),
    difficultyRating: 2,
    createdAt: new Date(yesterday),
    updatedAt: new Date(),
    isMirrorCompletionVisible: true,
    assignments: [
      createAssignment('t17', '2', 'active', withTime(today, 9)),
      {
        ...createAssignment('t17', '1', 'active', withTime(today, 9)),
        recoveredAt: new Date() // User recovered this task
      }
    ],
    timeProposals: [],
    completions: {
      '1': { completed: false },
      '2': { completed: false }
    }
  }
];

// Mock completion logs (for streak calculation)
// Covers all difficulty ratings (1-5) and various completion scenarios
export const mockCompletionLogs: CompletionLog[] = [
  // Today's completions
  {
    id: 'cl1',
    userId: '1',
    taskId: 't1',
    completedAt: new Date('2024-11-25T07:30:00'),
    difficultyRating: 2
  },
  {
    id: 'cl2',
    userId: '2',
    taskId: 't2',
    completedAt: new Date('2024-11-25T06:00:00'),
    difficultyRating: 4
  },
  {
    id: 'cl3',
    userId: '1',
    taskId: 't6',
    completedAt: new Date('2024-11-25T07:00:00'),
    difficultyRating: 5
  },
  {
    id: 'cl4',
    userId: '2',
    taskId: 't6',
    completedAt: new Date('2024-11-25T06:30:00'),
    difficultyRating: 5
  },
  {
    id: 'cl5',
    userId: '1',
    taskId: 't15',
    completedAt: new Date('2024-11-24T10:00:00'),
    difficultyRating: 1
  },
  {
    id: 'cl6',
    userId: '2',
    taskId: 't15',
    completedAt: new Date('2024-11-24T10:15:00'),
    difficultyRating: 1
  },
  // Historical completions for streak calculation
  {
    id: 'cl7',
    userId: '1',
    taskId: 't-hist-1',
    completedAt: new Date('2024-11-24T08:00:00'),
    difficultyRating: 3
  },
  {
    id: 'cl8',
    userId: '1',
    taskId: 't-hist-2',
    completedAt: new Date('2024-11-23T08:00:00'),
    difficultyRating: 2
  },
  {
    id: 'cl9',
    userId: '2',
    taskId: 't-hist-3',
    completedAt: new Date('2024-11-24T18:00:00'),
    difficultyRating: 4
  }
];

// Mock notifications - using recent dates
const getRecentDate = (hoursAgo: number) => {
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  return date;
};

// Mock notifications - covers all notification types
export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    userId: '1',
    type: 'task_initiated',
    message: 'Jordan initiated "Read chapter 5" in Learning Together',
    taskId: 't4',
    projectId: 'p3',
    isRead: false,
    createdAt: getRecentDate(2) // 2 hours ago
  },
  {
    id: 'n2',
    userId: '1',
    type: 'task_completed',
    message: 'Jordan completed "30 min cardio" in Fitness Challenge',
    taskId: 't2',
    projectId: 'p2',
    isRead: false,
    createdAt: getRecentDate(5) // 5 hours ago
  },
  {
    id: 'n3',
    userId: '1',
    type: 'streak_reminder',
    message: 'Complete your tasks today to maintain your 12-day streak!',
    isRead: true,
    createdAt: getRecentDate(1) // 1 hour ago
  },
  {
    id: 'n4',
    userId: '1',
    type: 'task_accepted',
    message: 'Sam accepted "Weekly study session" in Learning Together',
    taskId: 't16',
    projectId: 'p3',
    isRead: false,
    createdAt: getRecentDate(3) // 3 hours ago
  },
  {
    id: 'n5',
    userId: '1',
    type: 'task_declined',
    message: 'Sam declined "Team meeting prep" in Fitness Challenge',
    taskId: 't10',
    projectId: 'p2',
    isRead: false,
    createdAt: getRecentDate(4) // 4 hours ago
  },
  {
    id: 'n6',
    userId: '1',
    type: 'task_time_proposed',
    message: 'Sam proposed a new time for "Yoga session"',
    taskId: 't5',
    projectId: 'p2',
    isRead: false,
    createdAt: getRecentDate(6) // 6 hours ago
  },
  {
    id: 'n7',
    userId: '1',
    type: 'project_joined',
    message: 'Jordan joined "Fitness Challenge"',
    projectId: 'p2',
    isRead: true,
    createdAt: getRecentDate(12) // 12 hours ago
  },
  {
    id: 'n8',
    userId: '2',
    type: 'task_initiated',
    message: 'Alex initiated "Morning meditation" in Morning Routine',
    taskId: 't1',
    projectId: 'p1',
    isRead: false,
    createdAt: getRecentDate(24) // 24 hours ago
  },
  {
    id: 'n9',
    userId: '3',
    type: 'task_time_proposed',
    message: 'Alex proposed a new time for "Code review session"',
    taskId: 't12',
    projectId: 'p3',
    isRead: false,
    emailSent: true,
    createdAt: getRecentDate(8) // 8 hours ago
  }
];

// Helper function to get user by ID
export const getUserById = (id: string): User | undefined => {
  return mockUsers.find(user => user.id === id);
};

// Helper function to get project by ID
export const getProjectById = (id: string): Project | undefined => {
  return mockProjects.find(project => project.id === id);
};

// Helper function to get task by ID
export const getTaskById = (id: string): Task | undefined => {
  return mockTasks.find(task => task.id === id);
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Map database status to UI-friendly status
 * Converts: pending_acceptance -> pending, initiated -> pending
 */
export const mapTaskStatusForUI = (status: Task['status']): 'pending' | 'accepted' | 'completed' => {
  switch (status) {
    case 'draft':
    case 'initiated':
    case 'cancelled':
    case 'expired':
      return 'pending';
    case 'scheduled':
    case 'in_progress':
      return 'accepted';
    case 'completed':
      return 'completed';
    default:
      return 'pending';
  }
};

/**
 * Populate project participants from participantIds
 * This simulates a JOIN operation that would happen in a real database
 */
export const populateProjectParticipants = (project: Project): Project => {
  if (project.participants) return project; // Already populated
  return {
    ...project,
    participants: project.participantIds
      .map(id => getUserById(id))
      .filter((user): user is User => user !== undefined)
  };
};

/**
 * Get tasks for today - filters by dueDate matching today
 * Also ensures tasks are visible to the user (they're creator or have an assignment)
 * Uses task.assignments array (not assigneeId) to match database schema
 */
export const getTodayTasks = (userId?: string): Task[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return mockTasks.filter(task => {
    // Filter by due date (check effective_due_date from assignments or task dueDate)
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    if (!dueDate) return false;
    
    dueDate.setHours(0, 0, 0, 0);
    const isToday = dueDate.getTime() === today.getTime();
    
    if (!isToday) return false;
    
    // If userId provided, filter to tasks visible to that user
    // User can see task if they're the creator OR have an assignment
    if (userId) {
      const isCreator = task.creatorId === userId;
      const hasAssignment = task.assignments.some(assignment => assignment.userId === userId);
      return isCreator || hasAssignment;
    }
    
    return true;
  });
};

/**
 * Get all tasks for a user
 * User can see tasks where they're the creator OR have an assignment
 * Uses task.assignments array (not assigneeId) to match database schema
 */
export const getUserTasks = (userId: string): Task[] => {
  return mockTasks.filter(
    task => task.creatorId === userId || task.assignments.some(assignment => assignment.userId === userId)
  );
};

// Helper function to get project tasks
export const getProjectTasks = (projectId: string): Task[] => {
  return mockTasks.filter(task => task.projectId === projectId);
};
