# 票 01 研究：E2E 路径 vs demo.md 6 条 P0 验收（增量缺口定位）

Date: 2026-10-25 · 零付费（只读代码 + 读既有 run/issue 产物，未跑 create/build/生图）

## 结论速览（TL;DR）

1. **6 条 P0 现状**：运行时能力（P0-03 启动 / P0-04 操作 / P0-05 通关）已离线验证（v7 fixture 包
   `playable-smoke` 全绿）；P0-02（生成）卡在 **plan-assets 一步的文本上游不可靠**（不是 design→config）；
   P0-06（风格接入）只到视觉层产物（VDC 的 `visual-design.json`/`svg`/`png`），未到真实站点人工对照。
2. **design→config 5 条硬失败已不是当前阻塞**：它们被 `recipe-config-gap-v1`（2026-10-23/24）修复，
   且免费验收（票 06）已过 —— 但该 effort **不在 fpvs-v1-p0 map 的「前置」链里**，map 里
   「那之后无一张图去修它」是**事实错误**。
3. **当前真实阻塞 = 文本上游**：`deepseek-v4-pro` 对 `emit_asset_recipe` 大工具 schema 系统性不可靠
   （empty-input 丢入参 + schema 不过契约，实测约 1/8 成功率），用户 2026-10-24 裁定**暂不换 provider**。
   见 `recipe-config-gap-v1` 票 07。

---

## Q2（先答——它推翻 map 的当前阻塞前提）：design→config 5 条硬失败现状

### 5 条硬失败的原文（E3）

现场 `.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/stage-b.log`：

```
✗ 编译出来的配置过不了校验（5 条硬失败）：
  · entity "block-1": 资源 "scavenger-hero" 有多个可画的动画，引用必须指明 anim（可选：idle, run, jump）
  · entity "slope-1": 资源 "scavenger-hero" 有多个可画的动画，引用必须指明 anim（可选：idle, run, jump）
  · hud.panel: "chest" 是 sprite，这里要的是 ui
  · hud.pip: "resource-item" 是 sprite，这里要的是 ui
  · hud.panel.size: 声明的是 72×32，而包里的 "chest" 是 32×24 —— 而这件资源不是九宫格
```

### 每条对应的当前代码（E1），以及是否被修

| # | 失败 | 出处（当前代码） | 修复 effort | 现状 |
|---|---|---|---|---|
| 1 | `block-1`→`scavenger-hero`（玩家角色当地形） | `resolvePackRef` 多动画缺 anim：`packages/contracts/src/assetpack.ts:423-426` | recipe-config-gap-v1 票 05 | **已修**：`solid` 实体引用加 `["sprite"]` kind 锁 `packages/contracts/src/game-config.ts:370-372`，改报「是 animation，这里要的是 sprite」构建期 kind 拒绝 |
| 2 | `slope-1`→`scavenger-hero`（同上） | 同上 | 同上 | **已修**：同上一条锁 |
| 3 | `hud.panel`→`chest`（玩法 sprite 当 ui） | `ref("hud.panel", ..., ["ui"])`：`game-config.ts:373` | recipe-config-gap-v1 票 04 | **已修（根因侧）**：`hudUiGate` 逼 recipe 产带 `ninePatch` 的 ui 面板 `packages/assets/src/ops.ts:288-302` |
| 4 | `hud.pip`→`resource-item`（玩法 sprite 当 ui） | `ref("hud.pip", ..., ["ui"])`：`game-config.ts:374` | recipe-config-gap-v1 票 04 | **已修（根因侧）**：`hudUiGate` 逼 recipe 产不带 `ninePatch` 的 ui 图标（同上） |
| 5 | `hud.panel.size` 72×32 vs 32×24 非九宫格 | `auditPanelSize`：`packages/contracts/src/game-config.ts:404-425`（九宫格才放行「声明≠包」） | recipe-config-gap-v1 票 04 | **已修（根因侧）**：`hudUiGate` 逼 ui 面板带 `ninePatch`，声明尺寸可合法放大 |

