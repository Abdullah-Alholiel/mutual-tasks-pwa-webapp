# Database Foundation & Data Model

This document is the contract between the current front-end mocks and the future remote database. Every TypeScript interface in `src/types/index.ts` mirrors these tables so we can swap mock data for API calls without rewriting the UI.

> **Status:** The app still runs on local mock data. Everything below prepares us for a hosted relational database (PostgreSQL, Supabase, Planetscale, etc.) once we are ready to turn it on.

## Entity relationship overview
```
User (1) ──< (N) Project    (ownerId) + (participants via junction table)
User (1) ──< (N) Task       (creatorId, assigneeId, initiatedByUserId)
Project (1) ──< (N) Task
Task (1) ──< (N) CompletionLog   (one row per user per task)
User (1) ──< (N) Notification
```

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
  stats: UserStats;
}

interface UserStats {
  totalCompletedTasks: number;
  currentStreak: number;
  longestStreak: number;
  score: number;
}
```

**Tables & notes**
- `users` – columns mirror the interface. Store timezone in IANA format (e.g., `America/Los_Angeles`).
- `user_stats` – either a materialized view or table joined by `user_id`. Keeping stats denormalized makes leaderboards instant.

### 2. Project
**Primary key:** `id` **Foreign key:** `ownerId → users.id`

```typescript
interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  participantIds: string[];
  totalTasksPlanned: number;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  color?: string;
  participants?: User[];
  completedTasks?: number;
  progress?: number;
}
```

**Tables & notes**
- `projects` – store scalar fields plus `is_public` (bool) and optional `color`.
- `project_participants` – junction table with `(project_id, user_id)` composite key.
- Derived fields (`participants`, `completedTasks`, `progress`) are handled in queries/DTOs, not stored.

### 3. Task
**Primary key:** `id` **Foreign keys:** `projectId`, `creatorId`, `assigneeId`, `initiatedByUserId`

```typescript
type TaskStatus =
  | 'draft'
  | 'initiated'
  | 'pending_acceptance'
  | 'time_proposed'
  | 'accepted'
  | 'completed';

interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  creatorId: string;
  assigneeId: string;
  type: 'one_off' | 'recurring';
  recurrencePattern?: 'daily' | 'weekly' | 'custom';
  status: TaskStatus;
  initiatedAt?: Date;
  acceptedAt?: Date;
  completedAt?: Date;
  dueDate?: Date;
  proposedDueDate?: Date;
  proposedByUserId?: string;
  initiatedByUserId: string;
  isMirrorCompletionVisible: boolean;
  completions: Record<string, {
    completed: boolean;
    completedAt?: Date;
    difficultyRating?: DifficultyRating;
  }>;
  createdAt?: Date; // Legacy alias for initiatedAt
  difficultyRating?: DifficultyRating; // Legacy convenience field
}
```

**Tables & notes**
- `tasks` table keeps every scalar field including `proposed_due_date` + `proposed_by_user_id`.
- Enums: `task_status`, `task_type`, `recurrence_pattern`.
- Store `is_mirror_completion_visible` so both users can see each other’s progress.
- The UI keeps a `completions` map for convenience, but the source of truth lives in `completion_logs`.

**Status flow**
```
draft → initiated → pending_acceptance → time_proposed → accepted → completed
        ↘ (decline) -> archived (future)  ↘ (if new time rejected) -> pending_acceptance
```

### 4. CompletionLog
**Primary key:** `id` **Foreign keys:** `userId`, `taskId`

```typescript
interface CompletionLog {
  id: string;
  userId: string;
  taskId: string;
  completedAt: Date;
  difficultyRating?: DifficultyRating; // 1-10 scale
}
```

**Table & notes**
- `completion_logs` – unique composite index on `(user_id, task_id)` so each user logs once per task instance.
- Index `(user_id, completed_at)` to power streak queries and `(task_id)` for fast joins back to tasks.
- Difficulty data feeds the score algorithm in `UserStats`.

### 5. Notification
**Primary key:** `id` **Foreign keys:** optional `taskId`, `projectId`

```typescript
type NotificationType =
  | 'task_initiated'
  | 'task_accepted'
  | 'task_declined'
  | 'task_time_proposed'
  | 'task_completed'
  | 'streak_reminder'
  | 'project_joined';

interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  taskId?: string;
  projectId?: string;
  createdAt: Date;
  isRead: boolean;
  emailSent?: boolean;
}
```

**Table & notes**
- `notifications` – index `(user_id, is_read, created_at)` for inbox queries.
- `email_sent` flag ensures we do not fire duplicate transactional emails.

## Normalization summary
- **Normalized tables:** `users`, `user_stats`, `projects`, `project_participants`, `tasks`, `completion_logs`, `notifications`.
- **Denormalized convenience fields (frontend only):** `Project.participants`, `Project.completedTasks`, `Task.completions`, `Task.createdAt`.
- **Bridging helper functions:** `populateProjectParticipants`, `mapTaskStatusForUI`, `getTodayTasks`, and `getProjectTasks` inside `src/lib/mockData.ts` simulate JOINs until the API replaces them.

## Backend readiness checklist
- [ ] Create SQL schema & migrations mirroring the interfaces above.
- [ ] Seed lookup enums (`task_status`, `recurrence_pattern`, `notification_type`).
- [ ] Implement REST (or tRPC/GraphQL) endpoints listed below with proper validation.
- [ ] Enforce status transitions in the service layer (e.g., cannot jump from `draft` to `completed`).
- [ ] Calculate/compress stats service-side: streaks, total completions, and score.
- [ ] Emit notifications + email events when tasks change state.
- [ ] Add pagination & filtering to all list endpoints (projects, tasks, notifications).
- [ ] Make sure all date fields are stored as UTC timestamps or ISO strings.
- [ ] Document environment variables (database URL, email provider keys, etc.).

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
POST   /api/tasks
GET    /api/tasks/:id
PUT    /api/tasks/:id/accept
PUT    /api/tasks/:id/decline
PUT    /api/tasks/:id/propose-time
PUT    /api/tasks/:id/complete
GET    /api/tasks/today
GET    /api/completion-logs
POST   /api/completion-logs
GET    /api/notifications
PUT    /api/notifications/:id/read
```

## Rolling out the real database
1. **Stand up the DB** – provision PostgreSQL (Supabase, Railway, Neon, etc.) and run the schema above.
2. **Add an API layer** – Node/Express, Nest, Next API routes, or Serverless functions that expose the endpoints.
3. **Swap data hooks** – replace the exports in `src/lib/mockData.ts` with React Query hooks that call the API. The rest of the app already expects promises, so the change is localized.
4. **Migrate statistics** – backfill `completion_logs` from any existing task data, then calculate `user_stats`.
5. **Enable notifications & email** – use `EMAIL_INTEGRATION.md` as the playbook for wiring SendGrid, Resend, or AWS SES. Honor the `emailSent` flag.
6. **Cut over gradually** – keep a feature flag or `.env` switch so teammates can toggle between mock mode and remote mode until the API is battle-tested.

## Notes & reminders
- Keep IDs as strings on the client, even if the DB uses UUID types.
- Dates are JavaScript `Date` objects in the mock layer; convert to ISO (`2025-11-26T12:00:00Z`) over the wire.
- Difficulty rating uses a 1–10 scale (not 1–5) to give us more nuance for streak coaching.
- Mirror-completion visibility lets each partner see if the other has finished; keep it enabled by default.

Once the remote DB is live, this document should stay updated so designers, engineers, and future contributors always know the “source of truth” for how data is shaped and why.