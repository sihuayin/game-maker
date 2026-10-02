// V2 的**结构化调用**底座（票 28，由[票 27] 的 Q3(ii) + Q4(ii) 派生）。
//
// ⚠️ **这一层是纯的**：没有 fetch、没有重试、没有 fs。
//   理由是结构性的 —— `scripts/check-deps.mjs` 把「新包彼此不依赖、只依赖 `contracts`」
//   钉死了，所以共享的 **I/O** 根本没有地方放（放 `assets` 则 `vision` 够不着）。
//   而**真正容易写歪的是「形状」那一半**：十四块嵌套的 schema 手抄一遍必错，所以它进这里。
//   I/O 那一半（fetch / 重试 / 落账）**各包自理**。
//
// ⚠️ 决定的出处是 **R16（新）**（票 27 改写的字面），三条纪律照抄如下：
//   ① V2 新调用走 `tool_choice: {type:"tool", name}` **强制工具调用**。
//   ② **入参必须过 Zod 才算成功** —— `stop_reason === "tool_use"` **不是**成功信号。
//   ③ 重采样**固定次数**，它是**承重的不是保险**。
import { z } from "zod";
import { toJSONSchema, z as z4 } from "zod/v4";
// ⚠️ 复用**唯一那一份**格式化器，不为 v4 再抄一遍。
import { formatIssues } from "./zod-issues.js";

/**
 * R16（新）定的**重采样次数**：1 次首发 + 2 次重采样。
 *
 * ⚠️ 它是**地板，不是调优结果** —— 票 27 只量到 5 发（首发 80%），误差棒极宽。
 *   按那个数精调是自欺；等账上攒够了再说（账上现在**说得出**为什么重来，见 `failure`）。
 * ⚠️ **只此一份**：V2 那三张票（08/09/10）都从这里取，别各写各的 2 或 3。
 */
export const STRUCTURED_CALL_ATTEMPTS = 3;

/**
 * **一次上游调用为什么没成**的**闭集**（票 27 的 Q4(ii)）。
 *
 * ⚠️ **它存在的理由**：票 27 之前，`LedgerCall` 只记 `attempts`（次数），
 *   于是「代理不认工具」「模型能力不够」「被截断」「代理挂了」四种**完全不同的病因**
 *   混在同一个分母里 —— 而「率」这个数就没法读。
 *
 * ⚠️ **只在失败的那一笔上出现。缺席 == 不是失败**（与 `usage` 一条心：
 *   不许填一个占位值冒充「测到了」）。
 *
 * ⚠️ 有一条是票 27 探针**当场抓到的**：`empty-input`。见 `parseToolUse`。
 */
export const CALL_FAILURES = [
  "http",         // 上游回了非 2xx（含 body 不是 JSON）
  "timeout",      // 我们主动中止（本地超时）
  "truncated",    // stop_reason = max_tokens —— 截断，不是坏数据
  "invalid-json", // 回的不是合法 JSON（**纯文本那一路**的主要失败；工具那一路拿不到它）
  "no-tool-use",  // 响应里没有我们要的那个 tool_use 块 —— (a) 的死因：代理不认 tools
  "empty-input",  // tool_use 在，但 input 是空的 —— **上游把入参丢了**（票 27 第 1 发）
  "schema",       // input 是对象、但不合契约 —— 模型能力 / schema 太大
] as const;
export const CallFailure = z.enum(CALL_FAILURES);
export type CallFailure = z.infer<typeof CallFailure>;

/**
 * 任何 Zod schema 在**结构上**都满足它 —— v3 的 `ZodType` 算，v4 的也算。
 *
 * ⚠️ **故意不绑版本**：本仓库同时装着 v3（`zod`）与 v4（`zod/v4`）两套 API
 *   （见本文件末尾「为什么新契约用 `zod/v4`」），而调用方不该关心自己拿的是哪种。
 *   两者的 `safeParse` 返回的都是 `{success, data|error}`，`error.issues[]` 都有 `path`/`message`。
 */
export interface StructuredSchema<T> {
  safeParse(input: unknown): {
    success: true;
    data: T;
  } | {
    success: false;
    error: { issues: readonly { path: readonly PropertyKey[]; message: string }[] };
  };
}

const isRecord = (u: unknown): u is Record<string, unknown> =>
  typeof u === "object" && u !== null && !Array.isArray(u);

/** 一句话说清「拿到的是什么」—— 报错里没有这个，人只能猜。 */
const describe = (u: unknown): string =>
  u === null ? "null" : Array.isArray(u) ? `数组(${u.length})` : typeof u;

/** `parseToolUse` 只能产出这几种 —— 另三种（http / timeout / invalid-json）发生在**取 body 之前**。 */
export type ToolUseFailure = Extract<CallFailure, "truncated" | "no-tool-use" | "empty-input" | "schema">;

export type ToolUseOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; failure: ToolUseFailure; detail: string };

const fail = (failure: ToolUseFailure, detail: string): { ok: false; failure: ToolUseFailure; detail: string } =>
  ({ ok: false, failure, detail });

