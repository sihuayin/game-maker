import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { AssetPlanCapabilities, GameDesignSpec, VisualWorldSpec } from "@game-maker/contracts";
import {
  plannerCapabilitiesOf, resolveRoute, sourceForDecision,
  type ExistingAsset, type RouteSuccess,
} from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const RECIPE = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/e2e/wasteland-platformer/asset-recipe.json"), "utf8"));
const DESIGN: GameDesignSpec = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/e2e/wasteland-platformer/game-design.json"), "utf8"));
const WORLD: VisualWorldSpec = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/e2e/wasteland-platformer/visual-world.json"), "utf8"));
const specOf = (id: string) => RECIPE.assets.find((a: any) => a.spec.id === id)!.spec;
const sourceOf = (id: string) => RECIPE.assets.find((a: any) => a.spec.id === id)!.source;

const CAPS = (over: Partial<AssetPlanCapabilities["routes"]> = {}): AssetPlanCapabilities => ({
  routes: { image: true, drawlist: true, import: false, ...over },
  runtime: { profile: "platformer", version: "1", capabilities: [] },
});
const existing = (over: Partial<ExistingAsset> = {}): ExistingAsset => ({
  id: "chest-ruined-city", ref: "frame.png", mustReuse: true, accessible: true, ...over,
});
const resolve = (id: string, candidate: any, caps = CAPS(), assets: ExistingAsset[] = []) =>
  resolveRoute({ spec: specOf(id), context: { design: DESIGN, visualWorld: WORLD }, capabilities: caps, existingAssets: assets, candidate });

describe("resolveRoute：硬信号与顺序（第三轮 Q10.2/Q10.4）", () => {
  it("characterId 最高：候选 drawlist 也覆盖为 image:character，participated=false", () => {
    const d = resolve("player-scavenger", "drawlist");
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.route).toBe("image");
    expect(d.reason.code).toBe("image:character");
    expect(d.inputs).toEqual({ masterAsset: "master-player-scavenger" });
    expect(d.participated).toBe(false);
    expect(d.candidate).toBe("drawlist");
  });

  it("masterAsset > animation > background 的顺序：背景走 image:background", () => {
    const d = resolve("level-downtown-ruins", "drawlist");
    expect(d.ok && d.reason.code).toBe("image:background");
  });

  it("九宫格 UI 是 drawlist 硬信号：候选 image 不覆盖，participated=false", () => {
    const d = resolve("ui-scrap-counter", "image");
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.route).toBe("drawlist");
    expect(d.reason.code).toBe("drawlist:ui-ninepatch");
    expect(d.participated).toBe(false);
  });

  it("非九宫格 UI 由候选平局：drawlist / image 各一例，participated=true", () => {
    const d1 = resolve("ui-scrap-icon", "drawlist");
    expect(d1.ok && d1.route === "drawlist" && d1.reason.code === "drawlist:candidate" && d1.participated).toBe(true);
    const d2 = resolve("ui-scrap-icon", "image");
    expect(d2.ok && d2.route === "image" && d2.reason.code === "image:candidate" && d2.participated).toBe(true);
  });

  it("普通 sprite 由候选平局", () => {
    const d = resolve("chest-ruined-city", "image");
    expect(d.ok && d.route === "image" && d.participated).toBe(true);
  });
});

describe("resolveRoute：import 的合格条件（第三轮 Q10.1）", () => {
  it("mustReuse + accessible ⇒ import（候选 image 不能覆盖）", () => {
    const d = resolve("chest-ruined-city", "image", CAPS({ import: true }), [existing()]);
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(d.route).toBe("import");
    expect(d.reason.code).toBe("import:explicit-ref");
    expect(d.inputs).toEqual({ importRef: "frame.png" });
    expect(d.participated).toBe(false);
  });

  it("mustReuse 但 ref 不可访问 ⇒ ref 失败，不回退", () => {
    const d = resolve("chest-ruined-city", "image", CAPS({ import: true }), [existing({ accessible: false })]);
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.failure).toBe("ref");
  });

  it("mustReuse=false ⇒ import 不合格，继续候选平局", () => {
    const d = resolve("chest-ruined-city", "drawlist", CAPS(), [existing({ mustReuse: false })]);
    expect(d.ok && d.route === "drawlist" && d.reason.code === "drawlist:candidate").toBe(true);
  });

  it("候选 import 不能自己触发 import：无硬信号时直接 no-route", () => {
    const d = resolve("chest-ruined-city", "import");
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.failure).toBe("no-route");
  });
});

