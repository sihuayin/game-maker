# P0-04 结论包与 HITL 裁定

Type: grilling
Status: resolved
Owner: amber（HITL）· 2026-11-08
Blocked by: 08
Map: ../map.md

## Question

汇总 P0-01～P0-03 的证据，回答 PRD §6 六个问题，提出 GO / CONDITIONAL GO / NO-GO 建议；由用户作最终裁定。

### 必须交付

- `evidence/04-final-report.md`：
  1. Runtime 时间语义是否足够明确？
  2. 单移动 Hazard 是否能建立可信的时序模型？
  3. 是否能正确识别等待后的安全窗口？
  4. 是否能证明确定封路，而不是依赖采样猜测？
  5. 算法的性能和状态空间是否可控？
  6. 是否值得进入正式 Pipeline 集成？
- 每条结论附 E1 / E2 / E3 证据索引；保留 `NO_PROVEN_BLOCKER` ≠「可玩」的区别。
- 建议：GO / CONDITIONAL GO / NO-GO；若 GO 或 CONDITIONAL GO，写明**推荐范围与前置条件**，但不产出集成方案、不改生产代码。
- 残余风险与未确认事项清单。
- 本票 `## Answer` 记录用户的最终裁定原文。

### 边界

- 不启动集成、不修改 Runtime / 生产判据 / 公开契约 / Pipeline / Publish Gate。
- 只有用户明确裁定后才能关图；未裁定不得自行关图。

## Answer

- **报告路径**：`.scratch/level-playability-v1.1-p0/evidence/04-final-report.md`
- **最终裁定**：**GO — 技术可行性得到支持**
- **裁定口径**：Q1(a) 技术可行性口径；Q2(a) 能力证明 + 结果层旁证
- **本票开始 HEAD / 回退点**：`3042ba8`
- **产物**：`evidence/04-final-report.md`、本票、`map.md`（收口）
- **命令与退出码**：`node --test .scratch/level-playability-v1.1-p0/prototype/temporal-model.test.mjs` → `EXIT=0`，12/12。

### 用户最终裁定原文

> 我的裁定：Q1 选 (a)，Q2 选 (a)。两项均接受推荐方案。
>
> ## Q1 — GO 的口径
>
> 接受 (a)：技术可行性口径
>
> GO 的含义限定为：
>
> > 现有证据足以支持 Temporal Playability 的技术可行性，可以据此规划正式集成方案；不代表集成设计已经完成，也不授权 Runtime、Pipeline 或其他生产代码实施。
>
> 因此，PRD §6 的「证据充分，可以规划正式集成」与 P0-03R 的「技术可行性得到支持」并不冲突。应明确区分：
>
> - 允许： 研究集成边界、设计方案、评估成本和风险、提出后续实施 PRD。
> - 不允许： 直接开始集成、修改 Runtime / Pipeline / contracts / CLI / MCP，或将 GO 当作实施授权。
>
> 不选择 (b)，因为当前证据没有证明集成就绪。
>
> ## Q2 — A 案的结论强度
>
> 接受 (a)：能力证明 + 结果层旁证
>
> 结论包采用以下措辞：
>
> > 算法具备识别等待窗口的能力。A 案真实 Runtime 提供结果层旁证，证明该案例存在安全通过方式；但 Runtime 采用等待后跳跃，且跳跃发生在分析器窗口结束之后（3276ms > 2733ms），因此未验证算法所给出的水平等待 witness，也未证明两者机制等价。
>
> 明确禁止使用「安全窗口已通过真实 Runtime 验证」这一表述。
>
> ## 最终写入结论包的统一口径
>
> 建议将两项裁定合并为以下声明：
>
> > GO — 技术可行性得到支持。 当前证据表明，Temporal Playability 对本阶段限定范围内的单个移动 Hazard，具备识别时序安全窗口、证明特定永久封锁，以及在关键输入不确定时正确降级为 `INSUFFICIENT_EVIDENCE` 的能力。A 案的 Runtime 结果仅为安全通过方式的结果层旁证，不构成水平等待机制的 Runtime 验证。该结论允许规划正式集成，但不代表集成就绪，也不构成任何生产代码修改或集成实施授权。
>
> 最终裁定：Q1(a)、Q2(a)。 P0-04 可以按上述口径形成 GO 结论；后续集成必须另开 effort 并单独授权。
