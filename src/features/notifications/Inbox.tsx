import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import type { Notification } from '@/types';
import { Bell, CheckCircle2, Sparkles, X, Users, RotateCcw, UserPlus, Inbox as InboxIcon, ChevronDown, Trash2 } from 'lucide-react';
import { formatDistanceToNow, isToday, isYesterday, isAfter, subDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from '@/components/ui/drawer';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InboxProps {
  notifications: Notification[];
  onMarkAsRead: (notificationId: number) => void;
  onMarkAllAsRead: () => void;
  onClearAll?: () => void;
  onDeleteList?: (ids: number[]) => void;
}

export const Inbox = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onDeleteList
}: InboxProps) => {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }

    if (notification.taskId) {
      navigate(`/`);
    } else if (notification.projectId) {
      navigate(`/projects/${notification.projectId}`);
    } else if (notification.type === 'friend_request') {
      navigate(`/friends`, { state: { openRequests: true } });
    } else if (notification.type === 'friend_accepted') {
      navigate(`/friends`);
    }
    setOpen(false);
  };

  const InboxTrigger = (
    <motion.button
      className="relative p-2 rounded-full hover:bg-muted/50 transition-colors group focus:outline-none"
      onClick={() => setOpen(true)}
      whileTap={{ scale: 0.9 }}
      aria-label="Notifications"
    >
      <motion.div
        animate={unreadCount > 0 ? { rotate: [0, -10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.5, delay: 1, repeat: unreadCount > 0 ? Infinity : 0, repeatDelay: 5 }}
      >
        <Bell className={cn(
          "w-5 h-5 transition-colors",
          unreadCount > 0 ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
        )} />
      </motion.div>

      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-destructive rounded-full border-2 border-background"
          />
        )}
      </AnimatePresence>
    </motion.button>
  );

  const InboxContent = (
    <div className="flex flex-col h-full w-full max-h-[85vh]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Inbox</h2>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="rounded-full px-2 py-0.5 text-xs">
              {unreadCount} new
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1">
          {notifications.length > 0 && onClearAll && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearAll}
              className="h-8 px-2 text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors gap-1.5"
              title="Clear all notifications"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Clear All</span>
            </Button>
          )}
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onMarkAllAsRead}
              className="h-8 w-8 text-muted-foreground hover:text-primary transition-colors"
              title="Mark all as read"
            >
              <CheckCircle2 className="w-4 h-4" />
            </Button>
          )}
          {!isMobile && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground ml-1"
              onClick={() => setOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <NotificationList
            notifications={notifications}
            onMarkAsRead={onMarkAsRead}
            onItemClick={handleNotificationClick}
            onDeleteList={onDeleteList}
          />
        </div>
      </ScrollArea>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerTrigger asChild>
          {InboxTrigger}
        </DrawerTrigger>
        <DrawerContent className="bg-background/95 backdrop-blur-xl border-t border-white/10 h-[75vh] max-h-[75vh] flex flex-col">
          <div className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted/50 mt-3" />
          <div className="flex justify-center pb-2 pt-1">
            <ChevronDown className="w-5 h-5 text-muted-foreground/50 animate-bounce" />
          </div>
          {InboxContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {InboxTrigger}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-white/10 h-[500px] flex flex-col">
        {InboxContent}
      </PopoverContent>
    </Popover>
  );
};

// --- Subcomponents ---

const NotificationList = ({
  notifications,
  onMarkAsRead,
  onItemClick,
  onDeleteList
}: {
  notifications: Notification[];
  onMarkAsRead: (id: number) => void;
  onItemClick: (n: Notification) => void;
  onDeleteList?: (ids: number[]) => void;
}) => {
  // Group notifications
  const groups = useMemo(() => {
    const unread: Notification[] = [];
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const lastWeek: Notification[] = [];
    const lastMonth: Notification[] = [];
    const older: Notification[] = [];

    const now = new Date();
    const oneWeekAgo = subDays(now, 7);
    const oneMonthAgo = subDays(now, 30);

    notifications.forEach(n => {
      if (!n.isRead) {
        unread.push(n);
        return;
      }

      const date = new Date(n.createdAt);
      if (isToday(date)) {
        today.push(n);
      } else if (isYesterday(date)) {
        yesterday.push(n);
      } else if (isAfter(date, oneWeekAgo)) {
        lastWeek.push(n);
      } else if (isAfter(date, oneMonthAgo)) {
        lastMonth.push(n);
      } else {
        older.push(n);
      }
    });

    return { unread, today, yesterday, lastWeek, lastMonth, older };
  }, [notifications]);

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12 flex flex-col items-center">
        <div className="w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
          <InboxIcon className="w-8 h-8 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground font-medium">All caught up!</p>
        <p className="text-xs text-muted-foreground/70 mt-1">No new notifications</p>
      </div>
    );
  }

  const renderGroup = (title: string, items: Notification[], isUnread = false, groupKey: string) => {
    if (items.length === 0) return null;

    return (
      <motion.div
        key={groupKey}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0 }}
        className="space-y-3"
      >
        <div className="flex items-center justify-between px-1">
          <h3 className={cn(
            "text-xs font-medium uppercase tracking-wider",
            isUnread ? "text-primary font-semibold" : "text-muted-foreground"
          )}>
            {title}
          </h3>
          {onDeleteList && !isUnread && (
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive text-muted-foreground/50 transition-colors"
              onClick={() => onDeleteList(items.map(n => n.id))}
              title={`Clear ${title}`}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
        <div className="space-y-2">
          {items.map(n => (
            <NotificationItem
              key={n.id}
              notification={n}
              onClick={() => onItemClick(n)}
              onMarkAsRead={onMarkAsRead}
              isRead={!isUnread}
            />
          ))}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      <AnimatePresence mode="popLayout">
        {renderGroup('New', groups.unread, true, 'group-unread')}
        {renderGroup('Earlier Today', groups.today, false, 'group-today')}
        {renderGroup('Yesterday', groups.yesterday, false, 'group-yesterday')}
        {renderGroup('Last Week', groups.lastWeek, false, 'group-last-week')}
        {renderGroup('Last Month', groups.lastMonth, false, 'group-last-month')}
        {renderGroup('Older', groups.older, false, 'group-older')}
      </AnimatePresence>
    </div>
  );
};

