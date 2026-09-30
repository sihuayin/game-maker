// **塔防的模拟** —— 纯函数，零 Phaser、零 DOM、无随机数。
//
// ⚠️ **它为什么存在**（这是本次加塔防时对「外壳薄到没什么可测的」那条判据的交代）：
//   塔防比横版多出来的东西 —— 出怪节奏、索敌、伤害、减速、经济、胜负 —— 全是**逻辑**，
//   而渲染层是这个仓库**唯一拒绝测试**的地方（`tsconfig.spec.json` 有意排除 `src/shell`）。
//   把它们写进 `Phaser.Scene.update()`，等于把整个玩法放到 vitest 够不着的地方，
//   于是唯一的证据只剩一张截图。
//   写在这里之后：**玩法可以零浏览器地测**，而截图退回到它该干的活（证明渲染没坏）。
//
// ⚠️ **约定**（契约文件头那三条规则的实现处）：
//   ① 伤害在**开火那一刻**结算，抛射物纯装饰；
//   ② 护甲平减、**下限 1**；
//   ③ 减速**取最强的一份并刷新时长**。
//
// ⚠️ **固定步长**。`advance()` 把任意大的 dt 切成 `FIXED_DT_MS` 的小步 ——
//   这不是洁癖：无头 Chrome 的 `--virtual-time-budget` 会给出**极大**的 delta，
//   按 delta 直接推进的话一整波会在一帧里漏光（横版免疫，因为它只做速度积分）。
//   切成固定步长之后，「虚拟时间」与「真实时间」跑出来的结果**逐字节相同**，
//   截图因此是**可复现**的。
import { pathPointAt, type TdWorldDescription } from "./world.js";
import type { Vec } from "../draw.js";

/** 模拟步长。⚠️ 只有一处定义 —— 改了它，真实时间与虚拟时间仍然一致。 */
export const FIXED_DT_MS = 16;
/** 一帧最多推进多少**真实**毫秒 —— 超过就丢掉（切后台回来时不要把整局一次算完）。 */
export const MAX_FRAME_MS = 250;
/** 开火特效播多久（毫秒）。⚠️ 放这里而不是外壳里 —— 帧的推进由模拟的时间轴决定。 */
export const BURST_MS = 260;

export type TdAction =
  | { kind: "build"; slotId: string; towerId: string }
  | { kind: "upgrade"; slotId: string }
  | { kind: "start-wave" };

export type SimEnemy = {
  id: number;
  enemyId: string;
  hp: number;
  /** 沿折线走了多远（像素）。**这就是它的位置** —— 没有 x/y，也就没有「走歪」这回事。 */
  dist: number;
  slowFactor: number;
  slowUntil: number;
  /** 受击闪白的到期时刻（表现用，但放在这里渲染层就是无状态的）。 */
  flashUntil: number;
};

export type SimTower = { slotId: string; towerId: string; level: 0 | 1; cooldownMs: number };
export type SimProjectile = { id: number; towerId: string; from: Vec; to: Vec; tMs: number; durMs: number };
export type SimBurst = { id: number; at: Vec; radius: number; startMs: number; untilMs: number };

export type TdPhase = "build" | "wave" | "won" | "lost";

export type TdState = {
  ms: number;
  scrap: number;
  lives: number;
  killed: number;
  leaked: number;
  built: number;
  upgraded: number;
  phase: TdPhase;
  /** 已开始的波数（0 = 还没开第一波）。 */
  wave: number;
  spawns: { enemy: string; atMs: number }[];
  spawnCursor: number;
  waveStartMs: number;
  enemies: SimEnemy[];
  towers: SimTower[];
  projectiles: SimProjectile[];
  bursts: SimBurst[];
  nextId: number;
  /** 最近发生的一件事 —— 探针断言与画面提示都读它。 */
  lastEvent: string;
};

export const createSim = (world: TdWorldDescription): TdState => ({
  ms: 0,
  scrap: world.economy.startScrap,
  lives: world.economy.lives,
  killed: 0, leaked: 0, built: 0, upgraded: 0,
  phase: "build", wave: 0,
  spawns: [], spawnCursor: 0, waveStartMs: 0,
  enemies: [], towers: [], projectiles: [], bursts: [],
  nextId: 1,
  lastEvent: "开局",
});

/** 把状态深拷到「可以安全改写」的程度。数组里的每个元素都是小对象，逐帧拷很便宜。 */
const fork = (s: TdState): TdState => ({
  ...s,
  spawns: s.spawns,
  enemies: s.enemies.map((e) => ({ ...e })),
  towers: s.towers.map((t) => ({ ...t })),
  projectiles: s.projectiles.map((p) => ({ ...p })),
  bursts: s.bursts.map((b) => ({ ...b })),
});

