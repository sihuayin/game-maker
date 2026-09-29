// ⚠️ **原型，不是产物** —— 这一票要回答的是「这份提示词产出的关卡像不像一个铺子」，
//    而那是**人眼**判的。所以产物是「跑一次 + 把结果摊开给人看」，用完即弃。
//
// 假设：prototype 的两个分支（LOGIC / UI）都不贴 —— 被验的是**一段提示词**，
// 而要看的东西是它产出的**地图**。所以取「把产物摊开给人看」这条，而不是造一个状态机或 UI 变体。
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const PACK = path.join(ROOT, "fixtures/packs/counter-siege/v4");
const SCALE = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/td-configs/counter-siege.json"), "utf8"));

const manifest = JSON.parse(fs.readFileSync(path.join(PACK, "manifest.json"), "utf8"));

/** 资源包清单 —— `resourceBrief` 的塔防版。⚠️ 带上 `role`：模型靠它认出「哪个是砖」。 */
const resourceBrief = (m) => m.assets.map((a) => {
  const anim = a.animations?.length ? `动画：${a.animations.map((x) => `${x.name}(${x.frames.length}帧)`).join(" · ")}` : "（无动画）";
  return `- \`${a.id}\` · ${a.kind} · ${a.size.w}×${a.size.h}px · ${a.role} · ${anim}`;
}).join("\n");

/** ⚠️ 骨架 —— 这一段是这一票最值钱的：逐字给出「一行多长、五个字符怎么摆」。
 *  资源 id 一律占位符，否则示例会把某一关的 id 焊进提示词。 */
export const tdConfigExample = {
  format: "td-config/v1",
  world: { size: { w: 480, h: 270 } },
  arena: {
    cell: 15,
    walkChar: ":",
    tiles: { "#": { asset: "<墙砖的 id>" }, ".": { asset: "<地面砖的 id>" }, "=": { asset: "<货架砖的 id>" }, ":": { asset: "<走道砖的 id>" }, "+": { asset: "<卷帘门的 id>" } },
    rows: [
      "################################",
      "################################",
      "#..............................#",
      "#..==========================..#",
      "#::::::::::::::::::::::::::::::+",
      "#.....:........................#",
      "#.....:........................#",
      "#.....:.======================.#",
      "#.....:........................#",
      "#.....:........................#",
      "#.....:........................#",
      "#.....:........................#",
      "#::::::........................#",
      "#..............................#",
      "#..............................#",
      "#..==========================..#",
      "#..............................#",
      "#..............................#",
    ],
  },
  scene: { slot: { asset: "<插槽的 id>" }, slotActive: { asset: "<高亮框的 id>" } },
  path: { points: [{ x: 457, y: 67 }, { x: 97, y: 67 }, { x: 97, y: 187 }, { x: 37, y: 187 }] },
  core: { asset: "<柜台的 id>" },
  slots: [
    { id: "s1", at: { x: 187, y: 112 } }, { id: "s2", at: { x: 277, y: 112 } }, { id: "s3", at: { x: 367, y: 112 } },
  ],
  towers: [
    { id: "<机关 id>", name: "<显示名>", asset: "<机关的 id>", attack: "single", targeting: "first",
      cost: 40, upgradeCost: 60,
      levels: [{ range: 56, damage: 5, fireMs: 480 }, { range: 68, damage: 9, fireMs: 380 }],
      projectile: { asset: "<抛射物的 id>", speed: 220 } },
    { id: "<范围机关的 id>", name: "<显示名>", asset: "<范围机关的 id>", attack: "aoe", targeting: "first",
      cost: 60, upgradeCost: 90,
      levels: [
        { range: 40, damage: 3, fireMs: 900, slow: { factor: 0.6, ms: 1200 } },
        { range: 52, damage: 5, fireMs: 800, slow: { factor: 0.45, ms: 1600 } },
      ],
      fx: { asset: "<放电特效的 id>", anim: "<动画名>" } },
  ],
  enemies: [
    { id: "<敌人 id>", name: "<显示名>", asset: "<敌人的 id>", anim: "<动画名>",
      hp: 20, speed: 40, bounty: 6, armor: 0, leakCost: 1 },
  ],
  waves: [{ groups: [{ enemy: "<敌人 id>", count: 6, gapMs: 800, delayMs: 0 }] }],
  economy: { startScrap: 120, lives: 20, waveBonus: 35 },
  hud: {
    panel: { asset: "<顶栏的 id>", at: { x: 0, y: 0 }, size: { w: 480, h: 30 } },
    readout: { at: { x: 22, y: 5 }, step: { x: 0, y: 10 } },
    icons: { scrap: { asset: "<废料图标的 id>", at: { x: 8, y: 6 } }, life: { asset: "<声望图标的 id>", at: { x: 8, y: 16 } } },
    buttons: { asset: "<按钮底板的 id>", at: { x: 300, y: 4 }, size: { w: 44, h: 22 }, step: { x: 48, y: 0 } },
    start: { asset: "<按钮底板的 id>", at: { x: 444, y: 4 }, size: { w: 28, h: 22 } },
  },
};

