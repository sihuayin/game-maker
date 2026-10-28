#!/usr/bin/env node
// FA-05 最终验收一致性核对（只读、零付费）。
//
// 核对同一验收对象上：交付报告（qa-report.delivery） / CLI 与 MCP 共用的终端摘要
// （`deliverySummaryOf`） / 试玩摘要映射 / 视觉评审 —— 结论不得互相矛盾，缺席证据不得默认 pass。
// 不启动浏览器、不写 work 或快照；唯一写入本目录 consistency.json。
// 用法：node .scratch/fpvs-v1-final/runs/2026-10-28-final-acceptance/consistency.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const WORK = path.resolve(ROOT, ".scratch/fpvs-v1-final/work/wasteland-scavenger-recipe");
const RUN = path.join(WORK, "run/v1");
const ART = path.resolve(ROOT, ".scratch/fpvs-v1-final/artifacts");

const C = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);
const P = await import(pathToFileURL(path.join(ROOT, "packages/pipeline/dist/index.js")).href);

const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sha = (p) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const exists = (p) => fs.existsSync(p);

const report = readJson(path.join(RUN, "qa-report.json"));
const identity = readJson(path.join(ART, "identity.json"));
const checks = [];

function check(id, fn) {
  try {
    const v = fn();
    checks.push({ id, pass: v?.pass !== false, ...(v ?? {}) });
  } catch (e) {
    checks.push({ id, pass: false, error: e instanceof Error ? e.message : String(e) });
  }
}

const d = report.delivery;
const byKey = (key) => d?.checks?.find((c) => c.key === key);

check("report.schema", () => {
  const parsed = C.QAReportSchema.safeParse(report);
  return { pass: parsed.success, issues: parsed.success ? [] : parsed.error.issues };
});

check("delivery.present", () => ({
  pass: d !== undefined && d.site !== undefined && d.playtest !== undefined,
  hasDelivery: d !== undefined,
  hasSite: d?.site !== undefined,
  hasPlaytest: d?.playtest !== undefined,
  hasVisualReview: d?.visualReview !== undefined,
}));

check("verdict.deterministic", () => {
  const fromChecks = C.deliveryVerdictOf(d.checks);
  return {
    pass: fromChecks === d.verdict && C.DeliveryReportSchema.parse(d).verdict === d.verdict,
    declared: d.verdict,
    recomputedFromChecks: fromChecks,
  };
});

check("summary.shared-by-cli-and-mcp", () => {
  const s = P.deliverySummaryOf(d);
  return {
    pass: s.data.deliveryVerdict === d.verdict && s.summary[0].includes(d.verdict),
    verdict: d.verdict,
    summaryVerdict: s.data.deliveryVerdict,
    verdictLine: s.summary[0],
    note: "CLI create/build（cli.ts:361/402）与 MCP create_game（server.ts:407）都只调用这个纯函数；没有第二套 verdict 计算。",
  };
});

check("playtest.mapping", () => {
  const mapped = C.mapPlaytest(d.playtest);
  const smoke = byKey("playable-smoke");
  return {
    pass: mapped.status === smoke.status && (mapped.detail ?? undefined) === (smoke.detail ?? undefined),
    mapped, check: smoke,
    report: d.playtest.report,
    aggregate: d.playtest.aggregate,
  };
});

check("visual.mapping", () => {
  const checkStatus = C.visualReviewToCheck(d.visualReview.status);
  const visual = byKey("visual-review");
  return {
    pass: checkStatus === visual.status,
    visualReview: d.visualReview,
    visualCheck: visual,
    derived: checkStatus,
  };
});

check("checks.all-pass", () => ({
  pass: d.checks.length === 6 && d.checks.every((c) => c.status === "pass"),
  checks: d.checks,
}));

