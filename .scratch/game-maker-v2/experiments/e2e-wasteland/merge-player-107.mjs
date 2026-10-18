// 票 107：把玩家专用包（v1）的 8 帧贴回 v1 包的 animations 图集，产出合包 v2。
// 敌人帧与背景/道具/UI 图集逐字节不动；manifest / ledger / master-ratios / coverage 跟着更新。
// 跑法：node merge-player-107.mjs base=<v1 pack> player=<player-only pack> out=<pack/v2>
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
// ⚠️ 先 `pnpm build`（脚本读 dist）。
import { pathToFileURL } from "node:url";
const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const A = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/index.js")).href);
const C = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);
const { decodePNG, encodePNG, verifyPack } = A;
const { parseAssetPack } = C;
const args = Object.fromEntries(process.argv.slice(2).map((a) => { const i = a.indexOf("="); return [a.slice(0, i), a.slice(i + 1)]; }));
const BASE = args.base, PLAYER = args.player, OUT = args.out;
if (!BASE || !PLAYER || !OUT) throw new Error("usage: node merge.mjs base=<v1 pack> player=<player-only pack> out=<v2 pack dir>");
const sha = (p) => "sha256:" + createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(BASE, OUT, { recursive: true });

// 1) 把玩家帧贴回 v1 的 animations 图集（敌人帧 / 其它图集逐字节不动）
const baseAtlasPath = path.join(OUT, "delivery/atlas.animations.png");
const baseMeta = readJson(path.join(OUT, "delivery/atlas.animations.json"));
const playerAtlas = decodePNG(fs.readFileSync(path.join(PLAYER, "delivery/atlas.animations.png")));
const playerMeta = readJson(path.join(PLAYER, "delivery/atlas.animations.json"));
const atlas = decodePNG(fs.readFileSync(baseAtlasPath));
const paste = (dst, src, dx, dy) => {
  for (let y = 0; y < src.height; y++)
    src.data.copy(dst.data, ((dy + y) * dst.width + dx) * 4, y * src.width * 4, (y + 1) * src.width * 4);
};
const crop = (img, r) => {
  const out = { width: r.w, height: r.h, data: Buffer.alloc(r.w * r.h * 4) };
  for (let y = 0; y < r.h; y++) img.data.copy(out.data, y * r.w * 4, ((r.y + y) * img.width + r.x) * 4, ((r.y + y) * img.width + r.x + r.w) * 4);
  return out;
};
const playerFrames = Object.keys(playerMeta.frames);
for (const name of playerFrames) {
  const b = baseMeta.frames[name]?.frame;
  const p = playerMeta.frames[name]?.frame;
  if (!b || !p) throw new Error(`帧 "${name}" 在两边不齐`);
  if (b.w !== p.w || b.h !== p.h) throw new Error(`帧 "${name}" 尺寸不同：v1 ${b.w}x${b.h} vs 新 ${p.w}x${p.h}`);
  paste(atlas, crop(playerAtlas, p), b.x, b.y);
}
fs.writeFileSync(baseAtlasPath, encodePNG(atlas));

// 2) 拷玩家创作态（生成图 / 提示词 / 母版）
const copyIf = (rel) => {
  const s = path.join(PLAYER, rel);
  if (!fs.existsSync(s)) return false;
  fs.mkdirSync(path.dirname(path.join(OUT, rel)), { recursive: true });
  fs.copyFileSync(s, path.join(OUT, rel));
  return true;
};
const copied = [
  "authoring/generated/player-scavenger.idle.png", "authoring/generated/player-scavenger.idle.prompt.txt",
  "authoring/generated/player-scavenger.run.png", "authoring/generated/player-scavenger.run.prompt.txt",
  "authoring/generated/player-scavenger.jump.png", "authoring/generated/player-scavenger.jump.prompt.txt",
  "authoring/masters/master-player-scavenger.png", "authoring/masters/master-player-scavenger.prompt.txt",
  "authoring/masters/master-player-scavenger.ratio.json",
].filter(copyIf);
console.log("copied player authoring:", copied.length);

// 3) 母版比例：替换玩家那一行，敌人保留
const baseRatios = readJson(path.join(OUT, "master-ratios.json"));
const playerRatios = readJson(path.join(PLAYER, "master-ratios.json"));
baseRatios.packVersion = 2;
baseRatios.masters = [
  ...baseRatios.masters.filter((m) => m.master !== "master-player-scavenger"),
  ...playerRatios.masters.filter((m) => m.master === "master-player-scavenger"),
];
fs.writeFileSync(path.join(OUT, "master-ratios.json"), JSON.stringify(baseRatios, null, 2) + "\n");
// coverage 的 packVersion 也要跟着 v2
const covPath = path.join(OUT, "coverage.json");
if (fs.existsSync(covPath)) {
  const cov = readJson(covPath);
  cov.packVersion = 2;
  fs.writeFileSync(covPath, JSON.stringify(cov, null, 2) + "\n");
}

// 4) 账：旧玩家调用换成新玩家调用；其余旧调用原样保留
const baseLedger = readJson(path.join(OUT, "ledger.json"));
const playerLedger = readJson(path.join(PLAYER, "ledger.json"));
const isPlayer = (c) => c.target === "player-scavenger" || c.target === "master-player-scavenger";
baseLedger.calls = [...baseLedger.calls.filter((c) => !isPlayer(c)), ...playerLedger.calls];
baseLedger.packVersion = 2;
baseLedger.createdAt = new Date().toISOString();
// `run` 是严格对象：按合并后的 calls 重算 byStep；wallClock 记两段生产时间之和
const byStep = {};
for (const c of baseLedger.calls) {
  const b = (byStep[c.step] ??= { calls: 0, attempts: 0 });
  b.calls += 1; b.attempts += c.attempts ?? 0;
}
baseLedger.run = {
  wallClockMs: (baseLedger.run?.wallClockMs ?? 0) + (playerLedger.run?.wallClockMs ?? 0),
  byStep,
};
fs.writeFileSync(path.join(OUT, "ledger.json"), JSON.stringify(baseLedger, null, 2) + "\n");

// 5) manifest：版本 / 时间 / 图集 checksum / files[] 全量重算
const manPath = path.join(OUT, "manifest.json");
const man = readJson(manPath);
man.version = 2;
man.createdAt = new Date().toISOString();
man.generator = { ...man.generator, run: "107-player-redesign" };
const animAtlas = man.atlases.find((a) => a.id === "animations");
if (!animAtlas) throw new Error("manifest 里没有 animations 图集");
animAtlas.checksum = sha(baseAtlasPath);
const walk = (dir, root = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
  const p = path.join(dir, d.name);
  return d.isDirectory() ? walk(p, root) : [path.relative(root, p).split(path.sep).join("/")];
});
man.files = walk(OUT).filter((p) => p !== "manifest.json").sort().map((p) => ({
  path: p, bytes: fs.statSync(path.join(OUT, p)).size, checksum: sha(path.join(OUT, p)),
}));
fs.writeFileSync(manPath, JSON.stringify(man, null, 2) + "\n");

// 6) 校验
const check = parseAssetPack(readJson(manPath));
console.log("manifest", check.ok ? "ok" : check.errors.join(" / "));
const v = verifyPack({ packDir: OUT });
console.log("verify", JSON.stringify(v.summary ?? v).slice(0, 1200));
