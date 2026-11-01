// 双基线 Registry：解析、严格校验、路径与身份绑定。
// Registry 只声明身份与路径，不存摘要；摘要只来自各基线的 Anchor。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export const REGISTRY_FORMAT = "baseline-registry/v1";
export const DEFAULT_REQUIRED_IDS = ["fpvs-v1", "p0-02-second-demo-v2"];
export const ID_PATTERN = /^[a-z0-9][a-z0-9._-]{0,63}$/;
export const SHA256_RE = /^sha256:[0-9a-f]{64}$/;

export class RegistryError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RegistryError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new RegistryError(code, message);
}

export function sha256Bytes(buf) {
  return "sha256:" + crypto.createHash("sha256").update(buf).digest("hex");
}

export function sha256File(p) {
  return sha256Bytes(fs.readFileSync(p));
}

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function assertExactKeys(obj, allowed, where) {
  for (const key of Object.keys(obj)) {
    if (!allowed.includes(key)) fail("registry.unknown-field", `${where}: 未知字段 ${key}`);
  }
}

function validateRelPath(p, where) {
  if (typeof p !== "string" || p.length === 0) fail("registry.path-invalid", `${where}: 路径为空`);
  if (p.includes("\\")) fail("registry.path-invalid", `${where}: 不允许反斜杠：${p}`);
  if (p.startsWith("/")) fail("registry.path-invalid", `${where}: 不允许绝对路径：${p}`);
  if (p.split("/").some((part) => part === "" || part === "." || part === "..")) {
    fail("registry.path-invalid", `${where}: 路径含空段/./..：${p}`);
  }
  if (path.posix.normalize(p) !== p) fail("registry.path-invalid", `${where}: 路径未规范化：${p}`);
  return p;
}

function resolveFileInside(repoRoot, rel, where) {
  validateRelPath(rel, where);
  const abs = path.resolve(repoRoot, rel);
  let real;
  try {
    real = fs.realpathSync(abs);
  } catch (e) {
    fail("registry.file-missing", `${where}: 文件不存在：${rel}（${e instanceof Error ? e.message : String(e)}）`);
  }
  let rootReal;
  try {
    rootReal = fs.realpathSync(repoRoot);
  } catch (e) {
    fail("registry.path-invalid", `${where}: repo root 不可解析：${repoRoot}`);
  }
  const relToRoot = path.relative(rootReal, real);
  if (relToRoot === "" || relToRoot.startsWith("..") || path.isAbsolute(relToRoot)) {
    fail("registry.path-invalid", `${where}: realpath 越出仓库：${rel} -> ${real}`);
  }
  let st;
  try {
    st = fs.statSync(real);
  } catch (e) {
    fail("registry.file-missing", `${where}: 无法 stat：${rel}`);
  }
  if (!st.isFile()) fail("registry.path-invalid", `${where}: 不是普通文件：${rel}`);
  return { abs, real, rel };
}

export function parseFreezeHashList(text, where = "freezeHashes") {
  const entries = [];
  const seen = new Set();
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === "") continue;
    const m = line.match(/^([0-9a-f]{64})\s+(.+)$/);
    if (m === null) fail("freeze.format", `${where}:${i + 1}: 期望 "<64hex>  <path>"，实际：${line}`);
    const rel = m[2].trim();
    validateRelPath(rel, `${where}:${i + 1}`);
    if (seen.has(rel)) fail("freeze.duplicate", `${where}: 重复路径 ${rel}`);
    seen.add(rel);
    entries.push({ sha256: "sha256:" + m[1], path: rel });
  }
  if (entries.length === 0) fail("freeze.empty", `${where}: 没有条目`);
  return entries;
}

