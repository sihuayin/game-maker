#!/usr/bin/env node
/**
 * 外壳的真冒烟：**起一个静态 HTTP server + 无头 Chrome，打开站点看它到底起没起来。**
 *
 *   pnpm --filter @game-maker/demo bundle && node packages/demo/probe/smoke.mjs
 *
 * ⚠️ **不进 CI**（票 44 的「两层守护」：守门的进 vitest、这一层可复跑）。
 *   它回答的是 `pnpm test` 回答不了的那个问题 —— **真的能起来吗**。
 *
 * 两个场景：
 *   A. **空场景最小数据集**（票 32 §3）—— **手工注入**，不走装配器：
 *      它**过不了校验**，而它是故意的（考的是校验够不到的那些失败）。
 *   B. **真链路** —— 资源包 + game-config → **装配器（票 33，与 CLI 同一份代码）** → 浏览器。
 *      这一条才是「一个资源包 + 一份配置 → 打开即玩」的兑现。
 *
 * 依赖：Node 22、`python3`、Google Chrome（找不到时设 `CHROME_BIN`）。
 */
import { execFileSync, execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PKG = path.dirname(HERE);
const ROOT = path.resolve(PKG, '../..');
const SITE_ROOT = path.join(ROOT, 'out', '__probe');   // ⚠️ 产物目录，已被 .gitignore（Q9）
const SHELL_JS = path.join(PKG, 'dist', 'shell.js');
const DIST_JS = path.join(PKG, 'dist', 'index.js');
const PACK_SRC = path.join(ROOT, 'fixtures', 'packs', 'last-train', 'v2');
const CONFIG = path.join(ROOT, 'fixtures', 'game-configs', 'last-train.json');
const PORT = 8793;

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  process.env.CHROME_BIN,
].filter(Boolean).find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
if (!CHROME) { console.error('找不到 Chrome，设置 CHROME_BIN 环境变量'); process.exit(1); }
for (const f of [SHELL_JS, DIST_JS]) if (!fs.existsSync(f)) { console.error(`没有 ${f} —— 先跑 pnpm --filter @game-maker/demo bundle`); process.exit(1); }

const INDEX_HTML = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>game-maker demo</title>
<style>html,body{margin:0;height:100%;background:#101014;display:grid;place-items:center}</style>
</head><body><div id="game"></div>
<script src="./shell.js"></script>
</body></html>
`;

/** 注入「页面里出过错没有」的探针 —— 只加在探针自己拷的那一份 html 上，站点产物不动。 */
const PROBE = `<script>
window.__LOG__=[];
addEventListener('error',function(e){window.__LOG__.push('ERR '+(e.message||'(no msg)')+' @ '+(e.filename||(e.target&&(e.target.src||e.target.href))||''));},true);
setTimeout(function(){document.documentElement.setAttribute('data-probe',JSON.stringify({
  log:window.__LOG__, canvases:document.querySelectorAll('canvas').length}));},6000);
</script>`;

function chrome(url, { budget = 9000, shot } = {}) {
  const shotArgs = shot ? [`--screenshot=${shot}`, '--window-size=1000,600'] : [];
  // ⚠️ **必须带 timeout** —— 实测 `--screenshot` 偶发把无头 Chrome 挂死（有一回挂了 11 小时，
  //   还占着端口，把后面每一次探针都堵住）。宁可在这里响亮地失败，也不要静静吊死。
  const out = execSync(
    `"${CHROME}" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=${budget} ` +
    `--enable-logging=stderr --v=0 ${shotArgs.join(' ')} --dump-dom "${url}" 2>&1`,
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000 },
  );
  const raw = (out.match(/data-probe="([^"]*)"/) || [])[1];
  const probe = raw ? JSON.parse(raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')) : null;
  // ⚠️ 消息里带**转义引号**（`包里没有资源 \"x\"`）—— 用「第一个方括号到 `, source:`」抽，
  //   用最短匹配会把消息截断成半句，于是探针看起来在报一个不存在的问题。
  const consoleLines = out.split('\n')
    .filter((l) => l.includes('INFO:CONSOLE'))
    .map((l) => {
      const m = l.match(/INFO:CONSOLE[^\]]*\]\s*([\s\S]*?)(?:,\s*source:|$)/);
      let msg = (m ? m[1] : l).trim();
      if (msg.startsWith('"') && msg.endsWith('"')) msg = msg.slice(1, -1);
      return msg.replace(/\\"/g, '"').replace(/\\n/g, '\n');
    })
    .filter((l) => !l.startsWith('%c'));
  return { probe, consoleLines };
}

const banner = (s) => console.log(`\n${'='.repeat(72)}\n${s}\n${'='.repeat(72)}`);
const ok = (b) => (b ? '✅' : '❌');

// ── 搭根目录 ───────────────────────────────────────────────────────────────
fs.rmSync(SITE_ROOT, { recursive: true, force: true });
fs.mkdirSync(SITE_ROOT, { recursive: true });

