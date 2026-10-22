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

describe("票 07：胜利只绑 gate；危险物重置同步物理体", () => {
  it("goal 只在 `wins` 标记的实体上注册 tryWin —— 其他 goal 只是画出来的", () => {
    const goal = between('case "goal": {', 'case "decor":');
    expect(goal, "goal 分支没有读世界层的 wins 裁决").toContain("e.wins");
    expect(goal).toContain("tryWin()");
    expect(goal.indexOf("e.wins"), "tryWin 注册必须在 wins 守卫之后").toBeLessThan(goal.indexOf("tryWin()"));
  });

  it("hitHazard 用 body.reset 同步物理体与 prev，并按 floorY 校正脚线", () => {
    const hit = between("private hitHazard(", "private tryWin(");
    expect(hit, "必须同步物理体（票 06：只动 GameObject 会叠加上一物理步的位移）").toContain(".reset(");
    expect(hit, "重置后要用纯层算出的 floorY 校正脚线").toContain("floorY");
    expect(hit, "`setPosition` 只动 GameObject，body 仍在旧位").not.toContain("setPosition");
    expect(hit, "`setVelocity(0,0)` 不是修复项：reset 已经 stop()").not.toContain("setVelocity");
  });
});
