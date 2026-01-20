# Resource Not Found / Access Denied Implementation

## Summary
Implemented a unified, modular solution for handling "not found" and "access denied" scenarios across the app, preventing blank pages when users access resources they don't have permission to view.

**IMPORTANT**: Public projects are accessible to all users (members and non-members). Only private projects block non-members.

## Files Created

### `src/components/ui/ResourceNotFound.tsx`
- **Purpose**: Reusable component for displaying consistent "not found" / "access denied" UI
- **Features**:
  - Animated icon and content using framer-motion
  - Tailored messages for each scenario (project, friend, page)
  - Configurable action buttons (default "Go Back" and type-specific actions)
  - Responsive design with proper mobile/desktop support
  - Type-safe with TypeScript

- **Scenarios Handled**:
  | Type | Status | Message | Default Action |
  |------|--------|---------|----------------|
  | project | not_found | "The project you're looking for doesn't exist or has been deleted." | Browse Projects |
  | project | access_denied | "You have left this project or are not a member anymore." | Browse Projects |
  | project | private_project | "This is a private project. You must be a member to view it." | Browse Projects |
  | project | deleted | "This project has been permanently deleted by the owner." | Browse Projects |
  | friend | not_found | "The user profile you're looking for doesn't exist." | Browse Friends |
  | page | not_found | "The page you're looking for doesn't exist or has been moved." | Go Home |

## Files Modified

### 1. `src/features/projects/ProjectDetail.tsx`
**Changes**:
- Added `ResourceNotFound` component import
- Added `HabitSeries` type import for proper typing
- Fixed `Input` component name conflict by importing as `InputComponent`
- **Replaced simple "Project not found" message** with comprehensive checks that respect project privacy:
  ```tsx
  // Before:
  if (!project || !currentProject) {
    return <div>Project not found</div>;
  }
  if (!isParticipant) {
    return <ResourceNotFound type="project" status="access_denied" />;
  }

  // After:
  if (!currentProject) {
    return <ResourceNotFound type="project" status="not_found" />;
  }

  // Only show access denied for private projects when user is not a participant
  // Public projects are accessible to all users
  if (!currentProject.isPublic && !isParticipant) {
    return <ResourceNotFound type="project" status="private_project" entityName={project.name} />;
  }
  ```

**Scenarios Fixed**:
- User tries to access a project that doesn't exist → "Project not found"
- User tries to access a private project they're not a member of → "This is a private project. You must be a member to view it: [Project Name]"
- User tries to access a public project they're not a member of → **Allowed to view** (shown as guest viewer)

### 2. `src/features/pages/NotFound.tsx`
**Changes**:
- Replaced custom 404 UI with `ResourceNotFound` component
- Improved navigation handling with `useNavigate`
- Added proper Go Home action button

**Before**:
```tsx
<div className="flex min-h-[100dvh]...">
  <h1 className="mb-4 text-4xl font-bold">404</h1>
  <a href="/">Return to Home</a>
</div>
```

**After**:
```tsx
<ResourceNotFound
  type="page"
  status="not_found"
  onBack={() => navigate(-1)}
  onAction={() => navigate('/')}
/>
```

### 3. `src/features/friends/pages/FriendProfile.tsx`
**Changes**:
- Added `ResourceNotFound` component import
- **Fixed blank page issue** when friend doesn't exist:
  ```tsx
  // Before:
  if (loadingFriend || !friend) {
    return <PageLoader />;  // Showed loader even when friend not found!
  }

  // After:
  if (loadingFriend) {
    return <PageLoader />;
  }
  if (!friend) {
    return <ResourceNotFound type="friend" status="not_found" />;
  }
  ```

**Scenarios Fixed**:
- User tries to access a non-existent friend profile → "User not found"
- Friend account was deleted → "User not found"
- Invalid profile URL → "User not found"

## Key Design Decisions

### 1. Public vs Private Project Access
- **Public projects**: Accessible to all users (members and non-members). Users can view project details even if not participants.
- **Private projects**: Only accessible to project members. Non-members see "This is a private project. You must be a member to view it."

This aligns with the application's privacy model where:
- `isPublic: true` → Anyone can view
- `isPublic: false` → Only participants can view

### 2. Separate Loading vs Not Found States
- **Loading**: Show `PageLoader` while data is being fetched
- **Not Found**: Show `ResourceNotFound` only after loading completes and data is null/undefined

This ensures users don't see premature error messages.

### 3. Type Safety
- Fixed `useState<any>` in ProjectDetail by importing and using `HabitSeries` type
- All ResourceNotFound props are properly typed with discriminated unions

### 4. Consistent UX
- Same visual language and patterns across all "not found" scenarios
- Animated icon for better visual feedback
- Clear action buttons (Go Back + type-specific action)

## Build Status
⚠️  **Note**: There is a pre-existing build error in `src/hooks/useKeyboardVisible.ts` at line 87 that was not introduced by these changes. This appears to be a parser issue unrelated to the ResourceNotFound implementation.

All ResourceNotFound changes have been implemented and are ready to use once the pre-existing build issue is resolved.

## Edge Cases Handled

### Project Access
1. **User tries to access a non-existent project** → "Project not found"
2. **User tries to access a public project (not a member)** → **Allowed to view** as guest
3. **User tries to access a private project (not a member)** → "This is a private project. You must be a member to view it: [Project Name]"
4. **User leaves a private project, then tries to access via old link** → "This is a private project. You must be a member to view it: [Project Name]"
5. **User removed from a private project by owner** → "This is a private project. You must be a member to view it: [Project Name]"
6. **User was removed from a public project** → Still allowed to view (public projects are accessible to all)
7. **Project deleted by owner** → "Project not found"

### Other Resources
8. **Friend profile deleted** → "User not found"
9. **Invalid profile URL** → "User not found"
10. **General 404 routes** → "Page not found" with Go Home button
