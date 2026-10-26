# 票 07 · 真 gemini 探针 · 书面预算报告

Date: 2026-10-25 · 作者：main session

## 目标

验证 `gemini-3.1-flash` 对 `emit_asset_recipe`（`RecipeToolSchema` 大 schema）能否**稳定产出有效 recipe**。
这正是 deepseek 卡在约 1/8 成功率的地方，也是换 provider 的唯一理由。假上游只证了「形状对」，
gemini 对大 schema 的真实可靠性只有真调用能证。

## 探针设计

跑一次 `create`（**不带 `--yes`**）到清单检查点为止（Stage A），文本上游走 gemini：

- 前四步（visual-world → intent → design → character-dna）也要真跑 —— 它们是 plan-assets 的输入。
- **判据** = 跑到清单检查点、`parseRecipe` 过契约（exit 0）。
- 若 plan-assets 出现 `empty-input` / `schema` / `no-tool-use`，记下具体失败与成功率，**不盲目重试成成功**。
- 生图 0 次（Stage A 停在清单处，不进入 build/pack）。

## 零付费预检（先跑，不花钱，任一不过就零付费停住）

1. ClashX `7890` 监听？（gemini 出站链路 = `text.proxy 7890 → ClashX → Google`）
2. `unset ANTHROPIC_BASE_URL ANTHROPIC_AUTH_TOKEN` —— env 优先，不 unset 会用旧的 cc-switch/deepseek。
3. `resolveTextTransport` 解析出 `protocol=gemini` · `model=gemini-3.1-flash` · `baseUrl`/`proxy` 正确 · key 长度 53。
4. gemini 端点经 7890 的 TCP/TLS 可达（免费握手，不发 API 请求，不发 token）。

## 预算（文本按请求数封顶 —— 沿用 prior 口径：文本单价不在本仓记录，不按金额估）

| 项 | 上限 |
|---|---|
| 文本请求 | **≤ 25**（5 步 × 3 发 + plan-assets 的 `empty-input` 单独 6 发档） |
| 生图 | **0** |
| 墙钟 | **20 分钟** |
| 费用 | 按请求数封顶（≤25），不按金额估算 |

## 失败 / 重试策略（不隐藏）

- 结构化调用首发 + 重采样（`STRUCTURED_CALL_ATTEMPTS=3`）；plan-assets 的 `empty-input` 单独 6 发（既有 `EMPTY_INPUT_ATTEMPTS=6`）。
- 任何一步越过上限 / 墙钟到顶 ⇒ **停**，保留现场与 ledger，不偷偷续跑。
- 失败不自动修复、不换模型、不重试成成功。

## 需要你给的授权（逐字）

> 批准 gemini 探针：`create`（不带 `--yes`）Stage A，文本上游 gemini-3.1-flash，≤25 文本请求 / 0 生图 / 20 分钟，无隐藏重试；预检不过零付费停住。

## 授权（2026-10-25 用户逐字）

> 批准 gemini 探针：create（不带 --yes）Stage A，文本上游 gemini-3.1-flash，≤25 文本请求 / 0 生图 / 20 分钟，无隐藏重试；预检不过零付费停住。