// 场景 A：**手工**摆一份（不走装配器 —— 它过不了校验，这是故意的）
const A_DIR = path.join(SITE_ROOT, 'empty', 'site', 'v1');
fs.mkdirSync(A_DIR, { recursive: true });
fs.copyFileSync(SHELL_JS, path.join(A_DIR, 'shell.js'));
fs.writeFileSync(path.join(A_DIR, 'index.html'), INDEX_HTML);
fs.writeFileSync(path.join(A_DIR, '__probe.html'), INDEX_HTML.replace('<head>', `<head>${PROBE}`));
fs.writeFileSync(path.join(A_DIR, 'site.json'), JSON.stringify({ shell: '1', pack: 'v2' }, null, 2) + '\n');
fs.copyFileSync(path.join(PKG, 'fixtures', 'empty-world.json'), path.join(A_DIR, 'game-config.json'));
fs.mkdirSync(path.join(SITE_ROOT, 'empty', 'pack'), { recursive: true });
execFileSync('cp', ['-R', PACK_SRC, path.join(SITE_ROOT, 'empty', 'pack', 'v2')]);

// 场景 B：**走真链路** —— 装配器（与 CLI 同一份代码）产出一个站点
const { assembleSite } = await import(DIST_JS);
const res = assembleSite({ packDir: PACK_SRC, configPath: CONFIG, shellJsPath: SHELL_JS, outRoot: SITE_ROOT, gameId: 'last-train' });
const B_DIR = path.join(SITE_ROOT, res.data.siteDir);
fs.copyFileSync(path.join(B_DIR, 'index.html'), path.join(B_DIR, '__probe.html'));
fs.writeFileSync(path.join(B_DIR, '__probe.html'),
  fs.readFileSync(path.join(B_DIR, 'index.html'), 'utf8').replace('<head>', `<head>${PROBE}`));
banner('装配器（票 33）产出');
for (const l of res.summary) console.log('   ' + l);

const results = {};
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: SITE_ROOT, stdio: 'ignore' });
srv.on('exit', (c) => { if (c !== null && c !== 0) console.error(`⚠️ http server 退出了（码 ${c}）—— 端口 ${PORT} 可能被上一次没杀干净的探针占着；查：lsof -nP -iTCP:${PORT} -sTCP:LISTEN`); });
await new Promise((r) => setTimeout(r, 1200));

const scenarios = [
  { key: 'A', name: '空场景最小数据集（数据全错，手工注入）', dir: A_DIR },
  { key: 'B', name: '真链路：资源包 + 配置 → 装配器 → 浏览器', dir: B_DIR },
];

try {
  for (const s of scenarios) {
    banner(`${s.key}. ${s.name}`);
    const shot = path.join(SITE_ROOT, `shot-${s.key}.png`);
    const url = `http://127.0.0.1:${PORT}/${path.relative(SITE_ROOT, s.dir)}/__probe.html`;
    const r = chrome(url, { shot });
    // ⚠️ 两类要分开数：**外壳报出来的问题**（`[error] where: …`，那是契约要求它说的话）
    //   与**没人预期过的崩溃**（Uncaught / TypeError…）。混在一起数，等于把
    //   「它忠实地报告了坏数据」判成「它崩了」。
    const errs = r.consoleLines.filter((l) => /^\[error\]/.test(l));
    const warns = r.consoleLines.filter((l) => /^\[warning\]/.test(l));
    const crashed = r.consoleLines.filter((l) => /Uncaught|TypeError|ReferenceError|SyntaxError|Failed to load/i.test(l));
    const booted = r.consoleLines.some((l) => l.includes('[shell]'));
    const canvases = r.probe?.canvases ?? 0;
    const jsErrs = r.probe?.log ?? [];

    console.log(`外壳启动(${booted})  画布(${canvases})  页面内异常(${jsErrs.length})  意外崩溃(${crashed.length})  外壳报错(${errs.length})  外壳警告(${warns.length})`);
    console.log('控制台：');
    for (const l of r.consoleLines.filter((x) => /^\[shell\]|^\[error\]|^\[warning\]/.test(x)).slice(0, 8)) console.log('   ' + l.split('\n')[0]);
    if (jsErrs.length) console.log('   页内异常：' + jsErrs.join(' | '));
    console.log(`   截图：${path.relative(ROOT, shot)}`);

    results[s.key] = {
      booted, canvases, crashed: crashed.length, errs: errs.length, warns: warns.length, jsErrs,
      hasPlaceholders: r.consoleLines.some((l) => /原位画占位符/.test(l)),
      good: booted && canvases > 0 && crashed.length === 0 && jsErrs.length === 0,
    };
  }
} finally { srv.kill(); }

banner('汇总');
const A = results.A, B = results.B;
console.log(`${ok(A.booted)} A 外壳启动（零数据也起得来）`);
console.log(`${ok(A.canvases > 0)} A 出画布（票 32 §3 判据之一）`);
console.log(`${ok(A.hasPlaceholders && A.errs > 0)} A 占位符可见 + 控制台有警告（外壳报错 ${A.errs} 条）`);
console.log(`${ok(A.jsErrs.length === 0 && A.crashed === 0)} A 不抛（页内 0 异常、0 意外崩溃）`);
console.log(`${ok(B.good && B.errs === 0)} B 真链路：装配 + 启动 + 出画布 + **一条 error 都没有**（报错 ${B.errs} 条 / 警告 ${B.warns} 条）`);
const allOk = A.booted && A.canvases > 0 && A.hasPlaceholders && A.errs > 0 && A.jsErrs.length === 0 && A.crashed === 0
  && B.good && B.errs === 0;
console.log(`\n${allOk ? '✅ 全绿' : '❌ 有失败项'} —— 截图在 ${path.relative(ROOT, SITE_ROOT)}/shot-*.png`);
process.exit(allOk ? 0 : 1);
