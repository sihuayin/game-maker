#!/usr/bin/env node
/**
 * P0-03 · 可玩性 headless smoke（票 10）
 *
 * 它回答 `pnpm test` 回答不了的那个问题：**站点真的能启动、能操作、能拾取、能胜利吗**。
 * 默认 `pnpm test` 仍然零浏览器依赖；这一条是**独立**命令（map Q8 A）：
 *
 *   pnpm test:playable                  # 正例 + 软锁专项 + 软锁旧实现负例
 *   pnpm test:playable --negative gate     # 负例：gate 指错（装配期拒绝）
 *   pnpm test:playable --negative pickup   # 负例：运行时拿掉一个 pickup（到 gate 不 won）
 *   pnpm test:playable --negative input    # 负例：破坏输入（走不动）
 *
 * 依赖：Node 22（内置 fetch / WebSocket）、系统 Chrome、已构建的 `packages/demo/dist`。
 * **不新增 Playwright / Puppeteer / 任何依赖**；浏览器不可用时**失败并记录**，不跳过。
 *
 * 输入（可用环境变量或参数覆盖）：
 *   PLAYABLE_PACK / --pack     默认 = 已验收的 v7 包（.scratch/asset-integration-v1/.../pack/v7）
 *   PLAYABLE_CONFIG / --config 默认 = 与该包配套的已验收 config（.scratch/.../game-config.json）
 *   PLAYABLE_OUT / --out       默认 = .scratch/p0-construction-v1/runs/<今天>-ticket-10
 *
 * 证据：每次运行写 `<out>/<scenario>/result.json`（含轨迹）、截图与 `chrome.log`；
 * 汇总写 `<out>/summary-<mode>.json`。测试产物只落 `.scratch/p0-construction-v1/runs/` 或 `out/`。
 *
 * ⚠️ **不改站点运行时**：状态读取靠 CDP 在页面里注入一个只读探针（捕获 Phaser 实例），
 *   负例里的「旧实现」也只是在**本次页面会话**里猴子补丁 `hitHazard`，站点产物本身不动。
 *
 * ⚠️ **时序**：不做固定 sleep 的玩法编排。所有跳跃 / 前进都由**读到的状态**决定
 *   （x / y / body.bottom / onFloor / blockedRight / collected / pickups / hazards / solids），
 *   只有 CDP 轮询间隔与按键保持时长是固定的小常数。
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.dirname(HERE);
const ROOT = path.resolve(PKG, '../..');
const SHELL_JS = path.join(PKG, 'dist', 'shell.js');
const DIST_JS = path.join(PKG, 'dist', 'index.js');

/** 已验收的最终包 + 手写 config（票 10 要求优先 v7 + 已验收 config）。 */
const DEFAULT_PACK = path.join(ROOT, '.scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7');
const DEFAULT_CONFIG = path.join(ROOT, '.scratch/asset-integration-v1/runs/2026-10-20e-site/game-config.json');

const TODAY = new Date().toISOString().slice(0, 10);
const DEFAULT_OUT = path.join(ROOT, '.scratch/p0-construction-v1/runs', `${TODAY}-ticket-10`);

const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);

const MIME = {
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

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 参数 ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
    out[key] = val;
  }
  return out;
}

const ARGS = parseArgs(process.argv.slice(2));
const MODE = typeof ARGS.negative === 'string' ? ARGS.negative : 'positive';
if (!['positive', 'gate', 'pickup', 'input'].includes(MODE)) {
  console.error(`不认识的 --negative ${JSON.stringify(MODE)}（认得的：gate|pickup|input）`);
  process.exit(2);
}
const PACK = path.resolve(ARGS.pack ?? process.env.PLAYABLE_PACK ?? DEFAULT_PACK);
const CONFIG = path.resolve(ARGS.config ?? process.env.PLAYABLE_CONFIG ?? DEFAULT_CONFIG);
const OUT = path.resolve(ARGS.out ?? process.env.PLAYABLE_OUT ?? DEFAULT_OUT);
const ONLY = typeof ARGS.scenario === 'string' ? ARGS.scenario : null;
const PLAY_MS = Number(ARGS.timeout ?? process.env.PLAYABLE_TIMEOUT ?? 45000);
const RESET_MS = Number(ARGS.resetTimeout ?? process.env.PLAYABLE_RESET_TIMEOUT ?? 30000);

// ── 通用小工具 ──────────────────────────────────────────────────────────────

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

function slimState(st) {
  if (!st) return null;
  return {
    x: st.x, y: st.y, bottom: st.bottom, top: st.top, left: st.left, right: st.right,
    vx: st.vx, vy: st.vy, onFloor: st.onFloor, blockedRight: st.blockedRight, touchingRight: st.touchingRight,
    collected: st.collected, won: st.won,
    pickups: st.pickups.map((p) => ({ x: p.x, y: p.y, active: p.active })),
    hazards: st.hazards.map((h) => ({ x: h.x, y: h.y })),
    gate: st.gate,
  };
}

