// `run-design-attempts/v1` 的形状（票 55）—— 这一份只钉**封套**，不钉「谁写的、什么时候写的」。
//
// ⚠️ 三条最要紧的：
//   ① **`raw` 可以缺，但缺席与 `{}` 是两件事** —— 前者是「没有那个 `tool_use` 块」，
//      后者是「模型**真的**写了一个空对象」（票 27 实测的那一发）。伪造其中任何一个都是在毁证据。
//   ② **一份空容器在结构上不存在**（`attempts` 至少一条）—— 它正是「写与不写」那条判据的落地。
//   ③ **`.strict()`**：多一个键就解析不过 —— 诊断产物宁可炸，也不许悄悄长出新字段。
import { describe, expect, it } from "vitest";
import {
  DESIGN_ATTEMPTS_FILE, DESIGN_ATTEMPTS_FORMAT, DESIGN_ATTEMPT_OUTCOMES, parseDesignAttempts,
} from "../src/index.js";

const doc = (attempts: unknown[]) => ({ format: DESIGN_ATTEMPTS_FORMAT, attempts });

/** 一条 `schema` 那一发的形状。 */
const bad = { attempt: 1, outcome: "schema", detail: "工具入参不过契约：coreLoopSteps: 太短", raw: { format: "x" } };

describe("§`run-design-attempts/v1`：封套", () => {
  it("常量对得上（format 串与文件名各只有一处）", () => {
    expect(DESIGN_ATTEMPTS_FORMAT).toBe("run-design-attempts/v1");
    expect(DESIGN_ATTEMPTS_FILE).toBe("design-attempts.json");
  });

  it("五档下场与 `parseToolUse` 那四个 + R12 那一档一一对应（不做新词表）", () => {
    expect([...DESIGN_ATTEMPT_OUTCOMES]).toEqual(["truncated", "no-tool-use", "empty-input", "schema", "rejected"]);
  });

  it("读得回来：一份两发的容器（一档 `schema`、一档 `rejected` 带 `rejections`）", () => {
    const r = parseDesignAttempts(doc([
      bad,
      {
        attempt: 2, outcome: "rejected", detail: "这份设计做不出来（R12）。1 条理由：\n  · [camera-unsupported] …",
        rejections: [{ reason: "camera-unsupported", detail: "参考图是俯视的" }], raw: { format: "y" },
      },
    ]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.attempts.map((a) => a.attempt)).toEqual([1, 2]);
      expect(r.value.attempts[1]!.rejections![0]!.reason).toBe("camera-unsupported");
    }
  });
});

describe("§`raw`：可以缺 —— 而「缺席」与「`{}`」是**两件事**", () => {
  it("没有那个块 ⇒ `raw` 缺席（`no-tool-use`：那一发根本没有入参）", () => {
    const r = parseDesignAttempts(doc([{ attempt: 1, outcome: "no-tool-use", detail: "响应里没有那个 tool_use 块" }]));
    expect(r.ok).toBe(true);
    // ⚠️ 是**键不在**，不是「键在而是 undefined」—— 读的人靠这个分辨「没有」与「空」
    if (r.ok) expect("raw" in r.value.attempts[0]!).toBe(false);
  });

  it("⚠️ 而模型**真的**写了一个 `{}` ⇒ 原样存着（票 27 那一发是最值钱的证据，不许被「空」吞掉）", () => {
    const r = parseDesignAttempts(doc([{ attempt: 1, outcome: "empty-input", detail: "入参是空的或用不了（拿到 对象(0)）", raw: {} }]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect("raw" in r.value.attempts[0]!).toBe(true);
      expect(r.value.attempts[0]!.raw).toEqual({});
    }
  });

  it("`raw` 是**原样**的：非对象（字符串 / 数组 / null）也照收 —— 那是上游丢数据的样子", () => {
    for (const raw of ["{}", ["a"], null, 42]) {
      const r = parseDesignAttempts(doc([{ attempt: 1, outcome: "empty-input", detail: "d", raw }]));
      expect(r.ok, String(raw)).toBe(true);
    }
  });
});

describe("§空容器在结构上不存在 —— 它正是「写与不写」那条判据的落地（票 55 的 Q5）", () => {
  it("`attempts: []` ⇒ 解析不过（没有「拿到过入参」就不该有这份文件）", () => {
    const r = parseDesignAttempts(doc([]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("；")).toContain("attempts");
  });

  it("`attempt` 从 **1** 起（与账里的 `attempts` 同一套编号）", () => {
    expect(parseDesignAttempts(doc([{ ...bad, attempt: 0 }])).ok).toBe(false);
    expect(parseDesignAttempts(doc([{ ...bad, attempt: 1.5 }])).ok).toBe(false);
  });

  it("`rejections` 至少一条（它是「拒绝」那一档的**权威事实**，空数组等于没有理由）", () => {
    expect(parseDesignAttempts(doc([{ attempt: 1, outcome: "rejected", detail: "d", rejections: [] }])).ok).toBe(false);
  });
});

describe("§封口：多一个键、少一个键、换个 format 都不认", () => {
  const cases: [string, unknown][] = [
    ["format 不对", { format: "run-design-attempts/v2", attempts: [bad] }],
    ["多一个顶层键", { format: DESIGN_ATTEMPTS_FORMAT, attempts: [bad], extra: 1 }],
    ["某一发多一个键", doc([{ ...bad, tokens: 900 }])],
    ["`detail` 缺席", doc([{ attempt: 1, outcome: "schema" }])],
    ["`outcome` 不在闭集里", doc([{ attempt: 1, outcome: "timeout", detail: "d" }])],
    ["整份不是对象", "不是对象"],
  ];
  for (const [why, input] of cases)
    it(`${why} ⇒ 不认（parseXxx 回 errors 而不是抛）`, () => {
      const r = parseDesignAttempts(input);
      expect(r.ok, why).toBe(false);
      if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
    });
});
