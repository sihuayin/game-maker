# Visual Design Compiler V1
## 基于 SVG 的游戏视觉设计编译器

- 项目：game-maker
- 版本：V1
- 文档类型：产品需求文档（PRD）
- 状态：待评审
- 优先级：P1（建议作为现有游戏生成流水线的独立阶段）
- 核心目标：建立游戏设计与最终游戏实现之间的可视化、可验证的设计中间层

---

# 1. 背景与问题

## 1.1 项目背景

game-maker 的目标是：

用户提供游戏风格图和游戏需求，系统自动完成游戏设计、关卡设计、资源生成、代码生成与验证，最终产出一个风格一致、完整可玩的游戏。

当前系统已经具备以下设计与生成能力：

- 游戏意图解析。
- GameDesignSpec 生成。
- AssetRecipe 生成。
- AssetPack 生成。
- GameConfig 生成。
- 游戏构建与 QA。

但从游戏设计到最终视觉结果之间，仍然存在一个重要问题：

**系统可以理解游戏需要什么，却不一定能够准确确定游戏应该长什么样。**

例如，用户提出：

> 制作一款 2D 废土寻宝游戏。玩家在废弃工厂中探索，寻找宝箱，躲避敌人。整体采用复古像素风格。

AI 可以生成符合描述的游戏设计，但仍然可能出现：

- 玩家与背景比例不协调。
- 场景布局与游戏意图不一致。
- UI 设计风格不统一。
- 资源生成缺少明确的视觉参考。
- 最终游戏与用户预期存在较大差异。

目前主要依赖自然语言 Prompt 和最终游戏截图来发现这些问题。

这意味着视觉设计问题往往在资源生成和代码实现之后才被发现，修复成本较高。

## 1.2 核心问题

在现有 GameDesignSpec 与 AssetRecipe 之间，缺少一个可视化的设计中间层。

V1 需要解决：

1. 如何将游戏设计转换成明确的视觉布局？
2. 如何让人和 AI 在编码之前审查视觉设计？
3. 如何将视觉设计与游戏对象、游戏意图关联？
4. 如何验证 SVG 设计稿的完整性和正确性？
5. 如何为后续资源生成和游戏实现提供稳定的视觉依据？

---

# 2. 产品目标

## 2.1 核心目标

新增 Visual Design Compiler，将 GameDesignSpec 转换成一份可预览、可审查、可验证的游戏视觉设计规格。

核心流程：

```text
Game Intent
    ↓
GameDesignSpec
    ↓
Visual Design Compiler
    ↓
Visual Design Spec + SVG
    ↓
Visual QA
    ↓
Approved Visual Design
```

V1 的交付结果应当是：

- 一份结构化的视觉设计规格。
- 一组符合规范的 SVG 设计稿。
- 一组可供人工审查的 PNG 预览图。
- 一份视觉设计验证报告。
- 一份可追溯的设计与需求关联信息。

## 2.2 设计原则

### 原则一：SVG 是设计中间表示，不是最终游戏资源

SVG 主要负责表达：

- 视觉布局。
- 对象位置。
- 对象尺寸。
- 图层关系。
- 视觉风格。
- UI 结构。
- 场景组成。

不要求最终游戏直接使用 SVG 渲染。

最终游戏仍然可以使用 PNG、SpriteSheet、Drawlist 或其他现有资源类型。

### 原则二：结构化数据是设计的语义来源

SVG 适合表达视觉效果，但不适合独立承担全部游戏语义。

例如，SVG 中一个矩形可能是：

- 玩家碰撞体。
- 装饰物。
- 地形。
- UI 背景。
- 宝箱。

因此，V1 需要同时生成 Visual Design Spec。

Visual Design Spec 描述对象的语义、位置、尺寸、层级和资源关联。

SVG 则是 Visual Design Spec 的可视化呈现。

两者必须能够相互验证。

### 原则三：不破坏现有流水线

V1 应当作为独立编译阶段加入。

不得直接修改现有 AssetRecipe、AssetPack、GameConfig 的语义或职责。

现有资源生成流程仍然保持可用。

### 原则四：优先确定设计，再生成资源和代码

V1 的主要价值是让视觉设计问题尽早暴露。

不应为了实现 SVG 设计稿而提前引入复杂的游戏运行时功能。

---

# 3. V1 功能范围

## 3.1 包含范围

