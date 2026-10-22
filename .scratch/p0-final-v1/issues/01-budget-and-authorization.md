# 01. P0-FINAL 书面预算与付费授权

Type: task
Status: resolved
Owner: main session · 2026-10-22
Blocked by: —
Map: ../map.md

## Question

按 `docs/v4/P0-00-p0-scope.md` §7.1，出书面预算报告（预计调用数 / 单价 / 上限 / 失败与重试策略），
并取得逐字授权。**当前未发出任何文本 / 生图 / 视觉模型请求。**

## 输入（只读）

| 项 | 路径 / 值 |
|---|---|
| 风格参考图 | `fixtures/e2e/wasteland-platformer/style.png` · sha256 `76ed648ec71dfffe3274dc16ab0d8ab1d242502511db947ce630ee75a47f89d0` |
| 游戏意图 | `fixtures/e2e/wasteland-platformer/intent.md` · sha256 `314efbd6b46b3b899b38de35c8bba89dc0ea01e5bb66c2791dabf309f40b7eb1` |
| 输出根 | `.scratch/p0-final-v1/runs/2026-10-22-real/`（全新目录，不覆盖既有产物） |
| 文本上游 | `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` 已设；本地端口 `15721` 已开 |
| 生图上游 | config 的 `gemini · gemini-3.1-flash-lite-image`；config 代理 `127.0.0.1:9098` **当前无监听** |

## 零付费预检（已跑）

| 检查 | 结果 |
|---|---|
| Node / pnpm | v22.23.2 / 10.7.1 |
| Chrome | 155.0.8059.85（`playable-smoke` 可用） |
| 磁盘 | 506 GB 可用 |
| 文本端口 15721 | open |
| 生图代理 9098 | **closed** |
| ClashX 7890 | open |
| `socat` | 未安装 ⇒ 用一支 20 行 Node TCP 转发（`9098→7890`），**不改 config** |
| 归档同款输入的 imageCalls | **11**（animation 4 · single 1 · background 4 · master 2；`imageCallsOf` 实算） |

## 执行链（两段，段间停一次）

```text
Stage A  create（不带 --yes）→ 清单 + run 目录 + 精确 imageCalls
Stage B  build <run> → pack → config → QA → site
         playable-smoke（pack + config）→ 截图 / 轨迹 / 汇总
         人工检查（风格 / 可辨识 / 帧一致 / 新实体同世界 / 核心循环）
```

**为什么分两段**：R9 的清单检查点本来就在 `create` 与 `build` 之间；Stage A 只花文本，
跑完能拿到**精确的生图调用数**再批 Stage B，避免按旧清单盲批。

## 调用预算

### Stage A · 理解层（零生图）

| 类别 | 估计 | 上限 |
|---|---|---|
| 文本步 | 5 步（visual-world · intent · design · character-dna · recipe） | **≤ 15 请求**（`STRUCTURED_CALL_ATTEMPTS = 3` × 5） |
| 生图 | 0 | **0** |
| 墙钟 | 归档 `create` 约 29 s | **15 分钟** |
| 费用 | 文本单价不在本仓记录；usage 落 `ledger` | 按请求数封顶，不按金额估算 |

### Stage B · 构建 / 站点 / smoke（付费在生图）

| 类别 | 估计 | 上限 |
|---|---|---|
| 生图调用 | **11**（按归档同款清单；以 Stage A 实测为准） | `imageCalls ≤ 14`，否则**先停再报** |
| 生图请求 | 11 × 1 = 11 | **≤ 4 × imageCalls**（Gemini 引擎每调用最多 4 发） |
| 文本（drawlist） | 6 个 drawlist × 1 = 6 | **≤ 40 请求**（含 Stage A；若 Stage A 报出 > 8 个 drawlist，先停再报） |
| 墙钟 | 归档 `build` 约 251 s + site + smoke | **45 分钟**（Stage B）+ **15 分钟**（smoke / 人工） |

### 费用（生图，按 Google 官方 list price 2026-10-19 页面）

`gemini-3.1-flash-lite-image`：图像输出 **$30 / 1M image tokens ≈ $0.0336 / 张（1K）**；
输入（文本 / 图片）**$0.25 / 1M tokens**。

