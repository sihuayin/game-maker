// **`auditConfigPipeline` 的档位判据**（B-02：`reachability` 进 `deterministic`）。
//
// ⚠️ 这条判据要钉的是**分档**，不是「可达性判据本身准不准」（那在 `reachability.test.ts`）：
//   不可达的 config **必须**出现在 `deterministic`、**不得**出现在 `resampleable` ——
//   后者会把它喂回下一发 config（重采样），而「这一关走不通」不是再抽一次能修的。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  auditConfigPipeline, auditReachability, parseAssetPack, parseGameConfig,
  type GameConfig,
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

const withConfig = (f: (c: GameConfig) => void): GameConfig => {
  const c = structuredClone(CONFIG);
  f(c);
  return c;
};
const VIEWPORT = { w: 480, h: 270 };
const pipe = (c: GameConfig) => auditConfigPipeline(c, { manifest: MANIFEST, viewport: VIEWPORT });
/** 一道占满世界高的墙 —— 右边的终点 / 拾取物一律够不到（跳跃顶点远小于它）。 */
const walledOff = () =>
  withConfig((c) => { c.terrain.push({ x: 300, y: 0, w: 100, h: c.world.size.h }); });

describe("§B-02：`reachability` 的 error 进 `deterministic`，不进 `resampleable`", () => {
  it("不可达 config：每条 reachability error 都在 deterministic 里", () => {
    const bad = walledOff();
    const rr = auditReachability(bad, MANIFEST);
    expect(rr.length).toBeGreaterThan(0);
    const p = pipe(bad);
    for (const i of rr) {
      expect(i.severity).toBe("error");
      expect(p.deterministic).toContainEqual(i);
    }
  });

  it("不可达 config：reachability error **一条都不进** resampleable（否则会被喂回下一发）", () => {
    const bad = walledOff();
    const key = (i: { where: string; message: string }) => `${i.where}|${i.message}`;
    const rr = new Set(auditReachability(bad, MANIFEST).map(key));
    const p = pipe(bad);
    expect(p.resampleable.filter((i) => rr.has(key(i)))).toEqual([]);
    // ⚠️ 正反一起断：不是「resampleable 恰好为空」，而是「它没有因为可达性多出东西」。
    expect(p.deterministic.length).toBeGreaterThan(p.resampleable.length);
  });

  it("可达的真夹具：reachability 不新增 error（deterministic 不含「够不到」）", () => {
    expect(auditReachability(CONFIG, MANIFEST)).toEqual([]);
    expect(pipe(CONFIG).deterministic.filter((i) => i.message.includes("够不到"))).toEqual([]);
  });

  it("deterministic 仍是 resampleable 的超集（顺序与既有族不变）", () => {
    const p = pipe(CONFIG);
    expect(p.deterministic.slice(0, p.resampleable.length)).toEqual(p.resampleable);
  });
});

// ── D-03：`classifyConfigIssues` 的归因规则（保守兜底） ──────────────────────
import { classifyConfigIssues, ENTITY_ASSET_KINDS, type AssetKind } from "../src/index.js";

const err = (where: string, message = "boom", code?: "entity-asset-kind" | "entity-state-frames" | "hud-panel-size") =>
  ({ severity: "error" as const, where, message, ...(code === undefined ? {} : { code }) });
const withoutKinds = (kinds: readonly AssetKind[]) => ({
  ...MANIFEST,
  assets: MANIFEST.assets.filter((a) => !kinds.includes(a.kind)),
});
/** 把一件实体的 kind 改成另一个 —— 只改语义来源，不改别的。 */
const kindOf = (id: string, kind: string) => withConfig((c) => {
  const e = c.entities.find((x) => x.id === id)!;
  (e as unknown as { kind: string }).kind = kind;
});

