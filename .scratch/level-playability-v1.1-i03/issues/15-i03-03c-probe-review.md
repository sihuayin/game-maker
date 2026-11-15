# I03-03C 几何证据独立复核标准

Type: grilling
Status: resolved
Owner: claude (I03-03C session 2026-11-14)
Blocked by: 04
Map: ../map.md
Class: I-03 / DECISION

## Question

几何 probe 证据的**独立复核标准**是什么？复核必须能判定“证据是否足以让某个几何分项 checked”，且不得由 probe 作者自审、不得把复核通过当作 NB/PU 准入或公共能力开放。

### 必须裁定

- 复核人独立性（未参与 probe / 格式 / 夹具编写）；
- 输入（I03-03A 格式、I03-03B 矩阵、原始 JSON / hash、命令）；
- 必须自己重跑 probe 并记录退出码、关键计数、hash；
- 逐项 `PASS / FAIL / NOT_RUN`：证据完整性、确定性、正例 / 负例、失败码、环境；
- 至少 2 条独立断言（自选，记录理由）；
- 报告路径、未覆盖项、限制、独立签署；
- 复核通过只证明几何证据本身，不授权 NB/PU 准入、不开放公共能力、不启动实施。

### 禁止

- 以作者总结替代复核；
- 修改 probe / 产品代码 / 证据；
- 用总通过率替代逐项结论。

### 验收

复核标准表、输入清单、逐项判定模板、证据 / hash 要求、独立签署栏。

## Answer

**Q1=A / Q2=A / Q3=A / Q4=A / Q5=A。** 本票冻结**独立复核标准**，不执行实际复核、不实现 probe、不设置 `coverage.geometry`、不开放公共能力。

> B2 已按用户裁定修正正例行口径：**14 行 = hazard 2 + player 8 帧 + player body 1 + graph 3**；13 不是必要检查项的上限，spawn body 是独立行。见 I03-03B2 的 2026-11-14 修正。

### 1. 复核人独立性与输入（Q1）

- **fresh 独立会话**，未参与 probe、证据格式、夹具或 manifest 编写。
- 只接收：
  - I03-03A Geometry Probe Evidence Contract；
  - I03-03B2 逐行 fixture manifest；
  - 原始 probe JSON / hash / 命令 / 冻结基底；
  - I03-03B 的覆盖 / 负例设计。
- 必须自己重建 / 重跑 / 检查；**不接受作者总结作为 PASS 依据**。
- 作者可提供定位信息，但不能替代复核人的独立判断。

### 2. 复核清单（Q2）

逐项检查，**summary 不能作为唯一复核对象**：

1. 夹具完整性：14 条正例行（hazard 2 / player 8 帧 + body 1 / graph 3）、10 个负例。
2. 原始输入 hash、v2→v4 归一化可重建性。
3. 每行 `expected / actual / delta / pass`。
4. 零容差与坐标归一化规则（sprite bounds vs body AABB、rounded vs unrounded、foot 定义）。
5. 失败码及 class 映射（missing-evidence / geometry-mismatch / environment / nondeterministic）。
6. summary 聚合正确性（不是唯一证据）。
7. runner / environment 信息。
8. 同环境确定性重跑。
9. 负例单变量隔离。
10. 无虚假 `checked`。
11. 原始证据未被手工修改。
12. **至少 2 条自选关键断言**，记录理由与结果（例如独立重算 `normalizedResult` hash、独立比较一条 body / frame 行、独立重建一个负例 recipe）。

### 3. 通过粒度（Q3）

| 分项 | 复核方式 | 分项结论 |
| --- | --- | --- |
| hazard | required rows + 对应检查项 | 独立 `PASS / FAIL / NOT_RUN` |
| player | required rows + 对应检查项（8 帧 + body） | 独立 `PASS / FAIL / NOT_RUN` |
| graph | required rows + 对应检查项（terrain / luggage / player box） | 独立 `PASS / FAIL / NOT_RUN` |

- 只有某分项的全部 required rows + 清单项均 `PASS`，复核报告才能写 **`evidence supports checked`**。
- 任一 `FAIL` 或 `NOT_RUN` ⇒ 该分项**不能**判 checked。
- 不允许用整体通过率推导单个分项通过；不允许 hazard 通过推广到 player / graph。

### 4. 环境与确定性（Q4）

- 复核必须在 probe 记录的 runner / environment 下重跑。
- 语义字段逐字节一致；`normalizedResult` hash 必须匹配。
- 环境不匹配 ⇒ 该分项保持 `partial`，记录 `environment-mismatch`；**不得**判 `geometry-mismatch` / `geometry-untrusted`。
- 禁止跨浏览器 / 跨环境比较几何结果。
- 确定性失败（同环境不可复现）⇒ `nondeterministic` + `partial`，不得判 checked。

### 5. 报告与授权边界（Q5）

报告路径：`.scratch/level-playability-v1.1-i03/reports/geometry-probe-review.md`

必须包括：

- 复核人、日期、runner / environment；
- 重跑命令及退出码；
- 原始输入 / 输出 hash；
- 每项 `PASS / FAIL / NOT_RUN`；
- hazard / player / graph 分项结论（是否 `evidence supports checked`）；
- 未覆盖项与限制；
- 独立签署。

复核 PASS 的权限**严格限定**为“证据足以支持被复核的几何分项”。它**不**代表：

- 自动设置 `coverage.geometry`；
- 自动通过 NB / PU 证据准入；
- 开放 `PUBLIC_NB` / `PUBLIC_PU`；
- 授权 probe / 夹具 / 生产代码实施。

### 6. 三层独立结构

1. **I03-03A**：probe 输入输出、比较规则、hash 与失败码合同。
2. **I03-03B**：真实 pack 基底、正负例夹具与预期 coverage。
3. **I03-03C**：独立复核、逐项签署与环境确定性验证。

三层都不构成生产实施授权或公共能力开放。

### 7. 边界

- 本票不执行实际复核；不实现 probe；不物化夹具；不修改产品代码 / fixture / Runtime / `profile.ts` / `graph.ts`。
- 不开放 `PUBLIC_NB` / `PUBLIC_PU`；不改变 publish rejection。
- 全部进入 I-03 授权包；I03-09 组装时必须把 §1–§5 与 14 行口径写入复核章节。

### 8. 下游

- **I03-04 / I03-05 / I03-06** 已解除全部前置，成为下一 frontier。
- I03-04/05 的几何准入必须读复核报告的**分项结论**，不得只看 probe 退出码或 `all-checked`。
- I03-07 / I03-08 / I03-09 继续等待对应前置；最终由 I03-09 汇总、I03-10 独立审查、I03-11 用户签署。

## Comments

- 2026-11-14（I03-10 F2 修正）：复核清单第 1 项的负例数由 10 更新为 11（含 `body-bounds-mismatch`）；其余 12 项标准不变。
