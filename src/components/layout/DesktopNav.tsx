import { Home, FolderKanban, User } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { motion } from 'framer-motion';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { currentUser } from '@/lib/mockData';

const navItems = [
  { to: '/', icon: Home, label: 'Today' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export const DesktopNav = () => {
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
            
            <NavLink to="/profile" className="ml-2">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Avatar className="w-8 h-8 ring-2 ring-border">
                  <AvatarImage src={currentUser.avatar} alt={currentUser.name} />
                  <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
              </motion.div>
            </NavLink>
          </div>
        </div>
      </div>
    </motion.nav>
  );
};