const dist2 = (a: Vec, b: Vec) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** 敌人此刻在哪 —— 渲染、索敌、命中判定三处共用这一条。 */
export const enemyPos = (world: TdWorldDescription, e: SimEnemy): Vec => pathPointAt(world.path, e.dist);

const towerPosOf = (world: TdWorldDescription, slotId: string): Vec =>
  world.slots.find((s) => s.id === slotId)?.at ?? { x: 0, y: 0 };

/** 一步。**不改传入的 state** —— 返回新的。 */
function stepOnce(prev: TdState, dtMs: number, actions: readonly TdAction[], world: TdWorldDescription): TdState {
  const s = fork(prev);
  s.ms += dtMs;

  // ── 动作（建造 / 升级 / 开波）────────────────────────────────────────────
  for (const a of actions) {
    if (a.kind === "build") {
      const spec = world.towers.find((t) => t.id === a.towerId);
      if (!spec || s.phase === "won" || s.phase === "lost") continue;
      if (s.towers.some((t) => t.slotId === a.slotId)) continue;      // 插槽已被占
      if (s.scrap < spec.cost) continue;                               // 钱不够
      s.towers.push({ slotId: a.slotId, towerId: a.towerId, level: 0, cooldownMs: 0 });
      s.scrap -= spec.cost;
      s.built += 1;
      s.lastEvent = `建造 ${spec.name}`;
    } else if (a.kind === "upgrade") {
      const t = s.towers.find((x) => x.slotId === a.slotId);
      if (!t || t.level === 1) continue;
      const spec = world.towers.find((x) => x.id === t.towerId);
      if (!spec || s.scrap < spec.upgradeCost) continue;
      t.level = 1;
      s.scrap -= spec.upgradeCost;
      s.upgraded += 1;
      s.lastEvent = `升级 ${spec.name}`;
    } else {
      if (s.phase !== "build" || s.wave >= world.waves.length) continue;
      s.phase = "wave";
      s.spawns = world.waves[s.wave]!.spawns;
      s.spawnCursor = 0;
      s.waveStartMs = s.ms;
      s.lastEvent = `第 ${s.wave + 1} 波`;
    }
  }

  // ── 出怪 ────────────────────────────────────────────────────────────────
  if (s.phase === "wave") {
    while (s.spawnCursor < s.spawns.length && s.waveStartMs + s.spawns[s.spawnCursor]!.atMs <= s.ms) {
      const sp = s.spawns[s.spawnCursor]!;
      const spec = world.enemies.find((e) => e.id === sp.enemy);
      s.spawnCursor += 1;
      if (!spec) continue;
      s.enemies.push({
        id: s.nextId++, enemyId: spec.id, hp: spec.hp, dist: 0,
        slowFactor: 1, slowUntil: 0, flashUntil: 0,
      });
    }
  }

  // ── 敌人推进 ────────────────────────────────────────────────────────────
  const arrived: SimEnemy[] = [];
  for (const e of s.enemies) {
    const spec = world.enemies.find((x) => x.id === e.enemyId);
    if (!spec) continue;
    const slowed = e.slowUntil > s.ms;
    e.dist += spec.speed * (slowed ? e.slowFactor : 1) * (dtMs / 1000);
    if (e.dist >= world.path.total) arrived.push(e);
  }
  if (arrived.length > 0) {
    for (const e of arrived) {
      const spec = world.enemies.find((x) => x.id === e.enemyId)!;
      s.lives -= spec.leakCost;
      s.leaked += 1;
      s.lastEvent = `${spec.name} 冲到了柜台（-${spec.leakCost} 声望）`;
    }
    s.enemies = s.enemies.filter((e) => !arrived.includes(e));
    if (s.lives <= 0) { s.lives = 0; s.phase = "lost"; s.lastEvent = "柜台被抢空了"; }
  }

  // ── 机关开火 ────────────────────────────────────────────────────────────
  if (s.phase !== "lost" && s.phase !== "won") {
    for (const t of s.towers) {
      t.cooldownMs -= dtMs;
      if (t.cooldownMs > 0) continue;
      const spec = world.towers.find((x) => x.id === t.towerId);
      const lv = spec?.levels[t.level];
      if (!spec || !lv) continue;
      const at = towerPosOf(world, t.slotId);
      const r2 = lv.range * lv.range;
      const inRange = s.enemies.filter((e) => dist2(enemyPos(world, e), at) <= r2);
      if (inRange.length === 0) continue;      // 够不着就不开火，冷却继续攒着

      t.cooldownMs = lv.fireMs;
      const hit: SimEnemy[] = [];
      if (spec.attack === "single") {
        // 索敌：走得最远的 / 血最多的。两个都只是一行比较。
        const target = inRange.reduce((best, e) =>
          spec.targeting === "first"
            ? (e.dist > best.dist ? e : best)
            : (e.hp > best.hp ? e : best));
        hit.push(target);
        if (spec.projectile) {
          const to = enemyPos(world, target);
          // 飞行时长 = 距离 / 速度。下限 60ms 免得贴脸时抛射物一帧就到、看不见。
          const durMs = Math.max(60, (Math.hypot(to.x - at.x, to.y - at.y) / spec.projectile.speed) * 1000);
          s.projectiles.push({
            id: s.nextId++, towerId: spec.id, from: { ...at },
            // ⚠️ 飞向**开火那一刻**的位置 —— 伤害已经结算过了，抛射物不为命中负责
            to, tMs: 0, durMs,
          });
        }
      } else {
        // aoe：不索敌，射程内全部吃一份，并在原地留一个扩散环
        hit.push(...inRange);
        s.bursts.push({ id: s.nextId++, at: { ...at }, radius: lv.range, startMs: s.ms, untilMs: s.ms + BURST_MS });
      }

      for (const e of hit) {
        e.hp -= Math.max(1, lv.damage - (world.enemies.find((x) => x.id === e.enemyId)?.armor ?? 0));
        e.flashUntil = s.ms + 90;
        if (lv.slow) {
          // 规则 ③：取最强的一份，时长刷新到更晚的那个
          const cur = e.slowUntil > s.ms ? e.slowFactor : 1;
          e.slowFactor = Math.min(cur, lv.slow.factor);
          e.slowUntil = Math.max(e.slowUntil > s.ms ? e.slowUntil : s.ms, s.ms + lv.slow.ms);
        }
      }
    }

    // 结算死亡 —— 放在开火之后，一次遍历搞定
    const dead = s.enemies.filter((e) => e.hp <= 0);
    if (dead.length > 0) {
      for (const e of dead) {
        const spec = world.enemies.find((x) => x.id === e.enemyId);
        s.scrap += spec?.bounty ?? 0;
        s.killed += 1;
      }
      s.enemies = s.enemies.filter((e) => e.hp > 0);
    }
  }

  // ── 抛射物与特效的寿命 ──────────────────────────────────────────────────
  for (const p of s.projectiles) p.tMs += dtMs;
  s.projectiles = s.projectiles.filter((p) => p.tMs < p.durMs);
  s.bursts = s.bursts.filter((b) => b.untilMs > s.ms);

  // ── 一波是否清场 ────────────────────────────────────────────────────────
  if (s.phase === "wave" && s.spawnCursor >= s.spawns.length && s.enemies.length === 0) {
    s.scrap += world.economy.waveBonus;
    s.wave += 1;
    s.spawns = [];
    if (s.wave >= world.waves.length) { s.phase = "won"; s.lastEvent = "五波打完，柜台守住了"; }
    else { s.phase = "build"; s.lastEvent = `第 ${s.wave} 波清场（+${world.economy.waveBonus} 废料）`; }
  }

  return s;
}

