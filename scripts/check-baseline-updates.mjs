#!/usr/bin/env node
// Registry 驱动的基线更新日志校验：A 保持旧脚本兼容；B 额外做严格字段校验。
// 旧 scripts/check-manifest-updates.mjs 零改动。
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { loadRegistry, RegistryError } from "./lib/baseline-registry.mjs";
import { parseStrictUpdateLog } from "./lib/update-log.mjs";

const args = process.argv.slice(2);
const valueOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : undefined;
};
const registryPath = valueOf("registry");
const repoRoot = valueOf("repo-root");
const onlyBaseline = valueOf("baseline");
if (registryPath === undefined || repoRoot === undefined) {
  console.error("用法：node scripts/check-baseline-updates.mjs --registry <registry.json> --repo-root <base> [--baseline <id>]");
  process.exit(2);
}

try {
  const { entries } = loadRegistry({
    registryPath: path.resolve(registryPath),
    repoRoot: path.resolve(repoRoot),
  });
  const selected = onlyBaseline === undefined ? entries : entries.filter((e) => e.id === onlyBaseline);
  if (selected.length === 0) throw new RegistryError("registry.baseline-missing", `Registry 中没有基线 ${onlyBaseline}`);
  for (const entry of selected) {
    const r = spawnSync(process.execPath, [
      path.join(repoRoot, "scripts/check-manifest-updates.mjs"),
      "--log", entry.updateLogAbs,
      "--manifest", entry.manifestAbs,
    ], { cwd: repoRoot, encoding: "utf8" });
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    if (r.error !== undefined) throw new RegistryError("log.existing-check", `${entry.id}: 无法运行旧脚本：${r.error.message}`);
    if (r.status !== 0) throw new RegistryError("log.existing-check", `${entry.id}: 旧脚本校验失败（exit ${r.status}）`);
    if (entry.id !== "fpvs-v1") parseStrictUpdateLog(fs.readFileSync(entry.updateLogAbs, "utf8"), entry);
    console.log(`✅ ${entry.id}: update log ok`);
  }
} catch (e) {
  if (e instanceof RegistryError) {
    console.error(`✗ [${e.code}] ${e.message}`);
    process.exitCode = 1;
  } else {
    throw e;
  }
}
