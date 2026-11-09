#!/usr/bin/env node
// I00-03 只读取证脚本：Hazard 运动相位与时间起点。
//
// 两件事：
//   1) 把证据文件里引用的**每个** `file:line` 锚点读出来，断言该行仍然是那句话
//      —— 行号漂移 / 代码被改，脚本当场报 FAIL（而不是证据文件悄悄过期）。
//   2) 只读扫描语料里带 `motion` 的 hazard，给出「一帧 delta 折成相位」的量级。
//
// ⚠️ 只读：不写任何产品目录，不联网，不装依赖。
// 用法：node .scratch/level-playability-v1.1-integration/scripts/phase-origin-probe.mjs [--json]
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "../../..");   // scripts → integration → .scratch → repo root

const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const lines = (rel) => read(rel).split("\n");

/** 锚点表：rel + 1-based 行号 + 该行必须包含的片段（去首尾空白后）。 */
const ANCHORS = [
  // ── 契约：Motion 没有 phase 字段 ──────────────────────────────────────
  ["packages/contracts/src/game-config.ts", 79, "export const Motion = z.object({"],
  ["packages/contracts/src/game-config.ts", 80, 'kind: z.literal("cycle"),'],
  ["packages/contracts/src/game-config.ts", 81, 'axis: z.enum(["x", "y"]),'],
  ["packages/contracts/src/game-config.ts", 83, "distance: z.number().int().positive(),"],
  ["packages/contracts/src/game-config.ts", 84, "periodMs: z.number().int().positive(),"],
  ["packages/contracts/src/game-config.ts", 85, "}).strict();"],
  ["packages/contracts/src/game-config.ts", 117, "at: Point,"],
  ["packages/contracts/src/game-config.ts", 122, "motion: Motion.optional(),"],

  // ── 纯函数：三角波从 t=0 起算 ─────────────────────────────────────────
  ["packages/demo/src/hazard.ts", 14, "export function hazardAnchor(start: number, distance: number, periodMs: number, elapsedMs: number): number {"],
  ["packages/demo/src/hazard.ts", 16, "const phase = (((elapsedMs % periodMs) + periodMs) % periodMs) / periodMs;"],
  ["packages/demo/src/hazard.ts", 18, "return start + k * distance;"],
  ["packages/demo/src/hazard.ts", 28, 'export function dangerState(periodMs: number, activeMs: number, elapsedMs: number): "idle" | "active" {'],

  // ── 外壳：t0 在 create 置 0，update 里累加 delta ──────────────────────
  ["packages/demo/src/shell/scene.ts", 40, "create(): void {"],
  ["packages/demo/src/shell/scene.ts", 58, "this.addPlayer();"],
  ["packages/demo/src/shell/scene.ts", 61, "for (const e of world.entities) this.addEntity(e);"],
  ["packages/demo/src/shell/scene.ts", 79, "update(_time: number, delta: number): void {"],
  ["packages/demo/src/shell/scene.ts", 80, "this.advanceHazards(delta);"],
  ["packages/demo/src/shell/scene.ts", 161, "t0: 0, hits: 0 };"],
  ["packages/demo/src/shell/scene.ts", 272, "h.t0 += delta;"],
  ["packages/demo/src/shell/scene.ts", 276, "const p = hazardAnchor(h.start, h.distance, h.periodMs, h.t0);"],
  ["packages/demo/src/shell/scene.ts", 289, "d.t += delta;"],

  // ── 入口：没有覆盖 fps / visibility 配置 ──────────────────────────────
  ["packages/demo/src/shell/entry.ts", 75, "new Phaser.Game({"],

  // ── Phaser：delta 平滑与 clamp ────────────────────────────────────────
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 99, "this.minFps = GetValue(config, 'min', 5);"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 113, "this.targetFps = GetValue(config, 'target', 60);"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 174, "this._min = 1000 / this.minFps;"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 435, "this.smoothStep = GetValue(config, 'smoothStep', true);"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 573, "delta = Math.min(delta, this._target);"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 576, "if (delta > this._min)"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 584, "delta = Math.min(delta, this._min);"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 717, "var delta = Math.max(0, time - this.lastTime);"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 726, "delta = this.smoothDelta(delta);"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 739, "this.callback(time, delta);"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 468, "pause: function ()"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 470, "this._pauseTime = window.performance.now();"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 479, "resume: function ()"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 481, "this.resetDelta();"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 513, "this._coolDown = this.panicMax;"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 535, "for (var i = 0; i < this.deltaSmoothingMax; i++)"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 537, "this.deltaHistory[i] = this._target;"],
  ["packages/demo/node_modules/phaser/src/core/TimeStep.js", 540, "this.resetDelta();"],

  // ── Phaser：可见性 / 帧循环 / 场景调度 ───────────────────────────────
  ["packages/demo/node_modules/phaser/src/core/VisibilityHandler.js", 28, "if (document.hidden !== undefined)"],
  ["packages/demo/node_modules/phaser/src/core/VisibilityHandler.js", 53, "if (document.hidden || event.type === 'pause')"],
  ["packages/demo/node_modules/phaser/src/core/VisibilityHandler.js", 68, "window.onblur = function ()"],
  ["packages/demo/node_modules/phaser/src/core/Game.js", 449, "eventEmitter.on(Events.HIDDEN, this.onHidden, this);"],
  ["packages/demo/node_modules/phaser/src/core/Game.js", 481, "if (this.isPaused)"],
  ["packages/demo/node_modules/phaser/src/core/Game.js", 592, "this.loop.pause();"],
  ["packages/demo/node_modules/phaser/src/core/Game.js", 631, "this.loop.resume();"],
  ["packages/demo/node_modules/phaser/src/core/Game.js", 498, "this.scene.update(time, delta);"],
  ["packages/demo/node_modules/phaser/src/core/Game.js", 514, "this.scene.render(renderer);"],
  ["packages/demo/node_modules/phaser/src/scene/Systems.js", 362, "events.emit(Events.UPDATE, time, delta);"],
  ["packages/demo/node_modules/phaser/src/scene/Systems.js", 364, "this.sceneUpdate.call(this.scene, time, delta);"],
  ["packages/demo/node_modules/phaser/src/scene/SceneManager.js", 566, "if (sys.settings.status > CONST.START && sys.settings.status <= CONST.RUNNING)"],
  ["packages/demo/node_modules/phaser/src/scene/SceneManager.js", 641, "settings.status = CONST.RUNNING;"],
  ["packages/demo/node_modules/phaser/src/physics/arcade/ArcadePhysics.js", 142, "eventEmitter.on(SceneEvents.UPDATE, this.world.update, this.world);"],
  ["packages/demo/node_modules/phaser/src/loader/LoaderPlugin.js", 945, "this.systems.events.on(SceneEvents.UPDATE, this.update, this);"],
  ["packages/demo/node_modules/phaser/src/loader/LoaderPlugin.js", 1155, "this.emit(Events.COMPLETE, this, this.totalComplete, this.totalFailed);"],

  // ── 现有审计：移动 hazard 今天怎么被处理 ─────────────────────────────
  ["packages/contracts/src/playability/mechanic.ts", 117, "const movingHazards = allHazards.filter((e) => e.motion);"],
  ["packages/contracts/src/playability/mechanic.ts", 119, 'if (movingHazards.length > 0) addGap("moving-hazard-phase");'],
  ["packages/contracts/src/playability/completion.ts", 149, "resetBoxes.push(entity.motion ? sweptBox(geometry.box, entity.motion) : geometry.box);"],
  ["packages/contracts/src/playability/completion.ts", 352, "function sweptBox(box: Aabb, motion: Motion): Aabb {"],
  ["packages/contracts/src/playability/profile.ts", 57, 'solidMotion: "static-origin",'],
];

