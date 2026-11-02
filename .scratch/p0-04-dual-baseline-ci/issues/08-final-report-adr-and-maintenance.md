# 最终验收报告、ADR 与维护文档

Type: task
Status: resolved
Blocked by: 07

## Question

收口 P0-04：把审计、锚点、双基线 CI、更新通道与真实 PR 证据汇总为一份可复核的最终报告，并补齐架构与维护文档。

### 必须完成

1. **AC 矩阵**：逐条覆盖 PRD §6 的 AC-01–AC-16，给出 PASS/FAIL、证据链接（命令、退出码、路径、run/PR URL、SHA）。
2. **结论边界**：
   - 明确区分“FPVS-V1 基线可信交付已验证”“P0-02 第二套基线可信交付已验证”“两套基线均已接入同一套可信 CI 保护机制”；
   - **不得**扩展为“第二个独立游戏 Demo 已完成端到端生成验收”；
   - 如实报告 owner-only 限制与 P0-03 继承的限制。
   - 披露 A/B **73** 个绝对路径重叠（28 个双方 required），表述为“逻辑独立、物理证据部分重叠”。
3. **零回退**：核对 A 的 223/151/72/13、Anchor、更新日志、四项 required checks、ruleset 行为；B 的 231/137/94/6、冻结 112 文件；两者均零修改。
   - 112 冻结文件的完整性证据必须来自 `freeze-sha256.txt` 逐条复核（与 01 审计一致）；说明其中 `v1/v2 chrome.log` 不在 231 清单，以及该哈希清单是否被 CI 钉住；若未钉住，列为已知限制。
   - optional 94 的精确构成：`oldWork` 93 + `v3/chrome.log` 1；不要把 94 全部表述为“旧 work 文件”。
4. **文档**：
   - 在 `docs/adr/` 续写或新增 ADR，记录双基线信任边界、registry 不是信任根、更新通道语义；
   - 写维护说明：如何新增/更新基线、如何诊断 A/B 失败、owner 通道操作步骤、负向 PR 验收步骤；
   - `CONTEXT.md` 只在确实产生新领域术语时更新，保持词汇表，不写实现细节。
5. **最终 verdict**：`.scratch/p0-04-dual-baseline-ci/final-verdict.json`，机器可读记录 AC 结果、关键 SHA、PR/run 链接、零付费声明。
6. **回归**：`pnpm test`、`pnpm typecheck`、`pnpm check:links` 全绿；不引入付费调用。
7. **本票一个 PR**。

### 03 裁定输入（2026-11-01）

- AC 矩阵必须**单列** `freezeHashes` 不可被普通更新改写（03 Q3/Q8）；不得用其他 AC 通过抵消。
- 112 冻结文件完整性必须由 `freeze-sha256.txt` 逐条复核；2 个 `chrome.log` 虽不在 231 Manifest，也属于冻结身份边界（03 Q8）。
- 如实披露 A/B head-side 信任元数据检查**非对称**：A 只比 Manifest，B 比 Manifest + Anchor + 更新日志 + `freezeHashes`；Registry 字节相等（03 Q2）。不得声称 A/B head-side 检查完全对称。
- Registry schema、未知字段拒绝、A/B 路径交叉、集合断言与单元测试必须记录（03 Q1/Q10）；Registry 不纳入 `pnpm check` 的决定也要写明。
- 更新通道必须记录 owner PR + 只读 dispatch、`baseline` 必填、非目标字节相等、无自动写回、审计字段使用 `github.actor_id`/`triggering_actor`（03 Q3）。
- 负向样本记录 03 Q11 指定路径与“B setup.json 为 B-only required”的复核证据；披露 73 路径重叠（28 双方 required）与 optional 94 = `oldWork` 93 + `v3/chrome.log` 1。
- 回归：04 的 B Anchor 可复算记录、05 的 bootstrap dispatch、06 的 `freezeHashes` 拦截证据都必须进入 AC 矩阵。

## 验收标准

- AC-01–AC-16 全部有证据；任何安全相关项失败不得用其他项通过抵消。
- 报告不夸大、不把证据完整性通过解释为游戏功能验收。
- AC 矩阵覆盖 03 的冻结覆盖、非对称 head-side 检查、Registry 校验、更新通道与负向样本要求；`freezeHashes` 独立 AC 有证据。
- 不声称 A/B 的 head-side 信任元数据检查完全对称；不声称普通更新通道可以改写 `freeze-sha256.txt`。
- 文档足以让后续维护者独立执行一次基线更新与一次负向 PR 验收。

## Answer

**结论：PASS（2026-11-02）。** 双基线可信交付能力收口；AC-01–AC-16 全部 PASS，另单列 AC-07b `freezeHashes` 不可被普通更新改写。

- 最终报告：[final-report.md](../final-report.md)
- 机器可读：[final-verdict.json](../final-verdict.json)
- 最终复核：[report.md](../runs/2026-11-02T06-45-50Z-final/report.md) · [facts.json](../runs/2026-11-02T06-45-50Z-final/facts.json)

### 基线复核

- A：223 / 151 / 72 / 13 records / 9 roots；`sha256:ba7a485b…36fd`。
- B：231 / 137 / 94 / 6 records / 3 roots；`sha256:07866e0e…b9ab`；freeze 112/112。
- A/B 路径重叠 73（28 双方 required / 30 A required-B optional / 15 双方 optional）。
- Optional 94 = `oldWork` 93 + `v3/chrome.log` 1。
- 501 个受保护文件零变化；A/B Manifest/Anchor/日志与 112 冻结文件一致。

### 规则与回归

- ruleset `26268801` active；`check` / `test` / `typecheck` / `evidence` 四项 required checks 不变；`strict_required_status_checks_policy=true`。
- `pnpm test`：161 文件 / 2,350 tests；`pnpm typecheck`；`pnpm check:links` 均通过。
- 零付费 API / 生图 / 模型调用；未新增 Provider。

### 文档

- 新增 [ADR 0002：双基线可信验收的信任边界与更新通道](../../../docs/adr/0002-dual-baseline-trust-boundary.md)。
- 新增 [双基线维护说明](../maintenance.md)：更新、诊断、owner 通道、负向 PR 验收步骤。
- `CONTEXT.md` 未新增词条：本图没有产生需要进入词汇表的新领域术语。

### 结论边界与限制

- FPVS-V1 基线可信交付已验证；P0-02 第二套基线可信交付已验证；两者受同一套可信 CI 保护。
- **不**扩展为“第二个独立游戏 Demo 已完成端到端生成验收”。
- owner-only：owner 仍有 bypass；未证明非管理员无法绕过。
- A 的 head-side 只比 Manifest；B 比 Manifest + Anchor + 更新日志 + `freezeHashes`；非对称，不声称完全对称。
- 2 个 Manifest 外 `chrome.log` 由 112 freeze hash list 覆盖；该 hash list 由 CI 钉住，但不是普通更新目标；重新冻结需新裁定。
- 负向 PR #20–#23 按纪律保持 OPEN/BLOCKED、未合并。
