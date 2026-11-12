# I02-06 Phaser overlap 语义直接证据

Type: research
Status: resolved
Owner: research subagent · 2026-11-10
Blocked by: 02
Map: ../map.md
Class: I-02 / EVIDENCE

## Question

I-00 §6.1 把「相切不算撞」冻结为与 `overlapsStrict` 同义，并明确要求 I-01 补一条 **Phaser overlap 的直接证据**；I-01 未提供（代码事实 C-11）。本票只取证，不裁定语义。

### 必须回答

1. 仓库锁定的 Phaser 版本，以及 Arcade Physics 中 overlap / collide 的实际源码位置（本地 `node_modules`，`file:line`）。
2. AABB 判定使用严格不等号还是闭区间；**边界相切、零面积接触**是否触发 overlap / collide。
3. 与 `packages/contracts/src/playability/geometry.ts` 的 `overlapsStrict` / `overlapsInclusive` 逐条对照。
4. 若证据推翻 strict，明确它改变的是 **Runtime 语义基线**（I-00 §6.1），不是 I-02 的 epsilon；只登记冲突，不裁定。
5. 是否能从仓库内的 Runtime 代码（`packages/demo/**` 只读）找到调用点，说明判定在实际游戏中的用法。
6. 命令、版本、`file:line`、限制与复现方法。

### 输出

`evidence/06-phaser-overlap.md`。

### 下游

I02-D1、I02-D3、I02-D4。

## Answer

证据全文：[`evidence/06-phaser-overlap.md`](../evidence/06-phaser-overlap.md)。**修改产品目录：否**。

- 安装版本：Phaser **3.90.0**（`packages/demo/node_modules/phaser/package.json:3`；`pnpm-lock.yaml:641,1086`）。
- 决定性代码：`World.js:1698-1713` 的矩形 AABB 谓词为
  `!(body1.right <= body2.left || body1.bottom <= body2.top || body1.left >= body2.right || body1.top >= body2.bottom)`
  —— **严格不等号**。`overlap` 与 `collide` 都先过 `World.separate` 的 `!intersects` 闸门（`World.js:1392`），检测谓词相同，差别只在 `overlapOnly` 后处理（`World.js:1432-1474`）。
- 运行时探针（直接执行安装源码）：右/左/上/下边相切、角接触、零面积接触均 `false`；`1px` 与 `1e-9` 正面积重叠均 `true`。
- 与 `geometry.ts:14-15` 的 `overlapsStrict` 一致；`overlapsInclusive`（`:18-19`）的相切为 `true`，`touches` 正好描述 Phaser 判为不撞的边界接触集合。
- demo 调用点（只读）：`scene.ts:154/163/172` 的 `physics.add.overlap` 用于 pickup / hazard / goal；`scene.ts:228` 地形用 `collider`；danger / chest 用 `scene.ts:304,323` 的手写严格比较。
- **`strict` 未被推翻**：I-00 §6.1 的冻结语义成立，不需要改 Runtime 语义基线或 I-02 epsilon。B-10 的谓词证据缺口已补齐；下游 D1/D3/D4 只需引用，不再等待本票。
- 限制：谓词语义已证，但 **runtime hitbox equality 仍不在 I-01 链路内**（C-11 / B-02）；Arcade body 轴对齐、忽略旋转；圆 body 是闭区间但 demo 未用 `setCircle`；Runtime 以 60Hz 离散 step 求值，与 I-02 的连续时间存在检测时机差异。

### 下游

I02-D1、I02-D3、I02-D4。
