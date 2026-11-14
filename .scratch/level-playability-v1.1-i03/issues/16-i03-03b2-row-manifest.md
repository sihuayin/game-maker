# I03-03B2 逐行 fixture manifest

Type: task
Status: open
Owner: —
Blocked by: 14
Map: ../map.md
Class: I-03 / TASK

## Task

把 I03-03B 的夹具设计落成**逐行 fixture manifest**：每个 frame / body 的 expected 值、来源、hash 与负例变异配方。**不实现 probe，不修改产品 fixture。**

### 必须完成

1. 在 `.scratch/level-playability-v1.1-i03/evidence/geometry-probe/fixtures/last-train-v4/` 建立 v4 归一化副本；记录原始 v2 输入 hash、归一化变换（脚本 / 命令 / 逐字段）、产物 hash。
2. 逐行列出正例：
   - hazard：`sweep1` / `sweep2`（size / anchor / frame bounds）；
   - player：`idle1..2` / `run1..4` / `jump1..2` 八帧 + spawn body（size / offset / bounds / foot）；
   - graph：`terrain#0`、`luggage` solid、player box。
   每行记录 expected 值、来源（manifest / atlas / 代码规则）、fixture hash。
3. 建立 10 个负例副本（I03-03B §3），每个只改一个主变量；记录变异配方、输入 hash、产物 hash、预期失败码 / 分项状态 / summary。
4. 写机器可读 manifest（路径与字段与 I03-03A / I03-03B 对齐），例如 `fixtures/manifest.json`；不得直接手工编辑最终证据。
5. 验证：同一基底 + 同一变异可确定性重建；正例清单与 B 票完全一致；无遗漏帧 / body。
6. 写 `.scratch/level-playability-v1.1-i03/evidence/03b2-fixture-manifest.md`。
7. 不实现 probe；不改 `fixtures/packs/**` / Runtime / `profile.ts` / `graph.ts`。

### 禁止

- 实现 probe / 跑浏览器；
- 修改产品 fixture / 新增产品 JSON fixture；
- 根据 probe 结果删减失败对象；
- 开放公共能力 / 推送 / PR / 合并。

### 验收

逐行 manifest 完整；正例零遗漏；10 个负例单变量；输入 / 输出 hash 与重建命令齐全；产品目录零 diff。

## Answer

（resolved 时填写）
