// ============================================================================
// Vitest Setup File
// ============================================================================

import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
    cleanup();
});

// Mock import.meta.env for tests
vi.stubGlobal('import', {
    meta: {
        env: {
            DEV: true,
            VITE_SUPABASE_URL: 'https://test.supabase.co',
            VITE_SUPABASE_ANON_KEY: 'test-key',
        },
    },
});
