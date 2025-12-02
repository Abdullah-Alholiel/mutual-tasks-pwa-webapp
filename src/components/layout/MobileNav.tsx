import { Home, FolderKanban, User, Bell } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { currentUser, mockNotifications } from '@/lib/mockData';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, User as UserIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Inbox } from '@/components/notifications/Inbox';
import { useState } from 'react';
import type { Notification } from '@/types';

const navItems = [
  { to: '/', icon: Home, label: 'Today' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export const MobileNav = () => {
  const navigate = useNavigate();
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

  const handleViewProfile = () => {
    navigate('/profile');
  };

  const handleMarkAsRead = (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    toast.success('All notifications marked as read');
  };


  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
    >
      <div className="mx-4 mb-4">
        <div className="glass-strong rounded-3xl shadow-lg p-2">
          <div className="flex items-center justify-around gap-1">
            {/* Today - Far Left */}
            <NavLink
              to="/"
              end
              className="flex flex-col items-center gap-1 px-2 sm:px-3 py-3 rounded-2xl transition-all duration-200"
              activeClassName="bg-primary/10"
            >
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-1"
                >
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <Home className="w-5 h-5" />
                  </motion.div>
                  <span
                    className={`text-xs font-medium transition-colors hidden sm:block ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    Today
                  </span>
                </motion.div>
              )}
            </NavLink>

            {/* Projects */}
            <NavLink
              to="/projects"
              end
              className="flex flex-col items-center gap-1 px-2 sm:px-3 py-3 rounded-2xl transition-all duration-200"
              activeClassName="bg-primary/10"
            >
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-1"
                >
                  <motion.div
                    animate={{
                      scale: isActive ? 1.1 : 1,
                      color: isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))'
                    }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  >
                    <FolderKanban className="w-5 h-5" />
                  </motion.div>
                  <span
                    className={`text-xs font-medium transition-colors hidden sm:block ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    Projects
                  </span>
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
            <div className="flex flex-col items-center gap-1 px-2 sm:px-3 py-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <motion.div
                    whileTap={{ scale: 0.95 }}
                    className="flex flex-col items-center gap-1"
                  >
                    <Avatar className="w-6 h-6 ring-2 ring-border">
                      <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                      <AvatarFallback className="text-xs">
                        {currentUser.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </motion.div>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="center" side="top" className="mb-2">
                  <DropdownMenuItem onClick={handleViewProfile}>
                    <UserIcon className="w-4 h-4 mr-2" />
                    View Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-xs font-medium text-muted-foreground hidden sm:block">
                Profile
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};
