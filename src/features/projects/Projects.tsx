import { useState, useMemo } from 'react';
import { AppLayout } from '@/layout/AppLayout';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { motion } from 'framer-motion';
import { Plus, FolderKanban, Globe, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { InlineLoader, PageLoader } from '@/components/ui/loader';
import type { Project } from '@/types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/features/auth/useAuth';
import { useProjects, usePublicProjects, useCreateProject, useUserProjectsWithStats, useJoinProject } from './hooks/useProjects';
import { getUserProjects } from '@/lib/projects/projectUtils';
import { getIconByName } from '@/lib/projects/projectIcons';
import { adjustColorOpacity } from '@/lib/colorUtils';
import { useIsRestoring } from '@tanstack/react-query';
import { getDatabaseClient } from '@/db';
// Global realtime subscriptions are handled by GlobalRealtimeSubscriptions in AppLayout

interface ProjectsProps {
  isInternalSlide?: boolean;
  isActive?: boolean;
}

const Projects = ({ isInternalSlide, isActive = true }: ProjectsProps) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isRestoring = useIsRestoring();
  const queryClient = useQueryClient();

  // Global realtime subscriptions are handled by GlobalRealtimeSubscriptions in AppLayout
  // Project updates are automatically reflected via the global subscription
  const { data: allProjects = [], isLoading: projectsLoading } = useUserProjectsWithStats();
  const { data: publicProjectsRaw = [] } = usePublicProjects();
  const createProjectMutation = useCreateProject();
  const joinProjectMutation = useJoinProject();
  const [showProjectForm, setShowProjectForm] = useState(false);

  // We no longer block the whole page on loading
  // SWR pattern: show cached data instantly if available
  // isRestoring ensures we wait for localStorage hydration before deciding we have "no data"
  const isInitialLoading = (projectsLoading || isRestoring) && allProjects.length === 0;

  // Calculate user-specific progress for each project using utility
  // Note: For now we'll use projects as-is since progress is calculated server-side
  const projectsWithProgress = allProjects;

  // Filter projects using utilities
  const myProjects = useMemo(() =>
    user ? getUserProjects(projectsWithProgress, user.id) : [],
    [projectsWithProgress, user]
  );

  const publicProjects = useMemo(() =>
    publicProjectsRaw || [],
    [publicProjectsRaw]
  );

  const handleCreateProject = async (projectData: {
    name: string;
    description: string;
    participants: string[];
    color: string;
    isPublic: boolean;
    icon: string;
  }) => {
    if (!user || !isAuthenticated) {
      toast.error('You must be logged in to create a project');
      return;
    }

    // Private projects can now be created without additional participants
    // if (!projectData.isPublic && projectData.participants.length < 1) {
    //   toast.error('Private project requires at least one participant', {
    //     description: 'Add at least one friend to create a private project'
    //   });
    //   return;
    // }

    try {
      // Create project with owner ID
      const ownerId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
      const newProject = await createProjectMutation.mutateAsync({
        name: projectData.name,
        description: projectData.description,
        ownerId,
        totalTasks: 0,
        isPublic: projectData.isPublic,
        color: projectData.color,
        icon: projectData.icon
      });

      // Add participants if provided
      const updatedParticipants: any[] = [];
      const updatedRoles: any[] = [];

      // Add owner (current user) to the local state lists
      if (user) {
        updatedParticipants.push(user);
        updatedRoles.push({
          projectId: newProject.id,
          userId: ownerId,
          role: 'owner',
          addedAt: new Date(),
          user: user
        });
      }

      if (projectData.participants.length > 0) {
        const db = getDatabaseClient();
        const projectId = typeof newProject.id === 'string' ? parseInt(newProject.id) : newProject.id;

        // Add participants
        for (const participantIdStr of projectData.participants) {
          const participantId = typeof participantIdStr === 'string' ? parseInt(participantIdStr) : participantIdStr;

          // Check if user exists
          const participantUser = await db.users.getById(participantId);
          if (!participantUser) {
            toast.error(`User with ID ${participantIdStr} not found`);
            continue;
          }

          // Add as participant
          await db.projects.addParticipant(projectId, participantId, 'participant');

          // Add to local lists for UI state
          updatedParticipants.push(participantUser);
          updatedRoles.push({
            projectId: newProject.id,
            userId: participantId,
            role: 'participant',
            addedAt: new Date(),
            user: participantUser
          });
        }
      }

      setShowProjectForm(false);

      // Construct updated project object with participants for immediate UI feedback
      const projectWithParticipants = {
        ...newProject,
        participants: updatedParticipants,
        participantRoles: updatedRoles
      };

      // Seed the React Query cache so ProjectDetail finds data immediately
      queryClient.setQueryData(['project', String(newProject.id)], projectWithParticipants);
      queryClient.setQueryData(['project', Number(newProject.id)], projectWithParticipants);

      // Navigate to the new project
      navigate(`/projects/${newProject.id}`, { state: { project: projectWithParticipants } });
    } catch (error) {
      console.error('Failed to create project:', error);
      toast.error('Failed to create project');
    }
  };

  const [joiningProject, setJoiningProject] = useState<Project | null>(null);

  const handleJoinProject = async (project: Project) => {
    setJoiningProject(project);
    try {
      await joinProjectMutation.mutateAsync(project.id);
      // Navigate to project detail
      navigate(`/projects/${project.id}`);
    } catch (error) {
      setJoiningProject(null);
    }
  };

  if (joiningProject) {
    return <PageLoader text={`Joining "${joiningProject.name}"...`} />;
  }

  if (isInitialLoading) {
    return (
      <div className="space-y-8 p-4">
        <div className="h-20 w-full animate-pulse bg-muted rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="h-48 animate-pulse bg-muted rounded-2xl" />
          <div className="h-48 animate-pulse bg-muted rounded-2xl" />
          <div className="h-48 animate-pulse bg-muted rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <motion.h1
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-3xl font-bold mb-2"
            >
              Projects
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="text-muted-foreground"
            >
              Collaborate on goals with your friends
            </motion.p>
          </div>

          <Button
            onClick={() => setShowProjectForm(true)}
            className="gradient-primary text-white hover:opacity-90"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </div>

        {/* Projects Tabs */}
        <Tabs defaultValue="my-projects" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
            <TabsTrigger value="my-projects" className="flex items-center gap-2">
              <FolderKanban className="w-4 h-4" />
              My Projects
              {myProjects.length > 0 && (
                <Badge variant="secondary" className="ml-2">{myProjects.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="public" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              Public Projects
              {publicProjects.length > 0 && (
                <Badge variant="secondary" className="ml-2">{publicProjects.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="my-projects" className="space-y-4">
            {myProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myProjects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="h-full"
                  >
                    <ProjectCard project={project} />
                  </motion.div>
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                  <FolderKanban className="w-10 h-10 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">No projects yet</h3>
                <p className="text-muted-foreground mb-6">
                  Create your first project and invite friends to collaborate
                </p>
                <Button
                  onClick={() => setShowProjectForm(true)}
                  className="gradient-primary text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create First Project
                </Button>
              </motion.div>
            )}
          </TabsContent>

          <TabsContent value="public" className="space-y-4">
            {publicProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {publicProjects.map((project, index) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="h-full"
                  >
                    <PublicProjectCard
                      project={project}
                      onJoin={() => handleJoinProject(project)}
                    />
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <Globe className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No public projects available</h3>
                <p className="text-muted-foreground">
                  Check back later or create your own public project!
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <ProjectForm
        open={showProjectForm}
        onOpenChange={setShowProjectForm}
        onSubmit={handleCreateProject}
        currentUser={user!}
      />
    </>
  );
};

// Public Project Card with Join Button
interface PublicProjectCardProps {
  project: Project;
  onJoin: () => void;
}

const PublicProjectCard = ({ project, onJoin }: PublicProjectCardProps) => {
  const navigate = useNavigate();
  const Icon = getIconByName(project.icon || 'Target');

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="cursor-pointer h-full"
    >
      <div className="bg-card border border-border/50 rounded-2xl p-5 hover-lift shadow-md hover:shadow-lg transition-all duration-200 h-full flex flex-col">
        <div className="flex flex-col gap-4 h-full">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-lg text-foreground break-words">
                  {project.name}
                </h3>
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Public
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            </div>

            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden group/icon"
              style={{
                backgroundColor: adjustColorOpacity(project.color || '#3b82f6', 0.15),
                boxShadow: `0 8px 15px -4px ${adjustColorOpacity(project.color || '#3b82f6', 0.25)}`,
                border: `1px solid ${adjustColorOpacity(project.color || '#3b82f6', 0.19)}`,
                color: project.color || '#3b82f6'
              }}
            >
              <div
                className="absolute inset-0 opacity-20 bg-gradient-to-br from-white to-transparent"
                style={{ background: `linear-gradient(135deg, ${adjustColorOpacity(project.color || '#3b82f6', 0.25)}, transparent)` }}
              />
              <Icon className="w-6 h-6 relative z-10 shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
            </div>
          </div>

          {/* Members */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {project.participants?.length || project.participantRoles?.length || 0} members
              </span>
            </div>
          </div>

          {/* Join Button */}
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onJoin();
            }}
            className="w-full gradient-primary text-white hover:opacity-90"
            size="sm"
          >
            <Users className="w-4 h-4 mr-2" />
            Join Project
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default Projects;
