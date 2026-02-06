// ============================================================================
// Atomic Task Operations - Using Database Transactions
// ============================================================================
// These functions use Supabase RPC to ensure atomic task creation/deletion
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';
import type { Task } from '@/types';
import { transformTaskRow, type TaskRow } from '@/db/transformers';
import { notifyTaskCreated } from '@/lib/tasks/taskEmailNotifications';

// Get Supabase client for RPC calls
function getSupabaseClient() {
    const url = getSupabaseUrl();
    const key = getSupabaseAnonKey();

    if (!url || !key) {
        throw new Error('Supabase configuration missing');
    }

    return createClient(url, key);
}

export interface AtomicTaskInput {
    projectId: number;
    creatorId: number;
    title: string;
    description?: string;
    type: 'one_off' | 'habit';
    recurrencePattern?: string;
    dueDate: Date;
    recurrenceIndex?: number;
    recurrenceTotal?: number;
    showRecurrenceIndex?: boolean;
    participantUserIds: number[];
}

export interface AtomicTaskResult {
    task: Task;
    statusesCreated: number;
}

/**
 * Create a task with statuses using direct Supabase INSERT
 * Uses verification to ensure data is persisted, with manual rollback on failure
 */
export async function createTaskAtomic(input: AtomicTaskInput): Promise<AtomicTaskResult> {
    const supabase = getSupabaseClient();

    console.log('[AtomicTask] Creating task with direct insert:', input.title);

    // 1. INSERT task directly
    const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
            project_id: input.projectId,
            creator_id: input.creatorId,
            title: input.title,
            description: input.description || null,
            type: input.type,
            recurrence_pattern: input.recurrencePattern || null,
            due_date: input.dueDate.toISOString(),
            recurrence_index: input.recurrenceIndex || null,
            recurrence_total: input.recurrenceTotal || null,
            show_recurrence_index: input.showRecurrenceIndex || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (taskError) {
        console.error('[AtomicTask] INSERT failed:', taskError);
        throw new Error(`Task creation failed: ${taskError.message}`);
    }

    // 2. VERIFY task exists in database
    const { data: verifyData, error: verifyError } = await supabase
        .from('tasks')
        .select('id')
        .eq('id', taskData.id)
        .single();

    if (verifyError || !verifyData) {
        console.error('[AtomicTask] ❌ VERIFICATION FAILED - Task not in database');
        throw new Error('Task not persisted. Check Supabase RLS policies.');
    }

    console.log('[AtomicTask] ✅ Task verified in database:', taskData.id);

    // 3. CREATE statuses for all participants
    // Determine initial status based on due date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDueDate = new Date(input.dueDate);
    taskDueDate.setHours(0, 0, 0, 0);
    const initialStatus = taskDueDate > today ? 'upcoming' : 'active';

    const statuses = input.participantUserIds.map(userId => ({
        task_id: taskData.id,
        user_id: userId,
        status: initialStatus,
    }));

    if (statuses.length > 0) {
        const { error: statusError } = await supabase
            .from('task_statuses')
            .insert(statuses);

        if (statusError) {
            console.error('[AtomicTask] Status creation failed, rolling back task:', statusError);
            // ROLLBACK: delete the task we just created
            await supabase.from('tasks').delete().eq('id', taskData.id);
            throw new Error(`Status creation failed: ${statusError.message}`);
        }

        console.log('[AtomicTask] ✅ Created', statuses.length, 'task statuses');
    }

    // Transform and return
    const task = transformTaskRow(taskData as TaskRow);

    // Send notifications to all participants (except creator)
    notifyTaskCreated(task.id, input.projectId, input.creatorId)
        .then(() => {
            console.log('[AtomicTask] ✅ notifyTaskCreated completed successfully for task:', task.id);
        })
        .catch(error => {
            console.error('[AtomicTask] ❌ notifyTaskCreated FAILED for task:', task.id, error);
            // Error is logged but not re-thrown - notification failure shouldn't block task creation
        });

    return {
        task,
        statusesCreated: statuses.length,
    };
}

