# Database Foundation & Data Model

This document is the contract between the current front-end mocks and the future remote database. Every TypeScript interface in `src/types/index.ts` mirrors these tables so we can swap mock data for API calls without rewriting the UI.

> **Status:** The app still runs on local mock data. Everything below prepares us for a hosted relational database (Supabase/PostgreSQL) once we are ready to turn it on.

## Entity relationship overview
```
User (1) ──< (N) Project             (ownerId)
Project (1) ──< (N) ProjectParticipant (role)
Project (1) ──< (N) Task             (creatorId)
Task (1) ──< (N) TaskAssignment      (userId)
Task (1) ──< (N) TaskTimeProposal    (proposerId)
Task (1) ──< (N) CompletionLog       (userId)
User (1) ──< (N) Notification        (taskId | projectId)
User (1) ──< (1) UserStats           (score derived)
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
  stats: UserStats;
}

interface UserStats {
  totalCompletedTasks: number;
  currentStreak: number;
  longestStreak: number;
  score: number; // basic_score - tardiness_penalty
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
  ownerId: string;
  participantIds: string[]; // mirrors project_participants rows
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
- `projects` – store scalar fields plus `is_public` (bool) and optional `color` for UI accents.
- `project_participants` – junction table with `(project_id, user_id)` composite PK and a `role` enum (`owner | manager | participant`).
- Public/private differences live at the project level and inform which assignments/proposals are allowed.

### 3. Task
**Primary key:** `id` **Foreign keys:** `projectId`, `creatorId`

```typescript
type TaskStatus =
  | 'draft'
  | 'initiated'
  | 'scheduled'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'expired';

type TaskType = 'habit' | 'one_off';

type DifficultyRating = 1 | 2 | 3 | 4 | 5;

interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  creatorId: string;
  type: TaskType;
  status: TaskStatus;
  dueDate: Date; // always set by initiator
  difficultyRating: DifficultyRating;
  createdAt: Date;
  updatedAt: Date;
  assignments: TaskAssignment[]; // hydrated for UI
  timeProposals?: TaskTimeProposal[];
  completions: Record<string, {
    completed: boolean;
    completedAt?: Date;
    difficultyRating?: DifficultyRating;
  }>;
}
```

**Tables & notes**
- `tasks` – includes mandatory `due_date`, `difficulty_rating` (1–5), creator, timestamps, and `type` (`habit` or `one_off`).
- No `assignee_id`; per-user participation is modeled through `task_assignments`.
- Status starts at `draft`, moves to `initiated`, then either `scheduled` / `in_progress`, and can land on `completed`, `cancelled`, or `expired`.
- Time changes happen through `task_time_proposals`; accepted proposals update the task `due_date` and each assignment’s `effective_due_date`.

### 4. TaskAssignment
**Primary key:** `id` **Foreign keys:** `taskId`, `userId`

```typescript
type AssignmentStatus =
  | 'invited'
  | 'active'
  | 'declined'
  | 'completed'
  | 'missed'
  | 'archived';

interface TaskAssignment {
  id: string;
  taskId: string;
  userId: string;
  status: AssignmentStatus;
  isRequired: boolean;
  effectiveDueDate: Date;
  archivedAt?: Date;
  recoveredAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

**Tables & notes**
- `task_assignments` replaces `assigneeId` and tracks each participant’s state/history.
- `(task_id, user_id)` is unique to prevent duplicates.
- Archiving is per-user only; owners delete tasks globally instead of archiving.

### 5. TaskTimeProposal
**Primary key:** `id` **Foreign keys:** `taskId`, `proposerId`

```typescript
type ProposalStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

interface TaskTimeProposal {
  id: string;
  taskId: string;
  proposerId: string;
  proposedDueDate: Date;
  status: ProposalStatus;
  createdAt: Date;
  respondedAt?: Date;
}
```

**Tables & notes**
- Only available for private projects.
- Each proposal captures who asked, the new time, and when it was handled.

### 6. CompletionLog
**Primary key:** `id` **Foreign keys:** `userId`, `taskId`

```typescript
interface CompletionLog {
  id: string;
  userId: string;
  taskId: string;
  completedAt: Date;
  difficultyRating: DifficultyRating; // 1-5
}
```

**Table & notes**
- `completion_logs` – unique composite index on `(user_id, task_id)` so each user logs once per task instance.
- Index `(user_id, completed_at)` to power streak queries and `(task_id)` for joins.

### 7. Notification
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
- `email_sent` flag prevents duplicate transactional emails.

## Normalization summary
- **Normalized tables:** `users`, `user_stats`, `projects`, `project_participants`, `tasks`, `task_assignments`, `task_time_proposals`, `completion_logs`, `notifications`.
- **Denormalized convenience fields (frontend only):** `Project.participants`, `Project.completedTasks`, `Project.progress`, `Task.assignments`, `Task.timeProposals`, `Task.completions`.
- **Helper functions** in `src/lib/mockData.ts` still simulate joins (`populateProjectParticipants`, `getTodayTasks`, etc.) until the Supabase-backed API replaces them.

## Backend readiness checklist
- [ ] Create SQL schema & migrations mirroring the interfaces above (use Supabase migrations).
- [ ] Seed enums (`project_role`, `assignment_status`, `proposal_status`, `task_status`, `task_type`).
- [ ] Enforce task status transitions service-side; prevent skipping straight to `completed`.
- [ ] Implement scoring in the service layer: `score = basic_score - tardiness_penalty` (no recovery bonus).
- [ ] Ensure project privacy rules gate assignments & time proposals.
- [ ] Emit notifications + email events on assignment changes.
- [ ] Add pagination/filtering to project, task, notification lists.

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
GET    /api/task-assignments/:id
PUT    /api/task-assignments/:id/archive
GET    /api/completion-logs
POST   /api/completion-logs
GET    /api/notifications
PUT    /api/notifications/:id/read
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
- Difficulty rating is a strict 1–5 integer everywhere (tasks + completion logs).
- Owners delete tasks to end them for everyone. Archiving is per assignment (`task_assignments.status = 'archived'`).
- Every task starts with an initial `due_date`; proposals only reschedule.
- Task visibility = project membership + assignment rows, so keep participant data accurate.

Once the remote DB is live, keep this document updated so designers, engineers, and future contributors always know the “source of truth” for how data is shaped and why.
