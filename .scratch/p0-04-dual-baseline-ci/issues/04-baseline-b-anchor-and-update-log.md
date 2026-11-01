# 基线 B 独立信任锚与更新日志

Type: task
Status: resolved
Blocked by: 03

## Question

为基线 B 建立独立、可审计的 SHA-256 信任锚与更新日志，使 B 能与 A 一样被 base-only 验收，同时 A 的三件文件零改动。

### 必须完成

1. **B Anchor**：在 `.scratch/p0-02-second-demo-v2/manifest/` 新建 `expected-hashes.sha256`：
   - 固定格式 `sha256:<64 lowercase hex>\n`；
   - 对 `final-manifest.json` 的**原始文件字节**计算，不重新序列化 JSON；
   - 初始值必须**独立复算**，不能只抄人工常量；记录完整摘要、计算对象、计算命令、计算时间与冻结来源；
   - 预期摘要 `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab`，若复算不一致 ⇒ 停止并报告，不写入。
2. **B 更新日志**：在 B 的 manifest 目录新建 `MANIFEST-UPDATES.md`，按 A 的格式写初始 freeze 条目：
   - reason / subject / oldSha256（none）/ newSha256 / evidence（231 文件，137 required / 94 optional，6 records；另有 112 冻结文件由 `freeze-sha256.txt` 覆盖）/ verifiedBy / recordedIn；
   - 只追加；最后一条 `newSha256` 必须与当前 B Manifest 原始字节一致。
3. **格式校验（03 Q6 已裁定）**：`scripts/check-manifest-updates.mjs` **零改动**；04 用现有脚本分别对 A/B 执行原命令，记录 stdout/stderr/退出码。B 日志的严格字段校验与 Registry 驱动 wrapper（`scripts/check-baseline-updates.mjs`）由 05 实现，04 不提前改脚本，也不重构旧脚本。
4. **测试**：A 回归、B 正例、非法摘要格式、摘要不匹配、缺失日志；严格重复字段/多日志 schema 由 05 的 wrapper 测试。`pnpm test` / `pnpm typecheck` 全绿。
5. **E3**：对 A、B 各跑一次真实校验，记录命令、退出码、摘要；B 的 anchor 与 log 必须通过；A 的 anchor/log 零改动。
6. **PR**：本票一个 PR；不修改 B 的 Manifest、`freeze/` 或 A 文件；不重新生成 Manifest。

### 03 裁定输入（2026-11-01）

- **Q7**：B Anchor 使用与 A 对称的单行 `sha256:<64 hex>`；身份由 Registry `id` + 路径绑定，Anchor 自身不加必填 ID。
- **Q7**：04 必须留下完整 64 位摘要、被计算文件的精确路径、原始字节计算方式、独立复算命令与结果、冻结来源及对应 commit SHA；`sha256:07866e0e…b9ab` 不得作为未验证常量直接写入。
- **Q7**：B 更新日志为 Markdown 追加；初始 freeze 条目使用 A 兼容字段（reason/subject/oldSha256/newSha256/evidence/verifiedBy/recordedIn），可追加 `baselineId`/`operator`/`commitSha`/`recordedAt`，但不得要求 A 历史记录补字段。
- **Q6**：旧 `check-manifest-updates.mjs` 零改动；04 必须验证现有脚本对 A 原调用与 B 新日志调用的输出、退出码和失败行为；wrapper 由 05 实现。
- **Q9**：Registry 由 05 引入；04 只做 B 的 Anchor + 更新日志，不创建 registry。

### 研究输入（02）

- B Anchor 推荐使用与 A 完全对称的单行格式 `sha256:<64 hex>`；身份由 registry 的 ID + 路径绑定，不在 Anchor 内新增必填字段（OD-14）。
- `scripts/check-manifest-updates.mjs` 已用 `--log/--manifest` 参数化；最低风险实现是 **A 原命令 + B 并列调用**，不修改 A 的现有语义（OD-13）。
- 若引入 `baselineId`/`operator`/`commitSha` 等严格字段，只能是可选；A 的旧日志没有这些字段，不得把 A 变为必填失败。
- 04 只落 B 的三件文件与校验；registry 本身由 05 按 03 的 schema 落地，04 不提前创建 registry。

