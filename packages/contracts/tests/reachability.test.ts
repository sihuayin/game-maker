// 票 18 的**可达性**那一条（`03 §22` 的冒烟 `boot → spawn → goal`）。
//
// ⚠️ 夹具是**真产物**：真配置（`fixtures/game-configs/last-train.json`）+ 真包。
//   本文件主要是在钉**那条判据的射程** —— 它报什么、**不**报什么、以及为什么「不报」是对的。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  auditGameConfig, auditReferences, auditReachability, DEFAULT_PLAYER_MOVE, jumpSpan, maxJumpHeight,
  parseAssetPack, parseGameConfig, playerMoveOf,
  type AssetPackManifest, type ConfigIssue, type GameConfig,
} from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const MANIFEST = (() => {
  const p = parseAssetPack(JSON.parse(readFileSync(`${ROOT}fixtures/packs/last-train/v2/manifest.json`, "utf8")));
  if (!p.ok) throw new Error("夹具包本身就不过 schema：" + p.errors.join("；"));
  return p.value;
})();
const CONFIG = (() => {
  const c = parseGameConfig(JSON.parse(readFileSync(`${ROOT}fixtures/game-configs/last-train.json`, "utf8")));
  if (!c.ok) throw new Error("夹具配置本身就不过 schema：" + c.errors.join("；"));
  return c.value;
})();

/** 一份改过的配置（真夹具 + 一处改动）。 */
const withConfig = (f: (c: GameConfig) => void): GameConfig => {
  const c = structuredClone(CONFIG);
  f(c);
  return c;
};
const reach = (c: GameConfig) => auditReachability(c, MANIFEST);
const who = (is: readonly ConfigIssue[]) => is.map((i) => i.where);

describe("§真夹具：这一关是通的", () => {
  it("一条都不报", () => {
    expect(reach(CONFIG)).toEqual([]);
  });

  it("⚠️ 而那**不是因为判据没跑** —— 它真跑过，只是没话说", () => {
    // 反证：把**同一个**判据喂给一份挖了沟的配置，它立刻开口（下一条 describe）。
    expect(reach(withConfig((c) => { c.terrain = [{ x: 0, y: 250, w: 200, h: 20 }, { x: 400, y: 250, w: 1040, h: 20 }]; })))
      .not.toEqual([]);
  });

  it("⚠️ 扫过的车厢（`hazard`）**当空气** —— 它横在 800..1200，而这一关仍然「通」", () => {
    const carriage = CONFIG.entities.find((e) => e.id === "carriage")!;
    expect(carriage.kind).toBe("hazard");
    expect(carriage.motion).toBeDefined();
    expect(reach(CONFIG)).toEqual([]);
  });
});

describe("§它**报**什么（不可达的那半边）", () => {
  it("挖一条 200px 的沟 ⇒ 沟那边的一个都够不到（而**沟这边**的 `suitcase-1` 一起陪葬 —— 它也在沟外）", () => {
    const bad = reach(withConfig((c) => {
      c.terrain = [{ x: 0, y: 250, w: 200, h: 20 }, { x: 400, y: 250, w: 1040, h: 20 }];
    }));
    expect(who(bad).sort()).toEqual(['entity "signal"', 'entity "suitcase-1"', 'entity "suitcase-2"', 'entity "suitcase-3"'].sort());
    for (const i of bad) expect(i.severity).toBe("error");
    expect(bad[0]!.message).toMatch(/够不到/);
  });

  it("竖一面 **100px** 高的墙（跳跃顶点只有 60.5px）⇒ 墙那边的够不到，**墙这边的够得到**", () => {
    const bad = reach(withConfig((c) => {
      c.entities.push({ id: "wall", kind: "solid", at: { x: 600, y: 250 }, asset: "prop-luggage-pile", body: { w: 20, h: 100 } });
    }));
    expect(who(bad)).not.toContain('entity "suitcase-1"');   // x=300，墙这一边 ✓
    expect(who(bad)).toContain('entity "suitcase-3"');       // x=1100，墙那边 ✗
  });

  it("把 pickup 抬到 **120px** 高（顶点 60.5px，且底下没东西可踩）⇒ 报它一个", () => {
    const bad = reach(withConfig((c) => { c.entities.find((e) => e.id === "suitcase-2")!.at = { x: 700, y: 130 }; }));
    expect(who(bad)).toEqual(['entity "suitcase-2"']);
  });
});

