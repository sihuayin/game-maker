#!/usr/bin/env node
// I00-04 敏感度重算：只读 P0 冻结原型与 P0 案例输入，不改 P0 目录。
// 用法：
//   node lagms-sensitivity.mjs <prototype.mjs> <caseB-input.json> [lag,lag,...]
// 输出：Markdown 表 + 机器可读 JSON 行（`JSON: {...}`）。退出码 0。
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const protoPath = process.argv[2];
const casePath = process.argv[3];
const lags = (process.argv[4] ?? "0,16.67,94,200,250")
  .split(",").map(Number).filter(Number.isFinite);

if (!protoPath || !casePath) {
  console.error("usage: node lagms-sensitivity.mjs <prototype.mjs> <caseB-input.json> [lag,...]");
  process.exit(2);
}

const model = await import(pathToFileURL(protoPath).href);
const base = JSON.parse(fs.readFileSync(casePath, "utf8"));
const speed = model.hazardSpeed(base.hazard);
const gate = model.provePermanentGate(base);      // ⚠️ 无 lag 参数：交集证明与 lag 无关
const gateWidth = gate.gateHi - gate.gateLo;

const rows = [];
for (const lag of lags) {
  const cfg = structuredClone(base);
  cfg.options.lagMs = lag;
  const r = model.analyze(cfg);
  const pad = speed * lag;
  // 反事实：若把「并集扫掠带」误用于交集证明，门会随 lag 收缩
  const unionLo = gate.gateLo + pad;
  const unionHi = gate.gateHi - pad;
  rows.push({
    lagMs: lag,
    withinSourceBound: lag <= 200,
    padPx: pad,
    p0Gate: `[${gate.gateLo},${gate.gateHi}]`,
    p0GateWidth: gateWidth,
    naiveUnionGate: `[${unionLo.toFixed(2)},${unionHi.toFixed(2)}]`,
    naiveUnionGateWidth: unionHi - unionLo,
    verdict: r.verdict,
    reason: r.reason,
  });
}

console.log("| lagMs | ≤200ms(源码界) | pad=0.02·lag (px) | P0 交集门 | 门宽 | 并集带误用后的门 | 并集门宽 | verdict | reason |");
console.log("|---:|:---:|---:|---|---:|---|---:|---|---|");
for (const x of rows) {
  console.log(`| ${x.lagMs} | ${x.withinSourceBound ? "是" : "否(不可达)"} | ${x.padPx.toFixed(2)} | ${x.p0Gate} | ${x.p0GateWidth} | ${x.naiveUnionGate} | ${x.naiveUnionGateWidth.toFixed(2)} | ${x.verdict} | ${x.reason} |`);
}
console.log("");
console.log(`hazardSpeed = ${speed} px/ms；hazard.width = ${base.hazard.width}px；anchorX = ${base.hazard.anchorX}；distance = ${base.hazard.distance}；periodMs = ${base.hazard.periodMs}`);
console.log(`并集门宽 = ${gateWidth} - 2·pad；归零的 lag = ${(gateWidth / (2 * speed)).toFixed(0)}ms（远超 200ms 源码界）`);
console.log("JSON: " + JSON.stringify({ speed, gate, gateWidth, rows }));
