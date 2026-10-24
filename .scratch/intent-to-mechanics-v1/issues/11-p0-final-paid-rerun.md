# 11. P0-FINAL 付费重跑（独立授权）

Type: task
Status: resolved
Owner: main session · 2026-10-23
Blocked by: 10
Map: ../map.md

## Question

P0-FINAL 付费重跑（文档 §6 P0-5）：用废土寻宝风格图 + 意图做端到端验收。**单独书面预算 + 逐字授权**（第一轮裁定
Q2：不得自动执行）。不允许手工编辑中间 JSON 绕过流水线。

## 现状（E1）

- 输入：`fixtures/e2e/wasteland-platformer/style.png` + `intent.md`（W6 同款）；前置阻塞即 R12
  `intent-mechanic-missing`（`open-chest` / `avoid-danger`），见 `p0-final-v1/map.md`。

## 建议

本票**只占位**：免费验收（[票 10](10-free-acceptance.md)）全绿后才出书面预算报告（调用数 / 单价 / 上限 / 失败与
重试策略），等你逐字授权再跑；参考 `p0-final-v1` 的预算与授权格式。重跑成功 ⇒ 可宣告 P0-FINAL E2E 通过；失败 ⇒
留现场 + 登记缺口，**不得把失败重试成成功**。

## 书面预算报告（2026-10-23）

前置阻塞已消：文本上游已修复（`deepseek-v4-pro`，见 `text-upstream-v1`）；R12 `intent-mechanic-missing` 已由
本图落地（`open-chest` / `avoid-danger` 进 `MECHANICS` + `EntityKind` chest/danger）。免费验收（票 10）全绿
（vitest 1846 + 三 probe + 覆盖报告三层全 satisfied）。本报告沿用 `p0-final-v1` 票 01 的口径与两段结构。

### 输入（只读）

| 项 | 路径 / 值 |
|---|---|
| 风格参考图 | `fixtures/e2e/wasteland-platformer/style.png` · sha256 `76ed648e…47f89d0` |
| 游戏意图 | `fixtures/e2e/wasteland-platformer/intent.md` · sha256 `314efbd6…40b7eb1`（废土寻宝：横移/跳跃/宝箱/资源/敌人/废土背景/最终目标） |
| 输出根 | `.scratch/intent-to-mechanics-v1/runs/<today>-p0-final/`（全新目录，不覆盖） |
| 文本上游 | cc-switch 端口 `15721` 已开；`deepseek-v4-pro` 已修复 |
| 生图上游 | config `gemini · gemini-3.1-flash-lite-image`；代理 `127.0.0.1:9098` 无监听 |

### 零付费预检（已跑，2026-10-23）

| 检查 | 结果 |
|---|---|
| Node / pnpm | v22.23.2 / 10.7.1 |
| Chrome | 155.0.8059.86 |
| 磁盘 | 506 GB 可用 |
| 文本端口 15721 | open（cc-switch 监听中） |
| 生图代理 9098 | **closed**（预期；临时转发，不改 config） |
| ClashX 7890 | **closed** ⚠️（上次跑时 open；生图出站需先起 ClashX） |
| `socat` | 未安装 ⇒ 复用 `p0-final-v1/proxy-forward.mjs`（20 行 Node 转发 `9098→7890`） |
| CLI build | `packages/cli/dist/cli.mjs` 已构建（16:48） |

### 执行链（两段，段间停一次）

```text
Stage A  create（不带 --yes）→ 清单 + run 目录 + 精确 imageCalls
Stage B  build <run> → pack → config → QA → site
         playable-smoke / mechanic-probe → 截图 / 轨迹 / 覆盖报告
         人工检查（风格 / 可辨识 / 帧一致 / 新实体同世界 / 核心循环）
```

### 调用预算

#### Stage A · 理解层（零生图）

| 类别 | 估计 | 上限 |
|---|---|---|
| 文本步 | 5 步（visual-world · intent · design · character-dna · recipe） | **≤ 15 请求**（`STRUCTURED_CALL_ATTEMPTS = 3` × 5） |
| 生图 | 0 | **0** |
| 墙钟 | 归档 `create` 约 29 s | **15 分钟** |
| 费用 | 文本单价不在本仓记录；usage 落 ledger | 按请求数封顶，不按金额估算 |

#### Stage B · 构建 / 站点 / smoke（付费在生图）

