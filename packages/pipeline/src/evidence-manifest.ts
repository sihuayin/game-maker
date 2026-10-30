// **正式证据清单的生成核心**（P0-02 v2 票 07 / 票 13）。
//
// ⚠️ 输入是 spec（`delivery-evidence-manifest-spec/v1`），输出是既有的
//   `delivery-evidence-manifest/v1`；不新增清单 schema。
// ⚠️ 生成器负责：展开 entries、确定性排序、计算 sha256/bytes、校验 records 都在 files 里、
//   校验 subject 与实际 pack manifest / config 字节及 qa-report.delivery 一致。
// ⚠️ `--out` 必须在所有声明 root 之外；默认拒绝覆盖，`--force` 才重建；临时文件 + rename。
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { CommandError, QAReportSchema } from "@game-maker/contracts";
import {
  EvidenceManifestRecordSchema, EvidenceManifestSchema, ManifestSubjectSchema, assertOutOutsideRoots,
  type EvidenceManifest, type EvidenceRootPath,
} from "./evidence-integrity.js";

export const EVIDENCE_MANIFEST_SPEC_FORMAT = "delivery-evidence-manifest-spec/v1" as const;

const Sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/);
const EntryBase = {
  root: z.string().min(1),
  path: z.string().min(1),
  role: z.string().min(1),
  required: z.boolean(),
};
export const EvidenceManifestSpecEntrySchema = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("file"), ...EntryBase }),
  z.strictObject({
    kind: z.literal("dir"), ...EntryBase,
    excludeExt: z.array(z.string().min(1)).default([]),
    excludeDirs: z.array(z.string().min(1)).default([]),
  }),
]);
export type EvidenceManifestSpecEntry = z.infer<typeof EvidenceManifestSpecEntrySchema>;

export const EvidenceManifestSpecSchema = z.strictObject({
  format: z.literal(EVIDENCE_MANIFEST_SPEC_FORMAT),
  subject: ManifestSubjectSchema,
  roots: z.record(z.string().min(1), z.string().min(1)),
  entries: z.array(EvidenceManifestSpecEntrySchema).min(1),
  records: z.array(EvidenceManifestRecordSchema),
  generatedBy: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
});
export type EvidenceManifestSpec = {
  format: typeof EVIDENCE_MANIFEST_SPEC_FORMAT;
  subject: {
    packId: string; packVersion: number; siteVersion: number; shellVersion: string;
    manifestChecksum: string; configChecksum: string;
  };
  roots: Record<string, string>;
  entries: EvidenceManifestSpecEntry[];
  records: Array<{ root: string; path: string; role: string; required: boolean; identity: boolean }>;
  generatedBy?: string;
  note?: string;
};

const sha = (p: string): string => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;
const readJson = (p: string): unknown => JSON.parse(fs.readFileSync(p, "utf8"));
function fail(msg: string): never { throw new CommandError("invalid", msg); }

