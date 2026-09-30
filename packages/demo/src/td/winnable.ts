// **「这一关通不通」** —— 让参考玩家跑一遍，报出结果与两条诊断（票 02 · 10 · 11）。
//
// ⚠️ **它住 demo 而不是 contracts**（票 11）：跑参考玩家需要**模拟器**，而模拟器住这里。
//   而「在哪一步判」的答案是 **`site`** —— 依据是 `compileGame` 自己那句注释：
//   「这里跑的是 `site` 要跑的同一批校验（**减去第四族**）」。
//   ⇒ **「compile 跑它能跑的、`site` 跑其余的」这条分工已经存在**（几何族同样够不着 demo）。
//
// ⚠️ **它是纯层**（零 Phaser / 零 DOM）—— 所以「这一关通不通」可以在 vitest 里断言，
//   而不必开浏览器。

import { createSim, advance, autoPlay, FIXED_DT_MS, type TdState } from "./sim.js";
import type { TdWorldDescription } from "./world.js";
import { pathPointAt } from "./world.js";
import type { ConfigIssue } from "@game-maker/contracts";

/** 参考玩家跑完之后的那几个数。 */
export type ReferenceRun = {
  phase: TdState["phase"];
  /** **已完成的波数** —— 所以「在第 1 波就被抢空」是 `lost` 且 `wave === 0`。 */
  wave: number;
  lives: number;
  leaked: number;
  /**
   * 整局杀掉了几个敌人。
   * ⚠️ **它一度被当成「没有消费者的投机泛化」砍掉过** —— 而砍掉之后才发现，
   *   「一个敌人都没杀掉」正是「刻度写反」最干净的那条判据（票 13 在量的那个）。
   *   ⇒ **「没有消费者」是一个时刻的判断，不是一条性质**：字段与判据是成对出现的，
   *     而判据还没定下来的时候，字段看起来就是多余的。
   */
  killed: number;
  /** 跑完用掉的游戏时间（毫秒）—— 「跑到上限还没结束」那条要说它。 */
  ms: number;
};

/**
 * **让参考玩家把这一关跑一遍。**
 * ⚠️ 确定性 —— 同一个人、同一步长、无随机数（`autoPlay` 的注释里写着这条）。
 */
export function playReference(world: TdWorldDescription, opts: { maxMs?: number } = {}): ReferenceRun {
  const maxMs = opts.maxMs ?? 900_000;
  let s = createSim(world);
  for (let i = 0; i < maxMs / FIXED_DT_MS && s.phase !== "won" && s.phase !== "lost"; i++) {
    s = advance(s, FIXED_DT_MS, autoPlay(s, world), world);
  }
  return { phase: s.phase, wave: s.wave, lives: s.lives, leaked: s.leaked, killed: s.killed, ms: s.ms };
}

/**
 * 走道上「至少被一个插槽够得着」的弧长占比 —— ⚠️ **它带着尺子**（见下）。
 *
 * ⚠️ 采样走**整数步数**，不是「`d += total/steps`」——
 *   后者在 `total === 0`（两点重合的退化路径）时**加了个 0，于是死循环**。
 *   而 `path.total` 是数据，退化值是能进来的。
 */
function pathCoverage(world: TdWorldDescription, range: number): number {
  const steps = Math.max(1, Math.round(world.path.total));
  let n = 0;
  for (let i = 0; i <= steps; i++) {
    const p = pathPointAt(world.path, (world.path.total * i) / steps);
    if (world.slots.some((s) => Math.hypot(p.x - s.at.x, p.y - s.at.y) <= range)) n++;
  }
  return n / (steps + 1);
}

/** 每一波的敌人总血（**在纯层就算得出来**：`world.waves` 与 `world.enemies` 都在这儿）。 */
function perWaveHp(world: TdWorldDescription): number[] {
  const hp = new Map(world.enemies.map((e) => [e.id, e.hp]));
  return world.waves.map((w) => w.spawns.reduce((n, s) => n + (hp.get(s.enemy) ?? 0), 0));
}

/**
 * **这一关通不通** —— 一条**判据** ＋ 两条**诊断**（票 10 拆的）。
 *
 * ⚠️ **判据只有一条**：**退化的输** —— `lost` 且**一波都没打完**。
 *   那种「数值刻度整个写反了」是**精确可算**的，而它**不可能是有意设计**。
 *
 * ⚠️ **其余的一律是诊断**，依据是一组实测（票 10）：**覆盖这个量「排序稳、绝对值不稳」** ——
 *   同一个关卡用不同的射程当尺子会给出 **0%–54%** 的不同答案。要当判据就得有一个**绝对阈值**，
 *   而它给不了。⚠️ 这与票 02 否掉「按覆盖挑插槽」撞的是**同一块石头**（说不清用哪一级射程）。
 *   ⇒ 诊断**必须带上它用的那把尺子**，否则读的人会以为那个数是无尺子的。
 *
 * ⚠️ **只在参考玩家输了、或赢得不干净时才报** —— 不然每一关都刷一屏没人读。
 */
