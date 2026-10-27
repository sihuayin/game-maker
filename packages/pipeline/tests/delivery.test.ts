// 票 08 给 `packages/pipeline/src/delivery.ts` 立的判据 —— 交付子对象怎么**装**、怎么**并进** qa-report.json。
//
//   ⚠️ 这一组**不跑上游、不花钱**：包用入库的真 fixture（只读），报告在临时目录里手写。
//     契约层面的（必需性/not-required 绕过/verdict 一致）由 `contracts/tests/delivery.test.ts` 盯；
//     这里盯的是**写盘**那一半：QA 硬失败提前落、站点成功/失败补写、收尾异常不覆盖。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { parseAssetPack, QA_JUDGEMENTS, QA_REPORT_FORMAT, type AssetPackManifest } from "@game-maker/contracts";
import {
  buildQaFailureDelivery, buildSiteFailureDelivery, buildSiteSuccessDelivery,
  tryWriteDelivery, writeDeliveryToReport, writeVisualReviewToReport,
} from "../src/delivery.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const ID = "last-train";

const dirs: string[] = [];
const tmp = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-delivery-"));
  dirs.push(d);
  return d;
};
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const manifest = (): AssetPackManifest => {
  const raw = JSON.parse(fs.readFileSync(path.join(PACK, "manifest.json"), "utf8")) as unknown;
  const parsed = parseAssetPack(raw);
  if (!parsed.ok) throw new Error("fixture 不过 schema：" + parsed.errors.join("；"));
  return parsed.value;
};

/** 一个规范 out 树里的 run 目录。 */
const runDirOf = (outRoot: string): string => path.join(outRoot, ID, "run", "v1");
const configPathOf = (outRoot: string): string => path.join(runDirOf(outRoot), "game-config.json");

/** 一份六条全跑的绿报告（QA 层）。 */
const qaReport = (): Record<string, unknown> => ({
  format: QA_REPORT_FORMAT,
  checked: [...QA_JUDGEMENTS],
  failures: [],
  observations: [
    { source: "inspect", outcome: "ok", lines: [] },
    { source: "review", outcome: "unavailable", reason: "测试：没配视觉上游" },
  ],
  subject: { packId: ID, packVersion: 2 },
});

const statusOf = (checks: readonly { key: string; status: string }[], key: string): string | undefined =>
  checks.find((c) => c.key === key)?.status;

describe("buildQaFailureDelivery（票 04 Q4：QA 硬失败提前落）", () => {
  it("QA fail → 下游 blocked、视觉 incomplete、最终 fail", () => {
    const out = tmp();
    const r = buildQaFailureDelivery({
      outRoot: out, runDir: runDirOf(out), packDir: PACK, manifest: manifest(),
      configPath: configPathOf(out), qaStatus: "fail",
    });
    expect(r.verdict).toBe("fail");
    expect(statusOf(r.checks, "qa")).toBe("fail");
    expect(statusOf(r.checks, "site")).toBe("blocked");
    expect(statusOf(r.checks, "playable-smoke")).toBe("blocked");
    expect(statusOf(r.checks, "visual-review")).toBe("incomplete");
    expect(r.site).toBeUndefined(); // 站点未装配，不伪造版本
  });

  it("QA incomplete → 下游 blocked、视觉 incomplete、最终 blocked（blocked > incomplete）", () => {
    const out = tmp();
    const r = buildQaFailureDelivery({
      outRoot: out, runDir: runDirOf(out), packDir: PACK, manifest: manifest(),
      configPath: configPathOf(out), qaStatus: "incomplete",
    });
    expect(r.verdict).toBe("blocked");
    expect(statusOf(r.checks, "qa")).toBe("incomplete");
  });
});

