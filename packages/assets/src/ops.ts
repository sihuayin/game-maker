// core 的**公开操作面**（票 30）。CLI 与 MCP 都是它的薄壳 —— 两者渲染**同一份** `CommandResult`。
//
// R5 排除了「MCP 转调 CLI」，所以这里是唯一的实现处：core 返回结构体，两个壳各自渲染。
//
// ⚠️ **路径一律相对于调用方给的 `outRoot`**，不是绝对路径。
// 绝对路径把「产物在哪儿」与「这台机器上的哪里」绑死 —— 而票 24 已经为资源包避开了同一个错
// （包内一律相对路径）。MCP 把路径交给 agent 时，agent 自己知道根在哪。
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  auditGameConfig, CharacterDNAFileSchema, ConfigToolSchema, DEFAULT_PLAYER_MOVE, entityBox, FALLBACK_ANCHOR, forcedTool,
  formatIssues, GameDesignSpecSchema,
  jumpSpan, MASTER_RATIOS_FILE, maxJumpHeight,
  parseAssetPack, parseAssetPlan, parseGameConfig, parseLedger, parseMasterRatios, parseRecipe, parseToolUse, PLATFORMER_V1,
  PLAYER_ACTION_NAMES,
  RecipeToolSchema, resolveRuntimeProfile, runtimeProfileRef, STRUCTURED_CALL_ATTEMPTS,
  StyleSpecSchema, summarizeCalls, VisualWorldSpecSchema,
  type AssetPackEntry, type AssetPackManifest, type AssetRecipe, type CallFailure, type CharacterDNAFile, type ConfigIssue, type GameConfig, type LayerCoverageEntry, type LedgerCall,
  type LedgerStep, type LedgerUsage, type MasterRatio, type StructuredSchema, type StyleSpec, type VisualWorldSpec,
  type GameDesignSpec,
  type AssetSource, type LayerCoverage,
} from "@game-maker/contracts";
import { createDrawListGenerator, GenerationError, stripFences, UPSTREAM_TIMEOUT_MS } from "./generate.js";
import { DEFAULT_CONCURRENCY } from "./pack.js";
import { backgroundCoverage } from "./coverage.js";
import { buildAssetPack, normalizePalette } from "./pack.js";
import { createDashScopeMcpGenerator, createGeminiGenerator, createOpenAIGenerator, ImageGenerationError, type ImageGenerator } from "./image-gen.js";
import { masterRatioNotes, referenceImagesOf } from "./master.js";
import { ensureCharacterMasters } from "./planner-masters.js";
import { describeImageTransport, type ImageTransport } from "./image-config.js";
import { createProxyFetch } from "./http.js";
import { decodePNG } from "./png.js";
import { plannerCapabilitiesOf, resolveRoute, sourceForDecision, type ExistingAsset } from "./route.js";
import { assetPlanPrompt, assetTask, CONFIG_TOOL_DESCRIPTION, CONFIG_TOOL_NAME, designBrief, drawListFewShot, drawListOpsSpec, paletteLine, PLAN_TOOL_DESCRIPTION, PLAN_TOOL_NAME, recipeShapeSpec, SKELETON_SHAPE_HEADING, SKELETON_SHAPE_NOTE, styleBrief, tdConfigPrompt } from "./prompt.js";

// ⚠️ **2026-09-29 搬到 `@game-maker/contracts`**（票 33）—— `site` 装配住在 `demo`，
//   而依赖图里 demo 只能依赖 contracts。这里**引入 + 原样再导出**，调用方一行都不用改。
import { CommandError, EXIT, DEFAULT_HUD_LINE_HEIGHT, auditLayerCoverage, auditScreenSpace, auditTdConfig, auditTdWorldSize, carryOnError, failureDirOfError, gameHudScreenItems, layerDrawnSize, parseTdConfig, tdHudScreenItems, tdResolveConfig, type CommandResult, type TdConfig } from "@game-maker/contracts";
export { asCommandError, CommandError, EXIT, exitCodeOfError, failureDirOfError, ledgerOfError, type CommandResult } from "@game-maker/contracts";
export type Transport = { baseUrl: string; apiKey: string };
const rel = (root: string, p: string) => path.relative(root, p).split(path.sep).join("/");

/**
 * **「已经花掉的」那一段** —— 两个壳（CLI 与 MCP）**共用这一处**。
 *
 * ⚠️ **别在两个壳里各写一遍**：它们的输出**必须一字不差**（人看 CLI、agent 看 MCP），
 *   而两份拷贝会漂 —— 2026-09-30 就给「`ms` 缺席」那句「还没回来」**同时往两份里贴过**，
 *   贴的时候还得记得两边都改（code-review 抓到的正是这个）。
 *
 * ⚠️ `ms` 缺席要印成**「还没回来」**，不许印 `0.0s`：那是**没测到**，不是「花了 0 秒」。
 */
export function formatSpentCalls(calls: readonly LedgerCall[]): string {
  const trips = calls.reduce((n, c) => n + c.attempts, 0);
  return `已经花掉的（${calls.length} 次调用 · ${trips} 次往返）：\n` +
    calls.map((c) => `  · ${c.step} ${c.target} · ${c.ms === undefined ? "**还没回来**" : (c.ms / 1000).toFixed(1) + "s"} · 往返 ${c.attempts}${c.model ? ` · ${c.model}` : ""}`).join("\n");
}

/**
 * **失败现场那一段**（票 01 的现场 + 票 48 把它补进 MCP）。
 *
 * ⚠️ 与 `formatSpentCalls` **同一条纪律**：**两个壳共用这一处**，别各写一份
 *   （它们必须说同一件事 —— 人看 CLI、agent 看 MCP）。
 * ⚠️ 账与现场**是两项独立信息**：只有一项时**只印那一项**，不许因为另一项缺席就把这一项也吞掉
 *   （票 48 的执行约束 2）。
 */
export function failureSiteNote(dir: string): string {
  return `⚠️ **已经付过钱的那几张原图留着**（连同那时逐字发出去的提示词）：${dir}\n` +
    `   想复用：把那些资源的 source 改成 {"kind":"import","ref":"…"} 指过去 —— **生图 0 次**。`;
}

// ── plan-assets：设计 + 这个世界 → 资源清单（票 12）───────────────────────────
//
// ⚠️ **这一道是 `derive` 的接班人，不是它的兄弟**（票 12 的 Q1：(a) 合并 —— 票 09 / 10 / 11 三次
//   把这一问推给它）。两者产的是**同一种文件**，而这一道是它的**严格超集**：
//   旧的 `derive` 提示词**明确拒绝**决定策略（「所有资源的 source 都写 drawlist……
//   那一项由人后续自己填」），而 V2 要求 LLM 决定它（`00 §2.4`）。
//   ⇒ 于是**写入侧只有这一处**（`derivePackMode` 那条教训：两个入口各写一遍必然漂移）。
export type PlanAssetsOptions = {
  /** `game-design.json` —— 理解层的收尾产物（票 10）。 */
  designPath: string;
  /** `visual-world.json` —— 票 02 的产物。 */
  visualWorldPath: string;
  outRoot: string;
  transport?: Transport; fetchImpl?: typeof fetch;
  /** 一次上游调用的超时（毫秒）。默认 [[UPSTREAM_TIMEOUT_MS]] —— ⚠️ 测「超时」那条路时才传小的。 */
  timeoutMs?: number;
  /**
   * 生图 transport（**免费解析**，不探测在线）。用于构造能力快照与参考图能力检查；
   * 不给 ⇒ `routes.image = false`（第四轮 Q14.1：能力缺失归 usage）。
   */
  imageTransport?: ImageTransport;
  /**
   * 既有素材（**fixture / 手写 Recipe 路径专用**；create 链传空，第一轮 Q4）。
   * `ref` 相对 recipe 输出目录解析；可访问性由 planAssets 预检查后传给 resolver。
   */
  existingAssets?: readonly { id: string; ref: string; mustReuse: boolean }[];
};

/** 上游自报的模型名与用量（与 `callText` 那条路同款 —— 它们是「花了什么」的事实，票 45）。 */
function spentOfTool(body: unknown): Spent {
  const j = body as {
    model?: string;
    usage?: { input_tokens?: number; output_tokens?: number; reasoning_tokens?: number };
  } | null;
  const u = j?.usage;
  return {
    ...(j?.model !== undefined ? { model: j.model } : {}),
    ...(u === undefined
      ? {}
      : {
          usage: {
            ...(u.input_tokens !== undefined ? { inputTokens: u.input_tokens } : {}),
            ...(u.output_tokens !== undefined ? { outputTokens: u.output_tokens } : {}),
            ...(u.reasoning_tokens !== undefined ? { reasoningTokens: u.reasoning_tokens } : {})
          }
        })
  };
}

/**
 * **一次往返**（**R16 那条协议**：强制工具调用）。⚠️ 它与上面 `onceThrough` 那条**旧协议**的路
 * **并列**，别把两者混起来：那条走 `callText` + 剥围栏 + `JSON.parse`，这条走 `parseToolUse`。
 *
 * ⚠️ **唯一的成功判据是入参过 Zod** —— `stop_reason === "tool_use"` **不是**（票 27 第 1 发实测：
 *   工具被调、`input = {}`、1135 token 打水漂）。
 */
async function onceThroughTool<T>(o: {
  transport: Transport; body: string; tool: string; schema: StructuredSchema<T>;
  fetchImpl?: typeof fetch; timeoutMs?: number;
}): Promise<Once<T>> {
  const doFetch = o.fetchImpl ?? fetch;
  const timeoutMs = o.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await doFetch(`${o.transport.baseUrl}/v1/messages`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": o.transport.apiKey, "anthropic-version": "2023-06-01" },
      body: o.body,
    });
  } catch (e) {
    const kind = ctl.signal.aborted ? ("timeout" as const) : ("http" as const);
    const msg = ctl.signal.aborted
      ? `上游 ${Math.round(timeoutMs / 1000)} 秒没回应，已中止（超时）`
      : (e as Error).message;
    return { kind: "upstream", failure: kind, error: new UpstreamCallError(kind, msg) };
  } finally { clearTimeout(timer); }

  if (!res.ok)
    return { kind: "upstream", failure: "http", error: new UpstreamCallError("http", `上游返回 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`) };

  let body: unknown;
  try { body = await res.json(); }
  catch (e) { return { kind: "upstream", failure: "http", error: new UpstreamCallError("http", `上游回的不是 JSON：${(e as Error).message}`) }; }

  // ⚠️⚠️ **body 不是对象 ⇒ 上游没给一个可用的应答，落 `upstream`/`http`、不重采样**
  //   （[票 51](../../../.scratch/game-maker-v2/issues/51-not-sent-lies-both-ways.md) 的 Q3 = (B)，2026-10-12）。
  //   这一道是**前置**的，**不动 `parseToolUse`**（它照旧把这种入参判成 `no-tool-use` 可重采样，
  //   它的单元测试一个字没改）—— 因为同一个事实两条路（旧文本链 / R16 工具链）**判成两档**
  //   正是票 51 标题那一句，而「代理坏掉、回了 `null`」重试三次只是**白花钱**。
  //   ⚠️ **代价已裁定并记入票 51**：`planAssets` / `compileRuntime` 在「200 + body 不是对象」这一条上
  //   退出码 **4 → 3**、往返 **3 → 1 次**（`{"content":5}` 那种**是对象**的不受影响，两条路本来就都落 4）。
  if (!isResponseObject(body))
    return { kind: "upstream", failure: "http",
      error: new UpstreamCallError("http", `上游回的不是一个 messages 应答（拿到 ${describeShape(body)}）`) };

  const spent = spentOfTool(body);
  const parsed = parseToolUse(body, o.tool, o.schema);
  // 形式的失败（没调工具 / 入参丢了 / 不合线形状）由 `parseToolUse` 分好类 —— 那一档才是重采样的理由。
  if (!parsed.ok) return { kind: "bad", failure: parsed.failure, detail: parsed.detail, spent };
  return { kind: "ok", result: { ok: true, value: parsed.value } as const, spent };
}

/**
 * **玩家那件资源**长什么样才编得出配置（**票 61**）—— 不合规返回一句给人读的话，合规返回 `null`。
 *
 * ⚠️ **为什么要有这一条**：配置契约要的是「**一件**资源同时带 `idle`/`run`/`jump` 三路动画」
 *   （`game-config.ts` 的 `Player.anims`，外壳按三个键各播一路），而**配方层从来不知道这件事** ——
 *   三个名字一个都不在配方提示词里。第十二次真跑就是这么死的：模型把三路拆成了三件
 *   （`player-walk` / `player-jump` / `player-idle`，各一路），配置那一步**挑哪一件都错**。
 *
 * ⚠️ **它判的是清单**（`AssetRecipe`），**不是包**：这是唯一一个「**在花钱之前、又还在抽签圈里**」
 *   的位置 —— 一份漏了的清单是**模型没生成好**（玩家一定存在，三路一定做得出来），
 *   不是「这份设计做不出来」⇒ 与 `parseRecipe` 落**同一档**（`failure: "schema"`），重采样。
 *   与 `compileRuntime` 那道 audit 闸门的分野正是这一条（那一档**不重采样**）。
 *
 * ⚠️ **认不出即失败，不许静默跳过**：清单里没有任何一件把 `characterId` 写成 `design.player.id`
 *   就**抛**。模型漏写 `characterId` 是最常见的那种漏法，而「找不到就放行」会把它变成一个
 *   **空守卫** —— 那正是票 61 要消灭的那一类错。
 *
 * ⚠️ 判的是**四条**（人裁 Q6(r2) = (c) 逐字），一条都不多：
 *   ① 玩家名下的 `kind:"animation"` 资源**恰好一件**（0 件、2 件都算错）；
 *   ② 那一件的 `animations[]` **同时含三个固定名**（多出来的路不管 —— 合约只要求「包含」）；
 *   ③ 那三路**每路至少 2 帧**（1 帧是静帧，不是动画）；
 *   ④ 三条路的**名字**逐字取自 `PLAYER_ACTION_NAMES`（全仓唯一来源，见 `game-config.ts`）。
 *   ⇒ 「三格指同一个动画」那一半**不在这里**：那是**配置侧**的对账（人裁 Q7(r2) = (b)，两侧都守）。
 *   ⚠️ 玩家名下若有别的种类（比如一件 `sprite`）**不报错** —— 本闸门只数 `animation` 那一种，
 *      人裁没有把那一档判成失败，**不替人加第五条**。
 */
function playerAnimationGate(spec: AssetRecipe, playerId: string): string | null {
  const mine = spec.assets.filter((e) => e.spec.characterId === playerId);
  // ⚠️ 只留 `kind:"animation"` 那一种，**并且当场收窄**（`flatMap` 顺带把 union 收了）——
  //   下面那几处读的都是 `AnimatedSpec` 自己的字段（`animations[]` 只长在它身上）。
  const anims = mine.flatMap((e) => (e.spec.kind === "animation" ? [e.spec] : []));
  const want = PLAYER_ACTION_NAMES.join(" / ");

  if (anims.length === 0)
    return `清单里没有一件 kind:"animation" 的资源写着 characterId "${playerId}"` +
      (mine.length > 0
        ? `（写着它的那几件是 ${mine.map((e) => `${e.spec.id}(${e.spec.kind})`).join(" · ")} —— 三路动画住在**同一件** animation 资源自己的 animations[] 里）`
        : "（整个清单里一件都没写这个 characterId）") +
      ` —— 外壳按 ${want} 三个键各取一路，拆成几件之后配置那一步挑哪一件都错。`;

  if (anims.length > 1)
    return `玩家 "${playerId}" 名下有 ${anims.length} 件 kind:"animation" 资源：` +
      `${anims.map((a) => a.id).join(" · ")} —— **只许一件**：三路动画是**这一件**的三个 animations[] 条目，` +
      "拆成多件之后配置那一步没办法确定该引用哪一件（而且会多花几笔生图的钱）。";

  const only = anims[0]!;
  const names = only.animations.map((a) => a.name);
  const missing = PLAYER_ACTION_NAMES.filter((n) => !names.includes(n));
  if (missing.length > 0)
    return `玩家那件资源 "${only.id}" 的 animations[] 缺 ${missing.map((n) => `"${n}"`).join(" / ")}` +
      `（它有的是：${names.join(" / ") || "一个都没有"}）—— 三个动作名是契约定死的字面 ${want}，` +
      "不许改名、不许少写（配置那三格就是照着这三个键取的）。";

  const thin = PLAYER_ACTION_NAMES.flatMap((n) => {
    const a = only.animations.find((x) => x.name === n);
    return a !== undefined && a.frames < 2 ? [a] : [];
  });
  if (thin.length > 0)
    return `玩家那件资源 "${only.id}" 有 ${thin.length} 路动画只有 1 帧：` +
      `${thin.map((a) => `"${a.name}"(${a.frames} 帧)`).join(" · ")} —— 1 帧是**静帧**、不是动画，` +
      "三路各至少 2 帧。";

  return null;
}

/**
 * **设计 → 清单的覆盖闸**（CAP-SPEC-12）。
 *
 * 规则只有一条，两个键**都是精确相等** —— 人裁 2026-10-21（票 01）：严格全覆盖、无豁免。
 *   四桶里的每个 id 都要求某件资产 `spec.id` **逐字**等于它，或 `spec.characterId` **逐字**等于它
 *   （敌人 / NPC 通常走后者，道具 / 拾取物走前者；两种写法都算覆盖，改名与省略都不算）。
 *
 * ⚠️ 精确相等是**故意的**：前缀匹配（`chest-closed` 覆盖 `chest`）会把「改名」一起放过去，
 *   而「模型可漏 / 改名而不被拒」正是这条 CAP 要抓的东西。缺一个 id 就报一个，名字一字不改地列出来。
 * ⚠️ 它在**重采样循环里**（与玩家闸门同一档：`schema`）—— 模型看得到自己的清单，三发内可以补；
 *   三发用完才 `invalid`（退出码 4）。这一层没有「模型说不需要」的豁免。
 */
