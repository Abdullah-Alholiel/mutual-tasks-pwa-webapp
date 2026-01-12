// ============================================================================
// Database Integrity Repair Migration
// ============================================================================
// Run this migration to fix data integrity issues:
// 1. Add foreign key constraints with CASCADE DELETE
// 2. Create atomic task creation function
// 3. Fix orphaned data
// 4. Add database triggers for count consistency
// ============================================================================

import 'dotenv/config';
import { Client } from 'pg';

// Get connection string from environment
const connectionString = process.env.SUPABASE_DB_URL ?? '';

if (!connectionString) {
    throw new Error('SUPABASE_DB_URL is required');
}

// Disable SSL certificate validation for local development
if (!process.env.NODE_TLS_REJECT_UNAUTHORIZED) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const REPAIR_STATEMENTS = [
    // ============================================================================
    // PHASE 1: Data Cleanup
    // ============================================================================

    // 1. Delete orphaned task_statuses (statuses for non-existent tasks)
    `
  DELETE FROM task_statuses 
  WHERE task_id NOT IN (SELECT id FROM tasks);
  `,

    // 2. Delete orphaned completion_logs (logs for non-existent tasks)
    `
  DELETE FROM completion_logs 
  WHERE task_id NOT IN (SELECT id FROM tasks);
  `,

    // 3. Delete orphaned notifications (notifications for non-existent tasks/projects)
    `
  DELETE FROM notifications 
  WHERE task_id IS NOT NULL AND task_id NOT IN (SELECT id FROM tasks);
  `,

    `
  DELETE FROM notifications 
  WHERE project_id IS NOT NULL AND project_id NOT IN (SELECT id FROM projects);
  `,

    // 4. Fix project task counts to match actual task count
    `
  UPDATE projects p
  SET total_tasks = (
    SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id
  );
  `,

    // ============================================================================
    // PHASE 2: Add/Fix Foreign Key Constraints with CASCADE DELETE
    // ============================================================================

    // Task statuses - ensure cascade delete when task is deleted
    `
  ALTER TABLE task_statuses 
  DROP CONSTRAINT IF EXISTS task_statuses_task_id_fkey;
  `,

    `
  ALTER TABLE task_statuses
  ADD CONSTRAINT task_statuses_task_id_fkey 
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  `,

    // Completion logs - cascade delete
    `
  ALTER TABLE completion_logs 
  DROP CONSTRAINT IF EXISTS completion_logs_task_id_fkey;
  `,

    `
  ALTER TABLE completion_logs
  ADD CONSTRAINT completion_logs_task_id_fkey 
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  `,

    // Task recurrence - cascade delete
    `
  ALTER TABLE task_recurrence 
  DROP CONSTRAINT IF EXISTS task_recurrence_task_id_fkey;
  `,

    `
  ALTER TABLE task_recurrence
  ADD CONSTRAINT task_recurrence_task_id_fkey 
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
  `,

    // ============================================================================
    // PHASE 3: Create Trigger to Keep Project Task Count Updated
    // ============================================================================

    // Function to update project task count
    `
  CREATE OR REPLACE FUNCTION update_project_task_count()
  RETURNS TRIGGER AS $$
  BEGIN
    IF TG_OP = 'INSERT' THEN
      UPDATE projects SET total_tasks = total_tasks + 1 WHERE id = NEW.project_id;
      RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE projects SET total_tasks = GREATEST(total_tasks - 1, 0) WHERE id = OLD.project_id;
      RETURN OLD;
    END IF;
    RETURN NULL;
  END;
  $$ LANGUAGE plpgsql;
  `,

    // Drop existing trigger if exists
    `
  DROP TRIGGER IF EXISTS task_count_trigger ON tasks;
  `,

    // Create trigger
    `
  CREATE TRIGGER task_count_trigger
  AFTER INSERT OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION update_project_task_count();
  `,

    // ============================================================================
    // PHASE 4: Create Atomic Task Creation Function
    // ============================================================================

    `
  CREATE OR REPLACE FUNCTION create_task_with_statuses(
    p_project_id INTEGER,
    p_creator_id INTEGER,
    p_title TEXT,
    p_description TEXT DEFAULT NULL,
    p_type TEXT DEFAULT 'one_off',
    p_recurrence_pattern TEXT DEFAULT NULL,
    p_due_date TIMESTAMPTZ DEFAULT NOW(),
    p_recurrence_index INTEGER DEFAULT NULL,
    p_recurrence_total INTEGER DEFAULT NULL,
    p_show_recurrence_index BOOLEAN DEFAULT FALSE,
    p_participant_user_ids INTEGER[] DEFAULT ARRAY[]::INTEGER[]
  )
  RETURNS TABLE (
    task_id INTEGER,
    task_data JSONB,
    statuses_created INTEGER
  )
  LANGUAGE plpgsql
  AS $$
  DECLARE
    v_task_id INTEGER;
    v_participant_id INTEGER;
    v_statuses_count INTEGER := 0;
    v_task_record RECORD;
  BEGIN
    -- Insert the task
    INSERT INTO tasks (
      project_id, creator_id, title, description, type, 
      recurrence_pattern, due_date, recurrence_index, 
      recurrence_total, show_recurrence_index,
      created_at, updated_at
    ) VALUES (
      p_project_id, p_creator_id, p_title, p_description, p_type::task_type,
      p_recurrence_pattern::recurrence_pattern, p_due_date, p_recurrence_index,
      p_recurrence_total, p_show_recurrence_index,
      NOW(), NOW()
    )
    RETURNING id INTO v_task_id;
    
    -- Create task statuses for all participants
    FOREACH v_participant_id IN ARRAY p_participant_user_ids
    LOOP
      INSERT INTO task_statuses (task_id, user_id, status)
      VALUES (v_task_id, v_participant_id, 'active');
      v_statuses_count := v_statuses_count + 1;
    END LOOP;
    
    -- Get the created task as JSON
    SELECT * INTO v_task_record FROM tasks WHERE id = v_task_id;
    
    -- Return result
    RETURN QUERY SELECT 
      v_task_id,
      to_jsonb(v_task_record),
      v_statuses_count;
  END;
  $$;
  `,

    // ============================================================================
    // PHASE 5: Create Function to Delete Task with Cleanup
    // ============================================================================

    `
  CREATE OR REPLACE FUNCTION delete_task_completely(p_task_id INTEGER)
  RETURNS BOOLEAN
  LANGUAGE plpgsql
  AS $$
  BEGIN
    -- Delete task (cascade will handle statuses, logs, recurrence)
    DELETE FROM tasks WHERE id = p_task_id;
    RETURN FOUND;
  END;
  $$;
  `,
];

