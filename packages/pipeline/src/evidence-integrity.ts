// **证据完整性校验核心**（Evidence Integrity V1 · 票 04）。
//
// 回答一句话：**这份交付报告的结论，能不能由磁盘上现在这份证据重新推出来？**
// 它只读：不构建、不跑 QA、不启动浏览器、不写交付目录；报告本身由调用方落盘（票 05）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、输入契约：清单（票 03 冻结、git 固定）
//
//   `delivery-evidence-manifest/v1` 声明 roots / subject / files[] / records[]；
//   它是**唯一**期望哈希来源。校验器不读证据自述的哈希当期望值（那只是第二方，用于三方核对）。
//   roots 是**封闭**的：files[].root / records[].root 只能引用已登记的标识符。
//
// 二、结果语义（PRD EI-02 / Q7）
//
//   文件级：verified / missing / unreadable / hash-mismatch / path-invalid / optional-missing；
//   分组级：确定性矛盾（hash / 路径 / 引用 / 身份 / 报告矛盾）→ fail；
//           必需前置缺失（missing / unreadable / 身份字段缺失）→ blocked；
//   最终状态：既有 `deriveDeliveryVerdict`（fail > blocked > incomplete > pass），不另造一套优先级。
//   ⚠️ 单项 blocked 不提前退出：其余独立检查照常跑完，报告要能一次看全诊断。
//
// 三、六项交付检查「重算」= 由当前证据重导出，不重新执行（Q13）
//
//   asset-pack → verifyPack + manifestChecksum；
//   config → config 文件实际哈希 vs subject.configChecksum；
//   qa → qaVerdict(qa-report)；
//   site → 站点四文件 + site.json 引用 + 记录里的 site-integrity；
//   playable-smoke → playtestSummaryOf + mapPlaytest（交付内 report 指向的那一份）；
//   visual-review → 审核记录完整性 / subject / 与 delivery.visualReview 一致（不重判人工结论）。
//
// 四、信任边界（报告必须写明）
//
//   能发现「相对清单的改动」；发现不了「清单与被验证据一起被改并提交」—— 后者由 git 提交历史与人工审查负责。
//   三方哈希核对只增加内部矛盾检测，不增加防篡改强度。
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { z } from "zod";
import {
  CommandError, deriveDeliveryVerdict, mapPlaytest, playtestSummaryOf, playtestProjectionOf, samePlaytestProjection, qaVerdict,
  QAReportSchema, PlaytestReportSchema, MechanicCoverageReportSchema,
  type DeliveryCheckStatus, type QAReport,
} from "@game-maker/contracts";
import { verifyPack } from "@game-maker/assets";
import { manifestChecksumOf } from "./publish-gate.js";

// ─────────────────────────────────────────────────────────────────────────────
// 一、清单 schema（Q6 / Q9 / Q12）
// ─────────────────────────────────────────────────────────────────────────────

const Sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/, "形如 sha256:<64 位小写十六进制>");

export const EvidenceManifestFileSchema = z.strictObject({
  root: z.string().min(1),
  path: z.string().min(1),
  role: z.string().min(1),
  required: z.boolean(),
  bytes: z.number().int().nonnegative().optional(),
  sha256: Sha256,
});
export type EvidenceManifestFile = z.infer<typeof EvidenceManifestFileSchema>;

export const EvidenceManifestRecordSchema = z.strictObject({
  root: z.string().min(1),
  path: z.string().min(1),
  role: z.string().min(1),
  required: z.boolean(),
  /** 必须带身份并与清单 subject 逐字段匹配（Q12）。 */
  identity: z.boolean(),
});
export type EvidenceManifestRecord = z.infer<typeof EvidenceManifestRecordSchema>;

export const ManifestSubjectSchema = z.strictObject({
  packId: z.string().min(1),
  packVersion: z.number().int().positive(),
  siteVersion: z.number().int().positive(),
  shellVersion: z.string().min(1),
  manifestChecksum: Sha256,
  configChecksum: Sha256,
});
export type ManifestSubject = z.infer<typeof ManifestSubjectSchema>;

export const EvidenceManifestSchema = z.strictObject({
  format: z.literal("delivery-evidence-manifest/v1"),
  generatedAt: z.string().min(1),
  generatedBy: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
  subject: ManifestSubjectSchema,
  roots: z.record(z.string().min(1), z.string().min(1)),
  files: z.array(EvidenceManifestFileSchema).min(1),
  records: z.array(EvidenceManifestRecordSchema),
}).superRefine((m, ctx) => {
  const rootIds = new Set(Object.keys(m.roots));
  if (rootIds.size === 0) ctx.addIssue({ code: "custom", path: ["roots"], message: "清单没有声明任何 root" });
  const fileKeys = new Set<string>();
  for (const [i, f] of m.files.entries()) {
    if (!rootIds.has(f.root)) ctx.addIssue({ code: "custom", path: ["files", i, "root"], message: `root 未登记：${f.root}` });
    const key = `${f.root}:${f.path}`;
    if (fileKeys.has(key)) ctx.addIssue({ code: "custom", path: ["files", i], message: `文件重复：${key}` });
    fileKeys.add(key);
  }
  const recordKeys = new Set<string>();
  for (const [i, r] of m.records.entries()) {
    if (!rootIds.has(r.root)) ctx.addIssue({ code: "custom", path: ["records", i, "root"], message: `root 未登记：${r.root}` });
    const key = `${r.root}:${r.path}`;
    if (recordKeys.has(key)) ctx.addIssue({ code: "custom", path: ["records", i], message: `记录重复：${key}` });
    recordKeys.add(key);
    // Q6：被引用但未列入 files[] 的文件 ⇒ reference-invalid（写前就拒更省事）。
    if (!fileKeys.has(key)) ctx.addIssue({ code: "custom", path: ["records", i], message: `记录不在 files[] 里：${key}` });
  }
});
export type EvidenceManifest = z.infer<typeof EvidenceManifestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 二、报告 schema（Q8：pipeline 本地；不扩 contracts）
// ─────────────────────────────────────────────────────────────────────────────

const VerdictEnum = z.enum(["pass", "fail", "incomplete", "blocked"]);
const CheckStatusEnum = z.enum(["pass", "fail", "incomplete", "blocked", "not-required"]);
const FileStatusEnum = z.enum(["verified", "missing", "unreadable", "hash-mismatch", "path-invalid", "optional-missing"]);
const IdentityStatusEnum = z.enum(["verified", "missing", "mismatch", "unreadable", "invalid"]);
const ConsistencyStatusEnum = z.enum(["verified", "fail", "blocked"]);
type ConsistencyStatus = z.infer<typeof ConsistencyStatusEnum>;

export const VerificationFileResultSchema = z.strictObject({
  root: z.string().min(1),
  path: z.string().min(1),
  role: z.string().min(1),
  required: z.boolean(),
  status: FileStatusEnum,
  expected: Sha256.optional(),
  actual: Sha256.optional(),
  bytes: z.number().int().nonnegative().optional(),
  detail: z.string().min(1).optional(),
});
export type VerificationFileResult = z.infer<typeof VerificationFileResultSchema>;

export const IdentityFieldResultSchema = z.strictObject({
  name: z.string().min(1),
  expected: z.union([z.string(), z.number()]),
  actual: z.union([z.string(), z.number(), z.null()]),
  status: z.enum(["verified", "missing", "mismatch"]),
});
export type IdentityFieldResult = z.infer<typeof IdentityFieldResultSchema>;

export const IdentityResultSchema = z.strictObject({
  record: z.string().min(1),
  role: z.string().min(1),
  status: IdentityStatusEnum,
  fields: z.array(IdentityFieldResultSchema),
  detail: z.string().min(1).optional(),
});
export type IdentityResult = z.infer<typeof IdentityResultSchema>;

export const ConsistencyResultSchema = z.strictObject({
  id: z.string().min(1),
  rule: z.string().min(1),
  status: ConsistencyStatusEnum,
  detail: z.string().min(1).optional(),
});
export type ConsistencyResult = z.infer<typeof ConsistencyResultSchema>;

const DeclaredCheckSchema = z.strictObject({
  key: z.string().min(1),
  status: z.string().min(1),
  detail: z.string().optional(),
});
const RecomputedCheckSchema = z.strictObject({
  key: z.string().min(1),
  status: CheckStatusEnum,
  detail: z.string().min(1).optional(),
});
const CheckComparisonSchema = z.strictObject({
  key: z.string().min(1),
  declared: z.string().nullable(),
  recomputed: CheckStatusEnum,
  match: z.boolean(),
});

/** 信任锚点：本次运行是否把当前清单钉在外部提供的 SHA-256 上（Q13）。 */
const AnchorResultSchema = z.strictObject({
  mode: z.enum(["digest", "digest+base"]),
  source: z.literal("cli"),
  expectedSha256: Sha256,
  actualSha256: Sha256,
  baseManifest: z.strictObject({
    path: z.string().min(1),
    sha256: Sha256,
    byteEqual: z.boolean(),
  }).optional(),
  result: z.enum(["matched", "mismatch"]),
});
export type AnchorResult = z.infer<typeof AnchorResultSchema>;

export const DeliveryVerificationReportSchema = z.strictObject({
  format: z.literal("delivery-verification/v1"),
  generatedAt: z.string().min(1),
  input: z.strictObject({
    manifest: z.strictObject({ path: z.string().min(1), sha256: Sha256 }),
    subject: ManifestSubjectSchema,
  }),
  /** 只在显式传入可信摘要时出现；旧报告没有这个字段仍然合法。 */
  trust: AnchorResultSchema.optional(),
  scope: z.strictObject({
    roots: z.record(z.string().min(1), z.string().min(1)),
    files: z.strictObject({ total: z.number().int().nonnegative(), required: z.number().int().nonnegative(), optional: z.number().int().nonnegative() }),
    records: z.number().int().nonnegative(),
  }),
  trustBoundary: z.string().min(1),
  declared: z.strictObject({
    verdict: VerdictEnum.nullable(),
    checks: z.array(DeclaredCheckSchema),
  }),
  recomputed: z.strictObject({
    verdict: VerdictEnum,
    checks: z.array(RecomputedCheckSchema),
  }),
  comparison: z.strictObject({
    verdictMatch: z.boolean(),
    checks: z.array(CheckComparisonSchema),
  }),
  results: z.strictObject({
    files: z.array(VerificationFileResultSchema),
    identities: z.array(IdentityResultSchema),
    consistency: z.array(ConsistencyResultSchema),
  }),
  diagnostics: z.array(z.strictObject({
    category: z.enum(["files", "identity", "consistency", "verdict", "anchor"]),
    severity: z.enum(["fail", "blocked"]),
    rule: z.string().min(1),
    message: z.string().min(1),
    root: z.string().optional(),
    path: z.string().optional(),
    record: z.string().optional(),
  })),
  status: VerdictEnum,
  exitCode: z.union([z.literal(0), z.literal(1)]),
  limitations: z.array(z.string().min(1)),
});
export type DeliveryVerificationReport = z.infer<typeof DeliveryVerificationReportSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 三、路径安全（Q14）
// ─────────────────────────────────────────────────────────────────────────────

