// 产物 B：**固定 runtime 外壳**（票 44）+ 站点构建器（票 33）。
//
// ⚠️ 这里只导出**纯层**（`world.ts`）—— 它零 DOM、零 Phaser，可以在 vitest 里零浏览器地测。
//   渲染层与入口在 `src/shell/`，由 esbuild 单独打成 `dist/shell.js`，**不走这个入口**
//   （那样才能让「纯层不许碰 DOM」变成**结构上的**事实，而不是一句约定）。
export { assembleSite, auditGeometry, type SiteOptions } from "./site.js";
export {
  buildWorld, formatIssue, SHELL_VERSION, VIEWPORT,
  type AtlasToLoad, type BackgroundLayer, type Box, type Draw, type Drawn, type EntityDesc,
  type HudDesc, type Issue, type Missing, type PlayerDesc, type Size, type Vec, type WorldDescription,
} from "./world.js";
