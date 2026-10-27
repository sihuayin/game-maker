# 04. qa-report 扩展契约 + 版本绑定裁定

Type: grilling
Status: resolved
Owner: main session · 2026-10-27
Map: ../map.md
Blocked by: 01

## Question

裁定 qa-report.json 的扩展契约（FR-01 + FR-05 + FR-06 摘要），至少定：

1. **落点与版本**：扩展现有 `qa-report/v1` 还是升 `qa-report/v2`？审计（票 01）已知 schema 在 `contracts/src/qa.ts`、
   升版会迫使旧报告解析不过（`CONTEXT.md`「账」词条教训）。新增字段作为新顶层键，还是新增一个「交付验收」子对象？
2. **字段集**：执行标识 / 资源包·配置·站点版本标识 / 各检查项状态 / 失败原因 / 证据引用 / 最终交付状态 /
   视觉评审状态 —— 每个字段的精确类型，尽量复用已有类型（`subject`、`RunIdentity`、`QAVerdict`、`Observation`）。
3. **版本绑定**：报告如何绑 pack/v<N> ↔ game-config ↔ site/v<N>（复用 `subject`{packId,packVersion,manifestChecksum}
   + site 的 `site.json`{shell,pack,config} + run version）。审计已知 site 在 shell 层装配（pipeline 不碰 demo）、
   `assertPublishableQa` 是自然缝 —— site 版本在 QA 报告生成之后才有，报告如何拿到它？
4. **失败也落盘**：审计已知 qa-report「先落盘再抛」，但 pack/config/QA 之前失败时无报告 ——
   交付结论是否也要在早失败时落盘（BLOCKED/FAIL），还是只在 QA 之后聚合？
5. **摘要（FR-06，P1）**：CLI 终端摘要如何从报告派生（复用现有「观察摘要」`观察摘要` 词条）。

HITL：用户逐字裁定，不替用户答。

## Answer（裁定 · 2026-10-27 用户逐字）

**裁定原则：加性扩展、复用现有契约、按实际执行阶段落盘、不将缺失结果解释为通过。**

### Q1 — 报告落点与版本：采纳

扩展 `qa-report/v1`，**不升版**。顶层新增可选字段 `delivery?: DeliveryReport`，现有字段（format/subject/checked/failures/observations）保持不变。
兼容性要求：旧报告无 `delivery` 仍能解析；新报告可带 `delivery` 但不得改既有 QA 字段语义；`delivery` 不存在不代表交付通过；
QA 层继续记检查事实、交付层聚合状态与结论；不新增平行报告文件为主报告、不升版。

### Q2 — delivery 字段集：采纳（补两约束）

约束一：站点尚未生成时允许缺少 `site`。约束二：必需检查项必须有明确判定依据（`checks` 形状无 `required` 字段，
实施用**代码中的固定检查项注册表**声明每个 `key` 是否必需及其判定规则；不得靠 `not-required` 隐式绕过必需检查）。

```ts
interface DeliveryReport {
  runId: string;
  pack: { packId: string; packVersion: number; manifestChecksum?: string };
  config: { file: string };
  site?: { version: number; shell: string };
  checks: Array<{ key: string; status: DeliveryCheckStatus; detail?: string }>;
  verdict: DeliveryVerdict;
  visualReview: { status: "pending" | "pass" | "fail"; reviewer?: string; reviewedAt?: string; note?: string };
  evidence: Array<{ ref: string; path: string }>;
  knownLimitations?: string[];
}
```

字段语义：`runId` 复用 run/v<N> 命名；`pack` 复用 subject；`config.file` 指向实际使用的配置；`site` 仅在已获版本时填；
`verdict` 由检查项状态 + 必需性确定性计算；`visualReview` 独立于 QA 结果；`evidence` 引用日志/试玩/截图；`knownLimitations` 记确认限制不代替状态。
站点信息可选的理由：QA 失败或站点失败时站点版本尚未产生，强制必填会逼系统伪造版本或造无效报告 → 站点已装配填真实、未装配省略并在检查项记 `blocked`/实际失败，不得用旧站点版本填充。

