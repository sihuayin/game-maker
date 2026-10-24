#!/usr/bin/env node
/**
 * 票 72 · Q3 = (a) 的验证探针 —— **本机无头 Chrome，零上游调用**。
 *
 *   pnpm --filter @game-maker/demo bundle && node .scratch/game-maker-v2/experiments/72-two-shell-size/probe.mjs
 *
 * 回答**两件**事（票 72 的裁定 Q3 逐字）：
 *   ① 今天无头 Chrome 里 `canNine`（= `game.renderer.type === Phaser.WEBGL`）的实际值；
 *   ② 塔防 `hud.start` 的**实际渲染宽度**（声明 28×22，包里 44×22）。
 *
 * ⚠️ **它一个字都不改仓库源码**：站点由现成的装配器（与 CLI 同一份代码）产出，
 *   探针只在自己拷的那一份 `__p72.html` 里注入早于外壳的钩子。
 * ⚠️ 产物落在本目录（票 72 Q3′：「不进 git 索引」）：截图 + `readout-*.json`。
 */
import { execSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, '../../../..');   // ⚠️ 这是 `.scratch/<effort>/experiments/<票>/` ⇒ 仓库根在上四层
const SITE_ROOT = path.join(HERE, 'site');          // 站点暂存（也被本目录一起收着）
const SHELL_JS = path.join(ROOT, 'packages/demo/dist/shell.js');
const DIST_JS = path.join(ROOT, 'packages/demo/dist/index.js');
const PORT = 8796;

const CHROME = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  process.env.CHROME_BIN,
].filter(Boolean).find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
if (!CHROME) { console.error('找不到 Chrome，设置 CHROME_BIN 环境变量'); process.exit(1); }
for (const f of [SHELL_JS, DIST_JS]) if (!fs.existsSync(f)) { console.error(`没有 ${f} —— 先跑 pnpm --filter @game-maker/demo bundle`); process.exit(1); }

/** ⚠️ **早于外壳**注入 —— 钩子必须在 Phaser 建上下文、画第一帧之前装好。 */
const EARLY = `<script>
window.__P72__={ctx:[],draws:[],seen:{},err:[]};
(function(){
  var og=HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext=function(t){ try{window.__P72__.ctx.push(String(t));}catch(e){} return og.apply(this,arguments); };
  var di=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(img){
    try{
      var a=arguments;
      if(img&&img.width){
        var r={n:a.length,iw:img.width,ih:img.height,
          cv:(this.canvas?(this.canvas.width+'x'+this.canvas.height):'?'),
          main:(this.canvas===document.querySelector('canvas')),
          tf:(function(){try{return this.getTransform?[this.getTransform().a,this.getTransform().d,this.getTransform().e,this.getTransform().f]:null;}catch(e){return null;}}).call(this)};
        if(a.length>=9){r.sx=a[1];r.sy=a[2];r.sw=a[3];r.sh=a[4];r.dx=a[5];r.dy=a[6];r.dw=a[7];r.dh=a[8];}
        else if(a.length>=5){r.dx=a[1];r.dy=a[2];r.dw=a[3];r.dh=a[4];}
        else {r.dx=a[1];r.dy=a[2];}
        var k=[r.n,r.iw,r.ih,r.sx,r.sy,r.sw,r.sh,r.dx,r.dy,r.dw,r.dh,r.cv,r.main,JSON.stringify(r.tf)].join(',');
        window.__P72__.count=(window.__P72__.count||0)+1;
        if(!window.__P72__.seen[k]&&window.__P72__.draws.length<4000){window.__P72__.seen[k]=1;r.n_hits=1;window.__P72__.draws.push(r);}
        else if(window.__P72__.seen[k]===1){window.__P72__.seen[k]=2;for(var i=0;i<window.__P72__.draws.length;i++){var d=window.__P72__.draws[i];if([d.n,d.iw,d.ih,d.sx,d.sy,d.sw,d.sh,d.dx,d.dy,d.dw,d.dh].join(',')===k){d.n_hits=2;break;}}}
      }
    }catch(e){}
    return di.apply(this,arguments);
  };
  addEventListener('error',function(e){window.__P72__.err.push(String((e&&e.message)||e));},true);
})();
<\/script>`;

