const fs = require('fs');
let code = fs.readFileSync('vite.config.ts', 'utf-8');
if (!code.includes('VitePWA')) {
  code = `import { VitePWA } from 'vite-plugin-pwa';\n` + code;
  code = code.replace('plugins: [react(), tailwindcss()],', `plugins: [react(), tailwindcss(), VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: 'Henosis Web',
        short_name: 'Henosis',
        theme_color: '#ffffff',
        icons: [
          { src: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512x512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true
      }
    })],`);
  fs.writeFileSync('vite.config.ts', code);
}
