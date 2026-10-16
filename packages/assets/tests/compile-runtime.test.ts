// `compileRuntime` 的判据。⚠️ 它**取代**了 `compileGame`，而两条行为**与旧那道相反**（票 14）：
//   ① 调用走 **R16 的工具调用**（不是 `callText` 的纯文本）；
//   ② **业务校验不过 ⇒ 抛、且不落盘**（旧那道是「照常落盘 + 报 ❌」）。
//      ⚠️ 理由见 `compileRuntime` 的文档注释：R9 把人工点收成了唯一一个、且在清单处 ⇒ config 那里没有读者了。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYER_MOVE, jumpSpan, maxJumpHeight, parseGameConfig, STRUCTURED_CALL_ATTEMPTS, type GameDesignSpec } from "@game-maker/contracts";
import { CommandError, compileRuntime, gameConfigExample } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
/** ⚠️ 真产物：票 40 的包 + 票 33 的配置（那份配置**本身就是**一份合法正例）。 */
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const GOOD = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/game-configs/last-train.json"), "utf8"));

/** 一份最小但合法的设计（它的实体 id 不必与包里的资源 id 相同 —— **映射是模型的事**）。 */
const DESIGN: GameDesignSpec = {
  format: "game-design/v1",
  game: { title: "末班车", genre: "platformer", camera: "side", runtimeProfile: { id: "platformer", version: "1" } },
  coreLoopSteps: ["躲开行李", "捡齐失物", "走到信号灯"],
  player: { id: "p-postman", role: "送信的邮差", abilities: ["跑", "跳"], goals: ["赶上末班车"] },
  enemies: [{ id: "e-dog", behavior: "沿地面来回走", threat: "碰到扣血" }],
  npcs: [], interactables: [{ id: "i-signal", type: "信号灯", behavior: "捡齐后变绿" }],
  resources: [{ id: "r-lost", purpose: "三件失物" }],
  world: { theme: "黄昏的铁路小站", setting: "月台与铁轨", structure: "三条横带：铁轨 / 月台 / 远山" },
  levels: [{ id: "l-1", purpose: "唯一一关", layout: "左侧出发，右侧信号灯", entities: ["e-dog", "r-lost", "i-signal"] }],
  progression: { model: "linear", description: "一关到底" },
  mechanics: [{ id: "m-jump", mechanic: "jump" }],
  winConditions: ["捡齐三件失物并走到信号灯"], loseConditions: [], runtimeRequirements: ["input:keyboard"]
};

