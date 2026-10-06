// 文本那两个操作的账（票 28）：**一笔账 = 一次往返**，且失败的那笔**说得出为什么**。
//
// ⚠️ 这一族的存在理由：`derive`（现 `plan-assets`）与 `compileGame`（现 `compile-runtime`）的账以前是坏的，
//   而且是**两种不同的坏法** ——
//   `derive`（现在是 `plan-assets`）每一轮**覆盖写**、`attempts` 恒为 1（重采样在账上完全不可见）；
//   `compileGame` **一分账都不交**（因为 `LedgerStep` 枚举里**根本没有 `compile-game`**）。
//   两者都让票 27 要的那个数 —— 「首发到底成不成、不成是因为什么」—— 读不出来。
//
// ⚠️ **一格 = 一次调用**（`CONTEXT.md` 的「调用 / 往返」）：重采样**不新开一格**，
//   而是在同一格里把 `attempts` 加上去、把每次没成的原因追加进 `failures`。
//   两个都留着才同时回答得了「重试烧了多少」**和**「每次为什么重来」。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CALL_FAILURES, parseRecipe, STRUCTURED_CALL_ATTEMPTS, type GameDesignSpec, type VisualWorldSpec } from "@game-maker/contracts";
import { CommandError, compileRuntime, planAssets } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const STYLE = path.join(ROOT, "fixtures/style-spec.halt-dusk.json");
const RECIPE = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/recipes/shift-change.json"), "utf8"));
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const GAME_CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/game-configs/last-train.json"), "utf8"));

const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-text-ledger-"));
  fs.writeFileSync(path.join(d, "requirement.md"), "做一个横版跳跃小关卡。");
  return d;
};
/** 上游的回应体是 **Anthropic 的 messages 形状**（`callText` 读 `content[].text`），不是裸 JSON。 */
const upstream = (payload: unknown): typeof fetch =>
  (async () => new Response(
    JSON.stringify({ content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload) }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  )) as typeof fetch;

type Rec = { step: string; target: string; attempts: number; failures?: string[] };

describe("⚠️ 先验正例：夹具本身得是合法的", () => {
  it("`fixtures/recipes/shift-change.json` 过 schema —— 不然下面测的就不是账，是别的东西为什么失败了", () => {
    const r = parseRecipe(RECIPE);
    expect(r.ok, r.ok ? "" : r.errors.join("；")).toBe(true);
  });
});

