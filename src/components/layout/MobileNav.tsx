import { Home, FolderKanban, User } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { motion } from 'framer-motion';

const navItems = [
  { to: '/', icon: Home, label: 'Today' },
  { to: '/projects', icon: FolderKanban, label: 'Projects' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export const MobileNav = () => {
  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
    >
      <div className="mx-4 mb-4">
        <div className="glass-strong rounded-3xl shadow-lg p-2">
          <div className="flex items-center justify-around">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className="flex flex-col items-center gap-1 px-6 py-3 rounded-2xl transition-all duration-200"
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
                      <item.icon className="w-5 h-5" />
                    </motion.div>
                    <span
                      className={`text-xs font-medium transition-colors ${
                        isActive ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {item.label}
                    </span>
                  </motion.div>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      </div>
    </motion.nav>
  );
};
