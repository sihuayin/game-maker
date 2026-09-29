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
  auditGameConfig, entityBox, FALLBACK_ANCHOR, parseAssetPack, parseGameConfig, parseRecipe,
  type AssetPackManifest, type StyleSpec,
} from "@game-maker/contracts";
import { createDrawListGenerator, GenerationError, stripFences } from "./generate.js";
import { buildAssetPack, type GenerateImage } from "./pack.js";
import { createDashScopeMcpGenerator, createGeminiGenerator, createOpenAIGenerator, ImageGenerationError } from "./image-gen.js";
import { describeImageTransport, type ImageTransport } from "./image-config.js";
import { createProxyFetch } from "./http.js";
import { assetTask, drawListFewShot, drawListOpsSpec, paletteLine, styleBrief } from "./prompt.js";

// ⚠️ **2026-09-29 搬到 `@game-maker/contracts`**（票 33）—— `site` 装配住在 `demo`，
//   而依赖图里 demo 只能依赖 contracts。这里**引入 + 原样再导出**，调用方一行都不用改。
import { CommandError, EXIT, type CommandResult } from "@game-maker/contracts";
export { CommandError, EXIT, exitCodeOfError, type CommandResult } from "@game-maker/contracts";
export type Transport = { baseUrl: string; apiKey: string };
const rel = (root: string, p: string) => path.relative(root, p).split(path.sep).join("/");

// ── derive：需求 + StyleSpec → 资源清单 ──────────────────────────────────────
export type DeriveOptions = { requirementPath: string; stylePath: string; outRoot: string; transport?: Transport; fetchImpl?: typeof fetch };

/**
 * 推导一份资源清单。**两阶段的第一阶段**（票 28）—— 清单落盘，人过目，再 `pack`。
 *
 * ⚠️ 清单**绝不覆盖**：每次推导写一个新的 `v<N>`（与资源包同一条规矩）。
 */
