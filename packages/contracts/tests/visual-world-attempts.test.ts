// `run-visual-world-attempts/v1` 的形状（票 60）—— 这一份只钉**封套**，不钉「谁写的、什么时候写的」。
//
// ⚠️ 四件最要紧的：
//   ① **`raw` 可以缺，但缺席与 `{}` 是两件事** —— 前者是「没有那个 `tool_use` 块」，
//      后者是「模型**真的**写了一个空对象」（票 27 实测的那一发）。伪造其中任何一个都是在毁证据。
//   ② **一份空容器在结构上不存在**（`attempts` 至少一条）—— 它正是「这一圈有没有拿到过模型入参」那条判据的落地。
//   ③ **`response` 是必填的**（票 60 的 Q1c）：四个下场都发生在**取到 body 之后**，
//      所以「这一发换回来什么」**总写得出来**（最差也是一份两格都缺席的摘要 ⇒ 那就是「上游什么都没说」，
//      而不是「我们没记」—— 后者在结构上不可表示）。
//   ④ **`.strict()`**：多一个键就解析不过 —— 诊断产物宁可炸，也不许悄悄长出新字段。
import { describe, expect, it } from "vitest";
import {
  VISUAL_WORLD_ATTEMPTS_FILE, VISUAL_WORLD_ATTEMPTS_FORMAT, parseVisualWorldAttempts,
} from "../src/index.js";

const doc = (attempts: unknown[]) => ({ format: VISUAL_WORLD_ATTEMPTS_FORMAT, attempts });

/** 一条 `schema` 那一发的形状 —— 而 `raw` 写的正是**第十跑那件事**：顶层 `palette` 是个数组。 */
const bad = {
  attempt: 1, outcome: "schema", detail: "工具入参不过契约：palette: expected object, received array",
  raw: { format: "visual-world/v1", palette: ["#2e3b4e", "#4a6076"] },
  response: { stopReason: "tool_use", usage: { inputTokens: 1500, outputTokens: 2100 } },
};

describe("§`run-visual-world-attempts/v1`：封套", () => {
  it("常量对得上（format 串与文件名各只有一处）", () => {
    // ⚠️ **`run-` 前缀**：它是 run 级诊断 sidecar，而 `visual-world/v1` **已经被真产物占了**
    //   （票 60 的 Q1b 要求「以仓库既有命名规范核对」⇒ 核对出来的就是这个前缀）。
    expect(VISUAL_WORLD_ATTEMPTS_FORMAT).toBe("run-visual-world-attempts/v1");
    expect(VISUAL_WORLD_ATTEMPTS_FILE).toBe("visual-world-attempts.json");
  });

  it("四档下场与 `parseToolUse` 的 `ToolUseFailure` **同一批名字**（不另抄一份词表）", () => {
    // ⚠️ 而**没有** `rejected` —— 那一档是设计层专有的（R12：上游**成功**、只是结论被否），
    //   这一步到不了它 ⇒ 收进来就是发明一个到不了的值（票 60 的 §2.5 ④ / R7 的门）。
    for (const outcome of ["truncated", "no-tool-use", "empty-input", "schema"]) {
      const r = parseVisualWorldAttempts(doc([{ ...bad, outcome }]));
      expect(r.ok, outcome).toBe(true);
    }
    expect(parseVisualWorldAttempts(doc([{ ...bad, outcome: "rejected" }])).ok).toBe(false);
    // ⚠️ 上游失败（`http` / `timeout`）也**不在**闭集里：它发生在取到 body 之前、压根没有入参可留
    expect(parseVisualWorldAttempts(doc([{ ...bad, outcome: "timeout" }])).ok).toBe(false);
    expect(parseVisualWorldAttempts(doc([{ ...bad, outcome: "http" }])).ok).toBe(false);
  });

  it("读得回来：一份三发的容器（三发各自的 `raw` 与响应摘要都在）", () => {
    const r = parseVisualWorldAttempts(doc([
      bad,
      { ...bad, attempt: 2, raw: { format: "visual-world/v1", palette: [] } },
      { ...bad, attempt: 3, raw: { format: "visual-world/v1" } },
    ]));
    expect(r.ok, r.ok ? "" : r.errors.join("；")).toBe(true);
    if (!r.ok) return;
    expect(r.value.attempts.map((a) => a.attempt)).toEqual([1, 2, 3]);
    expect((r.value.attempts[0]!.raw as { palette: unknown[] }).palette).toEqual(["#2e3b4e", "#4a6076"]);
    expect(r.value.attempts[0]!.response.usage?.outputTokens).toBe(2100);
  });
});