export function designCoverageGate(recipe: AssetRecipe, design: GameDesignSpec): string | null {
  const byId = new Set(recipe.assets.map((e) => e.spec.id));
  const byCharacter = new Set(
    recipe.assets.flatMap((e) => (e.spec.characterId === undefined ? [] : [e.spec.characterId])),
  );
  const missing: string[] = [];
  const needAsset = (bucket: string, ids: readonly string[]) => {
    for (const id of ids)
      if (!byId.has(id) && !byCharacter.has(id))
        missing.push(`${bucket} "${id}" —— 没有一件资产的 \`id\`（或 \`characterId\`）等于它`);
  };
  needAsset("enemies[]", design.enemies.map((e) => e.id));
  needAsset("npcs[]", design.npcs.map((e) => e.id));
  needAsset("interactables[]", design.interactables.map((e) => e.id));
  needAsset("resources[]", design.resources.map((e) => e.id));
  if (missing.length === 0) return null;
  return "清单没有覆盖设计层的全部实体（资源不完整）：\n"
    + missing.map((m) => `  · ${m}`).join("\n")
    + "\n⚠️ 设计层列出的每个 id 都必须有一件资产**逐字**覆盖它（不改名、不省略）；"
    + "这一层没有「不需要资源」的豁免。请补齐后重出这份清单。";
}

/** 空色板的**同一句判据**（CAP-SPEC-17）：风格规格与 VWS 两条入口共用这一处。 */
export function emptyPaletteProblem(palette: readonly string[], what: string): string | null {
  return palette.length === 0
    ? `${what}不过业务判据：palette 至少要有一个色（空色板画不出任何颜色）`
    : null;
}

/**
 * 规划一份资源清单。**两阶段的第一阶段**（票 28）—— 清单落盘，人过目，再 `pack`。
 *
 * ⚠️ 清单**绝不覆盖**：每次规划写一个新的 `v<N>`（与资源包同一条规矩）。
 * ⚠️ **它走 R16**（强制工具调用 + 入参过 Zod + `STRUCTURED_CALL_ATTEMPTS` 次重采样）——
 *   与 `derive` 当年那条「纯文本 + 剥围栏 + 2 次」的旧路**不是一回事**，别照抄旧的那份。
 * ⚠️ **入参过线形状不算数**：真正的判据是 `parseRecipe`（v3 那份契约）—— 依赖图 · 母版比例 ·
 *   九宫格中央区 · 路径字符都住在它里面（`recipe-tool.ts` 的文件头解释了这条分工）。
 */
