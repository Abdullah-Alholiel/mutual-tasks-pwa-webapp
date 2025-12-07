import { Home, FolderKanban } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Inbox } from '@/components/notifications/Inbox';
import { useState } from 'react';
import type { Notification } from '@/types';
import { getDatabaseClient } from '@/db';
import { useAuth } from '@/hooks/useAuth';
import { handleError } from '@/lib/errorUtils';
import { toast } from 'sonner';
export const MobileNav = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);  
  const handleMarkAsRead = async (notificationId: number) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    try {
      const db = getDatabaseClient();
      await db.notifications.markAsRead(notificationId);
    } catch (error) {
      handleError(error, 'markNotificationRead');
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      const db = getDatabaseClient();
      if (user) {
        const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
        await db.notifications.markAllAsRead(userId);
        toast.success('All notifications marked as read');
      }
    } catch (error) {
      handleError(error, 'markAllNotificationsRead');
    }
  };

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-background border-t border-border"
    >
      <div className="glass-strong p-2">
        <div className="flex items-center justify-around gap-1">
            {/* Today - Far Left */}
            <NavLink
              to="/"
              end
              className="flex flex-col items-center gap-1 px-2 sm:px-3 py-3 rounded-2xl transition-all duration-300"
              activeClassName="bg-primary/10"
            >
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-1 relative"
                  layout
                >
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
                    }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 400, 
                      damping: 25,
                      duration: 0.3
                    }}
                  >
                    <Home className="w-5 h-5" />
                  </motion.div>
                  <motion.span
                    className="text-xs hidden sm:block"
                    animate={{
                      color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                      fontWeight: isActive ? 700 : 500
                    }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 400, 
                      damping: 25,
                      duration: 0.3
                    }}
                  >
                    Today
                  </motion.span>
                </motion.div>
              )}
            </NavLink>

            {/* Projects */}
            <NavLink
              to="/projects"
              end
              className="flex flex-col items-center gap-1 px-2 sm:px-3 py-3 rounded-2xl transition-all duration-300"
              activeClassName="bg-primary/10"
            >
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-1 relative"
                  layout
                >
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
                    }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 400, 
                      damping: 25,
                      duration: 0.3
                    }}
                  >
                    <FolderKanban className="w-5 h-5" />
                  </motion.div>
                  <motion.span
                    className="text-xs hidden sm:block"
                    animate={{
                      color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                      fontWeight: isActive ? 700 : 500
                    }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 400, 
                      damping: 25,
                      duration: 0.3
                    }}
                  >
                    Projects
                  </motion.span>
                </motion.div>
              )}
            </NavLink>
            
            {/* Inbox - Left of Profile */}
            <div className="flex flex-col items-center gap-1 px-2 sm:px-3 py-3">
              <div className="relative">
                <Inbox
                  notifications={notifications}
                  onMarkAsRead={handleMarkAsRead}
                  onMarkAllAsRead={handleMarkAllAsRead}
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground hidden sm:block">
                Inbox
              </span>
            </div>

            {/* Profile Button - Far Right */}
            <NavLink
              to="/profile"
              end
              className="flex flex-col items-center gap-1 px-2 sm:px-3 py-3 rounded-2xl transition-all duration-300"
              activeClassName="bg-primary/10"
            >
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-1 relative"
                  layout
                >
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1
                    }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 400, 
                      damping: 25,
                      duration: 0.3
                    }}
                  >
                    <Avatar 
                      className={`w-6 h-6 ring-2 transition-all duration-300 ${
                        isActive 
                          ? 'ring-primary' 
                          : 'ring-border'
                      }`}
                    >
                      <AvatarImage src={user?.avatar} alt={user?.name} />
                      <AvatarFallback className="text-xs">
                        {user?.name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                  <motion.span 
                    className="text-xs hidden sm:block"
                    animate={{
                      color: isActive 
                        ? 'hsl(var(--primary))' 
                        : 'hsl(var(--muted-foreground))',
                      fontWeight: isActive ? 700 : 500
                    }}
                    transition={{ 
                      type: 'spring', 
                      stiffness: 400, 
                      damping: 25,
                      duration: 0.3
                    }}
                  >
                    Profile
                  </motion.span>
                </motion.div>
              )}
            </NavLink>
        </div>
      </div>
    </nav>
  );
};
