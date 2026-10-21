// 票 06 · 运行时取证驱动（零付费）。CDP_PORT=9333, PAGE_MATCH=about:blank / 8791
// 用法：node drive-runtime.mjs <url> <outDir>
import fs from 'node:fs';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const url = process.argv[2];
const out = process.argv[3];
const port = process.env.CDP_PORT ?? '9333';
const match = process.env.PAGE_MATCH ?? 'about:blank';

let page;
for (let i = 0; i < 60; i++) {
  try {
    const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
    page = list.find((t) => (t.type === 'page' || t.type === 'other') && String(t.url).includes(match));
    if (page) break;
  } catch {}
  await wait(250);
}
if (!page) throw new Error('no devtools page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map(); const events = []; const net = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.consoleAPICalled' || m.method === 'Runtime.exceptionThrown' || m.method === 'Log.entryAdded') {
    events.push({ t: Date.now(), method: m.method, params: m.params });
  }
  if (m.method === 'Network.responseReceived') {
    const r = m.params.response;
    net.push({ t: Date.now(), url: r.url, status: r.status, mime: r.mimeType });
  }
  if (m.method === 'Network.loadingFailed') net.push({ t: Date.now(), failed: m.params.errorText, rid: m.params.requestId });
};
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable'); await send('Page.bringToFront');
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });

const HOOK = `(() => {
  const T = { start: performance.now(), draws: [] };
  window.__animTrace = T;
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function(img, ...args) {
    try {
      const src = img && (img.currentSrc || img.src || '');
      if (String(src).indexOf('atlas.animations.png') >= 0 && args.length === 8 && T.draws.length < 60000) {
        const [sx, sy, sw, sh, dx, dy, dw, dh] = args.map((n) => Math.round(Number(n)));
        T.draws.push([Math.round(performance.now() - T.start), sx, sy, sw, sh, dx, dy, dw, dh]);
      }
    } catch (e) {}
    return orig.apply(this, arguments);
  };
  window.__hookInstalled = true;
})();`;
await send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
const injected = await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__injectedAt = performance.now();' });
void injected;

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  return r.result?.result?.value;
};
const shot = async (name, clip) => {
  const p = { format: 'png', fromSurface: true };
  if (clip) p.clip = { ...clip, scale: 1 };
  const r = await send('Page.captureScreenshot', p);
  if (!r.result?.data) { console.error('shot failed', name, JSON.stringify(r).slice(0, 300)); return; }
  fs.writeFileSync(`${out}/${name}`, Buffer.from(r.result.data, 'base64'));
  console.log('shot', name);
};
const key = (type, k, code, vk) => send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });

await send('Page.navigate', { url });
await wait(2500);
// 等待 shell 横幅出现（最多 8s）
for (let i = 0; i < 32; i++) {
  const ok = await evalJs(`(() => (window.__animTrace?.draws?.length ?? 0) > 0)()`);
  if (ok) break;
  await wait(250);
}
console.log('probe', JSON.stringify(await evalJs(`({phaser: typeof Phaser, games: (typeof Phaser!=='undefined' && Phaser.GAMES) ? Phaser.GAMES.length : null, hook: !!window.__hookInstalled, draws: window.__animTrace?.draws?.length, canvas: (()=>{const c=document.querySelector('canvas'); return c?{w:c.width,h:c.height,rect:c.getBoundingClientRect().toJSON()}:null})()})`)));

const IDLE_FULL = '01-idle-full.png';
await shot(IDLE_FULL);
// idle 帧证据：连续快速截取玩家局部（画布坐标 32..128 / 372..500）
for (let i = 0; i < 8; i++) await shot(`02-idle-player-${String(i).padStart(2, '0')}.png`, { x: 20, y: 360, width: 130, height: 150 });
// 键盘触发 run
await key('keyDown', 'ArrowRight', 'ArrowRight', 39);
await wait(700);
await shot('03-run-full.png');
await shot('03-run-player.png', { x: 20, y: 360, width: 200, height: 150 });
await key('keyUp', 'ArrowRight', 'ArrowRight', 39);
await wait(500);
// 键盘触发 jump
await key('keyDown', ' ', 'Space', 32);
await wait(100);
await key('keyUp', ' ', 'Space', 32);
await wait(120);
await shot('04-jump-full.png');
await wait(700);
await shot('05-after-landing-full.png');
// 再等 2.5s，覆盖 lunge（manifest 5 帧 @14fps = 357ms，循环与否在 trace 里看）
await wait(2500);
const trace = await evalJs(`window.__animTrace`);
fs.writeFileSync(`${out}/draw-trace.json`, JSON.stringify(trace, null, 0));
const probe2 = await evalJs(`({now: performance.now(), draws: window.__animTrace?.draws?.length, scene: (()=>{try{const g=Phaser.GAMES[0]; const s=g.scene.getScenes(true)[0]; return {key:s.scene.key, anims:Object.keys(s.anims.anims.entries).map(k=>{const a=s.anims.anims.entries[k]; return {key:a.key,frameRate:a.frameRate,repeat:a.repeat,frames:a.frames.length}}), player:s.player?{x:s.player.x,y:s.player.y,anim:s.player.anims.currentAnim?.key,frame:s.player.anims.currentFrame?.index,isPlaying:s.player.anims.isPlaying,fps:s.player.anims.currentAnim?.frameRate,repeat:s.player.anims.currentAnim?.repeat}:null};}catch(e){return {error:String(e)}}})()})`);
fs.writeFileSync(`${out}/scene-probe.json`, JSON.stringify(probe2, null, 2));
console.log('scene-probe', JSON.stringify(probe2));
fs.writeFileSync(`${out}/console-events.json`, JSON.stringify(events, null, 2));
fs.writeFileSync(`${out}/network.json`, JSON.stringify(net, null, 2));
ws.close();
console.log('done');
