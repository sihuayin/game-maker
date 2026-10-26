// 票 08 的落点：**参考图 + 需求文本 → `VisualWorldSpec`**。整条 V2 链的**最前端**。
//
// 决定住 `../../../.scratch/game-maker-v2/issues/08-vision-analyze-reference.md`。
//
// ⚠️ **本包的 I/O 是自己写的**，没有复用 `packages/assets` 的 `callText` / `onceThrough` / `spentCall`
//   —— 那三个都住在 `assets`，而 `check-deps.mjs` 只许 `vision` 依赖 `contracts`（R11）。
//   这是**结构性**的：共享的 I/O 根本没有地方放（放 `assets` 则 `vision` 够不着，
//   放 `contracts` 则那一层不再「纯」）。所以下面有一份同形的 `spentCall`，
//   而**形状**那一半（`forcedTool` / `parseToolUse` / 失败闭集）确实是从 `contracts` 取来的。
//
// ⚠️ **为什么这一步要看图 + 需求文本两样**（票 08 的 R1-Q1）：`palette` 是[[绘制词汇]]，
//   **不是画面分布的摘要** —— 它的判据是「画不画得出这个世界里的东西」，
//   而**要画的东西有一部分压根不在参考图里**（`halt-dusk.png` 的 provenance 白纸黑字：
//   它「故意不包含牛/拖拉机/谷仓」，而 Destination 验收第 2 条要考的正是这个）。
//   一个只见过参考图的模型挑不出「画得出牛的那几个色」。
//   ⚠️ 喂的是**原始需求文本**、**不是** `GameIntentSpec` 的产物 ⇒ 两步仍然**并列**，不引入次序。
import fs from "node:fs";
import path from "node:path";
import {
  STRUCTURED_CALL_ATTEMPTS, STYLE_MEDIA_TYPES, UPSTREAM_TIMEOUT_MS, VISUAL_WORLD_ATTEMPTS_FORMAT, VisualWorldSpecSchema,
  buildTextRequest, carryOnError, formatIssues, parseTextResponse, textModelOf, textUsageOf,
  type CallFailure, type LedgerCall, type LedgerStep, type LedgerUsage, type StyleReference,
  type TextImagePart, type TextTransport, type ToolUseFailure,
  type VisualWorldAttempt, type VisualWorldAttempts, type VisualWorldResponseSummary, type VisualWorldSpec,
} from "@game-maker/contracts";
import { buildVisualWorld } from "./build-visual-world.js";
import { TOOL_DESCRIPTION, TOOL_NAME, visionPrompt } from "./prompts.js";
import { applyDeterministicPalette, extractPalette, PALETTE_SIZE, type PaletteSource } from "./palette.js";

/** 输出上限。⚠️ 票 08 的八发实测 **1742–2156 token**（内嵌 `style` 子树把票 27 的 1135–1660 顶上去了）。
 *  这是**上限不是分配**，给足不花钱；而**截断**会把一次本来会成功的调用变成 `truncated` 重采样。 */
const MAX_TOKENS = 16_000;

// ⚠️ **媒体类型白名单已提到 `contracts`**（2026-10-16 · [票 78](../../../.scratch/game-maker-v2/issues/78-reviewpack-wiring.md)）：
//   两个包要用同一份（`vision` 喂 `analyze-reference` · `assets` 喂 `reviewPack`），
//   而 R11 说新包彼此不依赖 ⇒ 只有 `contracts` 放得下。**内容一字未改**，只是搬了个家。

/** 模型面向的 schema = 契约 **减掉**调用方注入的那一个键（票 08 的 R1-Q2）。
 *  ⚠️ `.omit()` 会**丢掉**顶层那条越界 `superRefine`（v4 实测）—— 那是**预期的**：
 *    gate 本来就拦不住模型（`toJSONSchema` 同样丢掉它），它拦的是 `buildVisualWorld` 装配出来的**成品**。 */
const ModelFacingSpec = VisualWorldSpecSchema.omit({ styleReferences: true });

