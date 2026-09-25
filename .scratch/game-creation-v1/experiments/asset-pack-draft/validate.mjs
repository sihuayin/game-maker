// 用**已落地的契约**（packages/contracts）校验刚生成的包。
//
// 早先这里有一份 schema.mjs 草案。它已经落进 packages/contracts/src/assetpack.ts 了 ——
// 两份并存的 schema 必然漂移，所以草案已删除，这里改成 import 真契约。
// 反例测试（9 条）也搬进了 packages/contracts/tests/assetpack.test.ts。
//
//   pnpm build && node validate.mjs
import fs from "node:fs";
import path from "node:path";
const CONTRACT = "../../../../packages/contracts/dist/index.js";
const { parseAssetPack } = await import(CONTRACT);
const p = path.join(process.argv[2] || "out/dystopian-shop/v1", "manifest.json");
const r = parseAssetPack(JSON.parse(fs.readFileSync(p, "utf8")));
if (!r.ok) { console.log("❌ 真实包没通过契约校验："); for (const e of r.errors) console.log("   " + e); process.exit(1); }
const m = r.value;
console.log(`✅ ${p} 通过 assetpack/v1 校验（${m.assets.length} resources / ${m.atlases.length} atlases / ${m.files.length} files）`);
console.log(`   provenance.mode=${m.provenance.mode} · palette coverage=${JSON.stringify(m.palette.coverage)}`);
