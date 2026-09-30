// `assetpack-coverage/v1` —— 交付态**每一层背景画得有多满**（票 43 撞出来，票 50 定它是判据）。
//
// ⚠️ **它不是契约的一部分，是「可派生的观察」**（票 24 原则 2：不重复**可派生**的内容）——
//   这个量可以从图集像素算出来。所以它是包根的 sidecar `coverage.json`，**不进 manifest**
//   （进 manifest 要 `assetpack/v2 → v3`，而票 19 刚为躲这一刀把账本做成了 sidecar）。
//
// ⚠️ **形状住在这里、算法住在 `@game-maker/assets`** —— 与账本同一个分工：
//   装配器（`@game-maker/demo`）**只能依赖 contracts**，所以它要能读到这个形状；
//   而它**没有 PNG 解码器**，所以算不出来（去 `pack` 那一步算）。
import { z } from "zod";

export const COVERAGE_FORMAT = "assetpack-coverage/v1" as const;

/** 一层背景：它的整帧有多少像素是真的画了东西的。 */
export const LayerCoverage = z.object({
  asset: z.string().min(1),
  frame: z.string().min(1),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  opaque: z.number().int().nonnegative(),
  /** `opaque / (w·h)`，0..1。⚠️ **1 才是画满**。 */
  ratio: z.number().min(0).max(1),
}).strict();

export const Coverage = z.object({
  format: z.literal(COVERAGE_FORMAT),
  packId: z.string().min(1),
  packVersion: z.number().int().positive(),
  layers: z.array(LayerCoverage),
}).strict();

export type Coverage = z.infer<typeof Coverage>;
export type LayerCoverage = z.infer<typeof LayerCoverage>;

export function parseCoverage(input: unknown): { ok: true; value: Coverage } | { ok: false; errors: string[] } {
  const r = Coverage.safeParse(input);
  if (r.success) return { ok: true, value: r.data };
  return { ok: false, errors: r.error.issues.map((i) => `${i.path.join(".") || "<根>"}: ${i.message}`) };
}

/**
 * 一层的「满」到什么程度才算满。
 * ⚠️ 留一点容差是因为**量化/二值化**可能在边缘留下极少数全透明像素；
 *   而 0.42 与 1.0 之间的差距不是容差能糊过去的。
 *
 * ⚠️ **这个数是两个方向的界**（2026-09-30 起）：最远那层**必须够到它**（后面没有东西了），
 *   其余层**不许够到它**（后面还有东西 —— 够到就等于把后面那几层全挡住）。
 *   一个数、一个含义（「画满了」），两端共用。
 */
export const FILLED = 0.999;
