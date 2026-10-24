#!/usr/bin/env node
/** 把一张截图里的一块放大到看得清 —— 只为复核（票 72 Q3），零上游、不进 git 索引。
 *  用法：node zoom.mjs <in.png> <out.png> <x> <y> <w> <h> [scale] */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const [inp, outp, x, y, w, h, sc = '8'] = process.argv.slice(2);
const S = Number(sc), X = Number(x), Y = Number(y), W = Number(w), H = Number(h);
const W2 = Math.min(1200, W * S), H2 = Math.min(760, H * S);
const html = `<!doctype html><meta charset="utf-8"><style>
html,body{margin:0;background:#101014;overflow:hidden}
img{position:absolute;image-rendering:pixelated;transform-origin:0 0;transform:scale(${S});
    left:${-X * S + 8}px;top:${-Y * S + 8}px}
</style><img src="${path.basename(inp)}">`;
const tmp = path.join(path.dirname(inp), '__zoom.html');
fs.writeFileSync(tmp, html);
const CHROME = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', process.env.CHROME_BIN]
  .filter(Boolean).find((p) => { try { return fs.statSync(p).isFile(); } catch { return false; } });
execSync(`"${CHROME}" --headless=new --disable-gpu --no-sandbox --virtual-time-budget=2500 ` +
  `--screenshot="${outp}" --window-size=${W2},${H2} "file://${tmp}" 2>/dev/null`, { timeout: 60_000 });
fs.rmSync(tmp, { force: true });
console.log(`${outp}  （原图 x${X}..${X + W} y${Y}..${Y + H} 放大 ${S}×）`);
