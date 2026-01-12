// ============================================================================
// useAIGeneration Hook - Description Generation with Usage Limits
// ============================================================================

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { generateAIDescription } from '@/features/ai/actions';
import { useAuth } from '@/features/auth/useAuth';
import {
    checkUsageLimit,
    incrementUsage,
    AI_ERROR_MESSAGES,
    getAIErrorMessage,
} from '@/features/ai-service/utils';

type AIGenType = 'task' | 'project';
type AIState = 'idle' | 'loading' | 'success' | 'error';

interface UseAIGenerationResult {
    aiState: AIState;
    generateDescription: (title: string) => Promise<string | null>;
    setAiState: (state: AIState) => void;
    remainingToday: number | null;
}

/**
 * Hook for AI description generation with usage limits.
 * Usage is only counted when description is successfully generated AND returned to caller.
 * The caller should call this, receive the description, and insert it into the input field.
 * 
 * @param type - 'task' or 'project' (for display purposes only)
 */
export const useAIGeneration = (type: AIGenType): UseAIGenerationResult => {
    const [aiState, setAiState] = useState<AIState>('idle');
    const [remainingToday, setRemainingToday] = useState<number | null>(null);
    const { user } = useAuth();

    const generateDescription = useCallback(async (title: string): Promise<string | null> => {
        // Check if user is logged in
        if (!user?.id) {
            toast.error(AI_ERROR_MESSAGES.NOT_LOGGED_IN.title, {
                description: AI_ERROR_MESSAGES.NOT_LOGGED_IN.description,
            });
            return null;
        }

        if (!title.trim()) {
            toast.error(`Please enter a ${type} title first`);
            return null;
        }

        // Check usage limit before proceeding
        try {
            const limitCheck = await checkUsageLimit(user.id, 'description_generation');
            setRemainingToday(limitCheck.remaining);

            if (!limitCheck.allowed) {
                toast.error(AI_ERROR_MESSAGES.LIMIT_EXCEEDED_DESCRIPTION.title, {
                    description: AI_ERROR_MESSAGES.LIMIT_EXCEEDED_DESCRIPTION.description,
                });
                return null;
            }

            // Warn if running low
            if (limitCheck.remaining <= 2) {
                toast.warning(AI_ERROR_MESSAGES.LIMIT_WARNING_DESCRIPTION(limitCheck.remaining).title, {
                    description: AI_ERROR_MESSAGES.LIMIT_WARNING_DESCRIPTION(limitCheck.remaining).description,
                });
            }
        } catch (error) {
            console.warn('Failed to check usage limit, proceeding anyway:', error);
            // Continue anyway - don't block users if limit check fails
        }

        setAiState('loading');

        try {
            // Call Server Action
            const result = await generateAIDescription(type, title);

            if (result.success && result.description) {
                setAiState('success');

                // Increment usage count ONLY on successful generation
                // The description will be inserted into the input by the caller
                try {
                    await incrementUsage(user.id, 'description_generation');
                    if (remainingToday !== null && remainingToday > 0) {
                        setRemainingToday(remainingToday - 1);
                    }
                } catch (usageError) {
                    console.warn('Failed to increment usage count:', usageError);
                    // Don't block the user - just log the error
                }

                toast.success('Description generated successfully!');
                return result.description;
            } else {
                throw new Error(result.error || 'Failed to generate description');
            }

        } catch (error) {
            console.error('AI Generation failed:', error);
            setAiState('error');

            // Get tailored error message
            const errorMsg = getAIErrorMessage(error, 'description');
            toast.error(errorMsg.title, {
                description: errorMsg.description,
            });

            // Auto-reset on error
            setTimeout(() => {
                setAiState('idle');
            }, 3000);

            return null;
        }
    }, [user?.id, type, remainingToday]);

    return { aiState, generateDescription, setAiState, remainingToday };
};
