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
