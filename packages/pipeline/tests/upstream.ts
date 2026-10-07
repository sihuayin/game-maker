// 测试用的**假上游**与五份骨架（票 15 的链要跑通，得有人替那五发文本调用答话）。
//
// ⚠️ 一条假 `fetch` 同时答**两类**请求，靠 body 里有没有 `tools` 分派：
//   · 有 ⇒ 理解层那五发（**强制工具调用**，R16）；按 `tool_choice.name` 回一份**过得了契约**的入参；
//   · 没有 ⇒ drawlist 那一支（生成器要的是一段 JSON 文本，`pack` 里那条路）。
import type { CharacterDNAFile } from "@game-maker/contracts";
import { encodePNG } from "@game-maker/assets";

/** 五份骨架 —— ⚠️ 每一份都必须**过得了自己的契约**（含各自的顶层 gate），否则测的不是这一票的东西。 */
export const VWS = {
  format: "visual-world/v1",
  styleIdentity: { keywords: ["低饱和", "像素"], description: "黄昏的铁路小站" },
  camera: { mode: "side" },
  composition: { foreground: "铁轨与碎石", midground: "月台", background: "远山剪影", density: "中" },
  lighting: {},
  // ⚠️ 这一格的用词与下面 DNA 的 `silhouette` **必须不同** —— 否则票 13 那个守门人会响。
  character: { silhouette: "矮壮方头、硬边" },
  environment: { architecture: "木构小站", terrain: "碎石与枕木" },
  palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
  materials: {}, shapeLanguage: [], constraints: [],
  styleReferences: [{ path: "style.png", role: "global" }],
  style: {
    id: "halt-dusk", identity: [], camera: {}, composition: {}, palette: ["#2e3b4e", "#4a6076"],
    lighting: {}, shapeLanguage: [], material: [], environment: [], characterStyle: [], constraints: [], confidence: 0.5,
  },
};

export const INTENT = {
  format: "game-intent/v1", title: "拾荒者", genre: "platformer", targetExperience: "荒凉、压抑",
  coreLoop: ["在废土上跳跃移动", "收集废料"], player: { role: "拾荒者", goals: ["在天黑前抵达"] },
  world: { theme: "后启示录废土", setting: "沙暴侵蚀的废弃都市", atmosphere: "荒凉孤寂" },
  mechanics: [{ id: "m-jump", name: "跳跃" }], entities: [{ id: "e-drone", type: "enemy", role: "巡逻的无人机" }],
  winConditions: ["抵达终点"], loseConditions: [], ambiguity: [],
};

export const DESIGN = {
  format: "game-design/v1",
  game: { title: "拾荒者", genre: "占位（装配时覆盖）", camera: "占位", runtimeProfile: { id: "占位", version: "1" } },
  coreLoop: ["在废墟间探索并收集零件"],
  player: { id: "p-scavenger", role: "拾荒者", abilities: ["跑"], goals: ["在天黑前抵达"] },
  enemies: [{ id: "e-drone", behavior: "沿月台往复巡逻", threat: "接触即伤" }],
  npcs: [], interactables: [], resources: [],
  world: { theme: "废土", setting: "铁轨旁的废墟", structure: "三条横带：铁轨 / 月台 / 远山" },
  levels: [{ id: "l-1", purpose: "教学", layout: "左侧出发、右侧终点", entities: ["e-drone"] }],
  progression: { model: "linear", description: "三关" },
  mechanics: [{ id: "m-jump", mechanic: "jump" }],
  winConditions: ["抵达终点"], loseConditions: [], runtimeRequirements: [],
};

export const DNA: CharacterDNAFile = {
  format: "character-dna/v1",
  characters: [
    {
      id: "p-scavenger", identity: "沙暴废城里最后一个还在翻垃圾的人",
      silhouette: "比同类窄一号，左肩塌下去", face: "两个像素眼窝", clothing: "深蓝长大衣",
      gear: ["半截撬棍"], palette: ["palette:0"], visualConstraints: ["帽檐压到眼线上方"],
    },
    { id: "e-drone", identity: "仍在按旧指令巡逻的无人机", silhouette: "扁平梭形，四角旋翼", face: "none", clothing: "none", gear: [], palette: ["palette:1"], visualConstraints: [] },
  ],
};