describe("buildSiteSuccessDelivery（票 04 Q3 阶段二）", () => {
  it("站点已装配 → site 版本 + 试玩/视觉仍 incomplete → 最终 incomplete", () => {
    const out = tmp();
    const r = buildSiteSuccessDelivery({
      outRoot: out, runDir: runDirOf(out), packDir: PACK, manifest: manifest(),
      configPath: configPathOf(out), siteVersion: 1, shellVersion: "2",
    });
    expect(r.site).toEqual({ version: 1, shell: "2" });
    expect(statusOf(r.checks, "site")).toBe("pass");
    expect(statusOf(r.checks, "playable-smoke")).toBe("incomplete"); // 票 09 才接
    expect(statusOf(r.checks, "visual-review")).toBe("incomplete"); // 票 10 才接
    expect(r.verdict).toBe("incomplete");
  });
});

describe("buildSiteFailureDelivery（票 04 Q4：站点确定性失败）", () => {
  it("站点 fail → 试玩 blocked、视觉 incomplete、最终 fail", () => {
    const out = tmp();
    const r = buildSiteFailureDelivery({
      outRoot: out, runDir: runDirOf(out), packDir: PACK, manifest: manifest(),
      configPath: configPathOf(out),
    });
    expect(r.verdict).toBe("fail");
    expect(statusOf(r.checks, "site")).toBe("fail");
    expect(statusOf(r.checks, "playable-smoke")).toBe("blocked");
    expect(r.site).toBeUndefined();
  });
});

describe("writeDeliveryToReport（并进 qa-report.json，不覆盖 QA 层）", () => {
  it("QA 层原样保留，只在顶层加 delivery", () => {
    const out = tmp();
    const runDir = runDirOf(out);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(qaReport(), null, 2) + "\n");

    const delivery = buildSiteSuccessDelivery({
      outRoot: out, runDir, packDir: PACK, manifest: manifest(), configPath: configPathOf(out),
      siteVersion: 3, shellVersion: "2",
    });
    writeDeliveryToReport(runDir, delivery);

    const raw = JSON.parse(fs.readFileSync(path.join(runDir, "qa-report.json"), "utf8")) as Record<string, unknown>;
    expect(raw.format).toBe(QA_REPORT_FORMAT); // QA 层 format 还在
    expect(raw.checked).toEqual([...QA_JUDGEMENTS]); // QA 层 checked 原样
    expect(raw.observations).toHaveLength(2); // QA 层观察原样
    expect((raw.delivery as Record<string, unknown>).verdict).toBe("incomplete");
    expect((raw.delivery as Record<string, unknown>).site).toEqual({ version: 3, shell: "2" });
  });

  it("报告缺 delivery 也读得回、并得进（旧报告兼容）", () => {
    const out = tmp();
    const runDir = runDirOf(out);
    fs.mkdirSync(runDir, { recursive: true });
    const old = qaReport(); // 无 delivery 的旧报告
    fs.writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(old, null, 2) + "\n");

    writeDeliveryToReport(runDir, buildQaFailureDelivery({
      outRoot: out, runDir, packDir: PACK, manifest: manifest(), configPath: configPathOf(out), qaStatus: "fail",
    }));
    const raw = JSON.parse(fs.readFileSync(path.join(runDir, "qa-report.json"), "utf8")) as Record<string, unknown>;
    expect((raw.delivery as Record<string, unknown>).verdict).toBe("fail");
  });
});

describe("tryWriteDelivery（收尾异常不覆盖原始失败）", () => {
  it("报告不存在 → 返回 false，不抛、不伪造", () => {
    const out = tmp();
    const runDir = runDirOf(out);
    fs.mkdirSync(runDir, { recursive: true }); // 有 runDir 但没有 qa-report.json
    const delivery = buildSiteSuccessDelivery({
      outRoot: out, runDir, packDir: PACK, manifest: manifest(), configPath: configPathOf(out),
      siteVersion: 1, shellVersion: "2",
    });
    expect(tryWriteDelivery(runDir, delivery)).toBe(false);
    expect(fs.existsSync(path.join(runDir, "qa-report.json"))).toBe(false); // 没写出东西
  });

  it("报告在 → 返回 true", () => {
    const out = tmp();
    const runDir = runDirOf(out);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(qaReport(), null, 2) + "\n");
    const delivery = buildSiteSuccessDelivery({
      outRoot: out, runDir, packDir: PACK, manifest: manifest(), configPath: configPathOf(out),
      siteVersion: 1, shellVersion: "2",
    });
    expect(tryWriteDelivery(runDir, delivery)).toBe(true);
  });
});

