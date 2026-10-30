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
import { parseAssetPack, QA_JUDGEMENTS, QA_REPORT_FORMAT, QAReportSchema, buildDeliveryReport, type AssetPackManifest } from "@game-maker/contracts";
import {
  buildQaFailureDelivery, buildSiteFailureDelivery, buildSiteSuccessDelivery, deliverySummaryOf,
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

  it("缺 delivery ⇒ 拒绝（票 04：不再初始化交付结论）", () => {
    const out = tmp();
    const runDir = runDirOf(out);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(qaReport(), null, 2) + "\n"); // 无 delivery

    expect(() => writeVisualReviewToReport({ outRoot: out, runDir, review: { status: "fail", note: "参考风格对不上" } })).toThrow(/delivery/);
  });

  it("原子替换：写完后没有 .tmp 残留", () => {
    const out = tmp();
    const runDir = runDirOf(out);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(qaReport(), null, 2) + "\n");
    writeDeliveryToReport(runDir, buildSiteSuccessDelivery({
      outRoot: out, runDir, packDir: PACK, manifest: manifest(), configPath: configPathOf(out),
      siteVersion: 1, shellVersion: "2",
    }));

    writeVisualReviewToReport({ outRoot: out, runDir, review: { status: "pass" } });

    expect(fs.readdirSync(runDir).filter((f) => f.includes(".tmp"))).toEqual([]);
  });
});

