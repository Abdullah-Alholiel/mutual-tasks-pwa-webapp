import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';
import visualizer from 'rollup-plugin-visualizer';
import { sentryVitePlugin } from "@sentry/vite-plugin";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const isProduction = mode === 'production';
  const isAnalyze = mode === 'analyze';

  return {
    envPrefix: ["VITE_", "ONESIGNAL_"],
    server: {
      host: "::",
      port: 8080,
      proxy: {
        // Proxy to local Netlify functions server (run with: netlify functions:serve --port 9999)
        '/.netlify/functions': {
          target: 'http://localhost:9999',
          changeOrigin: true,
          secure: false,
        }
      }
    },
    build: {
      target: 'esnext',
      minify: 'terser',
      sourcemap: isProduction ? 'hidden' : true,
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // React Core
            if (id.includes('react') && id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('react-router-dom')) {
              return 'router-vendor';
            }

            // Supabase
            if (id.includes('@supabase/supabase-js')) {
              return 'supabase-vendor';
            }

            // React Query
            if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query-sync-storage-persister') || id.includes('@tanstack/react-query-persist-client')) {
              return 'query-vendor';
            }

            // UI Components (Radix UI)
            if (id.includes('@radix-ui')) {
              return 'ui-vendor';
            }

            // Charts
            if (id.includes('recharts')) {
              return 'charts-vendor';
            }

            // Animations
            if (id.includes('framer-motion')) {
              return 'animations-vendor';
            }

            // Utilities
            if (id.includes('date-fns')) {
              return 'utils-vendor';
            }
            if (id.includes('zod')) {
              return 'validation-vendor';
            }
            if (id.includes('clsx') || id.includes('tailwind-merge') || id.includes('class-variance-authority')) {
              return 'tailwind-vendor';
            }
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      terserOptions: {
        compress: {
          drop_console: isProduction,
          drop_debugger: isProduction,
          pure_funcs: isProduction ? ['console.log', 'console.info', 'console.debug'] : [],
        },
      },
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        '@tanstack/react-query',
        '@supabase/supabase-js',
        'date-fns',
      ],
      exclude: ['vite-plugin-pwa'],
    },
    plugins: [
      sentryVitePlugin({
        authToken: process.env.SENTRY_AUTH_TOKEN,
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        telemetry: false,
      }),
      react(),
      mode === "development" && componentTagger(),
      isAnalyze && (visualizer as any)({
        open: true,
        gzipSize: true,
        brotliSize: true,
        filename: 'dist/bundle-analysis.html',
      }),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/icon-48x48.png', 'icons/icon-192x192.png', 'masked-icon.svg'],
        // Service worker only generated during production build, not dev
        devOptions: {
          enabled: false
        },
        manifest: {
          name: 'Momentum - Collaborative Tasks',
          short_name: 'Momentum',
          description: 'Collaborative habit and task tracking with friends',
          theme_color: '#F8FAFC',
          background_color: '#F7F9FC',
          display: 'standalone',
          orientation: 'portrait-primary',
          icons: [
            {
              src: '/icons/icon-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: '/icons/icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ],
          categories: ['productivity', 'social'],
          screenshots: [
            {
              src: '/screenshot-mobile.png',
              sizes: '390x844',
              type: 'image/png',
              form_factor: 'narrow'
            }
          ]
        },
        workbox: {
          skipWaiting: true,
          clientsClaim: true,
          navigateFallback: 'index.html',
          globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
          // Exclude OneSignal service worker files from workbox precaching
          globIgnores: ['**/OneSignalSDK*.js'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