| 功能 | 优先级 |
|---|---|
| GameDesignSpec 转换为 Visual Design Spec | P0 |
| 生成 SVG 场景设计稿 | P0 |
| 生成 SVG 游戏 UI 设计稿 | P0 |
| 生成 SVG 游戏实体设计稿 | P0 |
| SVG 语法与结构验证 | P0 |
| SVG 渲染为 PNG 预览图 | P0 |
| 设计稿与 GameDesignSpec 关联 | P0 |
| Visual QA 报告 | P0 |
| 设计稿版本管理 | P1 |
| 局部设计修改 | P1 |
| 人工批准设计稿 | P1 |
| SVG 直接转换成 AssetRecipe | P2 |
| SVG 直接驱动 GameConfig | P2 |
| 自动修改游戏代码 | 不属于 V1 |

## 3.2 不包含范围

V1 不负责：

- 生成最终游戏美术资产。
- 生成角色动画。
- 生成完整的游戏代码。
- 修改游戏玩法逻辑。
- 自动生成碰撞体。
- 自动完成关卡物理设计。
- 直接替代现有 AssetRecipe。
- 将 SVG 作为最终游戏资源的唯一格式。
- 建立跨游戏的共享视觉知识库。

V1 仅针对单个游戏项目。

---

# 4. 系统架构

## 4.1 新增编译阶段

建议的逻辑结构：

```text
packages/
├── contracts/
├── game-design/
├── assets/
├── pipeline/
└── visual-design/
    ├── contracts/
    ├── compiler/
    ├── renderer/
    ├── validator/
    └── qa/
```

以上目录为逻辑建议，具体目录和接口必须在实施前根据仓库现状确认。

## 4.2 模块职责

### contracts

定义 Visual Design Spec、SVG 文件引用和 QA 报告的数据结构。

### compiler

输入 GameDesignSpec，生成 Visual Design Spec。

编译过程可以使用 AI 生成候选设计，但最终输出必须经过契约验证。

### renderer

负责将 SVG 渲染成 PNG 预览图。

渲染结果必须可重复生成。

### validator

负责确定性验证：

- SVG 是否符合 XML 语法。
- SVG 是否符合允许的元素与属性范围。
- 设计对象是否满足契约。
- 对象引用是否有效。
- 画布尺寸是否正确。
- 文件是否完整。

### qa

负责将 Visual Design Spec 与 GameDesignSpec 对比。

输出需求覆盖情况、设计完整性和视觉审查结果。

---

# 5. 输入与输出契约

## 5.1 输入

Visual Design Compiler V1 接收：

| 输入 | 必需 | 说明 |
|---|---|---|
| GameDesignSpec | 是 | 游戏设计规格 |
| Style Image | 是 | 用户提供的游戏风格图 |
| Game Intent | 是 | 游戏意图与主要玩法 |
| Target Viewport | 是 | 设计画布尺寸 |
| Existing Visual Design | 否 | 用于后续版本迭代 |

V1 不应要求用户手动编辑中间 JSON。

## 5.2 输出目录

建议：

```text
visual-design/
└── v1/
    ├── design-spec.json
    ├── svg/
    │   ├── scene.svg
    │   ├── hud.svg
    │   └── entities.svg
    ├── preview/
    │   ├── scene.png
    │   ├── hud.png
    │   └── entities.png
    └── qa/
        └── report.json
```

实际路径必须遵循 game-maker 现有 run/vN 和 pack/site/vN 的版本目录约定。

不得覆盖已有版本。

## 5.3 Visual Design Spec

建议至少包含：

```json
{
  "schemaVersion": 1,
  "viewport": {
    "width": 1280,
    "height": 720
  },
  "style": {
    "source": "style-image",
    "palette": [],
    "visualLanguage": "pixel-art"
  },
  "objects": [
    {
      "id": "player",
      "role": "player",
      "bounds": {
        "x": 120,
        "y": 480,
        "width": 48,
        "height": 64
      },
      "layer": 10,
      "visualRef": "svg/entities.svg#player",
      "sourceIntent": "player-exploration"
    },
    {
      "id": "treasure-01",
      "role": "pickup",
      "bounds": {
        "x": 840,
        "y": 500,
        "width": 40,
        "height": 32
      },
      "layer": 20,
      "visualRef": "svg/entities.svg#treasure-01",
      "sourceIntent": "treasure-collection"
    }
  ]
}
```

