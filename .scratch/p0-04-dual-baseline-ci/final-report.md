# P0-04 最终验收报告：双基线可信 CI 接入

- 日期：2026-11-02
- 收口 base：`3439202`（07 收口后）；最终复核工作树见 [`runs/2026-11-02T06-45-50Z-final/`](runs/2026-11-02T06-45-50Z-final/)
- 总体结论：**PASS**
- 验收范围：双基线可信交付能力；**不**扩展为第二个独立游戏 Demo 的端到端生成验收

## 1. 结论边界

| 结论 | 状态 |
|---|---|
| FPVS-V1（基线 A）可信交付已验证 | **已验证** |
| P0-02 Second Demo V2（基线 B）可信交付已验证 | **已验证** |
| 两套基线均已接入同一套普通 PR 无法伪造的可信 CI 保护 | **已验证** |
| 第二个独立游戏 Demo 已完成端到端生成验收 | **未声称、未证明** |
| 非管理员无法绕过 | **未证明**；owner 仍保留 PR bypass |

## 2. AC 矩阵（PRD §6）

| AC | 验收条件 | 结果 | 证据 |
|---|---|---|---|
| AC-01 | 基线 A 冻结文件完整性 | **PASS** | A 223 / 151 / 72 / 13；`sha256:ba7a485b…36fd`；[01 审计](issues/01-readonly-dual-baseline-audit.md)、[最终复核实证](runs/2026-11-02T06-45-50Z-final/report.md) |
| AC-02 | 基线 B 冻结文件完整性 | **PASS** | B 231 / 137 / 94 / 6；`sha256:07866e0e…b9ab`；freeze 112/112；[01 审计](issues/01-readonly-dual-baseline-audit.md)、[最终复核](runs/2026-11-02T06-45-50Z-final/report.md) |
| AC-03 | 两套 Manifest 独立 | **PASS** | Registry 独立 entry；A/B Manifest 不同；73 路径重叠已披露；[05](issues/05-evidence-ci-dual-baseline.md) |
| AC-04 | 两套 SHA-256 信任锚独立 | **PASS** | A `ba7a485b…36fd`；B `07866e0e…b9ab`；[04](issues/04-baseline-b-anchor-and-update-log.md) |
| AC-05 | Base-only trusted evidence 保持 | **PASS** | [05 E3 run 41321106019](https://github.com/sihuayin/game-maker/actions/runs/41321106019)；负向 #20–#23 仍由 base 规则执行 |
| AC-06 | 双基线 Evidence CI | **PASS** | 05 E3；[07 green #19 run 41390243462](https://github.com/sihuayin/game-maker/actions/runs/41390243462) |
| AC-07 | 双基线 Baseline Update 隔离 | **PASS** | 06 E3：target A/B success、identity mismatch / freeze tamper 被拦截、合法 B 更新 success；main 未写回；[06](issues/06-baseline-update-dual-channel.md) |
| **AC-07b** | **`freezeHashes` 不可被普通更新改写** | **PASS** | 06 E3 [run 41388668495](https://github.com/sihuayin/game-maker/actions/runs/41388668495) → `candidate.freezeHashes-changed`；05 对 B Anchor/日志/`freeze-sha256.txt` 做字节比较 |
| AC-08 | 基线 A 篡改负向 PR | **PASS（被拦截）** | [#20](https://github.com/sihuayin/game-maker/pull/20) · [run 41390763321](https://github.com/sihuayin/game-maker/actions/runs/41390763321)：A fail / B pass；`test.exit` hash-mismatch |
| AC-09 | 基线 B 篡改负向 PR | **PASS（被拦截）** | [#21](https://github.com/sihuayin/game-maker/pull/21) · [run 41390771481](https://github.com/sihuayin/game-maker/actions/runs/41390771481)：A pass / B fail；freeze 111/112 |
| AC-10 | Manifest + Anchor 联合篡改 | **PASS（被拦截）** | [#22](https://github.com/sihuayin/game-maker/pull/22) · [run 41390785603](https://github.com/sihuayin/game-maker/actions/runs/41390785603)：`B Manifest differs from base Manifest` |
| AC-11 | 验收规则篡改 | **PASS（被拦截）** | [#23](https://github.com/sihuayin/game-maker/pull/23) · [run 41390792355](https://github.com/sihuayin/game-maker/actions/runs/41390792355)：base workflow 执行，head bypass 未执行；A fail / B pass |
| AC-12 | 正常双基线 PR | **PASS** | [#19](https://github.com/sihuayin/game-maker/pull/19) → merged `eedd15b`；四项 checks 全绿 |
| AC-13 | 原有 required checks 和 ruleset | **PASS（无回退）** | ruleset `26268801` active；`check`/`test`/`typecheck`/`evidence`；`strict_required_status_checks_policy=true` |
| AC-14 | Optional 文件状态 | **PASS（逐项报告）** | B optional 94 = `oldWork` 93 + `v3/chrome.log` 1；05 B step 逐条报告，缺失不拉红 required |
| AC-15 | 冻结文件与历史记录零修改 | **PASS** | 最终复核 501 个受保护文件零变化；A/B Manifest/Anchor/日志与 112 冻结文件一致；[最终复核](runs/2026-11-02T06-45-50Z-final/report.md) |
| AC-16 | 付费与生图调用 | **PASS（零调用）** | 全图零付费 API、零生图、零模型调用；未新增 Provider |

## 3. 基线复核

| 项 | 基线 A | 基线 B |
|---|---|---|
| 文件 / required / optional / records / roots | 223 / 151 / 72 / 13 / 9 | 231 / 137 / 94 / 6 / 3 |
| Manifest 原始字节 SHA-256 | `sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd` | `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab` |
| Anchor | `sha256:ba7a485b…36fd` | `sha256:07866e0e…b9ab` |
| 更新日志 | 最后一条与 Manifest 一致 | 最后一条与 Manifest 一致 |
| 冻结 112 | — | 112/112 verified；missing 0 / mismatched 0 / extra 0 |

- **A/B 路径重叠 73**：28 双方 required / 30 A required-B optional / 15 双方 optional。逻辑独立，物理证据部分重叠；负向样本使用各自独占 required。
- **Optional 94 精确构成**：`oldWork` 93 + `v3/chrome.log` 1；不再表述为“旧 work 94 个文件”。
- **2 个 Manifest 外 `chrome.log`**：`v1/v2/chrome.log` 不在 231 Manifest，但属于 112 冻结快照；由 `freeze-sha256.txt` 与 CI 的 112 校验覆盖。三个 `chrome.log` 已显式纳入 git（内容零变化），使 CI 可检出全部 112 文件。
- **`freezeHashes` 是否被 CI 钉住**：是。Registry 声明 `freezeHashes`；普通 PR 的 B 侧对 `freeze-sha256.txt` 做 head/base 字节相等比较，并对 112 文件逐条复算。它不是普通更新目标；重新冻结需另立裁定。

## 4. 证据链

| 阶段 | 证据 |
|---|---|
| 01 只读审计 | [report.md](runs/2026-11-01T12-28-50Z-baseline-audit/report.md) · PASS |
| 03 Registry 裁定 | [票 03](issues/03-registry-shape-and-isolation-ruling.md) · Q1–Q11 |
| 04 B Anchor/日志 | [report.md](runs/2026-11-01T14-40-03Z-b-anchor/report.md) · PASS |
| 05 Evidence CI | PR #14/#15/#16；E3 [run 41321106019](https://github.com/sihuayin/game-maker/actions/runs/41321106019) |
| 06 Baseline Update | PR #17/#18；E3 [41385937629](https://github.com/sihuayin/game-maker/actions/runs/41385937629)、[41385962594](https://github.com/sihuayin/game-maker/actions/runs/41385962594)、[41388656648](https://github.com/sihuayin/game-maker/actions/runs/41388656648)、[41388668495](https://github.com/sihuayin/game-maker/actions/runs/41388668495)、[41388674222](https://github.com/sihuayin/game-maker/actions/runs/41388674222) |
| 07 红绿验收 | 绿 #19 → `eedd15b`；负向 #20–#23 OPEN/BLOCKED；[报告](runs/2026-11-02T04-45-27Z-pr-acceptance/report.md) |
| 08 最终复核 | [report.md](runs/2026-11-02T06-45-50Z-final/report.md) · [facts.json](runs/2026-11-02T06-45-50Z-final/facts.json) |

## 5. 零回退与规则

- A 的 223/151/72/13、Anchor、更新日志零修改；B 的 231/137/94/6、Anchor、更新日志、112 冻结文件零修改。
- 四项 required checks 名称不变；ruleset `26268801` active，`strict_required_status_checks_policy=true`，未降低保护。
- A 的验收失败面保持不变：A 只比较 head Manifest；B 比较 Manifest + Anchor + 更新日志 + `freezeHashes`。这是**非对称**策略，不声称 A/B head-side 检查完全对称。
- Registry 未纳入 `pnpm check`；05 以单元测试覆盖 strict schema/未知字段/重复 ID/缺失基线/交叉绑定/仓库外 realpath/非 POSIX/`freezeHashes` 规则/集合不一致。

## 6. 文档

- [ADR 0002：双基线可信验收的信任边界与更新通道](../../docs/adr/0002-dual-baseline-trust-boundary.md)
- [双基线维护说明](maintenance.md)
- [ADR 0001](../../docs/adr/0001-evidence-trust-boundary.md) 继续有效。
- `CONTEXT.md` 未新增词条：本图没有产生需要进入词汇表的新领域术语；Registry/信任锚等术语保持现有用法，不写实现细节。

## 7. 限制

- owner-only：owner 仍有 PR bypass；没有证明非管理员无法绕过，也没有完整 organization audit log。
- A 的 head Anchor/更新日志单独被修改不会显式失败（A 只比 Manifest），但 base 验收不读取 head 副本。
- A/B 物理证据有 73 个路径重叠；不是完全物理独立。
- Optional 缺失只报告，不拉红 required；Optional 存在但哈希不符按既有规则处理。
- 2 个 Manifest 外 `chrome.log` 依赖 `freeze-sha256.txt`；该文件由 CI 钉住，但不是普通更新目标；重新冻结属于新的裁定/版本。
- 负向 PR #20–#23 仍 OPEN/BLOCKED，按纪律未合并；它们是验收证据，不是待合并变更。
- 证据完整性通过不等于游戏功能、机制覆盖、人工视觉审核完成，也不等于第二个独立 Demo 的生成验收。
- 当前 Registry/workflow 固定 A/B；第三套基线不在 P0-04 范围。

## 8. 零付费与最终结论

- 零付费 API、零生图、零模型调用；未新增 Provider/Provider Switch；未修改游戏生成管线业务逻辑。
- 最终结论：**P0-04 完成的是“双基线可信交付能力”** —— 两套独立冻结基线各自拥有 Manifest 与 SHA-256 信任锚，并同时受同一套普通 PR 无法伪造的 CI 保护；普通 PR 无法通过修改交付文件、Manifest、Anchor、Registry 或 head 验收规则绕过检查；受控 owner 通道可以分别维护两套基线。
- 不把本结论扩展为“第二个独立游戏 Demo 已完成端到端生成验收”。
