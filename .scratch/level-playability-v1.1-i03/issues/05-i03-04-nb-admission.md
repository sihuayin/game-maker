# I03-04 PUBLIC_NB 三阶段准入链

Type: grilling
Status: resolved
Owner: claude (I03-04 session 2026-11-14)
Blocked by: 01, 02, 03, 04, 13, 14, 15, 16
Map: ../map.md
Class: I-03 / DECISION

## Question

定义 `PUBLIC_NB` 的三阶段——**接线完成 / 证据准入 / 公共开放**——以及每阶段的入口条件、证据、独立审查、授权与回滚。

### 必须裁定

- 接线完成：生产链路消费内部 NB 候选 + Witness；**不等于开放**；
- 证据准入：几何 `checked`、`coverage.temporal`、lag 语义、Witness 完整性、确定性、预算等条件；
- 公共开放：独立审查 + 增量授权 + 发布开关；只有证据准入通过才可；
- 公共 NB 的 release gate / feature flag / 回滚；
- 不得因 I-02 `nb-candidate` 或接线成功自动开放；
- 与 `PUBLIC_PU` 的独立关系。

### 禁止

- 把三阶段压成一个“接通即开放”；
- 在几何 / 时序证据未准入时发布公共 NB；
- 由 NB 推导 PU。

### 验收

三阶段状态机、每阶段证据 / 审查 / 授权 / 回滚、负向场景（接线完成但未准入）。

## Answer

**Q1=A / Q2=A / Q3=A / Q4=A / Q5=A。** 冻结 `PUBLIC_NB` 三阶段生命周期与全局 gate；**不授权生产接线、不开放公共能力、不修改 publish gate**。`PUBLIC_PU` 保持独立阻断。

### 0. 状态机

| 阶段 | 名称 | 公共 gate | 允许 | 禁止 |
| --- | --- | --- | --- | --- |
| 1 | **WIRED** 接线完成 | `BLOCKED` | 消费内部 NB 候选 + Witness；暴露 `coverage.temporal` / evidence 摘要；映射为 IE；保留候选 / Witness 作非结论证据 | 公共 `NO_PROVEN_BLOCKER`；把 `nb-candidate` 当准入通过；改变 publish rejection；自动开放 |
| 2 | **ADMITTED** 证据准入通过 | `BLOCKED` | 证据满足 §2 全部条件；可进入独立复核 / 用户授权准备 | 自动变 OPEN；公共 NB；按关卡 allowlist |
| 3 | **OPEN** 公共能力开放 | `OPEN` | 逐关仍须通过 §2 证据准入后发布公共 NB | 未通过 §2 的关卡发布 NB；跳过 gate 读取 |

- `WIRED → ADMITTED`：§2 条件 + 固定 admission 夹具全部通过；不改变 gate。
- `ADMITTED → OPEN`：独立复核 + 用户显式授权 + gate `BLOCKED → OPEN`。
- `OPEN → BLOCKED`：确认假 NB（Q5 回滚）。
- `PUBLIC_PU` 不因 NB 阶段推进获得任何隐含授权；仍走 I03-05 独立链。

### 1. 阶段 1 — WIRED（Q1）

生产链路可以消费 I-02 内部 NB 候选及 Witness，但公共 gate 保持 `BLOCKED`：

- 适用关卡的时序结果映射为 `INSUFFICIENT_EVIDENCE`；
- 暴露 `coverage.temporal` 与 I03-01 的 evidence 摘要；
- NB candidate / Witness 只作**非结论性证据**；
- 不产生公共 `NO_PROVEN_BLOCKER`；
- 不改变现有 publish rejection；
- 不自动开放 `PUBLIC_NB`。

### 2. 阶段 2 — ADMITTED（Q2）

所有条件必须同时满足：

| 条件 | 准入要求 |
| --- | --- |
| 几何 | `hazard + player` checked；涉及图割时 `graph` 也必须 checked |
| 几何复核 | I03-03A/B/C 三层独立复核通过 |
| 时序覆盖 | `coverage.temporal = "checked"` |
| 双档 lag | 两档均完整且结果一致 |
| Certificate | `kind = "witness"`、`status = "COMPLETE"` |
| 预算 | 无预算耗尽、无 wall-clock abort |
| 确定性 | 满足冻结的跨进程确定性要求（签名 + 规范化序列化） |
| 体积 | Witness 未触发 transition / bytes 上限 |
| 公共映射 | 符合 I03-01 的 evidence / Verdict 映射 |
| Admission fixtures | 固定夹具集全部通过 |

固定 admission 夹具集必须包含：

1. **Synthetic NB 正例**：合法 NB 通过完整准入。
2. **False-NB 负例**：不满足全相位安全条件的候选**不会**错误通过。
3. **真实 IE 负例**：模型外 / 证据不足 / 预算异常仍保持 IE。

