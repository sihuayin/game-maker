// 票 02 的两条判据，住在同一个文件里：
//
//   **§漂移判据** —— `visual-world.ts` 的四处 **v4 镜像**必须与各自的 v3 原件同形。
//     镜像这件事（R3-Q1）是为了不把 v3 契约拖进 v4 而付的代价，而「同形」是**承诺**，
//     所以它得**被盯着**：v3 那边加一个字段而镜像没跟上，这里要红。
//     ⚠️ 比对用**行为**（喂值看收不收），不用内部结构 —— 两套 zod 的 introspection
//       API 不一样，比 `_def.typeName` 等于把测试绑死在某一个版本上。
//     ⚠️ 封口性是一条**明示例外**，见下。
//
//   **§4 判据** —— 四份 fixture 里的 `stylespec.json` **一字不改**仍然解析通过
//     （`03 §5` 的兼容要求）。⚠️ 在这条判据被立起来之前，`fixtures/style-spec.json`
//     **没有任何测试读过它**，而两个包内那份只被**逐文件 checksum** 盖住 ——
//     那证明的是**字节没变**，不是**它是一份合法的 `StyleSpec`**。
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  CAMERA_MODES, InputPath, PALETTE_BUCKETS, PaletteColor, PaletteColorShape, PaletteRef,
  PaletteRefShape, PaletteSchema, PaletteShape, StyleReferencePath, StyleSpecSchema, StyleSpecShape,
  VISUAL_WORLD_FORMAT, VisualWorldSpecSchema, toolInputSchema,
} from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));

/** 一个「收不收」的探针 —— 镜像判据的全部内容就是这个函数。 */
interface Probe { safeParse(input: unknown): { success: boolean } }
const accepts = (s: Probe, i: unknown) => s.safeParse(i).success;
/** 两份 schema 对**同一个输入**的判定。断言时比 `v3` 与 `v4` 相等，就是「行为一致」。 */
const pair = (v3: Probe, v4: Probe, i: unknown) => ({ v3: accepts(v3, i), v4: accepts(v4, i) });

