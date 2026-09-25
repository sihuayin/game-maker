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
import { parseAssetPack, parseRecipe, type AssetPackManifest, type StyleSpec } from "@game-maker/contracts";
import { buildPackResilient, type Endpoint, type ProbeResult } from "./degrade.js";
import { createDrawListGenerator, stripFences } from "./generate.js";
import { assetTask, drawListFewShot, drawListOpsSpec, paletteLine, styleBrief } from "./prompt.js";

export type CommandOutcome = "ok" | "degraded";

export type CommandResult = {
  command: string;
  /** `degraded` **仍然是成功** —— 退出码 0（票 14：降级是正常运营模式）。 */
  outcome: CommandOutcome;
  /** 人类可读的几行。CLI 直接打印，MCP 放进 content。 */
  summary: string[];
  /** 机器可读的载荷。路径一律相对 `outRoot`。 */
  data: Record<string, unknown>;
  /** 产物（相对 `outRoot` 的路径 + 种类）。 */
  artifacts: { path: string; kind: string }[];
  degradations: { stage: string; reason: string; fellBackTo: string }[];
  transport?: { preferred: string; used: string; switches: { from: string; to: string; reason: string }[] };
  probes?: ProbeResult[];
};

/**
 * 退出码语义。
 * **降级成功也是 0** —— 降级是正常运营模式（票 14），产物可用且已标注；
 * 脚本要分支就读 `data.degraded`，而不是靠一个「成功但不成功」的怪码。
 */
export const EXIT = { ok: 0, failure: 1, usage: 2, upstream: 3, invalid: 4 } as const;

/** 失败**不**放进 `CommandResult.outcome` —— 它抛。这样「成功」这个类型里没有假货。 */
export class CommandError extends Error {
  constructor(readonly kind: keyof typeof EXIT, message: string) { super(message); this.name = "CommandError"; }
}
/** 成功的操作（含降级）永远是 0。 */
export const exitCodeOf = (_r: CommandResult): number => EXIT.ok;
export const exitCodeOfError = (e: unknown): number => (e instanceof CommandError ? EXIT[e.kind] : EXIT.failure);

export type Transport = { baseUrl: string; apiKey: string };
const rel = (root: string, p: string) => path.relative(root, p).split(path.sep).join("/");

// ── derive：需求 + StyleSpec → 资源清单 ──────────────────────────────────────
export type DeriveOptions = { requirementPath: string; stylePath: string; outRoot: string; transport?: Transport; fetchImpl?: typeof fetch; offline?: boolean };

/**
 * 推导一份资源清单。**两阶段的第一阶段**（票 28）—— 清单落盘，人过目，再 `pack`。
 *
 * ⚠️ 清单**绝不覆盖**：每次推导写一个新的 `v<N>`（与资源包同一条规矩）。
 */
