# 102. 票 101 的施工：两块碎块过滤（`>=3` guard → `>=2`）＋ 底部横带阈值 90 → 80

Type: task
Status: resolved
Owner: claude (2026-10-17 · 已认领；**已施工 · 已关 · 已提交** —— 授权逐字「施工 · 不提交」→「关票 + 提交」；施工记录在 `## 4 · 施工记录`，收口在 `## 收口`)
Blocked by: —
Map: ../map.md
> 派生自[票 101](101-two-box-speck-filter.md) 的 **Q1 = (a) · Q2 = (c) · Q3 · Q4**（人裁 2026-10-17，逐字表在票 101 的 `## Answer`）。
> ⚠️ **立票 ≠ 批准施工**（票 65 / 71 / 82 / 90 / 91 / 98 / 100 先例逐字沿用）：本票只是**施工载体**，
> 动手要**另一次独立点头**；关票与提交各自另算。
> ⚠️ 人裁本轮逐字：「**本轮仅完成裁定，不构成代码修改授权；没有执行回放、付费调用或提交。**」

## 1 · 射程（一个不多、一个不少）

| # | 文件 | 改什么 |
|---|---|---|
| ① | `packages/assets/src/sheet.ts:78` | `if (boxes.length >= 3)` → `if (boxes.length >= 2)`。**不许直接删守卫**：0 块时 `ws[Math.floor(0)]` 是 `undefined`，会对空数组做乘除。n=2 时现有 median 排序后取的是**较大块**（`ws[floor(2/2)] = ws[1]`），等价于「≥ 较大块的 40%」。**不新增墨面积判据。** |
| ② | `packages/assets/src/sheet.ts:98` ＋ `bottomBand` 文件头注释 | `minCover` 默认 `0.9` → **`0.8`**；`minRows` 保持 3；注释里凡写 90% 的同步改。**形状不变**：只认最底部 / ink 底边的连续有墨行，不扩展到画面中部。 |
| ③ | `packages/assets/src/pack.ts:852` 与 `:876` | 救援注释与失败报文里的「≥ 90%」→ **「≥ 80%」**。策略一字不改：只在**首次**数量不符时重试 · 裁的是**像素** · 重分块**正好 N 块**才接受 · `groundBands` 留痕。 |

**不改**：`segmentRow` 的其他默认（`minGap` / `minWidth` / `minInkRows`）· 画面中部的线检测 · 墨面积判据 · `fixtures/**` · R 表（R17）· `packages/qa` · `game-maker.local.json`。

## 2 · 验收（全部免费 · 人裁三条全要）

### ① 合成测试进仓库（`packages/assets/tests/pack-ground-band.test.ts` 或新文件）

1. **碎块 + 1 个真角色、spec 2** ⇒ 过滤后只剩 1 块 ⇒ **硬失败**（Q1 的见证）。
2. **合法双帧、宽度比 0.65** ⇒ **不误杀**，两帧都在。
3. **碎块 + 2 个真角色（3 块）** ⇒ 现有 median 过滤行为不变。
4. **底部横带 + 2 个分离角色** ⇒ 救援成功、输出 2 帧、`groundBands` 留痕。⚠️ 带子的覆盖率**不要取 100%**，取 **~85–88%**，否则证明不了「80% 阈值真的生效」。
5. **正常图** ⇒ 行为不变、无救援记录。
6. **负向对照 0.30** ⇒ 记录为**已知代价**的硬失败；**不列为必须通过的合法帧**。

⚠️ **先只加断言、源码一行不动 ⇒ 红；再改源码 ⇒ 绿**（票 94 / 98 / 100 那一招）。

### ② 13h 真图免费回放（`/tmp` 探针 · 不落库）

- 图：`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/pack/v1/authoring/generated/enemy-patroller.turn.png`
- 生产函数链：`dominantOpaqueColor` → `keyBackground` → `segmentRowCells` → `bottomBand` → `cropAboveBand` → 重分块。
- 断言：原始 **2 块** → 过滤后 **1 块** → 带子 **15 行 / 均值 88.5% / 每行 ≥85%** → 裁后 **2 个真角色**，几何 **`363×560`** 与 **`414×560`**。
- ⚠️ 不提交原始产物、不改 fixture。

### ③ 负向对照

- **0.65**：合法窄帧必须存活。
- **0.30**：记录为已知代价的硬失败，不要求通过。

## 3 · 边界

- **零付费真跑**；不重跑 13h / 17c；不买图。
- 施工授权与提交授权**分开**；本票 `Status: open`，动手要另一次逐字点头。
- 通行验收：全量测试 · `tsc -b --force` · `check:deps` · `check:links` · **改完 `src` 重建 `dist` 并复核**（本仓那个反复咬人的陷阱）。

## 4 · 施工记录（2026-10-17 · 已获准：**施工 · 不提交**）

**授权逐字**（人选项，2026-10-17）：**「施工 · 不提交 (推荐)」** —— 选项正文：

> 改 sheet.ts 的 guard 与 bottomBand 默认值、改 pack.ts 注释/报文，补合成测试 + 13h /tmp 回放，
> 跑全量验收；保留工作树，不关票、不提交。

### 一 · 先红（源码一行没动，只加断言）

新增 5 条合成测试后，`pack-ground-band.test.ts`：**3 failed | 6 passed** —— 红的正是预期那三条：

