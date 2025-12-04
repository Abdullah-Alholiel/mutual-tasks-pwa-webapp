import { Home, FolderKanban, User } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { currentUser, mockNotifications } from '@/lib/mockData';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { Inbox } from '@/components/notifications/Inbox';
import { useState } from 'react';
import type { Notification } from '@/types';
import { db } from '@/lib/db';
import { handleError } from '@/lib/errorUtils';

const navItems = [
  { to: '/', icon: Home, label: 'Today' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export const DesktopNav = () => {
  const [notifications, setNotifications] = useState<Notification[]>(
    mockNotifications.filter(n => n.userId === currentUser.id)
  );

  const handleLogout = () => {
    toast.success('Logged out successfully', {
      description: 'See you soon!'
    });
    // In a real app, this would clear auth state
    // Redirect to auth page
    window.location.href = '/auth';
  };

  const handleMarkAsRead = async (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
    try {
      await db.markNotificationRead(notificationId);
    } catch (error) {
      handleError(error, 'markNotificationRead');
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = notifications.filter(n => !n.isRead).map(n => n.id);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try {
      await Promise.all(unreadIds.map(id => db.markNotificationRead(id)));
    toast.success('All notifications marked as read');
    } catch (error) {
      handleError(error, 'markAllNotificationsRead');
    }
  };


  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
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
                      <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                      <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
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
