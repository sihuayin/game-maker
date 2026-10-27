// 机制化 QA probe 的**可复用 harness**（票 15）。
//
// 「与具体玩法场景无关」的浏览器机器（历史来源：旧 `playable-smoke`；2026-10-27 退役）：
//   找/启 Chrome → CDP → 注入只读状态探针 → 驱动 → 读状态 → 断言。
// `mechanic-probe.mjs` 与 playtest 自测/runner import 这里 —— 仓库里只有这一套 CDP/Chrome 机器。
//
// ⚠️ **不改站点运行时**：状态读取靠 CDP 在页面里注入一个只读探针（捕获 Phaser 实例），
//   负例里的「旧实现」也只是在**本次页面会话**里猴子补丁，站点产物本身不动。
//
// ⚠️ 与新 playtest harness 同款：依赖 Node 22（内置 fetch / WebSocket）、系统 Chrome、
//   已构建的 `packages/demo/dist`。不新增 Playwright / Puppeteer / 任何依赖。

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.dirname(HERE);
export const ROOT = path.resolve(PKG, '../..');
export const SHELL_JS = path.join(PKG, 'dist', 'shell.js');
export const DIST_JS = path.join(PKG, 'dist', 'index.js');

export const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

export const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.css': 'text/css; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

export const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

export function slimState(st) {
  if (!st) return null;
  return {
    x: st.x, y: st.y, bottom: st.bottom, top: st.top, left: st.left, right: st.right,
    vx: st.vx, vy: st.vy, onFloor: st.onFloor, blockedRight: st.blockedRight, touchingRight: st.touchingRight,
    collected: st.collected, won: st.won,
    pickups: st.pickups.map((p) => ({ x: p.x, y: p.y, active: p.active })),
    hazards: st.hazards.map((h) => ({ x: h.x, y: h.y })),
    chests: st.chests.map((c) => ({ x: c.x, y: c.y, opened: c.opened })),
    dangers: st.dangers.map((d) => ({ x: d.x, y: d.y, state: d.state, hits: d.hits })),
    gate: st.gate,
  };
}

export class StageError extends Error {
  constructor(stage, reason, extra = {}) {
    super(reason);
    this.stage = stage;
    this.extra = extra;
  }
}

export function findChrome() {
  const found = CHROME_CANDIDATES.find((p) => {
    try { return fs.statSync(p).isFile(); } catch { return false; }
  });
  if (!found) {
    throw new StageError(
      'browser',
      '找不到系统 Chrome —— 本 harness 要求「浏览器不可用 = 失败并记录」，不静默跳过。\n' +
      '  装 Chrome 或设 CHROME_BIN=/path/to/Chrome 后重跑。'
    );
  }
  return found;
}

export const CHROME_FLAGS = [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
  '--disable-backgrounding-occluded-windows',
  '--hide-scrollbars',
  '--window-size=1000,600',
];

export async function launchChrome(chrome, logFile) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-probe-'));
  const log = fs.openSync(logFile, 'a');
  const proc = spawn(chrome, [
    ...CHROME_FLAGS,
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    'about:blank',
  ], { stdio: ['ignore', log, log] });
  proc.on('error', (e) => { try { fs.writeSync(log, `spawn error: ${e}\n`); } catch {} });

  const portFile = path.join(profile, 'DevToolsActivePort');
  const t0 = Date.now();
  let port = null;
  while (Date.now() - t0 < 15000) {
    if (proc.exitCode !== null) {
      fs.closeSync(log);
      throw new Error(`Chrome 提前退出（code ${proc.exitCode}），日志：${logFile}`);
    }
    try {
      const lines = fs.readFileSync(portFile, 'utf8').trim().split('\n');
      if (lines.length >= 2 && Number(lines[0]) > 0) { port = Number(lines[0]); break; }
    } catch {}
    await delay(100);
  }
  if (!port) {
    try { proc.kill('SIGKILL'); } catch {}
    fs.closeSync(log);
    throw new Error(`15 秒内没有拿到 Chrome 的 DevTools 端口，日志：${logFile}`);
  }

  let page = null;
  const t1 = Date.now();
  while (Date.now() - t1 < 15000) {
    try {
      const list = await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json());
      page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) break;
    } catch {}
    await delay(100);
  }
  if (!page) {
    try { proc.kill('SIGKILL'); } catch {}
    fs.closeSync(log);
    throw new Error(`15 秒内没有拿到可连接的页面 target（端口 ${port}），日志：${logFile}`);
  }

  return {
    proc, profile, port, page, log,
    async close() {
      try { proc.kill('SIGTERM'); } catch {}
      const t2 = Date.now();
      while (proc.exitCode === null && Date.now() - t2 < 3000) await delay(100);
      if (proc.exitCode === null) { try { proc.kill('SIGKILL'); } catch {} }
      try { fs.closeSync(log); } catch {}
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
    },
  };
}

