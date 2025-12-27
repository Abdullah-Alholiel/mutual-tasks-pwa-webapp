// ============================================================================
// Project Hooks - Public API
// ============================================================================

// Main orchestrator hook
export { useProjectDetail } from './useProjectDetail';

// Individual hooks for granular usage
export { useProjects, useProject, usePublicProjects, useCreateProject, useUpdateProject, useDeleteProject } from './useProjects';
export { useProjectTaskData } from './useProjectTaskData';
export { useProjectTaskCategories } from './useProjectTaskCategories';
export { useProjectTaskMutations } from './useProjectTaskMutations';
export { useProjectMembers } from './useProjectMembers';
export { useProjectSettings } from './useProjectSettings';

// Types
export type {
  TaskCreationData,
  ProjectWithParticipants,
  ProjectTaskState,
  CategorizedTasks,
  ProjectPermissions,
  ParticipantWithUser,
} from './types';

