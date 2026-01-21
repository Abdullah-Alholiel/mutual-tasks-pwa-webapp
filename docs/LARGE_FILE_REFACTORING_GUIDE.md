# Large File Refactoring - Implementation Guide

**Date**: January 20, 2026
**Status**: Ready for Implementation
**Priority**: High

---

## Overview

This document provides detailed refactoring plans for splitting large files into smaller, maintainable modules.

---

## File 1: useProjectTaskMutations.ts (815 lines)

### Current Structure

The file contains a single hook with 6 handler functions:

```typescript
export const useProjectTaskMutations = ({
  user,
  projectWithParticipants,
  taskState,
  onTaskFormClose,
}: UseProjectTaskMutationsParams) => {
  // ... 6 handler functions:
  // 1. handleRecover (lines 63-172)
  // 2. handleComplete (lines 173-377)
  // 3. handleCreateTask (lines 378-523)
  // 4. handleDeleteTask (lines 524-578)
  // 5. handleDeleteTaskSeries (lines 579-635)
  // 6. handleUpdateTask (lines 636-815)

  return {
    handleRecover,
    handleComplete,
    handleCreateTask,
    handleDeleteTask,
    handleDeleteTaskSeries,
    handleUpdateTask,
    isLoading: isMutating,
  };
};
```

### Refactoring Plan

#### Step 1: Extract Individual Hooks

**Created** (already):
- `src/features/projects/hooks/useTaskRecovery.ts` ✅

**To Create**:

**1. useTaskCompletion.ts**
```typescript
// Handles task completion with difficulty rating
// Lines 173-377 from original file
export function useTaskCompletion(params) {
  const handleComplete = useCallback(async (taskId: number, difficultyRating?: number) => {
    // Task completion logic
    // - Validate completion
    // - Create completion log
    // - Update task status
    // - Send notifications
  }, [dependencies]);

  return { handleComplete };
}
```

**2. useTaskCreation.ts**
```typescript
// Handles task creation (single and batch)
// Lines 378-523 from original file
export function useTaskCreation(params) {
  const handleCreateTask = useCallback(async (taskData: TaskCreationData) => {
    // Task creation logic
    // - Validate task data
    // - Handle recurring tasks
    // - Create task and statuses
    // - Send notifications
  }, [dependencies]);

  return { handleCreateTask };
}
```

**3. useTaskDeletion.ts**
```typescript
// Handles task deletion (single and series)
// Lines 524-635 from original file
export function useTaskDeletion(params) {
  const handleDeleteTask = useCallback(async (taskId: number) => {
    // Single task deletion logic
  }, [dependencies]);

  const handleDeleteTaskSeries = useCallback(async (series: RecurrentTaskSeries) => {
    // Series deletion logic
  }, [dependencies]);

  return { handleDeleteTask, handleDeleteTaskSeries };
}
```

**4. useTaskUpdate.ts**
```typescript
// Handles task updates
// Lines 636-815 from original file
export function useTaskUpdate(params) {
  const handleUpdateTask = useCallback(async (taskId: number, taskData: TaskCreationData) => {
    // Task update logic
    // - Validate updates
    // - Update task and statuses
    // - Send notifications
  }, [dependencies]);

  return { handleUpdateTask };
}
```

#### Step 2: Simplify Main Hook

**Refactored useProjectTaskMutations.ts**:
```typescript
import { useTaskRecovery } from './useTaskRecovery';
import { useTaskCompletion } from './useTaskCompletion';
import { useTaskCreation } from './useTaskCreation';
import { useTaskDeletion } from './useTaskDeletion';
import { useTaskUpdate } from './useTaskUpdate';

export const useProjectTaskMutations = (params) => {
  const { handleRecover } = useTaskRecovery(params);
  const { handleComplete } = useTaskCompletion(params);
  const { handleCreateTask } = useTaskCreation(params);
  const { handleDeleteTask, handleDeleteTaskSeries } = useTaskDeletion(params);
  const { handleUpdateTask } = useTaskUpdate(params);

  return {
    handleRecover,
    handleComplete,
    handleCreateTask,
    handleDeleteTask,
    handleDeleteTaskSeries,
    handleUpdateTask,
    isLoading: isMutating,
  };
};
```

**Expected Result**: ~150-200 lines (down from 815)

---

## File 2: ProjectDetail.tsx (1,177 lines)

### Current Structure

```typescript
const ProjectDetail = () => {
  // 50+ state variables
  const { project, ... } = useProjectDetail();
  const { handleRecover, ... } = useProjectTaskMutations(...);

  return (
    <div>
      {/* UI mixed with business logic */}
      {/* - Header section */}
      {/* - Stats section */}
      {/* - Tasks section (tabs) */}
      {/* - Dialogs and forms */}
    </div>
  );
};
```

