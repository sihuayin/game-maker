#!/usr/bin/env node
// 相对链接的守卫 —— 仓库里那些**互相指的路径**必须真的指得到。
//
// 为什么需要它：`CONTEXT.md` 与三张 wayfinder 图的票互相引了几百次，而**没有任何东西检查它们**。
// 「零断裂」一直靠人手工验 —— 2026-09-30 那次我自己写的临时扫法**只认 `](../…)` 一种形状**，
// 漏掉了三条写成别的形状的；是两个审查轴各自手写了一遍扫描才把它们找出来。
// ⇒ 这一层与 `check-deps.mjs` 同一形状：**结构性、可复跑、红了就是红的**。
//
// ⚠️ **跳过的三类**，每一类都有理由：
//   · `http(s)://` / `mailto:` —— 外部的东西，离线也验不了；
//   · `#锚点` —— 同文件内的跳转，与路径无关；
//   · **代码围栏里的**（``` 或 ~~~）—— 围栏里贴的是终端会话或代码，
//     那里的 `](...)` 不是链接。⚠️ 这一条是有意的：一段**被围起来的转录**不算正文
//     （2026-09-30 删掉的那段误粘进来的会话，正是「没围起来所以成了正文」）。
//
// ⚠️ 它**只查「指得到吗」**，不查锚点是否真有那个标题，也不查链接文字与目标是否相符。
//   后者是审查那一轴的事（人读得出来，脚本读不出来）。
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
/** 这些目录里没有「仓库的文档」：依赖、构建产物、产物目录、本地配置。 */
const SKIP_DIRS = new Set(["node_modules", "out", ".git", "dist", ".claude"]);
/** ⚠️ 这些文档里写着**故意**指向不存在的东西的例子（模板、反例）。加之前先看清楚为什么。 */
const ALLOW = new Set([]);

/** 一份文档里所有**不在围栏里**的相对链接（行号从 1 起）。 */
function relativeLinks(file) {
  const lines = fs.readFileSync(file, "utf8").split("\n");
  const out = [];
  let fence = null;                                   // 当前围栏的记号（``` 或 ~~~），null = 不在里面
  for (const [i, line] of lines.entries()) {
    const m = /^\s*(`{3,}|~{3,})/.exec(line);
    if (m) {
      const mark = m[1][0];
      fence = fence === null ? mark : (fence === mark ? null : fence);
      continue;
    }
    if (fence !== null) continue;
    // `](目标)` 与 `![alt](目标)` —— 目标里不出现空格或右括号（本仓库的路径都没有）
    for (const l of line.matchAll(/\]\(([^)\s]+)\)/g)) {
      const t = l[1];
      if (/^(https?:|mailto:|#)/.test(t)) continue;
      out.push({ line: i + 1, target: t });
    }
  }
  return out;
}

function walk(dir) {
  const md = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) md.push(...walk(path.join(dir, e.name))); }
    else if (e.name.endsWith(".md")) md.push(path.join(dir, e.name));
  }
  return md;
}

const files = walk(ROOT).sort();
const broken = [];
let checked = 0;
for (const file of files) {
  for (const { line, target } of relativeLinks(file)) {
    checked += 1;
    // 去掉 `#锚点` 与 `?query` 再解析 —— 这一层只管**那个文件在不在**
    const bare = target.replace(/[#?].*$/, "");
    if (bare === "") continue;
    const abs = path.resolve(path.dirname(file), decodeURIComponent(bare));
    if (!fs.existsSync(abs) && !ALLOW.has(path.relative(ROOT, file)))
      broken.push(`${path.relative(ROOT, file)}:${line} → ${target}`);
  }
}

if (broken.length > 0) {
  console.error(`❌ 相对链接断了 ${broken.length} 条：\n` + broken.map((b) => "   · " + b).join("\n"));
  process.exit(1);
}
console.log(`✅ 相对链接零断裂（${files.length} 份文档 · ${checked} 条链接）`);
