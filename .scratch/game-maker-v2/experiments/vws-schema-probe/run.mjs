// 探针：`toolInputSchema(VisualWorldSpecSchema)` 到底能不能产出一份**模型用得上的** `input_schema`？
//
// ⚠️ **纯本地**：没有 fetch、没有凭据、不落盘凭据。只做 schema → JSON Schema 的转换。
// ⚠️ 背景：票 27 的探针（`../tool-choice-probe/run.mjs`）量到 4/5，但那份 schema 是
//   **手抄**的（注释写着「逐键照抄 docs/v2/01-contracts.md §2」）—— 本探针回答
//   「换成真契约生成的那份，还成不成立」。
//
// 跑法：node .scratch/game-maker-v2/experiments/vws-schema-probe/run.mjs
// ⚠️ `.scratch/` 不在任何包的 node_modules 底下 —— 裸 import "zod/v4" resolves 不了
//   （pnpm 的严格孤立：zod 只装在 packages/*/node_modules 里）。所以借 contracts 的
//   require 去 resolve，再按绝对路径 import。这也是仓库里既有的路子（probe 从 dist/ 取东西）。
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
const CONTRACTS = path.resolve(import.meta.dirname, "../../../../packages/contracts");
const req = createRequire(path.join(CONTRACTS, "package.json"));
const { z, toJSONSchema } = await import(pathToFileURL(req.resolve("zod/v4")).href);
import { VisualWorldSpecSchema, PaletteShape } from "../../../../packages/contracts/dist/visual-world.js";
import { toolInputSchema } from "../../../../packages/contracts/dist/structured-call.js";

const line = (t) => console.log(`\n${"─".repeat(4)} ${t} ${"─".repeat(Math.max(0, 60 - t.length))}`);
const ok = (b) => (b ? "✅" : "❌");

// ── 0. 前置：dist 是不是真的装着那份契约 ────────────────────────────────
line("0. dist 里的契约");
console.log(`VisualWorldSpecSchema 有 _zod（是 v4）: ${ok("_zod" in VisualWorldSpecSchema)}`);
console.log(`顶层键：${Object.keys(VisualWorldSpecSchema.shape).join(", ")}`);

// ── 1. 直接调 toolInputSchema ─────────────────────────────────────────
line("1. toolInputSchema(VisualWorldSpecSchema)");
let schema = null, threw = null;
try {
  schema = toolInputSchema(VisualWorldSpecSchema);
} catch (e) {
  threw = e;
  console.log(`❌ 抛了：${e.constructor.name}: ${e.message}`);
  console.log(e.stack.split("\n").slice(0, 12).join("\n"));
}
if (schema) {
  const text = JSON.stringify(schema);
  console.log(`✅ 没抛。顶层键：${Object.keys(schema).join(", ")}`);
  console.log(`字节：${Buffer.byteLength(text, "utf8")}  ·  字符：${text.length}`);
}

// ── 2. 全文 dump ──────────────────────────────────────────────────────
line("2. 完整 JSON Schema（顶层）");
if (schema) {
  console.log(`顶层：${JSON.stringify({ ...schema, properties: { ...schema.properties, style: "<见下>" } }, null, 2).slice(0, 200)}`);
  console.log("\n--- 顶层（style 折叠）---");
  const top = { ...schema, properties: { ...schema.properties, style: "«StyleSpecShape：见 §2b»" } };
  console.log(JSON.stringify(top, null, 2));
  console.log("\n--- §2b style 子树 ---");
  console.log(JSON.stringify(schema.properties.style, null, 2));
  console.log("\n--- §2c style.palette ---");
  console.log(JSON.stringify(schema.properties.style.properties.palette, null, 2));
}

// ── 2d. 模型要填的那一半（去掉 style）─────────────────────────────────
line("2d. 模型视角（去掉 style 后的 properties）");
if (schema) {
  const { style: _s, ...modelFacing } = schema.properties;
  console.log(JSON.stringify(modelFacing, null, 2));
  console.log(`\nrequired（去掉 style）：${JSON.stringify(schema.required.filter((k) => k !== "style"))}`);
}

