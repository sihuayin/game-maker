# 玩家角色的生图提示词（反乌托邦柜台世界）

参考图 = `fixtures/reference/test.png`（店内柜台那张）。
风格规格 = `.scratch/game-creation-v1/experiments/style-transfer-from-test-png/stylespec.json`。

**这个世界的硬事实（都是量出来的，不是偏好）：**

| | |
|---|---|
| 画布 32×48 | ⇒ **角色外接矩形必须 宽 2 : 高 3**。管线会把外接矩形两方向独立拉伸到 32×48，比例不对就是硬拉伸（实测最大 26%） |
| 9 色板 | `#7C968E` `#55685F` `#A9B7AC` `#3E3236` `#C3CDC9` `#EAD8A6` `#C4694A` `#4EBBA4` `#6D8F52` |
| 头身比 ≈ 4 头身 | 由 48px 的画布决定。**不要**照抄"6 头身"——参考图里的人物只有上半身，而且票 22 实测模型读到了自由文本也不执行 |
| 背景**必须真透明** | GPT Image 2.5 支持真 alpha。**绝对不要**用上面 9 色里的任何颜色画背景 —— `#3E3236` 是角色用得最多的色（实测占一帧的 73%），拿它当底会把角色抠穿 |
| 两条路 | ① **只出母版**，用程序 drawlist 补动画；② 走下面第一轮 + 第二轮，全用生图 |

---

## 通用画风块（三段提示词里**一字不改**地重复）

```
2D retro pixel art, hand-crafted, low-to-medium pixel resolution, visibly discrete pixels.
Flat solid color blocks only. Hard pixel-stepped edges. NO anti-aliasing, NO soft edges,
NO gradients, NO glossy highlights, NO photographic texture, NO 3D rendering, NO anime,
NO vector smoothness.

Muted desaturated dystopian industrial palette, cold teal-gray dominant, warm accents minor.
Use ONLY these 9 colors, nothing else:
#7C968E  #55685F  #A9B7AC  #3E3236  #C3CDC9  #EAD8A6  #C4694A  #4EBBA4  #6D8F52

Shading is built from CLUSTERED pixel steps and small dithered patches, not smooth blends.
Camera: straight-on eye-level, zero perspective distortion, flat orthographic staging.

Background must be FULLY TRANSPARENT (true alpha = 0). No checkerboard pattern, no solid
backdrop color, no ground, no shadow, no props, no UI, no text, no labels, no watermark.
```

⚠️ **最后那段关于透明的话很关键**：光写 "transparent" 有时会给你一张画着灰白格子的图。
拿到图先确认它是**真带 alpha 通道的 PNG**（在 Finder 里看，或丢进预览看棋盘格是不是透明的）。

---

## 第一轮：角色母版（1 张，**先出这张**）

先定稿角色，后面三个动画全都拿它当参考图。这一步是生图路线拿到帧一致性的唯一手腕。

```
[上面那段通用画风块，原样复制]

Create a game-ready player character sprite, single character, full body, centered,
front-facing, standing still, arms relaxed at the sides.

The character: a middle-aged shopkeeper in a dystopian retro-industrial world.
Thick worn work jacket in grey-green. Dark trousers, scuffed boots.
A green knit beanie cap on the head. A short grey beard on the face.
On the CHEST, a small emissive CRT display panel glowing with warm amber light.

PROPORTIONS: about 4 heads tall, compact and slightly stocky. Full body visible.

VALUE STRUCTURE — this is the most important part:
The cap, the beard, the face, the jacket, the trousers and the boots must each be VISIBLY
DIFFERENT COLORS from one another. The character must NOT read as a dark silhouette.
The darkest palette color must be used ONLY for thin outlines and deep shadow pockets,
never for large flat areas. Aim for at least 5 of the 9 palette colors clearly readable.

Bounding box of the character must be WIDTH : HEIGHT = 2 : 3 exactly.
The character must fit fully inside the canvas with a small transparent margin, not touching
any edge.

No weapon, no handheld object, no additional characters, no scenery.
```

