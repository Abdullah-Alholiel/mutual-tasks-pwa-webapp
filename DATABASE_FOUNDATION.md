# Database Foundation & Data Model

This document outlines the database foundation that has been implemented to prepare for backend integration. All TypeScript interfaces are structured to match a relational database schema.

## Entity Relationship Overview

```
User (1) ──< (N) Project (via participantIds)
User (1) ──< (N) Task (as creatorId or assigneeId)
Project (1) ──< (N) Task
Task (1) ──< (N) CompletionLog
User (1) ──< (N) Notification
```

## Core Entities

### 1. User Entity
**Primary Key:** `id`

```typescript
interface User {
  id: string;                    // UUID in production
  name: string;
  handle: string;                 // Unique username
  email: string;                  // Unique, for authentication
  avatar: string;                 // URL to avatar image
  timezone: string;                // IANA timezone (e.g., 'America/Los_Angeles')
  stats: UserStats;                // Denormalized summary stats
}

interface UserStats {
  totalCompletedTasks: number;    // Count of completed tasks
  currentStreak: number;           // Current consecutive days
  longestStreak: number;           // Best streak ever
  score: number;                   // Calculated from completions + difficulty
}
```

**Database Table:**
- `users` table with columns matching above
- `user_stats` can be a separate table or computed view

### 2. Project Entity
**Primary Key:** `id`  
**Foreign Keys:** `ownerId` → `users.id`

```typescript
interface Project {
  id: string;                      // UUID in production
  name: string;
  description: string;
  ownerId: string;                  // FK to users.id
  participantIds: string[];       // Array of user IDs (normalized)
  totalTasksPlanned: number;       // Set by creator at creation
  createdAt: Date;
  updatedAt: Date;
  color?: string;                  // UI preference (optional)
  
  // Computed/denormalized (not in DB):
  participants?: User[];            // Populated from participantIds
  completedTasks?: number;         // Derived from tasks
  progress?: number;               // Derived: completedTasks / totalTasksPlanned
}
```

**Database Tables:**
- `projects` table with: id, name, description, owner_id, total_tasks_planned, created_at, updated_at, color
- `project_participants` junction table: project_id, user_id (many-to-many)

### 3. Task Entity
**Primary Key:** `id`  
**Foreign Keys:** 
- `projectId` → `projects.id`
- `creatorId` → `users.id`
- `assigneeId` → `users.id`
- `initiatedByUserId` → `users.id`

```typescript
interface Task {
  id: string;                      // UUID in production
  projectId: string;              // FK to projects.id
  title: string;
  description?: string;
  creatorId: string;               // FK to users.id (who created)
  assigneeId: string;               // FK to users.id (friend assigned)
  type: 'one_off' | 'recurring';
  recurrencePattern?: 'daily' | 'weekly' | 'custom';
  status: 'draft' | 'initiated' | 'pending_acceptance' | 'accepted' | 'completed';
  initiatedAt?: Date;               // When moved from draft to initiated
  acceptedAt?: Date;                // When assignee accepted
  completedAt?: Date;               // When both users completed
  dueDate?: Date;
  initiatedByUserId: string;        // FK to users.id
  isMirrorCompletionVisible: boolean; // Both users see each other's completion
  
  // Denormalized for convenience (normalized to CompletionLog in DB):
  completions: {
    [userId: string]: {
      completed: boolean;
      completedAt?: Date;
      difficultyRating?: DifficultyRating;
    };
  };
}
```

**Database Tables:**
- `tasks` table with all scalar fields
- Status enum: `draft`, `initiated`, `pending_acceptance`, `accepted`, `completed`
- `recurrence_pattern` enum: `daily`, `weekly`, `custom` (nullable)

**Status Flow:**
```
draft → initiated → pending_acceptance → accepted → completed
```

### 4. CompletionLog Entity
**Primary Key:** `id`  
**Foreign Keys:**
- `userId` → `users.id`
- `taskId` → `tasks.id`

```typescript
interface CompletionLog {
  id: string;                      // UUID in production
  userId: string;                   // FK to users.id
  taskId: string;                   // FK to tasks.id
  completedAt: Date;
  difficultyRating?: number;        // 1-10 scale
}
```

**Database Table:**
- `completion_logs` table
- Unique constraint on (user_id, task_id) - one completion per user per task
- Indexed on: user_id, task_id, completed_at (for streak calculations)