### Refactoring Plan

#### Step 1: Extract UI Components

**1. ProjectDetailHeader.tsx** (~150 lines)
```typescript
// Project name, icon, member count
// Edit project button, leave project button
// Delete project button
export function ProjectDetailHeader({ project, ... }) { ... }
```

**2. ProjectTaskList.tsx** (~250 lines)
```typescript
// Task list with sections (active, upcoming, completed, archived)
// Each section is a component
export function ProjectTaskList({ tasks, ... }) { ... }
```

**3. ProjectTaskSection.tsx** (~100 lines)
```typescript
// Individual task section (e.g., "Active Tasks")
// Shows tasks with filters
export function ProjectTaskSection({ title, tasks, ... }) { ... }
```

**4. ProjectDialogs.tsx** (~200 lines)
```typescript
// All dialogs consolidated:
// - Add member dialog
// - Edit project dialog
// - Leave project dialog
// - Delete project dialog
export function ProjectDialogs({ project, ... }) { ... }
```

#### Step 2: Extract Logic Hooks

**1. useProjectDialogState.ts** (~80 lines)
```typescript
// Dialog open/close state management
export function useProjectDialogState() {
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [showEditProjectForm, setShowEditProjectForm] = useState(false);
  const [showLeaveProjectDialog, setShowLeaveProjectDialog] = useState(false);
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);
  const [showMembersDialog, setShowMembersDialog] = useState(false);

  return {
    showTaskForm, setShowTaskForm,
    showAddMemberForm, setShowAddMemberForm,
    showEditProjectForm, setShowEditProjectForm,
    showLeaveProjectDialog, setShowLeaveProjectDialog,
    showDeleteProjectDialog, setShowDeleteProjectDialog,
    showMembersDialog, setShowMembersDialog,
  };
}
```

**2. useProjectMemberIdentifier.ts** (~40 lines)
```typescript
// Member identifier search logic
export function useProjectMemberIdentifier(participants) {
  const [memberIdentifier, setMemberIdentifier] = useState('');

  return { memberIdentifier, setMemberIdentifier };
}
```

#### Step 3: Simplified ProjectDetail.tsx

```typescript
import { ProjectDetailHeader } from './ProjectDetailHeader';
import { ProjectTaskList } from './ProjectTaskList';
import { ProjectDialogs } from './ProjectDialogs';
import { useProjectDialogState } from './useProjectDialogState';

const ProjectDetail = () => {
  const { project, tasks, ... } = useProjectDetail();
  const { handleRecover, ... } = useProjectTaskMutations(...);
  const dialogs = useProjectDialogState();

  return (
    <div className="project-detail">
      <ProjectDetailHeader project={project} dialogs={dialogs} />
      <ProjectStats {...} />
      <ProjectTaskList tasks={tasks} {...} />
      <ProjectDialogs {...dialogs} project={project} />
    </div>
  );
};
```

**Expected Result**: ~250-300 lines (down from 1,177)

---

## File 3: Auth.tsx (752 lines)

### Current Structure

```typescript
const Auth = () => {
  // Multiple authentication flows
  // - Login
  // - Signup
  // - Magic link verification
  // - Password reset
  // - Email verification
  // - OAuth (if present)
  // - Error handling

  return (
    <div>
      {/* All auth forms in one file */}
    </div>
  );
};
```

### Refactoring Plan

#### Step 1: Extract Auth Forms

**1. LoginForm.tsx** (~100 lines)
```typescript
export function LoginForm({ onSuccess, onError, ... }) { ... }
```

**2. SignupForm.tsx** (~120 lines)
```typescript
export function SignupForm({ onSuccess, onError, ... }) { ... }
```

**3. MagicLinkForm.tsx** (~80 lines)
```typescript
export function MagicLinkForm({ onSuccess, onError, ... }) { ... }
```

**4. VerifyEmailForm.tsx** (~80 lines)
```typescript
export function VerifyEmailForm({ code, ... }) { ... }
```

#### Step 2: Extract Auth Logic

**1. useAuthenticationFlow.ts** (~150 lines)
```typescript
// Handles auth state transitions
export function useAuthenticationFlow() { ... }
```

**2. useAuthErrorHandler.ts** (~60 lines)
```typescript
// Centralized auth error handling
export function useAuthErrorHandler() { ... }
```

#### Step 3: Simplified Auth.tsx

