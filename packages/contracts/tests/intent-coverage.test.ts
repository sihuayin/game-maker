// 票 19 的**意图覆盖**那一条（`03 §23`，判据名 `intent-coverage`）。
//
// ⚠️ 夹具是**一对真的 intent + design**（`fixtures/upstream/canned.json`）——
//   它在链上四处被用（`compile-design` / `pipeline` / QA 三处），是这一层唯一的真样本。
//   本文件钉三件事：**集合差按 id 算**（含**串桶**）· **单向** · 以及
//   ⚠️ **文本那一半确实不在里面**（那是票 19 亲手砍掉的，见 `intent-coverage.ts` 头一）。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  auditIntentCoverage, GameDesignSpecSchema, GameIntentSpecSchema,
  type GameDesignSpec, type GameIntentSpec, type MissingIntentItem,
} from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const CANNED = JSON.parse(readFileSync(`${ROOT}fixtures/upstream/canned.json`, "utf8")) as {
  intent: unknown;
  design: unknown;
};

const INTENT: GameIntentSpec = (() => {
  const i = GameIntentSpecSchema.safeParse(CANNED.intent);
  if (!i.success) throw new Error("夹具的 intent 本身就不过 schema");
  return i.data;
})();
const DESIGN: GameDesignSpec = (() => {
  const d = GameDesignSpecSchema.safeParse(CANNED.design);
  if (!d.success) throw new Error("夹具的 design 本身就不过 schema");
  return d.data;
})();

/** 一份改过的设计（真夹具 + 一处改动）。⚠️ 夹具是**拷**出来改的，别动磁盘上那一份。 */
const withDesign = (f: (d: GameDesignSpec) => void): GameDesignSpec => {
  const d = structuredClone(DESIGN);
  f(d);
  return d;
};
/** 只看得见 id 的那一栏（大多数断言只关心它）。 */
const ids = (items: readonly MissingIntentItem[]) => items.map((m) => `${m.kind}:${m.id}`);

describe("§真夹具：覆盖成立 ⇒ 一条都不报", () => {
  it("干净的那一对，差集是空的", () => {
    expect(auditIntentCoverage(INTENT, DESIGN)).toEqual([]);
  });

  it("⚠️ 而那不是「没跑」—— 把实体挪走它当场就开口（下一条 describe）", () => {
    // 反证：同一个函数喂一份缺项的设计，立刻有话说。
    expect(auditIntentCoverage(INTENT, withDesign((d) => { d.enemies = []; d.levels[0]!.entities = []; })))
      .toHaveLength(1);
  });
});

describe("§⚠️ 钉子：**文本那一半不在里面**（票 19 的 Q1）", () => {
  it("这份**绿**的设计把 `coreLoop` 整个改写了 —— 文本相等会在同一个位置上误报两条", () => {
    // ⚠️ 这一条是**故意**的：票 19 拿票 10 探针的 4 发真输出来量文本相等，命中 **0/3 ×4**。
    //   夹具这里就是那个形状的缩影（意图 2 条 → 设计 1 条、措辞全不一样）——
    //   而**同一个** `coreLoop` 如果按文本相等去减，会报两条「缺失」。
    const textualWouldMiss = INTENT.coreLoop.filter((x) => !DESIGN.coreLoop.includes(x));
    expect(textualWouldMiss).toEqual(["在废土上跳跃移动", "收集废料"]);
    expect(auditIntentCoverage(INTENT, DESIGN)).toEqual([]);   // 而这条判据一个字都不报
  });

  it("`winConditions` / `player.goals` 在这份夹具里**恰好**相等 —— 那是巧合，不是判据的一部分", () => {
    // ⚠️ 写下来免得下一个人拿这一对当「文本相等可行」的反例：
    //   它相等**只是因为**这份夹具是人手写的；探针里那 4 发真输出没有一个字段是逐字来的。
    expect(INTENT.winConditions).toEqual(DESIGN.winConditions);
    expect(INTENT.player.goals).toEqual(DESIGN.player.goals);
    // 而改变它们**不会**让判据说一个字（文本那一半不存在）：
    const changed = withDesign((d) => { d.winConditions = ["换了个说法"]; d.player.goals = ["也换了"]; });
    expect(auditIntentCoverage(INTENT, changed)).toEqual([]);
  });
});

