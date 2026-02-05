import type { Project } from '@/types';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { Users, TrendingUp, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getIconByName } from '@/lib/projects/projectIcons';

import { adjustColorOpacity } from '@/lib/colorUtils';
import { DEFAULT_PROJECT_COLOR } from '@/constants/projectColors';

interface ProjectCardProps {
  project: Project;
}

export const ProjectCard = ({ project }: ProjectCardProps) => {
  const navigate = useNavigate();
  const progress = project.totalTasks > 0
    ? ((project.completedTasks || 0) / project.totalTasks) * 100
    : 0;

  const Icon = project.icon ? getIconByName(project.icon) : TrendingUp;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/projects/${project.id}`)}
      className="cursor-pointer h-[240px]"
    >
      <Card className="p-5 hover-lift shadow-sm border-border/50 h-full flex flex-col relative">
        {project.isPublic && (
          <Badge variant="outline" className="text-[10px] h-5 flex items-center gap-1 flex-none absolute top-4 right-4 z-10 bg-background/80 backdrop-blur-sm">
            <Globe className="w-3 h-3" />
            Public
          </Badge>
        )}

        <div className="flex flex-col h-full">
          <div className="flex items-start gap-4 flex-none">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg relative overflow-hidden group/icon flex-none"
              style={{
                backgroundColor: adjustColorOpacity(project.color || DEFAULT_PROJECT_COLOR, 0.15),
                boxShadow: `0 8px 15px -4px ${adjustColorOpacity(project.color || DEFAULT_PROJECT_COLOR, 0.25)}`,
                border: `1px solid ${adjustColorOpacity(project.color || DEFAULT_PROJECT_COLOR, 0.19)}`,
                color: project.color || DEFAULT_PROJECT_COLOR
              }}
            >
              <div
                className="absolute inset-0 opacity-20 bg-gradient-to-br from-white to-transparent"
                style={{ background: `linear-gradient(135deg, ${adjustColorOpacity(project.color || DEFAULT_PROJECT_COLOR, 0.25)}, transparent)` }}
              />
              <Icon className="w-7 h-7 relative z-10 transition-transform duration-300 group-hover/icon:scale-110" />
            </div>

            <div className="flex-1 min-w-0 pt-1">
              <div className="flex items-center gap-2 mb-1.5 pr-12">
                <h3 className="font-semibold text-lg text-foreground truncate">
                  {project.name}
                </h3>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col justify-end py-2 mt-auto">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/50">
                    Progress
                  </span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-bold text-foreground">
                      {Math.round(progress)}%
                    </span>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      completed
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <Badge
                    variant="secondary"
                    className="bg-muted/40 text-muted-foreground font-bold px-2 py-0.5 rounded-md border-none"
                  >
                    {project.completedTasks || 0}/{project.totalTasks || 0} tasks
                  </Badge>
                </div>
              </div>

              <div className="relative h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="absolute inset-y-0 left-0 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.1)]"
                  style={{
                    backgroundColor: project.color,
                    boxShadow: `0 0 15px ${project.color}50`
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-border/50 flex-none">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {project.participants?.length || project.participantRoles?.length || 0} members
              </span>
            </div>

            {project.participants && project.participants.length > 0 && (
              <div className="flex -space-x-2">
                {project.participants.slice(0, 3).map((participant) => (
                  <Avatar
                    key={participant.id}
                    className="w-8 h-8 ring-2 ring-background border border-border"
                  >
                    <AvatarImage src={participant.avatar} alt={participant.name} />
                    <AvatarFallback>{participant.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                ))}
                {project.participants.length > 3 && (
                  <div className="relative z-10 w-8 h-8 rounded-full bg-muted ring-2 ring-background border border-border flex items-center justify-center">
                    <span className="text-xs font-medium text-muted-foreground">
                      +{project.participants.length - 3}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
};
