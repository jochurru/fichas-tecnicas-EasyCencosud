import puppeteer from 'puppeteer';

/**
 * @fileoverview Singleton para la gestión de la instancia de navegador Puppeteer.
 * Proporciona reutilización de navegador, reconexión automática ante caídas y apagado limpio.
 */

let sharedBrowser = null;
let launchPromise = null;

/**
 * Obtiene la instancia activa del navegador Puppeteer.
 * Si no existe o está desconectada, lanza una nueva instancia compartida.
 * 
 * @async
 * @returns {Promise<import('puppeteer').Browser>} Instancia activa de Puppeteer Browser
 * @throws {Error} Si Puppeteer falla al iniciar
 */
export async function getBrowser() {
  if (sharedBrowser) {
    try {
      await sharedBrowser.version();
      return sharedBrowser;
    } catch (err) {
      console.warn('[BrowserManager] Navegador compartido desconectado, reanudando...', err.message);
      try {
        await sharedBrowser.close();
      } catch (cErr) {
        // Ignorar error al cerrar instancia muerta
      }
      sharedBrowser = null;
    }
  }

  if (launchPromise) {
    return launchPromise;
  }

  launchPromise = (async () => {
    try {
      console.log('[BrowserManager] Iniciando nueva instancia de Puppeteer Chromium...');
      sharedBrowser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote'
        ]
      });

      sharedBrowser.on('disconnected', () => {
        console.warn('[BrowserManager] Evento disconnected recibido en Puppeteer.');
        sharedBrowser = null;
        launchPromise = null;
      });

      console.log('[BrowserManager] Puppeteer Chromium iniciado exitosamente.');
      return sharedBrowser;
    } catch (err) {
      console.error('[BrowserManager] Error crítico al iniciar Puppeteer:', err);
      sharedBrowser = null;
      launchPromise = null;
      throw err;
    } finally {
      launchPromise = null;
    }
  })();

  return launchPromise;
}

/**
 * Cierra la instancia compartida de Puppeteer de manera ordenada (Graceful Shutdown).
 * 
 * @async
 * @returns {Promise<void>}
 */
export async function cleanupBrowser() {
  if (sharedBrowser) {
    try {
      console.log('[BrowserManager] Cerrando instancia compartida de Puppeteer...');
      await sharedBrowser.close();
    } catch (err) {
      console.warn('[BrowserManager] Error al cerrar Puppeteer:', err.message);
    } finally {
      sharedBrowser = null;
      launchPromise = null;
    }
  }
}
