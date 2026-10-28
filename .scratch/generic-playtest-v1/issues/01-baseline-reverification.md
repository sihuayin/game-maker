# 01 基线重验与差距清单

Type: research
Status: resolved

## Question

以当前 `main` 的源码、测试和真实产物为准，逐条重验 `docs/v7.6/验证.md`：哪些验收标准已满足、哪些部分满足、哪些未满足？每条给出 E1/E2/E3 证据（`file:line`、测试名、运行路径），并单独列出**可继承的历史证据**及其身份（pack/site/shell/checksum/哈希）。

范围与约束：

- 只读审计，不改代码、不跑付费、不写历史目录。
- 覆盖 §5.5（P0-1，8 条）、§6.6（P0-2，8 条）、§7.5（P0-3，6 条）、§8.4（P0-4，6 条）、§9（测试计划）、§12（DoD，8 条）。
- 重点核实 §1 的问题基线是否过时（尤其 FA-02 的自动 `SUCCESS`、FA-05/06 的 `verdict=pass`）。
- 明确区分「代码/测试存在」与「证据可继承」：继承必须核对身份、适用范围、证据有效性。
- 输出一份差距清单，供下一票分诊；不要提实施方案，不要修改契约。

已知起点（2026-10-28 的只读 Explore 审计，需复核而非照抄）：

- §6.6 8/8 基本满足；§5.5 有 2 项未满足（`pickupAbove` 无条件追逐、无无进展/重复重置终止）、4 项部分满足。
- `policy.mjs` 不读 `dangers`；`hazardModel` 只接受 `axis:"x"`；跳跃只记录已发键；等待无独立上限。
- §7.5/§8.4 存在记录性缺口：`review-verdict` 不校验审核记录身份；`delivery.evidence` 只存路径、读取不重算哈希；`consistency.mjs` 未比对 `review-record.subject` 与 delivery。

## Answer

**结论：`main@ae339b9` 未满足 v7.6 全部验收标准。** 逐条 E1/E2/E3 见 [`../research/baseline-audit.md`](../research/baseline-audit.md)。

**计数**
- §5.5 **3 MET / 3 PARTIAL / 2 NOT MET**：NOT MET = `pickupAbove` 盲追、无无进展/重复重置终止；PARTIAL = dangers/axis:y、等待无独立上限、跳跃动作层不校验状态变化（证据层已有 jump/land 状态差）。
- §6.6 **8/8 MET**（版本化目录、三态执行、观测可追溯、五态归因、身份拒写、原子写回、playable-smoke 兼容、不自动建基准/不覆盖）；caveat：6.6-1 缺直接单测，site 原始字节不在 delivery 身份。
- §7.5 **3 MET / 3 PARTIAL**：审核记录身份未绑定 delivery；视觉结论无 evidence ref；无机器可读“证据不足”。
- §8.4 **5 MET / 1 PARTIAL**：`delivery.evidence` 仅 ref+path、读取不重算哈希；视觉结论无结构化 ref。
- §9 **9.2 MET / 9.1+9.3 PARTIAL**；§12 **6 MET / 1 PARTIAL / 1 NOT MET（DoD-1）**。

**差距清单（交 03）**
1. `policy` 不读 `dangers`；`READ_STATE` 的 dangers 仅 `{x,y,state,hits}`，缺盒足迹/periodMs/activeMs/t。
2. `hazardModel` 仅 `axis:"x"`；纵向巡逻无等待/窗口。
3. `pickupAbove` 无条件起跳（仅近横向巡逻被 `jumpPredictionSafe` 抑制）。
4. 无进展/重复重置不终止；`stuck` 仅事后归因。
5. 等待无独立上限；跳跃按“已发键”冷却，不验证是否离地。
6. 契约不能表达主动停止（02 = NOT EXPRESSIBLE；08 待裁定）。
7. `review-record.subject` 未与 delivery 比对；`consistency.mjs` 无此检查。
8. `delivery.evidence` 不重算哈希；视觉结论无 evidence ref。
9. §9 缺纵向/喷发 fixture 与全量五态 E2E；§1 部分过时（FA-02 已 SUCCESS、FA-05/06 pass；`x=813/24 reset` 不可复现，现存失败样本 x=438/19 reset）。

**继承证据**
- **FA-04 视觉审核：可继承**（review-record subject 与 pack/v1·site/v1·shell 2、manifest `a162942d…feb3`、config `455d9c7f…7dcd` 一致；materials 44/44 哈希、capture 9 shot 齐；delivery.visualReview reviewer/time 匹配）。无需重审；产品路径不校验记录，07 仍须 effort 脚本核验。注意 6 项 ≠ §7.3 的 7 项；08/09 截图字节相同。
- **FA-05 报告/verdict：可继承为同一冻结对象的 `delivery=pass`；不可继承为 §5.5 通用策略已满足**（qa-report `dc20e301…5ee6`、evidence 36/36 哈希、consistency 12/12）。07 需重新聚合；字节变化即失效。
- **FA-06 回归：可继承为基线**（四命令 exit 0、2160/145；本轮 `ae339b9` 已独立复跑 test/typecheck exit 0）；04/05 后须重跑。
- **不可继承**：阶段 C visual pass；FA-02 25.8px 净空；`x=813/24 reset`；任何 pack/site/config/qa-report 字节变化后的 FA-04/FA-05；纵向/喷发无历史真实证据。

**待 03 裁定**
- 最终 verdict：继承 `pass` 只覆盖 delivery/试玩/视觉，不覆盖 P0-1 通用性；本轮应 `pass` / `incomplete` / `fail`？
- 是否批准 08 的最小 `stop?`；未批准前 05 如何降级表达主动停止。
- dangers 周期语义（periodMs=安全窗口、activeMs=喷发、周期相加；t 累计、命中不复位、重载归零）、纵向巡逻、pickupAbove 可达性、等待/无进展阈值。
- §7.5/§8.4 记录缺口：只记已知限制还是另开加固票；FA-04 6 项是否补成 §7.3 的 7 项。