describe("resolveRoute：能力缺失不换路（第二轮 Q7 / 第四轮 Q14）", () => {
  it("需要 image 但 image 不可用 ⇒ capability（missing=image）", () => {
    const d = resolve("player-scavenger", "drawlist", CAPS({ image: false }));
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.failure).toBe("capability");
    expect(d.missing).toBe("image");
  });

  it("需要 drawlist 但 drawlist 不可用 ⇒ capability", () => {
    const d = resolve("ui-scrap-counter", "drawlist", CAPS({ drawlist: false }));
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.failure).toBe("capability");
    expect(d.missing).toBe("drawlist");
  });

  it("需要 import 但 import 不可用 ⇒ capability", () => {
    const d = resolve("chest-ruined-city", "image", CAPS({ import: false }), [existing()]);
    expect(d.ok).toBe(false);
    if (d.ok) return;
    expect(d.failure).toBe("capability");
    expect(d.missing).toBe("import");
  });
});

describe("sourceForDecision：最终 source 与 route 一致", () => {
  const ok = (id: string, candidate: any, caps = CAPS(), assets: ExistingAsset[] = []): RouteSuccess => {
    const d = resolve(id, candidate, caps, assets);
    if (!d.ok) throw new Error(d.message);
    return d;
  };
  it("image 决策保留候选 image 的 reference/background", () => {
    const src = { kind: "image" as const, reference: "ref.png", background: { tolerance: 12 } };
    expect(sourceForDecision(src, ok("chest-ruined-city", "image"))).toEqual(src);
  });
  it("候选 drawlist → image 决策产出最小 image source", () => {
    expect(sourceForDecision({ kind: "drawlist" }, ok("player-scavenger", "drawlist"))).toEqual({ kind: "image" });
  });
  it("import 决策产出 import source（并保留同 ref 的候选 source）", () => {
    const d = ok("chest-ruined-city", "import", CAPS({ import: true }), [existing()]);
    expect(sourceForDecision({ kind: "import", ref: "frame.png" }, d, existing())).toEqual({ kind: "import", ref: "frame.png" });
    expect(sourceForDecision({ kind: "drawlist" }, d, existing())).toEqual({ kind: "import", ref: "frame.png" });
  });
});

describe("确定性（第四轮 Q13）：同一归一化输入重复 20 次", () => {
  it("route / reason.code / inputs / candidate / participated 完全一致", () => {
    const input = {
      spec: specOf("chest-ruined-city"),
      context: { design: DESIGN, visualWorld: WORLD },
      capabilities: CAPS(), existingAssets: [], candidate: "drawlist" as const,
    };
    const first = resolveRoute(input);
    for (let i = 0; i < 20; i++) expect(resolveRoute(input)).toEqual(first);
  });
});

describe("plannerCapabilitiesOf：能力快照来源", () => {
  it("image transport 决定 image；existingAssets 决定 import；runtime 来自 design.runtimeProfile", () => {
    const a = plannerCapabilitiesOf({ design: DESIGN, imageTransport: { protocol: "gemini", baseUrl: "x", apiKey: "k" }, hasExistingAssets: false });
    expect(a.routes).toEqual({ image: true, drawlist: true, import: false });
    expect(a.runtime.profile).toBe("platformer");
    expect(a.runtime.version).toBe("1");
    expect(a.runtime.capabilities.length).toBeGreaterThan(0);
    const b = plannerCapabilitiesOf({ design: DESIGN, hasExistingAssets: true });
    expect(b.routes).toEqual({ image: false, drawlist: true, import: true });
  });
});
