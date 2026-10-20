# 01. 把最终资源包集成进本地可玩站点

Type: task
Status: open
Owner: —
Blocked by: —
Map: ../map.md
> 派生自 style-migration-v1 的最终包。
> ⚠️ 本票只批准**免费搜索 / 本地装配**；`compile-runtime` 若走文本上游，须先出预算 + 逐字点头。

## Question

用最终包 + 原始设计，走 `compile-runtime` / `site`，启动一个本地站点，确认资源在真实外壳里可见。

- 先**免费**找现成的 `game-config`（原 run / `out/` / 旧站点），能复用就不发文本上游。
- 若必须 `compile-runtime`：它需要 `ANTHROPIC_BASE_URL` / `AUTH_TOKEN` 与**一次文本调用**
  （可能 1–3 发，0 张图）；先出书面预算报告 + 逐字点头，再发。
- 站点根目录按 CLI 警告：HTTP server 的根必须是 `<out>/<gameId>/`，不是 `site/` 内部。

## 验收

- 本地站点能打开；资源（动画 / 精灵 / 背景 / UI）在场景中可见，或明确说明为什么不可见。
- 截图 / URL / 使用的 config 路径落盘。
- 0 张生图；文本调用（若有）逐笔记账。

## 边界

- 不改 `game-maker.local.json`；不改包内容；不跑生图。
- 文本上游的付费动作须单独点头；本票不预授权。

## Comments

### 2026-10-20 · 免费搜索：没有现成 config

- 扫了 `out/` 与 `.scratch/` 下的 `game-config*.json`：找到的都属于 `last-train` / probe 等，
  **没有**与 `runs/2026-10-18d/ruin-scavenger-extraction-assets/run/v1/game-design.json`
  （残城拾荒）或最终包匹配的 `game-config`。
- ⇒ 站点集成要么走 `compile-runtime`（文本上游 1–3 发、0 张图，需书面预算 + 逐字点头），
  要么手写一份 config（零上游，但要按最终包的 19 个资源逐项对）。
- 本票仍 **未发任何上游请求**。
