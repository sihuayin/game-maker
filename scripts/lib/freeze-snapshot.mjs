// 112 冻结快照验证：用 base 的 freeze-sha256.txt 逐条复算 PR head 的冻结文件。
// 冻结根由 base Manifest 的 out root + identity.packId 推导；不改写 Manifest 或 hash list。
import fs from "node:fs";
import path from "node:path";
import { loadRegistry, RegistryError, sha256File } from "./baseline-registry.mjs";

function fail(code, message) {
  throw new RegistryError(code, message);
}

function walkFiles(dir) {
  const out = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      const abs = path.join(current, entry.name);
      if (entry.isDirectory()) visit(abs);
      else if (entry.isFile()) out.push(abs);
      else fail("freeze.entry", `不支持的冻结条目：${abs}`);
    }
  };
  visit(dir);
  return out;
}

export function verifyFreezeSnapshot({ registryPath, repoRoot, headRoot, baselineId, outPath }) {
  const absRepo = path.resolve(repoRoot);
  const absHead = path.resolve(headRoot);
  const { byId } = loadRegistry({ registryPath: path.resolve(registryPath), repoRoot: absRepo, requiredIds: [baselineId] });
  const entry = byId.get(baselineId);
  if (entry === undefined) fail("freeze.baseline-missing", `Registry 中没有基线 ${baselineId}`);
  if (entry.freezeHashesAbs === undefined) fail("freeze.missing", `${baselineId}: 没有 freezeHashes`);
  const manifest = entry.manifestDoc;
  const outDeclared = manifest.roots?.out;
  if (typeof outDeclared !== "string" || outDeclared.length === 0) fail("freeze.root", `${baselineId}: Manifest 没有 out root`);
  const outAbs = path.resolve(path.dirname(entry.manifestAbs), outDeclared);
  const packId = entry.identity.packId;
  const outFiles = Array.isArray(manifest.files) ? manifest.files.filter((f) => f.root === "out") : [];
  if (outFiles.length === 0) fail("freeze.root", `${baselineId}: Manifest out root 没有文件`);
  if (!outFiles.every((f) => f.path === packId || f.path.startsWith(`${packId}/`))) {
    fail("freeze.root", `${baselineId}: Manifest out 文件不以 packId(${packId}) 开头，无法推导冻结根`);
  }
  const freezeRootBase = path.join(outAbs, packId);
  const freezeRootRel = path.relative(absRepo, freezeRootBase).split(path.sep).join("/");
  const freezeRootHead = path.join(absHead, freezeRootRel);
  if (!fs.existsSync(freezeRootHead) || !fs.statSync(freezeRootHead).isDirectory()) {
    fail("freeze.root", `${baselineId}: head 冻结根不存在：${freezeRootRel}`);
  }
  const hashEntries = entry.freezeEntries;
  const expected = new Set(hashEntries.map((h) => h.path));
  const missing = [];
  const mismatched = [];
  let verified = 0;
  for (const item of hashEntries) {
    const headAbs = path.join(freezeRootHead, item.path);
    let st;
    try {
      st = fs.statSync(headAbs);
    } catch {
      missing.push(item.path);
      continue;
    }
    if (!st.isFile()) {
      missing.push(item.path);
      continue;
    }
    const actual = sha256File(headAbs);
    if (actual !== item.sha256) mismatched.push({ path: item.path, expected: item.sha256, actual });
    else verified += 1;
  }
  const extra = walkFiles(freezeRootHead)
    .map((abs) => path.relative(freezeRootHead, abs).split(path.sep).join("/"))
    .filter((rel) => !expected.has(rel));
  const pass = missing.length === 0 && mismatched.length === 0 && extra.length === 0;
  const result = {
    format: "freeze-snapshot-verification/v1",
    generatedAt: new Date().toISOString(),
    baselineId,
    hashList: path.relative(absRepo, entry.freezeHashesAbs).split(path.sep).join("/"),
    freezeRoot: freezeRootRel,
    count: hashEntries.length,
    verified,
    missing,
    mismatched,
    extra,
    pass,
  };
  if (outPath !== undefined) {
    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(path.resolve(outPath), JSON.stringify(result, null, 2) + "\n");
  }
  return result;
}
