import { describe, expect, it } from "vitest";
import { ASSET_PLAN_REASON_CODES, ASSET_PLAN_ROUTES, parseAssetPlan } from "../src/index.js";

const valid = () => ({
  format: "asset-plan/v1",
  recipeId: "wasteland-scavenger-assets",
  recipeVersion: 2,
  plannerVersion: "1",
  capabilities: {
    routes: { image: true, drawlist: true, import: false },
    runtime: { profile: "platformer", version: "1", capabilities: ["collision:aabb"] },
  },
  inputs: { styleRef: "stylespec.json", referenceImage: "reference.png" },
  assets: [
    {
      id: "player-scavenger",
      route: "image",
      reason: { code: "image:character", text: "角色资源（characterId）" },
      inputs: { masterAsset: "master-player-scavenger" },
      candidate: "drawlist",
      participated: false,
    },
  ],
});
const mutate = (f: (p: ReturnType<typeof valid>) => void) => { const p = structuredClone(valid()); f(p); return p; };

describe("asset-plan/v1：合法计划记录", () => {
  it("最小合法 sidecar 通过", () => {
    const r = parseAssetPlan(valid());
    expect(r.ok, r.ok ? "" : r.errors.join(" / ")).toBe(true);
  });

  it("route 与 reason 的封闭枚举与 source.kind 三值一致", () => {
    expect([...ASSET_PLAN_ROUTES].sort()).toEqual(["drawlist", "image", "import"]);
    expect(ASSET_PLAN_REASON_CODES).toHaveLength(8);
  });
});

describe("asset-plan/v1：结构/枚举必须硬拒", () => {
  it("未知 format / 版本 / route / reason / candidate 都拒", () => {
    for (const p of [
      mutate((x) => { x.format = "asset-plan/v2"; }),
      mutate((x) => { x.assets[0]!.route = "video"; }),
      mutate((x) => { x.assets[0]!.reason.code = "image:magic"; }),
      mutate((x) => { x.assets[0]!.candidate = "video"; }),
    ]) expect(parseAssetPlan(p).ok, JSON.stringify(p)).toBe(false);
  });

  it("必填字段缺失 / null / 空字符串 / 错误类型都拒（不宽松解析）", () => {
    for (const p of [
      mutate((x) => { delete (x as any).format; }),
      mutate((x) => { (x as any).recipeVersion = null; }),
      mutate((x) => { (x as any).recipeId = ""; }),
      mutate((x) => { (x as any).assets[0]!.participated = "no"; }),
      mutate((x) => { (x as any).capabilities.routes.image = "yes"; }),
      mutate((x) => { (x as any).assets[0]!.inputs = null; }),
      mutate((x) => { (x as any).assets[0]!.reason = { code: "image:character", text: "" }; }),
    ]) expect(parseAssetPlan(p).ok, JSON.stringify(p)).toBe(false);
  });

  it("未知键拒（严格对象）", () => {
    expect(parseAssetPlan(mutate((x) => { (x as any).extra = 1; })).ok).toBe(false);
    expect(parseAssetPlan(mutate((x) => { (x as any).assets[0]!.extra = 1; })).ok).toBe(false);
  });
});
