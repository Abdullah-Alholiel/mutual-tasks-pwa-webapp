import { motion } from 'framer-motion';
import { Button } from './button';
import { AlertTriangle, FolderOpen, UserX, Home, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type ResourceType = 'project' | 'friend' | 'page';
type ResourceStatus = 'not_found' | 'access_denied' | 'deleted' | 'private_project';

interface ResourceNotFoundProps {
  type: ResourceType;
  status: ResourceStatus;
  entityName?: string;
  onBack?: () => void;
  onAction?: () => void;
  actionLabel?: string;
  className?: string;
}

const resourceConfig = {
  project: {
    not_found: {
      icon: FolderOpen,
      title: 'Project not found',
      description: "The project you're looking for doesn't exist or has been deleted.",
      actionLabel: 'Browse Projects',
      defaultBackPath: '/projects',
    },
    access_denied: {
      icon: UserX,
      title: "You can't access this project",
      description: 'You have left this project or are not a member anymore.',
      actionLabel: 'Browse Projects',
      defaultBackPath: '/projects',
    },
    private_project: {
      icon: UserX,
      title: "You can't access this project",
      description: 'This is a private project. You must be a member to view it.',
      actionLabel: 'Browse Projects',
      defaultBackPath: '/projects',
    },
    deleted: {
      icon: FolderOpen,
      title: 'Project deleted',
      description: 'This project has been permanently deleted by the owner.',
      actionLabel: 'Browse Projects',
      defaultBackPath: '/projects',
    },
  },
  friend: {
    not_found: {
      icon: UserX,
      title: 'User not found',
      description: "The user profile you're looking for doesn't exist.",
      actionLabel: 'Browse Friends',
      defaultBackPath: '/friends',
    },
  },
  page: {
    not_found: {
      icon: AlertTriangle,
      title: 'Page not found',
      description: "The page you're looking for doesn't exist or has been moved.",
      actionLabel: 'Go Home',
      defaultBackPath: '/',
    },
  },
} as const;

const ResourceNotFound = ({
  type,
  status,
  entityName,
  onBack,
  onAction,
  actionLabel: customActionLabel,
  className,
}: ResourceNotFoundProps) => {
  const config = resourceConfig[type][status];
  const Icon = config.icon;
  const displayTitle = entityName ? `${config.title}: ${entityName}` : config.title;
  const actionLabel = customActionLabel || config.actionLabel;

  return (
    <div className={cn('min-h-screen min-h-[100dvh] bg-background flex items-center justify-center p-4 md:p-6', className)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        <div className="text-center space-y-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4, ease: 'easeOut' }}
            className="mx-auto w-20 h-20 rounded-2xl bg-muted flex items-center justify-center"
          >
            <Icon className="w-10 h-10 text-muted-foreground" />
          </motion.div>

          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              {displayTitle}
            </h1>
            <p className="text-muted-foreground text-base">
              {config.description}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-4">
            {onAction && (
              <Button
                onClick={onAction}
                className="w-full sm:w-auto gradient-primary text-white flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                {actionLabel}
              </Button>
            )}
            <Button
              onClick={onBack}
              variant="outline"
              className="w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <Home className="w-4 h-4" />
              Go Back
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ResourceNotFound;
