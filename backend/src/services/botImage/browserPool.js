import puppeteer from 'puppeteer';

/**
 * Shared Puppeteer Browser Pool for Telegram Bot Graphics
 * Maintains an on-demand headless browser instance with automatic idle shutdown
 * to prevent Out-Of-Memory (OOM) crashes on constrained servers.
 */

let sharedBrowser = null;
let isLaunching = false;
let launchQueue = [];
let activeRenders = 0;
let idleTimer = null;
const IDLE_TIMEOUT_MS = 30000; // Auto-close browser after 30s of inactivity

function resetIdleTimer() {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }
  idleTimer = setTimeout(async () => {
    if (activeRenders <= 0 && sharedBrowser) {
      await cleanupBrowserPool();
    }
  }, IDLE_TIMEOUT_MS);
  if (idleTimer.unref) idleTimer.unref();
}

export async function getSharedBrowser() {
  if (process.env.DISABLE_PUPPETEER === 'true') {
    throw new Error('Puppeteer headless browser is disabled via DISABLE_PUPPETEER');
  }

  if (sharedBrowser && sharedBrowser.connected) {
    return sharedBrowser;
  }

  if (isLaunching) {
    return new Promise((resolve, reject) => {
      launchQueue.push({ resolve, reject });
    });
  }

  isLaunching = true;
  try {
    sharedBrowser = await puppeteer.launch({
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--font-render-hinting=none',
        '--disable-extensions',
        '--no-zygote',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--js-flags=--max-old-space-size=128',
      ],
    });

    sharedBrowser.on('disconnected', () => {
      sharedBrowser = null;
    });

    while (launchQueue.length > 0) {
      const q = launchQueue.shift();
      q.resolve(sharedBrowser);
    }

    return sharedBrowser;
  } catch (err) {
    sharedBrowser = null;
    while (launchQueue.length > 0) {
      const q = launchQueue.shift();
      q.reject(err);
    }
    throw err;
  } finally {
    isLaunching = false;
    resetIdleTimer();
  }
}

/**
 * Render an HTML string into a PNG buffer
 * @param {string} html 
 * @param {Object} options 
 * @returns {Promise<Buffer>}
 */
export async function renderHtmlToImageBuffer(html, options = {}) {
  const {
    width = 1200,
    height = 700,
    deviceScaleFactor = 1.5,
    selector = '#bot-card',
    timeout = 10000,
  } = options;

  activeRenders++;
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  let browser;
  let page;
  try {
    browser = await getSharedBrowser();
    page = await browser.newPage();

    await page.setViewport({
      width,
      height,
      deviceScaleFactor,
    });

    await page.setContent(html, {
      waitUntil: 'networkidle0',
      timeout,
    });

    // Ensure web fonts are rendered
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    const targetHandle = (await page.$(selector)) || (await page.$('body'));
    const screenshotBuffer = await targetHandle.screenshot({
      type: 'png',
      omitBackground: true,
    });

    return Buffer.from(screenshotBuffer);
  } finally {
    if (page) {
      await page.close().catch(() => {});
    }
    activeRenders = Math.max(0, activeRenders - 1);
    resetIdleTimer();
  }
}

export const cleanupBrowserPool = async () => {
  if (sharedBrowser) {
    try {
      await sharedBrowser.close();
    } catch {}
    sharedBrowser = null;
  }
};

process.on('SIGINT', () => {
  cleanupBrowserPool().finally(() => process.exit(0));
});

process.on('SIGTERM', () => {
  cleanupBrowserPool().finally(() => process.exit(0));
});
