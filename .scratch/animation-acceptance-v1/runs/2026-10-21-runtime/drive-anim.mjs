// 票 06 · 动画运行取证（零付费）：CDP + Phaser Game 捕获 + Canvas drawImage 跟踪
// 用法：node drive-anim.mjs <url> <outDir>
import fs from 'node:fs';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const url = process.argv[2];
const out = process.argv[3];
const port = process.env.CDP_PORT ?? '9333';
const match = process.env.PAGE_MATCH ?? '8791';

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
  if (m.method === 'Runtime.consoleAPICalled' || m.method === 'Runtime.exceptionThrown' || m.method === 'Log.entryAdded')
    events.push({ t: Date.now(), method: m.method, params: m.params });
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
  let ph;
  Object.defineProperty(window, 'Phaser', {
    configurable: true,
    get() { return ph; },
    set(v) {
      ph = v;
      try {
        const proto = v && v.Game && v.Game.prototype;
        if (proto && !proto.__gmCaptured) {
          const boot = proto.boot;
          proto.boot = function (...a) { window.__game = this; return boot.apply(this, a); };
          proto.__gmCaptured = true;
        }
      } catch (e) { window.__phaserHookError = String(e); }
    }
  });
  const orig = CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage = function (img, ...args) {
    try {
      if (img && img.naturalWidth === 256 && img.naturalHeight === 760 && args.length === 8 && T.draws.length < 120000) {
        const [sx, sy, sw, sh, dx, dy, dw, dh] = args.map((n) => Math.round(Number(n)));
        T.draws.push([Math.round(performance.now() - T.start), sx, sy, sw, sh, dx, dy, dw, dh]);
      }
    } catch (e) {}
    return orig.apply(this, arguments);
  };
  window.__hookInstalled = true;
})();`;
await send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });

const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return { __exception: r.result.exceptionDetails.text };
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
const SAMPLE = (ms) => `(async () => {
  const t0 = performance.now(); const arr = [];
  while (performance.now() - t0 < ${ms}) {
    const g = window.__game; const s = g && g.scene.getScenes(true)[0];
    if (s) {
      const snap = { t: +(performance.now() - t0).toFixed(1), player: null, anims: [] };
      const pick = (c) => ({ x: c.x, y: c.y, key: c.anims.currentAnim && c.anims.currentAnim.key, idx: c.anims.currentFrame && c.anims.currentFrame.index, frame: c.anims.currentFrame && c.anims.currentFrame.textureFrame, playing: c.anims.isPlaying, fps: c.anims.currentAnim && c.anims.currentAnim.frameRate, repeat: c.anims.currentAnim && c.anims.currentAnim.repeat });
      if (s.player && s.player.anims.currentAnim) snap.player = pick(s.player);
      for (const c of s.children.list) if (c.anims && c.anims.currentAnim) snap.anims.push(pick(c));
      arr.push(snap);
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  return arr;
})()`;

await send('Page.navigate', { url });
for (let i = 0; i < 60; i++) {
  const ok = await evalJs(`!!(window.__game && window.__game.scene && window.__game.scene.getScenes(true)[0])`);
  if (ok === true) break;
  await wait(250);
}
console.log('probe', JSON.stringify(await evalJs(`({phaser: typeof Phaser, game: !!window.__game, hook: !!window.__hookInstalled, hookErr: window.__phaserHookError || null, renderer: window.__game ? (window.__game.renderer.type === 1 ? 'Canvas' : window.__game.renderer.type === 2 ? 'WebGL' : window.__game.renderer.type) : null, canvas: (()=>{const c=document.querySelector('canvas');return c?{w:c.width,h:c.height,rect:c.getBoundingClientRect().toJSON()}:null})(), scene: (()=>{const s=window.__game && window.__game.scene.getScenes(true)[0]; return s?{key:s.scene.key, children:s.children.list.length, anims:Object.keys(s.anims.anims.entries).map(k=>{const a=s.anims.anims.entries[k];return {key:a.key,frameRate:a.frameRate,repeat:a.repeat,frames:a.frames.length}})}:null})()})`)));

await wait(1500);
const idleSamples = await evalJs(SAMPLE(2600));
fs.writeFileSync(`${out}/samples-idle.json`, JSON.stringify(idleSamples, null, 0));
console.log('idle samples', idleSamples?.length);
await shot('10-idle-full.png');
for (let i = 0; i < 10; i++) await shot(`11-idle-player-${String(i).padStart(2, '0')}.png`, { x: 0, y: 360, width: 160, height: 150 });

// 直接 API 触发（同一帧内读回；下一帧 update() 会按输入切回 idle）
console.log('direct-play', JSON.stringify(await evalJs(`(()=>{const s=window.__game.scene.getScenes(true)[0]; s.player.play('run', true); return {key:s.player.anims.currentAnim&&s.player.anims.currentAnim.key, idx:s.player.anims.currentFrame&&s.player.anims.currentFrame.index, playing:s.player.anims.isPlaying};})()`)));
await wait(120);
console.log('direct-play-after-120ms', JSON.stringify(await evalJs(`(()=>{const s=window.__game.scene.getScenes(true)[0]; return {key:s.player.anims.currentAnim&&s.player.anims.currentAnim.key, idx:s.player.anims.currentFrame&&s.player.anims.currentFrame.index};})()`)));

// run：键盘合成输入 + 采样
const runPromise = send('Runtime.evaluate', { expression: SAMPLE(900), awaitPromise: false, returnByValue: true });
const runEval = await runPromise;
await key('keyDown', 'ArrowRight', 'ArrowRight', 39);
await wait(450);
await shot('12-run-full.png');
await shot('12-run-player.png', { x: 0, y: 360, width: 320, height: 150 });
await wait(550);
await key('keyUp', 'ArrowRight', 'ArrowRight', 39);
const runRes = await send('Runtime.awaitPromise', { promiseObjectId: runEval.result.result.objectId, returnByValue: true });
fs.writeFileSync(`${out}/samples-run.json`, JSON.stringify(runRes.result?.result?.value ?? null, null, 0));
console.log('run samples', runRes.result?.result?.value?.length);

await wait(500);
// jump：键盘合成输入 + 采样
const jumpPromise = send('Runtime.evaluate', { expression: SAMPLE(1400), awaitPromise: false, returnByValue: true });
const jumpEval = await jumpPromise;
await key('keyDown', ' ', 'Space', 32);
await wait(80);
await key('keyUp', ' ', 'Space', 32);
await wait(120);
await shot('13-jump-full.png');
await wait(150);
await shot('14-jump-later-full.png');
const jumpRes = await send('Runtime.awaitPromise', { promiseObjectId: jumpEval.result.result.objectId, returnByValue: true });
fs.writeFileSync(`${out}/samples-jump.json`, JSON.stringify(jumpRes.result?.result?.value ?? null, null, 0));
console.log('jump samples', jumpRes.result?.result?.value?.length);
await wait(900);
await shot('15-after-landing-full.png');

const trace = await evalJs(`window.__animTrace`);
fs.writeFileSync(`${out}/draw-trace.json`, JSON.stringify(trace, null, 0));
console.log('draw trace', trace?.draws?.length);
fs.writeFileSync(`${out}/console-events.json`, JSON.stringify(events, null, 2));
fs.writeFileSync(`${out}/network.json`, JSON.stringify(net, null, 2));
ws.close();
console.log('done');