export async function deriveRecipe(opts: DeriveOptions): Promise<CommandResult> {
  const requirement = fs.readFileSync(opts.requirementPath, "utf8");
  const style = JSON.parse(fs.readFileSync(opts.stylePath, "utf8")) as StyleSpec;
  if (!opts.transport) throw new CommandError("upstream", "推导需要文本上游；它现在不可达（清单是文件，人可以直接写一份）");

  const prompt = `你是游戏资源策划。根据下面的**需求**与**风格规格**，产出一份完整的资源清单。
⚠️ **所有资源的 source 都写 {"kind":"drawlist"}** —— 你无法知道人工导入的位图放在哪，
   也无法替人决定哪个资源该花钱调生图模型（source.kind = "image"）。
那一项由人后续自己填。

只输出 JSON 本体，不要 markdown 围栏，不要解释。
清单要完整：需求里点名的每一种资源都列出来，该拆的拆开（两种障碍是两条）。
⚠️ **同一个东西的多个动作是「一个资源、多个动画」，不是多个资源** ——
玩家角色的 idle/run/jump 应当是**一个**资源，带三个 animation；
「不同的资源」指的是**不同的东西**（玩家 / 货箱 / 罐头 / 背景）。
dependencies 只用于生成顺序，绝大多数清单不需要它。

# 需求
${requirement}

# 风格规格
${styleBrief(style)}

# 清单格式（asset-recipe/v1）
{"format":"asset-recipe/v1","id":"<slug>","styleRef":"${rel(opts.outRoot, opts.stylePath)}","assets":[
 {"spec":{"kind":"sprite|animation|background|ui","id":"<slug>","role":"...","description":"...",
   "styleId":"${style.id}","anchor":{"x":0..1,"y":0..1},"size":{"w":int,"h":int},
   "dependencies":[],"required":true,
   "animations":[{"name":"...","frames":int,"fps":num,"loop":bool}]},
  "source":{"kind":"drawlist"}}]}

四条硬规则（**会被 schema 强制检查，违反直接拒收**）：
1. \`sprite\` —— **不许出现 \`animations\` 这个键**（它只有一帧）。会动的才是 animation。
2. \`animation\` —— 必须有 \`animations\`，至少一个。
3. \`background\` 是场景尺度；\`ui\` 是**屏幕空间**（世界里的招牌是 sprite，不是 ui）。
4. \`animations[].frames\` 是**帧数**（整数），不是帧名。

每个 spec 只许有这些键：kind / id / role / description / styleId / anchor / size / dependencies / required。
按类可以另加，且**形状必须逐字如下**：
  animation  → "animations":[{"name":"walk","frames":4,"fps":8,"loop":true}, ...]
  background → "layers":[{"name":"sky","parallax":0.3},
                         {"name":"ground","parallax":1,"tileable":{"x":true,"y":false}}]
               ← **数组**，每项是对象，**从远到近**排序；层名会拼成帧名 \`<资源 id>.<层名>\`
               ← 不平铺的层**别写 tileable**（三层里通常只有墙与地平铺，天空不平铺）
  ui         → "ninePatch":{"left":4,"right":4,"top":4,"bottom":4}
**多余一个键、或形状不对，就会被拒收。**`;

  // ⚠️ 有界重试，与生成器同一条道理：推导是**重采样**，不是修复循环（不把错误喂回去）。
  //   实测它真的会偶发不过 schema（第一版没有重试，一次形状违规就让整条命令挂掉）。
  let checked: ReturnType<typeof parseRecipe> | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try { raw = await callText({ ...opts.transport, prompt, fetchImpl: opts.fetchImpl }); }
    catch (e) { throw new CommandError("upstream", (e as Error).message); }
    let parsed: unknown;
    try { parsed = JSON.parse(stripFences(raw)); }
    catch (e) { lastError = `上游返回的不是合法 JSON：${(e as Error).message}`; continue; }
    const r = parseRecipe(parsed);
    if (r.ok) { checked = r; break; }
    lastError = `推导出来的清单不过 schema：${r.errors.slice(0, 4).join("；")}`;
  }
  if (!checked?.ok) throw new CommandError("invalid", lastError);

  const dir = path.join(opts.outRoot, checked.value.id, "recipes");
  fs.mkdirSync(dir, { recursive: true });
  // StyleSpec 与配方放**同一个目录**，于是 styleRef 就是一个普通文件名 —— 不需要 `..`。
  // （它是这个项目的输入之一，本来就该跟着配方走。）
  fs.copyFileSync(opts.stylePath, path.join(dir, "stylespec.json"));
  const version = nextVersion(dir);
  const file = path.join(dir, `v${version}.json`);
  fs.writeFileSync(file, JSON.stringify({ ...checked.value, styleRef: "stylespec.json" }, null, 2) + "\n");

  const kinds: Record<string, number> = {};
  for (const a of checked.value.assets) kinds[a.spec.kind] = (kinds[a.spec.kind] ?? 0) + 1;
  return {
    command: "derive",
    summary: [`清单已落盘：${rel(opts.outRoot, file)}`, `${checked.value.assets.length} 个资源（${Object.entries(kinds).map(([k, v]) => `${k}×${v}`).join(" · ")}）`],
    data: { recipeId: checked.value.id, version, assetCount: checked.value.assets.length, kinds },
    artifacts: [{ path: rel(opts.outRoot, file), kind: "asset-recipe" }],
  };
}

/** 调一次文本上游（`derive` 用；生成走 `createDrawListGenerator`）。 */
async function callText(opts: Transport & { prompt: string; fetchImpl?: typeof fetch }): Promise<string> {
  const doFetch = opts.fetchImpl ?? fetch;
  const res = await doFetch(`${opts.baseUrl}/v1/messages`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: "deepseek-v4-pro", max_tokens: 32_000, thinking: { type: "disabled" }, messages: [{ role: "user", content: opts.prompt }] }),
  });
  if (!res.ok) throw new Error(`上游返回 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`);
  const j = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
}

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
    anims: { idle: "<idle 动画名>", run: "<run 动画名>", jump: "<jump 动画名>" },
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
    panel: { asset: "<ui 面板资源的 id>", at: { x: 8, y: 262 }, size: { w: 72, h: 32 } },
    pip: { asset: "<ui 标记资源的 id>", at: { x: 12, y: 250 }, step: { x: 20, y: 0 } },
  },
  objective: { kind: "collect-then-reach", gate: "gate" },
} as const;

