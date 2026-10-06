import { describe, expect, it } from "vitest";
import { z as z3 } from "zod";
import { z as z4 } from "zod/v4";
import {
  CALL_FAILURES, CallFailure, LedgerStep, UPSTREAM_TIMEOUT_MS, forcedTool, parseLedger, parseToolUse, toolInputSchema,
} from "../src/index.js";

/** 一份**像 V2 契约那样**的 schema —— 嵌套对象、枚举、可选字段、开集 `Record` 一个不少。 */
const Spec = z4.strictObject({
  schemaVersion: z4.string(),
  camera: z4.strictObject({
    mode: z4.enum(["side", "top-down", "isometric", "first-person", "other"]),
    angle: z4.number().optional(),
  }),
  palette: z4.strictObject({ primary: z4.array(z4.string()) }),
  // ⚠️ **开集**：这是 `Record`，不是带固定键的对象 —— 它**不该**被封口。
  materials: z4.record(z4.string(), z4.strictObject({ appearance: z4.string(), color: z4.array(z4.string()).optional() })),
  confidence: z4.number().min(0).max(1),
});

/** 一份能过 `Spec` 的最小合法值。 */
const GOOD = {
  schemaVersion: "1", camera: { mode: "side" },
  palette: { primary: ["#112233"] }, materials: { brick: { appearance: "哑光" } }, confidence: 0.8,
};

/** 上游的回应体长这样（Anthropic 的 messages 形状）—— 只有 `content` 与 `stop_reason` 是我们要的。 */
const body = (content: unknown[], stopReason = "tool_use") => ({ content, stop_reason: stopReason });
const toolBlock = (input: unknown, name = "emit_spec") => ({ type: "tool_use", name, input });

describe("⚠️ `stop_reason === \"tool_use\"` **不是**成功信号（票 27 第 1 发）", () => {
  it("工具被调了、`stop_reason` 也对，而 `input` 是**空对象** ⇒ 必须报失败", () => {
    // ⚠️ **这是本文件最要紧的一条**，因为它是真跑里抓到的：票 27 的七发探针里有一发
    //   回来的是 `blocks = [tool_use]` · `stop_reason = "tool_use"` · **`input = {}`**，
    //   而**上游烧掉了 1135 个输出 token**。代理把入参丢了 —— 静默的数据丢失，
    //   三项「看起来正常」的信号全是绿的。**唯一算数的判据是入参过 schema。**
    const r = parseToolUse(body([toolBlock({})]), "emit_spec", Spec);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.failure).toBe("empty-input");
    expect(r.detail).toContain("入参是空的或用不了");
  });

  it("`input` 不是对象（上游丢数据丢得更彻底）也是 `empty-input`", () => {
    for (const junk of [null, undefined, "{}", 42, ["a"]]) {
      const r = parseToolUse(body([toolBlock(junk)]), "emit_spec", Spec);
      expect(r.ok, `${String(junk)} 不该被当成成功`).toBe(false);
      if (!r.ok) expect(r.failure).toBe("empty-input");
    }
  });

  it("`input` 是对象、但**不过 schema** ⇒ `schema`（与「丢数据」分开记）", () => {
    const r = parseToolUse(body([toolBlock({ schemaVersion: "1" })]), "emit_spec", Spec);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure).toBe("schema");
      expect(r.detail).toContain("camera");   // 报错要能定位
    }
  });

  it("入参**过 schema** 才是成功 —— 而成功时原样交出解析后的值", () => {
    const r = parseToolUse(body([toolBlock(GOOD)]), "emit_spec", Spec);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual(GOOD);
  });
});

