// ============================================================================
// AI Service Feature Module - Main Entry Point
// ============================================================================

// Types
export type {
    AIProjectInput,
    AIGeneratedProject,
    AIGeneratedTask,
    AIProjectState,
    GenerateProjectResult,
} from './types';

// Actions
export { generateAIProject } from './actions';

// Hooks
export { useAIProjectGeneration } from './hooks';
export type { UseAIProjectGenerationResult } from './hooks';

// Components
export { AIProjectModal, AIProjectButton } from './components';

// Utilities
export { aiLogger } from './utils';