- 19 关历史语料只作 **IE 不回归**证据，不能替代 NB 正例。
- 夹具集必须在运行正式 admission 测试前冻结并记录 hash；**禁止**根据测试结果调整样本以获得通过。
- 阶段 2 通过只表示证据准入条件成立，**不自动改变全局能力状态**。

### 3. 阶段 3 — OPEN（Q3）

必须同时满足：

- 独立复核通过（复核人未参与实现 / probe / 夹具）；
- 用户显式授权；
- `PUBLIC_NB` gate 从 `BLOCKED` 明确变更为 `OPEN`。

开放后，每个关卡仍须独立通过 §2 证据准入，才能得到公共 `NO_PROVEN_BLOCKER`。阶段 2 通过不等于公共开放。

### 4. 能力粒度（Q4）

- `PUBLIC_NB` 是**全局能力**；不建立逐关 allowlist。
- gate `OPEN` 后，任何满足 §2 条件的关卡可产生公共 NB；不满足的仍为 IE。
- 不增加按关卡预算或开关；关卡差异由实际证据决定。

### 5. 公共结果与回滚（Q5）

公共 NB 结果：

```ts
{
  verdict: "NO_PROVEN_BLOCKER",
  coverage: {
    // 沿用现有 PlayabilityCoverage；至少 temporal: "checked"
    temporal: "checked",
    // 其余 coverage 字段来自现有审计 / I03-01；不伪造
  },
  evidence: {
    // I03-01 定义的 temporal evidence summary
  },
}
```

- **不新增公共 `publicCapability` 字段。**
- I-02 内部 `publicCapability="BLOCKED"` / `publicResult=null` **保持原样**；不得为 I-03 发布回写 / 篡改内部结果。

假 NB 回滚：

1. 全局 `PUBLIC_NB` gate **立即关闭**。
2. 受影响关卡公共结果退回 `INSUFFICIENT_EVIDENCE`。
3. 受影响证据标记失效，不得继续作为准入依据。
4. 重新开放必须重新完成根因分析、修复、独立复核与显式授权。
5. 不能只回滚单个关卡而让全局能力继续开放；不能静默保留旧证据。

### 6. 追加：证据失效范围

证据失效不是“当前关卡退回 IE”这么窄。每条 NB 结果必须带一个**证据基线元组**：

| 轴 | 内容 |
| --- | --- |
| `algorithmVersion` | I-02 U5 提交 / 内部算法版本 + I-03 adapter 版本 |
| `geometryBaseline` | profile id、graph.ts 版本、atlas JSON/PNG hash、probe 合同 / 夹具 manifest hash |
| `proofRulesVersion` | D9 / D10 / I-00 六条件 / I03-03 gate 规则版本 |
| `fixtureVersion` | admission / probe 夹具版本与 hash |

- 假 NB 确认后，所有**依赖同一失效基线元组**的结果全部失效，不只当前关卡。
- 证据失效后必须重新建立基线、重新独立复核、重新授权；不得用旧 hash 继续。
- 若失效只因某个夹具 / 关卡输入，仍需证明其他关卡不依赖该失效输入；不能默认豁免。

### 7. 追加：关闭优先级

全局 gate 关闭必须**优先于**：

1. 缓存结果；
2. 历史发布产物；
3. 逐关准入结果；
4. 任何“曾通过”的证明。

- 公共读取路径必须先检查 gate 状态；`BLOCKED` ⇒ 一律 IE / 不返回 NB。
- 缓存键必须包含 gate 状态 + 证据基线元组；gate 关闭后旧缓存不得命中。
- 不允许出现“gate 已关闭但缓存 / 历史产物仍返回 `NO_PROVEN_BLOCKER`”。

### 8. 边界

- 本票不授权生产接线、不实现 WIRED / ADMITTED / OPEN、不修改 `publish-gate` / `api.ts` / `mechanic.ts` / Runtime。
- 不开放 `PUBLIC_NB` / `PUBLIC_PU`；不改变现有 publish rejection。
- 全部进入 I-03 授权包；I03-09 必须写入状态机、admission fixtures / hash、全局 gate、逐关准入、证据失效范围与关闭优先级。
- `PUBLIC_PU` 仍由 I03-05 独立裁定；NB 的阶段推进不构成 PU 授权。

### 9. 下游

- **I03-05**：`PUBLIC_PU` 独立准入链。
- **I03-06**：publish-gate 消费规则（第一阶段非阻断；不得把 NB gate 开放当作拒稿行为变化）。
- **I03-07 / I03-08 / I03-09**：白名单、验收矩阵、授权包组装。
