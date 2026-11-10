// **可信 Atlas 输入**（I-01）—— 纯验证，不读盘、不算哈希。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、为什么住 contracts 而不读文件
//
//   G-01 要求「Hitbox 几何来自经过验证的 Atlas 字节」。读取与 SHA-256 必须住在
//   能碰 `node:fs` / `node:crypto` 的层（`packages/assets/src/ops.ts`）；contracts
//   保持浏览器兼容，只接收**同一份** `bytes`，用它做 digest 比对与 `AtlasJson` 解析。
//   ⇒ TOCTOU 由构造关闭：函数只收 `bytes`，没有路径可二次读盘。
//
// 二、全有或全无
//
//   `TemporalInputResult` 是判别联合：失败时不携带任何可消费几何。失败**累积**返回，
//   按 `(code, atlasPath, assetId, frameName)` 去重并稳定排序，便于诊断与测试。
//
// 三、brand 的边界
//
//   运行时 brand 是架构纪律与误用防护，**不是同进程内的密码学安全边界** ——
//   它不能抵御恶意代码伪造或篡改。唯一生产者是 `verifyTemporalInput`；不导出铸造工厂。
// ─────────────────────────────────────────────────────────────────────────────
import { AtlasJson } from "../atlas-json.js";
import type { AssetPackEntry, AssetPackManifest } from "../assetpack.js";

/** 模块私有 brand。**永不导出** ⇒ 包外无法铸造。 */
const trustedBrand: unique symbol = Symbol("game-maker.trusted-atlas-input");

/** 几何相等容差（I01-03）。只用于 anchor 相等，不复用门宽 ε。 */
const ANCHOR_EQUAL_EPSILON = 1e-9;

export type TemporalInputFailureCode =
  | "atlas-file-missing"
  | "atlas-checksum-mismatch"
  | "atlas-json-invalid"
  | "frame-missing"
  | "frame-source-size-mismatch"
  | "frame-anchor-missing"
  | "frame-anchor-mismatch"
  | "asset-unverified"
  | "frame-rotated-unsupported"
  | "frame-trimmed-unsupported";

export type TemporalInputFailure = {
  readonly code: TemporalInputFailureCode;
  readonly atlasPath?: string;
  readonly assetId?: string;
  readonly frameName?: string;
  readonly detail: string;
};

export type FrameGeometry = {
  readonly assetId: string;
  readonly atlasId: string;
  readonly frameName: string;
  readonly sourceSize: { readonly w: number; readonly h: number };
  readonly anchor: { readonly x: number; readonly y: number };
};

export type VerifiedFile = {
  readonly path: string;
  readonly bytes: number;
  readonly checksum: string;
};

export type TrustedAtlasInput = {
  readonly [trustedBrand]: true;
  /** 键 `assetId/frameName`。 */
  readonly frames: ReadonlyMap<string, FrameGeometry>;
  readonly assets: ReadonlySet<string>;
  /** 追溯到已校验字节；顺序稳定（按路径排序）。 */
  readonly files: readonly VerifiedFile[];
};

export type TemporalInputResult =
  | { readonly ok: true; readonly value: TrustedAtlasInput }
  | { readonly ok: false; readonly failures: readonly TemporalInputFailure[] };

export type VerifyTemporalInputInput = {
  readonly manifest: AssetPackManifest;
  /** 调用方从 `GameConfig` 推导出的资产 id 集合（player + 引用的 hazard / pickup / goal）。 */
  readonly assetIds: readonly string[];
  /** 每个相关 Atlas JSON 的路径与字节；按 path 去重。 */
  readonly atlases: readonly { readonly path: string; readonly bytes: Uint8Array }[];
  /** 生产只允许真实 sha256；测试可注入。 */
  readonly digest: (bytes: Uint8Array) => string;
};

const failureKey = (f: TemporalInputFailure): string =>
  [f.code, f.atlasPath ?? "", f.assetId ?? "", f.frameName ?? ""].join("\u0000");

