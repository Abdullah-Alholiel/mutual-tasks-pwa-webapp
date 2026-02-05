import { useState, FormEvent } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import { useProjectDetail } from './hooks/useProjectDetail';
import type { Project, Task, User } from '@/types';
import { PROJECT_ICONS, getIconsByCategory, ICON_CATEGORIES } from '@/lib/projects/projectIcons';
import {
  Plus,
  Trash2,
  Clock,
  CheckCircle2,
  Settings,
  UserPlus,
  Pencil,
  LogOut,
  Repeat,
  Sparkles,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input as InputComponent } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { RecurrentTaskSeries } from '../tasks/components/RecurrentTaskSeries';
import { TaskForm } from '../tasks/components/TaskForm';
import { Button } from '@/components/ui/button';
import { AnimatedTabs, AnimatedTabsContent, AnimatedTabsList, AnimatedTabsTrigger } from '@/components/ui/animated-tabs';
import { motion, AnimatePresence } from 'framer-motion';
import { FriendSelector } from '@/features/projects/components/FriendSelector';
import { useFriends } from '@/features/friends/hooks/useFriends';
import { useJoinProject } from './hooks/useProjects';
import { FriendActionButton } from '@/features/projects/components/FriendActionButton';
import { useAIGeneration } from '@/hooks/useAIGeneration';
import { ProjectTaskSections } from './components/ProjectTaskSections';
import { TaskCard } from '../tasks/components/TaskCard';
import { AIGenerateButton } from '@/components/ui/ai-generate-button';
import { Loader, PageLoader } from '@/components/ui/loader';
import { normalizeId } from '@/lib/idUtils';
import { ProjectHeader } from '@/features/projects/components/ProjectHeader';
import { ProjectStats } from '@/features/projects/components/ProjectStats';
import ResourceNotFound from '@/components/ui/ResourceNotFound';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { getAvailableRoles } from '@/lib/projects/projectUtils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { HabitSeries } from './hooks/types';
import { EmptyState } from '@/components/ui/empty-state';

