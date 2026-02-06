import confetti from 'canvas-confetti';

/**
 * Trigger a high-quality multi-burst confetti effect.
 * Suitable for task completions and other "reward" moments.
 */
export const triggerRewardConfetti = () => {
    const count = 150;
    const defaults = {
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#3b82f6'],
        zIndex: 9999,
    };

    const fire = (particleRatio: number, opts: any) => {
        confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio),
        });
    };

    fire(0.25, {
        spread: 26,
        startVelocity: 55,
    });
    fire(0.2, {
        spread: 60,
    });
    fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
    });
    fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
    });
    fire(0.1, {
        spread: 120,
        startVelocity: 45,
    });
};
