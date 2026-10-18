// 票 61 · **玩家那件资源**的闸门（配方侧）。
//
// ⚠️ 它盯的是一件**契约链上的事**：配置契约要「**一件**资源同时带 `idle`/`run`/`jump` 三路动画」
//   （外壳按三个键各播一路），而**配方层从前不知道这件事** —— 三个名字一个都不在配方提示词里。
//   第十二次真跑就是这么死的：模型把三路拆成三件（`player-walk` / `player-jump` / `player-idle`），
//   配置那一步挑哪一件都错。
//
// ⚠️ **为什么单起一个文件**：`plan-assets.test.ts` 问的是「发出去的那一发长什么样」（R16 的协议），
//   本文件问的是「**这份清单能不能编出一份能跑的配置**」—— 两件事，各有各的判据。
//
// ⚠️ **判据钉在内容上，不是「配置能过」**（人裁验收第 4 条的原话：只验证配置能过，
//   退化解仍然可能蒙混过关）⇒ 阳性那条**读回盘上那份清单**，逐个断名字与帧数。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  PLAYER_ACTION_NAMES, STRUCTURED_CALL_ATTEMPTS, exitCodeOfError,
  type AssetRecipe, type GameDesignSpec, type VisualWorldSpec,
} from "@game-maker/contracts";
import { CommandError, planAssets } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
/** ⚠️ **真实产物级的阳性夹具**：一件 `player-odin`，`kind:"animation"`、三路齐备、带 `characterId`。 */
const PLAYER_OK = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/recipes/shift-change-master.json"), "utf8")) as AssetRecipe;
const REF_PNG = path.join(ROOT, "fixtures/reference/halt-dusk.png");

/** ⚠️ `player.id` = `p-scavenger` —— 与那份夹具里的 `characterId` 对得上（这是**契约那条链**，
 *   今天只有注释写着；本票第一次拿闸门去对账它）。 */
const DESIGN: GameDesignSpec = {
  format: "game-design/v1",
  game: { title: "拾荒者", genre: "platformer", camera: "side", runtimeProfile: { id: "platformer", version: "1" } },
  coreLoopSteps: ["探索废墟", "收集零件"],
  player: { id: "p-scavenger", role: "拾荒者", abilities: ["跑", "跳"], goals: ["在天黑前抵达"] },
  enemies: [{ id: "e-drone", behavior: "沿月台往复巡逻", threat: "接触即伤" }],
  npcs: [], interactables: [], resources: [],
  world: { theme: "废土", setting: "铁轨旁的废墟", structure: "三条横带：铁轨 / 月台 / 远山" },
  levels: [{ id: "l-1", purpose: "教学关", layout: "左侧出发，右侧终点", entities: ["e-drone"] }],
  progression: { model: "linear", description: "三关" },
  mechanics: [{ id: "m-jump", mechanic: "jump" }],
  winConditions: ["抵达终点"], loseConditions: [], runtimeRequirements: ["input:keyboard"],
};

const playerOf = (r: AssetRecipe) => r.assets.find((e) => e.spec.id === "player-odin")!;

const stage = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-player-gate-"));
  const world: VisualWorldSpec = {
    format: "visual-world/v1",
    styleIdentity: { keywords: ["低饱和"], description: "黄昏的铁路小站" },
    camera: { mode: "side" },
    composition: { foreground: "铁轨", midground: "月台", background: "远山" },
    lighting: {}, character: {}, environment: {},
    palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
    materials: {}, shapeLanguage: [], constraints: [],
    styleReferences: [{ path: path.relative(d, REF_PNG) }],
    style: {
      id: "halt-dusk", identity: [], camera: {}, composition: {}, palette: ["#112233", "#445566"],
      lighting: {}, shapeLanguage: [], material: [], environment: [], characterStyle: [], constraints: [], confidence: 0.5,
    },
  };
  fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify(DESIGN));
  fs.writeFileSync(path.join(d, "visual-world.json"), JSON.stringify(world));
  return d;
};

