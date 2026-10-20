import fs from 'node:fs';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let page;
for (let i = 0; i < 40; i++) {
  try {
    const list = await fetch('http://127.0.0.1:9222/json/list').then((r) => r.json());
    page = list.find((t) => t.type === 'page' && String(t.url).includes('8765'));
    if (page) break;
  } catch {}
  await wait(250);
}
if (!page) throw new Error('no devtools page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable'); await send('Page.bringToFront');
await wait(1800);
const out = '/Volumes/shy/some-projects/game-maker/.scratch/asset-integration-v1/runs/2026-10-20e-site/';
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(out + name, Buffer.from(r.result.data, 'base64')); };
await shot('cdp-a.png');
await wait(900);
await shot('cdp-b.png');
const key = (type, key, code, vk) => send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
await key('keyDown', 'ArrowRight', 'ArrowRight', 39);
await wait(1400);
await shot('cdp-run.png');
await key('keyDown', ' ', 'Space', 32);
await wait(120);
await key('keyUp', ' ', 'Space', 32);
await wait(220);
await shot('cdp-jump.png');
await key('keyUp', 'ArrowRight', 'ArrowRight', 39);
ws.close();
console.log('ok');
