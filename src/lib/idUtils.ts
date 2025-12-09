// ============================================================================
// ID Utilities - Shared ID Normalization Helpers
// ============================================================================
// 
// Centralized utilities for handling ID type conversions (string <-> number)
// Used across all utilities to ensure consistent ID handling
// ============================================================================

/**
 * Normalize ID to number for comparisons
 * Handles both string and number IDs consistently
 * 
 * @param id - ID as string or number
 * @returns ID as number
 */
export function normalizeId(id: string | number): number {
  return typeof id === 'string' ? parseInt(id) : id;
}

/**
 * Compare two IDs (handles both string and number)
 * 
 * @param id1 - First ID
 * @param id2 - Second ID
 * @returns True if IDs are equal
 */
export function compareIds(id1: string | number, id2: string | number): boolean {
  return normalizeId(id1) === normalizeId(id2);
}

