// 票 05 Q11 的**见证判据** —— 「词表的每一条都得**指得到外壳的一行**」。
//
//   它是 `R12`（`RuntimeProfile` 是**外壳能力的事实投影**）在「转录」这条路上的收尾：
//   词表是**带行号的转录**（`vocabulary.ts` 的注释写着它投影的是哪一行），而注释**不会响** ——
//   删掉 `scene.ts` 里那行实现，注释照样躺在那儿说它实现了。这一条判据就是那条注释的报警器。
//
//   ⚠️ **为什么是读源码文本**：`shell/scene.ts` 第 7 行 `import Phaser from "phaser"`，
//     在 node 的 vitest 里 import 不了。八条能力里**七条**住在 `scene.ts`
//     （能 import 的只有 `draw.ts` / `world.ts` 那两个纯文件）——
//     所以「对着实现过」只剩读文本一条路（票 05 Q11）。
//
//   ⚠️ **两条纪律**（Q11 定的）：
//     ① `needle` 必须是**行为串**，不是注释措辞 —— 否则改一次注释就能悄悄满足判据。
//        ⚠️ 守这一条的机制是 `stripComments`：判据读的是**剥掉注释之后**的源码。
//        第一版读原文 + 只判行首注释，被一句**行尾块注释**当场骗过（变异实验，见下）。
//     ② **不记行号** —— 行号会漂；指路的那份行号留在 `vocabulary.ts` 的注释里。
//        ⚠️ 于是本文件的 `needle` 与 `vocabulary.ts` 注释里的行号**是两个东西**：
//        前者要稳（改实现就红），后者要准（改了要手动更新）。**别把它们合并。**
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { CAPABILITIES, type Capability } from "@game-maker/contracts";

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

type Witness = { file: string; needle: string };

/** ⚠️ 这张表**是穷尽的**（`Record<Capability, …>`）：词表加一条能力而这里没给见证 ⇒
 *  **当场编译不过** —— 与 `vocabulary.test.ts` 的 `ENTITY_KIND_FATE` 同款，
 *  只不过那张写成了 `Record<string, …>`（编译期不拦，只有测试期拦；别抄那一半）。 */
const WITNESS: Record<Capability, Witness> = {
  "input:keyboard":              { file: "../src/shell/scene.ts", needle: "createCursorKeys()" },
  "camera:side-scroll":          { file: "../src/shell/scene.ts", needle: "cam.setBounds(" },
  "camera:parallax":             { file: "../src/shell/scene.ts", needle: "setScrollFactor(l.parallax)" },
  "collision:aabb":              { file: "../src/shell/scene.ts", needle: "this.physics.add.overlap(" },
  "motion:cyclic":               { file: "../src/shell/scene.ts", needle: "h.t0 % h.periodMs" },
  "objective:collect-then-reach": { file: "../src/shell/scene.ts", needle: "this.collected < world.objective.pickupCount" },
  "hud:screen-space":            { file: "../src/shell/scene.ts", needle: "setScrollFactor(0)" },
  // 「1 交付态像素 = 1 屏幕像素」靠的是视口是**外壳的常量**（`CONTEXT.md:456-459`）。
  "coord:delivery-pixels":       { file: "../src/draw.ts", needle: "VIEWPORT" }
};

/** 剥掉注释之后的源码。
 *
 *  ⚠️ 这一层是**被变异实验逼出来的**：第一版直接读原文、再拿行首判注释，结果被
 *    `true /* this.collected < world.objective.pickupCount *\/` 这种**行尾块注释**骗过 ——
 *    「实现删了、注释留着」正是这条判据要抓的东西，而它当时没响。
 *  ⚠️ 只做**够用**的剥离（先块注释、再行注释），不写解析器：目标是堵死把 needle 藏进注释
 *    这一条路，不是处理所有语法。 */
const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§见证：八条能力**逐条**指得到外壳的一行", () => {
  it("表是**全的**：每条能力都有见证，且没有表外的条目", () => {
    expect(Object.keys(WITNESS).sort()).toEqual([...CAPABILITIES].sort());
  });

  it.each(CAPABILITIES)("`%s` 的行为串还在它指的那个文件里（**剥掉注释之后**）", (cap) => {
    const w = WITNESS[cap];
    expect(w, `能力 \`${cap}\` 没有见证`).toBeDefined();
    const live = stripComments(read(w.file));
    expect(live, `${w.file} 的**活代码**里找不到 \`${w.needle}\` —— 被删了，还是被挪进注释了？`).toContain(w.needle);
  });

  it("`needle` 是**行为串**不是注释措辞 —— 改一次注释就能满足判据的话，这句「实现了」是空的", () => {
    for (const cap of CAPABILITIES) {
      const w = WITNESS[cap];
      const src = read(w.file);
      // 原文里在、剥注释后不在 ⇒ 它只是一句**关于**实现的措辞。
      if (src.includes(w.needle) && !stripComments(src).includes(w.needle))
        throw new Error(`\`${cap}\` 的 needle \`${w.needle}\` 只在注释里`);
    }
  });
});

describe("§反向：见证的**文件名**是真的", () => {
  it("指到的文件都读得出来（改名 / 搬走 ⇒ 红）", () => {
    for (const cap of CAPABILITIES) expect(() => read(WITNESS[cap].file), `${cap} 的见证文件读不出来`).not.toThrow();
  });
});
