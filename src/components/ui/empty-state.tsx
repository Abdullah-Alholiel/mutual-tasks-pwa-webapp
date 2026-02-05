import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, LucideIcon } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
    icon?: LucideIcon;
    title: string;
    description: string;
    action?: {
        label: string;
        onClick: () => void;
        icon?: ReactNode;
    };
    className?: string;
}

export const EmptyState = ({
    icon: Icon = Sparkles,
    title,
    description,
    action,
    className,
}: EmptyStateProps) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className={cn(
                "flex flex-col items-center justify-center py-16 px-4 text-center space-y-6 max-w-md mx-auto",
                className
            )}
        >
            <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{
                    delay: 0.2,
                    duration: 0.8,
                    type: "spring",
                    stiffness: 200,
                    damping: 20
                }}
                className="relative"
            >
                {/* Decorative background glow */}
                <div className="absolute inset-0 bg-primary/10 blur-3xl rounded-full scale-150 animate-pulse" />

                <div className="relative bg-gradient-to-br from-primary/10 to-accent/10 p-6 rounded-3xl ring-1 ring-primary/20 backdrop-blur-sm shadow-inner">
                    <Icon className="w-12 h-12 text-primary/70 animate-float" />
                </div>
            </motion.div>

            <div className="space-y-2">
                <motion.h3
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-2xl font-bold tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent"
                >
                    {title}
                </motion.h3>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                    className="text-muted-foreground text-balanced leading-relaxed"
                >
                    {description}
                </motion.p>
            </div>

            {action && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                >
                    <Button
                        onClick={action.onClick}
                        size="lg"
                        className="rounded-full px-8 shadow-lg hover:shadow-primary/25 transition-all duration-300 hover:scale-105 active:scale-95 group"
                    >
                        {action.icon && (
                            <span className="mr-2 group-hover:rotate-12 transition-transform duration-300">
                                {action.icon}
                            </span>
                        )}
                        {action.label}
                    </Button>
                </motion.div>
            )}
        </motion.div>
    );
};