describe("§实体：按 `type` 落桶找，串桶也算缺（票 19 的 Q9/Q12）", () => {
  it("桶里没有它 ⇒ 一条，`foundIn` **不存在**（那是「没做」）", () => {
    const d = withDesign((x) => { x.enemies = []; x.levels[0]!.entities = []; });
    const missing = auditIntentCoverage(INTENT, d);
    expect(ids(missing)).toEqual(["entity:e-drone"]);
    expect(missing[0]).toEqual({
      kind: "entity", id: "e-drone", saidAs: "巡逻的无人机", type: "enemy", bucket: "enemies"
    });
    // ⚠️ **别写 `foundIn: undefined`** —— optional 就是它的语义（键**根本不存在**）。
    expect("foundIn" in missing[0]!).toBe(false);
  });

  it("⚠️ 同一个 id 躺在**别的**桶里 ⇒ 也是缺，而 `foundIn` 说得清是哪一种（**串桶**）", () => {
    const d = withDesign((x) => { x.enemies = []; x.npcs = [{ id: "e-drone", role: "会说话的无人机", interaction: "对话" }]; });
    const missing = auditIntentCoverage(INTENT, d);
    expect(ids(missing)).toEqual(["entity:e-drone"]);
    expect(missing[0]).toMatchObject({ bucket: "enemies", foundIn: "npcs" });
  });

  it("⚠️ 「任意桶里有就算」是错的 —— 换一张表把 `type` 判反，这一条会红", () => {
    // 反向钉子：`e-drone` 在 `enemies` 里**是**有对家的 —— 所以上面那条必须靠 `foundIn` 区分，
    // 而不是靠「id 在任意桶里出现过」。
    expect(auditIntentCoverage(INTENT, DESIGN)).toEqual([]);
  });
});

describe("§机制：按 id（设计层那一条是**封闭枚举**，没有名字可比）", () => {
  it("设计层没有这个 id ⇒ 一条，带着**用户的原话**（`mechanics[].name` 是自由文本）", () => {
    const d = withDesign((x) => { x.mechanics = [{ id: "m-run", mechanic: "run" }]; });
    const missing = auditIntentCoverage(INTENT, d);
    expect(ids(missing)).toEqual(["mechanic:m-jump"]);
    expect(missing[0]).toEqual({ kind: "mechanic", id: "m-jump", saidAs: "跳跃" });
  });
});

describe("§单向：设计**多**出来的不是缺（票 10 的 R2-Q1）", () => {
  it("补一个意图没点名的实体 ⇒ 什么都不报（那是「需求补全」，是设计层的活）", () => {
    const d = withDesign((x) => {
      x.resources = [{ id: "e-water", purpose: "喝一口回血" }];
      x.levels[0]!.entities = ["e-drone", "e-water"];
    });
    expect(auditIntentCoverage(INTENT, d)).toEqual([]);
  });

  it("空意图 ⇒ 空差集（不是「全缺」）", () => {
    const bare: GameIntentSpec = { ...INTENT, entities: [], mechanics: [] };
    expect(auditIntentCoverage(bare, DESIGN)).toEqual([]);
  });
});

describe("§次序是接口的一部分", () => {
  it("`entities` 先、`mechanics` 后 —— 两个调用方都按它渲染", () => {
    const d = withDesign((x) => {
      x.enemies = []; x.levels[0]!.entities = []; x.mechanics = [{ id: "m-run", mechanic: "run" }];
    });
    expect(ids(auditIntentCoverage(INTENT, d))).toEqual(["entity:e-drone", "mechanic:m-jump"]);
  });
});