const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-runtime-"));
  fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify(DESIGN));
  return d;
};
/** 上游的回应体是**工具调用那一档**（`parseToolUse` 读 `content[].input`），不是 `content[].text`。 */
const upstream = (input: unknown): typeof fetch =>
  (async () => new Response(
    JSON.stringify({
      content: [{ type: "tool_use", name: "emit_game_config", input }],
      stop_reason: "tool_use", model: "deepseek-flash", usage: { output_tokens: 1500 }
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  )) as unknown as typeof fetch;
const run = (d: string, input: unknown, over: Record<string, unknown> = {}) =>
  compileRuntime({
    designPath: path.join(d, "game-design.json"), packDir: PACK, outRoot: path.join(d, "out"),
    transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl: upstream(input), ...over,
  });
const fileOf = (d: string, v = 1) => path.join(d, "out", "last-train", "game-configs", `v${v}.json`);

describe("⚠️ 提示词里的示例**必须自己先过 schema**（旧票 40 那条守门人，原样保留）", () => {
  it("`gameConfigExample` 是一份合法的 game-config", () => {
    const r = parseGameConfig(gameConfigExample);
    expect(r.ok, r.ok ? "" : r.errors.join("；")).toBe(true);
  });

  it("示例里的 HUD 是**屏幕空间**的坐标，且关卡单屏高", () => {
    const r = parseGameConfig(gameConfigExample);
    if (!r.ok) return;
    expect(r.value.hud.panel.at.x).toBeLessThan(480);
    expect(r.value.world.size.h).toBe(270);
  });
});

describe("编译：一次调用 → 一份落盘的配置", () => {
  it("上游给一份合法配置 → 落盘 v1，校验全过，账上是 `compile-runtime`", async () => {
    const d = tmp();
    const r = await run(d, GOOD);
    expect(r.command).toBe("compile-runtime");
    expect(r.data.ok).toBe(true);
    expect(r.data.version).toBe(1);
    expect(r.data.levelId).toBe("l-1");
    expect(fs.readFileSync(fileOf(d), "utf8")).toBe(JSON.stringify(GOOD, null, 2) + "\n");
    const ledger = r.data.ledger as { step: string; target: string; attempts: number; failures?: string[] }[];
    expect(ledger[0]).toMatchObject({ step: "compile-runtime", target: "game-config", attempts: 1, model: "deepseek-flash" });
    expect(ledger[0]!.failures).toBeUndefined();
  });

  it("**绝不覆盖**：编两次就是 v1 与 v2", async () => {
    const d = tmp();
    await run(d, GOOD);
    const r2 = await run(d, GOOD);
    expect(r2.data.version).toBe(2);
    expect(fs.existsSync(fileOf(d, 1))).toBe(true);
  });

  it("回报里给出**下一步命令**", async () => {
    const d = tmp();
    const r = await run(d, GOOD);
    expect(r.summary.join("\n")).toMatch(/game-maker site .*--config .*v1\.json/);
  });
});

describe("⚠️ **业务校验不过 ⇒ 抛、且不落盘**（票 14 的 Q5 裁定：那是**确定性**失败，不是模型没生成好）", () => {
  it("引用了包里没有的资源 → `invalid`，而且**一个字节都没落**", async () => {
    const d = tmp();
    const bad = structuredClone(GOOD);
    (bad.entities as Record<string, unknown>[])[0]!.asset = "__没有这个__";
    const e = await run(d, bad).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).kind).toBe("invalid");
    expect((e as CommandError).message).toMatch(/包里没有资源/);
    // ⚠️ 这一条**与旧行为相反**：`compileGame` 当年照落（「人过目的前提是他看得到哪儿不对」），
    //   而 R9 把人工点收成了唯一一个、且在清单处 ⇒ config 那里**没有读者**了。
    expect(fs.existsSync(path.join(d, "out")), "坏配置比没配置更坏").toBe(false);
  });

  it("消息要点出「**这不是模型没生成好**」—— 两类失败必须分得开", async () => {
    const d = tmp();
    const bad = structuredClone(GOOD);
    (bad.entities as Record<string, unknown>[])[0]!.asset = "__没有这个__";
    const e = await run(d, bad).catch((x: unknown) => x);
    expect((e as CommandError).message).toMatch(/不是模型没生成好/);
  });

  it("**模型拿世界坐标写 HUD** → 抓出来（世界宽 1440，屏幕只有 480）—— 它最容易犯的错", async () => {
    const d = tmp();
    const bad = structuredClone(GOOD);
    bad.hud.panel.at = { x: 1000, y: 262 };
    const e = await run(d, bad).catch((x: unknown) => x);
    expect((e as CommandError).message).toMatch(/hud\.panel.*屏幕空间/);
  });

  it("⚠️ 而**锚点语义**下 `at.y = 地面线` 的写法**不该被误报**（票 48 修掉的那个 bug）", async () => {
    const d = tmp();
    const bad = structuredClone(GOOD);
    (bad.entities as Record<string, unknown>[])[3]!.at = { x: 500, y: 210 };
    (bad.entities as Record<string, unknown>[])[4]!.at = { x: 800, y: 202 };
    const r = await run(d, bad); // 过得了 ⇒ 它会成功落盘
    expect(r.data.ok).toBe(true);
  });
});

