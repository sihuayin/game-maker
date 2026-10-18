# 07. 最小能力对象：字段、来源与边界

Type: grilling
Status: resolved
Owner: claude (2026-10-18 · 人裁离线；第三轮细节已裁，见 [12](12-round-3-rulings.md))
Blocked by: —
Map: ../map.md
> 第一轮 Q6 = (a)：image / drawlist / import 可用性 + design 的 `runtimeProfile.capabilities`，
> 作为 `planAssets` 输入；不建跨包 registry。本票定**对象形状与来源**。

## Question

1. **字段**：`{ routes: { image: boolean; drawlist: boolean; import: boolean }, runtime: { id, version, capabilities[] } }`？
   是否还需要 `imageModel` / `textModel` / `existingAssetRefs`（Phase 1 明确没有）？
2. **来源**：
   - image 可用性：CLI/MCP 的 `resolveImageTransport` / 配置 / 环境变量；
   - drawlist 可用性：文本上游配置；
   - import：Phase 1 固定 false（create 链无输入）还是从手写 Recipe 的 ref 推导？
   - runtimeProfile：design 里已有 `runtimeProfile`；哪些 capability 真正影响 route（还是只记录）？
3. **失败时机**：能力缺失在 `planAssets` 入口就拒，还是逐资源由 resolver 拒？报文怎么带能力名？
4. **落点**：能力对象是否写进 plan sidecar 的能力快照？是否进 Recipe（明确：不进）？
5. **不建 registry 的边界**：对象是本调用的一次性输入，不跨项目、不缓存、不持久化。


## 第二轮已定（方向，见 [11](11-round-2-rulings.md)）

- 形状：`routes: { image, drawlist, import }` 三个布尔 + `runtime: { profile, version, capabilities }`。
- 内部输入；不建 registry、不缓存、不持久化；能力快照写入 sidecar。
- `import` 在 create 链固定 `false`；手写 Recipe / planner fixture 可显式 `true`。
- `runtime.capabilities` **只记录**，不参与路线规则/能力判定。
- **仍待本票细化**：image/drawlist 可用性从 `resolveImageTransport` / 文本上游解析结果到布尔值的精确映射；
  「不能仅以配置字段存在就断言上游可用」的落地检查；错误上下文；测试。


## - 形状：`routes{image,drawlist,import}` + `runtime{profile,version,capabilities}`。
- image：配置完整 + 协议受支持（需要参考图时协议支持参考图）；drawlist：文本上游 baseUrl/apiKey 非空；
  import：create 链 false，fixture 可 true 且须验证 ref 可访问。
- 结构性检查，不 live ping；能力缺失时规划期硬失败，不换路。
- `plan` CLI/MCP 免费解析 image transport；create 复用；能力对象为 `planAssets` 内部输入，不改公共参数。
- runtime 只记录，不参与规则。
- ⚠️ 实施时仍需在 09/08 落实：具体 transport→boolean 映射、参考图能力检查、fake transport 测试。
