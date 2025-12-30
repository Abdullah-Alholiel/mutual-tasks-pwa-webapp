# Database Layer - Modular Architecture

This directory contains a production-ready, modular database access layer for Supabase. All data operations connect directly to your remote Supabase database.

## Architecture

The database layer is split into focused modules:

```
src/db/
├── transformers.ts    # DB ↔ Frontend type transformations
├── users.ts           # User CRUD operations
├── projects.ts        # Project CRUD operations
├── tasks.ts           # Task CRUD operations
├── taskStatus.ts      # TaskStatus CRUD operations
├── completionLogs.ts  # CompletionLog CRUD operations
├── notifications.ts   # Notification CRUD operations
├── index.ts           # Main client factory and exports
└── db.ts              # Backward compatibility export
```

## Usage

### Basic Usage

```typescript
import { db } from '@/db';

// Access repositories through the db client
const user = await db.users.getById(123);
const projects = await db.projects.getAll({ userId: 123 });
const tasks = await db.tasks.getAll({ projectId: 456 });
```

### Repository Pattern

Each entity has its own repository with full CRUD operations:

#### Users Repository

```typescript
// Get user by ID
const user = await db.users.getById(userId);

// Get user stats
const stats = await db.users.getStats(userId);

// Create user
const newUser = await db.users.create({
  name: 'John Doe',
  handle: '@johndoe',
  email: 'john@example.com',
  // ... other fields
});

// Update user
const updated = await db.users.update(userId, { name: 'Jane Doe' });

// Search users
const results = await db.users.search('john');
```

#### Projects Repository

```typescript
// Get project with participants
const project = await db.projects.getById(projectId);

// Get all projects with filters
const myProjects = await db.projects.getAll({ userId: 123 });
const publicProjects = await db.projects.getAll({ isPublic: true });

// Create project
const newProject = await db.projects.create({
  name: 'My Project',
  description: 'Project description',
  ownerId: 123,
  // ... other fields
});

// Add participant
await db.projects.addParticipant(projectId, userId, 'participant');

// Update participant role
await db.projects.updateParticipantRole(projectId, userId, 'manager');

// Remove participant
await db.projects.removeParticipant(projectId, userId);
```

#### Tasks Repository

```typescript
// Get task with statuses and recurrence
const task = await db.tasks.getById(taskId);

// Get all tasks with filters
const projectTasks = await db.tasks.getAll({ projectId: 123 });
const userTasks = await db.tasks.getAll({ userId: 456 });

// Create task
const newTask = await db.tasks.create({
  title: 'Complete task',
  description: 'Task description',
  projectId: 123,
  creatorId: 456,
  type: 'one_off',
  dueDate: new Date(),
});

// Update task
await db.tasks.update(taskId, { title: 'Updated title' });

// Delete task (cascades to related records)
await db.tasks.delete(taskId);
```

#### TaskStatus Repository

```typescript
// Get task statuses for a task
const statuses = await db.taskStatus.getByTaskId(taskId);

// Get task status for specific user
const userStatus = await db.taskStatus.getByTaskAndUser(taskId, userId);

// Create task status
await db.taskStatus.create({
  taskId: 123,
  userId: 456,
  status: 'active',
});

// Create multiple statuses (assign task to multiple users)
await db.taskStatus.createMany([
  { taskId: 123, userId: 456, status: 'active' },
  { taskId: 123, userId: 789, status: 'active' },
]);

// Update task status
await db.taskStatus.update(statusId, { status: 'completed' });

// Upsert by task and user
await db.taskStatus.updateByTaskAndUser(taskId, userId, {
  status: 'archived',
  archivedAt: new Date(),
});
```

#### CompletionLogs Repository

```typescript
// Get completion logs
const logs = await db.completionLogs.getAll({ userId: 123 });
const taskLogs = await db.completionLogs.getAll({ taskId: 456 });

// Check if task is completed
const isCompleted = await db.completionLogs.isCompleted(taskId, userId);

// Create completion log
await db.completionLogs.create({
  userId: 123,
  taskId: 456,
  difficultyRating: 3,
  penaltyApplied: false,
  xpEarned: 300,
});

// Get user stats
const stats = await db.completionLogs.getUserStats(userId);
```

#### Notifications Repository

```typescript
// Get notifications for user
const notifications = await db.notifications.getByUserId(userId, {
  isRead: false,
  limit: 20,
});

// Get unread count
const unreadCount = await db.notifications.getUnreadCount(userId);

// Create notification
await db.notifications.create({
  userId: 123,
  type: 'task_completed',
  message: 'Task completed!',
  taskId: 456,
});

// Mark as read
await db.notifications.markAsRead(notificationId);
await db.notifications.markAllAsRead(userId);
```

## Type Transformations

The `transformers.ts` module handles all conversions between:
- **Database format**: snake_case, string IDs, ISO date strings
- **Frontend format**: camelCase, number IDs, Date objects

All transformations are automatic - you never need to manually convert types.

## Environment Configuration

The database client requires Supabase configuration:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Required:** Both environment variables must be set. The client will throw an error if they're missing.

## Initialization

### Option 1: Lazy Initialization (Automatic)

The client initializes automatically when first accessed:

```typescript
import { db } from '@/db';

// Automatically initializes using environment variables
const user = await db.users.getById(123);
```

### Option 2: Explicit Initialization (Recommended)

For better error handling, initialize at app startup:

```typescript
// In main.tsx or App.tsx
import { createClient } from '@supabase/supabase-js';
import { initializeDatabase } from '@/db';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

initializeDatabase(supabase);

// Now db is ready to use
import { db } from '@/db';
```

## Error Handling

All repository methods throw errors that should be caught:

```typescript
try {
  const user = await db.users.getById(userId);
} catch (error) {
  console.error('Failed to fetch user:', error);
  // Handle error
}
```

## Best Practices

1. **Always use the repository pattern** - Don't access Supabase directly
2. **Handle errors** - Wrap database calls in try-catch blocks
3. **Use filters** - Leverage repository filter options for efficient queries
4. **Batch operations** - Use `createMany` methods when creating multiple records
5. **Type safety** - All methods are fully typed with TypeScript

## Migration from Old Code

If you have code using the old `db.ts` interface, it will continue to work due to backward compatibility. However, you should migrate to the new repository pattern:

**Old:**
```typescript
const user = await db.getUser(userId);
```

**New:**
```typescript
const user = await db.users.getById(userId);
```

## Adding New Entities

To add a new entity:

1. Create a new repository file (e.g., `newEntity.ts`)
2. Add transformation functions to `transformers.ts`
3. Initialize the repository in `index.ts`
4. Export it from the `DatabaseClient` interface

