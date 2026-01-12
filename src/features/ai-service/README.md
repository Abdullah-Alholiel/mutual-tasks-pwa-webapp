# AI Service Feature Module

Generate complete projects with tasks from natural language descriptions using AI.

## Quick Start

1. **Import into n8n**: Import `n8n-ai-project-generator.json` into your n8n instance
2. **Set environment variable**: Add `N8N_PROJECT_WEBHOOK_URL` to your Netlify environment with the webhook URL
3. **Use in app**: Click the AI Generate button on the Projects page

## Architecture

```
ai-service/
├── types/       # TypeScript interfaces
├── actions/     # API actions (generateAIProject)
├── hooks/       # React hooks (useAIProjectGeneration)
├── components/  # UI (AIProjectModal, AIProjectButton)
├── utils/       # Logging utilities
└── index.ts     # Module exports
```

## Usage

```tsx
import { AIProjectButton, AIProjectModal, type AIGeneratedProject } from '@/features/ai-service';

const [showModal, setShowModal] = useState(false);

const handleCreate = (project: AIGeneratedProject) => {
  // project.name, project.tasks, etc.
};

<AIProjectButton onClick={() => setShowModal(true)} />
<AIProjectModal open={showModal} onOpenChange={setShowModal} onCreateProject={handleCreate} />
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `N8N_PROJECT_WEBHOOK_URL` | n8n webhook URL for project generation |
| `x_momentum_secret` | Auth header value for n8n |
