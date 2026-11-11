# I02-AUDIT 授权包范围与证据审计

| 项 | 值 |
| --- | --- |
| 票 | [I02-AUDIT 范围与证据审计](../issues/17-i02-audit.md)（task · DELIVERABLE） |
| 审计对象 | [`docs/v7.8/移动-I02.md`](../../../docs/v7.8/移动-I02.md) · `sha256:afb1fbe99ba972796b634d7de2dbe343c5551e7a129b24037944c7978b1df9ad` |
| 基线 | `a3b8a54`；分支 `wayfinder/level-playability-v1.1-i02` |
| 日期 | 2026-11-11 |
| 审计人 | wayfinder 会话（**自审**；见 §6 F5） |
| 产品目录改动 | **无**（`git diff --stat a3b8a54..HEAD -- packages/` 为空） |
| 结论 | **SIGN-READY（仅限首次签署 U1）**；无阻断项，5 项条件记录在 §5 |

> 本审计只判断授权包是否达到「可签署」，**不替用户签署**，也不产生实施授权。首次签署仍只放行 U1。

## 1. 审计方法

1. 逐项对照 AUTH 票「必须包含」、I-02 §12 七项、地图 Destination 12 项与 D8 专项要求。
2. 机械检查：链接解析、SHA 复算、产品目录 diff、实验复跑。
3. 对抗性检查：白名单越界、静默冲突消解、单元授权与能力授权混写、scratch 结论冒充生产验收。
4. 发现即记录；可当场修正的授权包缺项直接修正，并在 §6 标注。

## 2. 范围审计

| # | 检查 | 结果 | 证据 / 备注 |
| --- | --- | --- | --- |
| S1 | 白名单增量与 I-00 §11 + 用户 2026-11-10 裁定一致 | **PASS** | 本包 §5；D6 逐文件点名；D7 增补 `TEST_ONLY` helper |
| S2 | 无白名单外文件被偷偷纳入 | **PASS（修正后）** | F1：`temporal-input.ts` 原未显式列入禁止；已补 §5.3 |
| S3 | `graph.ts` 正确处理 | **PASS** | 仅 `HopSampling` 尾参；独立增量审批；未批 U4 `BLOCKED` |
| S4 | `profile.ts` 正确处理 | **PASS** | 禁止修改；只读 import 允许 |
| S5 | `fixtures/packs/**` 正确处理 | **PASS（修正后）** | 禁止；F2 补禁止新增 JSON fixture |
| S6 | 未越界到 I-03 / Runtime / CLI / MCP / 公共 Contract / 新依赖 | **PASS** | 本包 §11；I-03 字段与接线全部 `DEFERRED` |
| S7 | 产品目录未被修改 | **PASS** | `git diff --stat a3b8a54..HEAD -- packages/` 为空 |
| S8 | 非目标 / 停止 / 退出条件齐全 | **PASS** | 本包 §1、§12；D8 §9 |
| S9 | `@internal` 不被当成访问控制 | **PASS** | 本包 §5.4、§11.2 要求导出扫描 + 白名单审计 |

## 3. 证据审计

| # | 检查 | 结果 | 证据 / 备注 |
| --- | --- | --- | --- |
| E1 | 每条结论有 E1/E2/E3 落点 | **PASS** | 本包 §8.11、§14；语义裁定指向 D1–D10 / D5B |
| E2 | 链接可解析 | **PASS** | 自动检查：0 broken；全部相对路径存在 |
| E3 | SHA 可复算 | **PASS** | 12/12 证据 / 实验行匹配；输入文档 4 个 SHA 匹配 |
| E4 | 命令可复现 | **PASS（附快照说明）** | 03/04 逐字节复现；05/06 语义复现（见 §4 F4） |
| E5 | scratch 不被表述为生产验收 | **PASS** | 本包页首、§8.7、§13；证据文件均有同类声明 |
| E6 | 未修改产品目录 | **PASS** | 同 S7 |
| E7 | 证据索引完整 | **PASS** | 本包 §14：00–07 证据 + 03–06 实验输出 + 复现命令 |

## 4. 复跑记录

| 实验 | 命令 | 退出码 | 结果 |
| --- | --- | ---: | --- |
| 03 连续求交 | `node build-inputs.mjs && node run.mjs` | 0 | 输出逐字节一致（`34ac2d55…`） |
| 04 图割 / hop | `node build-inputs.mjs && node run.mjs` | 0 | 输出逐字节一致（`591c40a3…`） |
| 05 性能 | `node build-inputs.mjs && node --expose-gc run.mjs` | 0 | `checks=12/12`；`stateSignatureSha256` 稳定；`run.json` 因墙钟字段变化（见 F4） |
| 06 cut 基准 | `node build-inputs.mjs && node run.mjs` | 0 | `checks=10/10`；`determinism=true`；`run.json` 因 `generatedAt` / `wallMs` 变化（见 F4） |

复跑后已将 05 / 06 的 `outputs/run.json` 恢复到提交快照；授权包 §14 已补「输出 SHA 是快照」说明。

## 5. 完整性审计