describe("§D-03：归因 —— entity", () => {
  it("实体存在、允许的 kind 包里没有 ⇒ packRooted", () => {
    const r = classifyConfigIssues(CONFIG, withoutKinds(["sprite", "animation"]), [err('entity "suitcase-1"')]);
    expect(r.packRooted).toHaveLength(1);
    expect(r.configFixable).toEqual([]);
  });

  it("实体存在、允许的 kind 包里有 ⇒ configFixable（换一件就行）", () => {
    const r = classifyConfigIssues(CONFIG, MANIFEST, [err('entity "suitcase-1"')]);
    expect(r.configFixable).toHaveLength(1);
    expect(r.packRooted).toEqual([]);
  });

  it("where 的 id **不在 config**（幻觉）⇒ configFixable，哪怕包里没有那类资源", () => {
    const r = classifyConfigIssues(CONFIG, withoutKinds(["sprite", "animation"]), [err('entity "ghost"')]);
    expect(r.configFixable).toHaveLength(1);
    expect(r.packRooted).toEqual([]);
  });

  it("`decor` 的允许集是 undefined ⇒ 能力不明确 ⇒ configFixable", () => {
    expect(ENTITY_ASSET_KINDS.decor).toBeUndefined();
    const r = classifyConfigIssues(kindOf("suitcase-1", "decor"), withoutKinds(["sprite", "animation"]), [err('entity "suitcase-1"')]);
    expect(r.configFixable).toHaveLength(1);
    expect(r.packRooted).toEqual([]);
  });

  it("chest + entity-state-frames：包里没有 ≥2 帧资产 ⇒ packRooted", () => {
    // ⚠️ 把动画全抹掉：剩下的 sprite 只有 1 帧，满足不了「状态帧」能力。
    const singleFrame = {
      ...MANIFEST,
      assets: MANIFEST.assets.map((a) => { const { animations: _a, ...rest } = a; return rest; }),
    };
    const r = classifyConfigIssues(kindOf("suitcase-1", "chest"), singleFrame,
      [err('entity "suitcase-1"', "单帧", "entity-state-frames")]);
    expect(r.packRooted).toHaveLength(1);
  });

  it("chest + entity-state-frames：包里有 ≥2 帧动画 ⇒ configFixable（换那件动画）", () => {
    const r = classifyConfigIssues(kindOf("suitcase-1", "chest"), MANIFEST,
      [err('entity "suitcase-1"', "单帧", "entity-state-frames")]);
    expect(r.configFixable).toHaveLength(1);
    expect(r.packRooted).toEqual([]);
  });

  it("`entity-state-frames` 出现在非 chest/danger 上 ⇒ 不追加帧数条件（按允许 kind 判）", () => {
    const r = classifyConfigIssues(CONFIG, withoutKinds(["sprite", "animation"]),
      [err('entity "suitcase-1"', "x", "entity-state-frames")]);
    expect(r.packRooted).toHaveLength(1);   // pickup 要 sprite/animation，包里没有
  });
});

describe("§D-03：归因 —— hud / player / background / 其它", () => {
  it("`hud.panel.*` / `hud.pip.*`：包内无 ui ⇒ packRooted；有 ui ⇒ configFixable", () => {
    expect(classifyConfigIssues(CONFIG, withoutKinds(["ui"]), [err("hud.panel.size")]).packRooted).toHaveLength(1);
    expect(classifyConfigIssues(CONFIG, withoutKinds(["ui"]), [err("hud.pip[0]")]).packRooted).toHaveLength(1);
    expect(classifyConfigIssues(CONFIG, MANIFEST, [err("hud.panel.size")]).configFixable).toHaveLength(1);
  });

  it("`player` / `player.anims.*`：包内无 animation ⇒ packRooted；有 ⇒ configFixable", () => {
    expect(classifyConfigIssues(CONFIG, withoutKinds(["animation"]), [err("player.anims.run")]).packRooted).toHaveLength(1);
    expect(classifyConfigIssues(CONFIG, MANIFEST, [err("player")]).configFixable).toHaveLength(1);
  });

  it("`scene.background*`：包内无 background ⇒ packRooted；有 ⇒ configFixable", () => {
    expect(classifyConfigIssues(CONFIG, withoutKinds(["background"]), [err("scene.background[0]")]).packRooted).toHaveLength(1);
    expect(classifyConfigIssues(CONFIG, MANIFEST, [err("scene.background")]).configFixable).toHaveLength(1);
  });

  it("未知 `where` ⇒ 兜底 configFixable（不硬拒）", () => {
    const r = classifyConfigIssues(CONFIG, MANIFEST, [err("objective.gate")]);
    expect(r.configFixable).toHaveLength(1);
    expect(r.packRooted).toEqual([]);
  });
});
