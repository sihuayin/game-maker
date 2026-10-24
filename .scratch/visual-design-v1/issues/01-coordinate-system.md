# 01. VDS 的坐标系统与设计画布

Type: research
Status: resolved
Owner: research subagent · 2026-10-24
Blocked by: —
Map: ../map.md

## Question

钉死 Visual Design Spec 里 `bounds` / 对象几何所用的**坐标系**，以及「设计画布」（PRD §5.1 的
`Target Viewport` 输入）与现有系统的关系。要回答：

1. 现有三把尺子各自是什么、在哪个文件定死：
   - **Viewport 480×270**（`CONTEXT.md` 说是 Runtime Shell 常量，不是数据）—— 在哪一行？
   - **Game Config 坐标 = 交付态像素、1:1、整数**（`game-config` 顶层七块）—— 谁负责保证？
   - **DrawList 的 viewBox / expectedSize**（创作态像素）—— 与交付态的比例关系？
2. PRD §5.1 把 `Target Viewport` 列为必填输入、§6.1 说「SVG 坐标必须与 Visual Design Spec 使用统一的设计坐标系」。
   这个「设计坐标系」最自然的是哪一把？VDS 在资产**存在之前**就产出，而 Game Config 的交付态像素只有在资产
   （锚点/尺寸）落地后才确定 —— 这两者之间的转换（设计画布 → 交付态）由谁、在哪一步做？
3. PRD §5.3 示例里 `viewport: 1280×720` 与现有 480×270 视口冲突（1280×720 不是现有任何常量）。
   是「设计画布 = 与视口同尺寸」、还是「设计画布是独立可配的画布、渲染时缩放到视口」？给出**确定性可算**的结论。

交付：给出一句话结论（VDS 用哪把尺子、设计画布怎么定义），附 file:line 证据。结论会被票 03/05 消费，不必在此锁定。

## Answer

**三把尺子（file:line）**

1. **Viewport 480×270** —— 硬常量，不是数据、不可由数据文件改。
   - `packages/demo/src/draw.ts:15`：`export const VIEWPORT = { w: 480, h: 270 } as const;`
     上一行注释（`draw.ts:14`）：「视口 = **外壳常量**（票 32 裁决 1）。于是 1 交付像素 = 1 屏幕像素字面成立。」
   - 编译侧有一份**同值兜底**：`packages/assets/src/ops.ts:830` `DEFAULT_VIEWPORT = { w: 480, h: 270 }`（注释「与票 32 裁决 1 的外壳常量同值」）。
   - CLI 把外壳那一份**传进** compile-*：`packages/cli/src/cli.ts:219` `viewport: VIEWPORT, hudLineHeight: HUD_LINE_HEIGHT`。
   - `compile-*` 的 `viewport?` 参数（`ops.ts:935`）是**依赖注入缝**（壳把常量塞进去），不是「可配置」——全仓没有一处从数据文件读视口。
   - `CONTEXT.md:608-614`：「它是 [[Runtime Shell]] 的常量，不是数据……当前取值 480×270，于是 1 交付态像素 = 1 屏幕像素字面成立（整数坐标从创作态一路到屏幕不被任何东西重采样）。」
   ⇒ 结论：**不是软常量、无处可配**，480×270 是两处字面量（值相同）。

2. **Game Config 坐标 = 交付态像素、1:1、整数** —— schema 层强制。
   - `packages/contracts/src/game-config.ts:32` `Coord = z.number().int().nonnegative()`；`:34` `Size`（`int().positive()`）；`:42` `Rect`。
   - 顶层七块在 `game-config.ts:209-218`；带坐标的是 **5/7**：
     `world.size`（`:211`）· `player.at`（`:174`）· `terrain`（`z.array(Rect)`，`:215`）·
     `entities[].at` + 可选 `body`（`:92`/`:96`）· `hud.panel.at/size` + `hud.pip.at/step`（`:188-192`）。
     **不带坐标**：`scene`（只有 `background.asset`，`:212`）· `objective`（只有 `kind`+`gate`，`:203-207`）。
   - 整数由 schema 保证；**1:1 像素由构造保证**：`scale` 键进不来（`.strict()`，`game-config.ts:21-24`「`1.7` 会静默糊掉像素网格」），视口又是 480×270（1 交付 px = 1 屏幕 px）。
   - `CONTEXT.md:337-340`：「顶层七块……它的坐标一律是交付态像素，1:1、整数。」

