# 07. P0-FINAL 付费重跑（独立授权）

Type: task
Status: resolved
Owner: main session · 2026-10-24
Blocked by: 06
Map: ../map.md

## Question

付费 P0-FINAL 重跑（独立授权）：用废土寻宝风格图 + 意图做端到端验收，验证修复后 config 稳定过校验。
**单独书面预算 + 逐字授权**；失败留现场 + 登记缺口，不得把失败重试成成功。

## 边界

- 免费验收（票 06）全绿后才出书面预算报告（调用数 / 单价 / 上限 / 失败与重试策略），等你逐字授权再跑。
- 参考上一张图 `intent-to-mechanics-v1` 票 11 的预算与授权格式。
- 不手工编辑中间 JSON 绕过流水线。

## 书面预算报告（2026-10-23）

前置：免费验收（票 06）全绿。修复已落地——`hudUiGate`（清单必须带 ui 面板+图标）+ `solid`→`sprite` kind 锁
（禁拿玩家动画当地形）+ recipe 地形 sprite 正向线索。本报告沿用上一张图 `intent-to-mechanics-v1` 票 11 的两段结构。

### 输入（只读）

| 项 | 路径 / 值 |
|---|---|
| 风格参考图 | `fixtures/e2e/wasteland-platformer/style.png` · sha256 `76ed648e…47f89d0` |
| 游戏意图 | `fixtures/e2e/wasteland-platformer/intent.md` · sha256 `314efbd6…40b7eb1` |
| 输出根 | `.scratch/recipe-config-gap-v1/runs/<today>-p0-final/`（全新目录） |
| 文本上游 | cc-switch 端口 `15721` 已开；`deepseek-v4-pro` |
| 生图上游 | config `gemini-3.1-flash-lite-image`；代理 `9098` 无监听 |

### 零付费预检（已跑，2026-10-23）

| 检查 | 结果 |
|---|---|
| Node / pnpm | v22.23.2 / 10.7.1 |
| Chrome | 155.0.8059.86 |
| 磁盘 | 506 GB 可用 |
| 文本端口 15721 | open |
| 生图代理 9098 | closed（预期；临时转发 9098→7890，不改 config） |
| ClashX 7890 | **open**（`204`）✓ |
| CLI build | `packages/cli/dist/cli.mjs` 已构建 |

### 执行链（两段，段间停一次）

```text
Stage A  create（不带 --yes）→ 清单 + run 目录 + 精确 imageCalls
Stage B  build <run> → pack → config → QA → site
         playable-smoke / probe → 截图 / 轨迹 / 覆盖报告
         人工检查（风格 / 可辨识 / 帧一致 / 新实体同世界 / 核心循环）
```

### 调用预算

#### Stage A · 理解层（零生图）

| 类别 | 估计 | 上限 |
|---|---|---|
| 文本步 | 5 步（visual-world · intent · design · character-dna · recipe） | **≤ 15 请求**（`STRUCTURED_CALL_ATTEMPTS = 3` × 5） |
| 生图 | 0 | **0** |
| 墙钟 | 约 103 s（上次实测） | **15 分钟** |

#### Stage B · 构建 / 站点 / smoke（付费在生图）

| 类别 | 估计 | 上限 |
|---|---|---|
| 生图调用 | **12**（上次实测；本次可能 +ui/+地形，以 Stage A 为准） | `imageCalls ≤ 14`，否则**先停再报** |
| 生图请求 | ≤ 4 × imageCalls | **≤ 4 × imageCalls**（Gemini 每调用最多 4 发） |
| 文本（drawlist） | 6 个 drawlist × 1 | **≤ 40 请求**（含 Stage A） |
| 墙钟 | 约 159 s（上次生图实测）+ site + smoke | **45 分钟**（Stage B）+ **15 分钟**（smoke / 人工） |

### 费用（生图，按 Google 官方 list price）

`gemini-3.1-flash-lite-image`：图像输出 **$30 / 1M image tokens ≈ $0.0336 / 张（1K）**；输入 $0.25 / 1M tokens。

| 路径 | 生图请求 | 估计 |
|---|---|---|
| 正常（12 次调用、无重试） | 12 | **≈ $0.40** |
| 最坏（14 × 4 发） | 56 | **≈ $1.88** |
| **硬上限** | — | **$2.00** |

⚠️ 实际账单以中转为准；文本单价未记录，按请求数封顶（≤ 40），usage 落 ledger。

### 失败 / 重试策略（不隐藏）

