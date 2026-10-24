# 07. VDS ↔ GameConfig 交叉验证（身份判据 + 几何观察）

Type: grilling
Status: resolved
Owner: claude · 2026-10-24
Blocked by: 03
Map: ../map.md

## Question

钉死 Q3(b) 里「二者在共享子集交叉验证」的细则（用户已裁：身份/role 一致 = 硬判据候选；几何漂移 = 仅观察；细则单独开票 = 本票）。

- **共享子集**到底是什么：实体 id + role？还是 id + role + 粗略 bounds？哪个字段算「共享」、哪个各归各的？
- **身份判据**：VDS 里 id 对应的 role，与最终 GameConfig 里同一 id 的 role 不一致（串桶式错误）—— 是否硬失败？
  复用 `意图覆盖`/`串桶`（`contracts/intent-coverage.ts`）的判法，还是新写？
- **几何观察**：VDS 的 bounds vs GameConfig 的最终几何，漂移多大算「报告」？观察的**措辞**（不许暗示「错」）。
- 落点：qa 步（GameConfig 已产出之后），作为新的一条 QA 判据/观察。归哪一族？现有 QA 族 = 视觉/玩法/意图 ——
  是视觉族加一条，还是独立？

HITL：grilling + domain-modeling，把「交叉验证」钉成可机械判的判据 + 可读的观察。

## Answer

**VDS ↔ GameConfig 交叉验证，钉死如下（用户裁定 2026-10-24：Q1/Q2/Q3/Q4 均按推荐）。**

**一、字段劈法（Q1）** —— 三把钥匙，「共享子集」两字装不下：

- **join 键 = 实体 id**（唯一字面共享）：VDS `sourceIntent` ↔ GameConfig `entities[].id`。
- **判据键（对应、须一致）= `role` ↔ `kind`**：身份。VDS `role`（11 值）↔ GameConfig `kind`（`EntityKind` 7 值）。
- **观察键（对应、只报）= `bounds` ↔ `entityBox`**：几何。VDS `bounds`（视口坐标）↔ `at`+`anchor`+`size` 推的盒。

「共享子集 = 实体 id + 粗略 bounds」措辞退休；id 是唯一共享键，身份/几何是两组**对应字段**，一组判、一组观察。

**二、身份判据（Q2）** —— 新判据，硬失败，两种失败模式：

- **射程**：只对 `role ∈ EntityKind(7)` 且带 `sourceIntent` 的 VDS 对象。四个单例（`player`/`background`/`ui-panel`/`ui-pip`）映射到 GameConfig 固定单例（`player` 顶层 / `scene.background` / `hud.panel`/`hud.pip`），天生不会串/缺，不进判据。
- **失败模式（都硬失败，镜像 `intent-coverage` 的 `MissingIntentItem {foundIn?}`）**：
  - **串桶** = id 两边都在、`role ≠ kind`（预览说 `pickup`、config 做成了 `hazard`）。
  - **缺失** = `sourceIntent` id 在 GameConfig `entities[]` 里**没有**（预览了、config 没做）。
- **判法：新写，借模式不借函数**。`intent-coverage` 是**单向子集**（意图是权威，`intent.type` 封闭枚举定桶）；票 07 是**双向对应**（两边都是同一个无 `kind` 设计实体的两种解释，没有权威方——设计层 4 桶只有 id+自由文本，`EntityKind` 是 VDC 与 `compileRuntime` 两次独立 LLM 各自定的）。且票 07 只有 QA 一个调用方，直接产 `QAFinding`，不套中性 `MissingIntentItem[]`。
- **为什么是硬失败**：精确可算（`role`/`kind` 封闭枚举、映射一一对应）+ 错了一定不是设计（同一个设计实体，两个视图身份不一致 = 预览骗人，预览的核心用途失效）。

**三、缺失边界（票 04 vs 票 07）** —— 按「各自判哪一对产物」劈：

- **票 04（已关）** = VDS ↔ **设计** 的 id 集合差 S=D：缺失 = 设计实体没进 VDS（D∖S）、悬空 = VDS 指向设计里没有的 id（S∖D）。都在 VDS 产出时判，**够不着 config**。
- **票 07（本票）** = VDS ↔ **config** 的对应：缺失 = `sourceIntent` id 不在 config（S∖C）、串桶 = id 在但 role≠kind。都在 QA 步（config 产出后）判。

⇒ 缺失对象归**票 07**（票 04 判 VDS↔设计、够不着 config）。S∖C = D∖C（票 04 已保证 S=D）。

**四、几何观察（Q3）** —— 只报不判：

- **只比尺寸 `w/h`，不比位置**：VDS `bounds` 是视口/屏幕空间（480×270），GameConfig `at` 是世界坐标（外壳支持 `camera:side-scroll`，`world.size` 可 > 视口），位置需相机映射才可比，而相机在 VDS 产出时未定。
- **无阈值**：观察不是判据，设阈值 = 偷升级成判据。
- **描述性措辞，不暗示「错」**：「预览盒 24×40 · 交付盒 32×48（预览尺寸偏小 33%）」，对齐 `CONTEXT.md` 观察摘要口吻。

**五、落点（Q4）** —— 视觉族加一条判据 + 一条观察：

- 主语是视觉预览（VDS），GameConfig 只是被对账的参照（同款先例：`palette-binding` 拿 manifest 对 recipe，本就跨契约）。
- **实现侧代价（记给实现者）**：`QA_JUDGEMENTS` 6→7（新判据名建议 `vds-config-identity`）；`assemble.ts` 的 `QAJudgementResults` 变 7 键；`QaContext` 加 `vdsPath`；几何观察若新开 source 则扩 `OBSERVATION_SOURCES`（现 `inspect`/`review`）。