const sha256Of = (buf: Buffer): string => "sha256:" + crypto.createHash("sha256").update(buf).digest("hex");

/** 规范化路径组件包含性：不用字符串前缀（`/allowed-other` 不是 `/allowed` 的子目录）。 */
function within(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  if (rel === "" || path.isAbsolute(rel)) return false;
  return rel.split(path.sep)[0] !== "..";
}

type RootInfo = { id: string; declared: string; abs: string; real?: string; error?: string };

function loadRoots(manifest: EvidenceManifest, manifestDir: string): Map<string, RootInfo> {
  const out = new Map<string, RootInfo>();
  for (const [id, declared] of Object.entries(manifest.roots)) {
    const abs = path.resolve(manifestDir, declared);
    let real: string | undefined;
    let error: string | undefined;
    try {
      real = fs.realpathSync(abs);
    } catch (e) {
      error = `root 不可解析（${abs}）：${e instanceof Error ? e.message : String(e)}`;
    }
    out.set(id, { id, declared, abs, ...(real === undefined ? {} : { real }), ...(error === undefined ? {} : { error }) });
  }
  return out;
}

type ResolvedEntry =
  | { ok: true; abs: string; real: string; exists: true }
  | { ok: true; abs: string; exists: false }
  | { ok: false; reason: string };

/** 双端 realpath + 组件包含性；悬空链接 / 越界链接一律拒绝。 */
function resolveEntry(root: RootInfo, relPath: string): ResolvedEntry {
  if (root.error !== undefined || root.real === undefined) return { ok: false, reason: root.error ?? "root 不可解析" };
  if (path.isAbsolute(relPath)) return { ok: false, reason: "绝对路径不允许" };
  const lexical = path.resolve(root.abs, relPath);
  if (!within(root.abs, lexical)) return { ok: false, reason: "路径越界（词法）" };

  let st: fs.Stats | undefined;
  try {
    st = fs.lstatSync(lexical);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") return { ok: false, reason: `lstat 失败：${(e as Error).message}` };
  }

  if (st?.isSymbolicLink() === true) {
    try {
      const real = fs.realpathSync(lexical);
      if (!within(root.real, real)) return { ok: false, reason: "符号链接指向 root 外" };
      return fs.existsSync(real) ? { ok: true, abs: lexical, real, exists: true } : { ok: false, reason: "悬空符号链接" };
    } catch {
      return { ok: false, reason: "悬空符号链接" };
    }
  }

  if (st !== undefined) {
    try {
      const real = fs.realpathSync(lexical);
      if (!within(root.real, real)) return { ok: false, reason: "真实路径越界" };
      return { ok: true, abs: lexical, real, exists: true };
    } catch (e) {
      return { ok: false, reason: `realpath 失败：${(e as Error).message}` };
    }
  }

  // 不存在：对最近的已存在祖先做 realpath，确认它没有通过链接逃逸。
  let ancestor = path.dirname(lexical);
  while (!fs.existsSync(ancestor) && path.dirname(ancestor) !== ancestor) ancestor = path.dirname(ancestor);
  try {
    const realAncestor = fs.realpathSync(ancestor);
    if (!within(root.real, realAncestor)) return { ok: false, reason: "父级符号链接指向 root 外" };
    if (ancestor === root.abs && !within(root.real, path.join(root.real, path.relative(root.abs, lexical))))
      return { ok: false, reason: "路径越界" };
  } catch (e) {
    return { ok: false, reason: `父级 realpath 失败：${(e as Error).message}` };
  }
  return { ok: true, abs: lexical, exists: false };
}

// ─────────────────────────────────────────────────────────────────────────────
// 四、文件校验（EI-02）
// ─────────────────────────────────────────────────────────────────────────────

function verifyOneFile(file: EvidenceManifestFile, roots: Map<string, RootInfo>): VerificationFileResult {
  const root = roots.get(file.root);
  if (root === undefined) return { root: file.root, path: file.path, role: file.role, required: file.required, status: "path-invalid", expected: file.sha256, detail: "root 未登记" };
  const resolved = resolveEntry(root, file.path);
  if (!resolved.ok) {
    // root 级错误按「缺失」处理（前置不在，不是确定性矛盾）；路径越界是确定性矛盾。
    const status = root.error !== undefined ? "missing" : "path-invalid";
    return { root: file.root, path: file.path, role: file.role, required: file.required, status, expected: file.sha256, detail: resolved.reason };
  }
  if (!resolved.exists) {
    return {
      root: file.root, path: file.path, role: file.role, required: file.required,
      status: file.required ? "missing" : "optional-missing", expected: file.sha256,
    };
  }
  let buf: Buffer;
  try {
    buf = fs.readFileSync(resolved.real);
  } catch (e) {
    return { root: file.root, path: file.path, role: file.role, required: file.required, status: "unreadable", expected: file.sha256, detail: (e as Error).message };
  }
  const actual = sha256Of(buf);
  if (actual !== file.sha256) {
    return { root: file.root, path: file.path, role: file.role, required: file.required, status: "hash-mismatch", expected: file.sha256, actual, bytes: buf.length };
  }
  if (file.bytes !== undefined && file.bytes !== buf.length) {
    return { root: file.root, path: file.path, role: file.role, required: file.required, status: "hash-mismatch", expected: file.sha256, actual, bytes: buf.length, detail: `bytes 不符（记 ${file.bytes}，实际 ${buf.length}）` };
  }
  return { root: file.root, path: file.path, role: file.role, required: file.required, status: "verified", expected: file.sha256, actual, bytes: buf.length };
}

// ─────────────────────────────────────────────────────────────────────────────
// 五、记录读取与身份（EI-03 / Q12）
// ─────────────────────────────────────────────────────────────────────────────

type JsonRecord = { record: EvidenceManifestRecord; file: VerificationFileResult; json?: unknown; readError?: string; parseError?: string };

const fieldNames = ["packId", "packVersion", "siteVersion", "shellVersion", "manifestChecksum", "configChecksum"] as const;
type FieldName = (typeof fieldNames)[number];
type ExtractedIdentity = Partial<Record<FieldName, string | number | null>>;

function readRecords(manifest: EvidenceManifest, roots: Map<string, RootInfo>, files: Map<string, VerificationFileResult>): JsonRecord[] {
  return manifest.records.map((record) => {
    const file = files.get(`${record.root}:${record.path}`);
    if (file === undefined) return { record, file: { root: record.root, path: record.path, role: record.role, required: record.required, status: "path-invalid", detail: "记录未在 files[] 中" } };
    if (file.status !== "verified") return { record, file };
    const root = roots.get(record.root);
    if (root === undefined) return { record, file, readError: "root 未登记" };
    const resolved = resolveEntry(root, record.path);
    if (!resolved.ok || !resolved.exists) return { record, file, readError: resolved.ok ? "文件不存在" : resolved.reason };
    try {
      const text = fs.readFileSync(resolved.real, "utf8");
      try {
        return { record, file, json: JSON.parse(text) };
      } catch (e) {
        return { record, file, parseError: (e as Error).message };
      }
    } catch (e) {
      return { record, file, readError: (e as Error).message };
    }
  });
}

function extractIdentity(record: EvidenceManifestRecord, json: unknown, index: Index): { identity: ExtractedIdentity; error?: string } {
  if (typeof json !== "object" || json === null) return { identity: {}, error: "记录不是对象" };
  const obj = json as Record<string, unknown>;
  const subject = (x: unknown): ExtractedIdentity => {
    if (typeof x !== "object" || x === null) return {};
    const s = x as Record<string, unknown>;
    const pick = (k: string): string | number | null => {
      const v = s[k];
      return typeof v === "string" || typeof v === "number" ? v : null;
    };
    return {
      packId: pick("packId"), packVersion: pick("packVersion"), siteVersion: pick("siteVersion"),
      shellVersion: pick("shellVersion"), manifestChecksum: pick("manifestChecksum"), configChecksum: pick("configChecksum"),
    };
  };

  switch (record.role) {
    case "qa-report": {
      const parsed = QAReportSchema.safeParse(json);
      if (!parsed.success) return { identity: {}, error: `不过 qa-report/v1：${parsed.error.issues.slice(0, 2).map((i) => i.message).join("；")}` };
      const d = parsed.data.delivery;
      if (d === undefined) return { identity: {} };
      const configFile = d.config.file;
      const out = index.roots.get("out");
      const configAbs = out === undefined ? undefined : path.resolve(out.abs, configFile);
      const configResult = configAbs === undefined ? undefined : index.byAbs.get(configAbs)?.result;
      return {
        identity: {
          packId: d.pack.packId,
          packVersion: d.pack.packVersion,
          siteVersion: d.site?.version ?? null,
          shellVersion: d.site?.shell ?? null,
          manifestChecksum: d.pack.manifestChecksum ?? null,
          configChecksum: configResult?.actual ?? null,
        },
      };
    }
    case "playtest-result":
    case "playtest-attempt": {
      const parsed = PlaytestReportSchema.safeParse(json);
      if (!parsed.success) return { identity: {}, error: `不过 playtest-report/v1：${parsed.error.issues.slice(0, 2).map((i) => i.message).join("；")}` };
      const i = parsed.data.identity;
      return {
        identity: {
          packId: i.packId, packVersion: i.packVersion, siteVersion: i.siteVersion, shellVersion: i.shellVersion,
          manifestChecksum: i.packChecksum ?? null, configChecksum: i.configChecksum ?? null,
        },
      };
    }
    case "identity": {
      const inner = obj["identity"];
      if (typeof inner !== "object" || inner === null) return { identity: {} };
      const i = inner as Record<string, unknown>;
      const pick = (k: string): string | number | null => (typeof i[k] === "string" || typeof i[k] === "number" ? (i[k] as string | number) : null);
      return {
        identity: {
          packId: pick("packId"), packVersion: pick("packVersion"), siteVersion: pick("siteVersion"),
          shellVersion: pick("shellVersion"), manifestChecksum: pick("manifestFileSha256"), configChecksum: pick("siteConfigSha256"),
        },
      };
    }
    case "acceptance-consistency":
    case "regression":
      return { identity: {} }; // 不在 Q12 名单；identity=false 时不会走到比较
    default:
      return { identity: subject(obj["subject"]) };
  }
}

