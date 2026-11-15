# I03-03B2 阻塞发现 — 玩家脚点 / 锚点坐标约定不一致

| 项 | 值 |
| --- | --- |
| 日期 | 2026-11-14 |
| 触发票 | I03-03B2 逐行 fixture manifest |
| 结论 | **STOP**：D2 / `profile.ts` / `temporal-witness.ts` / demo 对 `config.player.at` 的解释不一致；player 与 graph 的几何行无法在零容差下冻结 |
| 产品改动 | **无**（只读计算 + 文档） |

## 1. 事实

last-train 玩家：`player-traveler`，size `32×48`，anchor `{x:0.5, y:0.95}`，config `player.at = {x:40, y:250}`。

| 来源 | 计算 | 结果 |
| --- | --- | --- |
| `profile.ts:77` `footOf` + `profile.ts:102` `runtimePlayerGeometry` | `foot = at + (1 − 0.95)·48`；`boxFromFoot(foot, 32×48)` | foot `(40, 252.4)`；box `(24, 204.4, 32, 48)` |
| demo `world.ts:207` `boxAt(at, size, anchor)`（`entityBox` 取整） | `entityBox(40,250, 32×48, {0.5,0.95})` | box `(24, 204, 32, 48)` |
| `temporal-witness.ts:250-252` | `at` **按脚点**解释；`boxFromFoot({40,250}, 32×48)` | box `(24, 202, 32, 48)` |
| `scene.ts:219` | 玩家 body `setSize(world.player.box.w/h, false)`；sprite origin 由 frame anchor 逐帧设置 | body 尺寸 `32×48`；body 位置 / offset 待 probe 实测 |

## 2. D2 自身的两句话互相冲突

- `.scratch/level-playability-v1.1-i02/issues/08-i02-d2-motion-input-contract.md:96`：
  > 玩家盒：manifest `size` + `anchor`，经 `footOf(at, size, anchor)` / `boxFromFoot` 派生；**不取整**。
- 同文件 `:97`：
  > 起点：`config.player.at` 按**脚点**解释；起点盒由脚点反推。

前者把 `at` 当**锚点落点**（`profile.ts` 一致），后者与 `temporal-witness.ts` 把 `at` 当**脚点**。last-train 的 anchor `.95` 让两者相差 `2.4px`；U2/U5 的内存夹具用 anchor `.5,1`，`footOf(at)=at`，所以此前没有暴露。

## 3. 影响

- player 分项：witness 的 spawn box 与 `runtimePlayerGeometry` 相差 `2.4px`（y），与 demo `entityBox` 相差 `2.0px`（y）；即便取整，仍有 `0.4px` 差。
- graph 分项：`graph.player` 来自 `runtimePlayerGeometry`；与 witness spawn 的 player box 同样不一致。
- hazard 分项：`hazard-sweeping-carriage` 的 `entityBox` 与 sprite 由 manifest size/anchor 派生，暂未发现同类冲突；但 player/graph 的行不能冻结。
- 零容差规则（I03-03A Q3）：任何非零 delta ⇒ 不得 `checked`；坐标约定不明确 ⇒ **STOP**，不得自行选归一化方式。
- 现有 U2/U5 测试用 anchor `.5,1`，不覆盖 `.95` 的玩家；修改约定可能影响 last-train 及后续真实关卡，但不影响当前内存夹具。

## 4. 选项

| 方案 | 内容 | 代价 |
| --- | --- | --- |
| A | `at` = **锚点落点**（`profile.ts` / D2 第一句）；player box = `boxFromFoot(footOf(...))`；`temporal-witness` 改为 `footOf`；起点盒由 foot 反推 | 修正 witness 的 at-as-foot；last-train spawn 变化；U2/U5 `.5,1` 夹具不变；需补充 `.95` 回归 |
| B | `at` = **脚点**（D2 第二句 / `temporal-witness`）；player box = `boxFromFoot(at)`；`runtimePlayerGeometry` / demo 改为不做 `footOf` | 与 `profile.ts` / demo 渲染锚点冲突；`at` 同时承担 draw anchor 与 foot，语义更混 |
| C | 新增显式 `playerFoot` / `playerBox` 输入；`at` 只作 draw anchor；audit / runtime 都从显式值派生 | 公共 / 配置契约变更，范围更大；需独立授权 |

## 5. 建议

推荐 **A**：`at` 是锚点落点（与 `profile.ts`、demo 渲染、manifest anchor 一致）；player audit box 用 `boxFromFoot(footOf(at, size, anchor))`；`temporal-witness` 的 `at`-as-foot 是例外，应在 I-03 实施单元修正，并补 `.95` anchor 的回归。玩家盒保持**不取整**；runtime body 与它的零容差比较若因 Phaser 取整失败，则 STOP，不引入容差。

## 6. 状态

- 未写 probe；未改任何产品代码 / fixture / Runtime / `profile.ts` / `graph.ts`。
- I03-03B2 保持 open，blocked by I03-03B2a（本发现的新 HITL 票）。
- I03-04 / I03-05 继续通过 B2 传递阻塞。
