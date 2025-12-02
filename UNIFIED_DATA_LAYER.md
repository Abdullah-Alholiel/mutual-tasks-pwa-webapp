# Unified Data Access Layer

## Overview

The application now uses a **single set of types** and a **unified data access layer** that works seamlessly with both Supabase and mock data. Components never see database-specific formats - they always work with camelCase types and Date objects.

## Key Improvements

### ✅ Single Source of Truth
- **One set of types** (`src/types/index.ts`) - no duplicate `*Row` types
- All types use **camelCase** and **Date objects** for optimal frontend DX
- Types match the ERD exactly

### ✅ Unified API
- **Same interface** for both Supabase and mock data
- Components use `db.getUser()`, `db.getTasks()`, etc. regardless of data source
- Automatic transformation happens internally

### ✅ Tree-shakeable & Optimized
- Only imports what's needed
- Mock client can be completely removed in production builds
- Minimal bundle size impact

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Components                           │
│  (Use: User, Task, Project - camelCase, Date)         │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│              Unified Data Access Layer                   │
│                  (src/lib/db.ts)                         │
│  - DatabaseClient interface                             │
│  - MockDatabaseClient (development)                     │
│  - SupabaseDatabaseClient (production)                  │
│  - Internal transformations (snake_case ↔ camelCase)    │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
┌─────────────────┐    ┌──────────────────┐
│   Mock Data     │    │    Supabase      │
│  (mockData.ts)  │    │  (snake_case,    │
│                 │    │   ISO strings)   │
└─────────────────┘    └──────────────────┘
```

## Usage

### In Components

```typescript
import { db } from '@/lib/db';
import { User, Task } from '@/types';

// Same API whether using Supabase or mocks
const user = await db.getUser(userId);
const tasks = await db.getTasks({ projectId: 'p1' });
const project = await db.getProject(projectId);

// All return types are camelCase with Date objects
user.createdAt.toLocaleDateString(); // ✅ Works
task.originalDueDate.getTime();      // ✅ Works
```

### Type Safety

```typescript
import type { User, Task, Project } from '@/types';

// Components only import frontend types
function UserProfile({ user }: { user: User }) {
  // TypeScript ensures correct types
  const joined = user.createdAt.toLocaleDateString();
  return <div>Joined: {joined}</div>;
}
```

## Data Access Methods

### Users
```typescript
db.getUser(id: string): Promise<User | null>
db.getUserStats(userId: string): Promise<UserStats | null>
```

### Projects
```typescript
db.getProjects(filters?: { userId?: string; isPublic?: boolean }): Promise<Project[]>
db.getProject(id: string): Promise<Project | null>
db.createProject(data): Promise<Project>
db.updateProject(id: string, data: Partial<Project>): Promise<Project>
```

### Tasks
```typescript
db.getTasks(filters?: { projectId?: string; userId?: string; status?: TaskStatus }): Promise<Task[]>
db.getTask(id: string): Promise<Task | null>
db.createTask(data): Promise<Task>
db.updateTask(id: string, data: Partial<Task>): Promise<Task>
```

### Notifications
```typescript
db.getNotifications(userId: string, filters?: { isRead?: boolean }): Promise<Notification[]>
db.markNotificationRead(id: string): Promise<void>
```

### Task Status
```typescript
db.getTaskStatuses(taskId: string): Promise<TaskStatusEntity[]>
db.updateTaskStatus(id: string, data: Partial<TaskStatusEntity>): Promise<TaskStatusEntity>
```

## Internal Transformations

The data access layer automatically handles:

1. **Naming**: `created_at` → `createdAt`, `user_id` → `userId`
2. **Dates**: ISO strings → Date objects
3. **Nullability**: `null` → `undefined` for optional fields
4. **Relations**: Joins and nested data are handled automatically

## Configuration

### Using Mock Data (Default)
No configuration needed - works out of the box.

### Using Supabase
Set environment variables:
```bash
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_USE_SUPABASE=true
```

The client automatically detects Supabase configuration and switches from mock to real data.

## Migration from Old Code

### Before (Old Pattern)
```typescript
// Had to import both types
import { User, UserRow } from '@/types';
import { userRowToUser } from '@/lib/dbTransform';

// Manual transformation
const { data } = await supabase.from('users').select('*').single();
const user = userRowToUser(data as UserRow);
```

### After (New Pattern)
```typescript
// Single import
import { User } from '@/types';
import { db } from '@/lib/db';

// Automatic transformation
const user = await db.getUser(userId);
```

## Benefits

1. **Simpler Code**: Components only see one set of types
2. **Type Safety**: TypeScript ensures consistency
3. **Easy Testing**: Mock client works identically to Supabase
4. **Performance**: Tree-shakeable, only loads what's needed
5. **Maintainability**: Single source of truth for types
6. **Flexibility**: Switch between mock and Supabase with env vars

## File Structure

```
src/
  types/
    index.ts          # Single set of types (camelCase, Date)
  lib/
    db.ts            # Unified data access layer
    mockData.ts      # Mock data (development)
database/
  supabaseClient.ts  # Supabase client setup
```

## Summary

✅ **No duplicate types** - Single source of truth  
✅ **Unified API** - Same interface for mocks and Supabase  
✅ **Automatic transformations** - Handled internally  
✅ **Tree-shakeable** - Optimized for production  
✅ **Type-safe** - Full TypeScript support  
✅ **Easy migration** - Drop-in replacement for old code  

Components now have a clean, consistent API that works seamlessly with both development mocks and production Supabase.