```typescript
import { LoginForm } from './LoginForm';
import { SignupForm } from './SignupForm';
import { MagicLinkForm } from './MagicLinkForm';
import { VerifyEmailForm } from './VerifyEmailForm';
import { useAuthenticationFlow } from './useAuthenticationFlow';

const Auth = () => {
  const { authState, ... } = useAuthenticationFlow();

  switch (authState.mode) {
    case 'login':
      return <LoginForm {...} />;
    case 'signup':
      return <SignupForm {...} />;
    case 'magic':
      return <MagicLinkForm {...} />;
    case 'verify':
      return <VerifyEmailForm {...} />;
    default:
      return <div>...</div>;
  }
};
```

**Expected Result**: ~150-200 lines (down from 752)

---

## File 4: Index.tsx (743 lines)

### Current Structure

```typescript
const Index = () => {
  // Dashboard with:
  // - Today's tasks
  // - User stats
  // - Project list
  // - Quick actions
  // - Greeting/onboarding

  return (
    <div>
      {/* Dashboard UI mixed with business logic */}
    </div>
  );
};
```

### Refactoring Plan

#### Step 1: Extract Dashboard Components

**1. UserGreeting.tsx** (~80 lines)
```typescript
// Welcome message, date display
export function UserGreeting({ user, date, ... }) { ... }
```

**2. TodayTasksSection.tsx** (~150 lines)
```typescript
// Today's tasks with filters
export function TodayTasksSection({ tasks, ... }) { ... }
```

**3. UserStatsDashboard.tsx** (~120 lines)
```typescript
// Statistics cards (completed, streak, etc.)
export function UserStatsDashboard({ stats, ... }) { ... }
```

**4. QuickActions.tsx** (~80 lines)
```typescript
// Quick action buttons (create task, create project)
export function QuickActions({ ... }) { ... }
```

**5. OnboardingGuide.tsx** (~100 lines)
```typescript
// Onboarding steps for new users
export function OnboardingGuide({ ... }) { ... }
```

#### Step 2: Simplified Index.tsx

```typescript
import { UserGreeting } from './UserGreeting';
import { TodayTasksSection } from './TodayTasksSection';
import { UserStatsDashboard } from './UserStatsDashboard';
import { QuickActions } from './QuickActions';
import { OnboardingGuide } from './OnboardingGuide';

const Index = () => {
  const { user, stats, tasks, ... } = useDashboard();

  return (
    <div className="dashboard">
      <UserGreeting user={user} />
      <QuickActions />
      <TodayTasksSection tasks={tasks} />
      <UserStatsDashboard stats={stats} />
      <OnboardingGuide user={user} />
    </div>
  );
};
```

**Expected Result**: ~150-200 lines (down from 743)

---

## File 5: TaskCard.tsx (704 lines)

### Current Structure

```typescript
export const TaskCard = ({ task, ... }) => {
  // All task interactions in one component:
  // - Display
  // - Checkbox
  // - Difficulty rating
  // - Recovery button
  // - Delete button
  // - Edit button
  // - Expand/collapse
  // - Recurring indicator
  // - Avatar display

  return (
    <div>
      {/* Complex UI mixed with interaction logic */}
    </div>
  );
};
```

### Refactoring Plan

#### Step 1: Extract Task Card Subcomponents

**1. TaskCardHeader.tsx** (~100 lines)
```typescript
// Title, assignee, date, recurring indicator
export function TaskCardHeader({ task, ... }) { ... }
```

**2. TaskCardActions.tsx** (~150 lines)
```typescript
// All action buttons (complete, edit, delete, recover, etc.)
export function TaskCardActions({ task, ... }) { ... }
```

**3. TaskCardDifficulty.tsx** (~80 lines)
```typescript
// Difficulty rating dialog and display
export function TaskCardDifficulty({ task, ... }) { ... }
```

**4. TaskCardStatus.tsx** (~100 lines)
```typescript
// Checkbox, ring color, status indicator
export function TaskCardStatus({ task, ... }) { ... }
```

#### Step 2: Simplified TaskCard.tsx

```typescript
import { TaskCardHeader } from './TaskCardHeader';
import { TaskCardActions } from './TaskCardActions';
import { TaskCardDifficulty } from './TaskCardDifficulty';
import { TaskCardStatus } from './TaskCardStatus';

export const TaskCard = ({ task, ... }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="task-card">
      <TaskCardStatus task={task} />
      <TaskCardHeader task={task} />
      {isExpanded && (
        <>
          <TaskCardDifficulty task={task} />
          <TaskCardActions task={task} />
        </>
      )}
    </div>
  );
};
```

**Expected Result**: ~150-200 lines (down from 704)

---

## Benefits of Refactoring

### Maintainability
- ✅ **Smaller files** are easier to understand
- ✅ **Clear responsibilities** per component/hook
- ✅ **Faster navigation** in IDE
- ✅ **Easier testing** (smaller scope)

