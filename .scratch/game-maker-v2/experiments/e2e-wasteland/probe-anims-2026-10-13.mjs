// 免费、只读：拿**真包**去问 auditGameConfig —— 「player.anims 三格都指向同一个动画名」到底过不过？
import fs from "node:fs";
import { pathToFileURL } from "node:url";
const C = await import(pathToFileURL("/Volumes/shy/some-projects/game-maker/packages/contracts/dist/index.js").href);
const PACK = "/Volumes/shy/some-projects/game-maker/.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13e/ruined-city-scavenger/pack/v1";
const manifest = JSON.parse(fs.readFileSync(PACK + "/manifest.json", "utf8"));

const mk = (playerAsset, anims) => ({
  format: "game-config/v1",
  world: { size: { w: 1440, h: 270 } },
  scene: { background: { asset: "bg-ruined-street" } },
  player: { asset: playerAsset, anims, at: { x: 40, y: 250 } },
  terrain: [{ x: 0, y: 250, w: 1440, h: 20 }],
  entities: [
    { id: "scrap-1", kind: "pickup", at: { x: 300, y: 250 }, asset: "scrap" },
    { id: "gate", kind: "goal", at: { x: 1400, y: 250 }, asset: "exit-gate" },
  ],
  hud: { panel: { asset: "hud-bar-backdrop", at: { x: 8, y: 262 }, size: { w: 72, h: 32 } },
         pip: { asset: "hud-scrap-icon", at: { x: 12, y: 250 }, step: { x: 20, y: 0 } } },
  objective: { kind: "collect-then-reach", gate: "gate" },
});

for (const [label, cfg] of [
  ["甲 · 模型实际写的：asset=player-scavenger(sprite), anims 三个真名", mk("player-scavenger", { idle: "idle", run: "run", jump: "jump" })],
  ["乙 · 「三格都指向同一个已有动画名」", mk("player-walk", { idle: "walk", run: "walk", jump: "walk" })],
  ["丙 · asset=player-walk，但三个名字照骨架字面填", mk("player-walk", { idle: "idle", run: "run", jump: "jump" })],
]) {
  const ok = C.parseGameConfig(cfg);
  if (!ok.ok) { console.log(`${label}\n   ❌ 连契约都没过：${ok.errors.slice(0,2).join("；")}\n`); continue; }
  const issues = C.auditGameConfig(ok.value, manifest);
  const hard = issues.filter((i) => i.severity === "error");
  const playerish = hard.filter((i) => /^player/.test(i.where));
  console.log(`${label}\n   硬失败 ${hard.length} 条 · 其中 player 族 ${playerish.length} 条`);
  for (const i of playerish) console.log(`      · ${i.where}: ${i.message}`);
  for (const i of hard.filter((i) => !/^player/.test(i.where))) console.log(`      （非 player）· ${i.where}: ${i.message.slice(0,80)}`);
  console.log("");
}
