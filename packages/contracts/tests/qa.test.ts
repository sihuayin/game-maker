// 票 06 给 `qa-report/v1` 立的判据。
//
//   每一条断言背后都有一个**被裁决过**的决定，不是顺手加的覆盖率。最要紧的五条：
//     §一个枚举两用 —— 「码的条数 = 判据的条数」在类型上**只有一份**（Q10）；
//        所以这里断的是「两处取的是同一个 enum」，不是「两张表恰好一样长」。
//     §`status` 不是一个字段（Q1）—— 判据阻断、观察只报，落实它的办法是**让
//        「通过」那个位置根本不存在**。变异检验：往报告里塞 `status` 必须**被拒**。
//     §`JudgementResult` 只有二态（Q21）—— 「成功」是**读出来的**（findings 空不空），
//        不是第三个变体，也不许在 `ran: true` 那一支里再放一个 `ok: boolean`。
//     §观察不许偷懒（Q9 / Q14）—— 每个来源**恰好一条**；`unavailable` 必须说为什么。
//        变异检验：把一条观察**删掉**，报告必须红（而不是静默地少一条）。
//     §`qaVerdict` 的三态（Q7）—— `incomplete` 的存在理由是**「没查」不许读成 `pass`**。
//        变异检验：把观察换成再难听的话，裁决必须**一个字母都不动**（R3 的底线）。
//
//   ⚠️ 这里**不**验六条判据各自的实现 —— 那住在三个地方：
//     `packages/contracts/tests/…`（色板 / 构造性约束 / 引用族）· `packages/qa/tests/…`（票 17/18/19）。
import { describe, expect, it } from "vitest";
import {
  OBSERVATION_SOURCES,
  QA_JUDGEMENTS,
  QA_JUDGEMENT_LABELS,
  QA_REPORT_FORMAT,
  QAReportSchema,
  buildQAReport,
  JudgementResultSchema,
  QAFailureSchema,
  ObservationSchema,
  qaVerdict,
  toolInputSchema
} from "../src/index.js";
import type { JudgementResult, Observation, QAJudgementResults } from "../src/index.js";

/** 六条全过。⚠️ 用 `Object.fromEntries` 是**故意的** —— 它让这个 fixture 跟着
 *  `QA_JUDGEMENTS` 走，而不是抄一份六项清单（抄一份就又是一处要对齐的东西）。 */
const allPass = (over: Partial<Record<string, JudgementResult>> = {}): QAJudgementResults =>
  Object.fromEntries(QA_JUDGEMENTS.map((j) => [j, over[j] ?? { ran: true, findings: [] }])) as QAJudgementResults;

const ranButNotChecked = (j: string): QAJudgementResults =>
  allPass({ [j]: { ran: false, reason: "这一条今天判不了" } });

/** 两条观察，两个来源各一条 —— Q14 要求的最小合法集合。 */
const OBSERVATIONS: Observation[] = [
  { source: "inspect", outcome: "ok", lines: ["色板 8 色 · 交付态实际用到的像素分布："] },
  { source: "review", outcome: "unavailable", reason: "没配视觉上游" }
];

/** ⚠️ **`format` 不在这里重复写**：`buildQAReport` 自己产出它（写在这里会被展开**盖掉**，
 *  `tsc` 的 TS2783 提醒的正是这件事）。「产出的 format 对不对」由下面那些 `safeParse`
 *  与 `{ ...report(), format: "1.0" }` 那条反例管 —— 不靠这一行摆样子。 */
const report = (results = allPass(), observations: unknown[] = OBSERVATIONS) =>
  buildQAReport(results, observations as Observation[]);

describe("§一个枚举两用：判据名只有一处（票 06 Q2 / Q10）", () => {
  it("`QA_JUDGEMENTS` 恰好六条 —— 判据表几条，这里就几个值", () => {
    expect(QA_JUDGEMENTS).toHaveLength(6);
    expect([...QA_JUDGEMENTS].sort()).toEqual([
      "constructive-constraint", "intent-coverage", "layer-coverage",
      "palette-binding", "reachability", "reference-resolution"
    ]);
  });

  it("⚠️ `checked` 与 `QAFailure.judgement` 取的是**同一个 enum**（不是两张恰好一样长的表）", () => {
    // 行为证据：同一个**非法**值，两处都得拒。若哪天有人另立一个镜像枚举，这一条会先红。
    expect(QAReportSchema.safeParse(report()).success).toBe(true);
    expect(QAReportSchema.safeParse({ ...report(), checked: ["style-similarity"] }).success).toBe(false);
    expect(QAFailureSchema.safeParse({ judgement: "style-similarity", target: "a", detail: "d", severity: "error" }).success).toBe(false);
  });

  it("`QA_JUDGEMENT_LABELS` 穷尽 —— 漏一个键是编译错误，多一个在这里红", () => {
    expect(Object.keys(QA_JUDGEMENT_LABELS).sort()).toEqual([...QA_JUDGEMENTS].sort());
    for (const j of QA_JUDGEMENTS) expect(QA_JUDGEMENT_LABELS[j].length).toBeGreaterThan(0);
  });
});

