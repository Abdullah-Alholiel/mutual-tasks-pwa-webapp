// ============================================================================
// Generate AI Project Action - Calls n8n for Project Generation
// ============================================================================

import type { GenerateProjectResult, AIGeneratedProject, N8nGeminiResponse } from '../types';
import { aiLogger } from '../utils';
import { getSessionToken } from '@/lib/auth/sessionStorage';

// Rate limit error type for specific handling
export const RATE_LIMIT_ERROR = 'RATE_LIMIT_EXCEEDED';
export const TIMEOUT_ERROR = 'TIMEOUT_ERROR';

/**
 * Generate a complete project with tasks from a natural language description.
 * 
 * This action calls the Netlify Serverless Function which proxies to n8n.
 * The function handles the secret key injection securely on the server side.
 * 
 * @param description - Free-form description of the project to create
 * @returns Promise with success status and generated project or error
 */
export async function generateAIProject(
    description: string
): Promise<GenerateProjectResult> {
    // Check if running in local development mode (direct N8N call)
    const isLocalDev = import.meta.env.DEV && import.meta.env.VITE_USE_LOCAL_N8N === 'true';

    // Local: Call N8N directly, Production: Call Netlify function
    const functionUrl = isLocalDev
        ? 'https://n8n-pwg804wg84008c00g8www4gc.145.241.109.213.sslip.io/webhook/ai-generated-project-momentumPWA'
        : '/.netlify/functions/ai-generate-project';

    aiLogger.info('Starting AI project generation', {
        descriptionLength: description.length,
        isLocalDev,
        endpoint: isLocalDev ? 'N8N Direct' : 'Netlify Function'
    });

    // Get session token for authorization (used in production)
    const sessionToken = getSessionToken();
    if (!sessionToken && !isLocalDev) {
        aiLogger.error('No session token found');
        return { success: false, error: 'Please log in to use AI features' };
    }

    try {
        // Build headers based on environment
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-user-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
        };

        // Add auth headers - different for local vs production
        if (isLocalDev) {
            // Local: Use N8N secret header (both formats for compatibility)
            const secret = import.meta.env.VITE_N8N_SECRET;
            headers['x-momentum-secret'] = secret;
            headers['x_momentum_secret'] = secret; // N8N might use underscore format

            aiLogger.info('Local N8N mode - headers set', {
                hasSecret: !!secret,
                secretPreview: secret.substring(0, 5) + '...'
            });
        } else {
            // Production: Use session token
            headers['Authorization'] = `Bearer ${sessionToken}`;
        }

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ description: description.trim() }),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            aiLogger.error('API Error', undefined, { status: response.status, errorText });

            // Handle rate limit specifically
            if (response.status === 429) {
                const limit = response.headers.get('X-RateLimit-Limit') || '3';
                return {
                    success: false,
                    error: RATE_LIMIT_ERROR,
                    rateLimitInfo: {
                        limit: parseInt(limit),
                        remaining: 0,
                    }
                };
            }

            // Handle timeout errors (Netlify default timeout, gateway timeout)
            if (response.status === 504 || response.status === 408) {
                return { success: false, error: TIMEOUT_ERROR };
            }

            // Handle auth errors
            if (response.status === 401) {
                return { success: false, error: 'Please log in again to use AI features' };
            }

            throw new Error(`Service error: ${response.status}`);
        }

        // Extract rate limit info from successful response
        const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '3');
        const limit = parseInt(response.headers.get('X-RateLimit-Limit') || '3');

        const responseText = await response.text();
        aiLogger.info('Received response from n8n', { responseLength: responseText.length });

        // Parse the response
        let project: AIGeneratedProject | undefined;

        try {
            const data = JSON.parse(responseText);

            // Handle the array response format from n8n Gemini node
            if (Array.isArray(data) && data.length > 0) {
                const firstItem = data[0] as N8nGeminiResponse;
                if (firstItem?.content?.parts?.[0]?.text) {
                    const jsonText = firstItem.content.parts[0].text;
                    project = parseProjectJson(jsonText);
                }
            } else if (data.name && data.tasks) {
                // Direct JSON format
                project = validateProject(data);
            } else if (typeof data === 'string') {
                // Plain text that might be JSON
                project = parseProjectJson(data);
            }
        } catch (parseError) {
            aiLogger.error('Failed to parse AI response', parseError);
            // Try to extract JSON from the response text
            project = parseProjectJson(responseText);
        }

        if (project) {
            aiLogger.success('Project generated successfully', {
                projectName: project.name,
                taskCount: project.tasks.length,
                remaining
            });
            return {
                success: true,
                project,
                rateLimitInfo: { limit, remaining }
            };
        } else {
            return { success: false, error: 'Failed to parse AI response into valid project' };
        }

    } catch (error) {
        aiLogger.error('AI Project Generation failed', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate project',
        };
    }
}

/**
 * Parse JSON text that might have markdown code blocks or extra content
 */
function parseProjectJson(text: string): AIGeneratedProject | undefined {
    // Remove markdown code blocks if present
    let cleanedText = text
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim();

    // Try to find JSON object in the text
    const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        cleanedText = jsonMatch[0];
    }

    try {
        const parsed = JSON.parse(cleanedText);
        return validateProject(parsed);
    } catch {
        return undefined;
    }
}

/**
 * Validate and sanitize parsed project data
 */
function validateProject(data: unknown): AIGeneratedProject | undefined {
    if (!data || typeof data !== 'object') return undefined;

    const obj = data as Record<string, unknown>;

    // Required fields
    if (typeof obj.name !== 'string' || !obj.name.trim()) return undefined;
    if (!Array.isArray(obj.tasks)) return undefined;

    // Default values for optional fields
    const project: AIGeneratedProject = {
        name: obj.name.trim().slice(0, 50),
        description: typeof obj.description === 'string' ? obj.description.trim().slice(0, 200) : '',
        icon: typeof obj.icon === 'string' ? obj.icon : 'Folder',
        color: typeof obj.color === 'string' ? obj.color : 'hsl(199, 89%, 48%)',
        isPublic: typeof obj.isPublic === 'boolean' ? obj.isPublic : true,
        tasks: [],
    };

    // Validate each task
    for (const task of obj.tasks) {
        if (!task || typeof task !== 'object') continue;
        const t = task as Record<string, unknown>;

        if (typeof t.title !== 'string' || !t.title.trim()) continue;

        project.tasks.push({
            title: t.title.trim().slice(0, 100),
            description: typeof t.description === 'string' ? t.description.trim().slice(0, 200) : '',
            daysFromNow: typeof t.daysFromNow === 'number' ? Math.max(0, Math.floor(t.daysFromNow)) : 0,
            type: t.type === 'habit' ? 'habit' : 'one_off',
            recurrencePattern: t.recurrencePattern === 'Daily' || t.recurrencePattern === 'weekly' || t.recurrencePattern === 'custom'
                ? t.recurrencePattern
                : undefined,
            recurrenceInterval: typeof t.recurrenceInterval === 'number' ? t.recurrenceInterval : undefined,
        });
    }

    // Must have at least one task
    if (project.tasks.length === 0) return undefined;

    return project;
}
