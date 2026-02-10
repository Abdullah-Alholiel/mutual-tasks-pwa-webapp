// ============================================================================
// DueDateTimeDisplay - Reusable Due Date-Time Display Component
// ============================================================================
//
// Displays task due date with optional time component.
// Shows relative labels (Today, Tomorrow) and formatted time when set.
// ============================================================================

import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDueDateTimeCompact, hasTimeComponent } from '@/lib/datetime/datetimeUtils';

interface DueDateTimeDisplayProps {
    dueDate: Date;
    showTimeIfSet?: boolean;
    className?: string;
    icon?: boolean;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'muted' | 'accent';
}

/**
 * DueDateTimeDisplay - Display due date with optional time
 *
 * Display rules:
 * - Shows "Today" or "Tomorrow" with time if set
 * - Shows formatted date with time for other dates
 * - Can show/hide time based on showTimeIfSet prop
 * - Supports different sizes and color variants
 */
export const DueDateTimeDisplay = ({
    dueDate,
    showTimeIfSet = true,
    className,
    icon = true,
    size = 'sm',
    variant = 'default',
}: DueDateTimeDisplayProps) => {
    const hasTime = hasTimeComponent(dueDate);
    const displayText = formatDueDateTimeCompact(dueDate, showTimeIfSet);

    const sizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
    };

    const variantClasses = {
        default: 'text-muted-foreground',
        muted: 'text-muted-foreground/70',
        accent: 'text-primary',
    };

    return (
        <div
            className={cn(
                'flex items-center gap-1.5',
                sizeClasses[size],
                variantClasses[variant],
                className
            )}
        >
            {icon && <Clock className={cn('shrink-0', size === 'sm' ? 'w-3.5 h-3.5' : size === 'md' ? 'w-4 h-4' : 'w-5 h-5')} />}
            <span className="truncate">{displayText}</span>
        </div>
    );
};

DueDateTimeDisplay.displayName = 'DueDateTimeDisplay';