export function connectCdp(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let id = 0;
    const pending = new Map();
    const listeners = new Map();
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch { return; }
      if (msg.id && pending.has(msg.id)) {
        const { resolve: res, reject: rej } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) rej(new Error(`${msg.error.message} (code ${msg.error.code})`));
        else res(msg);
        return;
      }
      if (msg.method) for (const fn of listeners.get(msg.method) ?? []) fn(msg.params);
    });
    ws.addEventListener('open', () => resolve({
      ws,
      send(method, params = {}) {
        return new Promise((res, rej) => {
          const i = ++id;
          pending.set(i, { resolve: res, reject: rej });
          try { ws.send(JSON.stringify({ id: i, method, params })); }
          catch (e) { pending.delete(i); rej(e); }
        });
      },
      on(method, fn) {
        if (!listeners.has(method)) listeners.set(method, []);
        listeners.get(method).push(fn);
      },
      close() { try { ws.close(); } catch {} },
    }));
    ws.addEventListener('error', () => reject(new Error(`WebSocket 连接失败：${url}`)));
  });
}

// 只读状态探针：读的是场景上**已经存在**的字段（TS 的 private 只在编译期）。
// ⚠️ 票 15 在旧 playable-smoke 那版基础上加了 `chests` / `dangers`（含 `state` 与 `hits`）——
//   机制 probe（open-chest / avoid-danger）靠这两样读「开没开」「喷发没喷发、打中没打中」。
export const READ_STATE = `(()=>{
  const g = window.__gmGame
    ?? (window.Phaser && window.Phaser.GAMES ? window.Phaser.GAMES[window.Phaser.GAMES.length - 1] : null);
  const s = g && g.scene && g.scene.getScene ? g.scene.getScene('shell') : null;
  if (!s || !s.player || !s.player.body) return null;
  const p = s.player, b = p.body;
  const solids = (s.solids && s.solids.getChildren ? s.solids.getChildren() : []).map((c) => {
    const cb = c.body;
    return cb ? { x: cb.x, y: cb.y, w: cb.width, h: cb.height } : null;
  }).filter(Boolean);
  return {
    x: p.x, y: p.y,
    bottom: b.bottom, top: b.top, left: b.left, right: b.right,
    width: b.width, height: b.height,
    vx: b.velocity.x, vy: b.velocity.y,
    onFloor: !!b.blocked.down,
    blockedRight: !!b.blocked.right,
    touchingRight: !!b.touching.right,
    collected: s.collected,
    won: !!s.won,
    pickups: (s.pickups || []).map((q) => ({ x: q.x, y: q.y, active: !!q.active, visible: !!q.visible })),
    hazards: (s.hazards || []).map((h) => ({ x: h.sprite.x, y: h.sprite.y, axis: h.axis, distance: h.distance, periodMs: h.periodMs, t0: h.t0 })),
    chests: (s.chests || []).map((c) => ({ x: c.sprite.x, y: c.sprite.y, opened: !!c.opened })),
    dangers: (s.dangers || []).map((d) => ({ x: d.sprite.x, y: d.sprite.y, state: d.state, hits: d.hits })),
    gate: s.gate ? { x: s.gate.x, y: s.gate.y } : null,
    solids,
    scrollX: s.cameras && s.cameras.main ? s.cameras.main.scrollX : 0,
  };
})()`;

// ⚠️ 与 W6 的 play.mjs / repro-hazard.mjs 同一个捕获方式：Phaser 会把自己挂到 window 上，
//   在 setter 里把 Game 换成 Proxy，构造时把实例存进 `window.__gmGame`。不改站点代码。
export const PHASER_HOOK = `(()=>{
  let pv;
  try {
    Object.defineProperty(window, 'Phaser', {
      configurable: true,
      get() { return pv; },
      set(v) {
        pv = v;
        try {
          const O = v.Game;
          v.Game = new Proxy(O, {
            construct(t, args) {
              const inst = Reflect.construct(t, args);
              window.__gmGame = inst;
              return inst;
            },
          });
        } catch (e) { window.__gmHookError = String(e); }
      },
    });
  } catch (e) { window.__gmHookError = String(e); }
})();`;

export const INPUT_BLOCKER = `(()=>{
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
})();`;

