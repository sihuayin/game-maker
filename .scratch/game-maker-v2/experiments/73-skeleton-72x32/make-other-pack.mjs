// 票 73 · 读数 ③：造一个**第二包**，好把「同一个骨架、换一个包」那一句**渲染出来看**。
//
// ⚠️ 为什么不能直接用真包：真实跑产物（`experiments/e2e-wasteland/raw/run-out-2026-10-13*`）
//   是 **`assetpack/v3`**，而今天的 `parseAssetPack` **只认 v4** ⇒ 渲染不出提示词。
//   ⇒ 这里拿夹具包 `fixtures/packs/last-train/v2`（v4）**改一份**：把那件 ui 面板换成
//   **13e 那一跑真量到的数**（`hud-bar-backdrop` · 32×16 · 锚点 {0.5,0.5} · 九宫格 {4,4,24,8}）。
// ⚠️ 它只写 /tmp，**不碰仓库里任何文件**。
// ⚠️ 用法：node make-other-pack.mjs  → 打印新包目录
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
const ROOT = path.resolve(new URL("../../../..", import.meta.url).pathname);
const src = path.join(ROOT, "fixtures/packs/last-train/v2");
const dst = fs.mkdtempSync(path.join(os.tmpdir(), "gm-p73-pack-"));
fs.cpSync(src, dst, { recursive: true });
const p = path.join(dst, "manifest.json");
let s = fs.readFileSync(p, "utf8").split("hud-lost-slots").join("hud-bar-backdrop");
const m = JSON.parse(s);
const a = m.assets.find((x) => x.id === "hud-bar-backdrop");
a.size = { w: 32, h: 16 };
a.anchor = { x: 0.5, y: 0.5 };
a.scale9Borders = { x: 4, y: 4, w: 24, h: 8 };
fs.writeFileSync(p, JSON.stringify(m, null, 2));
const C = await import(ROOT + "/packages/contracts/dist/index.js");
const ok = C.parseAssetPack(JSON.parse(fs.readFileSync(p, "utf8")));
if (!ok.ok) { console.error("造出来的包不过 schema：", ok.errors.slice(0, 3)); process.exit(1); }
console.log(dst);
