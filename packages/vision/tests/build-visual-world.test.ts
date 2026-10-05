// 装配那一步的判据：**注入两件调用方才知道的东西，然后重新过一次契约**。
//
// ⚠️ 这里也是**越界 gate 唯一的落点**：`superRefine` 会被 `toJSONSchema` 丢掉（模型看不见），
//   而模型面向的 schema 又用 `.omit()` 把它摘掉了 ⇒ 它拦不住模型吐的那一半，
//   只能拦**装配之后的成品**。所以「模型自相矛盾」这件事在这里必须红。
import { describe, expect, it } from "vitest";
import { buildVisualWorld, type VisualWorldFromModel } from "../src/index.js";

const REFS = [{ path: "fixtures/reference/halt-dusk.png", role: "global" }];
const STYLE_KEYS = ["id", "identity", "camera", "composition", "palette", "lighting", "shapeLanguage",
                    "material", "environment", "characterStyle", "constraints", "confidence"] as const;

const fromModel = (over: Partial<VisualWorldFromModel> = {}): VisualWorldFromModel => ({
  format: "visual-world/v1",
  styleIdentity: { keywords: ["像素"], description: "黄昏山间列车小站" },
  camera: { mode: "side" },
  composition: {}, lighting: {}, character: {}, environment: {},
  palette: { primary: ["palette:0"], secondary: [], accent: [], background: ["palette:1"], shadow: [], highlight: [] },
  materials: { wood: { appearance: "哑光" }, dust: { appearance: "颗粒", color: ["palette:1"] } },
  shapeLanguage: ["横平竖直"], constraints: ["不要抗锯齿"],
  style: {
    id: "模型自己编的", identity: ["扁平"], camera: {}, composition: {},
    palette: ["#2e3b4e", "#4a6076"], lighting: {},
    shapeLanguage: [], material: [], environment: [], characterStyle: [], constraints: [], confidence: 0.9,
  },
  ...over,
});

describe("装配", () => {
  it("① `styleReferences` **由调用方注入**（R1-Q2）—— 模型答不出这个路径", () => {
    const r = buildVisualWorld({ fromModel: fromModel(), styleReferences: REFS, styleId: "halt-dusk" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.spec.styleReferences).toEqual(REFS);
  });

  it("② `style.id` **强制覆盖**（票 02 裁决 21）—— 模型抄错也不要紧", () => {
    const r = buildVisualWorld({ fromModel: fromModel(), styleReferences: REFS, styleId: "halt-dusk" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.spec.style.id).toBe("halt-dusk");
  });

  it("就算模型那一份里混进了 `styleReferences`，调用方给的照样赢", () => {
    const sneaky = { ...fromModel(), styleReferences: [{ path: "nope.png", role: "瞎编的" }] } as VisualWorldFromModel;
    const r = buildVisualWorld({ fromModel: sneaky, styleReferences: REFS, styleId: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.spec.styleReferences).toEqual(REFS);
  });

  it("键序被归一成契约的次序 —— 落盘的 `visual-world.json` 因此是稳定的（可 diff）", () => {
    const r = buildVisualWorld({ fromModel: fromModel(), styleReferences: REFS, styleId: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Object.keys(r.spec)).toEqual(["format", "styleIdentity", "camera", "composition", "palette",
        "lighting", "materials", "character", "environment", "shapeLanguage", "constraints", "styleReferences", "style"]);
      expect(Object.keys(r.spec.style)).toEqual([...STYLE_KEYS]);
    }
  });

  it("⚠️ **`style` 子树的其余字段一个都不动**（R2-Q6：模型看得见的，就该模型负责）", () => {
    const r = buildVisualWorld({ fromModel: fromModel(), styleReferences: REFS, styleId: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.spec.style.confidence).toBe(0.9);
      expect(r.spec.style.identity).toEqual(["扁平"]);
      expect(r.spec.style.palette).toEqual(["#2e3b4e", "#4a6076"]);
    }
  });
});

describe("⚠️ 越界 gate —— 模型自己跟自己打架（R1-Q6 / R2-Q4）", () => {
  it("六桶里越界 ⇒ 拒，且报错**指得到那一格**", () => {
    const bad = fromModel({ palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: ["palette:2"] } });
    const r = buildVisualWorld({ fromModel: bad, styleReferences: REFS, styleId: "s" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.detail).toContain("palette.highlight[0]");
      expect(r.detail).toContain("只有 2 个色");
    }
  });

  it("`materials.*.color` 里越界 ⇒ 同样拒（一个世界只有一个颜色来源）", () => {
    const bad = fromModel({ materials: { wood: { appearance: "哑光", color: ["palette:9"] } } });
    const r = buildVisualWorld({ fromModel: bad, styleReferences: REFS, styleId: "s" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toContain("materials.wood.color[0]");
  });

  it("边界内（最后一个下标）⇒ 放行 —— gate 不能把合法的也拦下", () => {
    const edge = fromModel({ palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: ["palette:1"] } });
    expect(buildVisualWorld({ fromModel: edge, styleReferences: REFS, styleId: "s" }).ok).toBe(true);
  });

  it("空色板 + 任何引用 ⇒ 拒（下标 0 也越界）", () => {
    const bad = fromModel({
      palette: { primary: ["palette:0"], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
      style: { ...fromModel().style, palette: [] },
    });
    expect(buildVisualWorld({ fromModel: bad, styleReferences: REFS, styleId: "s" }).ok).toBe(false);
  });

  it("⚠️ 自造键 ⇒ 拒（票 08 第 06 发实测：模型写了 `environmentStyle`）", () => {
    const bad = fromModel();
    (bad.style as unknown as Record<string, unknown>)["environmentStyle"] = ["瞎编"];
    const r = buildVisualWorld({ fromModel: bad, styleReferences: REFS, styleId: "s" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toContain("environmentStyle");
  });
});
