# I02-02 I-00 / I-02 冲突登记

Type: task
Status: resolved
Owner: claude · 2026-11-10
Blocked by: 02
Map: ../map.md
Class: I-02 / EVIDENCE

## Question

建立 **I-00 / I-02 冲突登记表**，只登记、不消解。授权包必须把它作为独立章节。

### 表结构

| 冲突 | I-00 冻结条文 | I-02 需求条文 | 代码事实 | 影响 | 裁定票 | 状态 |

### 至少覆盖

1. **Motion 相位**：I-02 §4 I02-01「输入要求」列相位信息；I-00 §4.3 / §5.1 冻结「相位是自由变量、配置不表达相位」；`game-config.ts` 的 `Motion` 只有 `kind/axis/distance/periodMs`。**不得把「相位是自由变量」误读成「输入中存在相位字段」**。
2. **速度**：I-02 输入列速度；I-00 冻结「由 `distance / periodMs` 导出」；不得引入独立配置速度字段。
3. **Hazard 运动模型**：I-02 与 I-00 的模型边界；代码只有 `Motion` 四字段；不得自行扩大输入契约。
4. **图割 hop 参数**：I-00 §7 PU 第 4 条与 §11「需单独裁定」；I-02 I02-04 §7 要求加倍不变性；`graph.ts` 的 `hopSamples` 当前硬编码 `n`。
5. **PU 六条件**：I-00 §7 六条与 I-02 §5 / I02-03 / I02-04 的映射；任何修改需独立裁定。
6. **I-02 网格约束**：I-02 I02-05 的 `N ≥ 2` 与 `N ≤ floor(maxSpeed × periodMs / xStep)` 是否与 I-00 §6.5 完全一致。
7. **Atlas 几何失败规则**：I-02 §3「Atlas 帧几何无法验证 ⇒ IE」与 I-01 的失败码是否一一对应。
8. **双档 lag**：I-02 §6.4 与 I-01 实现的比较口径是否一致（只比 verdict、`lag-invalid` 优先）。
9. **授权形态**：I-02 §12 要求新的实施授权包；I-00 R2 已批准「分阶段放行」。两者是否冲突，还是后者是前者的执行形式。
10. **I-01 已实现范围**：I-02 §1 对 I-01 的描述是否与代码事实一致。

### 输出

`evidence/02-conflict-register.md`。每条必须带 `file:line` 或文档章节；**不得在表内给出倾向性结论**。

### 下游

I02-D1、I02-D2、I02-D4、I02-AUTH。

## Answer

登记表：[`evidence/02-conflict-register.md`](../evidence/02-conflict-register.md)。**只登记，不消解**；**修改产品目录：否**。

- 共 **20 条**：用户点名的五组 `A-01～A-05`，取证过程中新增的 `B-01～B-15`。
- 状态：**16 条待裁定**；2 条（`B-04`、`B-13`）属 I-03 边界、本图不裁定；1 条（`B-14` 网格约束）已核对一致；1 条（`B-10` Phaser overlap）取证中，已开 [I02-06](19-i02-06-phaser-overlap.md)。
- 裁定票落位：
  - 相位 → [I02-D1](07-i02-d1-phase-semantics.md)；速度 / 运动模型 → [I02-D2](08-i02-d2-motion-input-contract.md)；
  - hop 参数 / PU 六条件 / P0 垂直规避声明 → [I02-D4](10-i02-d4-gate-graphcut.md)（hop 授权形态同时涉及 D6/D8）；
  - coverage `partial` vs `checked` / 三角波位置 / T-58 → D2 / D4 / D6 / D9；
  - 预算 / 确定性 → [I02-D5](11-i02-d5-budget-determinism.md)；结果形状 → [I02-D9](15-i02-d9-internal-result-contract.md)；
  - `coverage.temporal` / 机制层 gap → I-03（出局）。
- 已写入授权包必须包含的边界：I-02 §1 对 I-01 的描述不得被读成「Runtime hitbox 已证明」；I-02 §12 的新授权包与 I-00 R2 的分阶段放行不是同一层，不得把 R2 当成 I-02 授权。

### 下游

I02-D1、I02-D2、I02-D4、I02-D5、I02-D6、I02-D9、I02-AUTH。