class StageError extends Error {
  constructor(stage, reason, extra = {}) {
    super(reason);
    this.stage = stage;
    this.extra = extra;
  }
}

/** 环境级失败也要**落盘**（票面：浏览器不可用 = 失败并记录，不静默跳过成绿）。 */
function failRun(stage, message) {
  try {
    writeJson(path.join(OUT, `summary-${MODE}.json`), {
      startedAt: new Date().toISOString(), mode: MODE, ok: false, stage, reason: message,
      pack: PACK, config: CONFIG, out: OUT,
    });
  } catch {}
  console.error(`❌ ${message}`);
  process.exit(2);
}

// ── Chrome ──────────────────────────────────────────────────────────────────

function findChrome() {
  const found = CHROME_CANDIDATES.find((p) => {
    try { return fs.statSync(p).isFile(); } catch { return false; }
  });
  if (!found) {
    failRun(
      'browser',
      '找不到系统 Chrome —— 本票要求「浏览器不可用 = 失败并记录」，不静默跳过。\n' +
      '  装 Chrome 或设 CHROME_BIN=/path/to/Chrome 后重跑。'
    );
  }
  return found;
}

async function launchChrome(chrome, logFile) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'gm-playable-'));
  const log = fs.openSync(logFile, 'a');
  const proc = spawn(chrome, [
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

// ── CDP ─────────────────────────────────────────────────────────────────────

function connectCdp(url) {
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
const READ_STATE = `(()=>{
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
    hazards: (s.hazards || []).map((h) => ({ x: h.sprite.x, y: h.sprite.y, axis: h.axis, distance: h.distance, periodMs: h.periodMs })),
    gate: s.gate ? { x: s.gate.x, y: s.gate.y } : null,
    solids,
    scrollX: s.cameras && s.cameras.main ? s.cameras.main.scrollX : 0,
  };
})()`;

// ⚠️ 与 W6 的 play.mjs / repro-hazard.mjs 同一个捕获方式：Phaser 会把自己挂到 window 上，
//   在 setter 里把 Game 换成 Proxy，构造时把实例存进 `window.__gmGame`。不改站点代码。
const PHASER_HOOK = `(()=>{
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

const INPUT_BLOCKER = `(()=>{
  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
})();`;

function makePage(cdp) {
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

// ── 静态服务 ────────────────────────────────────────────────────────────────

async function startServer(root) {
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

// ── 状态感知的玩法策略 ──────────────────────────────────────────────────────

/**
 * 正例策略：向右走，按状态决定跳。
 * - 面前有**可攀爬的抬高实体**（顶面比脚底高 10–90 px）时，先走到被挡住再跳；
 * - 站在抬高面上时，只在**脚下平台到头**时跳（不在平台上为躲 hazard 提前跳）；
 * - 否则：被挡 / 脚下没地 / 前方有 hazard / 前方高处有 pickup / 原地卡住 ⇒ 跳。
 * ⚠️ 没有固定 x 坐标，也没有固定时序；全部来自读到的 solids / hazards / pickups / body。
 */
function shouldJump(st, ctx) {
  if (!st.onFloor) return false;
  if (Date.now() - ctx.lastJumpAt < 240) return false;
  const onRaised = st.bottom < ctx.floorY - 10;
  const blocked = st.blockedRight || st.touchingRight;
  const climbable = !onRaised && st.solids.some((s) =>
    s.x > st.x && s.x - st.x < 80 && s.y < st.bottom - 10 && s.y > st.bottom - 90,
  );
  if (climbable) return blocked || ctx.stuck;

  if (onRaised) {
    // ⚠️ 站在抬高面上时，`right + 18` 的探针会**过早**判定「平台到头」：
    //   玩家 body 宽 48，木箱也才 48 ⇒ 刚踩上箱顶探针就伸到箱外，于是提前起跳、
    //   落弧正好砸进箱右侧的 hazard（实测连撞 10 次）。这里改用**玩家中心**对平台右缘。
    // ⚠️ 用 **body 的水平重叠**判「脚下是谁」，不是玩家中心：玩家 body 宽 48、木箱也宽 48，
    //   中心刚过箱缘时身体还有一半踩在上面（onFloor 仍为真），用中心会漏掉这块支撑面，
    //   于是继续往前走、直到撞上箱右侧的 hazard（票 10 实测：连撞 10 次）。
    const under = st.solids
      .filter((s) => Math.abs(s.y - st.bottom) <= 2 && s.x < st.right && s.x + s.w > st.left)
      .sort((a, b) => (a.x + a.w) - (b.x + b.w))[0];
    if (under) {
      const rightEdge = under.x + under.w;
      // 平台下方/附近有一个**更低**的 pickup：走下去捡，不要跳。
      // ⚠️ 用绝对距离、并且允许它已经在身后：W6 的成功轨迹就是**从台阶右侧走下来**
      //   （x≈236 离台、x=250 落到净水边缘），不是从台缘跳过去 —— 跳过去会高过净水。
      const pickupBelow = st.pickups.some((p) =>
        p.active && Math.abs(p.x - st.x) < 48 && p.y > st.bottom + 5,
      );
      if (pickupBelow) return false;
      // 平台**自身范围内**的 hazard（例如巡逻敌人）：提前跳过去；平台外的静态 hazard 不提前跳，
      // 等走到平台右缘再起跳 —— 否则会给箱外 hazard 送人头（票 10 实测）。
      const next = st.hazards.filter((h) => h.x > st.x).sort((a, b) => a.x - b.x)[0];
      const hazardOverPlatform = next && next.x <= rightEdge + 30 && next.x - st.x < 60;
      if (hazardOverPlatform) return true;
      return st.x >= rightEdge + 8 || blocked || ctx.stuck;
    }
    return blocked || ctx.stuck;
  }

  const probe = st.right + 18;
  const groundAhead = st.solids.some((s) =>
    s.y <= st.bottom + 8 && s.y >= st.bottom - 90 && s.x <= probe && s.x + s.w >= probe,
  );
  const hazardAhead = st.hazards.some((h) =>
    h.x > st.x && h.x - st.x < 100 && Math.abs(h.y - st.y) < 90,
  );
  const pickupAbove = st.pickups.some((p) =>
    p.active && p.x > st.x && p.x - st.x < 130 && p.y < st.bottom - 20,
  );
  return blocked || !groundAhead || hazardAhead || pickupAbove || ctx.stuck;
}

/**
 * 软锁专项策略：与正例相同地爬上木箱，但**在抬高面上故意提前跳**，
 * 让落弧撞上木箱右侧的 hazard。起跳点由 hazard 的位置反推（hazard.x - 60），
 * 不是写死的 x —— 换一份「木箱 + 右侧 hazard」的 config 仍然成立。
 */
function shouldJumpForHazard(st, ctx) {
  if (!st.onFloor) return false;
  if (Date.now() - ctx.lastJumpAt < 240) return false;
  const onRaised = st.bottom < ctx.floorY - 10;
  if (onRaised) {
    const next = st.hazards.filter((h) => h.x > st.x).sort((a, b) => a.x - b.x)[0];
    return next ? st.x >= next.x - 60 : shouldJump(st, ctx);
  }
  return shouldJump(st, ctx);
}

// ── 场景：正例 ──────────────────────────────────────────────────────────────

async function runPlayable(page, dir, expectedPickups) {
  const t0 = Date.now();
  const start = await page.reload();
  const floorY = await page.waitForFloor();
  const spawn = { x: start.x, y: start.y };
  const trace = [];
  const shots = [];
  const shot = async (name) => { const f = await page.shot(dir, name); if (f) shots.push(f); };

  await shot('00-start.png');
  const ctx = {
    floorY, lastJumpAt: 0, stuck: false,
    progressX: start.x, progressAt: Date.now(), prevX: start.x,
    lastCollected: start.collected, atGateSince: 0, resets: 0,
  };
  let last = start;
  const extra = () => ({
    trace, shots, resets: ctx.resets, jumps: ctx.jumps ?? 0,
    last: slimState(last), solids: start.solids, floorY, spawn,
  });

  await page.keyDownRight();
  try {
    const deadline = Date.now() + PLAY_MS;
    while (Date.now() < deadline) {
      const st = await page.readState();
      if (!st) { await delay(50); continue; }
      last = st;
      trace.push({ t: Date.now() - t0, ...slimState(st) });

      if (st.x > ctx.progressX + 0.5) { ctx.progressX = st.x; ctx.progressAt = Date.now(); }
      ctx.stuck = Date.now() - ctx.progressAt > 450;

      if (ctx.prevX > 200 && st.x < 100) {
        ctx.resets += 1;
        ctx.progressX = st.x; ctx.progressAt = Date.now();
        await shot(`reset-${ctx.resets}.png`);
      }
      ctx.prevX = st.x;

      if (st.collected !== ctx.lastCollected) {
        ctx.lastCollected = st.collected;
        await shot(`pickup-${st.collected}.png`);
      }

      if (st.won) {
        await shot('won.png');
        tickWin(st, expectedPickups);
        const errs = page.consoleErrors();
        if (errs.length || page.exceptions.length) {
          await shot('fail-runtime.png');
          throw new StageError(
            'runtime',
            `核心循环完成，但页面有错误：console.error ${errs.length} 条 / 未捕获异常 ${page.exceptions.length} 条` +
            (errs.length ? `；首条：${errs[0].text}` : ''),
          );
        }
        return {
          ok: true, stage: 'won', reason: `collected=${st.collected}/${expectedPickups} · x=${st.x.toFixed(1)}`,
          durationMs: Date.now() - t0, floorY, spawn, resets: ctx.resets, final: slimState(st), shots, trace,
        };
      }

      if (st.bottom > floorY + 80) {
        await shot('fail-floor.png');
        throw new StageError('floor', `玩家掉穿地面：body.bottom=${st.bottom.toFixed(1)} > floorY+80 (${(floorY + 80).toFixed(1)})`, extra());
      }

      if (st.gate && st.x >= st.gate.x - 20) {
        if (!ctx.atGateSince) ctx.atGateSince = Date.now();
        if (Date.now() - ctx.atGateSince > 1500) {
          await shot('fail-win.png');
          throw new StageError('win', `已到 gate（x=${st.x.toFixed(1)}，gate.x=${st.gate.x}）但 won=false；collected=${st.collected}/${expectedPickups}`, extra());
        }
      } else {
        ctx.atGateSince = 0;
      }

      if (shouldJump(st, ctx)) {
        trace.push({ t: Date.now() - t0, jump: true, x: st.x, y: st.y, bottom: st.bottom, onFloor: st.onFloor });
        await page.jump(ctx);
      }
      await delay(35);
    }
  } finally {
    await page.keyUpRight().catch(() => {});
    await page.writeLogs(dir);
  }

  await page.shot(dir, 'fail-timeout.png').catch(() => {});
  const stage = last.x < spawn.x + 5 ? 'move' : last.collected === 0 ? 'pickup' : 'navigate';
  throw new StageError(stage, `超时 ${PLAY_MS}ms 未完成核心循环：x=${last.x.toFixed(1)} collected=${last.collected}/${expectedPickups} won=${last.won} onFloor=${last.onFloor}`, extra());
}

function tickWin(st, expectedPickups) {
  if (st.collected < expectedPickups) throw new StageError('win', `won=true 但 collected=${st.collected}/${expectedPickups}`);
}

// ── 场景：软锁专项 / 旧实现负例 ────────────────────────────────────────────

async function triggerReset(page, dir, { floorY, attempt }) {
  const t0 = Date.now();
  const trace = [];
  const first = await page.readState();
  const ctx = {
    floorY, lastJumpAt: 0, stuck: false,
    prevX: first.x, progressX: first.x, progressAt: Date.now(),
    jumpedElevated: false, lastAirborneAt: 0, lastState: first, resetState: null, resetAirborne: false,
  };

  await page.keyDownRight();
  try {
    const deadline = Date.now() + RESET_MS;
    while (Date.now() < deadline) {
      const st = await page.readState();
      if (!st) { await delay(40); continue; }
      trace.push({ t: Date.now() - t0, ...slimState(st) });

      if (ctx.prevX > 200 && st.x < 100) {
        ctx.resetState = st;
        // 「空中撞」用**最近一次离地 ≤250ms** 判定：只看上一帧会在碰撞恰好跨两帧时误判。
        ctx.resetAirborne = !!(ctx.jumpedElevated && ctx.lastAirborneAt && Date.now() - ctx.lastAirborneAt <= 250);
        break;
      }

      if (st.x > ctx.progressX + 0.5) { ctx.progressX = st.x; ctx.progressAt = Date.now(); }
      ctx.stuck = Date.now() - ctx.progressAt > 450;
      if (ctx.jumpedElevated && !st.onFloor) ctx.lastAirborneAt = Date.now();

      // ⚠️ `jumpedElevated` 必须在**起跳前**记：起跳后同一帧 onFloor 就变假了。
      if (shouldJumpForHazard(st, ctx)) {
        const onRaised = st.onFloor && st.bottom < floorY - 10;
        if (onRaised) ctx.jumpedElevated = true;
        await page.jump(ctx);
      }

      ctx.lastState = st;
      ctx.prevX = st.x;
      await delay(35);
    }
  } finally {
    await page.keyUpRight().catch(() => {});
  }

  if (!ctx.resetState) {
    throw new StageError('reset-sequence', `第 ${attempt} 次：${RESET_MS}ms 内没有触发 hazard 重置（trace samples=${trace.length}）`);
  }
  if (!ctx.resetAirborne) {
    await page.shot(dir, `reset-${attempt}-not-airborne.png`);
    throw new StageError(
      'reset-sequence',
      `第 ${attempt} 次：重置发生了，但不是「从抬高面起跳、空中撞 hazard」的序列` +
      `（jumpedElevated=${ctx.jumpedElevated}，重置前 onFloor=${ctx.lastState?.onFloor}）`,
    );
  }

  const frames = await page.sampleFrames(30);
  const baseline = ctx.lastState ?? ctx.resetState;
  const failures = [];
  const maxBottom = Math.max(...frames.map((f) => f.bottom));
  if (maxBottom > floorY + 1) {
    failures.push({ stage: 'reset-floor', reason: `重置后 30 帧内 body.bottom 最大 ${maxBottom.toFixed(2)} > floorY+1 (${(floorY + 1).toFixed(2)})` });
  }
  if (!frames.some((f) => f.onFloor)) {
    failures.push({ stage: 'reset-floor', reason: '重置后 30 帧内 onFloor 没有变真' });
  }
  const stateChanged = frames.find((f) => f.collected !== baseline.collected || f.won !== baseline.won);
  if (stateChanged) {
    failures.push({ stage: 'reset-state', reason: `重置后 collected/won 变了：${baseline.collected}/${baseline.won} → ${stateChanged.collected}/${stateChanged.won}` });
  }
  const rest = frames.filter((f) => f.onFloor);
  const restBottom = rest.length ? rest[rest.length - 1].bottom : null;
  await page.shot(dir, `reset-${attempt}.png`);

  return {
    attempt, resetState: slimState(ctx.resetState), airborne: ctx.resetAirborne,
    frames: frames.map(slimState), failures, restBottom, maxBottom,
    trace,
  };
}

async function runHazard(page, dir, { legacy = false } = {}) {
  const t0 = Date.now();
  const start = await page.reload();
  const floorY = await page.waitForFloor();
  const spawn = { x: start.x, y: start.y };

  if (legacy) {
    // 票 06 §6.3 的负例：把 `hitHazard` 换回旧实现（只动 GameObject、不动物理体）。
    // 只在本次页面会话里补丁；站点产物不动。
    const patched = await page.evaluate(`(()=>{
      const g = window.__gmGame;
      const s = g && g.scene && g.scene.getScene('shell');
      if (!s) return false;
      const sx = ${JSON.stringify(spawn.x)}, sy = ${JSON.stringify(spawn.y)};
      s.hitHazard = function () {
        if (!this.player || this.won) return;
        this.player.setPosition(sx, sy);
        this.player.setVelocity(0, 0);
      };
      return true;
    })()`);
    if (!patched) throw new StageError('boot', '旧实现负例：拿不到 shell 场景，无法补丁 hitHazard');
  }

  const batches = [];
  const attempts = legacy ? 1 : 2;
  for (let i = 0; i < attempts; i++) {
    const b = await triggerReset(page, dir, { floorY, attempt: i + 1 });
    batches.push(b);
    if (b.failures.length) break;
  }

  const durationMs = Date.now() - t0;

  if (legacy) {
    const b = batches[0];
    const caught = b.failures.length > 0;
    return {
      ok: caught, stage: 'reset-floor', expected: 'fail',
      reason: caught
        ? `旧实现按预期在 reset-floor 失败：${b.failures.map((f) => f.reason).join('；')}`
        : '旧实现竟然通过了 30 帧检查 —— 这条专项用例失去了判别力',
      durationMs, floorY, spawn, resetBatches: batches,
    };
  }

  const bad = batches.flatMap((b) => b.failures);
  if (bad.length) {
    throw new StageError(bad[0].stage, bad[0].reason, { resetBatches: batches });
  }
  if (batches.length !== 2) throw new StageError('reset-sequence', `只触发了 ${batches.length} 次重置（要 2 次）`);
  const [a, b] = batches;
  if (a.restBottom === null || b.restBottom === null) {
    throw new StageError('reset-floor', '两次重置后都没有读到静止脚线');
  }
  if (Math.abs(a.restBottom - b.restBottom) > 0.5) {
    throw new StageError(
      'reset-accumulate',
      `两次重置的静止脚线不同：${a.restBottom.toFixed(2)} vs ${b.restBottom.toFixed(2)}（差 ${Math.abs(a.restBottom - b.restBottom).toFixed(2)} px）`,
    );
  }

  const errs = page.consoleErrors();
  if (errs.length || page.exceptions.length) {
    throw new StageError(
      'runtime',
      `软锁专项完成，但页面有错误：console.error ${errs.length} 条 / 未捕获异常 ${page.exceptions.length} 条` +
      (errs.length ? `；首条：${errs[0].text}` : ''),
    );
  }

  return {
    ok: true, stage: 'reset-floor',
    reason: `两次重置均在 30 帧内回到 floorY（静止脚线 ${a.restBottom.toFixed(2)} / ${b.restBottom.toFixed(2)}），collected/won 未变`,
    durationMs, floorY, spawn, resetBatches: batches,
  };
}

// ── 负例 ────────────────────────────────────────────────────────────────────

async function runGateNegative() {
  const dir = path.join(OUT, 'negative-gate');
  fs.mkdirSync(dir, { recursive: true });
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  const original = cfg.objective?.gate;
  cfg.objective = { ...cfg.objective, gate: 'no-such-gate-for-p03-negative' };
  const cfgPath = path.join(dir, 'config-gate-missing.json');
  writeJson(cfgPath, cfg);
  const { assembleSite } = await import(pathToFileURL(DIST_JS).href);
  const t0 = Date.now();

  let observed;
  try {
    assembleSite({
      packDir: PACK, configPath: cfgPath, shellJsPath: SHELL_JS,
      outRoot: path.join(dir, 'out'),
      gameId: 'p03-negative-gate',
    });
    observed = { rejected: false, stage: 'assemble', reason: 'gate 指向不存在的 id，装配却成功了' };
  } catch (e) {
    observed = {
      rejected: true,
      stage: 'assemble',
      kind: e?.kind ?? 'unknown',
      message: e instanceof Error ? e.message : String(e),
    };
  }
  const result = {
    ok: observed.rejected, expected: 'fail', stage: 'assemble',
    reason: observed.rejected
      ? `按预期在装配期拒绝（${observed.kind}）：${observed.message}`
      : observed.reason,
    originalGate: original, mutatedGate: cfg.objective.gate,
    durationMs: Date.now() - t0, observed,
  };
  writeJson(path.join(dir, 'result.json'), result);
  return result;
}

async function runPickupNegative(page) {
  const dir = path.join(OUT, 'negative-pickup');
  fs.mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  const start = await page.reload();
  const expected = countPickups();
  const removed = await page.evaluate(`(()=>{
    const g = window.__gmGame;
    const s = g && g.scene && g.scene.getScene('shell');
    if (!s) return null;
    const p = (s.pickups || []).find((q) => q.active);
    if (!p) return null;
    const where = { x: p.x, y: p.y };
    p.destroy();
    return { where, left: (s.pickups || []).filter((q) => q.active).length };
  })()`);
  if (!removed) throw new StageError('boot', '负例 pickup：场景里没有可拿掉的 pickup');

  let failure = null;
  try {
    const r = await driveForNegative(page, dir, expected);
    failure = { stage: 'none', reason: `拿掉 pickup 后仍然赢了：${r.reason}` };
  } catch (e) {
    failure = e instanceof StageError ? { stage: e.stage, reason: e.message } : { stage: 'harness', reason: String(e) };
  }
  const result = {
    ok: failure.stage === 'win', expected: 'fail', stage: failure.stage,
    reason: failure.stage === 'win'
      ? `按预期在 win 阶段失败：${failure.reason}`
      : `负例没有在 win 阶段失败（得到 ${failure.stage}）：${failure.reason}`,
    removedPickup: removed, expectedPickups: expected, durationMs: Date.now() - t0, start: slimState(start),
  };
  writeJson(path.join(dir, 'result.json'), result);
  return result;
}

async function runInputNegative(page) {
  const dir = path.join(OUT, 'negative-input');
  fs.mkdirSync(dir, { recursive: true });
  const t0 = Date.now();
  const start = await page.reload({ preScripts: [INPUT_BLOCKER] });
  const expected = countPickups();

  let failure = null;
  try {
    const r = await driveForNegative(page, dir, expected, { timeout: 7000 });
    failure = { stage: 'none', reason: `输入被破坏后仍然赢了：${r.reason}` };
  } catch (e) {
    failure = e instanceof StageError ? { stage: e.stage, reason: e.message } : { stage: 'harness', reason: String(e) };
  }
  const result = {
    ok: failure.stage === 'move', expected: 'fail', stage: failure.stage,
    reason: failure.stage === 'move'
      ? `按预期在 move 阶段失败：${failure.reason}`
      : `负例没有在 move 阶段失败（得到 ${failure.stage}）：${failure.reason}`,
    durationMs: Date.now() - t0, start: slimState(start),
  };
  writeJson(path.join(dir, 'result.json'), result);
  return result;
}

/** 负例只需要「跑到赢或失败」；成功返回 = 负例失效。复用正例驱动，但超时更短。 */
async function driveForNegative(page, dir, expectedPickups, { timeout = 30000 } = {}) {
  const t0 = Date.now();
  const start = await page.readState();
  const ctx = {
    floorY: null, lastJumpAt: 0, stuck: false,
    progressX: start.x, progressAt: Date.now(), prevX: start.x,
    lastCollected: start.collected, atGateSince: 0, resets: 0,
  };
  ctx.floorY = await page.waitForFloor();
  let last = start;
  const trace = [];
  const extra = () => ({ trace, last: slimState(last), start: slimState(start) });
  await page.keyDownRight();
  try {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const st = await page.readState();
      if (!st) { await delay(50); continue; }
      last = st;
      trace.push({ t: Date.now() - t0, ...slimState(st) });
      if (st.x > ctx.progressX + 0.5) { ctx.progressX = st.x; ctx.progressAt = Date.now(); }
      ctx.stuck = Date.now() - ctx.progressAt > 450;
      if (ctx.prevX > 200 && st.x < 100) { ctx.resets += 1; ctx.progressX = st.x; ctx.progressAt = Date.now(); }
      ctx.prevX = st.x;
      if (st.collected !== ctx.lastCollected) { ctx.lastCollected = st.collected; await page.shot(dir, `pickup-${st.collected}.png`); }
      if (st.won) {
        await page.shot(dir, 'won.png');
        return { ok: true, reason: `won at x=${st.x.toFixed(1)} collected=${st.collected}/${expectedPickups}`, final: slimState(st), trace };
      }
      if (st.bottom > ctx.floorY + 80) throw new StageError('floor', `掉穿地面：bottom=${st.bottom.toFixed(1)}`);
      if (st.gate && st.x >= st.gate.x - 20) {
        if (!ctx.atGateSince) ctx.atGateSince = Date.now();
        if (Date.now() - ctx.atGateSince > 1500) {
          throw new StageError('win', `已到 gate（x=${st.x.toFixed(1)}，gate.x=${st.gate.x}）但 won=false；collected=${st.collected}/${expectedPickups}`, extra());
        }
      } else ctx.atGateSince = 0;
      if (shouldJump(st, ctx)) {
        trace.push({ t: Date.now() - t0, jump: true, x: st.x, y: st.y, bottom: st.bottom, onFloor: st.onFloor });
        await page.jump(ctx);
      }
      await delay(35);
    }
  } finally {
    await page.keyUpRight().catch(() => {});
    await page.writeLogs(dir);
  }
  await page.shot(dir, 'fail-timeout.png').catch(() => {});
  const stage = last.x < start.x + 5 ? 'move' : last.collected === 0 ? 'pickup' : last.x < (last.gate?.x ?? Infinity) - 50 ? 'navigate' : 'win';
  throw new StageError(stage, `超时 ${timeout}ms：x=${last.x.toFixed(1)} collected=${last.collected}/${expectedPickups} won=${last.won}`, extra());
}

function countPickups() {
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  return (cfg.entities ?? []).filter((e) => e.kind === 'pickup').length;
}

// ── 组装与主流程 ────────────────────────────────────────────────────────────

async function assembleForPositive() {
  if (!fs.existsSync(PACK)) failRun('assemble', `找不到资源包：${PACK}\n  可用 --pack / PLAYABLE_PACK 覆盖。`);
  if (!fs.existsSync(CONFIG)) failRun('assemble', `找不到 config：${CONFIG}\n  可用 --config / PLAYABLE_CONFIG 覆盖。`);
  if (!fs.existsSync(SHELL_JS) || !fs.existsSync(DIST_JS)) {
    failRun('assemble', `没有构建产物（${SHELL_JS} / ${DIST_JS}）—— 先跑 \`pnpm build\`。`);
  }
  const cfg = JSON.parse(fs.readFileSync(CONFIG, 'utf8'));
  if (cfg.format !== 'game-config/v1') {
    failRun('assemble', `本 smoke 只覆盖横版（game-config/v1）；读到的是 ${JSON.stringify(cfg.format)}。塔防归 P2。`);
  }
  const { assembleSite } = await import(pathToFileURL(DIST_JS).href);
  const outRoot = path.join(OUT, 'out');
  const res = assembleSite({ packDir: PACK, configPath: CONFIG, shellJsPath: SHELL_JS, outRoot });
  const siteDir = path.resolve(outRoot, res.data.siteDir);
  const gameRoot = path.join(outRoot, res.data.gameId);
  writeJson(path.join(OUT, 'assemble.json'), { pack: PACK, config: CONFIG, summary: res.summary, data: res.data, siteDir, gameRoot });
  return { siteDir, gameRoot, summary: res.summary, data: res.data };
}

