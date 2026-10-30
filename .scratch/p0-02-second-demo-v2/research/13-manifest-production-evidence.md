# 票 13 · 正式证据清单生产路径实施证据

- 日期：2026-10-30
- 票：[清单生产实施](../issues/13-manifest-production-implementation.md)
- 上游裁定：[票 07](../issues/07-manifest-production-path.md) · `rulings-2026-10-29.md` 第 9 节
- 结论：**spec → `delivery-evidence-manifest/v1` 生产路径落地；E2 全绿；阶段 A 清单 + `verify-delivery` E3 通过**。零付费；未提交；历史零改动。

## 1. 红：改动前的缺陷

[00-stage-a-facts.md](00-stage-a-facts.md) §7 记录（HEAD `f0411e6`）：

- 清单 schema 已在 `packages/pipeline`，`verify-delivery` 已存在；
- 生成器只存在于 `.scratch/evidence-integrity-v1/tools/build-manifest.mjs`，roots/文件规则/records 全部写死；
- `packages/` 与根脚本没有引用；CLI 不认识 `build-evidence-manifest`。

## 2. 绿：实现内容

- 新 `packages/pipeline/src/evidence-manifest.ts`：
  - `delivery-evidence-manifest-spec/v1`：`roots` / `subject` / `entries`（file 或 dir + `excludeExt` / `excludeDirs`）/ `records` / 可选 `generatedBy` / `note`；
  - 展开 entries、确定性排序、计算 sha256/bytes；任何声明/展开文件缺失、record 不在 files、同一文件多 root、role 冲突 → exit 4；
  - subject 校验：从清单内 `qa-report` 的 `delivery` 取 pack/site；用实际 `pack/vN/manifest.json` 与 config 字节重算，逐字段比对，并检查 `delivery.pack.manifestChecksum`；
  - `--out` 必须在所有声明 root 之外（复用 `assertOutOutsideRoots`）；默认拒绝覆盖，`--force` 才重建；临时文件 + 原子 rename。
- 新 `packages/cli/src/manifest.ts` + CLI 命令：
  `build-evidence-manifest --spec <spec.json> --out <manifest.json> [--force] [--json]`。
- `evidence-integrity.ts` 导出 `ManifestSubjectSchema`；不新增清单 schema、不扩 MCP。

## 3. E2

| 测试 | 结果 |
|---|---|
| `packages/pipeline/tests/evidence-manifest.test.ts` | 5 tests（展开/排序/哈希、覆盖拒绝、缺文件/record/空目录/subject 不符、out 在 root 内、确定性） |
| `packages/cli/tests/build-evidence-manifest.test.ts` | 3 tests（缺参数、成功+覆盖拒绝+--force、out 在 root 内） |
| 全量 `pnpm test` | **155 文件 / 2279 tests** 全绿 |
| `pnpm typecheck` | exit 0 |
| 历史证据验收（`--out` 本 effort） | exit 0（223 文件 / 13 records / 诊断 0） |

## 4. E3：阶段 A 正式清单 + verify-delivery

Spec：`.scratch/p0-02-second-demo-v2/manifest/stage-a-spec.json`

- roots：`out` = 本 effort 可写副本；`fa04` = 旧视觉审核目录（历史身份绑定）；`oldWork` = 旧 work（materials.json 自述材料的只读历史来源）。
- entries：out 下 wasteland-scavenger-recipe 递归（排除 `.log`）、fa04 递归、oldWork 递归（optional）、`playtest/v2/chrome.log`。
- records：`qa-report`、`playtest-result`、`mechanic-coverage`、`visual-review`、`visual-materials`、`visual-capture`。
- subject：`wasteland-scavenger-recipe v1 · site v1 · shell 2`，manifest/config checksum 与冻结身份一致。

生成：

```
node packages/cli/dist/cli.mjs build-evidence-manifest \
  --spec .scratch/p0-02-second-demo-v2/manifest/stage-a-spec.json \
  --out .scratch/p0-02-second-demo-v2/manifest/stage-a-manifest.json --force
```

- 退出码 **0**；清单 **217 文件（required 123 / optional 94）· 6 records**；日志 `runs/ticket13-manifest-build.log`。

校验：

```
node packages/cli/dist/cli.mjs verify-delivery \
  --manifest .scratch/p0-02-second-demo-v2/manifest/stage-a-manifest.json \
  --out .scratch/p0-02-second-demo-v2/runs/manifest-verify
```

- 退出码 **0**；**pass**；diagnostics **fail 0 / blocked 0**；声明 pass ↔ 重算 pass，六项一致。
- `mechanic-coverage` 记录内容核验通过（format v2 / `probe.executed=true` / `verdict=satisfied` / subject 六字段一致）。
- 报告：`runs/manifest-verify/2026-10-30T04-40-18-693Z-delivery-verification/report.json`。

## 5. 历史与零付费

- 基线副本 qa-report 仍为 `dc20e301…5ee6`；旧 work 95/95、冻结快照 66/66 未变。
- 生成/校验只读证据；零模型/付费调用；未提交、未推送。
- 阶段 A 最终清单会在票 14 的新 v2 attempt 与票 11 的撤销/恢复之后再重建一次（票 15），当前清单已证明生产路径可用。

## 6. 已知限制

- 阶段 A 清单为了 `materials.json` 的历史自述材料，纳入了旧 work 的 94 个 optional 文件；它们是历史证据，不是本轮新产物。
- 当前 qa-report 的 `delivery.playtest` 仍指向旧 v2（harness v1）attempt；票 14 会产新的 v2 attempt，票 15 重建清单。
- 生成器不解析 `entries` 之外的引用；清单的完整性由 spec 的显式声明保证。

## 7. 变更文件

- `packages/pipeline/src/evidence-manifest.ts`（新）+ `src/index.ts`
- `packages/pipeline/src/evidence-integrity.ts`（导出 `ManifestSubjectSchema`）
- `packages/pipeline/tests/evidence-manifest.test.ts`（新）
- `packages/cli/src/manifest.ts`（新）+ `src/cli.ts`
- `packages/cli/tests/build-evidence-manifest.test.ts`（新）
- `.scratch/p0-02-second-demo-v2/manifest/stage-a-spec.json`（effort-local）
