# I-05 unit brief · Pipeline 验收与最终收口报告

| 项 | 值 |
| --- | --- |
| 票 | [`05-i05-brief`](../issues/05-i05-brief.md)（grilling，resolved 2026-11-18） |
| 授权包 | `docs/v7.8/移动-收口.md` §5.2（UNSIGNED 草案） |
| 差分底座 | [`01-coverage-inventory`](../evidence/01-coverage-inventory.md) §2.2 / §2.3 |
| 状态 | **brief 冻结；I-05 `NOT_AUTHORIZED`**——实施前仍需独立增量授权记录 + 用户签署 |
| 基线 | 单元分支切出时的 `main` SHA（不在本 brief 预填） |

## 0. 单元性质与两阶段

I-05 = **验收 / 证据阶段**，不新增算法、不扩展产品决策语义。

职责收窄为：**验证真实 Pipeline 中时序诊断确实产生、可追溯，并且不改变既有放行行为。**

| 阶段 | 内容 | 前置 |
| --- | --- | --- |
| **5A** Pipeline 验收 | 三案例 + `last-train` 冒烟；`build` / `publish-gate` / `qa-report` 路径；诊断存在且不误伤 | I-04 合并 / 签署 / Ledger + FIX 合并 / 签署 / Ledger |
| **5B** 最终收口报告 | `V1.1-closure.md` + 签署 | 5A 完成 + PU-ADMIT 合并 / 签署 / Ledger |

仍是一个单元、一行 Ledger、两个门。

## 1. 范围与非目标

**范围内**：

- 证明时序诊断在真实 Pipeline 产物中存在、路径可追溯、不改变放行决定。
- 三案例（FIX）+ `last-train` 冒烟；构建 / 测试报告引用；支持范围、限制、残余风险。
- 最终收口报告与用户签署。

**非目标**：

- 让 temporal 参与 `publish-gate` / `qa-report` 决策（产品行为变更，另开 effort）。
- 修改 `publish-gate` / `qa-report` / CLI / MCP 语义。
- 新建 fixture（归 FIX）；重跑 P2–P7 或重开已签署结论。
- 扩大 PRD §12 的能力声明。

## 2. 案例集合

| 案例 | 来源 | 角色 |
| --- | --- | --- |
| NB witness | FIX 签署产物 | 主证据 |
| PU witness | FIX 签署产物 | 主证据；挂条件 5 |
| IE 负例 | FIX 签署产物 | 主证据 |
| `fixtures/game-configs/last-train.json` | 现有真实生产 fixture | 额外 IE 冒烟 / 支持证据，不重复计入三案例 |

- 禁止用静态层 NB/PU 或合成 `PU_WORLD` 替代主证据。
- FIX `INFEASIBLE` / 失败 ⇒ I-05 `INCOMPLETE`（见 §3.1）。
- 同一证据只服务一个结论：FIX 的 PU witness 归 I-05；条件 5 归 PU-C5；六条件资格归 PU-ADMIT。

## 3. Pipeline 验收口径

### 3.1 判定对象

- 时序诊断**存在**：产物 / 报告中可见，且能追溯到输入 config / pack hash。
- 诊断**不参与放行**：`publish-gate` 的放行决定与基线一致；`qa-report` 形状不变。
- **零付费**：不调用付费上游。

### 3.2 路径

每个案例至少跑一条完整正式路径：

1. 优先 `build`（`--reuse-from` / `--reuse-config`）+ `publish-gate`。
2. `create` 仅在无需付费上游时使用。
3. 需要付费才能跑的路径记 `NOT_RUN` 并写明原因，不伪造、不降级为单元测试冒充。
4. `qa-report` 逐案例记录；temporal 字段缺失是**已知事实**，不得写成「已交付时序诊断」。

## 4. 证据格式与确定性

落点：`.scratch/level-playability-v1.1-closure/evidence/i05/<case>/`，每个案例含：

- `commands.log`（命令 / 参数 / 退出码 / 耗时）；
- `run1/`、`run2/`（完整产物；两次重复）；
- `diff.json`（两次运行逐文件 / 逐判定比较，零容差）；
- `qa-report.json`（副本 + hash）与 playability verdict、temporal 诊断摘要；
- `inputs.json`（config / pack / manifest hash）；
- `SHA256SUMS`。

