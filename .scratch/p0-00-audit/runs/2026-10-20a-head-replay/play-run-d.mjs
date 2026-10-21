// W6 零付费试玩驱动：读 Phaser 场景状态，按状态发键，记录轨迹与截图。
import fs from 'node:fs';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const out = process.argv[2];
const port = process.env.CDP_PORT ?? '9222';
const match = process.env.PAGE_MATCH ?? '8767';
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
let id = 0; const pending = new Map();
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
const send = (method, params = {}) => new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable'); await send('Runtime.enable'); await send('Page.bringToFront');
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${out}/${name}`, Buffer.from(r.result.data, 'base64')); };
const key = (type, k, code, vk) => send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk });
const STATE = `(()=>{const s=__gmGame?.scene?.getScene('shell');if(!s||!s.player)return null;return {x:+s.player.x.toFixed(1),y:+s.player.y.toFixed(1),vx:+(s.player.body?.velocity.x??0).toFixed(1),vy:+(s.player.body?.velocity.y??0).toFixed(1),onFloor:!!s.player.body?.blocked.down,blockedRight:!!s.player.body?.blocked.right,touchingRight:!!s.player.body?.touching.right,collected:s.collected,won:!!s.won,pickups:(s.pickups||[]).map(p=>({x:+p.x.toFixed(1),y:+p.y.toFixed(1),active:!!p.active,visible:!!p.visible})),hazards:(s.hazards||[]).map(h=>({x:+h.sprite.x.toFixed(1),y:+h.sprite.y.toFixed(1),axis:h.axis,dist:h.distance,period:h.periodMs})),gate:{x:+s.gate.x.toFixed(1),y:+s.gate.y.toFixed(1)},scrollX:+s.cameras.main.scrollX.toFixed(1)};})()`;
const state = async () => {
  const r = await send('Runtime.evaluate', { expression: STATE, returnByValue: true });
  return r.result?.result?.value ?? null;
};
// 每次重放都从页面初始状态开始；注入脚本必须在本 CDP 会话里注册，reload 后才生效
const HOOK = "(()=>{let pv;Object.defineProperty(window,'Phaser',{configurable:true,get(){return pv},set(v){pv=v;try{const O=v.Game;v.Game=new Proxy(O,{construct(t,args){const inst=Reflect.construct(t,args);window.__gmGame=inst;return inst}})}catch(e){window.__gmHookError=String(e)}}})})();";
await send('Page.addScriptToEvaluateOnNewDocument', { source: HOOK });
await send('Page.reload', { ignoreCache: true });
await wait(2500);
// 等场景
let s0 = null;
for (let i = 0; i < 60 && !s0; i++) { await wait(100); s0 = await state(); }
if (!s0) throw new Error('scene not ready');
await shot('run-d-01-start.png');
const trace = [];
const t0 = Date.now();
let lastJump = 0, lastCollected = s0.collected, maxX = s0.x, resets = 0, prevX = s0.x;
let progressX = s0.x, progressAt = Date.now();
let sawGap = false, sawEnd = false;
await key('keyDown', 'ArrowRight', 'ArrowRight', 39);
const zones = [[430, 465], [688, 712]];
while (Date.now() - t0 < 45000) {
  const st = await state();
  if (!st) { await wait(60); continue; }
  trace.push({ t: Date.now() - t0, ...st });
  if (st.collected !== lastCollected) {
    lastCollected = st.collected;
    await shot(`run-d-02-collected-${st.collected}.png`);
  }
  if (st.x > maxX) maxX = st.x;
  if (st.x > progressX + 0.5) { progressX = st.x; progressAt = Date.now(); }
  if (prevX > 200 && st.x < 60) { resets++; await shot(`run-d-03-reset-${resets}.png`); }
  prevX = st.x;
  if (st.x > 290 && !sawGap) { sawGap = true; await shot('run-d-04-gap.png'); }
  if (st.x > 540 && !sawEnd) { sawEnd = true; await shot('run-d-05-end.png'); }
  if (st.won) { await shot('run-d-06-won.png'); break; }
  if (st.y > 400) { await shot('run-d-07-fell-through.png'); trace.push({ event: 'fell-through-floor', t: Date.now() - t0, ...st }); break; }
  const onFloorLevel = st.onFloor && st.y >= 240;
  const inZone = onFloorLevel && zones.some(([a, b]) => st.x >= a && st.x <= b);
  // 站在箱体 / 台阶顶上时，也要在危险物之前起跳（y<240 表示不在主地面）
  const elevatedJump = false;
  const stuck = Date.now() - progressAt > 450;
  if (st.onFloor && (inZone || elevatedJump || st.blockedRight || st.touchingRight || stuck) && Date.now() - lastJump > 480) {
    lastJump = Date.now();
    await key('keyDown', ' ', 'Space', 32);
    await wait(70);
    await key('keyUp', ' ', 'Space', 32);
  }
  await wait(35);
}
await key('keyUp', 'ArrowRight', 'ArrowRight', 39);
const final = await state();
fs.writeFileSync(`${out}/run-d-play-trace.json`, JSON.stringify({ resets, maxX, final, trace }, null, 2));
console.log(JSON.stringify({ resets, maxX, final, samples: trace.length }));
ws.close();
