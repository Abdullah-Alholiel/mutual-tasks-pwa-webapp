import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { AuthLogo } from '@/features/auth/AuthLogo';

// D-046 (G1): the sign-in logo must carry NO tile/background chrome — the
// brand mark renders directly on the auth screen, with a dark-mode variant
// for readability on the dark sign-in background.
describe('AuthLogo (D-046 no-tile sign-in logo)', () => {
    it('renders the transparent brand mark with no tile chrome (no glow, shadow, sheen, plate)', () => {
        const { container } = render(<AuthLogo />);
        const wrapper = container.firstElementChild as HTMLElement;
        expect(wrapper).toBeTruthy();

        const html = wrapper.innerHTML;
        // The old tile anatomy is gone: every decorative layer must be absent.
        expect(html).not.toContain('blur-2xl'); // ambient glow blob
        expect(html).not.toContain('bg-primary/30'); // 3D-lift shadow blob
        expect(html).not.toContain('from-white/10'); // sheen gradient
        expect(html).not.toContain('rounded-[1.8rem]'); // plate corners
        expect(html).not.toContain('overflow-hidden'); // plate crop box
        expect(html).not.toContain('bg-background'); // opaque plate surface

        // No <div> layers at all — the mark is plain <img> elements.
        expect(wrapper.querySelectorAll('div')).toHaveLength(0);
    });

    it('shows the light transparent asset by default and the dark variant under .dark', () => {
        const { container } = render(<AuthLogo />);
        const imgs = container.querySelectorAll('img');
        expect(imgs).toHaveLength(2);

        const light = imgs[0];
        expect(light.getAttribute('src')).toBe('/icons/icon-transparent-512.png');
        expect(light.className).toContain('dark:hidden');

        const dark = imgs[1];
        expect(dark.getAttribute('src')).toBe('/icons/icon-transparent-dark-512.png');
        expect(dark.className).toContain('hidden');
        expect(dark.className).toContain('dark:block');
        expect(dark.getAttribute('aria-hidden')).toBe('true');
    });

    it('labels the mark for screen readers once (alt on the light image only)', () => {
        const { container } = render(<AuthLogo />);
        const imgs = container.querySelectorAll('img');
        expect(imgs[0].getAttribute('alt')).toBe('Momentum');
        // The dark twin must not announce itself: alt="" + aria-hidden.
        expect(imgs[1].getAttribute('alt')).toBe('');
        expect(imgs[1].getAttribute('aria-hidden')).toBe('true');
    });
});
