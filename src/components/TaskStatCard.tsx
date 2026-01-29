import { motion } from 'framer-motion';

interface TaskStatCardProps {
  count: number;
  label: string;
  color?: string;
  delay: number;
}

export const TaskStatCard = ({ count, label, color, delay }: TaskStatCardProps) => {
  const isRecovered = label === 'Recovered';
  const countColor = isRecovered ? 'text-status-warning' : color;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="bg-card border border-border/50 rounded-2xl p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col items-center justify-center min-h-[100px]"
    >
      <div
        className={`text-3xl md:text-4xl font-bold mb-1 ${countColor}`}
      >
        {count}
      </div>
      <div className="text-xs md:text-xs uppercase tracking-wider text-muted-foreground font-semibold text-center">
        {label}
      </div>
    </motion.div>
  );
};
