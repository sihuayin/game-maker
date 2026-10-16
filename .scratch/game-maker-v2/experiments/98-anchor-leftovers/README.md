# 票 98 · 探针（零付费 · 零网络 · 只读已构建的 `dist`）

| 脚本 | 量什么 | 用法 |
| --- | --- | --- |
| `skeleton-panel-at.mjs` | 骨架 `hud.panel` 那一格（旧数 `(8,262)` / 新数 `(72,238)`）在**九种锚点**下各自的盒子，用本仓自己的 `entityBox` + `auditScreenSpace`（视口 480×270） | `node skeleton-panel-at.mjs` |
| `dump-anchor-mentions.mjs` | ① 与 ④ **渲染出来的**文本里「锚点」出现在哪 —— 用的是真 design ＋ 真 world（13e 落盘那一份） | `node dump-anchor-mentions.mjs` |

⚠️ 两个都读 `packages/*/dist`（**不是** `src`）—— 改完 `src` 不 `tsc -b` 就重跑，读到的还是旧代码（本仓反复咬人的那个陷阱）。