describe("§`JudgementResult` 只有**二态**，且「成功」不是一种状态（票 06 Q21）", () => {
  const parse = (u: unknown) => JudgementResultSchema.safeParse(u);

  it("两态：跑了（findings 空 = 成功）/ 没跑（带 reason）", () => {
    expect(parse({ ran: true, findings: [] }).success).toBe(true);
    expect(parse({ ran: true, findings: [{ target: "a", detail: "d", severity: "error" }] }).success).toBe(true);
    expect(parse({ ran: false, reason: "这一条今天判不了" }).success).toBe(true);
  });

  it("⚠️ **不许**在 `ran: true` 那一支里再放一个 `ok` —— 它是 `findings.length === 0` 的可派生副本", () => {
    expect(parse({ ran: true, findings: [], ok: true }).success).toBe(false);
    expect(parse({ ran: true, findings: [], status: "pass" }).success).toBe(false);
  });

  it("⚠️ **不许**三个变体 —— 第三态写不出来", () => {
    expect(parse({ ran: "partial", findings: [] }).success).toBe(false);
    expect(parse({ ran: true, state: "ok" }).success).toBe(false);
  });

  it("没跑就**必须**说为什么 —— 否则「没查」是一句无从追问的话", () => {
    expect(parse({ ran: false }).success).toBe(false);
    expect(parse({ ran: false, reason: "" }).success).toBe(false);
  });
});

describe("§`status` **不是一个字段**（票 06 Q1）—— 判据阻断、观察只报", () => {
  it("报告恰好是 `format` / `checked` / `failures` / `observations`", () => {
    expect(QAReportSchema.safeParse(report()).success).toBe(true);
  });

  it("⚠️ 变异：往报告里塞 `status` ⇒ **当场被拒**（这就是「没有能被写错的位置」）", () => {
    expect(QAReportSchema.safeParse({ ...report(), status: "pass" }).success).toBe(false);
  });

  it("⚠️ `repairAttempts` 与 `createdAt` 同样塞不进去（Q4 / Q11）", () => {
    expect(QAReportSchema.safeParse({ ...report(), repairAttempts: 2 }).success).toBe(false);
    expect(QAReportSchema.safeParse({ ...report(), createdAt: "2026-10-02T00:00:00Z" }).success).toBe(false);
  });

  it("`format` 是 literal，且不是裸对象（裸对象没地方放它）", () => {
    expect(QAReportSchema.safeParse({ ...report(), format: "1.0" }).success).toBe(false);
    expect(QAReportSchema.safeParse({ checked: [], failures: [], observations: [] }).success).toBe(false);
  });
});

describe("§装配侧的三个 refine（票 06 Q16(ii) / Q19）", () => {
  const base = () => report();
  const withFailure = (f: unknown, checked: readonly string[] = [...QA_JUDGEMENTS]) =>
    QAReportSchema.safeParse({ ...base(), checked, failures: [f] });

  it("**同一 `(judgement, target)` 不许重复** —— 重复条目会让同一个资源被派两次", () => {
    const f = { judgement: "layer-coverage", target: "bg.far", detail: "没画满", severity: "error" };
    expect(withFailure(f).success).toBe(true);
    expect(QAReportSchema.safeParse({ ...base(), failures: [f, { ...f, detail: "换了个说法" }] }).success).toBe(false);
    // 换一个 target 就合法 —— 这一条判据在**两个**目标上各失败一次，是真事
    expect(QAReportSchema.safeParse({ ...base(), failures: [f, { ...f, target: "bg.near" }] }).success).toBe(true);
  });

  it("**没跑过的判据产不出失败**", () => {
    const f = { judgement: "reachability", target: "game-config", detail: "终点不可达", severity: "error" };
    expect(withFailure(f).success).toBe(true);
    // 把 reachability 从 checked 里拿掉 ⇒ 那条失败立刻成了坏数据
    expect(QAReportSchema.safeParse({
      ...base(), checked: QA_JUDGEMENTS.filter((j) => j !== "reachability"), failures: [f]
    }).success).toBe(false);
  });

  it("`checked` 不许重复 —— 一条判据只跑得了一次", () => {
    expect(QAReportSchema.safeParse({ ...base(), checked: ["layer-coverage", "layer-coverage"] }).success).toBe(false);
  });

  it("失败是**封口**的：多一个键就拒", () => {
    expect(QAFailureSchema.safeParse({
      judgement: "layer-coverage", target: "bg", detail: "d", severity: "error", where: 'entity "x"'
    }).success).toBe(false); // ⚠️ `where` 那种人话进不来（Q8：target 复用账的词汇）
  });
});

