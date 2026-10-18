// `build` / `create --yes` 终端里的 **inspect 观察摘要**（v3 终端摘要那张图）。
//
// ⚠️ **纯函数**：不 I/O、不调用 `inspectPack`、不读 PNG、不解析 `inspectPack.summary` 的文本。
//   输入只有 pipeline 已经收窄好的 `InspectData` 与 QA 报告里那条 inspect 观察。
// ⚠️ 只**聚合**，不评分、不阻断、不设阈值；缺字段 / 非法字段 ⇒ 省略对应段，绝不抛错、绝不以 0 冒充缺失。
import type { Observation } from "@game-maker/contracts";
import type { InspectData, SourceSizeEntry } from "@game-maker/assets";

export type InspectDigestPaths = { qaReport: string; packDir: string };

const HEADER = "资源观察摘要（不评分 · 不阻断）：";

/** QA 报告里那条 inspect 观察（每个来源恰好一条；契约保证）。 */
export function inspectObservationOf(observations: readonly Observation[]): Observation | undefined {
  return observations.find((o) => o.source === "inspect");
}

/**
 * 渲染摘要。返回 `[]` = **整块不出现**（03：`ok` 但没有 `inspectData`）。
 * unavailable ⇒ **一行**同源原因，没有 header / 指针。
 */
export function inspectDigestLines(
  inspectData: InspectData | undefined,
  observation: Observation | undefined,
  paths: InspectDigestPaths,
): string[] {
  if (observation?.outcome === "unavailable") return [`inspect 观察不可用：${observation.reason}`];
  if (inspectData === undefined) return [];

  const lines = [HEADER];

  const first: string[] = [];
  const assetCount = Array.isArray(inspectData.assets) ? inspectData.assets.length : undefined;
  if (assetCount !== undefined) first.push(`${assetCount} 个资源`);
  const sizes = validSourceSizes(inspectData.sourceSizes);
  if (sizes.length > 0) {
    // ⚠️ 并列取 manifest 顺序第一条（strict > 保留先出现的那个）。
    const max = sizes.reduce((a, b) => (Math.abs(b.deltaAr) > Math.abs(a.deltaAr) ? b : a));
    first.push(`源图→目标 ${sizes.length} 条 · 最大 |长宽比差| ${Math.abs(max.deltaAr).toFixed(1)}%（${labelOf(max)}）`);
  }
  if (first.length > 0) lines.push(`  ${first.join(" · ")}`);

  const second: string[] = [];
  const off = offPaletteOf(inspectData.paletteUsage);
  if (off !== undefined) second.push(`色板外像素 ${off.pixels} 个（${(off.share * 100).toFixed(2)}%）`);
  const cover = coverageOf(inspectData.layerCoverage);
  if (cover !== undefined) second.push(`背景层 ${cover.count} 帧 · 最低覆盖 ${(cover.ratio * 100).toFixed(1)}%（${cover.frame}）`);
  if (second.length > 0) lines.push(`  ${second.join(" · ")}`);

  lines.push(`  全文：${paths.qaReport} · game-maker inspect ${paths.packDir}`);
  return lines;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const finiteNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const labelOf = (e: SourceSizeEntry): string => (e.unit === "" ? e.id : `${e.id}.${e.unit}`);

function validSourceSizes(entries: unknown): SourceSizeEntry[] {
  if (!Array.isArray(entries)) return [];
  return entries.filter((e): e is SourceSizeEntry => {
    if (!isRecord(e)) return false;
    return typeof e["id"] === "string" && typeof e["unit"] === "string" && finiteNumber(e["deltaAr"]);
  });
}

function offPaletteOf(paletteUsage: unknown): { pixels: number; share: number } | undefined {
  if (!isRecord(paletteUsage)) return undefined;
  const off = paletteUsage["offPalette"];
  if (!isRecord(off)) return undefined;
  const pixels = off["pixels"], share = off["share"];
  // ⚠️ 真零（0 个 / 0.00%）照常显示；缺失或非法才省略。
  if (!(typeof pixels === "number" && Number.isInteger(pixels) && pixels >= 0)) return undefined;
  if (!(finiteNumber(share) && share >= 0 && share <= 1)) return undefined;
  return { pixels, share };
}

function coverageOf(layerCoverage: unknown): { count: number; ratio: number; frame: string } | undefined {
  if (!Array.isArray(layerCoverage)) return undefined;
  const valid = layerCoverage.filter((e): e is { frame: string; ratio: number } => {
    if (!isRecord(e)) return false;
    const frame = e["frame"], ratio = e["ratio"];
    return typeof frame === "string" && frame.length > 0 && finiteNumber(ratio) && ratio >= 0 && ratio <= 1;
  });
  if (valid.length === 0) return undefined;
  let min = valid[0]!;
  // ⚠️ 并列取 manifest 顺序第一条（strict < 保留先出现的那个）。
  for (const e of valid.slice(1)) if (e.ratio < min.ratio) min = e;
  return { count: valid.length, ratio: min.ratio, frame: min.frame };
}