describe("deliverySummaryOf（票 13 · FR-06，P1）", () => {
  it("delivery 缺席 → 明示「尚无交付结论」，不默认 pass", () => {
    const s = deliverySummaryOf(undefined);
    expect(s.summary[0]).toContain("尚无");
    expect(s.summary[0]).not.toContain("pass");
    expect(s.data.deliveryVerdict).toBeNull();
  });

  it("全 pass → verdict 行说 pass，无失败/未完成项", () => {
    const delivery = buildDeliveryReport({
      runId: "x/run/v1", pack: { packId: "x", packVersion: 1 }, config: { file: "x/c.json" },
      site: { version: 1, shell: "2" },
      checks: [
        { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" },
        { key: "qa", status: "pass" }, { key: "site", status: "pass" },
        { key: "playable-smoke", status: "pass" }, { key: "visual-review", status: "pass" },
      ],
      visualReview: { status: "pass", reviewer: "人" },
    });
    const s = deliverySummaryOf(delivery);
    expect(s.summary[0]).toContain("pass");
    expect(s.summary.join("\n")).not.toContain("未完成");
    expect(s.data.deliveryVerdict).toBe("pass");
  });

  it("试玩 UNKNOWN → verdict incomplete、试玩项标未完成、已知限制列出来", () => {
    const out = tmp();
    const delivery = buildSiteSuccessDelivery({
      outRoot: out, runDir: runDirOf(out), packDir: PACK, manifest: manifest(),
      configPath: configPathOf(out), siteVersion: 1, shellVersion: "2",
    });
    const s = deliverySummaryOf(delivery);
    expect(s.summary[0]).toContain("incomplete");
    expect(s.summary.join("\n")).toContain("试玩");
    expect(s.summary.join("\n")).toContain("视觉人工对照");
    expect(s.data.deliveryVerdict).toBe("incomplete");
  });

  it("QA 硬失败 → verdict fail、失败项与阻塞项分开列", () => {
    const out = tmp();
    const delivery = buildQaFailureDelivery({
      outRoot: out, runDir: runDirOf(out), packDir: PACK, manifest: manifest(),
      configPath: configPathOf(out), qaStatus: "fail",
    });
    const s = deliverySummaryOf(delivery);
    expect(s.summary[0]).toContain("fail");
    const joined = s.summary.join("\n");
    expect(joined).toContain("QA 六判据"); // 失败项
    expect(joined).toContain("被前置阻塞"); // 阻塞项
    expect(s.data.deliveryVerdict).toBe("fail");
  });
});

// ── FA-03 · FR-03 边界：CLI / MCP / 交付报告同一结论 ────────────────────────
//   CLI（cli.ts 的 create/build）与 MCP（server.ts 的 create）**都只经过 `deliverySummaryOf`**。
//   这里钉住「同一份 delivery，写盘读回后摘要结论 = 报告 verdict」，防止某一壳自己重算或漂移；
//   同时覆盖 §6.1 的「未知/未完成/不通过不能被读成通过」。
describe("FR-03 · CLI / MCP / 交付报告同一结论（FA-03）", () => {
  type Check = { key: string; status: string; detail?: string };
  const cases: Array<{
    verdict: string; checks: Check[];
    visualReview?: { status: string; reviewer?: string };
    site?: { version: number; shell: string };
  }> = [
    {
      verdict: "pass", site: { version: 1, shell: "2" }, visualReview: { status: "pass", reviewer: "人" },
      checks: [
        { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
        { key: "site", status: "pass" }, { key: "playable-smoke", status: "pass", detail: "SUCCESS" },
        { key: "visual-review", status: "pass" },
      ],
    },
    {
      verdict: "incomplete", site: { version: 1, shell: "2" },
      checks: [
        { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
        { key: "site", status: "pass" }, { key: "playable-smoke", status: "incomplete" },
        { key: "visual-review", status: "incomplete" },
      ],
    },
    {
      verdict: "fail", site: { version: 1, shell: "2" }, visualReview: { status: "fail" },
      checks: [
        { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
        { key: "site", status: "pass" }, { key: "playable-smoke", status: "pass", detail: "SUCCESS" },
        { key: "visual-review", status: "fail" },
      ],
    },
    {
      verdict: "blocked",
      checks: [
        { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
        { key: "site", status: "blocked" }, { key: "playable-smoke", status: "blocked" },
        { key: "visual-review", status: "incomplete" },
      ],
    },
  ];

  it("四种 verdict：写盘读回后，交付报告与终端摘要（CLI/MCP 共用）一致", () => {
    for (const c of cases) {
      const out = tmp();
      const runDir = runDirOf(out);
      fs.mkdirSync(runDir, { recursive: true });
      fs.writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(qaReport(), null, 2) + "\n");
      const delivery = buildDeliveryReport({
        runId: `${ID}/run/v1`, pack: { packId: ID, packVersion: 2 },
        config: { file: `${ID}/run/v1/game-config.json` },
        ...(c.site === undefined ? {} : { site: c.site as never }),
        checks: c.checks as never,
        ...(c.visualReview === undefined ? {} : { visualReview: c.visualReview as never }),
      });
      writeDeliveryToReport(runDir, delivery);

      const parsed = QAReportSchema.parse(JSON.parse(fs.readFileSync(path.join(runDir, "qa-report.json"), "utf8")));
      expect(parsed.delivery?.verdict).toBe(c.verdict);
      const s = deliverySummaryOf(parsed.delivery);
      expect(s.data.deliveryVerdict).toBe(parsed.delivery?.verdict);
      expect(s.summary[0]).toContain(c.verdict);
      // 非 pass 的结论行不得含「：pass」——「没查/没通过」不能被摘要读成通过。
      if (c.verdict !== "pass") expect(s.summary[0]).not.toContain("：pass");
    }
  });

  it("报告没有 delivery ⇒ 摘要明示「尚无」，不是 pass（旧报告不会被读成通过）", () => {
    const out = tmp();
    const runDir = runDirOf(out);
    fs.mkdirSync(runDir, { recursive: true });
    fs.writeFileSync(path.join(runDir, "qa-report.json"), JSON.stringify(qaReport(), null, 2) + "\n");
    const parsed = QAReportSchema.parse(JSON.parse(fs.readFileSync(path.join(runDir, "qa-report.json"), "utf8")));
    expect(parsed.delivery).toBeUndefined();
    const s = deliverySummaryOf(undefined);
    expect(s.data.deliveryVerdict).toBeNull();
    expect(s.summary[0]).not.toContain("pass");
  });
});
