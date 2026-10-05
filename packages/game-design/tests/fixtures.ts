// 票 10 那两份测试共用的夹具：一份意图、一份世界、一份「模型吐出来的设计」。
//
// ⚠️ 三份都**必须过得了各自的契约**（两份上游契约各带一条 gate，设计契约也带一条）——
//   不然测的就不是这一票的规矩了。⚠️ 意图那份**故意**要了一条外壳做不了的机制（`二段跳`）。
import { PLATFORMER_V1, type GameDesignSpec, type GameIntentSpec, type VisualWorldSpec } from "@game-maker/contracts";

export const INTENT: GameIntentSpec = {
  format: "game-intent/v1",
  title: "拾荒者",
  genre: "platformer",
  subgenre: "metroidvania-lite",
  camera: "横向卷轴",
  targetExperience: "孤独但一直向上",
  coreLoop: ["探索废墟", "收集零件"],
  player: { role: "拾荒者", goals: ["在天黑前抵达"] },
  world: { theme: "废土", setting: "铁轨旁的废墟", atmosphere: "黄昏，尘土悬浮" },
  mechanics: [{ id: "m-jump", name: "跳跃" }, { id: "m-double-jump", name: "二段跳" }],
  entities: [{ id: "e-drone", type: "enemy", role: "沿固定路线巡逻的无人机" }],
  winConditions: ["抵达终点"],
  loseConditions: [],
  ambiguity: ["camera：需求没提，暂按横版默认"]
};

export const VWS: VisualWorldSpec = {
  format: "visual-world/v1",
  styleIdentity: { keywords: ["低饱和", "像素"], description: "黄昏的铁路小站，三条横带各自一套光照" },
  camera: { mode: "side" },
  composition: { foreground: "铁轨与碎石", midground: "月台与告示板", background: "远山剪影", density: "中" },
  lighting: {}, character: {}, environment: { architecture: "木构小站", terrain: "碎石与枕木" },
  palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
  materials: {}, shapeLanguage: [], constraints: [], styleReferences: [],
  style: {
    id: "halt-dusk", identity: [], camera: {}, composition: {}, palette: ["#2e3b4e", "#4a6076"],
    lighting: {}, shapeLanguage: [], material: [], environment: [], characterStyle: [], constraints: [], confidence: 0.5
  }
};

/** 「模型吐出来的那一份」。⚠️ 三个照抄值**故意写错**（装配时要被覆盖掉）。
 *  ⚠️ 它默认**把两条机制都做出来了**（`m-double-jump` 落在 `jump` 上）。 */
export const designFromModel = (over: Partial<GameDesignSpec> = {}): GameDesignSpec => ({
  format: "game-design/v1",
  game: { title: "拾荒者", genre: "模型瞎写的", camera: "模型瞎写的", runtimeProfile: { id: "胡编", version: "9" } },
  coreLoop: ["在废墟间探索并收集零件"],
  player: { id: "p-scavenger", role: "拾荒者", abilities: ["跑", "跳"], goals: ["在天黑前抵达"] },
  enemies: [{ id: "e-drone", behavior: "沿月台往复巡逻", threat: "接触即伤" }],
  npcs: [], interactables: [],
  resources: [],
  world: { theme: "废土", setting: "铁轨旁的废墟", structure: "三条横带：铁轨 / 月台 / 远山" },
  levels: [{ id: "l-1", purpose: "教学", layout: "左侧出发，右侧终点", entities: ["e-drone"] }],
  progression: { model: "linear", description: "三关" },
  mechanics: [{ id: "m-jump", mechanic: "jump" }, { id: "m-double-jump", mechanic: "jump" }],
  winConditions: ["抵达终点"], loseConditions: [],
  runtimeRequirements: ["input:keyboard"],
  ...over
});

export const PROFILE = PLATFORMER_V1;
