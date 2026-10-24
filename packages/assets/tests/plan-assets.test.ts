// 票 12 的判据：`planAssets` **发出去的那一发**长什么样，以及它**没发的那一发**为什么不发。
//
// ⚠️ 两条结构性的欠条住在这里：
//   ① 票 10 的裁定说设计层那 **12 个 ① 档字段**「由票 10 的提示词逐条点名地生产，而**具名插值在下游**」
//      —— 下游就是**这里**，所以本文件逐条盯着它们露没露脸；
//   ② 票 12 的 Q3 裁「**不固定三层**」，所以提示词里必须说得出这句话。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseAssetPlan, parseRecipe, type GameDesignSpec, type VisualWorldSpec } from "@game-maker/contracts";
import { CommandError, planAssets } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const RECIPE = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/recipes/shift-change.json"), "utf8"));

/** ⚠️ 票 01 的**覆盖闸**：`DESIGN` 四桶里的每个 id 都必须有资产。这份配方夹具是另一个游戏的骨架，
 *  所以给**测试用的响应**补上四件占位资源 —— 不改夹具文件，也不动任何被测的协议 / 提示词。 */
const withCoverage = (recipe: unknown): Record<string, unknown> => {
  const doc = structuredClone(recipe) as {
    assets: { spec: { id?: string; characterId?: string; [k: string]: unknown }; [k: string]: unknown }[];
    [k: string]: unknown;
  };
  const covered = new Set(
    doc.assets.flatMap((a) => [a.spec.id, a.spec.characterId]).filter((x): x is string => typeof x === "string"),
  );
  for (const id of ["e-drone", "n-trader", "i-terminal", "r-part"]) {
    if (covered.has(id)) continue;
    doc.assets.push({
      spec: {
        kind: "sprite", id, role: `${id} 的可见形象`, description: `${id} 的占位资源。`,
        styleId: "style-ref", anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true,
      },
      source: { kind: "drawlist" },
    });
  }
  return doc;
};

/** ⚠️ 四个桶**都非空** —— 不然那 12 个 ① 档路径里有几条压根不会出现在提示词里。 */
const DESIGN: GameDesignSpec = {
  format: "game-design/v1",
  game: { title: "拾荒者", genre: "platformer", camera: "side", runtimeProfile: { id: "platformer", version: "1" } },
  coreLoopSteps: ["探索废墟", "收集零件"],
  player: { id: "p-scavenger", role: "拾荒者", abilities: ["跑", "跳"], goals: ["在天黑前抵达"] },
  enemies: [{ id: "e-drone", behavior: "沿月台往复巡逻", threat: "接触即伤" }],
  npcs: [{ id: "n-trader", role: "废土商人", interaction: "用零件换补给" }],
  interactables: [{ id: "i-terminal", type: "开关", behavior: "消耗零件打开闸门" }],
  resources: [{ id: "r-part", purpose: "开门用的零件" }],
  world: { theme: "废土", setting: "铁轨旁的废墟", structure: "三条横带：铁轨 / 月台 / 远山" },
  levels: [{ id: "l-1", purpose: "教学关", layout: "左侧出发，右侧终点", entities: ["e-drone", "r-part"] }],
  progression: { model: "linear", description: "三关" },
  mechanics: [{ id: "m-jump", mechanic: "jump" }],
  winConditions: ["抵达终点"], loseConditions: [], runtimeRequirements: ["input:keyboard"]
};

const stage = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-plan-p-"));
  const refPng = path.join(ROOT, "fixtures/reference/halt-dusk.png");
  const world: VisualWorldSpec = {
    format: "visual-world/v1",
    styleIdentity: { keywords: ["低饱和", "像素"], description: "黄昏的铁路小站，三条横带各自一套光照" },
    camera: { mode: "side" },
    composition: { foreground: "铁轨与碎石", midground: "月台与告示板", background: "远山剪影", density: "中" },
    lighting: {}, character: { silhouette: "矮壮方头" }, environment: { architecture: "木构小站", terrain: "碎石与枕木" },
    palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
    materials: { wood: { appearance: "哑光" } }, shapeLanguage: [], constraints: [],
    styleReferences: [{ path: path.relative(d, refPng) }],
    style: {
      id: "halt-dusk", identity: [], camera: {}, composition: {}, palette: ["#112233", "#445566"],
      lighting: {}, shapeLanguage: [], material: [], environment: [], characterStyle: [], constraints: [], confidence: 0.5
    }
  };
  fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify(DESIGN));
  fs.writeFileSync(path.join(d, "visual-world.json"), JSON.stringify(world));
  return d;
};