const NotificationItem = ({
  notification,
  onClick,
  onMarkAsRead,
  isRead
}: {
  notification: Notification;
  onClick: () => void;
  onMarkAsRead: (id: number) => void;
  isRead?: boolean;
}) => {
  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'task_created': return <Sparkles className="w-4 h-4 text-[#1D4ED8]" />;
      case 'task_completed': return <CheckCircle2 className="w-4 h-4 text-[#10B981]" />;
      case 'task_recovered': return <RotateCcw className="w-4 h-4 text-[#FCD34D]" />;
      case 'project_joined': return <Users className="w-4 h-4 text-primary" />;
      case 'friend_request': return <UserPlus className="w-4 h-4 text-[#8B5CF6]" />;
      case 'friend_accepted': return <Users className="w-4 h-4 text-[#10B981]" />;
      default: return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getBgColor = (type: Notification['type']) => {
    switch (type) {
      case 'task_created': return 'hover:bg-[#1D4ED8]/5';
      case 'task_completed': return 'hover:bg-[#10B981]/5';
      case 'task_recovered': return 'hover:bg-[#FCD34D]/5';
      case 'friend_request': return 'hover:bg-[#8B5CF6]/5';
      case 'friend_accepted': return 'hover:bg-[#10B981]/5';
      default: return 'hover:bg-primary/5';
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, height: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      className="relative group"
    >
      <Card
        className={cn(
          "p-3 cursor-pointer transition-all duration-200 border-transparent bg-card/40 hover:border-border/50 shadow-sm",
          isRead ? "opacity-60 bg-transparent shadow-none" : "bg-card/60 shadow-md border-border/20",
          getBgColor(notification.type)
        )}
        onClick={onClick}
      >
        <div className="flex gap-3">
          <div className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
            isRead ? "bg-muted/50" : "bg-background shadow-inner"
          )}>
            {getIcon(notification.type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex justify-between items-start gap-2">
              <p className={cn("text-sm leading-tight", !isRead && "font-medium")}>
                {notification.message}
              </p>
              {!isRead && (
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0 mt-1" />
              )}
            </div>
            <span className="text-[10px] text-muted-foreground mt-1.5 block">
              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
            </span>
          </div>
        </div>
      </Card>
    </motion.div>
  );
};