/**
 * 推进 `dtMs`（真实毫秒）—— **切成固定步长**，见文件头那条。
 * ⚠️ 传入的 state **不会被改**。
 */
export function advance(
  state: TdState, dtMs: number, actions: readonly TdAction[], world: TdWorldDescription,
): TdState {
  // ⚠️ **步数取整到固定步长的整数倍**（`Math.floor` 而不是 `while (left > 0)`）：
  //   后者会在 250ms 的预算里走出 16 步 = 256ms —— 比声明的上限还多，
  //   而那个「多一点点」在每帧都发生。取整之后「推进量 ≤ MAX_FRAME_MS」是**字面成立**的。
  // ⚠️ **至少一步**：`dtMs` 为 0 也照样走一步，否则「这一帧点了按钮」在没有时间流逝时
  //   会被整个丢掉 —— 而按钮与时间无关。
  const steps = Math.max(1, Math.floor(Math.min(MAX_FRAME_MS, Math.max(0, dtMs)) / FIXED_DT_MS));
  let s = state;
  for (let i = 0; i < steps; i++) {
    // 动作只在**第一步**生效 —— 否则一次点击会在这一帧里被执行几十遍
    s = stepOnce(s, FIXED_DT_MS, i === 0 ? actions : [], world);
  }
  return s;
}

