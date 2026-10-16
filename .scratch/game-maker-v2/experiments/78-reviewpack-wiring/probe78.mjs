// 票 78 探针 —— **只读 · 零付费 · 零网络**（`reviewPack` 的 fetch 是**假的**，一次都不发出去）。
//
// 量三件事：
//   ① 拼联系表**是纯的** —— 真跑一次 `packContactSheet`，量它的尺寸与格数（零成本的一半在这里）
//   ② 包里的 `authoring/stylespec.json` **过不过 `StyleSpecSchema`** —— 那决定「接线要不要再要一个 --style」
//   ③ 真发一次 `reviewPack` **会发出去多少字节** —— 拿假 fetch 把**请求体**截下来量（含 base64 图）
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const ROOT = path.resolve(HERE, "../../../..");          // 仓库根
const A = await import(pathToFileURL(path.resolve(ROOT, "packages/assets/dist/index.js")).href);
const C = await import(pathToFileURL(path.resolve(ROOT, "packages/contracts/dist/index.js")).href);

const PACKS = ["fixtures/packs/last-train/v2", "fixtures/packs/counter-siege/v4"];

for (const rel of PACKS) {
  const packDir = path.resolve(ROOT, rel);
  console.log(`═══ ${rel} ═══`);

  // ① 联系表 —— 纯函数，零网络
  const t0 = process.hrtime.bigint();
  const sheet = A.packContactSheet(packDir);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6;
  const frames = JSON.parse(fs.readFileSync(path.join(packDir, "manifest.json"), "utf8")).atlases
    .reduce((n, at) => n + Object.keys(JSON.parse(fs.readFileSync(path.join(packDir, at.meta), "utf8")).frames).length, 0);
  console.log(`   ① 联系表：${sheet.width}×${sheet.height}px · 图集里共 ${frames} 帧 · 拼了 ${ms.toFixed(0)}ms  ← **纯函数，零网络**`);

  // ② 包里那份 stylespec 过不过契约
  const sp = path.join(packDir, "authoring", "stylespec.json");
  const raw = JSON.parse(fs.readFileSync(sp, "utf8"));
  const parsed = C.StyleSpecSchema.safeParse(raw);   // ⚠️ 原生 zod：判据是 `success`，不是本仓自己的 `ok`
  const NEEDED = ["identity", "shapeLanguage", "material", "constraints", "palette"];
  const missing = NEEDED.filter((k) => !(k in raw));
  console.log(`   ② authoring/stylespec.json：过 StyleSpecSchema = ${parsed.success ? "✅ 过" : "❌ 不过 " + parsed.error.message}` +
    ` · reviewPack 要的 5 个键缺 ${missing.length ? missing.join(" ") : "0 个"}`);

  // ③ 拿假 fetch 截下请求体 —— 一次真调用要发出去多少
  let captured = null;
  const spy = async (url, init) => { captured = { url, body: init.body }; return new Response(JSON.stringify({ content: [{ type: "text", text: "（假的上游）" }] }), { status: 200, headers: { "content-type": "application/json" } }); };
  const r = await A.reviewPack({ packDir, style: raw, baseUrl: "http://localhost", apiKey: "x", fetchImpl: spy });
  const b = JSON.parse(captured.body);
  const img = b.messages[0].content.find((c) => c.type === "image");
  const txt = b.messages[0].content.find((c) => c.type === "text");
  console.log(`   ③ 真发一次会发出去：POST ${captured.url} · model \`${b.model}\` · 请求体 ${captured.body.length} 字节`);
  console.log(`        其中 base64 图 ${img.source.data.length} 字节（${(img.source.data.length/1024).toFixed(0)}KB）· 提示词 ${txt.text.length} 字节 · ok=${r.ok}`);
  console.log("");
}

// ── ④ ⭐ **原图在不在包里** —— 它决定「落点选 packDir 还是 runDir」 ──────────────
const RAW = path.resolve(ROOT, ".scratch/game-maker-v2/experiments/e2e-wasteland/raw");
console.log("═══ ④ 原图（票 22 要喂的那张）够不够得着 ═══\n");
for (const run of ["run-out-2026-10-13e", "run-out-2026-10-13h"]) {
  const gid = path.join(RAW, run, "ruined-city-scavenger");
  if (!fs.existsSync(gid)) { console.log(`   （盘上没有 ${run}）`); continue; }
  const runDir = path.join(gid, "run", "v1");
  const packV = fs.readdirSync(path.join(gid, "pack")).sort().pop();
  const packDir = path.join(gid, "pack", packV);
  const vws = JSON.parse(fs.readFileSync(path.join(packDir, "authoring", "visual-world.json"), "utf8"));
  const ref = vws.styleReferences?.[0]?.path;
  const inPack = fs.existsSync(path.join(packDir, "authoring", ref));
  const inRun = fs.existsSync(path.join(runDir, ref));
  const size = inRun ? fs.statSync(path.join(runDir, ref)).size : 0;
  const pngs = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const q = path.join(d, e.name); if (e.isDirectory()) walk(q); else if (e.name.endsWith(".png")) pngs.push(path.relative(packDir, q)); } };
  walk(packDir);
  console.log(`   ${run}（${packV}）`);
  console.log(`      包里那份 authoring/visual-world.json 指向 : \`${ref}\``);
  console.log(`      那个路径在 **包里** 存在吗                : ${inPack ? "✅ 在" : "❌ **不在（悬空）**"}`);
  console.log(`      那个路径在 **run 目录里** 存在吗           : ${inRun ? `✅ 在（${size} 字节）` : "❌ 不在"}`);
  console.log(`      包里 ${pngs.length} 张 png 里有参考图吗      : ${pngs.some((x) => x.includes("style") || x.includes("reference")) ? "有" : "❌ **没有** —— 全是交付图集与生成物"}`);
  console.log("");
}
console.log("⇒ 读出来的：**对 packDir 跑，原图够不着；对 runDir 跑（或额外给一个图路径）才够得着。**");

console.log("");
console.log("⇒ 读出来的：**「一次视觉调用」的代价 = 上面 ③ 那个请求体**（图占绝大部分）；");
console.log("   而 ① 与 ② 都是**免费的纯函数**（零网络），可以随便跑。");