/** 记下**发出去的那一发**，并回一份给定的清单。 */
const capture = (input: unknown) => {
  const seen: Record<string, any>[] = [];
  const f = (async (_url: string, init: RequestInit) => {
    seen.push(JSON.parse(String(init.body)));
    return new Response(
      JSON.stringify({ content: [{ type: "tool_use", name: "emit_asset_recipe", input }], stop_reason: "tool_use", model: "m",
        usage: { input_tokens: 10, output_tokens: 10 } }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  return { f, seen };
};

const run = (d: string, fetchImpl: typeof fetch) =>
  planAssets({
    designPath: path.join(d, "game-design.json"), visualWorldPath: path.join(d, "visual-world.json"),
    outRoot: path.join(d, "out"), transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl,
    imageTransport: { protocol: "gemini", baseUrl: "http://x", apiKey: "k" },
  });

/** 差一点的清单（每发都回同一份）⇒ 抛出来的那个 `CommandError`。 */
const failure = async (mutate: (r: AssetRecipe) => void) => {
  const d = stage();
  const recipe = structuredClone(PLAYER_OK);
  mutate(recipe);
  const e = await run(d, capture(recipe).f).catch((x: unknown) => x);
  return { d, recipe, e };
};

/** 账上那唯一一格（`plan-assets` / `recipe`）。 */
const callOf = (e: unknown) => ((e as CommandError).ledger as { attempts: number; failures?: string[] }[])[0]!;

describe("票 61 · 阳性：真实夹具那份清单照常落盘", () => {
  it("玩家那件 `kind:\"animation\"`、三路名字逐字等于 `PLAYER_ACTION_NAMES`、`characterId` 指对", async () => {
    const d = stage();
    await run(d, capture(PLAYER_OK).f);
    const file = path.join(d, "out", PLAYER_OK.id, "recipes", "v1.json");
    const onDisk = JSON.parse(fs.readFileSync(file, "utf8")) as AssetRecipe;
    const p = playerOf(onDisk);
    expect(p.spec.kind).toBe("animation");
    expect(p.spec.characterId).toBe(DESIGN.player.id);
    if (p.spec.kind !== "animation") throw new Error("unreachable");
    // ⚠️ **逐字相等**，不是「包含那三个名字」：多一路别的动画不算错，但少一路、改了名就算
    expect(p.spec.animations.map((a) => a.name).filter((n) => (PLAYER_ACTION_NAMES as readonly string[]).includes(n)))
      .toEqual([...PLAYER_ACTION_NAMES]);
    for (const n of PLAYER_ACTION_NAMES)
      expect(p.spec.animations.find((a) => a.name === n)!.frames, `${n} 的帧数`).toBeGreaterThanOrEqual(2);
    // 而全清单里**只有这一件**写着玩家的 id
    expect(onDisk.assets.filter((e) => e.spec.characterId === DESIGN.player.id)).toHaveLength(1);
  });
});

describe("§提示词：那三个名字是**插值**出来的字面（人裁 Q13 第 1 条 · Q12 补充裁定）", () => {
  const textOf = (seen: Record<string, any>[]) => seen[0]!.messages[0].content[0].text as string;

  it("⚠️ 送进模型的那段文本里**直接呈现** idle / run / jump，且**不带尖括号**", async () => {
    const d = stage();
    const c = capture(PLAYER_OK);
    await run(d, c.f);
    const text = textOf(c.seen);
    // ⚠️ **断言的是插值之后真正发出去的那段文本**，不是源码里有个常量（人裁那条验收纪律的原话）
    for (const n of PLAYER_ACTION_NAMES) expect(text).toContain(`\`${n}\``);
    expect(text).toContain("不许改名");
    // ⚠️ 尖括号 = 邀请模型自己起名，而契约要的是照字面
    for (const n of PLAYER_ACTION_NAMES) expect(text).not.toContain(`<${n}`);
    expect(text).not.toContain("<idle");
  });

  it("⚠️ 而**基数**那句也在（恰好一件），且不出现「合并」那种会把约束读成「合起来即可」的说法", async () => {
    const d = stage();
    const c = capture(PLAYER_OK);
    await run(d, c.f);
    const text = textOf(c.seen);
    expect(text).toContain("恰好一件");
    expect(text).toContain("别把三个动作拆成三件");
    expect(text).toContain("每路至少 2 帧");
    // ⚠️ 玩家那个 id 是**具名插值**进来的（模型不必去猜「设计层那个玩家」是谁）
    expect(text).toContain(DESIGN.player.id);
  });
});

describe("§负例：不合规的清单**一页都不落盘**，三发用完退 4（人裁 Q5(r2) = (a)）", () => {
  it("① 缺一路（`jump`）⇒ 退 4，消息点名缺的那一路", async () => {
    const { d, e } = await failure((r) => {
      const p = playerOf(r).spec as { animations: { name: string }[] };
      p.animations = p.animations.filter((a) => a.name !== "jump");
    });
    expect(e).toBeInstanceOf(CommandError);
    expect(exitCodeOfError(e)).toBe(4);
    expect((e as CommandError).message).toMatch(/"jump"/);
    expect(fs.existsSync(path.join(d, "out")), "没落盘").toBe(false);
  });

  it("② 玩家名下**两件** animation ⇒ 退 4，两件的 id 都点名", async () => {
    const { e } = await failure((r) => {
      const src = structuredClone(playerOf(r));
      src.spec.id = "player-odin-2";
      r.assets.push(src);
    });
    expect(exitCodeOfError(e)).toBe(4);
    expect((e as CommandError).message).toMatch(/player-odin-2/);
    expect((e as CommandError).message).toMatch(/只许一件/);
  });

  it("③ `characterId` **缺席** ⇒ 退 4（**认不出即失败**，不许静默跳过）", async () => {
    const { e } = await failure((r) => { delete (playerOf(r).spec as { characterId?: string }).characterId; });
    expect(exitCodeOfError(e)).toBe(4);
    expect((e as CommandError).message).toMatch(new RegExp(DESIGN.player.id));
  });

  it("③ `characterId` 写**别人的 id** ⇒ 同样退 4（与缺席同一档，不是「跳过这一件」）", async () => {
    const { e } = await failure((r) => { (playerOf(r).spec as { characterId?: string }).characterId = "e-drone"; });
    expect(exitCodeOfError(e)).toBe(4);
    expect((e as CommandError).message).toMatch(/没有一件/);
  });

  it("④ 某一路只有 **1 帧** ⇒ 退 4，点名是那一路、几帧", async () => {
    const { e } = await failure((r) => {
      const p = playerOf(r).spec as { animations: { name: string; frames: number }[] };
      p.animations.find((a) => a.name === "jump")!.frames = 1;
    });
    expect(exitCodeOfError(e)).toBe(4);
    expect((e as CommandError).message).toMatch(/"jump"\(1 帧\)/);
  });

  it("⚠️ 四发负例走的都是**那一条现成的路**：三发「schema」、不新增错误通路、不动闭集", async () => {
    const { e } = await failure((r) => {
      const p = playerOf(r).spec as { animations: { name: string }[] };
      p.animations = p.animations.filter((a) => a.name !== "jump");
    });
    const call = callOf(e);
    expect(call.attempts, "三次上限照旧").toBe(STRUCTURED_CALL_ATTEMPTS);
    expect(call.failures).toEqual(Array(STRUCTURED_CALL_ATTEMPTS).fill("schema"));
  });
});
