// U3 / R3：门区半部的 API 与输入契约（U3-01）。
//
// ⚠️ 本票只断言 **API 形状、失败原因闭集、依赖边界与确定性**；门区几何（U3-02）、
//    全周期覆盖（U3-03）、判侧（U3-04）、forbiddenInjection（U3-05）与 D4 §11
//    反例（U3-06）在后续票补齐。
// ⚠️ 夹具全部内存构造（`playability-temporal-fixtures.ts`），不读文件系统、不新增
//    JSON fixture、不新增依赖。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { boxFromFoot } from "../src/playability/geometry.js";
import { buildMovementGraph } from "../src/playability/graph.js";
import {
  computePermanentGate,
  type PermanentGateHalf,
  type PermanentGateInput,
} from "../src/playability/temporal-gate.js";
import type { DegradationReason, PermanentGateProof } from "../src/playability/temporal-result.js";
import { aabb, witnessWorld } from "./playability-temporal-fixtures.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

const gateSource = (): string =>
  fs.readFileSync(path.join(ROOT, "packages/contracts/src/playability/temporal-gate.ts"), "utf8");

/** 默认输入：与 `witnessWorld()` 默认世界一致的显式几何（不解析 GameConfig）。 */
const input = (overrides: Partial<PermanentGateInput> = {}): PermanentGateInput => {
  const { config, manifest } = witnessWorld();
  const graph = buildMovementGraph(config, manifest);
  if (graph === null) throw new Error("fixture graph must build");
  return {
    motion: { at: { x: 50, y: 40 }, distance: 10, periodMs: 200 },
    hazard: { size: { w: 4, h: 12 }, anchor: { x: 0.5, y: 1 } },
    playerSize: { w: 2, h: 20 },
    spawnBox: boxFromFoot({ x: 5, y: 40 }, { w: 2, h: 20 }),
    goalRect: aabb(87, 20, 6, 20),
    graph,
    ...overrides,
  };
};

/** U3 允许的失败原因：D9 闭集的子集，不得新增原因码。 */
const U3_REASONS: readonly DegradationReason[] = ["no-permanent-gate", "geometry-untrusted"];

describe("U3-01 门区半部 API 契约", () => {
  it("输出形状固定为门区半部六字段", () => {
    const result = computePermanentGate(input());
    expect(Object.keys(result).sort()).toEqual([
      "forbiddenInjection",
      "gate",
      "gateStatus",
      "periodCoverage",
      "reason",
      "sideRule",
    ]);
  });

  it("骨架只返回 INCOMPLETE + no-permanent-gate，四个半部均为 null", () => {
    const result: PermanentGateHalf = computePermanentGate(input());
    expect(result.gateStatus).toBe("INCOMPLETE");
    expect(result.reason).toBe("no-permanent-gate");
    expect(result.gate).toBeNull();
    expect(result.periodCoverage).toBeNull();
    expect(result.sideRule).toBeNull();
    expect(result.forbiddenInjection).toBeNull();
  });

  it("失败原因只取 D9 闭集的 U3 两项", () => {
    const result = computePermanentGate(input());
    expect(result.reason).not.toBeNull();
    expect(U3_REASONS).toContain(result.reason);
  });

  it("门区半部可无损耗嵌入 D9 PermanentGateProof", () => {
    const result = computePermanentGate(input());
    const gate: PermanentGateProof["gate"] | null = result.gate;
    const period: PermanentGateProof["periodCoverage"] | null = result.periodCoverage;
    const side: PermanentGateProof["sideRule"] | null = result.sideRule;
    const injection: PermanentGateProof["forbiddenInjection"] | null = result.forbiddenInjection;
    expect([gate, period, side, injection]).toEqual([null, null, null, null]);
  });

  it("相同输入重复运行结果规范化相等（无随机 / 时间依赖）", () => {
    const first = JSON.stringify(computePermanentGate(input()));
    const second = JSON.stringify(computePermanentGate(input()));
    expect(second).toBe(first);
  });

  it("不生成 U4 字段（graphCut / hopDoubling / movementModelClosure）", () => {
    const keys = Object.keys(computePermanentGate(input()));
    for (const forbidden of ["graphCut", "hopDoubling", "hopSamplingCoverage", "movementModelClosure"]) {
      expect(keys).not.toContain(forbidden);
    }
  });
});

describe("U3-01 依赖与公共面边界", () => {
  it("temporal-gate.ts 不 import temporal.ts / temporal-witness.ts", () => {
    const source = gateSource();
    expect(source).not.toMatch(/from\s+["']\.\/temporal\.js["']/);
    expect(source).not.toMatch(/from\s+["']\.\/temporal-witness\.js["']/);
  });

  it("只 import D6 DAG 允许的下层模块", () => {
    const allowed = new Set([
      "./geometry.js",
      "./graph.js",
      "./temporal-motion.js",
      "./temporal-budget.js",
      "./temporal-result.js",
    ]);
    const specifiers = [...gateSource().matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
    expect(specifiers.length).toBeGreaterThan(0);
    for (const specifier of specifiers) expect(allowed.has(specifier as string), specifier).toBe(true);
  });

  it("不新增公共 barrel 导出", () => {
    for (const barrel of [
      "packages/contracts/src/playability/index.ts",
      "packages/contracts/src/index.ts",
    ]) {
      expect(fs.readFileSync(path.join(ROOT, barrel), "utf8"), barrel).not.toContain("temporal-gate");
    }
  });

  it("不新增 TEMPORAL_LAG_* 常量、不出现 Symbol(、无 analyze: 属性标签", () => {
    const source = gateSource();
    expect(source).not.toMatch(/TEMPORAL_LAG_/);
    expect(source).not.toContain("Symbol(");
    expect(source).not.toMatch(/analyze\s*:/);
  });

  it("导出符号全部标 @internal", () => {
    const lines = gateSource().split("\n");
    const exported = lines
      .map((line, index) => ({ line, index }))
      .filter(({ line }) => /^export (?:type|const|function) [A-Za-z_$]/.test(line))
      .map(({ line, index }) => ({ name: line.split(/\s+/)[2], index }));
    expect(exported.length).toBeGreaterThan(0);
    for (const { name, index } of exported) {
      const window = lines.slice(Math.max(0, index - 8), index).join("\n");
      expect(window, name).toContain("@internal");
    }
  });
});