/**
 * Delete a task completely using direct DELETE
 * Related records (statuses, logs, notifications) are cleaned up explicitly.
 * 
 * NOTE: We fetch notification IDs BEFORE deleting the task because the DB
 * might have ON DELETE SET NULL on the task_id foreign key, which would
 * set task_id to null before our delete query runs.
 */
export async function deleteTaskAtomic(taskId: number): Promise<boolean> {
    const supabase = getSupabaseClient();

    console.log('[AtomicTask] Deleting task:', taskId);

    // STEP 1: Fetch notification IDs BEFORE any deletes
    // This is critical because ON DELETE SET NULL might fire when we delete the task
    const { data: notificationData } = await supabase
        .from('notifications')
        .select('id')
        .eq('task_id', taskId);

    const notificationIds = notificationData?.map(n => n.id) || [];
    console.log('[AtomicTask] Found', notificationIds.length, 'notifications to delete for task', taskId);

    // STEP 2: Delete related records first (in case CASCADE not set up)
    await supabase.from('task_statuses').delete().eq('task_id', taskId);
    await supabase.from('completion_logs').delete().eq('task_id', taskId);
    await supabase.from('task_recurrence').delete().eq('task_id', taskId);

    // STEP 3: Delete the task itself
    const { error } = await supabase.from('tasks').delete().eq('id', taskId);

    if (error) {
        console.error('[AtomicTask] Delete failed:', error);
        throw new Error(`Failed to delete task: ${error.message}`);
    }

    // STEP 4: Delete notifications BY ID (not by task_id, which may now be null)
    if (notificationIds.length > 0) {
        const { error: notifError } = await supabase
            .from('notifications')
            .delete()
            .in('id', notificationIds);

        if (notifError) {
            console.warn('[AtomicTask] Failed to delete notifications:', notifError);
        } else {
            console.log('[AtomicTask] ✅ Deleted', notificationIds.length, 'notifications');
        }
    }

    console.log('[AtomicTask] ✅ Task deleted (with statuses, logs, and notifications):', taskId);
    return true;
}

/**
 * Delete a recurring task series
 * Deletes all tasks in the same series (same title, description, recurrence pattern)
 */
export async function deleteTaskSeriesAtomic(taskId: number): Promise<number> {
    const supabase = getSupabaseClient();

    console.log('[AtomicTask] Deleting task series for task:', taskId);

    // 1. Fetch the target task to identify series attributes
    const { data: targetTask, error: fetchError } = await supabase
        .from('tasks')
        .select('project_id, title, description, type, creator_id, recurrence_pattern')
        .eq('id', taskId)
        .single();

    if (fetchError || !targetTask) {
        console.error('[AtomicTask] Failed to fetch target task for series deletion:', fetchError);
        throw new Error(`Failed to fetch task: ${fetchError?.message || 'Task not found'}`);
    }

    if (targetTask.type !== 'habit') {
        console.warn('[AtomicTask] Task is not a habit, deleting single task only.');
        const success = await deleteTaskAtomic(taskId);
        return success ? 1 : 0;
    }

    // 2. Fetch all notification IDs for the ENTIRE series
    // We match tasks with same project, title, description (null safe), and type
    let query = supabase.from('tasks')
        .select('id')
        .eq('project_id', targetTask.project_id)
        .eq('title', targetTask.title)
        .eq('type', 'habit');

    // Handle nullable description
    if (targetTask.description) {
        query = query.eq('description', targetTask.description);
    } else {
        query = query.is('description', null);
    }

    const { data: seriesTasks, error: seriesError } = await query;

    if (seriesError || !seriesTasks || seriesTasks.length === 0) {
        console.error('[AtomicTask] Failed to find series tasks:', seriesError);
        return 0;
    }

    const taskIds = seriesTasks.map(t => t.id);
    console.log(`[AtomicTask] Found ${taskIds.length} tasks in series to delete.`);

    // 3. Delete related resources for ALL tasks in series
    // Notifications
    const { data: notificationData } = await supabase
        .from('notifications')
        .select('id')
        .in('task_id', taskIds);

    const notificationIds = notificationData?.map(n => n.id) || [];

    if (notificationIds.length > 0) {
        await supabase.from('notifications').delete().in('id', notificationIds);
    }

    // Task Statuses
    await supabase.from('task_statuses').delete().in('task_id', taskIds);

    // Completion Logs
    await supabase.from('completion_logs').delete().in('task_id', taskIds);

    // Task Recurrence
    await supabase.from('task_recurrence').delete().in('task_id', taskIds);

    // 4. Delete the tasks themselves
    const { error: deleteError, count } = await supabase
        .from('tasks')
        .delete({ count: 'exact' })
        .in('id', taskIds);

    if (deleteError) {
        console.error('[AtomicTask] Series delete failed:', deleteError);
        throw new Error(`Failed to delete series: ${deleteError.message}`);
    }

    console.log(`[AtomicTask] ✅ Successfully deleted series (${count} tasks).`);
    return count || 0;
}

