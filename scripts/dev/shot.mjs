// Headless screenshot driver: renders the site with software WebGL in an invisible
// browser, so the 3D can be checked without opening a window.
//
//   npm run build && npm run preview &        (serves dist/ on :4173)
//   node scripts/dev/shot.mjs scripts/dev/steps-example.mjs [width] [height] [mobile]
//
// A steps file default-exports async ({ goto, run, shot, sleep, logs }) => {...}.
// run(js) evaluates an async function body in the page; shot(name) writes
// scripts/dev/shots/<name>.jpg. Software rendering is slow (a few fps), so poll
// for state (see steps-example.mjs) instead of relying on wall-clock sleeps.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [stepsFile, W = '1440', H = '860', mobile = ''] = process.argv.slice(2);
const dir = path.dirname(new URL(import.meta.url).pathname);
fs.mkdirSync(dir + '/shots', { recursive: true });
const port = 9333 + Math.floor(Math.random() * 500);
const cache = process.env.HOME + '/.cache/ms-playwright';
const bin = process.env.CHROME_BIN
  ?? (fs.existsSync(cache) ? fs.readdirSync(cache).filter((d) => d.startsWith('chromium_headless_shell')).map((d) => `${cache}/${d}/chrome-headless-shell-linux64/chrome-headless-shell`).find((p) => fs.existsSync(p)) : null)
  ?? '/usr/bin/google-chrome-stable';
const headless = bin.includes('headless') ? [] : ['--headless=new'];
const chrome = spawn(bin, [...headless, `--remote-debugging-port=${port}`, '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', `--window-size=${W},${H}`, '--hide-scrollbars', '--mute-audio', `--user-data-dir=${dir}/profile-${port}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let target;
for (let i = 0; i < 50 && !target; i++) { await sleep(200); try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {} }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } else if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) logs.push(d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' ')); else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC: ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text)); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: +W, height: +H, deviceScaleFactor: mobile ? 2 : 1, mobile: !!mobile });
if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true });
const api = {
  sleep, logs,
  goto: async (url) => { await send('Page.navigate', { url }); await sleep(800); },
  run: async (expr) => { const r = await send('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description); return r.result.result.value; },
  shot: async (name) => { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 72 }); const f = `${dir}/shots/${name}.jpg`; fs.writeFileSync(f, Buffer.from(r.result.data, 'base64')); return f; },
};
try { await (await import(path.resolve(stepsFile))).default(api); } catch (e) { console.log('STEP ERROR', e.message); }
if (logs.length) console.log('console:', [...new Set(logs)].slice(0, 8).join('\n'));
ws.close(); chrome.kill(); await sleep(200); fs.rmSync(`${dir}/profile-${port}`, { recursive: true, force: true });