export type AnalyzeReferenceInput = {
  /** 调用方给的参考图登记。第一阶段恰好 1 项（R18 的 `maxItems` 由**调用方**执行，不写进 schema）。 */
  styleReferences: StyleReference[];
  /** 原始需求文本（R1-Q1）。**必填** —— 人肉基线说「一定要给」。 */
  requirementText: string;
  /** 风格身份（R2-Q2：参考图 basename 的 slug，由 CLI 生成）。提示词递给模型照抄，这里**强制覆盖**。 */
  styleId: string;
  /**
   * `styleReferences[].path` **相对谁解析**（默认 `process.cwd()`）。
   *
   * ⚠️ 2026-10-07（票 15）加上它：那几条相对路径是**调用方给的**，而「相对谁」是个真问题 ——
   *   CLI 从哪儿跑就是哪；而 pipeline 里的 `createGame` 可能带着一个**别的**工作目录。
   *   ⚠️ 形状是仓库现成的规矩（R5）：**环境由壳读、core 只收结构体** ——
   *   与 `resolveImageTransport({env, cwd})` 同款，**不**让这一层去读全局状态。
   */
  cwd?: string;
  transport: TextTransport;
  /**
   * 参考图的**已解码像素**（第一阶段恰好一张）。
   *
   * ⚠️ 给了 ⇒ 模型成功后，`style.palette` 按它**确定性替换**，六个桶 / `materials.*.color`
   *   里的 `palette:N` 按「旧色最近的新色」改写（票 04）。不给 ⇒ 保持模型色板（旧行为，
   *   直接调用本文件的测试与手工路径走这一支）。
   * ⚠️ 解码不在这里做：`vision` 只许依赖 `contracts`，PNG 解码器在 `assets`（调用方递）。
   */
  referencePixels?: PaletteSource;
  /** 测试可注入（`review.ts` 同款用法）。 */
  fetchImpl?: typeof fetch;
  /** 一次上游调用的超时。默认 [[UPSTREAM_TIMEOUT_MS]] —— ⚠️ 测「超时」那条路时才传小的。 */
  timeoutMs?: number;
};

export type AnalyzeReferenceResult = {
  /** 已注入 `styleReferences`、已覆盖 `style.id`、并**重新过了一次契约**的成品。 */
  spec: VisualWorldSpec;
  /** **一次调用 = 一格**（`attempts` 累加、`failures[]` 留原因）。⚠️ 没上路就**缺席**（不填占位值）。 */
  ledger?: LedgerCall[];
};

/**
 * 这一步失败**带着病因**。⚠️ **三发全败也要把账带出来** —— 那正是 `failures[]` 存在的理由
 * （票 27 的 Q4(ii)：只记「最后失败的那次」时，`empty-input` 那种「没被看见就过去了」的病因
 * **一次都不会出现**）。
 */
export class AnalyzeReferenceError extends Error {
  constructor(readonly failure: CallFailure, message: string, readonly ledger?: LedgerCall[]) {
    super(message);
    this.name = "AnalyzeReferenceError";
  }
}

// ── 账（与 `assets/ops.ts` 的 `spentCall` 同形 —— 见文件头「I/O 各包自理」）─────────
type Spent = { usage?: LedgerUsage; model?: string; requestedModel?: string; upstream?: string };

function spentCall(step: LedgerStep, target: string) {
  const t0 = Date.now();
  const failures: CallFailure[] = [];
  let trips = 0;
  let spent: Spent = {};
  return {
    trip(o: { failure?: CallFailure; spent?: Spent } = {}) {
      trips += 1;
      if (o.failure !== undefined) failures.push(o.failure);
      // ⚠️ 只有**成功**那一趟带 `spent`，而一趟调用里至多成功一次（成了就 return）
      //   ⇒ 后面失败的那些**盖不掉**它。
      if (o.spent !== undefined) spent = { ...spent, ...o.spent };
    },
    /** ⚠️ **一次都没发出去就返回 `null`** —— 账不记没上路的往返。 */
    record(): LedgerCall | null {
      if (trips === 0) return null;
      return {
        step, target, upstream: "messages", ms: Date.now() - t0, attempts: trips,
        ...(failures.length === 0 ? {} : { failures }), ...spent,
      };
    },
  };
}

/** ⚠️ `bad` 多带两枚（票 60）：模型自己写下的那份 `raw`（不参与任何判断，只为了**活过失败**）
 *  与 `response`（这一发换回来什么）。⚠️ `failure` 收成 `ToolUseFailure`（四个值 ⟺
 *  `VisualWorldAttemptOutcome` 那四个）⇒「这一发是什么下场」**不需要一次转型**。 */
type Trip =
  | { kind: "ok"; value: VisualWorldSpec; spent: Spent }
  | { kind: "bad"; failure: ToolUseFailure; detail: string; spent: Spent; raw?: unknown; response: VisualWorldResponseSummary }
  | { kind: "upstream"; failure: Extract<CallFailure, "http" | "timeout">; detail: string };

/** 上游自己报的那两样 —— **拿不到就缺席，不许编一个**。 */
function spentOf(transport: TextTransport, body: unknown): Spent {
  const { model, usage } = textUsageOf(transport, body);
  return {
    requestedModel: textModelOf(transport),
    ...(model ? { model } : {}),
    // ⚠️ 上游没给就**整个键缺席** —— 不许填 0 冒充「测到了 0」。
    ...(usage ? { usage } : {}),
  };
}