export async function planAssets(opts: PlanAssetsOptions): Promise<CommandResult> {
  const readJson = (p: string, what: string): unknown => {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); }
    catch (e) { throw new CommandError("invalid", `${what}读不出来或不是 JSON：${p} —— ${(e as Error).message}`); }
  };
  const fmt = (e: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }) =>
    e.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("；");

  const d = GameDesignSpecSchema.safeParse(readJson(opts.designPath, "设计"));
  if (!d.success) throw new CommandError("invalid", `设计不过 schema：${fmt(d.error)}`);
  const w = VisualWorldSpecSchema.safeParse(readJson(opts.visualWorldPath, "这个世界"));
  if (!w.success) throw new CommandError("invalid", `这个世界不过 schema：${fmt(w.error)}`);
  // ⚠️ **查的是两个字段空不空，不是对象在不在** —— 这一条是从 `derive` 那里继承来的教训
  //   （它的账测试里记着）：只查对象的话，`{baseUrl:"", apiKey:""}` 会**照样发出去**，
  //   而 fetch 对空 baseUrl 抛的那一枪会被记成 `failure: "http"` ——
  //   **一个本地配置错被计成上游故障**，于是「上游今天稳不稳」这个数被自己的配置污染了。
  // ⚠️ 报错里**点名两个环境变量**：这一档以前是 `callText` 替它报的，而那条路现在不走了。
  if (!opts.transport || opts.transport.baseUrl === "" || opts.transport.apiKey === "")
    throw new CommandError(
      "upstream",
      "规划资源清单需要文本上游：ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN **两个都要给**。" +
      "⚠️ 但清单是文件 —— 人可以直接写一份，再 `pack`。");

  const design = d.data;
  const world = w.data;
  // ⚠️ **空色板前移**（CAP-SPEC-17）：单独 `plan` 入口也必须在**下游任何付费调用之前**拒。
  //   色板非空是业务判据（契约里 `palette` 带 `.default([])`，故意放行缺席）——
  //   与 `readStyle` 共用 `emptyPaletteProblem`，一处措辞、一处口径。
  const emptyPalette = emptyPaletteProblem(world.style.palette, "这个世界");
  if (emptyPalette !== null) throw new CommandError("invalid", emptyPalette);
  const existingInputs = opts.existingAssets ?? [];
  const capabilities = plannerCapabilitiesOf({
    design,
    ...(opts.imageTransport === undefined ? {} : { imageTransport: opts.imageTransport }),
    hasExistingAssets: existingInputs.length > 0,
  });
  const refs = world.styleReferences;
  /** ⚠️ 风格与清单**住同一个目录** ⇒ `styleRef` 就是一个普通文件名（与 `derive` 当年的做法一字不差）。 */
  const STYLE_FILE = "stylespec.json";
  const REF_FILE = "reference.png";

  const body = JSON.stringify({
    // ⚠️ 与 `callText` 同源（票 24 的实况：代理**请求一个、回另一个**，`model` 与 `requestedModel` 是两个事实）。
    model: "deepseek-v4-pro", max_tokens: 16_000, thinking: { type: "disabled" },
    ...forcedTool(PLAN_TOOL_NAME, PLAN_TOOL_DESCRIPTION, RecipeToolSchema),
    messages: [{
      role: "user",
      content: [{
        type: "text",
        text: assetPlanPrompt({
          design, vws: world,
          echo: { styleRef: STYLE_FILE, styleId: world.style.id, ...(refs.length > 0 ? { referenceImage: REF_FILE } : {}) }
        })
      }]
    }]
  });

  // ⚠️ 账**只进回报，不落盘**（票 19：账跟着「包」走，而「清单」不是包 —— 清单可以是人直接写的）。
  const call = spentCall("plan-assets", "recipe");
  let checked: ReturnType<typeof parseRecipe> | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < STRUCTURED_CALL_ATTEMPTS; attempt++) {
    const once = await onceThroughTool({
      transport: opts.transport, body, tool: PLAN_TOOL_NAME, schema: RecipeToolSchema,
      ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
      ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
    });
    if (once.kind === "upstream") {
      call.trip({ failure: once.failure });
      throw new CommandError("upstream", once.error.message, ledgerCarrying(call.record()));
    }
    // ⚠️ 「没上路」那一档在**这条路上不该出现**（凭据上面已经查过）—— 留着这一句是为了让类型收窄
    //   说得出口，而它真出现时按「上游不可达」报（与 `derive` 当年同款）。
    if (once.kind === "not-sent") throw new CommandError("upstream", once.error.message);
    if (once.kind === "bad") {
      call.trip({ failure: once.failure, spent: once.spent });
      lastError = once.detail;
      continue;
    }
    const truth = parseRecipe(once.result.value);
    if (!truth.ok) {
      call.trip({ failure: "schema", spent: once.spent });
      lastError = `清单不过契约：${truth.errors.slice(0, 4).join("；")}`;
      continue;
    }
    // ⚠️ **票 02（P0-06）：`frames` 候选不再被静默折叠成 `image`**（CAP-ASSET-01）。
    //   旧行为：`candidate: entry.source.kind === "frames" ? "image" : …` ⇒ 模型写 `frames`、
    //   落盘却是 `image`、sidecar 还记成 `candidate:"image"` —— 一次**静默降级**。
    //   P0 的口径是**明确失败**（人裁 2026-10-21）：不接受模型自己挑这条候选，也不参数化保留它。
    //   ⚠️ **不重采样**：这是「模型选了这条候选」，不是「形状写坏了」—— 三发盲重采样只会重复同一件事。
    //   ⚠️ 账**照记这一发的花费**（`spent`）—— 钱是真花了，失败不改变这个事实。
    //   ⚠️ **只管 `assets[]`**：`authoring[]` 的 `frames` 早就被契约自己拒了
    //   （「母版是一张位图，不是动画」）—— 这里再写一遍是第二个事实源。
    const framesEntry = truth.value.assets.find((e) => e.source.kind === "frames");
    if (framesEntry !== undefined) {
      call.trip({ spent: once.spent });
      throw new CommandError(
        "invalid",
        `资源 "${framesEntry.spec.id}" 用了 \`source.kind:"frames"\` —— P0 不接受模型自己挑这条候选：`
        + "规划期会把它改写成 `image`（一图 N 帧），那正是**静默降级**。"
        + "请改用 `image`；确需逐帧模式（`frames`）请由人改清单，规划期不保留这条候选。",
        ledgerCarrying(call.record()),
      );
    }
    // ⚠️ **票 01：设计 → 清单的覆盖闸**（CAP-SPEC-12）—— 紧挨 `parseRecipe`：过得了契约、
    //   但漏了 / 改了设计层某个实体，资源就不完整。与玩家闸门**同一档**（`schema`、重采样），
    //   不新增错误通路、不动 `CALL_FAILURES` 那个闭集。
    const coverageError = designCoverageGate(truth.value, design);
    if (coverageError !== null) {
      call.trip({ failure: "schema", spent: once.spent });
      lastError = coverageError;
      continue;
    }
    // ⚠️ **票 61：玩家那件资源的闸门**（紧挨 `parseRecipe`，理由见那个函数的头）。
    //   与上一档**同一档**：过得了契约、但这份清单编不出能跑的配置 ⇒ 算**模型没生成好**、重采样。
    //   ⚠️ 三发用尽照旧走下面那条**现成的** `CommandError("invalid")`（退 4），
    //   不新增错误通路、不动 `CALL_FAILURES` 那个闭集。
    const playerErr = playerAnimationGate(truth.value, design.player.id);
    if (playerErr !== null) {
      call.trip({ failure: "schema", spent: once.spent });
      lastError = playerErr;
      continue;
    }
    call.trip({ spent: once.spent });
    checked = truth;
    break;
  }
  if (!checked?.ok) throw new CommandError("invalid", lastError, ledgerCarrying(call.record()));

  const dir = path.join(opts.outRoot, checked.value.id, "recipes");
  fs.mkdirSync(dir, { recursive: true });

  // ── 确定性路线决策（第一~四轮）────────────────────────────────────────────
  // ⚠️ 模型给的 `source.kind` 只是**候选**；这里是唯一最终写入者。
  const existingAssets: ExistingAsset[] = existingInputs.map((x) => {
    let accessible = false;
    try {
      const abs = path.resolve(dir, x.ref);
      accessible = fs.existsSync(abs) && fs.statSync(abs).isFile();
    } catch { accessible = false; }
    return { ...x, accessible };
  });
  // ── 票 03：**母版兜底**（在路线决策之前）────────────────────────────────────
  // ⚠️ B 跑量到 3 个角色、0 张母版：提示词当时逐字允许省略（「母版不必每份清单都有」），
  //   而链上的 DNA → 母版 → 动画**没有任何一步要求它必须存在**。这里按票面补成确定性的：
  //   每个带 `characterId` 的 animation 都必须指着一张本角色、同比例的母版。
  // ⚠️ **import 的 mustReuse 资产不补**：那一路用的是人给的位图，`masterAsset` 在那里没有意义。
  //   放在决策**之前**，是为了让 resolver 的 `inputs.masterAsset` 与随后的能力检查都看见这条边。
  const withMasters = ensureCharacterMasters(checked.value, {
    skipAssetIds: new Set(existingAssets.filter((a) => a.mustReuse).map((a) => a.id)),
  });

  const decisions = withMasters.assets.map((entry) => {
    const existing = existingAssets.find((a) => a.id === entry.spec.id);
    const decision = resolveRoute({
      spec: entry.spec, context: { design, visualWorld: world },
      // ⚠️ `frames` 在**上面**就拒了（票 02 的明确失败）；这里的三值收窄只是类型需要，
      //   不是一条还能走到的降级路 —— 别再让任何人从这里读回「frames 会被折成 image」。
      capabilities, existingAssets, candidate: entry.source.kind === "frames" ? "image" : entry.source.kind,
    });
    if (!decision.ok)
      throw new CommandError(
        decision.failure === "capability" ? "usage" : "invalid",
        `资源 "${entry.spec.id}" 的路线决策失败（${decision.failure}）：${decision.message}`,
        ledgerCarrying(call.record()),
      );
    // ⚠️ 参考图能力：协议不支持时在**规划期**拒（不把已知问题推到 pack）。
    if (decision.route === "image" && opts.imageTransport?.protocol === "dashscope-mcp" &&
        (entry.spec.masterAsset !== undefined || (entry.source.kind === "image" && entry.source.reference !== undefined)))
      throw new CommandError(
        "usage",
        `资源 "${entry.spec.id}" 需要参考图/母版，而 image 协议 \`dashscope-mcp\` 不支持参考图`,
        ledgerCarrying(call.record()),
      );
    return { entry, decision, source: sourceForDecision(entry.source as AssetSource, decision, existing) };
  });
  const finalRecipe = { ...withMasters, assets: decisions.map(({ entry, source }) => ({ spec: entry.spec, source })) };
  const finalChecked = parseRecipe(finalRecipe);
  if (!finalChecked.ok)
    throw new CommandError(
      "invalid",
      `路线改写后的清单不过契约：${finalChecked.errors.slice(0, 4).join("；")}`,
      ledgerCarrying(call.record()),
    );

  // ⚠️ 落盘的风格是**这个世界的 `style` 子树**（R6 说的那个「兼容载体」）—— 它原样就是一份
  //   `StyleSpec`，所以配方契约与 `pack` 都**一行不用改**。
  fs.writeFileSync(path.join(dir, STYLE_FILE), JSON.stringify(world.style, null, 2) + "\n");
  const out: Record<string, unknown> = { ...finalChecked.value, styleRef: STYLE_FILE };
  if (refs.length > 0) {
    // ⚠️ 风格参考图**拷进配方目录**（与 stylespec 同款）：`referenceImage` 是**原图参与生图**的唯一入口
    //   （`03 §15` 要求原图必须参与），而世界那边的路径是**相对 `visual-world.json`** 的。
    const src = path.resolve(path.dirname(opts.visualWorldPath), refs[0]!.path);
    try { fs.copyFileSync(src, path.join(dir, REF_FILE)); }
    catch (e) { throw new CommandError("invalid", `世界指的那张风格参考图读不出来：${src} —— ${(e as Error).message}`); }
    out["referenceImage"] = REF_FILE;
  } else {
    delete out["referenceImage"]; // 世界没给参考图 ⇒ 不留模型瞎写的那个值
  }
  const version = nextVersion(dir);
  const file = path.join(dir, `v${version}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");

  // plan sidecar：**规划成功才有**；由 resolver 输出直接生成，不从 Recipe 反推。
  const sidecar = {
    format: "asset-plan/v1",
    recipeId: finalChecked.value.id,
    recipeVersion: version,
    plannerVersion: "1",
    capabilities,
    inputs: {
      styleRef: STYLE_FILE,
      ...(typeof out["referenceImage"] === "string" ? { referenceImage: out["referenceImage"] } : {}),
    },
    assets: decisions.map(({ entry, decision }) => ({
      id: entry.spec.id,
      route: decision.route,
      reason: { code: decision.reason.code, ...(decision.reason.text === undefined ? {} : { text: decision.reason.text }) },
      inputs: decision.inputs,
      candidate: decision.candidate,
      participated: decision.participated,
    })),
  };
  const planParsed = parseAssetPlan(sidecar);
  if (!planParsed.ok)
    throw new CommandError("invalid", `plan sidecar 不过契约：${planParsed.errors.slice(0, 4).join("；")}`, ledgerCarrying(call.record()));
  const planFile = path.join(dir, `v${version}.plan.json`);
  fs.writeFileSync(planFile, JSON.stringify(planParsed.value, null, 2) + "\n");

  const kinds: Record<string, number> = {};
  for (const a of finalChecked.value.assets) kinds[a.spec.kind] = (kinds[a.spec.kind] ?? 0) + 1;
  return {
    command: "plan",
    summary: [`清单已落盘：${rel(opts.outRoot, file)}`, `规划记录已落盘：${rel(opts.outRoot, planFile)}`, `${finalChecked.value.assets.length} 个资源（${Object.entries(kinds).map(([k, v]) => `${k}×${v}`).join(" · ")}）`],
    data: { recipeId: finalChecked.value.id, version, assetCount: finalChecked.value.assets.length, kinds, plan: rel(opts.outRoot, planFile), ledger: asLedger(call.record()) },
    artifacts: [
      { path: rel(opts.outRoot, file), kind: "asset-recipe" },
      { path: rel(opts.outRoot, planFile), kind: "asset-plan" },
    ]
  };
}

/**
 * 调一次文本上游（`derive` 用；生成走 `createDrawListGenerator`）。
 * ⚠️ 返回**不只是文本**：`usage` 与上游自报的模型名都要带出来（票 45）——
 *   它们是「花了什么」的事实，而这一层过去把它们直接丢了。
 */
/**
 * `callText` 失败**带着病因**（票 27 的 Q4(ii)，票 28 落地）。
 *
 * ⚠️ **为什么要一个类型而不是靠 message 认**：账上要写得出「**为什么**重来」，
 *   而按错误信息做字符串匹配去认病因，正是本仓库反复吃亏的那件事
 *   （票 06 量过：「那句好话站错了地方」也是同一种病）。
 *
 * ⚠️ 只有两档：`timeout`（我们自己中止的）与 `http`（**上游没给一个可用的应答** ——
 *   非 2xx、body 不是 JSON、连不上）。闭集里没有第三档，别现编。
 *
 * ⚠️ **「没配凭据」故意**不走这里 —— 那个错在**请求上路之前**就抛了（见下面 `callText` 的守卫），
 *   而账只记**真的发出去过**的往返（票 46）。它在 `onceThrough` 里落成 `"not-sent"`。
 */
export class UpstreamCallError extends Error {
  constructor(readonly failure: Extract<CallFailure, "http" | "timeout">, message: string) {
    super(message);
    this.name = "UpstreamCallError";
  }
}

/**
 * ⚠️ **「没配凭据、请求真的没上路」的指名标记**（票 51 的 Q1 = (d)，2026-10-12）。
 *
 * ⚠️⚠️ **为什么非要一个类，而不是继续「抛的不是 `UpstreamCallError` 就是没发出去」**：
 *   那不叫判据，那叫**兜底** —— 而兜底的方向是错的、且错得最贵。`callText` 里有四个抛点，
 *   **只有这一个**真没上路；其余三个（`timeout` 一处 · `http` 两处）本来就抛 `UpstreamCallError`，
 *   可**将来任何没设防的抛点**（`res.json()` 的 `SyntaxError`、取 `usage` 的 `TypeError`）
 *   都会被那条兜底记成「我们没发出去」—— 而那两张脸**钱已经花了**（HTTP 200 都回来了）。
 *   ⇒ 谎报的后果不是文案难看，是**整笔账丢掉**（不带账的那一档没人读得出花过钱）。
 *   ⇒ 翻过来才对：**点名的这一处落 `"not-sent"`，其余的默认落 `upstream`**（保守，且与
 *   `UpstreamCallError` 上面那句「上游没给一个可用的应答」逐字一致）。
 *   ⚠️ 不是第三档病因 —— `CallFailure` 的**闭集一个字没动**，这只是「有没有上路」的标记。
 */
class NotSentError extends Error {
  constructor(message: string) { super(message); this.name = "NotSentError"; }
}

/**
 * ⚠️ 与 `contracts/structured-call.ts` 里那一对**逐字同义**（`isRecord` / `describe`）——
 *   那边是模块私有的、没导出，而这里只需要它**报形状**这一个用法。
 *   ⚠️ 故意**不**为了这两行去扩大 contracts 的公开面（那会动到一个本票边界外的包）。
 */
const describeShape = (u: unknown): string =>
  u === null ? "null" : Array.isArray(u) ? `数组(${u.length})` : typeof u;

/** 一个 body 是不是「一个能当 messages 应答读的对象」。⚠️ 数组、`null`、标量都不是。 */
const isResponseObject = (u: unknown): u is Record<string, unknown> =>
  typeof u === "object" && u !== null && !Array.isArray(u);

async function callText(opts: Transport & { prompt: string; fetchImpl?: typeof fetch; timeoutMs?: number }):
Promise<{ text: string; usage?: LedgerUsage; servedModel?: string; stopReason?: string }> {
  // ⚠️ **没配凭据要在**这里**拦住**，不能让它落到 fetch 上去失败。
  //   两个壳（CLI 一处 + MCP 三处）永远传一个**定义了、但 `baseUrl` 可能是空串**的对象，
  //   所以 `ops` 里那些 `if (!opts.transport)` 恒不触发 —— 用户看到的是一个原始 fetch 报错，
  //   而不是这句话。（票 06 量到的：那句好话站错了地方。）
  //   ⚠️ **只可能在这里拦住**，所以「没上路」这件事**由这一处点名**（`NotSentError`，票 51）——
  //   `onceThrough` 的判据挂在这个类上，而不是挂在那四个抛点之外的兜底上。
  if (opts.baseUrl === "" || opts.apiKey === "")
    throw new NotSentError(
      "文本上游没配：ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN **两个都要给**。" +
      "⚠️ 但这一步的产物是文件 —— 资源清单与关卡配置都可以由人直接写一份。");

  const doFetch = opts.fetchImpl ?? fetch;
  // ⚠️ 超时**做成参数**：否则「上游不响应」这条路径在测试里就要真等 180 秒，而那等于测不了。
  const timeoutMs = opts.timeoutMs ?? UPSTREAM_TIMEOUT_MS;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await doFetch(`${opts.baseUrl}/v1/messages`, {
      method: "POST",
      signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "deepseek-v4-pro", max_tokens: 32_000, thinking: { type: "disabled" }, messages: [{ role: "user", content: opts.prompt }] }),
    });
  } catch (e) {
    // ⚠️ 中止与「连不上」是**两件事**，而 fetch 都抛 AbortError/TypeError —— 分开报，否则人查错方向
    if (ctl.signal.aborted) throw new UpstreamCallError("timeout", `上游 ${Math.round(timeoutMs / 1000)} 秒没回应，已中止（超时）`);
    throw new UpstreamCallError("http", e instanceof Error ? e.message : String(e));
  } finally { clearTimeout(timer); }
  if (!res.ok) throw new UpstreamCallError("http", `上游返回 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`);
  // ⚠️⚠️ **HTTP 200 不等于「上游给了一个能用的应答」**（票 51 的病一，2026-10-12）——
  //   下面这一句过去**裸着**：body 不是 JSON ⇒ `SyntaxError`，取了 `usage` / 调了 `.filter` ⇒ `TypeError`。
  //   两个都从 `callText` 里冒出去，被 `onceThrough` 那条兜底记成「**我们没发出去**」——
  //   可**钱已经花了**（200 都回来了）⇒ 账整笔丢掉、文案是原始 JS 错误。
  //   ⚠️ 「body 不是 JSON」本来就写在上面 `UpstreamCallError` 的 `http` 档定义里 ——
  //   这里只是把 `onceThroughTool`（R16 那条）与 `analyze-intent` 那两份**已经设了防**的实现对齐。
  let body: unknown;
  try { body = await res.json(); }
  catch (e) { throw new UpstreamCallError("http", `上游回的不是 JSON：${(e as Error).message}`); }
  // ⚠️ **形状也要设防，而且这一道只收「不是对象」**（票 51 的 Q1 = (d)）：
  //   `null` / `[]` / `123` / `false` / `"abc"` 都是**合法 JSON**、却读不成一个 messages 应答 ——
  //   不设防的话 `body.usage` 当场炸（`null` 那张脸），而它同样是**花了钱的**。
  //   ⚠️ 是对象而 `content` 不是数组（`{"content":5}`）**不在这里**报：它要被归一成
  //   「没有文本块」⇒ 空文本 ⇒ 调用方按「不是合法 JSON」处置 —— 与 `parseToolUse` 对 `content`
  //   的同一条归一化一致，两条路因此**同判**（票 51 的 M3 那一行 `{"content":5}` 从此不再分歧）。
  if (!isResponseObject(body))
    throw new UpstreamCallError("http", `上游回的不是一个 messages 应答（拿到 ${describeShape(body)}）`);
  const j = body as {
    model?: string; content?: { type: string; text?: string }[]; stop_reason?: string;
    usage?: { input_tokens?: number; output_tokens?: number; completion_tokens_details?: { reasoning_tokens?: number } };
  };
  const u = j.usage;
  const blocks = Array.isArray(j.content) ? j.content : [];
  return {
    text: blocks.filter((c) => c.type === "text").map((c) => c.text ?? "").join(""),
    ...(j.model ? { servedModel: j.model } : {}),
    // ⚠️ `stop_reason` 要交出来（票 28）：以前这一层只顾着取文本，于是**截断**
    //   在三个调用点上一律表现为「不是合法 JSON」—— 一个**假病因**，而它会把人引去查模型。
    ...(j.stop_reason ? { stopReason: j.stop_reason } : {}),
    ...(u ? { usage: {
      ...(u.input_tokens !== undefined ? { inputTokens: u.input_tokens } : {}),
      ...(u.output_tokens !== undefined ? { outputTokens: u.output_tokens } : {}),
      ...(u.completion_tokens_details?.reasoning_tokens !== undefined ? { reasoningTokens: u.completion_tokens_details.reasoning_tokens } : {}),
    } } : {}),
  };
}

/** 上游自报的、跟着这一笔走的东西。⚠️ 单独一个类型：它俩总是**成对**出现，不该在路上散成两个参数。 */
type Spent = Pick<LedgerCall, "model" | "usage">;

/**
 * 一次**往返**的结果。
 *
 * ⚠️ `"not-sent"` 是**故意**分开的一档：那是**我们这边**没把请求发出去（没配凭据），
 *   不是上游的错 —— 而账上**也不该有这一笔**（票 46：只记真的发出去的）。
 */
type Once<T> =
  | { kind: "ok"; result: { ok: true; value: T }; spent: Spent }
  | { kind: "bad"; failure: CallFailure; detail: string; spent: Spent }
  | { kind: "upstream"; failure: CallFailure; error: Error }
  | { kind: "not-sent"; error: Error };

/**
 * **发一趟、拿回来、解析** —— 文本那三处（`derive` / `compile-game` / `compile-td-game`）
 * 共用的那一段。⚠️ 以前它是**抄三遍**的，而三遍里各自对「失败」的处理还都不一样。
 *
 * ⚠️ **只管一次往返**：`attempts` 的累加与 `failures` 的追加是调用方的事（见 `spentCall`）——
 *   因为账的一格是**一次调用**，不是一次往返（`CONTEXT.md` 的「调用 / 往返」）。
 *
 * ⚠️ **失败是返回值，不是抛**（除了上游那一档）：调用方得先把这一趟记进账，再决定重采样还是收工。
 *   抛出去的话账就漏了 —— 而「花了钱是事实，失败不改变这个事实」（票 46）。
 */
async function onceThrough<T>(o: {
  transport: Transport; prompt: string; fetchImpl?: typeof fetch; timeoutMs?: number;
  /** 出 schema 问题时那句话里的主语：「推导出来的清单」/「编译出来的配置」/「编译出来的关卡」。 */
  what: string;
  parse: (input: unknown) => { ok: true; value: T } | { ok: false; errors: string[] };
}): Promise<Once<T>> {
  let r: Awaited<ReturnType<typeof callText>>;
  try {
    r = await callText({ ...o.transport, prompt: o.prompt,
      ...(o.fetchImpl !== undefined ? { fetchImpl: o.fetchImpl } : {}),
      ...(o.timeoutMs !== undefined ? { timeoutMs: o.timeoutMs } : {}) });
  } catch (e) {
    // ⚠️⚠️ **判据翻过来了：点名的那个类落「没上路」，其余**默认**落「上游没给可用的应答」**
    //   （票 51 的 Q1 = (d)，2026-10-12）。以前是反的（「不是 `UpstreamCallError` ⇒ 我们没发出去」），
    //   而那条兜底把**两张花了钱的脸**（200 + 非 JSON、200 + JSON 但形状炸）一律记成「没发」。
    //   ⚠️ **方向为什么这样选**：兜底报「没发」是**记账撒谎**（丢掉一整笔真花销），
    //   兜底报「上游没给可用的应答」是**记账保守** —— 而它在 `UpstreamCallError` 的文档里
    //   本来就是 `http` 那一档的定义（「非 2xx、body 不是 JSON、连不上」，含「其余说不出名目的」）。
    //   ⇒ `failure` 取不到时落 `"http"`：它正是「上游没给一个可用的应答」这个名字。
    const err = e as Error;
    return e instanceof NotSentError
      ? { kind: "not-sent", error: err }
      : { kind: "upstream", failure: e instanceof UpstreamCallError ? e.failure : "http", error: err };
  }
  // ⚠️ 上游自报的模型名与用量要带出来 —— 它们是「花了什么」的事实（票 45），而这一层以前把它们丢了。
  const spent: Spent = {
    ...(r.servedModel !== undefined ? { model: r.servedModel } : {}),
    ...(r.usage !== undefined ? { usage: r.usage } : {}),
  };
  // ⚠️ **截断只用来「解释失败」，不拿它推翻一次成功。** 先解析、再校验，两关都过了就是成功；
  //   只有没过时才回头看 `stop_reason`。反过来的话，一份**完整**的产出会因为 `stop_reason`
  //   被判失败、丢掉重来（多花一次钱），而被截断的产出又会被报成「模型吐了坏数据」（查错方向）。
  const truncated = r.stopReason === "max_tokens";
  let parsed: unknown;
  try { parsed = JSON.parse(stripFences(r.text)); }
  catch (e) {
    return truncated
      ? { kind: "bad", failure: "truncated", detail: "输出撞上了 max_tokens 被截断（不是模型吐了坏数据）", spent }
      : { kind: "bad", failure: "invalid-json", detail: `上游返回的不是合法 JSON：${(e as Error).message}`, spent };
  }
  const p = o.parse(parsed);
  if (!p.ok)
    return truncated
      ? { kind: "bad", failure: "truncated", spent,
          detail: `输出撞上了 max_tokens 被截断，而且也没过 schema：${p.errors.slice(0, 4).join("；")}` }
      : { kind: "bad", failure: "schema", spent,
          detail: `${o.what}不过 schema：${p.errors.slice(0, 4).join("；")}` };
  return { kind: "ok", result: p, spent };
}

/**
 * 一次**调用**的账：随往返累加，**最后一次性交出去**。
 *
 * ⚠️ **一格 = 一次调用，不是一次往返**（`CONTEXT.md` 的「调用 / 往返」：`attempts` 记的是
 *   「这一次调用里往返了几次」）。⇒ 重采样**不新开一格**，而是在同一格里把 `attempts` 加上去、
 *   把每次没成的原因追加进 `failures`。两个都留着，账才同时回答得了「重试烧了多少」
 *   **和**「每次为什么重来」—— 只留前者的旧账，把那四种病因混成了同一个分母。
 */
function spentCall(step: LedgerStep, target: string) {
  const t0 = Date.now();
  const failures: CallFailure[] = [];
  let trips = 0;
  let spent: Spent = {};
  return {
    trip(o: { failure?: CallFailure; spent?: Spent } = {}) {
      trips += 1;
      if (o.failure !== undefined) failures.push(o.failure);
      // ⚠️ 只有**成功**那一趟带 `spent`，而一趟调用里至多成功一次（成了就 break）
      //   ⇒ 后面失败的那些**盖不掉**它。
      if (o.spent !== undefined) spent = { ...spent, ...o.spent };
    },
    /** ⚠️ **一次都没发出去就返回 `null`** —— 账不记没上路的往返（票 46）。 */
    record(): LedgerCall | null {
      if (trips === 0) return null;
      return {
        step, target, upstream: "messages", ms: Date.now() - t0, attempts: trips,
        ...(failures.length === 0 ? {} : { failures }), ...spent,
      };
    },
  };
}

/** `data.ledger` 要的是数组 —— 一次都没发出去就是空数组（与 `pack` 那边的口径一致）。 */
const asLedger = (r: LedgerCall | null): LedgerCall[] => (r === null ? [] : [r]);
/** 把这一次调用的账装进 `CommandError`；没发出去就**不带**（票 46：只记真的发出去的）。 */
const ledgerCarrying = (r: LedgerCall | null): { ledger?: LedgerCall[] } => (r === null ? {} : { ledger: [r] });

function nextVersion(dir: string): number {
  if (!fs.existsSync(dir)) return 1;
  const vs = fs.readdirSync(dir).map((d) => /^v(\d+)\.json$/.exec(d)).filter((m): m is RegExpExecArray => m !== null).map((m) => Number(m[1]));
  return vs.length === 0 ? 1 : Math.max(...vs) + 1;
}

// ── compile-game：需求 + 资源包 → game-config ────────────────────────────────
//
// 与 `derive → pack` 完全同构（票 09 裁决 2）：**一次 LLM 调用编译 → 先落盘成文件 →
// 人过目 → 再装配**。产物 B 的那条链从此**首尾闭合**：需求 → 配置 →（票 33）站点。
//
// ⚠️ **输入用的是「资源包的 manifest」而不是 `asset-recipe/v1` 配方。**
//   两者是同一个清单的两种状态，而 manifest 是**实现态**、也正是 config 必须解析通过的那一份。
//   用配方会让「模型看到的」与「校验依据的」成为两份 —— 那正是本仓库反复吃的亏。

/** 外壳视口。⚠️ 与票 32 裁决 1 的外壳常量同值；调用方可以显式传（CLI 传的就是外壳那一份）。 */
export const DEFAULT_VIEWPORT = { w: 480, h: 270 } as const;

/**
 * 给模型看的**形状骨架**。⚠️ **它必须是能过 schema 的** —— 导出它是为了让测试能直接断言这件事。
 *
 * 票 40 抓到过三条「**提示词教模型写一个会被自己拒收的形状**」（`tileable` 少一个轴、
 * 锚点没进提示词、帧数两份实现）。这里的等价风险是：教模型把 `at` 当左上角、
 * 或者把 HUD 摆到屏幕外。**示例错了，模型就会错，而且是以一种「看起来没问题」的方式错。**
 */
export const gameConfigExample = {
  format: "game-config/v1",
  world: { size: { w: 1440, h: 270 } },
  scene: { background: { asset: "<背景资源的 id>" } },
  player: {
    asset: "<玩家资源的 id>",
    // ⚠️ **三个键由契约那一份派生**（票 61：这三个动作名全仓只写一遍，见 `game-config.ts`）——
    //   骨架里手写一遍就是第四个事实源，而「示例错了，模型就会错」。值的占位符逐键生成。
    anims: Object.fromEntries(PLAYER_ACTION_NAMES.map((n) => [n, `<${n} 动画名>`])),
    at: { x: 40, y: 250 },
  },
  terrain: [{ x: 0, y: 250, w: 1440, h: 20 }],
  entities: [
    { id: "pickup-1", kind: "pickup", at: { x: 300, y: 250 }, asset: "<可拾取资源的 id>" },
    { id: "block-1", kind: "solid", at: { x: 500, y: 250 }, asset: "<静态障碍资源的 id>" },
    { id: "mover", kind: "hazard", at: { x: 800, y: 250 }, asset: "<危险物资源的 id>", anim: "<动画名>",
      motion: { kind: "cycle", axis: "x", distance: 200, periodMs: 4000 } },
    { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "<终点资源的 id>", anim: "<动画名>" },
  ],
  hud: {
    panel: { asset: "<ui 面板资源的 id>", at: { x: 72, y: 238 }, size: { w: 72, h: 32 } },
    pip: { asset: "<ui 标记资源的 id>", at: { x: 12, y: 250 }, step: { x: 20, y: 0 } },
  },
  objective: { kind: "collect-then-reach", gate: "gate" },
} as const;

/**
 * 「这件资源**是不是九宫格**」那一截 —— **两份清单共用同一份**（票 85 · 票 71 的 Q3 = (b)）。
 *
 * ⚠️ **为什么是共用函数，而不是两份清单各写一遍**：要防的是**词**的漂，不是行的漂 ——
 *   各写一遍，就没有任何东西保证两处**永远**说同一句话。
 *   ⛔ **它只负责这一截**（票 71 的边界 2 逐字）：不合并两份清单的整体实现、不碰 `role`、
 *   不统一背景层的换行位置、不改清单的其他内容。
 *
 * ⚠️ **措辞是票 71 的 Q1 = (乙)：标记词 + 半句后果** —— 而那半句是**分情况**的：
 *   九宫格那侧「声明尺寸**可**与包内尺寸不同」，非九宫格那侧「**必须**一致」。
 *   ⚠️ **非九宫格那一侧不许沉默**（票 71 的边界 1 逐字：「不能只给九宫格资源加标记
 *   而让非九宫格资源保持沉默」）：沉默会被读成「这件**没有**这个属性」，
 *   而它真正的意思是「这件**不许**改尺寸」—— 正是[票 08] 吃过的那个形状。
 *
 * ⚠️ **词只用「九宫格」**（Q2 = (a)）：判据报错（`auditPanelSize`）与 `CONTEXT.md` 的术语表正名
 *   **都是这个词** ⇒ 模型被拒之后能把清单与报错**对上**。
 *   · ⛔ `ninePatch` —— config 这一发的模型**从没见过它**（它只活在配方那一发的散文里）；
 *   · ⛔ `scale9Borders` —— 那是**包内部**的字段名，而这里要传的是**事实**、不是字段。
 *
 * ⚠️ **为什么清单上要有这一截**：config 那一步的模型要在 `hud.panel.size` 这类格子里**声明尺寸**，
 *   而「声明 ≠ 包」**只有九宫格才合法**（`auditPanelSize`）—— 而那个事实住在包里，
 *   **判据拿得到、模型拿不到**（票 71 §1 量过真发出去的 body：`scale9Borders` / `九宫格` /
 *   `ninePatch` **三个词都零命中**）。⇒ 这一截就是把那个事实**印出来**。
 *
 * ⚠️ **只印在 `ui` 上**（2026-10-15 人裁）：声明尺寸的那几个格子**全部**由 `ref(…, ["ui"])` 锁着
 *   （横版 `game-config.ts:334`；塔防 `td-config.ts:428-429`）—— 非 ui 的资产**根本没有那个落点**，
 *   那半句后果印在它身上是**一句空话**（而塔防那份包 21 件里 17 件是 sprite/animation）。
 *   ⇒ 不适用的资产返回**空串**。
 *
 * ⚠️ **返回值带着它后面那个 `· ` 分隔符**（不适用时返回空串）——
 *   这样两份清单的调用点**逐字相同**（`… · ${nineSliceNote(a)} · 锚点 …`），
 *   接缝只剩这一处；分隔符若由调用方各接一次，两处就能漂。
 */
const nineSliceNote = (a: AssetPackEntry): string =>
  a.kind !== "ui"
    ? ""
    : a.scale9Borders !== undefined
      ? "**九宫格**（声明尺寸可与包内尺寸不同） · "
      : "**非九宫格**（声明尺寸必须与包内尺寸一致） · ";

/** 把资源包渲染成模型能读的一张清单：id / 种类 / 尺寸 / **锚点落点** / 动画名 / 背景层。 */
function resourceBrief(manifest: AssetPackManifest): string {
  const lines: string[] = [];
  for (const a of manifest.assets) {
    const anims = a.animations ?? [];
    const animText = anims.length === 0
      ? "（无动画，引用时不必给 anim）"
      : anims.map((x) => `${x.name}(${x.frames.length} 帧)`).join(" · ");
    lines.push(`- \`${a.id}\` · ${a.kind} · ${a.size.w}×${a.size.h}px · ${nineSliceNote(a)}锚点 {x:${a.anchor.x}, y:${a.anchor.y}} · 动画：${animText}`);
    if (a.layers && a.layers.length > 0)
      lines.push(`    背景层（远→近）：${a.layers.map((l) => `${l.name}(parallax ${l.parallax}${l.tileable?.x ? " 可平铺" : ""})`).join(" · ")}`);
  }
  return lines.join("\n");
}

