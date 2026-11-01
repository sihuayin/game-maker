#!/usr/bin/env node
// 校验 .scratch/baselines/registry.json：严格 schema、路径、身份、Anchor、更新日志、freezeHashes。
// 只读；不修改任何文件。
import path from "node:path";
import { loadRegistry, RegistryError, DEFAULT_REQUIRED_IDS } from "./lib/baseline-registry.mjs";

const args = process.argv.slice(2);
const valueOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : undefined;
};
const registryPath = valueOf("registry");
const repoRoot = valueOf("repo-root");
if (registryPath === undefined || repoRoot === undefined) {
  console.error("用法：node scripts/validate-baseline-registry.mjs --registry <registry.json> --repo-root <base> [--require-ids a,b] [--exact-ids]");
  process.exit(2);
}
const requiredIds = valueOf("require-ids")?.split(",").map((s) => s.trim()).filter(Boolean) ?? DEFAULT_REQUIRED_IDS;
const exactIds = args.includes("--exact-ids");
try {
  const { entries } = loadRegistry({
    registryPath: path.resolve(registryPath),
    repoRoot: path.resolve(repoRoot),
    requiredIds,
    exactIds,
  });
  console.log(`✅ baseline registry：${entries.length} 套基线`);
  for (const entry of entries) {
    const freeze = entry.freezeEntries === undefined ? "" : ` · freezeHashes ${entry.freezeEntries.length} 条`;
    console.log(`   - ${entry.id}: manifest ${entry.manifestSha.slice(0, 19)}… · anchor matched · update log matched${freeze}`);
  }
} catch (e) {
  if (e instanceof RegistryError) {
    console.error(`✗ [${e.code}] ${e.message}`);
    process.exitCode = 1;
  } else {
    throw e;
  }
}