- ⭐ 碎块 + 1 个真角色、spec 2 ⇒ 过滤后只剩 1 块，**硬失败**（旧代码静默通过）
- ⭐ 底部横带 **84.4%** 宽 + 2 个分离角色 ⇒ 80% 阈值救得了（旧默认 90% 救不了）
- 已知代价：宽度比 0.30 的第二帧被当碎块丢弃 ⇒ 预期**硬失败**（旧代码静默通过）

### 二 · 改了什么

| 文件 | 改动 |
| --- | --- |
| `packages/assets/src/sheet.ts:78` | `if (boxes.length >= 3)` → **`>= 2`**；＋ 三行注释说明 13h 现场、n=2 时 median 取较大块、以及**不能直接删守卫**（0 块时 `ws[0]` 是 `undefined`）。 |
| `packages/assets/src/sheet.ts:98` | `bottomBand` 的 `minCover` 默认 **`0.9` → `0.8`**；`minRows` 保持 3。 |
| `packages/assets/src/sheet.ts` 文件头 | 补一段：80% 是量出来的（13h 15 行 / 每行 ≥85% / 均值 88.5%；21 张正常图底部连续段 0 行 ≥80%），命中后仍要「正好 N 块」才接受。 |
| `packages/assets/src/pack.ts:852` | 救援注释「逐行覆盖率 ≥ 90%」→ **「≥ 80%」**。 |
| `packages/assets/src/pack.ts:876` | 失败报文「已尝试忽略底部 ≥90% 的连续横带」→ **「≥80%」**。策略一字未改。 |
| `packages/assets/tests/pack-ground-band.test.ts` | ＋5 条（见上）＋ `twoBlockSheet` 形状助手（碎块 / 合法双帧 / 3 块 / 84.4% 横带 / 0.30 已知代价）。 |

### 三 · 验收（全部免费 · 零上游 · 零付费）

- ✅ **定向测试 9/9 全绿**（3 红 → 5 条新测试与原有 4 条全过）。
- ✅ **全量 87 文件 / 1490 条全绿**（基线 87 / 1485 ⇒ **+5 条** = 本轮新增的 5 个 `it`）。
- ✅ `npx tsc -b --force` 干净（exit 0）。
- ✅ `pnpm check:deps` ✅ 依赖图合法（9 个包）。
- ✅ `pnpm check:links` ✅ 相对链接零断裂（326 份文档 · 1976 条链接）。
- ✅ **dist 复核**（`tsc -b --force` 重建后）：`dist/sheet.js:75` 是 `boxes.length >= 2` · `:96` 是
  `minCover = 0.8` · `dist/pack.js:727` 是「≥80% 的连续横带」；旧值（`>= 3` / `0.9` / `≥90%`）在 `dist` **0 命中**。

### 四 · 13h 真图免费回放（`/tmp` 探针 · 不落库）

图：`raw/run-out-2026-10-13h/ruined-city-scavenger/pack/v1/authoring/generated/enemy-patroller.turn.png`

```text
图 1344×768 · 众数色 230,7,155 · 抠掉 84.8%
① 未过滤的原始分块 = 2   (0,0) 28×31 · (107,101) 1189×575      ← minRelativeWidth: 0（只为露出未过滤形状，不改生产默认）
①b 过滤后分块     = 1   (107,101) 1189×575
② bottomBand(默认) = { y0: 661, y1: 675, rows: 15, cover: 0.8846726190476187 }
③ 裁带后分块       = 2   (108,101) 363×560 · (882,101) 414×560
✅ 断言全过
```

⇒ 13h 从「静默通过成两张碎图」变成「**1 块 ⇒ 救援 ⇒ 两个真角色**」；
而 90% 阈值下这一步仍是 `null`（红测试已证）。

### 五 · 边界（一个字没越）

- **未提交** · **未关票**（`Status` 停在 `claimed`）—— 两者各自要另一次逐字点头。
- 未动 `fixtures/**` · 未动 R 表（R17）· `packages/qa` 一行没碰 · `game-maker.local.json` 一个字没动 · **零付费真跑**。
- 未改 `segmentRow` 的其他默认（`minGap` / `minWidth` / `minInkRows`）· 未加墨面积判据 · 未扩展到画面中部的线。
- `git diff --stat`（本轮施工部分）：`pack.ts` +2/-2 · `sheet.ts` +9/-2 · `pack-ground-band.test.ts` +72。

## 收口

**2026-10-17 · 人裁逐字「关票 + 提交」**。⇒ `Status` `claimed` → **`resolved`**。

- ✅ 施工与验收全在 `## 4 · 施工记录`：3 红 → 9 绿 · 全量 87/1490 · `tsc` / `check:deps` / `check:links` / **dist 复核** · 13h 免费回放。
- ✅ 已提交（本次提交）；⚠️ **未推送**。
- ✅ 本图已落一行索引（`map.md` 的 `## Decisions so far`）。
- ⚠️ **边界原样**：未动 `fixtures/**` · 未动 R 表（R17）· `packages/qa` 一行没碰 · `game-maker.local.json` 一个字没动 · **零付费真跑** · 未改 `segmentRow` 的其他默认 · 未加墨面积判据 · 未扩展到画面中部的线。