describe("失败的路", () => {
  it("⚠️ **结构不过才重采样**：三发都给不出过契约的配置 ⇒ `invalid`，账上三次都记着", async () => {
    const d = tmp();
    const e = await run(d, { 不是: "一份配置" }).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("invalid");
    expect(fs.existsSync(path.join(d, "out"))).toBe(false);
    const ledger = (e as CommandError).ledger as { attempts: number; failures?: string[] }[];
    expect(ledger[0]!.attempts).toBe(STRUCTURED_CALL_ATTEMPTS);
    expect(ledger[0]!.failures).toEqual(Array(STRUCTURED_CALL_ATTEMPTS).fill("schema"));
  });

  it("⚠️ 而**业务校验不过只试一次** —— 那不是重采样能救的事（账上就一趟往返）", async () => {
    const d = tmp();
    const bad = structuredClone(GOOD);
    (bad.entities as Record<string, unknown>[])[0]!.asset = "__没有这个__";
    const e = await run(d, bad).catch((x: unknown) => x);
    const ledger = (e as CommandError).ledger as { attempts: number; failures?: string[] }[];
    expect(ledger[0]!.attempts, "只发了一趟").toBe(1);
    expect(ledger[0]!.failures, "而这一趟是**成功**的（入参过完了契约）").toBeUndefined();
  });

  it("没有文本上游 → upstream", async () => {
    const d = tmp();
    const e = await compileRuntime({ designPath: path.join(d, "game-design.json"), packDir: PACK, outRoot: path.join(d, "out") })
      .catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("upstream");
  });

  it("凭据是空串（生产里真会发生的那条路）→ upstream，且说得出要哪两个环境变量", async () => {
    const d = tmp();
    const e = await run(d, GOOD, { transport: { baseUrl: "", apiKey: "" } }).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("upstream");
    expect((e as CommandError).message).toMatch(/ANTHROPIC_BASE_URL/);
    expect((e as CommandError).message).toMatch(/ANTHROPIC_AUTH_TOKEN/);
  });

  it("不是一个资源包 → usage", async () => {
    const d = tmp();
    const e = await run(d, GOOD, { packDir: d }).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("usage");
  });
});

describe("⚠️ 两层判据：**过线形状 ≠ 过契约**（票 12 立的先例，本票照抄）", () => {
  it("实体 id 重复 ⇒ 线形状放行（镜像没有 refine）、**v3 契约判死** ⇒ 算 `schema`、重采样", async () => {
    const d = tmp();
    const dup = structuredClone(GOOD);
    (dup.entities as unknown[]).push(structuredClone((dup.entities as unknown[])[0]));
    const e = await run(d, dup).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("invalid");
    const ledger = (e as CommandError).ledger as { attempts: number; failures?: string[] }[];
    expect(ledger[0]!.attempts).toBe(STRUCTURED_CALL_ATTEMPTS);
    expect(ledger[0]!.failures).toEqual(Array(STRUCTURED_CALL_ATTEMPTS).fill("schema"));
    expect(fs.existsSync(path.join(d, "out")), "一份都别落").toBe(false);
  });
});

