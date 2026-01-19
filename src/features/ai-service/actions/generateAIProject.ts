// ============================================================================
// Generate AI Project Action - Calls n8n for Project Generation
// ============================================================================

import type { GenerateProjectResult, AIGeneratedProject, N8nGeminiResponse } from '../types';
import { aiLogger } from '../utils';
import { getSessionToken } from '@/lib/auth/sessionStorage';

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
    // Call the Netlify Serverless Function
    const functionUrl = '/.netlify/functions/ai-generate-project';

    aiLogger.info('Starting AI project generation', { descriptionLength: description.length });

    // Get session token for authorization
    const sessionToken = getSessionToken();
    if (!sessionToken) {
        aiLogger.error('No session token found');
        return { success: false, error: 'Please log in to use AI features' };
    }

    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`,
                'x-user-timezone': Intl.DateTimeFormat().resolvedOptions().timeZone,
            },
            body: JSON.stringify({ description: description.trim() }),
            cache: 'no-store',
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            aiLogger.error('n8n Webhook Error', undefined, { status: response.status, errorText });
            throw new Error(`External service error: ${response.status}`);
        }

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
                taskCount: project.tasks.length
            });
            return { success: true, project };
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