- 生图：Gemini 每调用最多 4 发；只有 5xx/429/网络/`NO_IMAGE` 重试；帧数/内容/抠底失败**不重试**。
- 文本：结构化调用最多 3 发；drawlist 最多 3 发。
- 越上限/墙钟到顶 ⇒ 停，留现场 + 已付费原图；不偷偷续跑。
- 失败不自动修复/重生成/换模型；Stage A 失败 ⇒ 停，不进 Stage B。

### 已知风险

1. **生图出站**：`9098（临时转发）→ 7890（ClashX）→ Google`；7890 已确认 `204`，但 9098 需临时转发。
2. **风格错配**：style.png 是黄昏小站、intent.md 是废土寻宝（有意错配）。
3. **新机制可玩性**：planner 可能产出与 v7 不同的关卡（含 chest/danger）；smoke 按阶段记录结果。
4. **生图帧数/抠底**：模型可能画错帧数或抠底失败；图已付费，包会失败。

### 需要你给的授权（逐字）

推荐两段授权。先发 Stage A：

> **批准 P0-FINAL 重跑 Stage A：理解层，≤15 文本请求，0 生图，15 分钟。**

Stage A 跑完报 recipe 路径、`imageCalls` 精确数、drawlist 数、文本 ledger，再另发 Stage B：

> **批准 P0-FINAL 重跑 Stage B：<实际> 次生图 / ≤4× 请求 / 生图费用 ≤$2.00 / 文本 ≤40 请求 / 墙钟 75 分钟，代理 9098→7890。**

未收到授权句前，本票**不发任何文本 / 生图请求**。

## 授权（2026-10-23，用户逐字）

> 批准 P0-FINAL 重跑 Stage A：理解层，≤15 文本请求，0 生图，15 分钟。

**状态**：Stage A 已授权（两段授权第一段）。Stage B 需在 Stage A 报出精确 `imageCalls` 后**另行授权**，未授权前零生图。

## Stage A 结果（2026-10-23，已跑）—— ❌ 失败在 design 步（不是 config）

**Stage A 卡在 `design` 步的 R12**（exit 4，0 生图）：

> `[intent-mechanic-missing]` 意图里的机制「躲避危险」（`avoid-danger`）在设计层没有对家。

- **意图层**（`analyze-intent`）把「躲避危险和敌人」拆成了 **6 条机制**，其中 `avoid-danger`（躲避危险）与
  `avoid-enemy`（躲避敌人）是**两条**；设计层（`compile-design`）这次**漏了 `avoid-danger`** → R12 拒。
- **不是回归**：`avoid-danger` 仍在 `MECHANICS`（`vocabulary.ts:58`）+ `RUNTIME_IMPLEMENTED_MECHANICS`（`:98`）。
  上一张图 `intent-to-mechanics-v1` 票 11 的 Stage A **同一步过了 R12**（那次设计映射了 avoid-danger）。
- **根因 = 设计步 LLM 非确定 + R12 不重试**：`compile-design`（`compile-design.ts:288-299`）把 R12 当**结论**、
  `raise(DesignRejectedError)` **立即抛、不重采样**（「设计做不出来」= 结论，不是「模型没干好」）。于是模型这一次
  恰好漏了 `avoid-danger`，整条链就在 design 步崩掉、没有第二次机会。
- **config 修复未被验证**：本次失败在 recipe/config **之前**，`hudUiGate` + `solid→sprite` kind 锁**没跑到**。

现场：`.scratch/recipe-config-gap-v1/runs/2026-10-23-p0-final/.failed-2026-10-23T10-58-21-488Z/`
（`game-intent.json` 六条机制 + `design-attempts.json` + `stage-a.log`）。文本 1 发（compile-design，`deepseek-v4-pro`）。

**这是本图范围外的缺口**：设计步 R12 的「不重试」把一次可补的采样失误当成终局拒绝。修法（另立 effort）：
R12 `intent-mechanic-missing` 应该**重采样**（机制在 `MECHANICS` 里、只是模型漏写），而 `mechanic-unsupported`
（外壳真做不了）才**不重试**。本图只管 recipe/config，不碰设计步。

## R12 重试修复 + Stage A 重跑（2026-10-23）—— ✅ 过

- **修了 `compile-design.ts`**：R12 `intent-*`（机制/实体漏写 = 采样失误）**重采样**（与 schema 失败同档、三发）；
  `*-unsupported` / `mechanic-experimental`（外壳真做不了 = 确定性）仍**立即抛不重试**。witness 3 用例
  （`compile-design.test.ts`），全仓 1854 绿。
- **Stage A 重跑全过**（R12 不再卡）：设计 6 条机制全映射（`run/jump/open-chest/collect-pickup/avoid-danger/
  hazard-contact`）；`gameId=wasteland-scavenger-assets`、`run/v1`。
