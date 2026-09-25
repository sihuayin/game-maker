// 图集组装：多张位图拼进一张 PNG + 元数据。
//
// 输出是 **TexturePacker JSON Hash**（票 25 查清的事实形状：Aseprite 字段名逐字相同、
// Phaser 原生读、零转换器）。只写 Phaser **真的会读**的字段：
//   frame / rotated / trimmed / spriteSourceSize / sourceSize / **anchor** / **scale9Borders**
// 其余一切（含 meta）Phoenix 只会原样塞进 texture.customData，不产生行为。
import { emptyImage, type RasterImage } from "./image.js";

const nextPow2 = (n: number): number => { let p = 1; while (p < n) p *= 2; return p; };

export type AtlasFrameInput = {
  /** 图集里的帧名。**也是产物 B 引用它的名字**，与 manifest 的 `frames[].name` 必须一致。 */
  name: string;
  image: RasterImage;
  /** 归一化锚点。Phaser 会把它当 origin 用，且在动画播放时**逐帧重设**。 */
  anchor?: { x: number; y: number };
  /** 九宫格中央区域。Phaser 的 `add.nineslice()` 零参数自动读它（仅 WebGL）。 */
  scale9Borders?: { x: number; y: number; w: number; h: number };
};

export type AtlasFrameJson = {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  anchor?: { x: number; y: number };
  scale9Borders?: { x: number; y: number; w: number; h: number };
};

export type AtlasJson = {
  frames: Record<string, AtlasFrameJson>;
  meta: { app: string; version: string; image: string; format: "RGBA8888"; size: { w: number; h: number }; scale: number };
};

/** 货架式打包。输入顺序先由调用方定死（这里按 高降序、名字升序），所以结果确定。 */
function shelfPack(frames: (AtlasFrameInput & { w: number; h: number })[], width: number) {
  const placed: (AtlasFrameInput & { w: number; h: number; x: number; y: number })[] = [];
  let x = 0, y = 0, shelfHeight = 0;
  for (const f of frames) {
    if (x + f.w > width) { x = 0; y += shelfHeight; shelfHeight = 0; }
    placed.push({ ...f, x, y });
    x += f.w;
    shelfHeight = Math.max(shelfHeight, f.h);
  }
  return { placed, height: y + shelfHeight };
}

/**
 * 打包成一张图集。**确定**：同样的输入永远得到同样的矩形分配与同样的 PNG 字节。
 *
 * 候选宽度从「最大帧宽」起逐次翻倍，选**装得下且面积最小**的那个 —— 规则写死，
 * 不用启发式，否则同一批资源在不同机器上可能打包出不同的图集，checksum 就废了。
 */
export function buildAtlas(frames: readonly AtlasFrameInput[]): { json: AtlasJson; image: RasterImage } {
  if (frames.length === 0) throw new Error("buildAtlas: 至少要有一帧");
  const sized = frames.map((f) => ({ ...f, w: f.image.width, h: f.image.height }));
  const sorted = [...sized].sort((a, b) => b.h - a.h || a.name.localeCompare(b.name));
  const maxW = Math.max(...sorted.map((f) => f.w));

  const candidates = [maxW];
  for (let w = nextPow2(maxW); w <= 4096; w *= 2) if (w !== maxW) candidates.push(w);
  let best: { w: number; placed: ReturnType<typeof shelfPack>["placed"]; height: number; area: number } | null = null;
  for (const w of candidates) {
    const { placed, height } = shelfPack(sorted, w);
    if (height > 4096) continue;
    const area = w * height;
    if (!best || area < best.area) best = { w, placed, height, area };
  }
  if (!best) throw new Error("buildAtlas: 没有能装下的打包方案（图集超过 4096×4096）");

  const image = emptyImage(best.w, best.height);
  const jsonFrames: Record<string, AtlasFrameJson> = {};
  for (const f of best.placed) {
    for (let r = 0; r < f.h; r++)
      f.image.data.copy(image.data, ((f.y + r) * best.w + f.x) * 4, r * f.w * 4, (r + 1) * f.w * 4);
    const frame: AtlasFrameJson = {
      frame: { x: f.x, y: f.y, w: f.w, h: f.h },
      rotated: false,
      trimmed: false,     // 不做 trim：帧 = 完整 viewBox，于是锚点的分母 sourceSize 就是它
      spriteSourceSize: { x: 0, y: 0, w: f.w, h: f.h },
      sourceSize: { w: f.w, h: f.h },
    };
    if (f.anchor) frame.anchor = f.anchor;
    if (f.scale9Borders) frame.scale9Borders = f.scale9Borders;
    jsonFrames[f.name] = frame;
  }
  return {
    json: { frames: jsonFrames, meta: { app: "game-maker", version: "1", image: "", format: "RGBA8888", size: { w: best.w, h: best.height }, scale: 1 } },
    image,
  };
}
