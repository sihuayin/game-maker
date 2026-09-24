#!/usr/bin/env node
/**
 * 一键复跑票 03 的全部实测。
 *
 *   node probe.mjs
 *
 * 会做四件事：
 *   1. npx vite build（计时）
 *   2. 把探针脚本注入 dist/index.html，用 headless Chrome 从 file:// 打开 → 预期 CORS 失败
 *   3. 起 python3 -m http.server，用 headless Chrome 打开 → 预期成功
 *   4. 生成 base64 data-URI 的逃生舱页面，从 file:// 打开 → 预期成功
 *
 * 前置：本目录 npm install（见 README）。
 */
import { execFileSync, execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const CHROME_CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  process.env.CHROME_BIN,
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
if (!CHROME) { console.error('找不到 Chrome，设置 CHROME_BIN 环境变量'); process.exit(1); }

const PROBE = `<script>
window.__LOG__=[];
window.addEventListener('error',function(e){window.__LOG__.push('ERR '+(e.message||'(no msg)')+' @ '+(e.filename||(e.target&&(e.target.src||e.target.href))||''));},true);
setTimeout(function(){document.documentElement.setAttribute('data-probe',JSON.stringify({log:window.__LOG__,probe:window.__PROBE__||null,ready:!!window.__GAME_EVENT_READY__,href:location.href}));},4000);
</script>`;

/** 用 headless Chrome 打开 url，返回页面里的 data-probe + Chrome 打印的 CONSOLE 行。 */
function chromeWithConsole(url, { budget = 8000 } = {}) {
  const out = execSync(
    `"${CHROME}" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=${budget} ` +
    `--enable-logging=stderr --v=0 --dump-dom "${url}" 2>&1`,
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }
  );
  const probe = (out.match(/data-probe="([^"]*)"/) || [])[1];
  const decoded = probe ? JSON.parse(probe.replace(/&quot;/g, '"').replace(/&amp;/g, '&')) : null;
  const consoleLines = out.split('\n')
    .filter((l) => l.includes('INFO:CONSOLE') && !l.includes('Phaser v3'))
    .map((l) => (l.match(/"((?:[^"\\]|\\.)*)"/) || [])[1] || l)
    .filter((l) => !l.startsWith('%c'));
  return { probe: decoded, consoleLines };
}

const banner = (s) => console.log(`\n${'='.repeat(70)}\n${s}\n${'='.repeat(70)}`);
const results = {};

