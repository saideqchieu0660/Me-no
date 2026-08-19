import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { SoundProvider } from './components/SoundProvider';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

// Handle dynamic import failures globally (Auto-reload on new production deployments)
import { ErrorBoundary } from './components/ErrorBoundary';
import { toast } from 'sonner';

// Defensive Canvas polyfill to prevent "canvas.getBoundingClientRect is not a function" crashes
try {

  if (typeof window !== "undefined") {
    // 1. Regular Canvas
    if (typeof HTMLCanvasElement !== "undefined" && !HTMLCanvasElement.prototype.getBoundingClientRect) {
      HTMLCanvasElement.prototype.getBoundingClientRect = function() {
        return { width: this.width || 0, height: this.height || 0, top: 0, left: 0, right: this.width || 0, bottom: this.height || 0, x: 0, y: 0, toJSON: () => this };
      };
    }
    
    // 2. OffscreenCanvas (frequently used by tsparticles)
    if (typeof OffscreenCanvas !== "undefined") {
      (OffscreenCanvas.prototype as any).getBoundingClientRect = (OffscreenCanvas.prototype as any).getBoundingClientRect || function(this: any) {
        return { width: this.width || 0, height: this.height || 0, top: 0, left: 0, right: this.width || 0, bottom: this.height || 0, x: 0, y: 0, toJSON: () => this };
      };
    }

    // 3. Fallback for document.createElement('canvas')
    const originalCreateElement = document.createElement;
    document.createElement = function(tagName: string, options?: ElementCreationOptions): HTMLElement {
      const el = originalCreateElement.call(document, tagName, options);
      if (tagName && tagName.toLowerCase() === 'canvas') {
        if (!el.getBoundingClientRect) {
          el.getBoundingClientRect = function() {
              return { width: (el as any).width || 0, height: (el as any).height || 0, top: 0, left: 0, right: (el as any).width || 0, bottom: (el as any).height || 0, x: 0, y: 0, toJSON: () => this };
          };
        }
      }
      return el;
    } as any;
  }
} catch (e) {
  console.warn("Failed to apply Canvas getBoundingClientRect polyfills:", e);
}

// Removed old unregister to allow PWA Service Worker offline caching

// Handle dynamic import failures globally (Auto-reload on new production deployments)
const handleChunkError = (message: string) => {
  if (
    message?.includes("Failed to fetch dynamically imported module") ||
    message?.includes("Loading chunk failed") ||
    message?.includes("Importing a module script failed") ||
    message?.includes("dynamically imported module")
  ) {
    if (!navigator.onLine) {
       console.warn("Offline: Cannot load chunk. Not reloading.");
       return;
    }
    const lastReloadTime = sessionStorage.getItem("chunk_reload_time");
    const now = Date.now();
    // Only reload once every 10 seconds to prevent infinite loops when network is genuinely down
    if (!lastReloadTime || now - parseInt(lastReloadTime, 10) > 10000) {
      sessionStorage.setItem("chunk_reload_time", now.toString());
      console.warn("Chunk load error detected, triggering hard reload to fetch new assets...");
      
      const purgePromises = [];
      if (false) {
        purgePromises.push(navigator.serviceWorker.getRegistrations().then(regs => Promise.all(regs.map(r => r.unregister()))));
      }
      if ('caches' in window) {
        purgePromises.push(caches.keys().then(names => Promise.all(names.map(name => caches.delete(name)))));
      }
      
      Promise.all(purgePromises).catch(() => {}).finally(() => {
        window.location.reload();
      });
    }
  }
};

window.addEventListener("error", (e) => {
  if (e.message) {
    handleChunkError(e.message);
  }
});

window.addEventListener("unhandledrejection", (e) => {
  if (e.reason && e.reason.message) {
    handleChunkError(e.reason.message);
  }
});

// Force Vite cache break
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <SoundProvider>
          <App />
        </SoundProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);

