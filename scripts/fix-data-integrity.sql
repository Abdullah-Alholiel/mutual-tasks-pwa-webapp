-- ============================================================================
-- Data Integrity Fix: Missing Completion Logs
-- ============================================================================
-- This script identifies and fixes data inconsistencies where task_statuses
-- shows status='completed' but no corresponding completion_logs entry exists.
--
-- Run this in your Supabase SQL Editor in the following order:
-- 1. First run the DIAGNOSIS queries to understand the scope
-- 2. Review the results
-- 3. Run the appropriate FIX queries based on your decision
-- ============================================================================

-- ============================================================================
-- STEP 1: DIAGNOSIS - Understand the scope of the problem
-- ============================================================================

-- 1.1 Find all task_statuses with completed status but no completion_log
SELECT 
    ts.id as task_status_id,
    ts.task_id,
    ts.user_id,
    ts.status,
    ts.ring_color,
    ts.archived_at,
    ts.recovered_at,
    t.title as task_title,
    t.due_date,
    t.project_id,
    u.name as user_name,
    u.email as user_email
FROM task_statuses ts
LEFT JOIN completion_logs cl ON ts.task_id = cl.task_id AND ts.user_id = cl.user_id
JOIN tasks t ON ts.task_id = t.id
JOIN users u ON ts.user_id = u.id
WHERE ts.status = 'completed'
  AND cl.id IS NULL
ORDER BY ts.task_id, ts.user_id;

-- 1.2 Count summary
SELECT 
    COUNT(*) as total_missing_completion_logs,
    COUNT(DISTINCT ts.task_id) as affected_tasks,
    COUNT(DISTINCT ts.user_id) as affected_users
FROM task_statuses ts
LEFT JOIN completion_logs cl ON ts.task_id = cl.task_id AND ts.user_id = cl.user_id
WHERE ts.status = 'completed'
  AND cl.id IS NULL;

-- 1.3 Also check for the inverse: completion_logs without matching completed status
SELECT 
    cl.id as completion_log_id,
    cl.task_id,
    cl.user_id,
    cl.created_at as completed_at,
    cl.difficulty_rating,
    cl.xp_earned,
    ts.status as current_status,
    ts.ring_color,
    t.title as task_title
FROM completion_logs cl
LEFT JOIN task_statuses ts ON cl.task_id = ts.task_id AND cl.user_id = ts.user_id
LEFT JOIN tasks t ON cl.task_id = t.id
WHERE ts.status IS NULL OR ts.status != 'completed'
ORDER BY cl.task_id, cl.user_id;

-- ============================================================================
-- STEP 2: FIX OPTIONS - Choose the right approach for your data
-- ============================================================================

-- ============================================================================
-- OPTION A: Create missing completion_logs for tasks marked as completed
-- Use this if you believe the task_statuses.status='completed' is correct
-- and the completion_logs entries are simply missing
-- ============================================================================

-- A.1 Preview what will be inserted (DRY RUN)
SELECT 
    ts.user_id,
    ts.task_id,
    3 as difficulty_rating,  -- Default difficulty
    CASE WHEN ts.recovered_at IS NOT NULL THEN true ELSE false END as penalty_applied,
    CASE 
        WHEN ts.recovered_at IS NOT NULL THEN 100  -- Half XP for recovered
        ELSE 200  -- Full XP for on-time
    END as xp_earned,
    COALESCE(ts.recovered_at, t.due_date, NOW()) as created_at
FROM task_statuses ts
LEFT JOIN completion_logs cl ON ts.task_id = cl.task_id AND ts.user_id = cl.user_id
JOIN tasks t ON ts.task_id = t.id
WHERE ts.status = 'completed'
  AND cl.id IS NULL;

-- A.2 ACTUAL INSERT - Run this to create missing completion_logs
-- ⚠️ CAUTION: This will modify your database. Run the preview first!
/*
INSERT INTO completion_logs (user_id, task_id, difficulty_rating, penalty_applied, xp_earned, created_at)
SELECT 
    ts.user_id,
    ts.task_id,
    3 as difficulty_rating,  -- Default difficulty (middle value)
    CASE WHEN ts.recovered_at IS NOT NULL THEN true ELSE false END as penalty_applied,
    CASE 
        WHEN ts.recovered_at IS NOT NULL THEN 100  -- Half XP for recovered tasks
        ELSE 200  -- Full XP for on-time completion
    END as xp_earned,
    COALESCE(ts.recovered_at, t.due_date, NOW()) as created_at
FROM task_statuses ts
LEFT JOIN completion_logs cl ON ts.task_id = cl.task_id AND ts.user_id = cl.user_id
JOIN tasks t ON ts.task_id = t.id
WHERE ts.status = 'completed'
  AND cl.id IS NULL;
*/

