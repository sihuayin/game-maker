# 文本上游修复：让 plan-assets 稳定产出非空 recipe 入参

Labels: wayfinder:map
Tracker: local-markdown
Effort: text-upstream-v1

> **本图 2026-10-22 开，2026-10-22 收口。** 前置：`p0-final-v1` 因文本上游阻塞而暂停 —— Stage A 的
> `plan-assets` 连续 3/3 返回 `empty-input`（工具被调、入参丢失），无 recipe、无生图。
> 本图**承载验证**（覆盖 wayfinder「只规划」默认），付费上游调用逐字授权；不重跑完整 create、
> 不生成资源、不提交 / 推送。
> ✅ **2026-10-22 收口**：根因 = DeepSeek 卡 `ANTHROPIC_MODEL` 兜底把字面 `deepseek-v4-pro` 降级成
> `deepseek-flash`；改为 `deepseek-v4-pro` 后，探针 + plan-only 一发通过（6 资源 recipe、过契约）。
> 累计文本花费 **$0.0044262 / $0.25**。上游已可靠，交回 `p0-final-v1` 重跑 Stage A。
> ⏸️ **下游结果（2026-10-22）**：p0-final-v1 的 Stage A 重跑中，文本上游正常（3 步全 HTTP 200、v4-pro），
> 但撞上 **R12 intent-mechanic-missing**（语义契约缺口，与本图无关）。P0-FINAL 真实阻塞已改记为 R12，见 p0-final-v1。

## Destination

判定 `plan-assets` 空入参的根因（**provider 映射没生效** vs **大 `emit_asset_recipe` schema
丢数据**），决定修法（可含最小仓库侧改动），并**验证到位**：切 provider → 探针 → plan-only
重试跑通，让 `plan-assets` 稳定产出**非空、过契约、可作 recipe 合法输入**的结果，从而解开
`p0-final-v1` 的 Stage A。

## Notes

- **领域 / 事实**
  - 上游：`cc-switch`（`127.0.0.1:15721`），请求 `deepseek-v4-pro` 被映射成 `deepseek-flash`，
    UI 里的切换**未在代理侧生效**（响应 `model` 仍是 flash）。
  - 失败签名：`empty-input`（工具被调、入参空/丢失）与 `schema`（入参有、不过契约）交替出现。
    小 schema 探针（强制工具调用）**能过**（`tool_use` + 非空 `input`）；大 schema plan-only **3/3 失败**。
  - 根因（票 01 已判定）：① DeepSeek 转译层把已生成的 `tool_use.input` 静默丢（`empty-input`）；
    ② 映射把 `v4-pro` 降成 `deepseek-flash` 的弱模型质量（`schema`）。「大 schema 太大」已被推翻
    （schema 10,447 B 属正常量级）。「票 27」已定位：`game-maker-v2` 票 27（小 schema 丢输入，非大 schema）。
  - 关键文件：`packages/contracts/src/recipe-tool.ts`（v4 镜像 schema，`emit_asset_recipe` 的
    `toolInputSchema` 来源）、`recipe.ts`（v3 权威，含全部 `refine` 判据）、
    `packages/assets/src/prompt.ts`（`PLAN_TOOL_NAME` / `PLAN_TOOL_DESCRIPTION`）。
  - 失败现场：`.scratch/p0-final-v1/runs/2026-10-22-real/.failed-2026-10-22T08-18-36-700Z/`
    （`game-design.json` + `visual-world.json` 供 plan-only 重试复用）。

- **裁定（2026-10-22，用户）**
  - **Q1=B**：范围含仓库侧最小必要改动；根因判定 + 修法决定是本图产出。
  - **Q2=B**：承载验证（真切 provider、真发探针、真跑 plan-only 重试）。
  - **Q3（2026-10-22 重裁定，原 A 作废）**：第一个先把 **DeepSeek 映射真正切到 `deepseek-v4-pro`**
    （当前被 `ANTHROPIC_MODEL=deepseek-flash` 硬兜底降级）；失败按
    **`MiniMax-M3.1-Flash → qwen3.8-max → relay`** 推进（票 03：M2.7 已退市）。
    每次切换记录 provider / 模型 / 错误类型 / 实际花费。
  - **Q4**：本图文本请求**硬上限 $0.25**（非目标消费额）；到顶即停，不自动续跑、不追加。
  - **Q5=A**：plan-only 重试通过即「验证到位」；完整 `create` Stage A 重跑归 `p0-final-v1`（出界）。

