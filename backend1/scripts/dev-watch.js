/**
 * Dev server watcher that waits for an in-process CV extract to finish
 * before restarting. `node --watch` kills the process immediately, which
 * drops the parsed CV before it is saved.
 */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const entry = path.join(root, 'src', 'server.js');
const watchDir = path.join(root, 'src');
const activeFile = path.join(root, 'data', '.cv-parse-active.json');

let child = null;
let restarting = false;
let waitingForParse = false;
let debounce = null;

function activeCountFor(pid) {
  if (!pid) return 0;
  try {
    const parsed = JSON.parse(fs.readFileSync(activeFile, 'utf8'));
    return Number(parsed?.jobs?.[String(pid)]) || 0;
  } catch {
    return 0;
  }
}

function start() {
  child = spawn(process.execPath, [entry], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  const started = child;
  started.on('exit', (code, signal) => {
    if (child === started) child = null;
    const wasRestart = restarting;
    restarting = false;
    if (wasRestart) {
      start();
      return;
    }
    if (signal) return;
    if (code && code !== 0) {
      console.log(`[dev] server exited (${code}). Restarting.`);
      setTimeout(start, 400);
    }
  });
}

function tryRestart() {
  debounce = null;
  if (!child) {
    waitingForParse = false;
    start();
    return;
  }
  if (activeCountFor(child.pid) > 0) {
    if (!waitingForParse) {
      waitingForParse = true;
      console.log('[dev] CV extract is still running. The server will restart after it finishes.');
    }
    debounce = setTimeout(tryRestart, 1000);
    return;
  }
  if (waitingForParse) {
    waitingForParse = false;
    console.log('[dev] CV extract finished. Restarting.');
  }
  restarting = true;
  child.kill();
}

function scheduleRestart(filename) {
  const rel = String(filename || '');
  if (!rel || rel.includes('node_modules')) return;
  clearTimeout(debounce);
  debounce = setTimeout(tryRestart, 300);
}

function watchTree(dir) {
  const onChange = (_event, filename) => scheduleRestart(filename);
  try {
    fs.watch(dir, { recursive: true }, onChange);
    return;
  } catch (err) {
    console.warn('[dev] recursive watch unavailable:', err?.message || err);
  }
  const walk = (folder) => {
    fs.watch(folder, onChange);
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        walk(path.join(folder, entry.name));
      }
    }
  };
  walk(dir);
}

watchTree(watchDir);
start();

function stop(signal) {
  if (child) child.kill(signal);
  process.exit(0);
}

process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