| # | 检查 | 结果 | 备注 |
| --- | --- | --- | --- |
| C1 | 五个单元完整定义 | **PASS** | 本包 §7.1；U1–U5 与 I02-01～05 映射 |
| C2 | 授权状态正确 | **PASS** | U1 `AUTHORIZED`；U2/U3/U5 `PLANNED`；U4 `BLOCKED`；与 D8 一致 |
| C3 | R1 / R2 清单可执行 | **PASS** | 本包 §9.1–9.2；R3/R4 也已补齐 |
| C4 | I02-03 / I02-04 依赖、先后、授权条件明确 | **PASS** | U3 → R3 → U4；`graph.ts` 独立审批 |
| C5 | 冲突登记覆盖已知冲突且无静默消解 | **PASS（附条件）** | A-01～A-05、B-01～B-17；B-02 `OPEN`、B-11 `PARTIAL`、B-03/04/13 `DEFERRED TO I-03` 均显式记录 |
| C6 | 非目标 / 停止 / 退出条件齐全 | **PASS** | 本包 §1、§12 |
| C7 | 首次签署只放行 U1 | **PASS** | 本包 §15.2；`PUBLIC_NB` / `PUBLIC_PU` `BLOCKED` |
| C8 | 审计记录 / 签署记录位置 | **PASS** | 本包 §15.1、§15.4；本报告 |

## 6. D8 专项检查

| # | 检查 | 结果 |
| --- | --- | --- |
| D8-1 | 单元授权与能力授权分离 | **PASS**：本包 §7.3 两张表 |
| D8-2 | U4 未被误标 `AUTHORIZED` | **PASS**：U4 `BLOCKED` |
| D8-3 | R4 未被写成最终能力授权 | **PASS**：§9.4 明确 |
| D8-4 | 预算接口未被写成独立实施单元 | **PASS**：§7.1 / §7.4 为 U1 前置 |
| D8-5 | `PLANNED` 未被读成隐含授权 | **PASS**：§7.3 明确 |

## 7. 发现与处置

| ID | 级别 | 发现 | 处置 |
| --- | --- | --- | --- |
| F1 | 范围缺项（已修） | `temporal-input.ts` 未显式列入禁止清单 | 本包 §5.3 补入；只读 import 仍允许 |
| F2 | 范围缺项（已修） | 未显式禁止新增 JSON fixture | 本包 §5.3 / §5.5 补入；既有 JSON 只读 |
| F3 | 文案（已修） | 授权包行数 1,010 vs 实际 1,019 | AUTH 票 / 地图改为「约 1,020」；本包实际行数随修正变化 |
| F4 | 证据口径（已修） | 05 / 06 的 `run.json` 含墙钟 / `generatedAt`，SHA 只能作快照 | 本包 §14 补「输出 SHA 是快照」；复现以 `checks` / `stateSignature` / 分布 / `determinism` 为准 |
| F5 | 审计限制（记录） | 本审计由授权包作者会话执行，不是独立第三方 | 用户签署是独立门；R1–R4 仍按 D8 要求独立复核 |
| F6 | 条件（记录） | B-02 `OPEN`（PU 条件 2 阻塞）、B-11 `PARTIAL`（locale-independent 排序约束）、B-03/04/13 `DEFERRED TO I-03`、U4 `BLOCKED` | 均不阻断首次签署 U1；已写入本包 §10 / §13 / §7.3 |

**阻断项：无（仅限首次签署 U1）。**

若签署范围超出 U1，则以下条件成为阻断：

- U2：R1 PASS + 增量签署；
- U3：R2 PASS + 增量签署；
- U4：R3 PASS + `graph.ts` 独立审批 + 增量签署；
- U5：R4 PASS + 增量签署；
- 公共 NB/PU：I-03 准入；
- B-02：几何 `checked` 与 Runtime hitbox equality 未闭合。

## 8. 可签署性结论

**`SIGN-READY`（仅限首次签署 U1）。**

- 授权包满足 AUTH 票「必须包含」与 §12 七项要求；
- 白名单、预算、内部结果、测试矩阵、复核门槛、冲突登记、停止条件、证据索引、签署表齐全；
- 无阻断首次签署 U1 的缺项；
- 5 项条件（F5/F6）与 §7.3 的 `PLANNED` / `BLOCKED` 状态必须在签署时保持。

## 9. 复现

```bash
cd /Volumes/shy/some-projects/game-maker
shasum -a 256 docs/v7.8/移动-I02.md
git diff --stat a3b8a54..HEAD -- packages/          # 应为空

cd .scratch/level-playability-v1.1-i02/experiments/03-continuous-intersection && node build-inputs.mjs && node run.mjs
cd ../04-graph-cut && node build-inputs.mjs && node run.mjs
cd ../05-performance && node build-inputs.mjs && node --expose-gc run.mjs
cd ../06-cut-budget && node build-inputs.mjs && node run.mjs
```

预期：03 / 04 输出逐字节一致；05 `checks=12/12`；06 `checks=10/10`、`determinism=true`。05 / 06 的 `run.json` 因墙钟 / 时间戳字段变化，按语义结果而非字节 SHA 复现。
