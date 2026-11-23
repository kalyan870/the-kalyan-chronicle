import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(() => {
  const base = process.env.GITHUB_PAGES === 'true' ? '/the-kalyan-chronicle/' : '/';
  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'icon.svg',
          'apple-touch-icon.png',
          'pwa-192x192.png',
          'pwa-512x512.png',
          'pwa-maskable-512x512.png',
        ],
        manifest: {
          id: base,
          name: 'The Kalyan Chronicle — Engineering Broadsheet',
          short_name: 'Chronicle',
          description:
            'Installable Android & Web broadsheet newspaper, daily project digest, and verified portfolio for Saragadam Kalyan.',
          theme_color: '#f7f3ea',
          background_color: '#f7f3ea',
          display: 'standalone',
          orientation: 'any',
          start_url: base,
          scope: base,
          categories: ['news', 'developer', 'productivity'],
          icons: [
            {
              src: `${base}pwa-192x192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: `${base}pwa-maskable-512x512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: [
            '**/*.{js,css,html,ico,svg,woff,woff2}',
            'pwa-*.png',
            'apple-touch-icon.png',
          ],
          // Keep rarely used export, editor, and reader code out of the
          // install-time precache. These chunks are fetched on demand.
          globIgnores: [
            '**/exportBroadsheetPdf-*.js',
            '**/html2canvas-*.js',
            '**/index.es-*.js',
            '**/PrintPreviewModal-*.js',
            '**/EditionArchiveModal-*.js',
            '**/DevWorkbenchModal-*.js',
            '**/ChronicleAskBar-*.js',
          ],
          navigateFallback: `${base}index.html`,
          navigateFallbackDenylist: [
            /^\/api\//,
            /^\/\.well-known\//,
            /^\/a2a\//,
            /^\/healthz\//,
            /^\/llms\.txt$/,
            /^\/feed\.json$/,
            /^\/rss\.xml$/,
            /^\/openapi\.json$/,
            /^\/robots\.txt$/,
            /^\/sitemap\.xml$/,
          ],
          runtimeCaching: [
            {
              urlPattern: /\/api\/digest(?:\?.*)?$/i,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'chronicle-latest-edition-api',
                networkTimeoutSeconds: 4,
                expiration: {
                  maxEntries: 5,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /\/assets\/.*\.(?:png|jpg|jpeg|webp|svg)$/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'chronicle-broadsheet-media',
                expiration: {
                  maxEntries: 40,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'gstatic-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(rootDir, 'dist');
          const srcAssets = path.resolve(rootDir, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(rootDir, '.'),
      },
    },
    server: {
      // Allow hosted preview domains (AI Studio Cloud Run, Vercel, Netlify, Cloudflare)
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
