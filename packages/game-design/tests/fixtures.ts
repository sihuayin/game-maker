// 票 10 那两份测试共用的夹具：一份意图、一份世界、一份「模型吐出来的设计」。
//
// ⚠️ 三份都**必须过得了各自的契约**（两份上游契约各带一条 gate，设计契约也带一条）——
//   不然测的就不是这一票的规矩了。⚠️ 意图那份**故意**要了一条外壳做不了的机制（`二段跳`）。
import {
  CHARACTER_DNA_FORMAT, PLATFORMER_V1,
  type CharacterDNA, type CharacterDNAFile, type GameDesignSpec, type GameIntentSpec, type VisualWorldSpec
} from "@game-maker/contracts";

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

// ── 票 31 的夹具：一份**带角色**的设计 · 一份**填了类**的世界 · 一族模型吐出来的 DNA ──────
//
// ⚠️ 三个都**必须过得了各自的契约**（三份契约各带一条 gate）—— 不然测的就不是这一票的规矩了。
// ⚠️ 下面那份设计的四个桶**都给上了**：于是「多一条 DNA」那一头**有东西可试**
//   （`interactables[]` / `resources[]` 里的东西**没有基因**，票 04 裁决 13）。

/** ⚠️ 设计层的角色实体 = `player` + `enemies[]` + `npcs[]`（`e-drone` / `e-mutant` / `n-merchant`）；
 *  而 `i-terminal` / `r-scrap` **不在**那一族里 —— 木条箱与补给没有「是谁」这回事。 */
export const DESIGN = designFromModel({
  player: { id: "p-scavenger", role: "拾荒者", abilities: ["跑", "跳"], goals: ["在天黑前抵达"] },
  enemies: [
    { id: "e-drone", behavior: "沿月台往复巡逻", threat: "接触即伤" },
    { id: "e-mutant", behavior: "蹲在废墟里，近了才扑", threat: "扑击一次两级血" }
  ],
  npcs: [{ id: "n-merchant", role: "守着一间废弃铺子的老人", interaction: "用废料换净水" }],
  interactables: [{ id: "i-terminal", type: "终端", behavior: "消耗废料开门" }],
  resources: [{ id: "r-scrap", purpose: "换净水" }]
});

/** ⚠️ **填了「类」的**世界：那五格是**这一类共有**的画法（票 31 的守门人比的就是它们）。 */
export const VWS_CLASS: VisualWorldSpec = {
  ...VWS,
  palette: { primary: ["palette:0"], secondary: [], accent: ["palette:1"], background: [], shadow: [], highlight: [] },
  materials: { rust: { appearance: "锈蚀的金属", texture: "颗粒", color: ["palette:1"] } },
  character: {
    proportions: "三头身，头大身短",
    silhouette: "矮壮、方头、硬边",
    poseLanguage: "重心低，肩膀前倾",
    clothing: "灰绿色旧工作服",
    faceAbstraction: "两个像素眼窝，没有五官"
  }
};

/** 一条 DNA。⚠️ 八格全给（契约定死了没有 `optional`）—— 覆盖值走 `over`。 */
export const dnaRecord = (id: string, over: Partial<CharacterDNA> = {}): CharacterDNA => ({
  id,
  identity: `${id} 是这条废土铁路上的一个具体角色`,
  silhouette: "比同类窄一号，左肩塌下去",
  face: "一只眼窝比另一只大",
  clothing: "外套下摆撕掉了一半",
  gear: ["半截撬棍"],
  palette: ["palette:0"],
  visualConstraints: [],
  ...over
});

/** 一族 DNA —— 默认**恰好**覆盖 `DESIGN` 的那四个角色实体（构造性 gate 因此默认成立）。 */
export const dnaFile = (characters: CharacterDNA[] = [
  dnaRecord("p-scavenger"), dnaRecord("e-drone", { face: "none", clothing: "none", gear: [] }),
  dnaRecord("e-mutant"), dnaRecord("n-merchant")
]): CharacterDNAFile => ({ format: CHARACTER_DNA_FORMAT, characters });
