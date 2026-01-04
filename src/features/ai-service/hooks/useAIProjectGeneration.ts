// ============================================================================
// useAIProjectGeneration Hook - State Management for AI Project Generation
// ============================================================================

import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import type { AIProjectState, AIGeneratedProject } from '../types';
import { generateAIProject } from '../actions';
import { aiLogger } from '../utils';

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
}

/**
 * Hook for managing AI project generation state.
 * 
 * Handles loading states, error handling, toast notifications, 
 * and stores the generated project for preview before creation.
 * 
 * @example
 * ```tsx
 * const { aiState, generatedProject, generateProject, resetState } = useAIProjectGeneration();
 * 
 * const handleGenerate = async () => {
 *   const project = await generateProject(description);
 *   if (project) {
 *     // Show preview, user can then create the project
 *   }
 * };
 * ```
 */
export const useAIProjectGeneration = (): UseAIProjectGenerationResult => {
    const [aiState, setAiState] = useState<AIProjectState>('idle');
    const [generatedProject, setGeneratedProject] = useState<AIGeneratedProject | null>(null);

    /**
     * Generate a project with tasks from a natural language description
     */
    const generateProject = useCallback(async (description: string): Promise<AIGeneratedProject | null> => {
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

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error('Failed to generate project', {
                description: errorMessage === 'External service error: 403'
                    ? 'Authentication failed. Please check your API keys.'
                    : errorMessage === 'External service error: 500'
                        ? 'AI service is temporarily unavailable. Please try again.'
                        : 'Please check your connection or try again later.',
            });

            // Auto-reset error state after 3 seconds
            setTimeout(() => {
                setAiState('idle');
            }, 3000);

            return null;
        }
    }, []);

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
    };
};
