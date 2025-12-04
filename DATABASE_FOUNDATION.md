# Database Foundation & Data Model

This document is the contract between the current front-end mocks and the future remote database. Every TypeScript interface in `src/types/index.ts` mirrors these tables so we can swap mock data for API calls without rewriting the UI.

> **Status:** The app still runs on local mock data. Everything below prepares us for a hosted relational database (Supabase/PostgreSQL) once we are ready to turn it on.

## Entity relationship overview
```
User (1) ──< (N) Project             (ownerId)
Project (1) ──< (N) ProjectParticipant (role)
Project (1) ──< (N) Task             (creatorId)
Task (1) ──< (N) TaskStatusEntity    (userId) [replaces TaskAssignment]
Task (1) ──< (N) TaskRecurrence      (for habits)
Task (1) ──< (N) CompletionLog       (userId)
User (1) ──< (N) Notification        (taskId | projectId)
User (1) ──< (1) UserStats           (totalscore derived)
```

## Entity Relationship usecases







## Core entities

### 1. User
**Primary key:** `id`

```typescript
interface User {
  id: string;
  name: string;
  handle: string;
  email: string;
  avatar: string;
  timezone: string;
  notificationPreferences?: Record<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
  stats?: UserStats; // Computed/derived field for frontend convenience
}

interface UserStats {
  userId: string;
  totalCompletedTasks: number;
  currentStreak: number;
  longestStreak: number;
  totalscore: number; // XP earned from completed tasks
  updatedAt: Date;
}
```

**Tables & notes**
- `users` – columns mirror the interface. Store timezone in IANA format (e.g., `America/Los_Angeles`).
- `user_stats` – 1:1 table keyed by `user_id`. Keeps denormalized streak + score data for instant leaderboards.

### 2. Project
**Primary key:** `id` **Foreign key:** `ownerId → users.id`

```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  icon?: string;
  color?: string;
  ownerId: string;
  isPublic: boolean;
  totalTasks: number;
  createdAt: Date;
  updatedAt: Date;
  
  // Computed/derived fields (not stored in DB, calculated on the fly)
  participants?: User[];
  participantRoles?: ProjectParticipant[];
  completedTasks?: number;
  progress?: number;
}

interface ProjectParticipant {
  projectId: string;
  userId: string;
  role: ProjectRole; // 'owner' | 'manager' | 'participant'
  addedAt: Date;
  removedAt?: Date;
  user?: User; // Computed/derived field for frontend convenience
}
```

**Tables & notes**
- `projects` – store scalar fields plus `is_public` (bool) and optional `color` for UI accents.
- `project_participants` – junction table with `(project_id, user_id)` composite PK and a `role` enum (`owner | manager | participant`).
- Public/private differences live at the project level and inform which assignments/proposals are allowed.

### 3. Task
**Primary key:** `id` **Foreign keys:** `projectId`, `creatorId`

```typescript
type TaskStatus = 'active' | 'upcoming' | 'completed' | 'archived';

type TaskType = 'one_off' | 'habit';

type RecurrencePattern = 'daily' | 'weekly' | 'custom';

interface Task {
  id: string;
  projectId: string;
  creatorId: string;
  title: string;
  description?: string;
  type: TaskType;
  recurrencePattern?: RecurrencePattern; // For habit tasks
  originalDueDate: Date; // Date-only (no time component)
  status: TaskStatus;
  initiatedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  
  // Computed/derived fields (not stored in DB, calculated on the fly)
  taskStatuses?: TaskStatusEntity[];
  recurrence?: TaskRecurrence;
}
```

**Tables & notes**
- `tasks` – includes mandatory `original_due_date` (date-only, no time), creator, timestamps, and `type` (`habit` or `one_off`).
- `recurrence_pattern` is optional and only used for habit tasks (`daily`, `weekly`, or `custom`).
- No `assignee_id`; per-user participation is modeled through `task_statuses` (formerly `task_assignments`).
- Status can be `active`, `upcoming`, `completed`, or `archived`.
- Tasks are automatically assigned to all project participants when created (no assignment step).

### 4. TaskStatusEntity
**Primary key:** `id` **Foreign keys:** `taskId`, `userId`

> **Note:** This entity replaces the old `TaskAssignment` concept. The name `TaskStatusEntity` better reflects that it tracks per-user task status, not just assignment.

