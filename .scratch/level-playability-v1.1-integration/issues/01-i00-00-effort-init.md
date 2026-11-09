# I00-00 Effort 初始化与权威输入冻结

Type: task
Status: open
Owner: —
Blocked by: —
Map: ../map.md
Class: I-00 / EVIDENCE

## Question

建立本 effort 的权威基线与工作区，使后续所有票有可复现的起点。本票**不解析任何 Runtime 或审计语义**，也不触碰产品代码。

### 开图时已完成

- PRD 已单独提交：`bd1389f`（只含 `docs/v7.8/移动.md`）。
- 分支 `wayfinder/level-playability-v1.1-integration` 已从该提交切出。
- 目录 `.scratch/level-playability-v1.1-integration/{issues,evidence,scripts}/` 已建。

### 本票必须交付

1. **前置检查复核**：`git status` 干净；`shasum -a 256 docs/v7.8/移动.md` == `3598cc19889b10a9fabf3a4f6f28ae7cee43a22355b639d8d61298e6d459cea9`。
2. **`evidence/00-baseline.md`**，至少记录：
   - PRD 路径、文件 `sha256`、权威输入提交 SHA（`bd1389f`）；
   - P0 结论包路径与 P0 关图提交（`c6424c2`）；
   - 图分支起点；
   - `CONTEXT.md` 相关词条清单（可玩性判定 / Playability Verdict / FixedRuntimeProfile）；
   - 本 effort 的停止线摘要（零付费、Runtime 只读、不接生产）；
   - 复现上述检查的命令与退出码。

### 验收

基线文件可让另一个会话在无上下文的情况下复现同一起点。

### 边界

不改 `packages/**`、不改 PRD 内容、不新增依赖、不推送。
