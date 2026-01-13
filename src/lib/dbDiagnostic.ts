// ============================================================================
// Database Diagnostic Utility
// ============================================================================
// Run this in browser console to diagnose database connection issues
// ============================================================================

import { getDatabaseClient } from '@/db';
import { getSupabaseUrl, getSupabaseAnonKey } from '@/lib/env';

/**
 * Comprehensive database diagnostic
 * Call this from browser console: import('@/lib/dbDiagnostic').then(m => m.runDiagnostic())
 */
export async function runDiagnostic() {
    console.log('='.repeat(60));
    console.log('[DB DIAGNOSTIC] Starting comprehensive database check...');
    console.log('='.repeat(60));

    // 1. Check environment configuration
    console.log('\n[1] Environment Configuration:');
    const supabaseUrl = getSupabaseUrl();
    const supabaseKey = getSupabaseAnonKey();
    console.log('  Supabase URL:', supabaseUrl);
    console.log('  Supabase Key:', supabaseKey ? `${supabaseKey.slice(0, 20)}...` : 'NOT SET');

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ CRITICAL: Missing Supabase configuration!');
        return;
    }

    // 2. Get database client
    console.log('\n[2] Database Client:');
    const db = getDatabaseClient();
    console.log('  Database client initialized:', !!db);

    // 3. Check current max task ID in database
    console.log('\n[3] Checking current task count and max ID:');
    try {
        const tasks = await db.tasks.getAll({});
        console.log('  Total tasks fetched:', tasks.length);

        if (tasks.length > 0) {
            const maxId = Math.max(...tasks.map(t => t.id));
            const minId = Math.min(...tasks.map(t => t.id));
            console.log('  Min task ID:', minId);
            console.log('  Max task ID:', maxId);
            console.log('  Sample task:', tasks[0]);
        } else {
            console.log('  No tasks found in database!');
        }
    } catch (error) {
        console.error('  ❌ Error fetching tasks:', error);
    }

    // 4. Check projects
    console.log('\n[4] Checking projects:');
    try {
        const projects = await db.projects.getAll({});
        console.log('  Total projects fetched:', projects.length);

        if (projects.length > 0) {
            const maxId = Math.max(...projects.map(p => p.id));
            console.log('  Max project ID:', maxId);

            // Check project 22 specifically
            const project22 = projects.find(p => p.id === 22);
            if (project22) {
                console.log('  Project 22 found:', project22.name, 'total_tasks:', project22.totalTasks);
            } else {
                console.log('  Project 22 NOT found');
            }
        }
    } catch (error) {
        console.error('  ❌ Error fetching projects:', error);
    }

    // 5. Test INSERT
    console.log('\n[5] Testing INSERT operation:');
    console.log('  Creating a test task in project 1...');

    try {
        const testTask = await db.tasks.create({
            projectId: 1,
            creatorId: 1,
            title: `DIAGNOSTIC_TEST_${Date.now()}`,
            description: 'This is a diagnostic test task - DELETE ME',
            type: 'one_off',
            dueDate: new Date(),
        });

        console.log('  ✅ Task created with ID:', testTask.id);
        console.log('  Full task data:', testTask);

        // 6. Verify task exists
        console.log('\n[6] Verifying task exists in database:');
        const verifyTask = await db.tasks.getById(testTask.id);

        if (verifyTask) {
            console.log('  ✅ VERIFICATION SUCCESS - Task confirmed in database');
            console.log('  Task ID:', verifyTask.id, 'Title:', verifyTask.title);

            // Clean up - delete the test task
            console.log('\n[7] Cleaning up test task...');
            await db.tasks.delete(testTask.id);
            console.log('  ✅ Test task deleted');

            console.log('\n' + '='.repeat(60));
            console.log('✅ DATABASE IS WORKING CORRECTLY');
            console.log('='.repeat(60));
        } else {
            console.error('  ❌ VERIFICATION FAILED - Task NOT found after insert!');
            console.error('  This confirms data is NOT persisting to the database.');
            console.error('  Possible causes:');
            console.error('  1. RLS policies blocking inserts');
            console.error('  2. Different database connection for read/write');
            console.error('  3. Transaction isolation issues');

            console.log('\n' + '='.repeat(60));
            console.log('❌ DATABASE INSERT IS NOT PERSISTING');
            console.log('='.repeat(60));
        }

    } catch (error) {
        console.error('  ❌ Error during INSERT test:', error);
        console.log('\n' + '='.repeat(60));
        console.log('❌ DATABASE INSERT FAILED');
        console.log('='.repeat(60));
    }
}

/**
 * Quick check of task IDs in database
 */
export async function checkTaskIds() {
    const db = getDatabaseClient();
    const tasks = await db.tasks.getAll({});

    console.log('Total tasks:', tasks.length);
    console.log('Task IDs:', tasks.map(t => t.id).sort((a, b) => a - b));

    // Check for gaps
    const sortedIds = tasks.map(t => t.id).sort((a, b) => a - b);
    const gaps: number[] = [];
    for (let i = 1; i < sortedIds.length; i++) {
        if (sortedIds[i] - sortedIds[i - 1] > 1) {
            gaps.push(sortedIds[i - 1]);
        }
    }

    if (gaps.length > 0) {
        console.log('Gaps found after IDs:', gaps);
    } else {
        console.log('No significant gaps in IDs');
    }

    return { total: tasks.length, minId: sortedIds[0], maxId: sortedIds[sortedIds.length - 1], gaps };
}

// Export for browser console access
if (typeof window !== 'undefined') {
    (window as any).dbDiagnostic = { runDiagnostic, checkTaskIds };
}
