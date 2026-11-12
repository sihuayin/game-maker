# U2-R2 独立复核

Type: task
Status: resolved
Owner: independent reviewer subagent (rerun) · 2026-11-12
Blocked by: 11, 12
Map: ../map.md
Class: U2 / REVIEW

## Task

由**未参与 U2 编写**的独立复核会话，按授权包 §9.2 的 R2 清单复核 U2，并写正式报告。

### 输入包（只给这些）

- 授权包 `docs/v7.8/移动-I02.md` @ `797cd6fc…`；
- U2 白名单；
- R2 清单（授权包 §9.2）；
- 测试命令；
- `git diff <U2 base>..<head>` 与 head SHA；
- U2-07 的证据路径。

**不得**提供：作者总结、作者的 PASS 结论、作者的调试笔记。

### 必须自行执行

1. 检查 diff 与全部变更文件；
2. 运行 U2 定向 vitest 与 `pnpm test`，记录退出码；
3. 检查 T-55 / T-57 / T-58 / T-61 / T-62 / T-64；
4. 逐项判断 R2：Witness 模型、S1–S4、残差等待、U9、完整性、Witness 形状、双档、反例、范围与模型条件；
5. 检查未提前实现 U3 / U4 / U5（无门区 / 图割 / 性能证据 / A–J）；
6. 检查无公共导出 / 无生产接线 / 无 JSON fixture / 无新依赖。

### 报告

写入唯一权威路径：

```text
.scratch/level-playability-v1.1-i02/reports/R2-review.md
```

报告必须含：

- 逐项 `PASS / FAIL / NOT_RUN`；
- 每项的命令、退出码、原始输出摘要或 hash；
- diff scope、未覆盖项；
- 复核人、日期；
- 末尾**用户签署栏**（由 U2-SIGN 填写）。

### 失败处理

任一 `FAIL` 或必要项 `NOT_RUN` ⇒ R2 不通过；U2 不得标记完成；R2 PASS 也不能替代用户签署。

### 验收

报告完整、可复核；未修改任何产品文件。

## Answer

**R2 结论：FAIL —— U2 不得标记完成。**

- 报告（唯一权威路径）：`.scratch/level-playability-v1.1-i02/reports/R2-review.md`
- 复核人：**independent reviewer subagent, fresh context**；日期 **2026-11-12**。
- 输入：授权包 SHA-256 现场复算匹配 `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`；
  diff `23a2027..f743c61` 产品路径只含 3 个 U2 白名单文件；`f743c61..HEAD` 产品 / 授权包未漂移。

### 逐项结果

| 项 | 判定 | 摘要 |
| --- | --- | --- |
| Witness 模型 | PASS | `(footX,k)`、静态走廊、精确 spawn、wait/move、恒速线性、每边一格、状态边界到达、Goal 内缩 0.5px |
| S1–S4 | **FAIL** | **S2 lagPad 非保守**：`lagMs` 窗口跨折返点时漏掉 `∃δ` 返回位姿；官方 16.67ms 档有可复现反例（`verifyTransition` 返回 `verified:true` 但存在正宽度 lagged 碰撞） |
| 残差等待 | PASS | 整格扫掠、跨折返点切段、非端点采样；静态玩家 + 全 N 格并集覆盖 |
| U9 | **FAIL** | 结构项（`∀φ0` 接近 / 整周期停留 / `∃ψ` 出口 / 同一 pad / 严格相交 / 无最小安全窗口）通过；但接近 / 出口转移继承 S2 假验证；停留段本身不受影响 |
| 完整性 | PASS（机制） | 全 N 格、策略表 + 逐转移、可达闭包、严格 rank / 有限 trace、部分路径不提升、预算耗尽 ⇒ IE；记录真实性受 S2 FAIL 影响 |
| Witness 形状 | PASS | `policy + verification`、D9 信封齐全、确定性重放、`volume.bytes` 可独立复算、超限无部分 Witness |
| 双档 | PASS（附风险） | 每档独立编码；U9 停留段强制绑定 lag；`resolveTwoLagResults` 未改。风险：W 编码未绑定 hazard / lag 来源 |
| 反例 | PASS | D3 §11 十三条 13/13 存在且通过；但不含「lag 跨折返点」 |
| 范围与模型条件 | PASS | 只改 U2 白名单；不发布公共 NB；`coverage.temporal` 显式前置；无公共导出 / 生产接线 / JSON fixture / 新依赖 |
| 未提前实现 U3/U4/U5 | PASS | 无门区 / 图割 / hop 加倍 / 性能证据 / A–J |

### 命令重跑

- `pnpm build`：exit 0。
- `pnpm typecheck`：exit 0。
- `playability-temporal-witness.test.ts`：exit 0，`68 passed (68)`。
- `playability-temporal-input.test.ts`：exit 0，`65 passed (65)`。
- `pnpm test`：两次均 exit 0，`173 passed` / `2742 passed`；两次均出现 2 条
  `[vitest-worker]: Timeout calling "onTaskUpdate"` 工具层 RPC 超时（非断言失败）。
- T-55 / T-57 / T-58 / T-61 / T-62 / T-64：定向重跑 6/6 通过。