const results = [];
let fail = 0;
for (const [rel, n, needle] of ANCHORS) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) { results.push({ rel, line: n, ok: false, why: "missing file" }); fail++; continue; }
  const ls = lines(rel);
  const text = (ls[n - 1] ?? "").trim();
  const ok = text.includes(needle);
  if (!ok) {
    // 行号漂移时给出真实位置，方便修证据而不是猜
    const hit = ls.findIndex((l) => l.includes(needle));
    results.push({ rel, line: n, ok, actual: text.slice(0, 140), needle, foundAt: hit >= 0 ? hit + 1 : null });
    fail++;
  } else {
    results.push({ rel, line: n, ok });
  }
}

// ── 语料扫描：带 motion 的 hazard ────────────────────────────────────────
const ROOTS = ["out", "fixtures", ".scratch", "packages/demo/fixtures"];
const files = [];
const collect = (d) => {
  let ents;
  try { ents = readdirSync(join(ROOT, d), { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const rel = join(d, e.name);
    if (e.isDirectory()) collect(rel);
    else if (e.name.endsWith(".json")) files.push(rel);
  }
};
for (const r of ROOTS) if (existsSync(join(ROOT, r))) collect(r);

const byHash = new Map();
for (const f of files) {
  let j;
  try { j = JSON.parse(readFileSync(join(ROOT, f), "utf8")); } catch { continue; }
  if (!j || typeof j !== "object") continue;
  if (j.format !== "game-config/v1" && j.format !== "game-maker/game-config@1") continue;
  if (!Array.isArray(j.entities) || !j.world?.size) continue;
  const h = createHash("sha256").update(JSON.stringify(j)).digest("hex");
  if (!byHash.has(h)) byHash.set(h, { file: f, cfg: j });
}

const moving = [];
const hazards = [];
for (const { file, cfg } of byHash.values()) {
  for (const e of cfg.entities) {
    if (e.kind !== "hazard") continue;
    hazards.push(e.id);
    if (e.motion) moving.push({ file, id: e.id, at: e.at, distance: e.motion.distance, periodMs: e.motion.periodMs, axis: e.motion.axis, kind: e.motion.kind });
  }
}

const FRAME = 1000 / 60;      // 目标帧
const CAP = 1000 / 5;         // minFps=5 ⇒ 单帧 delta 上界
const phaseStats = moving.map((m) => ({
  id: m.id,
  file: m.file,
  distance: m.distance,
  periodMs: m.periodMs,
  pxPerMs: (2 * m.distance) / m.periodMs,
  phaseFracOneFrame: FRAME / m.periodMs,
  phaseFracCapFrame: CAP / m.periodMs,
  pxOneFrame: ((2 * m.distance) / m.periodMs) * FRAME,
  pxCapFrame: ((2 * m.distance) / m.periodMs) * CAP,
}));

const head = (() => { try { return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT }).toString().trim(); } catch { return null; } })();
const status = (() => { try { return execFileSync("git", ["status", "--porcelain", "packages", "fixtures", "docs"], { cwd: ROOT }).toString().trim(); } catch { return null; } })();

