import { Home, FolderKanban, Users } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/features/auth/useAuth';
import { useLocation } from 'react-router-dom';

export const MobileNav = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Check active state for each route

  // Check active state for each route
  const isActiveRoute = (path: string) => location.pathname === path;

  // Common tab styles
  const tabBaseStyles = "flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300";

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 w-full px-4 flex justify-center items-end bg-gradient-to-t from-background/90 via-background/50 to-transparent pointer-events-none"
      style={{
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
        height: 'calc(80px + env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* Pill-shaped container - full width */}
      <div className="w-full bg-background/70 backdrop-blur-2xl border border-border/40 shadow-xl rounded-full px-4 py-2 flex items-center justify-around ring-1 ring-white/10 dark:ring-black/10 pointer-events-auto">

        {/* Today */}
        <NavLink
          to="/"
          end
          className="flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 hover:bg-muted/50"
          activeClassName="bg-primary/20"
        >
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.9 }}
              animate={{ scale: isActive ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex items-center justify-center"
            >
              <Home
                className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
            </motion.div>
          )}
        </NavLink>

        {/* Projects */}
        <NavLink
          to="/projects"
          end
          className="flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 hover:bg-muted/50"
          activeClassName="bg-primary/20"
        >
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.9 }}
              animate={{ scale: isActive ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex items-center justify-center"
            >
              <FolderKanban
                className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
            </motion.div>
          )}
        </NavLink>

        {/* Friends */}
        <NavLink
          to="/friends"
          end
          className="flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 hover:bg-muted/50"
          activeClassName="bg-primary/20"
        >
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.9 }}
              animate={{ scale: isActive ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex items-center justify-center"
            >
              <Users
                className={`w-5 h-5 transition-colors duration-300 ${isActive ? 'text-primary' : 'text-muted-foreground'
                  }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
            </motion.div>
          )}
        </NavLink>



        {/* Profile */}
        <NavLink
          to="/profile"
          end
          className="flex items-center justify-center w-12 h-12 rounded-full transition-all duration-300 hover:bg-muted/50"
          activeClassName="bg-primary/20"
        >
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.9 }}
              animate={{ scale: isActive ? 1.1 : 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="flex items-center justify-center"
            >
              <Avatar
                className={`w-7 h-7 ring-2 transition-all duration-300 ${isActive ? 'ring-primary' : 'ring-border'
                  }`}
              >
                <AvatarImage src={user?.avatar} alt={user?.name} />
                <AvatarFallback className="text-xs bg-muted">
                  {user?.name?.charAt(0) || <div className="w-3 h-3 bg-muted-foreground/20 rounded-full animate-pulse" />}
                </AvatarFallback>
              </Avatar>
            </motion.div>
          )}
        </NavLink>
      </div>
    </nav>
  );
};
