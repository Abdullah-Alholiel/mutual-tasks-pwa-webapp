// ============================================================================
// Request Deduplicator Tests
// ============================================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deduplicator, withDeduplication } from '../../src/lib/utils/requestDeduplicator';

describe('RequestDeduplicator', () => {
    beforeEach(() => {
        deduplicator.clear();
    });

    it('should execute request normally', async () => {
        const mockFn = vi.fn().mockResolvedValue('result');

        const result = await deduplicator.deduplicate('test-key', mockFn);

        expect(result).toBe('result');
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should deduplicate concurrent requests with same key', async () => {
        let resolvePromise: (value: string) => void;
        const slowPromise = new Promise<string>(resolve => {
            resolvePromise = resolve;
        });
        const mockFn = vi.fn().mockReturnValue(slowPromise);

        // Start two requests with same key
        const promise1 = deduplicator.deduplicate('same-key', mockFn);
        const promise2 = deduplicator.deduplicate('same-key', mockFn);

        // Function should only be called once
        expect(mockFn).toHaveBeenCalledTimes(1);

        // Resolve and both should get same result
        resolvePromise!('shared-result');

        const [result1, result2] = await Promise.all([promise1, promise2]);
        expect(result1).toBe('shared-result');
        expect(result2).toBe('shared-result');
    });

    it('should allow different keys to run in parallel', async () => {
        const mockFn1 = vi.fn().mockResolvedValue('result1');
        const mockFn2 = vi.fn().mockResolvedValue('result2');

        const [result1, result2] = await Promise.all([
            deduplicator.deduplicate('key1', mockFn1),
            deduplicator.deduplicate('key2', mockFn2),
        ]);

        expect(result1).toBe('result1');
        expect(result2).toBe('result2');
        expect(mockFn1).toHaveBeenCalledTimes(1);
        expect(mockFn2).toHaveBeenCalledTimes(1);
    });

    it('should track pending status correctly', async () => {
        let resolvePromise: () => void;
        const slowPromise = new Promise<void>(resolve => {
            resolvePromise = resolve;
        });

        deduplicator.deduplicate('pending-key', () => slowPromise);

        expect(deduplicator.isPending('pending-key')).toBe(true);
        expect(deduplicator.isPending('other-key')).toBe(false);

        resolvePromise!();

        // Wait for cleanup
        await new Promise(r => setTimeout(r, 10));
        expect(deduplicator.isPending('pending-key')).toBe(false);
    });
});

describe('withDeduplication', () => {
    beforeEach(() => {
        deduplicator.clear();
    });

    it('should wrap function with deduplication', async () => {
        const original = vi.fn().mockResolvedValue('wrapped');
        const wrapped = withDeduplication(
            (id: number) => `complete-${id}`,
            original
        );

        const result = await wrapped(123);

        expect(result).toBe('wrapped');
        expect(original).toHaveBeenCalledWith(123);
    });
});