export function renderPrompt(requirement) {
  return `你是塔防关卡设计师。根据下面的**需求**与**资源包清单**，产出一份 td-config（td-config/v1）。

只输出 JSON 本体，不要 markdown 围栏，不要解释。

# 铁律（**每条都会被校验器检查，违反直接拒收**）

1. 顶层只有这十一类键：format / world / arena / scene / path / core / slots / towers / enemies / waves / economy / hud。多一个就拒。
2. \`format\` 恒为 \`"td-config/v1"\`。坐标一律**非负整数** —— \`x: 10.5\` 会静默糊掉像素网格，直接拒。
3. **场地由字符地图拼出来**，不是一整张背景图。字符只有五个，含义固定：
   \`#\`=墙 · \`.\`=地面 · \`=\`=货架 · \`:\`=**走道** · \`+\`=入口（卷帘门）。
   \`arena.walkChar\` 必须写 \`":"\`。\`arena.tiles\` 把每个字符绑到资源包里的一件**砖**（就是下面清单里 role 写着「砖」的那种）。
4. 地图固定 **32 列 × 18 行**、\`cell\` 固定 **15**。**每一行必须是正好 32 个字符**，行数正好 18。
   ⚠️ 世界尺寸必须是 480×270（32×15、18×15），行列数或 cell 写错就拒。
5. ⚠️ **走道要连成一条**：从右上角那个 \`+\`（入口）出发，一路 \`:\` 不断，**通到左下角的柜台**。
   不要把走道画碎、不要让它中途断掉。**敌人走过的每一格都必须是走道砖** ——
   地图上画成别的字符、而路径又从那里穿过，就会拒。
6. \`path.points\` 是敌人走的折线，**从入口到柜台**，相邻两点必须**轴对齐**（只有横段和竖段），
   不许有两个点完全重合。坐标要落在走道那一格的中心上。
7. ⚠️ **\`core\` 只写资源 id，不写位置** —— 柜台的位置**就是路径的最后一个点**，写重了就拒。
8. \`slots\` 是可建造的空位，**不许压在走道上**（离折线太近会拒）。插槽 id 自定（\`s1\`、\`s2\`…）。
9. \`towers[].attack\` 只能 \`"single"\`（单体）或 \`"aoe"\`（范围）；\`targeting\` 只能 \`"first\`" 或 \`"strongest\"\`。
   每座塔**正好两级**（\`levels\` 是长度 2 的数组）。
   ⚠️ \`levels[].slow\` 是个**对象**\`{"factor":0.6,"ms":1200}\`，**不是一个数**；\`factor\` 必须**严格小于 1**。
   ⚠️ **\`aoe\` 塔不写 \`projectile\`**（它不抛东西，伤害在原地炸开）；它要写 \`fx\`（开火时播一次的特效）。
   \`single\` 塔才写 \`projectile\`，\`speed\` 必须 **> 0**。
10. \`waves[].groups[].enemy\` 必须是 \`enemies\` 里真实存在的 id；敌人的 \`anim\` 必须是清单里真有的动画名。
11. **只许用下面清单里的 id 与动画名** —— 清单里没有的一律拒收。

# 需求
${requirement}

# 资源包清单（**只许用这里面的东西**）
${resourceBrief(manifest)}

# 数值参考刻度（**这是参考，不是规定**）

这一关的数值要在下面这个量级上，才**不容易写出一局赢不了的**：

- 机关的伤害：**个位数**（3–20）。敌人的血量：**两位数**（14–70）。护甲：**0–2**（不是两位数）。
- 机关的射速：**400–1400 毫秒**。敌人速度：**20–70 像素/秒**。
- 开局废料：**最便宜那座塔造价的三倍左右**。塔的造价：**40–80**（最贵别超过最便宜的 2 倍）。
- 波次 5 波，每波 6–21 个敌人，同一组内的出怪间隔 500–2000 毫秒。

⚠️ **拿不准的时候，宁可把敌人写弱、把塔写便宜** —— 往那个方向的余量是 10 倍量级，
往反方向只有 1.5 倍（这是一关一关量出来的，不是猜的）。
⚠️ **这一条不是规定**：你的关卡只要**自洽**就行（塔的伤害与敌人的血量成比例、开局废料够建两三座）。
**难而公平**的关卡是允许的。

# 形状（**逐字照抄这个骨架**；\`<…>\` 是占位符，换成清单里真实的 id 与动画名）
${JSON.stringify(tdConfigExample, null, 2)}

⚠️⚠️ **骨架里那张地图是「行格式的演示」，不是一张可以拿来用的地图。**
它存在的唯一理由是让你看清「一行正好 32 个字符、五个字符怎么摆、走道怎么连成一条」。
**照抄它 = 没有按上面的需求设计这一关** —— 需求说了这一关的场地长什么样，按那个画。
（行列数、字符集、走道要连通这三条不变。）
`;
}
