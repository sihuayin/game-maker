#!/usr/bin/env node
// 校验 MANIFEST-UPDATES.md 最后一条 `newSha256` 是否等于当前 Manifest 的原始字节 SHA-256。
//
// 只做一致性检查：它证明“更新日志最后一条与当前清单对得上”，
// 不证明日志历史不可伪造 —— 后者仍由 git 历史、受保护分支与人工审查负责。
//
// 用法：node scripts/check-manifest-updates.mjs --log <MANIFEST-UPDATES.md> --manifest <expected-hashes.json>
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const args = process.argv.slice(2);
const valueOf = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : undefined;
};
const logPath = valueOf("log");
const manifestPath = valueOf("manifest");
if (logPath === undefined || manifestPath === undefined) {
  console.error("用法：node scripts/check-manifest-updates.mjs --log <MANIFEST-UPDATES.md> --manifest <expected-hashes.json>");
  process.exit(2);
}
const absLog = path.resolve(logPath);
const absManifest = path.resolve(manifestPath);
let log, manifest;
try {
  log = fs.readFileSync(absLog, "utf8");
} catch (e) {
  console.error(`✗ 读不出 MANIFEST-UPDATES：${absLog}（${e instanceof Error ? e.message : String(e)}）`);
  process.exit(1);
}
try {
  manifest = fs.readFileSync(absManifest);
} catch (e) {
  console.error(`✗ 读不出 Manifest：${absManifest}（${e instanceof Error ? e.message : String(e)}）`);
  process.exit(1);
}
const entries = [...log.matchAll(/^\s*-\s*newSha256:\s*(\S+)\s*$/gm)].map((m) => m[1]);
if (entries.length === 0) {
  console.error("✗ MANIFEST-UPDATES 没有 `- newSha256:` 记录");
  process.exit(1);
}
const last = entries[entries.length - 1];
if (!/^sha256:[0-9a-f]{64}$/.test(last)) {
  console.error(`✗ 最后一条 newSha256 格式不合法：${last}`);
  process.exit(1);
}
const actual = "sha256:" + crypto.createHash("sha256").update(manifest).digest("hex");
if (last !== actual) {
  console.error(`✗ 最后一条 newSha256 ${last} 不等于当前 Manifest ${actual}`);
  process.exit(1);
}
console.log(`✅ MANIFEST-UPDATES：最后一条 newSha256 与当前 Manifest 一致（${actual}）`);