export function makePage(cdp) {
  const consoleEntries = [];
  const exceptions = [];
  cdp.on('Runtime.consoleAPICalled', (p) => {
    const text = (p.args ?? []).map((a) => {
      if (a.value !== undefined) return String(a.value);
      if (a.description !== undefined) return String(a.description);
      if (a.unserializableValue !== undefined) return String(a.unserializableValue);
      return a.type ?? '?';
    }).join(' ');
    consoleEntries.push({ type: p.type, text });
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails ?? {};
    exceptions.push({ text: d.text, line: d.lineNumber, column: d.columnNumber, description: d.exception?.description });
  });

  const page = {
    cdp,
    consoleEntries,
    exceptions,
    clearLog() { consoleEntries.length = 0; exceptions.length = 0; },
    async send(method, params) { return cdp.send(method, params); },
    async evaluate(expression, { awaitPromise = false } = {}) {
      const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
      if (r.result?.exceptionDetails) {
        throw new Error(`页面求值失败：${r.result.exceptionDetails.text} ${r.result.exceptionDetails.exception?.description ?? ''}`.trim());
      }
      return r.result?.result?.value;
    },
    async readState() {
      try { return (await this.evaluate(READ_STATE)) ?? null; }
      catch { return null; }
    },
    async sampleFrames(n = 30) {
      const expr = `(async()=>{
        const raf = () => new Promise((res) => {
          let done = false;
          const t = setTimeout(() => { if (!done) { done = true; res(); } }, 50);
          requestAnimationFrame(() => { if (!done) { done = true; clearTimeout(t); res(); } });
        });
        const out = [];
        for (let i = 0; i < ${n}; i++) { await raf(); out.push(${READ_STATE}); }
        return out;
      })()`;
      const frames = await this.evaluate(expr, { awaitPromise: true });
      if (!Array.isArray(frames)) throw new Error('连续采样没有返回数组');
      return frames.filter(Boolean);
    },
    async key(type, key, code, vk) {
      await cdp.send('Input.dispatchKeyEvent', {
        type, key, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk,
      });
    },
    async keyDownRight() { await this.key('keyDown', 'ArrowRight', 'ArrowRight', 39); },
    async keyUpRight() { await this.key('keyUp', 'ArrowRight', 'ArrowRight', 39); },
    async jump(ctx) {
      await this.key('keyDown', ' ', 'Space', 32);
      await delay(50);
      await this.key('keyUp', ' ', 'Space', 32);
      if (ctx) { ctx.lastJumpAt = Date.now(); ctx.jumps = (ctx.jumps ?? 0) + 1; }
    },
    async shot(dir, name) {
      const r = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const data = r.result?.data;
      if (!data) return null;
      const file = path.join(dir, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
      return file;
    },
    async waitForScene(timeoutMs = 15000) {
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const st = await this.readState();
        if (st) return st;
        await delay(100);
      }
      throw new StageError(
        'boot',
        `15 秒内没有拿到场景状态（__gmGame / shell 场景未就绪）。` +
        `页面异常 ${exceptions.length} 条；控制台 ${consoleEntries.length} 条。`
      );
    },
    async waitForFloor(timeoutMs = 8000) {
      let stable = null, n = 0;
      const t0 = Date.now();
      while (Date.now() - t0 < timeoutMs) {
        const st = await this.readState();
        if (st?.onFloor) {
          if (stable !== null && Math.abs(st.bottom - stable) < 0.01) {
            n += 1;
            if (n >= 5) return st.bottom;
          } else {
            stable = st.bottom;
            n = 0;
          }
        } else {
          stable = null;
          n = 0;
        }
        await delay(50);
      }
      throw new StageError('spawn', '出生点 8 秒内没有稳定落地（读不到 onFloor / body.bottom）');
    },
    async reload({ preScripts = [] } = {}) {
      const ids = [];
      for (const source of preScripts) {
        const r = await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source });
        ids.push(r.result?.identifier);
      }
      this.clearLog();
      await cdp.send('Page.reload', { ignoreCache: true });
      try {
        return await this.waitForScene();
      } finally {
        for (const identifier of ids) {
          if (!identifier) continue;
          try { await cdp.send('Page.removeScriptToEvaluateOnNewDocument', { identifier }); } catch {}
        }
      }
    },
    consoleErrors() {
      return consoleEntries.filter((e) => e.type === 'error' && !/favicon\.ico/.test(e.text));
    },
    async writeLogs(dir) {
      writeJson(path.join(dir, 'console.json'), consoleEntries);
      writeJson(path.join(dir, 'exceptions.json'), exceptions);
    },
  };
  return page;
}

export async function startServer(root) {
  const server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
    catch { res.writeHead(400); res.end('bad request'); return; }
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end('forbidden'); return; }
    fs.stat(file, (err, st) => {
      if (!err && st.isDirectory()) {
        file = path.join(file, 'index.html');
        try { st = fs.statSync(file); } catch { st = null; }
      }
      if (err || !st || !st.isFile()) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': 'no-store',
      });
      fs.createReadStream(file).pipe(res);
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return server;
}

/**
 * 装配一个站点（包 + config → 可被浏览器加载的目录）。返回 `{ siteDir, gameRoot, summary, data }`。
 * ⚠️ 前置：`packages/demo/dist` 已构建（`pnpm build`）。config 必须是**落盘的 JSON 文件路径**。
 */
export async function assembleSiteForProbe({ packDir, configPath, outRoot, gameId = 'probe' }) {
  const { assembleSite } = await import(pathToFileURL(DIST_JS).href);
  const res = assembleSite({ packDir, configPath, shellJsPath: SHELL_JS, outRoot, gameId });
  const siteDir = path.resolve(outRoot, res.data.siteDir);
  const gameRoot = path.join(outRoot, res.data.gameId);
  return { siteDir, gameRoot, summary: res.summary, data: res.data };
}