function verifyIdentity(records: JsonRecord[], subject: ManifestSubject, index: Index): { results: IdentityResult[]; diagnostics: Array<{ rule: string; message: string; record: string }>; status: ConsistencyStatus } {
  const results: IdentityResult[] = [];
  const diagnostics: Array<{ rule: string; message: string; record: string }> = [];
  for (const r of records) {
    if (!r.record.identity) continue;
    const tag = `${r.record.root}:${r.record.path}`;
    if (r.file.status !== "verified") {
      results.push({ record: tag, role: r.record.role, status: r.file.status === "missing" ? "missing" : "unreadable", fields: [], detail: r.file.detail ?? r.file.status });
      diagnostics.push({ rule: "identity.record", message: `记录不可用：${tag}（${r.file.status}）`, record: tag });
      continue;
    }
    if (r.parseError !== undefined || r.readError !== undefined) {
      results.push({ record: tag, role: r.record.role, status: "invalid", fields: [], detail: r.parseError ?? r.readError });
      diagnostics.push({ rule: "identity.record", message: `记录不可解析：${tag}`, record: tag });
      continue;
    }
    const ex = extractIdentity(r.record, r.json, index);
    if (ex.error !== undefined) {
      results.push({ record: tag, role: r.record.role, status: "invalid", fields: [], detail: ex.error });
      diagnostics.push({ rule: "identity.record", message: `身份不可提取：${tag} —— ${ex.error}`, record: tag });
      continue;
    }
    const fields: IdentityFieldResult[] = fieldNames.map((name) => {
      const expected = subject[name];
      const actual = ex.identity[name] ?? null;
      const status = actual === null ? "missing" : String(actual) === String(expected) ? "verified" : "mismatch";
      return { name, expected, actual, status };
    });
    const status: IdentityResult["status"] = fields.some((f) => f.status === "mismatch")
      ? "mismatch" : fields.some((f) => f.status === "missing") ? "missing" : "verified";
    results.push({ record: tag, role: r.record.role, status, fields });
    for (const f of fields) {
      if (f.status === "missing") diagnostics.push({ rule: "identity.missing", message: `${tag} 缺身份字段 ${f.name}`, record: tag });
      if (f.status === "mismatch") diagnostics.push({ rule: "identity.mismatch", message: `${tag} 的 ${f.name} 不符：期望 ${f.expected}，实际 ${f.actual}`, record: tag });
    }
  }
  const status: ConsistencyStatus = diagnostics.some((d) => d.rule === "identity.mismatch" || d.rule === "identity.record" && d.message.includes("不可解析"))
    ? "fail"
    : diagnostics.length > 0 ? "blocked" : "verified";
  return { results, diagnostics, status };
}

// ─────────────────────────────────────────────────────────────────────────────
// 六、一致性（EI-04 / Q15）
// ─────────────────────────────────────────────────────────────────────────────

function findRepoRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

type Index = {
  roots: Map<string, RootInfo>;
  files: Map<string, VerificationFileResult>;
  byAbs: Map<string, { file: EvidenceManifestFile; result: VerificationFileResult; abs: string }>;
  manifestFiles: EvidenceManifestFile[];
  manifestDir: string;
  repoRoot: string;
};

function buildIndex(manifest: EvidenceManifest, roots: Map<string, RootInfo>, results: VerificationFileResult[], manifestDir: string): Index {
  const byAbs = new Map<string, { file: EvidenceManifestFile; result: VerificationFileResult; abs: string }>();
  for (const [i, file] of manifest.files.entries()) {
    const root = roots.get(file.root);
    if (root === undefined || root.real === undefined) continue;
    const resolved = resolveEntry(root, file.path);
    if (!resolved.ok || !resolved.exists) continue;
    const hit = { file, result: results[i]!, abs: resolved.real };
    byAbs.set(resolved.real, hit);
    // 词法路径也登记一份：调用方（delivery 的相对路径、捕获记录的 siteDir）先用 path.resolve 得到词法路径。
    if (resolved.abs !== resolved.real) byAbs.set(resolved.abs, hit);
  }
  return { roots, files: new Map(results.map((r) => [`${r.root}:${r.path}`, r])), byAbs, manifestFiles: manifest.files, manifestDir, repoRoot: findRepoRoot(manifestDir) };
}

function resolveDeclaredPath(index: Index, declared: string, recordRoot?: string): { abs: string; file: EvidenceManifestFile; result: VerificationFileResult } | undefined {
  if (path.isAbsolute(declared)) {
    const hit = index.byAbs.get(path.resolve(declared));
    return hit === undefined ? undefined : { abs: hit.abs, file: hit.file, result: hit.result };
  }
  const candidates = [
    recordRoot === undefined ? undefined : path.resolve(recordRoot, declared),
    path.resolve(index.repoRoot, declared),
    ...([...index.roots.values()].map((r) => path.resolve(r.abs, declared))),
  ].filter((x): x is string => x !== undefined);
  for (const c of candidates) {
    const hit = index.byAbs.get(c);
    if (hit !== undefined) return { abs: hit.abs, file: hit.file, result: hit.result };
  }
  return undefined;
}

function recordRootAbs(index: Index, record: EvidenceManifestRecord): string | undefined {
  return index.roots.get(record.root)?.abs;
}

function threeWay(index: Index, records: JsonRecord[], subject: ManifestSubject): { results: ConsistencyResult[]; diagnostics: Array<{ rule: string; message: string; status: "fail" | "blocked" }> } {
  const results: ConsistencyResult[] = [];
  const diagnostics: Array<{ rule: string; message: string; status: "fail" | "blocked" }> = [];

  for (const r of records) {
    const tag = `${r.record.root}:${r.record.path}`;
    if (r.file.status !== "verified") {
      const blocked = r.file.status === "missing" || r.file.status === "unreadable";
      results.push({ id: "record.parse", rule: "记录可读且可解析", status: blocked ? "blocked" : "fail", detail: `${tag}：${r.file.status}` });
      diagnostics.push({ rule: "record.parse", message: `${tag} 不可用（${r.file.status}）`, status: blocked ? "blocked" : "fail" });
    } else if (r.parseError !== undefined || r.readError !== undefined) {
      results.push({ id: "record.parse", rule: "记录可读且可解析", status: "fail", detail: `${tag}：${r.parseError ?? r.readError}` });
      diagnostics.push({ rule: "record.parse", message: `${tag} 不可解析：${r.parseError ?? r.readError}`, status: "fail" });
    }
  }

  const compare = (id: string, rule: string, declared: string, sha: string, rootHint?: string): void => {
    const hit = resolveDeclaredPath(index, declared, rootHint);
    if (hit === undefined) {
      results.push({ id, rule, status: "fail", detail: `自述路径不在清单里：${declared}` });
      diagnostics.push({ rule: `${id}.reference-invalid`, message: `自述路径不在清单里：${declared}`, status: "fail" });
      return;
    }
    if (hit.file.sha256 !== sha) {
      results.push({ id, rule, status: "fail", detail: `清单期望 ${hit.file.sha256}，自述 ${sha}（${declared}）` });
      diagnostics.push({ rule: `${id}.manifest-vs-declared`, message: `清单与自述哈希不符：${declared}`, status: "fail" });
      return;
    }
    const st = hit.result.status;
    if (st === "missing" || st === "unreadable") {
      results.push({ id, rule, status: "blocked", detail: `实际文件 ${st}（${declared}）` });
      diagnostics.push({ rule: `${id}.actual`, message: `实际文件不可用：${declared}（${st}）`, status: "blocked" });
      return;
    }
    if (st !== "verified") {
      results.push({ id, rule, status: "fail", detail: `实际文件 ${st}（${declared}）` });
      diagnostics.push({ rule: `${id}.actual`, message: `实际文件不可验证：${declared}（${st}）`, status: "fail" });
      return;
    }
    results.push({ id, rule, status: "verified", detail: declared });
  };

  for (const r of records) {
    if (r.json === undefined) continue;
    const rootHint = recordRootAbs(index, r.record);
    if (r.record.role === "identity") {
      const inner = (r.json as Record<string, unknown>)["identity"];
      if (typeof inner === "object" && inner !== null) {
        const i = inner as Record<string, unknown>;
        const packs = `pack/v${subject.packVersion}/manifest.json`;
        const sites = `site/v${subject.siteVersion}/game-config.json`;
        const pairs: Array<[string, unknown]> = [
          [packs, i["manifestFileSha256"]],
          [sites, i["siteConfigSha256"]],
          ["run-config", i["runConfigSha256"]],
        ];
        for (const [suffix, sha] of pairs) {
          if (typeof sha !== "string") continue;
          const hits = [...index.byAbs.values()].filter((h) => suffix === "run-config"
            ? h.file.path.includes("/run/") && h.file.path.endsWith("game-config.json")
            : h.file.path.endsWith(suffix));
          if (hits.length === 0) {
            const listed = index.manifestFiles.some((f) => suffix === "run-config"
              ? f.path.includes("/run/") && f.path.endsWith("game-config.json")
              : f.path.endsWith(suffix));
            results.push({
              id: "identity.self-hash", rule: "identity 自述哈希",
              status: listed ? "blocked" : "fail",
              detail: listed ? `清单里有 ${suffix}，但文件不可用` : `清单里没有 ${suffix}`,
            });
            diagnostics.push({
              rule: listed ? "identity.unavailable" : "identity.reference-invalid",
              message: listed ? `identity 引用的 ${suffix} 不可用` : `identity 引用的 ${suffix} 不在清单里`,
              status: listed ? "blocked" : "fail",
            });
            continue;
          }
          for (const h of hits) compare("identity.self-hash", "identity 自述哈希", h.abs, sha);
        }
      }
    } else if (r.record.role === "acceptance-evidence") {
      const files = (r.json as Record<string, unknown>)["files"];
      if (Array.isArray(files)) {
        for (const f of files) {
          if (typeof f !== "object" || f === null) continue;
          const e = f as Record<string, unknown>;
          if (typeof e["path"] !== "string" || typeof e["sha256"] !== "string") continue;
          compare("evidence.self-hash", "evidence 自述哈希", e["path"], e["sha256"], rootHint);
        }
      }
    } else if (r.record.role === "visual-materials") {
      const mat = (r.json as Record<string, unknown>)["materials"];
      const gen = (r.json as Record<string, unknown>)["generated"];
      const entries = [
        ...(typeof mat === "object" && mat !== null ? [((mat as Record<string, unknown>)["reference"]), ((mat as Record<string, unknown>)["deliveredAssets"]), ((mat as Record<string, unknown>)["visualContext"])] : []),
        gen,
      ].flat().filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
      for (const e of entries) {
        if (typeof e["path"] !== "string" || typeof e["sha256"] !== "string") continue;
        compare("materials.self-hash", "materials 自述哈希", e["path"], e["sha256"], rootHint);
      }
    } else if (r.record.role === "visual-supplement") {
      const constraints = (r.json as Record<string, unknown>)["constraints"];
      const hist = typeof constraints === "object" && constraints !== null ? (constraints as Record<string, unknown>)["historicalRecordHashes"] : undefined;
      if (typeof hist === "object" && hist !== null) {
        for (const [name, sha] of Object.entries(hist)) {
          if (typeof sha !== "string") continue;
          // `historicalRecordHashes` 是 **FA-04 目录内的 basename**（不是补审记录自己的 root）。
          const hits = [...index.byAbs.values()].filter((h) => h.file.root === "fa04" && path.basename(h.file.path) === name);
          for (const h of hits) compare("supplement.history", "补审记录的历史哈希", h.abs, sha);
        }
      }
    } else if (r.record.role === "acceptance-consistency") {
      const subject = (r.json as Record<string, unknown>)["subject"];
      const sha = typeof subject === "object" && subject !== null ? (subject as Record<string, unknown>)["reportSha256"] : undefined;
      if (typeof sha === "string") {
        const qa = [...index.byAbs.values()].find((h) => h.file.path.endsWith("run/v1/qa-report.json") && h.file.root === "out");
        if (qa === undefined) {
          results.push({ id: "consistency.report-hash", rule: "qa-report 哈希", status: "fail", detail: "清单里没有 out 的 run/v1/qa-report.json" });
          diagnostics.push({ rule: "consistency.reference-invalid", message: "consistency 引用的 qa-report 不在清单里", status: "fail" });
        } else compare("consistency.report-hash", "qa-report 哈希", qa.abs, sha);
      }
    }
  }
  return { results, diagnostics };
}

