// 确定性纯结构布局的测试（visual-design-impl-v1 票 02）。
//
// ⚠️ 覆盖用户约束 #2 的六条：确定性 · 覆盖 · 非重叠 · 增删不搅乱身份 · 特殊角色边界 · layer 有序。
//   role 是「视觉分组默认」（Q1 裁定），这里只断言它**确定**、不越过设计桶边界，不假装它是身份。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  GameDesignSpecSchema, VisualDesignSpecSchema, VisualWorldSpecSchema,
  type GameDesignSpec, type VisualWorldSpec,
} from "@game-maker/contracts";
import { layoutVds } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const VIEWPORT = { w: 480, h: 270 };

// ⚠️ layoutVds 只读 player.id 与四桶的 .id，这里给最小对象、cast 成 GameDesignSpec（其余字段它不碰）。
const design = (over?: {
  playerId?: string; enemies?: string[]; npcs?: string[]; interactables?: string[]; resources?: string[];
}): GameDesignSpec =>
  ({
    player: { id: over?.playerId ?? "player", role: "", abilities: [], goals: [] },
    enemies: (over?.enemies ?? []).map((id) => ({ id, behavior: "", threat: "" })),
    npcs: (over?.npcs ?? []).map((id) => ({ id, role: "", interaction: "" })),
    interactables: (over?.interactables ?? []).map((id) => ({ id, type: "", behavior: "" })),
    resources: (over?.resources ?? []).map((id) => ({ id, purpose: "" })),
  }) as unknown as GameDesignSpec;

// ⚠️ 同样只给 layoutVds 读得到的最小 vws（palette 六桶 + style.palette 长度）。
const vws = (hexes: string[] = ["#000000", "#111111"], buckets: Partial<Record<string, string[]>> = {}): VisualWorldSpec =>
  ({
    style: { palette: hexes },
    palette: {
      primary: buckets.primary ?? [],
      secondary: buckets.secondary ?? [],
      accent: buckets.accent ?? [],
      background: buckets.background ?? [],
      shadow: buckets.shadow ?? [],
      highlight: buckets.highlight ?? [],
    },
  }) as unknown as VisualWorldSpec;

const entities = (v: { objects: { sourceIntent?: string }[] }) => v.objects.filter((o) => o.sourceIntent !== undefined);

