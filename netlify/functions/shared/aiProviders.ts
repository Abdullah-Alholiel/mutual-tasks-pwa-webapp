// AI providers for the two AI functions (L4c, D-20261115-13): Cloudflare Workers AI
// primary (Pages `AI` binding), OpenRouter free-model fallback, legacy n8n kept for
// Netlify production and explicit `AI_PROVIDER_MODE=n8n`.
//
// Contract (docs/plans/2026-11-20-run19-l4c-ai-port/01-program-design.md):
// - Responses use the client's ALREADY-ACCEPTED shapes: canonical project JSON and
//   {description: "..."} / plain text — no client parser change.
// - Error contracts: provider internals NEVER leak (F19). The only special body is
//   { error: "AI_EXHAUSTED" } (Workers AI free allowance spent) — the client maps it
//   to a localized "AI help is back tomorrow" message (EN + AR).
// - Prompts ported VERBATIM from plans/ai-port/n8n-workflows.json, plus README step 3:
//   "Write in the same language as the user's text." (fixes English-for-Arabic).
// - Prompts and validation are DATA (the module exports them for tests); the runtime
//   functions stay thin so vitest can drive the full chain with mock providers.

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AiTokenUsage {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
}

export interface ValidatedProject {
    name: string;
    description: string;
    icon: string;
    color: string;
    isPublic: boolean;
    tasks: Array<{
        title: string;
        description: string;
        daysFromNow: number;
        type: 'one_off' | 'habit';
        recurrencePattern?: 'Daily' | 'weekly' | 'custom';
        recurrenceInterval?: number;
    }>;
}

export type ProviderOutcome =
    | { ok: true; text: string; provider: 'workers-ai' | 'openrouter'; model: string; usage?: AiTokenUsage; attempts: string[] }
    | { ok: false; error: string; exhausted: boolean; attempts: string[] };

interface AiBinding {
    run(model: string, inputs: Record<string, unknown>): Promise<unknown>;
}

