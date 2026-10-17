// 票 105 / 106 的**见证判据** —— `shell/scene.ts` 第 7 行 `import Phaser from "phaser"`，
// 在 node 的 vitest 里 import 不了。与 `shell-capability-witness.test.ts` 同一条纪律：
// **剥掉注释之后读活代码**（注释里写着「要做」而实现删了，必须红）。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(fileURLToPath(new URL("../src/shell/scene.ts", import.meta.url)), "utf8");
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
const LIVE = stripComments(SRC);

/** 截一段活代码；两端必须是真实存在的锚点（否则判据自己会悄悄变成空串）。 */
const between = (from: string, to: string): string => {
  const i = LIVE.indexOf(from);
  const j = LIVE.indexOf(to);
  expect(i, `找不到起点 ${from}`).toBeGreaterThan(-1);
  expect(j, `找不到终点 ${to}`).toBeGreaterThan(-1);
  return LIVE.slice(i, j);
};

describe("票 105：实体交互必须绑在真玩家上", () => {
  it("create() 里玩家先于实体创建 —— overlap 在注册那一刻取 playerOrStub()", () => {
    const create = between("create(): void {", "update(_time");
    const player = create.indexOf("this.addPlayer()");
    const entities = create.indexOf("for (const e of world.entities) this.addEntity(e)");
    expect(player, "create() 里没有 addPlayer()").toBeGreaterThan(-1);
    expect(entities, "create() 里没有实体循环").toBeGreaterThan(-1);
    expect(player, "addPlayer() 必须在实体循环之前：否则 overlap 全绑在 1×1 替身上（票 105）")
      .toBeLessThan(entities);
  });
});

describe("票 106：会动的危险物按锚点落位，不做盒心往返", () => {
  it("advanceHazards 用纯函数返回的锚点，并把静态体同步到精灵", () => {
    const body = between("private advanceHazards(", "private collect(");
    expect(body).toContain("hazardAnchor(");
    expect(body).toContain("updateFromGameObject()");
    expect(body, "`b.center` 往返会把锚点偏移每帧累加一次（票 106）").not.toContain(".center");
    expect(body).not.toContain("b.reset(");
  });
});