### 失败 / 未运行项

- **FAIL：S1–S4 的 S2**（根因，含修复建议与可复现参数，见报告 §4）。
- **FAIL：U9**（接近 / 出口继承 S2）。
- **未运行（非本票必要命令）**：真实 19 关语料 / 性能分布、U3–U5；未读取作者实现报告 / 地图 / 其它 U2 票（硬约束）。
- 报告 §7 另列 2 条工具层 unhandled error、W 编码跨档绑定风险、原因码映射偏宽等未覆盖 / 风险项。

> 按授权包 §9.2 与票 09 的失败处理，R2 不通过 ⇒ U2 不得标记完成；R2 PASS 也不能替代
> 用户签署，何况本次为 FAIL。票保持 `open`，等待实施会话修复后重新复核。

### 首次 R2 结果与重审条件（协调会话记录，2026-11-12）

- 首次 R2：**FAIL**（S2 `lagPad` 在 lag 窗口跨折返点时非保守；报告 `.scratch/level-playability-v1.1-i02/reports/R2-review.md`，复核人 `independent reviewer subagent, fresh context`）。
- 修复：U2-08；修复后审计：U2-09。
- 本票保持 open，Owner 重置为 `—`；由**新的独立会话**在 U2-08 / U2-09 完成后 claim 并重审。
- 首次 FAIL 报告保留，不得覆盖；重审结论另写，不得改写首次报告。

## Re-review Answer

**R2 重审结论：PASS —— 首次 FAIL 的 S2 / U9 项已解决；U2 可提交 U2-SIGN，R2 PASS 不替代用户签署。**

Status: resolved

- 报告（新文件，未覆盖首次报告）：`.scratch/level-playability-v1.1-i02/reports/R2-review-rerun.md`
- 首次报告：`.scratch/level-playability-v1.1-i02/reports/R2-review.md`（FAIL，保留）
- 复核人：**independent reviewer subagent (rerun), fresh context**；日期 **2026-11-12**
- 授权包 SHA-256 现场复算匹配 `797cd6fc7b299e22b6e90b9ef8a9567376ea3a914d70f8b6f1fc0f9a6ecedc56`；
  U2 全量 `23a2027..1fe09ef` 产品路径只含 3 个白名单文件；`1fe09ef..HEAD -- packages/ docs/` 为空。
- 修复段 `f743c61..1fe09ef`：源码 +55/−44（真改产品逻辑，不是只改测试），测试 +117/−2
  （新增 5 条跨折返点回归，未削弱原有断言）。

### 首次 FAIL 是否解决

| 首次 FAIL | 状态 | 独立证据 |
| --- | --- | --- |
| S2 `lagPad` 单侧加宽（首次报告 §4） | **已解决** | S2 / 残差等待 / U9 停留三处共用同一对称 pad helper；用首次报告原始参数（`at=(0,40)`、`anchor=(0,1)`、`lag=16.67`）独立复现：`verified:false` / `failure:"hazard"`；精确 `∃δ`（`u=211.6`，Hazard 盒 `[5.8,15.8]` vs 玩家 `[14,16]`）仍成立 |
| U9 接近 / 出口继承 S2 | **已解决** | 接近 / 出口 / 停留共享同一 `verifyTransition` / `verifyU9Stay`；跨折返点 `move` 边判 `hazard`；反例场景 U9 `failed / residual-wait`，不再出证 |

### 逐项结果（授权包 §9.2）

| §9.2 项 | 判定 |
| --- | --- |
| Witness 模型 | PASS |
| S1–S4 | **PASS（S2 已修复）** |
| 残差等待 | PASS |
| U9 | **PASS（继承项已修复）** |
| 完整性 | PASS |
| Witness 形状 | PASS |
| 双档 | PASS（附 W 编码未绑定 lag 的残留风险） |
| 反例 | PASS（D3 §11 13/13） |
| 范围与模型条件 | PASS |
| 未提前实现 U3/U4/U5 | PASS |
| T-55/57/58/61/62/64 | PASS |

### 命令重跑

- `pnpm build` exit 0；`pnpm typecheck` exit 0。
- witness `73 passed (73)`；input `65 passed (65)`；T-55/57/58/61/62/64 定向
  `6 passed | 59 skipped (65)`。
- `pnpm test` 两次均 exit 0：`173 passed` / `2747 passed`；两次分别为 4 / 5 条
  `[vitest-worker]: Timeout calling "onTaskUpdate"` 工具层 RPC 超时（非断言失败，未作为 PASS 依据）。
- 独立探针：S2 373 条 verified / **0 假验证**；残差等待 335 / **0**；U9 停留 215 / **0**；
  W 最小不动点闭包 / rank / 全 N 格核查通过；Witness 编码不变量通过；U9 跨档 `model-out`。

### 未运行 / 风险

- 未运行真实 19 关语料 / 性能分布（R2 不要求）；未读取作者实现 / 修复报告 / 地图 / 其它票（硬约束）。
- 残留风险：W 编码未绑定 hazard / lag 来源（实测 0ms 结果用 200ms 请求仍编码成功）；
  全量测试工具层 RPC 超时；D9 原因码映射偏宽。均不构成 §9.2 FAIL。