describe("`parseToolUse` 的其余四档", () => {
  it("没有那个块 ⇒ `no-tool-use`（(a) 这条路的死因：上游不认 `tool_choice`）", () => {
    const r = parseToolUse(body([{ type: "text", text: "抱歉，我不能…" }], "end_turn"), "emit_spec", Spec);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure).toBe("no-tool-use");
      expect(r.detail).toContain("上游不认 tools");   // 报错要指向**最可能的病因**
    }
  });

  it("块在、**名字不对** ⇒ 也是 `no-tool-use`（不许拿别人的入参凑数）", () => {
    const r = parseToolUse(body([toolBlock(GOOD, "别的工具")]), "emit_spec", Spec);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("no-tool-use");
  });

  it("⚠️ **过 Zod 就是成功** —— `stop_reason = max_tokens` **不许**推翻一份完整合法的入参", () => {
    // ⚠️ 反过来的话（先看 `stop_reason` 再验入参）会有两重代价：一份**好结果被丢掉重来**（多花一次钱），
    //   而被截断的产出又会被报成「模型吐了坏数据」（把人引去查模型）。R16 的判据只有一句：过 Zod。
    const r = parseToolUse(body([toolBlock(GOOD)], "max_tokens"), "emit_spec", Spec);
    expect(r.ok, "入参完整合法 ⇒ 成功，哪怕 stop_reason 是 max_tokens").toBe(true);
  });

  it("⚠️ **截断优先于缺块**：`stop_reason = max_tokens` 时该去加预算，不是去查代理", () => {
    // 两件事同时成立时，报 `no-tool-use` 会把人**引错方向** —— 缺块是截断造成的。
    const r = parseToolUse(body([], "max_tokens"), "emit_spec", Spec);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure).toBe("truncated");
      expect(r.detail).toContain("max_tokens");
    }
  });

  it("body 根本不是对象 ⇒ `no-tool-use`，且报错说得出拿到的是什么", () => {
    const r = parseToolUse("这不是 JSON 对象", "emit_spec", Spec);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.failure).toBe("no-tool-use");
      expect(r.detail).toContain("string");
    }
  });

  it("content 缺席 ⇒ 不该炸，报 `no-tool-use`", () => {
    const r = parseToolUse({ stop_reason: "end_turn" }, "emit_spec", Spec);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.failure).toBe("no-tool-use");
  });
});

describe("`toolInputSchema`：Zod → tool 的 `input_schema`", () => {
  it("产出**真 Anthropic 的 `strict` 要的形状**：每个对象都 `additionalProperties: false`", () => {
    const js = toolInputSchema(Spec);
    expect(js["type"]).toBe("object");
    expect(js["additionalProperties"]).toBe(false);
    // 必填只有那五个真必填的；`camera.angle` 是可选，不许进 `required`。
    expect(js["required"]).toEqual(["schemaVersion", "camera", "palette", "materials", "confidence"]);
    const camera = (js["properties"] as Record<string, Record<string, unknown>>)["camera"]!;
    expect(camera["additionalProperties"]).toBe(false);
    expect(camera["required"]).toEqual(["mode"]);
  });

  it("枚举、开集 `Record`、数组都翻得对", () => {
    const props = toolInputSchema(Spec)["properties"] as Record<string, Record<string, unknown>>;
    expect((props["camera"]!["properties"] as Record<string, Record<string, unknown>>)["mode"]!["enum"])
      .toEqual(["side", "top-down", "isometric", "first-person", "other"]);
    // ⚠️ `materials` 是 `Record<string, …>` —— **开集**。它的 `additionalProperties` 是**值的 schema**，
    //   不是 `false`：这一块**结构上**就满足不了 `strict`（票 27 记过这条）。
    expect(props["materials"]!["additionalProperties"]).toMatchObject({ type: "object" });
    expect(props["palette"]!["properties"]).toMatchObject({ primary: { type: "array" } });
  });

  it("⚠️ **封口是契约作者的表态**：普通 `z.object` **不**产出 `additionalProperties: false`", () => {
    // ⚠️ 这是给**契约作者**看的钉子：V2 契约要封口就得写 `z.strictObject`。
    //   转换器**不替它猜** —— 猜就会把 `materials` 那种开集 `Record` 也封上，
    //   而那会把一份合法输出**直接判成非法**（票 27 记过：开集与 `additionalProperties: false`
    //   是矛盾的）。本仓库的 v3 契约一律 `.strict()`，新契约用 `z.strictObject` 是同一件事。
    const loose = z4.object({ a: z4.string() });
    expect(toolInputSchema(loose)["additionalProperties"]).toBeUndefined();
    expect(toolInputSchema(z4.strictObject({ a: z4.string() }))["additionalProperties"]).toBe(false);
  });

  it("⚠️ 带 `.default()` 的字段在 `input` 侧**可选** —— 那是 `io: input` 的全部意义", () => {
    const js = toolInputSchema(z4.strictObject({ a: z4.string(), b: z4.string().default("x") }));
    expect(js["required"]).toEqual(["a"]);
    expect((js["properties"] as Record<string, unknown>)["b"]).toMatchObject({ default: "x" });
  });

  it("⚠️ 顶层 `$schema` 被摘掉了 —— `input_schema` 是**片段**不是文档", () => {
    expect(toolInputSchema(Spec)["$schema"]).toBeUndefined();
  });

  it("⚠️ **喂 v3 的 schema 当场炸**，而不是等上游回了坏数据再回头查", () => {
    // ⚠️ 票 28 落地时**当场更正**了票面的一条前提：`zod/v4` 的 `toJSONSchema` **不吃 v3 的 schema**
    //   （v3 的 `ZodObject` 连 `_zod` 都没有）。这是**故意的**：新契约用 `zod/v4` 写，旧契约不碰。
    const v3 = z3.object({ a: z3.string() });
    expect(() => toolInputSchema(v3 as never)).toThrow(/zod\/v4/);
  });
});