function banner(s) {
  console.log(`\n${'='.repeat(78)}\n${s}\n${'='.repeat(78)}`);
}

function printResult(name, r) {
  const mark = r.expected === 'fail'
    ? (r.ok ? `✅ 负例按预期失败（${r.stage}）` : `❌ 负例没有按预期失败（${r.stage}）`)
    : (r.ok ? `✅ ${name}` : `❌ ${name}`);
  console.log(`${mark} · ${(r.durationMs / 1000).toFixed(1)}s · ${r.reason ?? ''}`);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const chrome = findChrome();
  let chromeVersion = '';
  try { chromeVersion = execFileSync(chrome, ['--version'], { encoding: 'utf8', timeout: 15000 }).trim(); }
  catch (e) { chromeVersion = `(读不到 --version：${e instanceof Error ? e.message : String(e)})`; }

  const meta = {
    startedAt: new Date().toISOString(), mode: MODE, pack: PACK, config: CONFIG, out: OUT,
    chrome, chromeVersion, node: process.version,
  };
  console.log(`Chrome: ${chromeVersion} (${chrome})`);
  console.log(`包: ${PACK}`);
  console.log(`config: ${CONFIG}`);
  console.log(`证据: ${OUT}`);

  if (MODE === 'gate') {
    banner('负例 · gate 指错（应在装配期拒绝）');
    const r = await runGateNegative();
    printResult('gate', r);
    writeJson(path.join(OUT, `summary-${MODE}.json`), { ...meta, scenarios: [r] });
    process.exitCode = 1; // 负例命令**按约定**非 0
    return;
  }

  const site = await assembleForPositive();
  banner('站点装配');
  for (const l of site.summary) console.log('   ' + l);
  const urlPath = path.relative(site.gameRoot, path.join(site.siteDir, 'index.html')).split(path.sep).join('/');

  const server = await startServer(site.gameRoot);
  const addr = server.address();
  const url = `http://127.0.0.1:${addr.port}/${urlPath}`;
  console.log(`   URL: ${url}`);

  const browser = await launchChrome(chrome, path.join(OUT, 'chrome.log'));
  let cdp = null;
  try {
    cdp = await connectCdp(browser.page.webSocketDebuggerUrl);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    try { await cdp.send('Page.bringToFront'); } catch {}
    const bv = await cdp.send('Browser.getVersion').catch(() => null);
    const product = bv?.result?.product;
    if (product) chromeVersion = product;
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: PHASER_HOOK });
    const page = makePage(cdp);
    await cdp.send('Page.navigate', { url });
    // ⚠️ 首次导航必须**等它落地**再开始场景 —— 紧接着 Page.reload 会撞上 provisional load，
    //   CDP 报 `Not attached to an active page`（-32000）。
    await page.waitForScene(20000);
    const expectedPickups = countPickups();

    const run = async (name, fn) => {
      banner(name);
      const t0 = Date.now();
      try {
        const r = await fn();
        r.durationMs = r.durationMs ?? Date.now() - t0;
        writeJson(path.join(OUT, name, 'result.json'), r);
        const out = { name, ...r };
        printResult(name, out);
        return out;
      } catch (e) {
        const stage = e instanceof StageError ? e.stage : 'harness';
        const r = {
          ok: false, expected: 'pass', stage,
          reason: e instanceof Error ? e.message : String(e),
          durationMs: Date.now() - t0,
          extra: e instanceof StageError ? e.extra : undefined,
          console: page.consoleEntries,
          exceptions: page.exceptions,
        };
        const dir = path.join(OUT, name);
        writeJson(path.join(dir, 'result.json'), r);
        await page.shot(dir, `fail-${stage}.png`).catch(() => {});
        await page.writeLogs(dir).catch(() => {});
        console.log(`❌ ${name} · ${(r.durationMs / 1000).toFixed(1)}s · stage=${stage} · ${r.reason}`);
        return { name, ...r };
      }
    };

    let scenarios;
    if (MODE === 'positive') {
      scenarios = [];
      const want = (key) => !ONLY || ONLY === key;
      if (want('playable')) scenarios.push(await run('playable', () => runPlayable(page, path.join(OUT, 'playable'), expectedPickups)));
      if (want('hazard-reset')) scenarios.push(await run('hazard-reset', () => runHazard(page, path.join(OUT, 'hazard-reset'))));
      if (want('hazard-legacy')) scenarios.push(await run('hazard-legacy', () => runHazard(page, path.join(OUT, 'hazard-legacy'), { legacy: true })));
      const allOk = scenarios.every((r) => r.ok);
      console.log(`\n${allOk ? '✅ 正例全绿' : '❌ 有失败项'} —— 证据在 ${OUT}`);
      writeJson(path.join(OUT, `summary-${MODE}.json`), { ...meta, chromeVersion, url, scenarios });
      process.exitCode = allOk ? 0 : 1;
    } else if (MODE === 'pickup') {
      banner('负例 · 运行时拿掉一个 pickup');
      const r = await runNegativeScenario(page, 'negative-pickup', () => runPickupNegative(page));
      writeJson(path.join(OUT, `summary-${MODE}.json`), { ...meta, chromeVersion, url, scenarios: [r] });
      process.exitCode = 1;
    } else if (MODE === 'input') {
      banner('负例 · 破坏输入');
      const r = await runNegativeScenario(page, 'negative-input', () => runInputNegative(page));
      writeJson(path.join(OUT, `summary-${MODE}.json`), { ...meta, chromeVersion, url, scenarios: [r] });
      process.exitCode = 1;
    }
  } finally {
    if (cdp) cdp.close();
    await browser.close();
    await new Promise((r) => server.close(r));
  }
}

async function runNegativeScenario(page, name, fn) {
  try {
    const r = await fn();
    const out = { name, ...r };
    printResult(name, out);
    return out;
  } catch (e) {
    const stage = e instanceof StageError ? e.stage : 'harness';
    const r = {
      name, ok: false, expected: 'fail', stage,
      reason: e instanceof Error ? e.message : String(e),
      console: page.consoleEntries,
      exceptions: page.exceptions,
    };
    console.log(`❌ ${name} · stage=${stage} · ${r.reason}`);
    writeJson(path.join(OUT, name, 'result.json'), r);
    return r;
  }
}

main().catch((e) => {
  console.error(`\n❌ smoke 失败（harness）：${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  process.exit(1);
});
