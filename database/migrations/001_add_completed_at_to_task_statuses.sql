-- ============================================================================
-- Migration: Add completed_at timestamp to task_statuses table
-- ============================================================================
-- Purpose: Track when each user completed a specific task instance
-- This is separate from completion_logs which stores historical audit trail
--
-- Schema Update:
-- task_statuses.completed_at: Timestamp when user completed this specific task
-- completion_logs: Historical audit trail (ONE entry per task completion)
--
-- Important: A task can have archivedAt set AND be completed.
-- In this case, archivedAt takes precedence and ring should be red.
-- The task status remains 'completed' but shows red until recovery or manual update.
-- ============================================================================

-- Add completed_at column with proper default and constraint
ALTER TABLE task_statuses
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;

-- Add comment to document purpose
COMMENT ON COLUMN task_statuses.completed_at IS 'Timestamp when user completed this specific task. Null if not completed yet. Separate from completion_logs which stores historical audit trail.';

-- Create index for queries filtering by completion date
CREATE INDEX IF NOT EXISTS idx_task_statuses_completed_at
ON task_statuses(completed_at)
WHERE completed_at IS NOT NULL;

-- ============================================================================
-- Data Consistency: Backfill completed_at for existing completed tasks
-- ============================================================================
-- This ensures existing data follows the new schema.
-- This migration is idempotent and can be run multiple times safely.
-- NOTE: This only runs once per task_status + user combination.
-- ============================================================================

UPDATE task_statuses ts
SET completed_at = (
  SELECT cl.created_at
  FROM completion_logs cl
  WHERE cl.task_id = ts.task_id
    AND cl.user_id = ts.user_id
    AND ts.status = 'completed'
  ORDER BY cl.created_at DESC
  LIMIT 1
)
WHERE ts.status = 'completed'
  AND ts.completed_at IS NULL;

-- ============================================================================
-- Verification: Check for any orphaned completion_logs
-- ============================================================================
-- These would be completion logs without corresponding completed status.
-- This should return 0 rows if data is consistent.
-- ============================================================================

SELECT cl.id AS completion_log_id,
       cl.user_id,
       cl.task_id,
       cl.created_at AS completion_log_created_at,
       ts.status AS task_status,
       ts.completed_at AS task_status_completed_at
FROM completion_logs cl
LEFT JOIN task_statuses ts
  ON cl.task_id = ts.task_id
  AND cl.user_id = ts.user_id
WHERE ts.status IS NULL;

-- ============================================================================
-- Rollback Script (if needed)
-- ============================================================================
-- To rollback this migration, run:
-- UPDATE task_statuses SET completed_at = NULL WHERE status = 'completed';
-- DROP INDEX IF EXISTS idx_task_statuses_completed_at;
-- ALTER TABLE task_statuses DROP COLUMN IF EXISTS completed_at;
-- ============================================================================
