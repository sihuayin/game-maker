# P0-FINAL：一次真实付费单跑（风格图 + 意图 → 可玩 Demo）

Labels: wayfinder:map
Tracker: local-markdown
Effort: p0-final-v1

> **本图 2026-10-22 开。** 前置：`p0-construction-v1` 已收口（非 E2E 判据 12/12；
> `CAP-E2E-01` / P0-FINAL 未完成）。
> 本图**承载执行**（覆盖 wayfinder「只规划」默认），但任何付费调用必须先过书面预算 + 逐字授权。
> 不改 `game-maker.local.json`；不提交 / 推送，除非单独授权。
>
> ⚠️ **2026-10-22 Stage A 失败**：`plan-assets` 连续 3 发 `empty-input`（exit 4），无 recipe、无生图；
> 失败现场 `.scratch/p0-final-v1/runs/2026-10-22-real/.failed-2026-10-22T08-18-36-700Z/`。
> Stage B 未开始。处置选项见 [票 02](issues/02-stage-a-understanding.md)。
>
> **2026-10-22 裁定 B**：先修文本上游（`cc-switch`），再用 1 次探针验证强制工具调用；
> 探针通过后才重跑 Stage A。见 [票 05](issues/05-fix-text-upstream.md)。
> **2026-10-22 探针（1 次，已授权）**：`ok: true`，但响应 `model` 仍是 `deepseek-flash`——
> cc-switch 的切换未在代理侧生效。探针证明小 schema 的强制工具调用可用，Stage A 的失败更可能是
> 大 schema / 数据丢失。下一步选项见票 05。
> **2026-10-22 plan-only 重试**：3/3 失败（`empty-input` / `schema` / `empty-input`），模型仍 `deepseek-flash`；
> 实际 $0.010806（略超 $0.01 授权上限，已停）。结论：不是偶发，需真正切换 provider。
>
> ⏸️ **2026-10-22 暂时停止（用户指令）**：P0-FINAL 因文本上游阻塞而**暂停**，
> 未达到 `docs/v4/P0-00-p0-scope.md` §7.3 的成功或失败结论。
> **当前状态**：`CAP-E2E-01` / P0-FINAL 仍**未完成**；不得无条件宣称 P0 全部验收通过。
> **已发生**：文本 ≈ $0.0297（Stage A $0.0188 + 探针 $0.0001 + plan-only $0.0108）；生图 $0。
> **恢复路径**：切换 cc-switch provider（MiniMax-M2.7 / 千问 qwen3.8-max）→ 探针 → plan-only →
> 重跑 Stage A → Stage B → 结论（票 04）。详见 [票 05](issues/05-fix-text-upstream.md)。
> 见 [票 05](issues/05-fix-text-upstream.md)。



## Destination

一次真实付费单跑：`create`（风格图 + 意图）→ `build`（pack → config → QA → site）
→ headless smoke / 人工检查。必须记录输入哈希、命令、退出码、run/pack/site 路径、ledger/成本、
QA 报告、截图、玩法轨迹、失败与重试。成功 ⇒ 可宣告「单跑 E2E 已验证」；
失败 ⇒ 保存现场、登记缺口，**不得把失败重试成成功**。

## Notes

- **输入**：`fixtures/e2e/wasteland-platformer/style.png`（sha256 `76ed648e…f89d0`）
  + `intent.md`（sha256 `314efbd6…7eb1`）—— W6 同款。
- **付费闸**：书面预算报告见 [01](issues/01-budget-and-authorization.md)；未获逐字授权前零付费。
- **生图**：`gemini-3.1-flash-lite-image`（config 只读）。config 的代理 `127.0.0.1:9098`
  当前无监听；运行前起一个**临时 TCP 转发 9098→7890**，不改配置文件。
- **文本**：`ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` 已设；本地端口 `15721` 已开。
- **环境**：Node v22.23.2 · pnpm 10.7.1 · Chrome 155.0.8059.85 · 磁盘 506 GB 可用。
- **证据**：`runs/2026-10-22-real/`；测试产物只写这里或 `out/`。
- **工作树纪律**：不改 `game-maker.local.json`、v7 包、`fixtures/`；不 `reset` / `clean`；
  不提交 / 推送除非单独授权。
- **证据分级**：E0 推测 / E1 源码 / E2 测试 / E3 真实产物 + 运行证据（命令 + 退出码 + 路径）。

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

（无）

## Not yet specified

（无。处置已裁定 B：修文本上游 → 探针 → 重跑 Stage A；见票 05。）

## Out of scope

- **改代码 / 契约 / 流水线**：执行中发现真实缺陷时另开票，不在本图顺手修。
- **自动修复 / 自动重生成 / 隐藏重试**：失败即保存现场、登记缺口。
- **修改 `game-maker.local.json`**：凭证 / 模型配置只读。
- **提交 / 推送**：每次单独授权。