export type CompileRuntimeOptions = {
  /** `run/v<N>/game-design.json` —— 理解层的收尾产物（票 10）。 */
  designPath: string;
  /** 资源包目录 —— 它**就是**模型要看的资源清单，也是校验的依据。 */
  packDir: string;
  outRoot: string;
  /**
   * 编**哪一关**。⚠️ 省略 = 设计层的第一关。
   *  ⚠️ `CONTEXT.md` 的 [[Game Config]] 钉着「**一个 game-config = 一个关卡**」，
   *  而「多个关卡怎么索引」**仍是地图上的雾** ⇒ 本票只编一关，**不假装支持多关**。
   */
  levelId?: string;
  transport?: Transport;
  fetchImpl?: typeof fetch;
  /** 外壳视口。默认 480×270（与票 32 的常量同值）。⚠️ **它是外壳的常量，不是数据** —— 由调用方传。 */
  viewport?: { w: number; h: number };
  /** 外壳画 HUD 文字的行高（票 09）。默认 [[DEFAULT_HUD_LINE_HEIGHT]] —— ⚠️ 外壳那一份由壳传进来。 */
  hudLineHeight?: number;
  /** 一次上游调用的超时（毫秒）。默认 [[UPSTREAM_TIMEOUT_MS]] —— ⚠️ 测「超时」那条路时才传小的。 */
  timeoutMs?: number;
};

/**
 * **`RuntimeProfile` ⇒ 出哪一种 config 形状**（票 14 的 Q2：(β) profile 被**读**，用途是**分派**）。
 *
 * ⚠️ **今天只有一行、恒等于常数 —— 那是预期的**（同票 05 给 `mechanics`/`capabilities` 那两个
 *   数组写的自白）：它是**给第二个成员留的位**。第二个成员落地那天，这张表才开始说话，
 *   而**拒绝**早在 `compile-design`（票 10）就发生了 —— 本步只管「哪一代 ⇒ 哪一种形状」。
 */
const CONFIG_SHAPES: Record<string, { format: string; artifactKind: string }> = {
  platformer: { format: "game-config/v1", artifactKind: "game-config" }
};

// ── 手感：模型**必须拿到**的两个数（票 21）────────────────────────────────────
//
// ⚠️ 提示词从前只写「玩家能跳的高度是有限的，台阶别高过它」—— 一句**没有数**的话。
//   于是模型被要求摆出一个走得到的关卡，却**没被告知能跳多远**，而 `auditReachability`
//   正好是六条判据里唯一能在正常链路上响的那条（票 21 量到的）⇒ 那一声响是**信息缺口**，
//   不是模型不听话。
//
// ⚠️ 数**从契约推、不写成字面量**：默认手感只有一处来源（`DEFAULT_PLAYER_MOVE` ——
//   外壳（`demo/src/world.ts`）与判据（`playerMoveOf`）读的是同一个常量）⇒ 把 60.5 抄进
//   提示词就是「两套真相」，而它漂移的代价是**模型照提示词摆、判据照自己算**，两边打架。
// ⚠️ `jumpSpan` 与 `auditReachability` 的 `hop` **是同一条抛物线的同一个函数**（票 21 抽的）。
const DEFAULT_JUMP_APEX = maxJumpHeight(DEFAULT_PLAYER_MOVE);
const DEFAULT_JUMP_SPAN = jumpSpan(DEFAULT_PLAYER_MOVE);   // ⚠️ 同高落点 —— 最紧的那一半

/**
 * 设计 + 这一代外壳 + 资源包 → 一份 game-config，落盘到 `<out>/<id>/game-configs/v<N>.json`。
 *
 * ⚠️ **它是 `compile-game` 的接班人**（票 14 的 Q1：(a) 取代）—— 旧的「需求 + 资源包」那道
 *   **没有了**：新链的 config 必须**从设计层长出来**（`levels[].layout`、每关的 `entities[]`、
 *   `world.structure` 都在设计层），而从需求硬猜正是 `compile-td-game` 那条
 *   「需求没说的，它们只能拿示例填」的老路。⚠️ 塔防那条**一个字不动**（R4）。
 *
 * ⚠️ **两类失败要分开**（票 14 的 Q5 裁定，人类原话：「后者不应该默认重采样，否则会把**确定性的
 *   编译/设计错误**伪装成**模型生成失败**」）：
 *     · **入参/结构不过**（线形状不过 · v3 契约不过）⇒ 那是**模型没生成好** ⇒ **重采样**，3 次用尽才抛；
 *     · **过得了契约、过不了业务校验**（引用族 · 自洽族 · 屏幕空间 · 层覆盖）⇒ 那是**确定性的编译错误** ⇒
 *       **不重采样、直接抛**，而且**不落盘**。
 *    ⚠️ 「不落盘」是**与旧行为相反**的一处：`compileGame` 当年 audit 不过也照落（理由是票 09 裁决 2
 *    「人过目」）—— 而 **R9 把人工点收成了唯一一个、且在清单处**，config 那里**已经没有读者**了
 *    ⇒ 「坏配置比没配置更坏」（旧代码自己的注释）这一条终于说了算。
 */
/**
 * 这份 config 的背景层，拼成 `auditLayerCoverage` 要吃的那几样 primitive（票 65）。
 *
 * ⚠️ **解不到那件资源时一条都不给** —— 「这份 config 指着一个不存在的背景」由
 *   `auditGameConfig` 的**引用族**报（它就在上面那批里）。本判据只回答**几何**那一问
 *   （盖不盖得住世界），不重复回答「这个 id 存不存在」。
 * ⚠️ 而层的名字这里拼成 `${背景 id}.${层名}` —— 契约把帧名**逐字钉死**就是这个形状
 *   （`assetpack.ts` 的 superRefine）⇒ 与站点装配侧读到的 `draw.frame` 是**同一个字符串**，
 *   这正是「两侧 message 逐字相等」那条判据（验收条件 4）站得住的原因。
 */
function backgroundLayerEntries(config: GameConfig, manifest: AssetPackManifest): LayerCoverageEntry[] {
  const a = manifest.assets.find((x) => x.id === config.scene.background.asset);
  if (a === undefined) return [];
  return (a.layers ?? []).map((l, i) => ({
    where: `scene.background[${i}]`,
    name: `${a.id}.${l.name}`,
    parallax: l.parallax,
    drawn: layerDrawnSize({ tileable: l.tileable, nominal: a.size }, config.world.size),
  }));
}

