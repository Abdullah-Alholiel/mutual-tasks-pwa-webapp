# Mock Data Coverage Summary

This document outlines all the use cases covered by the mock data to ensure comprehensive testing of the database schema.

## ✅ Complete Coverage

### Task Statuses (7/7)
- ✅ `draft` - Task t7 (not yet initiated)
- ✅ `initiated` - Tasks t3, t4, t10 (waiting for acceptance)
- ✅ `scheduled` - Tasks t5, t12, t13, t14, t16 (accepted, ready to start)
- ✅ `in_progress` - Tasks t1, t2, t11, t17 (actively being worked on)
- ✅ `completed` - Tasks t6, t15 (fully completed by all participants)
- ✅ `cancelled` - Task t8 (task was cancelled)
- ✅ `expired` - Task t9 (past due date, not completed)

### Assignment Statuses (6/6)
- ✅ `invited` - Tasks t3, t4, t7 (user invited but hasn't accepted)
- ✅ `active` - Most tasks (user has accepted and is working on it)
- ✅ `declined` - Tasks t8, t10 (user declined the invitation)
- ✅ `completed` - Tasks t6, t15 (user completed their part)
- ✅ `missed` - Task t9 (task expired without completion)
- ✅ `archived` - Tasks t8, t11 (user archived for themselves)

### Time Proposal Statuses (4/4)
- ✅ `pending` - Task t5 (waiting for response)
- ✅ `accepted` - Task t12 (proposal was accepted, due date updated)
- ✅ `rejected` - Task t13 (proposal was rejected, original time kept)
- ✅ `cancelled` - Task t14 (proposal was cancelled)

### Difficulty Ratings (5/5)
- ✅ `1` - Task t15 (easiest)
- ✅ `2` - Tasks t1, t9, t11, t17
- ✅ `3` - Tasks t3, t4, t7, t12, t13
- ✅ `4` - Tasks t2, t5, t8, t16
- ✅ `5` - Task t6 (hardest)

### Task Types (2/2)
- ✅ `one_off` - Tasks t2, t4, t7, t8, t9, t10, t12, t13, t14, t15
- ✅ `habit` - Tasks t1, t3, t5, t6, t11, t16, t17

### Recurrence Patterns (3/3)
- ✅ `daily` - Tasks t1, t3, t6, t11, t17
- ✅ `weekly` - Task t5
- ✅ `custom` - Task t16

### Notification Types (7/7)
- ✅ `task_initiated` - Notifications n1, n8
- ✅ `task_accepted` - Notification n4
- ✅ `task_declined` - Notification n5
- ✅ `task_time_proposed` - Notifications n6, n9
- ✅ `task_completed` - Notification n2
- ✅ `streak_reminder` - Notification n3
- ✅ `project_joined` - Notification n7

### Project Roles (3/3)
- ✅ `owner` - All projects have owner (user 1)
- ✅ `manager` - Project p2 has manager (user 2)
- ✅ `participant` - All projects have participants

### Project Visibility (2/2)
- ✅ `isPublic: true` - Projects p1, p2
- ✅ `isPublic: false` - Project p3

### Special Assignment Features
- ✅ `archivedAt` - Task t11 (user archived assignment)
- ✅ `recoveredAt` - Task t17 (user recovered from archived)

### Completion States
- ✅ Both users completed - Tasks t6, t15
- ✅ One user completed - Tasks t1, t2
- ✅ Neither user completed - Most other tasks
- ✅ Different difficulty ratings per user - Task t1 (user 1: 2, user 2: not completed)

## Mock Data Statistics

- **Total Tasks**: 17 tasks covering all use cases
- **Total Users**: 3 users
- **Total Projects**: 3 projects (2 public, 1 private)
- **Total Notifications**: 9 notifications covering all types
- **Total Completion Logs**: 9 logs with various difficulty ratings

## Testing Scenarios Covered

1. ✅ Task creation with different types and statuses
2. ✅ Task acceptance/decline workflows
3. ✅ Task completion with difficulty ratings
4. ✅ Time proposal workflows (all statuses)
5. ✅ Assignment archiving and recovery
6. ✅ Task cancellation and expiration
7. ✅ Multi-user task assignments
8. ✅ Project participant roles (owner, manager, participant)
9. ✅ Public vs private projects
10. ✅ Habit tasks with different recurrence patterns
11. ✅ One-off tasks
12. ✅ All notification types
13. ✅ Completion logging for streaks

## Notes

- All tasks use `assignments` array (no `assigneeId` field) - matches database schema
- All projects include `participantRoles` - matches `project_participants` table
- All tasks include `completions` object - denormalized from `completion_logs` table
- Time proposals are properly linked to tasks
- All dates are relative (today, yesterday) for dynamic testing

