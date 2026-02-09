import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AIButtonState = 'idle' | 'loading' | 'success' | 'error';

interface AIGenerateButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    state?: AIButtonState;
}

/**
 * Compact AI Pulse Loader - Heartbeat/pulse animation styled for AI generation
 * Uses the app's purple AI accent color scheme
 */
const AIPulseLoader = () => (
    <svg
        className="w-5 h-4 mr-2"
        viewBox="0 0 64 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
    >
        {/* Background trace - subtle purple */}
        <polyline
            points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"
            fill="none"
            stroke="rgba(255, 255, 255, 0.25)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Animated front trace - bright white */}
        <polyline
            points="0.157 23.954, 14 23.954, 21.843 48, 43 0, 50 24, 64 24"
            fill="none"
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="48, 144"
            strokeDashoffset="192"
            className="animate-ai-pulse"
        />
        <style>{`
            @keyframes ai-pulse {
                72.5% { opacity: 0; }
                to { stroke-dashoffset: 0; }
            }
            .animate-ai-pulse {
                animation: ai-pulse 1.4s linear infinite;
            }
        `}</style>
    </svg>
);

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
                        icon: <AIPulseLoader />,
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
