import { AppLayout } from '@/components/layout/AppLayout';
import { TaskCard } from '@/components/tasks/TaskCard';
import { TaskForm } from '@/components/tasks/TaskForm';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Plus, Repeat, Sparkles } from 'lucide-react';
import { ProjectHeader } from '@/components/projects/ProjectHeader';
import { ProjectStats } from '@/components/projects/ProjectStats';
import { ProjectTaskSections } from '@/components/projects/ProjectTaskSections';
import { useProjectDetail } from '@/hooks/useProjectDetail';
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
import { Trash2, UserPlus, LogOut, Settings } from 'lucide-react';
import { getAvailableRoles } from '@/lib/projectUtils';
import { useState } from 'react';
import { currentUser } from '@/lib/mockData';
import type { Project } from '@/types';

const ProjectDetail = () => {
  const {
    project,
    currentProject,
    participants,
    progress,
    completedCount,
    totalTasks,
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
    isOwner,
    isManager,
    canManage,
    canLeave,
    navigate,
    completionLogs,
  } = useProjectDetail();

  if (!project || !currentProject) {
    return (
      <AppLayout>
        <div className="text-center py-16">
          <h2 className="text-2xl font-bold mb-4">Project not found</h2>
          <Button onClick={() => navigate('/projects')}>Back to Projects</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 animate-fade-in overflow-x-hidden w-full">
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
          participants={participants}
          isOwner={isOwner}
          onAddMember={() => setShowAddMemberForm(true)}
          onViewMembers={() => setShowMembersDialog(true)}
        />

        {/* Tasks Tabs */}
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6 h-auto p-0.5 gap-0.5 md:gap-1 md:p-1">
            <TabsTrigger value="all" className="text-[10px] sm:text-xs md:text-sm px-1 py-1.5 md:px-3 md:py-1.5">All</TabsTrigger>
            <TabsTrigger value="active" className="text-[10px] sm:text-xs md:text-sm px-1 py-1.5 md:px-3 md:py-1.5">Active</TabsTrigger>
            <TabsTrigger value="completed" className="text-[10px] sm:text-xs md:text-sm px-1 py-1.5 md:px-3 md:py-1.5">Done</TabsTrigger>
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
                onComplete={handleComplete}
                onRecover={handleRecover}
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
                        onComplete={handleComplete}
                        onRecover={handleRecover}
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
                    onComplete={handleComplete}
                    onRecover={handleRecover}
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
            <div className="space-y-3">
              {habitTasks.length > 0 ? (
                habitTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    completionLogs={completionLogs}
                    onComplete={handleComplete}
                    onRecover={handleRecover}
                  />
                ))
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
                    onRecover={handleRecover}
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

      <TaskForm
        open={showTaskForm}
        onOpenChange={setShowTaskForm}
        onSubmit={handleCreateTask}
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

          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            {participants.map((participant) => {
              const user = participant.user;
              if (!user) return null;
              
              return (
                <div key={participant.userId} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10 ring-2 ring-background border border-border">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{user.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{user.handle}</div>
                    </div>
                  </div>
                  {isOwner && participant.userId !== currentUser.id ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8">
                          <Badge variant="outline">{participant.role}</Badge>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {getAvailableRoles(participant.role).map((role) => (
                          <DropdownMenuItem 
                            key={role}
                            onClick={() => handleUpdateRole(participant.userId, role)}
                          >
                            Set as {role.charAt(0).toUpperCase() + role.slice(1)}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem 
                          onClick={() => handleRemoveParticipant(participant.userId)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Remove
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <Badge variant="outline">{participant.role}</Badge>
                  )}
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
            {isOwner && (
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
    </AppLayout>
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

  const handleSubmit = (e: React.FormEvent) => {
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
