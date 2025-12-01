# Mock Data Use Cases & Testing Guide

This document outlines all use cases for testing component functionalities using the curated mock data in `src/lib/mockData.ts`. Each use case maps to specific mock data entries and demonstrates how to test various features.

## Table of Contents
1. [User Management](#user-management)
2. [Project Management](#project-management)
3. [Task Management](#task-management)
4. [Task Assignments](#task-assignments)
5. [Time Proposals](#time-proposals)
6. [Task Completion](#task-completion)
7. [Notifications](#notifications)
8. [Component-Specific Use Cases](#component-specific-use-cases)

---

## User Management

### Current User
- **User ID**: `1`
- **Name**: Alex Chen
- **Handle**: @alexchen
- **Email**: alex@momentum.app
- **Stats**: 47 completed tasks, 12-day streak, longest streak 23, score 152

### Mock Users Available
1. **Alex Chen** (ID: `1`) - Current user
2. **Jordan Smith** (ID: `2`) - Friend
3. **Sam Rivera** (ID: `3`) - Friend

### Use Cases
- ✅ View current user profile with stats
- ✅ View friend profiles and compare stats
- ✅ Filter tasks/projects by user participation
- ✅ Display user avatars and handles throughout the app

---

## Project Management

### Available Projects

#### Project 1: Morning Routine (p1)
- **Type**: Public
- **Owner**: Alex (ID: 1)
- **Participants**: Alex (owner), Jordan (participant)
- **Progress**: 38/45 tasks (84%)
- **Color**: Blue
- **Use Cases**:
  - View project with progress tracking
  - See participant roles
  - Filter tasks by project
  - Test project detail page

#### Project 2: Fitness Challenge (p2)
- **Type**: Public
- **Owner**: Alex (ID: 1)
- **Participants**: Alex (owner), Jordan (manager), Sam (participant)
- **Progress**: 47/60 tasks (78%)
- **Color**: Green
- **Use Cases**:
  - Test multiple participant roles (owner, manager, participant)
  - View project with multiple members
  - Test manager role capabilities

#### Project 3: Learning Together (p3)
- **Type**: Private
- **Owner**: Alex (ID: 1)
- **Participants**: Alex (owner), Sam (participant)
- **Progress**: 18/30 tasks (60%)
- **Color**: Orange
- **Use Cases**:
  - Test private project visibility
  - Test time proposals (only available in private projects)
  - Test project privacy settings

#### Project 4: Community Garden (p4)
- **Type**: Public
- **Owner**: Jordan (ID: 2)
- **Participants**: Jordan (owner), Sam (participant)
- **Progress**: 12/20 tasks (60%)
- **Color**: Green
- **Use Cases**:
  - Test public project discovery
  - Test joining public projects
  - Test viewing projects user is not part of

### Project Management Use Cases

#### Creating Projects
1. **Create Public Project**
   - Fill form with name, description
   - Select public visibility
   - Choose color
   - Add participants
   - Verify project appears in "My Projects"

2. **Create Private Project**
   - Fill form with name, description
   - Select private visibility
   - Choose color
   - Add participants
   - Verify project appears only for members

#### Managing Projects
1. **Add Team Member**
   - Navigate to project detail
   - Click "Add Member"
   - Enter email (e.g., `jordan@momentum.app`)
   - Verify member added to participant list

2. **View Project Progress**
   - Navigate to project detail
   - Verify progress bar shows correct percentage
   - Verify task counts (pending/active/completed)

3. **Join Public Project**
   - Navigate to Projects page
   - Switch to "Public Projects" tab
   - Click "Join Project" on Community Garden
   - Verify project moves to "My Projects"

---

## Task Management

### Task Status Coverage

The mock data includes tasks covering all possible statuses:

#### Draft Tasks
- **Task ID**: `t7`
- **Status**: `draft`
- **Use Cases**:
  - View tasks that haven't been initiated
  - Test initiating a draft task
  - Verify draft tasks don't appear in "Today's Tasks"

#### Initiated Tasks
- **Task IDs**: `t3`, `t4`, `t10`
- **Status**: `initiated`
- **Use Cases**:
  - View tasks waiting for acceptance
  - Test accepting/declining tasks
  - Test proposing time for initiated tasks
  - Verify notification generation

#### Scheduled Tasks
- **Task IDs**: `t5`, `t12`, `t13`, `t14`, `t16`
- **Status**: `scheduled`
- **Use Cases**:
  - View tasks that are accepted but not started
  - Test time proposal workflows
  - Test moving from scheduled to in_progress

#### In Progress Tasks
- **Task IDs**: `t1`, `t2`, `t11`, `t17`
- **Status**: `in_progress`
- **Use Cases**:
  - View active tasks
  - Test completing tasks
  - Test difficulty rating modal
  - Verify completion tracking

#### Completed Tasks
- **Task IDs**: `t6`, `t15`
- **Status**: `completed`
- **Use Cases**:
  - View completed tasks
  - Verify completion timestamps
  - Test difficulty rating display
  - Verify streak calculation

#### Cancelled Tasks
- **Task ID**: `t8`
- **Status**: `cancelled`
- **Use Cases**:
  - View cancelled tasks
  - Test task cancellation flow
  - Verify archived assignments

#### Expired Tasks
- **Task ID**: `t9`
- **Status**: `expired`
- **Use Cases**:
  - View expired tasks
  - Test expired task handling
  - Verify missed assignment status

### Task Type Coverage

#### One-Off Tasks
- **Task IDs**: `t2`, `t4`, `t7`, `t8`, `t9`, `t10`, `t12`, `t13`, `t14`, `t15`
- **Use Cases**:
  - Create one-time tasks
  - Verify single occurrence
  - Test completion flow

#### Habit Tasks
- **Task IDs**: `t1`, `t3`, `t5`, `t6`, `t11`, `t16`, `t17`
- **Recurrence Patterns**:
  - Daily: `t1`, `t3`, `t6`, `t11`, `t17`
  - Weekly: `t5`
  - Custom: `t16`
- **Use Cases**:
  - Create recurring tasks
  - Test different recurrence patterns
  - Verify habit task creation generates multiple instances
  - Test custom recurrence configuration

### Difficulty Rating Coverage

All difficulty ratings (1-5) are represented:
- **Rating 1**: `t10`, `t14`, `t15` - Very Easy
- **Rating 2**: `t1`, `t11`, `t17` - Easy
- **Rating 3**: `t3`, `t4`, `t7`, `t12`, `t13` - Moderate
- **Rating 4**: `t2`, `t5`, `t16` - Hard
- **Rating 5**: `t6` - Extreme

**Use Cases**:
- Test difficulty rating selection
- Verify rating display after completion
- Test rating impact on scoring

---

## Task Assignments

### Assignment Status Coverage

#### Invited Assignments
- **Tasks**: `t3`, `t4`, `t7`
- **Use Cases**:
  - View tasks requiring acceptance
  - Test accept/decline actions
  - Verify invitation notifications

#### Active Assignments
- **Tasks**: `t1`, `t2`, `t5`, `t11`, `t12`, `t13`, `t14`, `t16`, `t17`
- **Use Cases**:
  - View active tasks
  - Test task completion
  - Verify active task filtering

#### Declined Assignments
- **Tasks**: `t8`, `t10`
- **Use Cases**:
  - View declined tasks
  - Test decline flow
  - Verify declined task handling

#### Completed Assignments
- **Tasks**: `t6`, `t15`
- **Use Cases**:
  - View completed assignments
  - Verify completion tracking
  - Test completion status display

#### Missed Assignments
- **Tasks**: `t9`
- **Use Cases**:
  - View missed tasks
  - Test expired task handling
  - Verify missed status

#### Archived Assignments
- **Tasks**: `t8`, `t11`
- **Use Cases**:
  - View archived tasks
  - Test archiving functionality
  - Test recovering archived tasks (t17)

### Assignment Use Cases

1. **Accept Task**
   - Navigate to task with `invited` status
   - Click "Accept"
   - Verify status changes to `active`
   - Verify task moves to "In Progress" section
   - Verify notification sent

2. **Decline Task**
   - Navigate to task with `invited` status
   - Click "Decline"
   - Verify task removed from view
   - Verify notification sent

3. **Archive Task**
   - Navigate to active task
   - Archive task (if feature exists)
   - Verify task archived
   - Verify `archivedAt` timestamp set

4. **Recover Task**
   - Navigate to archived task
   - Recover task
   - Verify task returns to active
   - Verify `recoveredAt` timestamp set

---

## Time Proposals

### Time Proposal Status Coverage

#### Pending Proposals
- **Task**: `t5`
- **Proposer**: Sam (ID: 3)
- **Use Cases**:
  - View pending time proposals
  - Test accepting/rejecting proposals
  - Verify proposal notification
  - Test proposal UI display

#### Accepted Proposals
- **Task**: `t12`
- **Proposer**: Sam (ID: 3)
- **Use Cases**:
  - View accepted proposals
  - Verify due date updated
  - Verify `effectiveDueDate` updated for all assignments
  - Test proposal history

#### Rejected Proposals
- **Task**: `t13`
- **Proposer**: Alex (ID: 1)
- **Use Cases**:
  - View rejected proposals
  - Verify original due date maintained
  - Test proposal rejection flow

#### Cancelled Proposals
- **Task**: `t14`
- **Proposer**: Jordan (ID: 2)
- **Use Cases**:
  - View cancelled proposals
  - Test proposal cancellation
  - Verify cancelled proposal handling

### Time Proposal Use Cases

1. **Propose New Time**
   - Navigate to task (must be in private project)
   - Click "Propose Time"
   - Select new date and time
   - Submit proposal
   - Verify proposal created with `pending` status
   - Verify notification sent to other participants

2. **Accept Time Proposal**
   - View task with pending proposal
   - Click "Accept" (if proposer is not current user)
   - Verify proposal status changes to `accepted`
   - Verify task `dueDate` updated
   - Verify all assignment `effectiveDueDate` updated
   - Verify `respondedAt` timestamp set

3. **Reject Time Proposal**
   - View task with pending proposal
   - Click "Decline" or "Reject"
   - Verify proposal status changes to `rejected`
   - Verify original due date maintained
   - Verify `respondedAt` timestamp set

4. **Cancel Own Proposal**
   - View task where current user is proposer
   - Cancel proposal
   - Verify proposal status changes to `cancelled`
   - Verify `respondedAt` timestamp set

---

## Task Completion

### Completion States

#### Single User Completed
- **Task**: `t1` (Alex completed, Jordan pending)
- **Task**: `t2` (Jordan completed, Alex pending)
- **Use Cases**:
  - View partial completion
  - Test mirror completion visibility
  - Verify completion indicators
  - Test waiting for partner completion

#### Both Users Completed
- **Tasks**: `t6`, `t15`
- **Use Cases**:
  - View fully completed tasks
  - Verify task status changes to `completed`
  - Verify completion timestamps
  - Test difficulty rating display
  - Verify streak calculation

#### No Completions
- **Tasks**: `t3`, `t4`, `t5`, `t7`, `t8`, `t9`, `t10`, `t11`, `t12`, `t13`, `t14`, `t16`, `t17`
- **Use Cases**:
  - View incomplete tasks
  - Test completion flow
  - Verify completion state tracking

### Completion Use Cases

1. **Complete Task**
   - Navigate to active task
   - Click "Mark Complete"
   - Select difficulty rating (1-5)
   - Submit rating
   - Verify completion recorded
   - Verify difficulty rating saved
   - Verify notification sent to partner

2. **View Partner Completion**
   - Navigate to task where partner completed
   - Verify partner's completion indicator shows checkmark
   - Verify difficulty rating visible (if `isMirrorCompletionVisible` is true)

3. **Complete Task Together**
   - Both users complete task
   - Verify task status changes to `completed`
   - Verify `completedAt` timestamp set
   - Verify both assignments marked as `completed`
   - Verify completion celebration message

---

## Notifications

### Notification Type Coverage

#### Task Initiated
- **Notification IDs**: `n1`, `n8`
- **Use Cases**:
  - View task initiation notifications
  - Test notification click navigation
  - Verify notification read state

#### Task Accepted
- **Notification ID**: `n4`
- **Use Cases**:
  - View task acceptance notifications
  - Test notification handling

#### Task Declined
- **Notification ID**: `n5`
- **Use Cases**:
  - View task decline notifications
  - Test decline notification handling

#### Task Time Proposed
- **Notification IDs**: `n6`, `n9`
- **Use Cases**:
  - View time proposal notifications
  - Test proposal notification handling
  - Verify email sent flag (`n9` has `emailSent: true`)

#### Task Completed
- **Notification ID**: `n2`
- **Use Cases**:
  - View task completion notifications
  - Test completion notification handling

#### Streak Reminder
- **Notification ID**: `n3`
- **Use Cases**:
  - View streak reminder notifications
  - Test reminder notifications

#### Project Joined
- **Notification ID**: `n7`
- **Use Cases**:
  - View project join notifications
  - Test join notification handling

### Notification Use Cases

1. **View Notifications**
   - Click notification bell icon
   - Verify unread count badge
   - View unread notifications in "New" section
   - View read notifications in "Earlier" section

2. **Mark as Read**
   - Click on notification
   - Verify notification moves to "Earlier" section
   - Verify unread count decreases

3. **Mark All as Read**
   - Click "Mark all as read" button
   - Verify all notifications marked as read
   - Verify unread count becomes 0

4. **Dismiss Notification**
   - Click dismiss (X) button
   - Verify notification removed
   - Verify notification count decreases

5. **Navigate from Notification**
   - Click notification with `taskId`
   - Verify navigation to Today page
   - Verify task highlighted/focused
   - Click notification with `projectId`
   - Verify navigation to project detail page

---

## Component-Specific Use Cases

### TaskCard Component

#### Test Cases

1. **Pending Task Card**
   - **Task**: `t3`, `t4`
   - Verify "Accept", "Decline", "Propose Time" buttons visible
   - Verify status badge shows "pending"
   - Verify project badge displayed
   - Verify creator avatar displayed
   - Verify due date/time displayed

2. **Active Task Card**
   - **Task**: `t1`, `t2`
   - Verify "Mark Complete" button visible
   - Verify status badge shows "accepted"
   - Verify completion indicators (checkmarks/circles)
   - Verify partner completion status visible

3. **Completed Task Card**
   - **Task**: `t6`, `t15`
   - Verify no action buttons
   - Verify status badge shows "completed"
   - Verify difficulty rating displayed
   - Verify both users show completed

4. **Task with Time Proposal**
   - **Task**: `t5`
   - Verify proposal banner displayed
   - Verify proposed time shown
   - Verify "Accept", "Decline" buttons for proposal
   - Verify "Waiting for response" message if user is proposer

5. **Habit Task Card**
   - **Task**: `t1`, `t3`, `t5`, `t6`, `t11`, `t16`, `t17`
   - Verify recurrence pattern badge displayed
   - Verify habit icon/indicator

6. **Task with Archived Assignment**
   - **Task**: `t11`
   - Verify archived assignment handling
   - Test recovery flow

### TaskForm Component

#### Test Cases

1. **Create One-Off Task**
   - Open form
   - Select project
   - Enter title and description
   - Select assignee
   - Set due date and time
   - Keep recurring toggle OFF
   - Submit
   - Verify single task created
   - Verify task status is `initiated`
   - Verify assignments created (creator: `active`, assignee: `invited`)

2. **Create Daily Habit Task**
   - Open form
   - Select project
   - Enter title and description
   - Select assignee
   - Set due date and time
   - Toggle recurring ON
   - Select "Daily" pattern
   - Submit
   - Verify multiple tasks created (28 instances)
   - Verify all tasks have `recurrencePattern: 'daily'`
   - Verify tasks span 28 days

3. **Create Weekly Habit Task**
   - Open form
   - Select project
   - Enter title and description
   - Select assignee
   - Set due date and time
   - Toggle recurring ON
   - Select "Weekly" pattern
   - Submit
   - Verify multiple tasks created (4 instances)
   - Verify all tasks have `recurrencePattern: 'weekly'`
   - Verify tasks are 7 days apart

4. **Create Custom Habit Task**
   - Open form
   - Select project
   - Enter title and description
   - Select assignee
   - Set due date and time
   - Toggle recurring ON
   - Select "Custom" pattern
   - Configure:
     - Frequency: weeks
     - Interval: 2
     - Days of week: Monday, Wednesday
     - End type: date/count
   - Submit
   - Verify tasks created according to custom pattern
   - Verify tasks only on selected days

5. **Create Task with Project Selection**
   - Open form with `allowProjectSelection={true}`
   - Verify project dropdown visible
   - Select project from dropdown
   - Verify "Create New Project" button visible
   - Create new project inline
   - Verify new project selected
   - Create task in new project

6. **Form Validation**
   - Try submitting without title
   - Try submitting without assignee
   - Try submitting without project
   - Verify error messages
   - Verify form doesn't submit

### ProjectForm Component

#### Test Cases

1. **Create Public Project**
   - Open form
   - Enter project name
   - Enter description
   - Keep public toggle ON
   - Select color
   - Select participants
   - Submit
   - Verify project created with `isPublic: true`
   - Verify project appears in public projects list

2. **Create Private Project**
   - Open form
   - Enter project name
   - Enter description
   - Toggle public OFF (private)
   - Select color
   - Select participants
   - Submit
   - Verify project created with `isPublic: false`
   - Verify project only visible to members

3. **Select Multiple Participants**
   - Open form
   - Select multiple friends
   - Verify all selected
   - Verify badges show "Selected"
   - Submit
   - Verify all participants added

4. **Color Selection**
   - Open form
   - Click different colors
   - Verify selected color highlighted
   - Submit
   - Verify project uses selected color

### ProjectDetail Component

#### Test Cases

1. **View Project Overview**
   - Navigate to project detail
   - Verify project name and description
   - Verify progress bar
   - Verify task counts (pending/active/completed)
   - Verify participant avatars

2. **View All Tasks Tab**
   - Navigate to "All" tab
   - Verify all tasks displayed
   - Verify tasks grouped by status
   - Verify empty state if no tasks

3. **View Pending Tasks Tab**
   - Navigate to "Pending" tab
   - Verify only pending tasks displayed
   - Verify badge count matches
   - Verify empty state if no pending tasks

4. **View Active Tasks Tab**
   - Navigate to "Active" tab
   - Verify only active tasks displayed
   - Verify badge count matches
   - Verify empty state if no active tasks

5. **View Completed Tasks Tab**
   - Navigate to "Completed" tab
   - Verify only completed tasks displayed
   - Verify badge count matches
   - Verify empty state if no completed tasks

6. **View Habits Tab**
   - Navigate to "Habits" tab
   - Verify only habit tasks displayed
   - Verify recurrence pattern badges
   - Verify empty state if no habit tasks

7. **Add Team Member**
   - Click "Add" button (if owner)
   - Enter email address
   - Submit
   - Verify member added
   - Verify participant list updated
   - Verify notification sent

8. **Create Task from Project**
   - Click "New Task" button
   - Verify project pre-selected
   - Create task
   - Verify task appears in project
   - Verify project progress updated

### Index (Today's Tasks) Component

#### Test Cases

1. **View Today's Tasks**
   - Navigate to home page
   - Verify only today's tasks displayed
   - Verify tasks grouped by status
   - Verify stats overview (pending/active/completed counts)

2. **View Pending Tasks Section**
   - Verify "Needs Your Action" section
   - Verify pending tasks displayed
   - Verify accept/decline buttons visible

3. **View Active Tasks Section**
   - Verify "In Progress" section
   - Verify active tasks displayed
   - Verify "Mark Complete" buttons visible

4. **View Completed Tasks Section**
   - Verify "Completed" section
   - Verify completed tasks displayed with opacity
   - Verify no action buttons

5. **Create Task from Home**
   - Click "New Task" button
   - Verify form opens with project selection
   - Create task
   - Verify task appears in today's list (if due today)

6. **Empty State**
   - Clear all today's tasks
   - Verify empty state message
   - Verify "Create Task" button

### DifficultyRatingModal Component

#### Test Cases

1. **Open Rating Modal**
   - Complete a task
   - Verify modal opens
   - Verify task title displayed
   - Verify 5 rating options visible

2. **Select Rating**
   - Click on rating (1-5)
   - Verify rating highlighted
   - Verify label displayed
   - Submit
   - Verify rating saved
   - Verify modal closes

3. **Skip Rating**
   - Click "Skip" button
   - Verify modal closes
   - Verify task completed without rating

### Inbox (Notifications) Component

#### Test Cases

1. **View Notification Bell**
   - Verify bell icon visible
   - Verify unread count badge
   - Click bell
   - Verify inbox opens

2. **View Unread Notifications**
   - Open inbox
   - Verify "New" section
   - Verify unread notifications listed
   - Verify unread indicator (dot)

3. **View Read Notifications**
   - Open inbox
   - Verify "Earlier" section
   - Verify read notifications listed
   - Verify reduced opacity

4. **Mark Notification as Read**
   - Click on unread notification
   - Verify notification moves to "Earlier"
   - Verify unread count decreases

5. **Mark All as Read**
   - Click "Mark all as read"
   - Verify all notifications marked read
   - Verify unread count becomes 0

6. **Dismiss Notification**
   - Click X button
   - Verify notification removed
   - Verify count decreases

7. **Navigate from Notification**
   - Click notification with taskId
   - Verify navigates to home page
   - Click notification with projectId
   - Verify navigates to project detail

### Projects Component

#### Test Cases

1. **View My Projects Tab**
   - Navigate to Projects page
   - Verify "My Projects" tab selected
   - Verify projects user is part of displayed
   - Verify project cards show progress

2. **View Public Projects Tab**
   - Switch to "Public Projects" tab
   - Verify public projects user is not part of displayed
   - Verify "Join Project" buttons visible

3. **Join Public Project**
   - Click "Join Project" on public project
   - Verify project moves to "My Projects"
   - Verify notification sent
   - Verify project accessible

4. **Create Project**
   - Click "New Project" button
   - Fill form
   - Submit
   - Verify project created
   - Verify navigation to project detail

5. **Empty States**
   - Clear projects
   - Verify empty state for "My Projects"
   - Verify empty state for "Public Projects"

---

## Testing Workflows

### Complete Task Flow
1. User creates task → Task status: `initiated`
2. Assignee receives notification → Notification type: `task_initiated`
3. Assignee accepts task → Task status: `scheduled`, Assignment status: `active`
4. Assignee receives notification → Notification type: `task_accepted`
5. User completes task → Completion recorded, Task status: `in_progress`
6. Assignee receives notification → Notification type: `task_completed`
7. Assignee completes task → Task status: `completed`, Both assignments: `completed`
8. Both users receive completion notification

### Time Proposal Flow (Private Projects Only)
1. User creates task in private project → Task status: `initiated`
2. Assignee accepts task → Task status: `scheduled`
3. Assignee proposes new time → Proposal status: `pending`
4. User receives notification → Notification type: `task_time_proposed`
5. User accepts proposal → Proposal status: `accepted`, Due date updated
6. Both assignments' `effectiveDueDate` updated

### Habit Task Creation Flow
1. User creates habit task with daily recurrence
2. System generates 28 task instances
3. All tasks have same title, description, project
4. Tasks have sequential due dates (daily)
5. All tasks start with status: `initiated`
6. Assignee receives notifications for all tasks

---

## Mock Data Reference

### Quick Reference by Task ID

| Task ID | Status | Type | Recurrence | Difficulty | Key Features |
|---------|--------|------|------------|------------|--------------|
| t1 | in_progress | habit | daily | 2 | One user completed |
| t2 | in_progress | one_off | - | 4 | Partner completed |
| t3 | initiated | habit | daily | 3 | Needs acceptance |
| t4 | initiated | one_off | - | 3 | Needs acceptance |
| t5 | scheduled | habit | weekly | 4 | Pending time proposal |
| t6 | completed | habit | daily | 5 | Both completed |
| t7 | draft | one_off | - | 3 | Not initiated |
| t8 | cancelled | one_off | - | 4 | Archived/declined |
| t9 | expired | one_off | - | 2 | Missed assignments |
| t10 | initiated | one_off | - | 1 | Declined assignment |
| t11 | in_progress | habit | daily | 2 | Archived assignment |
| t12 | scheduled | one_off | - | 3 | Accepted proposal |
| t13 | scheduled | one_off | - | 3 | Rejected proposal |
| t14 | scheduled | one_off | - | 1 | Cancelled proposal |
| t15 | completed | one_off | - | 1 | Both completed |
| t16 | scheduled | habit | custom | 4 | Custom recurrence |
| t17 | in_progress | habit | daily | 2 | Recovered assignment |

### Quick Reference by Project ID

| Project ID | Name | Type | Participants | Progress |
|------------|------|------|--------------|----------|
| p1 | Morning Routine | Public | Alex (owner), Jordan | 84% |
| p2 | Fitness Challenge | Public | Alex (owner), Jordan (manager), Sam | 78% |
| p3 | Learning Together | Private | Alex (owner), Sam | 60% |
| p4 | Community Garden | Public | Jordan (owner), Sam | 60% |

---

## Best Practices for Testing

1. **Start with Basic Flows**
   - Test creating projects
   - Test creating tasks
   - Test accepting/declining tasks
   - Test completing tasks

2. **Test Edge Cases**
   - Test expired tasks
   - Test cancelled tasks
   - Test archived assignments
   - Test time proposals in private projects

3. **Test Notifications**
   - Verify notifications generated for all actions
   - Test notification navigation
   - Test notification read states

4. **Test Habit Tasks**
   - Verify multiple instances created
   - Test different recurrence patterns
   - Test custom recurrence configuration

5. **Test Project Management**
   - Test public vs private projects
   - Test adding members
   - Test joining public projects
   - Test project progress tracking

6. **Test Assignment States**
   - Test all assignment statuses
   - Test archiving/recovering
   - Test completion tracking

---

## Notes

- All dates in mock data are relative to "today" for realistic testing
- Task IDs follow pattern: `t{number}`
- Project IDs follow pattern: `p{number}`
- Notification IDs follow pattern: `n{number}`
- Completion log IDs follow pattern: `cl{number}`
- Time proposal IDs follow pattern: `tp-{taskId}-{number}`

For questions or additional test cases, refer to the component source code and database foundation documentation.

