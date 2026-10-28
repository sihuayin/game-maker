#!/usr/bin/env node
// FA-01D / E1：在 work 区初始化本轮 delivery 信封（不碰只读快照）。
// 前置：pnpm build（需要 packages/pipeline/dist 与 packages/contracts/dist）。
// 用法：node .scratch/fpvs-v1-final/acceptance/init-delivery.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const { buildSiteSuccessDelivery, writeDeliveryToReport } =
  await import(path.join(ROOT, "packages/pipeline/dist/index.js"));
const { QAReportSchema } = await import(path.join(ROOT, "packages/contracts/dist/index.js"));

const EFFORT = path.join(ROOT, ".scratch/fpvs-v1-final");
const WORK = path.join(EFFORT, "work");
const SNAPSHOT = path.join(EFFORT, "artifacts/wasteland-scavenger-recipe");
const GAME = "wasteland-scavenger-recipe";
const runDir = path.join(WORK, GAME, "run/v1");
const packDir = path.join(WORK, GAME, "pack/v1");
const configPath = path.join(runDir, "game-config.json");
const siteDir = path.join(WORK, GAME, "site/v1");
const siteJson = JSON.parse(fs.readFileSync(path.join(siteDir, "site.json"), "utf8"));
const siteVersion = Number(/^v(\d+)$/.exec(path.basename(siteDir))?.[1]);
const manifest = JSON.parse(fs.readFileSync(path.join(packDir, "manifest.json"), "utf8"));

const before = JSON.parse(fs.readFileSync(path.join(runDir, "qa-report.json"), "utf8"));
const snapshotQa = JSON.parse(fs.readFileSync(path.join(SNAPSHOT, "run/v1/qa-report.json"), "utf8"));
const qaKeys = ["subject", "checked", "failures", "observations"];
const qaLayerSame = JSON.stringify(Object.fromEntries(qaKeys.map((k) => [k, before[k]]))) ===
  JSON.stringify(Object.fromEntries(qaKeys.map((k) => [k, snapshotQa[k]])));
if (!qaLayerSame) throw new Error("work 的 QA 层与快照不一致，停止初始化");
if (snapshotQa.delivery !== undefined) throw new Error("快照 QA 报告不应有 delivery");

const delivery = buildSiteSuccessDelivery({
  outRoot: WORK, runDir, packDir, manifest, configPath, siteVersion, shellVersion: String(siteJson.shell),
});
writeDeliveryToReport(runDir, delivery);

const raw = JSON.parse(fs.readFileSync(path.join(runDir, "qa-report.json"), "utf8"));
const parsed = QAReportSchema.parse(raw);
const d = parsed.delivery;
if (d === undefined) throw new Error("delivery 没写进去");
const qaLayerStillSame = JSON.stringify(Object.fromEntries(qaKeys.map((k) => [k, raw[k]]))) ===
  JSON.stringify(Object.fromEntries(qaKeys.map((k) => [k, snapshotQa[k]])));
if (!qaLayerStillSame) throw new Error("写 delivery 时改动了 QA 层字段");

console.log(JSON.stringify({
  ok: true,
  runId: d.runId,
  pack: d.pack,
  config: d.config,
  site: d.site,
  checks: Object.fromEntries(d.checks.map((c) => [c.key, c.status])),
  verdict: d.verdict,
  visualReview: d.visualReview ?? null,
  playtest: d.playtest ?? null,
  qaLayerSame,
  qaLayerStillSame,
  writing: {
    workQaReport: path.relative(ROOT, path.join(runDir, "qa-report.json")),
    snapshotQaReportUntouched: snapshotQa.delivery === undefined,
  },
}, null, 2));