/** planner 会吐的那份清单（**不含 `characterRef`** —— 那一格由 pipeline 注入，票 15 的 Q13）。
 *  ⚠️ 四个资产**覆盖四类 `kind`**：配置编译器要核「它引的那些资产真的在包里」，
 *  所以这里的形状由 `game-config` 的必填格（背景 / 玩家三条动画 / HUD 面板与 pip）倒推。 */
export const recipeFor = (id: string) => ({
  format: "asset-recipe/v1", id, styleRef: "stylespec.json", referenceImage: "reference.png",
  assets: [
    { spec: { kind: "background", id: "bg-dusk", role: "黄昏的站台", description: "三条横带的站台背景", styleId: "halt-dusk", anchor: { x: 0, y: 0 }, size: { w: 480, h: 270 }, required: true }, source: { kind: "drawlist" } },
    { spec: { kind: "animation", id: "p-body", role: "玩家：身体", description: "拾荒者的待机/走/跳", styleId: "halt-dusk", anchor: { x: 0.5, y: 1 }, size: { w: 32, h: 48 }, required: true, characterId: "p-scavenger", animations: [{ name: "idle", frames: 1, fps: 1, loop: true }, { name: "run", frames: 1, fps: 1, loop: true }, { name: "jump", frames: 1, fps: 1, loop: false }] }, source: { kind: "drawlist" } },
    { spec: { kind: "ui", id: "ui-hud", role: "HUD 面板", description: "一条 HUD 底板", styleId: "halt-dusk", anchor: { x: 0, y: 0 }, size: { w: 48, h: 8 }, required: true }, source: { kind: "drawlist" } },
    { spec: { kind: "ui", id: "ui-pip", role: "HUD 指示点", description: "一枚指示点", styleId: "halt-dusk", anchor: { x: 0, y: 0 }, size: { w: 4, h: 4 }, required: true }, source: { kind: "drawlist" } },
  ],
});

/** `emit_game_config` 的骨架 —— ⚠️ 它引的每一个资产 id 都必须在上面那份清单里（编译器要核）。
 *  ⚠️ `world.size` / `gameId` / `levelId` / `version` 由编译器**注入**（票 14），这里写什么都会被覆盖。 */
export const CONFIG = {
  format: "game-config/v1",
  world: { size: { w: 480, h: 270 } },
  scene: { background: { asset: "bg-dusk" } },
  player: { asset: "p-body", anims: { idle: "idle", run: "run", jump: "jump" }, at: { x: 40, y: 200 }, move: { speed: 60, jumpVelocity: 180, gravity: 400 } },
  terrain: [{ x: 0, y: 240, w: 480, h: 30 }],
  // ⚠️ 实体用**小资产**（`ui-pip` 4×4）—— 拿 480×270 的背景当实体，它的盒子会落在世界之外
  //   （实测：编译器会拒「落在世界之外」）。而 `objective` 是「捡齐 N 件再到达终点」⇒ 至少一个 pickup
  entities: [
    { id: "e-pickup-1", kind: "pickup", at: { x: 120, y: 220 }, asset: "ui-pip" },
    { id: "e-goal", kind: "goal", at: { x: 440, y: 220 }, asset: "ui-pip" },
  ],
  hud: { panel: { asset: "ui-hud", at: { x: 4, y: 4 }, size: { w: 48, h: 8 } }, pip: { asset: "ui-pip", at: { x: 6, y: 6 }, step: { x: 5, y: 0 } } },
  objective: { kind: "collect-then-reach", gate: "e-goal" },
};

/** ⚠️ **模型面向的那份 VWS 没有 `styleReferences`** —— 它是**调用方注入**的
 *（`analyze-reference.ts` 用 `VisualWorldSpecSchema.omit({styleReferences: true})` 当模型面），
 *  所以回给 `emit_visual_world` 的入参里带上它，会被判「多了个不认识的键」。 */
