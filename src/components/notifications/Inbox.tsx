import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Notification } from '@/types';
import { Bell, CheckCircle2, Clock, Sparkles, X, Calendar, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface InboxProps {
  notifications: Notification[];
  onMarkAsRead: (notificationId: string) => void;
  onMarkAllAsRead: () => void;
  onDismiss: (notificationId: string) => void;
}

export const Inbox = ({ 
  notifications, 
  onMarkAsRead, 
  onMarkAllAsRead,
  onDismiss 
}: InboxProps) => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  
  const unreadCount = notifications.filter(n => !n.isRead).length;
  const unreadNotifications = notifications.filter(n => !n.isRead);
  const readNotifications = notifications.filter(n => n.isRead);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'task_initiated':
        return <Sparkles className="w-5 h-5 text-primary" />;
      case 'task_accepted':
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case 'task_declined':
        return <X className="w-5 h-5 text-destructive" />;
      case 'task_time_proposed':
        return <Calendar className="w-5 h-5 text-accent" />;
      case 'task_completed':
        return <CheckCircle2 className="w-5 h-5 text-success" />;
      case 'project_joined':
        return <Users className="w-5 h-5 text-primary" />;
      default:
        return <Bell className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'task_initiated':
        return 'bg-primary/10 border-primary/20';
      case 'task_accepted':
        return 'bg-success/10 border-success/20';
      case 'task_declined':
        return 'bg-destructive/10 border-destructive/20';
      case 'task_time_proposed':
        return 'bg-accent/10 border-accent/20';
      case 'task_completed':
        return 'bg-success/10 border-success/20';
      case 'project_joined':
        return 'bg-primary/10 border-primary/20';
      default:
        return 'bg-muted border-border';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    
    if (notification.taskId) {
      navigate(`/`);
      setOpen(false);
    } else if (notification.projectId) {
      navigate(`/projects/${notification.projectId}`);
      setOpen(false);
    }
  };

  return (
    <>
      <button
        className="relative p-2 rounded-lg hover:bg-muted/50 transition-colors"
        onClick={() => setOpen(true)}
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5 text-muted-foreground" />
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center"
          >
            <span className="text-xs font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          </motion.div>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5" />
                Inbox
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {unreadCount} new
                  </Badge>
                )}
              </DialogTitle>
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onMarkAllAsRead}
                >
                  Mark all as read
                </Button>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 py-4">
            {notifications.length === 0 ? (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No notifications yet</p>
              </div>
            ) : (
              <>
                {unreadNotifications.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground px-2">
                      New
                    </h3>
                    <AnimatePresence>
                      {unreadNotifications.map((notification) => (
                        <NotificationItem
                          key={notification.id}
                          notification={notification}
                          onClick={() => handleNotificationClick(notification)}
                          onDismiss={() => onDismiss(notification.id)}
                          getIcon={getNotificationIcon}
                          getColor={getNotificationColor}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                )}

                {readNotifications.length > 0 && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground px-2">
                      Earlier
                    </h3>
                    {readNotifications.map((notification) => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onClick={() => handleNotificationClick(notification)}
                        onDismiss={() => onDismiss(notification.id)}
                        getIcon={getNotificationIcon}
                        getColor={getNotificationColor}
                        isRead
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onDismiss: () => void;
  getIcon: (type: Notification['type']) => React.ReactNode;
  getColor: (type: Notification['type']) => string;
  isRead?: boolean;
}

const NotificationItem = ({
  notification,
  onClick,
  onDismiss,
  getIcon,
  getColor,
  isRead = false
}: NotificationItemProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
    >
      <Card
        className={`p-4 cursor-pointer hover:shadow-md transition-all ${
          isRead ? 'opacity-60' : ''
        } ${getColor(notification.type)}`}
        onClick={onClick}
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {getIcon(notification.type)}
          </div>
          
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${isRead ? 'text-muted-foreground' : 'font-medium'}`}>
              {notification.message}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
            </p>
          </div>

          {!isRead && (
            <div className="shrink-0 w-2 h-2 rounded-full bg-primary" />
          )}

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
};