// ── 3. 逐条判据 ───────────────────────────────────────────────────────
line("3. 判据");
if (schema) {
  // 3a strictObject 封口
  const walk = (node, path = "$", out = []) => {
    if (!node || typeof node !== "object") return out;
    if (node.type === "object" || node.properties) out.push({ path, ap: node.additionalProperties });
    for (const [k, v] of Object.entries(node.properties ?? {})) walk(v, `${path}.${k}`, out);
    if (node.items) walk(node.items, `${path}[]`, out);
    for (const [k, v] of Object.entries(node.patternProperties ?? {})) walk(v, `${path}.{${k}}`, out);
    return out;
  };
  const objs = walk(schema);
  const closed = objs.filter((o) => o.ap === false);
  const open = objs.filter((o) => o.ap === undefined);
  const otherAp = objs.filter((o) => o.ap !== false && o.ap !== undefined);
  console.log(`3a 对象节点共 ${objs.length} 个：additionalProperties:false = ${closed.length} · 无该键 = ${open.length} · 其他 = ${otherAp.length}`);
  console.log(`   顶层 additionalProperties = ${JSON.stringify(schema.additionalProperties)} ${ok(schema.additionalProperties === false)}`);
  console.log(`   嵌套例子 styleIdentity.additionalProperties = ${JSON.stringify(schema.properties.styleIdentity.additionalProperties)}`);
  console.log(`   style.additionalProperties = ${JSON.stringify(schema.properties.style.additionalProperties)}`);
  for (const o of open) console.log(`   ⚠️ 没封口的：${o.path}`);
  for (const o of otherAp) console.log(`   ⚠️ 其他值：${o.path} = ${JSON.stringify(o.ap)}`);

  // 3b materials 开集
  const m = schema.properties.materials;
  console.log(`\n3b materials = ${JSON.stringify(m)}`);
  const mv = m.additionalProperties;
  console.log(`   materials 的值形状 additionalProperties = ${JSON.stringify(mv?.additionalProperties)} ${ok(mv?.additionalProperties === false)}`);
  console.log(`   materials 自身 additionalProperties = ${JSON.stringify(m.additionalProperties === false)}`);
  // 转换器有没有「替契约作者表态」把开集封上？
  console.log(`   ⇒ 开集保住了吗：${ok(!(m.additionalProperties === false))}`);

  // 3c style.palette（superRefine）
  const p = schema.properties.style.properties.palette;
  console.log(`\n3c style.palette = ${JSON.stringify(p)}`);
  console.log(`   type=array ${ok(p.type === "array")} · items.pattern=${JSON.stringify(p.items?.pattern)} · uniqueItems=${JSON.stringify(p.uniqueItems)}`);
  console.log(`   superRefine 留下的痕迹：${JSON.stringify(Object.keys(p))}`);

  // 3d literal / enum
  console.log(`\n3d format（z.literal）：${JSON.stringify(schema.properties.format)}`);
  console.log(`   camera.mode（z.enum）：${JSON.stringify(schema.properties.camera.properties.mode)}`);
  console.log(`   style.shading 那种有没有 enum：${JSON.stringify(schema.properties.style.properties.shapeLanguage)}`);

  // 3e optional / required
  console.log(`\n3e 顶层 required：${JSON.stringify(schema.required)}`);
  console.log(`   styleIdentity.required=${JSON.stringify(schema.properties.styleIdentity.required)}（keywords/description 必填，styleName 可选）`);
  console.log(`   camera.required=${JSON.stringify(schema.properties.camera.properties.required ?? schema.properties.camera.required)}`);
  console.log(`   style.required=${JSON.stringify(schema.properties.style.required)}`);
  console.log(`   style.camera（z.record 带 .default({})）→ ${JSON.stringify(schema.properties.style.properties.camera)}`);

  // 3f $ref / $defs / 环
  const refs = [];
  const collect = (n, path = "$") => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) return n.forEach((v, i) => collect(v, `${path}[${i}]`));
    for (const [k, v] of Object.entries(n)) {
      if (k === "$ref") refs.push({ path, ref: v });
      if (k === "$defs") console.log(`   ⚠️ 有 $defs：${path}`);
      collect(v, `${path}.${k}`);
    }
  };
  collect(schema);
  console.log(`\n3f $ref 数：${refs.length} · $defs：${"$defs" in schema ? "有" : "无"}`);
  for (const r of refs) console.log(`   ${r.path} → ${r.ref}`);
  console.log(`   深度：${(function d(n) { if (!n || typeof n !== "object") return 0; if (Array.isArray(n)) return 1 + Math.max(0, ...n.map(d)); return 1 + Math.max(0, ...Object.values(n).map(d)); })(schema)}`);
}