| 类别 | 估计 | 上限 |
|---|---|---|
| 生图调用 | **11**（归档同款清单；以 Stage A 实测为准） | `imageCalls ≤ 14`，否则**先停再报** |
| 生图请求 | 11 × 1 = 11 | **≤ 4 × imageCalls**（Gemini 引擎每调用最多 4 发） |
| 文本（drawlist） | 6 个 drawlist × 1 = 6 | **≤ 40 请求**（含 Stage A；若 Stage A 报 > 8 个 drawlist，先停再报） |
| 墙钟 | 归档 `build` 约 251 s + site + smoke | **45 分钟**（Stage B）+ **15 分钟**（smoke / 人工） |

### 费用（生图，按 Google 官方 list price 2026-10-19 页面）

`gemini-3.1-flash-lite-image`：图像输出 **$30 / 1M image tokens ≈ $0.0336 / 张（1K）**；输入 $0.25 / 1M tokens。

| 路径 | 生图请求 | 估计 |
|---|---|---|
| 正常（11 次调用、无重试） | 11 | **≈ $0.37** |
| 最坏（11 × 4 发全部用尽） | 44 | **≈ $1.48** |
| 14 次调用的最坏 | 56 | **≈ $1.88** |
| **硬上限** | — | **$2.00**（含输入 tokens） |

⚠️ 实际账单以中转为准；1K 以下画幅通常更便宜，本报告按 1K 上限估。
⚠️ 文本单价未在本仓记录；**按请求数封顶（≤ 40）**，usage 落 ledger。

### 失败 / 重试策略（不隐藏）

- **生图**：Gemini 每调用最多 **4 发**；只有 5xx / 429 / 网络 / `NO_IMAGE` 会重试。帧数 / 内容 / 抠底校验失败**不重试**。
- **文本**：结构化调用最多 **3 发**；drawlist 最多 **3 发**。
- **任何一发越过上限 / 墙钟到顶** ⇒ 停，保留现场与已付费原图；**不偷偷续跑**。
- **失败不自动修复、不自动重生成、不自动换模型**。
- **Stage A 失败** ⇒ 保存 run 现场与 ledger，停；不进入 Stage B。

### 已知风险

1. **ClashX 7890 当前 closed**（新）：生图出站链路是 `9098（临时转发）→ 7890（ClashX）→ Google`。
   若 ClashX 未起，生图会**网络失败**。处置：起 ClashX（或等价代理）后再跑 Stage B；**不改 config**。
2. **风格错配**：fixture 的 `style.png` 是黄昏小站、`intent.md` 是废土寻宝 —— 有意错配；风格判读有主观项。
3. **新机制可玩性**：planner 可能产出与 v7 不同的关卡（含 chest / danger）；smoke 的状态感知输入通用，
   若新 config 无 pickup/gate 会按阶段失败——这正是要记录的结果。
4. **生图帧数 / 抠底**：模型可能画错帧数或抠底失败；图已付费，包会失败。
5. **代理 9098 无监听**：若临时转发失败 ⇒ **零付费停住**，不改 config、不换上游。

### 需要你给的授权（逐字）

推荐两段授权。先发 Stage A：

> **批准 P0-FINAL 重跑 Stage A：理解层，≤15 文本请求，0 生图，15 分钟。**

Stage A 跑完我会报：recipe 路径、`imageCalls` 精确数、drawlist 数、文本 ledger。然后另发 Stage B：

> **批准 P0-FINAL 重跑 Stage B：<实际> 次生图 / ≤4× 请求 / 生图费用 ≤$2.00 / 文本 ≤40 请求 / 墙钟 75 分钟，代理 9098→7890。**

也可一次授权（含硬停）：

> **批准 P0-FINAL 重跑：Stage A ≤15 文本请求；Stage B 按 Stage A 实测 imageCalls，生图请求 ≤4×imageCalls、
> 生图费用 ≤$2.00、文本 ≤40 请求、墙钟 75 分钟，代理 9098→7890，无隐藏重试；
> Stage A 报出 >14 次生图或 >8 个 drawlist 资源先停再报。**

未收到上述任一授权语句前，本票**不发任何文本 / 生图请求**。

## 授权（2026-10-23，用户逐字）

> 批准 P0-FINAL 重跑 Stage A：理解层，≤15 文本请求，0 生图，15 分钟。

**状态**：Stage A 已授权（两段授权第一段）。Stage B 需在 Stage A 报出精确 `imageCalls` 后**另行授权**，未授权前零生图。

## Stage A 结果（2026-10-23，已跑）

