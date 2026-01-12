// ============================================================================
// useAIProjectGeneration Hook - State Management for AI Project Generation
// ============================================================================

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { AIProjectState, AIGeneratedProject } from '../types';
import { generateAIProject } from '../actions';
import {
    aiLogger,
    checkUsageLimit,
    incrementUsage,
    AI_ERROR_MESSAGES,
    getAIErrorMessage,
} from '../utils';
import { useAuth } from '@/features/auth/useAuth';

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
            toast.error('Please enter a project description');
            return null;
        }

        if (description.trim().length < 10) {
            toast.error('Please provide a more detailed description', {
                description: 'Describe your project idea in at least a few words.',
            });
            return null;
        }

        // Check usage limit before proceeding
        try {
            const limitCheck = await checkUsageLimit(user.id, 'project_generation');
            setRemainingToday(limitCheck.remaining);

            if (!limitCheck.allowed) {
                toast.error(AI_ERROR_MESSAGES.LIMIT_EXCEEDED_PROJECT.title, {
                    description: AI_ERROR_MESSAGES.LIMIT_EXCEEDED_PROJECT.description,
                });
                return null;
            }

            // Warn if running low
            if (limitCheck.remaining <= 1) {
                toast.warning(AI_ERROR_MESSAGES.LIMIT_WARNING_PROJECT(limitCheck.remaining).title, {
                    description: AI_ERROR_MESSAGES.LIMIT_WARNING_PROJECT(limitCheck.remaining).description,
                });
            }
        } catch (error) {
            aiLogger.warn('Failed to check usage limit, proceeding anyway', error);
            // Continue anyway - don't block users if limit check fails
        }

        setAiState('loading');
        setGeneratedProject(null);
        aiLogger.info('Starting project generation', { descriptionLength: description.length });

        try {
            const result = await generateAIProject(description);

            if (result.success && result.project) {
                setAiState('success');
                setGeneratedProject(result.project);

                toast.success('Project generated!', {
                    description: `Created "${result.project.name}" with ${result.project.tasks.length} tasks`,
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
            await incrementUsage(user.id, 'project_generation');
            aiLogger.info('Project generation usage incremented');

            // Update remaining count
            if (remainingToday !== null && remainingToday > 0) {
                setRemainingToday(remainingToday - 1);
            }
        } catch (error) {
            aiLogger.warn('Failed to increment usage count', error);
            // Don't block the user - just log the error
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
