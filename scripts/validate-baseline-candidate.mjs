#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { validateBaselineCandidate } from "./lib/baseline-candidate.mjs";
import { RegistryError } from "./lib/baseline-registry.mjs";

const args = process.argv.slice(2);
const valueOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : undefined;
};
const baseRoot = valueOf("base-root");
const candidateRoot = valueOf("candidate-root");
const baselineId = valueOf("baseline");
const changedPathsFile = valueOf("changed-paths");
const outPath = valueOf("out");
if ([baseRoot, candidateRoot, baselineId].some((v) => v === undefined)) {
  console.error("用法：node scripts/validate-baseline-candidate.mjs --base-root <base> --candidate-root <candidate> --baseline <id> [--changed-paths <file>] [--out <json>]");
  process.exit(2);
}
const changedPaths = changedPathsFile === undefined
  ? []
  : fs.readFileSync(path.resolve(changedPathsFile), "utf8").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
try {
  const result = validateBaselineCandidate({ baseRoot, candidateRoot, baselineId, changedPaths });
  if (outPath !== undefined) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outPath), JSON.stringify(result, null, 2) + "\n");
  }
  console.log(`✅ baseline candidate ${result.baselineId}: ${result.oldManifestSha256.slice(0, 19)}… -> ${result.newManifestSha256.slice(0, 19)}…`);
} catch (e) {
  if (e instanceof RegistryError) {
    const result = { format: "baseline-candidate-validation/v1", generatedAt: new Date().toISOString(), baselineId, result: "fail", error: { code: e.code, message: e.message } };
    if (outPath !== undefined) {
      fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
      fs.writeFileSync(path.resolve(outPath), JSON.stringify(result, null, 2) + "\n");
    }
    console.error(`✗ [${e.code}] ${e.message}`);
    process.exitCode = 1;
  } else {
    throw e;
  }
}