describe("`plan-assets` 的账（它取代了 `derive` —— 而协议从「纯文本」换成了 R16 的工具调用）", () => {
  // ⚠️ **失败档换了**：旧路吐坏 JSON 记 `invalid-json`，这条路上那个值**够不着**（工具调用没有裸 JSON）。
  //   换过来的是 `empty-input`（代理把入参丢了）与两道 `schema`（线形状不过 / v3 契约不过）。
  const DESIGN: GameDesignSpec = {
    format: "game-design/v1",
    game: { title: "拾荒者", genre: "platformer", camera: "side", runtimeProfile: { id: "platformer", version: "1" } },
    coreLoop: ["探索废墟"],
    player: { id: "p-scavenger", role: "拾荒者", abilities: ["跑"], goals: ["在天黑前抵达"] },
    enemies: [{ id: "e-drone", behavior: "沿月台巡逻", threat: "接触即伤" }],
    npcs: [], interactables: [], resources: [],
    world: { theme: "废土", setting: "废墟", structure: "三段式" },
    levels: [{ id: "l-1", purpose: "教学", layout: "左到右", entities: ["e-drone"] }],
    progression: { model: "linear", description: "三关" },
    mechanics: [{ id: "m-jump", mechanic: "jump" }],
    winConditions: ["抵达终点"], loseConditions: [], runtimeRequirements: ["input:keyboard"]
  };
  const REF_PNG = path.join(ROOT, "fixtures/reference/halt-dusk.png");

  /** 把两份上游产物写进 tmp（`planAssets` 吃的是**路径**），返回那一份世界文件所在的目录。 */
  const stage = () => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-plan-"));
    const world: VisualWorldSpec = {
      format: "visual-world/v1",
      styleIdentity: { keywords: ["低饱和"], description: "黄昏的铁路小站" },
      camera: { mode: "side" },
      composition: { foreground: "铁轨", midground: "月台", background: "远山" },
      lighting: {}, character: {}, environment: {},
      palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
      materials: {}, shapeLanguage: [], constraints: [],
      // ⚠️ 相对**它自己**（`visual-world.json` 所在目录）—— 契约就是这么定的。
      styleReferences: [{ path: path.relative(d, REF_PNG), role: "global" }],
      style: {
        id: "halt-dusk", identity: [], camera: {}, composition: {}, palette: ["#112233", "#445566"],
        lighting: {}, shapeLanguage: [], material: [], environment: [], characterStyle: [], constraints: [], confidence: 0.5
      }
    };
    fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify(DESIGN));
    fs.writeFileSync(path.join(d, "visual-world.json"), JSON.stringify(world));
    return d;
  };
  const run = (d: string, fetchImpl: typeof fetch, over: Record<string, unknown> = {}) =>
    planAssets({
      designPath: path.join(d, "game-design.json"), visualWorldPath: path.join(d, "visual-world.json"),
      outRoot: path.join(d, "out"), transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl, ...over,
    });

  /** 上游的回应体是**工具调用那一档**（`parseToolUse` 读 `content[].input`），不是 `content[].text`。 */
  const toolReply = (input: unknown): typeof fetch =>
    (async () => new Response(
      JSON.stringify({
        content: [{ type: "tool_use", name: "emit_asset_recipe", input }],
        stop_reason: "tool_use", model: "deepseek-flash", usage: { input_tokens: 900, output_tokens: 1200 }
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;
  /** 只回一段文字、压根没调工具。 */
  const noTool: typeof fetch =
    (async () => new Response(JSON.stringify({ content: [{ type: "text", text: "我拒绝" }], stop_reason: "end_turn" }),
      { status: 200, headers: { "content-type": "application/json" } })) as typeof fetch;

  it("一次就成 ⇒ 账上一格，`failures` 缺席（缺席 == 一次都没失败）", async () => {
    const d = stage();
    const r = await run(d, toolReply(RECIPE));
    const ledger = r.data.ledger as Rec[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ step: "plan-assets", target: "recipe", attempts: 1, model: "deepseek-flash" });
    expect(ledger[0]!.failures).toBeUndefined();
  });

  it("⚠️ 第一发**入参丢了**（`empty-input`）⇒ 重采样，一格账、`attempts` 2、病因写得出", async () => {
    const d = stage();
    let n = 0;
    const flaky = (async () => new Response(
      JSON.stringify({
        content: [{
          type: "tool_use", name: "emit_asset_recipe",
          input: n++ === 0 ? {} : RECIPE // 票 27 第 1 发实测过的那一档：工具被调、入参是空的
        }],
        stop_reason: "tool_use", model: "deepseek-flash", usage: { output_tokens: 1100 }
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;
    const r = await run(d, flaky);
    const ledger = r.data.ledger as Rec[];
    expect(ledger, "一格 = 一次调用，不是一次往返").toHaveLength(1);
    expect(ledger[0]!.attempts, "两趟往返").toBe(2);
    expect(ledger[0]!.failures, "而第一趟为什么没成，账上写得出").toEqual(["empty-input"]);
  });

  it("⚠️ **线形状过了还不够**：一份 `dependsOn` 有环的清单 ⇒ 由 v3 契约判死，**照样**算 `schema`、照样重采样", async () => {
    // 这一条盯的是那条**两层分工**：v4 镜像只判形状（没有 refine），
    // 所以「成不成立」只能由 `parseRecipe` 说了算 —— 而它的失败必须被记成 `schema`，不能漏。
    const cyclic = structuredClone(RECIPE) as { assets: { spec: { id: string; dependsOn?: string[] } }[] };
    const [a, b] = cyclic.assets;
    a!.spec.dependsOn = [b!.spec.id];
    b!.spec.dependsOn = [a!.spec.id];
    const d = stage();
    const e = await run(d, toolReply(cyclic)).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).message).toMatch(/有环/);
    const ledger = (e as CommandError).ledger as Rec[];
    expect(ledger[0]!.failures, "三次都记了，且按发生顺序").toEqual(["schema", "schema", "schema"]);
  });

  it("全都不成 ⇒ 失败**也把账带出来**，而且**每一次**的病因都在", async () => {
    const d = stage();
    const e = await run(d, noTool).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    const ledger = (e as CommandError).ledger as Rec[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.attempts, "地板值那几次都试过").toBe(STRUCTURED_CALL_ATTEMPTS);
    expect(ledger[0]!.failures).toEqual(Array(STRUCTURED_CALL_ATTEMPTS).fill("no-tool-use"));
  });

  it("⚠️ **上游挂了与模型吐坏数据是两个数** —— 前者当场停、记 `http`，不重采样", async () => {
    const d = stage();
    const e = await run(d, (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch)
      .catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("upstream");
    const ledger = (e as CommandError).ledger as Rec[];
    expect(ledger, "发出去过就得记（票 46）").toHaveLength(1);
    expect(ledger[0]!.attempts, "只发了一趟 —— 上游挂了当场停，不重采样").toBe(1);
    expect(ledger[0]!.failures).toEqual(["http"]);
  });

  it("⚠️ **没配凭据 ⇒ 账上不该有这一笔**：请求压根没上路（票 46 只记真的发出去的）", async () => {
    const d = stage();
    const e = await run(d, toolReply(RECIPE), { transport: { baseUrl: "", apiKey: "" } }).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("upstream");
    expect((e as CommandError).message).toMatch(/ANTHROPIC_BASE_URL/);
    expect((e as CommandError).ledger, "一次都没发出去").toBeUndefined();
  });

  it("⚠️ 落盘：**风格与参考图拷进配方目录**，`styleRef` / `referenceImage` 是普通文件名（与 `derive` 同款）", async () => {
    const d = stage();
    const r = await run(d, toolReply(RECIPE));
    const recipeFile = path.join(d, "out", RECIPE.id, "recipes", "v1.json");
    const onDisk = JSON.parse(fs.readFileSync(recipeFile, "utf8")) as {
      styleRef: string; referenceImage?: string; assets: unknown[];
    };
    expect(onDisk.styleRef).toBe("stylespec.json");
    expect(onDisk.referenceImage, "世界给了参考图 ⇒ 拷进来并指过去").toBe("reference.png");
    expect(fs.readFileSync(path.join(d, "out", RECIPE.id, "recipes", "stylespec.json"), "utf8")).toContain("halt-dusk");
    expect(fs.readFileSync(path.join(d, "out", RECIPE.id, "recipes", "reference.png"))).toEqual(fs.readFileSync(REF_PNG));
    expect(r.artifacts?.[0]).toMatchObject({ kind: "asset-recipe" });
  });
});

describe("`compile-runtime` 的账（它取代了 `compileGame` —— 协议换成 R16 的工具调用）", () => {
  // ⚠️ 它是那个「**一分账都不交**」的案子的主角：根因是 `LedgerStep` 枚举里**根本没有**
  //   `compile-game` 这个值（票 28 补上）。本票把它改写成 `compile-runtime`，而**值也换了一个**。
  const DESIGN = {
    format: "game-design/v1",
    game: { title: "末班车", genre: "platformer", camera: "side", runtimeProfile: { id: "platformer", version: "1" } },
    coreLoop: ["躲开行李", "捡齐失物", "走到信号灯"],
    player: { id: "p", role: "邮差", abilities: ["跑"], goals: ["赶上末班车"] },
    enemies: [], npcs: [], interactables: [], resources: [],
    world: { theme: "黄昏的铁路小站", setting: "月台", structure: "三条横带" },
    levels: [{ id: "l-1", purpose: "唯一一关", layout: "左到右", entities: [] }],
    progression: { model: "linear", description: "一关到底" },
    mechanics: [{ id: "m-jump", mechanic: "jump" }],
    winConditions: [], loseConditions: [], runtimeRequirements: ["input:keyboard"]
  };
  const stage = () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify(DESIGN));
    return d;
  };
  const run = (d: string, fetchImpl: typeof fetch, over: Record<string, unknown> = {}) =>
    compileRuntime({
      designPath: path.join(d, "game-design.json"), packDir: PACK, outRoot: path.join(d, "out"),
      transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl, ...over,
    });
  /** 上游的回应体是**工具调用那一档**（`parseToolUse` 读 `content[].input`）。 */
  const tool = (input: unknown, model = "deepseek-flash"): typeof fetch =>
    (async () => new Response(
      JSON.stringify({ content: [{ type: "tool_use", name: "emit_game_config", input }], stop_reason: "tool_use", model }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;

  it("成了 ⇒ `data.ledger` 里有账，`step` 是 `compile-runtime`", async () => {
    const d = stage();
    const r = await run(d, tool(GAME_CONFIG));
    const ledger = r.data.ledger as Rec[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ step: "compile-runtime", target: "game-config", attempts: 1 });
  });

  it("⚠️ 入参丢了（`empty-input`）⇒ 重采样，一格账、`attempts` 2、病因写得出", async () => {
    const d = stage();
    let n = 0;
    const flaky = (async () => new Response(
      JSON.stringify({
        content: [{ type: "tool_use", name: "emit_game_config", input: n++ === 0 ? {} : GAME_CONFIG }],
        stop_reason: "tool_use", model: "deepseek-flash",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as unknown as typeof fetch;
    const r = await run(d, flaky);
    const ledger = r.data.ledger as Rec[];
    expect(ledger).toHaveLength(1);
    expect(ledger[0]!.attempts).toBe(2);
    expect(ledger[0]!.failures).toEqual(["empty-input"]);
  });

  it("⚠️ 超时 ⇒ `timeout`，**不是** `http` —— 那是我们主动中止的，不是上游回了个坏应答", async () => {
    const d = stage();
    const hang = ((_url: unknown, init?: { signal?: AbortSignal }) =>
      new Promise((_res, rej) => { init?.signal?.addEventListener("abort", () => rej(new Error("aborted"))); })
    ) as unknown as typeof fetch;
    const e = await run(d, hang, { timeoutMs: 30 }).catch((x: unknown) => x);
    const ledger = (e as CommandError).ledger as Rec[];
    expect(ledger[0]!.failures).toEqual(["timeout"]);
  });

  it("⚠️ 病因**只许出自闭集** —— 否则「率」的分母会悄悄漂", async () => {
    const d = stage();
    const e = await run(d, (async () => new Response("boom", { status: 503 })) as unknown as typeof fetch)
      .catch((x: unknown) => x);
    for (const c of (e as CommandError).ledger ?? []) {
      for (const f of c.failures ?? []) expect(CALL_FAILURES).toContain(f);
    }
  });
});