check("playtest.result", () => {
  const p = path.resolve(WORK, "..", d.playtest.report);
  if (!exists(p)) return { pass: false, missing: d.playtest.report };
  const r = readJson(p);
  const s = r.scenarios?.[0];
  return {
    pass: r.execution === "executed" && r.aggregate === "SUCCESS" && s?.outcome === "SUCCESS" && s?.endState?.won === true && s?.eventCounts?.reset === 0,
    path: path.relative(ROOT, p),
    aggregate: r.aggregate,
    outcome: s?.outcome,
    won: s?.endState?.won,
    collected: s?.endState?.collected,
    resets: s?.eventCounts?.reset,
    identity: r.identity,
  };
});

check("identity.three-way", () => {
  const want = identity.identity;
  const r = readJson(path.resolve(WORK, "..", d.playtest.report));
  const p = r.identity;
  return {
    pass:
      d.pack.packId === want.packId && d.pack.packVersion === want.packVersion &&
      d.site.version === want.siteVersion && d.site.shell === want.shellVersion &&
      p.packId === want.packId && p.packVersion === want.packVersion &&
      p.siteVersion === want.siteVersion && p.shellVersion === want.shellVersion &&
      p.configChecksum === want.runConfigSha256 && p.packChecksum === want.manifestChecksumFromReport &&
      sha(path.join(WORK, "site/v1/game-config.json")) === want.siteConfigSha256,
    delivery: { pack: d.pack, site: d.site },
    playtest: p,
    frozen: want,
  };
});

check("evidence.refs-exist", () => {
  const missing = d.evidence.filter((e) => !exists(path.resolve(WORK, "..", e.path))).map((e) => e.path);
  return { pass: missing.length === 0, total: d.evidence.length, missing };
});

check("no-missing-evidence-defaults-pass", () => {
  // 缺席证据必须明示「尚无结论」，不能默认 pass：这里把必需段缺席的三种情况逐一验证。
  const noPlaytest = { ...d, playtest: undefined };
  const noVisual = { ...d, visualReview: { status: "pending" } };
  const noReport = P.deliverySummaryOf(undefined);
  return {
    pass:
      C.mapPlaytest(undefined).status === "blocked" &&
      C.visualReviewToCheck("pending") === "incomplete" &&
      noReport.data.deliveryVerdict === null &&
      noPlaytest.playtest === undefined && noVisual.visualReview.status === "pending",
    missingPlaytestMapsTo: C.mapPlaytest(undefined),
    pendingVisualMapsTo: C.visualReviewToCheck("pending"),
    absentDeliverySummary: noReport.summary[0],
  };
});

check("report.text-consistent", () => {
  const md = fs.readFileSync(path.join(HERE, "final-acceptance.md"), "utf8");
  return {
    pass: new RegExp(`最终(验收)?结论[：:]\\s*\`${d.verdict}\``).test(md) && md.includes(`delivery.verdict = ${d.verdict}`),
    note: "报告文本的最终结论必须与 delivery.verdict 一致。",
  };
});

const failed = checks.filter((c) => c.pass === false);
const out = {
  format: "fpvs-final-acceptance-consistency/v1",
  generatedAt: new Date().toISOString(),
  subject: {
    run: "wasteland-scavenger-recipe/run/v1",
    report: path.relative(ROOT, path.join(RUN, "qa-report.json")),
    reportSha256: sha(path.join(RUN, "qa-report.json")),
    verdict: d?.verdict,
  },
  verdict: failed.length === 0 ? "pass" : "fail",
  checksFailed: failed.length,
  checks,
};
fs.writeFileSync(path.join(HERE, "consistency.json"), JSON.stringify(out, null, 2) + "\n");
for (const c of checks) console.log(`${c.pass ? "✅" : "❌"} ${c.id}${c.pass ? "" : "  ← " + JSON.stringify(c.error ?? c)}`);
console.log(`\n${out.verdict.toUpperCase()} · ${checks.length - failed.length}/${checks.length} · → consistency.json`);
process.exitCode = failed.length === 0 ? 0 : 1;
