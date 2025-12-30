import { TaskCard } from '../tasks/components/TaskCard';
import { TaskForm } from '../tasks/components/TaskForm';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Plus,
  Repeat,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronRight,
  Trash2,
  UserPlus,
  LogOut,
  Settings
} from 'lucide-react';
import { ProjectHeader } from '@/features/projects/components/ProjectHeader';
import { ProjectStats } from '@/features/projects/components/ProjectStats';
import { ProjectTaskSections } from '@/features/projects/components/ProjectTaskSections';
import { useProjectDetail } from './hooks/useProjectDetail';
import { useIsMobile } from '@/hooks/use-mobile';
import { InlineLoader } from '@/components/ui/loader';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getAvailableRoles } from '@/lib/projects/projectUtils';
import { useState, FormEvent } from 'react';
import { useAuth } from '@/features/auth/useAuth';
import type { Project } from '@/types';

const ProjectDetail = () => {
  const { user: currentUser } = useAuth();
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
    handleAddMember,
    handleRemoveParticipant,
    handleUpdateRole,
    handleEditProject,
    handleLeaveProject,
    handleDeleteProject,
    handleDeleteTaskSeries,
    isOwner,
    isManager,
    canManage,
    canLeave,
    navigate,
    completionLogs,
    isCreatingTask,
  } = useProjectDetail();

  const [expandedHabits, setExpandedHabits] = useState<Record<string, boolean>>({});

  const toggleHabitExpansion = (seriesId: string) => {
    setExpandedHabits(prev => ({
      ...prev,
      [seriesId]: !prev[seriesId]
    }));
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

  if (isLoading) {
    return (
      <InlineLoader text="Loading project..." />
    );
  }

  if (!project || !currentProject) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-bold mb-4">Project not found</h2>
        <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
      </div>
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
            <div className="bg-card border border-border/50 p-6 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <Loader2 className="w-6 h-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Creating Tasks...</h3>
                <p className="text-sm text-muted-foreground mt-1">This may take a few moments for habit series</p>
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
              ? 'calc(1.5rem + env(safe-area-inset-top, 0px))'
              : '7rem',
            paddingBottom: '2rem',
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))'
          }}
        >
          <ProjectHeader
            project={project}
            canManage={canManage}
            onBack={() => navigate('/projects')}
            onEdit={() => setShowEditProjectForm(true)}
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
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList className="grid w-full grid-cols-6 h-auto p-0.5 gap-0.5 md:gap-1 md:p-1">
              <TabsTrigger value="all" className="text-[10px] sm:text-xs md:text-sm px-1 py-1.5 md:px-3 md:py-1.5">All</TabsTrigger>
              <TabsTrigger value="active" className="text-[10px] sm:text-xs md:text-sm px-1 py-1.5 md:px-3 md:py-1.5">Active</TabsTrigger>
              <TabsTrigger value="completed" className="text-[10px] sm:text-xs md:text-sm px-1 py-1.5 md:px-3 md:py-1.5">Completed</TabsTrigger>
              <TabsTrigger value="upcoming" className="text-[10px] sm:text-xs md:text-sm px-1 py-1.5 md:px-3 md:py-1.5">
                <span className="hidden sm:inline">Upcoming</span>
                <span className="sm:hidden">Next</span>
              </TabsTrigger>
              <TabsTrigger value="habits" className="text-[10px] sm:text-xs md:text-sm px-1 py-1.5 md:px-3 md:py-1.5">
                <Repeat className="w-2.5 h-2.5 sm:w-3 sm:h-3 md:w-4 md:h-4 md:mr-1 inline-block" />
                <span className="hidden sm:inline">Habits</span>
              </TabsTrigger>
              <TabsTrigger value="archived" className="text-[10px] sm:text-xs md:text-sm px-1 py-1.5 md:px-3 md:py-1.5">Archive</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-6">
              {hasAnyAllTabContent ? (
                <ProjectTaskSections
                  activeTasks={activeSectionTasks}
                  upcomingTasks={upcomingSectionTasks}
                  completedTasks={completedSectionTasks}
                  archivedTasks={archivedSectionTasks}
                  completionLogs={completionLogs}
                  onRecover={handleRecoverWrapper}
                  onComplete={handleCompleteWrapper}
                />
              ) : (
                projectTasks.length === 0 ? (
                  <EmptyState onCreateTask={() => setShowTaskForm(true)} />
                ) : (
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
                          onRecover={handleRecoverWrapper}
                          onComplete={handleCompleteWrapper}
                        />
                      ))}
                    </div>
                  </div>
                )
              )}
            </TabsContent>

            <TabsContent value="active">
              <div className="space-y-3">
                {activeTasks.length > 0 ? (
                  activeTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      completionLogs={completionLogs}
                      onRecover={handleRecoverWrapper}
                      onComplete={handleCompleteWrapper}
                    />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No active tasks</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="completed">
              <div className="space-y-3 opacity-60">
                {completedTasks.length > 0 ? (
                  completedTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      completionLogs={completionLogs}
                    />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No completed tasks yet</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="upcoming">
              <div className="space-y-3">
                {upcomingTasks.length > 0 ? (
                  upcomingTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      completionLogs={completionLogs}
                    />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No upcoming tasks</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="habits">
              <div className="space-y-8">
                {habitTasks.length > 0 ? (
                  habitTasks.map((series, idx) => {
                    const seriesId = `${series.title}-${idx}`;
                    const isExpanded = expandedHabits[seriesId] !== false; // Default to expanded

                    return (
                      <div key={seriesId} className="space-y-4">
                        <div
                          className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-border/50 backdrop-blur-sm cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => toggleHabitExpansion(seriesId)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center text-muted-foreground w-5 h-5">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </div>
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                              <Repeat className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-bold text-base">{series.title}</h3>
                              {series.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">{series.description}</p>
                              )}
                              <Badge variant="outline" className="mt-1 text-[10px] py-0 h-4 uppercase tracking-wider bg-background/50">
                                {series.recurrencePattern}
                              </Badge>
                            </div>
                          </div>

                          {canManage && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2 z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (window.confirm(`Are you sure you want to delete the entire series "${series.title}"? This will remove all its daily/weekly occurrences.`)) {
                                  handleDeleteTaskSeries(series);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              <span className="hidden sm:inline">Delete Series</span>
                            </Button>
                          )}
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="grid grid-cols-1 gap-3 pl-4 border-l-2 border-primary/10 py-1">
                                {series.tasks.map(task => (
                                  <TaskCard
                                    key={task.id}
                                    task={task}
                                    completionLogs={completionLogs}
                                    onRecover={handleRecoverWrapper}
                                    onComplete={handleCompleteWrapper}
                                  />
                                ))}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-12">
                    <Repeat className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">No habit tasks yet</p>
                    {canManage && (
                      <Button onClick={() => setShowTaskForm(true)} variant="outline">
                        Create Habit Task
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="archived">
              <div className="space-y-3">
                {archivedTasks.length > 0 ? (
                  archivedTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      completionLogs={completionLogs}
                      onRecover={handleRecoverWrapper}
                      onComplete={handleCompleteWrapper}
                    />
                  ))
                ) : (
                  <div className="text-center py-12">
                    <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No archived tasks</p>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <TaskForm
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSubmit={(taskData) => {
          handleCreateTask({
            ...taskData,
            projectId: typeof taskData.projectId === 'string' ? parseInt(taskData.projectId) : taskData.projectId
          });
        }}
        project={project}
      />

      {/* Add Member Dialog */}
      <Dialog open={showAddMemberForm} onOpenChange={setShowAddMemberForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Add a new member to this project by entering their handle
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="handle">Handle</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground">@</span>
                <Input
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
                  className="pl-10"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAddMember();
                    }
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enter the user's unique handle (e.g., @username)
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddMemberForm(false);
                  setMemberIdentifier('');
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddMember}
                disabled={!memberIdentifier.trim()}
                className="flex-1 gradient-primary text-white"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Member
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={showEditProjectForm} onOpenChange={setShowEditProjectForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{canManage ? 'Edit Project' : 'Project Settings'}</DialogTitle>
            <DialogDescription>
              {canManage
                ? 'Update project name and description'
                : 'View project settings. Only owners and managers can edit project details.'}
            </DialogDescription>
          </DialogHeader>

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
        </DialogContent>
      </Dialog>

      {/* Leave Project Confirmation Dialog */}
      <Dialog open={showLeaveProjectDialog} onOpenChange={setShowLeaveProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Leave Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to leave this project? You will no longer have access to its tasks and progress.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowLeaveProjectDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleLeaveProject}
              variant="destructive"
              className="flex-1"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Leave Project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Project Confirmation Dialog */}
      <Dialog open={showDeleteProjectDialog} onOpenChange={setShowDeleteProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this project? This action cannot be undone. All tasks, progress, and data associated with this project will be permanently deleted.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setShowDeleteProjectDialog(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDeleteProject}
              variant="destructive"
              className="flex-1"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Project
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
            {participants.map((participant) => {
              const user = participant.user;
              if (!user) return null;

              const isCurrentUser = currentUser && participant.userId === currentUser.id;

              return (
                <div key={participant.userId} className="group flex items-center justify-between p-3 rounded-xl border border-border bg-card/50 hover:bg-muted/50 transition-all duration-200">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="relative">
                      <Avatar className="w-11 h-11 ring-2 ring-background border border-border shadow-sm">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback className="bg-primary/5 text-primary text-sm font-semibold">
                          {user.name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      {participant.role === 'owner' && (
                        <div className="absolute -top-1 -right-1 bg-yellow-400 text-[8px] font-bold text-white px-1 rounded-full shadow-sm ring-1 ring-background">
                          👑
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold truncate text-foreground">{user.name}</span>
                        {isCurrentUser && (
                          <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">You</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate font-medium">{user.handle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {(isOwner || (isManager && participant.role !== 'owner')) && !isCurrentUser ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 w-[110px] justify-between px-3 font-medium hover:bg-primary/5 hover:text-primary transition-colors border-border/60"
                          >
                            <span className="text-[11px] capitalize">{participant.role}</span>
                            <Settings className="w-3.5 h-3.5 ml-1 opacity-60 shrink-0" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[160px]">
                          <div className="px-2 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                            Change Role
                          </div>
                          {getAvailableRoles(participant.role).map((role) => (
                            <DropdownMenuItem
                              key={role}
                              onClick={() => handleUpdateRole(participant.userId, role)}
                              className="capitalize cursor-pointer"
                            >
                              Set as {role}
                            </DropdownMenuItem>
                          ))}
                          <div className="h-px bg-border my-1" />
                          <DropdownMenuItem
                            onClick={() => handleRemoveParticipant(participant.userId)}
                            className="text-destructive focus:bg-destructive/10 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remove from team
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <div className="h-9 w-[110px] flex items-center justify-center rounded-md border border-border/40 bg-muted/30 px-3">
                        <span className="text-[11px] font-semibold capitalize text-muted-foreground">{participant.role}</span>
                      </div>
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
        </DialogContent>
      </Dialog>
    </>
  );
};

const EmptyState = ({ onCreateTask }: { onCreateTask: () => void }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="text-center py-16"
  >
    <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
      <Sparkles className="w-10 h-10 text-muted-foreground" />
    </div>
    <h3 className="text-xl font-semibold mb-2">No tasks yet</h3>
    <p className="text-muted-foreground mb-6">
      Create your first task to start building momentum together
    </p>
    <Button onClick={onCreateTask} className="gradient-primary text-white">
      <Plus className="w-4 h-4 mr-2" />
      Create First Task
    </Button>
  </motion.div>
);

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
  onSave: (data: { name: string; description: string }) => void;
  onCancel: () => void;
  onLeaveProject?: () => void;
  onDeleteProject?: () => void;
  canLeave?: boolean;
  canEdit: boolean;
  isOwner: boolean;
}) => {
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    onSave({ name: name.trim(), description: description.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="space-y-2">
        <Label htmlFor="name">Project Name *</Label>
        <Input
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
        <Label htmlFor="description">Description</Label>
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