const ProjectDetail = () => {
  const { user: currentUser } = useAuth();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        type: "spring" as const,
        stiffness: 300,
        damping: 24
      }
    }
  };
  const isMobile = useIsMobile();
  const {
    project,
    currentProject,
    participants,
    progress,
    completedCount,
    totalTasks,
    isLoading,
    activeTasks,
    upcomingTasks,
    completedTasks,
    habitTasks,
    completedHabitSeries,
    upcomingHabitSeries,
    archivedHabitSeries,
    archivedTasks,
    projectTasks,
    activeSectionTasks,
    upcomingSectionTasks,
    completedSectionTasks,
    archivedSectionTasks,
    hasAnyAllTabContent,
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
    handleRecover,
    handleComplete,
    handleCreateTask,
    handleUpdateTask,
    handleAddMember,
    handleAddMembers,
    handleRemoveParticipant,
    handleUpdateRole,
    handleEditProject,
    handleLeaveProject,
    handleDeleteProject,
    handleDeleteTask,
    handleDeleteTaskSeries,
    isOwner,
    isManager,
    canManage,
    canLeave,
    isParticipant,
    navigate,
    goBack,
    completionLogs,
    isCreatingTask,
  } = useProjectDetail();

  const joinProjectMutation = useJoinProject();
  const [isJoining, setIsJoining] = useState(false);



  const handleJoinProject = async () => {
    if (!project) return;
    setIsJoining(true);
    try {
      await joinProjectMutation.mutateAsync(project.id);
      // useProjectDetail will automatically refetch data due to query invalidation in useJoinProject
    } catch (error) {
      console.error('Failed to join project:', error);
    } finally {
      setIsJoining(false);
    }
  };

  // Confirmation dialog states
  const [participantToRemove, setParticipantToRemove] = useState<number | null>(null);
  const [seriesToDelete, setSeriesToDelete] = useState<HabitSeries | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<number | null>(null);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  // Friend selection for adding multiple members
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const { data: friends = [] } = useFriends();

  // Toggle friend selection
  const handleToggleFriend = (friendId: string) => {
    setSelectedFriendIds(prev =>
      prev.includes(friendId)
        ? prev.filter(id => id !== friendId)
        : [...prev, friendId]
    );
  };

  // Handle adding selected friends
  const handleAddSelectedFriends = async () => {
    if (selectedFriendIds.length === 0) {
      handleAddMember();
      return;
    }

    const friendIdsAsNumbers = selectedFriendIds.map(id => typeof id === 'string' ? parseInt(id) : parseInt(id));
    await handleAddMembers(friendIdsAsNumbers);
    setSelectedFriendIds([]);
    setMemberIdentifier('');
    setShowAddMemberForm(false);
  };



  // Wrapper functions to handle ID type conversion for TaskCard compatibility
  const handleRecoverWrapper = (taskId: string | number) => {
    const taskIdNum = typeof taskId === 'string' ? parseInt(taskId) : taskId;
    handleRecover(taskIdNum);
  };

  const handleCompleteWrapper = (taskId: string | number, difficultyRating?: number) => {
    const taskIdNum = typeof taskId === 'string' ? parseInt(taskId) : taskId;
    handleComplete(taskIdNum, difficultyRating);
  };

  const handleDeleteTaskWrapper = (taskId: string | number) => {
    const taskIdNum = typeof taskId === 'string' ? parseInt(taskId) : taskId;
    setTaskToDelete(taskIdNum);
  };

  const handleEditTaskWrapper = (task: Task) => {
    setTaskToEdit(task);
    setShowTaskForm(true);
  };

  const getOnEditTask = (task: Task) => {
    if (isParticipant && (canManage || (currentUser && normalizeId(task.creatorId) === normalizeId(currentUser.id)))) {
      return handleEditTaskWrapper;
    }
    return undefined;
  };

  if (isLoading) {
    return (
      <PageLoader text="Loading project..." />
    );
  }

  if (!currentProject || !project) {
    return (
      <ResourceNotFound
        type="project"
        status="not_found"
        onBack={() => navigate('/projects')}
      />
    );
  }

  // Only show access denied for private projects when user is not a participant
  // Public projects are accessible to all users
  if (!currentProject.isPublic && !isParticipant) {
    return (
      <ResourceNotFound
        type="project"
        status="private_project"
        entityName={project.name}
        onBack={() => navigate('/projects')}
      />
    );
  }

  return (
    <>
      {/* Task Creation Loading Banner Overlay */}
      <AnimatePresence>
        {isCreatingTask && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-sm"
          >
            <div className="bg-card border border-border/50 p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300 min-w-[300px]">
              <Loader containerHeight="h-auto" size={50} />
              <div className="text-center">
                <h3 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Creating Tasks</h3>
                <p className="text-sm text-muted-foreground mt-1">This may take a few moments...</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="h-full w-full overflow-y-auto custom-scrollbar">
        <div
          className="px-4 md:px-6 max-w-7xl mx-auto w-full space-y-6 animate-fade-in"
          style={{
            paddingTop: isMobile
              ? 'calc(1rem + env(safe-area-inset-top, 0px))'
              : '7rem',
            paddingBottom: isMobile ? 'calc(6rem + env(safe-area-inset-bottom, 0px))' : '2rem',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
          }}
        >
          {/* Mobile Header - first row on mobile */}
          {isMobile && <MobileHeader />}

          <ProjectHeader
            project={project}
            canManage={canManage}
            isParticipant={isParticipant}
            onBack={goBack}
            onEdit={() => setShowEditProjectForm(true)}
            onJoin={handleJoinProject}
            isJoining={isJoining}
            onCreateTask={() => setShowTaskForm(true)}
          />

          <ProjectStats
            project={project}
            progress={progress}
            completedCount={completedCount}
            totalTasks={totalTasks}
            activeCount={activeTasks.length}
            completedTasksCount={completedTasks.length}
            upcomingCount={upcomingTasks.length}
            archivedCount={archivedTasks.length}
            participants={participants}
            canManage={canManage}
            onAddMember={() => setShowAddMemberForm(true)}
            onViewMembers={() => setShowMembersDialog(true)}
          />

          {/* Tasks Tabs */}
          <AnimatedTabs defaultValue="all" className="space-y-4">
            <AnimatedTabsList className="grid w-full grid-cols-4 h-auto p-0.5 gap-0.5 md:gap-1 md:p-1">
              <AnimatedTabsTrigger value="all" className="text-sm sm:text-base md:text-lg px-1 py-1.5 md:px-3 md:py-1.5">All</AnimatedTabsTrigger>
              <AnimatedTabsTrigger value="completed" className="text-sm sm:text-base md:text-lg px-1 py-1.5 md:px-3 md:py-1.5">Completed</AnimatedTabsTrigger>
              <AnimatedTabsTrigger value="upcoming" className="text-sm sm:text-base md:text-lg px-1 py-1.5 md:px-3 md:py-1.5">
                <span className="hidden sm:inline">Upcoming</span>
                <span className="sm:hidden">Upcoming</span>
              </AnimatedTabsTrigger>
              <AnimatedTabsTrigger value="archived" className="text-sm sm:text-base md:text-lg px-1 py-1.5 md:px-3 md:py-1.5">Archived</AnimatedTabsTrigger>
            </AnimatedTabsList>

            <AnimatedTabsContent value="all" className="space-y-6">
              {/* Recurrent Task Series in "All" Tab */}
              {habitTasks.length > 0 && (
                <motion.div
                  className="space-y-3"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Repeat className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-muted-foreground">Recurrent Tasks</h3>
                  </div>
                  {habitTasks.map((series, idx) => (
                    <motion.div key={`${series.title}-${idx}`} variants={itemVariants}>
                      <RecurrentTaskSeries
                        series={series}
                        completionLogs={completionLogs}
                        onDeleteSeries={canManage ? setSeriesToDelete : undefined}
                        onRecoverTask={isParticipant ? handleRecoverWrapper : undefined}
                        onCompleteTask={isParticipant ? handleCompleteWrapper : undefined}
                        onDeleteTask={canManage ? handleDeleteTaskWrapper : undefined}
                        canManage={canManage}
                        showMemberInfo={isParticipant}
                      />
                    </motion.div>
                  ))}
                </motion.div>
              )}

              {hasAnyAllTabContent ? (
                <ProjectTaskSections
                  activeTasks={activeSectionTasks}
                  upcomingTasks={upcomingSectionTasks}
                  completedTasks={completedSectionTasks}
                  archivedTasks={archivedSectionTasks}
                  completionLogs={completionLogs}
                  onRecover={isParticipant ? handleRecoverWrapper : undefined}
                  onComplete={isParticipant ? handleCompleteWrapper : undefined}
                  onDelete={canManage ? handleDeleteTaskWrapper : undefined}
                  getOnEditTask={getOnEditTask}
                  showMemberInfo={isParticipant}
                />
              ) : (
                projectTasks.length === 0 ? (
                  <EmptyState
                    title="No tasks yet"
                    description={canManage
                      ? "Get started by creating your first task for this project."
                      : "There are no tasks in this project yet."}
                    action={canManage ? {
                      label: "Create Task",
                      onClick: () => setShowTaskForm(true),
                      icon: <Plus className="w-4 h-4" />
                    } : undefined}
                  />
                ) : (
                  /* Fallback for when no categorized tasks match but project has tasks (e.g. only habits, handled above) */
                  habitTasks.length === 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-accent" />
                        <h3 className="text-lg font-semibold">All Project Tasks</h3>
                      </div>
                      <div className="space-y-3">
                        {projectTasks.map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            completionLogs={completionLogs}
                            onRecover={isParticipant ? handleRecoverWrapper : undefined}
                            onComplete={isParticipant ? handleCompleteWrapper : undefined}
                            onDelete={canManage ? handleDeleteTaskWrapper : undefined}
                            onEdit={getOnEditTask(task)}
                            showMemberInfo={isParticipant}
                          />
                        ))}
                      </div>
                    </div>
                  )
                )
              )}
            </AnimatedTabsContent>



            <AnimatedTabsContent value="completed">
              <div className="space-y-6">
                {/* Recurrent Task Series Section (Completed only) */}
                {completedHabitSeries.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Repeat className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-muted-foreground">Recurrent Tasks</h3>
                    </div>
                    {completedHabitSeries.map((series, idx) => (
                      <RecurrentTaskSeries
                        key={`${series.title}-${idx}`}
                        series={series}
                        completionLogs={completionLogs}
                        onDeleteSeries={canManage ? setSeriesToDelete : undefined}
                        onRecoverTask={isParticipant ? handleRecoverWrapper : undefined}
                        onCompleteTask={isParticipant ? handleCompleteWrapper : undefined}
                        onDeleteTask={canManage ? handleDeleteTaskWrapper : undefined}
                        getOnEditTask={getOnEditTask}
                        canManage={canManage}
                        showMemberInfo={isParticipant}
                      />
                    ))}
                  </div>
                )}

                {/* Individual Completed Tasks Section */}
                <div className="space-y-3 opacity-60">
                  {completedTasks.length > 0 && completedHabitSeries.length > 0 && (
                    <div className="flex items-center gap-2 mb-2 mt-2">
                      <CheckCircle2 className="w-4 h-4 text-status-completed" />
                      <h3 className="text-sm font-semibold text-muted-foreground">One-off Tasks</h3>
                    </div>
                  )}

                  {completedTasks.length > 0 ? (
                    completedTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        completionLogs={completionLogs}
                        onDelete={canManage ? handleDeleteTaskWrapper : undefined}
                        onEdit={getOnEditTask(task)}
                        showMemberInfo={isParticipant}
                      />
                    ))
                  ) : (
                    completedHabitSeries.length === 0 && (
                      <div className="text-center py-12">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No completed tasks yet</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </AnimatedTabsContent>

            <AnimatedTabsContent value="upcoming">
              <div className="space-y-6">
                {/* Recurrent Task Series Section (Upcoming/Active only) */}
                {upcomingHabitSeries.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Repeat className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-muted-foreground">Recurrent Tasks</h3>
                    </div>
                    {upcomingHabitSeries.map((series, idx) => (
                      <RecurrentTaskSeries
                        key={`${series.title}-${idx}`}
                        series={series}
                        completionLogs={completionLogs}
                        onDeleteSeries={canManage ? setSeriesToDelete : undefined}
                        onRecoverTask={isParticipant ? handleRecoverWrapper : undefined}
                        onCompleteTask={isParticipant ? handleCompleteWrapper : undefined}
                        onDeleteTask={canManage ? handleDeleteTaskWrapper : undefined}
                        getOnEditTask={getOnEditTask}
                        canManage={canManage}
                        showMemberInfo={isParticipant}
                      />
                    ))}
                  </div>
                )}

                {/* Individual Upcoming Tasks Section */}
                <div className="space-y-3">
                  {upcomingTasks.length > 0 && upcomingHabitSeries.length > 0 && (
                    <div className="flex items-center gap-2 mb-2 mt-2">
                      <Clock className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-muted-foreground">One-off Tasks</h3>
                    </div>
                  )}

                  {upcomingTasks.length > 0 ? (
                    upcomingTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        completionLogs={completionLogs}
                        onRecover={isParticipant ? handleRecoverWrapper : undefined}
                        onComplete={isParticipant ? handleCompleteWrapper : undefined}
                        onDelete={canManage ? handleDeleteTaskWrapper : undefined}
                        onEdit={getOnEditTask ? getOnEditTask(task) : undefined}
                        showMemberInfo={isParticipant}
                      />
                    ))
                  ) : (
                    upcomingHabitSeries.length === 0 && (
                      <div className="text-center py-12">
                        <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No upcoming tasks</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </AnimatedTabsContent>

            <AnimatedTabsContent value="archived">
              <div className="space-y-6">
                {/* Recurrent Task Series Section (Archived only) */}
                {archivedHabitSeries.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Repeat className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-muted-foreground">Recurrent Tasks</h3>
                    </div>
                    {archivedHabitSeries.map((series, idx) => (
                      <RecurrentTaskSeries
                        key={`${series.title}-${idx}`}
                        series={series}
                        completionLogs={completionLogs}
                        onDeleteSeries={canManage ? setSeriesToDelete : undefined}
                        onRecoverTask={isParticipant ? handleRecoverWrapper : undefined}
                        onCompleteTask={isParticipant ? handleCompleteWrapper : undefined}
                        onDeleteTask={canManage ? handleDeleteTaskWrapper : undefined}
                        getOnEditTask={getOnEditTask}
                        canManage={canManage}
                        showMemberInfo={isParticipant}
                      />
                    ))}
                  </div>
                )}

                {/* Individual Archived Tasks Section */}
                <div className="space-y-3">
                  {archivedTasks.length > 0 && archivedHabitSeries.length > 0 && (
                    <div className="flex items-center gap-2 mb-2 mt-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground">One-off Tasks</h3>
                    </div>
                  )}

                  {archivedTasks.length > 0 ? (
                    archivedTasks.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        completionLogs={completionLogs}
                        onRecover={isParticipant ? handleRecoverWrapper : undefined}
                        onComplete={isParticipant ? handleCompleteWrapper : undefined}
                        onDelete={canManage ? handleDeleteTaskWrapper : undefined}
                        onEdit={getOnEditTask ? getOnEditTask(task) : undefined}
                        showMemberInfo={isParticipant}
                      />
                    ))
                  ) : (
                    archivedHabitSeries.length === 0 && (
                      <div className="text-center py-12">
                        <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                        <p className="text-muted-foreground">No archived tasks</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </AnimatedTabsContent>
          </AnimatedTabs>
        </div>
      </div>

      <TaskForm
        open={showTaskForm}
        onOpenChange={(open) => {
          setShowTaskForm(open);
          if (!open) setTaskToEdit(null);
        }}
        initialTask={taskToEdit || undefined}
        onSubmit={(taskData) => {
          if (taskToEdit) {
            handleUpdateTask(taskToEdit.id, {
              ...taskData,
              projectId: typeof taskData.projectId === 'string' ? parseInt(taskData.projectId) : taskData.projectId
            });
          } else {
            handleCreateTask({
              ...taskData,
              projectId: typeof taskData.projectId === 'string' ? parseInt(taskData.projectId) : taskData.projectId
            });
          }
        }}
        project={project}
      />

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberForm} onOpenChange={setShowAddMemberForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a new member to this project by entering their handle or selecting from your friends
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="handle">Handle</Label>
              <div className="relative">
                <InputComponent
                  id="handle"
                  type="text"
                  placeholder="username"
                  value={memberIdentifier}
                  onChange={(e) => {
                    let value = e.target.value;
                    if (value && !value.startsWith('@')) {
                      value = `@${value}`;
                    }
                    setMemberIdentifier(value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && memberIdentifier.trim()) {
                      handleAddMember();
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the user's unique handle (e.g., @username)
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Select Friends</Label>
              <FriendSelector
                availableFriends={friends.map(f => f.friend).filter((f): f is User => {
                  if (!f) return false;
                  return !participants.some(p => {
                    const pUserId = typeof p.userId === 'string' ? parseInt(p.userId) : p.userId;
                    return pUserId === f.id;
                  });
                })}
                selectedUserIds={selectedFriendIds}
                onToggleUser={handleToggleFriend}
                selectedColor={currentProject?.color}
                maxHeight="250px"
                emptyMessage="No friends available to add"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddMemberForm(false);
                  setMemberIdentifier('');
                  setSelectedFriendIds([]);
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddSelectedFriends}
                disabled={!memberIdentifier.trim() && selectedFriendIds.length === 0}
                className="flex-1 gradient-primary text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {selectedFriendIds.length > 0
                  ? `Add ${selectedFriendIds.length} Member${selectedFriendIds.length > 1 ? 's' : ''}`
                  : 'Add Member'
                }
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={showEditProjectForm} onOpenChange={setShowEditProjectForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-2 mb-2">
              <Pencil className="w-5 h-5 text-primary" />
              <DialogTitle>{canManage ? 'Edit Project' : 'Project Settings'}</DialogTitle>
            </div>
            <DialogDescription>
              {canManage
                ? 'Update project name and description'
                : 'View project settings. Only owners and managers can edit project details.'}
            </DialogDescription>
          </DialogHeader>

          {project && (
            <EditProjectForm
              project={project}
              onSave={handleEditProject}
              onCancel={() => setShowEditProjectForm(false)}
              onLeaveProject={canLeave ? () => setShowLeaveProjectDialog(true) : undefined}
              onDeleteProject={isOwner ? () => setShowDeleteProjectDialog(true) : undefined}
              canLeave={canLeave}
              canEdit={canManage}
              isOwner={isOwner}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Leave Project Confirmation Dialog */}
      <Dialog open={showLeaveProjectDialog} onOpenChange={setShowLeaveProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Leave Project?</DialogTitle>
            <DialogDescription className="pt-2 text-base">
              Are you sure you want to leave <span className="font-semibold text-foreground">"{project?.name}"</span>?
              You will no longer be able to see or manage tasks in this project.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLeaveProjectDialog(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleLeaveProject}
              className="rounded-xl px-8"
            >
              Leave Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={showDeleteProjectDialog} onOpenChange={setShowDeleteProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl text-destructive font-bold">Delete Project?</DialogTitle>
            <DialogDescription className="pt-2 text-base">
              This will <span className="font-bold text-destructive underline">permanently delete</span> the project <span className="font-semibold text-foreground">"{project?.name}"</span> and ALL its associated tasks and history.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowDeleteProjectDialog(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteProject}
              className="rounded-xl px-8"
            >
              Delete Everything
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Member Confirmation Dialog */}
      <Dialog open={participantToRemove !== null} onOpenChange={(open) => !open && setParticipantToRemove(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Remove member?</DialogTitle>
            <DialogDescription className="pt-2 text-base">
              Are you sure you want to remove this member from the team?
              They will lose access to all tasks in this project.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setParticipantToRemove(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (participantToRemove) {
                  handleRemoveParticipant(participantToRemove);
                  setParticipantToRemove(null);
                }
              }}
              className="rounded-xl px-8"
            >
              Remove Member
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Task Series Confirmation Dialog */}
      <Dialog open={seriesToDelete !== null} onOpenChange={(open) => !open && setSeriesToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Delete task series?</DialogTitle>
            <DialogDescription className="pt-2 text-base">
              Are you sure you want to delete the series <span className="font-semibold text-foreground">"{seriesToDelete?.title}"</span>?
              This will remove ALL occurrences of this task.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSeriesToDelete(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (seriesToDelete) {
                  handleDeleteTaskSeries(seriesToDelete);
                  setSeriesToDelete(null);
                }
              }}
              className="rounded-xl px-8"
            >
              Delete Series
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Single Task Confirmation Dialog */}
      <Dialog open={taskToDelete !== null} onOpenChange={(open) => !open && setTaskToDelete(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">Delete task?</DialogTitle>
            <DialogDescription className="pt-2 text-base">
              Are you sure you want to delete this task? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col sm:flex-row justify-end gap-3 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTaskToDelete(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                if (taskToDelete) {
                  handleDeleteTask(taskToDelete);
                  setTaskToDelete(null);
                }
              }}
              className="rounded-xl px-8"
            >
              Delete Task
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Members Dialog */}
      <Dialog open={showMembersDialog} onOpenChange={setShowMembersDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Team Members</DialogTitle>
            <DialogDescription>
              View and manage project members and their roles
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-[450px] overflow-y-auto custom-scrollbar pr-1">
            {/* Members List */}
            {participants
              .sort((a, b) => {
                const userA = a.user;
                const userB = b.user;
                if (!userA || !userB) return 0;

                // Priority 1: Owners at the top
                if (a.role === 'owner' && b.role !== 'owner') return -1;
                if (a.role !== 'owner' && b.role === 'owner') return 1;

                // Priority 2: Alphabetical by name
                return userA.name.localeCompare(userB.name);
              })
              .map((participant) => {
                const user = participant.user;
                if (!user) return null;

                const isCurrentUser = currentUser && participant.userId === currentUser.id;

                // Removed inline friendship logic as it is now handled by FriendActionButton

                const handleRowClick = () => {
                  navigate(`/friends/${user.id}`);
                };

                return (
                  <div
                    key={participant.userId}
                    className="group flex items-center justify-between p-3 rounded-xl border border-border bg-card/50 hover:bg-muted/50 transition-all duration-200 cursor-pointer"
                    onClick={handleRowClick}
                  >
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="relative">
                        <Avatar className="w-11 h-11 ring-2 ring-background border border-border shadow-sm">
                          <AvatarImage src={user.avatar} alt={user.name} />
                          <AvatarFallback className="bg-primary/5 text-primary text-sm font-semibold">
                            {user.name?.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        {participant.role === 'owner' && (
                          <div className="absolute -top-1 -right-1 bg-yellow-400 text-[10px] flex items-center justify-center w-5 h-5 rounded-full shadow-sm ring-2 ring-background z-10" title="Owner">
                            👑
                          </div>
                        )}
                        {participant.role === 'manager' && (
                          <div className="absolute -top-1 -right-1 bg-[#1D4ED8] text-[10px] flex items-center justify-center w-5 h-5 rounded-full shadow-sm ring-2 ring-background z-10" title="Manager">
                            🛡️
                          </div>
                        )}
                        {isCurrentUser && (
                          <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground text-[8px] px-1.5 py-0.5 rounded-full font-bold shadow-sm ring-2 ring-background">
                            YOU
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold truncate text-foreground">{user.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground truncate font-medium">{user.handle}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      {/* Friend Action Button */}
                      {!isCurrentUser && (
                        <FriendActionButton user={user} className="mr-1" />
                      )}

                      {(isOwner || (isManager && participant.role !== 'owner')) && !isCurrentUser && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-muted text-muted-foreground"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Settings className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                              Change Role
                            </div>
                            {getAvailableRoles(participant.role).map((role) => (
                              <DropdownMenuItem
                                key={role}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateRole(participant.userId, role);
                                }}
                                className="capitalize cursor-pointer"
                              >
                                Set as {role}
                              </DropdownMenuItem>
                            ))}
                            <div className="h-px bg-border my-1" />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                setParticipantToRemove(participant.userId);
                              }}
                              className="text-destructive focus:bg-destructive/10 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Remove from team
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowMembersDialog(false)}
              className="flex-1"
            >
              Close
            </Button>
            {canManage && (
              <Button
                onClick={() => {
                  setShowMembersDialog(false);
                  setShowAddMemberForm(true);
                }}
                className="flex-1 gradient-primary text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            )}
          </div>
        </DialogContent >
      </Dialog >
    </>
  );
};


const EditProjectForm = ({
  project,
  onSave,
  onCancel,
  onLeaveProject,
  onDeleteProject,
  canLeave,
  canEdit,
  isOwner
}: {
  project: Project;
  onSave: (data: { name: string; description: string; icon: string }) => void;
  onCancel: () => void;
  onLeaveProject?: () => void;
  onDeleteProject?: () => void;
  canLeave?: boolean;
  canEdit: boolean;
  isOwner: boolean;
}) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [selectedIcon, setSelectedIcon] = useState(project.icon || PROJECT_ICONS[0].name);
  const [iconCategory, setIconCategory] = useState('All');

  // AI Generation Hook
  const { aiState, generateDescription } = useAIGeneration('project');

  // Get filtered icons based on selected category
  const filteredIcons = getIconsByCategory(iconCategory);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      icon: selectedIcon
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      {/* Icon Selection with Category Tabs */}
      {canEdit && (
        <div className="space-y-3">
          <Label>Project Icon</Label>
          {/* Category Tabs */}
          <div className="flex flex-wrap gap-1.5">
            {ICON_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setIconCategory(category)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-full transition-all",
                  iconCategory === category
                    ? "text-white shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
                style={iconCategory === category ? { backgroundColor: project.color } : {}}
              >
                {category}
              </button>
            ))}
          </div>
          {/* Icon Grid */}
          <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-[140px] overflow-y-auto p-1 custom-scrollbar">
            {filteredIcons.map(({ name: iconName, icon: Icon }) => {
              const isSelected = selectedIcon === iconName;
              return (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setSelectedIcon(iconName)}
                  className={cn(
                    "flex items-center justify-center p-2.5 rounded-xl border-2 transition-all aspect-square cursor-pointer hover:scale-105 active:scale-95",
                    isSelected
                      ? "ring-2 ring-offset-2 ring-offset-background"
                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground hover:bg-muted/30"
                  )}
                  style={isSelected ? {
                    color: project.color,
                    borderColor: project.color,
                    backgroundColor: `${project.color}15`,
                    boxShadow: `0 0 0 2px ${project.color}40`
                  } : {}}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Project Name *</Label>
        <InputComponent
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={!canEdit}
          className={!canEdit ? "bg-muted cursor-not-allowed" : ""}
        />
        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Only owners and managers can edit the project name
          </p>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="description">Description</Label>
          {canEdit && (
            <AIGenerateButton
              state={aiState}
              onClick={async () => {
                const desc = await generateDescription(name);
                if (desc) {
                  setDescription((prev) => (prev ? `${prev}\n\n${desc}` : desc));
                }
              }}
              disabled={!name.trim() || aiState === 'loading'}
              className="scale-90 origin-right"
            />
          )}
        </div>
        <textarea
          id="description"
          className={`flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${!canEdit ? "bg-muted cursor-not-allowed" : ""}`}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={!canEdit}
        />
        {!canEdit && (
          <p className="text-xs text-muted-foreground">
            Only owners and managers can edit the project description
          </p>
        )}
      </div>

      {canEdit && (
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 gradient-primary text-white"
          >
            Save Changes
          </Button>
        </div>
      )}

      {(canLeave || isOwner) && (
        <div className={`pt-6 border-t border-border/50 ${!canEdit ? "pt-0" : ""}`}>
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-1">Danger Zone</h3>
              <p className="text-xs text-muted-foreground">
                {isOwner
                  ? 'Permanently delete this project or leave it. These actions cannot be undone.'
                  : 'Leave this project. You will lose access to all tasks and progress.'}
              </p>
            </div>
            <div className="space-y-2">
              {isOwner && onDeleteProject && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onDeleteProject}
                  className="w-full"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Project
                </Button>
              )}
              {canLeave && onLeaveProject && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onLeaveProject}
                  className="w-full"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Leave Project
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {!canEdit && !canLeave && (
        <div className="pt-4">
          <p className="text-sm text-muted-foreground text-center">
            You don't have permission to edit this project or leave it.
          </p>
        </div>
      )}
    </form>
  );
};

export default ProjectDetail;