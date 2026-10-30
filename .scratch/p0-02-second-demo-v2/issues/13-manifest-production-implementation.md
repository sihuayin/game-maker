# 正式证据清单生产路径：实施

Type: task
Status: resolved
Blocked by: 01, 07

## Question

按票 07 的裁定实施生产路径。最低不变量：

1. **先红**：新增失败测试/命令，证明当前 `packages/` 内没有参数化清单生成能力 ——
   - CLI 不认识 `build-evidence-manifest`；
   - `packages/pipeline` 没有 spec → manifest 的生成核心。
2. **实施（票 07）**：
   - `packages/pipeline` 新增 `EvidenceManifestSpecSchema` 与生成核心：spec 含 `roots` / `subject` / `entries`（显式文件或递归目录 + `excludeExt` / `excludeDirs`）/ `records` / 可选 `generatedBy` / `note`；
   - 生成器确定性展开、排序、计算 sha256+bytes；任何声明/展开文件缺失、record 不在 files、subject 与实际 pack/config 或 `qa-report.delivery` 不符 → exit 4；
   - `packages/cli` 新增 `build-evidence-manifest --spec <spec> --out <manifest> [--force]`；`--out` 必填且必须在所有 root 之外；默认拒绝覆盖，`--force` 才重建；临时文件 + 原子 rename；
   - 清单必须把 `run/vN/mechanic-coverage.json` 列为 required，并登记 `role=mechanic-coverage` 的 record（票 02 Q8）；
   - 阶段 A spec 放在本 effort；`visual-review` record 绑定旧 `fa04` 审查记录作为历史证据（不重新审核、不伪装成新审核）。
3. **契约**：复用 `delivery-evidence-manifest/v1` 与 `ManifestSubjectSchema`；不新增 MCP；不隐式扩 schema。
4. **测试**：spec schema；生成器单测（空 roots、缺失文件、重复 records、record 不在 files、subject 不符、确定性排序、原子写）；CLI 测试（缺 `--spec`/`--out`、`--out` 在 root 内、默认不覆盖、`--force` 重建）；不破坏现有 `verify-delivery` 测试。
5. **真实证据**：为阶段 A 可写副本生成一份正式清单（含覆盖报告 required 文件与 `mechanic-coverage` record、旧 `fa04` 视觉记录作历史证据），写入本 effort 的冻结目录；用 `verify-delivery` 跑一次并记录命令、退出码、报告路径、身份、六项一致性；零付费。清单生成在票 14 的最终 attempt 之后（或按需重建），避免指向已撤销的旧写回。
6. **回归**：目标测试 + `pnpm typecheck`；不写旧 effort 的历史清单目录。

产物：代码 + 测试 + 清单 + `research/13-manifest-production-evidence.md`。未获票 07 裁定前不开工。

## Answer

**2026-10-30 实施收口。** 证据：[research/13-manifest-production-evidence.md](../research/13-manifest-production-evidence.md)。

### 实现

- 新 `packages/pipeline/src/evidence-manifest.ts`：`delivery-evidence-manifest-spec/v1`（roots/subject/entries/records）+ 生成核心；确定性展开/排序/哈希；缺文件、record 不在 files、同文件多 root/role 冲突、subject 与实际 pack/config 或 qa-report.delivery 不符 → exit 4。
- 新 CLI `build-evidence-manifest --spec <spec> --out <manifest> [--force]`；`--out` 必填且在 root 外；默认拒绝覆盖，`--force` 才重建；临时文件 + 原子 rename。
- 阶段 A spec 纳入 out 副本、旧 `fa04` 视觉记录（历史身份绑定）、旧 work 材料（optional）、`mechanic-coverage` required record。
- 不新增清单 schema、不扩 MCP。

### 证据

- 全量 `pnpm test` **155 文件 / 2279 tests** 全绿；`pnpm typecheck` exit 0；历史证据验收 exit 0。
- 阶段 A 清单：**217 文件（required 123 / optional 94）· 6 records**；`verify-delivery` **exit 0 / pass / 诊断 0**，声明↔重算六项一致；`mechanic-coverage` 内容核验通过。
- 基线副本 qa-report 仍为 `dc20e301…5ee6`；旧 work / 快照零改动；零付费、未提交。

### 已知限制

- 阶段 A 清单纳入旧 work 94 个 optional 历史材料（`materials.json` 自述）；不是本轮新产物。
- 当前 qa-report 的 playtest 仍指向旧 v2（harness v1）；票 14 产新 v2 attempt，票 15 重建清单。
