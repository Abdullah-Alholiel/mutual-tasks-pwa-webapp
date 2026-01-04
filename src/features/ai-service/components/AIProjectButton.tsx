// ============================================================================
// AI Project Button - Trigger Button for AI Project Generation Modal
// ============================================================================

import React from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

interface AIProjectButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    /** Variant for different placements */
    variant?: 'default' | 'outline' | 'ghost';
    /** Size of the button */
    size?: 'default' | 'sm' | 'lg' | 'icon';
    /** Whether to show the text label */
    showLabel?: boolean;
}

// ============================================================================
// Component
// ============================================================================

/**
 * Button to trigger the AI Project Generation modal.
 * 
 * Features a sparkles icon with a gradient effect to indicate AI functionality.
 */
export const AIProjectButton = React.forwardRef<HTMLButtonElement, AIProjectButtonProps>(
    ({ className, variant = 'outline', size = 'default', showLabel = true, ...props }, ref) => {
        return (
            <Button
                ref={ref}
                variant={variant}
                size={size}
                className={cn(
                    'group relative overflow-hidden',
                    // Gradient border effect on hover
                    'border-violet-500/30 hover:border-violet-500/60',
                    'hover:bg-violet-500/5',
                    className
                )}
                {...props}
            >
                {/* Sparkles icon with gradient */}
                <Sparkles
                    className={cn(
                        'w-4 h-4 transition-colors',
                        'text-violet-500 group-hover:text-violet-600',
                        showLabel && 'mr-2'
                    )}
                />

                {/* Label */}
                {showLabel && (
                    <span className="bg-gradient-to-r from-violet-500 to-purple-600 bg-clip-text text-transparent font-medium">
                        AI Generate
                    </span>
                )}

                {/* Subtle shimmer effect on hover */}
                <div
                    className={cn(
                        'absolute inset-0 -translate-x-full group-hover:translate-x-full',
                        'bg-gradient-to-r from-transparent via-violet-500/10 to-transparent',
                        'transition-transform duration-700'
                    )}
                />
            </Button>
        );
    }
);

AIProjectButton.displayName = 'AIProjectButton';
