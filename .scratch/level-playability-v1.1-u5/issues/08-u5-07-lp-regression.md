# U5-07 LP-06 / LP-07 回归

Type: task
Status: open
Owner: —
Blocked by: 07
Map: ../map.md
Class: U5 / VERIFICATION

## Task

执行 LP-06 / LP-07 acceptance 脚本，与 U5-00 冻结基线逐项比较。**任何差异 ⇒ STOP 并分析根因。**

### 允许文件

- `.scratch/level-playability-v1.1-u5/evidence/`、`reports/`
- 仅在暴露 I-02 回归缺陷时修改白名单内产品文件，并逐项说明

### 必须完成

1. 复跑：
   ```bash
   pnpm build && node .scratch/level-playability-v1-p1/acceptance-corpus.mjs
   pnpm build && node .scratch/level-playability-v1-p1/acceptance-matrix.mjs
   ```
2. 与 `.scratch/level-playability-v1.1-u5/evidence/00-baseline.md` 记录的基线逐项比较；记录退出码、计数、原始输出 hash。
3. 任何差异：登记到 `.scratch/level-playability-v1.1-u5/evidence/07-lp-regression.md`（差异项、根因、是否 I-02 引入、处置），STOP + HITL；不得静默接受。
4. 不迁移、不改造、不包装成 I-02 新测试；不修改脚本。
5. 复跑全量 `pnpm test`。

### 禁止

- 修改 `.scratch/level-playability-v1-p1/` 脚本或语料；
- 用重跑 / 换环境掩盖差异；
- 新增产品文件 / 依赖。

### 验收

两份脚本退出码 0 且与基线逐项一致；差异为零或已登记并 STOP；证据完整。

## Answer

（resolved 时填写）
