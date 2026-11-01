#!/usr/bin/env node
import { verifyFreezeSnapshot } from "./lib/freeze-snapshot.mjs";
import { RegistryError } from "./lib/baseline-registry.mjs";

const args = process.argv.slice(2);
const valueOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : undefined;
};
const registryPath = valueOf("registry");
const repoRoot = valueOf("repo-root");
const headRoot = valueOf("head-root");
const baselineId = valueOf("baseline-id");
const outPath = valueOf("out");
if ([registryPath, repoRoot, headRoot, baselineId].some((v) => v === undefined)) {
  console.error("用法：node scripts/verify-freeze-snapshot.mjs --registry <registry.json> --baseline-id <id> --repo-root <base> --head-root <pr> [--out <json>]");
  process.exit(2);
}
try {
  const result = verifyFreezeSnapshot({ registryPath, repoRoot, headRoot, baselineId, outPath });
  console.log(`✅ freeze snapshot ${result.baselineId}: ${result.verified}/${result.count} verified · missing ${result.missing.length} · mismatch ${result.mismatched.length} · extra ${result.extra.length}`);
  if (!result.pass) process.exitCode = 1;
} catch (e) {
  if (e instanceof RegistryError) {
    console.error(`✗ [${e.code}] ${e.message}`);
    process.exitCode = 1;
  } else {
    throw e;
  }
}