describe("`forcedTool`：R16（新）钉的那两件只此一份", () => {
  it("`tools` + `tool_choice` 是**强制**那条路，且 `tool_choice` 点名同一个工具", () => {
    const t = forcedTool("emit_spec", "产出规格", Spec);
    expect(t.tool_choice).toEqual({ type: "tool", name: "emit_spec" });
    expect(t.tools).toHaveLength(1);
    expect(t.tools[0]!["name"]).toBe("emit_spec");
    expect(t.tools[0]!["input_schema"]).toEqual(toolInputSchema(Spec));
  });

  it("⚠️ **不带 `strict`** —— 依赖它就是在依赖一个代理静默忽略的参数（票 27 第 7 发）", () => {
    expect(forcedTool("emit_spec", "产出规格", Spec).tools[0]).not.toHaveProperty("strict");
  });
});

describe("账上的 `failure`：闭集、可缺席、不许现编", () => {
  const call = (over: Record<string, unknown> = {}) => ({
    step: "derive", target: "recipe", attempts: 1, ...over,
  });
  const ledger = (c: unknown) => ({
    format: "assetpack-ledger/v1", packId: "p", packVersion: 1,
    createdAt: new Date(0).toISOString(), run: { wallClockMs: 1, byStep: {} }, calls: [c],
  });

  it("`failures` 缺席 ⇒ 通过（「一次都没失败」，与 `usage` 一条心）", () => {
    expect(parseLedger(ledger(call())).ok).toBe(true);
  });

  it("闭集里的**每一个**值都收 —— 枚举与 `CallFailure` 是同一份", () => {
    for (const f of CALL_FAILURES) {
      expect(parseLedger(ledger(call({ failures: [f] }))).ok, f).toBe(true);
    }
    expect(CALL_FAILURES).toHaveLength(7);
  });

  it("⚠️ 闭集外的值**当场拒收** —— 否则「率」的四个分母会悄悄漂成五个", () => {
    expect(parseLedger(ledger(call({ failures: ["不知道"] }))).ok).toBe(false);
  });

  it("⚠️ **空数组也拒收**：`failures: []` 是「测到了 0 次失败」的冒充 —— 缺席才是那个意思", () => {
    expect(parseLedger(ledger(call({ failures: [] }))).ok).toBe(false);
  });

  it("⚠️ **一次调用里的每一次失败各占一格、按发生顺序** —— 这是数组而不是单值的全部意义", () => {
    const r = parseLedger(ledger(call({ attempts: 3, failures: ["truncated", "empty-input", "schema"] })));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.calls[0]!.failures).toEqual(["truncated", "empty-input", "schema"]);
  });

  it("`compile-game` 是合法的 `step`（票 28 补的 —— 它一直是「不交账」的真正原因）", () => {
    expect(parseLedger(ledger(call({ step: "compile-game", target: "game-config" }))).ok).toBe(true);
  });

  it("`CallFailure` 枚举与 `CALL_FAILURES` 是**同一份**（没有手抄第二遍）", () => {
    expect(CallFailure.options).toEqual([...CALL_FAILURES]);
  });
});