function siteIntegrity(index: Index, records: JsonRecord[], subject: ManifestSubject): { results: ConsistencyResult[]; diagnostics: Array<{ rule: string; message: string; status: "fail" | "blocked" }> } {
  const results: ConsistencyResult[] = [];
  const diagnostics: Array<{ rule: string; message: string; status: "fail" | "blocked" }> = [];
  const siteDir = path.join(index.roots.get("out")?.abs ?? "", subject.packId, "site", `v${subject.siteVersion}`);
  const actual = new Map<string, VerificationFileResult>();
  const outAbs = index.roots.get("out")?.abs;
  for (const name of ["index.html", "shell.js", "site.json", "game-config.json"]) {
    const rel = outAbs === undefined ? undefined : path.relative(outAbs, path.join(siteDir, name)).split(path.sep).join("/");
    const hit = rel === undefined ? undefined : index.files.get(`out:${rel}`);
    if (hit !== undefined) actual.set(name, hit);
  }
  const checkMap = (id: string, label: string, map: unknown): void => {
    if (typeof map !== "object" || map === null) return;
    for (const [name, sha] of Object.entries(map)) {
      if (typeof sha !== "string") continue;
      const hit = actual.get(name);
      if (hit === undefined) {
        results.push({ id, rule: label, status: "fail", detail: `${name} 不在清单/站点目录` });
        diagnostics.push({ rule: `${id}.missing`, message: `${label}：站点文件 ${name} 不在清单里`, status: "fail" });
      } else if (hit.status === "missing" || hit.status === "unreadable") {
        results.push({ id, rule: label, status: "blocked", detail: `${name} ${hit.status}` });
        diagnostics.push({ rule: `${id}.unavailable`, message: `${label}：站点文件 ${name} 不可用（${hit.status}）`, status: "blocked" });
      } else if (hit.status !== "verified" || hit.actual !== sha) {
        results.push({ id, rule: label, status: "fail", detail: `${name} 实际 ${hit.actual ?? "(未校验)"}，记录 ${sha}` });
        diagnostics.push({ rule: `${id}.mismatch`, message: `${label}：${name} 与记录不符`, status: "fail" });
      } else {
        results.push({ id, rule: label, status: "verified", detail: name });
      }
    }
  };
  for (const r of records) {
    if (r.json === undefined) continue;
    if (r.record.role === "visual-capture") {
      const si = (r.json as Record<string, unknown>)["siteIntegrity"];
      if (typeof si === "object" && si !== null) {
        checkMap("site.capture.before", "capture.siteIntegrity.before", (si as Record<string, unknown>)["before"]);
        checkMap("site.capture.after", "capture.siteIntegrity.after", (si as Record<string, unknown>)["after"]);
        const unchanged = (si as Record<string, unknown>)["unchanged"];
        if (unchanged !== true) {
          results.push({ id: "site.capture.unchanged", rule: "capture 站点未改", status: "fail", detail: "unchanged 不是 true" });
          diagnostics.push({ rule: "site.capture.unchanged", message: "capture.siteIntegrity.unchanged 不是 true", status: "fail" });
        }
      }
    } else if (r.record.role === "playtest-result" || r.record.role === "playtest-attempt") {
      // 同目录的 site-integrity.json 是 playtest 自带的站点前后快照。
      const dir = path.dirname(path.resolve(recordRootAbs(index, r.record) ?? "", r.record.path));
      const siHit = index.byAbs.get(path.join(dir, "site-integrity.json"));
      if (siHit === undefined || siHit.result.status !== "verified") {
        results.push({ id: "site.playtest", rule: "playtest site-integrity", status: "blocked", detail: `${r.record.path} 同目录没有可验证的 site-integrity.json` });
        diagnostics.push({ rule: "site.playtest", message: `${r.record.path} 的同目录 site-integrity.json 不在清单或未验证`, status: "blocked" });
      } else {
        try {
          const si = JSON.parse(fs.readFileSync(siHit.abs, "utf8")) as Record<string, unknown>;
          checkMap("site.playtest.before", "playtest.siteIntegrity.before", si["before"]);
          checkMap("site.playtest.after", "playtest.siteIntegrity.after", si["after"]);
          if (si["unchanged"] !== true) {
            results.push({ id: "site.playtest.unchanged", rule: "playtest 站点未改", status: "fail", detail: "unchanged 不是 true" });
            diagnostics.push({ rule: "site.playtest.unchanged", message: `${r.record.path} 的站点前后哈希不同`, status: "fail" });
          }
        } catch (e) {
          results.push({ id: "site.playtest", rule: "playtest site-integrity", status: "fail", detail: (e as Error).message });
          diagnostics.push({ rule: "site.playtest", message: `${r.record.path} 的 site-integrity.json 不可解析`, status: "fail" });
        }
      }
    } else if (r.record.role === "visual-supplement" || r.record.role === "visual-supplement-materials") {
      const subj = (r.json as Record<string, unknown>)["subject"];
      const hashes = typeof subj === "object" && subj !== null ? (subj as Record<string, unknown>)["siteHashes"] : undefined;
      if (typeof hashes === "object" && hashes !== null) {
        checkMap("site.supplement", "补审.subject.siteHashes", {
          ...(typeof (hashes as Record<string, unknown>)["index"] === "string" ? { "index.html": (hashes as Record<string, unknown>)["index"] } : {}),
          ...(typeof (hashes as Record<string, unknown>)["shell"] === "string" ? { "shell.js": (hashes as Record<string, unknown>)["shell"] } : {}),
          ...(typeof (hashes as Record<string, unknown>)["siteJson"] === "string" ? { "site.json": (hashes as Record<string, unknown>)["siteJson"] } : {}),
          ...(typeof (hashes as Record<string, unknown>)["config"] === "string" ? { "game-config.json": (hashes as Record<string, unknown>)["config"] } : {}),
        });
      }
    }
  }
  if (results.length === 0) results.push({ id: "site.integrity", rule: "站点完整性记录", status: "verified", detail: "没有可核对的站点记录" });
  return { results, diagnostics };
}