export function auditWinnable(run: ReferenceRun, world: TdWorldDescription): ConfigIssue[] {
  const out: ConfigIssue[] = [];
  const where = "objective";
  // ── 判据：退化的输 ────────────────────────────────────────────────────
  if (run.phase === "lost" && run.wave === 0)
    out.push({ severity: "error", where: "waves",
      message: `**参考玩家在第一波就被抢空了**（声望 0，漏 ${run.leaked}）—— ` +
        `这一关的数值刻度写反了，而那不可能是有意设计。` +
        `⚠️ 拿不准的时候**宁可把敌人写弱、把塔写便宜**：往那个方向的余量是 10 倍量级，往反方向只有 1.5 倍` });
  // ── 其余一律是**诊断**（票 10：覆盖那个量排序稳、绝对值不稳，够不上判据）────────
  else if (run.phase === "lost")
    out.push({ severity: "warning", where: "waves",
      message: `参考玩家**没能打完**（在第 ${run.wave + 1} 波被抢空，声望 ${run.lives}，漏 ${run.leaked}）。` +
        `⚠️ 这不一定是错 —— 「人打得赢、它打不赢」的关卡**可能是好关卡**。下面是两条诊断，帮你判：\n` +
        diagnostics(run, world) });
  else if (run.phase !== "won")
    // ⚠️ `phase` 还可能是 `build` / `wave` —— 那是**跑到上限还没结束**，**不是**「被抢空」。
    //   把这两种混成一句话就是**在编事实**（那种情形下声望可能一位没掉）。
    out.push({ severity: "warning", where: "waves",
      message: `参考玩家**跑完了上限（${Math.round(run.ms / 1000)} 秒）还没分出胜负**` +
        `（走到第 ${run.wave + 1} 波、声望 ${run.lives}）—— 这一关多半是「磨」的。诊断：\n` +
        diagnostics(run, world) });
  else if (run.lives * 2 <= world.economy.lives)
    // ⚠️ 阈值是「**掉了超过一半的声望**」，不是「漏了哪怕一点」——
    //   后者会让真关卡自己（20 里漏 1）每次都刷一条警告，而那正是「没人读的观察」。
    out.push({ severity: "warning", where: "waves",
      message: `参考玩家打完了，但**声望只剩 ${run.lives}/${world.economy.lives}** —— 赢得不干净。诊断：\n` +
        diagnostics(run, world) });
  return out;
}

/** 两条诊断 —— ⚠️ **每一条都带着它的尺子**。 */
function diagnostics(run: ReferenceRun, world: TdWorldDescription): string {
  // 尺子 = **最便宜那座塔的 L1 射程**。
  // ⚠️ **这是一个选择，不是定理** —— 票 10 的表里用的是「每一种塔各自的 L1」。
  //   取「最便宜那座」的理由：它是**最可能被先建出来的**那一座（开局废料买得起它），
  //   所以「走道有多少被够得着」按它算最贴近开局那几秒的真实处境。
  //   ⚠️ 换一把尺子这个数会变 —— 这就是它只能当诊断、且**必须把尺子报出来**的原因。
  const cheapest = [...world.towers].sort((a, b) => a.cost - b.cost)[0];
  const ruler = cheapest ? `${cheapest.name} L1 射程 ${cheapest.levels[0]!.range}` : "（没有机关）";
  const cov = cheapest ? Math.round(100 * pathCoverage(world, cheapest.levels[0]!.range)) : 0;
  const hp = perWaveHp(world);
  const peak = Math.max(0, ...hp);
  const jumps = hp.map((v, i) => (i === 0 ? 0 : v / hp[i - 1]!));
  return `  · **覆盖 ${cov}%**（尺子＝${ruler}）—— 走道上有多少弧长至少被一个插槽够得着。` +
    `⚠️ 换个射程当尺子这个数会变，所以它只是诊断。\n` +
    `  · **波次血量** ${hp.join(" / ")}（峰值 ${peak}，最大环比跳变 ${Math.max(0, ...jumps).toFixed(2)}×）—— ` +
    `最后一波跳得越狠越容易一次性漏光。`;
}