- **执行纪律（强制）**
  - 先探针、再 plan-only；探针失败不继续消耗预算；探针成功 ≠ plan-only 已通过。
  - 按**实际消费**记账（provider / 模型 / 尝试次数 / 成败 / 错误 / 可核实花费），不拿估算单价顶账。
  - 重试有上限：到预算上限 / 凭据异常 / 非预期付费行为 → 立即停。
  - **通过**必须同时满足：返回非空 + 过既有契约验证 + 可作后续 recipe 阶段合法输入。
    HTTP 200 / 可解析 JSON / 模型自称成功**都不算**通过。
  - **付费上游调用须逐字授权**；本图自身不授权任何付费请求。
  - 工作树：不改 `game-maker.local.json`、v7 包、`fixtures/`；不 reset / clean；不提交 / 推送。

- **技能**：research（票 01–03）；探针 / plan-only 用 `packages/cli/dist/cli.mjs` 与
  `.scratch/p0-final-v1/probe-tool-call.mjs` 同款脚本。

## Decisions so far

- [03. 候选 provider 的工具调用能力与单价](issues/03-provider-comparison.md)：**已收口（research）** ——
  ⚠️ **Q3=A 的「MiniMax-M2.7」已过时**：M2.7 已退市（2026-10-19 对新用户关闭、2026-11-18 下线），
  MiniMax 官方 Anthropic 端点只支持 **MiniMax-M3.1-Flash / M3**。大 schema 稳定排序（规格面）：
  `deepseek-v4-pro` ≥ `qwen3.8-max` > `MiniMax-M3.1-Flash` > Claude relay。但结合票 01 的
  「DeepSeek 转译层丢输入」实证，DeepSeek 同 relay 上换 v4-pro 未必避得开丢数据。→ 待用户重裁定
  「第一个切谁」，再更新票 04–06 与 Notes。
- [01. 根因证据：大 schema 丢数据 vs provider 映射没生效](issues/01-root-cause-evidence.md)：**已收口（research）** ——
  「大 schema 太大」假设基本被推翻：`toolInputSchema` 实测 10,447 B / 深 15 / 149 properties，
  请求体 ≈19.4 KB，属正常量级。真根因在 provider/转译侧：`empty-input` = 上游把已生成的 `tool_use.input`
  静默丢了（票 59 实测：烧 3k+ 输出 token 只回 `{}`，第 4 发能填满 20 assets）；`schema` = 映射把 `v4-pro`
  降成 `deepseek-flash` 的弱模型质量。→ 修法指向「切换 provider」，仓库侧最小修法退为低概率后备。
- [02. cc-switch 切换不生效的原因与正确切换流程](issues/02-cc-switch-mechanism.md)：**已收口（research）** ——
  切换确实没在代理侧生效（`currentProviderClaude` 仍是 DeepSeek、MiniMax `is_current=0`、日志仍转
  `api.deepseek.com/anthropic`）；最可能是「只点了编辑没点启用」或切到了 Codex 侧同名卡。MiniMax 的
  Claude provider 已在 DB 配好（端点 `api.minimaxi.com/anthropic`、四档全映射 `MiniMax-M2.7`），
  只需「启用」+ 重启 Claude Code，无需新建。
- [04. 把 DeepSeek 映射真正切到 deepseek-v4-pro 并确认代理侧生效](issues/04-fix-deepseek-v4pro-mapping.md)：**已收口（task · HITL）** ——
  DeepSeek 卡 `ANTHROPIC_MODEL` 由 `deepseek-flash` 改为 `deepseek-v4-pro`（已读 DB 核实）；字面
  `deepseek-v4-pro` 请求不再被兜底降级。端到端确认归票 05 探针。
- [05. 探针验证强制工具调用](issues/05-probe-tool-call.md)：**已收口（task · 付费探针）** ——
  探针通过：`model=deepseek-v4-pro`（修法生效、无需重启代理）、强制工具调用 + 非空入参、`ok:true`；
  实际花费 $0.000135（累计 $0.000135/$0.25）。
- [06. plan-only 重试验证 recipe 入参](issues/06-plan-only-retry.md)：**已收口（task · 付费 plan-only）** ——
  一发通过（attempts=1、零重试）：`model=deepseek-v4-pro`、产出 6 资源 recipe、过契约、exit 0；
  实际花费 $0.0042912（累计 $0.0044262/$0.25）。根因实锤 = flash 降级；**Destination 达成。**

## Not yet specified

（无。目的地已达成——v4-pro 上 plan-only 一发通过，「大 schema 丢数据」与「仓库侧最小修法」两条 fog 均已排除。）

## Out of scope

- **完整 `create` Stage A 重跑**（归 `p0-final-v1`）。
- **生成新资源 / 生图 / 视觉调用**。
- **提交 / 推送**（每次单独授权）。
- **修改 `game-maker.local.json`、v7 包、`fixtures/`**。
