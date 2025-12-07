// ============================================================================
// Database Client - Backward Compatibility Export
// ============================================================================
// 
// This file maintains backward compatibility with existing imports.
// All new code should import from '@/db' or '@/db/index' instead.
// ============================================================================

// Re-export everything from the new modular structure
export * from './index';

// Note: The 'db' export has been removed to prevent early initialization
// Use getDatabaseClient() instead: import { getDatabaseClient } from '@/db';

// Re-export the main client for backward compatibility
export type { DatabaseClient } from './index';
export { getDatabaseClient } from './index';