✅ **理解层全过，R12 不再卡** —— `create`（不带 `--yes`）跑完 5 步并停在清单检查点（exit 0）：

- **run**：`rust-city-scavenger/run/v1`（`gameId=rust-city-scavenger`）。
- **imageCalls = 12**（动画 3 · 单帧 4 · 背景 4 · 母版 1）—— 归档同款是 11，本次 +1（chest / danger 各多一帧）。
- **机制映射（R12 通过）**：`run` / `jump` / `collect-pickup` / `open-chest` / `avoid-danger` 全有对家，
  无 `intent-mechanic-missing`。设计里 `interactables`（chest + hazard-spike）、`enemies`（enemy-wasteland）、
  `resources`（resource-item）齐。
- **文本 ledger**：5 调用 / 7 尝试（`plan-assets` 需 3 发才成）、模型全程 `deepseek-v4-pro`（无降级）、
  in 8586 / out 5783 tokens、墙钟 103 s。**≤15 文本请求内**。
- **歧义（8 条，均不阻断）**：title / subgenre / progression / challenge / loseConditions / winConditions /
  entities / coreLoopSteps 需求未提。

证据：`.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/`（`stage-a.log` + run 目录 + `ledger.json`）。

**Stage B 预算（按实测 imageCalls=12）**：生图请求 ≤ 4×12=48；生图费用正常 ≈ $0.40（12×$0.0336）、
最坏 ≈ $1.61（48×$0.0336），**≤ $2.00 硬上限**；文本 ≤40；墙钟 75 分钟。
⚠️ **前置**：生图出站要 `9098→7890`，而 **ClashX 7890 当前 closed** —— 需先起 ClashX（或等价代理）再跑 Stage B。

## 授权（Stage B · 2026-10-23，用户逐字）

> 批准 P0-FINAL 重跑 Stage B：12 次生图 / ≤4× 请求 / 生图费用 ≤$2.00 / 文本 ≤40 请求 / 墙钟 75 分钟，代理 9098→7890，无隐藏重试。

**状态**：Stage B 已授权。跑前须核对 ClashX 7890 监听 + 起临时转发 9098→7890；任一缺失即零生图停住。

## Answer

**❌ 失败（2026-10-23）—— P0-FINAL 付费重跑未通过。** 按「失败留现场 + 登记缺口，不把失败重试成成功」收口：

- **Stage A（理解层）全过**：R12 不再卡，`open-chest` / `avoid-danger` 映射正确，`deepseek-v4-pro` 无降级。
- **Stage B 生图全过**：12 次 gemini（11 image + 1 master）**0 重试**、墙钟 159 s，成本 ≈ $0.40。
- **卡在 compile-runtime 的 GameConfig 业务校验（5 条硬失败）**：

  1. `entity "block-1"` → `scavenger-hero`：多动画引用未指明 `anim`（玩家角色被塞进地形块槽）。
  2. `entity "slope-1"` → `scavenger-hero`：同上（玩家角色被塞进斜坡槽）。
  3. `hud.panel` → `chest`：是 sprite，这里要 `ui`（HUD 面板绑了玩法 sprite）。
  4. `hud.pip` → `resource-item`：是 sprite，这里要 `ui`（HUD 图标绑了玩法 sprite）。
  5. `hud.panel.size`：声明 72×32 vs 包内 `chest` 32×24，且非九宫格。

- **根因**：不在生图、不在机制契约 —— 在**设计→config（compile-runtime）层**：层级组合把玩家角色当地形、
  HUD 把玩法 sprite 当 ui 资源。**这是本图范围外的新缺口**（本图只注册机制、不改 8 条机制行为），
  该缺陷应另立 effort 修，不在本票顺手改、不重采样掩盖。

- **现场**：`.scratch/intent-to-mechanics-v1/runs/2026-10-23-p0-final/`（`stage-a.log` · `stage-b.log` ·
  `run/v1` · `pack/v1` 各带 `ledger.json`）。config/site **未落盘**（业务校验失败不落坏配置，符合口径）。

- **成本**：生图 12 次 ≈ $0.40；文本 Stage A 7 发 + Stage B compile-runtime 1 发，均 `deepseek-v4-pro`。

**结论**：`CAP-E2E-01` / P0-FINAL E2E 仍**未通过**；意图→机制契约（本图核心）**已证明**，
但设计→config→runtime 链在真实付费单跑下暴露出编译层缺口，需要一张新图（另立 effort）。