**存成** `inputs/gpt-image-trial/player-master.png`。

---

## 第二轮：三个动画（各 1 张横排 sheet）

**每张都把 `player-master.png` 当参考图传进去**，并保留下面这段"保持"声明 —— 这是防漂移的关键。

### 共用开头（每张都要带）

```
[上面那段通用画风块，原样复制]

Using the attached character master sheet as the EXACT character reference, create one
horizontal sprite sheet of the SAME character.

KEEP EXACTLY, frame to frame, pixel-for-pixel wherever possible:
the face, the beard, the beanie cap, the jacket shape and color, the chest CRT panel,
the trousers, the boots, the body proportions, the outline style, the shading language,
the palette usage, the pixel scale, and the character's size within each cell.

Only the pose of the limbs and the body's vertical bob may change.
Every cell must contain the same character at the same scale, same body height,
same baseline (feet on the same ground line).

Layout: ONE single horizontal row of N equal-width cells. No grid lines, no cell borders,
no numbers, no text, no labels, no separators between cells.
Bounding box of the character in each cell must be WIDTH : HEIGHT = 2 : 3.
Background fully transparent.
```

### ②-a idle —— 4 格

```
[上面的共用开头，N = 4]

Animation: IDLE. Four frames of a quiet standing breath cycle.
Frame 1: neutral stance. Frame 2: chest slightly lifted, shoulders up 1 pixel.
Frame 3: settled. Frame 4: shoulders down 1 pixel, slight exhale.
The change between frames is tiny — a subtle breathing motion, not a pose change.
```

### ②-b run —— 6 格

```
[上面的共用开头，N = 6]

Animation: RUN cycle, seen from the front, running forward toward the viewer.
Six consecutive frames forming a complete loop.
Frame 1: contact, arms swung opposite to legs.
Frame 2: passing, body at its highest.
Frame 3: opposite contact, mirrored limbs.
Frame 4: passing, body at its highest.
Frame 5: contact again.
Frame 6: passing.
Arms bent at the elbow, swinging front-to-back. Legs clearly alternating.
Head and torso stay the same and stay centered; only limbs and a 1-2 pixel body bob change.
```

### ②-c jump —— 4 格

```
[上面的共用开头，N = 4]

Animation: JUMP. Four frames of a jump arc, front view.
Frame 1: crouch — knees bent, body compressed low, arms back.
Frame 2: launch — legs extending, arms swinging up, body stretched.
Frame 3: airborne apex — legs tucked slightly, arms up.
Frame 4: landing — knees bent absorbing, arms out for balance.
Head and torso keep their proportions; the body's vertical position changes between frames
(do NOT re-center each frame to the same height — the arc must be visible).
```

**分别存成** `player-idle.png` / `player-run.png` / `player-jump.png`。

---

## 拿到图之后

**先告诉我每张图的真实像素尺寸**（我在管线上要按它填网格参数 —— 网格切分是硬切的，`columns/rows/frameWidth/frameHeight` 必须精确）。
⚠️ 生图模型**不保证**返回你要的尺寸（第三方实测：请求 1280×720、返回 1672×941），所以别自己换算，报实测数字。

然后：

```bash
node .scratch/game-creation-v1/experiments/real-generation/measure-import.mjs <每张图> 32x48
```

它会报三件事，**进包前先看这三个数**：

- **平均色误差**（基线 8.5%）—— 明显更低说明模型真听进了色板
- **色板覆盖**（基线 8/9）—— 掉到 3~4 色说明量化把细节压平了
- **头身比与长宽比**—— 会直接算给你"会被拉伸多少 %"

⚠️ 它还会报**极淡 alpha 孤点**。那个数不是 0 的话告诉我：一颗 alpha=1 的孤点曾把角色缩到原大的 59%×88%（已在 `trimToInk` 里修掉，但值得知道你的图有没有）。
