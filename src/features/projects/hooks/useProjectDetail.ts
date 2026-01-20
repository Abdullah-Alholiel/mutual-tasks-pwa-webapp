// ============================================================================
// useProjectDetail - Main Orchestrator Hook for Project Detail Page
// ============================================================================
// This hook composes all the modular project hooks to provide a unified
// interface for the ProjectDetail component.
// ============================================================================

import { useState, useMemo } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import type { Project, ProjectParticipant } from '@/types';
import { useAuth } from '../../auth/useAuth';
import { useProject } from './useProjects';
import { useProjectTaskData } from './useProjectTaskData';
import { useProjectTaskCategories } from './useProjectTaskCategories';
import { useProjectTaskMutations } from './useProjectTaskMutations';
import { useProjectMembers } from './useProjectMembers';
import { useProjectSettings } from './useProjectSettings';
import { useProjectDetailRealtime } from './useProjectRealtime';

export const useProjectDetail = () => {
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  // Subscribe to project-specific realtime updates (tasks, participants)
  useProjectDetailRealtime(id, user?.id ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : undefined);

  // Global realtime subscriptions are handled by GlobalRealtimeSubscriptions in AppLayout
  // but for creating new tasks in a specific project, we need to listen to the 'tasks' table
  // which is handled by useProjectDetailRealtime above.

  // Get project from route state or database
  const projectFromState = location.state?.project as Project | undefined;
  const projectParticipantsFromState = location.state?.projectParticipants as ProjectParticipant[] | undefined;
  const { data: projectFromDb, isLoading: projectLoading } = useProject(id);
  const currentProject = projectFromState || projectFromDb;

  // Task form state
  const [showTaskForm, setShowTaskForm] = useState(false);

  // Fetch and manage task data
  const taskData = useProjectTaskData({ projectId: id });
  const {
    tasks,
    taskStatuses,
    completionLogs,
    setLocalTasks,
    setLocalTaskStatuses,
    setLocalCompletionLogs,
    isLoading: tasksLoading,
    isFetched: tasksFetched,
    projectTasksFromDb,
  } = taskData;

  // Manage project members
  const members = useProjectMembers({
    projectId: id,
    currentProject,
    projectFromDb,
    projectParticipantsFromState,
    user,
  });
  const {
    participants,
    projectParticipants,
    setProjectParticipants,
    showAddMemberForm,
    setShowAddMemberForm,
    showMembersDialog,
    setShowMembersDialog,
    memberIdentifier,
    setMemberIdentifier,
    handleAddMember,
    handleAddMembers,
    handleRemoveParticipant,
    handleUpdateRole,
  } = members;

  // Project with participants
  const projectWithParticipants = useMemo(() => {
    if (!currentProject) return undefined;
    return {
      ...currentProject,
      participants: participants.map(p => p.user).filter((u): u is NonNullable<typeof u> => u !== undefined),
      participantRoles: participants,
    };
  }, [currentProject, participants]);

  // Categorize tasks
  const taskCategories = useProjectTaskCategories({
    tasks,
    taskStatuses,
    completionLogs,
    currentProject,
    user,
  });
  const {
    activeTasks,
    upcomingTasks,
    completedTasks,
    archivedTasks,
    habitTasks,
    completedHabitSeries,
    upcomingHabitSeries,
    archivedHabitSeries,
    projectTasks,
    hasAnyAllTabContent,
    progress,
    completedCount,
    totalTasks,
  } = taskCategories;

  // Task mutations
  const taskMutations = useProjectTaskMutations({
    user,
    projectWithParticipants,
    taskState: {
      tasks,
      taskStatuses,
      completionLogs,
      setLocalTasks,
      setLocalTaskStatuses,
      setLocalCompletionLogs,
    },
    onTaskFormClose: () => setShowTaskForm(false),
  });
  const {
    handleRecover,
    handleComplete,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
    handleDeleteTaskSeries,
    isCreatingTask,
  } = taskMutations;

  // Project settings
  const settings = useProjectSettings({
    projectId: id,
    currentProject,
    user,
    participants,
  });
  const {
    isOwner,
    isManager,
    canManage,
    canLeave,
    isParticipant,
    showEditProjectForm,
    setShowEditProjectForm,
    showLeaveProjectDialog,
    setShowLeaveProjectDialog,
    showDeleteProjectDialog,
    setShowDeleteProjectDialog,
    handleEditProject,
    handleLeaveProject,
    handleDeleteProject,
    navigate,
  } = settings;

  // Section tasks (aliases for clarity)
  const activeSectionTasks = activeTasks;
  const upcomingSectionTasks = upcomingTasks;
  const completedSectionTasks = completedTasks;
  const archivedSectionTasks = archivedTasks;

  // Handle back navigation
  const goBack = () => {
    if (location.key !== 'default') {
      navigate(-1);
    } else {
      navigate('/projects');
    }
  };

  // Combined loading state
  const isLoading = projectLoading || tasksLoading || (tasksFetched && projectTasksFromDb.length > 0 && tasks.length === 0);

  return {
    // Project data
    project: projectWithParticipants,
    currentProject,
    participants,
    progress,
    completedCount,
    totalTasks,

    // Loading state
    isLoading,

    // Task lists
    activeTasks,
    upcomingTasks,
    completedTasks,
    habitTasks,
    completedHabitSeries,
    upcomingHabitSeries,
    archivedHabitSeries,
    archivedTasks,
    projectTasks,

    // Section tasks (with deduplication)
    activeSectionTasks,
    upcomingSectionTasks,
    completedSectionTasks,
    archivedSectionTasks,
    hasAnyAllTabContent,

    // Dialog states
    showTaskForm,
    setShowTaskForm,
    showAddMemberForm,
    setShowAddMemberForm,
    showEditProjectForm,
    setShowEditProjectForm,
    showLeaveProjectDialog,
    setShowLeaveProjectDialog,
    showDeleteProjectDialog,
    setShowDeleteProjectDialog,
    showMembersDialog,
    setShowMembersDialog,
    memberIdentifier,
    setMemberIdentifier,

    // Task handlers
    handleRecover,
    handleComplete,
    handleCreateTask,
    handleUpdateTask,
    handleDeleteTask,
    handleDeleteTaskSeries,

    // Member handlers
    handleAddMember,
    handleAddMembers,
    handleRemoveParticipant,
    handleUpdateRole,

    // Project handlers
    handleEditProject,
    handleLeaveProject,
    handleDeleteProject,

    // Permissions
    isOwner,
    isManager,
    canManage,
    canLeave,
    isParticipant,

    // Navigation
    navigate,
    goBack,

    // Data
    completionLogs,

    // Mutation states
    isCreatingTask,
  };
};
