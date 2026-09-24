#!/usr/bin/env node
// 依赖方向守卫（票 29 的产物之一，票 07 落地时抄这个）。
//
// 为什么需要它：pnpm 的严格 node_modules 只能挡住「未声明」的依赖；
// **已声明但被禁止的边**（例如 assets 偷偷依赖 demo）照样解析得通 ——
// 而那正是 R6「A 与 B 可独立交付」唯一的死法。
// 这一层读的是同一份 package.json，没有第二套描述，所以是结构性的，不是启发式的。
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const PKGS = path.join(ROOT, "packages");

/** 允许图：包名 → 它被允许依赖的兄弟包。空数组 = 不许依赖任何兄弟包。
 *  注意 mcp **不**依赖 cli —— R5：MCP 不 shell out 到 CLI，两层进度协议。 */
const ALLOWED = {
  "@game-maker/contracts": [],
  "@game-maker/assets": ["@game-maker/contracts"],
  "@game-maker/demo": ["@game-maker/contracts"],
  "@game-maker/cli": ["@game-maker/contracts", "@game-maker/assets", "@game-maker/demo"],
  "@game-maker/mcp": ["@game-maker/contracts", "@game-maker/assets", "@game-maker/demo"],
};

const siblings = new Set(fs.readdirSync(PKGS).map((d) => {
  const p = path.join(PKGS, d, "package.json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")).name : null;
}).filter(Boolean));

const errors = [];
const seen = new Set();
for (const dir of fs.readdirSync(PKGS)) {
  const pj = path.join(PKGS, dir, "package.json");
  if (!fs.existsSync(pj)) continue;
  const pkg = JSON.parse(fs.readFileSync(pj, "utf8"));
  seen.add(pkg.name);
  if (!(pkg.name in ALLOWED)) { errors.push(`${pkg.name}: 不在允许图里（新增包必须先在 check-deps.mjs 里表态）`); continue; }
  for (const dep of Object.keys(pkg.dependencies ?? {})) {
    if (!siblings.has(dep)) continue;                        // 外部依赖不管，pnpm 管
    if (!ALLOWED[pkg.name].includes(dep)) errors.push(`${pkg.name} → ${dep}：被禁止的边`);
  }
}
for (const name of Object.keys(ALLOWED)) if (!seen.has(name)) errors.push(`${name}: 允许图里有它，但 packages/ 下没有`);

if (errors.length) { console.error("❌ 依赖方向违规：\n" + errors.map((e) => "   · " + e).join("\n")); process.exit(1); }
console.log(`✅ 依赖图合法（${seen.size} 个包）`);