const report = {
  script: "phase-origin-probe.mjs",
  at: new Date().toISOString(),
  node: process.version,
  repoHead: head,
  productDirty: status,
  anchors: { total: ANCHORS.length, failed: fail, results },
  corpus: {
    roots: ROOTS,
    jsonFiles: files.length,
    uniqueConfigs: byHash.size,
    hazards: hazards.length,
    movingHazards: moving.length,
    axisKinds: [...new Set(moving.map((m) => `${m.kind}/${m.axis}`))],
    distinctPeriods: [...new Set(moving.map((m) => m.periodMs))].sort((a, b) => a - b),
    phaseFracOneFrameRange: [
      Math.min(...phaseStats.map((p) => p.phaseFracOneFrame)),
      Math.max(...phaseStats.map((p) => p.phaseFracOneFrame)),
    ],
    phaseFracCapFrameRange: [
      Math.min(...phaseStats.map((p) => p.phaseFracCapFrame)),
      Math.max(...phaseStats.map((p) => p.phaseFracCapFrame)),
    ],
    phaseStats,
  },
};

if (process.argv.includes("--json")) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
} else {
  console.log(`anchors: ${ANCHORS.length - fail}/${ANCHORS.length} ok`);
  for (const r of results) if (!r.ok) console.log(`FAIL ${r.rel}:${r.line} — 期望含 ${JSON.stringify(r.needle)}；实际 ${JSON.stringify(r.actual)}${r.foundAt ? `（真实行 ${r.foundAt}）` : ""}`);
  console.log(`corpus: json=${files.length} configs=${byHash.size} hazards=${hazards.length} moving=${moving.length}`);
  for (const p of phaseStats)
    console.log(`  ${p.id}: period=${p.periodMs}ms dist=${p.distance}px v=${p.pxPerMs.toFixed(4)}px/ms  1帧=${p.pxOneFrame.toFixed(2)}px(${(p.phaseFracOneFrame * 100).toFixed(3)}%周期)  200ms=${p.pxCapFrame.toFixed(1)}px(${(p.phaseFracCapFrame * 100).toFixed(2)}%周期)`);
  console.log(`repoHead=${head} productDirty=${status === "" ? "(empty)" : JSON.stringify(status)}`);
}
process.exit(fail === 0 ? 0 : 1);