- **修复生效、`imageCalls=18`（上次 12）**：清单 14 资源 = animation×1 · sprite×10 · background×1 · ui×2 ——
  `hud-panel`(ninePatch) + `hud-pip`（票 04 hudUiGate）+ `ground-tile`/`rubble-pile`/`broken-wall`/`cracked-plate`
  等地形 sprite（票 05 地形线索）都产出了。**18 > 预算上限 14 ⇒ 按「先停再报」停在这里。**

现场：`.scratch/recipe-config-gap-v1/runs/2026-10-23-p0-final/`（`stage-a-retry.log` + run 目录 + ledger）。

## 授权（Stage B · 2026-10-23，用户逐字）

> 批准 P0-FINAL 重跑 Stage B：18 次生图 / ≤4×=72 请求 / 生图费用 ≤$2.50 / 文本 ≤40 / 墙钟 75 分钟，代理 9098→7890，无隐藏重试。

**状态**：Stage B 已授权（实测 imageCalls=18）。跑前核对 ClashX 7890 + 起临时转发 9098→7890；任一缺失即零生图停住。

## Stage B 结果（2026-10-23，已跑）—— ❌ 失败在 pack 的 hud-panel（drawlist 截断）

**生图 13/14 全过，卡在 `hud-panel`**（九宫格 ui 面板、走 drawlist/文本）：

> 资源 "hud-panel" 生成失败：2 次都没成功；最后一次：返回的不是合法 JSON（Expected ',' or ']' after array element
> in JSON at position 4065）—— drawlist JSON 被截断。

- **修复都生效了**：`ground-tile`/`rubble-pile`/`broken-wall`/`cracked-plate`（地形）、`exit-gate`/`oil-drum`/
  `wrecked-vehicle`（goal/decor）、`hud-pip`（ui 图标）**全部生成成功**；config 那一步**还没走到**（pack 先崩）。
- **新缺口**：`hud-panel` 是**九宫格 ui** → `resolveRoute` 走 `drawlist`（文本向量图）→ `generate.ts` 的 drawlist
  生成返回**被截断的 JSON**（2/2 失败，非偶发）。这是票 04 hudUiGate **逼出 ui 面板之后才第一次走到**的路径
  （上次清单没有 ui，从没生成过 hud-panel drawlist）。
- **已付原图留现场**：`.scratch/recipe-config-gap-v1/runs/2026-10-23-p0-final/wasteland-scavenger-assets/
  failed-2026-10-23T12-03-14-382Z`（masters + hero/enemy/chest 等 5 张位图 + 逐字提示词）。**复用 = source 改
  `import` 指过去，生图 0 次**。
- **成本**：7 次调用（master×2 · image×3 · drawlist×2）· 9 往返；生图 ≈ $0.17，文本 drawlist 2 发。

**这是本图范围外的新缺口**：drawlist 生成对九宫格 ui 面板返回截断 JSON（`generate.ts` 的 `max_tokens ?? 32_000`
或模型输出被截）。修法另立 effort（调大 drawlist 预算 / 九宫格 ui 改走 image / drawlist 截断重试）。本图只管
recipe/config，不碰 drawlist 生成。

## Stage B 重跑（drawlist 修复后，2026-10-23）—— ❌ 又卡在生图底色判据

**drawlist 修复生效了**（`hud-panel` 这次 `往返 1` 就成、29.0s），但**又露出下一处**：

> 资源 "chest" 的底色判据没过：模型被告知底色 [255,0,255]（容差 30），但图上实测众数色是 [250,3,243]
> （L1=20），按声明色只抠掉 44.5%（要求 >50%）。

- **不是重试能解决的**：错误明说「第三次真跑 9/9 张都如此，声明色在提示词里写了两到四遍」—— 模型**稳定**把
  背景画成 [250,3,243] 而非 [255,0,255]，属**生图层（gemini image）系统性偏色**，不是偶发。
- **成本**：20 次调用（master×2 · image×16 · drawlist×2）全生成、全保留；生图 ≈ $0.67。
- **现场**：`.scratch/recipe-config-gap-v1/runs/2026-10-23-p0-final/wasteland-scavenger-assets/failed-2026-10-23T14-09-45-239Z`
  （含 18 张图 + 逐字提示词，可改 `import` 复用、生图 0 次）。

**这是生图层（image 底色抠除）的缺口，不在本图范围**。链路上的四层至此：config 校验 ✅（本图）、R12 ✅（顺带修）、
drawlist ✅（票 08）、**image 底色偏色 ❌（新）**。

