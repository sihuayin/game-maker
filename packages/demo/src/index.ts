// 产物 B：**固定 runtime 外壳**（票 44）+ 站点构建器（票 33）。
//
// ⚠️ 这里只导出**纯层**（`world.ts`）—— 它零 DOM、零 Phaser，可以在 vitest 里零浏览器地测。
//   渲染层与入口在 `src/shell/`，由 esbuild 单独打成 `dist/shell.js`，**不走这个入口**
//   （那样才能让「纯层不许碰 DOM」变成**结构上的**事实，而不是一句约定）。
export { assembleSite, auditGeometry, type SiteOptions } from "./site.js";
export { assembleFromConfig, detectFormat, defaultShellPath, CONFIG_FILE_NAME, KNOWN_FORMATS, type AssembleOptions } from "./assemble.js";
export { assembleTdSite, auditTdGeometry, type TdSiteOptions } from "./td/site.js";
export { buildTdWorld, pathPointAt, type TdWorldDescription, type TdTowerDesc, type TdEnemyDesc, type TdWaveDesc, type TdTile, type TdHudButton } from "./td/world.js";
export { playReference, auditWinnable, type ReferenceRun } from "./td/winnable.js";
export { createSim, advance, autoPlay, simSnapshot, enemyPos, FIXED_DT_MS, MAX_FRAME_MS, type TdState, type TdAction, type SimEnemy, type SimTower } from "./td/sim.js";
export {
  buildWorld, formatIssue, SHELL_VERSION, VIEWPORT,
  type AtlasToLoad, type BackgroundLayer, type Box, type Draw, type Drawn, type EntityDesc,
  type HudDesc, type Issue, type Missing, type PlayerDesc, type Size, type Vec, type WorldDescription,
} from "./world.js";
// ⚠️ `draw.ts` 那几样也一并露出来 —— 塔防与横版共用它们，两个壳（CLI / MCP）
//   与外壳都要拿得到**同一份**，而不是各写一个「差不多」的。
export {
  BACKDROP, FALLBACK_ANCHOR, HUD_LINE_HEIGHT, anchorOf, assetSize, atlasList, boxAt, boxToXYWH, resolveDraw, type ShellBase,
} from "./draw.js";
