# 02. 抠底后的品红边缘：加一步 despill / 边缘清理

Type: task
Status: resolved
Owner: claude (2026-10-18 · 人裁「施工 02」→「提交 关票」)
Blocked by: —
Map: ../map.md
> 派生自 C/C2 交付帧预览：抠底后仍残留红/品红像素。
> ⚠️ **立票 ≠ 批准施工**。

## 1 · 证据

- 主张的键色是 `#ff00ff`；C 实测图上的众数色是 `[215,28,142]`（L1 181），C2 是 `[201,49,144]`（L1 214）。
- 管线按实测众数色抠底，抠掉 89.7%（C）/ 69.1%（C2），但边缘仍有品红/红色像素。
- 免费后处理（R>140 · G<110 · B>80 · R−G>70 · B−G>35 ⇒ 透明）后明显干净；
  `runs/2026-10-18e-replay-clean/` 与 `runs/2026-10-18f-salvage/` 是证据。

## 2 · 要做什么

- 在 `keyBackground` 之后加一步确定性的 despill / 边缘清理：
  - 只删除**品红占优**的像素（阈值可配）；
  - 不碰角色本身的红色/棕色（用 R−G / B−G 组合判据，测试要覆盖）；
  - 记录删了多少像素到 report。
- 保留现有“实测众数色”逻辑；不改声明色。

## 3 · 验收

1. 用 C/C2 的真实已付费图做 fixture（只读，不重新生成），断言边缘品红像素 ≈ 0，角色红棕色不丢。
2. 先红后绿。
3. 单帧 / 多帧 / 背景层三条路都要覆盖。

## 4 · 边界

- 不跑付费上游；不改 `game-maker.local.json`。
- 不把 despill 做成“猜测主体”的启发式；只做颜色判据。

## 5 · 裁定（2026-10-18）

1. **despill 住 `import.ts`** —— `prepareFrame` 里 `keyBackground` 之后一步。
   单帧 / 多帧 / 背景层三条路天然共用；`pack` 继续只做装配，不碰颜色。
2. **阈值不进契约** —— 内部常量 `DESPILL_THRESHOLDS`（五条来自 C/C2 实测）＋
   `ImportOptions.despill`（`false` 关闭 / partial 覆盖）。模型与 planner 写不进配方。

## 6 · 施工记录（2026-10-18）

- **`despillMagenta(img, { thresholds })`**：只把命中 `R>140 · G<110 · B>80 · R−G>70 · B−G>35`
  的**不透明**像素置透明；不改输入、不读连通块/边缘距离，返回 `removedPixels`。
- **接入 `prepareFrame`**：抠底之后跑。两道门：
  - 没有 `background`（人给的透明 PNG、背景最远层）⇒ **不跑**；
  - 省略 `despill` 时，只有**底色本身属于品红家族**才自动跑 —— 天空层的 `[41,41,64]` 不跑。
    这一条是施工时被现有真图测试抓出来的：无条件跑会把 `layer-exp-treatment-sky` 的交付透明率
    从 25.46% 推到 27.18%，即误删内容。
  - `despill:false` 关闭；partial = 显式开启并覆盖阈值。
- **report**：`ImportResult.report.despilledPixels` 逐帧/逐格记录删除数。
- **真图 fixture**：新增 `fixtures/model-paint-despill/`，C/C2 六张已付费原图（master/idle/run 各两份）
  ＋ README（来源、尺寸、众数色、抠掉比例、逐张残留读数 5,260 / 11,943 / 7,692 / 5,201 / 9,162 / 12,116）。
  背景层用已有 `fixtures/model-paint-layers/`（wall 374 / ground 212）。
- **先红后绿**：实现前新用例 **15 条红**；现在 16 条全绿。
- **验收读数**：6 张真图抠完命中判据数逐张钉死，despill 后 **0**；交付态（降采样+二值化+量化后）也是 **0**；
  红/棕色像素删除前后逐张相等；单帧 / 4 格横排 / 2×6 多行 / 非最远背景层四条路各自有断言。
- **五闸**：全量 **100 文件 / 1601 条全绿**（+16）· `tsc -b --force` 干净 · `pnpm build` ✅ ·
  `check:deps` 9 包 ✅ · `check:links` 384 份文档 / 2097 条链接 ✅。
- **边界**：零付费上游 · `game-maker.local.json` 一字未动 · 颜色判据（非主体猜测）·
  没有 `background` 的图不碰 · 未动探针期尚未入库的源码改动。
- **未做 / 后续**：`despilledPixels` 目前只在 `ImportResult.report`，`pack` 不外露到 manifest
  （票面只要求 report）；亮粉色（`B−G` 够大）会与品红一起被删 —— 这是颜色判据的已知边界。