describe("§它**不**报什么（宽松的那一侧 —— 误伤比漏报贵）", () => {
  it("40px 的沟：跳得过去 ⇒ 不报", () => {
    expect(reach(withConfig((c) => {
      c.terrain = [{ x: 0, y: 250, w: 600, h: 20 }, { x: 640, y: 250, w: 800, h: 20 }];
    }))).toEqual([]);
  });

  it("**40px** 高的墙（比顶点矮，跳得上去）⇒ 不报", () => {
    expect(reach(withConfig((c) => {
      c.entities.push({ id: "wall", kind: "solid", at: { x: 600, y: 250 }, asset: "prop-luggage-pile", body: { w: 20, h: 40 } });
    }))).toEqual([]);
  });

  it("**50px** 高的 pickup（跳得到）⇒ 不报 —— 而 120px 那条报了（上一条 describe）", () => {
    expect(reach(withConfig((c) => { c.entities.find((e) => e.id === "suitcase-2")!.at = { x: 700, y: 200 }; }))).toEqual([]);
  });

  it("⚠️ 出生点**附近没有任何落脚点** ⇒ **一条都不报**（那不是「不可达」，是「出生点非法」）", () => {
    // 把出生点下面、以及它左右一个身位之内的地形全抽走 —— 玩家悬在空中。
    // ⚠️ 这件事归 `auditGameConfig` 的自洽族；在这里报「全都够不到」会把人指到一个不存在的出路上。
    const c = withConfig((cfg) => { cfg.terrain = [{ x: 400, y: 250, w: 1040, h: 20 }]; });
    expect(reach(c)).toEqual([]);
    // 反证：出生点**站在地上**的时候，同一个判据立刻开口（挖沟那一条）
    expect(reach(withConfig((cfg) => {
      cfg.terrain = [{ x: 0, y: 250, w: 200, h: 20 }, { x: 400, y: 250, w: 1040, h: 20 }];
    }))).not.toEqual([]);
  });

  it("⚠️ **一个身位之内就算够到** —— goal 埋在行李堆正中间（站不进去）也**不报**", () => {
    // 这是**故意**宽的那一侧：判据只该在「怎么走都碰不到」时开口，
    // 而「碰到」在物理上没有一个利落的定义（盒子的哪一部分算碰到？）
    // ⇒ 宁可说可达。⚠️ 代价是「终点被埋进墙里」这一种坏设计**抓不到**（文件头二写着）。
    const c = withConfig((cfg) => { cfg.entities.find((e) => e.id === "signal")!.at = { x: 500, y: 250 }; });
    expect(reach(c)).toEqual([]);
  });

  it("⚠️ 玩家资源解不到 ⇒ 也不报（那是**引用族**的事，本判据不重复说一遍）", () => {
    expect(reach(withConfig((c) => { c.player.asset = "查无此资源"; }))).toEqual([]);
  });
});

