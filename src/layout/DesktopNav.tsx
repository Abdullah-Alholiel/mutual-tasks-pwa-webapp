import { Home, FolderKanban, User, Users } from 'lucide-react';
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
import { toast } from '@/components/ui/sonner';
import { Inbox } from '@/features/notifications/Inbox';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useState } from 'react';
import { handleError } from '@/lib/errorUtils';
import { useAuth } from '@/features/auth/useAuth';
import { useNotifications } from '@/features/notifications/hooks/useNotifications';
import { useSmartScroll } from '@/hooks/useSmartScroll';
import { LogoutConfirmationDialog } from '@/components/LogoutConfirmationDialog';


const navItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/friends', icon: Users, label: 'Friends' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export const DesktopNav = () => {
  const { user, logout } = useAuth();

  // Use shared smart scroll hook
  // We don't need to strictly check isMobile here because CSS hides this component on mobile,
  // but it's cleaner to disable the logic if we are on mobile.
  const isMobile = window.innerWidth < 768; // Simple check or use hook if available
  const isVisible = useSmartScroll({
    safeZone: 100,
    scrollUpThreshold: 150,
    enabled: !isMobile
  });

  // Use real-time notifications hook
  const userId = user ? (typeof user.id === 'string' ? parseInt(user.id) : user.id) : null;
  const { notifications, markAsRead, markAllAsRead, deleteAll, deleteList } = useNotifications({
    userId,
    enabled: !!user,
  });

  // Logout confirmation dialog state
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  /**
   * Shows the logout confirmation dialog
   */
  const handleLogout = () => {
    setShowLogoutDialog(true);
  };

  /**
   * Performs the actual logout action after user confirms
   */
  const performLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      toast.success('Logged out successfully', {
        description: 'See you soon!'
      });
    } catch (error) {
      handleError(error, 'logout');
      toast.error('Failed to logout. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string | number) => {
    const id = typeof notificationId === 'string' ? parseInt(notificationId) : notificationId;
    await markAsRead(id);
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };


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
      className="hidden md:block fixed top-0 left-0 right-0 z-50 w-full"
    >
      <div className="flex justify-center pt-4 px-4 w-full">
        <div className="glass-strong rounded-full shadow-lg px-3 py-2 md:px-5 md:py-2.5 lg:px-8 lg:py-3 min-w-0 max-w-full transition-all duration-300 border border-white/10">
          <div className="flex items-center gap-1 md:gap-3 lg:gap-6">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className="flex items-center gap-1.5 md:gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-full transition-all duration-200 hover:bg-muted/50 whitespace-nowrap"
                activeClassName="bg-primary/10 text-primary font-semibold"
              >
                {({ isActive }) => (
                  <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="flex items-center gap-2"
                  >
                    <item.icon className="w-4 h-4 md:w-5 md:h-5" />
                    <span className="text-sm md:text-base font-medium">{item.label}</span>
                  </motion.div>
                )}
              </NavLink>
            ))}

            <div className="h-6 w-px bg-border/50 mx-1 md:mx-2" />

            <div className="flex items-center gap-1 md:gap-2">
              <Inbox
                notifications={notifications}
                onMarkAsRead={handleMarkAsRead}
                onMarkAllAsRead={handleMarkAllAsRead}
                onClearAll={deleteAll}
                onDeleteList={deleteList}
              />

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="outline-none ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full">
                    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                      <Avatar className="w-7 h-7 md:w-8 md:h-8 ring-2 ring-border/50 hover:ring-primary/50 transition-all">
                        <AvatarImage src={user?.avatar} alt={user?.name} />
                        <AvatarFallback className="text-xs bg-muted">
                          {user?.name?.charAt(0) || <div className="w-full h-full bg-muted-foreground/20 animate-pulse" />}
                        </AvatarFallback>
                      </Avatar>
                    </motion.div>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="hidden md:block h-6 w-px bg-border/50 mx-1 md:mx-2" />

              <div className="hidden md:flex items-center">
                <ThemeToggle size="compact" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Logout Confirmation Dialog */}
      <LogoutConfirmationDialog
        open={showLogoutDialog}
        onOpenChange={setShowLogoutDialog}
        onConfirm={performLogout}
        isLoading={isLoggingOut}
      />
    </motion.nav>
  );
};
