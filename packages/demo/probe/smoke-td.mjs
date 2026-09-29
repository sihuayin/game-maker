#!/usr/bin/env node
/**
 * 塔防站点的真冒烟：**起一个静态 HTTP server + 无头 Chrome，打开站点看它到底起没起来。**
 *
 *   pnpm --filter @game-maker/demo bundle && node packages/demo/probe/smoke-td.mjs
 *
 * ⚠️ 它与横版那份（`smoke.mjs`）是**兄弟不是同一份**，两个理由：
 *   ① **目录与端口都要分开** —— 那份开头 `fs.rmSync(SITE_ROOT, {recursive:true})`，
 *      共用 `out/__probe` 会让两个探针互相删对方的东西（截图文件名也会撞）。
 *   ② 它多断言一件事：**游玩过程本身**。塔防的逻辑全在 `sim.ts`（纯层）里，
 *      所以这里不重复测规则，只回答 vitest 回答不了的那个问题 ——
 *      **`?auto=1` 那条「建塔 → 出怪 → 交火 → 结算」的路，在真浏览器里转起来了吗。**
 *      判据不是看像素，是读外壳写在 `<html data-td-state>` 上的那份快照。
 *
 * 依赖：Node 22、`python3`、Google Chrome（找不到时设 `CHROME_BIN`）。
 */
import { execFileSync, execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PKG = path.dirname(HERE);
const ROOT = path.resolve(PKG, '../..');
const SITE_ROOT = path.join(ROOT, 'out', '__probe-td');      // ⚠️ 与横版那份**分开**
const SHELL_JS = path.join(PKG, 'dist', 'shell.js');
const DIST_JS = path.join(PKG, 'dist', 'index.js');
const PACK_SRC = path.join(ROOT, 'fixtures', 'packs', 'counter-siege', 'v4');
const CONFIG = path.join(ROOT, 'fixtures', 'td-configs', 'counter-siege.json');
const PORT = 8794;                                            // ⚠️ 同上
/** 参考玩家先跑多久（虚拟毫秒）—— 够建两座塔、够第一波走进射程。 */
const AUTO_MS = 18000;

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
  const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const raw = (out.match(/data-probe="([^"]*)"/) || [])[1];
  const probe = raw ? JSON.parse(unesc(raw)) : null;
  // ⚠️ 游玩过程那份快照 —— 塔防独有的那条证据（见文件头）。
  const tdRaw = (out.match(/data-td-state="([^"]*)"/) || [])[1];
  const tdState = tdRaw ? JSON.parse(unesc(tdRaw)) : null;
  // ⚠️ 消息里带**转义引号**（`包里没有资源 \"x\"`）—— 用「第一个方括号到 `, source:`」抽。
  const consoleLines = out.split('\n')
    .filter((l) => l.includes('INFO:CONSOLE'))
    .map((l) => {
      const m = l.match(/INFO:CONSOLE[^\]]*\]\s*([\s\S]*?)(?:,\s*source:|$)/);
      let msg = (m ? m[1] : l).trim();
      if (msg.startsWith('"') && msg.endsWith('"')) msg = msg.slice(1, -1);
      return msg.replace(/\\"/g, '"').replace(/\\n/g, '\n');
    })
    .filter((l) => !l.startsWith('%c'));
  return { probe, tdState, consoleLines };
}

const banner = (s) => console.log(`\n${'='.repeat(72)}\n${s}\n${'='.repeat(72)}`);
const ok = (b) => (b ? '✅' : '❌');

// ── 搭根目录 ───────────────────────────────────────────────────────────────
fs.rmSync(SITE_ROOT, { recursive: true, force: true });
fs.mkdirSync(SITE_ROOT, { recursive: true });

// 场景 A：**手工**摆一份坏数据（不走装配器 —— 它过不了校验，这是故意的）。
//   考的是「零数据／坏数据也必须起得来、出画布、不抛、把坏了说出来」。
const A_DIR = path.join(SITE_ROOT, 'broken', 'site', 'v1');
fs.mkdirSync(A_DIR, { recursive: true });
fs.copyFileSync(SHELL_JS, path.join(A_DIR, 'shell.js'));
fs.writeFileSync(path.join(A_DIR, 'index.html'), INDEX_HTML);
// ⚠️ 探针只加在**自己拷的那一份**上（`__probe.html`），站点产物一个字节都不动 ——
//   与横版那份同款，也与「注入的探针不该出现在交付物里」这条一致。
fs.writeFileSync(path.join(A_DIR, '__probe.html'), INDEX_HTML.replace('<head>', `<head>${PROBE}`));
fs.writeFileSync(path.join(A_DIR, 'site.json'), JSON.stringify({ shell: 'x', pack: 'v4', config: 'td-config.json' }, null, 2) + '\n');
fs.writeFileSync(path.join(A_DIR, 'td-config.json'), JSON.stringify({ format: 'td-config/v1', 乱写: true }));
fs.mkdirSync(path.join(SITE_ROOT, 'broken', 'pack'), { recursive: true });
execFileSync('cp', ['-R', PACK_SRC, path.join(SITE_ROOT, 'broken', 'pack', 'v4')]);

