const puppeteer = require('puppeteer');

const DEFAULT_CHROME_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  process.env.CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);

async function launchBrowser(options = {}) {
  const baseArgs = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'];
  const args = options.args ? [...baseArgs, ...options.args] : baseArgs;

  let lastError;
  for (const executablePath of DEFAULT_CHROME_PATHS) {
    try {
      return await puppeteer.launch({
        headless: options.headless ?? 'new',
        executablePath,
        args,
      });
    } catch (err) {
      lastError = err;
    }
  }

  try {
    return await puppeteer.launch({
      headless: options.headless ?? 'new',
      args,
    });
  } catch (err) {
    throw lastError || err;
  }
}

module.exports = { launchBrowser };
