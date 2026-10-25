// 确定性纯结构布局：GameDesignSpec → VisualDesignSpec（visual-design-impl-v1 票 02）。
//
// ⚠️ **纯结构**（Q6 裁定）：只读 player + 四个实体桶 + 实体 id + 桶内顺序 + 计数 + 静态布局规则。
//   不解读 `world.structure` / `levels[].layout` / 实体自由文本。
//
// ⚠️ **role 是「视觉分组默认」，不是身份断言**（Q1 裁定）：每桶给一个文档化的粗默认 role
//   （enemies→hazard · npcs→decor · interactables→pickup · resources→pickup），只用于 layer/颜色。
//   identity 判据（票 07）用**设计桶↔kind 家族**，不拿这个默认 role 对账 —— 因为设计桶 → EntityKind
//   不是 1:1（wasteland 真夹具里 `interactables` 一个桶既有 chest 又有 hazard），结构化字段里没有 kind 信号。
//
// ⚠️ **确定性**：同输入 ⇒ 同输出（逐字段确定，无随机、无自由文本解读）。
//   **非退化**：分栏 + 固定地面线，各实体独立栏不重叠；增删实体只平移栏位、不改每个 id 的 sourceIntent 绑定。
//   **容量检查**：实体数超过单行容量（栏宽 < 实体最大宽）时抛错，不静默重叠。
//
// ⚠️ **视口是参数**（「视口不是数据」，`CONTEXT.md:608-614`）：由调用方（票 06 的 compile 入口）注入
//   壳 VIEWPORT（480×270）。本函数不硬编码 480×270，只按传入的 viewport 计算。
import {
  VISUAL_DESIGN_FORMAT,
  VISUAL_WORLD_FORMAT,
  type GameDesignSpec,
  type Role,
  type VisualDesignSpec,
  type VisualWorldSpec,
} from "@game-maker/contracts";

/** 边距（像素）。 */
const MARGIN_X = 8;
/** 地面线距画布底边的距离（像素）。实体底对齐在这条线上。 */
const GROUND_GAP = 40;
/** 玩家占位尺寸。 */
const PLAYER_SIZE = { w: 24, h: 40 };
/** 非玩家实体占位尺寸。 */
const ENTITY_SIZE = { w: 16, h: 16 };
/** UI 面板占位（位置 + 尺寸）。 */
const UI_PANEL = { x: 8, y: 8, w: 160, h: 24 };
/** UI 指示点占位。 */
const UI_PIP = { x: 16, y: 16, w: 12, h: 8 };
/** z 序（越大越在上）。 */
const LAYER_BACKGROUND = 0;
const LAYER_ENTITY_BASE = 10;
const LAYER_UI_PANEL = 100;
const LAYER_UI_PIP = 110;

type Bucket = "player" | "enemies" | "npcs" | "interactables" | "resources";

/** 设计桶 → 默认 role（视觉分组提示）。 */
const BUCKET_ROLE: Record<Bucket, Role> = {
  player: "player",
  enemies: "hazard",
  npcs: "decor",
  interactables: "pickup",
  resources: "pickup",
};

/** role → 语义色板桶（fill 用；空桶回退 palette:0）。 */
const ROLE_PALETTE_BUCKET: Record<Role, keyof VisualWorldSpec["palette"]> = {
  player: "primary",
  background: "background",
  "ui-panel": "highlight",
  "ui-pip": "highlight",
  solid: "secondary",
  pickup: "accent",
  hazard: "secondary",
  danger: "secondary",
  goal: "accent",
  chest: "accent",
  decor: "secondary",
};

interface Entity {
  id: string;
  bucket: Bucket;
  size: { w: number; h: number };
}

/** 稳定序收集：player → enemies → npcs → interactables → resources（各桶内保持数组原序）。 */
function collectEntities(design: GameDesignSpec): Entity[] {
  const out: Entity[] = [];
  out.push({ id: design.player.id, bucket: "player", size: PLAYER_SIZE });
  for (const e of design.enemies) out.push({ id: e.id, bucket: "enemies", size: ENTITY_SIZE });
  for (const e of design.npcs) out.push({ id: e.id, bucket: "npcs", size: ENTITY_SIZE });
  for (const e of design.interactables) out.push({ id: e.id, bucket: "interactables", size: ENTITY_SIZE });
  for (const e of design.resources) out.push({ id: e.id, bucket: "resources", size: ENTITY_SIZE });
  return out;
}

/** 从语义色板桶取一个 ref（上游已校验在界内），空桶回退 palette:0。 */
function fillFor(vws: VisualWorldSpec, bucket: keyof VisualWorldSpec["palette"]): string {
  const refs = vws.palette[bucket];
  if (refs.length > 0) return refs[0]!;
  if (vws.style.palette.length === 0) throw new Error("空色板：无法给对象分配 fill");
  return "palette:0";
}

/**
 * 把一份 GameDesignSpec 落成一份 VDS（确定性纯结构布局）。
 *
 * 输出恒含：background（全画布，layer 0）+ 每个设计实体一个 object（分栏落位，layer 10 起递进）+
 * ui-panel/ui-pip（固定占位，layer 100/110）。background / ui 无 `sourceIntent`（纯装饰，不进覆盖分母）。
 */
export function layoutVds(
  design: GameDesignSpec,
  vws: VisualWorldSpec,
  viewport: { w: number; h: number },
): VisualDesignSpec {
  const entities = collectEntities(design);
  const n = entities.length;
  const available = viewport.w - 2 * MARGIN_X;
  const maxWidth = Math.max(...entities.map((e) => e.size.w));

  // 容量检查：单行分栏，栏宽必须 ≥ 实体最大宽，否则重叠。
  if (available / n < maxWidth) {
    throw new Error(
      `实体过多（${n} 个）：画布宽 ${viewport.w} 单行最多放 ${Math.floor(available / maxWidth)} 个（栏宽须 ≥ ${maxWidth}px），无法保证不重叠`,
    );
  }

  const colW = Math.floor(available / n);
  const groundY = viewport.h - GROUND_GAP;

  const objects: VisualDesignSpec["objects"] = [
    { id: "background", role: "background", bounds: { x: 0, y: 0, w: viewport.w, h: viewport.h }, layer: LAYER_BACKGROUND, fill: fillFor(vws, "background") },
  ];

  entities.forEach((e, i) => {
    const x = MARGIN_X + i * colW;
    const y = groundY - e.size.h;
    const role = BUCKET_ROLE[e.bucket];
    objects.push({
      id: e.id,
      role,
      bounds: { x, y, w: e.size.w, h: e.size.h },
      layer: LAYER_ENTITY_BASE + i,
      fill: fillFor(vws, ROLE_PALETTE_BUCKET[role]),
      sourceIntent: e.id,
    });
  });

  objects.push({ id: "ui-panel", role: "ui-panel", bounds: UI_PANEL, layer: LAYER_UI_PANEL, fill: fillFor(vws, "highlight") });
  objects.push({ id: "ui-pip", role: "ui-pip", bounds: UI_PIP, layer: LAYER_UI_PIP, fill: fillFor(vws, "highlight") });

  return {
    format: VISUAL_DESIGN_FORMAT,
    viewport: { w: viewport.w, h: viewport.h },
    style: { visualWorldFormat: VISUAL_WORLD_FORMAT },
    objects,
  };
}
