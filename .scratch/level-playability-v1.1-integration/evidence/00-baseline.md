# I00-00 基线：权威输入与可复现起点

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-09 |
| 分支 | `wayfinder/level-playability-v1.1-integration` |
| 工作区 | 干净（本票开始时仅本票文件处于 claimed 状态） |
| Node / pnpm | v22.23.2 / 10.7.1 |

## 1. 权威输入（只读冻结）

| 项 | 值 |
| --- | --- |
| 路径 | `docs/v7.8/移动.md` |
| 文件 SHA-256 | `3598cc19889b10a9fabf3a4f6f28ae7cee43a22355b639d8d61298e6d459cea9` |
| 行数 | 529 |
| 提交 | `bd1389f4e45bc5296fef6b800027acde0c11fbff` |
| 提交范围 | `1 file changed, 529 insertions(+)` —— 只含该 PRD |
| 父提交 | `c6424c2`（P0 关图 / PR #29 合并） |

**冻结规则**：地图内不直接编辑该文件。若评审要求修改，先走 HITL 修改权威输入、重新提交并重算 SHA-256，再更新本文件与 `map.md` 的 Baseline。

## 2. 前序基线（只读证据）

| 项 | 路径 / 值 |
| --- | --- |
| P0 结论包 | `.scratch/level-playability-v1.1-p0/evidence/04-final-report.md` |
| P0 冻结模型 | `.scratch/level-playability-v1.1-p0/prototype/MODEL.md` |
| P0 关图提交 | `c6424c2` |
| P0 裁定 | GO — 技术可行性得到支持（技术可行性口径，非集成就绪） |

P0 结论可引用、可复核，**不重开**；P0 原型不得直接进生产（PRD G-07）。

## 3. 领域词汇（`CONTEXT.md`）

- `:491` 可玩性判定（Playability Judgement）
- `:495` 空间可达性（Spatial Reachability）
- `:499` 机制可通行性（Mechanic-aware Traversability）
- `:503` 关卡完成性（Level Completion）
- `:507` Playability Verdict（可玩性结论）
- `:511` FixedRuntimeProfile（固定运行剖面）

`CONTEXT.md` 是唯一权威；本 effort 不新增同义词。

## 4. 本 effort 的停止线

- **零付费**：不调用模型、不生图、不重建付费站点。
- **Runtime 只读**：不改 `packages/**`、产品配置、公共契约、既有测试或 CI。
- **不接生产**：不改 Pipeline / contracts / CLI / MCP，不新增依赖或公开参数。
- **不推送、不合并**；图与证据只留在本地分支。

## 5. 复现命令与结果

```text
$ git branch --show-current
wayfinder/level-playability-v1.1-integration

$ git status --porcelain
（本票开始时为空）

$ shasum -a 256 docs/v7.8/移动.md
3598cc19889b10a9fabf3a4f6f28ae7cee43a22355b639d8d61298e6d459cea9  docs/v7.8/移动.md

$ git rev-parse bd1389f c6424c2
bd1389f4e45bc5296fef6b800027acde0c11fbff
c6424c2c43c1c5c314f55c2a55d76d60dfb6ca9d

$ git diff --stat bd1389f^ bd1389f
 docs/v7.8/移动.md | 529 ++++++++++++++++++++++++++++++++
 1 file changed, 529 insertions(+)
```

退出码均为 `0`。本票未修改任何产品目录文件。
