// W6 CDP 驱动（零付费）。用法：node drive.mjs <actions.json> <outDir>
import fs from 'node:fs';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const actions = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const out = process.argv[3];
const port = process.env.CDP_PORT ?? '9222';
const match = process.env.PAGE_MATCH ?? '8766';
let page;
for (let i = 0; i < 40; i++) {
  try {
    const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
    page = list.find((t) => t.type === 'page' && String(t.url).includes(match));
    if (page) break;
  } catch {}
  await wait(250);
}
if (!page) throw new Error('no devtools page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map(); const events = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.consoleAPICalled' || m.method === 'Runtime.exceptionThrown' || m.method === 'Log.entryAdded') {
    events.push({ method: m.method, params: m.params });
  }
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Page.bringToFront');
const shot = async (name) => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(`${out}/${name}`, Buffer.from(r.result.data, 'base64'));
  console.log(`shot ${name}`);
};
const key = (type, k, code, vk) => send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
for (const a of actions) {
  if (a.op === 'wait') await wait(a.ms);
  else if (a.op === 'shot') await shot(a.name);
  else if (a.op === 'down') await key('keyDown', a.key, a.code, a.vk);
  else if (a.op === 'up') await key('keyUp', a.key, a.code, a.vk);
  else if (a.op === 'eval') {
    const r = await send('Runtime.evaluate', { expression: a.expr, returnByValue: true, awaitPromise: true });
    console.log('eval', JSON.stringify(r.result?.result?.value ?? r.result));
  } else if (a.op === 'inject') {
    const r = await send('Page.addScriptToEvaluateOnNewDocument', { source: a.source });
    console.log('inject', JSON.stringify(r.result));
  } else if (a.op === 'reload') { await send('Page.reload', { ignoreCache: true }); await wait(a.ms ?? 2500); }
}
fs.writeFileSync(`${out}/console.json`, JSON.stringify(events, null, 2));
ws.close();
console.log('done');