describe("§⚠️ 票 21：提示词里那个「同高跨度」就是**真的边界**（不是判据那套宽松模型的上界）", () => {
  // 两个**不同的命题**，本票的补丁同时压着它们：
  //   ① 模型拿到了正确参数（那条判据在 `packages/assets/tests/compile-runtime.test.ts`）；
  //   ② 照那些参数摆出来的布局确实可达 —— 就是这一条。
  //
  // ⚠️ 为什么要分开：`compile-runtime` 现在把 `jumpSpan(move, 0)`（同高 = **最紧**的那一半）
  //   告诉模型，而**判据自己**搜索时用的是 `jumpSpan(move, 世界高)`（落点掉到世界底部 = **最宽**
  //   的那一半，给的是上界）。两个数**不一样**（66 vs 110.13），而会响的是**紧**的那个 ⇒
  //   拿宽松那个去教模型，会让「照提示词摆的关卡照样红」。
  const gapAt = (w: number) => withConfig((c) => {
    c.terrain = [{ x: 0, y: 250, w: 600, h: 20 }, { x: 600 + w, y: 250, w: 840 - w, h: 20 }];
  });

  it("沟宽 60px ⇒ 通（在 66px 之内）；沟宽 100px ⇒ 报够不到 —— **槽宽 100 远比判据的搜索半径 111 窄**", () => {
    expect(jumpSpan(DEFAULT_PLAYER_MOVE)).toBeCloseTo(66, 1);                       // 紧的那一半
    expect(Math.ceil(jumpSpan(DEFAULT_PLAYER_MOVE, 270))).toBeGreaterThan(100);      // 松的那一半 = 111
    expect(reach(gapAt(60))).toEqual([]);
    expect(who(reach(gapAt(100)))).toContain('entity "signal"');
  });

  it("⚠️ 而**顶点**那一半照旧：100px 高的墙过不去、40px 的过得去（与提示词说的 60.5px 同一个数）", () => {
    expect(maxJumpHeight(playerMoveOf(CONFIG))).toBeCloseTo(60.5, 1);
    const wall = (h: number) => withConfig((c) => {
      c.entities.push({ id: "wall", kind: "solid", at: { x: 600, y: 250 }, asset: "prop-luggage-pile", body: { w: 20, h } });
    });
    expect(reach(wall(40))).toEqual([]);
    expect(who(reach(wall(100)))).toContain('entity "signal"');
  });

  it("⚠️ **判据自己用的是宽的那一半**：从高台掉到地面（落差 150px）时，一趟能跨 70px —— 而提示词给模型的是 66px", () => {
    // ⚠️ 这条钉的是**判据的搜索半径**（`maxDx = ceil(jumpSpan(move, 世界高))`）——
    //   有落差时滞空更久、一趟更远，而「全局重跑式」的搜索必须覆盖到那一趟。
    //   把半径退化成同高跨度（66）⇒ 这一条**当场红**（BFS 根本不去看 70px 外的落脚点）。
    const dropHop = withConfig((c) => {
      c.terrain = [{ x: 0, y: 100, w: 200, h: 20 }, { x: 300, y: 250, w: 1140, h: 20 }];
      c.player.at = { x: 40, y: 100 };                       // 从台上出发
      c.entities = c.entities.filter((e) => e.id === "signal");
      c.entities[0]!.at = { x: 340, y: 250 };                // 目标在地面上（离台右缘一趟的距离）
      c.objective = { kind: "collect-then-reach", gate: "signal" };
    });
    expect(reach(dropHop)).toEqual([]);
    // ⇒ 落差 150px 时那一趟的上界（94.6）比同高那半（66）宽 —— 两个数**不一样**，
    //   而给模型的是**紧**的那个（教模型用宽的那个，照它摆的关卡照样红）。
    expect(jumpSpan(DEFAULT_PLAYER_MOVE, 150)).toBeCloseTo(94.6, 1);
    expect(jumpSpan(DEFAULT_PLAYER_MOVE, 150)).toBeGreaterThan(jumpSpan(DEFAULT_PLAYER_MOVE));
  });
});

describe("§判据的门槛：它凭什么够得上「判据」", () => {
  it("跳跃顶点 60.5px —— 上面那几条阈值都是从这个数来的", () => {
    expect(maxJumpHeight(playerMoveOf(CONFIG))).toBeCloseTo(60.5, 1);
  });

  it("⚠️ 它**只报不可达**，从不报「可达」—— 一条好消息都不产", () => {
    for (const bad of [
      reach(CONFIG),
      reach(withConfig((c) => { c.entities.find((e) => e.id === "suitcase-2")!.at = { x: 700, y: 130 }; }))
    ])
      for (const i of bad) expect(i.severity).toBe("error");
  });
});

describe("§⚠️ `auditReferences` 与 `auditGameConfig` 的分工（票 18 的 R2-Q1）", () => {
  it("`auditGameConfig` 以 `auditReferences` 开头 —— **同一份实现，不是抄的第二份**", () => {
    const c = withConfig((cfg) => {
      cfg.hud.panel.asset = "查无此资源";
      cfg.hud.panel.at = { x: 9999, y: 262 };      // 同时踩**自洽族**那一条（HUD 落在世界外）
    });
    const refs = auditReferences(c, MANIFEST).map((i) => i.where + i.message);
    const all = auditGameConfig(c, MANIFEST);
    expect(all.slice(0, refs.length).map((i) => i.where + i.message)).toEqual(refs);
    expect(refs.length).toBeGreaterThan(0);
  });

  it("⚠️ 而**自洽族不进 `auditReferences`** —— 它是 `auditGameConfig` 自己的那两条判据", () => {
    const c = withConfig((cfg) => { cfg.hud.panel.at = { x: 9999, y: 262 }; });
    expect(auditReferences(c, MANIFEST)).toEqual([]);                       // 引用族：没有话
    expect(auditGameConfig(c, MANIFEST).some((i) => /世界之外/.test(i.message))).toBe(true);  // 自洽族：有
  });

  it("⚠️ 而 `characterId` **不在这里**（它住清单，由 `pack` 抛 —— 票 18 更正了 `01 §10`）", () => {
    // 这条钉的是**不存在**：`GameConfigSchema` 里根本没有那个键，`.strict()` 会当场拒。
    const r = parseGameConfig({ ...CONFIG, characterId: " traveler" });
    expect(r.ok).toBe(false);
  });
});
