// ============================================================================
// Project delete cascade ORDER contract (run 28, L4d acceptance finding)
// ============================================================================
// The live schema (migrations 001-003) has ON DELETE NO ACTION on all child
// FKs; 004's cascades are built but owner-apply is pending. Until then the
// CLIENT owns the delete order: grandchildren (completion_logs, task_statuses,
// task_recurrence, notifications-by-task) must be cleared before tasks, and
// notifications-by-project before the project. The previous order deleted
// participants then tasks, leaving task_statuses/completion_logs rows behind:
// any project containing a completed task failed to delete with 23503
// (proven live via REST as qa-bot before this fix; the L4d acceptance suite
// caught it as 'delete the project via UI' failing on both engines).
//
// These tests assert BEHAVIOR: the exact statement order, that the child
// prefetch happens first, that a project with no tasks skips the grandchild
// clears, and that a failing child delete aborts BEFORE the project delete.

import { describe, it, expect, vi } from 'vitest';
import { ProjectsRepository } from '../../src/features/projects/api/projects';

type Rec = { table: string; kind: 'select' | 'delete' };

/**
 * Recording supabase mock.
 * - Every statement (one await per from()-chain) is recorded as
 *   `table:kind` in `rec`.
 * - `script` maps `delete:<table>` to a FIFO queue of error objects:
 *   undefined entries (or missing keys) resolve as success; an error object
 *   is returned as { error } for that ONE delete statement.
 * - select on tasks resolves { data: taskIds.map(id => ({ id })) }.
 */
function makeClient(taskIds: number[], script: Partial<Record<string, (unknown | null)[]>> = {}) {
    const rec: Rec[] = [];
    const queues = new Map(
        Object.entries(script).map(([k, v]) => [k, [...(v ?? [])]] as [string, (unknown | null)[]]),
    );

    const from = (table: string) => {
        const op: Rec = { table, kind: 'select' };
        const chain: any = {
            select: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            in: vi.fn(() => chain),
            delete: vi.fn(() => {
                op.kind = 'delete';
                return chain;
            }),
            then: (resolve: (v: unknown) => void, reject: (v: unknown) => void) => {
                rec.push(op);
                let result: unknown;
                if (op.kind === 'select') {
                    result = { data: taskIds.map((id) => ({ id })), error: null };
                } else {
                    const q = `delete:${op.table}`;
                    const queue = queues.get(q);
                    const err = queue?.shift();
                    result = err ? { data: null, error: err } : { data: null, error: null };
                }
                return Promise.resolve(result).then(resolve, reject);
            },
        };
        return chain;
    };

    const client = { from: vi.fn(from) } as unknown as any;
    return { client, rec };
}

const NO_ERROR_FLOW = (ids: number[]) => makeClient(ids).rec;

describe('ProjectsRepository.delete — FK-safe order (pre-004 live schema)', () => {
    it('clears grandchildren before tasks, tasks before participants, participants before the project', async () => {
        const { client, rec } = makeClient([41, 42]);
        const repo = new ProjectsRepository(client as never);
        await repo.delete(7);

        expect(rec.map((r) => `${r.table}:${r.kind}`)).toEqual([
            'tasks:select',            // prefetch task ids
            'completion_logs:delete',  // grandchildren first...
            'task_statuses:delete',
            'task_recurrence:delete',
            'notifications:delete',    // ...including notifications by task_id
            'notifications:delete',    // notifications by project_id
            'tasks:delete',            // children of the project
            'project_participants:delete',
            'projects:delete',         // the project LAST
        ]);
    });

    it('a project with no tasks skips the task-keyed grandchild clears but still deletes everything', async () => {
        const { client, rec } = makeClient([]);
        const repo = new ProjectsRepository(client as never);
        await repo.delete(7);

        const tables = rec.filter((r) => r.kind === 'delete').map((r) => r.table);
        expect(tables).toEqual(['notifications', 'tasks', 'project_participants', 'projects']);
    });

    it('a failing grandchild delete aborts BEFORE the tasks delete (no half-deleted project)', async () => {
        const { client, rec } = makeClient([41], {
            'delete:completion_logs': [{ message: 'boom', code: '42501' }],
        });
        const repo = new ProjectsRepository(client as never);
        await expect(repo.delete(7)).rejects.toMatchObject({ message: 'boom' });

        const tables = rec.filter((r) => r.kind === 'delete').map((r) => r.table);
        expect(tables).toEqual(['completion_logs']); // nothing else was attempted
    });

    it('a failing tasks delete aborts BEFORE the project delete', async () => {
        const { client, rec } = makeClient([41], {
            'delete:tasks': [{ message: 'fk still referenced', code: '23503' }],
        });
        const repo = new ProjectsRepository(client as never);
        await expect(repo.delete(7)).rejects.toMatchObject({ code: '23503' });

        const tables = rec.filter((r) => r.kind === 'delete').map((r) => r.table);
        expect(tables[tables.length - 1]).toBe('tasks'); // project delete never ran
        expect(tables).not.toContain('projects');
    });

    it('the old broken order (participants before grandchildren) can no longer happen', async () => {
        const { client, rec } = makeClient([41, 42]);
        const repo = new ProjectsRepository(client as never);
        await repo.delete(7);

        const idx = (t: string) => rec.findIndex((r) => r.kind === 'delete' && r.table === t);
        expect(idx('completion_logs')).toBeLessThan(idx('task_statuses'));
        expect(idx('task_statuses')).toBeLessThan(idx('tasks'));
        expect(idx('tasks')).toBeLessThan(idx('project_participants'));
        expect(idx('project_participants')).toBeLessThan(idx('projects'));
    });

    it('success flow produces no errors (happy path is fully scripted green)', async () => {
        const { client } = makeClient([41, 42]);
        const repo = new ProjectsRepository(client as never);
        await expect(repo.delete(7)).resolves.toBeUndefined();
    });

    it('regression shape: NO_ERROR_FLOW helper stays consistent with makeClient', () => {
        expect(NO_ERROR_FLOW([1]).length).toBe(0);
    });
});
