# DoD 收口：回归、证据聚合与最终结论

Type: task
Status: resolved
Blocked by: 01, 07

## Question

按 `docs/v7.6/验收.md` §12 的 10 条 DoD 逐项收口：

- 正式入口重算范围内全部必需证据哈希；缺失 / 篡改 / 不可读可被发现；
- 身份、引用、关键报告一致性得到正式校验；
- 最终结论从当前有效检查重算，声明与重算差异可定位；
- 负向测试覆盖篡改、缺失、错配、路径逃逸、结论过期；
- 测试证明原始证据、历史记录、受保护交付未被修改；
- 冻结 Demo 通过正式基线重验，或对差异给出明确、可审计的解释；
- `pnpm test` / `pnpm typecheck` / `pnpm test:playtest` / `pnpm test:acceptance` / `pnpm test:evidence` 全部通过（记录退出码）；
- 无付费调用、无历史版本覆盖、无阈值降低。

产物：
- 最终验收记录（`runs/<timestamp>-final-acceptance/`）：`report.json` / `report.md` 副本、回归日志、DoD 10 条逐项判定、已知限制（含信任边界、单 Demo、`visual-review` 机器边界、MCP 未做、耗时）；
- map 的 Decisions-so-far 追加本票 gist，地图关闭；
- 不覆盖任何历史记录；提交/推送需单独授权。

最终结论只在「证据完整性通过 + 六项重算一致 + 声明与重算一致」时为 `pass`；任何未知不得升级为通过。

## Answer

**已收口（2026-10-29）。最终结论：`pass`。** 最终验收记录：`runs/2026-10-29T05-04-57Z-final-acceptance/`
（`final-acceptance.json` / `final-acceptance.md`、`report.json` / `report.md` 副本、`regression/` 日志与退出码、
`snapshot-before/after.json`、`07-inherited-copy.json`、`acceptance/`、`evidence/`）。

### 证据完整性重算

- `pnpm test:evidence` → **exit 0**，`status=pass`，**1,546 ms**，读取 19.3 MB；
  清单 `.scratch/evidence-integrity-v1/manifest/expected-hashes.json`（**223 文件 / 151 required / 72 optional**，sha256 `ba7a485b…36fd`）。
- 文件 **223/223 verified** · 身份 **11/11 verified** · 一致性 **144/144 verified** · records 13 · **diagnostics 0**。
- declared **pass** / recomputed **pass**（由当前证据经 `deriveDeliveryVerdict` 重导出）· verdictMatch=true · 六项检查逐项 match=true。
- 报告：`report.json`（sha256 `7f1bb152…dda2`）/ `report.md`；运行记录 `evidence/<stamp>-test-evidence/summary.json`。

### 回归（全部 exit 0）

| 命令 | exit | 结果 |
|---|---|---|
| `pnpm test` | 0 | 149 文件 / 2231 用例 |
| `pnpm typecheck` | 0 | 全包 tsc 通过 |
| `pnpm test:playtest` | 0 | self-test 4/4（gate/pickup/input/hazard-legacy）· 10 文件 / 143 用例 |
| `pnpm test:acceptance` | 0 | vitest + mechanic-probe + coverage `satisfied`，`allOk=true`（输出重定向到本运行目录） |
| `pnpm test:evidence` | 0 | 见上 |
| 07 独立交叉 | 0 | **27/27**，failed 0 |

### DoD 10/10 MET

1. 重算范围哈希：223/223 verified（required 151）。
2. 缺失/篡改/不可读：负向测试 `hash-mismatch` / `missing` / `unreadable` 全覆盖。
3. 身份/引用/一致性：身份 11/11、一致性 144/144；13 records 全解析；diagnostics=0。
4. 结论重算：declared=recomputed=pass，非继承历史声明。
5. 差异可定位：`comparison.checks` 逐项 + 诊断带 root/path/rule。
6. 负向覆盖：18 个 pipeline 用例（篡改/缺失/身份/三方矛盾/verdict 不一致/`..`/不可读/三类符号链接/绝对路径/引用错 attempt/材料集合/结论过期/只读/确定性）+ 6 个 CLI 用例。
7. 只读性：**312 个受保护文件前后逐文件 sha256 零变化**；证据目录 `git status` 零改动。
8. 基线重验：本次 pass；07 交叉 27/27；无差异需解释。
9. 回归：上表五项 + 07 全部 exit 0。
10. 约束：零付费调用、零历史覆盖、零阈值/结论规则改动、本轮源码改动为零。

### 产物与边界

- 新产物只写入新目录：`runs/2026-10-29T05-04-57Z-final-acceptance/` 与 `.scratch/playtest-v1/runs/2026-10-29-self-test/`；未覆盖任何历史记录。
- 聚合脚本：`.scratch/evidence-integrity-v1/tools/write-final-acceptance.mjs`（只读输入，`EI_BASE` 指定输出根）。
- 已知限制：信任边界（清单随证据一起被改无法自证，靠 git 历史与人工审查）；单 Demo；`visual-review` 只验记录不重判；
  不重新执行游戏/QA/试玩；MCP 未镜像；`*.log` 为 optional、不在信任边界；耗时 1.5 s（CLI）/ 19.3 MB，不作性能门槛；
  证据完整性通过 ≠ 五态 E2E、机制覆盖或视觉审核范围已完成。
- 未提交、未推送（需单独授权）。
