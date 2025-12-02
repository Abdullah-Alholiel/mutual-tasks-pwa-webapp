# Component Architecture & Operational Guide

This document explains how all components operationally function and which files handle what responsibilities. Use this to ensure standardization across the codebase.

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Data Flow](#data-flow)
3. [File Structure & Responsibilities](#file-structure--responsibilities)
4. [Component Patterns](#component-patterns)
5. [Standardization Checklist](#standardization-checklist)

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
- `Task`, `TaskStatusEntity` - Task entities (note: TaskStatusEntity replaces TaskAssignment)
- `CompletionLog` - Task completion records
- `Notification` - User notifications
- `TaskRecurrence` - Recurring task patterns

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

---

#### `taskUtils.ts` - Task Logic Utilities
**Purpose**: Reusable, standardized task-related logic

**Key Functions**:
- `getRingColor()` - Calculate avatar ring color (green/yellow/red/none)
- `canCompleteTask()` - Check if task can be completed
- `canRecoverTask()` - Check if task can be recovered
- `mapTaskStatusForUI()` - Map DB status to UI status
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
- `getNeedsActionTasks(tasks, taskStatuses, completionLogs, userId)` - Get tasks needing user action
- `getCompletedTasks(tasks, completionLogs, userId)` - Get completed tasks
- `getArchivedTasks(tasks, taskStatuses, completionLogs, userId)` - Get archived tasks that can be recovered
- `updateTasksWithStatuses(tasks, taskStatuses)` - Update tasks with their status entities

**Standardization**: 
- ✅ All pages use these utilities for task filtering
- ✅ Eliminates duplication across Index.tsx, Projects.tsx, and ProjectDetail.tsx
- ✅ Consistent filtering logic across the application

---

#### `projectUtils.ts` - Project Utilities
**Purpose**: Centralized project-related calculations and filtering

**Key Functions**:
- `calculateProjectProgress(project, tasks, completionLogs, userId)` - Calculate project progress for a user
- `calculateProjectsProgress(projects, tasks, completionLogs, userId)` - Batch progress calculation for multiple projects
- `getUserProjects(projects, userId)` - Filter projects by user participation
- `getPublicProjects(projects, userId)` - Filter public projects user is not part of

**Standardization**: 
- ✅ All pages use these utilities for progress calculation
- ✅ Eliminates duplication (was duplicated in Index.tsx and Projects.tsx)
- ✅ Consistent progress calculation across the application

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

### `/src/hooks/` - React Query Hooks

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
- `useTasks(filters?)` - Fetch tasks with optional filters
- `useTask(id)` - Fetch single task by ID
- `useTodayTasks()` - Fetch today's tasks
- `useProjectTasks(projectId)` - Fetch tasks for a project
- `useCreateTask()` - Create new task mutation
- `useUpdateTask()` - Update task mutation
- `useUpdateTaskStatus()` - Update task status mutation

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

### `/src/pages/` - Page Components

#### `Index.tsx` - Today's Tasks Page
**Responsibility**: Display and manage today's tasks

**State Management**:
- `tasks`, `taskStatuses`, `completionLogs`, `projects` - Local state (from mockData)
- Filters tasks by due date (today)
- Groups tasks into: "Needs Your Action", "Done for the Day", "Another Chance?"

**Key Operations**:
- `handleComplete()` - Complete task with difficulty rating
- `handleRecover()` - Recover archived task
- `handleCreateTask()` - Create new task (one-off or habit with recurrence)
- `handleCreateProject()` - Create new project

**Data Flow**:
1. Loads tasks from mockData
2. Filters by today's date
3. Groups by user status
4. Updates state on actions
5. Passes data to `TaskCard` components

**Standardization**: 
- ✅ Uses `getTodayTasks()`, `getNeedsActionTasks()`, `getCompletedTasks()`, `getArchivedTasks()` utilities
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
2. Filters into "My Projects" and "Public Projects"
3. Calculates progress for each project
4. Renders `ProjectCard` components

**Standardization**: 
- ✅ Uses `calculateProjectsProgress()` utility
- ✅ Uses `getUserProjects()` and `getPublicProjects()` utilities
- ✅ Uses `handleError()` for error handling
- ✅ Uses `useMemo` for performance optimization
- ✅ Consistent type imports
- ⚠️ Still uses local state (React Query hooks ready for integration)

---

#### `ProjectDetail.tsx` - Project Detail Page
**Responsibility**: Display project details, tasks, participants

**Standardization**: 
- ✅ Uses `getProjectTasks()`, `updateTasksWithStatuses()` utilities
- ✅ Uses `calculateProjectProgress()` utility
- ✅ Uses `getNeedsActionTasks()`, `getCompletedTasks()`, `getArchivedTasks()` utilities
- ✅ Uses `handleError()` for error handling
- ✅ Consistent type imports
- ⚠️ Still uses local state (React Query hooks ready for integration)

---

#### `Profile.tsx` - User Profile Page
**Responsibility**: Display user stats, streaks, completion history

**Standardization**: 
- ✅ Uses `getUserProjects()` utility
- ✅ Uses `handleError()` for error handling
- ✅ Consistent type imports
- ⚠️ Still uses local state (React Query hooks ready for integration)

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

---

#### Feature Components

##### `TaskCard.tsx` - Task Display Card
**Purpose**: Display individual task with status, participants, actions

**Props**:
- `task: Task` - Task to display
- `completionLogs?: CompletionLog[]` - Completion records
- `onComplete?: (taskId, difficultyRating) => void` - Completion handler
- `onRecover?: (taskId) => void` - Recovery handler
- `onAccept?`, `onDecline?` - Acceptance handlers (if needed)

**Key Features**:
- ✅ Uses `taskUtils` for ring color, status mapping, action checks
- ✅ Displays all participants with ring colors
- ✅ Shows completion status per participant
- ✅ Handles difficulty rating modal

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

#### UI Components (`/src/components/ui/`)
**Purpose**: shadcn/ui component library

**Standardization**: ✅ All components from shadcn/ui, consistent styling

**Key Components Used**:
- `Button`, `Card`, `Badge`, `Avatar`, `Dialog`, `Tabs`, `Progress`, etc.

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
    // Filter logic
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
  const status = mapTaskStatusForUI(data.status);
  const canAct = canCompleteTask(data);
  
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

### 4. Utility Usage Pattern
```typescript
// ✅ CORRECT: Use taskUtils
import { getRingColor, canCompleteTask } from '@/lib/taskUtils';
const ringColor = getRingColor(taskStatus, completionLog, taskDueDate);

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
- [x] **Task Filtering Utilities** (`taskFilterUtils.ts`)
  - `getTodayTasks()` - Get today's tasks
  - `getProjectTasks()` - Get project tasks
  - `getUserTasks()` - Get user tasks
  - `getNeedsActionTasks()` - Get tasks needing action
  - `getCompletedTasks()` - Get completed tasks
  - `getArchivedTasks()` - Get archived tasks
  - `updateTasksWithStatuses()` - Update tasks with statuses
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

#### 3. Pages Updated ✅
- [x] **Index.tsx** - Uses all utilities, error handling, memoization
- [x] **Projects.tsx** - Uses all utilities, error handling, memoization
- [x] **ProjectDetail.tsx** - Uses all utilities, error handling
- [x] **Profile.tsx** - Uses utilities, error handling

#### 4. Type Imports ✅
- [x] All components use `import type` for type-only imports
- [x] All library files use `import type` for type-only imports
- [x] Consistent type import pattern across codebase

#### 5. Error Handling ✅
- [x] All error handling uses `handleError()` utility
- [x] Consistent error logging and user notifications

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

## Standardization Implementation Summary

### Files Created
1. `/src/lib/projectUtils.ts` - Project utilities (progress calculation, filtering)
2. `/src/lib/taskFilterUtils.ts` - Task filtering utilities
3. `/src/lib/errorUtils.ts` - Error handling utilities
4. `/src/hooks/useProjects.ts` - Project React Query hooks
5. `/src/hooks/useTasks.ts` - Task React Query hooks
6. `/src/hooks/useCurrentUser.ts` - Current user hooks

### Files Updated
1. `/src/pages/Index.tsx` - Uses utilities, error handling, memoization
2. `/src/pages/Projects.tsx` - Uses utilities, error handling, memoization
3. `/src/pages/ProjectDetail.tsx` - Uses utilities, error handling
4. `/src/pages/Profile.tsx` - Uses utilities, error handling
5. All component files - Updated type imports to `import type`
6. All library files - Updated type imports to `import type`

### Impact Achieved
1. **Eliminated Duplication**: Progress calculation centralized (was in 2+ places)
2. **Consistent Filtering**: Task filtering uses standardized utilities
3. **Error Handling**: All errors go through `handleError()` utility
4. **Type Safety**: Better tree-shaking with `import type`
5. **Performance**: Added `useMemo` to prevent unnecessary recalculations
6. **Future-Ready**: React Query hooks ready for integration

### Next Steps
1. **Integrate React Query**: Replace local state with React Query hooks in pages
2. **Remove Direct mockData Imports**: All data access should go through `db` client
3. **Add Loading States**: Use React Query's `isLoading` states
4. **Add Error Boundaries**: Implement error boundaries for better error handling

---

## Best Practices

### ✅ DO
- Use `db` client for all data access
- Use utilities from `lib/taskUtils.ts` for task logic
- Import types from `@/types`
- Use `AppLayout` for all pages
- Use shadcn/ui components for UI
- Show toast notifications for user actions
- Use TypeScript interfaces for all props

### ❌ DON'T
- Import directly from `mockData.ts` in components
- Duplicate task logic (ring colors, status mapping, etc.)
- Create components without TypeScript interfaces
- Skip error handling
- Use inline styles (use Tailwind classes)
- Mix data access patterns (always use `db` client)

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
| `lib/projectUtils.ts` | Project utilities | Pages |
| `lib/errorUtils.ts` | Error handling utilities | All pages, components |
| `lib/notificationService.ts` | Notification creation | Pages, event handlers |
| `hooks/useProjects.ts` | Project React Query hooks | Pages (ready for integration) |
| `hooks/useTasks.ts` | Task React Query hooks | Pages (ready for integration) |
| `hooks/useCurrentUser.ts` | Current user hooks | Pages (ready for integration) |
| `pages/Index.tsx` | Today's tasks page | Router |
| `pages/Projects.tsx` | Projects list page | Router |
| `components/layout/AppLayout.tsx` | Page layout wrapper | All pages |
| `components/tasks/TaskCard.tsx` | Task display | Index, ProjectDetail |
| `components/projects/ProjectCard.tsx` | Project display | Projects |
| `components/tasks/TaskForm.tsx` | Task creation form | Index, ProjectDetail |
| `components/projects/ProjectForm.tsx` | Project creation form | Projects |

---

## Questions for Standardization Review

1. **Data Access**: Are all pages using `db` client? (Check: Index, Projects, ProjectDetail, Profile)
2. **Utilities**: Are all task-related calculations using `taskUtils.ts`?
3. **Types**: Are all types imported from `@/types`?
4. **Components**: Do all components have TypeScript interfaces?
5. **Error Handling**: Is error handling consistent across pages?
6. **Loading States**: Are loading states implemented?
7. **Progress Calculation**: Is progress calculation centralized?
8. **Task Filtering**: Is task filtering logic centralized?

---

**Last Updated**: Standardization completed - all utilities and hooks implemented
**Status**: ✅ All standardization recommendations implemented
**Next Review**: After React Query integration

