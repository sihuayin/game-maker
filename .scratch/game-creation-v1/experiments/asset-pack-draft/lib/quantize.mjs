// 最近邻色量化到 StyleSpec.palette。票 21 要求「光栅化产出」与「人工导入」共用同一份实现。
// 距离用 RGB 平方欧氏距离，忽略 alpha；同距时取索引小的（确定）。
export function quantizeToPalette({ width, height, data }, palette) {
  const pal = palette.map((hex) => { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; });
  const out = Buffer.alloc(data.length);
  let changed = 0, opaque = 0;
  for (let i = 0; i < width * height; i++) {
    const s = i * 4, a = data[s + 3];
    out[s] = data[s]; out[s + 1] = data[s + 1]; out[s + 2] = data[s + 2]; out[s + 3] = a;
    if (a === 0) continue;
    opaque++;
    let best = 0, bestD = Infinity;
    for (let k = 0; k < pal.length; k++) {
      const d = (data[s] - pal[k][0]) ** 2 + (data[s + 1] - pal[k][1]) ** 2 + (data[s + 2] - pal[k][2]) ** 2;
      if (d < bestD) { bestD = d; best = k; }
    }
    if (bestD !== 0) changed++;
    out[s] = pal[best][0]; out[s + 1] = pal[best][1]; out[s + 2] = pal[best][2];
  }
  return { width, height, data: out, opaquePixels: opaque, changedPixels: changed };
}

/** 扫像素判定「每一帧的每个非透明像素颜色 ∈ 色板」—— 让 paletteBinding:"exact" 成为**可验证**的声明。 */
export function paletteExactness({ width, height, data }, palette) {
  const set = new Set(palette.map((h) => h.toLowerCase()));
  const bad = new Map();
  for (let i = 0; i < width * height; i++) {
    const s = i * 4; if (data[s + 3] === 0) continue;
    const hex = '#' + [data[s], data[s + 1], data[s + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
    if (!set.has(hex)) bad.set(hex, (bad.get(hex) || 0) + 1);
  }
  return { exact: bad.size === 0, offPalette: [...bad].sort((a, b) => b[1] - a[1]).slice(0, 8) };
}
