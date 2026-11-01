# Evidence CI 双基线验收

Type: task
Status: open
Blocked by: 03, 04

## Question

把基线 B 纳入现有 `evidence` required check，使每个相关 PR 同时接受 A/B 两套独立验收；保留 A 的原有行为、required check 名称和 ruleset，不新增 required check。

### 必须完成

1. **base-only 信任**：workflow、CLI、registry、Manifest、Anchor、更新日志全部从受保护 base 读取；PR head 只作为数据读取，绝不执行。
2. **Sparse checkout**：
   - base 侧至少覆盖：`packages`、`scripts`、`.scratch/baselines`、A 的 manifest 目录、B 的 manifest 目录（Manifest/Anchor/更新日志）。
   - PR head 侧至少覆盖：A 的交付 roots（现有路径）、B 的三个 roots（`fa04` / `oldWork` / `out`）、A/B 的 manifest 目录、`.scratch/baselines`。
   - 不得只检出 Manifest 而遗漏实际交付文件，制造虚假 PASS。
3. **双独立 step**：
   - A step 保持 P0-03 的检查逻辑与诊断，行为不回退。
   - B step 独立执行：校验 PR B Manifest 与 base B Manifest 字节相等、读取 base B Anchor、用 base 逻辑验证 137 required / 94 optional / 6 records，逐条报告 optional 状态。（optional 94 的精确构成：`oldWork` 93 + `v3/chrome.log` 1；01 审计核实）
   - B step 使用 `if: always()`，A 失败时仍执行。
4. **汇总判定**：
   - 汇总 step 必须 `if: always()` 运行；
   - 检查 A、B 的真实退出状态，任何一套失败、step 被跳过、`summary.json`/`report.json` 缺失、`status != pass`、Anchor 异常，整体 `evidence` FAIL；
   - 不能因 artifact 未生成、step skipped 或输出缺失误判 PASS；
   - 输出 A/B 各自的诊断与汇总结论。
5. **Artifact**：A/B 各自 artifact（含 report.json/report.md/summary.json），再加一份双基线汇总 artifact；保留 30 天。
6. **测试**：为汇总判定写 E2 测试（A fail/B pass、A pass/B fail、双 fail、报告缺失、status 非 pass、anchor mismatch），并覆盖 A 回归。
7. **E3**：合并后用一个临时正常 PR 跑一次真实 `evidence`，记录 run URL、A/B 结果与耗时；07 票再做正式红绿样本。
8. **约束**：不新增 required check、不改 ruleset、不降低保护等级；不修改 A/B 冻结交付、Manifest、Anchor、更新日志；本票一个 PR。
9. **冻结快照覆盖（01 审计输入）**：B 冻结 112 中 `run/v1/playtest/v1/chrome.log` 与 `v2/chrome.log` 不在 231 清单，仅由 `freeze-sha256.txt` 固定，而该清单未被 Anchor 钉住。按 03 待裁定 9 执行：若 registry/CI 选择验证 112 快照，sparse 必须包含 `freeze-sha256.txt`，B step 逐条校验 112 个哈希并在 mismatch/missing 时 FAIL；若接受 231 为验收面，必须在 08 的限制中写明“2 个旧 attempt Chrome 日志不在 CI 覆盖内，由 git 历史负责”，不得静默。

### 研究输入（02）

- **汇总判定**：必须检查 A/B 的 `outcome`、`summary.json.pass/status/exitCode`、`report.json.status`、`report.input.manifest.path/sha256`、`trust.result=matched`、文件存在；任何一项缺失或非成功即 `exit 1`。artifact 用 `if-no-files-found: error` 或汇总前 pre-check。
- **禁止** job 级 `if` 或 paths 过滤：条件跳过的 job 会报 Success，paths 过滤会让 required check 停在 Pending。汇总 step 必须 `if: always()`，不要 `continue-on-error`。
- **Sparse 覆盖**：硬编码 A/B union；base 脚本读取 registry 与 Manifest roots，断言每个 Manifest/Anchor/日志和每个 root 都存在；缺失 ⇒ `registry.sparse-missing` FAIL，不能当“无差异”。
- **Bootstrap**：`pull_request_target` 使用 base workflow，因此“引入 B 检查的 PR”本身通常仍跑旧逻辑；05 合并后必须用 dispatch 或一个合并后探测 PR 补足首次真实 B step 证据，不得声称引入 PR 已执行新 B step。
- **A 失败面**：是否把 A 的比较扩展到 head Anchor/更新日志由 03 的 OD-06 裁定；若保持 A 现状，08 必须说明“只改 A Anchor/日志不会显式失败，但不会被使用”。
- **报告身份**：P0-04 可先用独立 OUT 目录（如 `.../A`、`.../B`）+ 期望路径/摘要校验；若加 CLI `baselineId`，必须可选，不能破坏旧报告。

## 验收标准

- 正常 PR：A/B 均 PASS，`evidence` PASS。
- A required 文件被篡改：`evidence` FAIL。
- B required 文件被篡改：`evidence` FAIL。
- B Manifest 被篡改：`evidence` FAIL。
- B Anchor 被篡改：`evidence` FAIL（使用 base Anchor，PR 副本不能自证）。
- Optional 缺失：Required 检查仍 PASS，但必须逐条报告，不静默。
- A 的检查行为与 P0-03 一致；`check`/`test`/`typecheck`/`evidence` 四个 required check 名称不变。
