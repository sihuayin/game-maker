#!/usr/bin/env node
// 07 继承证据机械核对（effort 脚本，不改产品读取路径 / 不改历史记录）。
// 用法：node .scratch/generic-playtest-v1/scripts/07-verify-inherited.mjs
// 退出码：0 = 全部核对通过；1 = 有失败项（明细见 07-inherited-verification.json）。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  deriveDeliveryVerdict, DELIVERY_REQUIRED_CHECKS, playtestProjectionOf, samePlaytestProjection,
} from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const P = (rel) => path.join(ROOT, rel);
const read = (rel) => JSON.parse(fs.readFileSync(P(rel), "utf8"));
const sha = (rel) => {
  try { return "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(P(rel))).digest("hex"); }
  catch { return null; }
};
const checks = [];
const add = (id, pass, detail) => checks.push({ id, pass: !!pass, detail });
const allPass = (xs) => xs.every((x) => x.pass);

const ID = "artifacts/identity.json".replace(/^/, ".scratch/fpvs-v1-final/");
const identity = read(ID).identity;
const qaRel = ".scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/qa-report.json";
const qa = read(qaRel);
const delivery = qa.delivery;
const vr = ".scratch/fpvs-v1-final/runs/2026-10-28-visual-review";
const review = read(`${vr}/review-record.json`);
const capture = read(`${vr}/capture.json`);
const materials = read(`${vr}/materials.json`);
const fa05 = ".scratch/fpvs-v1-final/runs/2026-10-28-final-acceptance";
const evidence = read(`${fa05}/evidence.json`);
const consistency = read(`${fa05}/consistency.json`);
const fa06 = read(".scratch/fpvs-v1-final/runs/2026-10-28-regression-closure/regression.json");
const supplement = read(".scratch/generic-playtest-v1/evidence/09-review-record.supplement.json");

// ── 1. delivery ↔ identity ────────────────────────────────────────────────
add("identity.delivery.pack", delivery.pack.packId === identity.packId && delivery.pack.packVersion === identity.packVersion,
  { delivery: delivery.pack, identity: { packId: identity.packId, packVersion: identity.packVersion } });
add("identity.delivery.manifest", delivery.pack.manifestChecksum === identity.manifestFileSha256,
  { declared: delivery.pack.manifestChecksum, actual: identity.manifestFileSha256 });
add("identity.delivery.site-shell", delivery.site.version === 1 && String(delivery.site.shell) === "2",
  delivery.site);
add("identity.delivery.config",
  String(delivery.config.file).endsWith(identity.configFile) && sha(".scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/game-config.json") === identity.siteConfigSha256,
  { declared: delivery.config.file, actual: sha(".scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/game-config.json"), expected: identity.siteConfigSha256 });
add("identity.manifest-file", sha(".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/pack/v1/manifest.json") === identity.manifestFileSha256,
  sha(".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/pack/v1/manifest.json"));
add("identity.site-config-file", sha(".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/site/v1/game-config.json") === identity.siteConfigSha256,
  sha(".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/site/v1/game-config.json"));

// ── 2. FA-04 review-record / capture / materials ↔ delivery ───────────────
const sameSubject = (s) => s && s.packId === delivery.pack.packId && s.packVersion === delivery.pack.packVersion
  && s.siteVersion === delivery.site.version && String(s.shellVersion) === String(delivery.site.shell)
  && s.manifestChecksum === delivery.pack.manifestChecksum
  && s.configChecksum === identity.siteConfigSha256;
add("inherit.review-record.subject", sameSubject(review.subject), review.subject);
add("inherit.capture.subject", sameSubject(capture.subject), capture.subject);
add("inherit.materials.subject", sameSubject(materials.subject), materials.subject);
add("inherit.review-record.overall", review.overall === "pass" && review.items.every((i) => i.verdict === "pass"),
  { overall: review.overall, items: review.items.map((i) => [i.id, i.verdict]) });

// ── 3. materials 逐文件哈希 + 快照 frozen ─────────────────────────────────
const matEntries = [
  ...(materials.materials.reference ?? []),
  ...(materials.materials.deliveredAssets ?? []),
  ...(materials.materials.visualContext ?? []),
  ...(materials.generated ?? []),
];
const matFailures = [];
for (const e of matEntries) {
  const actual = sha(e.path);
  if (actual !== e.sha256) matFailures.push({ path: e.path, kind: "work-hash", expected: e.sha256, actual });
  if (e.snapshotSha256 !== undefined) {
    const snap = e.path.replace(".scratch/fpvs-v1-final/work/", ".scratch/fpvs-v1-final/artifacts/");
    const snapActual = sha(snap);
    // 快照本身必须与记录一致；`frozen:"match"` 还要求工作区与快照逐字节相同。
    // `frozen:"differs"` 只允许 qa-report.json：它是 FA-02/FA-04 的预期写回对象（见 FA-05 §1）。
    if (snapActual !== e.snapshotSha256) {
      matFailures.push({ path: e.path, kind: "snapshot-hash", expected: e.snapshotSha256, actual: snapActual, frozen: e.frozen });
    } else if (e.frozen === "match" && snapActual !== actual) {
      matFailures.push({ path: e.path, kind: "work-vs-snapshot", expected: e.snapshotSha256, actual, frozen: e.frozen });
    } else if (e.frozen !== "match" && !e.path.endsWith("/run/v1/qa-report.json")) {
      matFailures.push({ path: e.path, kind: "unexpected-differs", expected: e.snapshotSha256, actual, frozen: e.frozen });
    }
  }
}
add("inherit.materials.hashes", matFailures.length === 0 && matEntries.length === 17 + 27,
  { checked: matEntries.length, failures: matFailures });

// ── 4. capture shots + site integrity ─────────────────────────────────────
const shotHashes = capture.shots.map((s) => ({ file: s.file, sha: sha(`${vr}/${s.file}`) }));
const distinct = new Set(shotHashes.map((s) => s.sha));
add("inherit.capture.shots", shotHashes.every((s) => s.sha) && distinct.size === 8 && shotHashes.length === 9,
  { files: shotHashes.length, distinct: distinct.size, duplicate: ["shots/08-goal.png", "shots/09-final.png"] });
add("inherit.capture.site-integrity", capture.siteIntegrity.unchanged
  && JSON.stringify(capture.siteIntegrity.before) === JSON.stringify(capture.siteIntegrity.after),
  capture.siteIntegrity.unchanged);
const siteFiles = {
  "index.html": ".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/site/v1/index.html",
  "shell.js": ".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/site/v1/shell.js",
  "site.json": ".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/site/v1/site.json",
  "game-config.json": ".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe/site/v1/game-config.json",
};
add("inherit.capture.site-files", Object.entries(siteFiles).every(([k, p]) => sha(p) === capture.siteIntegrity.before[k]),
  Object.fromEntries(Object.entries(siteFiles).map(([k, p]) => [k, sha(p)])));

// ── 5. QA evidence 36/36 + consistency 12/12 ──────────────────────────────
const evFailures = evidence.files.map((f) => ({ path: f.path, expected: f.sha256, actual: sha(f.path) }))
  .filter((f) => f.actual !== f.expected);
add("inherit.fa05.evidence", evidence.files.length === 36 && evFailures.length === 0,
  { count: evidence.files.length, failures: evFailures });
add("inherit.fa05.consistency", consistency.checks.length === 12 && consistency.checksFailed === 0
  && consistency.checks.every((c) => c.pass), { count: consistency.checks.length, failed: consistency.checksFailed });
add("inherit.fa05.report-hash", sha(qaRel) === consistency.subject.reportSha256,
  { actual: sha(qaRel), expected: consistency.subject.reportSha256 });

// ── 6. 历史 delivery verdict 重算 ─────────────────────────────────────────
const presentKeys = delivery.checks.map((c) => c.key);
const missingKeys = DELIVERY_REQUIRED_CHECKS.filter((k) => !presentKeys.includes(k));
const required = delivery.checks.filter((c) => DELIVERY_REQUIRED_CHECKS.includes(c.key))
  .map((c) => ({ status: c.status, required: true }));
const recomputed = deriveDeliveryVerdict(required);
add("delivery.verdict", missingKeys.length === 0 && recomputed === delivery.verdict && delivery.verdict === "pass",
  { declared: delivery.verdict, recomputed, missingKeys, checks: delivery.checks });
add("delivery.visual+playtest", delivery.visualReview?.status === "pass"
  && delivery.playtest?.aggregate === "SUCCESS"
  && delivery.playtest?.scenarios?.[0]?.outcome === "SUCCESS",
  { visual: delivery.visualReview?.status, aggregate: delivery.playtest?.aggregate });

// ── 7. FA-06 回归基线 ─────────────────────────────────────────────────────
add("inherit.fa06.regression", fa06.commands.length === 4 && fa06.commands.every((c) => c.exitCode === 0),
  fa06.commands.map((c) => [c.name, c.exitCode]));

// ── 8. 本轮 06 真实试玩（两份 attempt + 投影）────────────────────────────
const attempts = [1, 2].map((n) => {
  const base = `.scratch/generic-playtest-v1/evidence/06-attempt-${n}/attempt-v1`;
  const result = read(`${base}/result.json`);
  const s = result.scenarios[0];
  const integ = read(`${base}/site-integrity.json`);
  const strategy = read(`${base}/acceptance-win-wasteland-v1/strategy.json`);
  return { n, base, result, s, integ, strategy };
});
const idMatch = (r) => r.identity.packId === delivery.pack.packId
  && r.identity.packVersion === delivery.pack.packVersion
  && r.identity.siteVersion === delivery.site.version
  && String(r.identity.shellVersion) === String(delivery.site.shell)
  && r.identity.packChecksum === delivery.pack.manifestChecksum
  && r.identity.configChecksum === identity.siteConfigSha256;
const attemptChecks = attempts.map(({ n, s, integ, strategy, result }) => ({
  attempt: n,
  identity: idMatch(result),
  success: s.assertionAggregate === "pass" && s.terminationReached === true
    && s.endState.won === true && s.endState.collected === 6 && s.endState.chestsOpened === 2
    && s.endState.hits === 0 && s.endState.activePickups === 0
    && (s.eventCounts.reset ?? 0) === 0 && (s.eventCounts["danger-hit"] ?? 0) === 0
    && (s.eventCounts["runtime-error"] ?? 0) === 0,
  noStop: (s.stop ?? null) === null && (strategy.stop ?? null) === null,
  siteUnchanged: integ.unchanged === true,
  contractVersion: [result.identity.harnessVersion, result.identity.rulesVersion],
}));
add("round06.attempts", attemptChecks.every((a) => a.identity && a.success && a.noStop && a.siteUnchanged), attemptChecks);
const pa = playtestProjectionOf(attempts[0].s), pb = playtestProjectionOf(attempts[1].s);
add("round06.projection", samePlaytestProjection(pa, pb), { same: samePlaytestProjection(pa, pb), steps: attempts.map((a) => a.s.steps) });

// ── 9. 快照 50 文件运行前后一致 ───────────────────────────────────────────
const snapRoot = ".scratch/fpvs-v1-final/artifacts/wasteland-scavenger-recipe";
const listFiles = (dir) => fs.readdirSync(P(dir), { withFileTypes: true }).flatMap((d) => {
  const rel = `${dir}/${d.name}`;
  return d.isDirectory() ? listFiles(rel) : [rel];
});
const now = Object.fromEntries([...listFiles(`${snapRoot}/site`), ...listFiles(`${snapRoot}/pack`)]
  .map((p) => [p.replace(`${snapRoot}/`, ""), sha(p)]));
const before = read(".scratch/generic-playtest-v1/evidence/06-snapshot-before.json");
const after1 = read(".scratch/generic-playtest-v1/evidence/06-snapshot-after-1.json");
const after2 = read(".scratch/generic-playtest-v1/evidence/06-snapshot-after-2.json");
const canon = (m) => JSON.stringify(Object.keys(m).sort().map((k) => [k, m[k]]));
const normMap = (m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v).replace(/^sha256:/, "")]));
const sameMaps = [before, after1, after2].every((m) => canon(normMap(m.files)) === canon(normMap(now)));
add("snapshot.50-files", Object.keys(now).length === 50 && sameMaps,
  { count: Object.keys(now).length, sameAsBeforeAfter1After2: sameMaps });