function reportReferences(index: Index, qa: QAReport | undefined): { results: ConsistencyResult[]; diagnostics: Array<{ rule: string; message: string; status: "fail" | "blocked" }> } {
  const results: ConsistencyResult[] = [];
  const diagnostics: Array<{ rule: string; message: string; status: "fail" | "blocked" }> = [];
  if (qa?.delivery === undefined) {
    results.push({ id: "references.report", rule: "交付报告引用", status: "blocked", detail: "qa-report 没有 delivery" });
    diagnostics.push({ rule: "references.report", message: "无法核对 qa-report 的引用：没有 delivery", status: "blocked" });
    return { results, diagnostics };
  }
  const out = index.roots.get("out")?.abs;
  const check = (label: string, p: string): void => {
    if (out === undefined) {
      results.push({ id: "references.report", rule: "交付报告引用", status: "blocked", detail: `${label}：没有 out root` });
      diagnostics.push({ rule: "references.report", message: `${label}：没有 out root`, status: "blocked" });
      return;
    }
    const abs = path.resolve(out, p);
    const hit = index.byAbs.get(abs);
    const rel = path.relative(out, abs).split(path.sep).join("/");
    const listed = index.files.get(`out:${rel}`);
    if (hit !== undefined) {
      const st = hit.result.status;
      if (st === "verified") { results.push({ id: "references.report", rule: "交付报告引用", status: "verified", detail: `${label} → ${p}` }); return; }
      if (st === "missing" || st === "unreadable") {
        results.push({ id: "references.report", rule: "交付报告引用", status: "blocked", detail: `${label} → ${p}（${st}）` });
        diagnostics.push({ rule: "references.report", message: `${label} 指向的文件不可用：${p}（${st}）`, status: "blocked" });
        return;
      }
      results.push({ id: "references.report", rule: "交付报告引用", status: "fail", detail: `${label} → ${p}（${st}）` });
      diagnostics.push({ rule: "references.report", message: `${label} 指向的文件不可验证：${p}（${st}）`, status: "fail" });
      return;
    }
    if (listed === undefined) {
      results.push({ id: "references.report", rule: "交付报告引用", status: "fail", detail: `${label} → ${p} 不在清单里` });
      diagnostics.push({ rule: "references.report.reference-invalid", message: `${label} 引用的文件不在清单里：${p}`, status: "fail" });
      return;
    }
    // 已入清单但磁盘上不在：可选日志不算错；必需的按 blocked。
    if (listed.status === "optional-missing") {
      results.push({ id: "references.report", rule: "交付报告引用", status: "verified", detail: `${label} → ${p}（optional，不在磁盘）` });
      return;
    }
    const st = listed.status;
    const blocked = st === "missing" || st === "unreadable";
    results.push({ id: "references.report", rule: "交付报告引用", status: blocked ? "blocked" : "fail", detail: `${label} → ${p}（${st}）` });
    diagnostics.push({ rule: "references.report", message: `${label} 指向的文件不可用：${p}（${st}）`, status: blocked ? "blocked" : "fail" });
  };
  check("config.file", qa.delivery.config.file);
  if (qa.delivery.playtest !== undefined) check("playtest.report", qa.delivery.playtest.report);
  for (const e of qa.delivery.evidence) check(`evidence.${e.ref}`, e.path);
  return { results, diagnostics };
}

function canonicalJson(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm);
    if (v !== null && typeof v === "object")
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, x]) => [k, norm(x)]));
    return v;
  };
  return JSON.stringify(norm(value));
}

function playtestConsistency(records: JsonRecord[], qa: QAReport | undefined): { results: ConsistencyResult[]; diagnostics: Array<{ rule: string; message: string; status: "fail" | "blocked" }> } {
  const results: ConsistencyResult[] = [];
  const diagnostics: Array<{ rule: string; message: string; status: "fail" | "blocked" }> = [];
  if (qa?.delivery === undefined) {
    results.push({ id: "playtest.summary", rule: "delivery.playtest 与报告一致", status: "blocked", detail: "qa-report 没有 delivery" });
    diagnostics.push({ rule: "playtest.summary", message: "无法核对 delivery.playtest：没有 delivery", status: "blocked" });
    return { results, diagnostics };
  }
  const declared = qa.delivery.playtest;
  if (declared === undefined) {
    results.push({ id: "playtest.summary", rule: "delivery.playtest 与报告一致", status: "blocked", detail: "delivery 没有 playtest 摘要" });
    diagnostics.push({ rule: "playtest.summary", message: "delivery 没有 playtest 摘要", status: "blocked" });
    return { results, diagnostics };
  }
  const resultRecord = records.find((r) => r.record.role === "playtest-result");
  if (resultRecord?.json === undefined) {
    results.push({ id: "playtest.summary", rule: "delivery.playtest 与报告一致", status: "blocked", detail: "playtest 报告不可用" });
    diagnostics.push({ rule: "playtest.summary", message: "交付指向的 playtest 报告不可用", status: "blocked" });
    return { results, diagnostics };
  }
  const parsed = PlaytestReportSchema.safeParse(resultRecord.json);
  if (!parsed.success) {
    results.push({ id: "playtest.summary", rule: "delivery.playtest 与报告一致", status: "fail", detail: "playtest 报告不过 schema" });
    diagnostics.push({ rule: "playtest.summary", message: "playtest 报告不过 playtest-report/v1", status: "fail" });
    return { results, diagnostics };
  }
  const summary = playtestSummaryOf(parsed.data, declared.report);
  const same = JSON.stringify(summary) === JSON.stringify(declared);
  results.push({ id: "playtest.summary", rule: "delivery.playtest 与报告一致", status: same ? "verified" : "fail", detail: same ? declared.report : "摘要不一致" });
  if (!same) diagnostics.push({ rule: "playtest.summary", message: "delivery.playtest 与当前报告重导的摘要不一致", status: "fail" });

  const attempts = records.filter((r) => r.record.role === "playtest-attempt" && r.json !== undefined);
  if (attempts.length > 0) {
    for (const a of attempts) {
      const p = PlaytestReportSchema.safeParse(a.json);
      if (!p.success) {
        results.push({ id: "playtest.attempts", rule: "真实 attempt 结果", status: "fail", detail: `${a.record.path} 不过 schema` });
        diagnostics.push({ rule: "playtest.attempts", message: `${a.record.path} 不过 playtest-report/v1`, status: "fail" });
        continue;
      }
      for (const s of p.data.scenarios) {
        const clean = s.eventCounts.reset === undefined || s.eventCounts.reset === 0;
        const noHit = s.eventCounts["danger-hit"] === undefined || s.eventCounts["danger-hit"] === 0;
        const noErr = s.eventCounts["runtime-error"] === undefined || s.eventCounts["runtime-error"] === 0;
        const ok = s.execution === "executed" && s.assertionAggregate === "pass" && s.terminationReached === true && s.stop === undefined && clean && noHit && noErr;
        results.push({ id: "playtest.attempts", rule: "真实 attempt 结果", status: ok ? "verified" : "fail", detail: `${a.record.path} · ${s.scenarioId}` });
        if (!ok) diagnostics.push({ rule: "playtest.attempts", message: `${a.record.path} 的 ${s.scenarioId} 不满足成功/无停止/无重置`, status: "fail" });
      }
    }
    if (attempts.length >= 2) {
      const projections = attempts.slice(0, 2).map((a) => {
        const p = PlaytestReportSchema.safeParse(a.json);
        return p.success && p.data.scenarios.length > 0 ? playtestProjectionOf(p.data.scenarios[0]!) : undefined;
      });
      const same = projections[0] !== undefined && projections[1] !== undefined && samePlaytestProjection(projections[0], projections[1]);
      results.push({ id: "playtest.projection", rule: "两次 attempt 投影一致", status: same ? "verified" : "fail" });
      if (!same) diagnostics.push({ rule: "playtest.projection", message: "两次 attempt 的投影不一致", status: "fail" });
    }
  }
  return { results, diagnostics };
}

// ─────────────────────────────────────────────────────────────────────────────
// 七、六项重导出（Q13）
// ─────────────────────────────────────────────────────────────────────────────

type Recompute = { checks: Array<{ key: string; status: DeliveryCheckStatus; detail?: string }> };

function visualConsistency(index: Index, records: JsonRecord[]): { results: ConsistencyResult[]; diagnostics: Array<{ rule: string; message: string; status: "fail" | "blocked" }> } {
  const results: ConsistencyResult[] = [];
  const diagnostics: Array<{ rule: string; message: string; status: "fail" | "blocked" }> = [];
  const fa04 = index.roots.get("fa04")?.abs;

  const capture = records.find((r) => r.record.role === "visual-capture" && r.json !== undefined);
  const shots = capture === undefined ? undefined : (capture.json as Record<string, unknown>)["shots"];
  if (Array.isArray(shots)) {
    const distinct = new Set<string>();
    let bad = 0;
    for (const raw of shots) {
      const file = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>)["file"] : undefined;
      if (typeof file !== "string") { bad += 1; continue; }
      const abs = fa04 === undefined ? undefined : path.resolve(fa04, file);
      const hit = abs === undefined ? undefined : index.byAbs.get(abs);
      if (hit === undefined) {
        bad += 1;
        results.push({ id: "visual.shots", rule: "截图引用", status: "fail", detail: `${file} 不在清单里` });
        diagnostics.push({ rule: "visual.shots.reference-invalid", message: `截图不在清单里：${file}`, status: "fail" });
      } else if (hit.result.status !== "verified") {
        bad += 1;
        const blocked = hit.result.status === "missing" || hit.result.status === "unreadable";
        results.push({ id: "visual.shots", rule: "截图引用", status: blocked ? "blocked" : "fail", detail: `${file}：${hit.result.status}` });
        diagnostics.push({ rule: "visual.shots.actual", message: `截图不可用：${file}（${hit.result.status}）`, status: blocked ? "blocked" : "fail" });
      } else if (hit.result.actual !== undefined) distinct.add(hit.result.actual);
    }
    results.push({ id: "visual.shots.count", rule: "截图数量与去重", status: bad === 0 ? "verified" : "fail", detail: `${shots.length} 张 / ${distinct.size} 个不同字节` });
  }

  const review = records.find((r) => r.record.role === "visual-review" && r.json !== undefined);
  const materialsRec = records.find((r) => r.record.role === "visual-materials");
  const materialAbs = new Set<string>();
  if (materialsRec?.json !== undefined) {
    const m = materialsRec.json as Record<string, unknown>;
    const mm = m["materials"];
    const entries = [
      ...(typeof mm === "object" && mm !== null ? [(mm as Record<string, unknown>)["reference"], (mm as Record<string, unknown>)["deliveredAssets"], (mm as Record<string, unknown>)["visualContext"]] : []),
      m["generated"],
    ].flat().filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
    for (const e of entries) {
      if (typeof e["path"] !== "string") continue;
      const hit = resolveDeclaredPath(index, e["path"]);
      if (hit !== undefined) materialAbs.add(hit.abs);
      else {
        const abs = fa04 === undefined ? undefined : path.resolve(fa04, e["path"]);
        if (abs !== undefined && index.byAbs.has(abs)) materialAbs.add(abs);
      }
    }
  }
  if (review !== undefined) {
    const mats = (review.json as Record<string, unknown>)["materials"];
    if (typeof mats === "object" && mats !== null) {
      const m = mats as Record<string, unknown>;
      const checkRef = (p: string, underFa04: boolean): void => {
        const hit = underFa04
          ? (fa04 === undefined ? undefined : index.byAbs.get(path.resolve(fa04, p)))
          : resolveDeclaredPath(index, p);
        if (hit === undefined) {
          results.push({ id: "visual.materials", rule: "审核材料引用", status: "fail", detail: `${p} 不在清单里` });
          diagnostics.push({ rule: "visual.materials.reference-invalid", message: `审核材料不在清单里：${p}`, status: "fail" });
        }
      };
      const inCollection = (p: string, underFa04: boolean): void => {
        const abs = underFa04 ? (fa04 === undefined ? undefined : path.resolve(fa04, p)) : resolveDeclaredPath(index, p)?.abs;
        if (abs === undefined) return;
        if (!materialAbs.has(abs)) {
          results.push({ id: "visual.materials.collection", rule: "审核材料集合", status: "fail", detail: `${p} 不在 materials.json 里` });
          diagnostics.push({ rule: "visual.materials.collection", message: `审核材料不在 materials.json 里：${p}`, status: "fail" });
        }
      };
      for (const p of Array.isArray(m["reference"]) ? m["reference"] as unknown[] : []) if (typeof p === "string") { checkRef(p, false); inCollection(p, false); }
      for (const p of Array.isArray(m["deliveredAssets"]) ? m["deliveredAssets"] as unknown[] : []) if (typeof p === "string") { checkRef(p, true); inCollection(p, true); }
      for (const p of Array.isArray(m["runningScreenshots"]) ? m["runningScreenshots"] as unknown[] : []) if (typeof p === "string") { checkRef(p, true); inCollection(p, true); }
    }
  }
  if (results.length === 0) results.push({ id: "visual.records", rule: "视觉材料记录", status: "verified", detail: "没有可核对的视觉记录" });
  return { results, diagnostics };
}

