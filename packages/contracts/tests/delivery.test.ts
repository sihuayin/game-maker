// 票 03 给 `delivery.ts` 立的判据 —— 最终交付状态是**确定性计算**，不是顺手打的布尔。
//
//   最要紧的是**总序优先**：`fail > blocked > incomplete > pass`。它保证：
//     §确定性失败永远赢（票 03 Q2）—— 已知的阻断是**可行动的**，不能因为别处
//       「还没查」就把一次失败洗成 incomplete。
//     §生成失败 = fail（不是 blocked）—— 上游不可达就是失败，下游检查可以 blocked，
//       但最终仍 fail（§6 场景 L）。
//     §「没查」不许读成 pass —— incomplete 的存在理由是「没查必须有名字」（§6 F/G/H）。
//     §not-required 不参与 —— 但它不能出现在必需检查上，那是非法状态、抛错。
//
//   §6 矩阵十二场景（A–L）一条一条映射在下面。
import { describe, expect, it } from "vitest";
import {
  buildDeliveryReport, DELIVERY_CHECK_KEYS, DELIVERY_CHECK_LABELS, DELIVERY_REQUIRED_CHECKS,
  DeliveryReportSchema, deriveDeliveryVerdict,
} from "../src/delivery.js";
import type { DeliveryCheck, DeliveryCheckKey, DeliveryCheckStatus } from "../src/delivery.js";
import { QA_JUDGEMENTS, QA_REPORT_FORMAT, QAReportSchema } from "../src/qa.js";

/** 一个必需检查项。 */
const req = (status: DeliveryCheckStatus) => ({ status, required: true });
/** 一个非必需检查项。 */
const opt = (status: DeliveryCheckStatus) => ({ status, required: false });

describe("§6 矩阵十二场景（A–L）", () => {
  it("A 全部强制检查通过 + 视觉通过 → pass", () => {
    expect(deriveDeliveryVerdict([req("pass"), req("pass"), req("pass")])).toBe("pass");
  });

  it("B 资源校验失败 → fail", () => {
    expect(deriveDeliveryVerdict([req("fail"), req("pass")])).toBe("fail");
  });

  it("C 配置编译失败 → fail", () => {
    expect(deriveDeliveryVerdict([req("pass"), req("fail")])).toBe("fail");
  });

  it("D 强制 QA 失败 → fail", () => {
    expect(deriveDeliveryVerdict([req("fail")])).toBe("fail");
  });

  it("E 站点构建失败 → fail", () => {
    expect(deriveDeliveryVerdict([req("pass"), req("fail")])).toBe("fail");
  });

  it("F 试玩未完成、原因未知 → incomplete", () => {
    expect(deriveDeliveryVerdict([req("pass"), req("incomplete")])).toBe("incomplete");
  });

  it("G 试玩未完成、有试玩器限制证据 → incomplete（不冒充通过）", () => {
    expect(deriveDeliveryVerdict([req("pass"), req("incomplete")])).toBe("incomplete");
  });

  it("H 试玩通过、视觉待确认 → incomplete", () => {
    expect(deriveDeliveryVerdict([req("pass"), req("incomplete")])).toBe("incomplete");
  });

  it("I 视觉明确不通过 → fail", () => {
    expect(deriveDeliveryVerdict([req("pass"), req("fail")])).toBe("fail");
  });

  it("J 新产物无匹配报告（缺该版本有效验收证据）→ incomplete", () => {
    expect(deriveDeliveryVerdict([req("incomplete")])).toBe("incomplete");
  });

  it("K 必需检查结果缺失且原因不明 → incomplete", () => {
    expect(deriveDeliveryVerdict([req("incomplete")])).toBe("incomplete");
  });

  it("L 前置阶段失败、后续检查无法执行 → fail（下游 blocked 但最终 fail）", () => {
    // 生成失败是 fail；下游（站点/试玩/视觉）因前置失败无法执行 = blocked。fail 赢过 blocked。
    expect(deriveDeliveryVerdict([req("fail"), req("blocked"), req("blocked")])).toBe("fail");
  });
});

describe("总序优先 fail > blocked > incomplete > pass", () => {
  it("fail 赢过 blocked / incomplete / pass", () => {
    expect(deriveDeliveryVerdict([req("pass"), req("incomplete"), req("blocked"), req("fail")])).toBe("fail");
  });

  it("blocked 赢过 incomplete / pass（没有 fail 时）", () => {
    expect(deriveDeliveryVerdict([req("pass"), req("incomplete"), req("blocked")])).toBe("blocked");
  });

  it("incomplete 赢过 pass（没有 fail / blocked 时）", () => {
    expect(deriveDeliveryVerdict([req("pass"), req("incomplete")])).toBe("incomplete");
  });

  it("全 pass 才是 pass", () => {
    expect(deriveDeliveryVerdict([req("pass"), req("pass")])).toBe("pass");
  });
});

describe("not-required 不参与最终状态", () => {
  it("非必需检查项标 fail 也不拉黑整个交付", () => {
    // 非必需的检查项本就不要求，标 fail 不该影响最终状态（票 03 Q1 语义）。
    expect(deriveDeliveryVerdict([req("pass"), opt("fail")])).toBe("pass");
  });

  it("非必需检查项标 not-required 不参与计算", () => {
    expect(deriveDeliveryVerdict([req("pass"), opt("not-required")])).toBe("pass");
  });

  it("必需检查项标 not-required 是非法状态 → 抛错（不是静默 pass）", () => {
    // 「必需」与「不要求」自相矛盾。契约校验（票 08 schema）会先拒绝；这里是兜底，不许假绿。
    expect(() => deriveDeliveryVerdict([req("not-required")])).toThrow();
  });
});

