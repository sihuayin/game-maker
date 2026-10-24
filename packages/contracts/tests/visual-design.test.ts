// `visual-design/v1` 契约的测试（visual-design-impl-v1 票 01）。
//
// ⚠️ 最有分量的一条是**漂移测试**：`Role` 的实体子集必须**从 `EntityKind.options` 派生**、一字不差
//   （单一来源）。它的存在理由不是「现在对」，是拦住**将来有人把它改成手写 7 个字面量**——
//   一旦重声明，`role↔kind` 串桶判据（票 07）就会对不齐，而那正是本契约最不能漂的地方。
import { describe, expect, it } from "vitest";
import { Role, VISUAL_DESIGN_FORMAT, VisualDesignSpecSchema, type VisualDesignSpec } from "../src/index.js";
import { EntityKind } from "../src/game-config.js";

const SYNTHETIC_ROLES = ["player", "background", "ui-panel", "ui-pip"] as const;

/** 一份合法的最小 VDS（废土寻宝，480×270）。 */
const base = (over: Partial<VisualDesignSpec> = {}): VisualDesignSpec => ({
  format: VISUAL_DESIGN_FORMAT,
  viewport: { w: 480, h: 270 },
  style: { visualWorldFormat: "visual-world/v1" },
  objects: [
    { id: "bg-wasteland", role: "background", bounds: { x: 0, y: 0, w: 480, h: 270 }, layer: 0, fill: "palette:0" },
    { id: "e-player", role: "player", bounds: { x: 40, y: 190, w: 24, h: 40 }, layer: 10, fill: "palette:1", sourceIntent: "player" },
    { id: "e-chest", role: "chest", bounds: { x: 380, y: 224, w: 24, h: 20 }, layer: 20, fill: "palette:3", sourceIntent: "e-chest" },
  ],
  ...over,
});

const parse = (input: unknown) => VisualDesignSpecSchema.safeParse(input);

describe("visual-design/v1 契约", () => {
  it("接受合法 VDS", () => {
    expect(parse(base()).success).toBe(true);
  });

  it("判据：format 不是 visual-design/v1 ⇒ 拒", () => {
    const r = parse(base({ format: "game-design/v1" as never }));
    expect(r.success).toBe(false);
  });

  it("判据：role 只认 11 值 —— `npc`/`enemy`/`terrain` 都不在枚举", () => {
    for (const bad of ["npc", "enemy", "interactable", "resource", "terrain"]) {
      const r = parse(base({ objects: [{ ...base().objects[0]!, id: "x", role: bad as never }] }));
      expect(r.success).toBe(false);
    }
  });

  it("判据：fill 只认 `palette:N` 形 —— 硬编码 hex 拒", () => {
    const r = parse(base({ objects: [{ ...base().objects[0]!, id: "x", fill: "#6b8e55" }] }));
    expect(r.success).toBe(false);
  });

  it("判据：bounds 负数 / 非整数拒", () => {
    expect(parse(base({ objects: [{ ...base().objects[0]!, id: "x", bounds: { x: -1, y: 0, w: 10, h: 10 } }] })).success).toBe(false);
    expect(parse(base({ objects: [{ ...base().objects[0]!, id: "x", bounds: { x: 1.5, y: 0, w: 10, h: 10 } }] })).success).toBe(false);
    expect(parse(base({ objects: [{ ...base().objects[0]!, id: "x", bounds: { x: 0, y: 0, w: 0, h: 10 } }] })).success).toBe(false);
  });

  it("判据：layer 非整数拒", () => {
    const r = parse(base({ objects: [{ ...base().objects[0]!, id: "x", layer: 1.5 }] }));
    expect(r.success).toBe(false);
  });

  it("判据：object id 重复拒（superRefine）", () => {
    const r = parse(base({
      objects: [
        { ...base().objects[0]!, id: "dup" },
        { ...base().objects[1]!, id: "dup" },
      ],
    }));
    expect(r.success).toBe(false);
  });

  it("判据：objects 空拒（min(1)）", () => {
    expect(parse(base({ objects: [] })).success).toBe(false);
  });

  it("判据：viewport 非正 / 非整数拒", () => {
    expect(parse(base({ viewport: { w: 0, h: 270 } })).success).toBe(false);
    expect(parse(base({ viewport: { w: 480.5, h: 270 } })).success).toBe(false);
  });

  it("判据：strict —— 顶层 / object 的未知键都拒", () => {
    expect(parse({ ...base(), extra: true }).success).toBe(false);
    // visualRef 是 PRD §5.3 的旧字段、票 03 已砍 —— 构造「脏」输入（标 unknown 绕开字面量多余属性检查）
    const dirty: unknown = {
      ...base(),
      objects: [{ ...base().objects[0]!, id: "x", visualRef: "svg/x.svg#x" }],
    };
    expect(parse(dirty).success).toBe(false);
  });

  it("判据：style 只认 visualWorldFormat 出处指针", () => {
    const r = parse(base({ style: { visualWorldFormat: "drawlist/v1" as never } }));
    expect(r.success).toBe(false);
  });

  it("sourceIntent 可选（纯装饰可以没有）", () => {
    const r = parse(base({ objects: [{ id: "decor", role: "decor", bounds: { x: 1, y: 1, w: 2, h: 2 }, layer: 5, fill: "palette:2" }] }));
    expect(r.success).toBe(true);
  });
});

describe("Role 与 EntityKind 的漂移测试（单一来源）", () => {
  it("Role 的实体子集 === EntityKind.options，顺序也一致", () => {
    const entityKinds = Role.options.filter((r) => !(SYNTHETIC_ROLES as readonly string[]).includes(r));
    expect(entityKinds).toEqual([...EntityKind.options]);
  });

  it("Role 恰 11 值：EntityKind 7 + player + 3 合成角色", () => {
    expect(Role.options).toHaveLength(EntityKind.options.length + 4);
    for (const s of SYNTHETIC_ROLES) expect(Role.options).toContain(s);
  });
});