const { styleReferences: _injected, ...VWS_FROM_MODEL } = VWS;

const TOOL_INPUT: Record<string, unknown> = {
  emit_visual_world: VWS_FROM_MODEL, emit_game_intent: INTENT, emit_game_design: DESIGN,
  emit_character_dna: DNA, emit_game_config: CONFIG,
};

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

/** drawlist 那一支要的那段 JSON 文本（`pack` 里 `createDrawListGenerator` 读它）。
 *
 *  ⚠️ **帧数从提示词里数出来**（它逐帧列了「第 i 帧：…」）—— 数错了生成器会当场拒
 *  （「清单要 N 帧，模型给了 M 帧」），而那是**对的**，别去放宽它。
 *  ⚠️ 资产 **id 不出现在提示词里**（`assetTask` 给的是 `role` + `description`）⇒ 只能这么数。 */
const drawlistReply = (prompt: string) => {
  const n = Math.max(1, (prompt.match(/第 \d+ 帧：/g) ?? []).length);
  return {
    content: [{ type: "text", text: JSON.stringify({ frames: Array.from({ length: n }, () => ({ ops: [{ op: "rect", x: 0, y: 0, w: 16, h: 16, fill: "palette:0" }] })) }) }],
    model: "deepseek-flash", usage: { input_tokens: 100, output_tokens: 50 },
  };
};

export type UpstreamOptions = {
  /** 这一份清单的 id（planner 照它吐）—— 测试要它等于 run 目录名。 */
  recipeId: string;
  /** 前 N 次 `emit_game_design` 回一个**过不了 gate** 的设计（测「失败现场」用）。 */
  designFails?: number;
  /** 记下每一次请求的 body（断言「发出去的是什么」）。 */
  seen?: Record<string, unknown>[];
  /** 覆盖某一格 tool 的入参（例如把清单的 `id` 改掉）。 */
  override?: Record<string, unknown>;
};

/** 造一条假 `fetch`。⚠️ 它同时替文本与（可选的）生图两路上游答话。 */
export function fakeUpstream(opts: UpstreamOptions): typeof fetch {
  let designTrips = 0;
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    opts.seen?.push(body);
    const tools = body["tools"] as { name: string }[] | undefined;
    if (tools === undefined) {
      // drawlist 那一支：`frames` 的条数要与 framePlan 对得上
      // ⚠️ 两种形状都可能有：理解层那五发是**块数组**，而 drawlist 那一路的 `content` 是**一个字符串**
      const content = (body["messages"] as { content: unknown }[])[0]!.content;
      const text = typeof content === "string" ? content : ((content as { text?: string }[])[0]?.text ?? "");
      return json(drawlistReply(text));
    }
    const name = (body["tool_choice"] as { name: string }).name;
    if (name === "emit_game_design" && opts.designFails !== undefined && designTrips < opts.designFails) {
      designTrips += 1;
      // ⚠️ 一个**过不了 gate** 的设计（空串）—— 这是「模型没干好」那一档，会重采样到底再抛
      return json({ content: [{ type: "tool_use", name, input: { ...DESIGN, world: { theme: "", setting: "", structure: "" } } }], stop_reason: "tool_use", model: "deepseek-flash" });
    }
    const input = opts.override?.[name] ?? (name === "emit_asset_recipe" ? recipeFor(opts.recipeId) : TOOL_INPUT[name]);
    return json({
      content: [{ type: "tool_use", name, input }], stop_reason: "tool_use",
      model: "deepseek-flash", usage: { input_tokens: 1200, output_tokens: 900 },
    });
  }) as unknown as typeof fetch;
}

/** 一张真的小 PNG（参考图那一格要能解码）。 */
export function tinyPng(w = 8, h = 8): Buffer {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { data[i * 4] = 255; data[i * 4 + 1] = 0; data[i * 4 + 2] = 255; data[i * 4 + 3] = 255; }
  return encodePNG({ width: w, height: h, data });
}
