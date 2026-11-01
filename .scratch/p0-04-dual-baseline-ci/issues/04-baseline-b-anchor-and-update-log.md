# 基线 B 独立信任锚与更新日志

Type: task
Status: open
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
   - reason / subject / oldSha256（none）/ newSha256 / evidence（231 文件，137 required / 94 optional，6 records）/ verifiedBy / recordedIn；
   - 只追加；最后一条 `newSha256` 必须与当前 B Manifest 原始字节一致。
3. **格式校验**：按 03 的裁定扩展 `scripts/check-manifest-updates.mjs`（或新增等价脚本）：
   - 拒绝缺失字段、重复字段、非法摘要格式、最后一条与 Manifest 不匹配；
   - 支持 A/B 两个日志；A 的现有调用与行为不变。
4. **测试**：A 回归、B 正例、格式错误、摘要不匹配、缺失日志、重复条目；`pnpm test` / `pnpm typecheck` 全绿。
5. **E3**：对 A、B 各跑一次真实校验，记录命令、退出码、摘要；B 的 anchor 与 log 必须通过；A 的 anchor/log 零改动。
6. **PR**：本票一个 PR；不修改 B 的 Manifest、`freeze/` 或 A 文件；不重新生成 Manifest。

### 研究输入（02）

- B Anchor 推荐使用与 A 完全对称的单行格式 `sha256:<64 hex>`；身份由 registry 的 ID + 路径绑定，不在 Anchor 内新增必填字段（OD-14）。
- `scripts/check-manifest-updates.mjs` 已用 `--log/--manifest` 参数化；最低风险实现是 **A 原命令 + B 并列调用**，不修改 A 的现有语义（OD-13）。
- 若引入 `baselineId`/`operator`/`commitSha` 等严格字段，只能是可选；A 的旧日志没有这些字段，不得把 A 变为必填失败。
- 04 只落 B 的三件文件与校验；registry 本身由 05 按 03 的 schema 落地，04 不提前创建 registry。

## 验收标准

- B 拥有独立 Anchor 与更新日志；A 的三件文件字节零变化。
- B Anchor 有可复核来源（命令 + 对象 + 方式 + 来源），不是人工常量。
- 任一 Manifest 被篡改时能被发现；仅改 PR 中的 Manifest/Anchor 不能让验收通过（由 05 验证）。
- 原 A 的 `check-manifest-updates` 行为不回退。