-- ============================================================================
-- OPTION B: Reset task_statuses to archived for entries without completion_logs
-- Use this if you believe the tasks were NOT actually completed
-- and should be set back to archived status
-- ============================================================================

-- B.1 Preview what will be updated (DRY RUN)
SELECT 
    ts.id,
    ts.task_id,
    ts.user_id,
    ts.status as current_status,
    'archived' as new_status,
    ts.ring_color,
    'red' as new_ring_color,
    t.title as task_title,
    t.due_date
FROM task_statuses ts
LEFT JOIN completion_logs cl ON ts.task_id = cl.task_id AND ts.user_id = cl.user_id
JOIN tasks t ON ts.task_id = t.id
WHERE ts.status = 'completed'
  AND cl.id IS NULL;

-- B.2 ACTUAL UPDATE - Run this to reset status to archived
-- ⚠️ CAUTION: This will modify your database. Run the preview first!
/*
UPDATE task_statuses ts
SET 
    status = 'archived',
    ring_color = 'red',
    archived_at = COALESCE(ts.archived_at, NOW())
FROM (
    SELECT ts2.id
    FROM task_statuses ts2
    LEFT JOIN completion_logs cl ON ts2.task_id = cl.task_id AND ts2.user_id = cl.user_id
    WHERE ts2.status = 'completed'
      AND cl.id IS NULL
) missing
WHERE ts.id = missing.id;
*/

-- ============================================================================
-- OPTION C: Fix task_statuses that have completion_logs but wrong status
-- This syncs task_statuses with existing completion_logs
-- ============================================================================

-- C.1 Preview what will be updated (DRY RUN)
SELECT 
    ts.id,
    ts.task_id,
    ts.user_id,
    ts.status as current_status,
    'completed' as new_status,
    ts.ring_color as current_ring_color,
    CASE 
        WHEN cl.penalty_applied = true THEN 'yellow'
        WHEN cl.created_at::date <= t.due_date::date THEN 'green'
        ELSE 'none'
    END as new_ring_color,
    t.title as task_title,
    cl.created_at as completed_at
FROM completion_logs cl
LEFT JOIN task_statuses ts ON cl.task_id = ts.task_id AND cl.user_id = ts.user_id
LEFT JOIN tasks t ON cl.task_id = t.id
WHERE ts.status IS NOT NULL AND ts.status != 'completed';

-- C.2 ACTUAL UPDATE - Sync task_statuses with completion_logs
-- ⚠️ CAUTION: This will modify your database. Run the preview first!
/*
UPDATE task_statuses ts
SET 
    status = 'completed',
    ring_color = CASE 
        WHEN cl.penalty_applied = true THEN 'yellow'
        WHEN cl.created_at::date <= t.due_date::date THEN 'green'
        ELSE 'none'
    END
FROM completion_logs cl
JOIN tasks t ON cl.task_id = t.id
WHERE ts.task_id = cl.task_id 
  AND ts.user_id = cl.user_id
  AND ts.status != 'completed';
*/

-- ============================================================================
-- STEP 3: VERIFICATION - Run after fixes to confirm data integrity
-- ============================================================================

-- 3.1 Verify no more missing completion_logs
SELECT COUNT(*) as remaining_issues
FROM task_statuses ts
LEFT JOIN completion_logs cl ON ts.task_id = cl.task_id AND ts.user_id = cl.user_id
WHERE ts.status = 'completed'
  AND cl.id IS NULL;

-- 3.2 Verify no more status mismatches
SELECT COUNT(*) as remaining_mismatches
FROM completion_logs cl
LEFT JOIN task_statuses ts ON cl.task_id = ts.task_id AND cl.user_id = ts.user_id
WHERE ts.status IS NULL OR ts.status != 'completed';

-- 3.3 Summary of current data integrity status
SELECT 
    'task_statuses completed' as metric,
    COUNT(*) as count
FROM task_statuses WHERE status = 'completed'
UNION ALL
SELECT 
    'completion_logs total' as metric,
    COUNT(*) as count
FROM completion_logs
UNION ALL
SELECT 
    'missing completion_logs' as metric,
    COUNT(*) as count
FROM task_statuses ts
LEFT JOIN completion_logs cl ON ts.task_id = cl.task_id AND ts.user_id = cl.user_id
WHERE ts.status = 'completed' AND cl.id IS NULL
UNION ALL
SELECT 
    'orphaned completion_logs' as metric,
    COUNT(*) as count
FROM completion_logs cl
LEFT JOIN task_statuses ts ON cl.task_id = ts.task_id AND cl.user_id = ts.user_id
WHERE ts.status IS NULL OR ts.status != 'completed';
