# Game Maker V2 Contracts

> 所有模块必须通过 Contract 通信。
>
> 禁止模块直接依赖其他模块内部实现。

---

# 1. Contract 总览

```text
StyleReference
      ↓
VisualWorldSpec

User Intent
      ↓
GameIntentSpec

VisualWorldSpec
+
GameIntentSpec
      ↓
GameDesignSpec

GameDesignSpec
+
VisualWorldSpec
      ↓
AssetRecipe

AssetRecipe
      ↓
AssetPack

GameDesignSpec
+
RuntimeProfile
      ↓
GameConfig

Playable Game
      ↓
QAReport
```

---

# 2. VisualWorldSpec

文件：

```text
packages/contracts/src/visual-world.ts
```

结构：

```ts
export interface VisualWorldSpec {
  schemaVersion: string;

  identity: {
    styleName?: string;
    keywords: string[];
    description: string;
  };

  rendering: {
    style: string;
    pixelDensity?: number;
    antialiasing?: boolean;
    outline?: string;
    shading?: string;
    texture?: string;
    dithering?: string;
  };

  camera: {
    mode: "side" | "top-down" | "isometric" | "first-person" | "other";
    projection?: string;
    angle?: number;
    elevation?: number;
    perspective?: string;
  };

  composition: {
    foreground?: string;
    midground?: string;
    background?: string;
    objectScale?: string;
    characterScale?: string;
    density?: string;
  };

  palette: {
    primary: string[];
    secondary: string[];
    accent: string[];
    background: string[];
    shadow: string[];
    highlight: string[];
  };

  lighting: {
    direction?: string;
    softness?: string;
    contrast?: string;
    mood?: string;
  };

  materials: Record<string, {
    appearance: string;
    texture?: string;
    color?: string[];
  }>;

  character: {
    proportions?: string;
    silhouette?: string;
    poseLanguage?: string;
    clothing?: string;
    faceAbstraction?: string;
  };

  environment: {
    architecture?: string;
    terrain?: string;
    props?: string;
    textureDensity?: string;
  };

  animation: {
    frameStyle?: string;
    poseExaggeration?: string;
    timing?: string;
  };

  readability: {
    silhouette?: string;
    contrast?: string;
    gameplayScale?: string;
  };

  references: {
    styleImages: string[];
    characterImages?: string[];
    materialImages?: string[];
  };

  confidence: number;
}
```

---

# 3. GameIntentSpec

文件：

```text
packages/contracts/src/game-intent.ts
```

```ts
export interface GameIntentSpec {
  schemaVersion: string;

  title?: string;

  genre: string;

  subgenre?: string;

  camera?: string;

  targetExperience: string;

  coreLoop: string[];

  player: {
    role: string;
    goals: string[];
  };

  world: {
    theme: string;
    setting: string;
    atmosphere: string;
  };

  mechanics: string[];

  interactions: string[];

  entities: Array<{
    id: string;
    type: string;
    role: string;
  }>;

  progression?: {
    type?: string;
    description?: string;
  };

  challenge?: {
    type?: string;
    description?: string;
  };

  resources: string[];

  winConditions: string[];

  loseConditions: string[];

  ambiguity: string[];

  confidence: number;
}
```

---

# 4. GameDesignSpec

文件：

```text
packages/contracts/src/game-design.ts
```

```ts
export interface GameDesignSpec {
  schemaVersion: string;

  game: {
    title: string;
    genre: string;
    camera: string;
    runtimeProfile: string;
  };

  coreLoop: string[];

  player: {
    id: string;
    role: string;
    abilities: string[];
    goals: string[];
  };

  enemies: Array<{
    id: string;
    behavior: string;
    threat: string;
  }>;

  npcs: Array<{
    id: string;
    role: string;
    interaction: string;
  }>;

  interactables: Array<{
    id: string;
    type: string;
    behavior: string;
  }>;

  resources: Array<{
    id: string;
    purpose: string;
  }>;

  world: {
    theme: string;
    setting: string;
    structure: string;
  };

  levels: Array<{
    id: string;
    purpose: string;
    layout: string;
    entities: string[];
  }>;

  progression: {
    model: string;
    description: string;
  };

  difficulty?: {
    model: string;
    description: string;
  };

  winConditions: string[];

  loseConditions: string[];

  interactionModel: string[];

  assetRequirements: string[];

  visualRequirements: string[];

  runtimeRequirements: string[];
}
```

---

# 5. AssetRecipe 扩展

现有 AssetRecipe 保留。

增加：

```ts
export type AssetGenerationStrategy =
  | "image"
  | "character-reference"
  | "image-edit"
  | "drawlist"
  | "procedural"
  | "import";
```