/** 机制覆盖报告 v2 的内容核验（P0-02 v2 票 02 Q8）：
 *   记录存在时，必须 `probe.executed=true`、`verdict=satisfied`，且 subject 与清单 subject 六字段一致。
 *   ⚠️ 记录**缺席**时不在这里判失败：历史清单没有这个角色，强制要求会把历史验收一并打红；
 *      正式清单生成器（票 13）负责把 required record 写进去。 */
function mechanicCoverageConsistency(
  records: JsonRecord[], subject: ManifestSubject,
): { results: ConsistencyResult[]; diagnostics: Array<{ rule: string; message: string; status: "fail" | "blocked" }> } {
  const rec = records.find((r) => r.record.role === "mechanic-coverage");
  if (rec === undefined) return { results: [], diagnostics: [] };
  const tag = `${rec.record.root}:${rec.record.path}`;
  const blocked = (detail: string) => ({
    results: [{ id: "mechanic-coverage", rule: "机制覆盖报告", status: "blocked" as const, detail }],
    diagnostics: [{ rule: "mechanic-coverage.blocked", message: detail, status: "blocked" as const }],
  });
  const fail = (detail: string) => ({
    results: [{ id: "mechanic-coverage", rule: "机制覆盖报告", status: "fail" as const, detail }],
    diagnostics: [{ rule: "mechanic-coverage.fail", message: detail, status: "fail" as const }],
  });
  if (rec.file.status === "missing" || rec.file.status === "unreadable" || rec.file.status === "optional-missing")
    return blocked(`${tag}：${rec.file.status}`);
  if (rec.file.status !== "verified") return fail(`${tag}：${rec.file.status}`);
  if (rec.parseError !== undefined || rec.readError !== undefined)
    return fail(`${tag}：${rec.parseError ?? rec.readError}`);
  if (rec.json === undefined) return blocked(`${tag}：不可读`);
  const parsed = MechanicCoverageReportSchema.safeParse(rec.json);
  if (!parsed.success)
    return fail(`${tag} 不过 mechanic-coverage/v2：${parsed.error.issues.slice(0, 3).map((i) => i.message).join("；")}`);
  const r = parsed.data;
  const problems: string[] = [];
  if (!r.probe.executed) problems.push("probe.executed=false");
  if (r.verdict !== "satisfied") problems.push(`verdict=${r.verdict}`);
  const fields = ["packId", "packVersion", "siteVersion", "shellVersion", "manifestChecksum", "configChecksum"] as const;
  for (const f of fields)
    if (String(r.subject[f]) !== String(subject[f]))
      problems.push(`${f} 不一致：报告 ${String(r.subject[f])} / 清单 ${String(subject[f])}`);
  if (problems.length > 0) return fail(`${tag}：${problems.join("；")}`);
  return { results: [{ id: "mechanic-coverage", rule: "机制覆盖报告", status: "verified" }], diagnostics: [] };
}

function recomputeChecks(opts: {
  manifest: EvidenceManifest;
  index: Index;
  qa: QAReport | undefined;
  records: JsonRecord[];
}): Recompute {
  const { manifest, index, qa, records } = opts;
  const subject = manifest.subject;
  const out = index.roots.get("out");
  const checks: Recompute["checks"] = [];

  // asset-pack：verifyPack + manifestChecksum
  {
    const packDir = out === undefined ? undefined : path.join(out.abs, subject.packId, "pack", `v${subject.packVersion}`);
    if (packDir === undefined || !fs.existsSync(path.join(packDir, "manifest.json"))) {
      checks.push({ key: "asset-pack", status: "blocked", detail: "找不到交付的 pack manifest" });
    } else {
      try {
        const checksum = manifestChecksumOf(packDir);
        if (checksum !== subject.manifestChecksum) checks.push({ key: "asset-pack", status: "fail", detail: `manifestChecksum 不符：${checksum}` });
        else { verifyPack({ packDir, outRoot: out!.abs }); checks.push({ key: "asset-pack", status: "pass" }); }
      } catch (e) {
        checks.push({ key: "asset-pack", status: "fail", detail: e instanceof Error ? e.message : String(e) });
      }
    }
  }

  // config：实际哈希 vs subject
  {
    const file = qa?.delivery?.config.file;
    if (file === undefined || out === undefined) checks.push({ key: "config", status: "blocked", detail: "没有 delivery.config 或 out root" });
    else {
      const hit = index.byAbs.get(path.resolve(out.abs, file));
      if (hit === undefined) checks.push({ key: "config", status: "blocked", detail: `配置不在清单里：${file}` });
      else if (hit.result.status === "missing" || hit.result.status === "unreadable") checks.push({ key: "config", status: "blocked", detail: `配置不可用：${hit.result.status}` });
      else if (hit.result.status !== "verified") checks.push({ key: "config", status: "fail", detail: `配置不可验证：${hit.result.status}` });
      else if (hit.result.actual !== subject.configChecksum) checks.push({ key: "config", status: "fail", detail: `configChecksum 不符：${hit.result.actual}` });
      else checks.push({ key: "config", status: "pass" });
    }
  }

  // qa：qaVerdict
  if (qa === undefined) checks.push({ key: "qa", status: "blocked", detail: "qa-report 不可用" });
  else {
    const v = qaVerdict(qa);
    checks.push({ key: "qa", status: v === "pass" ? "pass" : v === "fail" ? "fail" : "incomplete" });
  }

  // site：四文件 + site.json 引用
  {
    const siteDir = out === undefined ? undefined : path.join(out.abs, subject.packId, "site", `v${subject.siteVersion}`);
    if (siteDir === undefined) checks.push({ key: "site", status: "blocked", detail: "没有 out root" });
    else {
      const names = ["index.html", "shell.js", "site.json", "game-config.json"];
      const missing = names.filter((n) => !fs.existsSync(path.join(siteDir, n)));
      if (missing.length > 0) checks.push({ key: "site", status: "blocked", detail: `站点文件缺失：${missing.join(", ")}` });
      else {
        let refs = true;
        try {
          const siteJson = JSON.parse(fs.readFileSync(path.join(siteDir, "site.json"), "utf8")) as Record<string, unknown>;
          refs = siteJson["pack"] === `v${subject.packVersion}` && siteJson["config"] === "game-config.json" && siteJson["shell"] === subject.shellVersion;
        } catch { refs = false; }
        const outAbs = index.roots.get("out")?.abs;
        const statuses = names.map((n) => {
          const rel = outAbs === undefined ? undefined : path.relative(outAbs, path.join(siteDir, n)).split(path.sep).join("/");
          return rel === undefined ? undefined : index.files.get(`out:${rel}`);
        });
        const blocked = statuses.some((r) => r === undefined || r.status === "missing" || r.status === "unreadable");
        const failed = statuses.some((r) => r !== undefined && r.status !== "verified" && r.status !== "missing" && r.status !== "unreadable");
        checks.push(blocked ? { key: "site", status: "blocked", detail: "站点文件缺失/不可读" }
          : failed || !refs ? { key: "site", status: "fail", detail: "站点文件哈希或引用不一致" }
          : { key: "site", status: "pass" });
      }
    }
  }

  // playable-smoke：交付内报告重导出
  {
    const d = qa?.delivery;
    if (d?.playtest === undefined) checks.push({ key: "playable-smoke", status: "blocked", detail: "delivery 没有 playtest 摘要" });
    else {
      const rec = records.find((r) => r.record.role === "playtest-result" && r.json !== undefined);
      if (rec?.json === undefined) checks.push({ key: "playable-smoke", status: "blocked", detail: "playtest 报告不可用" });
      else {
        const p = PlaytestReportSchema.safeParse(rec.json);
        if (!p.success) checks.push({ key: "playable-smoke", status: "fail", detail: "playtest 报告不过 schema" });
        else {
          const mapped = mapPlaytest(playtestSummaryOf(p.data, d.playtest!.report));
          checks.push({ key: "playable-smoke", status: mapped.status, ...(mapped.detail === undefined ? {} : { detail: mapped.detail }) });
        }
      }
    }
  }

  // visual-review：记录完整性 / subject / 与 delivery.visualReview 一致（不重判）
  {
    const review = records.find((r) => r.record.role === "visual-review");
    const supplement = records.find((r) => r.record.role === "visual-supplement");
    const d = qa?.delivery;
    if (review?.json === undefined) checks.push({ key: "visual-review", status: "blocked", detail: "review-record 不可用" });
    else if (d === undefined) checks.push({ key: "visual-review", status: "blocked", detail: "qa-report 没有 delivery" });
    else if (d.visualReview.status === undefined) checks.push({ key: "visual-review", status: "blocked", detail: "delivery 没有 visualReview" });
    else {
      const r = review.json as Record<string, unknown>;
      const items = Array.isArray(r["items"]) ? r["items"] as Array<Record<string, unknown>> : [];
      const overall = r["overall"];
      const allPass = items.length > 0 && items.every((i) => i["verdict"] === "pass");
      const supplementOk = supplement !== undefined && supplement.json === undefined
        ? undefined
        : supplement === undefined ? true : (() => {
          const s = supplement.json as Record<string, unknown>;
          const si = Array.isArray(s["items"]) ? s["items"] as Array<Record<string, unknown>> : [];
          return s["overall"] === "pass" && si.length > 0 && si.every((i) => i["verdict"] === "pass");
        })();
      const binding = d?.visualReview.status;
      if (supplementOk === undefined) checks.push({ key: "visual-review", status: "blocked", detail: "supplement 记录不可用" });
      else if (overall === "fail" || !allPass || !supplementOk) checks.push({ key: "visual-review", status: "fail", detail: "审核记录不是全 pass" });
      else if (binding !== "pass") checks.push({ key: "visual-review", status: "fail", detail: `delivery.visualReview=${binding ?? "(缺)"} 与记录不一致` });
      else checks.push({ key: "visual-review", status: "pass" });
    }
  }
  return { checks };
}

