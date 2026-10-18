# 06. plan sidecar 的落点、格式与搬运

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线；第三轮细节已裁，见 [12](12-round-3-rulings.md))
Blocked by: —
Map: ../map.md
> 第一轮 Q5 = (a)：Recipe 旁写 sidecar，记录 id / route / reason / inputs；Recipe Schema 不变。
> 本票定**形状与落点**，不实现。

## Question

1. **路径与命名**：`recipes/v<N>.plan.json`（与 recipe 同目录）？还是 `run/v<N>/asset-recipe.plan.json`？
   版本号与 recipe 的 `v<N>` 如何对齐？
2. **格式**：`format: "asset-plan/v1"`？每项资源 `{ id, route, reason, inputs }`；
   是否记录模型候选、能力快照、planner 版本、时间戳（可复现构建需要 `SOURCE_DATE_EPOCH`）？
3. **inputs 的边界**：既有素材 ref / 母版 id / styleRef / referenceImage / 能力对象？不记录无关上下文。
4. **搬运**：`create` / `build` 如何把它从 staging 搬到 run 根？`pack` 是否读它？
   （不应改写 Recipe；pack 的 ledger/失败现场继续负责执行侧。）
5. **旧 Recipe 无 sidecar**：允许缺失（兼容）还是报错？缺失时如何表达「无规划记录」。
6. **一致性**：如何验证 sidecar 的 route 与 Recipe 的 `source.kind` 逐项一致。


## 第二轮已定（方向，见 [11](11-round-2-rulings.md)）

- 路径 `recipes/v<N>.plan.json`；create 复制到 `run/v<N>/asset-recipe.plan.json`；**pack 不读**。
- 顶层形状：`format / recipeId / recipeVersion / plannerVersion / capabilities / assets[]`。
- 每项：`id / route / reason{code,text} / inputs / candidate`；候选与能力快照都记录；
  sidecar 的 route 必须与 Recipe 的 `source.kind` 逐项一致。
- 旧 Recipe 缺 sidecar **允许**；不得反推/补造理由。
- **仍待本票细化**：完整字段 Schema；reason code 枚举；`inputs` 必填/空值表达；
  `candidate` 枚举与「是否参与最终决策」字段；`plannerVersion` 取值。


## - 顶层：`format:"asset-plan/v1"`、`recipeId`、`recipeVersion`、`plannerVersion:"1"`、`capabilities`、
  `inputs{styleRef, referenceImage?}`、`assets[]`。
- 每项：`id`、`route`、`reason{code,text?}`、`inputs{importRef?, masterAsset?}`、`candidate?`、`participated`。
- `inputs` 始终对象；缺省键省略，不写 null；reason code 用 03 的同一份闭合枚举。
- `plan` artifacts 含 sidecar；create 复制到 `run/v<N>/asset-recipe.plan.json`；pack 不读；旧 Recipe 可无 sidecar。
- 一致性：sidecar route === Recipe source.kind；id 集合一致；`participated` 语义见 03/12。
- ⚠️ 实施时仍需在 09 落实：JSON Schema、必填约束、candidate 枚举与省略规则、测试。