以上仅为概念示例，不是已经确定的正式契约。

正式契约应当：

- 使用项目现有 schema 技术。
- 明确允许的 role。
- 明确坐标系统。
- 明确层级规则。
- 明确对象引用规则。
- 明确必需字段。
- 拒绝未知或不合法的关键字段。

不得将示例 JSON 直接作为正式实现。

---

# 6. SVG 设计规范

## 6.1 画布规范

所有 SVG 必须明确声明：

- width。
- height。
- viewBox。

例如：

```xml
<svg
  xmlns="http://www.w3.org/2000/svg"
  width="1280"
  height="720"
  viewBox="0 0 1280 720"
>
</svg>
```

SVG 坐标必须与 Visual Design Spec 使用统一的设计坐标系。

## 6.2 对象标识

所有需要被程序识别的对象必须具有稳定 ID。

例如：

```xml
<g id="player" data-role="player">
  <rect
    x="120"
    y="480"
    width="48"
    height="64"
    fill="#6b8e55"
  />
</g>
```

要求：

- ID 唯一。
- ID 与 Visual Design Spec 对应。
- 对象位置和尺寸可以被确定性读取。
- 装饰性元素可以不具有业务 ID。
- 不得仅依靠 SVG 中的文本标签识别对象。

## 6.3 SVG 安全规范

V1 必须限制 SVG 的能力范围。

禁止：

- JavaScript。
- 外部脚本。
- 外部资源引用。
- 不受控制的网络请求。
- `foreignObject`。
- 未经批准的外部字体。
- 未经批准的动态内容。

SVG 应当被视为不可信输入。

所有 SVG 在渲染前必须经过安全验证。

## 6.4 视觉规范

生成的 SVG 应当尽量遵循统一的设计语言：

- 色板。
- 线条粗细。
- 圆角。
- 阴影。
- 视觉比例。
- 图层顺序。
- 对象间距。

如果输入风格图是像素风格，则设计稿应采用适合像素风格的视觉表达。

但 V1 不要求 SVG 本身成为最终像素美术资产。

---

# 7. 编译流程

## 7.1 正常流程

```text
1. 读取 GameDesignSpec
2. 读取 Style Image
3. 提取游戏视觉约束
4. 生成 Visual Design Spec
5. 生成 SVG
6. 验证 Visual Design Spec
7. 验证 SVG
8. 渲染 PNG 预览
9. 执行 Visual QA
10. 输出设计稿与报告
```

## 7.2 失败流程

如果编译失败：

- 必须明确失败阶段。
- 必须返回具体错误。
- 不得将无效 SVG 标记为成功。
- 不得生成误导性的 QA 通过结果。
- 不得覆盖已存在的有效版本。
- 不得静默修复关键语义错误。

例如：

```text
Visual Design Compilation Failed

Stage: SVG Validation

Object: player

Reason:
The SVG object bounds do not match
the Visual Design Spec.

Expected:
x=120, y=480, width=48, height=64

Actual:
x=120, y=480, width=64, height=64
```

---

# 8. Visual QA

## 8.1 确定性 QA

以下检查必须通过程序完成：

| 检查项 | 验收标准 |
|---|---|
| SVG 语法 | 所有 SVG 可解析 |
| 画布尺寸 | 与目标 viewport 一致 |
| 对象 ID | 不重复 |
| 对象引用 | 所有引用有效 |
| 对象边界 | 与结构化规格一致 |
| 资源安全 | 不包含禁止内容 |
| 预览生成 | 所有必需预览成功生成 |
| 文件完整性 | 输出文件全部存在 |

## 8.2 语义 QA

检查：

- GameDesignSpec 中的必需对象是否存在。
- 玩家、目标、关键道具是否被表达。
- 关键 UI 是否存在。
- 对象的视觉角色是否与需求一致。
- 是否存在未被设计规格描述的重要对象。

## 8.3 视觉 QA

视觉 QA 可以使用视觉模型或人工审查。

主要检查：

- 风格图一致性。
- 视觉层次。
- 对象比例。
- 场景构图。
- UI 可读性。
- 游戏对象的辨识度。

视觉 QA 不应仅凭 SVG 语法正确就判定通过。

V1 的视觉 QA 可以先提供审查结果，不要求自动修改设计稿。

---

# 9. 与现有 game-maker 的集成

## 9.1 集成原则

