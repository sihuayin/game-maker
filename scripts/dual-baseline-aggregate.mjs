#!/usr/bin/env node
import { aggregateDualBaseline } from "./lib/dual-baseline-aggregate.mjs";
import { RegistryError } from "./lib/baseline-registry.mjs";

const args = process.argv.slice(2);
const valueOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : undefined;
};
const registryPath = valueOf("registry");
const repoRoot = valueOf("repo-root");
if (registryPath === undefined || repoRoot === undefined) {
  console.error("用法：node scripts/dual-baseline-aggregate.mjs --registry <registry.json> --repo-root <base> --a-outcome <outcome> --b-outcome <outcome> --b-freeze-outcome <outcome> --a-summary <json> --b-summary <json> --a-report <json> --b-report <json> --a-manifest <head path> --b-manifest <head path> --b-freeze <json> --out <aggregate.json>");
  process.exit(2);
}
try {
  const result = aggregateDualBaseline({
    registryPath,
    repoRoot,
    a: {
      outcome: valueOf("a-outcome"),
      summaryPath: valueOf("a-summary"),
      reportPath: valueOf("a-report"),
      manifestPath: valueOf("a-manifest"),
    },
    b: {
      outcome: valueOf("b-outcome"),
      freezeOutcome: valueOf("b-freeze-outcome"),
      summaryPath: valueOf("b-summary"),
      reportPath: valueOf("b-report"),
      manifestPath: valueOf("b-manifest"),
      freezePath: valueOf("b-freeze"),
    },
    outPath: valueOf("out"),
  });
  console.log(`✅ dual-baseline aggregate: ${result.pass ? "PASS" : "FAIL"}`);
  for (const p of result.problems) console.error(`   ✗ ${p}`);
  if (!result.pass) process.exitCode = 1;
} catch (e) {
  if (e instanceof RegistryError) {
    console.error(`✗ [${e.code}] ${e.message}`);
    process.exitCode = 1;
  } else {
    throw e;
  }
}