describe("§观察不许偷懒（票 06 Q9 / Q14）", () => {
  it("每个来源**恰好一条** —— 少一条就红，而不是静默地空着", () => {
    expect(QAReportSchema.safeParse(report(allPass(), OBSERVATIONS)).success).toBe(true);
    // 变异：**删掉** review 那一条 ⇒ 必须红
    expect(QAReportSchema.safeParse(report(allPass(), [OBSERVATIONS[0]!])).success).toBe(false);
  });

  it("同一来源两条也红", () => {
    expect(QAReportSchema.safeParse(report(allPass(), [...OBSERVATIONS, OBSERVATIONS[0]!])).success).toBe(false);
  });

  it("⚠️ `unavailable` **必须**说为什么 —— 「没拿到」与「拿到了、没差异」不许长得一样", () => {
    expect(ObservationSchema.safeParse({ source: "review", outcome: "unavailable" }).success).toBe(false);
    expect(ObservationSchema.safeParse({ source: "review", outcome: "unavailable", reason: "", lines: [] }).success).toBe(false);
  });

  it("`ok` 不许带 reason（没理由可写）", () => {
    expect(QAReportSchema.safeParse(report(allPass(), [
      { source: "inspect", outcome: "ok", lines: ["x"], reason: "多余的" },
      OBSERVATIONS[1]!
    ])).success).toBe(false);
  });

  it("来源是**封闭**的 —— 第三个来源写不出来（加它 = 加一个枚举值）", () => {
    expect(OBSERVATION_SOURCES).toEqual(["inspect", "review"]);
    expect(ObservationSchema.safeParse({ source: "llm", outcome: "ok", lines: [] }).success).toBe(false);
  });
});

describe("§`qaVerdict` 的三态（票 06 Q7 / Q15）", () => {
  const parse = (u: unknown) => {
    const r = QAReportSchema.safeParse(u);
    if (!r.success) throw new Error("fixture 不过 schema：" + JSON.stringify(r.error.issues[0]));
    return qaVerdict(r.data);
  };
  const errorFinding = (j = "layer-coverage") => ({ judgement: j, target: "bg.far", detail: "没画满", severity: "error" });

  it("`pass`：六条全跑 + 一条 error 都没有", () => {
    expect(parse(report())).toBe("pass");
  });

  it("`fail`：有一条 error", () => {
    expect(parse({ ...report(), failures: [errorFinding()] })).toBe("fail");
  });

  it("⚠️ `warning` **不阻断** —— 「精确可算、但不构成判决」的那一档（Q6）", () => {
    expect(parse({ ...report(), failures: [{ ...errorFinding(), severity: "warning" }] })).toBe("pass");
  });

  it("⚠️ `incomplete`：没有 error，但**有判据没跑** —— 「没查」不许读成 `pass`", () => {
    expect(parse({ ...report(ranButNotChecked("reachability")) })).toBe("incomplete");
  });

  it("`fail` 赢过 `incomplete` —— 已知的阻断是可行动的，不会因为「还有一条没查」而消失", () => {
    expect(parse({ ...report(ranButNotChecked("reachability")), failures: [errorFinding("layer-coverage")] })).toBe("fail");
  });

  it("⚠️ 变异：**观察影响不了裁决** —— 把观察换成再难听的话，一个字母都不动（R3 的底线）", () => {
    const shouty = [
      { source: "inspect", outcome: "ok", lines: ["完全不像", "配色灾难", "重做吧"] },
      { source: "review", outcome: "ok", lines: ["一眼假", "和参考图毫无关系"] }
    ];
    expect(parse(report(allPass(), shouty))).toBe("pass");
  });
});

describe("§`buildQAReport` 是**投影**，不是第二份真相（票 06 Q13 / Q19）", () => {
  it("`checked` 只含**真跑过**的判据", () => {
    const r = buildQAReport(ranButNotChecked("reachability"), OBSERVATIONS);
    expect(r.checked).toHaveLength(5);
    expect(r.checked).not.toContain("reachability");
  });

  it("`findings` 里的 `judgement` 是**加上去的那个键** —— 产侧不必、也写不出它", () => {
    const r = buildQAReport(
      allPass({ "layer-coverage": { ran: true, findings: [{ target: "bg.far", detail: "没画满", severity: "error" }] } }),
      OBSERVATIONS
    );
    expect(r.failures).toEqual([
      { judgement: "layer-coverage", target: "bg.far", detail: "没画满", severity: "error" }
    ]);
  });

  it("装配出来的东西**过得了 schema**（含六条全过那一种）", () => {
    expect(QAReportSchema.safeParse(buildQAReport(allPass(), OBSERVATIONS)).success).toBe(true);
  });
});

describe("§它真的是 v4 契约（票 28 定的边界）", () => {
  it("`toolInputSchema` 转得动，且顶层 `$schema` 被摘掉", () => {
    const js = toolInputSchema(QAFailureSchema);
    expect(js["$schema"]).toBeUndefined();
    expect((js["properties"] as Record<string, unknown>)["judgement"]).toBeDefined();
  });

  it("封口真的落到了 JSON Schema 上（`additionalProperties: false`）", () => {
    const js = toolInputSchema(QAFailureSchema);
    expect(js["additionalProperties"]).toBe(false);
  });
});