// ─────────────────────────────────────────────────────────────────────────────
// 八、总装
// ─────────────────────────────────────────────────────────────────────────────

const TRUST_BOUNDARY = "能发现相对清单的改动；发现不了清单与被验证据一起被改并提交 —— 后者由 git 提交历史与人工审查负责。三方哈希核对只增加内部矛盾检测，不增加防篡改强度。若启用 trust.anchor，另行记录当前清单与外部摘要的匹配结果；摘要来源的可信性由调用方（CI/base）负责。";

function groupStatus(files: VerificationFileResult[]): DeliveryCheckStatus {
  const required = files.filter((f) => f.required);
  if (required.some((f) => f.status === "path-invalid" || f.status === "hash-mismatch")) return "fail";
  if (required.some((f) => f.status === "missing" || f.status === "unreadable")) return "blocked";
  return "pass";
}

export function readEvidenceManifest(manifestPath: string): { manifest: EvidenceManifest; absPath: string; raw: Buffer } {
  const absPath = path.resolve(manifestPath);
  let raw: Buffer;
  try {
    raw = fs.readFileSync(absPath);
  } catch (e) {
    throw new CommandError("invalid", `读不出清单：${absPath}（${e instanceof Error ? e.message : String(e)}）`);
  }
  let json: unknown;
  try {
    json = JSON.parse(raw.toString("utf8"));
  } catch (e) {
    throw new CommandError("invalid", `清单不是合法 JSON：${e instanceof Error ? e.message : String(e)}`);
  }
  const parsed = EvidenceManifestSchema.safeParse(json);
  if (!parsed.success) {
    const msg = parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("；");
    throw new CommandError("invalid", `清单不过 delivery-evidence-manifest/v1：${msg}`);
  }
  return { manifest: parsed.data, absPath, raw };
}

/** 清单声明的全部 root（绝对路径 + 已解析 realpath）。 */
export type EvidenceRootPath = { id: string; declared: string; abs: string; real?: string };

export function evidenceRootPaths(manifestPath: string): EvidenceRootPath[] {
  const { manifest, absPath } = readEvidenceManifest(manifestPath);
  return [...loadRoots(manifest, path.dirname(absPath)).values()].map((r) => ({
    id: r.id, declared: r.declared, abs: r.abs, ...(r.real === undefined ? {} : { real: r.real }),
  }));
}

/** `--out` 必须落在所有声明 root 之外（Q9）。target 不存在时按最近的已存在祖先解析。 */
export function assertOutOutsideRoots(outDir: string, roots: readonly EvidenceRootPath[]): void {
  const target = path.resolve(outDir);
  let resolved = target;
  if (!fs.existsSync(target)) {
    let ancestor = path.dirname(target);
    while (!fs.existsSync(ancestor) && path.dirname(ancestor) !== ancestor) ancestor = path.dirname(ancestor);
    resolved = path.join(fs.realpathSync(ancestor), path.relative(ancestor, target));
  } else {
    resolved = fs.realpathSync(target);
  }
  const inside = (root: string): boolean => {
    const rel = path.relative(root, resolved);
    return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
  };
  for (const root of roots) {
    const real = root.real ?? root.abs;
    if (inside(real) || inside(root.abs))
      throw new CommandError("usage", `--out 不能位于证据 root 内：${outDir} 在 ${root.id}（${root.declared}）里`);
  }
}

/** 写一次运行的 JSON + Markdown；目录原子分配、绝不覆盖；中途失败不留最终目录。 */
export function writeVerificationReport(opts: { report: DeliveryVerificationReport; outDir: string }): { dir: string; reportJson: string; reportMarkdown: string } {
  const outDir = path.resolve(opts.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = opts.report.generatedAt.replace(/[:.]/g, "-");
  for (let n = 1; ; n += 1) {
    const name = n === 1 ? `${stamp}-delivery-verification` : `${stamp}-${n}-delivery-verification`;
    const finalDir = path.join(outDir, name);
    const tmpDir = path.join(outDir, `.${name}.tmp-${process.pid}`);
    try {
      fs.mkdirSync(tmpDir);
      fs.writeFileSync(path.join(tmpDir, "report.json"), JSON.stringify(opts.report, null, 2) + "\n");
      fs.writeFileSync(path.join(tmpDir, "report.md"), renderVerificationMarkdown(opts.report));
      fs.renameSync(tmpDir, finalDir);
      return { dir: finalDir, reportJson: path.join(finalDir, "report.json"), reportMarkdown: path.join(finalDir, "report.md") };
    } catch (e) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "EEXIST" || code === "ENOTEMPTY") continue;
      throw e;
    }
  }
}

export type AnchorOptions = {
  /** 可信清单摘要，形如 `sha256:<64 位小写十六进制>`。 */
  expectedManifestSha256?: string;
  /** 可信 base 清单路径；给了就要求与当前清单一字节不差。 */
  baseManifestPath?: string;
};

function normalizeExpectedSha(value: string): string {
  const parsed = Sha256.safeParse(value.trim());
  if (!parsed.success)
    throw new CommandError("usage", "--expected-manifest-sha 必须是 sha256:<64 位小写十六进制>");
  return parsed.data;
}

/** 报告里的路径：能相对 cwd 表示就相对，否则绝对。 */
function displayPathOf(absPath: string): string {
  const rel = path.relative(process.cwd(), absPath);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel)
    ? rel.split(path.sep).join("/")
    : absPath;
}

function readBaseManifestRaw(baseManifestPath: string): Buffer {
  const abs = path.resolve(baseManifestPath);
  try {
    return fs.readFileSync(abs);
  } catch (e) {
    throw new CommandError("invalid", `读不出 base manifest：${abs}（${e instanceof Error ? e.message : String(e)}）`);
  }
}

