import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CompletionStatus = 'completed' | 'late' | 'pending';

interface CompletionStatusIconProps {
  status: CompletionStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6'
};

const iconSizeClasses = {
  sm: 'w-2.5 h-2.5',
  md: 'w-3 h-3',
  lg: 'w-3.5 h-3.5'
};

export const CompletionStatusIcon = ({
  status,
  size = 'md',
  className
}: CompletionStatusIconProps) => {
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center',
        sizeClasses[size],
        {
          'bg-[#10B981]': status === 'completed',
          'bg-[#FCD34D]': status === 'late',
          'bg-muted/80': status === 'pending'
        },
        className
      )}
    >
      {status !== 'pending' && (
        <Check
          className={cn(
            'text-white',
            iconSizeClasses[size]
          )}
          strokeWidth={2.5}
        />
      )}
    </div>
  );
};
