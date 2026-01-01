import React, { useMemo } from 'react';
import styles from './ai-generate-button.module.css';
import { cn } from '@/lib/utils';
import { Sparkles } from 'lucide-react';

export type AIButtonState = 'idle' | 'loading' | 'success' | 'error';

interface AIGenerateButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    state?: AIButtonState;
}

export const AIGenerateButton = React.forwardRef<HTMLButtonElement, AIGenerateButtonProps>(
    ({ className, state = 'idle', disabled, ...props }, ref) => {

        // Determine the text to display based on state
        const buttonText = useMemo(() => {
            switch (state) {
                case 'success': return 'Generated';
                case 'error': return 'Failed';
                default: return 'Generate';
            }
        }, [state]);

        const loadingText = "Generating";

        return (
            <div className={styles.btnWrapper}>
                <button
                    ref={ref}
                    className={cn(
                        styles.btn,
                        state === 'loading' && styles.loading,
                        state === 'success' && styles.success,
                        state === 'error' && styles.error,
                        className
                    )}
                    disabled={disabled || state === 'loading'}
                    type="button"
                    {...props}
                >
                    <div className={styles.btnSvg}>
                        <svg className={styles.btnSvgContent} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
                        </svg>
                    </div>

                    <div className={styles.txtWrapper}>
                        {/* Primary Text (Generate / Generated / Failed) */}
                        <div className={styles.txt1}>
                            {buttonText.split('').map((char, i) => (
                                <span key={`${char}-${i}`} className={styles.btnLetter}>
                                    {char === ' ' ? '\u00A0' : char}
                                </span>
                            ))}
                        </div>

                        {/* Loading Text (Generating) - only visible during loading */}
                        <div className={styles.txt2}>
                            {loadingText.split('').map((char, i) => (
                                <span key={`${char}-${i}`} className={styles.btnLetter}>
                                    {char}
                                </span>
                            ))}
                        </div>
                    </div>
                </button>
            </div>
        );
    }
);

AIGenerateButton.displayName = 'AIGenerateButton';
