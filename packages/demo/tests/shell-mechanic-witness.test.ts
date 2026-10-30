// 票 12 的**运行时见证判据** —— 「机制词表的每一条 `supported` 都得**指得到外壳的一行**」。
//
//   与 `shell-capability-witness.test.ts`（能力侧）同款：`supported` 是 `vocabulary.ts` 里
//   `RUNTIME_IMPLEMENTED_MECHANICS` 的**带行号转录**，而注释**不会响** —— 删掉 `scene.ts` 里
//   那行实现，那张转录照样躺在那儿说它 supported。这一条判据就是那张转录的报警器。
//
//   ⚠️ **`moving-platform` 是 `null`** —— 那是**有意的**，不是忘了填：`Motion` 在 config 里
//     正交于 `kind`，但渲染器只在 `case "hazard"` 读 `motion`，带 motion 的 solid 从不移动。
//     它在 `RUNTIME_IMPLEMENTED_MECHANICS` 里**缺席**，所以推导出来是 `experimental`。
//     这里的 `null` 就是那个缺席的**表态**（与 `vocabulary.test.ts` 的 `ENTITY_KIND_FATE`
//     里 `decor: null` 同款：`null` 是表态，不是遗漏）。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MECHANICS, RUNTIME_IMPLEMENTED_MECHANICS, deriveMechanicStatus, type Mechanic } from "@game-maker/contracts";

const read = (rel: string): string => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), "utf8");

type Witness = { file: string; needle: string };

/** ⚠️ 这张表**是穷尽的**（`Record<Mechanic, Witness | null>`）：词表加一条机制而这里没给交代 ⇒
 *  **当场编译不过**。`null` = 声明了但**没有运行时实现**（⇒ `experimental`）。 */
const WITNESS: Record<Mechanic, Witness | null> = {
  "run":              { file: "../src/shell/scene.ts", needle: "setVelocityX(left ? -m.speed" },
  "jump":             { file: "../src/shell/scene.ts", needle: "setVelocityY(-m.jumpVelocity)" },
  "gravity":          { file: "../src/shell/scene.ts", needle: "setGravityY(world.player.move.gravity)" },
  "collide-terrain":  { file: "../src/shell/scene.ts", needle: "collider(s, this.solids)" },
  "collect-pickup":   { file: "../src/shell/scene.ts", needle: "this.collect(sprite)" },
  "moving-platform":  null, // ⚠️ `Motion` 有、渲染器没有 —— 带 motion 的 solid 从不移动。
  "hazard-contact":   { file: "../src/shell/scene.ts", needle: "this.hitHazard()" },
  "reach-goal":       { file: "../src/shell/scene.ts", needle: "this.tryWin()" },
  "open-chest":       { file: "../src/shell/scene.ts", needle: "this.openChest(c)" },
  "avoid-danger":     { file: "../src/shell/scene.ts", needle: "dangerState(d.periodMs, d.activeMs, d.t)" }
};

/** 剥掉注释之后的源码（与 `shell-capability-witness.test.ts` 同一套：堵死「把 needle 藏进注释」）。 */
const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("§见证：机制词表的 `supported` 逐条指得到外壳的一行", () => {
  it("表是**全的**：每条机制都有交代（supported 给 needle、experimental 给 null），且没有表外条目", () => {
    expect(Object.keys(WITNESS).sort()).toEqual([...MECHANICS].sort());
  });

  it("`null` 与 `RUNTIME_IMPLEMENTED_MECHANICS` **同源**：转录里说 supported 的，这里必有 needle；反之是 null", () => {
    for (const m of MECHANICS) {
      expect(WITNESS[m] !== null, `机制 \`${m}\` 的 needle 与 RUNTIME_IMPLEMENTED_MECHANICS 不一致`).toBe(
        RUNTIME_IMPLEMENTED_MECHANICS.includes(m)
      );
    }
  });

  it.each([...RUNTIME_IMPLEMENTED_MECHANICS])("`%s` 的行为串还在它指的那个文件里（**剥掉注释之后**）", (m) => {
    const w = WITNESS[m];
    expect(w, `机制 \`${m}\` 被标成 supported 却没有运行时 needle`).not.toBeNull();
    if (!w) return;
    const live = stripComments(read(w.file));
    expect(live, `${w.file} 的**活代码**里找不到 \`${w.needle}\` —— 被删了，还是被挪进注释了？`).toContain(w.needle);
  });

  it("`needle` 是**行为串**不是注释措辞 —— 改一次注释就能满足判据的话，这句「实现了」是空的", () => {
    for (const m of RUNTIME_IMPLEMENTED_MECHANICS) {
      const w = WITNESS[m]!;
      const src = read(w.file);
      if (src.includes(w.needle) && !stripComments(src).includes(w.needle))
        throw new Error(`\`${m}\` 的 needle \`${w.needle}\` 只在注释里`);
    }
  });

  it("hazard 命中计数在 overlap 分支递增，READ_STATE 暴露 hits（P0-02 v2 票 03）", () => {
    const scene = stripComments(read("../src/shell/scene.ts"));
    expect(scene).toContain("hazard.hits += 1");
    const harness = stripComments(read("../probe/probe-harness.mjs"));
    expect(harness).toContain("hits: h.hits ?? 0");
  });

  it("`moving-platform` 推导为 `experimental`（它是**唯一**声明了却没有运行时实现的那条）", () => {
    expect(deriveMechanicStatus("moving-platform")).toBe("experimental");
    expect(RUNTIME_IMPLEMENTED_MECHANICS).not.toContain("moving-platform");
  });
});

describe("§反向：见证的**文件名**是真的", () => {
  it("指到的文件都读得出来（改名 / 搬走 ⇒ 红）", () => {
    for (const m of MECHANICS) {
      const w = WITNESS[m];
      if (w) expect(() => read(w.file), `${m} 的见证文件读不出来`).not.toThrow();
    }
  });
});