### Q3 — 版本绑定：采纳「分阶段补全」（非无条件 patch）

阶段一（QA 步）：写 QA 层（format/subject/checked/failures/observations），可尚无 delivery，不提前伪造站点版本。
阶段二（交付收尾）：site 装配成功后，用 runId + subject 包身份 + 实际配置路径 + `assembleSite` 显式分配的 site 版本 + `site.json` 的 shell/pack/config，补齐 delivery、算最终状态、写回同一份 qa-report.json。
绑定规则：pack 复用 subject；站点关联以实际 site.json 为依据；config.file 指向实际 game-config.json；runId 识别执行目录、配置版本由实际关联确定（不额外发明配置版本号）；不凭文件名推断关联。
文件写入安全：增加 delivery 时保留 QA 层原始字段、不覆盖/重算；沿用现有原子替换方式，不为交付层引入状态库或平行版本目录。

### Q4 — 失败落盘策略：采纳

| 失败位置 | qa-report.json | delivery | 最终状态 |
|---|---|---|---|
| 资源包生成失败，QA 未开始 | 现有机制 | 不强行创建 | 失败现场+退出码+失败账本 |
| 配置生成失败，QA 未开始 | 现有机制 | 不强行创建 | 同上 |
| QA 硬失败，报告已落盘 | 保留 | 补写：QA fail、下游未执行按原因记 | `fail` |
| 站点构建确定性失败 | 保留 | 记站点失败+证据 | `fail` |
| Smoke 有确定性玩法失败证据 | 保留 | 记失败步骤+证据 | `fail` |
| Smoke 未完成原因不明 | 保留 | 记未完成+证据 | `incomplete` |
| 视觉评审明确不通过 | 保留 | 视觉 fail | `fail` |
| 视觉评审尚未完成 | 保留 | 视觉 pending、对应必需检查 incomplete | `incomplete` |
| 收尾意外异常 | 尽可能保留 | 能确定则写，否则不伪造通过 | 不得 `pass` |

QA 硬失败特殊处理：不等待 site 装配、在 QA 失败路径尽早收尾 —— QA 项 fail、未执行的 site/smoke 项 blocked（确因 QA 失败无法执行）、
视觉未评审保留 pending 且对应必需视觉检查记 incomplete（视觉未评审 ≠ 前置阻塞）、最终由确定性规则算 fail。
收尾失败不覆盖原始失败：原始失败不得改写为成功；保留原 qa-report.json；通过日志/退出码暴露收尾错误；不声称报告已完整落盘。

### Q5 — CLI 摘要与优先级：采纳（P1，不阻塞核心）

终端摘要复用观察摘要机制，追加交付聚合（最终 verdict + 失败项 + 未完成项 + 视觉评审状态 + 已知限制）。
从 `delivery` 派生；不重复输出完整报告；`--json`/MCP 复用同一结构化数据、不另建交付状态计算逻辑；
`delivery` 不存在时兼容旧报告并明示「尚无交付结论」，不默认显示 pass。
优先级：先完成（契约兼容 → 状态映射/计算 → 版本绑定 → 成功与失败路径收尾 → 自动化测试），终端摘要放 P1 后续。

### 最终实施检查清单

- [ ] 保留 qa-report/v1，新增可选 delivery
- [ ] 复用现有 QA 报告类型，不破坏旧报告解析
- [ ] 明确每个交付检查项必需性及状态映射
- [ ] 允许站点未生成时省略 site
- [ ] 绑定真实 run/pack/config/site 产物
- [ ] QA 成功后能继续补齐 delivery
- [ ] QA 失败时能提前写入失败结论
- [ ] 站点/Smoke/视觉失败或未完成时正确落盘
- [ ] 失败收尾不覆盖/伪造原始事实
- [ ] 测试旧报告兼容、站点未生成、QA 硬失败、收尾异常
- [ ] CLI 摘要列 P1，不阻塞核心报告交付
