// ============================================================================
// useAIProjectGeneration Hook - State Management for AI Project Generation
// ============================================================================

import { useState, useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import type { AIProjectState, AIGeneratedProject } from '../types';
import { generateAIProject, RATE_LIMIT_ERROR, TIMEOUT_ERROR } from '../actions';
import {
    aiLogger,
    AI_ERROR_MESSAGES,
    getAIErrorMessage,
} from '../utils';
import { useAuth } from '@/features/auth/useAuth';
import { getSessionToken } from '@/lib/auth/sessionStorage';

/**
 * Hook result interface for AI project generation
 */
export interface UseAIProjectGenerationResult {
    /** Current state of AI generation */
    aiState: AIProjectState;
    /** The generated project data (null until successful generation) */
    generatedProject: AIGeneratedProject | null;
    /** Trigger project generation from description */
    generateProject: (description: string) => Promise<AIGeneratedProject | null>;
    /** Reset state to idle and clear generated project */
    resetState: () => void;
    /** Confirm project creation (increments usage) - returns true if successful */
    confirmProjectCreation: () => Promise<boolean>;
    /** Remaining generations for today */
    remainingToday: number | null;
}

/**
 * Hook for managing AI project generation state.
 * 
 * Handles loading states, error handling, toast notifications, 
 * and stores the generated project for preview before creation.
 * Usage is only counted when user confirms project creation.
 * 
 * @example
 * ```tsx
 * const { aiState, generatedProject, generateProject, confirmProjectCreation } = useAIProjectGeneration();
 * 
 * const handleGenerate = async () => {
 *   const project = await generateProject(description);
 *   if (project) {
 *     // Show preview, user can then create the project
 *   }
 * };
 * 
 * const handleCreate = async () => {
 *   await confirmProjectCreation();
 *   // Then actually create the project in DB
 * };
 * ```
 */
export const useAIProjectGeneration = (): UseAIProjectGenerationResult => {
    const [aiState, setAiState] = useState<AIProjectState>('idle');
    const [generatedProject, setGeneratedProject] = useState<AIGeneratedProject | null>(null);
    const [remainingToday, setRemainingToday] = useState<number | null>(null);
    const { user } = useAuth();

    /**
     * Generate a project with tasks from a natural language description
     */
    const generateProject = useCallback(async (description: string): Promise<AIGeneratedProject | null> => {
        // Check if user is logged in
        if (!user?.id) {
            toast.error(AI_ERROR_MESSAGES.NOT_LOGGED_IN.title, {
                description: AI_ERROR_MESSAGES.NOT_LOGGED_IN.description,
            });
            return null;
        }

        // Validate input
        if (!description.trim()) {
            toast.error('Tell us what you want to build first.');
            return null;
        }

        if (description.trim().length < 10) {
            toast.error('Tell us a bit more.', {
                description: 'We need at least a few words to design your project.',
            });
            return null;
        }

        setAiState('loading');
        setGeneratedProject(null);
        aiLogger.info('Starting project generation', { descriptionLength: description.length });

        try {
            const result = await generateAIProject(description);

            // Handle rate limit specifically
            if (result.error === RATE_LIMIT_ERROR) {
                setAiState('error');
                setRemainingToday(0);

                toast.error(AI_ERROR_MESSAGES.LIMIT_EXCEEDED_PROJECT.title, {
                    description: AI_ERROR_MESSAGES.LIMIT_EXCEEDED_PROJECT.description,
                });

                // Auto-reset error state after 3 seconds
                setTimeout(() => {
                    setAiState('idle');
                }, 3000);

                return null;
            }

            // Handle timeout errors - encourage user to retry
            if (result.error === TIMEOUT_ERROR) {
                setAiState('idle'); // Reset to idle so they can try again immediately

                toast.error(AI_ERROR_MESSAGES.TIMEOUT.title, {
                    description: AI_ERROR_MESSAGES.TIMEOUT.description,
                });

                return null;
            }

            // Update remaining count from API response
            if (result.rateLimitInfo) {
                setRemainingToday(result.rateLimitInfo.remaining);
            }

            if (result.success && result.project) {
                setAiState('success');
                setGeneratedProject(result.project);

                toast.success('Project generated! ✨', {
                    description: `We've designed "${result.project.name}" with ${result.project.tasks.length} tasks.`,
                });

                return result.project;
            } else {
                throw new Error(result.error || 'Failed to generate project');
            }

        } catch (error) {
            aiLogger.error('AI Project Generation failed', error);
            setAiState('error');

            // Get tailored error message
            const errorMsg = getAIErrorMessage(error, 'project');
            toast.error(errorMsg.title, {
                description: errorMsg.description,
            });

            // Auto-reset error state after 3 seconds
            setTimeout(() => {
                setAiState('idle');
            }, 3000);

            return null;
        }
    }, [user?.id]);

    /**
     * Confirm that the generated project will be used
     * This is when we actually increment the usage count
     * Returns true if usage was successfully logged, false otherwise
     */
    const confirmProjectCreation = useCallback(async (): Promise<boolean> => {
        // Skip usage tracking in local dev mode (no Netlify functions available)
        const isLocalDev = import.meta.env.DEV && import.meta.env.VITE_USE_LOCAL_N8N === 'true';
        if (isLocalDev) {
            aiLogger.info('Local dev mode - skipping usage confirmation');
            return true; // Allow project creation without tracking
        }

        if (!user?.id || !generatedProject) {
            aiLogger.warn('confirmProjectCreation called without user or project', {
                hasUser: !!user?.id,
                hasProject: !!generatedProject
            });
            return false;
        }

        try {
            const sessionToken = getSessionToken();
            if (!sessionToken) {
                aiLogger.error('Session token missing in confirmProjectCreation');
                toast.error('Your session expired.', {
                    description: 'Please sign in again to continue.'
                });
                return false;
            }

            const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            aiLogger.info('Confirming project creation usage', {
                userId: user.id,
                timezone: userTimezone,
                projectName: generatedProject.name
            });

            const response = await fetch('/.netlify/functions/ai-confirm-usage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'authorization': `Bearer ${sessionToken}`,
                    'x-user-timezone': userTimezone,
                },
                body: JSON.stringify({
                    usageType: 'project_generation',
                    userTimezone: userTimezone,
                }),
            });

            const responseText = await response.text();
            let responseData: any;
            try {
                responseData = JSON.parse(responseText);
            } catch {
                responseData = { raw: responseText };
            }

            aiLogger.info('ai-confirm-usage response', {
                status: response.status,
                ok: response.ok,
                data: responseData
            });

            if (!response.ok) {
                aiLogger.error('Failed to record usage - API returned error', {
                    status: response.status,
                    statusText: response.statusText,
                    error: responseData
                });
                toast.error('Failed to record usage', {
                    description: responseData?.error || 'Please try again',
                });
                return false;
            }

            aiLogger.info('Project generation usage confirmed successfully');

            // Update remaining count
            if (remainingToday !== null && remainingToday > 0) {
                setRemainingToday(remainingToday - 1);
            }

            return true;
        } catch (error) {
            aiLogger.error('confirmProjectCreation failed with exception', error);
            toast.error('Failed to record usage', {
                description: 'Network error - please try again',
            });
            return false;
        }
    }, [user?.id, generatedProject, remainingToday]);

    /**
     * Reset the hook state
     */
    const resetState = useCallback(() => {
        setAiState('idle');
        setGeneratedProject(null);
    }, []);

    return {
        aiState,
        generatedProject,
        generateProject,
        resetState,
        confirmProjectCreation,
        remainingToday,
    };
};
