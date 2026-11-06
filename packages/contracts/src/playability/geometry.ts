// 可玩性几何的**唯一** AABB 词汇（LP-01）。
//
// ⚠️ 与 `game-config.ts` 的 zod `Rect` 不是同一层：那个是**配置形状**，这里是**纯几何**。
//   LP-02～LP-04 的判据必须共用这一套 overlap / 包含语义，不允许各写一套互相矛盾的规则。
//
// ⚠️ 「贴着不算撞」与 Runtime 的 AABB 语义一致（`strict`）。需要把边界也算作接触时
//   显式调用 `overlapsInclusive` / `touches`，不要用 `strict` 再加 epsilon 猜。

export type Aabb = { x: number; y: number; w: number; h: number };
export type Vec = { x: number; y: number };
export type Size = { w: number; h: number };

/** 严格相交：**贴着不算**（有正面积重叠才为 true）。 */
export const overlapsStrict = (a: Aabb, b: Aabb): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** 闭区间相交：贴边也算相交（用于边界接触与「完全埋进」的闭包判断）。 */
export const overlapsInclusive = (a: Aabb, b: Aabb): boolean =>
  a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;

/** `inner` 完全落在 `outer` 内（闭区间，贴边算）。 */
export const contains = (outer: Aabb, inner: Aabb): boolean =>
  inner.x >= outer.x && inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;

/** 有边界接触但没有面积重叠。 */
export const touches = (a: Aabb, b: Aabb): boolean => overlapsInclusive(a, b) && !overlapsStrict(a, b);

/** 四边各外扩 `d`（chest 的 `range` 就是它；不是单轴外扩）。 */
export const expandBox = (a: Aabb, d: number): Aabb => ({ x: a.x - d, y: a.y - d, w: a.w + 2 * d, h: a.h + 2 * d });

/** 由**脚点**（盒子底边中点）反推玩家盒子。脚点是 `footOf` 的产物，不是 `at` 锚点。 */
export const boxFromFoot = (foot: Vec, size: Size): Aabb => ({
  x: foot.x - size.w / 2, y: foot.y - size.h, w: size.w, h: size.h,
});

export const centerOf = (a: Aabb): Vec => ({ x: a.x + a.w / 2, y: a.y + a.h / 2 });