describe("票 08 搬进来的那个超时常量与那个新的账目档位", () => {
  it("`UPSTREAM_TIMEOUT_MS` 现在住这里 —— 因为 `vision` 只许依赖 `contracts`（R2-Q3）", () => {
    // ⚠️ 搬家的理由不是整洁，是**够不着**：`vision` 够不着 `assets`，而「全仓只有这一个数」
    //   这条纪律一旦有个包够不着它，就会**静默地**变成「有两个数」。
    expect(UPSTREAM_TIMEOUT_MS).toBe(180_000);
  });

  // ⚠️ 「`assets` 那边是原样再导出」这条断言住在 `packages/assets/tests/generate.test.ts` ——
  //   **不在这里**：`contracts` 的测试去 import `assets` 的源码是**越层**，
  //   而 `tsconfig.spec.json` 的 `rootDir` 会当场把它抓出来（第一版就是那么写的，13 条 TS6059）。
  it('`LedgerStep` 认得 `"analyze-reference"` —— 枚举里没有那个值，账上就是**隐形**的', () => {
    // ⚠️ 与 `compile-game` 同一条教训：那次它「不交账」的真正原因不是谁忘了写一行，
    //   是**枚举里根本没有那个值**。理解层的第一个调用不该再犯一次。
    expect(LedgerStep.options).toContain("analyze-reference");
  });

  // ⚠️ **每加一次调用就加一条**（票 09 补理解层第二发）。这一条看着同义反复，但它守着一件事：
  //   枚举值被谁删掉时**测试会红** —— 否则只有 `tsc` 拦得住（`spentCall("…")` 的字面量对不上
  //   `LedgerStep` 会在编译期报 TS2345），而**变异判据跑的是 vitest、不是 tsc** ⇒
  //   「删掉枚举值」这一发在变异里会静默通过（票 09 实吃了一口，见 `experiments/intent-mutations/`）。
  it('`LedgerStep` 认得 `"analyze-intent"` —— 理解层的第二发同理', () => {
    expect(LedgerStep.options).toContain("analyze-intent");
  });

  it('`LedgerStep` 认得 `"compile-design"` —— 理解层的收尾那一发同理', () => {
    // ⚠️ 每加一次调用就加一条（票 09 立的规矩）：枚举值光靠 `tsc` 守着不够，
    //   因为变异判据跑的是 vitest、不是 tsc。
    expect(LedgerStep.options).toContain("compile-design");
  });

  it('`LedgerStep` 认得 `"plan-assets"`，而 `"derive"` **不被删掉**（历史账还要能解析）', () => {
    expect(LedgerStep.options).toContain("plan-assets");
    // ⚠️ `derive` 是**只能出现在历史文件里**的那个值 —— 删它，磁盘上已有的 `ledger.json` 当场读不出来。
    expect(LedgerStep.options).toContain("derive");
  });

  it('`LedgerStep` 认得 `"compile-runtime"`，而 `"compile-game"` 同样不被删', () => {
    expect(LedgerStep.options).toContain("compile-runtime");
    expect(LedgerStep.options).toContain("compile-game");
  });
});
