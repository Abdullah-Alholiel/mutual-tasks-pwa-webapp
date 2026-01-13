// ============================================================================
// Data Integrity Guard - Validates database consistency on app startup
// ============================================================================

import { useEffect, useState } from 'react';
import { getDatabaseClient } from '@/db';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Task } from '@/types';

interface IntegrityIssue {
    type: 'phantom_tasks' | 'orphaned_status' | 'cache_mismatch' | 'stale_data';
    description: string;
    projectId?: number;
    taskId?: number;
}

interface IntegrityCheckResult {
    isHealthy: boolean;
    issues: IntegrityIssue[];
    checkedAt: Date;
}

/**
 * Hook to check and repair data integrity issues
 * Runs on app startup and periodically
 */
export function useDataIntegrityGuard(options = { enabled: true, intervalMs: 300000 }) {
    const [result, setResult] = useState<IntegrityCheckResult | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const queryClient = useQueryClient();

    const forceNuclearReset = () => {
        console.warn('[DataIntegrityGuard] Initiating reset');

        // 1. Clear LocalStorage
        localStorage.clear();

        // 2. Clear SessionStorage
        sessionStorage.clear();

        // 3. Clear Query Cache
        queryClient.clear();

        // 4. Unregister Service Workers
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then(function (registrations) {
                for (let registration of registrations) {
                    registration.unregister();
                }
            });
        }

        // 5. Reload page
        window.location.reload();
    };

    const checkIntegrity = async (): Promise<IntegrityCheckResult> => {
        const issues: IntegrityIssue[] = [];
        const db = getDatabaseClient();

        try {
            // 1. Fetch ALL authentic tasks from Database
            const dbTasks = await db.tasks.getAll({});
            const dbTaskIds = new Set(dbTasks.map(t => t.id));
            const dbTasksByProject = new Map<number, number>();

            dbTasks.forEach(t => {
                const count = dbTasksByProject.get(t.projectId) || 0;
                dbTasksByProject.set(t.projectId, count + 1);
            });

            // 2. Fetch ALL projects from Database
            const projects = await db.projects.getAll({});

            // 3. Check Project Counts (DB Consistency)
            for (const project of projects) {
                const actualCount = dbTasksByProject.get(project.id) || 0;

                if (project.totalTasks !== actualCount) {
                    issues.push({
                        type: 'stale_data',
                        description: `DB CONSISTENCY ERROR: Project ${project.name} (ID: ${project.id}) has count ${project.totalTasks} but actually has ${actualCount} tasks.`,
                        projectId: project.id,
                    });
                }
            }

            // 4. Check Frontend Cache vs Authenticated DB Data (The "Phantom Task" Check)
            const cachedTasks = queryClient.getQueryData(['tasks']) as Task[] | undefined;

            if (cachedTasks && Array.isArray(cachedTasks)) {
                let phantomCount = 0;
                for (const cachedTask of cachedTasks) {
                    if (!dbTaskIds.has(cachedTask.id)) {
                        phantomCount++;
                        if (phantomCount <= 5) { // Only log details for first 5
                            console.error(`[DataIntegrityGuard] Phantom Task: "${cachedTask.title}" (ID: ${cachedTask.id}) in cache but not in DB`);
                            issues.push({
                                type: 'phantom_tasks',
                                description: `Phantom Task: "${cachedTask.title}" (ID: ${cachedTask.id}) is in UI but not DB.`,
                                taskId: cachedTask.id,
                            });
                        }
                    }
                }

                if (phantomCount > 0) {
                    console.error(`[DataIntegrityGuard] Total phantom tasks: ${phantomCount}`);
                }
            }

            const checkResult: IntegrityCheckResult = {
                isHealthy: issues.length === 0,
                issues,
                checkedAt: new Date(),
            };

            return checkResult;
        } catch (error) {
            console.error('[DataIntegrityGuard] Error during integrity check:', error);
            return {
                isHealthy: false,
                issues: [{
                    type: 'stale_data',
                    description: `Integrity check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                }],
                checkedAt: new Date(),
            };
        }
    };

    useEffect(() => {
        if (!options.enabled) return;

        let isMounted = true;

        const runCheck = async () => {
            if (isChecking) return;

            setIsChecking(true);
            try {
                const checkResult = await checkIntegrity();
                if (isMounted) {
                    setResult(checkResult);

                    if (!checkResult.isHealthy) {
                        const phantomTasks = checkResult.issues
                            .filter(i => i.type === 'phantom_tasks')
                            .map(i => i.taskId)
                            .filter(Boolean) as number[];

                        if (phantomTasks.length > 0) {
                            // AUTO-FIX: Remove cached task data and force fresh DB fetch
                            queryClient.removeQueries({ queryKey: ['tasks'] });
                            queryClient.refetchQueries({ queryKey: ['tasks'] });
                        }
                    }
                }
            } finally {
                if (isMounted) {
                    setIsChecking(false);
                }
            }
        };

        // Run initial check
        runCheck();

        // Set up periodic checks
        const interval = setInterval(runCheck, options.intervalMs);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [options.enabled, options.intervalMs]);

    return {
        result,
        isChecking,
        checkIntegrity,
        forceNuclearReset
    };
}

/**
 * Component version of the integrity guard with UI feedback
 */
export function DataIntegrityGuard({ children }: { children: React.ReactNode }) {
    const { result, forceNuclearReset } = useDataIntegrityGuard();

    useEffect(() => {
        if (result && !result.isHealthy) {
            const phantomCount = result.issues.filter(i => i.type === 'phantom_tasks').length;

            if (phantomCount > 0) {
                toast.error('Data Synchronization Error', {
                    description: `Found ${phantomCount} tasks that don't exist in the database. recommended: Reset App Data.`,
                    action: {
                        label: 'Fix Now',
                        onClick: () => forceNuclearReset()
                    },
                    duration: 10000,
                });
            }
        }
    }, [result]);

    return <>{children}</>;
}

export default DataIntegrityGuard;
