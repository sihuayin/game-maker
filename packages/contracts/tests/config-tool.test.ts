// 票 14 立的第二份 **v4 镜像**（`config-tool.ts`）与它镜像的 **v3 契约**（`game-config.ts`）之间的漂移测试。
//
// ⚠️ 判据比对的是**行为**（票 02 立镜像、票 12 抄了一遍的同款判据）：
//   同一份输入，两份**要么都过、要么都拒**；唯一的例外是**明示例外**那一组。
//   ⚠️ 最后一条断言是它存在的**全部理由**：`toolInputSchema` 转得动它。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parseGameConfig, toolInputSchema, type GameConfig } from "../src/index.js";
import { ConfigToolSchema } from "../src/config-tool.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const CONFIG: GameConfig = JSON.parse(readFileSync(ROOT + "fixtures/game-configs/last-train.json", "utf8"));
const clone = (): GameConfig => structuredClone(CONFIG);

const v3 = (input: unknown) => parseGameConfig(input).ok;
const v4 = (input: unknown) => ConfigToolSchema.safeParse(input).success;
const agree = (input: unknown) => v3(input) === v4(input);

describe("§镜像与契约**行为一致**（漂移测试）", () => {
  it("那份真 fixture：两份都过", () => {
    expect(v3(CONFIG)).toBe(true);
    expect(v4(CONFIG)).toBe(true);
    expect(agree(CONFIG)).toBe(true);
  });

  it("⚠️ **封口逐层一致**：顶层 / world / scene / player / anims / hud / 实体 各多一个键，两份都拒", () => {
    const paths: [string, (c: Record<string, unknown>) => void][] = [
      ["顶层", (c) => { c["备注"] = "多一个键"; }],
      ["world", (c) => { (c["world"] as Record<string, unknown>)["多余"] = 1; }],
      ["scene", (c) => { (c["scene"] as Record<string, unknown>)["多余"] = 1; }],
      ["player", (c) => { (c["player"] as Record<string, unknown>)["多余"] = 1; }],
      ["player.anims", (c) => { ((c["player"] as Record<string, unknown>)["anims"] as Record<string, unknown>)["walk"] = "w"; }],
      ["hud", (c) => { (c["hud"] as Record<string, unknown>)["多余"] = 1; }],
      ["entities[0]", (c) => { ((c["entities"] as Record<string, unknown>[])[0]! as Record<string, unknown>)["多余"] = 1; }],
      ["objective", (c) => { (c["objective"] as Record<string, unknown>)["多余"] = 1; }]
    ];
    for (const [why, mut] of paths) {
      const c = clone() as unknown as Record<string, unknown>;
      mut(c);
      expect(v3(c), `${why}：契约该拒`).toBe(false);
      expect(v4(c), `${why}：镜像该拒`).toBe(false);
    }
  });

  it("⚠️ **整数性一致**：坐标写小数 / 负数，两份都拒", () => {
    for (const bad of [10.5, -1]) {
      const c = clone();
      (c.player as { at: { x: number } }).at.x = bad;
      expect(v3(c), `x=${bad} 契约该拒`).toBe(false);
      expect(v4(c), `x=${bad} 镜像该拒`).toBe(false);
    }
  });

  it("⚠️ **速度不是整数**（「坐标一律整数」管的是位置与尺寸）—— 两份都放行 `move`", () => {
    const c = clone();
    (c.player as { move?: unknown }).move = { speed: 90.5, jumpVelocity: 330.25, gravity: 900 };
    expect(v3(c)).toBe(true);
    expect(v4(c)).toBe(true);
  });

  it("可选性与默认值一致（`anim` / `body` / `motion` / `move` 省略时两份都过）", () => {
    const c = clone() as unknown as { player: { move?: unknown }; entities: Record<string, unknown>[] };
    delete c.player.move;
    for (const e of c.entities) { delete e["anim"]; delete e["body"]; delete e["motion"]; }
    expect(agree(c)).toBe(true);
    expect(v3(c)).toBe(true);
  });

  it("两份对**垃圾输入**的口径一致（`null` / 数字 / 字符串 / 数组 / 空对象）", () => {
    for (const junk of [null, 1, "x", [], {}, { format: "game-config/v1" }]) expect(agree(junk)).toBe(true);
  });
});

describe("⚠️ **明示例外**：只被 v3 的 refine 拒的输入，镜像放行", () => {
  // 今天只有一条：**实体 id 不得重复**（`GameConfigSchema` 的顶层 `superRefine`）。
  // ⚠️ 它**不是**漂移，是分工：镜像管线形状，契约判成立与否 —— 而 `toJSONSchema` 反正会把
  //   那几条 refine 静默丢掉（票 08 实测），所以模型看见的两份是一样的。
  it("实体 id 重复 ⇒ 契约拒、镜像放行", () => {
    const c = clone();
    (c.entities as unknown[]).push(structuredClone(c.entities[0]));
    expect(v3(c)).toBe(false);
    expect(v4(c)).toBe(true);
  });

  it("⚠️ 而**两族业务判据**（`auditGameConfig` / `auditScreenSpace`）本来就不在 schema 里 —— 谁都不管它们", () => {
    // 一份**过 schema**、却引用解不到的配置：两份都放行。那正是「校验分三层」的意思
    // （线形状 / 契约 / 业务判据），业务那一层的落点是 `compile-runtime` 的装配后校验。
    const c = clone();
    (c.scene.background as { asset: string }).asset = "根本没有这个资源";
    expect(v3(c)).toBe(true);
    expect(v4(c)).toBe(true);
  });
});

describe("§镜像存在的**全部理由**：`toolInputSchema` 转得动它", () => {
  it("⚠️ 顶层 8 键、封口、无 `$ref`", () => {
    const json = toolInputSchema(ConfigToolSchema);
    expect(Object.keys(json.properties as object)).toHaveLength(8);
    expect(json.additionalProperties).toBe(false);
    expect(JSON.stringify(json)).not.toContain("$ref");
  });

  it("⚠️ 而**v3 那份转不动** —— 这就是镜像存在的理由", () => {
    expect(() => toolInputSchema(GameConfigSchemaForTest as never)).toThrowError(/zod\/v4/);
  });
});

/** 只为了那条「v3 转不动」的断言。 */
const GameConfigSchemaForTest = (await import("../src/game-config.js")).GameConfigSchema;