export function verifyDeliveryEvidence(manifestPath: string, anchor?: AnchorOptions): DeliveryVerificationReport {
  if (anchor?.baseManifestPath !== undefined && anchor.expectedManifestSha256 === undefined)
    throw new CommandError("usage", "--base-manifest 需要同时给 --expected-manifest-sha");
  const { manifest, absPath: absManifest, raw } = readEvidenceManifest(manifestPath);
  const actualManifestSha = sha256Of(raw);
  let anchorResult: AnchorResult | undefined;
  let anchorStatus: DeliveryCheckStatus = "pass";
  const anchorDiagnostics: Array<{ category: "anchor"; severity: "fail"; rule: string; message: string }> = [];
  if (anchor?.expectedManifestSha256 !== undefined) {
    const expected = normalizeExpectedSha(anchor.expectedManifestSha256);
    const base = anchor.baseManifestPath === undefined
      ? undefined
      : (() => {
        const baseAbs = path.resolve(anchor.baseManifestPath);
        const baseRaw = readBaseManifestRaw(baseAbs);
        return { path: displayPathOf(baseAbs), sha256: sha256Of(baseRaw), byteEqual: raw.equals(baseRaw) };
      })();
    const digestMatch = expected === actualManifestSha;
    const baseOk = base === undefined || (base.byteEqual && base.sha256 === expected);
    const result = digestMatch && baseOk ? "matched" : "mismatch";
    anchorResult = {
      mode: base === undefined ? "digest" : "digest+base",
      source: "cli",
      expectedSha256: expected,
      actualSha256: actualManifestSha,
      ...(base === undefined ? {} : { baseManifest: base }),
      result,
    };
    if (!digestMatch) anchorDiagnostics.push({
      category: "anchor", severity: "fail", rule: "anchor.manifest-digest",
      message: `清单 sha256 ${actualManifestSha} 与可信摘要 ${expected} 不匹配`,
    });
    if (base !== undefined && !baseOk) anchorDiagnostics.push({
      category: "anchor", severity: "fail", rule: "anchor.base-manifest",
      message: `base manifest ${base.path} sha256 ${base.sha256}，byteEqual=${base.byteEqual}，期望摘要 ${expected}`,
    });
    if (result === "mismatch") anchorStatus = "fail";
  }
  const manifestDir = path.dirname(absManifest);
  const roots = loadRoots(manifest, manifestDir);
  const fileResults = manifest.files.map((f) => verifyOneFile(f, roots));
  const filesByKey = new Map(fileResults.map((r) => [`${r.root}:${r.path}`, r]));
  const index = buildIndex(manifest, roots, fileResults, manifestDir);
  const records = readRecords(manifest, roots, filesByKey);
  const qaRecord = records.find((r) => r.record.role === "qa-report");
  let qa: QAReport | undefined;
  if (qaRecord?.json !== undefined) {
    const p = QAReportSchema.safeParse(qaRecord.json);
    if (p.success) qa = p.data;
  }
  const identity = verifyIdentity(records, manifest.subject, index);

  const three = threeWay(index, records, manifest.subject);
  const site = siteIntegrity(index, records, manifest.subject);
  const references = reportReferences(index, qa);
  const visual = visualConsistency(index, records);
  const play = playtestConsistency(records, qa);
  const coverage = mechanicCoverageConsistency(records, manifest.subject);
  const recompute = recomputeChecks({ manifest, index, qa, records });

  // 一致性状态
  const consistencyAll = [...three.results, ...site.results, ...references.results, ...visual.results, ...play.results, ...coverage.results];
  const consistencyDiagnostics = [...three.diagnostics, ...site.diagnostics, ...references.diagnostics, ...visual.diagnostics, ...play.diagnostics, ...coverage.diagnostics];
  const consistencyStatus: DeliveryCheckStatus = consistencyDiagnostics.some((d) => d.status === "fail") || consistencyAll.some((r) => r.status === "fail")
    ? "fail" : consistencyDiagnostics.some((d) => d.status === "blocked") || consistencyAll.some((r) => r.status === "blocked") ? "blocked" : "pass";

  // 声明 vs 重算
  const declaredChecks = qa?.delivery?.checks ?? [];
  const declaredVerdict = qa?.delivery?.verdict ?? null;
  const comparison = recompute.checks.map((c) => {
    const d = declaredChecks.find((x) => x.key === c.key);
    return { key: c.key, declared: d?.status ?? null, recomputed: c.status, match: d?.status === c.status };
  });
  const recomputedVerdict = deriveDeliveryVerdict(recompute.checks.map((c) => ({ status: c.status, required: true })));
  const verdictMatch = declaredVerdict !== null && declaredVerdict === recomputedVerdict;
  // ⚠️ 重算本身 blocked/incomplete（例如必需证据缺失）时，**不要**把「声明 pass」读成确定性矛盾 ——
  //   那会把 Q7 的「缺失 → blocked」变成「缺失 → fail」。只有重算得到确定的 pass/fail 才比较声明值。
  const verdictStatus: DeliveryCheckStatus = declaredVerdict === null ? "blocked"
    : recomputedVerdict === "blocked" || recomputedVerdict === "incomplete" ? recomputedVerdict
    : !verdictMatch || comparison.some((c) => !c.match) ? "fail" : "pass";

  const filesStatus = groupStatus(fileResults);
  const identityStatus: DeliveryCheckStatus = identity.results.some((r) => r.status === "mismatch" || r.status === "invalid")
    ? "fail" : identity.results.some((r) => r.status === "missing" || r.status === "unreadable") ? "blocked" : "pass";
  const status = deriveDeliveryVerdict([
    { status: filesStatus, required: true },
    { status: identityStatus, required: true },
    { status: consistencyStatus, required: true },
    { status: verdictStatus, required: true },
    { status: anchorStatus, required: true },
  ]);

  const diagnostics = [
    ...anchorDiagnostics,
    ...fileResults.filter((f) => f.required && f.status !== "verified")
      .map((f) => ({
        category: "files" as const,
        severity: f.status === "path-invalid" || f.status === "hash-mismatch" ? "fail" as const : "blocked" as const,
        rule: `file.${f.status}`,
        message: `${f.root}:${f.path} —— ${f.detail ?? f.status}`,
        root: f.root, path: f.path,
      })),
    ...identity.diagnostics.map((d) => ({
      category: "identity" as const,
      severity: d.rule === "identity.mismatch" ? "fail" as const : "blocked" as const,
      rule: d.rule, message: d.message, record: d.record,
    })),
    ...consistencyDiagnostics.map((d) => ({
      category: "consistency" as const, severity: d.status, rule: d.rule, message: d.message,
    })),
    ...(verdictStatus === "fail" ? [{
      category: "verdict" as const, severity: "fail" as const, rule: "verdict.declared-vs-recomputed",
      message: `声明 ${declaredVerdict ?? "(缺)"} / 重算 ${recomputedVerdict}`,
    }] : declaredVerdict === null ? [{
      category: "verdict" as const, severity: "blocked" as const, rule: "verdict.declared",
      message: "交付没有声明 verdict",
    }] : verdictStatus !== "pass" ? [{
      category: "verdict" as const, severity: verdictStatus === "blocked" || verdictStatus === "incomplete" ? "blocked" as const : "fail" as const,
      rule: "verdict.recomputed", message: `声明 ${declaredVerdict} / 重算 ${recomputedVerdict}（不把声明值当当前结论）`,
    }] : []),
  ];

  const displayManifestPath = displayPathOf(absManifest);
  const report: DeliveryVerificationReport = {
    format: "delivery-verification/v1",
    generatedAt: new Date().toISOString(),
    input: { manifest: { path: displayManifestPath, sha256: actualManifestSha }, subject: manifest.subject },
    ...(anchorResult === undefined ? {} : { trust: anchorResult }),
    scope: {
      roots: Object.fromEntries([...roots.values()].map((r) => [r.id, r.declared])),
      files: { total: fileResults.length, required: fileResults.filter((f) => f.required).length, optional: fileResults.filter((f) => !f.required).length },
      records: records.length,
    },
    trustBoundary: TRUST_BOUNDARY,
    declared: { verdict: declaredVerdict, checks: declaredChecks.map((c) => ({ key: c.key, status: c.status, ...(c.detail === undefined ? {} : { detail: c.detail }) })) },
    recomputed: { verdict: recomputedVerdict, checks: recompute.checks.map((c) => ({ key: c.key, status: c.status, ...(c.detail === undefined ? {} : { detail: c.detail }) })) },
    comparison: { verdictMatch, checks: comparison },
    results: { files: fileResults, identities: identity.results, consistency: consistencyAll },
    diagnostics,
    status,
    exitCode: status === "pass" ? 0 : 1,
    limitations: [
      "本报告由已有证据重导出，不重新构建游戏、不重新执行 QA、不重新启动浏览器试玩。",
      "visual-review 只校验记录完整性与一致性，不重判人工视觉结论。",
      "信任边界：能发现相对清单的改动；发现不了清单与被验证据一起被改并提交。",
      ...(anchorResult === undefined ? [] : ["锚点校验只证明当前清单匹配给定摘要；摘要本身的可信来源由 CI/base 负责。"]),
      "本版不做：五态真实 E2E、第二个 Demo 的泛化、MCP 镜像。",
    ],
  };
  return DeliveryVerificationReportSchema.parse(report);
}

// ─────────────────────────────────────────────────────────────────────────────
// 九、Markdown（人读版；与 JSON 同一次运行）
// ─────────────────────────────────────────────────────────────────────────────

export function renderVerificationMarkdown(report: DeliveryVerificationReport): string {
  const lines: string[] = [];
  lines.push(`# 证据完整性验收报告`, "");
  lines.push(`- 结论：**${report.status}**（退出码 ${report.exitCode}）`, `- 生成时间：${report.generatedAt}`);
  lines.push(`- 清单：\`${report.input.manifest.path}\``, `  sha256：\`${report.input.manifest.sha256}\``);
  lines.push(`- subject：${report.input.subject.packId} v${report.input.subject.packVersion} · site v${report.input.subject.siteVersion} · shell ${report.input.subject.shellVersion}`);
  if (report.trust !== undefined) {
    lines.push(`- 信任锚点：**${report.trust.result}**（${report.trust.mode}）`,
      `  expected：\`${report.trust.expectedSha256}\``,
      `  actual：\`${report.trust.actualSha256}\``);
    if (report.trust.baseManifest !== undefined)
      lines.push(`  base manifest：\`${report.trust.baseManifest.path}\` · sha256 \`${report.trust.baseManifest.sha256}\` · byteEqual ${report.trust.baseManifest.byteEqual}`);
  }
  lines.push(`- 范围：${report.scope.files.total} 文件（required ${report.scope.files.required} / optional ${report.scope.files.optional}）· ${report.scope.records} 条记录`, "");
  lines.push(`## 声明 vs 重算`, "", "| 检查 | 声明 | 重算 | 一致 |", "|---|---|---|---|");
  for (const c of report.comparison.checks) lines.push(`| ${c.key} | ${c.declared ?? "—"} | ${c.recomputed} | ${c.match ? "✓" : "✗"} |`);
  lines.push("", `- 声明 verdict：${report.declared.verdict ?? "—"}`, `- 重算 verdict：${report.recomputed.verdict}`, "");
  lines.push(`## 文件（${report.results.files.filter((f) => f.status !== "verified").length} 项非 verified）`, "");
  for (const f of report.results.files.filter((x) => x.required && x.status !== "verified")) lines.push(`- [${f.status}] \`${f.root}:${f.path}\`${f.detail ? ` —— ${f.detail}` : ""}`);
  if (report.results.files.every((f) => f.status === "verified")) lines.push("- 全部文件 verified");
  lines.push("", `## 身份（${report.results.identities.length}）`, "");
  for (const i of report.results.identities) lines.push(`- [${i.status}] \`${i.record}\`${i.detail ? ` —— ${i.detail}` : ""}`);
  lines.push("", `## 一致性（${report.results.consistency.length}）`, "");
  for (const c of report.results.consistency.filter((x) => x.status !== "verified")) lines.push(`- [${c.status}] ${c.id}：${c.detail ?? c.rule}`);
  lines.push("", `## 诊断（${report.diagnostics.length}）`, "");
  for (const d of report.diagnostics) lines.push(`- [${d.severity}] ${d.rule}：${d.message}`);
  lines.push("", `## 信任边界`, "", report.trustBoundary, "", `## 已知限制`, "");
  for (const l of report.limitations) lines.push(`- ${l}`);
  return lines.join("\n") + "\n";
}
