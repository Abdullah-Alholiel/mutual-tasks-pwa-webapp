import { useState } from 'react';
import { toast } from 'sonner';
import { generateAIDescription } from '@/features/ai/actions';

type AIGenType = 'task' | 'project';
type AIState = 'idle' | 'loading' | 'success' | 'error';

interface UseAIGenerationResult {
    aiState: AIState;
    generateDescription: (title: string) => Promise<string | null>;
    setAiState: (state: AIState) => void;
}

export const useAIGeneration = (type: AIGenType): UseAIGenerationResult => {
    const [aiState, setAiState] = useState<AIState>('idle');

    const generateDescription = async (title: string): Promise<string | null> => {
        if (!title.trim()) {
            toast.error(`Please enter a ${type} title first`);
            return null;
        }

        setAiState('loading');

        try {
            // Call Server Action
            const result = await generateAIDescription(type, title);

            if (result.success && result.description) {
                setAiState('success');
                toast.success('Description generated successfully!');
                return result.description;
            } else {
                throw new Error(result.error || 'Failed to generate description');
            }

        } catch (error) {
            console.error('AI Generation failed:', error);
            setAiState('error');

            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            toast.error('Failed to generate description', {
                description: errorMessage === 'External service error: 403'
                    ? 'Authentication failed. Please check your API keys.'
                    : 'Please check your connection or try again later.'
            });

            // Auto-reset on error
            setTimeout(() => {
                setAiState('idle');
            }, 3000);

            return null;
        }
    };

    return { aiState, generateDescription, setAiState };
};
