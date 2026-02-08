// Note: This makes a call to the Netlify Serverless Function which proxies to n8n.
// The function handles the secret key injection securely on the server side.

import { getSessionToken } from '@/lib/auth/sessionStorage';

interface GenerateDescriptionResult {
    success: boolean;
    description?: string;
    error?: string;
}

export async function generateAIDescription(
    type: 'task' | 'project',
    title: string
): Promise<GenerateDescriptionResult> {
    // Call the Netlify Serverless Function
    // In Prod: Direct call to function
    // In Dev: Vite Proxies this path to n8n (simulating the function)
    const functionUrl = '/.netlify/functions/ai-generated-description';

    try {
        // Get session token for authentication
        const sessionToken = getSessionToken();
        if (!sessionToken) {
            console.error('[AI Description] No session token found');
            return { success: false, error: 'Please sign in to use AI features' };
        }

        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        console.log('[AI Description] Calling API:', { type, titleLength: title.length, timezone: userTimezone });

        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authorization': `Bearer ${sessionToken}`,
                'x-user-timezone': userTimezone,
            },
            body: JSON.stringify({
                title: title.trim(),
                type: type,
            }),
            cache: 'no-store'
        });

        console.log('[AI Description] Response status:', response.status);

        if (!response.ok) {
            // Try to read error body if available
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('[AI Description] API Error:', response.status, errorText);

            // Check for rate limit
            if (response.status === 429) {
                return { success: false, error: 'Daily limit reached. Try again tomorrow!' };
            }

            // Check for auth errors
            if (response.status === 401) {
                return { success: false, error: 'Session expired. Please sign in again.' };
            }

            throw new Error(`Service error: ${response.status}`);
        }

        const responseText = await response.text();
        let aiDesc = '';

        try {
            const data = JSON.parse(responseText);

            // Handle the array response format from n8n Gemini node
            if (Array.isArray(data) && data.length > 0) {
                const firstItem = data[0];
                if (firstItem?.content?.parts?.[0]?.text) {
                    aiDesc = firstItem.content.parts[0].text;
                }
            } else if (data.description) {
                // Standard JSON format
                aiDesc = data.description;
            } else if (data.text) {
                aiDesc = data.text;
            } else if (typeof data === 'string') {
                aiDesc = data;
            }
        } catch (e) {
            // Fallback to plain text if JSON parsing fails
            if (responseText && !responseText.toLowerCase().includes('error')) {
                aiDesc = responseText;
            }
        }

        if (aiDesc) {
            console.log('[AI Description] Success, description length:', aiDesc.length);
            return { success: true, description: aiDesc };
        } else {
            console.warn('[AI Description] No description in response');
            return { success: false, error: 'No description generated' };
        }

    } catch (error) {
        console.error('[AI Description] Action failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate description'
        };
    }
}

