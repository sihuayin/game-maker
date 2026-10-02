// 票 05 给 `RuntimeProfile` 立的判据。
//
//   最要看的三条：
//     §全集自白 —— 两个数组**今天**恰好等于词表全集。这不是把关，是**给第二个成员留的位**；
//       这一条在某天变红时，是**对的**：那说明词表长了或 profile 瘦了，得有人做一次决定。
//     §身份是单射 —— `<id>/<version>` 要能被拼出来，就得保证两段都不含分隔符。
//     §引用解析得动 —— `GameDesignSpec.game.runtimeProfile` 那种引用必须能被解析成真 profile；
//       解析不动，票 14 的「拒绝时说不出是哪一代」就是空话。
//
//   ⚠️ 这里**不**验「词表对不对得上外壳」—— 那两条判据住在两个地方：
//     `vocabulary.test.ts`（机制侧：`EntityKind → MECHANICS`）与
//     `packages/demo/tests/shell-capability-witness.test.ts`（能力侧：逐条指到外壳的一行）。
import { describe, expect, it } from "vitest";
import {
  CAPABILITIES, MECHANICS, PLATFORMER_V1, RUNTIME_PROFILES,
  RuntimeProfileSchema, resolveRuntimeProfile, runtimeProfileRef,
} from "../src/index.js";
import { GAME_DESIGN_FORMAT, GameDesignSpecSchema } from "../src/game-design.js";

describe("§形状：**只有四个字段**，且是封口的", () => {
  it("`id` / `version` / `mechanics` / `capabilities` —— 全都在", () => {
    const shape = RuntimeProfileSchema.shape as Record<string, unknown>;
    expect(Object.keys(shape).sort()).toEqual(["capabilities", "id", "mechanics", "version"]);
  });

  it("砍掉的那六个**进不来**（不是「靠自觉不写」）（票 05 Q4 / Q7）", () => {
    for (const dead of ["inputModel", "entityTypes", "winConditions", "loseConditions", "cameraModel", "genre"]) {
      const bad = { ...PLATFORMER_V1, [dead]: [] };
      expect(RuntimeProfileSchema.safeParse(bad).success).toBe(false);
    }
  });

  it("缺一项也解析不过", () => {
    const { capabilities, ...withoutCaps } = PLATFORMER_V1;
    expect(capabilities.length).toBeGreaterThan(0);
    expect(RuntimeProfileSchema.safeParse(withoutCaps).success).toBe(false);
  });
});

describe("§身份：`id` + `version`，显示成 `<id>/<version>`（票 05 Q8）", () => {
  it("渲染形式是**拼出来的**，且是 `platformer/v1`", () => {
    // ⚠️ `v` 是显示前缀，`version` 里存的是裸号 —— 这两条一起锁住 Q8 冻结的那两半。
    //   要正名成 `platformer/1`，得改文档与**重开 R4**（见 `runtimeProfileRef` 的注释）。
    expect(runtimeProfileRef(PLATFORMER_V1)).toBe("platformer/v1");
  });

  it("`version` 是 `\"1\"` 不是 `\"v1\"` —— 那份拼法不许回来", () => {
    expect(PLATFORMER_V1.version).toBe("1");
  });

  it("两段都**不许含 `/`** —— 否则渲染形式不是单射，拼回去就散架", () => {
    expect(RuntimeProfileSchema.safeParse({ ...PLATFORMER_V1, id: "plat/form" }).success).toBe(false);
    expect(RuntimeProfileSchema.safeParse({ ...PLATFORMER_V1, version: "1/beta" }).success).toBe(false);
    // 行为验证：空串也不行（`/1` 与 `1/` 都不是身份）。
    expect(RuntimeProfileSchema.safeParse({ ...PLATFORMER_V1, id: "" }).success).toBe(false);
  });

  it("**不加** `format` 判别式 —— 它不落盘，`id`+`version` 本身就是身份（Q5 / Q8）", () => {
    expect(RuntimeProfileSchema.safeParse({ ...PLATFORMER_V1, format: "runtime-profile/v1" }).success).toBe(false);
  });
});

describe("§注册表与解析（R4 的「成族」· 票 05 Q9）", () => {
  it("`platformer/v1` 是**唯一**的成员，且注册表里没有重复身份", () => {
    expect(RUNTIME_PROFILES).toContain(PLATFORMER_V1);
    const refs = RUNTIME_PROFILES.map(runtimeProfileRef);
    expect(new Set(refs).size).toBe(refs.length);
  });

  it("每一个成员都能被自己的身份解析回来", () => {
    for (const p of RUNTIME_PROFILES) expect(resolveRuntimeProfile(p)).toBe(p);
  });

  it("**解析不动就是拒绝的素材** —— 版本对不上、名字对不上都返回 `undefined`（票 03 Q5）", () => {
    expect(resolveRuntimeProfile({ id: "platformer", version: "1" })).toBe(PLATFORMER_V1);
    expect(resolveRuntimeProfile({ id: "platformer", version: "2" })).toBeUndefined();
    expect(resolveRuntimeProfile({ id: "tower-defense", version: "1" })).toBeUndefined();
  });

  it("`GameDesignSpec` 里那份**引用**解析得动（设计层与运行档对得上）", () => {
    const design = {
      format: GAME_DESIGN_FORMAT,
      game: { title: "t", genre: "g", camera: "c", runtimeProfile: { id: PLATFORMER_V1.id, version: PLATFORMER_V1.version } },
      coreLoop: [], player: { id: "p", role: "r", abilities: [], goals: [] },
      enemies: [], npcs: [], interactables: [], resources: [],
      world: { theme: "", setting: "", structure: "" }, levels: [],
      progression: { model: "m", description: "d" },
      mechanics: [], winConditions: [], loseConditions: [], runtimeRequirements: []
    };
    const parsed = GameDesignSpecSchema.safeParse(design);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(resolveRuntimeProfile(parsed.data.game.runtimeProfile)).toBe(PLATFORMER_V1);
  });
});

describe("§全集自白：两个数组今天**恰好**等于词表（票 05 Q2 / Q6）", () => {
  // ⚠️ 变红不代表「坏了」—— 代表**词表长了**或**这个成员瘦了**，得有人做一次决定。
  it("`mechanics` ⟺ `MECHANICS`，`capabilities` ⟺ `CAPABILITIES`", () => {
    expect(PLATFORMER_V1.mechanics).toEqual([...MECHANICS]);
    expect(PLATFORMER_V1.capabilities).toEqual([...CAPABILITIES]);
  });

  it("**恒成立的那条是「⊆」** —— 任何成员都不许引用词表外的名字（第二个成员也受这条管）", () => {
    for (const p of RUNTIME_PROFILES) {
      for (const m of p.mechanics) expect(MECHANICS).toContain(m);
      for (const c of p.capabilities) expect(CAPABILITIES).toContain(c);
    }
  });

  it("两个数组封闭在词表上：塞 `double-jump` / `gpu:raytracing` 解析不过", () => {
    expect(RuntimeProfileSchema.safeParse({ ...PLATFORMER_V1, mechanics: [...MECHANICS, "double-jump"] }).success).toBe(false);
    expect(RuntimeProfileSchema.safeParse({ ...PLATFORMER_V1, capabilities: [...CAPABILITIES, "gpu:raytracing"] }).success).toBe(false);
  });
});