describe("§`raw`：可以缺 —— 而「缺席」与「`{}`」是**两件事**", () => {
  it("没有那个块 ⇒ `raw` 缺席（`no-tool-use`：那一发根本没有入参）", () => {
    const r = parseVisualWorldAttempts(doc([
      { attempt: 1, outcome: "no-tool-use", detail: "响应里没有那个 tool_use 块", response: { stopReason: "tool_use" } },
    ]));
    expect(r.ok).toBe(true);
    // ⚠️ 是**键不在**，不是「键在而是 undefined」—— 读的人靠这个分辨「没有」与「空」
    if (r.ok) expect("raw" in r.value.attempts[0]!).toBe(false);
  });

  it("⚠️ 而模型**真的**写了一个 `{}` ⇒ 原样存着（票 27 那一发是最值钱的证据，不许被「空」吞掉）", () => {
    const r = parseVisualWorldAttempts(doc([
      { attempt: 1, outcome: "empty-input", detail: "入参是空的或用不了（拿到 对象(0)）", raw: {}, response: { usage: { outputTokens: 4430 } } },
    ]));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect("raw" in r.value.attempts[0]!).toBe(true);
      expect(r.value.attempts[0]!.raw).toEqual({});
    }
  });

  it("`raw` 是**原样**的：非对象（字符串 / 数组 / null）也照收 —— 那是上游丢数据的样子", () => {
    for (const raw of ["{}", ["a"], null, 42]) {
      const r = parseVisualWorldAttempts(doc([{ ...bad, raw }]));
      expect(r.ok, String(raw)).toBe(true);
    }
  });
});

describe("§`response` 是那一次往返的**摘要**（票 60 的 Q1c）—— 两格都缺席也收，那叫「上游什么都没说」", () => {
  it("两格都在 ⇒ 读得回来（判 H2 靠它：票 59 那条证据是从 `usage` 读出来的）", () => {
    const r = parseVisualWorldAttempts(doc([bad]));
    if (!r.ok) throw new Error(r.errors.join("；"));
    expect(r.value.attempts[0]!.response.stopReason).toBe("tool_use");
    expect(r.value.attempts[0]!.response.usage).toEqual({ inputTokens: 1500, outputTokens: 2100 });
  });

  it("两格都缺席**也收** —— 「上游没自报」与「我们没记」**是两件事**，后者在结构上不可表示", () => {
    const r = parseVisualWorldAttempts(doc([{ ...bad, response: {} }]));
    expect(r.ok).toBe(true);
  });

  it("⚠️ **整格不能缺**：`response` 不是可选的（缺了就等于「这一发换回来什么」没人记）", () => {
    const { response: _drop, ...noResponse } = bad;
    expect(parseVisualWorldAttempts(doc([noResponse])).ok).toBe(false);
  });

  it("摘要里**没有**别的东西：请求体 / 响应体 / headers 一个都不收（票 55 的 Q6(r1) 照旧）", () => {
    expect(parseVisualWorldAttempts(doc([{ ...bad, response: { ...bad.response, body: { content: [] } } }])).ok).toBe(false);
    expect(parseVisualWorldAttempts(doc([{ ...bad, response: { ...bad.response, headers: { "x-api-key": "k" } } }])).ok).toBe(false);
  });

  it("`usage` 的形状照账那一份（非负整数；上游没给就整个键缺席，不许填 0 冒充「测到了 0」）", () => {
    expect(parseVisualWorldAttempts(doc([{ ...bad, response: { usage: { outputTokens: -1 } } }])).ok).toBe(false);
    expect(parseVisualWorldAttempts(doc([{ ...bad, response: { usage: { outputTokens: 1.5 } } }])).ok).toBe(false);
    expect(parseVisualWorldAttempts(doc([{ ...bad, response: { usage: {} } }])).ok).toBe(true);
  });
});

describe("§空容器在结构上不存在 —— 它正是「写与不写」那条判据的落地（票 60 的 Q2）", () => {
  it("`attempts: []` ⇒ 解析不过（一个入参都没拿到就不该有这份文件）", () => {
    const r = parseVisualWorldAttempts(doc([]));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join("；")).toContain("attempts");
  });

  it("`attempt` 从 **1** 起（与账里的 `attempts` 同一套编号）", () => {
    expect(parseVisualWorldAttempts(doc([{ ...bad, attempt: 0 }])).ok).toBe(false);
    expect(parseVisualWorldAttempts(doc([{ ...bad, attempt: 1.5 }])).ok).toBe(false);
  });

  it("⚠️ **可以缺号**：上游死在半路那一发不在容器里 ⇒ `[1, 3]` 是合法的（它在账的 `failures[]` 里）", () => {
    const r = parseVisualWorldAttempts(doc([bad, { ...bad, attempt: 3 }]));
    expect(r.ok).toBe(true);
  });
});

describe("§封口：多一个键、少一个键、换个 format 都不认", () => {
  const cases: [string, unknown][] = [
    ["format 不对", { format: "run-visual-world-attempts/v2", attempts: [bad] }],
    ["⚠️ 用真产物那个 format", { format: "visual-world/v1", attempts: [bad] }],
    ["多一个顶层键", { format: VISUAL_WORLD_ATTEMPTS_FORMAT, attempts: [bad], extra: 1 }],
    ["某一发多一个键", doc([{ ...bad, tokens: 900 }])],
    ["`detail` 缺席", doc([{ attempt: 1, outcome: "schema", response: {} }])],
    ["整份不是对象", "不是对象"],
  ];
  for (const [why, input] of cases)
    it(`${why} ⇒ 不认（parseXxx 回 errors 而不是抛）`, () => {
      const r = parseVisualWorldAttempts(input);
      expect(r.ok, why).toBe(false);
      if (!r.ok) expect(r.errors.length).toBeGreaterThan(0);
    });
});