function inside(root: string, abs: string): boolean {
  const rel = path.relative(root, abs);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function walkDir(absDir: string, excludeExt: readonly string[], excludeDirs: readonly string[]): string[] {
  if (!fs.existsSync(absDir)) fail(`目录条目不存在：${absDir}`);
  if (!fs.statSync(absDir).isDirectory()) fail(`目录条目的不是目录：${absDir}`);
  const out: string[] = [];
  for (const d of fs.readdirSync(absDir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const abs = path.join(absDir, d.name);
    if (d.isDirectory()) {
      if (excludeDirs.includes(d.name)) continue;
      out.push(...walkDir(abs, excludeExt, excludeDirs));
    } else if (d.isFile()) {
      if (excludeExt.some((e) => d.name.endsWith(e))) continue;
      out.push(abs);
    } else {
      fail(`目录里有不支持的条目（符号链接/设备）：${abs}`);
    }
  }
  return out;
}

export type BuiltEvidenceManifest = {
  manifest: EvidenceManifest;
  outPath: string;
  files: number;
  required: number;
  records: number;
};

/** spec → manifest。失败一律 `CommandError("invalid")`（CLI exit 4），覆盖拒绝除外（exit 2）。 */
export function buildEvidenceManifest(opts: { specPath: string; outPath: string; force?: boolean }): BuiltEvidenceManifest {
  const specPath = path.resolve(opts.specPath);
  const outPath = path.resolve(opts.outPath);
  let spec!: EvidenceManifestSpec;
  try { spec = EvidenceManifestSpecSchema.parse(readJson(specPath)) as EvidenceManifestSpec; }
  catch (e) { fail(`spec 不可用（${specPath}）：${e instanceof Error ? e.message : String(e)}`); }

  const specDir = path.dirname(specPath);
  const rootAbs = new Map<string, string>();
  for (const [id, declared] of Object.entries(spec.roots)) rootAbs.set(id, path.resolve(specDir, declared));
  const rootPaths: EvidenceRootPath[] = [...rootAbs].map(([id, abs]) => ({
    id, declared: spec.roots[id]!, abs,
    ...(fs.existsSync(abs) ? { real: fs.realpathSync(abs) } : {}),
  }));
  assertOutOutsideRoots(outPath, rootPaths);

  if (fs.existsSync(outPath) && opts.force !== true)
    throw new CommandError("usage", `拒绝覆盖已存在的清单：${outPath}（确要重建请加 --force）`);

  // 展开 entries；同一文件通过两个 root 出现 ⇒ 拒绝（记录键会歧义）。
  type FileMeta = { root: string; rel: string; role: string; required: boolean; abs: string };
  const byKey = new Map<string, FileMeta>();
  const byAbs = new Map<string, FileMeta>();
  const add = (root: string, rel: string, abs: string, role: string, required: boolean): void => {
    const key = `${root}:${rel}`;
    const prev = byKey.get(key);
    if (prev !== undefined) {
      if (prev.role !== role) fail(`同一文件的 role 冲突：${key}（${prev.role} vs ${role}）`);
      prev.required = prev.required || required;
      return;
    }
    const other = byAbs.get(abs);
    if (other !== undefined) fail(`同一文件出现在多个 root：${abs}（${other.root}:${other.rel} vs ${root}:${rel}）`);
    const meta = { root, rel, role, required, abs };
    byKey.set(key, meta);
    byAbs.set(abs, meta);
  };

  for (const entry of spec.entries) {
    const root = rootAbs.get(entry.root);
    if (root === undefined) fail(`entry 引用了未登记的 root：${entry.root}`);
    const abs = path.resolve(root, entry.path);
    if (!inside(root, abs)) fail(`entry 路径越界：${entry.root}:${entry.path}`);
    const rel = path.relative(root, abs).split(path.sep).join("/");
    if (entry.kind === "file") {
      if (!fs.existsSync(abs)) fail(`文件条目不存在：${entry.root}:${entry.path}`);
      if (!fs.statSync(abs).isFile()) fail(`文件条目不是文件：${entry.root}:${entry.path}`);
      add(entry.root, rel, abs, entry.role, entry.required);
    } else {
      const files = walkDir(abs, entry.excludeExt, entry.excludeDirs);
      if (files.length === 0) fail(`目录条目没有可纳入的文件：${entry.root}:${entry.path}`);
      for (const f of files) add(entry.root, path.relative(root, f).split(path.sep).join("/"), f, entry.role, entry.required);
    }
  }
  if (byKey.size === 0) fail("spec 没有展开出任何文件");

  const files = [...byKey.values()]
    .map((m) => ({
      root: m.root, path: m.rel, role: m.role, required: m.required,
      bytes: fs.statSync(m.abs).size, sha256: sha(m.abs),
    }))
    .sort((a, b) => (a.root === b.root ? a.path.localeCompare(b.path) : a.root.localeCompare(b.root)));

  // records 必须在 files 里
  for (const r of spec.records) {
    if (!byKey.has(`${r.root}:${r.path}`)) fail(`record 不在 files 里：${r.root}:${r.path}`);
  }

  // subject 校验：qa-report.delivery + 实际 pack manifest / config 字节
  const qaRecords = spec.records.filter((r) => r.role === "qa-report");
  if (qaRecords.length !== 1) fail(`spec 必须恰好有一条 role=qa-report 的 record（现在 ${qaRecords.length} 条）`);
  const qaRec = qaRecords[0]!;
  const qaMeta = byKey.get(`${qaRec.root}:${qaRec.path}`);
  if (qaMeta === undefined) fail(`qa-report record 不在 files 里：${qaRec.root}:${qaRec.path}`);
  let qa;
  try { qa = QAReportSchema.parse(readJson(qaMeta.abs)); }
  catch (e) { fail(`qa-report 不过 schema：${e instanceof Error ? e.message : String(e)}`); }
  const d = qa.delivery;
  if (d === undefined) throw new CommandError("invalid", "qa-report 没有 delivery —— 无法校验 subject");
  if (d.site === undefined) throw new CommandError("invalid", "qa-report.delivery 没有 site —— 无法校验 subject");

  // pack manifest：优先 out 根下的标准路径；否则按路径后缀 + id/version 唯一匹配。
  const packRel = `${d.pack.packId}/pack/v${d.pack.packVersion}/manifest.json`;
  let candidates = files.filter((f) => f.root === qaRec.root && f.path === packRel);
  if (candidates.length === 0)
    candidates = files.filter((f) => f.path.endsWith(`pack/v${d.pack.packVersion}/manifest.json`));
  const checksums = new Map<string, string>();
  for (const f of candidates) {
    let m: { id?: unknown; version?: unknown };
    try { m = readJson(path.resolve(rootAbs.get(f.root)!, f.path)) as { id?: unknown; version?: unknown }; }
    catch { continue; }
    if (m.id !== d.pack.packId || m.version !== d.pack.packVersion) continue;
    checksums.set(f.sha256, `${f.root}:${f.path}`);
  }
  if (checksums.size === 0) fail(`找不到与 delivery.pack 匹配的 manifest.json（${d.pack.packId} v${d.pack.packVersion}）`);
  if (checksums.size > 1) fail(`存在多份内容不同的 pack manifest：${[...checksums.values()].join(" / ")}`);
  const manifestChecksum = [...checksums.keys()][0]!;

  // config：delivery.config.file 相对 qa-report 的 root。
  if (path.isAbsolute(d.config.file) || d.config.file.startsWith("..")) fail(`delivery.config.file 必须是 qa-report root 下的相对路径：${d.config.file}`);
  const cfgKey = `${qaRec.root}:${d.config.file.split(path.sep).join("/")}`;
  const cfgMeta = byKey.get(cfgKey);
  if (cfgMeta === undefined) fail(`delivery.config.file 不在 files 里：${cfgKey}`);
  const configChecksum = sha(cfgMeta.abs);

  const expected = {
    packId: d.pack.packId, packVersion: d.pack.packVersion,
    siteVersion: d.site.version, shellVersion: d.site.shell,
    manifestChecksum, configChecksum,
  };
  const fields = ["packId", "packVersion", "siteVersion", "shellVersion", "manifestChecksum", "configChecksum"] as const;
  const bad = fields.filter((f) => String(spec.subject[f]) !== String(expected[f]));
  if (bad.length > 0)
    fail(`spec.subject 与实际交付不一致：${bad.map((f) => `${f} spec ${String(spec.subject[f])} / 实际 ${String(expected[f])}`).join("；")}`);
  if (d.pack.manifestChecksum !== undefined && d.pack.manifestChecksum !== manifestChecksum)
    fail(`delivery.pack.manifestChecksum 与实际包不一致：delivery ${d.pack.manifestChecksum} / 实际 ${manifestChecksum}`);

  const outDir = path.dirname(outPath);
  const rootsOut = Object.fromEntries(Object.keys(spec.roots).sort().map((id) => [
    id, path.relative(outDir, rootAbs.get(id)!).split(path.sep).join("/"),
  ]));
  const manifest = EvidenceManifestSchema.parse({
    format: "delivery-evidence-manifest/v1",
    generatedAt: new Date().toISOString(),
    ...(spec.generatedBy === undefined ? { generatedBy: "game-maker build-evidence-manifest" } : { generatedBy: spec.generatedBy }),
    ...(spec.note === undefined ? {} : { note: spec.note }),
    subject: spec.subject,
    roots: rootsOut,
    files,
    records: spec.records,
  });

  fs.mkdirSync(outDir, { recursive: true });
  const tmp = `${outPath}.tmp-${process.pid}`;
  try {
    fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2) + "\n");
    fs.renameSync(tmp, outPath);
  } catch (e) {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    throw e;
  }
  return { manifest, outPath, files: files.length, required: files.filter((f) => f.required).length, records: spec.records.length };
}