## Stage B 重跑 2（08/09 修复后，2026-10-23）—— ❌ 又卡在 config 几何

**前四层修复全生效了**（pack 20 调用全过：hud-panel/hud-pip drawlist ✅、chest 底色判据 ✅），但 **config 步**
（compile-runtime）产出的配置过不了校验（2 条硬失败）：

> - entity "wrecked-vehicle-1": 落在世界之外（世界 1440×270；盒子 (1160,238) 80×40）
> - entity "gate": 落在世界之外（世界 1440×270；盒子 (1370,234) 40×48）

- **根因**：compile-runtime 的**模型**把 `wrecked-vehicle-1`（decor）和 `gate`（goal）摆到**地面线以下**（盒子底
  y=278 / 282，超世界高 270）。这是**模型几何错误**，不是 recipe/契约缺口 —— 与 R12 那次「漏写 avoid-danger」同款：
  **模型侧随机错误 + 业务校验不重试**（`ops.ts` 业务校验「不重采样」把这类模型错也当终局）。
- **config 修复（本图）已充分验证**：hud/solid 两条旧硬失败**都没再出现**，说明 recipe 补 ui + kind 锁是有效的。
- **成本**：pack 20 调用（master×2 · image×16 · drawlist×2）≈ $0.60；compile-runtime 文本 1 发。现场已留、图可 `import` 复用。

**这是 compile-runtime「几何/业务校验不重试」的缺口，第 5 层**：config 校验 ✅ · R12 ✅ · drawlist ✅ · image 底色 ✅ ·
**config 几何（模型摆出界、不重试）❌（新）**。

## 续跑（2026-10-24）

票 10（业务校验重试）/ 11（长宽比）/ 12（锚点摆法）已修并免费验收全绿（1855）。本票 resume：在这些修复之后
**重跑付费 P0-FINAL**，看是否终于通过、或露出第 6 层缺口。需重新逐字授权（Stage A/B）。

## 授权（Stage A 续跑 · 2026-10-24，用户逐字）

> 批准 P0-FINAL 重跑 Stage A（票 10/11/12 修复后）：理解层，≤15 文本请求，0 生图，15 分钟。

**状态**：Stage A 已授权（两段授权第一段）。Stage B 需在 Stage A 报出精确 `imageCalls` 后另行授权，未授权前零生图。

## Stage A 续跑结果（2026-10-24，已授权）—— ❌ 失败在 plan-assets（empty-input 复现）

- **前四步全过**（visual-world / intent / design / character-dna 产出齐全），卡在第五步 **recipe（plan-assets）**：
  `empty-input` ×3，`model=deepseek-v4-pro`（**不是 flash 降级**），usage 41 in / 1867 out。
- **这是旧病复现**：与 `p0-final-v1` 首跑同款 `empty-input`（工具被调、入参没了，上游烧了输出 token 但 args 丢了）。
  `text-upstream-v1` 修的是「flash 降级」那一层，但 **v4-pro 对 `emit_asset_recipe` 大 schema 也会间歇性丢工具入参** ——
  上两次成功的 Stage A（`intent-to-mechanics-v1` 票 11、本图 07 首跑）里 plan-assets 就已是「需 3 发才成」，这次 3/3 全 empty。
- **零生图**（卡在生图之前），文本 1 步 3 发（deepseek-v4-pro），墙钟 ~43s。
- 现场：`.scratch/recipe-config-gap-v1/runs/2026-10-24-p0-final/.failed-2026-10-24T10-18-20-606Z/`
  （前四步产物齐全，无 recipe）。

**这不是本图的 recipe/config 缺口，是文本上游（DeepSeek v4-pro）对大工具 schema 的数据丢失可靠性问题。**
按「失败留现场、不把失败重试成成功」收口；是否重试 / 换 provider / 查根因由你裁定。

## 授权（plan-only 诊断 · 2026-10-24，用户逐字批准）

> 批准 plan-only 重试诊断：1 次 plan-assets（≤3 发），0 生图，费用 < $0.01。

**状态**：已授权。跑 `game-maker plan`（用失败现场 design + visual-world，跳过前四步）。

## plan-only 诊断结果（2026-10-24，已授权）—— ✅ 空入参是偶发，重试可恢复

- `game-maker plan`（失败现场 design + visual-world，跳过前四步）**exit 0**：`plan-assets` **第 2 发成功**
  （attempts=2，failures=["empty-input"] —— 第 1 发 empty、第 2 发成）。
