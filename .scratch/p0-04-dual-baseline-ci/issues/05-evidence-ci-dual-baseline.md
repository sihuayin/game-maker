# Evidence CI 双基线验收

Type: task
Status: open
Blocked by: 03, 04

## Question

把基线 B 纳入现有 `evidence` required check，使每个相关 PR 同时接受 A/B 两套独立验收；保留 A 的原有行为、required check 名称和 ruleset，不新增 required check。

### 必须完成

1. **base-only 信任**：workflow、CLI、registry、Manifest、Anchor、更新日志全部从受保护 base 读取；PR head 只作为数据读取，绝不执行。
2. **Sparse checkout + 覆盖断言（03 Q8）**：
   - base 侧至少覆盖：`packages`、`scripts`、`.scratch/baselines`、A 的 manifest 目录、B 的 manifest 目录（Manifest/Anchor/更新日志）、B 的 `freeze-sha256.txt`。
   - PR head 侧至少覆盖：A 的交付 roots（现有路径）、B 的三个 roots（`fa04` / `oldWork` / `out`）、A/B 的 manifest 目录、`.scratch/baselines`、B 的 `freeze-sha256.txt`。
   - base 脚本读取 Registry 后断言每个 Manifest/Anchor/更新日志/`freezeHashes` 路径和每个 Manifest root 都已 checkout；缺失 ⇒ `registry.sparse-missing` FAIL，不能静默跳过。
   - 不得只检出 Manifest 而遗漏实际交付文件，制造虚假 PASS。
3. **双独立 step**：
   - A step 保持 P0-03 的检查逻辑与诊断，行为不回退。
   - B step 独立执行：校验 PR B Manifest 与 base B Manifest 字节相等、读取 base B Anchor、用 base 逻辑验证 137 required / 94 optional / 6 records，逐条报告 optional 状态（optional 94 = `oldWork` 93 + `v3/chrome.log` 1）。
   - B step 还必须校验 PR head 的 Anchor、更新日志、`freeze-sha256.txt` 与 base 字节相等（03 Q2）；并用 base 的 `freeze-sha256.txt` 逐条复算 PR head 的 **112 个冻结文件**，全部按 required 处理（含 2 个 `chrome.log`），任一缺失/摘要不符 ⇒ B FAIL（03 Q8）。
   - B step 使用 `if: always()`，A 失败时仍执行。
4. **汇总判定**：
   - 汇总 step 必须 `if: always()` 运行；
   - 检查 A、B 的真实退出状态，任何一套失败、step 被跳过、`summary.json`/`report.json` 缺失、`status != pass`、Anchor 异常，整体 `evidence` FAIL；
   - 不能因 artifact 未生成、step skipped 或输出缺失误判 PASS；
   - 输出 A/B 各自的诊断与汇总结论。
5. **Artifact**：A/B 各自 artifact（含 report.json/report.md/summary.json），再加一份双基线汇总 artifact；保留 30 天。
6. **测试**：
   - 汇总判定 E2：A fail/B pass、A pass/B fail、双 fail、报告缺失、status 非 pass、anchor mismatch。
   - Registry E2（03 Q10）：严格 schema/未知字段拒绝、重复 ID、缺失必需基线、A/B 路径交叉绑定、仓库外 realpath、非 POSIX 路径、`freezeHashes` B 必填/A 不需要、Registry 集合与 workflow 固定集合不一致。
   - Wrapper E2（03 Q6）：A 原命令输出/退出码/失败行为不变；B 严格日志字段；A 兼容字段。
   - 112 冻结验证 E2：缺失/哈希不符/多余文件；A 回归。
7. **E3 / bootstrap（03 Q2/Q9）**：05 引入 Registry 的 PR 必须由可信 Base 上的旧 workflow 执行 owner dispatch 验证候选；明确区分 base workflow、候选 PR head 和目标 SHA；验证通过后才合并，不能让候选 Head 自己提供的 workflow 成为验证依据。合并后立即用一个临时正常 PR 跑一次真实 `evidence`，记录 run URL、A/B 结果与耗时；07 再做正式红绿样本。
8. **约束**：不新增 required check、不改 ruleset、不降低保护等级；不修改 A/B 冻结交付、Manifest、Anchor、更新日志；本票一个 PR。
9. **冻结快照覆盖（03 Q8 已裁定）**：B 冻结 112 中 2 个 `chrome.log` 不在 231 清单，但必须纳入额外冻结完整性验证。sparse 必须包含 `freeze-sha256.txt`；B step 用 base 的 `freeze-sha256.txt` 逐条验证 PR head 的 112 个文件（全部按 required，含 2 个日志），任一缺失/摘要不符 ⇒ B FAIL；`freeze-sha256.txt` 本身按 Q2 与 base 字节相等。
10. **Registry（03 Q1/Q9）**：创建 `.scratch/baselines/registry.json`。顶层 `format` + `baselines[]`；每项 `id` / `name` / `manifestFormat` / `manifest` / `anchor` / `updateLog` / `identity`，B 增加 `freezeHashes`（A 不需要）；不存摘要/counts；严格拒绝未知字段；路径为仓库根相对 POSIX、realpath 在仓库内、三件同目录、A/B 路径不交叉；workflow 显式断言集合恰为 `fpvs-v1` 与 `p0-02-second-demo-v2`。
11. **Wrapper（03 Q6）**：新增 `scripts/check-baseline-updates.mjs`，从 Registry 读取 A/B 并分别调用现有 `scripts/check-manifest-updates.mjs`；现有脚本零改动；B 严格日志字段、A 兼容字段。

### 03 裁定输入（2026-11-01）

- **Q1**：集中式 Registry + 严格 schema + `freezeHashes`（B 必填、A 不需要）；不存摘要/counts；workflow 固定集合断言。
- **Q2**：Registry 字节相等；A 只比 Manifest（保持原失败面）；B 比 Manifest + Anchor + 更新日志 + `freezeHashes`；bootstrap 由 base 旧 workflow 的 owner dispatch 验证候选。
- **Q4**：单 job 双 step；A/B/aggregate 完整判定；三份 artifact；`if-no-files-found: error`；禁止 job 级 `if`/paths 过滤。
- **Q5**：不改 `verify-delivery`；`evidence-acceptance` summary 增加可选 `baselineId`；独立 OUT/artifact；aggregate 按 Registry/Anchor 校验报告身份。
- **Q6**：旧 `check-manifest-updates.mjs` 零改动；新增 `scripts/check-baseline-updates.mjs` wrapper；B 严格日志字段、A 兼容。
- **Q8**：硬编码 A/B union；覆盖断言；112 文件全部按 required 验证（含 2 个 `chrome.log`）；缺失/不符 B FAIL。
- **Q9**：05 引入 Registry；06 依赖 05。
- **Q10**：Registry 校验只加单元测试，不纳入 `pnpm check`。

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
- A 的检查行为与 P0-03 一致（只比 Manifest）；B 比 Manifest + Anchor + 更新日志 + `freezeHashes`；Registry 本身字节相等；`check`/`test`/`typecheck`/`evidence` 四个 required check 名称不变。
- Registry schema/集合断言/未知字段/交叉绑定测试通过；Registry 尚未合并时不污染 `pnpm check`。
- B 的 112 个冻结文件（含 2 个 `chrome.log`）缺失或哈希不符 ⇒ B FAIL；`freezeHashes` 被 PR 修改 ⇒ B FAIL。
- Wrapper 不改变 A 原调用输出/退出码/失败行为；bootstrap 由 base 旧 workflow 的 owner dispatch 验证候选。
