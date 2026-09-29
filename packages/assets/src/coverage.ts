// 交付态**每一层背景画得有多满** —— 确定性、可扫（票 43 撞出来，票 50 定它是判据要用的量）。
//
// ⚠️ **为什么要有这个文件**：它要被**两处**用 —— `pack`（产像素的地方，写进 sidecar）
//   与 `inspect`（给人看）。**只有一份实现**（本仓库反复吃的那个亏：两份并存的必然漂移）。
//
// ⚠️ **为什么由 `pack` 算而不是装配期算**（票 50）：
//   `@game-maker/demo` 里**没有 PNG 解码器**（它的依赖只有 contracts 与 phaser，
//   而依赖图写死 demo 只能依赖 contracts）—— 装配器**没有手**去解图集。
//   而像素是在 `pack` 里诞生的：**算在产它的地方**。
import fs from "node:fs";
import path from "node:path";
import { type AssetPackManifest, type LayerCoverage } from "@game-maker/contracts";
import { decodePNG } from "./png.js";

/**
 * 扫交付态图集，算出**每一个背景帧**的不透明覆盖率。
 *
 * ⚠️ **只算背景** —— 覆盖率对别的东西没有意义（一件道具本来就该是「中间有东西、四周透明」），
 *   而对背景它是**层与层之间的关系**：`layers[0]` 后面什么都没有，所以它必须满。
 */
export function backgroundCoverage(packDir: string, m: AssetPackManifest): LayerCoverage[] {
  const out: LayerCoverage[] = [];
  const cache = new Map<string, ReturnType<typeof decodePNG>>();
  for (const a of m.assets) {
    if (a.kind !== "background") continue;
    const atlas = m.atlases.find((x) => x.id === a.atlasId);
    if (!atlas) continue;
    const aj = JSON.parse(fs.readFileSync(path.join(packDir, atlas.meta), "utf8")) as
      { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> };
    let img = cache.get(atlas.id);
    if (!img) { img = decodePNG(fs.readFileSync(path.join(packDir, atlas.image))); cache.set(atlas.id, img); }
    for (const f of a.frames) {
      const fr = aj.frames[f.name];
      if (!fr) continue;
      let opaque = 0;
      for (let y = 0; y < fr.frame.h; y++)
        for (let x = 0; x < fr.frame.w; x++)
          if (img.data[((fr.frame.y + y) * img.width + fr.frame.x + x) * 4 + 3]! > 0) opaque += 1;
      const total = fr.frame.w * fr.frame.h;
      out.push({ asset: a.id, frame: f.name, w: fr.frame.w, h: fr.frame.h, opaque, ratio: total === 0 ? 0 : opaque / total });
    }
  }
  return out;
}
