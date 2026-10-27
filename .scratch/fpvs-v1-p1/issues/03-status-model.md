# 03. 统一状态模型裁定

Type: grilling
Status: resolved
Owner: main session · 2026-10-27
Map: ../map.md
Blocked by: 01

## Question

裁定本图的统一状态模型（`docs/v7.3/报告.md` FR-02 + §4.2 + §6 矩阵），至少定四件事：

1. **检查项状态词汇**：spec §4.2 给 `FAIL/INCOMPLETE/BLOCKED/PASS/NOT_REQUIRED`，但审计（票 01）确认仓库已有
   `QAVerdict=pass|fail|incomplete`、`HumanVerdict=pending|pass|fail`、`RuntimeStatus=verified|unverified|not-run` 等，
   而 `BLOCKED`/`NOT_REQUIRED` **不存在**。是沿用已有 + 新增缺失，还是统一一套新枚举？如何与 `CONTEXT.md` 的
   「观察/判据」边界对齐（判据阻断=FAIL、观察只报不阻断、未执行=INCOMPLETE、前置失败=BLOCKED、不适用=NOT_REQUIRED）？
2. **最终交付状态**：`PASS/FAIL/INCOMPLETE/BLOCKED` 的确定性计算规则 —— §6 矩阵 12 场景（A–L）全映射到判定条件。
3. **与 qaVerdict 的关系**：最终交付状态是 `qaVerdict` 的扩展，还是一个独立于 QA 的更高层结论？
   `qaVerdict` 的 `incomplete` 与最终 `INCOMPLETE` 是什么关系（前者是「QA 族没跑满」，后者是「交付结论下不了」）？
4. **观察/判据边界**：哪些进 FAIL（硬失败、错了一定不是设计），哪些只记观察不阻断（不影响 PASS/FAIL）。

HITL：用户逐字裁定，不替用户答。

## Answer（裁定 · 2026-10-27 用户逐字）

**裁定原则：复用现有判据，统一报告语义，不扩大质量门禁范围。**

### Q1 — 检查项状态枚举：采纳

新建报告层独立枚举（小写、连字符、独立于现有枚举）：

```ts
type DeliveryCheckStatus =
  | "pass" | "fail" | "incomplete" | "blocked" | "not-required";
```

| 状态 | 含义 |
|---|---|
| `pass` | 检查已执行，结果满足要求 |
| `fail` | 检查已执行，确定不满足要求 |
| `incomplete` | 检查结果不足以作出通过或失败结论，或检查未完成 |
| `blocked` | 检查因明确的前置条件缺失而无法执行 |
| `not-required` | 当前交付要求明确不要求此检查 |

实施约束：全部小写连字符；独立于 `QAVerdict`/`HumanVerdict`/`RuntimeStatus`，不改现有枚举；各层显式映射转换；
`not-required` 必须来自明确适用性规则，不能用于隐藏未执行或失败的检查。

### Q2 — 最终交付状态确定性计算：采纳

总序优先 `fail > blocked > incomplete > pass`：

```ts
type DeliveryVerdict = "pass" | "fail" | "incomplete" | "blocked";

function deriveDeliveryVerdict(checks: Array<{ status: DeliveryCheckStatus; required: boolean }>): DeliveryVerdict {
  const requiredChecks = checks.filter((check) => check.required);
  if (requiredChecks.some((c) => c.status === "fail")) return "fail";
  if (requiredChecks.some((c) => c.status === "blocked")) return "blocked";
  if (requiredChecks.some((c) => c.status === "incomplete")) return "incomplete";
  if (requiredChecks.every((c) => c.status === "pass")) return "pass";
  throw new Error("Invalid required delivery check states");
}
```

> 伪代码表达裁定规则；正式实现前由报告契约校验确保必需检查完整、状态合法，不靠异常兜底。

**生成失败与检查受阻边界**：生成阶段失败 = `fail`（不归 `blocked`；Degradation 约定上游不可达即失败）。
`blocked` 仅用于检查本身因前置缺失无法执行（例：资源生成失败 → 生成项 `fail`、验证项 `blocked`）。
「无结果且无法确定原因」→ `incomplete`，不凭空推断为 `blocked`。因 `fail` 优先级最高，最终为 `fail`。

**§6 场景矩阵最终映射**：

| 场景 | 最终状态 |
|---|---|
| A 全部通过、视觉通过 | `pass` |
| B 资源校验失败 | `fail` |
| C 配置编译失败 | `fail` |
| D 强制 QA 失败 | `fail` |
| E 站点构建失败 | `fail` |
| F 试玩未完成原因未知 | `incomplete` |
| G 试玩未完成有试玩器限制证据 | `incomplete` |
| H 试玩通过视觉待确认 | `incomplete` |
| I 视觉明确不通过 | `fail` |
| J 新产物无匹配报告 | `incomplete` |
| K 必需检查缺失原因不明 | `incomplete` |
| L 前置阶段失败后续无法执行 | `fail`（下游可标 `blocked`，但最终仍 `fail`） |

`not-required` 不参与优先级计算；必需检查不得标 `not-required` 以绕过验收。

### Q3 — 与 qaVerdict 关系：采纳

最终交付状态是独立高层结论，`qaVerdict` 是输入之一。映射：`pass→pass` / `fail→fail` / `incomplete→incomplete`。
QA 未运行或因前置无法运行 → 按实际原因映射 `incomplete` 或 `blocked`，不得伪造 qaVerdict。
语义边界：`qaVerdict.incomplete`（QA 族没跑满，QA 层事实）≠ 最终 `incomplete`（跨阶段证据不足），不同字段。

### Q4 — 观察/判据边界：采纳

沿用 CONTEXT.md「观察/判据」边界，本需求不新增判据。进 FAIL 的确定性判据：
① `QA_JUDGEMENTS` 6 条 ② 资源包确定性校验 ③ 配置契约校验 ④ 站点构建 ⑤ smoke 可玩性判据 ⑥ 视觉人工评审明确不通过（独立验收项）。
特别说明：smoke 自动玩家无法通关 ≠ 可玩性硬失败；试玩器限制/原因未定 → 记 `incomplete`，不擅自新增判据。
观察只记录、不阻断、不改变最终状态、不伪装成通过的判据。
视觉评审特殊边界：未评审 `incomplete` / 通过 `pass` / 不通过 `fail`；不引入未经裁定的自动视觉阈值；
「哪些观察升级为判据」留 P1 视觉一致性验收 V1。

### 最终实施约束

- [ ] 新建报告层五态枚举（小写连字符）
- [ ] 实现确定性最终交付状态计算
- [ ] 区分生成失败 / 检查受阻 / 结果缺失
- [ ] 显式映射 qaVerdict，不混淆 QA 层与交付层
- [ ] 复用现有 `QA_JUDGEMENTS` 等硬判据
- [ ] 观察只记录，不参与最终状态计算
- [ ] §6 十二场景自动化测试
- [ ] 必需检查缺失 / 非法状态组合 / 版本关联错误测试
- [ ] 不新增视觉阈值、不扩大质量门禁