```typescript
type TaskStatusUserStatus = 'active' | 'completed' | 'archived';

type TimingStatus = 'early' | 'on_time' | 'late';

type RingColor = 'green' | 'yellow' | 'red' | 'none';

interface TaskStatusEntity {
  id: string;
  taskId: string;
  userId: string;
  status: TaskStatusUserStatus;
  effectiveDueDate: Date; // User-specific due date (date-only, no time)
  initiatedAt?: Date;
  archivedAt?: Date;
  recoveredAt?: Date; // When user recovered an archived task
  timingStatus?: TimingStatus; // Calculated when task is completed
  ringColor?: RingColor; // Visual indicator: green (on-time), yellow (recovered), red (expired), none
  createdAt: Date;
  updatedAt: Date;
  
  // Computed/derived fields
  user?: User;
  task?: Task;
}
```

**Tables & notes**
- `task_statuses` (table name) replaces `task_assignments` and tracks each participant's state/history.
- `(task_id, user_id)` is unique to prevent duplicates.
- Tasks are automatically assigned to all project participants when created (no invitation/acceptance flow).
- `effective_due_date` is initially set to the task's `original_due_date` but can be adjusted per user if needed.
- `archived_at` marks when a user's task was archived (expired and not completed).
- `recovered_at` marks when a user recovered an archived task (moves status back to `active`).
- `ring_color` provides visual feedback: green for on-time completion, yellow for recovered tasks, red for expired/archived.
- Archiving is per-user only; task owners can delete tasks globally.

### 5. TaskRecurrence
**Primary key:** `id` **Foreign key:** `taskId`

```typescript
type RecurrencePattern = 'daily' | 'weekly' | 'custom';

interface TaskRecurrence {
  id: string;
  taskId: string;
  recurrencePattern: RecurrencePattern;
  recurrenceInterval: number; // For custom patterns
  nextOccurrence: Date;
  endOfRecurrence?: Date;
  
  // Computed/derived fields
  task?: Task;
}
```

**Tables & notes**
- `task_recurrences` – only used for habit tasks (`type = 'habit'`).
- Tracks recurrence pattern and generates future task instances.
- `recurrence_interval` is used for custom patterns (e.g., every 3 days).
- `next_occurrence` tracks when the next instance should be generated.

### 6. CompletionLog
**Primary key:** `id` **Foreign keys:** `userId`, `taskId`

```typescript
type DifficultyRating = 1 | 2 | 3 | 4 | 5;

type TimingStatus = 'early' | 'on_time' | 'late';

interface CompletionLog {
  id: string;
  userId: string;
  taskId: string;
  completedAt: Date;
  difficultyRating?: DifficultyRating; // 1-5, optional
  timingStatus: TimingStatus; // Calculated based on effectiveDueDate
  recoveredCompletion: boolean; // True if task was recovered before completion
  penaltyApplied: boolean; // True if half XP was applied (recovered + late)
  xpEarned: number; // XP calculated: base (difficulty * 100) or half if penalty applied
  createdAt: Date;
}
```

**Table & notes**
- `completion_logs` – unique composite index on `(user_id, task_id)` so each user logs once per task instance.
- Index `(user_id, completed_at)` to power streak queries and `(task_id)` for joins.
- `timing_status` is calculated when the task is completed: `early` (before due date), `on_time` (on due date), or `late` (after due date).
- `recovered_completion` indicates if the task was recovered (archived then reactivated) before completion.
- `penalty_applied` is true when a recovered task is completed late, resulting in half XP.
- `xp_earned` stores the calculated XP: base is `difficulty_rating * 100`, or half if `penalty_applied` is true.

### 7. Notification
**Primary key:** `id` **Foreign keys:** optional `taskId`, `projectId`

```typescript
type NotificationType =
  | 'task_initiated'
  | 'task_accepted'
  | 'task_declined'
  | 'task_completed'
  | 'task_recovered'
  | 'task_deleted'
  | 'task_overdue'
  | 'role_changed'
  | 'participant_removed'
  | 'project_joined'
  | 'project_left'
  | 'streak_reminder';

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  taskId?: string;
  projectId?: string;
  createdAt: Date;
  isRead: boolean;
  emailSent: boolean; // Required, not optional
}
```

**Table & notes**
- `notifications` – index `(user_id, is_read, created_at)` for inbox queries.
- `email_sent` flag (required boolean) prevents duplicate transactional emails.
- Notifications can be marked as read without deletion (persistent history).