- `model=deepseek-v4-pro`（正确），12 资源（animation×2 · sprite×7 · background×1 · ui×2），
  `recipeId=wasteland-scavenger-recipe`，`recipe/v1.json` + `v1.plan.json` 落盘。
- **结论**：`empty-input` 是**间歇性**（非系统）—— 重试在 3 发预算内能恢复；Stage A 那次 3/3 全 empty
  是一次倒霉连抽。但 empty-input **频率够高**，偶尔会耗光 3 发预算（Stage A 就是），耐久性待议。

## 授权（Stage A 重试 · 2026-10-24，用户逐字批准）

> 批准 P0-FINAL 重跑 Stage A（plan-only 已证 empty-input 偶发）：理解层，≤15 文本请求，0 生图，15 分钟。

**状态**：已授权。重跑 Stage A（plan-only 已证 empty-input 偶发、重试可恢复）。

## Stage A 重试结果（2026-10-24，已授权）—— ❌ 又失败在 plan-assets（empty-input + schema 混合）

- 又卡第五步 plan-assets：attempts=3，failures = **empty-input / schema / empty-input**，，
  usage 54 in / 2301 out。
- **新数据点**：这次是「empty-input + schema」混合 —— 模型有时丢工具入参（empty）、有时返回的入参**不过
  `emit_asset_recipe` 契约**（schema）。不是纯网络抖动，是 **v4-pro 对这个大 schema 的能力不稳**。
- 三次 plan-assets 实测成功率：Stage A 首跑 0/3 · plan-only 1/2 · Stage A 重试 0/3 ⇒ 约 **1/8**，低于可用阈值。
- 零生图。现场：.scratch/recipe-config-gap-v1/runs/2026-10-24-p0-final-retry/.failed-2026-10-24T10-42-01-259Z（前四步产物齐全，无 recipe）。

**结论升级**：empty-input 并非「偶发可恢复」，而是 **deepseek-v4-pro 对 `emit_asset_recipe` 大 schema 系统性不可靠**
（丢入参 + 产出不过契约）。换 provider 已从「可选项」变成「必须」。

## Answer（2026-10-24 · 结论：失败，换 provider 推迟）

付费重跑未通过，按「失败留现场 + 登记缺口」收口。最终阻塞不在 recipe/config（本图核心已修、免费验收全绿），而在**文本上游**：

- **Stage A 三次卡在 plan-assets**（`emit_asset_recipe` 大 schema）：首跑 empty-input ×3 → 诊断 plan-only 1/2 →
  重试 empty-input / schema / empty-input。三次实测成功率约 **1/8**。
- **根因**：`deepseek-v4-pro` 对大工具 schema 系统不可靠（丢入参 empty + 产出不过契约 schema），非网络抖动、
  非本图代码。`text-upstream-v1` 只修了 flash 降级、未真正换 provider —— `p0-final-v1` 票 05 的旧债。
- **用户裁定（2026-10-24）**：暂时不切换 provider；本票算完成（失败收口）。
- **已发生花费**：文本 plan-assets 共 3+2+3 = 8 发（均 deepseek-v4-pro）；生图 $0。
- **现场**：`runs/2026-10-24-p0-final/.failed-…/`、`runs/2026-10-24-p0-final-retry/.failed-…/`、
  `runs/2026-10-24-p0-final/plan-probe/`。

**状态**：`CAP-E2E-01` / P0-FINAL E2E 仍**未通过**。恢复路径 = 换 provider（MiniMax-M2.7 / qwen3.8-max）
→ 探针 → plan-only → Stage A → Stage B（另立 effort / 下次授权）。

## 诊断追记（2026-10-24）—— 查 cc-switch `proxy_request_logs`（E1）

`~/.cc-switch/cc-switch.db` 的 `proxy_request_logs` 表，精确对上我今天的 `plan-assets` 调用：

- **① 请求未截断**：失败两发（`41 in/1867 out`、`54 in/2301 out`）的 `input_tokens`=41/54 **只是非缓存增量**，
  `cache_read_tokens`=8192 是缓存命中；总输入 ≈ 8233 token（完整 prompt），成功/失败两发输入完全相同。
  「41/54」是 DeepSeek 提示词缓存的记账假象，**不是请求残缺**。
- **② 失败拆分**（7 发）：`empty-input` 5 / `schema` 1 / 成功 1。**empty-input（响应侧丢 `tool_use.input`）占 5/6**，
  schema 仅 1/6。
- **③ 结论**：schema 非主因 → 「暴露 superRefine / 改 schema」方向不成立；主因 = **empty-input**，
  指向换 provider 或响应侧健壮性（对 empty-input 单独加一档重试）。