// ── 参考玩家（`?auto=1` 用它，vitest 也用它）──────────────────────────────
//
// ⚠️ 它**不是作弊码**，是**一个玩家**：它产出的 `TdAction[]` 与鼠标点出来的一模一样，
//   走的也是同一个 `advance()`。于是「这份配置打得赢吗」变成一条**可以在 vitest 里断言的事**
//   （见 `tests/td-sim.test.ts`），而截图退回到证明渲染没坏。
/**
 * 参考玩家的建造顺序：**沿路径先后铺开** —— 按「插槽最靠近路径的哪个弧长位置」从入口排到柜台。
 *
 * ⚠️ **它必须与关卡无关**：只看几何，**不引用任何插槽的 id**、也不看有多少个插槽。
 *   否则它只能跑它自己那一关，而那正是它要取代的东西（票 02）。
 *
 * ⚠️ 为什么是这一条而不是另外两条（票 02 各量过）：
 *   · 「**离折线最近**」在真关卡上**退化** —— 9 个插槽里 8 个到折线的距离都是 **15.0**
 *     （正好贴着走道边），这条判据挑不出区别；
 *   · 「**按覆盖弧长最长**」得先回答「用哪一级射程算」—— 而那个数说不清，
 *     且两级会挑出**完全不同**的顺序。
 */
const ORDER_CACHE = new WeakMap<TdWorldDescription, string[]>();
function slotOrder(world: TdWorldDescription): string[] {
  const hit = ORDER_CACHE.get(world);
  if (hit) return hit;
  const arcAt = (slot: { at: Vec }) => {
    let best = Infinity, at = 0;
    for (let d = 0; d <= world.path.total; d += 1) {
      const p = pathPointAt(world.path, d);
      const dd = Math.hypot(p.x - slot.at.x, p.y - slot.at.y);
      if (dd < best) { best = dd; at = d; }
    }
    return at;
  };
  const order = [...world.slots].sort((a, b) => arcAt(a) - arcAt(b)).map((s) => s.id);
  ORDER_CACHE.set(world, order);
  return order;
}

/**
 * **参考玩家**这一步想做什么。**只读状态，不改。**
 *
 * ⚠️ 它是[[参考玩家]] —— **可通关性的下界，不是难度计**：它赢了只说明这一关不是坏的。
 *   三条策略都是票 02 量出来的：
 *   ① **升级优先**（先把已有的升满再铺新的）：同关同顺序下 **20/20 零漏** vs 铺开优先 14/20 漏 4；
 *   ② **沿路径先后铺开**（见 `slotOrder`）；
 *   ③ **选型循环关卡提供的种类** —— 按定义与关卡无关，而且会把每一种机关都用上
 *     （「最便宜」那条永远只建一种，等于让另外两种**根本没被验过**）。
 *   ⚠️ **它必须确定**：同一份关卡两次跑要给同一串动作（`td-sim.test.ts` 有一条断言钉着它）。
 */
export function autoPlay(state: TdState, world: TdWorldDescription): TdAction[] {
  if (state.phase === "won" || state.phase === "lost") return [];
  // ① 升级优先
  const plain = state.towers.find((t) => t.level === 0);
  if (plain) {
    const spec = world.towers.find((t) => t.id === plain.towerId);
    if (spec && state.scrap >= spec.upgradeCost) return [{ kind: "upgrade", slotId: plain.slotId }];
  }
  // ② 沿路径先后铺开（⚠️ 一波正在打的时候**照样建** —— 真人就是在打的中间补机关的）
  for (const slotId of slotOrder(world)) {
    if (state.towers.some((t) => t.slotId === slotId)) continue;
    // ③ 循环现有种类
    const spec = world.towers[state.towers.length % world.towers.length];
    if (!spec || state.scrap < spec.cost) continue;
    return [{ kind: "build", slotId, towerId: spec.id }];
  }
  // ④ 没别的可做的、而且**当前不在打**，就开下一波
  if (state.phase !== "build") return [];
  return [{ kind: "start-wave" }];
}

/** 探针断言读的那几个数（写进 `data-td-state`，比截图可靠）。 */
export function simSnapshot(s: TdState): Record<string, number | string> {
  return {
    phase: s.phase, wave: s.wave, scrap: s.scrap, lives: s.lives,
    built: s.built, upgraded: s.upgraded, killed: s.killed, leaked: s.leaked,
    enemies: s.enemies.length, lastEvent: s.lastEvent,
  };
}