| 路径 | 生图请求 | 估计 |
|---|---|---|
| 正常（11 次调用、无重试） | 11 | **≈ $0.37** |
| 最坏（11 × 4 发全部用尽） | 44 | **≈ $1.48** |
| 14 次调用的最坏 | 56 | **≈ $1.88** |
| **硬上限** | — | **$2.00**（含输入 tokens；约 $0.02） |

⚠️ 实际账单以中转为准；1K 以下画幅通常更便宜，本报告按 1K 上限估。
⚠️ 文本单价未在本仓记录；**按请求数封顶（≤ 40）**，usage 会落 ledger。
若你的中转有文本单价，请在授权时给出，我按单价换算金额硬上限。

## 失败 / 重试策略（不隐藏）

- **生图**：Gemini 每调用最多 **4 发**；只有 5xx / 429 / 网络 / `NO_IMAGE` 会重试。
  帧数 / 内容 / 抠底校验失败**不重试**（图已付费，包失败）。
- **文本**：结构化调用最多 **3 发**；drawlist 最多 **3 发**。
- **任何一发越过上限 / 墙钟到顶** ⇒ 停，保留现场与已付费原图；**不偷偷续跑**。
- **失败不自动修复、不自动重生成、不自动换模型**。
- **Stage A 失败**（契约 / `frames` / 候选 import / 上游）⇒ 保存 run 现场与 ledger，停；
  不进入 Stage B。`frames` 候选按 P0-06 口径明确失败，不会产生生图花费。

## 已知风险

1. **风格错配**：fixture 的 `style.png` 是黄昏小站、`intent.md` 是废土寻宝 —— 有意错配。
   产物应带参考图的色板 / 形状语言，题材来自文本；风格判读会有主观项。
2. **新游戏的可玩性未知**：planner 可能产出与 v7 不同的关卡；smoke 的状态感知输入是通用的，
   但若新 config 没有 pickup / gate，smoke 会按阶段失败——这正是 P0-FINAL 要记录的结果。
3. **生图帧数 / 抠底**：模型可能画错帧数或抠底失败；图已付费，包会失败。
4. **代理**：9098 无监听；若临时转发失败 ⇒ **零付费停住**，不改 config、不换上游。

## 需要你给的授权

### 推荐：两段授权

先发 Stage A：

> **批准 P0-FINAL Stage A：理解层，≤15 文本请求，0 生图，15 分钟，代理 9098→7890。**

Stage A 跑完我会报：recipe 路径、`imageCalls` 精确数、drawlist 数、ambiguity、文本 ledger。
然后另发 Stage B：

> **批准 P0-FINAL Stage B：<实际> 次生图 / ≤4× 请求 / 生图费用 ≤$2.00 / 文本 ≤40 请求 / 墙钟 75 分钟。**

### 也可一次授权（含硬停）

> **批准 P0-FINAL：Stage A ≤15 文本请求；Stage B 按 Stage A 实测 imageCalls，生图请求 ≤4×imageCalls、
> 生图费用 ≤$2.00、文本 ≤40 请求、墙钟 75 分钟，代理 9098→7890，无隐藏重试；
> Stage A 报出 >14 次生图或 >8 个 drawlist 资源先停再报。**

未收到上述任一授权语句前，本票**不发任何文本 / 生图请求**。

## 预检证据

- [`runs/2026-10-22-real/preflight/preflight.txt`](../runs/2026-10-22-real/preflight/preflight.txt)：
  Node / pnpm / Chrome / 磁盘 / 端口 / 输入哈希 / 归档 `imageCallsOf = 11`。
- [`runs/2026-10-22-real/preflight/check-links.txt`](../runs/2026-10-22-real/preflight/check-links.txt)：
  `pnpm check:links` exit 1；仅 2 条既有 `.scratch` 断链，无新增。
- [`proxy-forward.mjs`](../proxy-forward.mjs)：临时 TCP 转发 9098→7890；不改 `game-maker.local.json`。

## 授权（2026-10-22，用户逐字）

> 批准 P0-FINAL：Stage A ≤15 文本请求；Stage B 按 Stage A 实测 imageCalls，生图请求 ≤4×imageCalls、生图费用 ≤$2.00、文本 ≤40 请求、墙钟 75 分钟，代理 9098→7890，无隐藏重试；Stage A 报出 >14 次生图或 >8 个 drawlist 资源先停再报。

**状态**：已授权。Stage A 与 Stage B（在硬停条件内）均已获授权；未收到授权句前零请求。