const sortFailures = (failures: TemporalInputFailure[]): TemporalInputFailure[] => {
  const byKey = new Map<string, TemporalInputFailure>();
  for (const f of failures) {
    const key = failureKey(f);
    if (!byKey.has(key)) byKey.set(key, f);
  }
  return [...byKey.values()].sort((a, b) => failureKey(a).localeCompare(failureKey(b)));
};

const detailOf = (e: unknown): string => e instanceof Error ? e.message : String(e);

/**
 * 验证一整包可信输入。
 *
 * @returns `{ ok: true }` 时品牌值可被 `auditPlayabilityTemporal` 消费；`{ ok: false }`
 *          时携带**全部**累积失败，不携带任何几何。
 */
export function verifyTemporalInput(input: VerifyTemporalInputInput): TemporalInputResult {
  const failures: TemporalInputFailure[] = [];
  const assets: AssetPackEntry[] = [];
  const seenAssets = new Set<string>();

  for (const id of input.assetIds) {
    if (seenAssets.has(id)) continue;
    seenAssets.add(id);
    const asset = input.manifest.assets.find((a) => a.id === id);
    if (asset === undefined) {
      failures.push({ code: "asset-unverified", assetId: id, detail: `manifest 里没有资产 "${id}"` });
      continue;
    }
    assets.push(asset);
  }

  // 路径 → 需要该 atlas 的资产。按路径去重；相同路径只验一次。
  const required = new Map<string, AssetPackEntry[]>();
  for (const asset of assets) {
    const atlas = input.manifest.atlases.find((a) => a.id === asset.atlasId);
    if (atlas === undefined) {
      failures.push({
        code: "asset-unverified", assetId: asset.id,
        detail: `资产 "${asset.id}" 指向的图集 "${asset.atlasId}" 不在 manifest 里`,
      });
      continue;
    }
    const list = required.get(atlas.meta) ?? [];
    list.push(asset);
    required.set(atlas.meta, list);
  }

  // 调用方提供的字节按路径分组；同一路径多份时先比 digest 是否一致。
  const provided = new Map<string, Uint8Array[]>();
  for (const entry of input.atlases) {
    const list = provided.get(entry.path) ?? [];
    list.push(entry.bytes);
    provided.set(entry.path, list);
  }

  const parsedByPath = new Map<string, AtlasJson>();
  const verifiedFiles: VerifiedFile[] = [];

  for (const [atlasPath] of [...required.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const fileEntry = input.manifest.files.find((f) => f.path === atlasPath);
    if (fileEntry === undefined) {
      failures.push({
        code: "atlas-file-missing", atlasPath,
        detail: `manifest.files[] 里没有图集 "${atlasPath}"`,
      });
      continue;
    }
    const candidates = provided.get(atlasPath) ?? [];
    if (candidates.length === 0) {
      failures.push({
        code: "atlas-file-missing", atlasPath,
        detail: `没有提供图集字节：${atlasPath}`,
      });
      continue;
    }
    const digests = candidates.map((bytes) => input.digest(bytes));
    if (new Set(digests).size > 1) {
      failures.push({
        code: "atlas-checksum-mismatch", atlasPath,
        detail: `同一路径提供了 ${candidates.length} 份不同的字节：${atlasPath}`,
      });
      continue;
    }
    const checksum = digests[0]!;
    if (checksum !== fileEntry.checksum) {
      failures.push({
        code: "atlas-checksum-mismatch", atlasPath,
        detail: `SHA 不符：manifest 声明 ${fileEntry.checksum}，实际 ${checksum}`,
      });
      continue;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(new TextDecoder().decode(candidates[0]!));
    } catch (e) {
      failures.push({ code: "atlas-json-invalid", atlasPath, detail: `不是合法 JSON：${detailOf(e)}` });
      continue;
    }
    const parsed = AtlasJson.safeParse(raw);
    if (!parsed.success) {
      failures.push({
        code: "atlas-json-invalid", atlasPath,
        detail: `图集 schema 不符：${parsed.error.issues.slice(0, 3).map((i) => i.message).join("；")}`,
      });
      continue;
    }
    parsedByPath.set(atlasPath, parsed.data);
    verifiedFiles.push({ path: atlasPath, bytes: candidates[0]!.byteLength, checksum });
  }

  // 逐帧几何。每个失败的帧**累积全部**不适用的判据，不是首错即停。
  const frames = new Map<string, FrameGeometry>();
  for (const asset of assets) {
    const atlas = input.manifest.atlases.find((a) => a.id === asset.atlasId);
    if (atlas === undefined) continue;
    const parsed = parsedByPath.get(atlas.meta);
    if (parsed === undefined) continue;

    for (const frameRef of asset.frames) {
      const frame = parsed.frames[frameRef.name];
      if (frame === undefined) {
        failures.push({
          code: "frame-missing", atlasPath: atlas.meta, assetId: asset.id, frameName: frameRef.name,
          detail: `图集 "${atlas.meta}" 里没有帧 "${frameRef.name}"`,
        });
        continue;
      }

      let frameFailed = false;
      const anchor = frame.anchor;
      if (frame.sourceSize.w !== asset.size.w || frame.sourceSize.h !== asset.size.h) {
        frameFailed = true;
        failures.push({
          code: "frame-source-size-mismatch", atlasPath: atlas.meta, assetId: asset.id, frameName: frameRef.name,
          detail: `sourceSize ${frame.sourceSize.w}×${frame.sourceSize.h} 与 asset.size ${asset.size.w}×${asset.size.h} 不一致`,
        });
      }
      if (anchor === undefined) {
        frameFailed = true;
        failures.push({
          code: "frame-anchor-missing", atlasPath: atlas.meta, assetId: asset.id, frameName: frameRef.name,
          detail: "帧没有 anchor —— 缺失不等于已验证，不回落默认值",
        });
      } else if (
        Math.abs(anchor.x - asset.anchor.x) > ANCHOR_EQUAL_EPSILON ||
        Math.abs(anchor.y - asset.anchor.y) > ANCHOR_EQUAL_EPSILON
      ) {
        frameFailed = true;
        failures.push({
          code: "frame-anchor-mismatch", atlasPath: atlas.meta, assetId: asset.id, frameName: frameRef.name,
          detail: `anchor {${anchor.x}, ${anchor.y}} 与 asset.anchor {${asset.anchor.x}, ${asset.anchor.y}} 不一致`,
        });
      }
      if (frame.rotated) {
        frameFailed = true;
        failures.push({
          code: "frame-rotated-unsupported", atlasPath: atlas.meta, assetId: asset.id, frameName: frameRef.name,
          detail: "帧标记 rotated=true —— I-01 不支持旋转帧",
        });
      }
      if (frame.trimmed) {
        frameFailed = true;
        failures.push({
          code: "frame-trimmed-unsupported", atlasPath: atlas.meta, assetId: asset.id, frameName: frameRef.name,
          detail: "帧标记 trimmed=true —— I-01 不支持裁剪帧",
        });
      }
      if (frameFailed || anchor === undefined) continue;

      frames.set(`${asset.id}/${frameRef.name}`, {
        assetId: asset.id,
        atlasId: asset.atlasId,
        frameName: frameRef.name,
        sourceSize: { w: frame.sourceSize.w, h: frame.sourceSize.h },
        anchor: { x: anchor.x, y: anchor.y },
      });
    }
  }

  if (failures.length > 0) return { ok: false, failures: sortFailures(failures) };

  const value: TrustedAtlasInput = {
    [trustedBrand]: true,
    frames,
    assets: new Set(assets.map((a) => a.id)),
    files: [...verifiedFiles].sort((a, b) => a.path.localeCompare(b.path)),
  };
  return { ok: true, value };
}

/** 运行时 brand 守卫。**不是密码学边界**；只拒绝没有本模块私有 brand 的对象。 */
export function isTrustedAtlasInput(value: unknown): value is TrustedAtlasInput {
  return typeof value === "object" && value !== null
    && (value as { readonly [trustedBrand]?: unknown })[trustedBrand] === true;
}