// ─────────────────────────────────────────────────────────────────────────────
describe("漂移：v4 镜像 vs v3 原件", () => {
  /** 12 个字段**全给**的一份合法值 —— 拿它删字段来探必填性。 */
  const FULL_STYLE = {
    id: "probe", identity: ["a"],
    camera: {}, composition: {},
    palette: ["#112233"],
    lighting: {},
    shapeLanguage: [], material: [], environment: [], characterStyle: [], constraints: [],
    confidence: 0.5,
  };

  it("StyleSpecShape 与 StyleSpecSchema **键集一字不差**", () => {
    expect(Object.keys(StyleSpecShape.shape).sort()).toEqual(Object.keys(StyleSpecSchema.shape).sort());
  });

  it("StyleSpecShape 与 StyleSpecSchema **逐字段必填性一致**", () => {
    // 基线：全给 ⇒ 两边都收。没有这条，下面每一条「一致」都可能是「一致地错」。
    const base = pair(StyleSpecSchema, StyleSpecShape, FULL_STYLE);
    expect({ v3: base.v3, v4: base.v4 }).toEqual({ v3: true, v4: true });

    for (const key of Object.keys(FULL_STYLE)) {
      const { [key as keyof typeof FULL_STYLE]: _dropped, ...rest } = FULL_STYLE;
      const p = pair(StyleSpecSchema, StyleSpecShape, rest);
      expect(p.v3, `删掉 \`${key}\` 之后两份的必填性判定不同（v3=${p.v3} v4=${p.v4}）`).toBe(p.v4);
    }
  });

  it("StyleSpecShape 与 StyleSpecSchema 对**坏值**的收放一致", () => {
    for (const patch of [
      { palette: ["#112233", "#112233"] },  // 重复色
      { palette: ["#AABBCC"] },             // 大写
      { palette: ["#abc"] },                // 三位缩写
      { confidence: 1.5 },                  // 越界
      { confidence: -0.1 },
      { id: 3 },                            // 类型不符
    ]) {
      const p = pair(StyleSpecSchema, StyleSpecShape, { ...FULL_STYLE, ...patch });
      expect(p.v3, `${JSON.stringify(patch)} 的判定不同`).toBe(p.v4);
    }
  });

  // ⚠️ **明示例外**（R3-Q1）：v3 那份是 `z.object`（多余键被 **strip**），
  //   v4 镜像用 `z.strictObject`（多余键被 **拒**）。这条**故意**不一样 ——
  //   `io: "input"` 下 `z.object` 不产出 `additionalProperties: false`，
  //   而这份 schema 的用途是**告诉模型要什么**，不封口等于在最大的一块上让它自由发挥。
  //   本条把这个差别**钉成断言**：哪天有人「顺手对齐」了，这里会红。
  it("封口性是**明示例外**：v3 悄悄抹掉、v4 当面拒绝", () => {
    const extra = { ...FULL_STYLE, notAField: 1 };
    const r3 = StyleSpecSchema.safeParse(extra);
    expect(r3.success).toBe(true);
    expect(r3.success && "notAField" in r3.data).toBe(false);
    expect(StyleSpecShape.safeParse(extra).success).toBe(false);
  });

  it("PaletteShape 与 PaletteSchema 行为一致", () => {
    for (const v of [[], ["#112233"], ["#112233", "#445566"], ["#112233", "#112233"], ["#AABBCC"], ["#abc"], ["red"], ["#11223"], "nope"]) {
      const p = pair(PaletteSchema, PaletteShape, v);
      expect(p.v3, `色板 ${JSON.stringify(v)} 的判定不同`).toBe(p.v4);
    }
  });

  it("PaletteColorShape 与 PaletteColor 行为一致", () => {
    for (const v of ["#112233", "#AABBCC", "#abc", "red", "", "#1122334", 7, null]) {
      const p = pair(PaletteColor, PaletteColorShape, v);
      expect(p.v3, `色值 ${JSON.stringify(v)} 的判定不同`).toBe(p.v4);
    }
  });

  it("PaletteRefShape 与 PaletteRef 行为一致（六桶的取值域就靠它）", () => {
    for (const v of ["palette:0", "palette:12", "palette:", "palette:-1", "palette:x", "#112233", "", 3]) {
      const p = pair(PaletteRef, PaletteRefShape, v);
      expect(p.v3, `引用 ${JSON.stringify(v)} 的判定不同`).toBe(p.v4);
    }
  });

  it("StyleReferencePath 与 InputPath 行为一致", () => {
    for (const v of ["style.png", "../refs/style.png", "./a/b.png", "a/b/c.png", "", "/abs/style.png", "has space.png", "a//b.png", "a\\b.png", 3]) {
      const p = pair(InputPath, StyleReferencePath, v);
      expect(p.v3, `路径 ${JSON.stringify(v)} 的判定不同`).toBe(p.v4);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("§4 判据：四份 fixture 的 stylespec.json 一字不改仍解析通过", () => {
  const FIXTURES = [
    "fixtures/style-spec.json",
    "fixtures/style-spec.halt-dusk.json",
    "fixtures/packs/last-train/v2/authoring/stylespec.json",
    "fixtures/packs/counter-siege/v4/authoring/stylespec.json",
  ];

  it.each(FIXTURES)("%s 过 StyleSpecSchema", (rel) => {
    const abs = path.join(ROOT, rel);
    expect(existsSync(abs), `${rel} 不存在 —— fixture 被挪走或删了？`).toBe(true);
    const r = StyleSpecSchema.safeParse(JSON.parse(readFileSync(abs, "utf8")));
    // 失败时把 issue 打出来 —— 否则「期望 [] 拿到 [...]」这条信息等于没说
    expect(r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`)).toEqual([]);
  });

  it("四份 fixture 都带非空的 id —— manifest 的 stylespecId 指着它", () => {
    for (const rel of FIXTURES) {
      const doc = JSON.parse(readFileSync(path.join(ROOT, rel), "utf8"));
      expect(typeof doc.id, `${rel} 的 id`).toBe("string");
      expect(doc.id.length, `${rel} 的 id 非空`).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("VisualWorldSpecSchema 本身的形状", () => {
  /** 一份最小合法值：六桶全给（可以空）、`style` 子树给全 12 个字段。 */
  const MINIMAL = {
    format: VISUAL_WORLD_FORMAT,
    styleIdentity: { keywords: ["a"], description: "d" },
    camera: { mode: "side" },
    composition: {},
    palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
    lighting: {},
    materials: {},
    character: {},
    environment: {},
    shapeLanguage: [],
    constraints: [],
    styleReferences: [],
    style: {
      id: "probe", identity: ["a"], camera: {}, composition: {}, palette: ["#112233"],
      lighting: {}, shapeLanguage: [], material: [], environment: [], characterStyle: [], constraints: [], confidence: 0.9,
    },
  };
  const parse = (patch: Record<string, unknown> = {}) => VisualWorldSpecSchema.safeParse({ ...MINIMAL, ...patch });

  it("最小合法值通过，且 `format` 是判别式", () => {
    expect(parse().success).toBe(true);
    expect(parse({ format: "visual-world/v2" }).success).toBe(false);
  });

  it("六桶**必填**（缺一个就拒），但**允许空数组**", () => {
    const { highlight: _dropped, ...five } = MINIMAL.palette;
    expect(parse({ palette: five }).success).toBe(false);
    expect(parse({ palette: { ...five, highlight: [] } }).success).toBe(true);
  });

  // ⚠️ 第 2 条裁决（R1-Q2）：世界里的颜色**只有一个来源**。桶里写 hex 就是第二套。
  it("六桶只收 `palette:<下标>` —— 硬编码 hex 无法通过", () => {
    const p = (highlight: unknown) => parse({ palette: { ...MINIMAL.palette, highlight } }).success;
    expect(p(["palette:3"])).toBe(true);
    expect(p(["#112233"])).toBe(false);
    expect(p(["3"])).toBe(false);
  });

  it("`materials.*.color` 也是 `palette:<下标>`（不产生第二套颜色来源）", () => {
    const m = (color: unknown) => parse({ materials: { brick: { appearance: "哑光", color } } }).success;
    expect(m(["palette:1"])).toBe(true);
    expect(m(["#112233"])).toBe(false);
  });

  it("`materials` 的**键是开集**、**值封口**", () => {
    expect(parse({ materials: { anything: { appearance: "x" }, 另一个: { appearance: "y" } } }).success).toBe(true);
    expect(parse({ materials: { brick: { appearance: "x", 多余: 1 } } }).success).toBe(false);
  });

  it("`camera.mode` 是封闭枚举，且**保留 `other`**", () => {
    const c = (mode: unknown) => parse({ camera: { mode } }).success;
    for (const m of CAMERA_MODES) expect(c(m), m).toBe(true);
    expect(c("fixed 2D orthographic stage view")).toBe(false);
  });

  it("`styleReferences` **不设上限** —— `maxItems === 1` 是调用方的事（R4-Q3）", () => {
    const refs = (n: number) => Array.from({ length: n }, (_, i) => ({ path: `../refs/${i}.png`, role: "style" }));
    expect(parse({ styleReferences: refs(0) }).success).toBe(true);
    expect(parse({ styleReferences: refs(1) }).success).toBe(true);
    expect(parse({ styleReferences: refs(3) }).success).toBe(true);   // ← 契约不拦，调用方拦
    expect(parse({ styleReferences: [{ path: "/abs.png", role: "style" }] }).success).toBe(false);
  });

  it("`style` 子树**必填**，且它的 `palette` 是**有序去重**数组", () => {
    expect(parse({ style: undefined }).success).toBe(false);
    expect(parse({ style: { ...MINIMAL.style, palette: ["#112233", "#112233"] } }).success).toBe(false);
  });

  it("顶层**封口**：多一个键就拒", () => {
    expect(parse({ 未定义的字段: 1 }).success).toBe(false);
    // 改名的那个字段：老名字不该悄悄被收 —— 收了就是把 `identity` 撞名重新放了进来
    expect(parse({ identity: ["我撞名了"] }).success).toBe(false);
  });

  it("`PALETTE_BUCKETS` 与 schema 的键集一致", () => {
    expect(Object.keys(VisualWorldSpecSchema.shape.palette.shape).sort()).toEqual([...PALETTE_BUCKETS].sort());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 这一条是 R3-Q1 的**存在性证明**：镜像若不是真的 v4，`toolInputSchema` 会当场抛。
describe("可被 tool 协议消费（v4 的判据）", () => {
  it("VisualWorldSpecSchema 能转成 `input_schema`，且顶层封口", () => {
    const js = toolInputSchema(VisualWorldSpecSchema) as Record<string, unknown>;
    expect(js.type).toBe("object");
    expect(js.additionalProperties).toBe(false);
    // 判别式必须**落进** JSON Schema，否则模型根本不知道 `format` 该填什么
    expect(JSON.stringify(js)).toContain(VISUAL_WORLD_FORMAT);
  });

  it("反过来：v3 的 StyleSpecSchema 转不了 —— 这就是要镜像的理由", () => {
    expect(() => toolInputSchema(StyleSpecSchema as never)).toThrow(/zod\/v4/);
  });
});