// ── 4. 逐特性子探针（隔离「谁在 toJSONSchema 下活不下来」）──────────────
line("4. 逐特性子探针");
const sub = (label, s) => {
  try {
    const js = toJSONSchema(s, { io: "input" });
    const { $schema: _d, ...rest } = js;
    console.log(`${ok(true)} ${label} → ${JSON.stringify(rest)}`);
    return rest;
  } catch (e) {
    console.log(`${ok(false)} ${label} → 抛 ${e.constructor.name}: ${e.message}`);
    return null;
  }
};
sub("PaletteShape（.superRefine）", PaletteShape);
sub("z.literal('visual-world/v1')", z.literal("visual-world/v1"));
sub("z.enum([...])", z.enum(["side", "top-down", "other"]));
sub("z.strictObject({a})", z.strictObject({ a: z.string() }));
sub("z.object({a}) io:input", z.object({ a: z.string() }));
sub("z.record(z.string(), z.strictObject({a}))", z.record(z.string(), z.strictObject({ a: z.string() })));
sub("z.string().regex(...)", z.string().regex(/^#[0-9a-f]{6}$/));
sub("z.string().optional()", z.strictObject({ a: z.string().optional(), b: z.string() }));
sub("z.string().min(1).superRefine(...)", z.string().min(1).superRefine((_v, _c) => {}));
sub("z.record(z.string(), z.unknown()).default({})", z.record(z.string(), z.unknown()).default({}));

// PaletteShape 是数组 + superRefine —— 看它有没有把 items 丢掉
const palJs = (() => { try { return toJSONSchema(PaletteShape, { io: "input" }); } catch (e) { return { err: e.message }; } })();
console.log(`\nPaletteShape 单独：${JSON.stringify(palJs)}`);
console.log(`   → items 还在吗：${ok(palJs?.items?.pattern === "^#[0-9a-f]{6}$")}  ·  uniqueItems 有吗：${JSON.stringify(palJs?.uniqueItems)}`);
console.log(`   → superRefine 的「不得重复」去哪了：${palJs?.uniqueItems === true ? "被翻成了 uniqueItems" : "⚠️ 丢了（无 uniqueItems）"}`);

// 4b 同一份 schema 的 io:output 对照（.default() 的必填性差异）
line("4b io:input vs io:output（.default() 那一档）");
for (const io of ["input", "output"]) {
  const js = toJSONSchema(z.strictObject({ a: z.string().default("x"), b: z.string() }), { io });
  console.log(`   io:${io} → required=${JSON.stringify(js.required)}  ·  a=${JSON.stringify(js.properties.a)}`);
}

// ── 5. style 去掉后的瘦身版 ────────────────────────────────────────────
line("5. 瘦身版（.omit({style:true})）");
let slim = null;
try {
  const SlimSchema = VisualWorldSpecSchema.omit({ style: true });
  console.log(`   .omit 存在：${ok(typeof VisualWorldSpecSchema.omit === "function")}`);
  console.log(`   瘦身版顶层键：${Object.keys(SlimSchema.shape).join(", ")}`);
  slim = toolInputSchema(SlimSchema);
  const t = JSON.stringify(slim);
  console.log(`✅ 转换成功。字节：${Buffer.byteLength(t, "utf8")} · 字符：${t.length}`);
  console.log(`   顶层 additionalProperties=${JSON.stringify(slim.additionalProperties)} · required=${JSON.stringify(slim.required)}`);
} catch (e) {
  console.log(`❌ ${e.constructor.name}: ${e.message}`);
}

// ── 6. 体积 / token ───────────────────────────────────────────────────
line("6. 体积与 token 粗估");
const est = (o) => {
  const t = JSON.stringify(o);
  const bytes = Buffer.byteLength(t, "utf8");
  return { bytes, chars: t.length, tok4: Math.ceil(bytes / 4), tok36: Math.ceil(t.length / 3.6) };
};
const full = schema ? est(schema) : null;
const sl = slim ? est(slim) : null;
const pretty = schema ? est(JSON.stringify(schema, null, 2)) : null;
if (full) console.log(`全量 schema：${JSON.stringify(full)}`);
if (pretty) console.log(`全量（缩进 2）：字节 ${pretty.bytes} · 行数 ${JSON.stringify(schema, null, 2).split("\n").length}`);
if (sl) console.log(`瘦身版    ：${JSON.stringify(sl)}`);
if (full && sl) console.log(`style 子树占：${full.bytes - sl.bytes} 字节（${(((full.bytes - sl.bytes) / full.bytes) * 100).toFixed(1)}%）`);
console.log(`⚠️ token 数是**估的**：本机没装 tokenizer（无 tiktoken / @anthropic-ai/tokenizer），`);
console.log(`   只给了 bytes/4 与 chars/3.6 两个界。要真数得走 count_tokens —— 而本探针不联网。`);

// ── 7. 端到端：拿一份「模型会吐的东西」喂回 safeParse ────────────────────
line("7. 往返：schema 生成的示例值 → safeParse");
const sample = {
  format: "visual-world/v1",
  styleIdentity: { keywords: ["pixel"], description: "dusk railway halt" },
  camera: { mode: "side" },
  composition: {},
  palette: { primary: ["palette:0"], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
  lighting: {},
  materials: { wood: { appearance: "weathered" } },
  character: {},
  environment: {},
  shapeLanguage: [],
  constraints: [],
  styleReferences: [{ path: "fixtures/reference/halt-dusk.png", role: "style" }],
  style: { id: "s1", identity: [], palette: [], confidence: 0.5 },
};
const r = VisualWorldSpecSchema.safeParse(sample);
console.log(`最小合法样本 safeParse：${ok(r.success)}${r.success ? "" : " → " + JSON.stringify(r.error.issues.slice(0, 5))}`);

// ── 8. 边角：v3 守卫、与票 27 那份手抄 schema 的差、材料开集的实际行为 ────────
line("8a. 守卫：喂 v3 的 schema");
try {
  const v3 = await import(pathToFileURL(req.resolve("zod")).href);
  toolInputSchema(v3.z.object({ a: v3.z.string() }));
  console.log(`❌ 没抛 —— 守卫失效`);
} catch (e) {
  console.log(`✅ 抛了：${e.constructor.name}: ${e.message}`);
}

line("8b. 与票 27 那发实测用的 schema 对比（它是手抄的）");
// 票 27 那发的 schema 见 ../tool-choice-probe/run.mjs 的 VWS_SCHEMA + VWS_REQUIRED_TOP
const T27 = ["schemaVersion","identity","rendering","camera","palette","materials","character",
             "environment","animation","readability","references","confidence"];
const REAL = schema ? schema.required : [];
const only27 = T27.filter((k) => !REAL.includes(k));
const onlyReal = REAL.filter((k) => !T27.includes(k));
const both = T27.filter((k) => REAL.includes(k));
console.log(`   票 27：${T27.length} 键 · 真契约：${REAL.length} 键 · 交集：${both.length}（${both.join(",")}）`);
console.log(`   只有票 27 有：${only27.join(",")}`);
console.log(`   只有真契约有：${onlyReal.join(",")}`);
console.log(`   ⇒ 那 4/5 量的**不是**这份契约生成的 schema。`);
if (slim) {
  const t27 = JSON.stringify({ type: "object", properties: Object.fromEntries(T27.map((k) => [k, { type: "object" }])), required: T27 });
  console.log(`   （票 27 的真实 tool schema 字节数要跑那份探针才拿得到；这里只比键集）`);
}

line("8c. materials 开集的实际行为（safeParse 侧）");
const base = {
  format: "visual-world/v1",
  styleIdentity: { keywords: [], description: "d" },
  camera: { mode: "side" }, composition: {}, lighting: {},
  palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
  materials: {}, character: {}, environment: {},
  shapeLanguage: [], constraints: [], styleReferences: [],
  style: { id: "s", identity: [], confidence: 1 },
};
const withWeird = { ...base, materials: { "自创材质名-2026": { appearance: "x" } } };
const r2 = VisualWorldSpecSchema.safeParse(withWeird);
console.log(`   任意键名的材质：${ok(r2.success)} ${r2.success ? "" : JSON.stringify(r2.error.issues.slice(0, 3))}`);
const closedMat = { ...base, materials: { wood: { appearance: "x", surprise: 1 } } };
const r3 = VisualWorldSpecSchema.safeParse(closedMat);
console.log(`   材质值里多一个键：${ok(!r3.success)}（应当被拒）${r3.success ? "⚠️ 没拒" : ""}`);
const extraTop = { ...base, nope: 1 };
const r4 = VisualWorldSpecSchema.safeParse(extraTop);
console.log(`   顶层多一个键：${ok(!r4.success)}（应当被拒）`);

line("8d. 缺省字段（io:input 的语义）");
const omitDefaults = {
  format: "visual-world/v1",
  styleIdentity: { keywords: ["k"], description: "d" },
  camera: { mode: "top-down" },
  composition: {}, lighting: {}, character: {}, environment: {},
  palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
  materials: {}, shapeLanguage: [], constraints: [], styleReferences: [],
  style: { id: "s", identity: [], confidence: 0.5 },
};
const r5 = VisualWorldSpecSchema.safeParse(omitDefaults);
console.log(`   省略 style.camera/composition/lighting + style.palette：${ok(r5.success)} ${r5.success ? "→ 默认值补上：" + JSON.stringify(r5.data.style.camera) + " / " + JSON.stringify(r5.data.style.palette) : JSON.stringify(r5.error.issues.slice(0,3))}`);

line("8e. $ref / 体积分解");
const parts = schema ? Object.entries(schema.properties).map(([k, v]) => [k, Buffer.byteLength(JSON.stringify(v))]) : [];
parts.sort((a, b) => b[1] - a[1]);
for (const [k, n] of parts) console.log(`   ${String(n).padStart(5)} B  ${k}`);
console.log(`   合计 ${parts.reduce((a, [, n]) => a + n, 0)} B（体量前二：${parts.slice(0, 2).map(([k]) => k).join(", ")}）`);

// ── 9. 落一份产物，供上游票面直接引用 ──────────────────────────────────
line("9. 落盘");
const RAW = path.join(import.meta.dirname, "raw");
const fs = await import("node:fs");
fs.mkdirSync(RAW, { recursive: true });
if (schema) fs.writeFileSync(path.join(RAW, "visual-world.tool.json"), JSON.stringify(schema, null, 2));
if (slim) fs.writeFileSync(path.join(RAW, "visual-world-slim.tool.json"), JSON.stringify(slim, null, 2));
console.log(`   raw/visual-world.tool.json（${schema ? Buffer.byteLength(JSON.stringify(schema, null, 2)) : "—"} B）`);
console.log(`   raw/visual-world-slim.tool.json（${slim ? Buffer.byteLength(JSON.stringify(slim, null, 2)) : "—"} B）`);
