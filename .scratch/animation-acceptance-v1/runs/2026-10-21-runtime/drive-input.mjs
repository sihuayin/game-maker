// 票 06 · 键盘驱动下的动画状态采样（接在 drive-anim.mjs 之后；同一页面）
import fs from 'node:fs';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = process.argv[2];
const port = process.env.CDP_PORT ?? '9333';
const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
const page = list.find((t) => (t.type === 'page' || t.type === 'other') && String(t.url).includes('8791'));
if (!page) throw new Error('no site page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
const evalJs = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) return { __exception: r.result.exceptionDetails.text };
  return r.result?.result?.value;
};
const shot = async (name, clip) => {
  const p = { format: 'png', fromSurface: true };
  if (clip) p.clip = { ...clip, scale: 1 };
  const r = await send('Page.captureScreenshot', p);
  fs.writeFileSync(`${out}/${name}`, Buffer.from(r.result.data, 'base64'));
  console.log('shot', name);
};
const key = (type, k, code, vk) => send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
const START = (ms) => `(() => { window.__samples = []; window.__sampling = true; (async () => {
  const t0 = performance.now();
  while (performance.now() - t0 < ${ms}) {
    const s = window.__game.scene.getScenes(true)[0];
    const pick = (c) => ({ x: Math.round(c.x), y: Math.round(c.y), key: c.anims.currentAnim && c.anims.currentAnim.key, idx: c.anims.currentFrame && c.anims.currentFrame.index, frame: c.anims.currentFrame && c.anims.currentFrame.textureFrame, playing: c.anims.isPlaying, fps: c.anims.currentAnim && c.anims.currentAnim.frameRate, repeat: c.anims.currentAnim && c.anims.currentAnim.repeat });
    const snap = { t: +(performance.now() - t0).toFixed(1), player: s.player && s.player.anims.currentAnim ? pick(s.player) : null, anims: [] };
    for (const c of s.children.list) if (c.anims && c.anims.currentAnim) snap.anims.push(pick(c));
    window.__samples.push(snap);
    await new Promise((r) => setTimeout(r, 16));
  }
  window.__sampling = false;
})(); return true; })()`;
const collect = async (file) => {
  for (let i = 0; i < 200; i++) {
    if ((await evalJs('window.__sampling')) === false) break;
    await wait(50);
  }
  const s = await evalJs('window.__samples');
  fs.writeFileSync(`${out}/${file}`, JSON.stringify(s, null, 0));
  console.log(file, s.length);
};

await send('Runtime.enable'); await send('Page.enable');
console.log('on-floor', JSON.stringify(await evalJs(`(()=>{const s=window.__game.scene.getScenes(true)[0]; return {x:s.player.x,y:s.player.y,blockedDown:s.player.body.blocked.down,anim:s.player.anims.currentAnim.key};})()`)));

// run
await evalJs(START(1100));
await key('keyDown', 'ArrowRight', 'ArrowRight', 39);
await wait(420);
await shot('20-run-full.png');
await shot('20-run-player.png', { x: 0, y: 330, width: 500, height: 210 });
await wait(750);
await key('keyUp', 'ArrowRight', 'ArrowRight', 39);
await collect('samples-run.json');
await wait(700);
await shot('21-idle-again-full.png');

// jump
console.log('before-jump', JSON.stringify(await evalJs(`(()=>{const s=window.__game.scene.getScenes(true)[0]; return {y:s.player.y,blockedDown:s.player.body.blocked.down,anim:s.player.anims.currentAnim.key};})()`)));
await evalJs(START(1500));
await key('keyDown', ' ', 'Space', 32);
await wait(80);
await key('keyUp', ' ', 'Space', 32);
await wait(130);
await shot('22-jump-full.png');
await shot('22-jump-player.png', { x: 0, y: 300, width: 300, height: 240 });
await wait(220);
await shot('23-jump-later-full.png');
await collect('samples-jump.json');
await wait(1200);
await shot('24-landed-full.png');
console.log('after', JSON.stringify(await evalJs(`(()=>{const s=window.__game.scene.getScenes(true)[0]; return {y:s.player.y,blockedDown:s.player.body.blocked.down,anim:s.player.anims.currentAnim.key};})()`)));
ws.close();
console.log('done');