// 场景 B：**走真链路** —— 分派器（与 CLI 同一份代码）产出一个站点
const { assembleFromConfig } = await import(DIST_JS);
const res = assembleFromConfig({ packDir: PACK_SRC, configPath: CONFIG, shellJsPath: SHELL_JS, outRoot: SITE_ROOT, gameId: 'counter-siege' });
const B_DIR = path.join(SITE_ROOT, res.data.siteDir);
fs.writeFileSync(path.join(B_DIR, '__probe.html'),
  fs.readFileSync(path.join(B_DIR, 'index.html'), 'utf8').replace('<head>', `<head>${PROBE}`));
banner('装配器（与 CLI 同一份代码）产出');
for (const l of res.summary) console.log('   ' + l);

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: SITE_ROOT, stdio: 'ignore' });
srv.on('exit', (c) => { if (c !== null && c !== 0) console.error(`⚠️ http server 退出了（码 ${c}）—— 端口 ${PORT} 可能被上一次没杀干净的探针占着；查：lsof -nP -iTCP:${PORT} -sTCP:LISTEN`); });
await new Promise((r) => setTimeout(r, 1200));

const url = (dir, q = '') => `http://127.0.0.1:${PORT}/${path.relative(SITE_ROOT, path.join(dir, '__probe.html')).split(path.sep).join('/')}${q}`;
const results = {};
try {
  banner('A · 坏数据（场地/机关全解不到，手写注入）');
  results.A = chrome(url(A_DIR), { budget: 9000 });
  const A = results.A;
  for (const l of A.consoleLines) console.log('   ' + l);
  const errs = A.consoleLines.filter((l) => /^\[error\]/.test(l));
  const crashed = A.consoleLines.filter((l) => /Uncaught|TypeError|ReferenceError|SyntaxError|Failed to load/i.test(l));
  const booted = A.consoleLines.some((l) => l.includes('[shell]'));
  console.log(`   ${ok(booted)} 外壳启动（零数据也起得来）   ${ok(A.probe?.canvases > 0)} 出画布   ` +
    `${ok(errs.length > 0)} 把坏了说出来（${errs.length} 条）   ${ok(crashed.length === 0 && (A.probe?.log.length ?? 0) === 0)} 不抛`);
  results.A_ok = booted && A.probe?.canvases > 0 && errs.length > 0 && crashed.length === 0 && (A.probe?.log.length ?? 0) === 0;

  banner(`B · 真链路 + 参考玩家（?auto=1&ms=${AUTO_MS}）`);
  results.B = chrome(url(B_DIR, `?auto=1&ms=${AUTO_MS}`), { budget: 12000, shot: path.join(SITE_ROOT, 'shot-td.png') });
  const B = results.B;
  for (const l of B.consoleLines) console.log('   ' + l);
  const bErrs = B.consoleLines.filter((l) => /^\[error\]/.test(l));
  const bCrashed = B.consoleLines.filter((l) => /Uncaught|TypeError|ReferenceError|SyntaxError|Failed to load/i.test(l));
  const bBooted = B.consoleLines.some((l) => l.includes('[shell] 塔防'));
  const s = B.tdState;
  console.log(`   快照：${JSON.stringify(s)}`);
  const played = !!s && (s.built > 0) && (s.phase === 'wave' || s.phase === 'build') && (s.enemies > 0 || s.killed > 0);
  console.log(`   ${ok(bBooted)} 塔防外壳启动   ${ok(B.probe?.canvases > 0)} 出画布   ` +
    `${ok(bErrs.length === 0)} 一条 error 都没有   ${ok(bCrashed.length === 0 && (B.probe?.log.length ?? 0) === 0)} 不抛`);
  console.log(`   ${ok(played)} **游玩过程真的转了**（建了 ${s?.built ?? 0} 座塔 · 场上 ${s?.enemies ?? 0} 个敌人 · 杀了 ${s?.killed ?? 0} 个）`);
  console.log(`   截图：${path.relative(ROOT, path.join(SITE_ROOT, 'shot-td.png'))}`);
  results.B_ok = bBooted && B.probe?.canvases > 0 && bErrs.length === 0 && bCrashed.length === 0 && (B.probe?.log.length ?? 0) === 0 && played;
} finally {
  srv.kill();
}

banner('结论');
console.log(`   ${ok(results.A_ok)} A 坏数据也能起、也说自己坏了`);
console.log(`   ${ok(results.B_ok)} B 真链路：装配 → 启动 → 出画布 → 零错误 → **游玩过程真的转了**`);
const allOk = results.A_ok && results.B_ok;
console.log(allOk ? '\n全部通过。' : '\n有失败项。');
process.exit(allOk ? 0 : 1);
