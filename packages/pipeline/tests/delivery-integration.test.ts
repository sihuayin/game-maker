// 票 11 给「跨阶段报告关联」立的集成判据（§8.2）—— 报告不是单点，是**链上串起来**的。
//
//   ⚠️ 这一组**不付费、不跑真生图**：上游/生图都用 `upstream.ts` 的假响应，产物只落临时 out 树。
//     单点判据（`buildSiteFailureDelivery` / `mapPlaytest` / `writeVisualReviewToReport` 各自）由
//     `delivery.test.ts` / `playtest.test.ts` / `review-verdict.test.ts` 盯；这里盯的是**跨阶段**那几条：
//     QA 硬失败 → delivery 落盘 · build → site → 视觉一路串下来的 verdict · 试玩检查项怎么并进 delivery。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildDeliveryReport, mapPlaytest } from "@game-maker/contracts";
import {
  buildSiteFailureDelivery, buildSiteSuccessDelivery, runBuild, runUnderstanding,
  writeDeliveryToReport, writeVisualReviewToReport,
} from "../src/index.js";
import { CANNED, fakeUpstream, tinyPng } from "./upstream.js";

const dirs: string[] = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-delivery-int-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

function harness(over: { override?: Record<string, unknown> } = {}) {
  const cwd = tmp();
  fs.writeFileSync(path.join(cwd, "style.png"), tinyPng());
  return {
    cwd,
    outRoot: path.join(cwd, "out"),
    fetchImpl: fakeUpstream({ recipeId: "wasteland", ...(over.override !== undefined ? { override: over.override } : {}) }),
  };
}
const TRANSPORT = { baseUrl: "http://up.test", apiKey: "k" };
const IMAGE = { protocol: "gemini" as const, baseUrl: "http://up.test", apiKey: "k" };
const understand = (h: ReturnType<typeof harness>) =>
  runUnderstanding({
    outRoot: h.outRoot, requirement: "做一个废土横版寻宝游戏",
    styleReferences: [{ path: "style.png" }], transport: TRANSPORT, fetchImpl: h.fetchImpl, cwd: h.cwd, imageTransport: IMAGE,
  });
const build = (h: ReturnType<typeof harness>, runDir: string) =>
  runBuild({ outRoot: h.outRoot, runDir, transport: TRANSPORT, fetchImpl: h.fetchImpl, imageTransport: IMAGE });

const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
const runPath = (h: ReturnType<typeof harness>, ...rest: string[]) => path.join(h.outRoot, "wasteland", "run", "v1", ...rest);
const statusOf = (checks: readonly { key: string; status: string }[], key: string): string | undefined =>
  checks.find((c) => c.key === key)?.status;

/** 让 QA 真响一次：把拾取物摆到跳不到的高处 ⇒ `reachability` 报 error（与 create-game.test.ts 同一现场）。 */
function unreachableHarness() {
  const config = structuredClone(CANNED.gameConfig) as { entities: { id: string; at: { x: number; y: number } }[] };
  config.entities.find((e) => e.id === "e-pickup-1")!.at = { x: 120, y: 60 };
  return harness({ override: { emit_game_config: config } });
}

describe("QA 硬失败 → delivery 提前落盘（票 08 接线 · §8.2 跨阶段）", () => {
  it("真链上响一次 reachability：报告先落盘，且 delivery 记 qa=fail、下游 blocked、最终 fail", async () => {
    const h = unreachableHarness();
    const u = await understand(h);
    await expect(build(h, u.run.dir)).rejects.toMatchObject({ kind: "invalid" });

    const raw = readJson(runPath(h, "qa-report.json"));
    const delivery = raw["delivery"] as Record<string, unknown>;
    expect(delivery).toBeDefined(); // QA 硬失败**提前**写 delivery，不等站点（它根本跑不到）
    const checks = delivery["checks"] as { key: string; status: string }[];
    expect(statusOf(checks, "asset-pack")).toBe("pass"); // 包/配置已过
    expect(statusOf(checks, "config")).toBe("pass");
    expect(statusOf(checks, "qa")).toBe("fail");
    expect(statusOf(checks, "site")).toBe("blocked");
    expect(statusOf(checks, "playable-smoke")).toBe("blocked");
    expect(statusOf(checks, "visual-review")).toBe("incomplete"); // 视觉未评审 ≠ 前置阻塞
    expect(delivery["verdict"]).toBe("fail");
    expect(delivery["site"]).toBeUndefined(); // 不伪造站点版本
    expect((raw["subject"] as Record<string, unknown>)["packId"]).toBe("wasteland"); // QA 层身份还在
  });
});

