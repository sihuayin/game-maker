// 票 08 往 `visual-world.ts` 里加的那条**越界 gate**，与它带来的两条后果。
//
// ⚠️ 这条 gate 与票 02 那两条判据是**两回事**：那两条盯的是「镜像同形」与「旧文件仍解析」，
//   这一条盯的是**文书自己跟自己对不对得上** —— 色板与 `palette:N` 是同一次调用里写出来的。
import { describe, expect, it } from "vitest";
import { VisualWorldSpecSchema, toolInputSchema } from "../src/index.js";

/** 一份**最小合法**的文档。`style.palette` 两个色，所以合法下标只有 0 与 1。 */
const doc = (over: Record<string, unknown> = {}) => ({
  format: "visual-world/v1",
  styleIdentity: { keywords: [], description: "d" },
  camera: { mode: "side" }, composition: {}, lighting: {}, character: {}, environment: {},
  palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
  materials: {}, shapeLanguage: [], constraints: [], styleReferences: [],
  style: { id: "s", identity: [], palette: ["#112233", "#445566"], confidence: 0.5 },
  ...over,
});

const buckets = (over: Record<string, string[]> = {}) =>
  ({ primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [], ...over });

describe("⚠️ 越界 gate（R1-Q6 / R2-Q4）", () => {
  it("六桶里越界 ⇒ 拒，且 `path` 指得到**那一格**（报错要能定位）", () => {
    const r = VisualWorldSpecSchema.safeParse(doc({ palette: buckets({ highlight: ["palette:2"] }) }));
    expect(r.success).toBe(false);
    if (r.success) return;
    const i = r.error.issues[0]!;
    expect(i.path).toEqual(["palette", "highlight", 0]);
    expect(i.message).toContain("只有 2 个色");
  });

  it("`materials.*.color` 里越界 ⇒ 同样拒（六桶与它同一条规矩：一个世界只有一个颜色来源）", () => {
    const r = VisualWorldSpecSchema.safeParse(doc({
      materials: { sunDisc: { appearance: "发光", color: ["palette:2"] } },
    }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]!.path).toEqual(["materials", "sunDisc", "color", 0]);
  });

  it("一处越界只报一条 —— 别把同一份文档报成一堵墙", () => {
    const r = VisualWorldSpecSchema.safeParse(doc({ palette: buckets({ primary: ["palette:9"], accent: ["palette:8"] }) }));
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues).toHaveLength(2);
  });

  it("边界内（最后一个下标）⇒ 放行 —— gate **不许**把合法的也拦下", () => {
    expect(VisualWorldSpecSchema.safeParse(doc({ palette: buckets({ highlight: ["palette:1"] }) })).success).toBe(true);
  });

  it("空色板 + 任何引用 ⇒ 拒（下标 0 也越界）", () => {
    const d = doc({ palette: buckets({ primary: ["palette:0"] }) });
    (d.style as Record<string, unknown>)["palette"] = [];
    expect(VisualWorldSpecSchema.safeParse(d).success).toBe(false);
  });

  it("⚠️ 它**同时管从磁盘上读回来的文档** —— 一份人手写的、引用越界的会被拒", () => {
    // 这一条就是那句自白的内容：gate 不只活在 vision 那一次调用里。
    // 它让票 17 那条「palette 越界判据」**在 VWS 这一侧永远不再触发**（config / drawlist 侧那条还在）。
    const fromDisk = JSON.parse(JSON.stringify(doc({ palette: buckets({ shadow: ["palette:5"] }) })));
    expect(VisualWorldSpecSchema.safeParse(fromDisk).success).toBe(false);
  });
});

describe("gate 的两条「看不见」性质 —— 它们解释了这个设计为什么长这样", () => {
  it("⚠️ 它**在工具 schema 里一点痕迹都没有**（`toJSONSchema` 丢 `superRefine`）⇒ 模型看不见它", () => {
    const json = JSON.stringify(toolInputSchema(VisualWorldSpecSchema));
    expect(json).not.toContain("只有 2 个色");     // 显然
    expect(json).not.toContain("superRefine");
    // 而 `style.palette` 那条「不得重色」也一起没了 —— 同一款丢失，票 08 的探针实测过。
    expect(json).not.toContain("uniqueItems");
  });

  it("`.omit()` 会把 gate **摘掉** ⇒ `vision` 靠装配后的重校验接住它，而不是靠模型那一份", () => {
    const dropped = VisualWorldSpecSchema.omit({ styleReferences: true });
    const d = doc({ palette: buckets({ highlight: ["palette:2"] }) });
    delete (d as Record<string, unknown>)["styleReferences"];
    expect(dropped.safeParse(d).success).toBe(true);              // 摘掉了
    expect(VisualWorldSpecSchema.safeParse({ ...d, styleReferences: [] }).success).toBe(false);  // 契约那一份照旧拦
  });
});