export function parseRegistry(raw, source = "registry.json") {
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    fail("registry.parse", `${source}: 不是合法 JSON（${e instanceof Error ? e.message : String(e)}）`);
  }
  if (!isPlainObject(json)) fail("registry.parse", `${source}: 顶层必须是对象`);
  assertExactKeys(json, ["format", "baselines"], source);
  if (json.format !== REGISTRY_FORMAT) fail("registry.format", `${source}: format 必须是 ${REGISTRY_FORMAT}`);
  if (!Array.isArray(json.baselines) || json.baselines.length === 0) {
    fail("registry.parse", `${source}: baselines 必须是非空数组`);
  }
  const ids = new Set();
  const baselines = json.baselines.map((entry, i) => {
    const where = `${source}:baselines[${i}]`;
    if (!isPlainObject(entry)) fail("registry.parse", `${where}: 必须是对象`);
    assertExactKeys(entry, ["id", "name", "manifestFormat", "manifest", "anchor", "updateLog", "identity", "freezeHashes"], where);
    for (const key of ["id", "name", "manifestFormat", "manifest", "anchor", "updateLog"]) {
      if (typeof entry[key] !== "string" || entry[key].length === 0) fail("registry.parse", `${where}: ${key} 必须是非空字符串`);
    }
    if (!ID_PATTERN.test(entry.id)) fail("registry.id", `${where}: id 不合法：${entry.id}`);
    if (ids.has(entry.id)) fail("registry.duplicate-id", `${where}: 重复基线 id：${entry.id}`);
    ids.add(entry.id);
    if (entry.freezeHashes !== undefined && (typeof entry.freezeHashes !== "string" || entry.freezeHashes.length === 0)) {
      fail("registry.parse", `${where}: freezeHashes 必须是非空字符串`);
    }
    if (!isPlainObject(entry.identity)) fail("registry.parse", `${where}: identity 必须是对象`);
    assertExactKeys(entry.identity, ["packId", "packVersion", "siteVersion", "shellVersion"], `${where}.identity`);
    if (typeof entry.identity.packId !== "string" || entry.identity.packId.length === 0) fail("registry.identity", `${where}: identity.packId 必须是非空字符串`);
    if (!Number.isInteger(entry.identity.packVersion) || entry.identity.packVersion <= 0) fail("registry.identity", `${where}: identity.packVersion 必须是正整数`);
    if (!Number.isInteger(entry.identity.siteVersion) || entry.identity.siteVersion <= 0) fail("registry.identity", `${where}: identity.siteVersion 必须是正整数`);
    if (typeof entry.identity.shellVersion !== "string" || entry.identity.shellVersion.length === 0) fail("registry.identity", `${where}: identity.shellVersion 必须是非空字符串`);
    return entry;
  });
  return { format: json.format, baselines };
}

function readManifestAt(abs, where) {
  let raw;
  try {
    raw = fs.readFileSync(abs, "utf8");
  } catch (e) {
    fail("registry.manifest", `${where}: 读不出 Manifest：${e instanceof Error ? e.message : String(e)}`);
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    fail("registry.manifest", `${where}: Manifest 不是合法 JSON`);
  }
  if (!isPlainObject(doc)) fail("registry.manifest", `${where}: Manifest 顶层必须是对象`);
  if (typeof doc.format !== "string") fail("registry.manifest", `${where}: Manifest 缺少 format`);
  if (!isPlainObject(doc.subject)) fail("registry.manifest", `${where}: Manifest 缺少 subject`);
  return doc;
}

function assertIdentityMatches(entry, manifest, where) {
  for (const key of ["packId", "packVersion", "siteVersion", "shellVersion"]) {
    if (manifest.subject[key] !== entry.identity[key]) {
      fail("registry.identity-mismatch", `${where}: identity.${key}=${JSON.stringify(entry.identity[key])} 与 Manifest subject.${key}=${JSON.stringify(manifest.subject[key])} 不一致`);
    }
  }
}

function lastUpdateLogSha(text) {
  const entries = [...text.matchAll(/^\s*-\s*newSha256:\s*(\S+)\s*$/gm)].map((m) => m[1]);
  return entries.length === 0 ? undefined : entries[entries.length - 1];
}

