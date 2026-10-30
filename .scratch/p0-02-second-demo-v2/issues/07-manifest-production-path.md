# 正式证据清单与 verify-delivery 的生产路径

Type: grilling
Status: resolved
Blocked by: （无）

## Question

HITL：`verify-delivery` CLI 已存在，清单 schema 也已在 `packages/pipeline`，但清单生成器只存在于 `.scratch/evidence-integrity-v1/tools/build-manifest.mjs`，roots/文件规则/records 全部写死，`packages/` 与根脚本没有引用（`packages/pipeline/src/evidence-integrity.ts:50-111,1177-1289`；`.scratch/evidence-integrity-v1/tools/build-manifest.mjs:23-33,72-130,166-180`）。请裁定生产路径：

- (a) **参数化生成器 + CLI**：在 `packages/pipeline` 新增生成核心（显式 roots / subject / 文件选择规则 / records；默认拒绝覆盖，`--force` 才重建），在 `packages/cli` 加薄命令（如 `build-evidence-manifest`），补单测与 CLI 测试；不扩 MCP，不新增清单 schema。
- (b) 只做 `packages/pipeline` 库，不加 CLI；由 effort 脚本/测试调用。
- (c) 只把 effort 脚本做最小参数化搬进 `packages/`，保留 effort 包装。
- (d) 阶段 A 先用 effort 工具为可写副本生成清单，记录生产路径缺口，不写生产代码。

已知事实：清单 schema 为 `delivery-evidence-manifest/v1`；`verify-delivery` 的 `--out` 已在 root 外、原子目录、不覆盖；MCP 本版不扩；阶段 A 收口需要一个冻结快照 + 清单 + `verify-delivery` 的真实运行。

建议（待裁定）：**(a)**。理由：用户要求「生产路径」而不是一次性脚本；参数化生成器 + CLI 薄壳是最小但完整的生产入口，复用现有 schema，不扩 MCP。若批准，本票同时批准新增 CLI 命令（Q5 边界）。

产物：票内 Answer + 追加裁定；未裁定前不写生产代码。

## Answer

**2026-10-29 HITL 收口。** 逐字裁定见 [rulings-2026-10-29.md 第 9 节](../rulings-2026-10-29.md)。

### 已定契约

| 项 | 决定 |
|---|---|
| 生产路径 | `packages/pipeline` 参数化生成核心 + `packages/cli` 薄命令 `build-evidence-manifest`；复用 `delivery-evidence-manifest/v1`；不扩 MCP、不新增清单 schema |
| 输入模型 | `build-evidence-manifest --spec <spec.json> --out <manifest.json> [--force]`；spec 声明 `roots`、`subject`、`entries`、`records`；生成器确定性展开、排序、计算 sha256/bytes 并写盘 |
| entries | 支持显式文件与递归目录（`excludeExt` / `excludeDirs`）；任何声明或展开的文件缺失 → exit 4 |
| records | 显式列出；每条必须能在 `files` 中找到；沿用 `role` / `required` / `identity` |
| subject | spec 显式给出；生成器用实际 `pack/vN/manifest.json` + config 字节重算校验，并与清单内 `qa-report.delivery` 比对；不一致 → exit 4 |
| 输出 | `--out` 必填；默认拒绝覆盖，`--force` 才重建；临时文件 + 原子 rename；`--out` 必须落在所有声明 root 之外；`generatedBy` / `note` 可选由 spec 提供 |
| 阶段 A 视觉记录 | `visual-review` record 绑定旧 effort `fa04` 中与冻结身份一致的记录，作为**历史证据**纳入清单；不重新审核，也不伪装成当前新审核 |
| 阶段 A spec | 放在本 effort；须包含 `run/vN/mechanic-coverage.json` 为 required 文件 + `role=mechanic-coverage` record（票 02 Q8） |

### 实现义务（已回写下游票）

- [清单生产实施](../issues/13-manifest-production-implementation.md)：spec schema、生成核心、CLI、严格性校验、测试与阶段 A 真实清单/`verify-delivery` E3。