3. **DrawList viewBox / expectedSize** —— 创作态像素，与交付态 1:1。
   - `packages/contracts/src/drawlist.ts:83-84`：`viewBox = [x,y,w,h]`（画布原点+尺寸，op 坐标活在其内）；`expectedSize = [w,h]`（「编译期期望」）。`:75-77`：两者比对**只判过大**（`boundsOfOps()` 对 curve 是凸包上界）。
   - `packages/assets/src/raster.ts:115`：「产出尺寸 = `viewBox` 的宽高 × `scale`（向上取整）」；`:120-124` `scale` 默认 **1**；`:133` `toPx = (p − vbx) × scale`。**raster 只读 viewBox，不读 expectedSize**。
   - 生产调用 `packages/assets/src/pack.ts:599` `rasterize(dl, { palette })`（不传 scale）⇒ **1 drawlist 单位 = 1 交付像素**。
   - 「过大」判据 `checkSize`（`contracts/src/audit.ts:24-33`）拿 `boundsOfOps(ops)`（`geometry.ts:24`）比 `expectedSize`；而创作路径 `assets/src/generate.ts:179` 恒写 `viewBox=[0,0,vw,vh], expectedSize=[vw,vh]`（两者都 = `spec.size`）⇒ 生产中两者恒等，expectedSize 只是「期望」冗余。

**三问的结论**

- **Q2（VDS 用哪把尺子）**：最自然的是**视口（尺子 1，屏幕空间，480×270）**。理由：VDS 在**资产存在之前**产出，而 Game Config 的交付像素只有在资产锚点/尺寸落地后才定（`game-config.ts:85-87`：实体「不重复声明几何，`size`/`anchor` 只住资源包」；`CONTEXT.md` [[Entity]]/[[Anchor]]）⇒ VDS 够不着尺子 2。而视口是外壳常量、构建期恒有，且屏幕空间坐标系已存在（`packages/contracts/src/screen-space.ts:44`「HUD 活在屏幕空间 —— 尺子是**视口**，不是 `world.size`」）。「设计画布 → 交付态」**不需要缩放步骤**——设计画布 = 视口 = 交付屏幕空间，比例 1:1；资产落地后发生的那一步不是坐标换算，而是票 07 的**交叉验证**（VDS 的粗略 bounds 在实体 id + 粗 bounds 共享子集上对 GameConfig 的玩法几何对账）。
- **Q3（1280×720 冲突）**：**设计画布 = 与视口同尺寸（480×270），不是独立可配画布。** 确定性可算：视口是编译期常量（`draw.ts:15`）、编译器把视口当输入（同 `compile-*` 的 `viewport` 参数，`cli.ts:219`）；PRD 的 1280×720 是**非规范示意值**（`docs/v7/中间svg.md:333`「以上仅为概念示例，不是已经确定的正式契约」）；而任何非 480×270 的值都要求非整数下采样（1280→480 = ×0.375），直接违反本仓「整数从创作态一路到屏幕不被重采样」的不变量（`CONTEXT.md:611`、`game-config.ts:14-15`/`:21-24`、`raster.ts:121` `scale 必须是 ≥1 的整数`）。PRD §5.1 把 `Target Viewport` 列为必填输入、§6.1 要 SVG 与 VDS 同坐标系 ⇒ 实现时该输入**必须由外壳的 `VIEWPORT` 注入**（默认 480×270），PRD 示例里的 1280×720 应归一化掉。

**一句话结论**：VDS 的 `bounds` 用**视口（屏幕空间）坐标系**——就是现有的 480×270 外壳常量（`packages/demo/src/draw.ts:15`），「设计画布 / Target Viewport」定义为**与视口同尺寸（480×270）**、渲染时 1:1 不缩放，PRD 的 1280×720 是非规范占位、必须归一化到壳的 `VIEWPORT`。
