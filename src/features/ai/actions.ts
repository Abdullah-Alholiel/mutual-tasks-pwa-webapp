// Note: This runs on the client because this project uses Vite, not Next.js.
// "Server Actions" are not available in Vite.
// To truly hide secrets, you would need a backend proxy (e.g. Supabase Edge Function).
// For now, we use Vite environment variables.

interface GenerateDescriptionResult {
    success: boolean;
    description?: string;
    error?: string;
}

export async function generateAIDescription(
    type: 'task' | 'project',
    title: string
): Promise<GenerateDescriptionResult> {
    // We call the local Vite proxy path.
    // The proxy (in vite.config.ts) handles the forwarding to n8n AND injects the secret header.
    const proxyUrl = '/api/ai-generation';

    // Construct query parameters
    const params = new URLSearchParams({
        type: type,
        project_title: title.trim()
    });

    try {
        const response = await fetch(`${proxyUrl}?${params.toString()}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                // No secret here! It's added by the server proxy.
            },
            // Ensure we don't cache this request as it's dynamic
            cache: 'no-store'
        });

        if (!response.ok) {
            // Try to read error body if available
            const errorText = await response.text().catch(() => 'Unknown error');
            console.error('n8n Webhook Error:', response.status, errorText);
            throw new Error(`External service error: ${response.status}`);
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
            return { success: true, description: aiDesc };
        } else {
            return { success: false, error: 'No description generated' };
        }

    } catch (error) {
        console.error('AI Generation Action failed:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to generate description'
        };
    }
}