/**
 * ⚠️ **持续快照、取最富的一帧**，不是「等 6 秒读一次」。
 *   实测：`--virtual-time-budget` 下 rAF 跑几帧是**飘的** —— 固定时点会在「一帧都没渲染」的那一刻
 *   读到只有 2 条噪声的现场（第一次改钩子后就栽在这上面）。
 *   于是每 200ms 比一次 `totalDraws`，谁多留谁；画够 300 条就停表。
 */
const LATE = `<script>
(function(){
  var best=-1;
  var snap=function(){
    var p=window.__P72__||{};
    var t=p.count||0;
    if(t>best){
      best=t;
      document.documentElement.setAttribute('data-p72',JSON.stringify({
        ctx:p.ctx, draws:p.draws, errors:p.err, totalDraws:t,
        canvases:document.querySelectorAll('canvas').length,
        canvasSize:(function(){var c=document.querySelector('canvas');return c?{w:c.width,h:c.height,cssW:c.clientWidth,cssH:c.clientHeight}:null;})(),
        tdState:(function(){var v=document.documentElement.getAttribute('data-td-state');return v?v.slice(0,160):null;})(),
      }));
    }
    if(t>300) clearInterval(iv);
  };
  var iv=setInterval(snap,200);
  setTimeout(function(){clearInterval(iv);snap();},26000);
})();
<\/script>`;

function chrome(url, { budget = 30000, shot } = {}) {
  const shotArgs = shot ? [`--screenshot=${shot}`, '--window-size=1000,600'] : [];
  // ⚠️ 必须带 timeout —— 仓库里那两个探针的注释写着 `--screenshot` 偶发把无头 Chrome 挂死。
  const out = execSync(
    `"${CHROME}" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=${budget} ` +
    `--enable-logging=stderr --v=0 ${shotArgs.join(' ')} --dump-dom "${url}" 2>&1`,
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000 },
  );
  const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
  const raw = (out.match(/data-p72="([^"]*)"/) || [])[1];
  const consoleLines = out.split('\n').filter((l) => l.includes('INFO:CONSOLE')).map((l) => {
    const m = l.match(/INFO:CONSOLE[^\]]*\]\s*([\s\S]*?)(?:,\s*source:|$)/);
    let msg = (m ? m[1] : l).trim();
    if (msg.startsWith('"') && msg.endsWith('"')) msg = msg.slice(1, -1);
    return msg.replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }).filter((l) => !l.startsWith('%c'));
  return { p72: raw ? JSON.parse(unesc(raw)) : null, consoleLines };
}

const banner = (s) => console.log(`\n${'='.repeat(72)}\n${s}\n${'='.repeat(72)}`);

fs.rmSync(SITE_ROOT, { recursive: true, force: true });
fs.mkdirSync(SITE_ROOT, { recursive: true });

const demo = await import(DIST_JS);
const targets = [
  { key: 'landscape', name: '横版 last-train（v2）', fn: demo.assembleSite,
    packDir: path.join(ROOT, 'fixtures/packs/last-train/v2'),
    configPath: path.join(ROOT, 'fixtures/game-configs/last-train.json'), gameId: 'last-train' },
  { key: 'td', name: '塔防 counter-siege（v4）', fn: demo.assembleTdSite,
    packDir: path.join(ROOT, 'fixtures/packs/counter-siege/v4'),
    configPath: path.join(ROOT, 'fixtures/td-configs/counter-siege.json'), gameId: 'counter-siege' },
];

for (const t of targets) {
  const res = t.fn({ packDir: t.packDir, configPath: t.configPath, shellJsPath: SHELL_JS, outRoot: SITE_ROOT, gameId: t.gameId });
  t.dir = path.join(SITE_ROOT, res.data.siteDir);
  // ⚠️ 只改**探针自己拷的那一份**，站点产物一个字不动
  const html = fs.readFileSync(path.join(t.dir, 'index.html'), 'utf8')
    .replace('<head>', `<head>${EARLY}`)
    .replace('</body>', `${LATE}</body>`);
  fs.writeFileSync(path.join(t.dir, '__p72.html'), html);
  banner(`${t.name} —— 装配器产出`);
  for (const l of res.summary) console.log('   ' + l);
}

const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: SITE_ROOT, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

