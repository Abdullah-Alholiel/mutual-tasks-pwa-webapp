// ============================================================================
// useAIGeneration Hook - Description Generation with Usage Limits
// ============================================================================

import { useState, useCallback } from 'react';
import { toast } from '@/components/ui/sonner';
import { generateAIDescription } from '@/features/ai/actions';
import { useAuth } from '@/features/auth/useAuth';
import { getSessionToken } from '@/lib/auth/sessionStorage';
import {
    AI_ERROR_MESSAGES,
    getAIErrorMessage,
} from '@/features/ai-service/utils';

type AIGenType = 'task' | 'project';
type AIState = 'idle' | 'loading' | 'success' | 'error';

interface UseAIGenerationResult {
    aiState: AIState;
    generateDescription: (title: string) => Promise<string | null>;
    confirmDescription: () => Promise<void>;
    setAiState: (state: AIState) => void;
    remainingToday: number | null;
}

export const useAIGeneration = (type: AIGenType): UseAIGenerationResult => {
    const [aiState, setAiState] = useState<AIState>('idle');
    const [remainingToday, setRemainingToday] = useState<number | null>(null);
    const { user } = useAuth();

    const generateDescription = useCallback(async (title: string): Promise<string | null> => {
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

        setAiState('loading');

        try {
            const result = await generateAIDescription(type, title);

            if (result.success && result.description) {
                setAiState('success');

                // Show remaining count if available
                const remainingMsg = result.remaining !== undefined
                    ? `${result.remaining} remaining today`
                    : '';

                toast.success('Description generated!', {
                    description: remainingMsg,
                    duration: 3000,
                });

                return result.description;
            } else {
                // Handle timeout errors specifically - encourage retry
                if (result.error === 'timeout') {
                    setAiState('idle'); // Reset to idle so they can retry immediately
                    toast.error(AI_ERROR_MESSAGES.TIMEOUT.title, {
                        description: AI_ERROR_MESSAGES.TIMEOUT.description,
                    });
                    return null;
                }

                // Handle rate limit errors
                if (result.error && result.error.includes('Daily limit reached')) {
                    setAiState('error');
                    toast.error('Daily Limit Reached', {
                        description: 'You strictly have 10 description generations per day. Please try again tomorrow!',
                    });
                    return null;
                }

                throw new Error(result.error || 'Failed to generate description');
            }

        } catch (error) {
            console.error('AI Generation failed:', error);
            setAiState('error');

            const errorMsg = getAIErrorMessage(error, 'description');
            toast.error(errorMsg.title, {
                description: errorMsg.description,
            });

            setTimeout(() => {
                setAiState('idle');
            }, 3000);

            return null;
        }
    }, [user?.id, type]);

    const confirmDescription = useCallback(async (): Promise<void> => {
        if (!user?.id) return;

        try {
            const sessionToken = getSessionToken();
            if (!sessionToken) {
                toast.error('Session expired', {
                    description: 'Please login again',
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
                    usageType: 'description_generation',
                    userTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to record usage');
            }

            if (remainingToday !== null && remainingToday > 0) {
                setRemainingToday(remainingToday - 1);
            }
        } catch (error) {
            console.error('Failed to confirm description usage:', error);
            toast.error('Failed to record usage', {
                description: 'Please try again',
            });
        }
    }, [user?.id, remainingToday]);

    return { aiState, generateDescription, confirmDescription, setAiState, remainingToday };
};
