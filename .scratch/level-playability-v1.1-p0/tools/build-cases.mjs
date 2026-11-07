#!/usr/bin/env node
// P0-03a：从 fixtures/packs/last-train/v2 装配 A/B 两个 scratch 站点。
//
//   node .scratch/level-playability-v1.1-p0/tools/build-cases.mjs [--force] [--json]
//
// ⚠️ 只读 fixtures：资源包以拷贝方式进入 cases/<case>/site-out/<gameId>/pack/v2，
//   装配前后对 fixtures/packs/last-train/v2 做 manifest 与文件树哈希，必须不变。
// ⚠️ 不调用模型、不生图；只跑本地站点装配器（packages/demo/dist）。
// ⚠️ --force 只删除本 effort 的 cases/<case>/site-out（自产目录），绝不碰 fixtures/out。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { assembleSiteForProbe, DIST_JS, SHELL_JS } from "../../../packages/demo/probe/probe-harness.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EFFORT = path.resolve(HERE, "..");
const ROOT = path.resolve(EFFORT, "../..");
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const CASES = ["a", "b"];
const FORCE = process.argv.includes("--force");
const JSON_OUT = process.argv.includes("--json");

const sha256 = (p) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;
const walk = (root) => fs.readdirSync(root, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(root, d.name);
  return d.isDirectory() ? walk(p) : d.isFile() ? [p] : [];
});
const treeHash = (root) => {
  const rows = walk(root)
    .map((p) => `${sha256(p)}  ${path.relative(root, p).split(path.sep).join("/")}`)
    .sort();
  return `sha256:${crypto.createHash("sha256").update(rows.join("\n") + "\n").digest("hex")}`;
};

function gitStatus(target) {
  const r = spawnSync("git", ["status", "--short", "--", target], { cwd: ROOT, encoding: "utf8" });
  return (r.stdout ?? "").trim();
}

const packBefore = { manifest: sha256(path.join(PACK, "manifest.json")), tree: treeHash(PACK) };
const toolchain = {
  node: process.version,
  demoDist: { path: path.relative(ROOT, DIST_JS), sha256: sha256(DIST_JS) },
  shellJs: { path: path.relative(ROOT, SHELL_JS), sha256: sha256(SHELL_JS) },
  pack: { path: path.relative(ROOT, PACK), manifestSha256: packBefore.manifest, treeSha256: packBefore.tree },
};

const results = [];
for (const c of CASES) {
  const configPath = path.join(EFFORT, "cases", c, "game-config.json");
  const outRoot = path.join(EFFORT, "cases", c, "site-out");
  if (fs.existsSync(outRoot)) {
    if (!FORCE) throw new Error(`站点目录已存在：${path.relative(ROOT, outRoot)}（重跑请加 --force；只会删除本 effort 自产目录）`);
    fs.rmSync(outRoot, { recursive: true, force: true });
  }
  const gameId = `p0-03a-case-${c}`;
  const site = await assembleSiteForProbe({ packDir: PACK, configPath, outRoot, gameId });
  const siteDir = site.siteDir;
  const files = walk(siteDir).map((p) => ({
    path: path.relative(ROOT, p), sha256: sha256(p), bytes: fs.statSync(p).size,
  }));
  const siteJson = JSON.parse(fs.readFileSync(path.join(siteDir, "site.json"), "utf8"));
  results.push({
    case: c,
    config: path.relative(ROOT, configPath),
    configSha256: sha256(configPath),
    outRoot: path.relative(ROOT, outRoot),
    gameId,
    siteDir: path.relative(ROOT, siteDir),
    packDir: path.relative(ROOT, path.resolve(outRoot, site.data.packDir)),
    siteVersion: site.data.siteVersion,
    shellVersion: site.data.shellVersion,
    packVersion: site.data.packVersion,
    entry: path.relative(ROOT, path.join(siteDir, "index.html")),
    serveRoot: path.relative(ROOT, path.join(outRoot, gameId)),
    warnings: site.data.warnings,
    siteJson,
    files,
    siteTreeSha256: treeHash(siteDir),
    packTreeSha256: treeHash(path.resolve(outRoot, site.data.packDir)),
  });
}

const packAfter = { manifest: sha256(path.join(PACK, "manifest.json")), tree: treeHash(PACK) };
const report = {
  script: "tools/build-cases.mjs",
  scriptVersion: "p0-03a-build-cases/1",
  at: new Date().toISOString(),
  command: "node .scratch/level-playability-v1.1-p0/tools/build-cases.mjs --force --json",
  exitCode: 0,
  toolchain,
  fixtureIntegrity: {
    before: packBefore,
    after: packAfter,
    unchanged: packBefore.manifest === packAfter.manifest && packBefore.tree === packAfter.tree,
    gitStatusFixtures: gitStatus("fixtures"),
  },
  cases: results,
};

if (JSON_OUT) console.log(JSON.stringify(report, null, 2));
else {
  console.log("P0-03a case sites");
  for (const r of results) console.log(`  ${r.case}: ${r.siteDir} · site v${r.siteVersion} · pack ${r.packVersion} · warnings ${r.warnings.length}`);
  console.log(`  fixtures unchanged: ${report.fixtureIntegrity.unchanged}`);
}
if (!report.fixtureIntegrity.unchanged || report.fixtureIntegrity.gitStatusFixtures !== "")
  process.exitCode = 1;