async function run() {
    console.log('='.repeat(60));
    console.log('DATABASE INTEGRITY REPAIR MIGRATION');
    console.log('='.repeat(60));

    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database\n');

        // Run each repair statement
        for (let i = 0; i < REPAIR_STATEMENTS.length; i++) {
            const statement = REPAIR_STATEMENTS[i];
            const preview = statement.trim().split('\n')[0]?.trim().slice(0, 60) || 'statement';

            console.log(`[${i + 1}/${REPAIR_STATEMENTS.length}] Running: ${preview}...`);

            try {
                const result = await client.query(statement);
                const rowCount = result.rowCount ?? 0;
                console.log(`  ✓ Success ${rowCount > 0 ? `(${rowCount} rows affected)` : ''}`);
            } catch (error: any) {
                // Ignore "already exists" errors for idempotent operations
                if (error.code === '42P07' || error.code === '42710' ||
                    error.message?.includes('already exists')) {
                    console.log('  ✓ (already exists, skipping)');
                } else if (error.code === '42883' || error.message?.includes('does not exist')) {
                    console.log('  - (skipped - object does not exist yet)');
                } else {
                    console.error(`  ✗ Error: ${error.message}`);
                    // Don't throw - continue with other repairs
                }
            }
        }

        // Verify repairs
        console.log('\n' + '='.repeat(60));
        console.log('VERIFICATION');
        console.log('='.repeat(60));

        // Check for remaining orphaned records
        const orphanedStatuses = await client.query(`
      SELECT COUNT(*) as count FROM task_statuses 
      WHERE task_id NOT IN (SELECT id FROM tasks)
    `);
        console.log(`Orphaned task_statuses: ${orphanedStatuses.rows[0].count}`);

        const orphanedLogs = await client.query(`
      SELECT COUNT(*) as count FROM completion_logs 
      WHERE task_id NOT IN (SELECT id FROM tasks)
    `);
        console.log(`Orphaned completion_logs: ${orphanedLogs.rows[0].count}`);

        // Check project count discrepancies
        const countDiscrepancies = await client.query(`
      SELECT p.id, p.name, p.total_tasks, COUNT(t.id) as actual_count
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      GROUP BY p.id
      HAVING p.total_tasks != COUNT(t.id)
    `);
        console.log(`Projects with count discrepancies: ${countDiscrepancies.rows.length}`);

        if (countDiscrepancies.rows.length > 0) {
            console.log('Discrepancy details:');
            countDiscrepancies.rows.forEach(row => {
                console.log(`  - Project ${row.id} "${row.name}": claims ${row.total_tasks} tasks, has ${row.actual_count}`);
            });
        }

        console.log('\n✅ Database repair migration complete!');

    } finally {
        await client.end();
    }
}

run().catch(error => {
    console.error('Migration failed:', error);
    process.exit(1);
});