describe("确定性纯结构布局", () => {
  it("确定性：同输入 ⇒ 同输出（逐字段）", () => {
    const d = design({ enemies: ["e1"], interactables: ["c1"], resources: ["r1", "r2"] });
    const a = layoutVds(d, vws(), VIEWPORT);
    const b = layoutVds(d, vws(), VIEWPORT);
    expect(a).toEqual(b);
  });

  it("覆盖：每个设计实体恰有一个带 sourceIntent 的 object，且 id = sourceIntent（身份绑定不搅乱）", () => {
    const d = design({ enemies: ["e1", "e2"], npcs: ["n1"], interactables: ["c1"], resources: ["r1"] });
    const v = layoutVds(d, vws(), VIEWPORT);
    const ents = entities(v);
    expect(ents.map((o) => o.sourceIntent)).toEqual(["player", "e1", "e2", "n1", "c1", "r1"]);
    for (const o of ents) expect((o as { id: string }).id).toBe(o.sourceIntent);
  });

  it("role 映射（视觉分组默认）：player→player · enemies→hazard · npcs→decor · interactables→pickup · resources→pickup", () => {
    const v = layoutVds(design({ enemies: ["e1"], npcs: ["n1"], interactables: ["c1"], resources: ["r1"] }), vws(), VIEWPORT);
    const bySource = new Map(entities(v).map((o) => [(o as { sourceIntent: string }).sourceIntent, (o as { role: string }).role]));
    expect(bySource.get("player")).toBe("player");
    expect(bySource.get("e1")).toBe("hazard");
    expect(bySource.get("n1")).toBe("decor");
    expect(bySource.get("c1")).toBe("pickup");
    expect(bySource.get("r1")).toBe("pickup");
  });

  it("非退化：实体 bounds 在 x 轴上互不重叠（独立栏）", () => {
    const v = layoutVds(design({ enemies: ["e1", "e2", "e3"], resources: ["r1", "r2"] }), vws(), VIEWPORT);
    const boxes = entities(v).map((o) => (o as { bounds: { x: number; w: number } }).bounds).sort((a, b) => a.x - b.x);
    for (let i = 0; i + 1 < boxes.length; i++) {
      expect(boxes[i]!.x + boxes[i]!.w).toBeLessThanOrEqual(boxes[i + 1]!.x);
    }
  });

  it("layer 有序：background(0) < 实体(10 起) < ui-panel(100) < ui-pip(110)", () => {
    const v = layoutVds(design({ enemies: ["e1"] }), vws(), VIEWPORT);
    // player + e1 两个实体 ⇒ [0(背景), 10(player), 11(e1), 100, 110]
    expect(v.objects.map((o) => o.layer)).toEqual([0, 10, 11, 100, 110]);
  });

  it("合成对象：background + ui-panel + ui-pip 恒在，且无 sourceIntent（不进覆盖分母）", () => {
    const v = layoutVds(design({}), vws(), VIEWPORT);
    const synthetic = v.objects.filter((o) => !o.sourceIntent);
    expect(synthetic.map((o) => o.id).sort()).toEqual(["background", "ui-panel", "ui-pip"]);
  });

  it("容量检查：实体过多抛错，不静默重叠", () => {
    const many = Array.from({ length: 30 }, (_, i) => `e${i}`);
    expect(() => layoutVds(design({ enemies: many }), vws(), VIEWPORT)).toThrow(/实体过多/);
  });

  it("空桶回退：语义桶空 → fill 回退 palette:0", () => {
    const v = layoutVds(design({ enemies: ["e1"] }), vws(["#000000", "#111111"], {}), VIEWPORT);
    const enemy = entities(v).find((o) => o.sourceIntent === "e1") as { fill: string };
    expect(enemy.fill).toBe("palette:0");
  });

  it("语义桶 ref 直接用：fill 取到该桶第一个 ref", () => {
    const v = layoutVds(design({ enemies: ["e1"] }), vws(["#000000", "#111111", "#222222"], { secondary: ["palette:2"] }), VIEWPORT);
    const enemy = entities(v).find((o) => o.sourceIntent === "e1") as { fill: string };
    expect(enemy.fill).toBe("palette:2");
  });

  it("输出通过 VisualDesignSpecSchema 校验", () => {
    const v = layoutVds(design({ enemies: ["e1"], interactables: ["c1"], resources: ["r1"] }), vws(), VIEWPORT);
    expect(VisualDesignSpecSchema.safeParse(v).success).toBe(true);
  });
});

describe("真夹具原样通过（wasteland）", () => {
  it("fixtures/e2e/wasteland-platformer 的 game-design + visual-world → 布局通过 schema", () => {
    const gd = GameDesignSpecSchema.safeParse(JSON.parse(readFileSync(ROOT + "fixtures/e2e/wasteland-platformer/game-design.json", "utf8")));
    const vw = VisualWorldSpecSchema.safeParse(JSON.parse(readFileSync(ROOT + "fixtures/e2e/wasteland-platformer/visual-world.json", "utf8")));
    expect(gd.success).toBe(true);
    expect(vw.success).toBe(true);
    if (!gd.success || !vw.success) return;
    const v = layoutVds(gd.data, vw.data, VIEWPORT);
    expect(VisualDesignSpecSchema.safeParse(v).success).toBe(true);
    // wasteland：player + 1 enemy + 2 interactables + 1 resource = 5 个设计实体
    expect(entities(v)).toHaveLength(5);
  });
});
