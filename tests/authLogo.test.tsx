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
    });

    it('does not announce itself: the adjacent <h1>Momentum</h1> (Auth.tsx:81) already names the screen', () => {
        const { container } = render(<AuthLogo />);
        const imgs = container.querySelectorAll('img');
        for (const img of imgs) {
            expect(img.getAttribute('alt')).toBe('');
            expect(img.getAttribute('aria-hidden')).toBe('true');
        }
    });

    it('ships two DIFFERENT assets (dark variant is a real file, not a copy-paste slip)', async () => {
        const { readFile } = await import('node:fs/promises');
        const { createHash } = await import('node:crypto');
        // public/ is not served in jsdom; resolve from the repo root (tests run at cwd).
        const { resolve } = await import('node:path');
        const light = await readFile(resolve(__dirname, '../public/icons/icon-transparent-512.png'));
        const dark = await readFile(resolve(__dirname, '../public/icons/icon-transparent-dark-512.png'));
        const lh = createHash('sha256').update(light).digest('hex');
        const dh = createHash('sha256').update(dark).digest('hex');
        expect(lh).not.toEqual(dh);
    });
});
