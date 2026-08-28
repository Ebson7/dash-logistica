/**
 * Registers the Service Worker for PWA Offline Caching & Background Notifications
 */
export function registerServiceWorker(): void {
  if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          // Check for SW updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.info('Marsil Log PWA: Nova versão disponível em segundo plano.');
                }
              };
            }
          };
        })
        .catch((error) => {
          // In some restricted iframe environments or file:// protocols, SW registration may fail gracefully
          console.warn('Marsil Log PWA: Service Worker registration bypassed:', error);
        });
    });
  }
}