/** 记下**发出去的那一发**，并回一个合法的工具调用。 */
const capture = (raw: unknown = RECIPE) => {
  const input = withCoverage(raw);
  const seen: Record<string, any>[] = [];
  const f = (async (_url: string, init: RequestInit) => {
    seen.push(JSON.parse(String(init.body)));
    return new Response(
      JSON.stringify({ content: [{ type: "tool_use", name: "emit_asset_recipe", input }], stop_reason: "tool_use", model: "m" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof fetch;
  return { f, seen };
};
const IMAGE = { protocol: "gemini" as const, baseUrl: "http://x", apiKey: "k" };
const run = (d: string, fetchImpl: typeof fetch) =>
  planAssets({
    designPath: path.join(d, "game-design.json"), visualWorldPath: path.join(d, "visual-world.json"),
    outRoot: path.join(d, "out"), transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl, imageTransport: IMAGE,
  });

describe("§发出去的那一发（R16 的协议）", () => {
  it("强制工具调用 · 关 thinking · 与前三发同档的 `max_tokens` · 内容只有一段文本", async () => {
    const d = stage();
    const c = capture();
    await run(d, c.f);
    const b = c.seen[0]!;
    expect(b.tool_choice).toEqual({ type: "tool", name: "emit_asset_recipe" });
    expect(b.thinking).toEqual({ type: "disabled" });
    expect(b.max_tokens).toBe(16_000);
    expect(b.messages[0].content).toHaveLength(1);
    expect(b.messages[0].content[0].type).toBe("text");
  });

  it("⚠️ 创作侧那段**锚点说明**真在送出去的文本里（票 98 的 Q5 = (b) · 阳性见证）", async () => {
    const d = stage();
    const c = capture();
    await run(d, c.f);
    const text: string = c.seen[0]!.messages[0].content[0].text;
    // ⚠️ 断的是**稳定的短语**，不是整段逐字 —— 免得下一次小改措辞就红。
    //   ⚠️ 它证的是「那段话**真的到了模型手上**」，**不证**「模型照做了」（后者要真上游，归票 23）。
    //   ⚠️ 这不是恒真：加这段话之前，这一侧对锚点**一个字都没有**
    //     （票 98 的读数 B：6284 字符里「锚点」0 次，`` `anchor` `` 只以 JSON 键名出现两次）。
    expect(text).toContain("你在这里选什么锚点");
    // 而「锚点会决定配置那一步怎么写 `at`」这层**因果**要连在一起说，不许只剩一个键名。
    expect(text).toContain("那边就得按它写");
  });

  it("⚠️ 工具 schema **是 v4 镜像**（v3 那份 `toolInputSchema` 转不动）：7 键、封口、无 `$ref`", async () => {
    const d = stage();
    const c = capture();
    await run(d, c.f);
    const schema = c.seen[0]!["tools"][0].input_schema;
    expect(Object.keys(schema.properties)).toHaveLength(7);
    expect(schema.additionalProperties).toBe(false);
    expect(JSON.stringify(schema)).not.toContain("$ref");
  });
});

describe("⚠️ 票 10 的欠条：设计层那 **12 个 ① 档字段**必须**逐个具名**出现在提示词里", () => {
  it("12 个点号路径一个不少（`world.*` / `player.*` / 四个桶 / `levels[].purpose`）", async () => {
    const d = stage();
    const c = capture();
    await run(d, c.f);
    const text: string = c.seen[0]!.messages[0].content[0].text;
    const TWELVE = [
      "world.theme", "world.setting", "world.structure",
      "player.role", "player.abilities",
      "enemies[].behavior", "enemies[].threat",
      "npcs[].role", "npcs[].interaction",
      "interactables[].type", "interactables[].behavior",
      "levels[].purpose"
    ];
    expect(TWELVE.filter((f) => !text.includes(f))).toEqual([]);
    // 而且插的是**真值**，不是字段名的空壳
    expect(text).toContain(DESIGN.world.structure);
    expect(text).toContain(DESIGN.player.abilities.join(" / "));
    expect(text).toContain(DESIGN.npcs[0]!.interaction);
    expect(text).toContain(DESIGN.levels[0]!.purpose);
  });
});

describe("§这个世界（VisualWorldSpec）必须进提示词", () => {
  it("视觉身份 / 空间分层 / **六桶** / 角色的共同长相 / 环境 都在", async () => {
    const d = stage();
    const c = capture();
    await run(d, c.f);
    const text: string = c.seen[0]!.messages[0].content[0].text;
    expect(text).toContain("黄昏的铁路小站");
    expect(text).toContain("月台与告示板");     // composition.midground
    expect(text).toContain("颜色分工（六桶）");
    expect(text).toContain("primary=");
    expect(text).toContain("矮壮方头");         // character.silhouette
    expect(text).toContain("木构小站");         // environment.architecture
  });

  it("⚠️ **「不固定三层」写在提示词里**（票 12 的 Q3：外壳不限层数，「三」是我们的惯例不是常数）", async () => {
    const d = stage();
    const c = capture();
    await run(d, c.f);
    const text: string = c.seen[0]!.messages[0].content[0].text;
    expect(text).toContain("层数按画面需要定");
    expect(text).toContain("没有「必须三层」这回事");
  });
});

describe("⚠️ 骨架**本身**的判据（探针第一轮抓到的那处缺陷，立成回归判据）", () => {
  // ⚠️ 第一轮探针栽在这儿：骨架只画了 `{"spec":{…},"source":{…}}`，**没画出那三个可选键住在 `spec` 里**
  //   ⇒ 模型把 `dependsOn` 放在了 entry 层 ⇒ 被闭合当场拒掉（`assets[6]: Unrecognized key: "dependsOn"`）。
  //   ⚠️ 顺带抓到第二处：骨架把 `"source":{"kind":"drawlist"}` **写死**（那是 `derive` 时代的遗留）
  //   ⇒ 它在**教模型永远选 drawlist**（干净那发 `drawlist:15 / image:2`；改完是 `drawlist:18 / image:9`）。
  it("三个可选键**住在 `spec` 里**这件事画出来了，且说了「放错一层会被拒收」", async () => {
    const d = stage();
    const c = capture();
    await run(d, c.f);
    const text: string = c.seen[0]!.messages[0].content[0].text;
    expect(text).toContain('"dependsOn":[');      // 它在骨架里露过脸 → 模型知道该写在哪一层
    expect(text).toContain('"characterId":');
    expect(text).toContain('"masterAsset":');
    expect(text).toContain("放错一层会被拒收");
    // ⚠️ 而「**哪一层**」那句话本身也要盯住：只锚 `"dependsOn":[` 的话，
    //   把「两条腿」那句删掉**照样绿**（变异第 14 发就是这么漏的）。
    expect(text).toContain("{spec, source}");
    expect(text).toContain("两层");
  });

  it("⚠️ 最终 `source.kind` 由 **resolver** 决定；模型的 source.kind 只作为候选记录（v3 票 09）", async () => {
    const d = stage();
    const c = capture();
    const r = await run(d, c.f);
    const text: string = c.seen[0]!.messages[0].content[0].text;
    expect(text).toContain("drawlist|image|import");     // 模型仍看到三选一
    // 模型这份 fixture 把 player / background 都写成 drawlist；硬信号应覆盖为 image。
    const planPath = path.join(d, "out", String(r.data["plan"]));
    const plan = parseAssetPlan(JSON.parse(fs.readFileSync(planPath, "utf8")));
    expect(plan.ok, plan.ok ? "" : plan.errors.join(" / ")).toBe(true);
    if (!plan.ok) return;
    const player = plan.value.assets.find((a) => a.id === "player-odin")!;
    const bg = plan.value.assets.find((a) => a.id === "store-interior-bg")!;
    expect(player.route).toBe("image");
    expect(player.candidate).toBe("drawlist");
    expect(player.participated).toBe(false);
    expect(bg.route).toBe("image");
    expect(bg.candidate).toBe("drawlist");
    expect(bg.participated).toBe(false);
    // Recipe 的 source.kind 与 sidecar 的 route 一致
    const recipe = JSON.parse(fs.readFileSync(planPath.replace(/\.plan\.json$/, ".json"), "utf8"));
    for (const a of plan.value.assets) {
      const entry = recipe.assets.find((e: any) => e.spec.id === a.id);
      expect(entry.source.kind, a.id).toBe(a.route);
    }
  });
});

describe("§说明里那几条线形状表达不出来的规矩（R2-Q5）", () => {
  it("① 策略只有三个值，且点名说 `character-reference` / `image-edit` / `procedural` **不是值**", async () => {
    const d = stage();
    const c = capture();
    await run(d, c.f);
    const desc: string = c.seen[0]!["tools"][0].description;
    for (const v of ["drawlist", "image", "import"]) expect(desc).toContain(v);
    expect(desc).toContain("不是值");
    expect(desc).toContain("character-reference");
  });

  it("② 「带参考图」与「带母版」是 `image` 的两种**参数化**", async () => {
    const d = stage();
    const c = capture();
    await run(d, c.f);
    const desc: string = c.seen[0]!["tools"][0].description;
    expect(desc).toContain("source.reference");
    expect(desc).toContain("masterAsset");
    expect(desc).toContain("参数化");
  });

  it("③④⑤ 有 id 延续 / `authoring[]` 与母版比例 / `dependsOn` 那三条", async () => {
    const d = stage();
    const c = capture();
    await run(d, c.f);
    const desc: string = c.seen[0]!["tools"][0].description;
    expect(desc).toContain("照抄设计层的 id");
    expect(desc).toContain("宽高比必须一致");
    expect(desc).toContain("不许有环");
  });
});

describe("§出发前就拦住：上游产物不过 schema ⇒ **一次调用都不发**", () => {
  it("设计不过 schema ⇒ `invalid`，且账上一笔都没有", async () => {
    const d = stage();
    fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify({ ...DESIGN, genre: "  " })); // 设计层那条 gate 拦的就是它
    const c = capture();
    const e = await run(d, c.f).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).kind).toBe("invalid");
    expect(c.seen, "压根没发出去").toHaveLength(0);
  });

  it("世界不过 schema ⇒ 同样是 `invalid`、同样不发", async () => {
    const d = stage();
    const w = JSON.parse(fs.readFileSync(path.join(d, "visual-world.json"), "utf8")) as { camera: { mode: string } };
    w.camera.mode = "top-down-flying"; // 不在那个封闭枚举里
    fs.writeFileSync(path.join(d, "visual-world.json"), JSON.stringify(w));
    const c = capture();
    const e = await run(d, c.f).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("invalid");
    expect(c.seen).toHaveLength(0);
  });
});

describe("§票 03：planner 的母版兜底 —— 模型漏写也补上", () => {
  /** 落盘那份 recipe 的路径（`plan` 是 v<N>.plan.json，recipe 是同一个 v<N>.json）。 */
  const recipeOf = (d: string, planRel: string) =>
    JSON.parse(fs.readFileSync(path.join(d, "out", planRel.replace(/\.plan\.json$/, ".json")), "utf8"));

  it("三个角度的验收①：动画拿到 masterAsset，母版在 authoring[] 里、角色与比例都对", async () => {
    const d = stage();
    const c = capture();           // 默认 RECIPE：player-odin 写了 characterId、**没有** authoring
    const r = await run(d, c.f);
    const recipe = recipeOf(d, String(r.data["plan"]));

    const anim = recipe.assets.find((a: any) => a.spec.kind === "animation" && a.spec.characterId !== undefined)!;
    expect(anim.spec.masterAsset, "带 characterId 的动画必须指一张母版").toBeTruthy();
    const master = recipe.authoring.find((m: any) => m.id === anim.spec.masterAsset);
    expect(master, "masterAsset 必须解得到 authoring[]").toBeDefined();
    expect(master.characterId).toBe(anim.spec.characterId);
    // 母版画布与资产 size 的比例必须一致（契约那条零容差判据）
    expect(master.size.w * anim.spec.size.h).toBe(master.size.h * anim.spec.size.w);
    expect(parseRecipe(recipe).ok, parseRecipe(recipe).ok ? "" : (parseRecipe(recipe) as any).errors.join(" / ")).toBe(true);

    // sidecar 的 inputs 也记下同一条边（resolver 输出，不由 recipe 反推）
    const plan = parseAssetPlan(JSON.parse(fs.readFileSync(path.join(d, "out", String(r.data["plan"])), "utf8")));
    expect(plan.ok).toBe(true);
    if (plan.ok) expect(plan.value.assets.find((a) => a.id === anim.spec.id)!.inputs.masterAsset).toBe(master.id);
  });

  // ⚠️ 验收③（旧清单无 `masterAsset` 仍可跑）在 **pack** 侧：`fixtures/recipes/*.json` 全都不带母版，
  //   而它们照旧过完整包构建（`pack.test.ts` / `recipes-sweep.test.ts`）。planner 这条路**必然**
  //   至少补一张 —— 设计层有 `player`，而玩家闸门要求一件带 `characterId` 的 animation。
  it("多角色清单（B 跑的形状：3 个 characterId）⇒ 每个角色一张母版、每个动画都指向它", async () => {
    // ⚠️ 这正是 B 跑（3 个角色、0 张母版）的最小复现：模型输出里**一个 authoring 都没有**。
    const multi = structuredClone(RECIPE);
    const animSpec = (id: string, characterId: string, names: string[], size: { w: number; h: number }) => ({
      kind: "animation" as const, id, role: `${id} 的可见形象`, description: `${id} 的动作`,
      styleId: "style-ref", anchor: { x: 0.5, y: 1 }, size, required: true, characterId,
      animations: names.map((name) => ({ name, frames: 2, loop: name !== "jump" })),
    });
    multi.assets = [
      { spec: animSpec("player-odin", "p-scavenger", ["idle", "run", "jump"], { w: 32, h: 48 }), source: { kind: "image" } },
      { spec: animSpec("drone", "e-drone", ["patrol"], { w: 32, h: 32 }), source: { kind: "image" } },
      { spec: animSpec("trader", "n-trader", ["idle"], { w: 32, h: 48 }), source: { kind: "image" } },
    ];
    const d = stage();
    const c = capture(multi);
    const r = await run(d, c.f);
    const recipe = recipeOf(d, String(r.data["plan"]));

    const masters = recipe.authoring ?? [];
    expect(masters.map((m: any) => m.characterId).sort()).toEqual(["e-drone", "n-trader", "p-scavenger"]);
    expect(new Set(masters.map((m: any) => m.id)).size).toBe(3);
    for (const e of recipe.assets) {
      // ⚠️ 覆盖闸补进来的那几件占位资源**没有 `characterId`**（道具 / 拾取物本来就不该有母版）——
      //   本用例问的是「每个**角色**一张母版」，所以这里只走角色资产。
      if (e.spec.characterId === undefined) continue;
      const m = masters.find((x: any) => x.id === e.spec.masterAsset);
      expect(m, `${e.spec.id} 必须指向一张母版`).toBeDefined();
      expect(m.characterId).toBe(e.spec.characterId);
      expect(m.size.w * e.spec.size.h).toBe(m.size.h * e.spec.size.w);
    }
    expect(parseRecipe(recipe).ok).toBe(true);
  });

  it("提示词把这条要求说硬 —— 不再是「母版不必每份清单都有」", async () => {
    const d = stage();
    const c = capture();
    await run(d, c.f);
    const text: string = c.seen[0]!.messages[0].content[0].text;
    const desc: string = c.seen[0]!["tools"][0].description;
    expect(text).toContain("每个写了 `characterId` 的 `animation`");
    expect(desc).toContain("每个写了 `characterId` 的 `animation`");
    // ⚠️ 两条旧措辞各自住在**不同**的提示词里 —— 分别断，避免「查错了那一份」的空断言
    expect(desc).not.toContain("母版**不必每份清单都有**");
    expect(text).not.toContain("只有真给了母版才写");
  });
});

describe("§票 13：empty-input（上游丢参）单独重试档", () => {
  it("5 发 empty-input 后第 6 发成功 —— 独立 6 发预算（旧代码 3 发就放弃）", async () => {
    const d = stage();
    const input = withCoverage(RECIPE);
    let n = 0;
    const f = (async (_url: string, init: RequestInit) => {
      n += 1;
      // ⚠️ 前 5 发把入参丢了（`input: {}`），第 6 发才给合法入参。
      const block = n <= 5 ? {} : input;
      return new Response(
        JSON.stringify({ content: [{ type: "tool_use", name: "emit_asset_recipe", input: block }], stop_reason: "tool_use", model: "m" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    await run(d, f); // 不抛 = 成功（第 6 发才成）
    expect(n).toBe(6);
  });

  it("6 发全 empty-input → 报 invalid，不无限重试", async () => {
    const d = stage();
    let n = 0;
    const f = (async (_url: string, init: RequestInit) => {
      n += 1;
      return new Response(
        JSON.stringify({ content: [{ type: "tool_use", name: "emit_asset_recipe", input: {} }], stop_reason: "tool_use", model: "m" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    await expect(run(d, f)).rejects.toThrow();
    expect(n).toBe(6); // empty-input 封顶 6 发，不是无限
  });
});