### Performance
- ✅ **Better code splitting** (smaller bundles)
- ✅ **Lazy loading** possible for large sections
- ✅ **Reduced re-renders** (isolated components)

### Developer Experience
- ✅ **Faster onboarding** for new developers
- ✅ **Clearer error messages** (narrow scope)
- ✅ **Easier reviews** (smaller PRs)

### Testing
- ✅ **Easier unit tests** (small, focused functions)
- ✅ **Better test coverage** (clear boundaries)
- ✅ **Faster test runs** (smaller files)

---

## Implementation Priority

### Phase 1: Critical (1-2 days)
1. ✅ **useProjectTaskMutations.ts** → 5 focused hooks
   - Highest complexity reduction
   - Already started (useTaskRecovery created)

### Phase 2: High (2-3 days)
2. **ProjectDetail.tsx** → 5-6 components
   - Most complex UI component
   - Significant readability improvement

### Phase 3: Medium (1-2 days each)
3. **TaskCard.tsx** → 4 components
   - Frequently used component
4. **Auth.tsx** → 4-5 components
   - Critical auth flows

### Phase 4: Medium (1-2 days)
5. **Index.tsx** → 5 components
   - Main dashboard page

---

## File Structure After Refactoring

```
src/features/projects/hooks/
├── useProjectTaskMutations.ts          (~200 lines) ← Main orchestrator
├── useTaskRecovery.ts                (created) ✅
├── useTaskCompletion.ts               (to create)
├── useTaskCreation.ts                (to create)
├── useTaskDeletion.ts                (to create)
└── useTaskUpdate.ts                  (to create)

src/features/projects/components/
├── ProjectDetail.tsx                  (~300 lines) ← Main orchestrator
├── ProjectDetailHeader.tsx           (to create)
├── ProjectTaskList.tsx              (to create)
├── ProjectTaskSection.tsx            (to create)
└── ProjectDialogs.tsx               (to create)

src/features/auth/
├── Auth.tsx                         (~200 lines) ← Main orchestrator
├── LoginForm.tsx                    (to create)
├── SignupForm.tsx                   (to create)
├── MagicLinkForm.tsx                (to create)
└── VerifyEmailForm.tsx               (to create)
├── useAuthenticationFlow.ts          (to create)
└── useAuthErrorHandler.ts           (to create)

src/features/pages/
├── Index.tsx                         (~200 lines) ← Main orchestrator
├── UserGreeting.tsx                 (to create)
├── TodayTasksSection.tsx             (to create)
├── UserStatsDashboard.tsx             (to create)
├── QuickActions.tsx                  (to create)
└── OnboardingGuide.tsx               (to create)

src/features/tasks/components/
├── TaskCard.tsx                      (~200 lines) ← Main orchestrator
├── TaskCardHeader.tsx               (to create)
├── TaskCardActions.tsx              (to create)
├── TaskCardDifficulty.tsx           (to create)
└── TaskCardStatus.tsx              (to create)
```

---

## Testing Strategy

For each extracted component/hook:

1. **Unit Tests**:
   - Test pure functions independently
   - Mock external dependencies

2. **Integration Tests**:
   - Test component interactions
   - Test hook side effects

3. **Visual Regression Tests**:
   - Ensure UI looks the same
   - Test responsive behavior

---

## Migration Checklist

For each refactored file:

- [ ] Extract logic into separate file
- [ ] Create component/hook exports
- [ ] Update imports in parent file
- [ ] Simplify parent file
- [ ] Test functionality
- [ ] Update TypeScript types if needed
- [ ] Update documentation

---

## Risk Mitigation

### During Refactoring

1. **Keep original file** until migration verified
2. **Branch per file** refactoring
3. **Automated tests** on each branch
4. **Code review** before merge
5. **Feature flags** for gradual rollout

### Rollback Plan

If issues arise:
```bash
# Revert to original file
git revert HEAD~1

# Or restore from backup
cp useProjectTaskMutations.ts.backup useProjectTaskMutations.ts
```

---

## Success Criteria

After completing all refactorings:

- [ ] All files under 300 lines
- [ ] Clear separation of concerns
- [ ] All components/hooks have single responsibility
- [ ] Build passes without errors
- [ ] All tests pass
- [ ] Linter warnings minimal
- [ ] Code review approved
- [ ] No visual regressions

---

**Estimated Total Effort**: 8-12 days
**Estimated Lines Reduced**: ~4,000 lines (from ~4,200 to ~1,200)
**Estimated Maintainability Improvement**: +300%

---

**Implementation Date**: January 20, 2026
**Status**: Ready for Execution
