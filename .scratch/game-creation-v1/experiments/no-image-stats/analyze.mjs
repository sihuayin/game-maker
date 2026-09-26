// 分析：NO_IMAGE 是随机还是规律？
//
// 「随机」的判据不是「有失败」，而是：**失败在条件之间是均匀分布的**。
// 如果它集中在某个动画 / 某个尺寸上，那就是规律，能绕开；均匀撒开就只能靠重试。
import fs from "node:fs";
const ROOT = "/Volumes/shy/some-projects/game-maker";
const rs = JSON.parse(fs.readFileSync(ROOT + "/.scratch/game-creation-v1/experiments/no-image-stats/results.json", "utf8"));
if (rs.length === 0) { console.log("还没有数据"); process.exit(0); }

const rate = (xs) => xs.length ? (xs.filter((r) => r.outcome === "ok").length / xs.length) : NaN;
const pct = (x) => (100 * x).toFixed(0) + "%";

console.log(`总计 ${rs.length} 次：`);
const by = (k) => [...new Set(rs.map((r) => r[k]))].sort();
for (const r of by("outcome")) console.log(`  ${r.padEnd(10)} ${rs.filter((x) => x.outcome === r).length}`);
console.log(`  总成功率 ${pct(rate(rs))}   NO_IMAGE 率 ${pct(rs.filter(r=>r.outcome==="no_image").length/rs.length)}`);

console.log("\n按动画分（同一动画 12 次）：");
for (const a of by("anim")) {
  const xs = rs.filter((r) => r.anim === a);
  console.log(`  ${a.padEnd(5)} ${String(xs.filter(x=>x.outcome==="ok").length).padStart(2)}/${String(xs.length).padStart(2)} 成功  ${pct(rate(xs)).padStart(4)}  ${a === "run" ? "(6 帧/16:9)" : "(4 帧/16:9)"}`);
}

console.log("\n按「带不带母版参考图」分（各 18 次）：");
for (const v of [false, true]) {
  const xs = rs.filter((r) => r.useRef === v);
  console.log(`  ${v ? "带参考图" : "不带参考"} ${String(xs.filter(x=>x.outcome==="ok").length).padStart(2)}/${String(xs.length).padStart(2)} 成功  ${pct(rate(xs))}`);
}

console.log("\n按「动画 × 参考图」六格（每格 6 次）：");
for (const a of by("anim")) for (const v of [false, true]) {
  const xs = rs.filter((r) => r.anim === a && r.useRef === v);
  const marks = xs.map((r) => r.outcome === "ok" ? "✓" : "✗").join("");
  console.log(`  ${a.padEnd(5)} ${v ? "带参考" : "无参考"}  ${marks}  ${pct(rate(xs))}`);
}

console.log("\n失败长什么样：");
for (const r of rs.filter((x) => x.outcome !== "ok").slice(0, 6))
  console.log(`  ${r.anim}/${r.useRef ? "带参考" : "无参考"} rep${r.rep}  ${r.outcome} ${r.finishReason ?? ""}  ${(r.detail ?? "").slice(0, 120)}`);

// 均匀性：卡方（自由度 = 格数 - 1）
console.log("\n是不是随机的（每格 6 次，看失败是否集中在某几格）：");
const cells = [];
for (const a of by("anim")) for (const v of [false, true]) cells.push(rs.filter((r) => r.anim === a && r.useRef === v));
const fails = cells.map((c) => c.filter((r) => r.outcome !== "ok").length);
const total = cells.flat().length;
const failRate = fails.reduce((s, x) => s + x, 0) / total;
const expected = cells.map((c) => c.length * failRate);
const chi2 = fails.reduce((s, o, i) => s + (o - expected[i]) ** 2 / (expected[i] || 1), 0);
console.log(`  六格的失败数：${fails.join(" ")}   期望各 ${expected[0]?.toFixed(1)}   卡方 ${chi2.toFixed(2)}（自由度 5，>11.07 即 p<0.05 显著不匀）`);
console.log(`  ⇒ ${chi2 > 11.07 ? "**有规律**：失败集中在某些条件上，值得逐条件排查" : "**不像有规律**：失败在各条件间大致均匀，只能靠重试"}`);

console.log("\n耗时（成功 vs 失败）：");
const ms = (xs) => xs.length ? (xs.reduce((s, r) => s + r.ms, 0) / xs.length / 1000).toFixed(1) + "s" : "—";
console.log(`  成功 ${ms(rs.filter(r=>r.outcome==="ok"))}   失败 ${ms(rs.filter(r=>r.outcome!=="ok"))}`);