/**
 * 从一次 `/v1/messages` 的**已解析 body** 里取出工具入参，**并验证它**。
 *
 * ⚠️ **`stop_reason === "tool_use"` 不是成功信号，这个函数就是那条纪律的落点。**
 *   票 27 的第 1 发实测：`blocks = [tool_use]`、`stop_reason = "tool_use"`、
 *   上游**烧了 1135 个输出 token**，而 `input = {}` —— 代理把入参**丢了**。
 *   退出码、块类型、stop_reason 三项**看起来全部正常**。
 *   ⇒ 唯一算数的判据是**入参过 schema**。任何「先看看 stop_reason 再决定」的捷径都是错的。
 *
 * ⚠️ **不做 fetch、不看 HTTP 码**：那些是 I/O 那一半的事，它自己会填 `http` / `timeout`。
 *
 * ⚠️ **顺序有讲究**：先看截断，再找块。截断时缺块是**截断造成**的，
 *   报 `no-tool-use` 会把人引去查代理，而真正该做的是**加大 `max_tokens`**。
 */
export function parseToolUse<T>(body: unknown, toolName: string, schema: StructuredSchema<T>): ToolUseOutcome<T> {
  // ⚠️ **截断只用来「解释失败」，不许拿它推翻一次成功。** 顺序先「找块 → 验入参」，
  //   只在**没拿到可用入参**时才回头看 `stop_reason`。反过来的话，
  //   一份**完整合法**的入参会被判成失败 —— 而代价是丢掉一份好结果、再花一次钱重采样。
  //   R16 的判据只有一句：**过 Zod 才算成功**。
  const truncated = isRecord(body) && body["stop_reason"] === "max_tokens";
  const why = (fallback: string) =>
    truncated ? `${fallback}（⚠️ 而 stop_reason 是 max_tokens —— 更像是**被截断**的）` : fallback;

  if (!isRecord(body)) return fail("no-tool-use", `响应不是一个对象（拿到 ${describe(body)}）`);

  const blocks = Array.isArray(body["content"]) ? body["content"] : [];
  const block = blocks.find((b) => isRecord(b) && b["type"] === "tool_use" && b["name"] === toolName);
  const input = block === undefined ? undefined : (block as Record<string, unknown>)["input"];

  if (isRecord(input) && Object.keys(input).length > 0) {
    const r = schema.safeParse(input);
    if (r.success) return { ok: true, value: r.data };        // ← 唯一算数的判据
    return fail(truncated ? "truncated" : "schema",
      why(`工具入参不过契约：${formatIssues(r.error).slice(0, 4).join("；")}`));
  }

  if (truncated)
    return fail("truncated", "输出撞上了 max_tokens 被截断，而且没留下可用的入参（加大 max_tokens 再来）");

  if (block === undefined) {
    const seen = blocks.map((b) => (isRecord(b) ? String(b["type"]) : describe(b))).join(", ") || "（空）";
    return fail("no-tool-use",
      `响应里没有名为 "${toolName}" 的 tool_use 块（拿到的块：${seen}）。` +
      "⚠️ 这一档八成是**上游不认 tools / tool_choice**，不是模型写错了 —— 它是 (a) 这条路的死因。");
  }

  // ⚠️ `empty-input` 比字面**宽一档**：不只是「空对象」，而是「这一趟**没交出任何可用的入参**」——
  //   `{}`、`null`、字符串、数组都算。🎯 票 27 第 1 发实测的正是 `{}` 那个形状：
  //   上游烧了 1135 个输出 token，入参没了。**这不是模型不听话、也不是坏 JSON**，是数据丢了。
  return fail("empty-input",
    `工具被调了，但入参是空的或用不了（拿到 ${describe(input)}）—— ⚠️ 票 27 第 1 发实测过这一档：` +
    "上游烧了 1135 个输出 token，入参没了。**这不是模型不听话、也不是坏 JSON**，是数据丢了。");
}