Asset source：

```ts
interface AssetSource {
  kind: AssetGenerationStrategy;

  referenceAssets?: string[];

  masterAsset?: string;

  dependsOn?: string[];

  parameters?: Record<string, unknown>;
}
```

---

# 6. Asset Dependency

每个资产支持：

```ts
interface AssetDependency {
  dependsOn: string[];

  derivedFrom?: string;

  masterAsset?: string;

  referenceAssets?: string[];
}
```

例如：

```text
player-master
 ├── player-idle
 ├── player-run
 ├── player-jump
 └── player-attack
```

---

# 7. CharacterDNA

文件：

```text
packages/contracts/src/character-dna.ts
```

```ts
export interface CharacterDNA {
  id: string;

  identity: string;

  bodyProportions: string;

  silhouette: string;

  face: string;

  clothing: string;

  equipment: string[];

  palette: string[];

  accessories: string[];

  visualConstraints: string[];
}
```

---

# 8. RuntimeProfile

文件：

```text
packages/contracts/src/runtime-profile.ts
```

```ts
export interface RuntimeProfile {
  id: string;

  version: string;

  genre: string;

  capabilities: string[];

  inputModel: string;

  cameraModel: string;

  entityTypes: string[];

  mechanics: string[];

  winConditions: string[];

  loseConditions: string[];
}
```

第一阶段：

```text
platformer/v1
```

---

# 9. QAReport

文件：

```text
packages/contracts/src/qa.ts
```

```ts
export interface QAReport {
  status: "pass" | "fail";

  visual?: VisualQAResult;

  gameplay?: GameplayQAResult;

  intent?: IntentQAResult;

  failures: QAFailure[];

  repairAttempts: number;
}
```

---

# 10. Visual QA

```ts
interface VisualQAResult {
  styleSimilarity: number;
  paletteSimilarity: number;
  silhouetteSimilarity: number;
  compositionSimilarity: number;
  characterConsistency: number;
  materialConsistency: number;
  animationConsistency: number;
}
```

---

# 11. Intent QA

```ts
interface IntentQAResult {
  coverage: Record<string, boolean>;

  score: number;

  missingRequirements: string[];
}
```

---

# 12. QA Failure

```ts
type QAFailureCode =
  | "STYLE_MISMATCH"
  | "COLOR_MISMATCH"
  | "CAMERA_MISMATCH"
  | "SILHOUETTE_MISMATCH"
  | "CHARACTER_DRIFT"
  | "MATERIAL_MISMATCH"
  | "SCALE_MISMATCH"
  | "TRANSPARENCY_ERROR"
  | "ANIMATION_ERROR"
  | "GAMEPLAY_READABILITY_ERROR"
  | "GAMEPLAY_RUNTIME_ERROR"
  | "INTENT_MISSING";
```

---

# 13. GameCreationState

```ts
export interface GameCreationState {
  input: {
    styleReferences: string[];
    gameIntent: string;
  };

  visualWorld?: VisualWorldSpec;

  gameIntentSpec?: GameIntentSpec;

  gameDesign?: GameDesignSpec;

  assetRecipe?: AssetRecipe;

  assetPack?: AssetPack;

  runtimeProfile?: RuntimeProfile;

  gameConfig?: GameConfig;

  qa?: QAReport;
}
```

---

# 14. 模块边界

## Vision

输入：

```text
StyleReference
```

输出：

```text
VisualWorldSpec
```

不得生成 AssetPack。

---

## Intent Analyzer

输入：

```text
Natural Language Intent
```

输出：

```text
GameIntentSpec
```

不得直接生成 GameConfig。

---

## Game Design Compiler

输入：

```text
VisualWorldSpec
GameIntentSpec
```

输出：

```text
GameDesignSpec
```

---

## Asset Planner

输入：

```text
VisualWorldSpec
GameDesignSpec
```

输出：

```text
AssetRecipe
```

---

## Asset Compiler

输入：

```text
AssetRecipe
VisualWorldSpec
```

输出：

```text
AssetPack
```

---

## Runtime Compiler

输入：

```text
GameDesignSpec
RuntimeProfile
AssetPack
```

输出：

```text
GameConfig
```

---

## QA

输入：

```text
Playable Game
VisualWorldSpec
GameIntentSpec
GameDesignSpec
```

输出：

```text
QAReport
```

---

# 15. 禁止跨层

禁止：

```text
Vision → GameConfig

Intent Analyzer → AssetPack

Asset Generator → Runtime Code

Runtime → LLM
```

所有跨层调用必须通过 Contract。