// ── 10. 09 补审记录 ───────────────────────────────────────────────────────
add("supplement.subject", sameSubject(supplement.subject), supplement.subject);
add("supplement.items", supplement.overall === "pass" && supplement.items.length === 4
  && supplement.items.every((i) => i.verdict === "pass") && (supplement.problems ?? []).length === 0,
  { overall: supplement.overall, items: supplement.items.map((i) => [i.id, i.verdict]) });
add("supplement.fa04-unmodified", Object.entries(supplement.constraints.historicalRecordHashes)
  .every(([f, h]) => sha(`${vr}/${f}`) === h),
  supplement.constraints.historicalRecordHashes);
add("supplement.scope", supplement.constraints.distinctFramesNotNine === true
  && supplement.constraints.fullSevenItemReReview === false
  && supplement.constraints.historicalRecordModified === false,
  supplement.constraints);

const failed = checks.filter((c) => !c.pass);
const out = {
  format: "fpvs-inherited-verification/v1",
  generatedAt: new Date().toISOString(),
  subject: {
    packId: delivery.pack.packId, packVersion: delivery.pack.packVersion,
    siteVersion: delivery.site.version, shellVersion: String(delivery.site.shell),
    manifestChecksum: delivery.pack.manifestChecksum, configChecksum: identity.siteConfigSha256,
    qaReport: qaRel, qaReportSha256: sha(qaRel),
  },
  summary: { checks: checks.length, failed: failed.length, pass: failed.length === 0 },
  deliveryVerdict: { declared: delivery.verdict, recomputed, required: required.map((r) => r.status) },
  checks,
};
const outPath = P(".scratch/generic-playtest-v1/evidence/07-inherited-verification.json");
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n");
console.log(`checks=${checks.length} failed=${failed.length} pass=${failed.length === 0}`);
for (const f of failed) console.log("FAIL", f.id, JSON.stringify(f.detail));
process.exitCode = failed.length === 0 ? 0 : 1;
