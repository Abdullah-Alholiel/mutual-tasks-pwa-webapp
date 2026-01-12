// ============================================================================
// UserPreloadCache - Cache for User Profiles to Enrich Realtime Payloads
// ============================================================================
// Singleton cache that stores user profiles, enabling instant enrichment of
// INSERT payloads that only contain user IDs.
// ============================================================================

import { getDatabaseClient } from '@/db';
import type { User } from '@/types';

/**
 * Singleton cache for user profiles.
 * Used to enrich realtime INSERT payloads with full user data.
 */
class UserPreloadCache {
    private static instance: UserPreloadCache | null = null;
    private cache: Map<number, User> = new Map();
    private pendingFetches: Map<number, Promise<User | null>> = new Map();
    private lastFullRefresh: number = 0;
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    private constructor() { }

    static getInstance(): UserPreloadCache {
        if (!UserPreloadCache.instance) {
            UserPreloadCache.instance = new UserPreloadCache();
        }
        return UserPreloadCache.instance;
    }

    /**
     * Get a user from cache, or fetch if not present
     */
    async get(userId: number): Promise<User | null> {
        // Check cache first
        const cached = this.cache.get(userId);
        if (cached) return cached;

        // Check if already fetching
        const pending = this.pendingFetches.get(userId);
        if (pending) return pending;

        // Fetch and cache
        const fetchPromise = this.fetchUser(userId);
        this.pendingFetches.set(userId, fetchPromise);

        try {
            const user = await fetchPromise;
            if (user) {
                this.cache.set(userId, user);
            }
            return user;
        } finally {
            this.pendingFetches.delete(userId);
        }
    }

    /**
     * Get user synchronously (returns undefined if not cached)
     */
    getSync(userId: number): User | undefined {
        return this.cache.get(userId);
    }

    /**
     * Preload multiple users at once (batch fetch)
     */
    async preload(userIds: number[]): Promise<void> {
        const uncachedIds = userIds.filter(id => !this.cache.has(id));
        if (uncachedIds.length === 0) return;

        try {
            const db = getDatabaseClient();
            const users = await db.users.getByIds(uncachedIds);
            users.forEach(user => this.cache.set(user.id, user));
        } catch (err) {
            console.warn('[UserPreloadCache] Failed to preload users:', err);
        }
    }

    /**
     * Preload all members of a project
     */
    async preloadProjectMembers(projectId: number): Promise<void> {
        try {
            const db = getDatabaseClient();
            const participants = await db.projects.getParticipants(projectId);
            participants.forEach(p => {
                if (p.user) {
                    this.cache.set(p.user.id, p.user);
                }
            });
        } catch (err) {
            console.warn('[UserPreloadCache] Failed to preload project members:', err);
        }
    }

    /**
     * Add a user to cache manually (e.g., after login or profile update)
     */
    set(user: User): void {
        this.cache.set(user.id, user);
    }

    /**
     * Clear the cache (e.g., on logout)
     */
    clear(): void {
        this.cache.clear();
        this.pendingFetches.clear();
        this.lastFullRefresh = 0;
    }

    /**
     * Get cache stats for debugging
     */
    getStats(): { size: number; pending: number } {
        return {
            size: this.cache.size,
            pending: this.pendingFetches.size
        };
    }

    private async fetchUser(userId: number): Promise<User | null> {
        try {
            const db = getDatabaseClient();
            return await db.users.getById(userId);
        } catch (err) {
            console.warn(`[UserPreloadCache] Failed to fetch user ${userId}:`, err);
            return null;
        }
    }
}

// Export singleton getter
export const getUserPreloadCache = () => UserPreloadCache.getInstance();

export default UserPreloadCache;