export async function deriveRecipe(opts: DeriveOptions): Promise<CommandResult> {
  const requirement = fs.readFileSync(opts.requirementPath, "utf8");
  const style = JSON.parse(fs.readFileSync(opts.stylePath, "utf8")) as StyleSpec;
  if (opts.offline || !opts.transport) throw new CommandError("upstream", "推导需要文本上游；它现在不可达（用不到离线兜底 —— 清单是文件，人可以直接写一份）");

  const prompt = `你是游戏资源策划。根据下面的**需求**与**风格规格**，产出一份完整的资源清单。
⚠️ **所有资源的 source 都写 {"kind":"generate"}** —— 你无法知道人工导入的位图放在哪，
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
  "source":{"kind":"generate"}}]}

四条硬规则（**会被 schema 强制检查，违反直接拒收**）：
1. \`sprite\` —— **不许出现 \`animations\` 这个键**（它只有一帧）。会动的才是 animation。
2. \`animation\` —— 必须有 \`animations\`，至少一个。
3. \`background\` 是场景尺度；\`ui\` 是**屏幕空间**（世界里的招牌是 sprite，不是 ui）。
4. \`animations[].frames\` 是**帧数**（整数），不是帧名。

每个 spec 只许有这些键：kind / id / role / description / styleId / anchor / size / dependencies / required。
按类可以另加，且**形状必须逐字如下**：
  animation  → "animations":[{"name":"walk","frames":4,"fps":8,"loop":true}, ...]
  background → "layers":[{"parallax":0.3},{"parallax":1}]   ← **数组**，每项是对象
               "tileable":{"x":true,"y":false}               ← **对象**，不是 true/false
  ui         → "ninePatch":{"left":4,"right":4,"top":4,"bottom":4}
               "screenSpace":true
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
    command: "derive", outcome: "ok", degradations: [],
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

// ── pack：清单 → 资源包 ─────────────────────────────────────────────────────
export type PackOptions = { recipePath: string; outRoot: string; transport: Transport; endpoints?: Endpoint[]; fetchImpl?: typeof fetch; offline?: boolean; onProgress?: (done: number, total: number, assetId: string) => void };

export async function packAssets(opts: PackOptions): Promise<CommandResult> {
  const recipe = JSON.parse(fs.readFileSync(opts.recipePath, "utf8"));
  const r = parseRecipe(recipe);
  if (!r.ok) throw new CommandError("invalid", `清单不过 schema：${r.errors.slice(0, 4).join("；")}`);
  const styleAbs = path.resolve(path.dirname(opts.recipePath), r.value.styleRef);
  const style = JSON.parse(fs.readFileSync(styleAbs, "utf8")) as StyleSpec;

  const res = await buildPackResilient({
    recipe: r.value, style, outDir: opts.outRoot, transport: opts.transport,
    ...(opts.endpoints ? { endpoints: opts.endpoints } : {}), ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
    ...(opts.offline ? { offline: true } : {}),
    ...(opts.onProgress ? { onProgress: opts.onProgress } : {}),
  });
  const m = res.manifest;
  const degraded = m.provenance.degradations.length > 0;
  const lines = [`资源包：${rel(opts.outRoot, res.packDir)}（v${m.version}）`,
    `${m.assets.length} 个资源 · ${m.atlases.length} 张图集 · ${m.files.length} 个文件`,
    `来源：${m.provenance.mode}`];
  if (degraded) lines.push(...m.provenance.degradations.map((d) => `⚠️ 降级（${d.stage}）：${d.reason} → ${d.fellBackTo}`));
  return {
    command: "pack", outcome: degraded ? "degraded" : "ok",
    summary: lines, degradations: m.provenance.degradations,
    ...(m.provenance.transport ? { transport: m.provenance.transport } : {}),
    probes: res.probes,
    data: {
      packId: m.id, version: m.version, transportUsed: res.used,
      assetCount: m.assets.length, fileCount: m.files.length,
      provenanceMode: m.provenance.mode, paletteCoverage: m.palette.coverage, degraded,
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

  // ⚠️ **校验不过是失败，不是降级。** 第一版把两者都塞进 `outcome: "degraded"`，
  //   于是一个被篡改过的包 `verify` 之后**退出码是 0** —— 而那正是 checksum 要防的事。
  //   `degraded` 是票 14 的意思（产物可用但带降级标记），它按裁决就该是成功。
  if (problems.length > 0) throw new CommandError("invalid", `校验不过（${problems.length} 处）：${problems.slice(0, 6).join("；")}`);

  const degradations = m.provenance.degradations;
  return {
    command: "verify", outcome: degradations.length ? "degraded" : "ok",
    degradations,
    summary: [`✅ ${rel(root, opts.packDir)} 通过：${m.files.length} 个文件的 checksum 全部对得上`,
      `来源：${m.provenance.mode}`,
      ...degradations.map((d) => `⚠️ 这个包曾降级：${d.reason} → ${d.fellBackTo}`)],
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
    command: "inspect", outcome: m.provenance.degradations.length ? "degraded" : "ok",
    degradations: m.provenance.degradations, summary: lines,
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
