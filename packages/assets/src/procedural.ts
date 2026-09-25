// **不用 LLM 的兜底生成器**（票 14 的裁决）。
//
// 上游全不可达时，产物 A 不应该彻底停摆 —— 它应该产出一个**结构完整**的包：
// 尺寸对、帧数对、锚点对、颜色全在色板内、能被引擎直接加载。只是**难看**。
//
// 为什么不退到「仓库内置的 fixture 包」：**fixture 是针对特定输入的**。
// 用户换了需求文本，那个包就对不上了 —— 而 demo 会「假装」响应了新输入。
// 这个兜底对**任何** spec 都成立，所以不存在「对不上」这回事。
//
// ⚠️ 它产出的资源 `origin` 仍是 `generated`（确实是本管线造的），
// **降级事实记在 manifest 的 `provenance.degradations[]` 里** —— 那才是它该待的地方。
import type { AssetSpec, DrawList, StyleSpec } from "@game-maker/contracts";
import { framePlan } from "./prompt.js";

/** 确定性地按 spec 画色块。**同一份 spec 永远得到同样的产物**（要能进 checksum）。 */
export function proceduralDrawLists(spec: AssetSpec, style: StyleSpec): DrawList[] {
  const plan = framePlan(spec);
  const n = Math.max(1, style.palette.length);
  const [w, h] = [spec.size.w, spec.size.h];
  return plan.map((p, i) => ({
    format: "drawlist+curve/v1" as const,
    id: spec.id,
    frame: `${p.anim ?? spec.id}${p.total > 1 ? p.index + 1 : ""}`,
    viewBox: [0, 0, w, h] as [number, number, number, number],
    expectedSize: [w, h] as [number, number],
    ops: [
      // 主体：一个随帧号轮换色板索引的方块 —— 帧与帧之间看得出在动，但仅此而已
      { op: "rect" as const, x: 0, y: 0, w, h, fill: `palette:${(i * 2) % n}` },
      // 内框：让它至少有「一个有边框的东西」的读感，而不是一块纯色
      { op: "rect" as const, x: 1, y: 1, w: Math.max(1, w - 2), h: Math.max(1, Math.round(h / 5)), fill: `palette:${(i * 2 + 1) % n}` },
      { op: "rect" as const, x: 1, y: Math.max(2, h - 3), w: Math.max(1, w - 2), h: 2, fill: `palette:${(i * 2 + 2) % n}` },
      // 一点材质感：抖动，且**只用色板色**（票 36）
      { op: "dither" as const, x: 0, y: Math.round(h / 3), w, h: Math.max(1, Math.round(h / 6)),
        colors: [`palette:${(i * 2 + 1) % n}`, `palette:${(i * 2 + 3) % n}`] as [string, string], ratio: 0.4, pattern: "bayer2" as const },
    ],
  }));
}

/** 把它包成一个 `DrawListGenerator`（票 38 那个端口的形状）。 */
export const proceduralGenerator = (spec: AssetSpec, style: StyleSpec): DrawList[] => proceduralDrawLists(spec, style);
