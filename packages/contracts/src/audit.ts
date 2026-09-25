// 生成路径上的**确定性校验** —— R2 留下的、唯一的质量控制，全部集中在这里。
//
// R2 砍掉的是「打分」与「自动修复」，不是「校验」。凡是能在生成路径上静态判定的，都留。
// 这里只放**判定**，不放「怎么办」—— 报出来，由调用方决定。
import type { AssetPackEntry } from "./assetpack.js";
import type { AnimationSpec, AssetSpec } from "./asset-spec.js";
import type { DrawList } from "./drawlist.js";
import type { Bounds } from "./geometry.js";

export type SizeVerdict =
  | { ok: true }
  | { ok: false; severity: "error" | "warning"; message: string };

/**
 * 尺寸校验：**只判过大，且分两档**（票 27）。
 *
 * - `bounds.exact === true` —— 包围盒是精确的，超出就是违规，**容差 0**，报 `error`。
 * - `bounds.exact === false` —— 含 `curve`，包围盒是**凸包上界**，只会高估。
 *   上界都超出时才报，且报的是「**可能**超出」（`warning`）—— 因为它可能只是高估。
 *
 * **不需要魔法阈值**：上界的误差就是它自己的不确定性，`exact` 这个字段已经把它说清楚了。
 * 给一个百分比容差反而会给精确图元白送宽容。
 */
export function checkSize(bounds: Bounds, expected: { w: number; h: number }): SizeVerdict {
  if (!bounds.box) return { ok: false, severity: "error", message: "画布上一个非透明像素都没有" };
  const { w, h } = bounds.box;
  const overW = w > expected.w, overH = h > expected.h;
  if (!overW && !overH) return { ok: true };
  const detail = `实际 ${round(w)}×${round(h)} 超出期望 ${expected.w}×${expected.h}`;
  return bounds.exact
    ? { ok: false, severity: "error", message: `尺寸越界（包围盒精确）：${detail}` }
    : { ok: false, severity: "warning", message: `尺寸**可能**越界（含 curve，包围盒是凸包上界）：${detail}` };
}
const round = (v: number) => Math.round(v * 10) / 10;

/**
 * **spec ↔ 产物对账**：`AssetSpec` 说要做成什么样，包里实际做出的是什么。
 *
 * 这是「需求 vs 产物」**唯一**的对账点。没有它，`AssetSpec` 里的
 * `size` / `animations` / `anchor` 就只是写给自己看的注释。
 *
 * @param drawlists 可选：给了就顺带核对每份 drawlist 的 `viewBox` 与声明的尺寸。
 *                  不一致时锚点的分母就错了，而错误会**静默**传递到装配。
 */
export function auditAssetSpec(spec: AssetSpec, entry: AssetPackEntry, drawlists: readonly DrawList[] = []): string[] {
  const issues: string[] = [];
  const at = (m: string) => issues.push(`资源 "${spec.id}"：${m}`);

  if (spec.kind !== entry.kind) at(`spec 声明为 ${spec.kind}，产物却是 ${entry.kind}`);

  if (entry.size.w !== spec.size.w || entry.size.h !== spec.size.h)
    at(`尺寸对不上：spec 要 ${spec.size.w}×${spec.size.h}，产物是 ${entry.size.w}×${entry.size.h}`);

  // ── 动画名与帧数 ─────────────────────────────────────────────────────────
  const declared: AnimationSpec[] = spec.kind === "animation" ? spec.animations : [];
  const produced = entry.animations ?? [];
  if (spec.kind === "animation") {
    const want = new Set(declared.map((a) => a.name));
    const got = new Set(produced.map((a) => a.name));
    for (const n of want) if (!got.has(n)) at(`动画 "${n}" 没有做出来`);
    for (const n of got) if (!want.has(n)) at(`做出了没要求的动画 "${n}"`);
    for (const a of declared) {
      const b = produced.find((x) => x.name === a.name);
      if (b && b.frames.length !== a.frames) at(`动画 "${a.name}" 要 ${a.frames} 帧，实际 ${b.frames.length} 帧`);
    }
  } else if (produced.length > 0) {
    at(`声明为 ${spec.kind}，产物却带了动画（${produced.map((a) => a.name).join(", ")}）`);
  }
  if (spec.kind !== "animation" && entry.frames.length > 1)
    at(`声明为 ${spec.kind}，产物却有 ${entry.frames.length} 帧`);

  // ── drawlist 的画布与声明的尺寸 ──────────────────────────────────────────
  for (const dl of drawlists) {
    const [vw, vh] = [dl.viewBox[2], dl.viewBox[3]];
    if (vw !== spec.size.w || vh !== spec.size.h)
      at(`drawlist "${dl.id}.${dl.frame}" 的 viewBox 是 ${vw}×${vh}，与声明的 ${spec.size.w}×${spec.size.h} 不一致 —— 锚点的分母会跟着错`);
  }
  return issues;
}
