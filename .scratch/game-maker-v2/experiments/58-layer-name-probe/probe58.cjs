// 票 58 探针（第 2 版 —— 第 1 版漏了 COMMON 必填的 `description`，读数作废）
// 「层名不许重复」只住在交付侧：**规矩能放进哪一层**（免费 · 不碰网络）
const path = require("path");
const ROOT = "/Volumes/shy/some-projects/game-maker";
const c = require(path.join(ROOT, "packages/contracts/dist/index.js"));
const z = require(path.join(ROOT, "packages/contracts/node_modules/zod/index.js"));
const fs = require("fs");

const out = [];
const say = (s) => { out.push(s); console.log(s); };

const COMMON = {
  role: "background", description: "d", styleId: "s",
  size: { w: 64, h: 64 }, anchor: { x: 0, y: 0 },
};

say("=== ① 创作侧：AssetSpecSchema 收不收同名层 ===");
const bg = {
  ...COMMON, kind: "background", id: "bg-a",
  layers: [{ name: "far", parallax: 0.2 }, { name: "far", parallax: 0.5 }],  // ← 同名
};
const r1 = c.AssetSpecSchema.safeParse(bg);
say(`  两层都叫 "far" ⇒ ${r1.success ? "✅ 放行 —— 创作侧零判据" : "❌ 拒：" + JSON.stringify(r1.error.issues)}`);
// 对照：单层合法输入应当过（证明上面那个「放行」不是因为别的理由被绕过）
const bgOk = { ...bg, layers: [{ name: "far", parallax: 0.2 }, { name: "near", parallax: 0.5 }] };
say(`  对照（层名不同）⇒ ${c.AssetSpecSchema.safeParse(bgOk).success ? "✅ 过" : "❌ 拒 —— 探针本身有问题"}`);

say("");
say("=== ② 那条规矩**物理上**能放进哪一层（zod v3 结构约束）===");
try {
  const L2 = c.Layer.superRefine(() => {});
  L2.extend({ description: z.string().optional() });
  say("  放在 `Layer` 上再 `.extend()` ⇒ ✅ 可以");
} catch (e) {
  say(`  放在 \`Layer\` 上再 \`.extend()\` ⇒ ❌ ${e.constructor.name}: ${String(e.message).slice(0, 80)}`);
}
try {
  const B2 = c.BackgroundSpec.superRefine(() => {});
  z.discriminatedUnion("kind", [B2]).parse({ kind: "background" });
  say("  放在 `BackgroundSpec`（union 成员）上 ⇒ ✅ 可以");
} catch (e) {
  say(`  放在 \`BackgroundSpec\`（union 成员）上 ⇒ ❌ ${e.constructor.name}: ${String(e.message).slice(0, 80)}`);
}
try {
  z.discriminatedUnion("kind", [c.SpriteSpec, c.AnimatedSpec, c.BackgroundSpec, c.UiSpec]).superRefine(() => {});
  say("  放在 union（`AssetSpecSchema`）这一层 ⇒ ✅ 可以 —— 与九宫格那条同一个落点");
} catch (e) {
  say(`  放在 union 这一层 ⇒ ❌ ${e.constructor.name}: ${String(e.message).slice(0, 80)}`);
}

say("");
say("=== ③ 交付侧：AssetPackEntry 拒不拒同名层（复核票 46）===");
const entry = {
  id: "bg-a", kind: "background", role: "background", origin: "generated",
  paletteBinding: "exact", size: { w: 64, h: 64 }, anchor: { x: 0, y: 0 },
  layers: [{ name: "far", parallax: 0.2 }, { name: "far", parallax: 0.5 }],
  atlasId: "a", frames: [{ name: "bg-a.far" }, { name: "bg-a.far" }],
  authoring: [{ kind: "drawlist", ref: "authoring/bg-a.json" }],
};
const r3 = c.AssetPackEntry.safeParse(entry);
say(`  ⇒ ${r3.success ? "✅ 放行" : "❌ 拒（" + r3.error.issues.map(i => i.message).join(" · ") + "）"}`);

