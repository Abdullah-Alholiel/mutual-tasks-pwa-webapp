import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectForm } from '@/components/projects/ProjectForm';
import { mockProjects, mockUsers, currentUser, mockTasks, mockCompletionLogs, mockProjectParticipants } from '@/lib/mockData';
import { motion } from 'framer-motion';
import { Plus, FolderKanban, Globe, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Project, ProjectParticipant } from '@/types';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { calculateProjectsProgress, getUserProjects, getPublicProjects, joinProject } from '@/lib/projectUtils';
import { handleError } from '@/lib/errorUtils';

const Projects = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>(mockProjects);
  const [projectParticipants, setProjectParticipants] = useState<ProjectParticipant[]>(mockProjectParticipants);
  const [showProjectForm, setShowProjectForm] = useState(false);
  
  // Calculate user-specific progress for each project using utility
  const projectsWithProgress = useMemo(() => 
    calculateProjectsProgress(projects, mockTasks, mockCompletionLogs, currentUser.id),
    [projects, mockTasks, mockCompletionLogs]
  );

  // Filter projects using utilities
  const myProjects = useMemo(() => 
    getUserProjects(projectsWithProgress, currentUser.id),
    [projectsWithProgress]
  );
  
  const publicProjects = useMemo(() => 
    getPublicProjects(projectsWithProgress, currentUser.id),
    [projectsWithProgress]
  );

  const handleCreateProject = (projectData: {
    name: string;
    description: string;
    participants: string[];
    color: string;
    isPublic: boolean;
  }) => {
    // For private projects: require at least 2 participants (creator + one more)
    // For public projects: can create without additional participants
    if (!projectData.isPublic && projectData.participants.length < 1) {
      handleError('Private project requires at least one participant', 'handleCreateProject');
      toast.error('Private project requires at least one participant', {
        description: 'Add at least one friend to create a private project'
      });
      return;
    }
    
    const participantUsers = projectData.participants.length > 0
      ? [currentUser, ...projectData.participants.map(id => mockUsers.find(u => u.id === id)!).filter(Boolean)]
      : [currentUser]; // Public projects can have just the creator
    
    const newProject: Project = {
      id: `p${Date.now()}`,
      name: projectData.name,
      description: projectData.description,
      ownerId: currentUser.id,
      totalTasks: 0,
      isPublic: projectData.isPublic,
      createdAt: new Date(),
      updatedAt: new Date(),
      color: projectData.color,
      // Populated for UI
      participants: participantUsers,
      completedTasks: 0,
      progress: 0
    };

    setProjects(prev => [newProject, ...prev]);
    toast.success('Project created! 🎉', {
      description: 'Start adding tasks to get going!'
    });
    setShowProjectForm(false);
    // Navigate to the new project with project data in state
    navigate(`/projects/${newProject.id}`, { state: { project: newProject } });
  };

  const handleJoinProject = (project: Project) => {
    // Use modular joinProject utility
    const result = joinProject(
      project.id,
      currentUser.id,
      currentUser,
      projectParticipants,
      project
    );

    if (!result.success) {
      toast.error('Cannot join project', {
        description: result.error || 'An error occurred while joining the project'
      });
      return;
    }

    // Update project participants state
    setProjectParticipants(result.updatedParticipants);

    // Update projects state
    setProjects(prev =>
      prev.map(p => p.id === project.id ? result.updatedProject : p)
    );
    
    toast.success('Joined project! 🎉', {
      description: `You're now a member of ${project.name}`
    });

    // Navigate to project detail with updated data
    navigate(`/projects/${project.id}`, {
      state: {
        project: result.updatedProject,
        projectParticipants: result.updatedParticipants
      }
    });
  };

  return (
    <AppLayout>
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
      />
    </AppLayout>
  );
};

// Public Project Card with Join Button
interface PublicProjectCardProps {
  project: Project;
  onJoin: () => void;
}

const PublicProjectCard = ({ project, onJoin }: PublicProjectCardProps) => {
  const navigate = useNavigate();
  const progress = project.totalTasks > 0 
    ? ((project.completedTasks || 0) / project.totalTasks) * 100 
    : 0;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="cursor-pointer"
    >
      <div className="bg-card border border-border/50 rounded-2xl p-5 hover-lift shadow-md hover:shadow-lg transition-all duration-200">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Globe className="w-3 h-3" />
                  Public
                </Badge>
              </div>
              <h3 className="font-semibold text-lg text-foreground break-words mb-1">
                {project.name}
              </h3>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            </div>
            
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${project.color}15` }}
            >
              <div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: project.color }}
              />
            </div>
          </div>

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">
                {project.completedTasks || 0}/{project.totalTasks || 0} tasks
              </span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="h-2 rounded-full transition-all"
                style={{ 
                  width: `${progress}%`,
                  backgroundColor: project.color
                }}
              />
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
