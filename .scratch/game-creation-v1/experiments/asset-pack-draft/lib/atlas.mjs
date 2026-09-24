// 货架式打包 + TexturePacker JSON Hash 写出（票 25 查清的事实形状）。
// 只写 Phaser 真读的字段：frame/rotated/trimmed/spriteSourceSize/sourceSize/anchor/scale9Borders。

const nextPow2 = (n) => { let p = 1; while (p < n) p *= 2; return p; };

/** 货架打包。输入帧顺序须先由调用方定死（这里按 高降序、名字升序），保证确定。 */
function shelfPack(frames, width) {
  const placed = [];
  let x = 0, y = 0, shelfH = 0;
  for (const f of frames) {
    if (x + f.width > width) { x = 0; y += shelfH; shelfH = 0; }
    placed.push({ ...f, x, y });
    x += f.width; shelfH = Math.max(shelfH, f.height);
  }
  return { placed, height: y + shelfH };
}

/**
 * @param {{name:string,width:number,height:number,data:Buffer,anchor?:{x:number,y:number},scale9Borders?:object}[]} frames
 * @returns {{json:object, image:{width:number,height:number,data:Buffer}}}
 */
export function buildAtlas(frames) {
  const sorted = [...frames].sort((a, b) => b.height - a.height || a.name.localeCompare(b.name));
  const maxW = Math.max(...sorted.map((f) => f.width));
  const area = sorted.reduce((s, f) => s + f.width * f.height, 0);
  // 候选宽度：最大帧宽起，逐次翻倍。选「装得下且面积最小」的那个 —— 规则写死，因此确定。
  const cands = [maxW];
  for (let w = nextPow2(maxW); w <= 4096; w *= 2) if (w !== maxW) cands.push(w);
  let best = null;
  for (const w of cands) {
    const { placed, height } = shelfPack(sorted, w);
    const areaW = w * height;
    if (height > 4096) continue;
    if (!best || areaW < best.areaW) best = { w, placed, height, areaW };
  }
  if (!best) throw new Error('atlas: no packing candidate fits');

  const image = { width: best.w, height: best.height, data: Buffer.alloc(best.w * best.height * 4) };
  const jsonFrames = {};
  for (const f of best.placed) {
    for (let r = 0; r < f.height; r++) f.data.copy(image.data, ((f.y + r) * best.w + f.x) * 4, r * f.width * 4, (r + 1) * f.width * 4);
    const fr = { frame: { x: f.x, y: f.y, w: f.width, h: f.height }, rotated: false, trimmed: false,
      spriteSourceSize: { x: 0, y: 0, w: f.width, h: f.height }, sourceSize: { w: f.width, h: f.height } };
    if (f.anchor) fr.anchor = f.anchor;                 // Phaser 读它 → Frame.customPivot
    if (f.scale9Borders) fr.scale9Borders = f.scale9Borders; // Phaser 读它 → add.nineslice() 零参数
    jsonFrames[f.name] = fr;
  }
  return { json: { frames: jsonFrames, meta: { app: 'game-maker/assetpack-draft', version: '1', image: '', format: 'RGBA8888', size: { w: best.w, h: best.height }, scale: 1 } }, image };
}