try {
  for (const t of targets) {
    banner(`${t.name} —— 浏览器里量到的`);
    const shot = path.join(HERE, `shot-${t.key}.png`);
    const url = `http://127.0.0.1:${PORT}/${path.relative(SITE_ROOT, t.dir)}/__p72.html`;
    // ⚠️ **重试取最富的一跑** —— 实测 `--virtual-time-budget` 下 rAF 跑几帧是**飘的**：
    //   同一个页面，一跑记到 605 条 drawImage，另一跑只有 2 条（一帧都没渲染）。
    //   这里最多跑 6 次、留 `totalDraws` 最大的那一次；重试是**为了拿到一帧真渲染**，不是「重试到绿」。
    let r = chrome(url, { shot });
    for (let i = 0; i < 5 && (r.p72?.totalDraws ?? 0) < 50; i++) {
      const again = chrome(url, { shot });
      if ((again.p72?.totalDraws ?? 0) > (r.p72?.totalDraws ?? 0)) r = again;
    }
    const p = r.p72 ?? {};
    fs.writeFileSync(path.join(HERE, `readout-${t.key}.json`), JSON.stringify({ url, p72: p, consoleLines: r.consoleLines }, null, 2) + '\n');

    console.log(`drawImage 总调用数：${p.totalDraws ?? 0} · 塔防状态快照：${p.tdState ? '在' : '（没有）'}`);
    const ctxTypes = [...new Set(p.ctx ?? [])];
    console.log(`getContext 请求过的类型：${JSON.stringify(ctxTypes)}`);
    console.log(`画布 ${JSON.stringify(p.canvasSize)} · 页内异常 ${(p.errors ?? []).length} · 截图 ${path.relative(ROOT, shot)}`);
    console.log(`CANVAS 路径下量到的 drawImage（去重后 ${(p.draws ?? []).length} 条 · 图集尺寸 ${JSON.stringify([...new Set((p.draws??[]).map((d)=>d.iw+'x'+d.ih))])}）：`);
    for (const d of (p.draws ?? []).filter((d) => d.iw === 96 || (d.tf ?? [])[2] === 444).slice(0, 40))
      { const t = d.tf ?? [1, 1, 0, 0];
        console.log(`   [tf at(${t[2]},${t[3]}) scale(${+t[0].toFixed(4)},${+t[1].toFixed(4)})] atlas ${d.iw}×${d.ih} src (${d.sx ?? '-'},${d.sy ?? '-'}) ${d.sw ?? d.iw}×${d.sh ?? d.ih} → 局部 (${d.dx},${d.dy}) ${d.dw ?? d.sw ?? d.iw}×${d.dh ?? d.sh ?? d.ih} ⇒ 画出来 ${(+t[0] * (d.dw ?? d.sw ?? d.iw)).toFixed(2)}×${(+t[1] * (d.dh ?? d.sh ?? d.ih)).toFixed(2)}`); }
    const warns = r.consoleLines.filter((l) => /^\[warning\]|^\[error\]/.test(l));
    if (warns.length) { console.log('外壳控制台：'); for (const l of warns.slice(0, 6)) console.log('   ' + l.split('\n')[0]); }

    // ── 判决 ──────────────────────────────────────────────────────────────
    // ⚠️ 权威信号是**外壳自己那句话**：`s9 && !canNine` 时才打（`scene.ts` 与 `td/scene.ts` 各一处）。
    //   `getContext` 的类型列表**不是**判据 —— Phaser 的设备探测会试探 webgl，与最终选哪个渲染器无关。
    const canvasFallback = r.consoleLines.some((l) => /不支持九宫格/.test(l));
    const drewThrough2d = (p.draws ?? []).length > 0;
    console.log(`\n① canNine（renderer 是 WebGL 吗）：**${canvasFallback ? 'false —— Canvas 回退（外壳自己报了那句话）'
      : 'true —— 无回退警告'}** · 2D 路径上的 drawImage 流量：${drewThrough2d ? '有（' + p.draws.length + ' 条）' : '零'}`);
    if (t.key === 'td') {
      const btns = (p.draws ?? []).filter((d) => d.iw === 96 && d.sx === 0 && d.sy === 26);
      console.log(`② ui-btn（声明 44×22 包 44×22）与 hud.start（声明 28×22、包 44×22 同一个资产）画出来的宽度：`);
      for (const d of btns) { const t = d.tf ?? [1, 1, 0, 0];
        console.log(`   at(${t[2]},${t[3]}) · 局部宽 ${d.dw} × scaleX ${+t[0].toFixed(4)} ⇒ **画出来 ${(t[0] * d.dw).toFixed(2)}**`); }
    }
  }
} finally { srv.kill(); }
console.log(`\n产物：${path.relative(ROOT, HERE)}/  （readout-*.json · shot-*.png）`);
