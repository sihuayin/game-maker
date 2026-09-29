// ⚠️ 原型，不是产物：跑一次第一版提示词，把产物摊开给人看。
import fs from "node:fs";
import path from "node:path";
const { renderPrompt } = await import("./prompt.mjs");
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const { parseTdConfig, auditTdConfig } = await import(path.join(ROOT, "packages/contracts/dist/index.js"));

const requirement = fs.readFileSync(path.join(ROOT, "inputs/counter-siege/PROMPT.md"), "utf8");
const prompt = renderPrompt(requirement);

const t0 = Date.now();
const res = await fetch(`${process.env.ANTHROPIC_BASE_URL}/v1/messages`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_AUTH_TOKEN, "anthropic-version": "2023-06-01" },
  body: JSON.stringify({ model: "deepseek-v4-pro", max_tokens: 32000, thinking: { type: "disabled" }, messages: [{ role: "user", content: prompt }] }),
});
const body = await res.json();
const text = (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text).join("");
console.log(`上游 HTTP ${res.status} · ${((Date.now() - t0) / 1000).toFixed(1)}s · 服务模型 ${body.model} · stop=${body.stop_reason} · usage=${JSON.stringify(body.usage)}`);
fs.writeFileSync(path.join(ROOT, "out/__probe-prompt/raw.txt"), text);

const strip = (s) => { const m = /```(?:json)?\s*([\s\S]*?)```/.exec(s); return (m?.[1] ?? s).trim(); };
let parsed;
try { parsed = JSON.parse(strip(text)); }
catch (e) { console.log("❌ 不是合法 JSON：", e.message); console.log(text.slice(0, 600)); process.exit(1); }

const r = parseTdConfig(parsed);
if (!r.ok) { console.log("❌ 过不了 schema："); for (const e of r.errors.slice(0, 8)) console.log("   · " + e); process.exit(1); }
console.log("✅ 过得了 schema");

const M = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/packs/counter-siege/v4/manifest.json"), "utf8"));
const issues = auditTdConfig(r.value, M);
const errs = issues.filter((i) => i.severity === "error");
const warns = issues.filter((i) => i.severity === "warning");
console.log(`校验：${errs.length} 条硬失败 · ${warns.length} 条警告`);
for (const i of issues) console.log(`   ${i.severity === "error" ? "❌" : "⚠️"} ${i.where}: ${i.message}`);

fs.writeFileSync(path.join(ROOT, "out/__probe-prompt/td-config.json"), JSON.stringify(r.value, null, 2) + "\n");
const c = r.value;
console.log("\n=== 它画的那张地图 ===");
for (const [i, row] of c.arena.rows.entries()) console.log(`  ${String(i).padStart(2)} ${row}`);
console.log(`\n走道字符 "${c.arena.walkChar}" · 砖的绑定：${Object.entries(c.arena.tiles).map(([k, v]) => `${k}→${v.asset}`).join(" ")}`);
console.log(`路径 ${c.path.points.length} 点 · 插槽 ${c.slots.length} · 机关 ${c.towers.map((t) => `${t.name}(${t.cost})`).join(" ")} · 敌人 ${c.enemies.map((e) => `${e.name} ${e.hp}血`).join(" ")}`);
console.log(`经济：开局 ${c.economy.startScrap} · 声望 ${c.economy.lives} · 波次奖励 ${c.economy.waveBonus} · ${c.waves.length} 波`);