// ── schema → tool 的 `input_schema` ──────────────────────────────────────────
//
// ⚠️ **为什么新契约用 `zod/v4` 而不是 `zod`**（票 28 落地时**当场更正**了一条前提）：
//   票面上写的是「装的 zod 是 3.25.76，包里带着 v4 实现，走 `zod/v4` 子路径就有内置的
//   `toJSONSchema()`」—— **后半句对 v3 的 schema 不成立**：`zod/v4` 的 `toJSONSchema`
//   只吃 v4 的 `$ZodType`，而 `import { z } from "zod"` 造出来的 v3 `ZodObject`
//   **连 `_zod` 都没有**，喂进去直接崩（`Cannot read properties of undefined (reading 'def')`）。
//   ⇒ 两条路：给 `contracts` 加一个第三方依赖（`zod-to-json-schema`），或者**新契约用 v4 写**。
//   选了后者 —— 票 27 的 Q2(i) 本来就定了**只有 V2 新调用**走这套协议，
//   而 V2 的契约（`visual-world` / `game-intent` / `game-design` / `runtime-profile` / `qa`）
//   **当时一个都还不存在**（零命中），所以那不是改存量，是定新增。
//   ⚠️ 2026-10-02：写这段话时列的五份已落了四份（`runtime-profile` 是票 05 落的）——
//     ⚠️ 它**不喂 `toolInputSchema`**：`RuntimeProfile` 是**外壳的事实**，模型从不产出它（票 05 Q10）。
//   **零新依赖**，且 zod 4 才是这条路的前方 —— 将来整体升 v4 时，这批契约不用再动一次。
//
// ⚠️ 于是 `contracts` 里**两套 zod API 并存**，边界是干净的：
//   **旧契约（`StyleSpec` / drawlist / assetpack / …）= `zod`；V2 新契约 = `zod/v4`。**
//   ⚠️ 真正的规矩不是「一个文件只许用一种」，而是 —— **两边的 schema 不许互相嵌套**
//   （v3 的 `z.array` 里塞一个 v4 的 schema 会炸）。**本文件正是一个正当的例外**：
//   它用 v3 造了 `CallFailure` 这个枚举（它要留给 v3 的 `ledger.ts` 用），
//   用 v4 只做**转换**（`toJSONSchema`）—— 两者从头到尾没有互相嵌套过。
//
// ⚠️ **用 `io: "input"`**：我们要描述的是**让模型填的东西**。差别是实打实的 ——
//   带 `.default()` 的字段在 output 侧**必填**（默认值已经落定），在 input 侧**可选**
//   （模型可以不写，我们这边再补）。schema 是给模型看的提示，写错了它就会照着错。
//
// ⚠️ **于是契约的对象必须用 `z.strictObject`**：`io: "input"` 下，普通的 `z.object`
//   **不会**产出 `additionalProperties: false`，而 `z.strictObject` 会 —— 实测：
//     z.object({…})        + io:input ⇒ 无 `additionalProperties`
//     z.strictObject({…})  + io:input ⇒ `additionalProperties: false` ✅
//   与旧契约的习惯是同一条：本仓库的 v3 契约（`LedgerCall` / `Ledger` / `AssetSpec` …）
//   **一律 `.strict()`**，新契约用 `z.strictObject` 只是把同一件事写成 v4 的样子。
//   ⇒ 「封口」是**契约作者**的表态，转换器**不替它表态**（替它猜，就会把
//     `materials` 那种**开集** `Record` 也封上 —— 那会直接把合法输出判成非法）。
//
// ⚠️ 这个形状**正是真 Anthropic 的 `strict: true` 要求的**，但**别指望它被实现**：
//   票 27 第 7 发实测代理**收下并静默忽略**不认识的参数。
//   ⇒ 这份 schema 的用处是**告诉模型要什么**，不是**强迫它给什么**；
//     而 `strict` 那一档**故意不提供**（见 `forcedTool`）。

/**
 * 把一份 `zod/v4` 契约转成 tool 的 `input_schema`。
 *
 * ⚠️ **只吃 v4 schema**（见上）。传 v3 的会在**这里**炸，而不是在上游返回坏数据时炸 ——
 *   这正是我们要的：**早失败、且失败得说得清**。
 */
export function toolInputSchema(schema: z4.ZodType): Record<string, unknown> {
  // ⚠️ 类型已经拦住了 v3 的 schema —— 但 `any` 拦不住，所以这一层**还在**：
  //   「早失败、且失败得说得清」比「上游回了坏数据再回头查」便宜得多。
  if (!isRecord(schema) || !("_zod" in schema))
    throw new Error(
      "toolInputSchema 只吃 `zod/v4` 造的 schema（v3 的没有 `_zod`）。" +
      "⚠️ 旧契约（`zod`）**不该**走到这里 —— 按 R16（新），只有 V2 新调用用工具协议。");
  // ⚠️ `io: "input"`：我们要描述的是**让模型填的东西**，不是我们吐出去的东西。
  //   （有 `.default()` 的字段在 output 侧是必填、在 input 侧可选 —— 模型看到的是后者。）
  const js = toJSONSchema(schema, { io: "input" }) as Record<string, unknown>;
  // ⚠️ 去掉顶层的 `$schema`：`input_schema` 是一个**片段**，不是一份独立的文档，
  //   而 `$schema` 是**文档级**关键字。留着多半没事，但它是**纯粹的噪音** ——
  //   而这个仓库对「上游静默忽略 / 上游静默报错」已经吃够了亏，少一个未知关键字算一个。
  const { $schema: _drop, ...rest } = js;
  return rest;
}

/**
 * 一次强制工具调用的 `tools` + `tool_choice`（R16 新字面钉的那两件）。
 *
 * ⚠️ **只此一份**：三张票各写一遍，就会有一张写成 `{type:"any"}`、一张忘了 `name`。
 *   `strict` 这一档**故意不提供** —— 依赖它就是在依赖一个代理静默忽略的参数（见上）。
 */
export function forcedTool(toolName: string, description: string, schema: z4.ZodType):
{ tools: Record<string, unknown>[]; tool_choice: { type: "tool"; name: string } } {
  return {
    tools: [{ name: toolName, description, input_schema: toolInputSchema(schema) }],
    tool_choice: { type: "tool", name: toolName },
  };
}
