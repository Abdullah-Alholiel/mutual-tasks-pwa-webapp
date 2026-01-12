import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      host: "::",
      port: 8080,
      proxy: {
        // Simulate Netlify Function locally
        '/.netlify/functions/ai-generated-description': {
          target: env.N8N_WEBHOOK_URL,
          changeOrigin: true,
          secure: false,
          rewrite: (path) => path.replace(/^\/.netlify\/functions\/ai-generated-description/, ''),
          configure: (proxy, _options) => {
            proxy.on('proxyReq', (proxyReq, _req, _res) => {
              // DEBUG: Check if env vars are loaded
              console.log('Proxying to:', env.N8N_WEBHOOK_URL);
              console.log('Injecting Secret:', env.x_momentum_secret ? '***PRESENT***' : 'MISSING');

              // Securely inject the secret header on the server side
              proxyReq.setHeader('x-momentum-secret', env.x_momentum_secret);
              proxyReq.setHeader('x_momentum_secret', env.x_momentum_secret); // Include underscore version just in case
            });
          },
        }
      }
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
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
          theme_color: '#0EA5E9',
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
