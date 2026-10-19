# 17. 2.5 单行仍不守帧数/内容：逐帧生成 / 布局抢救 / 范围收缩

Type: grilling
Status: resolved
Owner: claude (2026-10-19 认领 · 人裁 A · 已施工、已关)
Blocked by: —
Map: ../map.md
> 派生自票 10 第三次真跑的失败（2026-10-19）：
> [失败报告](../report-10-real-single-row-failure-2026-10-19.md)。
> ⚠️ 本票只裁路线，不批准任何付费跑、不批准施工。

## Question

单行提示词让 8/6/3 帧的多数 sheet 变成一排（`run` 8×1 smoke 通过），但 4 帧仍画成两排，
且内容也漂：
- `idle` 4×1 → 4×2（8 个）；
- `hang` 4×1 → 1 倒挂 + 4 站立 + 格线/标签；
- `scrap-resource.idle` 4×1 → 5 个人类（spec 是废料）。

要裁：

- **A**：逐帧生成（61–66 次生图 ≈$2.38–2.57；需要管线施工）。
- **B**：布局抢救（裁顶排 / 复用已通过 sheet；只能救一部分）。
- **C**：再换竖向 1×4 / 1×3 网格（1 发 smoke；修不了主体错误）。
- **D**：换模型 / provider（JPEG 解码或 OpenAI；未知数大）。
- **E**：范围收缩（静物 / 背景 / UI + 已通过的动画）。

## 验收

- 一条明确裁定。
- 若选 A：施工另立票；先零付费 + 离线 fixture；完成后另出预算报告。
- 若选 B / E：明确交付边界与缺口。
- 若选 C：1 发 smoke 须逐字授权；只对排版问题有意义。

## 边界

- 不批准付费调用；不改 `game-maker.local.json`；不自动重跑 / 换模型 / 转码。
- 不放宽 sheet 的按格判据（要放宽必须另裁）。

## Answer

**人裁（2026-10-19 逐字）**：「裁 A：逐帧生成，先零付费施工 + 另出预算报告。」

### 裁定

**A · 逐帧生成**：`source.kind = "frames"` —— 每帧一次生图调用，不再要求模型「一图 N 帧」。

### 施工记录（零付费）

- `packages/contracts/src/recipe.ts`：新增 `FramesSource`（`{ kind: "frames" }`）进 `AssetSource`；
  契约判据：只用于 `animation`；**不许与 `animations[].sheet` 同时写**；母版不许用。
- `packages/contracts/src/recipe-tool.ts`：镜像形状同步。
- `packages/contracts/src/image-units.ts`：`imageCallsOf` 对 frames 源按 **帧数**计调用
  （检查点报的预计数必须等于真发数）。
- `packages/assets/src/prompt.ts`：新增 `animationFramePrompt`（单个角色 / 第 i 帧 / 共 N 帧；
  无网格 / 分隔线 / 编号 / 文字；侧视朝右；背景纯色）。
- `packages/assets/src/pack.ts`：`source.kind === "frames"` 分支 ——
  按 `framePlan` 一帧一个 unit、一次调用；每帧独立落盘 / 抠底 / 单帧判据；
  manifest 的 frames / animations 组装不变。
- 测试：契约（frames 计数、非法组合）、prompt（帧号 / 无网格）、
  新增 `pack-frames.test.ts`（2 帧 = 2 次调用、manifest 2 帧、原图逐帧落盘、`verifyPack` ok）。

### 五闸

| 闸 | 结果 |
| --- | --- |
| 全量测试 | ✅ **103 文件 / 1629 条**（+4） |
| `pnpm build` | ✅ |
| `pnpm typecheck` | ⚠️ 仅剩两条既有、与本票无关的红（`pack-sheet-grid.test.ts:150` · `prompt.test.ts:257`） |
| `check:deps` | ✅ 9 包 |
| `check:links` | ✅ 408 份文档 / 2143 条 |

### 边界

- 零上游、零付费；`game-maker.local.json` 未动；不改母版 / 网格 / 风格判据。
- 下一步：按 **61 帧 + 2 sprite + 3 背景 = 66 次生图**出预算报告（复用 3 个 import 母版；3 次文本）。