export interface ProviderDeps {
    aiBinding: unknown;
    fetchImpl?: typeof fetch;
    env?: Record<string, string | undefined>;
    /** Cut an individual provider attempt at this many ms (default 30s). */
    timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// Env switches (README step 7: plain env vars, safe defaults in code)
// ---------------------------------------------------------------------------

export const DEFAULT_OPENROUTER_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

function envFlag(env: Record<string, string | undefined> | undefined, name: string, def: boolean): boolean {
    const v = env?.[name];
    if (v === undefined || v === '') return def;
    return !['false', '0', 'no', 'off'].includes(v.toLowerCase());
}

function providerMode(env: ProviderDeps['env']): 'auto' | 'workers' | 'n8n' {
    const v = env?.AI_PROVIDER_MODE?.toLowerCase();
    return v === 'workers' || v === 'n8n' ? v : 'auto';
}

export function hasAiBinding(deps: ProviderDeps): boolean {
    return !!deps.aiBinding && typeof (deps.aiBinding as AiBinding).run === 'function';
}

/** True when the n8n webhook should be used (Netlify prod keeps working unchanged). */
export function useN8n(deps: ProviderDeps): boolean {
    const mode = providerMode(deps.env);
    if (mode === 'n8n') return true;
    if (mode === 'workers') return false;
    return !hasAiBinding(deps); // auto: binding present → Workers AI; absent → n8n
}

// ---------------------------------------------------------------------------
// Prompts (verbatim from n8n-workflows.json; the {{ }} placeholders resolved)
// ---------------------------------------------------------------------------

export const PROJECT_SYSTEM_PROMPT = [
    'You are an expert project planning assistant for a task management app called "Momentum".',
    'Your primary goal is to convert a user\'s idea into a structured JSON object.',
    'You MUST follow the user\'s schema constraints exactly.',
    'Do NOT output markdown code blocks (like ```json).',
    'Do NOT output conversational text (like "Here is your project").',
    'Output ONLY the raw JSON string.',
].join('\n');

export const PROJECT_USER_TEMPLATE = (description: string) => `Given a user's project description, create a structured project with tasks.

User's description:
"${description}"

Output MUST be valid JSON with this EXACT structure (no markdown, no code blocks, ONLY raw JSON):
{
  "name": "Project Name (max 50 chars, catchy and descriptive)",
  "description": "Brief project description (max 200 chars, explains the goal)",
  "icon": "MUST be one of: Target, Rocket, Zap, Star, Flag, Briefcase, Presentation, Building2, Laptop, Code, Dumbbell, Coffee, Book, Music, Home, Plane, Users, Heart, Smile, PartyPopper, PiggyBank, CreditCard, GraduationCap, Palette, Camera, Gamepad2, Gift",
  "color": "MUST be one of these exact HSL values: hsl(199, 89%, 48%), hsl(142, 76%, 36%), hsl(32, 95%, 58%), hsl(280, 70%, 50%), hsl(340, 75%, 55%), hsl(180, 70%, 45%)",
  "isPublic": true,
  "tasks": [
    {
      "title": "Task title (max 100 chars, action-oriented)",
      "description": "Brief task description (max 200 chars, what to do)",
      "daysFromNow": 0,
      "type": "one_off"
    }
  ]
}

TASK RULES:
- Generate 3-10 tasks based on project complexity
- daysFromNow: 0 = today, 1 = tomorrow, 7 = next week, etc.
- Space tasks logically over the project timeline
- type: "one_off" for single tasks, "habit" for recurring tasks
- For habit tasks, add: "recurrencePattern": "Daily" | "weekly" | "custom" and optionally "recurrenceInterval": number (for custom pattern, represents days between repetitions)
- Use action verbs in task titles (Complete, Review, Set up, etc.)
- Keep descriptions motivating and clear

ICON SELECTION:
- Goals/Achievements: Target, Rocket, Zap, Star, Flag
- Work/Professional: Briefcase, Presentation, Building2, Laptop, Code
- Lifestyle/Health: Dumbbell, Coffee, Book, Music, Home, Plane
- Social: Users, Heart, Smile, PartyPopper
- Finance: PiggyBank, CreditCard
- Education: GraduationCap
- Creative: Palette, Camera, Gamepad2, Gift

COLOR SELECTION:
- Blue (hsl(199, 89%, 48%)): Professional, calm, productivity
- Green (hsl(142, 76%, 36%): Health, growth, nature
- Orange (hsl(32, 95%, 58%)): Energy, creativity, warmth
- Purple (hsl(280, 70%, 50%)): Creativity, wisdom, luxury
- Pink (hsl(340, 75%, 55%)): Fun, social, compassion
- Teal (hsl(180, 70%, 45%)): Balance, sophistication, unique

IMPORTANT:
- Output ONLY the JSON object, no explanation, no markdown formatting
- Ensure all strings are properly escaped
- isPublic should generally be true unless the description mentions privacy
- Write in the same language as the user's text.`;

export const DESCRIPTION_PROMPT = (title: string, type: 'task' | 'project') =>
    `You are a helpful productivity assistant. The user has provided a title for a ${type === 'project' ? 'project' : 'task'}: "${title}".

If this is a 'project':
- Generate a comprehensive, high-level overview of what is needed to complete this project.
- Keep it under 40 words.
- Be professional and structured.

If this is a 'task':
- Generate a concise, actionable, and motivating description.
- Keep it under 20 words.

Output ONLY the description text. Do not include quotes or labels like "Description:".

Write in the same language as the user's text.`;

// ---------------------------------------------------------------------------
// Models (probed live 2026-11-16; results + neuron pricing in plans/ai-port/README.md)
// ---------------------------------------------------------------------------

const PROJECT_PRIMARY = { label: 'primary', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast', maxTokens: 1800 };
const PROJECT_BACKUP = { label: 'backup', model: '@cf/openai/gpt-oss-120b', maxTokens: 4000 };
const DESCRIPTION_PRIMARY = { label: 'primary', model: '@cf/mistralai/mistral-small-3.1-24b-instruct', maxTokens: 300 };

// ---------------------------------------------------------------------------
// Provider calls — each returns ProviderOutcome with `attempts` accumulated
// ---------------------------------------------------------------------------

/** Workers AI shapes differ: llama/mistral `{response}` vs gpt-oss OpenAI-style. */
export function extractWorkersAiText(raw: unknown): { text?: string; usage?: AiTokenUsage } {
    const r = raw as { response?: unknown; choices?: Array<{ message?: { content?: unknown } }>; usage?: Record<string, unknown> };
    let text: string | undefined;
    if (typeof r?.response === 'string') {
        text = r.response;
    } else if (Array.isArray(r?.choices) && r.choices.length > 0) {
        const c = r.choices[0]?.message?.content;
        if (typeof c === 'string') text = c;
    }
    let usage: AiTokenUsage | undefined;
    const u = r?.usage;
    if (u && typeof u === 'object') {
        const pick = (k: string) => (typeof u[k] === 'number' ? (u[k] as number) : undefined);
        usage = { prompt_tokens: pick('prompt_tokens'), completion_tokens: pick('completion_tokens'), total_tokens: pick('total_tokens') };
    }
    return { text, usage };
}

type Attempt = { ok: true; text: string; usage?: AiTokenUsage } | { ok: false; reason: 'invalid-content' | 'exhausted' | 'error' };

async function callWorkersAi(
    binding: AiBinding,
    model: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number,
    timeoutMs: number,
): Promise<Attempt> {
    try {
        const raw = (await Promise.race([
            binding.run(model, { messages, max_tokens: maxTokens }),
            new Promise((_r, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
        ])) as unknown;
        const { text, usage } = extractWorkersAiText(raw);
        if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'invalid-content' };
        return { ok: true, text, usage };
    } catch (e) {
        const msg = String((e as Error)?.message || e);
        if (isExhaustionText(msg)) return { ok: false, reason: 'exhausted' };
        return { ok: false, reason: 'error' };
    }
}

async function callOpenRouter(
    fetchImpl: typeof fetch,
    apiKey: string,
    model: string,
    messages: Array<{ role: string; content: string }>,
    maxTokens: number,
    timeoutMs: number,
): Promise<Attempt> {
    try {
        const resp = (await Promise.race([
            fetchImpl('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
                body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
            }),
            new Promise((_r, rej) => setTimeout(() => rej(new Error('timeout')), timeoutMs)),
        ])) as Response;
        if (!resp.ok) {
            const bodyText = await resp.text().catch(() => '');
            if (isExhaustionText(`${resp.status} ${bodyText}`)) return { ok: false, reason: 'exhausted' };
            return { ok: false, reason: 'error' };
        }
        const data = (await resp.json().catch(() => undefined)) as { choices?: Array<{ message?: { content?: string } }> } | undefined;
        const text = data?.choices?.[0]?.message?.content;
        if (typeof text !== 'string' || !text.trim()) return { ok: false, reason: 'invalid-content' };
        const u = (data as { usage?: Record<string, unknown> })?.usage;
        const usage: AiTokenUsage | undefined = u && typeof u === 'object'
            ? {
                prompt_tokens: typeof u.prompt_tokens === 'number' ? u.prompt_tokens : undefined,
                completion_tokens: typeof u.completion_tokens === 'number' ? u.completion_tokens : undefined,
                total_tokens: typeof u.total_tokens === 'number' ? u.total_tokens : undefined,
            }
            : undefined;
        return { ok: true, text, usage };
    } catch (e) {
        if (isExhaustionText(String((e as Error)?.message || e))) return { ok: false, reason: 'exhausted' };
        return { ok: false, reason: 'error' }
    }
}

/** Free-allowance / rate-limit / quota markers (README step 10). */
export function isExhaustionText(s: string): boolean {
    const l = s.toLowerCase();
    return (
        l.includes('free allowance') ||
        l.includes('free allocations') ||
        l.includes('neurons') && (l.includes('exceeded') || l.includes('insufficient') || l.includes('limit')) ||
        l.includes('429') ||
        l.includes('daily limit') ||
        l.includes('rate limit') ||
        l.includes('quota') ||
        l.includes('insufficient')
    );
}

// ---------------------------------------------------------------------------
// Chain runners
// ---------------------------------------------------------------------------

/** Resilient JSON extraction (client uses the same pattern server-side now). */
export function extractJsonCandidate(text: string): string | undefined {
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    return match ? match[0] : undefined;
}

export function validateProject(data: unknown): ValidatedProject | undefined {
    if (!data || typeof data !== 'object') return undefined;
    const obj = data as Record<string, unknown>;
    if (typeof obj.name !== 'string' || !obj.name.trim()) return undefined;
    if (!Array.isArray(obj.tasks)) return undefined;
    const project: ValidatedProject = {
        name: obj.name.trim().slice(0, 50),
        description: typeof obj.description === 'string' ? obj.description.trim().slice(0, 200) : '',
        icon: typeof obj.icon === 'string' ? obj.icon : 'Folder',
        color: typeof obj.color === 'string' ? obj.color : 'hsl(199, 89%, 48%)',
        isPublic: typeof obj.isPublic === 'boolean' ? obj.isPublic : true,
        tasks: [],
    };
    for (const task of obj.tasks) {
        if (!task || typeof task !== 'object') continue;
        const t = task as Record<string, unknown>;
        if (typeof t.title !== 'string' || t.title.trim() === '') continue;
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
    if (project.tasks.length === 0) return undefined;
    return project;
}

function openRouterModel(env: ProviderDeps['env']): string {
    const v = env?.AI_FALLBACK_MODEL?.trim();
    return v && v.length > 0 ? v : DEFAULT_OPENROUTER_MODEL;
}

function fallbackEnabled(env: ProviderDeps['env']): boolean {
    return envFlag(env, 'AI_FALLBACK_ENABLED', true);
}

/** Validate a project across attempts; returns the first valid one (used by the chain). */
function validateFromAttempts(texts: Array<{ ok: true; text: string }>): ValidatedProject | undefined {
    for (const { text } of texts) {
        const json = extractJsonCandidate(text);
        if (json) {
            try {
                const v = validateProject(JSON.parse(json));
                if (v) return v;
            } catch { /* next attempt */ }
        }
    }
    return undefined;
}

async function runChain(
    deps: ProviderDeps,
    messages: Array<{ role: string; content: string }>,
    cfAttempts: Array<{ label: string; model: string; maxTokens: number }>,
    fallbackMaxTokens: number,
    validate?: (texts: Array<{ ok: true; text: string }>) => ValidatedProject | undefined,
): Promise<ProviderOutcome> {
    const attempts: string[] = [];
    const env = deps.env ?? (typeof process !== 'undefined' ? process.env : undefined);
    const timeoutMs = deps.timeoutMs ?? 30_000;
    const texts: Array<{ ok: true; text: string }> = [];

    if (useN8n(deps)) {
        return { ok: false, error: 'N8N_MODE', exhausted: false, attempts: ['mode=n8n'] };
    }
    if (!hasAiBinding(deps) && providerMode(deps.env) !== 'workers') {
        return { ok: false, error: 'N8N_MODE', exhausted: false, attempts: ['mode=n8n-no-binding'] };
    }

    let exhausted = false;
    for (const a of cfAttempts) {
        if (!hasAiBinding(deps)) { attempts.push(`${a.label}:skipped-no-binding`); continue; }
        const r = await callWorkersAi(deps.aiBinding as AiBinding, a.model, messages, a.maxTokens, timeoutMs);
        if (r.ok) {
            attempts.push(`${a.label}:ok`);
            texts.push({ ok: true, text: r.text });
            if (validate) {
                const v = validate(texts);
                if (v) return { ok: true, text: JSON.stringify(v), provider: 'workers-ai', model: a.model, usage: r.usage, attempts };
            } else {
                return { ok: true, text: r.text, provider: 'workers-ai', model: a.model, usage: r.usage, attempts };
            }
        } else {
            attempts.push(`${a.label}:${r.reason}`);
            if (r.reason === 'exhausted') exhausted = true;
            if (r.reason === 'exhausted') break; // skip remaining CF attempts, go to fallback
        }
    }

    // OpenRouter fallback (README step 7) — only when enabled + key present.
    if (fallbackEnabled(env) && typeof env?.OPENROUTER_API_KEY === 'string' && env.OPENROUTER_API_KEY.length > 0) {
        const model = openRouterModel(env);
        const r = await callOpenRouter(deps.fetchImpl ?? fetch, env.OPENROUTER_API_KEY, model, messages, fallbackMaxTokens, timeoutMs);
        if (r.ok) {
            attempts.push(`openrouter:${model}:ok`);
            texts.push({ ok: true, text: r.text });
            if (validate) {
                const v = validate(texts);
                if (v) return { ok: true, text: JSON.stringify(v), provider: 'openrouter', model, usage: r.usage, attempts };
            } else {
                return { ok: true, text: r.text, provider: 'openrouter', model, usage: r.usage, attempts };
            }
        } else {
            attempts.push(`openrouter:${model}:${r.reason}`);
            if (r.reason === 'exhausted') exhausted = true;
        }
    } else {
        attempts.push('openrouter:skipped-disabled-or-no-key');
    }

    if (exhausted) {
        return { ok: false, error: 'AI_EXHAUSTED', exhausted: true, attempts };
    }
    return { ok: false, error: 'AI_NO_VALID_RESPONSE', exhausted: false, attempts };
}

export type ProjectOutcome =
    | { ok: true; project: ValidatedProject; provider: 'workers-ai' | 'openrouter'; model: string; usage?: AiTokenUsage; attempts: string[] }
    | { ok: false; error: string; exhausted: boolean; attempts: string[] };

export async function generateProjectWithAI(deps: ProviderDeps, description: string): Promise<ProjectOutcome> {
    const messages = [
        { role: 'system', content: PROJECT_SYSTEM_PROMPT },
        { role: 'user', content: PROJECT_USER_TEMPLATE(description) },
    ];
    const outcome = await runChain(deps, messages, [PROJECT_PRIMARY, PROJECT_BACKUP], 4000, validateFromAttempts);
    if (!outcome.ok) return outcome;
    // runChain's validate path already returned JSON.stringify(validProject) as text.
    try {
        const project = validateProject(JSON.parse(outcome.text));
        if (project) return { ok: true, project, provider: outcome.provider, model: outcome.model, usage: outcome.usage, attempts: outcome.attempts };
    } catch { /* falls through */ }
    return { ok: false, error: 'AI_NO_VALID_RESPONSE', exhausted: false, attempts: [...outcome.attempts, 'final-validation-failed'] };
}

export async function generateDescriptionWithAI(deps: ProviderDeps, title: string, type: 'task' | 'project'): Promise<ProviderOutcome> {
    const messages = [{ role: 'user', content: DESCRIPTION_PROMPT(title, type) }];
    return runChain(deps, messages, [DESCRIPTION_PRIMARY], 300);
}
