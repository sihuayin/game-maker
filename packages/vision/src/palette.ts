// 票 04：**确定性色板提取**（参考图像素 → 24/32 色）＋ 把 VWS 的 `palette:N` 改写过去。
//
// ⚠️ 为什么必须有这一层：B/C 四次 `analyze-reference` 给出的色板长度是 15 / 31 / 17 / 16，
//   而提示词要求 ≥32 从未稳定遵守。色板是**下游一切的调色盘**（生成提示词、DNA、drawlist），
//   让它随模型手气摆，等于每个交付物的颜色都不可复现。
//
// ⚠️ **它不读文件**（`vision` 只许依赖 `contracts`，PNG 解码器住在 `assets`）：
//   调用方把**已解码的像素**递进来（pipeline 用 `decodePNG`）。⇒ 纯函数，测试可只喂像素数组。
//
// ⚠️ **保留位置给暖色/肤色与高饱和色**（`WARM_RATIO` / `VIVID_RATIO`）：纯中位切分会被
//   参考图的大面积背景吃掉，24/32 个格子可能一个皮肤色都没有。留下这两档是**验收要求**
//   （「明暗 / 肤色不丢」），不是口味；具体比例写在常量上，改它要连着重量化预览。
import type { VisualWorldSpec } from "@game-maker/contracts";

/** 参考图的已解码像素（RGBA8）。与 `assets` 的 `RasterImage` 同形，但不跨包引用。 */
export type PaletteSource = { width: number; height: number; data: Uint8Array };

/** 生产用的目标色板长度（票 04 的 24–32 区间里取 32；24 是下限、48 接近无损）。 */
export const PALETTE_SIZE = 32;

/** 抠色时每通道保留的位数 —— 5 bit（步长 8）把近黑/近灰的抖动并成同一格，避免 20 个近黑色。 */
const CELL_BITS = 5;
const CELL_SHIFT = 8 - CELL_BITS;

/** 暖色/肤色预留：20% 的槽位。 */
const WARM_RATIO = 0.2;
/** 高饱和色预留：10% 的槽位（灯、眼睛、血、可交互物）。 */
const VIVID_RATIO = 0.1;

type Entry = { c: number; w: number };