// ── 票 08：检查项注册表 + `delivery` 报告本体 ───────────────────────────────
describe("检查项注册表（票 08）", () => {
  it("六个 key、全部必需 —— 缺一个都到不了 pass", () => {
    expect(DELIVERY_CHECK_KEYS).toHaveLength(6);
    expect([...DELIVERY_REQUIRED_CHECKS]).toEqual([...DELIVERY_CHECK_KEYS]);
  });

  it("`DELIVERY_CHECK_LABELS` 穷尽 —— 漏一个键是编译错误", () => {
    expect(Object.keys(DELIVERY_CHECK_LABELS).sort()).toEqual([...DELIVERY_CHECK_KEYS].sort());
  });
});

describe("DeliveryReportSchema（票 08）", () => {
  /** 六项检查；`over` 覆盖单个 key 的 status。 */
  const checks = (over: Partial<Record<DeliveryCheckKey, DeliveryCheckStatus>> = {}): DeliveryCheck[] => {
    const base: Record<DeliveryCheckKey, DeliveryCheckStatus> = {
      "asset-pack": "pass", "config": "pass", "qa": "pass",
      "site": "pass", "playable-smoke": "pass", "visual-review": "pass",
    };
    return DELIVERY_CHECK_KEYS.map((k) => ({ key: k, status: over[k] ?? base[k] }));
  };

  const delivery = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
    runId: "last-train/run/v1",
    pack: { packId: "last-train", packVersion: 1 },
    config: { file: "last-train/run/v1/game-config.json" },
    site: { version: 1, shell: "2" },
    checks: checks(),
    verdict: "pass",
    visualReview: { status: "pass" },
    evidence: [],
    ...over,
  });

  it("六项全过 + 视觉通过 + 站点已装配 → pass", () => {
    expect(DeliveryReportSchema.safeParse(delivery()).success).toBe(true);
  });

  it("站点未生成：site 省略 + site 检查项 blocked → 仍合法（不伪造版本）", () => {
    const d = delivery();
    delete d.site;
    d.checks = checks({ site: "blocked", "playable-smoke": "blocked", "visual-review": "incomplete" });
    d.verdict = "blocked";
    expect(DeliveryReportSchema.safeParse(d).success).toBe(true);
  });

  it("必需检查项缺失 → 拒", () => {
    const d = delivery();
    d.checks = checks().filter((c) => c.key !== "qa");
    expect(DeliveryReportSchema.safeParse(d).success).toBe(false);
  });

  it("必需检查项标 not-required → 拒（不隐式绕过）", () => {
    const d = delivery();
    d.checks = checks({ qa: "not-required" });
    expect(DeliveryReportSchema.safeParse(d).success).toBe(false);
  });

  it("verdict 与检查项不一致 → 拒（确定性）", () => {
    expect(DeliveryReportSchema.safeParse(delivery({ verdict: "fail" })).success).toBe(false);
  });

  it("site 字段与 site 检查项不一致 → 拒（有版本却记未通过 / 记通过却没版本）", () => {
    expect(DeliveryReportSchema.safeParse(delivery({ checks: checks({ site: "fail" }) })).success).toBe(false);
    const noSite = delivery();
    delete noSite.site; // site 检查项仍 pass 却没版本
    expect(DeliveryReportSchema.safeParse(noSite).success).toBe(false);
  });
});

describe("buildDeliveryReport（票 08）", () => {
  it("verdict 是算出来的，不是调用方打的", () => {
    const r = buildDeliveryReport({
      runId: "x/run/v1", pack: { packId: "x", packVersion: 1 }, config: { file: "x/run/v1/c.json" },
      site: { version: 1, shell: "2" },
      checks: [
        { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" },
        { key: "qa", status: "pass" }, { key: "site", status: "pass" },
        { key: "playable-smoke", status: "incomplete" }, { key: "visual-review", status: "incomplete" },
      ],
    });
    expect(r.verdict).toBe("incomplete");
    expect(r.visualReview.status).toBe("pending"); // 默认 pending（票 10）
  });

  it("必需检查项缺失 → 抛错（写之前拒绝，不落假绿）", () => {
    expect(() => buildDeliveryReport({
      runId: "x/run/v1", pack: { packId: "x", packVersion: 1 }, config: { file: "x" },
      checks: [{ key: "qa", status: "pass" }],
    })).toThrow();
  });
});

describe("qa-report/v1 兼容旧报告（票 08）", () => {
  const oldReport = (): Record<string, unknown> => ({
    format: QA_REPORT_FORMAT,
    checked: [...QA_JUDGEMENTS],
    failures: [],
    observations: [
      { source: "inspect", outcome: "ok", lines: [] },
      { source: "review", outcome: "unavailable", reason: "测试" },
    ],
  });

  it("无 delivery 仍解析（向后兼容）", () => {
    expect(QAReportSchema.safeParse(oldReport()).success).toBe(true);
  });

  it("带 delivery 也解析；delivery 缺席 ≠ 交付通过", () => {
    const validDelivery: Record<string, unknown> = {
      runId: "last-train/run/v1",
      pack: { packId: "last-train", packVersion: 1 },
      config: { file: "last-train/run/v1/game-config.json" },
      site: { version: 1, shell: "2" },
      checks: [
        { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" },
        { key: "qa", status: "pass" }, { key: "site", status: "pass" },
        { key: "playable-smoke", status: "pass" }, { key: "visual-review", status: "pass" },
      ],
      verdict: "pass",
      visualReview: { status: "pass" },
      evidence: [],
    };
    const parsed = QAReportSchema.safeParse({ ...oldReport(), delivery: validDelivery });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.delivery?.verdict).toBe("pass");
    expect(oldReport()).not.toHaveProperty("delivery");
  });
});