export async function compileRuntime(opts: CompileRuntimeOptions): Promise<CommandResult> {
  const readJson = (p: string, what: string): unknown => {
    try { return JSON.parse(fs.readFileSync(p, "utf8")); }
    catch (e) { throw new CommandError("invalid", `${what}读不出来或不是 JSON：${p} —— ${(e as Error).message}`); }
  };
  const fmt = (e: { issues: readonly { path: readonly PropertyKey[]; message: string }[] }) =>
    e.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("；");

  const d = GameDesignSpecSchema.safeParse(readJson(opts.designPath, "设计"));
  if (!d.success) throw new CommandError("invalid", `设计不过 schema：${fmt(d.error)}`);
  const design = d.data;

  // ── 哪一代外壳（票 14 的 Q2）────────────────────────────────────────────
  // ⚠️ 查不到 = **调用方的错**（选了一个不存在的代）—— 与票 10 的 `pickProfile` 同一条口径。
  const want = design.game.runtimeProfile;   // ⚠️ 从**设计层**读（不从入参）—— 开个入参就是给同一个事实第二个来源
  const profile = resolveRuntimeProfile(want);
  if (profile === undefined)
    throw new CommandError("invalid",
      `设计指着的那一代外壳不存在：\`${runtimeProfileRef(want)}\`（注册表里第一阶段只有 ` +
      `\`${runtimeProfileRef(PLATFORMER_V1)}\`）—— ⚠️ 拒绝**本该在** compile-design 那一步就发生（票 10）。`);
  const shape = CONFIG_SHAPES[profile.id];
  if (shape === undefined)
    throw new CommandError("invalid",
      `这一代外壳还没有对应的 config 形状：\`${runtimeProfileRef(profile)}\` —— ` +
      "⚠️ 加一个成员 = 往 `CONFIG_SHAPES` 加一行 + 一份新的 config 契约，**不是**改现有 config 的形状（票 05 Q3(b)）。");

  const manifestPath = path.join(opts.packDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new CommandError("usage", `不是资源包（没有 manifest.json）：${opts.packDir}`);
  const mp = parseAssetPack(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  if (!mp.ok) throw new CommandError("invalid", `资源包不过 schema：${mp.errors.slice(0, 4).join("；")}`);
  const manifest = mp.value;

  const levelId = opts.levelId ?? design.levels[0]?.id;
  const level = design.levels.find((l) => l.id === levelId);
  if (level === undefined)
    throw new CommandError("usage",
      `设计里没有这一关：\`${levelId ?? "（空）"}\`（现有：${design.levels.map((l) => l.id).join(" / ") || "无"}）`);

  // ⚠️ **查的是两个字段空不空，不是对象在不在** —— 生产里两个壳永远传一个「定义了、但 `baseUrl`
  //   可能是空串」的对象（票 06 量到的）⇒ 只查对象的话，`fetch("" + "/v1/messages")` 那一枪会被记成
  //   `failure: "http"`，**一个本地配置错被计成上游故障**。⚠️ 报错里点名那两个环境变量。
  if (!opts.transport || opts.transport.baseUrl === "" || opts.transport.apiKey === "")
    throw new CommandError("upstream",
      "编译需要文本上游：ANTHROPIC_BASE_URL 与 ANTHROPIC_AUTH_TOKEN **两个都要给**。" +
      "⚠️ 但配置是文件 —— 人可以直接写一份。");

  const vp = opts.viewport ?? DEFAULT_VIEWPORT;
  const prompt = `你是游戏关卡设计师。把下面这一关的**设计**编译成一份 game-config（game-config/v1）——
那是**给外壳吃的菜谱**，你只填「哪里有、参数是多少」。

只调 ${CONFIG_TOOL_NAME} 工具，不要解释。

# 铁律（**每条都会被校验器检查，违反直接拒收**）

1. 顶层**只有**这八个键：format / world / scene / player / terrain / entities / hud / objective。多一个就拒。
2. \`format\` 恒为 \`"game-config/v1"\`。坐标一律**非负整数** —— \`x: 10.5\` 会静默糊掉像素网格，直接拒。
3. ⚠️ **\`at\` 是「资源锚点落在的那个点」，不是左上角。** 本包的锚点含义见下面每条清单。
   最要命的一条：**底边中心的资源（角色、道具、危险物），站在地面线上的写法是 \`at.y = 地面线的 y\`**，
   **不是** \`地面线 − 高\`。写成后者，整个世界的道具都会浮在半空。
4. \`world.size.h\` **必须等于视口高 ${vp.h}**（这个游戏单屏高，只横向滚动；视口是 ${vp.w}×${vp.h}）。
   \`world.size.w\` 自己定（横向滚多远）。
5. \`kind\` ∈ \`solid\` / \`pickup\` / \`hazard\` / \`goal\` / \`decor\`。
   **看得见的静态碰撞体（行李堆、台阶）写 \`solid\` 实体**；\`terrain\` 只放**看不见的**碰撞
   （地面线、关卡边界、隐形墙）。
6. \`objective\` **不带数量**：\`{"kind":"collect-then-reach","gate":"<某个 goal 实体的 id>"}\`。
   要捡几件由 \`kind:"pickup"\` 的实体条数**派生** —— 多写一个数就拒。
7. \`gate\` 必须指向一个**真的存在**且 \`kind:"goal"\` 的实体；实体 id **不得重复**；**至少要有 1 个 pickup**。
8. ⚠️ **\`hud\` 的坐标是屏幕空间（≤ ${vp.w}×${vp.h}），不是世界空间。**
   例如世界可以宽 1440，但屏幕只有 ${vp.w} 宽 —— 判的是**整个盒子**：清单里那件资源的**锚点落在 \`at\` 上**，
   按你声明的**尺寸**量出来的矩形，**四条边**都要落在屏幕内（左边、上边一样管，不是只看右边超没超）。直接拒。
9. \`anim\` 只在资源有**多个**动画时才需要，且必须是清单里**真实存在**的动画名。
   ⚠️ **只许用下面清单里的 id 与动画名** —— 清单里没有的一律拒收。
10. ⚠️ \`player.anims\` 那三格（${PLAYER_ACTION_NAMES.map((n) => `\`${n}\``).join(" / ")}）**三格互不相同** ——
   必须是三个**不同**的动画名。外壳按这三个键**各取一路**播一种动作：三格填同一个名字，
   玩家三种动作在屏幕上长得一模一样，而这份配置会被拒收。⇒ 去清单里给这三格各挑一路不同的。

# 你在给哪一代外壳编
\`${runtimeProfileRef(profile)}\` —— 它**只实现了上面那套行为原语**，别写它做不了的东西（写了也跑不动）。

# 这一关的设计（GameDesignSpec）
⚠️ **照它摆**：\`world.structure\` 说的是**空间怎么分层**（几条横带、前景中景背景），
而这一关的 \`layout\` 说的是**从哪儿走到哪儿、路上有什么** —— 别自己发明一套布局。
${designBrief(design)}

# 资源包清单（**只许用这里面的东西**）
${resourceBrief(manifest)}

# 手感：玩家跳多高、一跃多远（⚠️ **关卡不照这套摆就会「够不到」**）
玩家**只有单跳**（没有二段跳、没有冲刺）。**默认手感** —— ⚠️ 正是**你不写 \`player.move\` 时外壳读的那一套**：

跑速 \`speed\` = ${DEFAULT_PLAYER_MOVE.speed}px/s · 起跳初速 \`jumpVelocity\` = ${DEFAULT_PLAYER_MOVE.jumpVelocity}px/s · 重力 \`gravity\` = ${DEFAULT_PLAYER_MOVE.gravity}px/s²

由它推出的两条**硬上限** —— 照它们摆，关卡就是通的：

1. **跳跃顶点 = ${DEFAULT_JUMP_APEX.toFixed(1)}px**（= 初速² ÷ (2 × 重力)）。
   **台阶、平台、墙的落差别高过这个数** —— 高过就是够不到。
2. **同一高度上，一跳最多跨 ${DEFAULT_JUMP_SPAN.toFixed(1)}px**（= 跑速 × 滞空时间，滞空 = 2 × 初速 ÷ 重力）。
   落点**比起点低**时可以更远（掉得越久走得越远），但**同一水平线上这就是上限** —— 比它宽的沟过不去。

⚠️ **别写 \`player.move\`**（骨架里也没有它）—— 写了上面两条数就不成立了。真要写，就照同样的两条公式重算、并照你写的那一套摆。

${SKELETON_SHAPE_HEADING}
${JSON.stringify(gameConfigExample, null, 2)}

${SKELETON_SHAPE_NOTE}
按这一关的设计把东西铺开，并让它**真的可通关**：照上面「手感」那一节的两条硬上限摆 ——
**台阶别高过跳跃顶点、沟别宽过同高跨度**。`;

  // ⚠️ **账**：一格 = 一次调用（`STRUCTURED_CALL_ATTEMPTS` 次往返都记在里面）。
  const call = spentCall("compile-runtime", "game-config");
  let checked: ReturnType<typeof parseGameConfig> | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < STRUCTURED_CALL_ATTEMPTS; attempt++) {
    const once = await onceThroughTool({
      transport: opts.transport, body: JSON.stringify({
        // ⚠️ 与 `callText` 同源（票 24 的实况：代理**请求一个、回另一个**）。
        model: "deepseek-v4-pro", max_tokens: 16_000, thinking: { type: "disabled" },
        ...forcedTool(CONFIG_TOOL_NAME, CONFIG_TOOL_DESCRIPTION, ConfigToolSchema),
        messages: [{ role: "user", content: [{ type: "text", text: prompt }] }]
      }),
      tool: CONFIG_TOOL_NAME, schema: ConfigToolSchema,
      ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
      ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {})
    });
    if (once.kind === "upstream") {
      call.trip({ failure: once.failure });
      throw new CommandError("upstream", once.error.message, ledgerCarrying(call.record()));
    }
    // ⚠️ 「没上路」那一档在**这条路上不该出现**（凭据上面已经查过）—— 留着这一句是为了让类型收窄
    //   说得出口，而它真出现时按「上游不可达」报（与 `derive` 当年同款）。
    //   ⚠️ **2026-10-12（票 51 的 Q4 = (a)）**：这一注是从 `planAssets` 那处**逐字补过来的**
    //   —— 上面那条路的返回类型是 `Once<T>`（四档），而 `onceThroughTool` 的出口只有三档
    //   （`upstream` / `bad` / `ok`），所以这一行**够不着**；删它得另给工具链单开一个三档类型，
    //   那超出本票「只做 `not-sent` 这一档」的边界。⚠️ 而且它**不是** `not-sent` 的生产者。
    if (once.kind === "not-sent") throw new CommandError("upstream", once.error.message);
    if (once.kind === "bad") { call.trip({ failure: once.failure, spent: once.spent }); lastError = once.detail; continue; }
    // ⚠️ **线形状过了不算数**：真正的判据是 v3 那份契约（实体 id 不重复那条 refine 住在它里面）。
    const truth = parseGameConfig(once.result.value);
    if (!truth.ok) {
      call.trip({ failure: "schema", spent: once.spent });
      lastError = `配置不过契约：${truth.errors.slice(0, 4).join("；")}`;
      continue;
    }
    call.trip({ spent: once.spent });
    checked = truth;
    break;
  }
  if (!checked?.ok) throw new CommandError("invalid", lastError, ledgerCarrying(call.record()));

  const config = checked.value;

  // ── ⚠️ **业务校验：确定性失败，不重采样、不落盘**（票 14 的 Q5 裁定）────────────
  //
  // ⚠️ 这里跑的是 `site` 要跑的同一批校验（**减去第四族里那些要世界描述的** —— 见下）。
  //   **同一份实现，不抄第二份**。
  // ⚠️ **「层盖不住世界」这一条 2026-10-13 从装配期提前到了这里**（票 65）：
  //   第十五跑的段 B 花了 11 张图、跑完全链，最后**死在站点装配期**才发现世界宽 1440 而
  //   两层不平铺的背景**盖不住**（各剩 384 / 96px）。⚠️ **它一分钱也省不下**（`config` 在
  //   `pack` 之后，图已经买完）—— 提前的价值是**失败点前移**（从最后一步到第二段的第一步）、
  //   **判据与真实渲染语义同源**、**失败账目分得开**（几何不成立 ⇒ `failures: []` · `attempts: 1`，
  //   不像契约没过那样被记成 `schema`）。
  //   ⚠️ 判据与规则**都住 `contracts`**（`layer-coverage.ts`），站点装配调的是**同一个函数**
  //   ⇒ 两侧不会再各说各话。⚠️ 而这一批里**只多这一条** —— 第四族另外那两条 coverage 判据
  //   吃 `coverage.json` 的像素比例（那要 PNG 解码器），**仍然只有装配期能跑**。
  const issues: ConfigIssue[] = [
    ...auditGameConfig(config, manifest),
    ...auditScreenSpace(vp, gameHudScreenItems(config, manifest,
      { lineHeight: opts.hudLineHeight ?? DEFAULT_HUD_LINE_HEIGHT })),
    ...auditLayerCoverage(vp, config.world.size, backgroundLayerEntries(config, manifest))
  ];
  const hard = issues.filter((i) => i.severity === "error");
  if (hard.length > 0)
    throw new CommandError("invalid",
      `编译出来的配置**过不了校验**（${hard.length} 条硬失败）：\n` +
      hard.slice(0, 6).map((i) => `  · ${i.where}: ${i.message}`).join("\n") +
      "\n⚠️ **这不是模型没生成好** —— 一份过得了契约、过不了业务校验的配置，说明是**这份设计配这个包**" +
      "做不出合法的关卡（引用解不到 / 东西摆在世界外 / HUD 跑出屏幕）⇒ **不重采样、也不落盘**：" +
      "重抽一次改不了这些事实，而落一份坏配置比不落更坏。\n" +
      "   要去的地方：设计层或资源清单（不是再抽一次）。",
      ledgerCarrying(call.record()));

  const dir = path.join(opts.outRoot, manifest.id, "game-configs");
  fs.mkdirSync(dir, { recursive: true });
  const version = nextVersion(dir);
  const file = path.join(dir, `v${version}.json`);
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");

  const pickups = config.entities.filter((e) => e.kind === "pickup").length;
  return {
    command: "compile-runtime",
    summary: [
      `配置已落盘：${rel(opts.outRoot, file)}（v${version}）`,
      `${config.entities.length} 个实体 · ${pickups} 个拾取物 · 世界 ${config.world.size.w}×${config.world.size.h}` +
        ` · 这一关 \`${level.id}\` · 外壳 \`${runtimeProfileRef(profile)}\``,
      `✅ 校验全过${issues.length ? `（${issues.length} 条警告）` : ""} —— 下一步：game-maker site ${rel(opts.outRoot, opts.packDir)} --config ${rel(opts.outRoot, file)}`,
      ...issues.map((i) => `⚠️ ${i.where}: ${i.message}`)
    ],
    data: {
      gameId: manifest.id, levelId: level.id, version, configPath: rel(opts.outRoot, file),
      entityCount: config.entities.length, pickupCount: pickups,
      worldSize: config.world.size, issues: issues.map((i) => `⚠️ ${i.where}: ${i.message}`),
      ok: true, ledger: asLedger(call.record())
    },
    artifacts: [{ path: rel(opts.outRoot, file), kind: shape.artifactKind }]
  };
}

// ── 塔防关卡编译（施工单第 1 条）──────────────────────────────────────────────

/**
 * 给模型看的**塔防关卡骨架**。
 *
 * ⚠️ **它必须是能过 `parseTdConfig` 的** —— 导出它是为了让测试能直接断言这件事
 *   （与 `gameConfigExample` 同一条规矩：**示例错了，模型就会以「看起来没问题」的方式错**）。
 * ⚠️ 资源 id 一律写**占位符**，否则示例会把某一关的 id 焊进提示词。
 * ⚠️ 而它里面那张 **18 行 × 32 字符的地图是这一段最值钱的部分** ——
 *   逐字给出「一行多长、五个字符怎么摆、走道怎么连成一条」，比任何文字描述都准。
 * ⚠️ **它里面没有 `path` 那一块**（票 12）：路径由工具从地图派生，模型不写它。
 *   这也正是这个骨架必须**照实**的原因 —— 示例里留一块不该写的东西，模型就会照写。
 * ⚠️ 而那张地图的走道**必须自己就是一条单线**（票 12 的「走道不许分叉」）——
 *   示例错了，模型就会以「看起来没问题」的方式错（票 40 的教训）。第 5 行原本
 *   在最左端还留了五个走道格，于是 `(6,4)` 成了一个 T 字口 ⇒ **已收回去**。
 *   （⚠️ 它是**行格式的演示**，不是一张可以拿来用的地图 —— 提示词里明说了这条。）
 */
export const tdConfigExample = {
  format: "td-config/v1",
  world: { size: { w: 480, h: 270 } },
  arena: {
    cell: 15,
    walkChar: ":",
    tiles: {
      "#": { asset: "<墙砖的 id>" }, ".": { asset: "<地面砖的 id>" },
      "=": { asset: "<货架砖的 id>" }, ":": { asset: "<走道砖的 id>" },
      "+": { asset: "<卷帘门的 id>" },
    },
    rows: [
      "################################",
      "################################",
      "#..............................#",
      "#..==========================..#",
      "#.....:::::::::::::::::::::::::+",
      "#.....:........................#",
      "#.....:........................#",
      "#.....:.======================.#",
      "#.....:........................#",
      "#.....:........................#",
      "#.....:........................#",
      "#.....:........................#",
      "#::::::........................#",
      "#..............................#",
      "#..............................#",
      "#..==========================..#",
      "#..............................#",
      "#..............................#",
    ],
  },
  scene: { slot: { asset: "<插槽的 id>" }, slotActive: { asset: "<高亮框的 id>" } },
  // ⚠️ **没有 `path` 这一块** —— 路径由工具从你画的地图**派生**（票 12），你不用写它。
  core: { asset: "<柜台的 id>" },
  slots: [
    { id: "s1", at: { x: 187, y: 112 } }, { id: "s2", at: { x: 277, y: 112 } },
    { id: "s3", at: { x: 157, y: 202 } }, { id: "s4", at: { x: 262, y: 202 } },
  ],
  towers: [
    { id: "<机关 id>", name: "<显示名>", asset: "<机关的 id>", attack: "single", targeting: "first",
      cost: 40, upgradeCost: 60,
      levels: [{ range: 56, damage: 5, fireMs: 480 }, { range: 68, damage: 9, fireMs: 380 }],
      projectile: { asset: "<抛射物的 id>", speed: 220 } },
    { id: "<范围机关的 id>", name: "<显示名>", asset: "<范围机关的 id>", attack: "aoe", targeting: "first",
      cost: 60, upgradeCost: 90,
      levels: [
        { range: 40, damage: 3, fireMs: 900, slow: { factor: 0.6, ms: 1200 } },
        { range: 52, damage: 5, fireMs: 800, slow: { factor: 0.45, ms: 1600 } },
      ],
      fx: { asset: "<放电特效的 id>", anim: "<动画名>" } },
  ],
  enemies: [
    { id: "<敌人 id>", name: "<显示名>", asset: "<敌人的 id>", anim: "<动画名>",
      hp: 20, speed: 40, bounty: 6, armor: 0, leakCost: 1 },
  ],
  waves: [
    { groups: [{ enemy: "<敌人 id>", count: 6, gapMs: 800, delayMs: 0 }] },
    { groups: [{ enemy: "<敌人 id>", count: 8, gapMs: 700, delayMs: 0 }] },
    { groups: [{ enemy: "<敌人 id>", count: 10, gapMs: 700, delayMs: 0 }] },
    { groups: [{ enemy: "<敌人 id>", count: 12, gapMs: 600, delayMs: 0 }] },
    { groups: [{ enemy: "<敌人 id>", count: 14, gapMs: 600, delayMs: 0 }] },
  ],
  economy: { startScrap: 120, lives: 20, waveBonus: 35 },
  hud: {
    panel: { asset: "<顶栏的 id>", at: { x: 0, y: 0 }, size: { w: 480, h: 30 } },
    readout: { at: { x: 22, y: 5 }, step: { x: 0, y: 10 } },
    icons: {
      scrap: { asset: "<废料图标的 id>", at: { x: 8, y: 6 } },
      life: { asset: "<声望图标的 id>", at: { x: 8, y: 16 } },
    },
    buttons: { asset: "<按钮底板的 id>", at: { x: 300, y: 4 }, size: { w: 44, h: 22 }, step: { x: 48, y: 0 } },
    start: { asset: "<按钮底板的 id>", at: { x: 444, y: 4 }, size: { w: 28, h: 22 } },
  },
} as const;

/**
 * 资源包清单 —— `resourceBrief` 的塔防版。
 *
 * ⚠️ 带上 `role`（模型靠它认出「**哪个是砖**」）、**锚点**与**尺寸**。
 *   ⚠️ 锚点那一项是补上的：第一版只写了 kind/size/role/animation，把锚点**悄悄丢了** ——
 *   而那正是「两份实现必然漂」的样子（横版那份是带锚点的）。
 *   塔防这边尤其不能丢：**砖的锚点必须正中**（票 07），而模型得看得到它才能照做。
 *
 * ⚠️ **「是不是九宫格」那一截不在这里写**（票 85）：它由 `nineSliceNote` 出，**两份清单共用同一份**
 *   —— 要防的正是上面那种「两份实现必然漂」，而那次漂的恰好就是**同一个形状**。
 *   ⛔ 别就地把那句话抄进来：词一漂，模型会读到两句不一样的话，**而没有任何判据会红**。
 */
function tdResourceBrief(m: AssetPackManifest): string {
  return m.assets.map((a) => {
    const anim = a.animations?.length ? `动画：${a.animations.map((x) => `${x.name}(${x.frames.length} 帧)`).join(" · ")}` : "（无动画）";
    const layers = a.layers?.length ? ` · 背景层（远→近）：${a.layers.map((l) => l.name).join(" → ")}` : "";
    return `- \`${a.id}\` · ${a.kind} · ${a.size.w}×${a.size.h}px · ${nineSliceNote(a)}锚点 {x:${a.anchor.x}, y:${a.anchor.y}} · ${a.role} · ${anim}${layers}`;
  }).join("\n");
}

export type CompileTdGameOptions = {
  requirementPath: string;
  /** 资源包目录 —— 它**就是**模型要看的资源清单，也是校验的依据。 */
  packDir: string;
  outRoot: string;
  transport?: Transport;
  fetchImpl?: typeof fetch;
  /** 外壳视口。默认 480×270。 */
  viewport?: { w: number; h: number };
  /** 外壳画 HUD 文字的行高（票 09）。默认 [[DEFAULT_HUD_LINE_HEIGHT]]。 */
  hudLineHeight?: number;
  /** 一次上游调用的超时（毫秒）。默认 [[UPSTREAM_TIMEOUT_MS]]。 */
  timeoutMs?: number;
  /**
   * 最多试几次。默认 **3**（不是 2 —— **校验不过也重采样**，而真跑量下来一次就过的概率只有 ~1/4）。
   * ⚠️ 每一次都是**一笔上游调用**，调小它就是省钱。
   */
  attempts?: number;
};