const pack = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;
const channels = (c: number): [number, number, number] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const hex = (c: number): string => `#${c.toString(16).padStart(6, "0")}`;
const lum = (c: number): number => {
  const [r, g, b] = channels(c);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const dist2 = (a: number, b: number): number => {
  const [ar, ag, ab] = channels(a), [br, bg, bb] = channels(b);
  return (ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2;
};

/** 暖色/肤色：红明显高于绿、蓝不高于红（排除品红/紫）。 */
const isWarm = (c: number): boolean => {
  const [r, g, b] = channels(c);
  return r > g + 15 && r > 70 && b <= r && r - b > 20;
};
/** 高饱和：通道极差与最大值都够大（灯、眼睛、血、可交互物）。 */
const isVivid = (c: number): boolean => {
  const [r, g, b] = channels(c);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx - mn > 60 && mx > 90;
};

/** 粗直方图：每格取**出现最多的真实颜色**，权重是整格像素数。 */
function coarseEntries(src: PaletteSource): Entry[] {
  const counts = new Map<number, number>();
  const n = src.width * src.height;
  for (let i = 0; i < n; i++) {
    const s = i * 4;
    if (src.data[s + 3]! < 128) continue;
    const c = pack(src.data[s]!, src.data[s + 1]!, src.data[s + 2]!);
    counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  // ⚠️ 按 packed 排序后再分组：Map 的插入顺序跟着扫描顺序，排序让它**与遍历顺序无关**。
  const cells = new Map<number, { best: number; bestCount: number; w: number }>();
  for (const c of [...counts.keys()].sort((a, b) => a - b)) {
    const count = counts.get(c)!;
    const [r, g, b] = channels(c);
    const key = ((r >> CELL_SHIFT) << (CELL_BITS * 2)) | ((g >> CELL_SHIFT) << CELL_BITS) | (b >> CELL_SHIFT);
    const cell = cells.get(key);
    if (cell === undefined) cells.set(key, { best: c, bestCount: count, w: count });
    else {
      cell.w += count;
      if (count > cell.bestCount || (count === cell.bestCount && c < cell.best)) {
        cell.best = c; cell.bestCount = count;
      }
    }
  }
  return [...cells.values()].map((x) => ({ c: x.best, w: x.w })).sort((a, b) => a.c - b.c);
}

const weightOf = (box: readonly Entry[]): number => box.reduce((s, e) => s + e.w, 0);
const rangeOf = (box: readonly Entry[], ch: number): number => {
  let lo = 255, hi = 0;
  for (const e of box) {
    const v = channels(e.c)[ch]!;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return hi - lo;
};

/** 盒子代表色：离加权平均最近的**真实色**（不是平均出来的假色）。 */
function representative(box: readonly Entry[]): number {
  const total = weightOf(box);
  let sr = 0, sg = 0, sb = 0;
  for (const e of box) {
    const [r, g, b] = channels(e.c);
    sr += r * e.w; sg += g * e.w; sb += b * e.w;
  }
  const ar = sr / total, ag = sg / total, ab = sb / total;
  let best = box[0]!.c, bestD = Infinity;
  for (const e of box) {
    const [r, g, b] = channels(e.c);
    const d = (r - ar) ** 2 + (g - ag) ** 2 + (b - ab) ** 2;
    if (d < bestD || (d === bestD && e.c < best)) { bestD = d; best = e.c; }
  }
  return best;
}

/** 中位切分（固定参数：选 `range × log1p(weight)` 最大的盒、按最宽通道的加权中位切）。 */
function medianCut(entries: readonly Entry[], target: number): number[] {
  if (target <= 0 || entries.length === 0) return [];
  const boxes: Entry[][] = [[...entries]];
  while (boxes.length < target) {
    let bestIdx = -1, bestScore = -1, bestFirst = Infinity;
    for (let i = 0; i < boxes.length; i++) {
      const box = boxes[i]!;
      if (box.length < 2) continue;
      const range = Math.max(rangeOf(box, 0), rangeOf(box, 1), rangeOf(box, 2));
      const score = range * Math.log1p(weightOf(box));
      const first = box[0]!.c;
      if (score > bestScore || (score === bestScore && first < bestFirst)) {
        bestIdx = i; bestScore = score; bestFirst = first;
      }
    }
    if (bestIdx < 0) break;
    const box = boxes.splice(bestIdx, 1)[0]!;
    const ranges = [rangeOf(box, 0), rangeOf(box, 1), rangeOf(box, 2)];
    let ch = 0;
    if (ranges[1]! > ranges[ch]!) ch = 1;
    if (ranges[2]! > ranges[ch]!) ch = 2;
    box.sort((a, b) => channels(a.c)[ch]! - channels(b.c)[ch]! || a.c - b.c);
    const total = weightOf(box);
    let acc = 0, split = 1;
    for (let j = 0; j < box.length - 1; j++) {
      acc += box[j]!.w;
      if (acc * 2 >= total) { split = j + 1; break; }
    }
    if (split <= 0 || split >= box.length) split = 1;
    boxes.splice(bestIdx, 0, box.slice(0, split));
    boxes.splice(bestIdx + 1, 0, box.slice(split));
  }
  return boxes.map(representative);
}

/**
 * 从**已解码的参考图**提取确定性色板。
 *
 * 阶数：
 *  ① 粗直方图（5 bit/通道）→ 每格一个真实代表色；
 *  ② 预留暖色（20%）与高饱和（10%）槽位 —— 防大面积背景把肤色/灯吃掉；
 *  ③ 其余槽位对中性色做中位切分；
 *  ④ 不够 `size` 时按**最远点**补（确定性：距离同分比权重，再比 packed）；
 *  ⑤ 按亮度升序、再按 packed 排序返回。
 *
 * ⚠️ 返回的每个色都是参考图里**真实出现过**的颜色（粗直方图的代表色），不是平均值。
 * ⚠️ 图像不足 `size` 个粗格时返回实际数量（不编色）；全透明图返回 `[]`。
 */
export function extractPalette(src: PaletteSource, { size = PALETTE_SIZE }: { size?: number } = {}): string[] {
  if (!Number.isInteger(size) || size <= 0) throw new Error(`extractPalette: size 必须是正整数，收到 ${size}`);
  const entries = coarseEntries(src);
  if (entries.length === 0) return [];
  const want = Math.min(size, entries.length);

  const selected = new Set<number>();
  const warm = entries.filter((e) => isWarm(e.c));
  const warmTarget = Math.min(want, Math.round(want * WARM_RATIO));
  for (const c of medianCut(warm, warmTarget)) selected.add(c);
  const vivid = entries.filter((e) => isVivid(e.c) && !selected.has(e.c));
  const vividTarget = Math.min(want - selected.size, Math.round(want * VIVID_RATIO));
  for (const c of medianCut(vivid, vividTarget)) selected.add(c);
  const neutral = entries.filter((e) => !isWarm(e.c) && !isVivid(e.c) && !selected.has(e.c));
  for (const c of medianCut(neutral, want - selected.size)) selected.add(c);

  // 不够就按最远点补（先补离已选最远的；同分取权重高的、再取 packed 小的）。
  while (selected.size < want) {
    let best: Entry | undefined, bestD = -1;
    for (const e of entries) {
      if (selected.has(e.c)) continue;
      let d = Infinity;
      for (const s of selected) d = Math.min(d, dist2(e.c, s));
      if (d > bestD || (d === bestD && (best === undefined || e.w > best.w || (e.w === best.w && e.c < best.c)))) {
        bestD = d; best = e;
      }
    }
    if (best === undefined) break;
    selected.add(best.c);
  }

  return [...selected].sort((a, b) => lum(a) - lum(b) || a - b).map(hex);
}

/**
 * 把 VWS 的六个桶 / `materials.*.color` 里的 `palette:N` 改写到新色板：
 * **每个旧色映射到新色板里离它最近的那个**（同距取下标小的）。
 *
 * ⚠️ 这是「替换而非合并」：合并会保留模型那半份、于是同一张参考图两次仍可能不同；
 *   而票 04 的验收要求色板**逐字节可复现**。旧色板只当**语义提示**用。
 */
export function applyDeterministicPalette(spec: VisualWorldSpec, palette: readonly string[]): VisualWorldSpec {
  if (palette.length === 0) return spec;
  const rgb = palette.map((p) => {
    const v = parseInt(p.slice(1), 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255] as const;
  });
  const nearest = (oldHex: string): number => {
    const v = parseInt(oldHex.slice(1), 16);
    const [r, g, b] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
    let best = 0, bestD = Infinity;
    rgb.forEach((c, i) => {
      const d = (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  };
  const remap = (ref: string): string => {
    const i = Number(ref.slice("palette:".length));
    const old = spec.style.palette[i];
    return old === undefined ? ref : `palette:${nearest(old)}`;
  };

  const buckets: Record<string, string[]> = {};
  for (const [k, refs] of Object.entries(spec.palette)) buckets[k] = (refs ?? []).map(remap);
  const materials: Record<string, { appearance?: string; color?: string[] }> = {};
  for (const [k, m] of Object.entries(spec.materials)) {
    materials[k] = { ...m, ...(m.color === undefined ? {} : { color: m.color.map(remap) }) };
  }
  return {
    ...spec,
    palette: buckets as VisualWorldSpec["palette"],
    materials: materials as VisualWorldSpec["materials"],
    style: { ...spec.style, palette: [...palette] },
  };
}
