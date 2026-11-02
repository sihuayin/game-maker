#!/usr/bin/env node
// 写入 owner dispatch 的更新记录；只读 dispatch，不写回 base。
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const valueOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : undefined;
};
const outPath = valueOf("out");
if (outPath === undefined) {
  console.error("用法：node scripts/write-baseline-update-meta.mjs --out <json> --baseline <id> --candidate-sha <sha> --base-sha <sha> --base-ref <ref> --run-id <id> --workflow <name> --actor <login> --actor-id <id> --triggering-actor <login> --validation <json> --validation-outcome <outcome> --evidence-outcome <outcome>");
  process.exit(2);
}
const validationPath = valueOf("validation");
let validation = null;
if (validationPath !== undefined && fs.existsSync(validationPath)) {
  try {
    validation = JSON.parse(fs.readFileSync(validationPath, "utf8"));
  } catch {
    validation = null;
  }
}
const validationOutcome = valueOf("validation-outcome") ?? "unknown";
const evidenceOutcome = valueOf("evidence-outcome") ?? "unknown";
const pass = validationOutcome === "success" && evidenceOutcome === "success" && validation?.result === "pass";
const meta = {
  format: "baseline-update-meta/v1",
  generatedAt: new Date().toISOString(),
  baseline: valueOf("baseline") ?? null,
  candidateSha: valueOf("candidate-sha") ?? null,
  baseSha: valueOf("base-sha") ?? null,
  baseRef: valueOf("base-ref") ?? null,
  runId: valueOf("run-id") ?? null,
  workflow: valueOf("workflow") ?? null,
  operator: {
    actor: valueOf("actor") ?? null,
    actorId: valueOf("actor-id") ?? null,
    triggeringActor: valueOf("triggering-actor") ?? null,
  },
  oldManifestSha256: validation?.oldManifestSha256 ?? null,
  newManifestSha256: validation?.newManifestSha256 ?? null,
  targetManifest: validation?.targetManifest ?? null,
  targetAnchor: validation?.targetAnchor ?? null,
  targetUpdateLog: validation?.targetUpdateLog ?? null,
  freezeHashes: validation?.freezeHashes ?? null,
  validation: { outcome: validationOutcome, result: validation?.result ?? null, error: validation?.error ?? null },
  evidence: { outcome: evidenceOutcome },
  mode: "baseline-update",
  result: pass ? "pass" : "fail",
};
fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
fs.writeFileSync(path.resolve(outPath), JSON.stringify(meta, null, 2) + "\n");
console.log(`${pass ? "✅" : "❌"} baseline update meta: ${meta.baseline} · ${meta.result}`);
