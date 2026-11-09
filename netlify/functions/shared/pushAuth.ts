import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Push-target authorization (P1-6b).
 *
 * The caller may push to a target only when a real relationship exists,
 * verified server-side from the database (never from caller-supplied data):
 *
 *   1. target is the caller themselves (reminders, self-echo), OR
 *   2. an accepted friend link exists in either direction, OR
 *   3. caller and target share an ACTIVE project (both rows in
 *      project_participants with removed_at IS NULL).
 *
 * Pending friend rows are deliberately NOT accepted: anyone can create a
 * friend_request row toward any user, so honoring pending rows would keep
 * the spoofing hole open (see docs/plans/2026-11-09-run2-p1-6b).
 *
 * Fails CLOSED: any DB error → false (and logged server-side only).
 */
export async function canNotifyTarget(
    supabase: SupabaseClient,
    callerId: number,
    targetId: number
): Promise<boolean> {
    // 1. Self-push is always allowed
    if (callerId === targetId) return true;

    // 2. Accepted friend link, either direction
    try {
        const orFilter = `and(user_id.eq.${callerId},friend_id.eq.${targetId}),and(user_id.eq.${targetId},friend_id.eq.${callerId})`;
        const { data: friendRows, error: friendError } = await supabase
            .from('friends')
            .select('id')
            .eq('status', 'accepted')
            .or(orFilter)
            .limit(1);

        if (!friendError && friendRows && friendRows.length > 0) return true;

        if (friendError) {
            console.error('[pushAuth] friends check failed:', friendError.code, friendError.message);
        }
    } catch (err) {
        console.error('[pushAuth] friends check threw:', err);
    }

    // 3. Shared active project (both participants, neither removed)
    try {
        // Projects where the caller is an active participant
        const { data: callerProjects, error: callerError } = await supabase
            .from('project_participants')
            .select('project_id')
            .eq('user_id', callerId)
            .is('removed_at', null);

        if (callerError) {
            console.error('[pushAuth] caller projects check failed:', callerError.code, callerError.message);
            return false;
        }
        if (!callerProjects || callerProjects.length === 0) return false;

        const projectIds = [...new Set(callerProjects.map(p => p.project_id))];

        const { count, error: sharedError } = await supabase
            .from('project_participants')
            .select('project_id', { count: 'exact', head: true })
            .eq('user_id', targetId)
            .is('removed_at', null)
            .in('project_id', projectIds);

        if (sharedError) {
            console.error('[pushAuth] shared project check failed:', sharedError.code, sharedError.message);
            return false;
        }

        return (count ?? 0) > 0;
    } catch (err) {
        console.error('[pushAuth] shared-project check threw:', err);
        return false;
    }
}
