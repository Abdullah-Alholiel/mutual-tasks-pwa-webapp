// Test stub for the vite-plugin-pwa virtual module (L0, run 24).
// vitest.config.ts aliases 'virtual:pwa-register' here because the PWA plugin
// is not part of the vitest pipeline — the source module imports it at top
// level and would otherwise fail import-analysis under vitest.
import { vi } from 'vitest';

export const registerSW = vi.fn(() => Promise.resolve());