/**
 * **这一发换回来什么**（票 60 的 Q1c 那一格，判 H2 用的）。
 *
 * ⚠️ **它只是摘要，不是响应体** —— 票 55 的 Q6(r1) 明令「不落请求体 / 响应体 / headers」，
 *   而人裁这一轮要的是「区分每次实际返回的内容」。两句同时成立的那个最小集合就是这两格：
 *   · `stopReason`：上游自己写的 —— 「被截断」与「上游不认 tools」两种死因的分水岭；
 *   · `usage`：**票 59 那条最锋利的证据就是从这里读出来的**（三发空各自烧了 4430 / 3198 / 3512
 *     个输出 token ⇒「一个 `{}` 不可能值三千多」）。
 *   ⚠️ 两格都**拿不到就缺席**，绝不编一个（与 `spentOf` 同一条纪律）。
 *   ⚠️ `usage` 直接**复用** `spentOf` 已经解析好的那一份，不另抄一遍取数逻辑。
 */
function responseOf(body: unknown, spent: Spent): VisualWorldResponseSummary {
  const sr = (body as { stop_reason?: unknown } | null)?.stop_reason;
  return {
    ...(typeof sr === "string" && sr !== "" ? { stopReason: sr } : {}),
    ...(spent.usage === undefined ? {} : { usage: spent.usage }),
  };
}

// ── 出发前的三处「免费」拦停 ─────────────────────────────────────────────────
// ⚠️ 都在**第一个请求上路之前**，所以它们**不记进账**（账只记真的发出去过的往返）。
//   而它们值钱的地方是同一条：**别让调用方的错去烧三次重采样**。

function assertConfigured(t: { baseUrl: string; apiKey: string }): void {
  if (t.baseUrl === "" || t.apiKey === "")
    throw new Error(
      "视觉上游没配：ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN **两个都要给**。" +
      "⚠️ 但这一步的产物是文件 —— 一份 `visual-world.json` 也可以由人直接写。");
}

function assertStyleReferences(refs: StyleReference[]): StyleReference[] {
  const r = VisualWorldSpecSchema.shape.styleReferences.safeParse(refs);
  if (!r.success) throw new Error("styleReferences 不合法（这是**调用方**给的那一份，不是模型吐的）：" +
    r.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("；"));
  if (r.data.length === 0) throw new Error("styleReferences 是空的 —— 这一步没有图可看。第一阶段恰好要 1 张（R18）。");
  if (r.data.length > 1)
    throw new Error(`第一阶段只支持 1 张参考图，给了 ${r.data.length} 张 —— ⚠️ 多图的权重融合与冲突解决**没有任何实测**（R18），实现延后到[票 26]。`);
  return r.data;
}

function assertRequirement(text: string): string {
  const t = text.trim();
  if (t === "")
    throw new Error("requirementText 是空的 —— ⚠️ 色板的判据是「能不能画出这个世界里的东西」，" +
      "而**要画的东西有一部分压根不在参考图里**（R1-Q1）。没有需求文本，这一步挑出来的色板画不出那些东西。");
  return t;
}

function imageBlocks(refs: StyleReference[], cwd: string): TextImagePart[] {
  return refs.map((r) => {
    const ext = path.extname(r.path).toLowerCase();
    const media = STYLE_MEDIA_TYPES[ext];
    if (media === undefined)
      throw new Error(`参考图 ${r.path} 的扩展名 "${ext}" 不在白名单里（${Object.keys(STYLE_MEDIA_TYPES).join(" / ")}）` +
        " —— 我们**按扩展名**判媒体类型，不解析图片内容（R1-Q7）。");
    let bytes: Buffer;
    try { bytes = fs.readFileSync(path.resolve(cwd, r.path)); }
    catch (e) { throw new Error(`参考图读不出来：${r.path} —— ${(e as Error).message}`); }
    return { mediaType: media, base64: bytes.toString("base64") };
  });
}

