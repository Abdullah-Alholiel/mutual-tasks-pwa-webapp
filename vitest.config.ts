import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react-swc';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        setupFiles: './tests/setup.ts',
        css: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
        },
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
            // vite-plugin-pwa's virtual module (imported by src/pwaRegister.ts)
            // has no plugin backing under vitest — map it to a test stub.
            'virtual:pwa-register': path.resolve(__dirname, './tests/lib/__mocks__/pwa-register.ts'),
        },
    },
});