/** 把资源包渲染成模型能读的一张清单：id / 种类 / 尺寸 / **锚点落点** / 动画名 / 背景层。 */
function resourceBrief(manifest: AssetPackManifest): string {
  const lines: string[] = [];
  for (const a of manifest.assets) {
    const anims = a.animations ?? [];
    const animText = anims.length === 0
      ? "（无动画，引用时不必给 anim）"
      : anims.map((x) => `${x.name}(${x.frames.length} 帧)`).join(" · ");
    lines.push(`- \`${a.id}\` · ${a.kind} · ${a.size.w}×${a.size.h}px · 锚点 {x:${a.anchor.x}, y:${a.anchor.y}} · 动画：${animText}`);
    if (a.layers && a.layers.length > 0)
      lines.push(`    背景层（远→近）：${a.layers.map((l) => `${l.name}(parallax ${l.parallax}${l.tileable?.x ? " 可平铺" : ""})`).join(" · ")}`);
  }
  return lines.join("\n");
}

/** 把「锚点」翻译成人能照着摆的一句话 —— 这一条是模型最容易搞错的地方。 */
const anchorHint = (a: { x: number; y: number }): string =>
  a.y === 1 && a.x > 0 ? "底边中心（**站在地面线上的东西写 at.y = 地面线的 y**）"
    : a.y === 1 && a.x === 0 ? "左下角"
      : a.x === 0 && a.y === 0 ? "左上角"
        : `{x:${a.x}, y:${a.y}}（归一化锚点，\`at\` 是它落在的那个点）`;

export type CompileGameOptions = {
  requirementPath: string;
  /** 资源包目录 —— 它**就是**模型要看的资源清单，也是校验的依据。 */
  packDir: string;
  outRoot: string;
  transport?: Transport;
  fetchImpl?: typeof fetch;
  /** 外壳视口。默认 480×270（与票 32 的常量同值）。 */
  viewport?: { w: number; h: number };
};

/**
 * 需求 + 资源包 → 一份 game-config，落盘到 `<out>/<id>/game-configs/v<N>.json`。
 *
 * ⚠️ **先校验、后落盘**。与别的操作不同，这一条的产物是**给机器吃的**：
 *   一份「看起来像那么回事、其实引用解不到」的配置，比没有配置更坏 ——
 *   它会在很久之后的装配那一步才炸，而且炸得像包有问题。
 *   ⚠️ 但它**照常落盘**（只是同时报出来）：票 09 裁决 2 说「人过目」，
 *   而人过目的前提是**他看得到哪儿不对** —— 不落盘的话他连看的东西都没有。
 */
