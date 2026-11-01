# Registry 信任边界与双基线独立性研究

Type: research
Status: resolved
Blocked by: —

## Question

研究并写出报告：一个只声明基线身份与路径、**不存摘要**的 registry，如何避免成为新的自证信任根；A/B 的独立 Anchor 与更新日志如何在同一个 registry 下保持隔离；普通 PR 修改 registry / Manifest / Anchor 时，base-only 验收如何给出明确失败。

### 必须回答

1. **威胁模型**：普通 PR 作者、owner bypass、管理员/GitHub 管理权限被攻陷分别能做什么；明确哪些在本图防御范围内（对齐 P0-03 ADR 0001 与裁定 Q3/Q7）。
2. **Registry 不自证**：registry 只声明身份与路径、不存摘要时，信任仍来自哪里；为什么从可信 base 读取 registry 就能避免 PR 自证；如果 PR head 的 registry 与 base 不同，应该拒绝、忽略还是给出诊断。
3. **三种 registry 形状对比**：
   - 集中 registry（`.scratch/baselines/registry.json`，R2-Q3 已选位置）；
   - 每基线一个 descriptor 文件；
   - workflow 内显式硬编码两套路径。
   覆盖：字段 schema、路径校验、base/head 双份比较、registry 自身更新通道、A 现有文件的兼容、失败诊断、未来第三套基线的扩展成本（只比较，不实施）。
4. **双基线独立性**：Manifest / Anchor / 更新日志 / 检查结果 / artifact 如何各自隔离；更新 A 不改变 B、更新 B 不改变 A 的物理与逻辑边界。
5. **更新通道语义**：`baseline-update.yml` 是“owner PR 改目标 Manifest/Anchor/日志 + dispatch 验证候选”，还是“workflow 自动写回”；两种方式分别如何满足“仅更新目标基线”“失败无半更新”“可追溯操作者/旧摘要/新摘要/提交 SHA/时间”。
6. **汇总判定**：单 job 双 step 下，A/B 任一失败、step 被跳过、报告缺失、artifact 未生成时，如何保证整体 `evidence` FAIL，而不是误判 PASS。
7. **A 兼容**：A 的 `expected-hashes.json`、`expected-hashes.sha256`、`MANIFEST-UPDATES.md` 零改动时，registry 如何引用它们；扩展 `check-manifest-updates` 时如何证明 A 行为不回退。
8. **报告身份**：`verify-delivery` 报告是否需要 `baselineId` 或等价字段，避免 A/B 报告混淆；若不改 CLI，CI 如何区分。

### 材料

- PRD：`docs/v7.6/接入.md` §3.2、§4 P0-04-02/03/04、§5。
- P0-03：`.scratch/p0-03-evidence-trust/map.md`、`docs/adr/0001-evidence-trust-boundary.md`。
- 现有实现：`.github/workflows/evidence.yml`、`.github/workflows/baseline-update.yml`、`scripts/evidence-acceptance.mjs`、`scripts/check-manifest-updates.mjs`、`packages/pipeline/src/evidence-integrity.ts`（`trust.anchor`）。

### 产出

- `research/registry-trust-boundary.md`：事实、威胁模型、方案对比、推荐与未决点；区分 E1/E2/E3 证据档位。
- 只读研究：不改代码、不改配置、不提交、不推送。
- 结尾列出交给 03 的**待裁定问题清单**，不要替用户做架构决策。

## Answer

**已收口（2026-11-01）。** 产出：[registry-trust-boundary.md](../research/registry-trust-boundary.md)（969 行）。只读研究；未改代码/配置/Manifest/Anchor/日志，未提交、未推送。

### 关键结论

1. **Registry 是路由表，不是信任根**：只存基线 ID → Manifest / Anchor / 更新日志路径；信任仍来自受保护 base 的 workflow、验收脚本、各基线 Manifest/Anchor 与 ruleset。registry 不存摘要，避免制造第二期望值。
2. **Base-only 读取足以阻止 PR 自证**：PR 改 Manifest/Anchor/registry 不改变本次验收使用的可信副本。
3. **Head registry 差异策略**：安全上“忽略”足够；但为“明确失败”与防止有写权限协作者合并弱化配置，研究推荐普通 PR 要求 **registry 字节相等，不同即 FAIL**（`registry.head-diff`），owner 更新走 dispatch + PR。属 03 待裁定项（OD-05）。
4. **集中式 `.scratch/baselines/registry.json` 是三种形状中综合最优**：A 的三件文件可原样引用；交叉绑定/重复路径可在同一校验器检查；第三套基线只需加 entry。限制：registry 不能直接驱动 `actions/checkout` 的 sparse 路径，需硬编码 A/B union + 覆盖断言（OD-15）。
5. **A/B 物理证据不独立**：两个 Manifest 有 **73 个绝对路径重叠**，其中 **28 个双方 required（`fa04`）**、30 个 A required / B optional（`fpvs-v1-final/work`）、15 个双方 optional；B 另有 **109 个独占 required**（`out`/freeze）。**07 的 A/B 负向样本必须使用各自独占的 required 路径**，否则一次篡改同时打红两套，无法证明“不相互掩盖”。
6. **更新通道**：推荐沿用 P0-03 的“owner PR 改目标文件 + 只读 `workflow_dispatch` 验证候选”；自动写回与 Out of scope 的“自动更新基线”冲突，且坏更新在 push 后难以原子撤销。
7. **汇总判定**：必须检查 A/B 的真实 `outcome`、`summary.json`、`report.json`、`status`、Anchor 结果、期望 Manifest 路径/摘要，再 `exit 1`；`if: always()` 只保证执行；**禁止** job 级 `if` 或 paths 过滤（会误报 Success/Pending）；artifact 用 `if-no-files-found: error` 或汇总前 pre-check。
8. **A 兼容零改动**：`check-manifest-updates.mjs` 已用 `--log/--manifest` 参数化，最低风险是 A 原命令 + B 并列调用；严格新字段（`baselineId`/`operator`/`commitSha`）只能可选，A 旧日志没有这些字段。
9. **报告身份**：`verify-delivery` 当前无 `baselineId`，且 A/B `subject` 完全相同；P0-04 不必改 CLI，用独立 OUT 目录/artifact + 期望路径/摘要校验即可；若加身份，必须可选。
10. **证据档位**：本研究为 E1 / E1-doc / E3-本地（摘要、日志一致性、路径重叠复算），**没有新增 E2 或 E3-CI**。

### 交给 03 的待裁定问题（研究 §11，OD-01–OD-18）

Registry schema 与严格度；基线 ID 与身份映射；路径校验规则；必需基线集合；head registry 策略；head Anchor/日志是否字节相等；registry 更新通道与目标隔离；更新记录位置与字段；owner-only 强制执行；汇总判定细节；artifact 布局；报告身份；`check-manifest-updates` 扩展形状；B Anchor 格式；sparse 覆盖与漂移检测；bootstrap 顺序；registry 是否进 `pnpm check`；07 负向样本路径选择。

### 已回灌

- 地图 Notes 已记录 73/28 路径重叠事实；[真实 PR 红绿验收](../issues/07-real-pr-red-green-acceptance.md) 已要求 A/B 负向样本使用各自独占 required 路径。
- [Evidence CI 双基线验收](../issues/05-evidence-ci-dual-baseline.md) 已补充汇总判定与 bootstrap 探测约束。
