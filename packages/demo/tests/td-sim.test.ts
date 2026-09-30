import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  FIXED_DT_MS, MAX_FRAME_MS, advance, autoPlay, createSim, enemyPos, simSnapshot,
  buildTdWorld, type TdAction, type TdState, type TdWorldDescription,
} from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const PACK = path.join(ROOT, "fixtures/packs/counter-siege/v4");
const CONFIG = path.join(ROOT, "fixtures/td-configs/counter-siege.json");
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

const world = (over: (c: Record<string, unknown>) => void = () => {}): TdWorldDescription => {
  const c = readJson(CONFIG);
  over(c);
  return buildTdWorld(readJson(path.join(PACK, "manifest.json")), c, { packBase: "../../pack/v4/" });
};

/** 一步一步推 `ms` 毫秒（每步 FIXED_DT_MS），动作只在第一步给。**至少走一步** ——
 *  `run(w, 0, [建塔])` 的意思是「把这一下点了」，而不是「什么都不做」。 */
function run(w: TdWorldDescription, ms: number, actions: TdAction[] = [], s: TdState = createSim(w)): TdState {
  const steps = Math.max(1, Math.round(ms / FIXED_DT_MS));
  for (let i = 0; i < steps; i++) s = advance(s, FIXED_DT_MS, i === 0 ? actions : [], w);
  return s;
}