V1 以独立编译阶段的方式加入现有流水线。

建议：

```text
GameDesignSpec
      ↓
Visual Design Compiler
      ↓
Visual Design Spec + SVG
      ↓
Visual QA
      ↓
Existing AssetRecipe Pipeline
      ↓
Existing AssetPack Pipeline
      ↓
Existing GameConfig Pipeline
```

## 9.2 不允许的修改

V1 不得：

- 修改 `resolveRoute` 的职责。
- 改变 `source.kind` 的写入规则。
- 绕过现有 AssetRecipe。
- 修改 AssetPack 的生成语义。
- 修改 GameConfig 的契约。
- 引入新的 GameCreationState。
- 引入跨游戏共享视觉知识。
- 改变现有版本目录的原子提交规则。

如果实现过程中发现必须修改已有契约，应当作为独立需求评审。

## 9.3 版本管理

视觉设计产物必须满足：

- 版本不可覆盖。
- 失败版本不消耗正式版本号。
- 构建中的产物不得被视为正式版本。
- 成功产物必须完整提交。
- 失败产物必须能够诊断。
- 设计稿与对应 GameDesignSpec 保持关联。

具体实现应复用项目现有的版本管理规则，而不是创建第二套版本机制。

---

# 10. CLI 与 Pipeline 接口

具体命令名称应根据仓库现有 CLI 结构确定。

建议支持：

```text
game-maker visual-design
```

功能：

- 生成视觉设计稿。
- 验证 SVG。
- 渲染预览。
- 输出 QA 报告。

建议提供逻辑接口：

```ts
interface VisualDesignCompiler {
  compile(input: VisualDesignInput): Promise<VisualDesignResult>;
}

interface VisualDesignInput {
  gameDesignSpec: GameDesignSpec;
  styleImage: StyleImageReference;
  viewport: Viewport;
}

interface VisualDesignResult {
  designSpec: VisualDesignSpec;
  svgFiles: SvgArtifact[];
  previewFiles: PreviewArtifact[];
  qaReport: VisualDesignQAReport;
}
```

以上为接口意图示例。

正式接口必须遵循仓库现有 contracts、CLI 和 pipeline 的设计约束。

---

# 11. 验收标准

V1 必须通过以下验收。

## AC-01：完整生成

给定有效的 GameDesignSpec、风格图和目标画布，系统能够生成：

- Visual Design Spec。
- Scene SVG。
- HUD SVG。
- Entities SVG。
- PNG 预览。
- QA 报告。

## AC-02：视觉预览

所有必需 SVG 均能够被安全渲染。

预览图尺寸与设计画布一致。

## AC-03：对象关联

Visual Design Spec 中的每个必需对象都能关联到 SVG 中对应的对象。

不得依赖模糊的文本匹配。

## AC-04：语义完整性

GameDesignSpec 中要求的玩家、关键目标和必要 UI 必须被表达。

缺少对象时，QA 必须失败或明确报告缺失。

## AC-05：SVG 安全

包含脚本、外部资源引用或禁止元素的 SVG 必须被拒绝。

## AC-06：失败诊断

SVG 解析失败、对象引用错误和设计契约错误必须能够定位到具体阶段及对象。

## AC-07：版本保护

重新生成视觉设计时，不得覆盖已有有效版本。

失败的编译不得污染正式版本。

## AC-08：现有流程兼容

加入 Visual Design Compiler 后：

- 现有资源生成流程仍然可以独立运行。
- 现有 AssetRecipe 不发生非必要变更。
- 现有 AssetPack 验证仍然通过。
- 现有 GameConfig 生成不受影响。
- 现有游戏构建和 QA 不受影响。

## AC-09：无人工修改中间 JSON

正常的编译与验收流程不得要求用户手动修改中间 JSON。

## AC-10：风格审查

必须提供能够用于视觉审查的预览图和风格一致性报告。

V1 不要求视觉模型对风格一致性作出绝对正确的判断，但必须区分确定性验证与主观视觉评价。

---

# 12. 测试方案

## 12.1 单元测试

覆盖：

- Visual Design Spec schema。
- SVG 解析。
- SVG 安全规则。
- 对象 ID 验证。
- 对象边界验证。
- SVG 与设计规格的一致性。
- PNG 渲染。

## 12.2 集成测试

验证：

```text
GameDesignSpec
      ↓
Visual Design Compiler
      ↓
SVG + PNG
      ↓
Visual QA
```

