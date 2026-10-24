// 危险物的运动路径 —— **纯函数**（票 106）。零 Phaser、零 DOM（与 `draw.ts` 同一条纪律）。
//
// ⚠️ 这里返回的是**锚点的世界坐标**，不是盒子的中心。
//   `at` 的语义是「锚点落在哪」（票 48），而危险物的资源锚点是 `{0.5,1}`（底边中心）；
//   拿 `body.center` 反推精灵位置会把这「半个身位」**每帧再减一次** ——
//   敌人实测 7 秒后 `y = -21838`，直接飞出世界（票 106 的现场）。
//   ⇒ 这一层只回答「锚点该在哪」；Phaser 那一侧 `setPosition` 之后
//     `StaticBody.updateFromGameObject()` 自己把碰撞体挪过去。

/**
 * 三角波：`start → start + distance → start`，周期 `periodMs`。
 * `elapsedMs` 可以大于一个周期（取模后照样落在行程内）。
 */
export function hazardAnchor(start: number, distance: number, periodMs: number, elapsedMs: number): number {
  if (!(distance > 0) || !(periodMs > 0)) return start;
  const phase = (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs;
  const k = phase < 0.5 ? phase * 2 : 2 - phase * 2;
  return start + k * distance;
}

/**
 * `danger` 的定时打击状态（票 05 / 14）—— `idle`（安全窗口）↔ `active`（喷发窗口）循环。
 *
 * ⚠️ `periodMs` 是**安全窗口时长**，`activeMs` 是**喷发时长**；完整周期 = `periodMs + activeMs`，
 *   喷发落在周期的**最后** `activeMs`。t=0 从 `idle` 开始 —— 给玩家一个安全窗口，
 *   这是「规避 = 掐在 idle 窗口穿过」的判据来源。
 */
export function dangerState(periodMs: number, activeMs: number, elapsedMs: number): "idle" | "active" {
  if (!(periodMs > 0) || !(activeMs > 0)) return "idle";
  const cycle = periodMs + activeMs;
  const phase = (((elapsedMs % cycle) + cycle) % cycle);
  return phase < periodMs ? "idle" : "active";
}
