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
import type { GameDesignSpec, VisualWorldSpec } from "@game-maker/contracts";
import { CommandError, planAssets } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const RECIPE = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/recipes/shift-change.json"), "utf8"));

/** ⚠️ 四个桶**都非空** —— 不然那 12 个 ① 档路径里有几条压根不会出现在提示词里。 */
const DESIGN: GameDesignSpec = {
  format: "game-design/v1",
  game: { title: "拾荒者", genre: "platformer", camera: "side", runtimeProfile: { id: "platformer", version: "1" } },
  coreLoop: ["探索废墟", "收集零件"],
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
    styleReferences: [{ path: path.relative(d, refPng), role: "global" }],
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
const capture = (input: unknown = RECIPE) => {
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
const run = (d: string, fetchImpl: typeof fetch) =>
  planAssets({
    designPath: path.join(d, "game-design.json"), visualWorldPath: path.join(d, "visual-world.json"),
    outRoot: path.join(d, "out"), transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl,
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

  it("⚠️ 而 `source.kind` **不写死**（写死等于替模型把策略定了，与 `00 §2.4` 正面冲突）", async () => {
    const d = stage();
    const c = capture();
    await run(d, c.f);
    const text: string = c.seen[0]!.messages[0].content[0].text;
    expect(text).toContain("drawlist|image|import");     // 三选一的占位
    expect(text).not.toContain('"source":{"kind":"drawlist"}');
    expect(text).toContain("别照抄成");
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
