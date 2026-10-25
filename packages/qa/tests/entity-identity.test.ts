// entity-identity-v1 票 05 §6.2 集成：PRD 五实体 fixture 走通「设计 → config → VDS」身份链。
//
// ⚠️ 这份是**手搓的小对象**（PRD 那份五个名字的 fixture），不是真产物 —— 它专测**身份一致性**：
//   ① `auditEntityIdentity`（编译期，设计↔config）零 error；② `visualConfigCoherence`（QA，VDS↔config）
//   零 error。1:N（scrap-resource → 2 个 pickup）与孤儿（block / gate）都在里面。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { auditEntityIdentity, type GameConfig, type GameDesignSpec } from "@game-maker/contracts";
import { visualQaRunner } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const RECIPE = path.join(ROOT, "fixtures/recipes/last-train.json");

/** PRD §6.2 的五个实体：player / enemy-wasteland / chest-ruined-city / hazard-spike-rubble / scrap-resource。 */
const DESIGN = {
  format: "game-design/v1",
  game: { title: "废土拾荒", genre: "platformer", camera: "side", runtimeProfile: { id: "platformer", version: "1" } },
  coreLoopSteps: ["跑", "跳", "捡"],
  player: { id: "player", role: "拾荒者", abilities: ["跑", "跳"], goals: ["捡齐废料"] },
  enemies: [{ id: "enemy-wasteland", behavior: "巡逻", threat: "碰伤" }],
  npcs: [],
  interactables: [
    { id: "chest-ruined-city", type: "宝箱", behavior: "打开得废料" },
    { id: "hazard-spike-rubble", type: "尖刺", behavior: "碰到扣血" },
  ],
  resources: [{ id: "scrap-resource", purpose: "可拾取废料" }],
  world: { theme: "废墟城市", setting: "废土", structure: "三条横带" },
  levels: [{ id: "level-1", purpose: "唯一一关", layout: "左到右", entities: ["enemy-wasteland", "chest-ruined-city", "hazard-spike-rubble", "scrap-resource"] }],
  progression: { model: "linear", description: "一关到底" },
  mechanics: [{ id: "m-jump", mechanic: "jump" }],
  winConditions: ["捡齐废料"], loseConditions: [],
  runtimeRequirements: ["input:keyboard"],
};

/** 一份对应 config：1:1（enemy / chest / hazard）+ 1:N（scrap-resource → 2 pickup）+ 孤儿（block / gate）。 */
const CONFIG = {
  format: "game-config/v1",
  world: { size: { w: 1440, h: 270 } },
  scene: { background: { asset: "bg-dusk-halt" } },
  player: { asset: "player-traveler", anims: { idle: "idle", run: "run", jump: "jump" }, at: { x: 40, y: 250 } },
  terrain: [{ x: 0, y: 250, w: 1440, h: 20 }],
  entities: [
    { id: "enemy-wasteland", sourceIntent: "enemy-wasteland", kind: "hazard", at: { x: 500, y: 230 }, asset: "hazard-sweeping-carriage", anim: "sweep", motion: { kind: "cycle", axis: "x", distance: 200, periodMs: 4000 } },
    { id: "chest-ruined-city", sourceIntent: "chest-ruined-city", kind: "chest", at: { x: 700, y: 230 }, asset: "pickup-suitcase" },
    { id: "hazard-spike-rubble", sourceIntent: "hazard-spike-rubble", kind: "hazard", at: { x: 900, y: 230 }, asset: "hazard-sweeping-carriage", anim: "sweep" },
    { id: "scrap-resource-1", sourceIntent: "scrap-resource", kind: "pickup", at: { x: 300, y: 230 }, asset: "pickup-suitcase" },
    { id: "scrap-resource-2", sourceIntent: "scrap-resource", kind: "pickup", at: { x: 400, y: 230 }, asset: "pickup-suitcase" },
    { id: "block", kind: "solid", at: { x: 200, y: 230 }, asset: "prop-luggage-pile" },
    { id: "gate", kind: "goal", at: { x: 1300, y: 230 }, asset: "signal-endlight", anim: "red" },
  ],
  hud: { panel: { asset: "hud-lost-slots", at: { x: 8, y: 262 }, size: { w: 72, h: 32 } }, pip: { asset: "hud-pip", at: { x: 12, y: 250 }, step: { x: 20, y: 0 } } },
  objective: { kind: "collect-then-reach", gate: "gate" },
};