### 修复机制落在 compile-runtime 链上（E1）

- **提示词侧**（防模型再犯）：铁律 #5 禁玩家/动画当 solid、缺 sprite 退 `terrain`：`packages/assets/src/ops.ts:1071-1073`；
  铁律 #8 声明 `sourceIntent`：`ops.ts:1077-1081`。
- **业务校验进重采样循环**（模型错 → 重抽，非终局）：`auditGameConfig` + `auditEntityIdentity` +
  `auditScreenSpace` 移进循环 `packages/assets/src/ops.ts:1161-1179`（recipe-config-gap-v1 票 10）；
  确定性钳位 `clampToWorld`：`ops.ts:1158-1160`（票 13）。
- **R12 重采样**（design 步漏写机制可重抽，不再当终局）：`packages/game-design/src/compile-design.ts:293-298`
  （`intent-mechanic-missing`/`intent-entity-missing` 可重采样；`*-unsupported`/`mechanic-experimental` 仍立即抛）。

### 免费验收证据（E3/E2）：5 条硬失败已消

`.scratch/recipe-config-gap-v1/issues/06-free-acceptance.md`（2026-10-23 收口）：
`recipe-config-acceptance.test.ts` 对合法配置跑 `auditGameConfig` + `auditScreenSpace` + `auditLayerCoverage`
**零硬失败**；`pnpm test:playable`（offline E2E）全绿；`pnpm test` 1853/1853。
票 07 Stage B 重跑 2 的原文：「**hud/solid 两条旧硬失败都没再出现，说明 recipe 补 ui + kind 锁是有效的**」
（`.scratch/recipe-config-gap-v1/issues/07-p0-final-paid-rerun.md` 第 208 行附近）。

### 与 entity-identity / VDC / 机制覆盖的关系（正交，未碰这 5 条）

后续这些 effort 全部落在**新增**校验上，未改 `auditReferences`/`resolvePackRef`/`auditPanelSize`/`hudUiGate`：

- `auditEntityIdentity`（sourceIntent coverage/悬空/越界/kind 兼容）：`packages/contracts/src/game-config.ts:559-619`（entity-identity-v1 / v1.1）。
- `DESIGN_BUCKET_KINDS`（桶→kind 兼容矩阵，单一来源）：`game-config.ts:534-539`。
- `visualConfigCoherence`（QA 第 7 判据）：`packages/qa/src/visual.ts`（VDC / visual-semantics-verification-v1）。

**结论**：5 条硬失败**已全部被 recipe-config-gap-v1 修复**，且免费验收已过；它们**不是**当前阻塞。
fpvs-v1-p0 `map.md` 第 18-20 行「那之后无一张图去修它」与「前置」链（缺 `recipe-config-gap-v1`）**事实有误**。

---

## Q1：6 条 P0 验收现状（E2E 路径 create → build → site）

| P0 | 现状 | 证据（file:line / 产物路径） |
|---|---|---|
| P0-01 审计 | 本票即审计；结论 = map 前提需修正（阻塞在文本上游，非 design→config） | 本文件 |
| P0-02 生成 | **有缺口，卡在 plan-assets**（不是 design→config）。Stage A 前四步 + visual-design 过，recipe 步 `empty-input`/`schema` 不可靠 | `planAssets` 重采样档 `packages/assets/src/ops.ts:381-400`；失败现场 `recipe-config-gap-v1` 票 07 |
| P0-03 启动加载 | 运行时外壳 + site 装配已具备，**离线已验证**；真实 E2E site 从未产出（因上游卡在 recipe） | `packages/demo/probe/playable-smoke.mjs`（P0-03 headless smoke）；`packages/demo/src/site.ts`/`assemble.ts`；p0-construction-v1 票 10、recipe-config-gap-v1 票 06 |
| P0-04 操作 | 外壳已实现 run/jump/collect/open-chest/avoid-danger；机制 probe 离线全绿 | `packages/demo/src/shell/scene.ts:84-94,154,173,284-340`；`vocabulary.ts:89-98`（`RUNTIME_IMPLEMENTED_MECHANICS` 8 值全 supported） |
| P0-05 通关 | 目标闭环已实现（collect-then-reach + won 判定）；playable-smoke 正例离线全绿（collected=3/3） | `packages/demo/src/shell/scene.ts:362`；`playable-smoke.mjs`；intent-to-mechanics-v1 票 10/15 |
| P0-06 风格接入 | 视觉层已到（visual-world→palette→VDC 的 visual-design.json/svg/png）；**未到真实站点人工对照**（E2E 没到 site） | `packages/visual-design/src/*`（VDC）；`.scratch/visual-design-impl-v1/issues/08-e2e-acceptance.md` |

