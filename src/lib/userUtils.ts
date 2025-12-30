// ============================================================================
// User Utilities - User-related helper functions
// ============================================================================
// Uses database to check user uniqueness and find users
// ============================================================================

import type { User } from '@/types';
import { getDatabaseClient } from '@/db';

/**
 * Check if a handle is unique (not already taken)
 * 
 * @param handle - The handle to check (should include @ prefix)
 * @param excludeUserId - Optional user ID to exclude from check (for updates)
 * @returns Promise<boolean> - True if handle is unique, false if already taken
 */
export async function isHandleUnique(handle: string, excludeUserId?: string | number): Promise<boolean> {
  if (!handle || !handle.trim()) {
    return false;
  }

  try {
    const db = getDatabaseClient();
    
    // Normalize handle (lowercase, trim)
    const normalizedHandle = handle.trim().toLowerCase();
    
    // getByHandle now handles @ prefix internally, so we can pass it with or without @
    const handleToSearch = normalizedHandle.startsWith('@') 
      ? normalizedHandle 
      : `@${normalizedHandle}`;

    // Find user by handle (getByHandle handles @ prefix removal and case-insensitive matching)
    const existingUser = await db.users.getByHandle(handleToSearch);
    
    if (!existingUser) {
      return true; // Handle is available
    }

    // If excludeUserId provided, check if it's the same user
    if (excludeUserId) {
      const excludeId = typeof excludeUserId === 'string' ? parseInt(excludeUserId) : excludeUserId;
      const existingId = typeof existingUser.id === 'string' ? parseInt(existingUser.id) : existingUser.id;
      return excludeId === existingId; // Unique if it's the same user
    }

    return false; // Handle is taken
  } catch (error) {
    console.error('Error checking handle uniqueness:', error);
    // On error, assume handle is available to not block user registration
    return true;
  }
}

/**
 * Validate handle format
 * Handles should:
 * - Start with @
 * - Be 3-30 characters long (including @)
 * - Contain only alphanumeric characters and underscores
 * - Not contain spaces
 * 
 * @param handle - The handle to validate
 * @returns Object with isValid flag and error message if invalid
 */
export const validateHandleFormat = (handle: string): { isValid: boolean; error?: string } => {
  if (!handle || !handle.trim()) {
    return { isValid: false, error: 'Handle is required' };
  }

  const trimmed = handle.trim();
  const normalized = trimmed.startsWith('@') ? trimmed : `@${trimmed}`;

  // Check length (including @)
  if (normalized.length < 3) {
    return { isValid: false, error: 'Handle must be at least 2 characters long' };
  }
  if (normalized.length > 30) {
    return { isValid: false, error: 'Handle must be 30 characters or less' };
  }

  // Check format: @ followed by alphanumeric and underscores only
  const handleRegex = /^@[a-zA-Z0-9_]+$/;
  if (!handleRegex.test(normalized)) {
    return { 
      isValid: false, 
      error: 'Handle can only contain letters, numbers, and underscores' 
    };
  }

  return { isValid: true };
};

/**
 * Determine if an identifier is an email or a handle
 * 
 * @param identifier - The identifier to check
 * @returns 'email' | 'handle'
 */
function identifyType(identifier: string): 'email' | 'handle' {
  const trimmed = identifier.trim().toLowerCase();
  
  // If it starts with @, it's definitely a handle
  if (trimmed.startsWith('@')) {
    return 'handle';
  }
  
  // If it contains @ but not at the start, and has a domain (contains a dot after @), it's an email
  // Email pattern: something@domain.tld
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (emailPattern.test(trimmed)) {
    return 'email';
  }
  
  // Otherwise, assume it's a handle (without @ prefix)
  return 'handle';
}

/**
 * Find user by email or handle
 * 
 * @param identifier - Email address or handle (with or without @)
 * @returns Promise<User | null> - User if found, null otherwise
 */
export async function findUserByIdentifier(identifier: string): Promise<User | null> {
  if (!identifier || !identifier.trim()) {
    return null;
  }

  try {
    const db = getDatabaseClient();
    const normalized = identifier.trim().toLowerCase();
    const type = identifyType(normalized);
    
    // Try primary method based on type detection
    if (type === 'email') {
      // Query by email first
      const userByEmail = await db.users.getByEmail(normalized);
      if (userByEmail) {
        return userByEmail;
      }
      
      // Fallback: try as handle if email search failed
      // getByHandle now handles @ prefix internally, so pass as-is
      const userByHandle = await db.users.getByHandle(normalized);
      if (userByHandle) {
        return userByHandle;
      }
    } else {
      // Query by handle first
      // getByHandle now handles @ prefix internally, so pass as-is
      const userByHandle = await db.users.getByHandle(normalized);
      if (userByHandle) {
        return userByHandle;
      }
      
      // Fallback: try as email if handle search failed (only if it looks like an email)
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailPattern.test(normalized)) {
        const userByEmail = await db.users.getByEmail(normalized);
        if (userByEmail) {
          return userByEmail;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error finding user by identifier:', error);
    return null;
  }
}

