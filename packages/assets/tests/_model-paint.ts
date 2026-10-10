// 「桩生图器**交付**的那个底色」—— 一个可以在测试之间复用的、确定性的事实。
//
// ⚠️ **这个文件是票 37 的 Q5 那一半**。此前的桩**照着提示词里那个颜色铺满**，
//   于是「模型会交付我们声明的那个颜色」成了测试环境里**唯一**的可能 ——
//   而真跑里它**从不发生**：第三次真跑 9/9 张图在容差 30 下抠到 **0 像素**，
//   画面里离声明色最近的那个像素也差 L1 **118~334**（提示词里那句话写了两到四遍）。
//
//   ⇒ 票 37 §4 量到的那件事就是这么来的：**三道闸全绿而规则是错的**，
//     因为「提示词说了 X、模型该照做」这一类判据**用桩永远验不出来** ——
//     被判据验的是桩（一个只会照做的傀儡），不是模型。
//   ⇒ 所以桩**默认交付另一个颜色**：从下面这 9 个**量出来的**交付色里挑一个，
//     确定性、可预测、**且永不等于声明色**。
//
// ⚠️ **上游依赖写在这儿**（票 37 的 Q5 边界第 4 条）：这 9 个值量自
//   `gemini-2.5-flash-image`（2026-10-09 第三次真跑，`#ff00ff` 一律没被交付）。
//   **换了上游（换模型 / 换供应商）⇒ 偏移会变 ⇒ 这一族值要重量**，
//   而不是把断言放宽到「怎么画都算过」。
//   原始读数：`.scratch/game-maker-v2/experiments/e2e-wasteland/raw/key-colour-third-run/`
//   （`measure-key-colour.mjs` + `measured-2026-10-09.txt`）。

/** 第三次真跑那 9 张图的**实测众数色**（也就是模型真画出来的那些底）。 */
export const MEASURED_DELIVERED: readonly (readonly [number, number, number])[] = [
  [200, 30, 124],   // master-enemy
  [226, 34, 138],   // master-scavenger
  [198, 28, 124],   // enemy-patrol
  [225, 31, 139],   // scavenger-idle
  [224, 31, 138],   // scavenger-run
  [225, 30, 138],   // scavenger-jump
  [224, 32, 138],   // scavenger-fail
  [243, 195, 219],  // treasure-chest（这一张是**浅粉**，与另外 8 张差得很远）
  [48, 57, 70],     // wasteland-skyline.sky（根本不是平涂）
];

/**
 * **声明色 → 交付色**的映射。表里那条是**量出来的**那一对（票 37 §2 第一行）：
 * 我们告诉模型 `#ff00ff`，它交回来的底是 `[200, 30, 124]`。
 *
 * ⚠️ 表**只覆盖量过的那一个声明色**（9 张图的提示词里写的都是 `#ff00ff`），
 *   其余声明色走下面的确定性哈希 —— 那不是在假装「量过别的声明色」，
 *   而是在**保持一条性质**：**交付色永不等于声明色**，且落在一个真实交付过的色族里。
 */
const PINNED: Record<string, readonly [number, number, number]> = {
  "#ff00ff": [200, 30, 124],
};

const l1 = (a: readonly number[], b: readonly number[]): number =>
  Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!);

const hex = (c: readonly [number, number, number]): string =>
  `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;

/** `#ff00ff` → `[200,30,124]` 这类入参既可以是十六进制串，也可以是三元组。 */
export const px = (c: string | readonly [number, number, number]): [number, number, number] =>
  typeof c === "string"
    ? [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]
    : [c[0]!, c[1]!, c[2]!];

/** 桩该画成什么颜色 —— 确定性、且**保证不等于** `declared`。 */
export function deliveredColour(declared: string | readonly [number, number, number]): [number, number, number] {
  const d = px(declared);
  const pinned = PINNED[hex(d)];
  if (pinned !== undefined) return [...pinned];
  const i = (d[0]! * 31 + d[1]! * 37 + d[2]! * 41) % MEASURED_DELIVERED.length;
  const pick = MEASURED_DELIVERED[i]!;
  // 撞上声明色（理论上只可能发生在声明色本身就是那一族里的一个时）就顺延一格 ——
  // **这条性质是硬的**：桩要是画了声明色，整个「交付色 ≠ 声明色」的测试环境就塌了。
  return l1(pick, d) === 0
    ? [...MEASURED_DELIVERED[(i + 1) % MEASURED_DELIVERED.length]!]
    : [...pick];
}
