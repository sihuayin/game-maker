# 06. 文本上游阻塞处置（deepseek 对 emit_asset_recipe 大 schema 不可靠）

Type: grilling
Status: resolved
Owner: main session · 2026-10-25
Map: ../map.md

## Question

票 01 研究确认：唯一剩余阻塞 = 文本上游 `deepseek-v4-pro` 对 `emit_asset_recipe` 大工具 schema 系统性不可靠
（empty-input 丢入参 + schema 不过契约，实测约 1/8 成功率）。用户 2026-10-24 在 `recipe-config-gap-v1` 曾裁定
**暂不换 provider**（见其 map Out of scope / 票 07）。repo 侧已落 `EMPTY_INPUT_ATTEMPTS=6`（票 13），非根解。

裁定本图如何处置这个阻塞，至少覆盖：

1. **换 provider**（MiniMax-M2.7 / qwen3.8-max，cc-switch 用户侧操作）—— 已知恢复路径，此前被暂缓；
2. **repo 侧拆 schema / 改工具形状**—— 让 deepseek 对小 schema 稳定（新 effort，之前只做重试档没做拆 schema）；
3. **接受 ~1/8 + 重试硬扛**—— 零决策变更，付费成本暴涨、不可靠；
4. **接受阻塞**—— 本图目的地停在阻塞态，Demo 暂不可达。

HITL：用户逐字裁定，不替用户答。

## Answer（裁定 · 2026-10-25 用户逐字）

**Q 裁定：选择 (a)。** 使用 `recipe-config-gap-v1` 票 07 已记录的 provider 恢复路径，通过 cc-switch 切换至
推荐 provider，解除 `emit_asset_recipe` 大 schema 调用的已知阻塞。本票不修改 repo，不启动 schema 拆分工程，
不改变零付费默认约束。切换后验证 recipe 产出，并继续 FPVS-V1-P0 的真实 Demo 交付。若恢复失败，停止盲目重试，
提交失败证据后再裁定后续路径。票 06 收口后，票 05 可进入独立授权流程，但不得据此执行未经书面授权的付费 E2E。

**裁定边界**：

1. **Provider**：优先按票 07 已写方案，在 MiniMax-M2.7 与 qwen3.8-max 中选择；不在本票重开 provider 评估。
2. **Repo**：本票不改仓库代码、工具 schema、重试策略。
3. **执行**：通过 cc-switch 切换 provider；切换后先验证 `emit_asset_recipe` 稳定产出有效 recipe，再继续 Demo 创建流程。
4. **成本**：本票不授权付费 E2E，不改变零付费默认约束；切换 ≠ 授权产生额外费用。
5. **回退**：若票 07 恢复路径无法奏效，停止盲目重试，记录失败证据，再单独裁定是否启动 (b)。
6. **票 05**：票 06 收口后可进入付费 E2E 方案准备与授权流程；不代表已获准执行，仍须单独书面授权。

**为什么不选其他**：(b) 拆 schema 是长期改进但属新仓库工程、无证据必解决阻塞；(c) 重试硬扛约 1/8×6 次
不保证可靠且增成本；(d) 接受阻塞 —— 恢复路径未尝试、没必要放弃 Demo 交付。

**补记（2026-10-25 用户改口径）**：不再走 cc-switch 切 MiniMax/qwen，改为**直连 Gemini（gemini-3.1-flash）**、
key 复用 `game-maker.local.json` `image` 段，需改 repo 加 gemini 文本协议（覆盖本票边界 #2「不改 repo」）。
执行落 [票 07](../issues/07-switch-provider-verify-recipe.md)。
