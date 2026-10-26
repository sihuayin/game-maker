# 票 05 · 付费 E2E（Stage B 生图 → 站点 → smoke）· 书面预算报告

Date: 2026-10-25 · 作者：main session

## 前置（已就绪）

- Stage A 已跑通（票 07 探针）：`runDir = wasteland-scavenger-recipe/run/v1`，recipe 9 资源，`imageCalls=13`。
- 文本上游 gemini（`text` 段 · gemini-3.5-flash · proxy 7890）；生图上游 gemini-3.1-flash-lite-image（`image` 段 · proxy 7890）。
- ClashX 7890 已监听；`unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN`（否则 env 盖掉文件 gemini）。

## 执行链（Stage B）

1. `build wasteland-scavenger-recipe/run/v1` → pack（生图 13 次 + drawlist 文本）→ compile-runtime（config）→ QA → site。
2. headless smoke（`pnpm test:playable`）验证可启动 / 可操作 / 可通关。
3. 人工对照（P0-06 风格接入）：保存参考图 / 关键资源 / 最终画面证据。

## 零付费预检（先跑，不花钱，任一不过就零付费停住）

- 生图上游解析对（gemini · gemini-3.1-flash-lite-image · proxy 7890 · key 53）。
- 文本上游解析对（gemini · gemini-3.5-flash · proxy 7890 · key 53）。
- 磁盘空间够（包 + site 产物）。

## 预算

| 项 | 上限 |
|---|---|
| 生图调用 | **13**（按 recipe 实测 imageCalls） |
| 生图请求 | **≤ 52**（13 × 4 发，Gemini 引擎每调用最多 4 发） |
| 生图费用 | 正常 ≈ $0.44（13×$0.0336）· 最坏 ≈ $1.75（52×$0.0336）· **硬上限 $2.00** |
| 文本请求 | **≤ 20**（drawlist ~8 + compile-runtime 1 + 重采样） |
| 墙钟 | **60 分钟**（build + smoke + 人工） |

> 生图单价按 `gemini-3.1-flash-lite-image` ≈ $0.0336/张（1K）估（沿用 prior 口径）；文本单价不在此按金额估、按请求数封顶。实际账单以你 Gemini 为准。

## 失败 / 重试策略（不隐藏）

- 生图：每调用最多 4 发，只有 5xx/429/网络/NO_IMAGE 才重试；帧数/内容/抠底校验失败**不重试**。
- 文本：结构化调用最多 3 发 + `empty-input` 6 发档。
- 任何一发越过上限 / 墙钟到顶 ⇒ **停**，留现场与 ledger，不偷偷续跑。
- 失败不自动修复、不换模型、不重试成成功；按 demo.md 6 条 P0 逐条记验收结果与已知限制。

## 需要你给的授权（逐字）

> 批准付费 E2E Stage B：build `wasteland-scavenger-recipe/run/v1`，生图 13 次 / ≤52 请求 / 生图费用 ≤$2.00 / 文本 ≤20 请求 / 墙钟 60 分钟，无隐藏重试；预检不过零付费停住。

## 授权（2026-10-25 用户逐字）

> 批准付费 E2E Stage B：build wasteland-scavenger-recipe/run/v1，生图 13 次 / ≤52 请求 / 生图费用 ≤$2.00 / 文本 ≤20 请求 / 墙钟 60 分钟，无隐藏重试；预检不过零付费停住。

## 授权（2026-10-26 用户逐字 · 票 09 收口后重跑）

> 授权重跑（同预算）：重新 create（Stage A 重生成清单 + Stage B 生图）+ build + site + headless smoke，用 wasteland fixture。生图 ≤$2.00 / ≤52 请求、文本 ≤20 请求、墙钟 60 分钟、无隐藏重试、预检不过零付费停住。

> 背景：2026-10-25 那次授权的是「build 既有 run/v1」——已跑过、烧在背景覆盖（票 08 定位、票 09 修复）。
> 旧 run/v1 的清单仍是 320×180 坏背景，重跑 build 只是拿坏清单再烧生图；票 09 的提示词 + 闸只在
> 重新 `create` 时生效。故本次 = 重新 `create`（非旧 build）。

## 授权（2026-10-26 用户逐字 · 票 11 收口后第二次重跑）

> 授权重跑（同预算）：重新 create（Stage A + Stage B 生图）+ build + site + headless smoke，用 wasteland fixture。生图 ≤$2.00 / ≤52 请求、文本 ≤20 请求、墙钟 60 分钟、无隐藏重试、预检不过零付费停住。

> 背景：上一发（2026-10-26 第一次重跑）烧在 `compile-design`（`mech-explore`，票 10 定位、票 11 修意图层），
> 只花了 ~5 文本、**生图 0**。本次是**首次真正花生图钱**（Stage B）。

## 授权（2026-10-26 用户逐字 · 票 13 收口后第三次重跑）

> 授权重跑（同预算）：重新 create（Stage A + Stage B 生图）+ build + site + headless smoke，用 wasteland fixture。生图 ≤$2.00 / ≤52 请求、文本 ≤20 请求、墙钟 60 分钟、无隐藏重试、预检不过零付费停住。

> 背景：上一发（第二次重跑）推进到 QA，`constructive-constraint` 2 条硬失败（run/patrol 4 帧 AR 4.0 压扁，
> 票 12 定位、票 13 修帧表网格排版）。本次 = 第三次重跑，验证帧表 AR 修复。

## 授权（2026-10-26 用户逐字 · 票 15 收口后第四次重跑）

> 授权重跑（同预算）：重新 create（Stage A + Stage B 生图）+ build + site + headless smoke，用 wasteland fixture。生图 ≤$2.00 / ≤52 请求、文本 ≤20 请求、墙钟 60 分钟、无隐藏重试、预检不过零付费停住。

> 背景：上一发（第三次重跑）推进到 QA，`constructive-constraint` 只剩 patrol 25.3%（enemy 画竖、框 32×32 方，
> 票 14 定位、票 15 改提示词「按身份定尺寸」）。本次 = 第四次重跑，验证 enemy 高框方向。
