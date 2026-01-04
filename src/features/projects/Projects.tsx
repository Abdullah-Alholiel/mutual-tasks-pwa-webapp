import { useState, useMemo } from 'react';
import { AppLayout } from '@/layout/AppLayout';
import { ProjectCard } from '@/features/projects/components/ProjectCard';
import { ProjectForm } from '@/features/projects/components/ProjectForm';
import { motion } from 'framer-motion';
import { Plus, FolderKanban, Globe, Users, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
import { useProjectsTabState } from './hooks/useProjectsTabState';
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
  const [searchQuery, setSearchQuery] = useState('');
  const { activeTab, setActiveTab } = useProjectsTabState();

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

  const filteredPublicProjects = useMemo(() => {
    if (!publicProjectsRaw || publicProjectsRaw.length === 0) return [];
    if (!searchQuery.trim()) return publicProjectsRaw;

    const query = searchQuery.toLowerCase().trim();
    const queryTokens = query.split(/\s+/).filter(t => t.length > 0);

    return publicProjectsRaw
      .map(project => {
        let score = 0;
        const name = (project.name || '').toLowerCase();
        const description = (project.description || '').toLowerCase();

        // 1. Exact Phrase Match (Highest priority)
        if (name.includes(query)) score += 100;
        else if (description.includes(query)) score += 40;

        // 2. Individual Token Matching
        let matchedTokensInName = 0;
        let matchedTokensTotal = 0;

        queryTokens.forEach(token => {
          const nameHasToken = name.includes(token);
          const descHasToken = description.includes(token);

          if (nameHasToken) {
            matchedTokensInName++;
            matchedTokensTotal++;

            // Check if it's a whole word match in name
            const wordRegex = new RegExp(`\\b${token}\\b`, 'i');
            if (wordRegex.test(name)) score += 30; // Solid match for whole word
            else score += 10; // Substring match

            // Bonus for name starting with token
            if (name.startsWith(token)) score += 20;
          }

          if (descHasToken) {
            if (!nameHasToken) matchedTokensTotal++;

            const wordRegex = new RegExp(`\\b${token}\\b`, 'i');
            if (wordRegex.test(description)) score += 15;
            else score += 5;
          }
        });

        // 3. Contextual Bonuses
        // Bonus for matching all tokens in the title
        if (matchedTokensInName === queryTokens.length) score += 50;

        // Bonus for matching all tokens across title/desc
        if (matchedTokensTotal === queryTokens.length) score += 30;

        // Bonus for correct sequence of tokens in title (even if not exact phrase)
        if (queryTokens.length > 1) {
          const tokenIndices = queryTokens.map(t => name.indexOf(t)).filter(i => i !== -1);
          const isSequential = tokenIndices.every((val, i) => i === 0 || val > tokenIndices[i - 1]);
          if (isSequential && tokenIndices.length === queryTokens.length) {
            score += 40;
          }
        }

        return { project, score };
      })
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.project);
  }, [publicProjectsRaw, searchQuery]);

  const publicProjects = filteredPublicProjects;

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
              className="text-3xl font-bold"
            >
              Projects
            </motion.h1>
          </div>

          <Button
            onClick={() => setShowProjectForm(true)}
            className="gradient-primary text-white hover:shadow-md hover:shadow-primary/20 rounded-full h-10 px-3.5 text-sm font-semibold transition-all duration-300 hover:translate-y-[-1px] active:translate-y-[0px] shrink-0"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Project
          </Button>
        </div>

        {/* Projects Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'my-projects' | 'public')} className="space-y-6">
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

          <TabsContent value="public" className="space-y-6">
            <div className="space-y-4">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input
                  type="text"
                  placeholder="Search by name or description"
                  className="pl-10 h-12 bg-card border-border/50 focus:border-primary/50 rounded-2xl shadow-sm transition-all text-base"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {searchQuery.trim() && publicProjects.length > 0 && (
                <div className="flex items-center gap-2 px-1">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold py-0.5">
                    {publicProjects.length} {publicProjects.length === 1 ? 'Result' : 'Results'} Found
                  </Badge>
                </div>
              )}
            </div>

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
            ) : searchQuery.trim() ? (
              <div className="text-center py-16">
                <Search className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-xl font-semibold mb-2">No matches found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your keywords to find what you're looking for
                </p>
                <Button
                  variant="ghost"
                  className="mt-4 text-primary"
                  onClick={() => setSearchQuery('')}
                >
                  Clear Search
                </Button>
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
      onClick={() => navigate(`/projects/${project.id}`, { state: { fromTab: 'public' } })}
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
            className="w-max mx-auto gradient-primary text-white rounded-full h-10 px-6 text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-300 hover:translate-y-[-1px]"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Join Project
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default Projects;
