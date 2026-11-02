// 基线更新候选校验：目标明确、目标隔离、diff 白名单、freezeHashes 不可被普通更新改写。
// base 是可信配置；candidate 只作为数据读取，不执行候选代码。
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { loadRegistry, RegistryError } from "./baseline-registry.mjs";
import { parseStrictUpdateLog } from "./update-log.mjs";

export const REGISTRY_REL = ".scratch/baselines/registry.json";

function fail(code, message) {
  throw new RegistryError(code, message);
}

function readBytes(p, label) {
  try {
    return fs.readFileSync(p);
  } catch (e) {
    fail("candidate.file-missing", `${label} 读不出：${p}（${e instanceof Error ? e.message : String(e)}）`);
  }
}

function byId(list, id) {
  return list.find((b) => b.id === id);
}

export function validateBaselineCandidate({ baseRoot, candidateRoot, baselineId, changedPaths = [] }) {
  const absBase = path.resolve(baseRoot);
  const absCand = path.resolve(candidateRoot);
  const baseRegistryPath = path.join(absBase, REGISTRY_REL);
  const candRegistryPath = path.join(absCand, REGISTRY_REL);
  const base = loadRegistry({ registryPath: baseRegistryPath, repoRoot: absBase, exactIds: true });
  const target = base.byId.get(baselineId);
  if (target === undefined) fail("candidate.baseline-missing", `Registry 中没有目标基线：${baselineId}`);
  const cand = loadRegistry({ registryPath: candRegistryPath, repoRoot: absCand, requiredIds: [baselineId] });
  const candTarget = cand.byId.get(baselineId);
  if (candTarget === undefined) fail("candidate.baseline-missing", `candidate Registry 中没有目标基线：${baselineId}`);

  const baseIds = [...base.byId.keys()].sort();
  const candIds = [...cand.byId.keys()].sort();
  if (!isDeepStrictEqual(baseIds, candIds)) {
    fail("candidate.baseline-set", `candidate 基线集合 ${candIds.join(",")} 与 base ${baseIds.join(",")} 不一致`);
  }

  for (const id of baseIds) {
    if (id === baselineId) continue;
    const b = byId(base.registry.baselines, id);
    const c = byId(cand.registry.baselines, id);
    if (!isDeepStrictEqual(b, c)) fail("candidate.non-target-registry", `非目标基线 ${id} 的 Registry entry 被修改`);
  }

  for (const key of ["id", "name", "manifestFormat", "freezeHashes"]) {
    if (target[key] !== candTarget[key]) fail("candidate.meta-changed", `目标基线 ${key} 不允许在更新中改变`);
  }
  for (const key of ["manifest", "anchor", "updateLog"]) {
    if (target[key] !== candTarget[key]) fail("candidate.path-changed", `目标基线 ${key} 路径不允许在更新中改变`);
  }

  if (target.freezeHashesAbs !== undefined) {
    const oldBytes = readBytes(target.freezeHashesAbs, "base freezeHashes");
    const newBytes = readBytes(candTarget.freezeHashesAbs, "candidate freezeHashes");
    if (!oldBytes.equals(newBytes)) {
      fail("candidate.freezeHashes-changed", "freezeHashes 是冻结快照身份依据，不能被普通基线更新改写");
    }
  }

  for (const id of baseIds) {
    if (id === baselineId) continue;
    const b = base.byId.get(id);
    const c = cand.byId.get(id);
    for (const [label, pa, pb] of [
      ["manifest", b.manifestAbs, c.manifestAbs],
      ["anchor", b.anchorAbs, c.anchorAbs],
      ["updateLog", b.updateLogAbs, c.updateLogAbs],
    ]) {
      if (!readBytes(pa, `base ${id} ${label}`).equals(readBytes(pb, `candidate ${id} ${label}`))) {
        fail("candidate.non-target-changed", `非目标基线 ${id} 的 ${label} 被修改`);
      }
    }
    if (b.freezeHashesAbs !== undefined || c.freezeHashesAbs !== undefined) {
      if (b.freezeHashesAbs === undefined || c.freezeHashesAbs === undefined) {
        fail("candidate.non-target-changed", `非目标基线 ${id} 的 freezeHashes 存在性被修改`);
      }
      if (!readBytes(b.freezeHashesAbs, `base ${id} freezeHashes`).equals(readBytes(c.freezeHashesAbs, `candidate ${id} freezeHashes`))) {
        fail("candidate.non-target-changed", `非目标基线 ${id} 的 freezeHashes 被修改`);
      }
    }
  }

  if (baselineId !== "fpvs-v1") {
    parseStrictUpdateLog(fs.readFileSync(candTarget.updateLogAbs, "utf8"), candTarget);
  }

  const allowed = new Set([target.manifest, target.anchor, target.updateLog, REGISTRY_REL].map((p) => path.posix.normalize(p)));
  for (const raw of changedPaths) {
    const p = path.posix.normalize(String(raw).trim());
    if (p === "") continue;
    if (!allowed.has(p)) fail("candidate.unexpected-path", `候选 diff 含非允许路径：${p}`);
  }

  return {
    format: "baseline-candidate-validation/v1",
    generatedAt: new Date().toISOString(),
    baselineId,
    oldManifestSha256: target.manifestSha,
    newManifestSha256: candTarget.manifestSha,
    targetManifest: target.manifest,
    targetAnchor: target.anchor,
    targetUpdateLog: target.updateLog,
    freezeHashes: target.freezeHashes ?? null,
    changedPaths: changedPaths.map((p) => String(p).trim()).filter(Boolean),
    result: "pass",
  };
}