/**
 * Fallback: Create task with statuses using individual queries
 * Use this if RPC function is not available
 */
export async function createTaskWithStatusesFallback(input: AtomicTaskInput): Promise<AtomicTaskResult> {
    const supabase = getSupabaseClient();

    console.log('[AtomicTask] Using fallback (non-atomic) task creation');

    // 1. Create task
    const { data: taskData, error: taskError } = await supabase
        .from('tasks')
        .insert({
            project_id: input.projectId,
            creator_id: input.creatorId,
            title: input.title,
            description: input.description || null,
            type: input.type,
            recurrence_pattern: input.recurrencePattern || null,
            due_date: input.dueDate.toISOString(),
            recurrence_index: input.recurrenceIndex || null,
            recurrence_total: input.recurrenceTotal || null,
            show_recurrence_index: input.showRecurrenceIndex || false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .select()
        .single();

    if (taskError) {
        console.error('[AtomicTask] Fallback task creation failed:', taskError);
        throw taskError;
    }

    // VERIFICATION: Check if task was actually persisted
    const { data: verifyData, error: verifyError } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskData.id)
        .single();

    if (verifyError || !verifyData) {
        console.error('[AtomicTask] ❌ VERIFICATION FAILED - Task not persisted!');
        console.error('[AtomicTask] This is a critical database issue.');
        throw new Error('Task creation verification failed. Task was not persisted to database.');
    }

    console.log('[AtomicTask] ✅ Task verified in database:', verifyData.id);

    // 2. Create statuses for all participants
    // Determine initial status based on due date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const taskDueDate = new Date(input.dueDate);
    taskDueDate.setHours(0, 0, 0, 0);
    const initialStatus = taskDueDate > today ? 'upcoming' : 'active';

    const statuses = input.participantUserIds.map(userId => ({
        task_id: taskData.id,
        user_id: userId,
        status: initialStatus,
    }));

    if (statuses.length > 0) {
        const { error: statusError } = await supabase
            .from('task_statuses')
            .insert(statuses);

        if (statusError) {
            console.error('[AtomicTask] Fallback status creation failed:', statusError);
            // Try to clean up the task we created
            await supabase.from('tasks').delete().eq('id', taskData.id);
            throw statusError;
        }
    }

    const task = transformTaskRow(taskData as TaskRow);

    // Send notifications to all participants (except creator)
    notifyTaskCreated(task.id, input.projectId, input.creatorId)
        .then(() => {
            console.log('[AtomicTask] ✅ notifyTaskCreated completed successfully for task:', task.id);
        })
        .catch(error => {
            console.error('[AtomicTask] ❌ notifyTaskCreated FAILED for task:', task.id, error);
            // Error is logged but not re-thrown - notification failure shouldn't block task creation
        });

    return {
        task,
        statusesCreated: statuses.length,
    };
}
