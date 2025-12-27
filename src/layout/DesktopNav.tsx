import { Home, FolderKanban, User } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Inbox } from '@/features/notifications/Inbox';
import { useState, useEffect, useRef } from 'react';
import type { Notification } from '@/types';
import { getDatabaseClient } from '@/db';
import { handleError } from '@/lib/errorUtils';
import { useAuth } from '@/features/auth/useAuth';


const navItems = [
  { to: '/', icon: Home, label: 'Today' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export const DesktopNav = () => {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollThreshold = 10; // Minimum scroll distance to trigger hide/show

  // Load notifications from database when user is available
  useEffect(() => {
    const loadNotifications = async () => {
      if (!user) return;

      try {
        const db = getDatabaseClient();
        const userId = typeof user.id === 'string' ? parseInt(user.id) : user.id;
        const userNotifications = await db.notifications.getByUserId(userId, {
          limit: 50,
          isRead: undefined, // Get both read and unread
        });
        setNotifications(userNotifications);
      } catch (error) {
        handleError(error, 'loadNotifications');
      }
    };

    loadNotifications();
  }, [user]);

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully', {
        description: 'See you soon!'
      });
    } catch (error) {
      handleError(error, 'logout');
      toast.error('Failed to logout. Please try again.');
    }
  };

  const handleMarkAsRead = async (notificationId: string | number) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    try {
      const db = getDatabaseClient();
      const id = typeof notificationId === 'string' ? parseInt(notificationId) : notificationId;
      await db.notifications.markAsRead(id);
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

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Only apply on desktop (md breakpoint and above)
      if (window.innerWidth < 768) {
        setIsVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      // Show nav when at the top
      if (currentScrollY < scrollThreshold) {
        setIsVisible(true);
        lastScrollY.current = currentScrollY;
        return;
      }

      // Determine scroll direction
      const scrollingDown = currentScrollY > lastScrollY.current;
      const scrollDifference = Math.abs(currentScrollY - lastScrollY.current);

      // Only update if scroll difference is significant enough
      if (scrollDifference > scrollThreshold) {
        setIsVisible(!scrollingDown);
        lastScrollY.current = currentScrollY;
      }
    };

    // Throttle scroll events for better performance
    let ticking = false;
    const throttledHandleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', throttledHandleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', throttledHandleScroll);
    };
  }, []);


  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{
        y: isVisible ? 0 : -100,
        opacity: isVisible ? 1 : 0,
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
      transition={{
        duration: 0.2,
        ease: 'easeInOut'
      }}
      className="hidden md:block fixed top-0 left-0 right-0 z-50"
    >
      <div className="flex justify-center pt-4">
        <div className="glass-strong rounded-3xl shadow-lg px-6 py-3">
          <div className="flex items-center gap-8">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className="flex items-center gap-2 px-4 py-2 rounded-2xl transition-all duration-200 hover:bg-muted/50"
                activeClassName="bg-primary/10 text-primary"
              >
                {({ isActive }) => (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2"
                  >
                    <item.icon className="w-5 h-5" />
                    <span className="font-medium">{item.label}</span>
                  </motion.div>
                )}
              </NavLink>
            ))}

            <div className="h-8 w-px bg-border ml-2" />

            <Inbox
              notifications={notifications}
              onMarkAsRead={handleMarkAsRead}
              onMarkAllAsRead={handleMarkAllAsRead}
            />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-2">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Avatar className="w-8 h-8 ring-2 ring-border hover:ring-primary transition-all">
                      <AvatarImage src={user?.avatar} alt={user?.name} />
                      <AvatarFallback className="text-xs bg-muted">
                        {user?.name?.charAt(0) || <div className="w-4 h-4 bg-muted-foreground/20 rounded-full animate-pulse" />}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};
