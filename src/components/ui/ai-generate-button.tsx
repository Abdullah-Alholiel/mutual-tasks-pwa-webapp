import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AIButtonState = 'idle' | 'loading' | 'success' | 'error';

interface AIGenerateButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    state?: AIButtonState;
}

export const AIGenerateButton = React.forwardRef<HTMLButtonElement, AIGenerateButtonProps>(
    ({ className, state = 'idle', disabled, onClick, ...props }, ref) => {

        // Determine the text to display based on state
        const buttonText = useMemo(() => {
            switch (state) {
                case 'loading': return 'Generating';
                case 'success': return 'Generated';
                case 'error': return 'Failed';
                default: return 'Generate';
            }
        }, [state]);

        // State-specific styles and icons
        const getStateConfig = () => {
            switch (state) {
                case 'loading':
                    return {
                        icon: <Loader2 className="w-4 h-4 mr-2 animate-spin" />,
                        className: "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white opacity-90 cursor-not-allowed"
                    };
                case 'success':
                    return {
                        icon: <Check className="w-4 h-4 mr-2" />,
                        className: "bg-emerald-500 hover:bg-emerald-600 text-white"
                    };
                case 'error':
                    return {
                        icon: <X className="w-4 h-4 mr-2" />,
                        className: "bg-destructive hover:bg-destructive/90 text-white"
                    };
                default:
                    return {
                        icon: <Sparkles className="w-4 h-4 mr-2" />,
                        className: "bg-[#8B5CF6] hover:bg-[#7C3AED] text-white"
                    };
            }
        };

        const config = getStateConfig();

        return (
            <Button
                ref={ref}
                type="button"
                onClick={onClick}
                disabled={disabled || state === 'loading'}
                className={cn(
                    "font-medium transition-all duration-300 min-w-[7rem]",
                    config.className,
                    className
                )}
                {...props}
            >
                {config.icon}
                <span className="animate-in fade-in duration-200">
                    {buttonText}
                </span>
            </Button>
        );
    }
);

AIGenerateButton.displayName = 'AIGenerateButton';