// ── 1. build ────────────────────────────────────────────────────────────────
banner('1. vite build（计时）');
fs.rmSync(path.join(HERE, 'dist'), { recursive: true, force: true });
fs.rmSync(path.join(HERE, 'node_modules/.vite'), { recursive: true, force: true });
const t0 = Date.now();
const buildOut = execSync('npx vite build', { cwd: HERE, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const wall = (Date.now() - t0) / 1000;
console.log(buildOut.split('\n').filter((l) => /dist\/|built in|larger than/.test(l)).join('\n'));
results.build = { wall, reported: (buildOut.match(/built in ([\d.]+m?s)/) || [])[1] };
console.log(`\nwall(端到端, 含 npx 冷启): ${wall.toFixed(2)}s`);

const distTree = execSync('find dist -type f | sort', { cwd: HERE, encoding: 'utf8' }).trim();
console.log('\ndist 目录:\n' + distTree);
console.log('\ndist/index.html:\n' + fs.readFileSync(path.join(HERE, 'dist/index.html'), 'utf8'));

// 注入探针
const idx = fs.readFileSync(path.join(HERE, 'dist/index.html'), 'utf8');
fs.writeFileSync(path.join(HERE, 'dist/__probe.html'), idx.replace('<head>', '<head>' + PROBE));

// ── 2. file:// 打开真实产物 ────────────────────────────────────────────────
banner('2. file:// 打开真实 Vite 产物   →   预期失败');
const viaFile = chromeWithConsole(`file://${path.join(HERE, 'dist/__probe.html')}`);
console.log('page probe :', JSON.stringify(viaFile.probe));
console.log('console    :', viaFile.consoleLines.slice(0, 2).join('\n             '));
results.file = viaFile;

// ── 3. python3 -m http.server ───────────────────────────────────────────────
banner('3. python3 -m http.server   →   预期成功');
const PORT = 8791;
const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'],
  { cwd: path.join(HERE, 'dist'), stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1500));
try {
  const viaHttp = chromeWithConsole(`http://127.0.0.1:${PORT}/__probe.html`);
  console.log('page probe :', JSON.stringify(viaHttp.probe));
  console.log('console    :', viaHttp.consoleLines.slice(0, 2).join('\n             '));
  results.http = viaHttp;
} finally { srv.kill(); }

// ── 4. 逃生舱：base64 data URI + file:// ───────────────────────────────────
banner('4. base64 data-URI 逃生舱 / file://   →   预期成功');
const FT = path.join(HERE, '.filetest');
fs.mkdirSync(FT, { recursive: true });
fs.copyFileSync(path.join(HERE, 'node_modules/phaser/dist/phaser.min.js'), path.join(FT, 'phaser.min.js'));
const pngB64 = fs.readFileSync(path.join(HERE, 'public/assets/atlas.png')).toString('base64');
const jsonObj = fs.readFileSync(path.join(HERE, 'public/assets/atlas.json'), 'utf8');
fs.writeFileSync(path.join(FT, 'inline-assets.js'),
  `window.__ATLAS_PNG__="data:image/png;base64,${pngB64}";window.__ATLAS_JSON__=${jsonObj};`);

const mkPage = (atlasUrlExpr, atlasJsonExpr, jsx = '') => `<!doctype html><html><head><meta charset="utf-8">
<script>
window.__LOG__=[];window.addEventListener('error',function(e){window.__LOG__.push('ERR '+(e.message||'(no msg)')+' @ '+(e.filename||(e.target&&(e.target.src||e.target.href))||''));},true);
setTimeout(function(){document.documentElement.setAttribute('data-probe',JSON.stringify({log:window.__LOG__,probe:window.__PROBE__||null}));},5000);
</script></head><body><div id="game"></div>
<script src="./phaser.min.js"></script>${jsx}
<script>
new Phaser.Game({type:Phaser.AUTO,width:320,height:180,parent:'game',scene:{
  preload:function(){this.load.atlas('pack',${atlasUrlExpr},${atlasJsonExpr});},
  create:function(){window.__PROBE__={phaser:Phaser.VERSION,renderer:this.game.renderer.type===Phaser.WEBGL?'WEBGL':'CANVAS',frames:this.textures.get('pack').getFrameNames()};console.log('PROBE_READY '+JSON.stringify(window.__PROBE__));}}});
</script></body></html>`;

fs.writeFileSync(path.join(FT, 'classic.html'), mkPage("'./atlas.png'", "'./atlas.json'"));
fs.copyFileSync(path.join(HERE, 'public/assets/atlas.png'), path.join(FT, 'atlas.png'));
fs.copyFileSync(path.join(HERE, 'public/assets/atlas.json'), path.join(FT, 'atlas.json'));
fs.writeFileSync(path.join(FT, 'inline.html'),
  mkPage('window.__ATLAS_PNG__', 'window.__ATLAS_JSON__', '<script src="./inline-assets.js"></script>'));

const classic = chromeWithConsole(`file://${path.join(FT, 'classic.html')}`, { budget: 9000 });
console.log('4a classic script + 相对路径 PNG（证明否决点 2 独立成立，预期失败）');
console.log('   page probe :', JSON.stringify(classic.probe));
console.log('   console    :', classic.consoleLines.slice(0, 1).join('\n                '));

const inline = chromeWithConsole(`file://${path.join(FT, 'inline.html')}`, { budget: 9000 });
console.log('\n4b base64 data URI（预期成功）');
console.log('   page probe :', JSON.stringify(inline.probe));
results.classicFile = classic;
results.inlineFile = inline;

// ── 汇总 ────────────────────────────────────────────────────────────────────
banner('汇总');
const ok = (b) => (b ? '✅' : '❌');
const framesOf = (r) => r?.probe?.probe?.frames ?? null;
console.log(`${ok(!results.file.probe?.probe)} 1. file:// 打开 Vite 产物        → 失败（页内没有任何 Phaser 实例）`);
console.log(`${ok(!!results.http?.probe?.probe)} 2. python3 -m http.server      → 成功 frames=${JSON.stringify(framesOf(results.http))}`);
console.log(`${ok(framesOf(results.classicFile)?.length === 0)} 3. file:// + classic script     → 游戏起来了，但 frames=${JSON.stringify(framesOf(results.classicFile))}（一图未加载，且不报错）`);
console.log(`${ok(!!results.inlineFile.probe?.probe)} 4. file:// + base64 data URI    → 成功 frames=${JSON.stringify(framesOf(results.inlineFile))}`);
console.log(`\n构建耗时 wall=${results.build.wall.toFixed(2)}s (vite 自报 ${results.build.reported})`);
console.log('  ⚠️ wall 含 npx 冷启 Node 的固定开销；首次在新目录跑还会多花约 1s 做 npx 解析。');
console.log('     进账本请用 vite 自报值。');
console.log('\n详情见 ../../research/demo-build-hosting.md');
