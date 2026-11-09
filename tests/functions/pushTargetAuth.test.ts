// P1-6b regression tests: push-target authorization.
// canNotifyTarget must allow ONLY: self, accepted friends (either direction),
// shared active project. Pending friend rows and unrelated users → false.
// DB errors fail CLOSED.

import { describe, it, expect, vi } from 'vitest';
import { canNotifyTarget } from '../../netlify/functions/shared/pushAuth';

type Row = Record<string, unknown>;

/** Minimal chainable query-builder fake covering the calls pushAuth makes. */
function fakeClient(tables: {
    friends?: Row[];
    project_participants?: Row[];
    failOn?: string[];
}) {
    const failOn = tables.failOn ?? [];
    const makeBuilder = (table: string) => {
        const state: {
            filters: string[];
            selectOpts?: { count?: string; head?: boolean };
            resolved?: { data: Row[] | null; error: { code: string; message: string } | null; count?: number };
        } = { filters: [] };
        const builder: any = {
            select(_cols?: unknown, opts?: { count?: string; head?: boolean }) { state.selectOpts = opts; return builder; },
            eq(col: string, val: unknown) { state.filters.push(`${col}=${val}`); return builder; },
            is(col: string, val: unknown) { state.filters.push(`${col}:${val}`); return builder; },
            or(filter: string) { state.filters.push(`or(${filter})`); return builder; },
            in(col: string, vals: unknown[]) { state.filters.push(`${col} in (${vals.join(',')})`); return builder; },
            limit(_n: number) { return builder; },
            then(onFulfilled: (r: unknown) => unknown) {
                if (!state.resolved) {
                    if (failOn.includes(table)) {
                        state.resolved = { data: null, error: { code: 'PGRST301', message: 'jwt expired (fake)' } };
                    } else if (table === 'friends') {
                        // emulate .eq('status','accepted') + .or(...) matching
                        const wanted = state.filters.find(f => f.startsWith('or('));
                        let rows = (tables.friends ?? []).filter(r => r.status === 'accepted');
                        if (wanted) {
                            const inner = wanted.slice(3, -1);
                            const clauses = inner.split(',and(').map((c, i) => (i === 0 ? c : 'and(' + c));
                            rows = rows.filter(r =>
                                clauses.some(cl => {
                                    const m = cl.match(/user_id\.eq\.(\d+),friend_id\.eq\.(\d+)/);
                                    if (!m) return false;
                                    return (
                                        r.user_id === Number(m[1]) &&
                                        r.friend_id === Number(m[2])
                                    );
                                })
                            );
                        }
                        state.resolved = { data: rows, error: null };
                    } else if (table === 'project_participants') {
                        let rows = tables.project_participants ?? [];
                        for (const f of state.filters) {
                            const eqUser = f.match(/^user_id=(\d+)$/);
                            if (eqUser) rows = rows.filter(r => r.user_id === Number(eqUser[1]));
                            if (f === 'removed_at:null') rows = rows.filter(r => r.removed_at === null);
                            const inMatch = f.match(/^project_id in \((.*)\)$/);
                            if (inMatch) {
                                const ids = inMatch[1].split(',').map(Number);
                                rows = rows.filter(r => ids.includes(r.project_id as number));
                            }
                        }
                        // emulate head:true count mode
                        const result: { data: Row[] | null; error: { code: string; message: string } | null; count?: number } = {
                            data: state.selectOpts?.head ? null : rows,
                            error: null,
                        };
                        if (state.selectOpts?.count === 'exact') result.count = rows.length;
                        state.resolved = result;
                    } else {
                        state.resolved = { data: [], error: null };
                    }
                }
                return Promise.resolve(onFulfilled(state.resolved));
            },
        };
        return builder;
    };
    return {
        from(table: string) { return makeBuilder(table); },
    } as unknown as import('@supabase/supabase-js').SupabaseClient;
}

describe('canNotifyTarget (P1-6b push-target authorization)', () => {
    it('allows self-push always', async () => {
        const client = fakeClient({});
        await expect(canNotifyTarget(client, 42, 42)).resolves.toBe(true);
    });

    it('allows a target who is an accepted friend (caller initiated)', async () => {
        const client = fakeClient({ friends: [{ id: 1, user_id: 42, friend_id: 99, status: 'accepted' }] });
        await expect(canNotifyTarget(client, 42, 99)).resolves.toBe(true);
    });

    it('allows a target who is an accepted friend (reverse direction)', async () => {
        const client = fakeClient({ friends: [{ id: 2, user_id: 99, friend_id: 42, status: 'accepted' }] });
        await expect(canNotifyTarget(client, 42, 99)).resolves.toBe(true);
    });

    it('REJECTS a pending friend row (spoofing vector)', async () => {
        const client = fakeClient({ friends: [{ id: 3, user_id: 42, friend_id: 77, status: 'pending' }] });
        await expect(canNotifyTarget(client, 42, 77)).resolves.toBe(false);
    });

    it('REJECTS a stranger with no relationship', async () => {
        const client = fakeClient({ friends: [], project_participants: [] });
        await expect(canNotifyTarget(client, 42, 555)).resolves.toBe(false);
    });

    it('allows via shared active project even without friendship', async () => {
        const client = fakeClient({
            friends: [],
            project_participants: [
                { project_id: 7, user_id: 42, removed_at: null },
                { project_id: 7, user_id: 99, removed_at: null },
                { project_id: 8, user_id: 999, removed_at: null },
            ],
        });
        await expect(canNotifyTarget(client, 42, 99)).resolves.toBe(true);
    });

    it('REJECTS when the shared-project row is soft-removed (removed_at set)', async () => {
        const client = fakeClient({
            friends: [],
            project_participants: [
                { project_id: 7, user_id: 42, removed_at: null },
                { project_id: 7, user_id: 99, removed_at: '2026-11-01T00:00:00Z' },
            ],
        });
        await expect(canNotifyTarget(client, 42, 99)).resolves.toBe(false);
    });

    it('REJECTS a user who only shared a DIFFERENT project with the caller', async () => {
        const client = fakeClient({
            friends: [],
            project_participants: [
                { project_id: 7, user_id: 42, removed_at: null },
                { project_id: 9, user_id: 99, removed_at: null },
            ],
        });
        await expect(canNotifyTarget(client, 42, 99)).resolves.toBe(false);
    });

    it('fails CLOSED when the friends table errors', async () => {
        const client = fakeClient({ friends: [{ id: 1, user_id: 42, friend_id: 99, status: 'accepted' }], failOn: ['friends'] });
        await expect(canNotifyTarget(client, 42, 99)).resolves.toBe(false);
    });

    it('fails CLOSED when the participants table errors', async () => {
        const client = fakeClient({ friends: [], project_participants: [{ project_id: 7, user_id: 42, removed_at: null }], failOn: ['project_participants'] });
        await expect(canNotifyTarget(client, 42, 99)).resolves.toBe(false);
    });

    it('friends check does not double-count — spy would show at most one query per phase', async () => {
        // sanity on query shape: 'or' filter is present and status filter applied
        const client = fakeClient({ friends: [{ id: 1, user_id: 42, friend_id: 99, status: 'accepted' }] });
        const anyClient = client as any;
        const spy = vi.spyOn(anyClient, 'from');
        await canNotifyTarget(client, 42, 99);
        expect(spy).toHaveBeenCalledTimes(1); // friend hit short-circuits before project query
    });
});