/**
 * 需求 + 资源包 → 一份 td-config，落盘到 `<out>/<id>/td-configs/v<N>.json`。
 *
 * ⚠️ **它跑的是「三族（契约层）+ 屏幕空间」**，与 `compileGame` 同一个口径 ——
 *   **几何族与「这一关通不通」跑不了**：那两族要的是世界描述与模拟器，而它们住在 `demo`
 *   （`assets → contracts` 是依赖图上写死的）。⇒ 那两族落在 `site`（票 11 定的）。
 *
 * ⚠️ **不过校验也照常落盘**（票 06/09 那条裁决）：**「人过目」的前提是他看得到哪儿不对**；
 *   不落盘他连看的东西都没有。退出码仍由回报里的 `ok` 决定。
 */
export async function compileTdGame(opts: CompileTdGameOptions): Promise<CommandResult> {
  const requirement = fs.readFileSync(opts.requirementPath, "utf8");
  const manifestPath = path.join(opts.packDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new CommandError("usage", `不是资源包（没有 manifest.json）：${opts.packDir}`);
  const mp = parseAssetPack(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  if (!mp.ok) throw new CommandError("invalid", `资源包不过 schema：${mp.errors.slice(0, 4).join("；")}`);
  const manifest = mp.value;
  if (!opts.transport) throw new CommandError("upstream", "编译需要文本上游；它现在不可达（配置是文件，人可以直接写一份）");

  const vp = opts.viewport ?? DEFAULT_VIEWPORT;
  const prompt = tdConfigPrompt(requirement, tdResourceBrief(manifest), tdConfigExample);

  // ⚠️ **校验（三族 + 世界尺寸 + 屏幕空间）**抽成一个内部函数 —— 循环里要用它决定**要不要重采样**。
  //   ⚠️ 「世界尺寸」那条是**票 83** 补的（票 81 的 Q3(乙) 的前提判据）：它与屏幕空间**同形**
  //     —— 视口由调用方传进来，所以编译期就判得上。⚠️ 加在这里不是顺手：**装配期那条几何族
  //     编译期跑不到**（`compileTdGame` 不跑 `auditTdGeometry`），不加这一条，一份声明了
  //     960×270 的配置要**烧完整条资源管线、死在装配期**才被告知世界比视口大。
  const auditOf = (c: TdConfig): string[] => {
    const out: string[] = [];
    for (const i of auditTdConfig(c, manifest))
      out.push(`${i.severity === "error" ? "❌" : "⚠️"} ${i.where}: ${i.message}`);
    for (const i of auditTdWorldSize(vp, c))
      out.push(`${i.severity === "error" ? "❌" : "⚠️"} ${i.where}: ${i.message}`);
    for (const i of auditScreenSpace(vp, tdHudScreenItems(c, manifest, { lineHeight: opts.hudLineHeight ?? DEFAULT_HUD_LINE_HEIGHT })))
      out.push(`${i.severity === "error" ? "❌" : "⚠️"} ${i.where}: ${i.message}`);
    return out;
  };

  // ⚠️ **重采样，不是修复循环**（不把错误喂回去 —— R2 把「自我修复闭环」整体判过出局）。
  //   而它要重采样的**不只有 schema 失败**：真跑量下来（20 次上游调用），模型一次就产出
  //   可用关卡的只有 **~1/4**，失败几乎全在「路径坐标 vs 地图上画成走道的格」那一族
  //   （那一族已由 `fromMap` 删掉；数字见 `docs/td-requirement.md` 与票 12）。
  //   ⇒ **硬失败也重采样**。⚠️ 每一次都是**一笔上游调用**，所以次数是参数（默认 3）。
  //
  //
  // ⚠️ **一格 = 一次调用**（`CONTEXT.md` 的「调用 / 往返」）。这里**以前每一轮把那唯一一格
  //   覆盖写**、只把往返次数堆在 `attempts` 上 —— 于是账上只留得下**最后一次**为什么失败，
  //   而「发了 3 次、前两次被截断、第三次坏 schema」与「一次就坏 schema」长得一模一样。
  //   现在由 `spentCall` 累加：`attempts` 照旧（重试烧了多少），`failures` 把每次的原因留下。
  const attempts = opts.attempts ?? 3;
  let picked: TdConfig | null = null;      // 过了校验的那一份
  let fallback: TdConfig | null = null;    // 最后一份过了 schema 的（校验可能不过）
  let issues: string[] = [];
  let lastError = "";
  const call = spentCall("compile-td-game", "td-config");
  try {
    for (let attempt = 0; attempt < attempts; attempt++) {
      const once = await onceThrough({
        transport: opts.transport, prompt, what: "编译出来的关卡", parse: parseTdConfig,
        ...(opts.fetchImpl !== undefined ? { fetchImpl: opts.fetchImpl } : {}),
        ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
      });
      // ⚠️⚠️ **`"not-sent"` 不 `trip`**（票 51 的 Q2 = (a)，2026-10-12）——
      //   以前这里写着 `? {}`，看着像「什么都没记」，其实 `trip` **光把 `trips` 加 1** 就够了：
      //   `record()` 于是交出一格 `{attempts: 1, ms, …}` 的**幻影**，而那一档**一个请求都没上路**
      //   —— 它顶掉两处已经写着的字：`spentCall` 自己那句「一次都没发出去就返回 `null`」，
      //   以及 `CONTEXT.md` 对 `attempts` 的定义（「这一次调用里**往返**了几次」，往返 = 一次 HTTP）。
      //   ⚠️ 这**不是**「少记一件事」：`trips` 恒 0 ⇒ `record()` 恒 `null` ⇒ 将来谁把
      //   `ledgerCarrying` 接到这一档上，也是**结构性**的 no-op —— 陷阱是**消掉**的，不是绕开的。
      //   ⚠️ 「试过 1 次、没上路」这个事实**没有家**（也不该借 `attempts` 表达）：真要记，另开一格再说。
      if (once.kind !== "not-sent")
        call.trip(once.kind === "ok" ? { spent: once.spent }
          : once.kind === "upstream" ? { failure: once.failure }
          : { failure: once.failure, spent: once.spent });
      if (once.kind === "not-sent") throw new CommandError("upstream", once.error.message);
      if (once.kind === "upstream") throw new CommandError("upstream", once.error.message, ledgerCarrying(call.record()));
      // ⚠️ **`bad` 记的是「这一趟上游没交出可用的东西」**；而下面「过不了校验」是**这一份关卡**
      //   的问题、不是上游的问题 —— 那一趟的 `failures` 上**不留东西**。要分开，
      //   否则「上游不稳」会被「模型设计得差」冒充成同一个数（这正是票 27 要病因的原因）。
      if (once.kind === "bad") { lastError = once.detail; continue; }
      const p = once.result;
      // ⚠️ **补全**：模型**不写** `path.points`（票 12）—— 从它画的那张地图**派生**出来填上。
      //   于是产物里路径还在、下游一无所知，而「路径与地图对不上」那一族失败**结构上不可能**。
      //   ⚠️ `fromMap` 才是那句「结构上不可能」的**全部**分量：它**不看模型写没写**、一律派生。
      //   只写一句「请不要写 path」是不够的（票 12 量过：「把话说硬」上限很低）——
      //   模型真写了、而这份代码又尊重它，那一族失败就原封不动地回来了。
      const resolved = tdResolveConfig(p.value, { fromMap: true });
      // ⚠️ **派生不出来也是「坏关卡」的一种，照常落盘**（与校验不过**同一条**裁决 —— 票 06/09：
      //   人过目的前提是他看得到哪儿不对）。落盘的是**没有 `path` 的那一份** ——
      //   它就是模型交出来的原文（而它**过得了 schema**），`site` 会在那里再说一遍同一句话。
      //   ⚠️ 原来这里写的是 `continue` ⇒ 三次重采样全撞上它时**抛异常、一个字节都不落** ——
      //   于是**模型的产出连同一笔已经花掉的调用一起丢了**，而它的失败其实说得清。
      const got = resolved.ok
        ? auditOf(resolved.value)
        : [`❌ arena: 从场地派生不出路径：${resolved.error}`];
      fallback = resolved.ok ? resolved.value : p.value;
      issues = got;
      if (resolved.ok && !got.some((i) => i.startsWith("❌"))) { picked = resolved.value; break; }
      lastError = `编译出来的关卡过不了校验（${got.filter((i) => i.startsWith("❌")).length} 条）：` +
        got.find((i) => i.startsWith("❌"))!.replace(/^❌ /, "");
    }
  } catch (e) {
    // ⚠️ **失败时已经花掉的那几笔跟着异常一起走**（票 46 的纪律）—— 包没产出来，它们没有别的家。
    // ⚠️ `onceThrough` 自己产出的 `CommandError` 已经带着账了，**原样放行**，别再包一层。
    //   ⚠️ 这一句**不是判类别的闸门**，它只是一条捷径：`CommandError` 的构造器**无条件**赋
    //   `ledger`/`failureDir`（`command.ts:73-74`，**今天**的行号）⇒ `'ledger' in e` 恒真 ⇒ 下面那句 `carryOnError`
    //   对它们本来就是个 no-op。真正的判据是**抛点**，见下。
    if (e instanceof CommandError) throw e;
    // ⚠️⚠️ **落到这里的，只可能是「我们的代码坏了」**（[票 49](../../../.scratch/game-maker-v2/issues/49-compiletdgame-mislabels-errors.md) 的裁定）：
    //   · **上游失败在上面两行已经显式抛掉了**（`once.kind === "not-sent"` / `"upstream"` ⇒ 都是
    //     `CommandError("upstream", …)`，`961-962`），而且 `onceThrough` **只返回、不抛**
    //     （它把 `callText` 的抛在内部收成那两档）⇒ try 里剩下的抛源**只有** `tdResolveConfig`
    //     与 `auditOf` 这两个**纯函数**。
    //   ⇒ 它们**必须原样抛出**：重包成 `upstream` 有**三处失真** —— ① 类别：「我们的 bug」被报成
    //   「上游的锅」，把人支去查网络、去等一会儿；② 退出码：落 **3**（上游死活）而不是 **1**
    //   （`EXIT.failure`，`Error` 的落点）—— 而重试一万次都一样；③ **原始栈丢掉**
    //   （`new CommandError(...)` 是另起一个 `Error`），而「哪一行判的」只有栈说得清。
    //   ⚠️ 与「要带账」**可以同时满足**（票 48 的老路：挂在原异常上、原样抛）—— 这两件事不是二选一。
    carryOnError(e, ledgerCarrying(call.record()));
    throw e;
  }
  // ⚠️ **一次都没过 schema** —— 那才是真的没东西可落盘。
  if (!fallback) throw new CommandError("invalid", lastError, ledgerCarrying(call.record()));
  // ⚠️ **不过校验也照常落盘**（票 06/09 那条裁决）：**人过目的前提是他看得到哪儿不对**。
  //   重采样全失败了也一样 —— 落**最后那一份**，并把问题报出来。
  const config = picked ?? fallback;

  const dir = path.join(opts.outRoot, manifest.id, "td-configs");
  fs.mkdirSync(dir, { recursive: true });
  const version = nextVersion(dir);
  const file = path.join(dir, `v${version}.json`);
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");

  const bad = issues.filter((i) => i.startsWith("❌"));
  return {
    command: "compile-td-game",
    summary: [
      `关卡已落盘：${rel(opts.outRoot, file)}（v${version}）`,
      `${config.waves.length} 波 · ${config.towers.length} 种机关 · ${config.enemies.length} 种敌人 · ${config.slots.length} 个插槽`,
      ...(bad.length === 0
        ? ["✅ 校验全过（三族 + 屏幕空间）—— 下一步：game-maker site …（几何族与「这一关通不通」判在那一步）"]
        : [`❌ **这份关卡过不了校验**（${bad.length} 条）—— 改完再 \`site\`：`, ...bad.map((b) => `  ${b}`)]),
    ],
    data: {
      gameId: manifest.id, version, configPath: rel(opts.outRoot, file),
      waveCount: config.waves.length, towerCount: config.towers.length,
      slotCount: config.slots.length, issues, ok: bad.length === 0,
      ledger: asLedger(call.record()),
    },
    artifacts: [{ path: rel(opts.outRoot, file), kind: "td-config" }],
  };
}

// ── pack：清单 → 资源包 ─────────────────────────────────────────────────────
export type PackOptions = {
  recipePath: string; outRoot: string; transport: Transport;
  /** ⚠️ **显式包版本号**（票 15 的 Q16/Q17）：给了就**绝不自算**。拿来给 create 链用。 */
  version?: number;
  /** 这个世界（`run/v<N>/visual-world.json`）：给了就拷一份进包（票 15 的 Q15 α）。
   *  ⚠️ 路径**相对配方文件**解析 —— 与 `styleRef` / `source.ref` / `characterRef` 同一条规则。 */
  visualWorldPath?: string;
  /** 生图上游。清单里有 `kind:"image"` 的资源时必填 —— 缺了就是**用法错**（2），不是上游错。 */
  imageTransport?: ImageTransport;
  fetchImpl?: typeof fetch;
  onProgress?: (done: number, total: number, assetId: string) => void;
  /**
   * 并发上限（票 47）。**按上游分别定** —— 限流是上游的属性。
   * 不给就用 `DEFAULT_CONCURRENCY`；设 1 就是旧的串行行为。
   */
  concurrency?: { text?: number; image?: number };
};

/**
 * 按 `protocol` 造出生图端口。**只有实测跑通过的那种才实现** ——
 * 剩下的显式抛「没实现」，而不是猜一个形状发出去（krill 那种「长得像 OpenAI 但什么都不实现」
 * 的中转真实存在，猜形状的代价是花着钱拿到一个 200/0 字节）。
 */
function imageGeneratorFor(t: ImageTransport, fetchImpl?: typeof fetch): ImageGenerator {
  // ⚠️ 有代理就必须自己走 —— Node 原生 fetch **不认 HTTPS_PROXY**（实测），
  // 而 api.openai.com / Google 这类上游在境内直连不通。不接这一句的后果是
  // 一个不含任何线索的「fetch failed」。
  const doFetch = fetchImpl ?? (t.proxy ? createProxyFetch({ proxy: t.proxy }) : undefined);
  const common = { baseUrl: t.baseUrl, apiKey: t.apiKey, ...(doFetch ? { fetchImpl: doFetch } : {}) };
  switch (t.protocol) {
    case "dashscope-mcp": return createDashScopeMcpGenerator(common);
    case "gemini": return createGeminiGenerator({ ...common, ...(t.model ? { model: t.model } : {}) });
    // ⚠️ `minimax` 仍然没写。它不是 "openai 换个 baseUrl" —— Minimax 的
    // `/v1/image_generation` 是另一个形状（`image_urls`、`aspect_ratio`、回的是 url）。
    // 没实测过就不猜。
    case "openai": return createOpenAIGenerator({ ...common, ...(t.model ? { model: t.model } : {}) });
    case "minimax":
      throw new CommandError("usage", `生图协议 "${t.protocol}" 的客户端**还没写**（已有的是 dashscope-mcp / gemini / openai）。不要猜形状 —— 猜错了就是花着钱拿到一个空回应。`);
  }
}

/**
 * 读 `recipe.characterRef` 指向的那份基因（票 15 的 Q13）。
 *
 * ⚠️ **有 `characterId` 而 `characterRef` 缺席 ⇒ 拒**（票 15 的 Q18）：
 *   票 04 的原话是「`AssetSpec.characterId` **必须命中** `character-dna.json` 里某条的 id」——
 *   而票 13 那条**回落**说的是「**调用方没给 DNA 文件**」这种兼容情形；
 *   一份**自己声明了 `characterId`** 的清单不属于那一类（那种清单画出来的角色是谁，就随提示词的缘了）。
 */
function readCharacterRef(recipe: { assets: readonly { spec: { id: string; characterId?: string } }[]; characterRef?: string }, recipeDir: string): CharacterDNAFile | undefined {
  const claiming = recipe.assets.filter((a) => a.spec.characterId !== undefined);
  if (recipe.characterRef === undefined) {
    if (claiming.length > 0)
      throw new CommandError("invalid",
        `清单里有资产写了 \`characterId\`（第一个是 "${claiming[0]!.spec.id}" → "${claiming[0]!.spec.characterId}"），` +
        `而这份配方**没有 \`characterRef\`** ⇒ 那个 id **无从命中**。\n` +
        "⚠️ 两种都算错：要么这份清单**该有一份角色基因**（把 `characterRef` 指过去），" +
        "要么那些 `characterId` **是多余的**（把它删掉 —— 全是道具的配方没有角色）。");
    return undefined;
  }
  const p = path.resolve(recipeDir, recipe.characterRef);
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { throw new CommandError("invalid", `角色基因读不出来或不是 JSON：${p} —— ${(e as Error).message}`); }
  const d = CharacterDNAFileSchema.safeParse(raw);
  if (!d.success)
    throw new CommandError("invalid", `角色基因不过 schema：${d.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("；")}`);
  return d.data;
}

/** 读那份 `VisualWorldSpec`（票 15 的 Q15 α）。⚠️ 不过 schema ⇒ **拒**（它是产物，不是手写物）。 */
function readVisualWorld(p: string): VisualWorldSpec {
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { throw new CommandError("invalid", `这个世界读不出来或不是 JSON：${p} —— ${(e as Error).message}`); }
  const w = VisualWorldSpecSchema.safeParse(raw);
  if (!w.success)
    throw new CommandError("invalid", `这个世界不过 schema：${w.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("；")}`);
  return w.data;
}

/**
 * 读那份 `stylespec.json`（票 29 的 Q1）。
 *
 * ⚠️ **它是产物**（票 29 的 Q4）：不过 schema ⇒ **拒**，与 `readVisualWorld` / `readCharacterRef` 同款
 *   —— 在这一票之前，它是 `pack` 里**唯一**没人验的产物读取（一句裸 cast，一个字段都不验）。
 * ⚠️ **规范化在前、校验在后**，且**规范化归入口、校验归契约**（票 29 的 Q2 裁定 (c)）：
 *     输入 → 小写 → 去重 → `StyleSpecSchema` → 下游
 *   契约管的是**规范形式**（小写 `#rrggbb`），而**接受形式**大小写都收 —— 真提取脚本产出的就是
 *   大写色板（`fixtures/style-spec.provenance.json`），拒掉它等于打掉仓库自己的基准 fixture。
 *   ⚠️ 小写化与去重**复用 `pack.ts` 的 `normalizePalette`**（同一份逻辑，不许再写第二套）。
 * ⚠️ **不扩范围**（人类这一轮的边界）：色板**整个缺席**时 schema 的 `.default([])` 会放行 ——
 *   那是契约自己的形状，本票不动它（见 Answer §边界）。
 * ⚠️ **2026-10-12（票 44）就地更正**：上面那条边界**已被票 44 关掉**。人类在那一票裁 **Q1=(a)
 *   「空色板的产物不该存在，一律拒」**，落点**正是这里**（原话：「在 `readStyle` 入口拒绝，
 *   复用票 29 已建立的校验闸」）⇒ 下面多了一条**业务判据**（色板非空）。⚠️ 契约**仍然不动**
 *   （`.default([])` 原样保留，守 R6）—— 拒的是**入口**，不是 schema。
 */
function readStyle(p: string): StyleSpec {
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { throw new CommandError("invalid", `风格规格读不出来或不是 JSON：${p} —— ${(e as Error).message}`); }
  // ⚠️ 数组里混进非字符串时**整段跳过规范化**，交给 schema 去报类型错 ——
  //   否则 `normalizePalette` 会在 `.toLowerCase()` 上炸成一个**指错方向**的 TypeError。
  const rawPalette = (raw !== null && typeof raw === "object") ? (raw as { palette?: unknown }).palette : undefined;
  let normalized: unknown = raw;
  if (Array.isArray(rawPalette) && rawPalette.every((c) => typeof c === "string")) {
    // ⚠️ `normalizePalette` **自己去重**（撞见重复色会抛）—— 那道拒绝也是本闸的一部分，
    //   所以它得**走同一个出口**。原样放出去的话，同一份坏 `stylespec.json` 会按「重复色与否」
    //   拿到**两个退出码**（schema 拒 ⇒ 4，它抛 ⇒ 1）—— 那正是本仓库反复吃的「两把尺子」。
    try { normalized = { ...(raw as Record<string, unknown>), palette: normalizePalette(rawPalette) }; }
    catch (e) { throw new CommandError("invalid", `风格规格不过 schema：${(e as Error).message}`); }
  }
  const s = StyleSpecSchema.safeParse(normalized);
  if (!s.success)
    throw new CommandError("invalid", `风格规格不过 schema：${formatIssues(s.error).slice(0, 4).join("；")}`);
  // ⚠️ **票 44 的闸**（人类 2026-10-12 裁定 **Q1=(a)**「空色板的产物不该存在，一律拒」）：
  //   **色板非空**是一条**业务**判据，不是 schema 判据 —— 契约那边 `palette` 带 `.default([])`，
  //   所以「整个键缺席」过得了 schema（票 29 量到并钉成 characterization 测试的那个盲区）。
  //   ⚠️ **为什么非空是硬要求**：`palette:N` 是 DrawList 里表达颜色的**唯一合法形式**，
  //   「颜色 ∈ 色板」是一个**构造上恒真**的命题 —— 空色板让它当场塌掉；而 `assetpack.ts` 的
  //   `palette.size` 要求 `positive()` ⇒ 一份空色板的包**本就是违反自己契约的产物**。
  //   ⚠️ 判在**成功之后、且用规范化过的值**（`s.data.palette`）⇒ 「键缺席」与「显式空数组」
  //   被同一句话拒掉（人类的边界原话：「**不依赖清单是否引用色板**」—— 色板是世界级风格数据，
  //   不该由某一份清单的引用情况决定它是否合法）。
  //   ⚠️ **不写「不过 schema」**：这一条 schema 是**故意放行**的（R6 钉死 `.default([])`），
  //   照抄那句会让下一个读的人以为契约拒了它。出口仍与兄弟读法同款：`invalid` ⇒ 退出码 4。
  const emptyPalette = emptyPaletteProblem(s.data.palette, "风格规格");
  if (emptyPalette !== null) throw new CommandError("invalid", emptyPalette);
  return s.data;
}

export async function packAssets(opts: PackOptions): Promise<CommandResult> {
  const recipe = JSON.parse(fs.readFileSync(opts.recipePath, "utf8"));
  const r = parseRecipe(recipe);
  if (!r.ok) throw new CommandError("invalid", `清单不过 schema：${r.errors.slice(0, 4).join("；")}`);
  const styleAbs = path.resolve(path.dirname(opts.recipePath), r.value.styleRef);
  // ⚠️ **票 29 的闸**：在这之前这一行是 `JSON.parse(...) as StyleSpec` —— 一句编译期的谎。
  const style = readStyle(styleAbs);

  const needsImage = r.value.assets.some((a) => a.source.kind === "image" || a.source.kind === "frames");
  if (needsImage && !opts.imageTransport)
    throw new CommandError("usage",
      `这份清单里有 source.kind="image" 的资源，但**没配生图凭据** —— ` +
      `写 game-maker.local.json（已 gitignore）或设 GAME_MAKER_IMAGE_* 环境变量。`);

  // ⚠️ **有一整类协议接不了参考图，而它是静默失败的**（票 13 的 Q6）：
  //   `dashscope-mcp` 那条的 `tools/call` 参数里根本没有 `reference` / `styleReference`
  //   两个键（`image-gen.ts` 的 `createDashScopeMcpGenerator` 入参解构里就没有它们）
  //   ⇒ 传了**静默丢掉**，账上一个字都不记。后果是「一个看起来正常、但完全没照参考图画的包」
  //   ——「错得安静」的正品。
  //   ⇒ **在花钱之前、免费地拒**（R12 的同一条原则）。⚠️ 判据是「**真的有一张图会被丢**」：
  //     `styleRef` 只是指向 `stylespec.json` 的**路径**，不是图，**永远不触发**（人类在这一轮
  //     专门点了这一条）；触发的是 `referenceImage` / `source.reference` / `masterAsset` 那三样。
  if (opts.imageTransport?.protocol === "dashscope-mcp") {
    const images = referenceImagesOf(r.value);
    if (images.length > 0)
      throw new CommandError("usage",
        `这份清单要递参考图，而配置的生图协议是 \`dashscope-mcp\` —— ⚠️ **那家接不了参考图**：\n` +
        images.map((x) => `  · ${x}`).join("\n") +
        `\n它的 \`tools/call\` 参数里没有这两个键 ⇒ 参考图会被**静默丢掉**（账上都不记一笔），` +
        `交付出来会是一个「看起来正常、但完全没照参考图画的包」。\n` +
        `⇒ 换一个支持参考图的协议（实测 Gemini 那条**真的把角色保持住了**），` +
        `或者把这几张参考图从清单里去掉。`);
  }

  // ⚠️ **DNA 的唯一通道是清单里那一格**（票 15 的 Q13）：pipeline **只写清单**、从不把对象递进来 ——
  //   于是**单跑的 `pack`** 与新链走的是**同一条电路**。
  const characterDna = readCharacterRef(r.value, path.dirname(path.resolve(opts.recipePath)));

  // ⚠️ 这个数组是**调用方与构建器共用**的：文本那一路由生成器直接记进来
  //   （`createDrawListGenerator({ onCall })`），生图那一路由 `buildAssetPack` 追加。
  //   ⚠️ 而它在这里**就存在了**，所以中途失败时已经花掉的那几笔还在 —— 那是票 46 的地基。
  const ledger: LedgerCall[] = [];
  let res;
  try {
    res = await buildAssetPack({
      recipe: r.value, style, outDir: opts.outRoot,
      // `source.ref` 相对**配方文件**解析（契约 `InputPath` 定的规则，与 `styleRef` 一致）
      recipeDir: path.dirname(path.resolve(opts.recipePath)),
      ...(opts.version !== undefined ? { version: opts.version } : {}),
      ...(opts.visualWorldPath !== undefined
        ? { visualWorld: readVisualWorld(path.resolve(path.dirname(path.resolve(opts.recipePath)), opts.visualWorldPath)) }
        : {}),
      ...(characterDna !== undefined ? { characterDna } : {}),
      generate: createDrawListGenerator({
        baseUrl: opts.transport.baseUrl, apiKey: opts.transport.apiKey,
        onCall: (c) => ledger.push(c),
        ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      }),
      ledger,
      ...(opts.imageTransport
        ? { generateImage: imageGeneratorFor(opts.imageTransport, opts.fetchImpl) }
        : {}),
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
      ...(opts.concurrency ? { concurrency: opts.concurrency } : {}),
    });
  } catch (e) {
    // ⚠️ 生成失败**就是**「上游不可达」（3），不是「失败」（1）。
    // 拆掉降级链之前这条分支不会发生 —— 上游死活都被兜底吸收，pack 永远成功。
    // ⚠️ **失败时账有两处可去，这一处是「当场看得见」的那一处**（票 46）：
    //   ⚠️ **2026-10-12（票 36）**：`pack` 现在在**资产段之后**就先写一版包内账 ⇒
    //   抛点之后的**失败现场里有一份 `ledger.json`**。但那一份要**先知道现场在哪**才读得到，
    //   而跟着异常走的这一份是给人**当场**看的 —— 两者不互相顶替。
    //   而**已经花掉的那几笔是事实** —— 它们跟着异常走，两个壳各自渲染。
    //   ⚠️ 这个数组在 `buildAssetPack` **调用之前**就存在了，所以它活过了这次抛出；
    //   而票 47 的「失败即止」保证它只含**真的发出去过**的调用（没发的不算）。
    // ⚠️ **失败现场**（票 01）：`buildAssetPack` 已经把工作目录改名留下了，
    //   路径挂在异常上 —— 与账**同一处**搬进 `CommandError`（两个壳各自渲染）。
    // ⚠️ 按能力读（票 48）—— 这枚指针**已经**挂在异常上了（`pack.ts` 的 `carryOnError`），
    //   以前那三处 `instanceof CommandError` 的读者把它当不存在。
    const failureDir = failureDirOfError(e);
    const carried = {
      ...(ledger.length > 0 ? { ledger } : {}),
      ...(failureDir !== undefined ? { failureDir } : {}),
    };
    if (e instanceof GenerationError || e instanceof ImageGenerationError)
      throw new CommandError("upstream", e.message, carried);
    if (e instanceof CommandError) throw new CommandError(e.kind, e.message, carried);
    // ⚠️⚠️ **其余一律原样抛出，只把「带出来的东西」挂上去**（2026-10-12 · 票 48 的 Q2 = A）。
    //
    //   原来是 `throw e;` —— **那一声把 `carried` 扔了**，而 `pack` 段的判断**全都**走这条路
    //   （11 处普通 `Error`）⇒ 「钱花了、账没人报」。第三跑那 9 张已付费的图死的就是这一类。
    //
    //   ⚠️ **为什么不重包成 `CommandError`**：票 46 §5 反对套它的**唯一理由**是「只会把栈弄丢」，
    //   而丢栈是这个仓库真吃过亏的东西（现场的栈是唯一能说明「哪一行判的」的凭据）。
    //   挂上去**一样能报账**，且栈、错误类、`cause` 链**一样不丢** ⇒ 正面解决那条理由，而不是绕过它。
    //
    //   ⚠️ **判据是「有没有真花掉的钱」，不是「抛的是哪个类」**（票 48 的 Q3 = A）：
    //   用的就是上面 `ledger.length > 0` 那把**已有的**尺子。⇒ 一分钱没花的真·代码 bug
    //   `carried` 是空的 ⇒ `carryOnError` 什么都不做 ⇒ **它仍是裸 `Error`、原样抛出**
    //   （票 46 §5 那个二分要保住的第二格，原样保住）。
    carryOnError(e, carried);
    throw e;
  }
  const m = res.manifest;
  return {
    command: "pack",
    summary: [`资源包：${rel(opts.outRoot, res.packDir)}（v${m.version}）`,
      `${m.assets.length} 个资源 · ${m.atlases.length} 张图集 · ${m.files.length} 个文件`,
      `来源：${m.provenance.mode}`,
      // ⚠️ **墙钟与调用耗时之和是两个数**（票 19）—— 串行时恰好相等，并行之后就不再相等。
      //   两个都报出来，差就是并行的收益。
      (() => {
        const s = summarizeCalls(ledger);
        const calls = ledger.length;
        if (calls === 0) return "账：无调用";
        // ⚠️ `?? 0` 在这里是**跳过**（`ms` 缺席 = 还没回来），不是「把没测到的当 0」
        const ms = ledger.reduce((n, c) => n + (c.ms ?? 0), 0);
        const trips = ledger.reduce((n, c) => n + c.attempts, 0);
        const wall = res.ledger ? `墙钟 ${(res.ledger.run.wallClockMs / 1000).toFixed(1)}s · ` : "";
        return `账：${calls} 次调用 · ${trips} 次往返（${trips > calls ? "**有重试**" : "无重试"}）· ` +
          `${wall}调用耗时合计 ${(ms / 1000).toFixed(1)}s · 见包内 ledger.json`;
      })(),
      ...(res.imageCalls.length > 0
        ? [`生图：${res.imageCalls.length} 次调用 · ${res.imageCalls.map((c) => c.assetId).join(" ")}`]
        : []),
      // ⚠️ **母版比例的观察**（票 39 的 Q1 ①）：当场给人看的那一份。
      //   ⚠️ 它**不是**「有内容就是错」—— 不阻断、不打分（上游守不守住 `aspectRatio` 不是设计能控的）。
      //   真值在包内 `master-ratios.json`（+ 每张母版那一格），失败现场也留得住。
      ...(res.masterRatios === undefined ? [] : masterRatioNotes(res.masterRatios)),
      // ⚠️ **底部横带救援的观察**（票 100）：有内容不是失败，但**不许静默** ——
      //   人要知道这一帧是从一张「底下带横带」的图上救回来的。
      ...(res.groundBands === undefined ? [] : res.groundBands.map((g) =>
        `⚠️ 底部横带：${g.assetId}${g.anim === undefined ? "" : `.${g.anim}`} 忽略了 ${g.rows} 行` +
        `（覆盖率 ${(g.cover * 100).toFixed(1)}%）`))],
    data: {
      packId: m.id, version: m.version,
      ...(res.imageCalls.length > 0
        ? { imageCalls: res.imageCalls, imageUpstream: describeImageTransport(opts.imageTransport) }
        : {}),
      // ⚠️ **结构化那一份**（不是渲染好的句子）—— 两个壳各自决定怎么呈现。
      ...(res.masterRatios === undefined ? {} : { masterRatios: res.masterRatios }),
      ...(res.groundBands === undefined ? {} : { groundBands: res.groundBands }),
      ledgerCalls: ledger, ledgerRun: summarizeCalls(ledger),
      assetCount: m.assets.length, fileCount: m.files.length,
      provenanceMode: m.provenance.mode, paletteCoverage: m.palette.coverage,
    },
    artifacts: [{ path: rel(opts.outRoot, res.packDir), kind: "asset-pack" }],
  };
}

// ── verify：校验一个已有资源包 ───────────────────────────────────────────────
export type VerifyOptions = { packDir: string; outRoot?: string };

/** 校验一个包：schema + **逐文件 checksum**。 */
export function verifyPack(opts: VerifyOptions): CommandResult {
  const root = opts.outRoot ?? path.dirname(path.resolve(opts.packDir));
  const manifestPath = path.join(opts.packDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new CommandError("usage", `不是资源包（没有 manifest.json）：${opts.packDir}`);
  const parsed = parseAssetPack(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  if (!parsed.ok) throw new CommandError("invalid", `manifest 不过 schema：${parsed.errors.slice(0, 6).join("；")}`);
  const m = parsed.value;

  const problems: string[] = [];
  // ⚠️ checksum 存在的意义**就是**能被校验 —— 只存着不校验，它等于没有（票 18）。
  for (const f of m.files) {
    const abs = path.join(opts.packDir, f.path);
    if (!fs.existsSync(abs)) { problems.push(`缺文件：${f.path}`); continue; }
    const buf = fs.readFileSync(abs);
    if (buf.length !== f.bytes) problems.push(`大小不符：${f.path}（记 ${f.bytes}，实际 ${buf.length}）`);
    const sum = "sha256:" + createHash("sha256").update(buf).digest("hex");
    if (sum !== f.checksum) problems.push(`checksum 不符：${f.path}`);
  }
  // ⚠️ **账（包里如果有）也要过 schema** —— 它已经在 `files[]` 里，所以上面那段已经验过
  //   「没被改过」；但 checksum **只证明它没被改**，不证明它**是一份合法的账**。
  //   ⚠️ **没有不算错** —— 磁盘上已有的包（票 40 那份）不带它，必须照常通过。
  const ledgerPath = path.join(opts.packDir, "ledger.json");
  const hasLedger = fs.existsSync(ledgerPath);
  let ledgerRun: ReturnType<typeof summarizeCalls> | null = null;
  if (hasLedger) {
    const l = parseLedger(JSON.parse(fs.readFileSync(ledgerPath, "utf8")));
    if (!l.ok) problems.push(...l.errors.map((e) => `ledger.json 不过 schema：${e}`));
    else if (l.value.packId !== m.id || l.value.packVersion !== m.version)
      problems.push(`账与包对不上：ledger.json 说自己是 "${l.value.packId}" v${l.value.packVersion}，而 manifest 是 "${m.id}" v${m.version}`);
    else ledgerRun = l.value.run.byStep;
  }

  // ⚠️ **母版比例的读数（包里如果有）也要过 schema**（票 39）—— 与账本同一条理由：
  //   checksum 只证明它**没被改过**，不证明它**是一份合法的读数**。
  //   ⚠️ **没有不算错**（票 45 之前产的包都没有这个 sidecar）。
  //   ⚠️ 也**不校验它「对不对」** —— 它是**观察**，不是判据：上游回什么比例都对，
  //     这里只保证「这文件我们读得懂」。
  const ratiosPath = path.join(opts.packDir, MASTER_RATIOS_FILE);
  let masterRatios: MasterRatio[] | null = null;
  if (fs.existsSync(ratiosPath)) {
    const mr = parseMasterRatios(JSON.parse(fs.readFileSync(ratiosPath, "utf8")));
    if (!mr.ok) problems.push(...mr.errors.map((e) => `${MASTER_RATIOS_FILE} 不过 schema：${e}`));
    else if (mr.value.packId !== m.id || mr.value.packVersion !== m.version)
      problems.push(`读数与包对不上：${MASTER_RATIOS_FILE} 说自己是 "${mr.value.packId}" v${mr.value.packVersion}，而 manifest 是 "${m.id}" v${m.version}`);
    else masterRatios = mr.value.masters;
  }

  const onDisk = walk(opts.packDir).filter((p) => p !== "manifest.json").sort();
  const declared = m.files.map((f) => f.path);
  for (const p of onDisk) if (!declared.includes(p)) problems.push(`files[] 没记录的文件：${p}`);

  // ⚠️ **校验不过是失败**（退出码 4），不是某种「可用的降级产物」。
  if (problems.length > 0) throw new CommandError("invalid", `校验不过（${problems.length} 处）：${problems.slice(0, 6).join("；")}`);

  return {
    command: "verify",
    summary: [`✅ ${rel(root, opts.packDir)} 通过：${m.files.length} 个文件的 checksum 全部对得上`,
      `来源：${m.provenance.mode}`,
      ...(ledgerRun
        ? [`账：${Object.values(ledgerRun).reduce((n, v) => n + (v?.calls ?? 0), 0)} 次调用被记在包内 ledger.json 里`]
        : ["账：这个包没有 ledger.json（**不是错** —— 票 45 之前产的包都没有）"]),
      ...(masterRatios === null ? [] : masterRatioNotes(masterRatios))],
    data: { packId: m.id, version: m.version, ok: true, problems: [], provenanceMode: m.provenance.mode },
    artifacts: [],
  };
}

const walk = (dir: string, base = ""): string[] => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]));

// ── inspect：包里有什么 ─────────────────────────────────────────────────────
/**
 * 交付态到底把色板用成了什么样 —— **确定性、可扫**（票 15 发现，票 39 定它是**观察**）。
 *
 * ⚠️ **它是观察，不是判据**（票 39）。读法定了「`palette` 是**绘制词汇**」之后，
 *   「某个色没人用」「重音色占比低」都**不是缺陷** —— 词汇表里的词不必每句都用上，
 *   而一个黄昏世界的最暗色占大头可能正是对的。所以这里**只报数**，不打分、不阻断。
 *   ⚠️ 这也是为什么它不该留在 `out/`（gitignore）里当一次性脚本 —— 人眼判
 *   「像不像同一个视觉世界」时，手上多这组数比没有强。
 *
 * ⚠️ **票 47 加的那一半：色板外像素**（人裁 2026-10-13）。以前这一处**静默丢掉**它们
 *   （`if (i >= 0)` 那个 if 没有 else）⇒ 「交付图和色板对不上」这件事**没有任何地方报得出来**。
 *   ⚠️ 它是**诊断观察**，**不是失败条件、不是阈值、不是验收判据** —— 实测那堆色板外的颜色
 *   来自 drawlist 里**手写的** `opacity < 1`（半透明混合，`raster.ts` 的 `blend`），
 *   也就是说**它可以是设计**。⇒ 只报数。
 *   ⚠️ 它是「交付图里有没有纯黑 / 纯白」唯一可能的观测面（纯黑纯白必然是色板外的，除非色板里就有），
 *   而票 47 量到的那两条约束今天在交付态成立靠的是**实现副产物**（量化 / 二值 alpha），
 *   **不是**一条针对它们的契约声明 ⇒ 这条观察就是把那个「没人看着的输入」摆到人眼前。
 */
function paletteUsage(packDir: string, m: AssetPackManifest) {
  const hex = (r: number, g: number, b: number) =>
    "#" + [r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("");
  const perColor = m.palette.values.map((c) => ({ color: c, pixels: 0, assets: [] as string[] }));
  const atlasCache = new Map<string, ReturnType<typeof decodePNG>>();
  const perAsset: { id: string; usedColors: number; opacityPixels: number; offPalettePixels: number; top: { color: string; share: number }[] }[] = [];
  // 色板外像素（票 47）：逐色计数，只留前几名 —— 它是观察，不是判据，所以**不进任何分母**。
  const offPalette = new Map<string, number>();
  let opaqueAll = 0;

  for (const a of m.assets) {
    const atlas = m.atlases.find((x) => x.id === a.atlasId);
    if (!atlas) continue;
    const aj = JSON.parse(fs.readFileSync(path.join(packDir, atlas.meta), "utf8")) as
      { frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }> };
    let img = atlasCache.get(atlas.id);
    if (!img) { img = decodePNG(fs.readFileSync(path.join(packDir, atlas.image))); atlasCache.set(atlas.id, img); }
    const count = new Array(m.palette.values.length).fill(0);
    let opaque = 0;
    let offAsset = 0;
    for (const f of a.frames) {
      const fr = aj.frames[f.name];
      if (!fr) continue;
      for (let y = 0; y < fr.frame.h; y++) for (let x = 0; x < fr.frame.w; x++) {
        const o = ((fr.frame.y + y) * img.width + fr.frame.x + x) * 4;
        if (img.data[o + 3] === 0) continue;
        opaque++;
        const c = hex(img.data[o]!, img.data[o + 1]!, img.data[o + 2]!);
        const i = m.palette.values.indexOf(c);
        if (i >= 0) { count[i]++; perColor[i]!.pixels++; }
        // ⚠️ 色板外 **只报数**（票 47）：不进 `count`、不进 `perColor`、不进任何分母。
        else { offAsset++; offPalette.set(c, (offPalette.get(c) ?? 0) + 1); }
      }
    }
    opaqueAll += opaque;
    const used = count.filter((c) => c > 0).length;
    for (const [i, c] of count.entries()) if (c > 0) perColor[i]!.assets.push(a.id);
    perAsset.push({
      id: a.id, usedColors: used, opacityPixels: opaque, offPalettePixels: offAsset,
      top: count.map((c, i) => ({ color: m.palette.values[i]!, share: opaque === 0 ? 0 : c / opaque }))
        .sort((x, y) => y.share - x.share).slice(0, 3).filter((x) => x.share > 0),
    });
  }
  const total = perColor.reduce((n, c) => n + c.pixels, 0);
  const offPalettePixels = opaqueAll - total;
  return {
    perAsset,
    perColor: perColor.map((c) => ({ color: c.color, assets: c.assets.length, share: total === 0 ? 0 : c.pixels / total })),
    totalPixels: total,
    opaquePixels: opaqueAll,
    // ⚠️ 观察，不是判据（票 47）—— `share` 的分母是**全部不透明像素**，与 `perColor[].share` 的分母
    //   （只在色板内的那些）**故意不同** ⇒ 别把两组数放一起比。
    offPalette: {
      pixels: offPalettePixels,
      share: opaqueAll === 0 ? 0 : offPalettePixels / opaqueAll,
      colors: [...offPalette.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
        .map(([color, pixels]) => ({ color, pixels })),
    },
  };
}

export type SourceSizeEntry = {
  id: string; unit: string;
  source: { w: number; h: number; ar: number };
  target: { w: number; h: number; ar: number };
  deltaAr: number;
};

/** `inspectPack.data` 的形状（v3 终端摘要）。⚠️ 它**一直是这个形状** —— 本类型只是把它定型并导出，
 *  不是新契约、不落盘、不改报告。 */
export type InspectPaletteUsage = {
  perAsset: { id: string; usedColors: number; opacityPixels: number; offPalettePixels: number; top: { color: string; share: number }[] }[];
  perColor: { color: string; assets: number; share: number }[];
  totalPixels: number;
  opaquePixels: number;
  offPalette: { pixels: number; share: number; colors: { color: string; pixels: number }[] };
};

export type InspectAsset = {
  id: string;
  kind: AssetPackEntry["kind"];
  size: AssetPackEntry["size"];
  origin: AssetPackEntry["origin"];
  paletteBinding: AssetPackEntry["paletteBinding"];
  frames: number;
  animations: { name: string; frames: number; fps: number | null; loop: boolean }[];
};

export type InspectData = {
  packId: string;
  version: number;
  provenanceMode: AssetPackManifest["provenance"]["mode"];
  assets: InspectAsset[];
  paletteUsage: InspectPaletteUsage;
  layerCoverage: LayerCoverage[];
  sourceSizes: SourceSizeEntry[];
};

/** `源图 → 目标` 的尺寸观察（v3 视觉 QA 接口）。⚠️ 只**记录**，不设阈值、不判通过/失败。 */
function sourceSizeObservations(packDir: string, m: AssetPackManifest): { lines: string[]; entries: SourceSizeEntry[] } {
  const entries: SourceSizeEntry[] = [];
  const ar = (s: { w: number; h: number }) => s.w / s.h;
  const add = (id: string, unit: string, raw: string, target: { w: number; h: number }) => {
    const file = path.join(packDir, raw);
    if (!fs.existsSync(file)) return;
    const img = decodePNG(fs.readFileSync(file));
    const source = { w: img.width, h: img.height, ar: img.width / img.height };
    const t = { ...target, ar: ar(target) };
    entries.push({ id, unit, source, target: t, deltaAr: (t.ar / source.ar - 1) * 100 });
  };
  for (const a of m.assets) {
    const bitmaps = a.authoring.filter((x) => x.kind === "bitmap" && x.ref.endsWith(".png"));
    if (bitmaps.length === 0) continue; // drawlist：无位图，跳过
    const find = (suffix: string) => bitmaps.find((x) => path.basename(x.ref) === suffix)?.ref;
    if (a.kind === "animation" && a.animations) {
      for (const anim of a.animations) {
        const raw = find(`${a.id}.${anim.name}.png`);
        if (raw !== undefined) add(a.id, anim.name, raw, { w: a.size.w * anim.frames.length, h: a.size.h });
      }
    } else if (a.kind === "background" && a.layers) {
      for (const layer of a.layers) {
        const raw = find(`${a.id}.${layer.name}.png`);
        if (raw !== undefined) add(a.id, layer.name, raw, { w: a.size.w, h: a.size.h });
      }
    } else {
      // single sprite / ui / import：一个位图资源
      add(a.id, "", bitmaps[0]!.ref, { w: a.size.w, h: a.size.h });
    }
  }
  // 母版：既有 master-ratios.json 的 canonical（requested）口径。
  const ratiosPath = path.join(packDir, MASTER_RATIOS_FILE);
  if (fs.existsSync(ratiosPath)) {
    const ratios = parseMasterRatios(JSON.parse(fs.readFileSync(ratiosPath, "utf8")));
    if (ratios.ok)
      for (const mr of ratios.value.masters)
        add(mr.master, "", `authoring/masters/${mr.master}.png`, { w: mr.requested.w, h: mr.requested.h });
  }
  const pct = (d: number) => {
    const v = Math.abs(d) < 0.05 ? 0 : d;
    return `${v > 0 ? "+" : v < 0 ? "-" : ""}${Math.abs(v).toFixed(1)}%`;
  };
  const lines = entries.map((e) => {
    const label = e.unit === "" ? e.id : `${e.id}.${e.unit}`;
    return `  ${label.padEnd(30)} 源图 ${e.source.w}×${e.source.h} (${e.source.ar.toFixed(3)}) → `
      + `目标 ${e.target.w}×${e.target.h} (${e.target.ar.toFixed(3)}) · 长宽比差 ${pct(e.deltaAr)}`;
  });
  return { lines, entries };
}

export function inspectPack(opts: { packDir: string; outRoot?: string }): CommandResult {
  const root = opts.outRoot ?? path.dirname(path.resolve(opts.packDir));
  const parsed = parseAssetPack(JSON.parse(fs.readFileSync(path.join(opts.packDir, "manifest.json"), "utf8")));
  if (!parsed.ok) throw new CommandError("invalid", `manifest 不过 schema：${parsed.errors.slice(0, 6).join("；")}`);
  const m = parsed.value;
  // ⚠️ 扫交付态图集要**解 PNG** —— 这是 `inspect` 唯一的重活，而它是诊断命令，值。
  const usage = paletteUsage(opts.packDir, m);
  const byId = new Map(usage.perAsset.map((u) => [u.id, u]));
  const sourceSizes = sourceSizeObservations(opts.packDir, m);

  const lines = [`${m.id} v${m.version} · ${m.provenance.mode}`, `${m.assets.length} 个资源 · ${m.atlases.length} 张图集`];
  for (const a of m.assets) {
    const anim = a.animations?.length ? ` · 动画 ${a.animations.map((x) => `${x.name}(${x.frames.length})`).join(" ")}` : "";
    const u = byId.get(a.id);
    const uses = u ? ` · 用色 ${u.usedColors}/${m.palette.values.length}` : "";
    // ⚠️ 色板外像素（票 47）：**只在不为 0 时**多挂一截 —— 没有它就是没有，
    //   不必让每一行都拖着「色板外 0」这个噪声。
    const offA = u && u.offPalettePixels > 0 ? ` · 色板外 ${u.offPalettePixels}` : "";
    lines.push(`  ${a.id} · ${a.kind} · ${a.size.w}×${a.size.h} · ${a.origin}/${a.paletteBinding} · ${a.frames.length} 帧${anim}${uses}${offA}`);
  }
  if (sourceSizes.lines.length > 0) {
    lines.push(`源图 / 目标尺寸（**观察，不是判据** —— 顺序始终源图 → 目标）：`);
    lines.push(...sourceSizes.lines);
  }
  // ⚠️ 这一块是**观察**不是判据（票 39）—— 不打分、不阻断，只是把人眼判「像不像同一个世界」时要看的事实摆出来
  // 每一层背景画得有多满（票 50）—— ⚠️ 这个量**是判据**（层覆盖），但它**判在 QA 那边**
  //   （票 06 Q12）：这里是**诊断命令**，只报数、**不判**。**同一个 helper**，不另算一份。
  const bg = backgroundCoverage(opts.packDir, m);
  if (bg.length > 0) {
    lines.push(`背景层：整帧有多少像素是真画了东西的（**只报数** —— 层覆盖是一条判据，判决在 QA 那边）：`);
    for (const c of bg)
      lines.push(`  ${c.frame.padEnd(24)} ${c.w}×${c.h}  ${(100 * c.ratio).toFixed(1)}%`);
  }
  lines.push(`色板 ${m.palette.values.length} 色 · 交付态实际用到的像素分布（**观察，不是判据**）：`);
  for (const c of usage.perColor)
    lines.push(`  ${c.color} · ${c.assets}/${m.assets.length} 个资源用到 · 占全部不透明像素 ${(100 * c.share).toFixed(1)}%`);
  // ⚠️ 票 47 加的这一行：色板外像素。以前它被**静默丢掉** ⇒ 「交付图与色板对不上」**没有落点**。
  //   ⚠️ 它是**诊断观察**，**不是失败条件、不是阈值、不是验收判据** —— 实测那些色板外的颜色来自
  //   drawlist 里手写的 `opacity < 1`（半透明混合）⇒ **它可以是设计**。
  const off = usage.offPalette;
  lines.push(
    `色板外像素 ${off.pixels} 个 · 占全部不透明像素 ${(100 * off.share).toFixed(2)}%` +
    (off.colors.length > 0 ? ` · 前几色 ${off.colors.map((c) => `${c.color}(${c.pixels})`).join(" ")}` : "") +
    `（**观察，不是判据** —— 对不上可以是设计）`
  );

  const data: InspectData = {
    packId: m.id, version: m.version, provenanceMode: m.provenance.mode,
    assets: m.assets.map((a) => ({ id: a.id, kind: a.kind, size: a.size, origin: a.origin,
      paletteBinding: a.paletteBinding, frames: a.frames.length,
      animations: (a.animations ?? []).map((x) => ({ name: x.name, frames: x.frames.length, fps: x.fps ?? null, loop: x.loop })) })),
    paletteUsage: usage, layerCoverage: bg,
    sourceSizes: sourceSizes.entries,
  };
  return {
    command: "inspect", summary: lines, data,
    artifacts: [{ path: rel(root, opts.packDir), kind: "asset-pack" }],
  };
}

export type { AssetPackManifest };
export { createDrawListGenerator, assetTask, drawListFewShot, drawListOpsSpec, paletteLine };
