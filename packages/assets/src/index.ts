// 资源管线：**交付态的唯一生产者**（票 21）。
//
// 它把创作态（drawlist）编译成交付态（PNG + 图集元数据）。
// 产物 B 直接加载这里产出的 PNG —— Phaser 根本不认识 drawlist。
//
// ⚠️ 尚未落地的部分，各自的票：
//   · 资源包的组装（写 manifest.json / authoring/ / checksums）→ 需要票 28 的 Recipe 形状
//   · 人工导入通道（sheet 切片、来源标注）→ 票 23
export * from "./image.js";
export * from "./png.js";
export * from "./raster.js";
export * from "./quantize.js";
export * from "./atlas.js";
export * from "./import.js";
export * from "./pack.js";
export * from "./prompt.js";
export * from "./generate.js";
export * from "./review.js";
