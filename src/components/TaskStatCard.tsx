import { motion } from 'framer-motion';

interface TaskStatCardProps {
  count: number;
  label: string;
  color?: string;
  delay: number;
  onClick?: () => void;
  isActive?: boolean;
}

export const TaskStatCard = ({ count, label, color, delay, onClick, isActive }: TaskStatCardProps) => {
  return (
    <motion.div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={isActive}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      transition={{
        opacity: { delay, duration: 0.3 },
        y: { delay, duration: 0.3 },
      }}
      className={[
        'flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-all duration-200',
        isActive
          ? 'bg-primary/10 ring-1 ring-primary/40 shadow-sm'
          : 'bg-muted/50 hover:bg-muted/80',
        onClick ? 'cursor-pointer select-none active:scale-95' : ''
      ].join(' ')}
    >
      <span className={`text-base font-bold leading-none tabular-nums ${color}`}>
        {count}
      </span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold leading-none">
        {label}
      </span>
    </motion.div>
  );
};