/** 一次往返。**只做一次** —— 重采样在调用方那层（R16 的固定次数）。 */
async function onceThrough(o: {
  url: string; headers: Record<string, string>; body: string; timeoutMs: number; doFetch: typeof fetch;
  transport: TextTransport; styleReferences: StyleReference[]; styleId: string; referencePixels?: PaletteSource;
}): Promise<Trip> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs);
  let res: Response;
  try {
    res = await o.doFetch(o.url, { method: "POST", signal: ctl.signal, headers: o.headers, body: o.body });
  } catch (e) {
    // ⚠️ 中止与「连不上」是**两件事**，而 fetch 都抛 AbortError/TypeError —— 分开报，否则人查错方向。
    if (ctl.signal.aborted)
      return { kind: "upstream", failure: "timeout", detail: `上游 ${Math.round(o.timeoutMs / 1000)} 秒没回应，已中止（超时）` };
    return { kind: "upstream", failure: "http", detail: e instanceof Error ? e.message : String(e) };
  } finally { clearTimeout(timer); }

  if (!res.ok)
    return { kind: "upstream", failure: "http", detail: `上游返回 HTTP ${res.status}：${(await res.text()).slice(0, 200)}` };

  let body: unknown;
  try { body = await res.json(); }
  catch (e) { return { kind: "upstream", failure: "http", detail: `上游回的不是 JSON：${(e as Error).message}` }; }

  const spent = spentOf(o.transport, body);
  const response = responseOf(body, spent);
  // ⚠️ **唯一算数的判据**：入参过 Zod。`stop_reason === "tool_use"` **不是**成功信号（票 27 第 1 发：`input = {}`）。
  const parsed = parseTextResponse({ transport: o.transport, body, toolName: TOOL_NAME, schema: ModelFacingSpec });
  // ⚠️ **`raw` 原样往外带**（票 60）：`parseToolUse` 自票 55 起**两个分支都回它**，
  //   这里只是**不让它在半路掉下去** —— 「模型把顶层 `palette` 写成了哪一种数组」全靠它。
  if (!parsed.ok) return { kind: "bad", failure: parsed.failure, detail: parsed.detail, spent, raw: parsed.raw, response };

  // 注入两件调用方才知道的东西，并**重新过一次契约** —— 越界 gate 正是在这里响。
  const built = buildVisualWorld({ fromModel: parsed.value, styleReferences: o.styleReferences, styleId: o.styleId });
  // ⚠️ **同名不同病**：这一档与「模型自己写坏了形状」都记 `schema`（形状里没有第五格，
  //   发明一个到不了的值是 R7 的门）；分开读**靠 `detail`** —— 与票 55 的 Q2(r3) 同一条分工。
  //   ⚠️ 而 `raw` 仍然带模型那一份原话（它**过了** `ModelFacingSpec`，只是装配之后越了界）。
  if (!built.ok) return { kind: "bad", failure: "schema", detail: `装配后不过契约：${built.detail}`, spent, raw: parsed.raw, response };

  // ── 票 04：**确定性色板**（模型成功后、成品过契约之前）────────────────────────
  // ⚠️ 顺序是判据的一部分：先让模型那份过契约（六桶/材料里的 `palette:N` 必须合法），
  //   再把色板换成参考图提取的那份，并把引用按「旧色的最近新色」改写。
  //   反过来（先换再验）会让一个自相矛盾的模型输出被我们**救活**，越界 gate 就成了假牙。
  let spec = built.spec;
  if (o.referencePixels !== undefined) {
    const palette = extractPalette(o.referencePixels, { size: PALETTE_SIZE });
    if (palette.length > 0) {
      const replaced = applyDeterministicPalette(spec, palette);
      const again = VisualWorldSpecSchema.safeParse(replaced);
      if (!again.success)
        return { kind: "bad", failure: "schema", detail: `确定性色板装配后不过契约：${formatIssues(again.error).slice(0, 4).join("；")}`, spent, raw: parsed.raw, response };
      spec = again.data;
    }
  }
  return { kind: "ok", value: spec, spent };
}

/**
 * 这一圈的入参**要不要带走**、带走什么（票 60 Q2 = (a)+(c)，照票 55 的 Q5 同款）。
 *
 * ⚠️ **判据不是「抛的是哪个类」**：`http` / `timeout` 抛在**第 2 发**时，第 1 发那份入参
 *   就在手上 —— 按错误类分流会把它**连同现场一起丢掉**。
 *   判据是**这一圈有没有拿到过模型入参**：拿到过就带，一个都没拿到就什么都不带
 *   （`carryOnError` 的空场合 ⇒ 连键都不加 ⇒ **不会有「写一个空容器」那一档**，
 *   而 `VisualWorldAttempts.attempts` 那条 `.min(1)` 是**同一件事的结构侧**）。
 * ⚠️ 「拿到过」= **至少一发有 `raw`**，而且是**按字节**算的：模型真写了一个 `{}` 也算拿到过
 *   （票 27 实测的那个形状，最值钱的一条证据）。真正「一个都没有」的只有 `no-tool-use`
 *   —— 那一档连块都不在，压根没有入参可言。
 * ⚠️ **上游失败那一发（`http` / `timeout`）压根不进 `attempts`** —— 它发生在取到 body 之前、
 *   没有模型入参可留 ⇒ 它是**伪造证据**，而账的 `failures[]` 才是它的家。
 */
