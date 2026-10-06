// `compileRuntime` 的判据。⚠️ 它**取代**了 `compileGame`，而两条行为**与旧那道相反**（票 14）：
//   ① 调用走 **R16 的工具调用**（不是 `callText` 的纯文本）；
//   ② **业务校验不过 ⇒ 抛、且不落盘**（旧那道是「照常落盘 + 报 ❌」）。
//      ⚠️ 理由见 `compileRuntime` 的文档注释：R9 把人工点收成了唯一一个、且在清单处 ⇒ config 那里没有读者了。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGameConfig, STRUCTURED_CALL_ATTEMPTS, type GameDesignSpec } from "@game-maker/contracts";
import { CommandError, compileRuntime, gameConfigExample } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
/** ⚠️ 真产物：票 40 的包 + 票 33 的配置（那份配置**本身就是**一份合法正例）。 */
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const GOOD = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/game-configs/last-train.json"), "utf8"));

/** 一份最小但合法的设计（它的实体 id 不必与包里的资源 id 相同 —— **映射是模型的事**）。 */
const DESIGN: GameDesignSpec = {
  format: "game-design/v1",
  game: { title: "末班车", genre: "platformer", camera: "side", runtimeProfile: { id: "platformer", version: "1" } },
  coreLoop: ["躲开行李", "捡齐失物", "走到信号灯"],
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