确保整个流程可以完整运行。

## 12.3 回归测试

必须验证：

- 现有 AssetRecipe 流程。
- 现有 AssetPack 验证。
- 现有 GameConfig 生成。
- 现有 CLI。
- 现有 MCP。
- 现有版本管理。

V1 不应为了视觉设计功能而破坏已有的资源编译能力。

## 12.4 Benchmark

建议使用一个固定的废土寻宝游戏作为 V1 Benchmark。

输入：

- 一张固定风格图。
- 一份固定 GameDesignSpec。
- 一组固定的视觉需求。

输出：

- Scene SVG。
- HUD SVG。
- Entities SVG。
- PNG 预览。
- QA 报告。

Benchmark 主要评估：

1. 设计完整性。
2. SVG 有效性。
3. 对象关联准确性。
4. 视觉风格一致性。
5. 生成失败率。
6. 编译耗时。
7. Token 消耗。

不应仅以 SVG 文件数量或代码行数评价生成质量。

---

# 13. 实施阶段

## Phase 0：架构审查

目标：

确认现有 game-maker 中与视觉设计相关的契约和流水线边界。

工作：

- 检查 GameDesignSpec。
- 检查 AssetRecipe。
- 检查现有 Visual QA。
- 检查版本目录规则。
- 检查 CLI 和 Pipeline。
- 确定 Visual Design Spec 的正式契约。

交付：

- 架构审查结果。
- 正式数据契约。
- 接口边界。
- 实施方案。

## Phase 1：Visual Design Compiler

目标：

生成结构化视觉设计和 SVG。

工作：

- 实现 Visual Design Spec。
- 实现编译器。
- 实现 Scene SVG。
- 实现 HUD SVG。
- 实现 Entities SVG。
- 实现 SVG 验证。
- 实现 PNG 渲染。

## Phase 2：Visual QA

目标：

确保设计稿符合游戏意图。

工作：

- 需求覆盖检查。
- 对象关联检查。
- 设计完整性检查。
- 视觉审查报告。
- 失败诊断。

## Phase 3：Pipeline 集成

目标：

将 Visual Design Compiler 接入现有游戏生成流水线。

工作：

- 接入 GameDesignSpec。
- 输出独立版本化产物。
- 保持现有 AssetRecipe 流程不变。
- 增加 CLI 或 Pipeline 调用入口。
- 增加集成测试。

## Phase 4：Benchmark 验收

目标：

验证 V1 的实际价值。

工作：

- 固定测试输入。
- 运行完整生成流程。
- 检查 SVG。
- 检查预览图。
- 检查 QA 报告。
- 评估视觉质量。
- 评估生成成本。

---

# 14. V1 成功标准

V1 的成功不是生成了多少 SVG。

而是：

**系统能否在生成游戏资源和代码之前，稳定地产出一份符合游戏意图、能够被人和 AI 理解、能够被程序验证的视觉设计规格。**

最终希望建立以下能力：

```text
用户需求
   ↓
游戏设计
   ↓
视觉设计
   ↓
视觉验收
   ↓
资源生成
   ↓
游戏实现
   ↓
游戏验收
```

V1 完成后，game-maker 将拥有一个独立的视觉设计中间层。

后续可以在此基础上逐步实现：

- Visual Design → AssetRecipe。
- Visual Design → AssetPack。
- Visual Design → GameConfig。
- Visual Design → Visual QA。
- Visual Design → Gameplay QA。

但这些属于后续阶段，不应作为 V1 的必要条件。

---

# 15. 最终裁定建议

建议批准 Visual Design Compiler V1，但严格限制其范围。

V1 只负责：

1. 从 GameDesignSpec 生成 Visual Design Spec。
2. 生成符合规范的 SVG。
3. 生成 PNG 预览。
4. 验证 SVG 和设计结构。
5. 输出 Visual QA 报告。
6. 以独立版本化产物保存。

暂不要求：

- SVG 直接驱动资源生成。
- SVG 直接生成游戏代码。
- SVG 替代现有 AssetRecipe。
- SVG 替代 GameConfig。
- 自动修改游戏玩法。

**核心裁定：SVG 是 game-maker 的视觉设计中间表示，而不是新的游戏资源生成系统。**

先让设计变得明确、可观察、可验证，再让它逐步驱动后续编译阶段。