**Use Cases:**
- Calculate streaks (consecutive days with completions)
- Show completion history in calendar
- Calculate user stats (totalCompletedTasks, score)

### 5. Notification Entity
**Primary Key:** `id`  
**Foreign Keys:**
- `userId` → `users.id`
- `taskId` → `tasks.id` (nullable)
- `projectId` → `projects.id` (nullable)

```typescript
interface Notification {
  id: string;                      // UUID in production
  userId: string;                   // FK to users.id
  type: 'task_initiated' | 'task_accepted' | 'task_completed' | 'streak_reminder';
  message: string;                  // Human-readable message
  taskId?: string;                  // FK to tasks.id (nullable)
  projectId?: string;               // FK to projects.id (nullable)
  createdAt: Date;
  isRead: boolean;                  // Read status
}
```

**Database Table:**
- `notifications` table
- Indexed on: user_id, is_read, created_at
- Can be used for email triggers (see backend service)

## Data Normalization

### Normalized (DB-ready) Fields:
- `Project.participantIds: string[]` - stored in junction table
- `Task.completions` - stored in `CompletionLog` table
- `User.stats` - can be computed or stored in separate table

### Denormalized (UI convenience) Fields:
- `Project.participants: User[]` - populated via JOIN
- `Project.completedTasks` - computed via COUNT query
- `Project.progress` - computed from completedTasks / totalTasksPlanned
- `Task.completions` - populated from CompletionLog table

## Helper Functions

### `populateProjectParticipants(project: Project): Project`
Simulates a JOIN operation to populate `project.participants` from `project.participantIds`.

### `mapTaskStatusForUI(status: TaskStatus): 'pending' | 'accepted' | 'completed'`
Maps database statuses to UI-friendly statuses:
- `pending_acceptance`, `initiated`, `draft` → `pending`
- `accepted` → `accepted`
- `completed` → `completed`

### `getTodayTasks(userId?: string): Task[]`
Gets tasks due today, optionally filtered by user visibility.

## Migration Notes

### From Old Structure:
1. ✅ `User.stats.totalCompleted` → `User.stats.totalCompletedTasks`
2. ✅ `Project.participants: User[]` → `Project.participantIds: string[]` (normalized)
3. ✅ `Task.status: 'pending'` → `Task.status: 'pending_acceptance'`
4. ✅ `Notification.read` → `Notification.isRead`
5. ✅ Added `Project.ownerId`, `Project.updatedAt`
6. ✅ Added `Task.initiatedAt`, `Task.initiatedByUserId`, `Task.isMirrorCompletionVisible`
7. ✅ Added `CompletionLog` entity (separated from Task.completions)

### Backward Compatibility:
- `Task.createdAt` kept for legacy support (maps to `initiatedAt`)
- `Task.completions` kept in Task interface for UI convenience (normalized in DB)
- `Project.participants` kept for UI convenience (normalized in DB)

## Backend Integration Checklist

When implementing the backend:

- [ ] Create database schema matching the interfaces
- [ ] Implement JOIN queries for denormalized fields
- [ ] Create API endpoints for CRUD operations
- [ ] Implement status transitions with validation
- [ ] Add indexes for performance (user_id, task_id, completed_at, etc.)
- [ ] Implement streak calculation service (using CompletionLog)
- [ ] Create notification service (email triggers)
- [ ] Add database migrations for schema changes
- [ ] Implement data validation and constraints
- [ ] Add pagination for large datasets
- [ ] Implement caching for computed stats

## API Endpoints (Future)

```
GET    /api/users/:id
GET    /api/users/:id/stats
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
GET    /api/projects/:id/tasks
GET    /api/tasks
POST   /api/tasks
GET    /api/tasks/:id
PUT    /api/tasks/:id/accept
PUT    /api/tasks/:id/complete
GET    /api/tasks/today
GET    /api/completion-logs
POST   /api/completion-logs
GET    /api/notifications
PUT    /api/notifications/:id/read
```

## Notes

- All IDs are currently strings (will be UUIDs in production)
- Dates are JavaScript Date objects (will be ISO strings in API)
- Difficulty rating is 1-10 scale (was 1-5, expanded for ERD)
- Status system supports draft → initiated → pending_acceptance → accepted → completed flow
- Mirror completion visibility ensures both users see each other's completion status