export function loadRegistry({ registryPath, repoRoot, requiredIds = DEFAULT_REQUIRED_IDS, exactIds = false }) {
  const absRegistry = path.resolve(registryPath);
  const absRepo = path.resolve(repoRoot);
  let raw;
  try {
    raw = fs.readFileSync(absRegistry, "utf8");
  } catch (e) {
    fail("registry.file-missing", `读不出 Registry：${absRegistry}（${e instanceof Error ? e.message : String(e)}）`);
  }
  const registry = parseRegistry(raw, absRegistry);
  const idSet = new Set(registry.baselines.map((b) => b.id));
  for (const id of requiredIds) {
    if (!idSet.has(id)) fail("registry.baseline-missing", `缺少必需基线：${id}`);
  }
  if (exactIds) {
    const expected = [...requiredIds].sort();
    const actual = [...idSet].sort();
    if (expected.length !== actual.length || expected.some((id, i) => id !== actual[i])) {
      fail("registry.baseline-set", `基线集合必须是 ${expected.join(", ")}；实际 ${actual.join(", ")}`);
    }
  }
  const seenPaths = new Map();
  const seenDirs = new Map();
  const entries = registry.baselines.map((entry, i) => {
    const where = `${absRegistry}:${entry.id}`;
    const manifest = resolveFileInside(absRepo, entry.manifest, `${where}.manifest`);
    const anchor = resolveFileInside(absRepo, entry.anchor, `${where}.anchor`);
    const updateLog = resolveFileInside(absRepo, entry.updateLog, `${where}.updateLog`);
    for (const [kind, item] of [["manifest", manifest], ["anchor", anchor], ["updateLog", updateLog]]) {
      const prev = seenPaths.get(item.rel);
      if (prev !== undefined) fail("registry.path-collision", `${where}: ${kind} 路径与基线 ${prev} 重复：${item.rel}`);
      seenPaths.set(item.rel, entry.id);
    }
    const dir = path.posix.dirname(entry.manifest);
    if (path.posix.dirname(entry.anchor) !== dir || path.posix.dirname(entry.updateLog) !== dir) {
      fail("registry.path-binding", `${where}: Manifest/Anchor/更新日志必须同目录`);
    }
    const prevDir = seenDirs.get(dir);
    if (prevDir !== undefined) fail("registry.cross-binding", `${where}: 目录与基线 ${prevDir} 重复：${dir}`);
    seenDirs.set(dir, entry.id);
    const manifestDoc = readManifestAt(manifest.abs, `${where}.manifest`);
    if (manifestDoc.format !== entry.manifestFormat) {
      fail("registry.manifest-format", `${where}: manifestFormat=${entry.manifestFormat} 与 Manifest format=${manifestDoc.format} 不一致`);
    }
    assertIdentityMatches(entry, manifestDoc, where);
    const manifestSha = sha256File(manifest.abs);
    const anchorText = fs.readFileSync(anchor.abs, "utf8").trim();
    if (!SHA256_RE.test(anchorText)) fail("registry.anchor-format", `${where}: Anchor 必须是单行 sha256:<64hex>`);
    if (anchorText !== manifestSha) fail("registry.anchor-mismatch", `${where}: Anchor ${anchorText} 不等于 Manifest ${manifestSha}`);
    const logText = fs.readFileSync(updateLog.abs, "utf8");
    const logSha = lastUpdateLogSha(logText);
    if (logSha === undefined) fail("registry.update-log", `${where}: 更新日志缺少 newSha256`);
    if (logSha !== manifestSha) fail("registry.update-log-mismatch", `${where}: 更新日志最后一条 ${logSha} 不等于 Manifest ${manifestSha}`);
    let freezeHashes;
    let freezeEntries;
    if (entry.freezeHashes !== undefined) {
      freezeHashes = resolveFileInside(absRepo, entry.freezeHashes, `${where}.freezeHashes`);
      const prev = seenPaths.get(freezeHashes.rel);
      if (prev !== undefined && prev !== entry.id) fail("registry.path-collision", `${where}: freezeHashes 路径与基线 ${prev} 重复：${freezeHashes.rel}`);
      seenPaths.set(freezeHashes.rel, entry.id);
      freezeEntries = parseFreezeHashList(fs.readFileSync(freezeHashes.abs, "utf8"), `${where}.freezeHashes`);
    } else if (entry.id !== "fpvs-v1") {
      fail("registry.freeze-missing", `${where}: 非 legacy 基线必须声明 freezeHashes`);
    }
    return {
      ...entry,
      manifestAbs: manifest.abs,
      anchorAbs: anchor.abs,
      updateLogAbs: updateLog.abs,
      freezeHashesAbs: freezeHashes?.abs,
      manifestDoc,
      manifestSha,
      freezeEntries,
    };
  });
  return { registry, entries, byId: new Map(entries.map((e) => [e.id, e])) };
}

export function relativeManifestPath(repoRoot, manifestAbs) {
  return path.relative(repoRoot, manifestAbs).split(path.sep).join("/");
}