/** 一份对应 VDS：每个四桶设计实体一个 object（sourceIntent = 设计 id）+ background 装饰。 */
const VDS = {
  format: "visual-design/v1", viewport: { w: 480, h: 270 },
  style: { visualWorldFormat: "visual-world/v1" },
  objects: [
    { id: "background", role: "background", bounds: { x: 0, y: 0, w: 480, h: 270 }, layer: 0, fill: "palette:0" },
    { id: "enemy-wasteland", role: "hazard", bounds: { x: 100, y: 200, w: 56, h: 64 }, layer: 10, fill: "palette:1", sourceIntent: "enemy-wasteland" },
    { id: "chest-ruined-city", role: "chest", bounds: { x: 200, y: 210, w: 32, h: 24 }, layer: 10, fill: "palette:2", sourceIntent: "chest-ruined-city" },
    { id: "hazard-spike-rubble", role: "hazard", bounds: { x: 300, y: 210, w: 32, h: 32 }, layer: 10, fill: "palette:3", sourceIntent: "hazard-spike-rubble" },
    { id: "scrap-resource", role: "pickup", bounds: { x: 400, y: 210, w: 16, h: 16 }, layer: 10, fill: "palette:4", sourceIntent: "scrap-resource" },
  ],
};

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });
const write = (dir: string, name: string, body: unknown): void =>
  fs.writeFileSync(path.join(dir, name), JSON.stringify(body, null, 2) + "\n");

function stage(): { runDir: string; packDir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gm-entity-id-"));
  dirs.push(dir);
  const runDir = path.join(dir, "run");
  const packDir = path.join(dir, "pack");
  fs.mkdirSync(runDir, { recursive: true });
  fs.cpSync(PACK, packDir, { recursive: true });
  fs.copyFileSync(RECIPE, path.join(runDir, "asset-recipe.json"));
  write(runDir, "game-config.json", CONFIG);
  write(runDir, "game-design.json", DESIGN);
  write(runDir, "visual-design.json", VDS);
  return { runDir, packDir };
}

describe("§6.2 集成：PRD 五实体全链身份一致", () => {
  it("① 编译期 `auditEntityIdentity`：coverage 全、无悬空、孤儿合法 ⇒ 零 error", () => {
    expect(auditEntityIdentity(DESIGN as unknown as GameDesignSpec, CONFIG as unknown as GameConfig)).toEqual([]);
  });

  it("② QA `visualConfigCoherence`：VDS sourceIntent ↔ config sourceIntent 一一关联 ⇒ 无身份 error", async () => {
    const { runDir, packDir } = stage();
    const r = await visualQaRunner({
      runDir, packDir, gameId: "last-train", viewport: { w: 480, h: 270 },
      recipePath: path.join(runDir, "asset-recipe.json"),
      configPath: path.join(runDir, "game-config.json"),
      intentPath: path.join(runDir, "game-intent.json"),
      designPath: path.join(runDir, "game-design.json"),
      vdsPath: path.join(runDir, "visual-design.json"),
    });
    const coherence = r.judgements["visual-config-coherence"];
    if (coherence === undefined || coherence.ran !== true) throw new Error("visual-config-coherence 没跑");
    expect(coherence.findings.filter((f) => f.severity === "error")).toEqual([]);
  });

  it("③ 反例：把 scrap-resource 的 sourceIntent 摘掉 ⇒ 编译期报 coverage 缺", () => {
    const broken = JSON.parse(JSON.stringify(CONFIG)) as GameConfig;
    for (const e of broken.entities) if (e.sourceIntent === "scrap-resource") delete e.sourceIntent;
    expect(auditEntityIdentity(DESIGN as unknown as GameDesignSpec, broken).map((i) => i.message).join())
      .toMatch(/scrap-resource.*没有对应实体/);
  });
});
