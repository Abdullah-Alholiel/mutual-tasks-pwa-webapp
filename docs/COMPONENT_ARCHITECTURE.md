# Component Architecture & Operational Guide

This document explains how all components operationally function and which files handle what responsibilities. Use this to ensure standardization across the codebase.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Data Flow](#data-flow)
3. [File Structure & Responsibilities](#file-structure--responsibilities)
4. [Component Patterns](#component-patterns)
5. [Task Status Model](#task-status-model)
6. [Standardization Checklist](#standardization-checklist)

---

## Architecture Overview

### High-Level Flow
```
User Interaction → Page Component → Feature Component → Data Layer → Mock/Supabase
                                                              ↓
                                                    State Update → UI Re-render
```

### Key Architectural Principles
1. **Unified Data Access Layer**: `src/lib/db.ts` provides a single interface for both mock and Supabase data
2. **Type Safety**: All types defined in `src/types/index.ts` - single source of truth
3. **Component Composition**: Pages compose feature components, which compose UI components
4. **State Management**: React state in pages, passed down as props to components
5. **Utility Functions**: Reusable logic in `src/lib/` (taskUtils, notificationService, etc.)
6. **Per-User Task Status**: Task status is stored per user (`TaskStatusEntity.status`), NOT on the task itself. Enum values are `Active | Completed | Archived | Recovered | Upcoming` (capitalized).

---

## Task Status Model

### Core Concept
**Tasks do NOT have a global status field.** All task status is user-dependent and stored in `TaskStatusEntity` records.

### TaskStatusEntity Structure
```typescript
interface TaskStatusEntity {
  id: string;
  taskId: string;
  userId: string;  // Foreign key to user
  status: TaskStatus;  // 'Active' | 'Completed' | 'Archived' | 'Recovered' | 'Upcoming'
  effectiveDueDate: Date;
  archivedAt?: Date;
  recoveredAt?: Date;
  timingStatus?: TimingStatus;
  ringColor?: RingColor;
  createdAt: Date;
  updatedAt: Date;
}
```

### Status Calculation Logic
The `calculateTaskStatusUserStatus()` function in `taskUtils.ts` determines status based on:
1. **Completed**: If user has a completion log OR status is 'Completed'
2. **Recovered**: If `recoveredAt` is set OR status is 'Recovered'
3. **Archived**: If `archivedAt` is set OR status is 'Archived' OR past due date
4. **Upcoming**: If due date is in the future
5. **Active**: If due date is today and not completed/archived/recovered

### Status Rules
- **Active**: Task due today, user hasn't completed it yet
- **Completed**: User marked task as complete (has completion log)
- **Archived**: Task past due date, user didn't complete it
- **Recovered**: User recovered an archived task (can be completed from "Another Chance?" section)
- **Upcoming**: Task due date is in the future

---

## Data Flow

### 1. Entry Point
**File**: `src/main.tsx`
- Registers service worker for PWA
- Renders root `App` component
- Sets up React Query client

### 2. App Router
**File**: `src/App.tsx`
- **Responsibility**: Route configuration and global providers
- **Provides**:
  - React Query (`QueryClientProvider`)
  - Toast notifications (`Toaster`, `Sonner`)
  - Tooltip provider
  - Browser router with routes:
    - `/` → Index (Today's Tasks)
    - `/projects` → Projects list
    - `/projects/:id` → Project detail
    - `/profile` → User profile
    - `/auth` → Authentication

### 3. Layout System
**File**: `src/components/layout/AppLayout.tsx`
- **Responsibility**: Wraps all pages with consistent layout
- **Structure**:
  - Desktop navigation (top)
  - Main content area (center)
  - Mobile navigation (bottom)
- **Usage**: All pages wrap content in `<AppLayout>`

**Related Files**:
- `src/components/layout/DesktopNav.tsx` - Desktop navigation bar
- `src/components/layout/MobileNav.tsx` - Mobile bottom navigation

---

## File Structure & Responsibilities

### `/src/types/index.ts` - Type Definitions
**Purpose**: Single source of truth for all TypeScript interfaces

**Key Types**:
- `User`, `UserStats` - User entities
- `Project`, `ProjectParticipant` - Project entities
- `Task` - Task entity (NO status field - status is per-user only)
- `TaskStatusEntity` - Per-user task status (status enum: `Active | Completed | Archived | Recovered | Upcoming`)
- `CompletionLog` - Task completion records
- `Notification` - User notifications
- `TaskRecurrence` - Recurring task patterns

**Key Enums**:
- `TaskStatus` = `'Active' | 'Completed' | 'Archived' | 'Recovered' | 'Upcoming'`
- `TASK_STATUSES` = `['Active', 'Completed', 'Archived', 'Recovered', 'Upcoming']`

**Standardization Note**: All types use camelCase. Database layer (`db.ts`) handles transformation to/from snake_case.

---

### `/src/lib/` - Core Business Logic

#### `db.ts` - Unified Data Access Layer
**Purpose**: Abstract interface for data operations (works with mock or Supabase)

**Key Functions**:
- `getDatabaseClient()` - Factory function returns mock or Supabase client
- `DatabaseClient` interface - Standardized API for all data operations
- Transformation functions - Convert between DB format (snake_case, ISO strings) and frontend format (camelCase, Date objects)

**Usage Pattern**:
```typescript
import { db } from '@/lib/db';
const projects = await db.getProjects({ userId: currentUser.id });
```

**Standardization**: All components should use `db` client, never access `mockData` directly.
**Task Status Note**: Tasks have NO `status` field. `getTasks()` filters only by `projectId` and `userId`. Per-user status is in `taskStatuses` array.

---

#### `mockData.ts` - Development Mock Data
**Purpose**: Comprehensive mock data for development/testing

**Exports**:
- `mockUsers`, `mockProjects`, `mockTasks`, `mockTaskStatuses`, `mockCompletionLogs`, `mockNotifications`
- `currentUser` - Currently logged-in user
- Helper functions: `getUserById`, `getProjectById`, `getTaskById`, `getTodayTasks`, etc.

**Standardization**: 
- ✅ Used by `db.ts` MockDatabaseClient
- ❌ Should NOT be imported directly in components
- ✅ Helper functions can be used for UI utilities (e.g., `getUserById` for displaying user info)
**Task Status Note**: `mockTasks` have NO `status` field. All status is modeled via `mockTaskStatuses` (per-user, capitalized enum values).

---

#### `taskUtils.ts` - Task Logic Utilities
**Purpose**: Reusable, standardized task-related logic

**Key Functions**:
- `calculateTaskStatusUserStatus()` - Calculate user's task status based on completion, recovery, and dates
- `getRingColor()` - Calculate avatar ring color (green/yellow/red/none)
- `canCompleteTask()` - Check if task can be completed (only active/recovered tasks due today)
- `canRecoverTask()` - Check if task can be recovered (only archived tasks)
- `normalizeToStartOfDay()` - Normalize dates to start of day
- `getStatusBadgeVariant()`, `getStatusColor()` - UI styling helpers

**Standardization**: 
- ✅ All components MUST use these utilities for task logic
- ❌ Do NOT duplicate ring color logic or status mapping
- ✅ Ensures consistent behavior across all task displays

---

#### `taskFilterUtils.ts` - Task Filtering Utilities
**Purpose**: Centralized task filtering logic

**Key Functions**:
- `getTodayTasks(tasks, userId?)` - Get tasks due today
- `getProjectTasks(tasks, projectId)` - Get tasks for a specific project
- `getUserTasks(tasks, userId)` - Get tasks for a specific user
- `getNeedsActionTasks(tasks, taskStatuses, completionLogs, userId)` - Get active tasks due today (for "Needs Your Action" section)
- `getCompletedTasksForToday(tasks, taskStatuses, completionLogs, userId)` - Get completed tasks with today's date (for "Done for the Day" section)
- `getRecoveredTasks(tasks, taskStatuses, completionLogs, userId)` - Get recovered tasks regardless of date (for "Another Chance?" section)
- `getArchivedTasks(tasks, taskStatuses, completionLogs, userId)` - Get archived tasks that can be recovered
- `getUpcomingTasks(tasks, taskStatuses, completionLogs, userId)` - Get upcoming tasks
- `updateTasksWithStatuses(tasks, taskStatuses)` - Update tasks with their status entities

**Status Source**: All filters derive from per-user `TaskStatusEntity.status` (capitalized enums: `Active`, `Completed`, etc.) plus completion logs. Task-level status does not exist.

**Standardization**: 
- ✅ All pages use these utilities for task filtering
- ✅ Eliminates duplication across Index.tsx, Projects.tsx, and ProjectDetail.tsx
- ✅ Consistent filtering logic across the application

---

#### `taskCreationUtils.ts` - Task Creation Utilities
**Purpose**: Standardized task creation logic

**Key Functions**:
- `getProjectParticipantIds(project, allUsers)` - Get all participant IDs including owner
- `buildTaskStatus(taskId, userId, status, dueDate, timestamp)` - Build a task status entity
- `createTaskStatusesForAllParticipants(taskId, project, allUsers, dueDate, timestamp)` - Create status entities for all project participants (initial status: `'Active'`)
- `validateProjectForTaskCreation(project, allUsers, minParticipants)` - Validate project has enough participants

**Standardization**: 
- ✅ All task creation uses these utilities
- ✅ Ensures consistent task status initialization
- ✅ Validates project requirements before task creation

---

#### `taskRecoveryUtils.ts` - Task Recovery Utilities
**Purpose**: Standardized task recovery logic

**Key Functions**:
- `recoverTask(taskId, userId, tasks, taskStatuses)` - Recover an archived task
  - Sets status to `'Recovered'`
  - Sets `recoveredAt` timestamp
  - Clears `archivedAt`
  - Sets `ringColor` to `'yellow'`
  - Sets `timingStatus` to `'late'`

**Standardization**: 
- ✅ All task recovery uses this utility
- ✅ Ensures consistent recovery behavior
- ✅ Only archived tasks can be recovered

---

#### `projectUtils.ts` - Project Utilities
**Purpose**: Centralized project-related calculations and filtering

**Key Functions**:
- `calculateProjectProgress(project, tasks, completionLogs, userId)` - Calculate project progress for a user
- `calculateProjectsProgress(projects, tasks, completionLogs, userId)` - Batch progress calculation for multiple projects
- `getUserProjects(projects, userId)` - Filter projects by user participation
- `getPublicProjects(projects, userId)` - Filter public projects user is not part of
- `getProjectsWhereCanCreateTasks(projects, userId)` - Get projects where user can create tasks (owner/manager roles)
- `joinProject(projectId, userId, user, projectParticipants, project)` - Join a public project
- `leaveProject(projectId, userId, projectParticipants)` - Leave a project
- `canLeaveProject(project, userId)` - Check if user can leave project

**Standardization**: 
- ✅ All pages use these utilities for progress calculation
- ✅ Eliminates duplication (was duplicated in Index.tsx and Projects.tsx)
- ✅ Consistent progress calculation across the application

---

#### `userUtils.ts` - User Utilities
**Purpose**: User-related helper functions

**Key Functions**:
- `isHandleUnique(handle, excludeUserId?)` - Check if handle is unique
- `validateHandleFormat(handle)` - Validate handle format (@ prefix, alphanumeric + underscore, 3-30 chars)
- `findUserByIdentifier(identifier)` - Find user by email or handle

**Standardization**: 
- ✅ All user lookup/validation uses these utilities
- ✅ Consistent handle validation across the application

---

#### `errorUtils.ts` - Error Handling Utilities
**Purpose**: Consistent error handling across the application

**Key Functions**:
- `handleError(error, context?, showToast?)` - Handle errors with logging and toast notifications
- `handleAsync(operation, context?, onSuccess?, onError?)` - Wrapper for async operations with error handling

**Standardization**: 
- ✅ All error handling goes through `handleError()` utility
- ✅ Consistent error logging and user notifications
- ✅ Development errors logged to console, production errors shown via toast

---

#### `notificationService.ts` - Notification Management
**Purpose**: Create notifications and send emails

**Key Methods**:
- `notifyTaskInitiated()`, `notifyTaskAccepted()`, `notifyTaskDeclined()`, etc.
- Handles both in-app notifications and email sending

**Standardization**: Use `notificationService` singleton for all notification creation.

---

#### `emailTemplates.ts` - Email Template Utilities
**Purpose**: Generate email templates for notifications

**Key Functions**:
- `generateTaskCompletedEmail()` - Generate email for task completion
- Various email template generators for different notification types

**Standardization**: All email generation uses these templates.

---

### `/src/hooks/` - React Hooks

#### `useProjects.ts` - Project Data Hooks
**Purpose**: React Query hooks for project data fetching and mutations

**Key Hooks**:
- `useProjects()` - Fetch all projects for current user
- `useProject(id)` - Fetch single project by ID
- `usePublicProjects()` - Fetch public projects
- `useCreateProject()` - Create new project mutation
- `useUpdateProject()` - Update project mutation

**Standardization**: 
- ✅ Ready for React Query integration
- ✅ Currently works with mock data through `db` client
- ✅ Provides consistent data fetching patterns

---

#### `useTasks.ts` - Task Data Hooks
**Purpose**: React Query hooks for task data fetching and mutations

**Key Hooks**:
- `useTasks(filters?)` - Fetch tasks with optional filters (projectId, userId only - no status filter)
- `useTask(id)` - Fetch single task by ID
- `useTodayTasks()` - Fetch today's tasks
- `useProjectTasks(projectId)` - Fetch tasks for a project
- `useCreateTask()` - Create new task mutation
- `useUpdateTask()` - Update task mutation
- `useUpdateTaskStatus()` - Update task status mutation (per-user status)

**Standardization**: 
- ✅ Ready for React Query integration
- ✅ Currently works with mock data through `db` client
- ✅ Provides consistent data fetching patterns

---

#### `useCurrentUser.ts` - Current User Hooks
**Purpose**: React Query hooks for current user data

**Key Hooks**:
- `useCurrentUser()` - Fetch current user
- `useCurrentUserStats()` - Fetch current user stats

**Standardization**: 
- ✅ Ready for React Query integration
- ✅ Currently works with mock data through `db` client

---

#### `useProjectDetail.ts` - Project Detail Hook
**Purpose**: Custom hook for project detail page logic

**Key Features**:
- Manages all state for project detail page
- Categorizes tasks by user status (Active/Recovered, Upcoming, Completed, Archived)
- Prevents task duplication across sections
- Handles task creation, recovery, completion
- Manages project member operations

**Returns**:
- Project data, participants, progress
- Task lists (active, upcoming, completed, archived, habits)
- UI state (modals, dialogs)
- Action handlers (create, recover, complete, add member, etc.)
- Permission flags (isOwner, isManager, canManage, canLeave)

**Standardization**: 
- ✅ Centralizes all project detail logic
- ✅ Uses utilities for filtering and calculations
- ✅ Prevents task duplication with user-specific categorization

---

#### `use-mobile.tsx` - Mobile Detection Hook
**Purpose**: Detect if user is on mobile device

**Usage**: Used for responsive UI behavior

---

#### `use-toast.ts` - Toast Hook
**Purpose**: Toast notification hook (from shadcn/ui)

---

### `/src/pages/` - Page Components

#### `Index.tsx` - Today's Tasks Page
**Responsibility**: Display and manage today's tasks

**State Management**:
- `tasks`, `taskStatuses`, `completionLogs`, `projects` - Local state (from mockData)
- Filters tasks by due date (today)
- Groups tasks into: "Needs Your Action", "Done for the Day", "Another Chance?"

**Key Operations**:
- `handleComplete()` - Complete task with difficulty rating (only in today's view)
- `handleCreateTask()` - Create new task (one-off or habit with recurrence)
- `handleCreateProject()` - Create new project

**Data Flow**:
1. Loads tasks from mockData
2. Filters by today's date using `getTodayTasks()`
3. Groups by user status using `getNeedsActionTasks()`, `getCompletedTasksForToday()`, `getRecoveredTasks()`
4. Updates state on actions
5. Passes data to `TaskCard` components

**Sections**:
- **Needs Your Action**: Active tasks due today (status: `Active`)
- **Done for the Day**: Completed tasks with today's completion date
- **Another Chance?**: Recovered tasks (status: `Recovered`, regardless of date)

**Standardization**: 
- ✅ Uses `getTodayTasks()`, `getNeedsActionTasks()`, `getCompletedTasksForToday()`, `getRecoveredTasks()` utilities
- ✅ Uses `updateTasksWithStatuses()` utility
- ✅ Uses `calculateProjectProgress()` utility
- ✅ Uses `handleError()` for error handling
- ✅ Uses `useMemo` for performance optimization
- ✅ Consistent type imports (`import type`)
- ⚠️ Still uses local state (React Query hooks ready for integration)

---

#### `Projects.tsx` - Projects List Page
**Responsibility**: Display user's projects and public projects

**State Management**:
- `projects` - Local state
- Calculates progress per project (user-specific)

**Key Operations**:
- `handleCreateProject()` - Create new project
- `handleJoinProject()` - Join public project

**Data Flow**:
1. Loads projects from mockData
2. Filters into "My Projects" and "Public Projects" using `getUserProjects()` and `getPublicProjects()`
3. Calculates progress for each project using `calculateProjectsProgress()`
4. Renders `ProjectCard` components

**Standardization**: 
- ✅ Uses `calculateProjectsProgress()` utility
- ✅ Uses `getUserProjects()` and `getPublicProjects()` utilities
- ✅ Uses `joinProject()` utility
- ✅ Uses `handleError()` for error handling
- ✅ Uses `useMemo` for performance optimization
- ✅ Consistent type imports
- ⚠️ Still uses local state (React Query hooks ready for integration)

---

#### `ProjectDetail.tsx` - Project Detail Page
**Responsibility**: Display project details, tasks, participants

**Architecture**:
- Uses `useProjectDetail()` hook for all logic
- Composes `ProjectHeader`, `ProjectStats`, `ProjectTaskSections` components
- Tabs: All, Active, Completed, Upcoming, Habits, Archived

**Task Categorization**:
- **All Tab**: Shows all tasks in project (no duplicates)
- **Active Tab**: Tasks with user status `Active` or `Recovered`
- **Upcoming Tab**: Tasks with user status `Upcoming`
- **Completed Tab**: Tasks user has completed (has completion log)
- **Archived Tab**: Tasks with user status `Archived`
- **Habits Tab**: All habit tasks in project

**Key Operations**:
- Task creation (via `TaskForm`)
- Task recovery (via `handleRecover` - only in project detail view)
- Task completion (via `handleComplete` - only in today's view)
- Member management (add, remove, update role)
- Project editing

**Standardization**: 
- ✅ Uses `useProjectDetail()` hook (centralized logic)
- ✅ Uses `ProjectHeader`, `ProjectStats`, `ProjectTaskSections` components
- ✅ Uses `handleError()` for error handling
- ✅ Consistent type imports
- ✅ Prevents task duplication with user-specific categorization
- ⚠️ Still uses local state (React Query hooks ready for integration)

---

#### `Profile.tsx` - User Profile Page
**Responsibility**: Display user stats, streaks, completion history

**Components Used**:
- `StreakCalendar` - Activity heatmap

**Standardization**: 
- ✅ Uses `getUserProjects()` utility
- ✅ Uses `handleError()` for error handling
- ✅ Consistent type imports
- ⚠️ Still uses local state (React Query hooks ready for integration)

---

#### `Auth.tsx` - Authentication Page
**Responsibility**: User authentication

---

#### `NotFound.tsx` - 404 Page
**Responsibility**: Display 404 error

---

### `/src/components/` - Reusable Components

#### Layout Components

##### `AppLayout.tsx`
- **Purpose**: Consistent page wrapper
- **Props**: `children` (ReactNode)
- **Standardization**: ✅ All pages use this

##### `DesktopNav.tsx` / `MobileNav.tsx`
- **Purpose**: Navigation bars
- **Standardization**: ✅ Consistent navigation structure

##### `NavLink.tsx`
- **Purpose**: Navigation link component
- **Standardization**: ✅ Used in navigation components

---

#### Feature Components

##### `TaskCard.tsx` - Task Display Card
**Purpose**: Display individual task with status, participants, actions

**Props**:
- `task: Task` - Task to display (NO status field)
- `completionLogs?: CompletionLog[]` - Completion records
- `onComplete?: (taskId, difficultyRating) => void` - Completion handler (only shown in today's view)
- `onRecover?: (taskId) => void` - Recovery handler (only shown in project detail view)
- `showRecover?: boolean` - Control recover button visibility (default: true)

**Key Features**:
- ✅ Uses `calculateTaskStatusUserStatus()` to determine user's status
- ✅ Uses `getRingColor()` for participant ring colors
- ✅ Uses `canCompleteTask()` and `canRecoverTask()` for action visibility
- ✅ Displays all participants with ring colors
- ✅ Shows completion status per participant
- ✅ Handles difficulty rating modal
- ✅ Status badge shows user's status (Active, Completed, Archived, Recovered, Upcoming)

**Status Display Logic**:
- Calculates user's status using `calculateTaskStatusUserStatus()`
- Maps status to UI badge (Active/Recovered show as "active", Completed shows as "completed", Archived shows as "archived")
- Shows "Mark Complete" button only if `canCompleteTask()` returns true AND `onComplete` is provided
- Shows "Recover Task" button only if `canRecoverTask()` returns true AND `showRecover` is true AND `onRecover` is provided

**Standardization**: ✅ Well-standardized, uses utilities correctly

---

##### `ProjectCard.tsx` - Project Display Card
**Purpose**: Display project summary with progress

**Props**:
- `project: Project` - Project to display

**Key Features**:
- Shows progress bar
- Displays participants
- Navigates to project detail on click

**Standardization**: ✅ Simple, consistent

---

##### `TaskForm.tsx` - Task Creation/Editing Form
**Purpose**: Form for creating or editing tasks

**Props**:
- `open: boolean` - Modal open state
- `onOpenChange: (open: boolean) => void` - Modal state handler
- `onSubmit: (taskData) => void` - Form submission handler
- `projects: Project[]` - Available projects
- `allowProjectSelection?: boolean` - Allow project selection
- `onCreateProject?: () => Project` - Create project handler

**Standardization**: ✅ Uses Dialog component, consistent form pattern

---

##### `ProjectForm.tsx` - Project Creation Form
**Purpose**: Form for creating projects

**Props**:
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `onSubmit: (projectData) => void`

**Standardization**: ✅ Consistent with TaskForm pattern

---

##### `DifficultyRatingModal.tsx` - Difficulty Rating Dialog
**Purpose**: Modal for rating task difficulty (1-5)

**Props**:
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `onSubmit: (rating: number) => void`
- `taskTitle: string`

**Standardization**: ✅ Simple, focused component

---

##### `ProjectHeader.tsx` - Project Header Component
**Purpose**: Display project header with actions

**Props**:
- `project: Project`
- `canManage: boolean`
- `onBack: () => void`
- `onEdit: () => void`
- `onCreateTask: () => void`

**Features**:
- Shows project icon, name, description
- Back button
- Edit button (if can manage)
- Create task button (if can manage)

**Standardization**: ✅ Reusable, consistent styling

---

##### `ProjectStats.tsx` - Project Statistics Component
**Purpose**: Display project statistics and participants

**Props**:
- `project: Project`
- `progress: number`
- `completedCount: number`
- `totalTasks: number`
- `activeCount: number`
- `completedTasksCount: number`
- `participants: ProjectParticipant[]`
- `isOwner: boolean`
- `onAddMember: () => void`
- `onViewMembers: () => void`

**Features**:
- Progress bar
- Active/Completed task counts
- Participant avatars
- Add member button (if owner)

**Standardization**: ✅ Reusable, consistent styling

---

##### `ProjectTaskSections.tsx` - Project Task Sections Component
**Purpose**: Display task sections for project detail view

**Props**:
- `activeTasks: Task[]`
- `upcomingTasks: Task[]`
- `completedTasks: Task[]`
- `archivedTasks: Task[]`
- `completionLogs: CompletionLog[]`
- `onRecover: (taskId: string) => void`

**Features**:
- Renders task sections (Active, Upcoming, Completed, Archived)
- Uses `TaskSection` sub-component
- Shows recover button only in Archived section

**Standardization**: ✅ Reusable, consistent structure

---

##### `Inbox.tsx` - Notifications Inbox Component
**Purpose**: Display and manage notifications

**Props**:
- `notifications: Notification[]`
- `onMarkAsRead: (notificationId: string) => void`
- `onMarkAllAsRead: () => void`

**Features**:
- Unread count badge
- Grouped by read/unread
- Click to navigate to task/project
- Mark as read functionality

**Standardization**: ✅ Reusable, consistent UI

---

##### `StreakCalendar.tsx` - Activity Heatmap Component
**Purpose**: Display user activity streak calendar

**Features**:
- 7-week activity heatmap
- Current streak display
- Longest streak display
- Intensity-based color coding

**Standardization**: ✅ Reusable, consistent styling

---

#### UI Components (`/src/components/ui/`)
**Purpose**: shadcn/ui component library

**Standardization**: ✅ All components from shadcn/ui, consistent styling

**Key Components Used**:
- `Button`, `Card`, `Badge`, `Avatar`, `Dialog`, `Tabs`, `Progress`, `Input`, `Label`, `Select`, `Toast`, etc.

---

## Component Patterns

### 1. Page Component Pattern
```typescript
// Standard page structure
const PageName = () => {
  // 1. State management
  const [data, setData] = useState(initialData);
  
  // 2. Data loading/filtering
  const filteredData = useMemo(() => {
    // Filter logic using utilities
  }, [data]);
  
  // 3. Event handlers
  const handleAction = () => {
    // Update state
    // Show toast
  };
  
  // 4. Render
  return (
    <AppLayout>
      {/* Page content */}
    </AppLayout>
  );
};
```

### 2. Feature Component Pattern
```typescript
// Standard feature component
interface ComponentProps {
  data: DataType;
  onAction?: (id: string) => void;
}

export const Component = ({ data, onAction }: ComponentProps) => {
  // 1. Use utilities from lib/
  const status = calculateTaskStatusUserStatus(taskStatus, completionLog, task);
  const canAct = canCompleteTask(taskStatus, completionLog, task);
  
  // 2. Local UI state (modals, etc.)
  const [isOpen, setIsOpen] = useState(false);
  
  // 3. Render
  return (
    <Card>
      {/* Component content */}
    </Card>
  );
};
```

### 3. Data Access Pattern
```typescript
// ✅ CORRECT: Use db client
import { db } from '@/lib/db';
const projects = await db.getProjects({ userId: currentUser.id });

// ❌ INCORRECT: Direct mockData import
import { mockProjects } from '@/lib/mockData';
```

### 4. Task Status Pattern
```typescript
// ✅ CORRECT: Calculate user status
import { calculateTaskStatusUserStatus } from '@/lib/taskUtils';
const myStatus = taskStatuses.find(ts => ts.taskId === task.id && ts.userId === userId);
const myCompletion = completionLogs.find(cl => cl.taskId === task.id && cl.userId === userId);
const userStatus = calculateTaskStatusUserStatus(myStatus, myCompletion, task);

// ❌ INCORRECT: Access task.status (doesn't exist)
const status = task.status; // Wrong! Tasks don't have status
```

### 5. Utility Usage Pattern
```typescript
// ✅ CORRECT: Use taskUtils
import { getRingColor, canCompleteTask } from '@/lib/taskUtils';
const ringColor = getRingColor(taskStatus, completionLog, task);

// ❌ INCORRECT: Duplicate logic
const ringColor = taskStatus.completed ? 'green' : 'red'; // Wrong!
```

---

## Standardization Status

### ✅ Completed Standardization

#### 1. Utility Functions ✅
- [x] **Project Utilities** (`projectUtils.ts`)
  - `calculateProjectProgress()` - Centralized progress calculation
  - `calculateProjectsProgress()` - Batch progress calculation
  - `getUserProjects()` - Filter user projects
  - `getPublicProjects()` - Filter public projects
  - `getProjectsWhereCanCreateTasks()` - Filter projects by permission
  - `joinProject()` - Join public project
  - `leaveProject()` - Leave project
  - `canLeaveProject()` - Check if user can leave
- [x] **Task Filtering Utilities** (`taskFilterUtils.ts`)
  - `getTodayTasks()` - Get today's tasks
  - `getProjectTasks()` - Get project tasks
  - `getUserTasks()` - Get user tasks
  - `getNeedsActionTasks()` - Get tasks needing action
  - `getCompletedTasksForToday()` - Get completed tasks for today
  - `getRecoveredTasks()` - Get recovered tasks
  - `getArchivedTasks()` - Get archived tasks
  - `getUpcomingTasks()` - Get upcoming tasks
  - `updateTasksWithStatuses()` - Update tasks with statuses
- [x] **Task Creation Utilities** (`taskCreationUtils.ts`)
  - `getProjectParticipantIds()` - Get participant IDs
  - `buildTaskStatus()` - Build task status entity
  - `createTaskStatusesForAllParticipants()` - Create statuses for all participants
  - `validateProjectForTaskCreation()` - Validate project for task creation
- [x] **Task Recovery Utilities** (`taskRecoveryUtils.ts`)
  - `recoverTask()` - Recover archived task
- [x] **Task Logic Utilities** (`taskUtils.ts`)
  - `calculateTaskStatusUserStatus()` - Calculate user status
  - `getRingColor()` - Calculate ring color
  - `canCompleteTask()` - Check if can complete
  - `canRecoverTask()` - Check if can recover
  - `normalizeToStartOfDay()` - Normalize dates
  - `getStatusBadgeVariant()`, `getStatusColor()` - UI helpers
- [x] **User Utilities** (`userUtils.ts`)
  - `isHandleUnique()` - Check handle uniqueness
  - `validateHandleFormat()` - Validate handle format
  - `findUserByIdentifier()` - Find user by email/handle
- [x] **Error Handling Utilities** (`errorUtils.ts`)
  - `handleError()` - Consistent error handling
  - `handleAsync()` - Async operation wrapper

#### 2. React Query Hooks ✅
- [x] **Project Hooks** (`useProjects.ts`)
  - `useProjects()`, `useProject()`, `usePublicProjects()`
  - `useCreateProject()`, `useUpdateProject()`
- [x] **Task Hooks** (`useTasks.ts`)
  - `useTasks()`, `useTask()`, `useTodayTasks()`, `useProjectTasks()`
  - `useCreateTask()`, `useUpdateTask()`, `useUpdateTaskStatus()`
- [x] **User Hooks** (`useCurrentUser.ts`)
  - `useCurrentUser()`, `useCurrentUserStats()`
- [x] **Project Detail Hook** (`useProjectDetail.ts`)
  - Centralized project detail page logic

#### 3. Pages Updated ✅
- [x] **Index.tsx** - Uses all utilities, error handling, memoization
- [x] **Projects.tsx** - Uses all utilities, error handling, memoization
- [x] **ProjectDetail.tsx** - Uses `useProjectDetail()` hook, all utilities
- [x] **Profile.tsx** - Uses utilities, error handling

#### 4. Type Imports ✅
- [x] All components use `import type` for type-only imports
- [x] All library files use `import type` for type-only imports
- [x] Consistent type import pattern across codebase

#### 5. Error Handling ✅
- [x] All error handling uses `handleError()` utility
- [x] Consistent error logging and user notifications

#### 6. Task Status Model ✅
- [x] Tasks have NO `status` field
- [x] All status is per-user via `TaskStatusEntity`
- [x] Status enum: `Active | Completed | Archived | Recovered | Upcoming` (capitalized)
- [x] All status calculation uses `calculateTaskStatusUserStatus()`
- [x] All components use per-user status correctly

### ⚠️ Future Improvements

#### 1. React Query Integration
- [ ] **Current**: Hooks created but pages still use local state
- [ ] **Next Step**: Replace local state with React Query hooks in pages
- [ ] **Benefit**: Automatic caching, refetching, and loading states

#### 2. Data Access Migration
- [ ] **Current**: Some pages still import directly from `mockData`
- [ ] **Next Step**: All data access should go through `db` client
- [ ] **Benefit**: Easier migration to Supabase when ready

#### 3. Loading States
- [ ] **Current**: No loading states in pages
- [ ] **Next Step**: Use React Query's `isLoading` states
- [ ] **Benefit**: Better UX with loading indicators

#### 4. Error Boundaries
- [ ] **Current**: Error handling via `handleError()` utility
- [ ] **Next Step**: Implement React error boundaries
- [ ] **Benefit**: Better error recovery and user experience

---

## Best Practices

### ✅ DO
- Use `db` client for all data access
- Use utilities from `lib/taskUtils.ts` for task logic
- Use `calculateTaskStatusUserStatus()` to get user's task status
- Import types from `@/types`
- Use `AppLayout` for all pages
- Use shadcn/ui components for UI
- Show toast notifications for user actions
- Use TypeScript interfaces for all props
- Use per-user task status (TaskStatusEntity), not task-level status
- Use capitalized status enums: `Active`, `Completed`, `Archived`, `Recovered`, `Upcoming`

### ❌ DON'T
- Import directly from `mockData.ts` in components
- Access `task.status` (doesn't exist - use TaskStatusEntity)
- Duplicate task logic (ring colors, status mapping, etc.)
- Create components without TypeScript interfaces
- Skip error handling
- Use inline styles (use Tailwind classes)
- Mix data access patterns (always use `db` client)
- Use lowercase status values (use capitalized: `Active`, not `active`)

---

## File Responsibility Summary

| File | Primary Responsibility | Used By |
|------|----------------------|---------|
| `main.tsx` | App entry point, service worker | React |
| `App.tsx` | Routing, global providers | All pages |
| `types/index.ts` | Type definitions | All files |
| `lib/db.ts` | Data access abstraction | Pages, components |
| `lib/mockData.ts` | Mock data source | `db.ts` (MockDatabaseClient) |
| `lib/taskUtils.ts` | Task logic utilities | TaskCard, pages |
| `lib/taskFilterUtils.ts` | Task filtering utilities | Pages |
| `lib/taskCreationUtils.ts` | Task creation utilities | Pages |
| `lib/taskRecoveryUtils.ts` | Task recovery utilities | Pages |
| `lib/projectUtils.ts` | Project utilities | Pages |
| `lib/userUtils.ts` | User utilities | Pages |
| `lib/errorUtils.ts` | Error handling utilities | All pages, components |
| `lib/notificationService.ts` | Notification creation | Pages, event handlers |
| `lib/emailTemplates.ts` | Email templates | notificationService |
| `hooks/useProjects.ts` | Project React Query hooks | Pages (ready for integration) |
| `hooks/useTasks.ts` | Task React Query hooks | Pages (ready for integration) |
| `hooks/useCurrentUser.ts` | Current user hooks | Pages (ready for integration) |
| `hooks/useProjectDetail.ts` | Project detail hook | ProjectDetail page |
| `pages/Index.tsx` | Today's tasks page | Router |
| `pages/Projects.tsx` | Projects list page | Router |
| `pages/ProjectDetail.tsx` | Project detail page | Router |
| `pages/Profile.tsx` | User profile page | Router |
| `components/layout/AppLayout.tsx` | Page layout wrapper | All pages |
| `components/tasks/TaskCard.tsx` | Task display | Index, ProjectDetail |
| `components/tasks/TaskForm.tsx` | Task creation form | Index, ProjectDetail |
| `components/tasks/DifficultyRatingModal.tsx` | Difficulty rating modal | TaskCard |
| `components/projects/ProjectCard.tsx` | Project display | Projects |
| `components/projects/ProjectForm.tsx` | Project creation form | Projects |
| `components/projects/ProjectHeader.tsx` | Project header | ProjectDetail |
| `components/projects/ProjectStats.tsx` | Project statistics | ProjectDetail |
| `components/projects/ProjectTaskSections.tsx` | Task sections | ProjectDetail |
| `components/notifications/Inbox.tsx` | Notifications inbox | DesktopNav, MobileNav |
| `components/profile/StreakCalendar.tsx` | Activity heatmap | Profile |

---

## Questions for Standardization Review

1. **Data Access**: Are all pages using `db` client? (Check: Index, Projects, ProjectDetail, Profile)
2. **Task Status**: Are all components using per-user status (TaskStatusEntity)? (Check: TaskCard, pages)
3. **Utilities**: Are all task-related calculations using `taskUtils.ts`?
4. **Types**: Are all types imported from `@/types`?
5. **Components**: Do all components have TypeScript interfaces?
6. **Error Handling**: Is error handling consistent across pages?
7. **Progress Calculation**: Is progress calculation centralized?
8. **Task Filtering**: Is task filtering logic centralized?
9. **Status Enum**: Are all status values capitalized? (`Active`, not `active`)

---

**Last Updated**: 2025-01-XX - Per-user task status model implemented
**Status**: ✅ All standardization recommendations implemented
**Next Review**: After React Query integration