describe("§问话面：发出去的那一发", () => {
  /** 抓住请求体，并回一份合法配置。 */
  const spy = (input: unknown = GOOD) => {
    const seen: Record<string, any>[] = [];
    const f = (async (_url: string, init: RequestInit) => {
      seen.push(JSON.parse(String(init.body)));
      return new Response(
        JSON.stringify({ content: [{ type: "tool_use", name: "emit_game_config", input }], stop_reason: "tool_use" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as unknown as typeof fetch;
    return { f, seen };
  };

  it("强制工具调用 · schema 是**本契约的 v4 镜像**（8 键、封口）· 内容只有一段文本", async () => {
    const d = tmp();
    const sp = spy();
    await run(d, GOOD, { fetchImpl: sp.f });
    const b = sp.seen[0]!;
    expect(b.tool_choice).toEqual({ type: "tool", name: "emit_game_config" });
    expect(Object.keys(b.tools[0].input_schema.properties)).toHaveLength(8);
    expect(b.tools[0].input_schema.additionalProperties).toBe(false);
    expect(b.messages[0].content).toHaveLength(1);
    expect(b.thinking).toEqual({ type: "disabled" });
    expect(b.max_tokens).toBe(16_000); // 与 08/09/10/12 同档
  });

  it("⚠️ **手感那一节把数给出去**（票 21）—— 而那些数是**从契约推的**，不是抄进提示词的字面量", async () => {
    const d = tmp();
    const sp = spy();
    await run(d, GOOD, { fetchImpl: sp.f });
    const text: string = sp.seen[0]!.messages[0].content[0].text;

    // ⚠️ 期望值**在这里现算**（从 `DEFAULT_PLAYER_MOVE`）—— 提示词里写死一个字面量
    //   （比如「60.5」）今天照样绿，但默认手感一改就**当场红**。这就是这条判据的全部牙齿：
    //   模型必须拿到**当前那一套**的数，而不是某一次抄下来的数。
    const apex = maxJumpHeight(DEFAULT_PLAYER_MOVE);
    const span = jumpSpan(DEFAULT_PLAYER_MOVE);           // ⚠️ 同高落点 —— 紧的那一半
    expect(text).toContain(apex.toFixed(1));              // 跳跃顶点
    expect(text).toContain(span.toFixed(1));              // 同高跨度
    // 三个原始参数也在（模型要能自己推「落点更低时更远」）
    for (const n of [DEFAULT_PLAYER_MOVE.speed, DEFAULT_PLAYER_MOVE.jumpVelocity, DEFAULT_PLAYER_MOVE.gravity])
      expect(text).toContain(String(n));

    // ⚠️ 而它**不许**把判据那套宽松模型（落点掉到世界底部 ⇒ 110.1px）当成给模型的数 ——
    //   那是**上界**，会响的是紧的那个（票 21：两个数不一样，教错了照样红）。
    expect(text).not.toContain(jumpSpan(DEFAULT_PLAYER_MOVE, 270).toFixed(1));

    // 老那句话（**没有数**的手势）换掉了 —— 它正是这条信息缺口的原文
    expect(text).not.toContain("台阶别高过它");
    expect(text).toContain("手感");
  });

  it("⚠️ 骨架那句「位置、尺寸、锚点是一整套」在**横版那一发**里（票 93 · 调用点见证）", async () => {
    // ⚠️ **为什么横版这一条也得有**（票 93 的 Q5 = 甲）：横版那个调用点**本票也改了**，
    //   而共用的常量只保证**字面不漂**，不保证**两处都引了它**。
    const d = tmp();
    const sp = spy();
    await run(d, GOOD, { fetchImpl: sp.f });
    const text: string = sp.seen[0]!.messages[0].content[0].text;
    expect(text).toMatch(/位置、尺寸、锚点是一整套/);
    expect(text).toMatch(/三样一起/);
    // ⚠️ 抬头里那句「逐字照抄」不许再回来（票 93 的 Q2 = 乙）
    expect(text).not.toMatch(/逐字照抄这个骨架/);
    // ⚠️ 而那条**单边算术**也不许再回来（票 73 的 Q2 = 乙：「不得只用 `x + 宽` 判断」）——
    //   它今天的样子是「HUD 写到 x > 408 就跑出屏幕了，直接拒」。
    expect(text).not.toMatch(/x > \d/);
  });

  it("⚠️ **设计层那 12 个 ① 档字段逐个具名**进提示词（票 10 的裁定：具名插值在下游 —— 本步是下游之一）", async () => {
    const d = tmp();
    const sp = spy();
    await run(d, GOOD, { fetchImpl: sp.f });
    const text: string = sp.seen[0]!.messages[0].content[0].text;
    const TWELVE = [
      "world.theme", "world.setting", "world.structure",
      "player.role", "player.abilities",
      "enemies[].behavior", "enemies[].threat",
      "npcs[].role", "npcs[].interaction",
      "interactables[].type", "interactables[].behavior",
      "levels[].purpose"
    ];
    // ⚠️ 这一份 fixture 的 npcs 是空的 ⇒ 那两条路径不会出现 ⇒ 只断言**存在的那几条**
    const present = TWELVE.filter((f) => {
      if (f.startsWith("npcs")) return DESIGN.npcs.length > 0;
      return true;
    });
    expect(present.filter((f) => !text.includes(f))).toEqual([]);
    expect(text).toContain(DESIGN.levels[0]!.layout);          // 这一关怎么走
    expect(text).toContain(DESIGN.world.structure);
    expect(text).toContain("l-1");                              // 编的是哪一关
    expect(text).toContain("platformer/v1");                    // 给哪一代编
  });

  // ── 票 85：清单上「这件是不是九宫格」那一截 ──────────────────────────────────
  //
  // ⚠️ **它补的是一个判据拿得到、模型拿不到的事实**：`auditPanelSize` 靠包里的 `scale9Borders`
  //   判「声明 = 包」合不合法，而真发出去的 body 里那个词**三个都零命中**（票 71 §1 量过）。
  //   ⇒ 那条例据在模型眼里是**事后复核**：它写的时候不知道自己指的那件是不是九宫格。
  //
  // ⚠️ **断的是「那一行里在不在」**，不是「整份提示词里一条都没有」——
  //   后者会因为**别的原因**变红，把这条判据的意思带偏（票 80 / 票 84 立的纪律）。
  const lineOf = (text: string, id: string) =>
    text.split("\n").find((l) => l.startsWith(`- \`${id}\``)) ?? "";

  it("清单里**带 `scale9Borders` 的那件标着「九宫格」**，并写明声明尺寸可不同（票 85 · 正向）", async () => {
    const d = tmp();
    const sp = spy();
    await run(d, GOOD, { fetchImpl: sp.f });
    // ⚠️ 夹具里这一件是真带九宫格的（`fixtures/packs/last-train/v2`：72×32 · `{x:4,y:4,w:64,h:24}`），
    //   而它**正是** `hud.panel.asset` 指的那一件。
    const line = lineOf(sp.seen[0]!.messages[0].content[0].text, "hud-lost-slots");
    // ⚠️ 两条一起断：**只有标记词而没有半句后果**＝模型读不出该拿它干什么 ——
    //   那正是票 08 的教训逐字：「光是标『可选』不够：模型会把『可选』读成『写上更保险』」。
    expect(line).toContain("**九宫格**");
    expect(line).toContain("声明尺寸可与包内尺寸不同");
  });

  it("清单里**没有 `scale9Borders` 的那件标着「非九宫格」**，并写明声明尺寸必须一致（票 85 · 反向）", async () => {
    const d = tmp();
    const sp = spy();
    await run(d, GOOD, { fetchImpl: sp.f });
    const line = lineOf(sp.seen[0]!.messages[0].content[0].text, "hud-pip");
    // ⚠️ 非九宫格那一侧**不许沉默**（票 71 的边界 1）：沉默会被读成「这件**没有**这个属性」，
    //   而它真正的意思是「这件**不许**改尺寸」。
    expect(line).toContain("**非九宫格**");
    expect(line).toContain("声明尺寸必须与包内尺寸一致");
    // ⚠️ 反面这一半**必须**在：一条只断「印了」的判据，在**所有** ui 都印「九宫格」的世界里照样绿，
    //   而那个世界是错的。
    // ⚠️ 找的是**加粗的那个标记词** ——「非九宫格」这五个字**本身含着「九宫格」三个字**，
    //   直接断 `not.toContain("九宫格")` 会把这行判据自己写成**永假**。
    expect(line).not.toContain("**九宫格**");
    // ⚠️ 而那一截**只印在 ui 上**（2026-10-15 人裁）：非 ui 的资产没有「声明尺寸」这个落点，
    //   半句后果印在它身上是空话 —— 顺带钉住这一点，免得有人顺手推广到全部资产。
    const sprite = lineOf(sp.seen[0]!.messages[0].content[0].text, "prop-luggage-pile");
    expect(sprite).toContain("锚点");
    expect(sprite).not.toContain("九宫格");
  });
});

describe("§哪一关 / 哪一代外壳", () => {
  it("`levelId` 省略 = 设计层的第一关；给了一个不存在的 ⇒ `usage`", async () => {
    const d = tmp();
    expect((await run(d, GOOD)).data.levelId).toBe("l-1");
    const e = await run(d, GOOD, { levelId: "l-9" }).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("usage");
    expect((e as CommandError).message).toMatch(/没有这一关/);
  });

  it("设计指着的一代不存在 ⇒ `invalid`，且消息说得出「拒绝本该在上一步」", async () => {
    const d = tmp();
    const design = { ...DESIGN, game: { ...DESIGN.game, runtimeProfile: { id: "tower-defense", version: "1" } } };
    fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify(design));
    const e = await run(d, GOOD).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("invalid");
    expect((e as CommandError).message).toMatch(/compile-design/);
  });

  it("设计本身不过契约（那条 gate）⇒ `invalid`，**一次调用都不发**", async () => {
    const d = tmp();
    fs.writeFileSync(path.join(d, "game-design.json"), JSON.stringify({ ...DESIGN, genre: "   " }));
    let called = 0;
    const spy = (async () => { called++; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch;
    const e = await run(d, GOOD, { fetchImpl: spy }).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("invalid");
    expect(called).toBe(0);
  });
});

/**
 * ⭐ 票 65：**层盖不住世界**这条判据**提前到了这里**（`config` 步）。
 *
 * ⚠️ 立案依据是第十五跑 · 段 B：那一跑 `pack` ✅ · `config` ✅ · `qa` ✅，11 张图已经买完，
 *   最后**死在站点装配期** —— 世界宽 1440，而两层不平铺的背景各剩 384 / 96px。
 *   提前判的价值是**失败点前移**（注意：**一分钱也省不下**，图早就买了）、
 *   **判据与真实渲染语义同源**、**失败账目分得开**。
 * ⚠️ 而「同源」那一条在**两侧的测试里各钉一遍同一个字面**（这里 + `demo/tests/site.test.ts`
 *   + `contracts/tests/layer-coverage.test.ts`）—— `assets` 与 `demo` 之间没有依赖边，
 *   一个测试里同时调两边做不到（`check-deps.mjs` 立的纪律）。
 */
describe("⭐ 票 65：**层盖不住世界**提前到 `config` 步（吃真实 `world.size`）", () => {
  /**
   * 立案现场那三条层的几何，落在 last-train 那件**本来就三层**的背景上
   * （与 `packages/demo/tests/site.test.ts` 的那份改造**逐项相同**）：
   * `sky` 视差 0.1 不平铺（剩 384）· `wall` 改成不平铺视差 0.4（剩 96）·
   * `ground` 保持 `tileable.x`（铺满世界 ⇒ 恒成立）。
   */
  function pack65(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-rt65-"));
    const dir = path.join(d, "pack");
    fs.cpSync(PACK, dir, { recursive: true });
    const manifest = JSON.parse(fs.readFileSync(path.join(PACK, "manifest.json"), "utf8"));
    const bg = manifest.assets.find((a: { id: string }) => a.id === "bg-dusk-halt");
    bg.layers[0].parallax = 0.1;
    bg.layers[1].parallax = 0.4;
    delete bg.layers[1].tileable;
    fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2));
    return dir;
  }
  /** ⚠️ **三个包各钉一份的同一个字符串**（见这个 describe 的头）。 */
  const SKY_MSG =
    `层 "bg-dusk-halt.sky" 盖不住世界：世界 1440×270px、视口 480×270px（镜头横向最多走 960px、纵向 0px），` +
    `它画出来 480×270px，视差 0.1 会跟着镜头退掉 96×0px，最坏时屏幕上只剩 384×270px，` +
    `而视口要 480×270px。—— **不平铺的层只有 parallax = 0 才恒成立**（票 40 算过的那条）`;

  it("阳性：**恰好两条**硬失败、不落盘、账上是 `attempts: 1` 且**不出现 `schema`**", async () => {
    const d = tmp();
    const e = await run(d, GOOD, { packDir: pack65() }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).kind).toBe("invalid");
    const m = (e as CommandError).message;
    expect(m).toMatch(/盖不住世界/);
    // `where` 逐条点出来 —— 三层里**只错两层**，可平铺那层一条都不报。
    expect([...m.matchAll(/· (scene\.background\[\d+\]):/g)].map((x) => x[1]))
      .toEqual(["scene.background[0]", "scene.background[1]"]);
    expect(m).not.toMatch(/bg-dusk-halt\.ground/);
    expect(m).toMatch(/只剩 384×270px/);
    expect(m).toMatch(/只剩 96×270px/);
    expect(fs.existsSync(path.join(d, "out")), "坏配置比没配置更坏").toBe(false);
    // ⚠️ **§4② 那张表**：几何不成立 ⇒ 那一趟**是成功的**（`attempts: 1` · 账上没有 `schema`），
    //   与「契约没过」（`failures: ["schema"]` · 可能重采样）**分得开**。
    const ledger = (e as CommandError).ledger as { attempts: number; failures?: string[] }[];
    expect(ledger[0]!.attempts, "只发了一趟 —— 几何不成立不是重采样能救的事").toBe(1);
    expect(ledger[0]!.failures ?? [], "账上**不出现 `schema`**").toEqual([]);
  });

  it("⭐ 那条 message **逐字**就是站点侧钉的那一个（同一个函数）+ 四样数一个不少", async () => {
    const d = tmp();
    const e = await run(d, GOOD, { packDir: pack65() }).catch((x: unknown) => x);
    const m = (e as CommandError).message;
    expect(m, "与 `demo/tests/site.test.ts` 里 `toBe(...)` 的是同一个字符串").toContain(SKY_MSG);
    // ⚠️ 为什么非要这四样：config 抛 ⇒ **不落那份坏配置** ⇒ 失败现场里没有 `game-config.json` 可读
    //   （第十五跑**正是靠它**读出 `world.size = 1440×270`）⇒ 世界尺寸只能从这句话里读。
    expect(m).toMatch(/世界 1440×270px/);
    expect(m).toMatch(/视口 480×270px/);
    expect(m).toMatch(/视差 0\.1/);
  });

  it("⚠️ **不误伤**（(乙) 与 (甲) 的分界）：世界不比视口宽 ⇒ 不平铺 + 非零视差**照常放行**", async () => {
    // ⚠️ 这一条钉的是「判据吃的是**真实几何**，不是『非平铺层的视差必须为 0』那条代理规则」：
    //   世界与视口同宽 ⇒ 镜头一步都不走 ⇒ 退掉的自然也是 0 ⇒ **恒成立**。
    //   ⚠️ 而 (甲) 那条更严的规则在这里**会误伤**（视差 0.1 ≠ 0 就拒）—— 这正是第二轮否掉它的理由。
    // ⚠️ 构造：真实外壳的视口恒为 480 ⇒ 要让 `travelX = 0` 只能把**世界收窄**（把这一关挤进一屏，
    //   连带把地形与实体的 x 挪进来）——**不能反过来把视口拉宽**：那会同时把「画出来 480 得盖住
    //   一屏」这个前提也改掉（`cover < viewport` 当场为真，报的还是同一条），量到的就不是这件事了。
    const d = tmp();
    const one = structuredClone(GOOD);
    one.world.size.w = 480;
    (one.terrain as Record<string, number>[])[0]!.w = 480;
    const xs = [120, 200, 280, 320, 360, 440];
    (one.entities as Record<string, unknown>[]).forEach((e, i) => { (e.at as { x: number }).x = xs[i]!; });
    const r = await run(d, one, { packDir: pack65() });
    expect(r.data.ok).toBe(true);
    expect(fs.existsSync(fileOf(d)), "过了就得照常落盘").toBe(true);
  });
});