describe("writeVisualReviewToReport（票 10：视觉评审写回）", () => {
  it("已有 delivery：只动视觉评审三处，QA 层与其余字段原样", () => {
    const out = tmp();
    const runDir = runDirOf(out);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(qaReport(), null, 2) + "\n");
    // 先落一份站点成功 delivery（site=pass、smoke/visual=incomplete、verdict=incomplete）
    writeDeliveryToReport(runDir, buildSiteSuccessDelivery({
      outRoot: out, runDir, packDir: PACK, manifest: manifest(), configPath: configPathOf(out),
      siteVersion: 1, shellVersion: "2",
    }));

    writeVisualReviewToReport({ outRoot: out, runDir, review: { status: "pass", reviewer: "人", reviewedAt: "2026-10-27T00:00:00.000Z" } });

    const raw = JSON.parse(fs.readFileSync(path.join(runDir, "qa-report.json"), "utf8")) as Record<string, unknown>;
    expect(raw.format).toBe(QA_REPORT_FORMAT); // QA 层还在
    expect(raw.checked).toEqual([...QA_JUDGEMENTS]); // QA 层 checked 原样
    const d = raw.delivery as Record<string, unknown>;
    expect((d.visualReview as Record<string, unknown>).status).toBe("pass");
    expect((d.checks as Array<Record<string, unknown>>).find((c) => c.key === "visual-review")!.status).toBe("pass");
    // smoke 仍 incomplete ⇒ 最终结论仍是 incomplete（视觉通过 ≠ 试玩做完）
    expect(d.verdict).toBe("incomplete");
    expect(d.site).toEqual({ version: 1, shell: "2" }); // 站点身份没动
  });

  it("缺 delivery：初始化一份（不伪造站点版本），QA 层保留", () => {
    const out = tmp();
    const runDir = runDirOf(out);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(qaReport(), null, 2) + "\n"); // 无 delivery

    writeVisualReviewToReport({ outRoot: out, runDir, review: { status: "fail", note: "参考风格对不上" } });

    const raw = JSON.parse(fs.readFileSync(path.join(runDir, "qa-report.json"), "utf8")) as Record<string, unknown>;
    const d = raw.delivery as Record<string, unknown>;
    expect(d).toBeDefined();
    expect((d.visualReview as Record<string, unknown>).status).toBe("fail");
    expect(d.site).toBeUndefined(); // 不伪造站点版本
    expect((d.checks as Array<Record<string, unknown>>).find((c) => c.key === "site")!.status).toBe("incomplete");
    expect((d.checks as Array<Record<string, unknown>>).find((c) => c.key === "visual-review")!.status).toBe("fail");
    expect(d.verdict).toBe("fail"); // 视觉明确不通过 = fail
  });

  it("报告没有 subject → 拒绝（无法初始化）", () => {
    const out = tmp();
    const runDir = runDirOf(out);
    fs.mkdirSync(runDir, { recursive: true });
    const noSubject = qaReport();
    delete noSubject.subject;
    fs.writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(noSubject, null, 2) + "\n");

    expect(() => writeVisualReviewToReport({ outRoot: out, runDir, review: { status: "pass" } })).toThrow();
  });

  it("原子替换：写完后没有 .tmp 残留", () => {
    const out = tmp();
    const runDir = runDirOf(out);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(qaReport(), null, 2) + "\n");

    writeVisualReviewToReport({ outRoot: out, runDir, review: { status: "pass" } });

    expect(fs.readdirSync(runDir).filter((f) => f.includes(".tmp"))).toEqual([]);
  });
});