构建 / 测试报告引用 I-04 的签署结果（命令日志 + hash），不重跑。

## 5. 最终收口报告

- 路径：`.scratch/level-playability-v1.1-closure/reports/V1.1-closure.md`（唯一权威）。
- 签署：`.scratch/level-playability-v1.1-closure/reports/V1.1-closure-signature.md`。
- 内容：支持范围；限制与已知问题；残余风险；能力声明（限 PRD §12 措辞）；DoD 十项追溯矩阵（引用 `09-closure-dod`）；各单元状态与签署记录；closure 结论。
- 签署后不可改写；修正只能以 addendum 叠加并重新签署。
- 5B 未满足前置 ⇒ 不得写「最终」报告，也不得签署。

## 6. 判定与 closure 状态

- 逐项 `PASS / FAIL / NOT_RUN`；禁止通过率 / 加权。
- 单元：`PASS` = 全部 required PASS + 三案例 + 报告签署；`INCOMPLETE` = 缺证据 / `NOT_RUN` / FIX 失败；`FAIL` = 真实误判或流水线回退。
- 退出码：`0` = 无 required FAIL；`1` = 至少一个 required FAIL；`2` = 输入 / 基线 / 报告结构无效。
- closure：全部单元签署且 DoD 十项可勾 ⇒ `PASS`；否则 `INCOMPLETE`；任一单元 `FAIL` ⇒ `FAIL`。
- 任何 `PASS` 都不开放 gate。

## 7. 白名单

### 7.1 允许新增（只增）

| 路径 | 目的 |
| --- | --- |
| `.scratch/level-playability-v1.1-closure/scripts/i05-*.mjs` | 只读驱动 / 汇总脚本（零付费） |
| `.scratch/level-playability-v1.1-closure/evidence/i05/**` | 证据 |
| `.scratch/level-playability-v1.1-closure/reports/V1.1-closure.md` | 最终报告 |
| `.scratch/level-playability-v1.1-closure/reports/V1.1-closure-signature.md` | 签署记录 |
| `.scratch/level-playability-v1.1-closure/reports/I05-review.md` | fresh 复核报告 |

### 7.2 禁止

- 修改产品源码 / 产品测试 / `fixtures/**` / 已签署文档 / Lockfile / `tsconfig*`。
- 新增依赖；付费上游。
- 改写 I-04 / FIX / PU-ADMIT 的签署证据或重跑其结论。

## 8. 证据消费（不重跑）

- I-04：回归命令日志 + hash + 判定表。
- FIX：三案例 config / pack hash + 判定 + 复核 + 签署。
- PU-ADMIT：六条件逐项资格 + 签署。
- 引用必须带 PR / merge SHA、签署记录、Ledger 行；缺失即 `NOT_RUN`，不得推断。
- `I03-acceptance` 的 `acceptance-run2/` 证据不可复算：I-05 不引用其日志；以 I-04 的 fresh 回归基线为准。

## 9. 复核与签署

- fresh reviewer 未参与 I-05 实施；独立复跑至少 1 个案例的完整路径；核对全部 hash 与 `diff.json`。
- 复核报告 `I05-review.md` 必须列出：reviewer 独立性、日期 / 环境、输入 hash、复跑记录、限制。
- 用户签署 `V1.1-closure-signature.md` 后才可闭合。

## 10. STOP

1. 为通过 I-05 修改 `publish-gate` / `qa-report` / CLI / MCP 或产品代码。
2. 调用付费上游，或伪造 `NOT_RUN` 为 PASS。
3. 用静态层 NB/PU、合成 `PU_WORLD`、单元测试冒充真实案例或 Pipeline。
4. 改写 / 重跑已签署证据，或把同一证据重复计入多个结论。
5. 在 5B 前置未满足时写「最终」报告或签署。
6. 扩大 PRD §12 能力声明。

任一 STOP ⇒ HITL；不得自行缩范围或改写历史记录。

## 11. 回滚（纯 audit）

- 证据与报告位于 `.scratch`；回滚 = 丢弃 I-05 分支 / 删除未签署产物。
- 产品零回滚；记录「无产品影响」证据。
- 已签署报告不可回滚改写；只能以 addendum 更正并重新签署。
