import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGameConfig } from "@game-maker/contracts";
import { CommandError, compileGame, gameConfigExample } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
/** ⚠️ 真产物：票 40 的包 + 票 33 的配置（那份配置**本身就是**一份合法正例）。 */
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const GOOD = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/game-configs/last-train.json"), "utf8"));

const tmp = () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-compile-"));
  fs.writeFileSync(path.join(d, "requirement.md"), "做一个横版跳跃小关卡，捡三个箱子然后走到信号灯。");
  return d;
};
/** 上游的回应体是 **Anthropic 的 messages 形状**（`callText` 读 `content[].text`），不是裸 JSON。 */
const upstream = (payload: unknown): typeof fetch =>
  (async () => new Response(
    JSON.stringify({ content: [{ type: "text", text: typeof payload === "string" ? payload : JSON.stringify(payload) }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  )) as typeof fetch;
const run = (d: string, payload: unknown, over: Record<string, unknown> = {}) =>
  compileGame({
    requirementPath: path.join(d, "requirement.md"), packDir: PACK, outRoot: path.join(d, "out"),
    transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl: upstream(payload), ...over,
  });

describe("⚠️ 提示词里的示例**必须自己先过 schema**", () => {
  it("gameConfigExample 是一份合法的 game-config —— 示例错了，模型就会以「看起来没问题」的方式错", () => {
    // 票 40 抓到过三条「提示词教模型写一个会被自己拒收的形状」。这一条是同等风险的守门人。
    const r = parseGameConfig(gameConfigExample);
    expect(r.ok, r.ok ? "" : r.errors.join("；")).toBe(true);
  });

  it("示例里的 HUD 是**屏幕空间**的坐标 —— 它自己就不能示范「拿世界坐标写 HUD」", () => {
    const r = parseGameConfig(gameConfigExample);
    if (!r.ok) return;
    expect(r.value.hud.panel.at.x).toBeLessThan(480);
    expect(r.value.world.size.h).toBe(270);      // 裁决 13：关卡单屏高
  });
});

describe("编译：一次调用 → 一份落盘的配置", () => {
  it("上游给一份合法配置 → 落盘 v1，且校验全过", async () => {
    const d = tmp();
    const r = await run(d, GOOD);
    const file = path.join(d, "out", "last-train", "game-configs", "v1.json");
    expect(fs.existsSync(file)).toBe(true);
    expect(r.command).toBe("compile-game");
    expect(r.data.ok).toBe(true);
    expect(r.data.version).toBe(1);
    expect(fs.readFileSync(file, "utf8")).toBe(JSON.stringify(GOOD, null, 2) + "\n");
  });

  it("**绝不覆盖**：编两次就是 v1 与 v2", async () => {
    const d = tmp();
    await run(d, GOOD);
    const r2 = await run(d, GOOD);
    expect(r2.data.version).toBe(2);
    expect(fs.existsSync(path.join(d, "out", "last-train", "game-configs", "v1.json"))).toBe(true);
  });

  it("回报里给出**下一步命令** —— 这条链是 derive → pack → compile-game → site", async () => {
    const d = tmp();
    const r = await run(d, GOOD);
    expect(r.summary.join("\n")).toMatch(/game-maker site .*--config .*v1\.json/);
  });
});

describe("⚠️ 坏配置**照常落盘**，但要**明确标出来**（票 09 裁决 2：人过目的前提是他看得到哪儿不对）", () => {
  it("引用了包里没有的资源 → 落盘 + ❌ + 退出仍然成功（人还要改它，不能把文件藏起来）", async () => {
    const d = tmp();
    const bad = structuredClone(GOOD);
    (bad.entities as Record<string, unknown>[])[0]!.asset = "__没有这个__";
    const r = await run(d, bad);
    expect(r.data.ok).toBe(false);
    expect(fs.existsSync(path.join(d, "out", "last-train", "game-configs", "v1.json"))).toBe(true);
    expect(r.summary.join("\n")).toMatch(/包里没有资源/);
  });

  it("**模型拿世界坐标写 HUD** → 抓出来（世界宽 1440，屏幕只有 480）—— 这是它最容易犯的错", async () => {
    const d = tmp();
    const bad = structuredClone(GOOD);
    bad.hud.panel.at = { x: 1000, y: 262 };
    const r = await run(d, bad);
    expect(r.data.ok).toBe(false);
    expect(r.summary.join("\n")).toMatch(/hud\.panel.*屏幕空间/);
  });

  it("**站在地面线上写成 `地面线 − 高`** → 自洽族把它报成「落在世界之外」", async () => {
    const d = tmp();
    const bad = structuredClone(GOOD);
    (bad.entities as Record<string, unknown>[])[3]!.at = { x: 500, y: 210 };   // 盒底 170（浮空）+ 顶 210
    (bad.entities as Record<string, unknown>[])[4]!.at = { x: 800, y: 202 };
    const r = await run(d, bad);
    // ⚠️ 现在**不报**了 —— 锚点语义下 `at.y` 就是盒子的底边（票 48），210 只是「离地 40px 的台子」。
    //   这条断言钉的是**别把它误报**：那正是票 48 修掉的那个 bug。
    expect(r.summary.join("\n")).not.toMatch(/落在世界之外/);
  });
});

describe("失败的路", () => {
  it("两次都吐坏 JSON → invalid（不是把半截东西落盘）", async () => {
    const d = tmp();
    const e = await run(d, "这不是 JSON").catch((x: unknown) => x);
    expect(e).toBeInstanceOf(CommandError);
    expect((e as CommandError).kind).toBe("invalid");
    expect(fs.existsSync(path.join(d, "out"))).toBe(false);
  });

  it("没有文本上游 → upstream（配置是文件，人可以直接写一份）", async () => {
    const d = tmp();
    const e = await compileGame({
      requirementPath: path.join(d, "requirement.md"), packDir: PACK, outRoot: path.join(d, "out"),
    }).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("upstream");
  });

  it("不是一个资源包 → usage", async () => {
    const d = tmp();
    const e = await run(d, GOOD, { packDir: d }).catch((x: unknown) => x);
    expect((e as CommandError).kind).toBe("usage");
  });
});
