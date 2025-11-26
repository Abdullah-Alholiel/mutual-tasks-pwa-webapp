import { User, Project, Task, Notification, CompletionLog } from '@/types';

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
      totalCompletedTasks: 38,
      currentStreak: 8,
      longestStreak: 15,
      score: 121
    }
  }
];

// Mock projects (normalized for DB, with participants populated for UI)
export const mockProjects: Project[] = [
  {
    id: 'p1',
    name: 'Morning Routine',
    description: 'Start each day with intention and energy',
    ownerId: '1',
    participantIds: ['1', '2'],
    totalTasksPlanned: 45,
    isPublic: true,
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-01-15'),
    color: 'hsl(199, 89%, 48%)',
    // Populated for UI convenience
    participants: [currentUser, mockUsers[1]],
    completedTasks: 38,
    progress: 38 / 45
  },
  {
    id: 'p2',
    name: 'Fitness Challenge',
    description: '30-day workout accountability',
    ownerId: '1',
    participantIds: ['1', '2', '3'],
    totalTasksPlanned: 60,
    isPublic: true,
    createdAt: new Date('2024-01-10'),
    updatedAt: new Date('2024-01-10'),
    color: 'hsl(142, 76%, 36%)',
    participants: [currentUser, mockUsers[1], mockUsers[2]],
    completedTasks: 47,
    progress: 47 / 60
  },
  {
    id: 'p3',
    name: 'Learning Together',
    description: 'Study and grow together',
    ownerId: '1',
    participantIds: ['1', '3'],
    totalTasksPlanned: 30,
    isPublic: false,
    createdAt: new Date('2024-02-01'),
    updatedAt: new Date('2024-02-01'),
    color: 'hsl(32, 95%, 58%)',
    participants: [currentUser, mockUsers[2]],
    completedTasks: 18,
    progress: 18 / 30
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

export const mockTasks: Task[] = [
  {
    id: 't1',
    projectId: 'p1',
    creatorId: '1',
    assigneeId: '2',
    type: 'recurring',
    recurrencePattern: 'daily',
    title: 'Morning meditation',
    description: '10 minutes of mindfulness',
    status: 'accepted', // Maps to 'accepted' for UI
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: new Date(today),
    initiatedByUserId: '1',
    isMirrorCompletionVisible: true,
    createdAt: new Date(yesterday), // Legacy support
    completions: {
      '1': { completed: true, completedAt: new Date(), difficultyRating: 2 },
      '2': { completed: false }
    }
  },
  {
    id: 't2',
    projectId: 'p2',
    creatorId: '2',
    assigneeId: '1',
    type: 'one_off',
    title: '30 min cardio',
    description: 'Running or cycling',
    status: 'accepted',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: new Date(today),
    initiatedByUserId: '2',
    isMirrorCompletionVisible: true,
    createdAt: new Date(yesterday),
    completions: {
      '1': { completed: false },
      '2': { completed: true, completedAt: new Date(), difficultyRating: 4 }
    }
  },
  {
    id: 't3',
    projectId: 'p1',
    creatorId: '1',
    assigneeId: '2',
    type: 'recurring',
    recurrencePattern: 'daily',
    title: 'Gratitude journaling',
    description: 'Write 3 things you\'re grateful for',
    status: 'pending_acceptance', // Maps to 'pending' for UI
    initiatedAt: new Date(),
    dueDate: new Date(today),
    initiatedByUserId: '1',
    isMirrorCompletionVisible: true,
    createdAt: new Date(),
    completions: {
      '1': { completed: false },
      '2': { completed: false }
    }
  },
  {
    id: 't4',
    projectId: 'p3',
    creatorId: '3',
    assigneeId: '1',
    type: 'one_off',
    title: 'Read chapter 5',
    description: 'Atomic Habits by James Clear',
    status: 'pending_acceptance',
    initiatedAt: new Date(),
    dueDate: new Date(today),
    initiatedByUserId: '3',
    isMirrorCompletionVisible: true,
    createdAt: new Date(),
    completions: {
      '1': { completed: false },
      '3': { completed: false }
    }
  },
  {
    id: 't5',
    projectId: 'p2',
    creatorId: '1',
    assigneeId: '3',
    type: 'recurring',
    recurrencePattern: 'weekly',
    title: 'Yoga session',
    description: '45 minutes of yoga practice',
    status: 'accepted',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    dueDate: new Date(today),
    initiatedByUserId: '1',
    isMirrorCompletionVisible: true,
    createdAt: new Date(yesterday),
    completions: {
      '1': { completed: false },
      '3': { completed: false }
    }
  },
  {
    id: 't6',
    projectId: 'p1',
    creatorId: '2',
    assigneeId: '1',
    type: 'recurring',
    recurrencePattern: 'daily',
    title: 'Cold shower',
    description: '2 minutes cold exposure',
    status: 'completed',
    initiatedAt: new Date(yesterday),
    acceptedAt: new Date(yesterday),
    completedAt: new Date(),
    dueDate: new Date(today),
    initiatedByUserId: '2',
    isMirrorCompletionVisible: true,
    createdAt: new Date(yesterday),
    completions: {
      '1': { completed: true, completedAt: new Date(), difficultyRating: 5 },
      '2': { completed: true, completedAt: new Date(), difficultyRating: 5 }
    }
  }
];

// Mock completion logs (for streak calculation)
export const mockCompletionLogs: CompletionLog[] = [
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
  }
];

// Mock notifications - using recent dates
const getRecentDate = (hoursAgo: number) => {
  const date = new Date();
  date.setHours(date.getHours() - hoursAgo);
  return date;
};

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
    case 'pending_acceptance':
    case 'initiated':
    case 'draft':
    case 'time_proposed':
      return 'pending';
    case 'accepted':
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
 * Also ensures tasks are visible to the user (they're creator or assignee)
 */
export const getTodayTasks = (userId?: string): Task[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return mockTasks.filter(task => {
    // Filter by due date
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    if (!dueDate) return false;
    
    dueDate.setHours(0, 0, 0, 0);
    const isToday = dueDate.getTime() === today.getTime();
    
    if (!isToday) return false;
    
    // If userId provided, filter to tasks visible to that user
    if (userId) {
      return task.creatorId === userId || task.assigneeId === userId;
    }
    
    return true;
  });
};

// Helper function to get user's tasks
export const getUserTasks = (userId: string): Task[] => {
  return mockTasks.filter(
    task => task.creatorId === userId || task.assigneeId === userId
  );
};

// Helper function to get project tasks
export const getProjectTasks = (projectId: string): Task[] => {
  return mockTasks.filter(task => task.projectId === projectId);
};
