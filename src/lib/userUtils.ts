// ============================================================================
// User Utilities - User-related helper functions
// ============================================================================

import type { User } from '@/types';
import { mockUsers } from '@/lib/mockData';

/**
 * Check if a handle is unique (not already taken)
 * 
 * @param handle - The handle to check (should include @ prefix)
 * @param excludeUserId - Optional user ID to exclude from check (for updates)
 * @returns True if handle is unique, false if already taken
 */
export const isHandleUnique = (handle: string, excludeUserId?: string): boolean => {
  if (!handle || !handle.trim()) {
    return false;
  }

  // Normalize handle (lowercase, trim)
  const normalizedHandle = handle.trim().toLowerCase();
  
  // Ensure handle starts with @
  const handleWithAt = normalizedHandle.startsWith('@') 
    ? normalizedHandle 
    : `@${normalizedHandle}`;

  // Check against all users (excluding the current user if updating)
  const existingUser = mockUsers.find(u => {
    if (excludeUserId && u.id === excludeUserId) {
      return false; // Exclude this user from check
    }
    return u.handle.toLowerCase() === handleWithAt;
  });

  return !existingUser;
};

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
 * Find user by email or handle
 * 
 * @param identifier - Email address or handle (with or without @)
 * @returns User if found, undefined otherwise
 */
export const findUserByIdentifier = (identifier: string): User | undefined => {
  if (!identifier || !identifier.trim()) {
    return undefined;
  }

  const normalized = identifier.trim().toLowerCase();
  
  // Try to find by email first
  const userByEmail = mockUsers.find(u => 
    u.email.toLowerCase() === normalized
  );
  
  if (userByEmail) {
    return userByEmail;
  }

  // Try to find by handle
  const handleWithAt = normalized.startsWith('@') 
    ? normalized 
    : `@${normalized}`;
  
  const userByHandle = mockUsers.find(u => 
    u.handle.toLowerCase() === handleWithAt
  );

  return userByHandle;
};