## 验收标准

- B 拥有独立 Anchor 与更新日志；A 的三件文件字节零变化。
- B Anchor 有可复核来源（命令 + 对象 + 方式 + 来源），不是人工常量。
- 任一 Manifest 被篡改时能被发现；仅改 PR 中的 Manifest/Anchor 不能让验收通过（由 05 验证）。
- 原 A 的 `check-manifest-updates` 行为不回退：脚本文件零改动，A 原调用输出/退出码/失败行为与 P0-03 一致。
- B 的 `check-baseline-updates` wrapper 与 strict 字段校验由 05 实现；04 只用现有脚本验证 B 新日志。

## Answer

**结论：PASS（2026-11-01）。** B 已拥有独立 Anchor 与更新日志；A 三件文件与 B Manifest/freeze 零改动；旧校验脚本零改动。

- 运行目录：[2026-11-01T14-40-03Z-b-anchor](../runs/2026-11-01T14-40-03Z-b-anchor/)
- 报告：[report.md](../runs/2026-11-01T14-40-03Z-b-anchor/report.md) · [facts.json](../runs/2026-11-01T14-40-03Z-b-anchor/facts.json)

### 新建文件

- `.scratch/p0-02-second-demo-v2/manifest/expected-hashes.sha256`：72 B，单行 `sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab`。
- `.scratch/p0-02-second-demo-v2/manifest/MANIFEST-UPDATES.md`：954 B，Markdown 追加；初始 freeze 条目使用 A 兼容字段 + `baselineId`。

### 独立复算

| 方法 | 结果 |
|---|---|
| 期望值 | `sha256:07866e0e…b9ab` |
| `shasum -a 256` | `sha256:07866e0e…b9ab` |
| Node `crypto` 原始字节 | `sha256:07866e0e…b9ab` |
| Python `hashlib` 原始字节 | `sha256:07866e0e…b9ab` |
| 一致 | **True** |

- 被计算文件：`.scratch/p0-02-second-demo-v2/manifest/final-manifest.json`，66,336 B。
- 计算方式：对**原始文件字节**做 SHA-256，不重新序列化 JSON。
- 冻结来源：commit `21632ef62e5d043f98baa834a14a40aa38dff064`（P0-02 v2 阶段 A 收口）；B `final-report.md` 记录的代码基线为 `f0411e676309fede8f20b79d9f8e44e5ac479ef6`（生成时工作树未提交，冻结文件由 21632ef 入库）。

### 现有脚本校验（`scripts/check-manifest-updates.mjs` 零改动）

| 用例 | 期望 | 实际 | 结果 |
|---|---|---|---|
| B 正例 | 0 | 0 | PASS |
| A 原调用 | 0 | 0 | PASS |
| B 日志 vs A Manifest | 1 | 1 | PASS |
| 缺失日志 | 1 | 1 | PASS |
| 非法摘要 | 1 | 1 | PASS |
| 空日志 | 1 | 1 | PASS |
| 重复条目（现状） | n/a | 0 | 现有脚本只校验最后一条；严格重复字段由 05 wrapper 负责 |

### verify-delivery（带 Anchor）

- A：exit 0 · status=pass · diagnostics=0 · `trust.result=matched`。
- B：exit 0 · status=pass · diagnostics=0 · `trust.result=matched`。

### 回归与零改动

- `pnpm test`：exit 0；`pnpm typecheck`：exit 0。
- 受保护文件快照 120 个（A 三件、B Manifest/spec、`freeze-sha256.txt`、final-report/verdict、112 冻结文件）：**零变化**。
- 未修改 B Manifest、B `freeze/`、A 文件或任何交付证据；未创建 registry（05）、未新增 wrapper（05）。
- 本票一个 PR；旧 `check-manifest-updates.mjs` 未改动。
