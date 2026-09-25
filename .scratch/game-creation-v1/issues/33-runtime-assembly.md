# 33. 资源包 → 运行时的装配

Type: task
Status: open
Blocked by: 24, 26, 27, 32
Map: ../map.md

> ✅ **装配 API 的形状已有硬约束**（2026-09-24，[票 03](03-phaser-vite-playwright-chain.md)）。
>
> 1. **加载方式**：推荐「**站点目录 + 同级 pack 目录**」这一形态 ——
>    完全兑现 R6「换包不重建」。⚠️ 代价是 **HTTP server 的根必须是父目录**，
>    这条要写进契约，否则运行起来会 404。
> 2. **`loaderBaseURL`**：Phaser 有这个钩子（源码原话「Useful if allowing the asset
>    base url to be configured outside of the game code」）——
>    **装配 API 必须带一个「包基址」参数，不要写死路径**。
> 3. **两个已实测的坑**：`import` 进来的 `.json` 会变成 JS 对象而非 URL；
>    小于 4096 B 的 PNG 会被 `assetsInlineLimit` 内联进 JS，产物目录里根本没有这个文件。
> 4. 交付格式按[票 25](25-delivery-format-spec.md)：**TexturePacker JSON Hash/Array**，
>    Phaser 原生读，不需要转换器。

> 这是把产物 A 和产物 B **接起来**的那一段，也是 R6 那句
> 「两个产物之间只有一个可序列化的文件」在运行时侧的兑现处。

> 🔴 **2026-09-25（[票 18](18-artifact-ref-consistency.md)）—— 本票的两问已有答案。**
> ① **产出目录 = `out/<gameId>/site/v<N>/`**，`N` 是站点**自己的**版本计数器
> （不是被引用资源包的版本号 —— 外壳会变而包不变，跟号就没处放）。
> ② 站点必须**记录它消费的是哪个资源包版本**，并在站点里**写死那条相对路径**
> （`../pack/v<M>/`）。这是 R6 说的 A/B 之间唯一的依赖，也是唯一
> 「同一份输入两次装配应当一致」的东西。
> ③ **本票第 1 问里那条「zip 怎么办」消解了** —— 交付形态定为**只出目录**
> （[票 18](18-artifact-ref-consistency.md) Q1）：zip 是「导出」动作，不是生成动作。
> Phaser 永远只从目录加载，不需要解压逻辑。
> ④ 站点**不做**逐文件 checksum（它的主体是构建工具的产物），只钉住消费的包。

## Question

四张前置票定完之后，本票把装配写出来：

1. **加载**：从资源包目录（或 zip）读 manifest，按[票 25](25-delivery-format-spec.md)
   定的格式把图集装载进 Phaser 的 loader。**zip 怎么办** ——
   解压到临时目录再当目录加载，还是 Phaser 能直接吃 zip？
2. **动画注册**：按[票 26](26-animation-representation.md) 定的表达，
   把动画元数据注册成 Phaser anims。
3. **世界装配**：按[票 09](09-game-config-contract.md) 的 game-config，
   把实体摆进场景、把 map/关卡铺出来。
4. **引用校验**：game-config 引用了包里不存在的资源时，
   在哪一步报、报成什么样（与票 24 第 4 条对齐）。
5. **失败降级**：单个资源缺失/损坏时跳过还是中止（与[票 32](32-runtime-shell.md) 第 3 条对齐）。

**本票是执行票**，产出真实代码，落在 `packages/demo/`（R9）。
**不要在本票里做的事**：外壳本身（票 32）、资源包契约（票 24）、
构建与托管（票 03）。