**P0-02 是唯一硬阻塞**，且阻塞点 = plan-assets 文本上游，其余 5 条 P0 的运行能力均已离线就绪、
只等一次能产出 config/site 的真实付费单跑。

---

## Q3：除 design→config 外，还有哪些缺口挡在「可玩 Demo」前

按付费 E2E 真实跑史（`recipe-config-gap-v1` 票 07，逐层露出后逐层修）：

| 层 | 缺口 | 状态 | 证据 |
|---|---|---|---|
| 设计步 R12 | `intent-mechanic-missing` 漏写不重试（当终局） | **已修**（重采样） | `packages/game-design/src/compile-design.ts:293-298` |
| 生图 drawlist | 九宫格 ui 面板 drawlist JSON 截断 | **已修**（attempts 2→4） | recipe-config-gap-v1 票 08 |
| 生图 image 底色 | chest 底色偏色（[250,3,243] vs [255,0,255]） | **已修**（edgeConnectedBackground） | recipe-config-gap-v1 票 09 |
| config 几何 | 实体摆出世界（wrecked-vehicle-1/gate） | **已修**（业务校验重采样 + clampToWorld + 锚点铁律） | `ops.ts:1158-1179`；recipe-config-gap-v1 票 10/12/13 |
| **文本上游** | **deepseek-v4-pro 对 `emit_asset_recipe` 大 schema：empty-input + schema，约 1/8 成功率** | **未修（当前阻塞）**；用户 2026-10-24 裁定暂不换 provider | recipe-config-gap-v1 票 07（第 272-298 行）；票 13 已加 `EMPTY_INPUT_ATTEMPTS=6` 但仍非根解 |

另有一条**结构性不可判**边界（非阻塞）：数量精确值 / 空间关系（VDS 纯机械布局 + 屏幕≠世界无变换）
不可确定性验证，已记为「结构性不可判」（`.scratch/visual-semantics-verification-v1/map.md` 票 01）。

**结论**：除 design→config（已修）外，**唯一当前阻塞 = 文本上游可靠性**。
恢复路径（recipe-config-gap-v1 票 07 已写）：换 provider（MiniMax-M2.7 / qwen3.8-max）→ 探针 →
plan-only → Stage A → Stage B。

---

## 来源索引

- 失败现场：`.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/stage-b.log`（5 条硬失败逐字）。
- 修复 effort：`.scratch/recipe-config-gap-v1/map.md`（票 04 hudUiGate / 票 05 kind 锁 / 票 06 免费验收 /
  票 07 付费重跑 / 票 08/09/10/11/12/13 逐层修复）。
- 关键代码：`packages/contracts/src/game-config.ts:50-51,370-374,404-425,534-539,559-619`；
  `packages/contracts/src/assetpack.ts:420-426`；`packages/assets/src/ops.ts:288-302,381-400,992,1004,1071-1081,1158-1205`；
  `packages/game-design/src/compile-design.ts:293-298`；`packages/contracts/src/vocabulary.ts:38-58,89-98`；
  `packages/demo/src/shell/scene.ts:84-94,154,173,284-340,362`；`packages/demo/probe/playable-smoke.mjs`。