## Normalization summary
- **Normalized tables:** `users`, `user_stats`, `projects`, `project_participants`, `tasks`, `task_statuses` (replaces `task_assignments`), `task_recurrences`, `completion_logs`, `notifications`.
- **Denormalized convenience fields (frontend only):** `Project.participants`, `Project.participantRoles`, `Project.completedTasks`, `Project.progress`, `Task.taskStatuses`, `Task.recurrence`, `TaskStatusEntity.user`, `TaskStatusEntity.task`, `ProjectParticipant.user`.
- **Helper functions** in `src/lib/mockData.ts` still simulate joins (`populateProjectParticipants`, `getTodayTasks`, etc.) until the Supabase-backed API replaces them.
- **Date handling:** All due dates are date-only (no time component). Use `normalizeToStartOfDay()` utility to ensure consistency.

## Backend readiness checklist
- [ ] Create SQL schema & migrations mirroring the interfaces above (use Supabase migrations).
- [ ] Seed enums (`project_role`, `task_status_user_status`, `task_status`, `task_type`, `recurrence_pattern`, `timing_status`, `ring_color`, `notification_type`).
- [ ] Enforce task status transitions service-side; prevent skipping straight to `completed`.
- [ ] Implement XP calculation: `base_xp = difficulty_rating * 100`, `xp_earned = penalty_applied ? base_xp / 2 : base_xp`.
- [ ] Auto-assign tasks to all project participants on creation (no assignment flow).
- [ ] Calculate `timing_status` on completion: compare `completed_at` with `effective_due_date`.
- [ ] Calculate `ring_color` based on completion timing and recovery status.
- [ ] Emit notifications + email events on task creation, completion, recovery, etc.
- [ ] Add pagination/filtering to project, task, notification lists.
- [ ] Ensure all due dates are stored as date-only (no time component).

## Proposed API surface
```
GET    /api/users/:id
GET    /api/users/:id/stats
GET    /api/projects
POST   /api/projects
GET    /api/projects/:id
PUT    /api/projects/:id
GET    /api/projects/:id/tasks
GET    /api/tasks
POST   /api/tasks                    # Auto-assigns to all project participants
GET    /api/tasks/:id
PUT    /api/tasks/:id
PUT    /api/tasks/:id/complete       # Creates CompletionLog, updates TaskStatusEntity
PUT    /api/tasks/:id/recover       # Recovers archived task (sets recoveredAt)
GET    /api/tasks/today
GET    /api/task-statuses           # Get all task statuses (replaces task-assignments)
GET    /api/task-statuses/:id
PUT    /api/task-statuses/:id        # Update status, ringColor, etc.
GET    /api/completion-logs
POST   /api/completion-logs
GET    /api/notifications
PUT    /api/notifications/:id/read   # Mark as read (does not delete)
```

## Rolling out the real database
1. **Stand up Supabase.** Create a project, add `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` to `.env.local` and `.env` for scripts.
2. **Run migrations.** Use `database/index.ts` to push schema + seed data via the Supabase service client.
3. **Swap data layer.** Replace `src/lib/mockData.ts` usage with React Query hooks that call Supabase SQL/RPC endpoints.
4. **Backfill stats.** Move local completion history into `completion_logs`, then recompute `user_stats`.
5. **Enable notifications/email.** Follow `EMAIL_INTEGRATION.md` to wire transactional email; respect `emailSent`.
6. **Gradual cutover.** Keep a feature flag to toggle between mock mode and live mode while stabilizing the API.

## Notes & reminders
- IDs stay as strings on the client, even if Supabase stores them as UUIDs.
- Dates are JavaScript `Date` objects in the mock layer; convert to ISO (`YYYY-MM-DDTHH:mm:ss.sssZ`) over the wire.
- **Due dates are date-only** (no time component). Always use `normalizeToStartOfDay()` utility when creating or comparing dates.
- Difficulty rating is a strict 1–5 integer (optional in CompletionLog).
- **Tasks are auto-assigned** to all project participants on creation (no invitation/acceptance flow).
- Owners delete tasks to end them for everyone. Archiving is per-user (`task_statuses.status = 'archived'`, `archived_at` set).
- Recovered tasks have `recovered_at` set and `status = 'active'`; they earn half XP if completed late.
- Ring colors provide visual feedback: `green` (on-time completion), `yellow` (recovered task), `red` (expired/archived), `none` (default).
- XP calculation: base is `difficulty_rating * 100`, or half if `penalty_applied` (recovered + late completion).
- Task visibility = project membership + task status rows, so keep participant data accurate.
- Notifications are marked as read but never deleted (persistent history).

Once the remote DB is live, keep this document updated so designers, engineers, and future contributors always know the “source of truth” for how data is shaped and why.
