// ============================================================================
// useAIProjectGeneration Hook - State Management for AI Project Generation
// ============================================================================

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { AIProjectState, AIGeneratedProject } from '../types';
import { generateAIProject } from '../actions';
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
    /** Confirm project creation (increments usage) */
    confirmProjectCreation: () => Promise<void>;
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

        setRemainingToday(3);

        setAiState('loading');
        setGeneratedProject(null);
        aiLogger.info('Starting project generation', { descriptionLength: description.length });

        try {
            const result = await generateAIProject(description);

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
     */
    const confirmProjectCreation = useCallback(async (): Promise<void> => {
        if (!user?.id || !generatedProject) return;

        try {
            const sessionToken = getSessionToken();
            if (!sessionToken) {
                toast.error('Your session expired.', {
                    description: 'Please sign in again to continue.'
                });
                return;
            }

            const response = await fetch('/.netlify/functions/ai-confirm-usage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'authorization': `Bearer ${sessionToken}`,
                    'x-user-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
                },
                body: JSON.stringify({
                    usageType: 'project_generation',
                    userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to record usage');
            }

            aiLogger.info('Project generation usage incremented');

            // Update remaining count
            if (remainingToday !== null && remainingToday > 0) {
                setRemainingToday(remainingToday - 1);
            }
        } catch (error) {
            aiLogger.warn('Failed to increment usage count', error);
            toast.error('Failed to record usage', {
                description: 'Please try again',
            });
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
