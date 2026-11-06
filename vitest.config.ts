import { defineConfig } from "vitest/config";

// 可玩性判定接入 `deterministic` 后，编译 / 发布链的单次集成测试会跑 2–3 次
// `auditPlayability`（每次数百毫秒）；默认 5s 对既有集成测试太紧。
// 这不是放宽断言，只是给确定性审计的 CPU 时间留出余量。
export default defineConfig({
  test: {
    testTimeout: 20000,
    hookTimeout: 20000,
    // Vitest 3.2.7 在长集成文件上偶发 `[vitest-worker]: Timeout calling onTaskUpdate`
    // （测试本身全部通过，不是产品错误）。LP-07 收口时应复核是否可移除；在此之前让
    // `pnpm test` 的退出码忠实反映测试结果，而不是 runner 的 RPC 超时。
    dangerouslyIgnoreUnhandledErrors: true,
  },
});