function carriedAttempts(attempts: VisualWorldAttempt[]): { visualWorldAttempts?: VisualWorldAttempts } {
  return attempts.some((a) => a.raw !== undefined)
    ? { visualWorldAttempts: { format: VISUAL_WORLD_ATTEMPTS_FORMAT, attempts } }
    : {};
}

/**
 * 看一张参考图 + 一段需求文本，产出这个世界的 `VisualWorldSpec`。
 *
 * ⚠️ **传输层的失败不重采样**（`http` / `timeout`）—— 与 `assets` 那条链一致：
 *   R16 的重采样是给**入参不过 Zod** 那种失败用的，不是给「上游挂了」用的。
 *   把两者混在一个分母里，正是票 27 的 Q4(ii) 立 `CALL_FAILURES` 要治的病。
 */
export async function analyzeReference(input: AnalyzeReferenceInput): Promise<AnalyzeReferenceResult> {
  assertConfigured(input.transport);
  const styleReferences = assertStyleReferences(input.styleReferences);
  /** ⚠️ 参考图那几条相对路径**相对谁** —— 调用方给（见 `AnalyzeReferenceInput.cwd`）。 */
  const cwd = input.cwd ?? process.cwd();
  const requirementText = assertRequirement(input.requirementText);

  const doFetch = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const req = buildTextRequest({
    transport: input.transport,
    prompt: visionPrompt({ requirementText, styleId: input.styleId }),
    toolName: TOOL_NAME, toolDescription: TOOL_DESCRIPTION, schema: ModelFacingSpec, maxTokens: MAX_TOKENS,
    images: imageBlocks(styleReferences, cwd),
  });

  const call = spentCall("analyze-reference", input.styleId);
  // ⚠️ **票 60**：这一圈里模型写下的入参 —— 只有它会被带到失败现场去。
  //   ⚠️ **「重采样之后成功」那一跑留不下来**，这是**有意的取舍**（票 55 的第一轮推论，写在明处）：
  //   只有**抛出来**才有写入点（阴性判据要求「成功路径一个字节不变」），而成功的那一跑本来就走过去了。
  const attempts: VisualWorldAttempt[] = [];
  /** 挂上这一圈再抛 —— **抛点只有这一个**，免得三处各写一遍挂载（`carryOnError` 没东西可带时是空操作）。
   *  ⚠️ 写成**函数声明**（不是 `const` 箭头）：只有这种形状，TS 才认它「永不返回」
   *  ⇒ 上面那三个 `if` 之后的收窄与「函数有终」才成立。 */
  function raise(e: unknown): never {
    carryOnError(e, carriedAttempts(attempts));
    throw e;
  }
  let lastFailure: CallFailure = "schema";
  let lastDetail = "";
  for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS; attempt++) {
    const once = await onceThrough({
      url: req.url, headers: req.headers, body: req.body, timeoutMs, doFetch,
      transport: input.transport, styleReferences, styleId: input.styleId,
      ...(input.referencePixels === undefined ? {} : { referencePixels: input.referencePixels }),
    });
    if (once.kind === "upstream") {
      // ⚠️ **上游失败不记进 `attempts`**：它发生在取到 body 之前，压根没有模型入参
      //   （`VisualWorldAttemptOutcome` 里没有它那一格）—— 它在**账**的 `failures[]` 里。
      call.trip({ failure: once.failure });
      const ledger = call.record();
      raise(new AnalyzeReferenceError(once.failure, once.detail, ledger ? [ledger] : undefined));
    }
    if (once.kind === "ok") {
      call.trip({ spent: once.spent });
      const ledger = call.record();
      return { spec: once.value, ...(ledger ? { ledger: [ledger] } : {}) };
    }
    attempts.push({
      attempt, outcome: once.failure, detail: once.detail, response: once.response,
      ...(once.raw === undefined ? {} : { raw: once.raw }),
    });
    call.trip({ failure: once.failure, spent: once.spent });
    lastFailure = once.failure;
    lastDetail = once.detail;
  }

  const ledger = call.record();
  raise(new AnalyzeReferenceError(
    lastFailure,
    `重采样 ${STRUCTURED_CALL_ATTEMPTS} 次都没有拿到一份过契约的 VisualWorldSpec（最后一次：${lastFailure}）。` +
    `最后一次的病因：${lastDetail}`,
    ledger ? [ledger] : undefined,
  ));
}