export async function compileGame(opts: CompileGameOptions): Promise<CommandResult> {
  const requirement = fs.readFileSync(opts.requirementPath, "utf8");
  const manifestPath = path.join(opts.packDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new CommandError("usage", `不是资源包（没有 manifest.json）：${opts.packDir}`);
  const mp = parseAssetPack(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
  if (!mp.ok) throw new CommandError("invalid", `资源包不过 schema：${mp.errors.slice(0, 4).join("；")}`);
  const manifest = mp.value;
  if (!opts.transport) throw new CommandError("upstream", "编译需要文本上游；它现在不可达（配置是文件，人可以直接写一份）");

  const vp = opts.viewport ?? DEFAULT_VIEWPORT;
  const prompt = `你是游戏关卡设计师。根据下面的**需求**与**资源包清单**，产出一份 game-config（game-config/v1）。

只输出 JSON 本体，不要 markdown 围栏，不要解释。

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
   世界可以宽 1440，但屏幕只有 ${vp.w} 宽 —— HUD 写到 x > ${vp.w - 72} 就跑出屏幕了，直接拒。
9. \`anim\` 只在资源有**多个**动画时才需要，且必须是清单里**真实存在**的动画名。
   ⚠️ **只许用下面清单里的 id 与动画名** —— 清单里没有的一律拒收。

# 需求
${requirement}

# 资源包清单（**只许用这里面的东西**）
${resourceBrief(manifest)}

# 锚点的意思（照这个摆）
${[...new Set(manifest.assets.map((a) => `${a.kind}：${anchorHint(a.anchor)}`))].join(" · ")}

# 形状（**逐字照抄这个骨架**；\`<…>\` 是占位符，换成清单里真实的 id 与动画名）
${JSON.stringify(gameConfigExample, null, 2)}

⚠️ 骨架里的**位置只是示意**（都摆在地面线上）—— 按需求把东西铺开，并让关卡真的可通关：
玩家能跳的高度是有限的，台阶别高过它。`;

  // 有界重试，与 derive 同一条道理：编译是**重采样**，不是修复循环（不把错误喂回去）
  let checked: ReturnType<typeof parseGameConfig> | null = null;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let raw: string;
    try { raw = await callText({ ...opts.transport, prompt, fetchImpl: opts.fetchImpl }); }
    catch (e) { throw new CommandError("upstream", (e as Error).message); }
    let parsed: unknown;
    try { parsed = JSON.parse(stripFences(raw)); }
    catch (e) { lastError = `上游返回的不是合法 JSON：${(e as Error).message}`; continue; }
    const r = parseGameConfig(parsed);
    if (r.ok) { checked = r; break; }
    lastError = `编译出来的配置不过 schema：${r.errors.slice(0, 4).join("；")}`;
  }
  if (!checked?.ok) throw new CommandError("invalid", lastError);

  const config = checked.value;

  // ── 落盘**之前**先校验：产物是给机器吃的，坏配置比没配置更坏 ──────────────
  //
  // ⚠️ 这里跑的是 `site` 要跑的同一批校验（减去第四族 —— 那条是**包**的性质，
  //   与模型写的配置无关：可平铺的层对任何世界宽都盖得住，不平铺的层只有 parallax = 0 才行，
  //   两条都不看 config）。
  const issues: string[] = [];
  for (const i of auditGameConfig(config, manifest))
    issues.push(`${i.severity === "error" ? "❌" : "⚠️"} ${i.where}: ${i.message}`);

  // HUD 的**屏幕空间**边界：校验器看不到视口（那是外壳的常量），所以在这一票里补上。
  // ⚠️ 模型最容易犯的错就是拿世界坐标写 HUD —— 摆到屏幕外，而契约层的校验放它过去。
  const pipSize = manifest.assets.find((a) => a.id === config.hud.pip.asset)?.size ?? { w: 1, h: 1 };
  const panelBox = entityBox(config.hud.panel.at, config.hud.panel.size,
    manifest.assets.find((a) => a.id === config.hud.panel.asset)?.anchor ?? FALLBACK_ANCHOR);
  const hudBoxes: [string, { x: number; y: number; w: number; h: number }][] = [["hud.panel", panelBox]];
  const pickups = config.entities.filter((e) => e.kind === "pickup").length;
  for (let i = 0; i < pickups; i++) {
    const at = { x: config.hud.pip.at.x + i * config.hud.pip.step.x, y: config.hud.pip.at.y + i * config.hud.pip.step.y };
    hudBoxes.push([`hud.pip[${i}]`, entityBox(at, pipSize,
      manifest.assets.find((a) => a.id === config.hud.pip.asset)?.anchor ?? FALLBACK_ANCHOR)]);
  }
  for (const [where, b] of hudBoxes)
    if (b.x < 0 || b.y < 0 || b.x + b.w > vp.w || b.y + b.h > vp.h)
      issues.push(`❌ ${where}: HUD 活在**屏幕空间**，必须落在视口 ${vp.w}×${vp.h} 内；而它的盒子是 (${b.x},${b.y}) ${b.w}×${b.h}`);

  const dir = path.join(opts.outRoot, manifest.id, "game-configs");
  fs.mkdirSync(dir, { recursive: true });
  const version = nextVersion(dir);
  const file = path.join(dir, `v${version}.json`);
  fs.writeFileSync(file, JSON.stringify(config, null, 2) + "\n");

  const bad = issues.filter((i) => i.startsWith("❌"));
  return {
    command: "compile-game",
    summary: [
      `配置已落盘：${rel(opts.outRoot, file)}（v${version}）`,
      `${config.entities.length} 个实体 · ${pickups} 个拾取物 · 世界 ${config.world.size.w}×${config.world.size.h}`,
      bad.length === 0
        ? `✅ 校验全过${issues.length ? `（${issues.length} 条警告）` : ""} —— 下一步：game-maker site ${rel(opts.outRoot, opts.packDir)} --config ${rel(opts.outRoot, file)}`
        : `❌ **这份配置过不了校验**（${bad.length} 条）—— 改完再 \`site\`：`,
      ...(bad.length ? issues : []),
    ],
    data: {
      gameId: manifest.id, version, configPath: rel(opts.outRoot, file),
      entityCount: config.entities.length, pickupCount: pickups,
      worldSize: config.world.size, issues, ok: bad.length === 0,
    },
    artifacts: [{ path: rel(opts.outRoot, file), kind: "game-config" }],
  };
}

// ── pack：清单 → 资源包 ─────────────────────────────────────────────────────
export type PackOptions = {
  recipePath: string; outRoot: string; transport: Transport;
  /** 生图上游。清单里有 `kind:"image"` 的资源时必填 —— 缺了就是**用法错**（2），不是上游错。 */
  imageTransport?: ImageTransport;
  fetchImpl?: typeof fetch;
  onProgress?: (done: number, total: number, assetId: string) => void;
};

/**
 * 按 `protocol` 造出生图端口。**只有实测跑通过的那种才实现** ——
 * 剩下的显式抛「没实现」，而不是猜一个形状发出去（krill 那种「长得像 OpenAI 但什么都不实现」
 * 的中转真实存在，猜形状的代价是花着钱拿到一个 200/0 字节）。
 */
function imageGeneratorFor(t: ImageTransport, fetchImpl?: typeof fetch): GenerateImage {
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

export async function packAssets(opts: PackOptions): Promise<CommandResult> {
  const recipe = JSON.parse(fs.readFileSync(opts.recipePath, "utf8"));
  const r = parseRecipe(recipe);
  if (!r.ok) throw new CommandError("invalid", `清单不过 schema：${r.errors.slice(0, 4).join("；")}`);
  const styleAbs = path.resolve(path.dirname(opts.recipePath), r.value.styleRef);
  const style = JSON.parse(fs.readFileSync(styleAbs, "utf8")) as StyleSpec;

  const needsImage = r.value.assets.some((a) => a.source.kind === "image");
  if (needsImage && !opts.imageTransport)
    throw new CommandError("usage",
      `这份清单里有 source.kind="image" 的资源，但**没配生图凭据** —— ` +
      `写 game-maker.local.json（已 gitignore）或设 GAME_MAKER_IMAGE_* 环境变量。`);

  let res;
  try {
    res = await buildAssetPack({
      recipe: r.value, style, outDir: opts.outRoot,
      // `source.ref` 相对**配方文件**解析（契约 `InputPath` 定的规则，与 `styleRef` 一致）
      recipeDir: path.dirname(path.resolve(opts.recipePath)),
      generate: createDrawListGenerator({
        baseUrl: opts.transport.baseUrl, apiKey: opts.transport.apiKey,
        ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
      }),
      ...(opts.imageTransport
        ? { generateImage: imageGeneratorFor(opts.imageTransport, opts.fetchImpl) }
        : {}),
      ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
    });
  } catch (e) {
    // ⚠️ 生成失败**就是**「上游不可达」（3），不是「失败」（1）。
    // 拆掉降级链之前这条分支不会发生 —— 上游死活都被兜底吸收，pack 永远成功。
    if (e instanceof GenerationError || e instanceof ImageGenerationError) throw new CommandError("upstream", e.message);
    throw e;
  }
  const m = res.manifest;
  return {
    command: "pack",
    summary: [`资源包：${rel(opts.outRoot, res.packDir)}（v${m.version}）`,
      `${m.assets.length} 个资源 · ${m.atlases.length} 张图集 · ${m.files.length} 个文件`,
      `来源：${m.provenance.mode}`,
      ...(res.imageCalls.length > 0
        ? [`生图：${res.imageCalls.length} 次调用 · ${res.imageCalls.map((c) => c.assetId).join(" ")}`]
        : [])],
    data: {
      packId: m.id, version: m.version,
      ...(res.imageCalls.length > 0
        ? { imageCalls: res.imageCalls, imageUpstream: describeImageTransport(opts.imageTransport) }
        : {}),
      assetCount: m.assets.length, fileCount: m.files.length,
      provenanceMode: m.provenance.mode, paletteCoverage: m.palette.coverage,
    },
    artifacts: [{ path: rel(opts.outRoot, res.packDir), kind: "asset-pack" }],
  };
}

// ── verify：校验一个已有资源包 ───────────────────────────────────────────────
export type VerifyOptions = { packDir: string; outRoot?: string };

/** 校验一个包：schema + **逐文件 checksum** + spec↔产物对账。 */
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
  const onDisk = walk(opts.packDir).filter((p) => p !== "manifest.json").sort();
  const declared = m.files.map((f) => f.path);
  for (const p of onDisk) if (!declared.includes(p)) problems.push(`files[] 没记录的文件：${p}`);

  // ⚠️ **校验不过是失败**（退出码 4），不是某种「可用的降级产物」。
  if (problems.length > 0) throw new CommandError("invalid", `校验不过（${problems.length} 处）：${problems.slice(0, 6).join("；")}`);

  return {
    command: "verify",
    summary: [`✅ ${rel(root, opts.packDir)} 通过：${m.files.length} 个文件的 checksum 全部对得上`,
      `来源：${m.provenance.mode}`],
    data: { packId: m.id, version: m.version, ok: true, problems: [], provenanceMode: m.provenance.mode },
    artifacts: [],
  };
}

const walk = (dir: string, base = ""): string[] => fs.readdirSync(dir, { withFileTypes: true })
  .flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name), `${base}${d.name}/`) : [`${base}${d.name}`]));