describe("塔防模拟：确定性（**截图与 vitest 靠它才说得上话**）", () => {
  it("同一个起点、同一串步长 → **逐字段相同**（无随机数）", () => {
    const w = world();
    const a = run(w, 5000, [{ kind: "build", slotId: "s3", towerId: "nailgun" }, { kind: "start-wave" }]);
    const b = run(w, 5000, [{ kind: "build", slotId: "s3", towerId: "nailgun" }, { kind: "start-wave" }]);
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it("**固定步长**：一次给 160ms 与分十次给 16ms 结果相同", () => {
    const w = world();
    const start = run(w, 1000, [{ kind: "start-wave" }]);
    const coarse = advance(start, 160, [], w);
    let fine = start;
    for (let i = 0; i < 10; i++) fine = advance(fine, FIXED_DT_MS, [], w);
    expect(JSON.stringify(coarse)).toEqual(JSON.stringify(fine));
  });

  it("**超大 delta 被夹住** —— 无头 Chrome 的虚拟时间会给出一整段的大 delta，不夹住一整波会在一帧里漏光", () => {
    const w = world();
    const s = run(w, 100, [{ kind: "start-wave" }]);
    const jumped = advance(s, 60_000, [], w);          // 「切后台回来」
    expect(jumped.ms - s.ms).toBeLessThanOrEqual(MAX_FRAME_MS);
  });

  it("**一次点击只执行一次** —— 不是在这一帧的每个小步里各执行一遍", () => {
    const w = world();
    // 一次 advance 走 160ms（= 10 个小步），期间只给一次 build
    const s = advance(createSim(w), 160, [{ kind: "build", slotId: "s3", towerId: "nailgun" }], w);
    expect(s.built).toBe(1);
    expect(s.scrap).toBe(w.economy.startScrap - w.towers[0]!.cost);
  });
});

describe("塔防模拟：三条写死的战斗规则（契约文件头那三条）", () => {
  it("① 伤害在**开火那一刻**结算：抛射物还没飞到，血已经掉了", () => {
    const w = world();
    let s = run(w, 0, [{ kind: "build", slotId: "s3", towerId: "nailgun" }, { kind: "start-wave" }]);
    // 推到第一个敌人进了射程
    for (let i = 0; i < 2000 && s.projectiles.length === 0; i++) s = advance(s, FIXED_DT_MS, [], w);
    expect(s.projectiles.length).toBeGreaterThan(0);
    // 抛射物还在飞，而敌人已经吃过伤害了
    const flying = s.projectiles[0]!;
    expect(flying.tMs).toBeLessThan(flying.durMs);
    const hurt = s.enemies.some((e) => e.hp < w.enemies.find((x) => x.id === e.enemyId)!.hp);
    expect(hurt).toBe(true);
  });

  it("② 护甲平减、**下限 1** —— 高护甲只会被磨，不会变成打不动", () => {
    const w = world((c) => {
      (c as { enemies: { armor: number }[] }).enemies.forEach((e) => { e.armor = 999; });
    });
    let s = run(w, 0, [{ kind: "build", slotId: "s3", towerId: "nailgun" }, { kind: "start-wave" }]);
    // ⚠️ 要**在过程里**看：拾荒者挨满 20 下才死，而这一波结束得比那快 ——
    //   在末尾断言会得到「一个敌人都没有」而不是「打不动」。
    const maxHp = w.enemies.find((x) => x.id === "scavenger")!.hp;
    let hurt = false, hits = 0;
    for (let i = 0; i < 500 && !hurt; i++) {
      s = advance(s, FIXED_DT_MS, [], w);
      hurt = s.enemies.some((e) => e.hp < maxHp);
      hits += s.projectiles.length;
    }
    expect(hurt).toBe(true);            // 999 护甲也**照样掉血**，只是每次掉 1 点
    expect(s.killed).toBe(0);           // 而它确实杀不死 —— 下限 1 是「磨」不是「免疫」
  });

  it("③ 减速**取最强的一份、时长刷新到更晚**（不是叠加、不是连乘）", () => {
    const w = world((c) => {
      // 两级都调成同一个强减速，好让「叠加」与「取最强」能区分开
      const t = (c as { towers: { id: string; levels: { slow?: { factor: number; ms: number } }[] }[] })
        .towers.find((x) => x.id === "shock")!;
      for (const l of t.levels) l.slow = { factor: 0.5, ms: 1000 };
    });
    let s = run(w, 0, [{ kind: "build", slotId: "s6", towerId: "shock" }, { kind: "start-wave" }]);
    // ⚠️ 同样要**在过程里**看（减速只持续 1s，一波早就打完了）
    let slowed = s.enemies.filter((e) => e.slowUntil > s.ms);
    let everSlowed = 0;
    for (let i = 0; i < 800; i++) {
      s = advance(s, FIXED_DT_MS, [], w);
      slowed = s.enemies.filter((e) => e.slowUntil > s.ms);
      everSlowed = Math.max(everSlowed, slowed.length);
    }
    expect(everSlowed).toBeGreaterThan(0);
    // 叠加/连乘会得到 0.25；**取最强**只会得到 0.5
    for (const e of slowed) expect(e.slowFactor).toBeCloseTo(0.5, 6);
  });

  it("**aoe 不索敌**：射程内的全部各吃一份", () => {
    const w = world();
    // 攒够钱建电击地板，把它放在长走道旁边
    let s = createSim(w);
    s = { ...s, scrap: 999 };
    s = run(w, 0, [{ kind: "build", slotId: "s6", towerId: "shock" }, { kind: "start-wave" }], s);
    let sawBurst = false, sawMulti = false;
    for (let i = 0; i < 800; i++) {
      const before = s.enemies.map((e) => e.hp);
      s = advance(s, FIXED_DT_MS, [], w);
      if (s.bursts.length > 0) sawBurst = true;
      // 同一帧里**不止一只**掉血 ⇒ 这一下是范围伤害，不是单体
      const hurtNow = s.enemies.filter((e, k) => before[k] !== undefined && e.hp < before[k]!).length;
      if (hurtNow > 1) sawMulti = true;
    }
    expect(sawBurst).toBe(true);
    expect(sawMulti).toBe(true);
  });
});

describe("塔防模拟：经济与胜负", () => {
  it("建塔花钱、钱不够就建不起来（**动作被拒不是错误，是规则**）", () => {
    const w = world();
    const poor = { ...createSim(w), scrap: 0 };
    const s = run(w, 0, [{ kind: "build", slotId: "s3", towerId: "floodlight" }], poor);
    expect(s.towers).toHaveLength(0);
    expect(s.scrap).toBe(0);
  });

  it("同一个插槽建不了第二座（升级是另一个动作）", () => {
    const w = world();
    const s = run(w, 0, [
      { kind: "build", slotId: "s3", towerId: "nailgun" },
      { kind: "build", slotId: "s3", towerId: "nailgun" },
    ], { ...createSim(w), scrap: 999 });
    expect(s.towers).toHaveLength(1);
  });

  it("升级要花钱、只能升一次", () => {
    const w = world();
    let s = { ...createSim(w), scrap: 999 };
    s = run(w, 0, [{ kind: "build", slotId: "s3", towerId: "nailgun" }], s);
    const afterBuild = s.scrap;
    s = run(w, 0, [{ kind: "upgrade", slotId: "s3" }], s);
    expect(s.towers[0]!.level).toBe(1);
    expect(afterBuild - s.scrap).toBe(w.towers[0]!.upgradeCost);
    s = run(w, 0, [{ kind: "upgrade", slotId: "s3" }], s);
    expect(s.towers[0]!.level).toBe(1);
  });

  it("漏一个敌人掉它自己那份声望（蛮兵掉 2 —— leakCost 是数据不是常量）", () => {
    const w = world();
    // 一座塔都不建，把第一波放光
    let s = run(w, 0, [{ kind: "start-wave" }]);
    for (let i = 0; i < 60_000 / FIXED_DT_MS; i++) {
      s = advance(s, FIXED_DT_MS, [], w);
      if (s.phase !== "wave") break;
    }
    expect(s.leaked).toBe(6);                                   // 第一波 6 只全漏
    expect(s.lives).toBe(w.economy.lives - 6);                  // 拾荒者 leakCost = 1
  });

  it("清场之后发波次奖励并回到建造期；打完最后一波就是**赢**", () => {
    const w = world();
    let s = createSim(w);
    for (let guard = 0; guard < 400_000 / FIXED_DT_MS && s.phase !== "won" && s.phase !== "lost"; guard++) {
      s = advance(s, FIXED_DT_MS, autoPlay(s, w), w);
    }
    expect(s.phase).toBe("won");
    expect(s.wave).toBe(w.waves.length);
    expect(s.lives).toBeGreaterThan(0);
  });

  it("声望归零就是**输**，而且不再继续推进", () => {
    const w = world((c) => { (c as { economy: { lives: number } }).economy.lives = 1; });
    let s = createSim(w);
    for (let i = 0; i < 60_000 / FIXED_DT_MS && s.phase !== "lost"; i++) {
      s = advance(s, FIXED_DT_MS, autoPlay(s, w), w);
    }
    expect(s.phase).toBe("lost");
    expect(s.lives).toBe(0);
  });
});

describe("参考玩家（`?auto=1` 与 vitest 用的是**同一个人**）", () => {
  it("**它能打赢这一关** —— 于是「这份配置是通的」是一条可以在 vitest 里断言的事", () => {
    const w = world();
    let s = createSim(w);
    for (let i = 0; i < 400_000 / FIXED_DT_MS && s.phase !== "won" && s.phase !== "lost"; i++) {
      s = advance(s, FIXED_DT_MS, autoPlay(s, w), w);
    }
    const snap = simSnapshot(s);
    expect(snap.phase).toBe("won");
    // ⚠️ 实测：**漏 1、声望 19/20**（旧尺子：漏 6、12/20）。
    //   留一点余量而不是钉 0 —— 这一关的数值将来一动，0 就会变成一条**与玩家无关的**假红。
    expect(snap.leaked as number).toBeLessThanOrEqual(2);
    expect(snap.built as number).toBe(w.slots.length);          // 每个插槽都用上了
  });

  it("⚠️ **与关卡无关**：把插槽 id 全部改名，结果**逐字段相同**（票 02 的确定性断言）", () => {
    // 这一条替掉了原先那条「播放顺序里的插槽 id 全都在关卡里」——
    // 那条测的是一张**写死的插槽表**，而那张表已经不存在了。
    // 真正要钉住的是：**玩家只看几何，不引用任何插槽 id**。改名不该改变任何东西。
    const run = (w: ReturnType<typeof world>) => {
      let s = createSim(w);
      for (let i = 0; i < 400_000 / FIXED_DT_MS && s.phase !== "won" && s.phase !== "lost"; i++) {
        s = advance(s, FIXED_DT_MS, autoPlay(s, w), w);
      }
      return simSnapshot(s);
    };
    const w1 = world();
    const w2 = world((c) => {
      (c as { slots: { id: string }[] }).slots = (c as { slots: { id: string }[] }).slots
        .map((s, i) => ({ ...s, id: `slot-${String.fromCharCode(97 + i)}` }));
    });
    expect(JSON.stringify(run(w2))).toBe(JSON.stringify(run(w1)));
  });

  it("结束之后不再产动作（赢了/输了都不该继续点）", () => {
    const w = world();
    const done = { ...createSim(w), phase: "won" as const };
    expect(autoPlay(done, w)).toEqual([]);
  });

  it("在打的时候**照样建塔** —— 真实玩家就是在打的中间补机关的", () => {
    const w = world();
    const mid = { ...createSim(w), phase: "wave" as const, scrap: 999 };
    expect(autoPlay(mid, w)[0]!.kind).toBe("build");
  });
});

describe("敌人在哪：位置由**模拟**算，渲染层只读", () => {
  it("新出的敌人在起点、走得越远越靠近柜台", () => {
    const w = world();
    let s = run(w, 0, [{ kind: "start-wave" }]);
    for (let i = 0; i < 200 && s.enemies.length === 0; i++) s = advance(s, FIXED_DT_MS, [], w);
    const e = s.enemies[0]!;
    const p0 = enemyPos(w, e);
    s = advance(s, 1000, [], w);
    const moved = s.enemies.find((x) => x.id === e.id);
    if (moved) expect(enemyPos(w, moved).x).toBeLessThanOrEqual(p0.x);   // 向左走（朝柜台）
  });
});
