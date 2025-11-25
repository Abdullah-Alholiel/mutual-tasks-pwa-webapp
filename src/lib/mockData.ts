import { User, Project, Task, Notification } from '@/types';

// Mock current user
export const currentUser: User = {
  id: '1',
  name: 'Alex Chen',
  handle: '@alexchen',
  email: 'alex@momentum.app',
  avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  timezone: 'America/Los_Angeles',
  stats: {
    totalCompleted: 47,
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
      totalCompleted: 52,
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
      totalCompleted: 38,
      currentStreak: 8,
      longestStreak: 15,
      score: 121
    }
  }
];

// Mock projects
export const mockProjects: Project[] = [
  {
    id: 'p1',
    name: 'Morning Routine',
    description: 'Start each day with intention and energy',
    participants: [currentUser, mockUsers[1]],
    totalTasksPlanned: 45,
    completedTasks: 38,
    createdAt: new Date('2024-01-15'),
    color: 'hsl(199, 89%, 48%)'
  },
  {
    id: 'p2',
    name: 'Fitness Challenge',
    description: '30-day workout accountability',
    participants: [currentUser, mockUsers[1], mockUsers[2]],
    totalTasksPlanned: 60,
    completedTasks: 47,
    createdAt: new Date('2024-01-10'),
    color: 'hsl(142, 76%, 36%)'
  },
  {
    id: 'p3',
    name: 'Learning Together',
    description: 'Study and grow together',
    participants: [currentUser, mockUsers[2]],
    totalTasksPlanned: 30,
    completedTasks: 18,
    createdAt: new Date('2024-02-01'),
    color: 'hsl(32, 95%, 58%)'
  }
];

// Mock tasks
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
    status: 'accepted',
    createdAt: new Date('2024-11-24'),
    acceptedAt: new Date('2024-11-24'),
    dueDate: new Date('2024-11-25'),
    completions: {
      '1': { completed: true, completedAt: new Date('2024-11-25T07:30:00'), difficultyRating: 2 },
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
    createdAt: new Date('2024-11-24'),
    acceptedAt: new Date('2024-11-24'),
    dueDate: new Date('2024-11-25'),
    completions: {
      '1': { completed: false },
      '2': { completed: true, completedAt: new Date('2024-11-25T06:00:00'), difficultyRating: 4 }
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
    status: 'pending',
    createdAt: new Date('2024-11-25T08:00:00'),
    dueDate: new Date('2024-11-25'),
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
    status: 'pending',
    createdAt: new Date('2024-11-25T09:00:00'),
    dueDate: new Date('2024-11-25'),
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
    createdAt: new Date('2024-11-20'),
    acceptedAt: new Date('2024-11-21'),
    dueDate: new Date('2024-11-25'),
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
    createdAt: new Date('2024-11-24'),
    acceptedAt: new Date('2024-11-24'),
    completedAt: new Date('2024-11-25T07:00:00'),
    dueDate: new Date('2024-11-25'),
    completions: {
      '1': { completed: true, completedAt: new Date('2024-11-25T07:00:00'), difficultyRating: 5 },
      '2': { completed: true, completedAt: new Date('2024-11-25T06:30:00'), difficultyRating: 5 }
    }
  }
];

// Mock notifications
export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    userId: '1',
    type: 'task_initiated',
    message: 'Jordan initiated "Read chapter 5" in Learning Together',
    taskId: 't4',
    projectId: 'p3',
    read: false,
    createdAt: new Date('2024-11-25T09:00:00')
  },
  {
    id: 'n2',
    userId: '1',
    type: 'task_completed',
    message: 'Jordan completed "30 min cardio" in Fitness Challenge',
    taskId: 't2',
    projectId: 'p2',
    read: false,
    createdAt: new Date('2024-11-25T06:00:00')
  },
  {
    id: 'n3',
    userId: '1',
    type: 'streak_reminder',
    message: 'Complete your tasks today to maintain your 12-day streak!',
    read: true,
    createdAt: new Date('2024-11-25T07:00:00')
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

// Helper function to get tasks for today
export const getTodayTasks = (): Task[] => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  return mockTasks.filter(task => {
    const dueDate = task.dueDate ? new Date(task.dueDate) : null;
    if (!dueDate) return false;
    
    dueDate.setHours(0, 0, 0, 0);
    return dueDate.getTime() === today.getTime();
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