describe("build → site → 视觉 一路串下来的 verdict（§8.2 跨阶段）", () => {
  it("站点成功（试玩/视觉 incomplete）→ 视觉 pass → 最终仍是 incomplete（试玩没做完）", async () => {
    const h = harness();
    const u = await understand(h);
    const built = await build(h, u.run.dir);

    // ── 阶段二：site 装配成功 → 补写 delivery（试玩/视觉尚未做）
    writeDeliveryToReport(built.runDir, buildSiteSuccessDelivery({
      outRoot: h.outRoot, runDir: built.runDir, packDir: built.paths.packDir,
      manifest: built.manifest, configPath: built.paths.config,
      siteVersion: built.packVersion, shellVersion: "2",
    }));
    let raw = readJson(runPath(h, "qa-report.json"));
    let d = raw["delivery"] as Record<string, unknown>;
    expect(d["site"]).toEqual({ version: 1, shell: "2" });
    expect(d["verdict"]).toBe("incomplete");

    // ── 视觉评审 pass → 视觉检查项 pass、但试玩仍 incomplete ⇒ verdict 仍 incomplete
    writeVisualReviewToReport({ outRoot: h.outRoot, runDir: built.runDir, review: { status: "pass", reviewer: "人" } });
    raw = readJson(runPath(h, "qa-report.json"));
    d = raw["delivery"] as Record<string, unknown>;
    expect(statusOf(d["checks"] as { key: string; status: string }[], "visual-review")).toBe("pass");
    expect((d["visualReview"] as Record<string, unknown>)["status"]).toBe("pass");
    expect(d["verdict"]).toBe("incomplete"); // 视觉通过 ≠ 试玩做完，不冒充交付通过
  });
});

describe("站点确定性失败 → delivery（票 04 Q4 · §8.2 跨阶段）", () => {
  it("site fail、试玩 blocked、最终 fail，且不伪造站点版本", async () => {
    const h = harness();
    const u = await understand(h);
    const built = await build(h, u.run.dir);

    writeDeliveryToReport(built.runDir, buildSiteFailureDelivery({
      outRoot: h.outRoot, runDir: built.runDir, packDir: built.paths.packDir,
      manifest: built.manifest, configPath: built.paths.config,
    }));
    const d = readJson(runPath(h, "qa-report.json"))["delivery"] as Record<string, unknown>;
    const checks = d["checks"] as { key: string; status: string }[];
    expect(statusOf(checks, "site")).toBe("fail");
    expect(statusOf(checks, "playable-smoke")).toBe("blocked");
    expect(d["verdict"]).toBe("fail");
    expect(d["site"]).toBeUndefined();
  });
});

describe("试玩检查项并进 delivery（票 09/06 · §8.2 跨阶段）", () => {
  it("mapPlaytest(UNKNOWN) → incomplete+UNKNOWN，并进 delivery 后 verdict 归 incomplete", () => {
    const mapped = mapPlaytest({
      execution: "executed", aggregate: "UNKNOWN",
      scenarios: [{ scenarioId: "playable", required: true, execution: "executed", outcome: "UNKNOWN" }],
    });
    expect(mapped).toEqual({ status: "incomplete", detail: "UNKNOWN" });

    // 把 mapped 的 status/detail **原样**并进一份「其余全过、只有试玩未完成」的 delivery。
    const delivery = buildDeliveryReport({
      runId: "wasteland/run/v1", pack: { packId: "wasteland", packVersion: 1 }, config: { file: "wasteland/run/v1/game-config.json" },
      site: { version: 1, shell: "2" },
      checks: [
        { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" },
        { key: "qa", status: "pass" }, { key: "site", status: "pass" },
        { key: "playable-smoke", status: mapped.status, detail: mapped.detail },
        { key: "visual-review", status: "pass" },
      ],
      visualReview: { status: "pass" },
    });
    expect(delivery.verdict).toBe("incomplete"); // 试玩 UNKNOWN ⇒ 不冒充交付通过
    expect(delivery.checks.find((c) => c.key === "playable-smoke")!.detail).toBe("UNKNOWN");
  });
});