// ── inspect：包里有什么 ─────────────────────────────────────────────────────
export function inspectPack(opts: { packDir: string; outRoot?: string }): CommandResult {
  const root = opts.outRoot ?? path.dirname(path.resolve(opts.packDir));
  const parsed = parseAssetPack(JSON.parse(fs.readFileSync(path.join(opts.packDir, "manifest.json"), "utf8")));
  if (!parsed.ok) throw new CommandError("invalid", `manifest 不过 schema：${parsed.errors.slice(0, 6).join("；")}`);
  const m = parsed.value;
  const lines = [`${m.id} v${m.version} · ${m.provenance.mode}`, `${m.assets.length} 个资源 · ${m.atlases.length} 张图集`];
  for (const a of m.assets) {
    const anim = a.animations?.length ? ` · 动画 ${a.animations.map((x) => `${x.name}(${x.frames.length})`).join(" ")}` : "";
    lines.push(`  ${a.id} · ${a.kind} · ${a.size.w}×${a.size.h} · ${a.origin}/${a.paletteBinding} · ${a.frames.length} 帧${anim}`);
  }
  return {
    command: "inspect", summary: lines,
    data: {
      packId: m.id, version: m.version, provenanceMode: m.provenance.mode,
      assets: m.assets.map((a) => ({ id: a.id, kind: a.kind, size: a.size, origin: a.origin,
        paletteBinding: a.paletteBinding, frames: a.frames.length,
        animations: (a.animations ?? []).map((x) => ({ name: x.name, frames: x.frames.length, fps: x.fps ?? null, loop: x.loop })) })),
    },
    artifacts: [{ path: rel(root, opts.packDir), kind: "asset-pack" }],
  };
}

export type { AssetPackManifest };
export { createDrawListGenerator, assetTask, drawListFewShot, drawListOpsSpec, paletteLine };