say("");
say("=== ④ 对照规矩：「九宫格中央区」是不是**反向**的单侧规矩 ===");
const ui = {
  ...COMMON, kind: "ui", id: "panel", size: { w: 32, h: 16 }, anchor: { x: 0.5, y: 0.5 },
  ninePatch: { left: 20, right: 20, top: 0, bottom: 0 },   // 20+20 >= 32 ⇒ 中央区空
};
const r4 = c.AssetSpecSchema.safeParse(ui);
say(`  创作侧 AssetSpecSchema ⇒ ${r4.success ? "✅ 放行" : "❌ 拒（" + r4.error.issues.map(i => i.message).join(" · ") + "）"}`);
// 交付侧那份是**中央矩形** {x,y,w,h}（不是内缩）—— 它能表达出「中央区空」吗？
const mkUi = (scale9) => ({
  id: "panel", kind: "ui", role: "ui", origin: "generated", paletteBinding: "exact",
  size: { w: 32, h: 16 }, anchor: { x: 0.5, y: 0.5 }, scale9Borders: scale9,
  atlasId: "a", frames: [{ name: "panel.0" }], authoring: [{ kind: "drawlist", ref: "a.json" }],
});
const w0 = c.AssetPackEntry.safeParse(mkUi({ x: 20, y: 0, w: 0, h: 16 }));
say(`  交付侧「中央区宽 = 0」⇒ ${w0.success ? "✅ 放行 ⚠️" : "❌ 拒（形状自己挡住）"}`);
const over = c.AssetPackEntry.safeParse(mkUi({ x: 20, y: 0, w: 20, h: 16 }));  // x+w=40 > size.w=32
say(`  交付侧「中央矩形越出资源」（x+w=40 > size.w=32）⇒ ${over.success ? "✅ 放行 —— ⚠️ 交付侧不拿它跟 size 对账" : "❌ 拒（" + over.error.issues.map(i => i.message).join(" · ") + "）"}`);

say("");
say("=== ⑤ 真配方过不过闸（fixtures/recipes/last-train.json 改一处层名）===");
const rec = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/recipes/last-train.json"), "utf8"));
say(`  原样 ⇒ ${c.parseRecipe(rec).ok ? "✅ 过" : "❌ 拒"}`);
let mutated = null;
for (const a of rec.assets) {
  const s = a.spec;
  if (s && s.kind === "background" && s.layers && s.layers.length > 1) {
    say(`  背景资产 "${s.id}" 层名：${s.layers.map(l => l.name).join(" / ")}`);
    s.layers[s.layers.length - 1].name = s.layers[0].name;
    mutated = s.layers.map(l => l.name).join(" / ");
    break;
  }
}
if (mutated) {
  const after = c.parseRecipe(rec);
  say(`  改成同名（${mutated}）⇒ ${after.ok ? "✅ **还是过闸** —— 配方层零判据（票 46 的读数复现）" : "❌ 拒：" + JSON.stringify(after.errors)}`);
}

say("");
say("=== ⑥ 模型看得见吗（recipe-tool 的 v4 镜像）===");
const shapeBg = {
  kind: "background", id: "bg-a", role: "background", description: "d", styleId: "s",
  size: { w: 64, h: 64 }, anchor: { x: 0, y: 0 },
  layers: [{ name: "far", parallax: 0.2 }, { name: "far", parallax: 0.5 }],
};
const mirror = JSON.stringify(c.RecipeToolSchema.shape ? {} : {});
const r6 = c.AssetSpecShape.safeParse(shapeBg);
say(`  模型面向的 AssetSpecShape（= recipe-tool 里那份）⇒ ${r6.success ? "✅ **放行** —— 镜像里一个 refine 都没有，模型看不见这条规矩" : "❌ 拒"}`);

fs.writeFileSync(path.join("/Users/sihuayin/.claude/jobs/5c64aaee/tmp", "probe58-out.txt"), out.join("\n") + "\n");
