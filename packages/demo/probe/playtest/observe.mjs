// 观测适配层（票 03）：把 `READ_STATE` 的快照差转成**结构化证据**。
//
// ⚠️ v1 零会话内打点：11 类事件全部由状态差推导；`runtime-error` 用 harness 实际捕获的
//   console/exceptions，`source:"cdp"`，**不伪装成 poll**。
// ⚠️ 事件名 `spawn` / `jump` / `land` 是**状态差推断**，载荷里带 `inferred:true`，不是直接观察。
// ⚠️ 同一轮询窗口内多次变化：计数仍然可判（delta），但顺序/时序不可判 —— 载荷 `ambiguous:true`。

export function snapshotOf(st) {
  if (!st) return null;
  return {
    x: st.x, y: st.y, bottom: st.bottom, left: st.left, right: st.right, vx: st.vx, vy: st.vy,
    onFloor: st.onFloor, blockedRight: st.blockedRight, touchingRight: st.touchingRight,
    collected: st.collected, won: st.won,
    pickups: (st.pickups || []).map((p) => ({ x: p.x, y: p.y, active: p.active })),
    hazards: (st.hazards || []).map((h) => ({ x: h.x, y: h.y })),
    chests: (st.chests || []).map((c) => ({ x: c.x, y: c.y, opened: c.opened })),
    dangers: (st.dangers || []).map((d) => ({ x: d.x, y: d.y, state: d.state, hits: d.hits })),
    gate: st.gate,
    scrollX: st.scrollX,
  };
}

const ALL_EVENT_TYPES = [
  "scene-ready", "spawn", "pickup", "win", "chest-open", "danger-hit", "danger-erupt",
  "land", "jump", "reset", "runtime-error",
];

function compare(op, observed, expected) {
  if (op === "eq") return observed === expected;
  if (op === "gte") return typeof observed === "number" && observed >= expected;
  if (op === "lte") return typeof observed === "number" && observed <= expected;
  return false;
}

function unknownEvidence(ruleId, missingObservation, id, explanation) {
  return {
    ruleId,
    missingObservation,
    affectedAssertionIds: [id],
    explanation,
  };
}

export function createObserver({ scenario, spawn }) {
  const events = [];
  const history = [];
  const gaps = [];
  let seq = 0;
  let prev = null;
  let first = null;
  let last = null;
  let sceneReady = false;
  let spawnEmitted = false;
  let maxCollected = 0;
  let maxHits = 0;
  let maxChests = 0;
  let sawWon = false;
  let gateReached = false;
  let steps = 0;
  let lastErrors = { console: 0, exceptions: 0 };

  function push(t, type, actor, params, source = "poll") {
    events.push({ v: 1, seq: seq++, t, frame: null, type, actor, params, source });
  }

  function markGap(t, reason) {
    gaps.push({ t, reason });
    history.push({ t, state: null, gap: true, reason });
  }

  function record(st, t, errors = { console: [], exceptions: [] }) {
    steps += 1;
    if (!st) { markGap(t, "state-unreadable"); return; }
    history.push({ t, ...snapshotOf(st) });

    if (!sceneReady) {
      sceneReady = true;
      push(t, "scene-ready", null, { x: st.x, y: st.y, onFloor: st.onFloor });
    }
    if (!spawnEmitted) {
      spawnEmitted = true;
      push(t, "spawn", null, { inferred: true, x: st.x, y: st.y, onFloor: st.onFloor });
    }
    if (!first) first = st;

    if (prev) {
      const pickupIdx = [];
      const n = Math.min(prev.pickups.length, st.pickups.length);
      for (let i = 0; i < n; i++)
        if (prev.pickups[i].active && !st.pickups[i].active) pickupIdx.push(i);
      if (pickupIdx.length > 0)
        push(t, "pickup", `pickup[${pickupIdx[0]}]`, {
          count: pickupIdx.length, indexes: pickupIdx, collected: st.collected,
          ambiguous: pickupIdx.length > 1,
        });

      const cn = Math.min(prev.chests.length, st.chests.length);
      for (let i = 0; i < cn; i++)
        if (!prev.chests[i].opened && st.chests[i].opened)
          push(t, "chest-open", `chest[${i}]`, { collected: st.collected });

      if (!prev.won && st.won) push(t, "win", null, { collected: st.collected });

      const dn = Math.min(prev.dangers.length, st.dangers.length);
      for (let i = 0; i < dn; i++) {
        const a = prev.dangers[i], b = st.dangers[i];
        if (b.hits > a.hits) push(t, "danger-hit", `danger[${i}]`, { count: b.hits - a.hits, hits: b.hits });
        if (a.state !== "active" && b.state === "active") push(t, "danger-erupt", `danger[${i}]`, { state: b.state });
      }

      if (!prev.onFloor && st.onFloor) push(t, "land", null, { inferred: true });
      if (prev.onFloor && !st.onFloor) push(t, "jump", null, { inferred: true });

      if (st.x < prev.x - 150 && Math.abs(st.x - spawn.x) < 15 && prev.x > spawn.x + 100)
        push(t, "reset", null, { fromX: prev.x, toX: st.x });
    }

    const c = errors.console?.length ?? 0;
    const e = errors.exceptions?.length ?? 0;
    for (let i = lastErrors.console; i < c; i++)
      push(t, "runtime-error", null, { kind: "console", text: errors.console[i]?.text ?? "" }, "cdp");
    for (let i = lastErrors.exceptions; i < e; i++)
      push(t, "runtime-error", null, { kind: "exception", text: errors.exceptions[i]?.text ?? "" }, "cdp");
    lastErrors = { console: c, exceptions: e };

    maxCollected = Math.max(maxCollected, st.collected ?? 0);
    maxHits = Math.max(maxHits, (st.dangers || []).reduce((n, d) => n + (d.hits || 0), 0));
    maxChests = Math.max(maxChests, (st.chests || []).filter((ch) => ch.opened).length);
    sawWon = sawWon || !!st.won;
    if (st.gate && st.x >= st.gate.x - 20) gateReached = true;

    prev = st;
    last = st;
  }

  function eventCounts() {
    const counts = Object.fromEntries(ALL_EVENT_TYPES.map((t) => [t, 0]));
    for (const ev of events) {
      if (ev.type === "pickup" || ev.type === "chest-open" || ev.type === "danger-hit" || ev.type === "danger-erupt")
        counts[ev.type] += typeof ev.params.count === "number" ? ev.params.count : 1;
      else counts[ev.type] += 1;
    }
    return counts;
  }

  function valueOf(path) {
    if (path === "initialActivePickups") return first ? first.pickups.filter((p) => p.active).length : 0;
    if (path === "activePickups") return last ? last.pickups.filter((p) => p.active).length : 0;
    if (path === "collected") return maxCollected;
    if (path === "won") return sawWon;
    if (path === "hits") return maxHits;
    if (path === "chestsOpened") return maxChests;
    return undefined;
  }

  function judgeableNegative(matcher) {
    // 「没看到」不等于「没发生」：只有窗口是诊断性截止期、且否定条件可判时才 fail。
    if (matcher.kind === "state" && matcher.path === "won") return gateReached;
    if (matcher.kind === "state" && matcher.path === "collected")
      return gateReached && valueOf("activePickups") === 0;
    if (matcher.kind === "event" && matcher.type === "win") return gateReached;
    if (matcher.kind === "event" && matcher.type === "pickup")
      return gateReached && valueOf("activePickups") === 0;
    return true;
  }

  function assertionResults() {
    const counts = eventCounts();
    return scenario.assertions.map((a) => {
      const m = a.expect;
      const observed = m.kind === "event" ? (counts[m.type] ?? 0) : valueOf(m.path);
      const pass = compare(m.op, observed, m.value);
      const base = { id: a.id, kind: a.kind, requires: a.requires, observed, expect: a.expect, withinMs: a.withinMs };
      if (pass) {
        // 事件计数的 pass 在轮询有洞时不一定充分（洞可能漏事件）；gte 是单调下界，仍可判。
        if (m.kind === "event" && gaps.length > 0 && m.op !== "gte")
          return {
            ...base, result: "unknown",
            insufficientEvidence: unknownEvidence("poll-gap", `连续轮询（${gaps.length} 个间隙）`, a.id,
              "轮询存在间隙，事件计数可能漏采；不能把已观察到的计数当作完整证据"),
            evidence: ["playtest-events", "playtest-trace"],
          };
        return { ...base, result: "pass", evidence: [] };
      }
      if (gaps.length > 0)
        return {
          ...base, result: "unknown",
          insufficientEvidence: unknownEvidence("poll-gap", `连续轮询（${gaps.length} 个间隙）`, a.id,
            "轮询存在间隙，无法判断否定条件是否在窗口内成立"),
          evidence: ["playtest-events", "playtest-trace"],
        };
      if (!judgeableNegative(m))
        return {
          ...base, result: "unknown",
          insufficientEvidence: unknownEvidence("negative-not-judgeable", "否定条件在窗口内不可判", a.id,
            "没有到达可作出否定结论的位置/状态（例如未到 gate 或仍有未拾取物），不能把没观察到当作失败"),
          evidence: ["playtest-events", "playtest-trace"],
        };
      return { ...base, result: "fail", evidence: ["playtest-events", "playtest-trace"] };
    });
  }

  function terminationReached(termination) {
    if (!last || termination.kind === "never") return false;
    if (termination.kind === "won") return sawWon;
    if (termination.kind === "collected") return maxCollected >= termination.value;
    return false;
  }

  function endState() {
    const st = last;
    return {
      collected: st?.collected ?? 0,
      won: !!st?.won,
      hits: (st?.dangers || []).reduce((n, d) => n + (d.hits || 0), 0),
      chestsOpened: (st?.chests || []).filter((c) => c.opened).length,
      activePickups: (st?.pickups || []).filter((p) => p.active).length,
      playerX: st ? st.x : null,
    };
  }

  function initialState() {
    const st = first;
    return {
      collected: st?.collected ?? 0,
      won: !!st?.won,
      hits: (st?.dangers || []).reduce((n, d) => n + (d.hits || 0), 0),
      chestsOpened: (st?.chests || []).filter((c) => c.opened).length,
      activePickups: (st?.pickups || []).filter((p) => p.active).length,
      playerX: st ? st.x : null,
    };
  }

  return {
    events, history, gaps,
    get steps() { return steps; },
    get maxCollected() { return maxCollected; },
    get sawWon() { return sawWon; },
    get gateReached() { return gateReached; },
    record, markGap, eventCounts, assertionResults, terminationReached, endState, initialState, valueOf,
  };
}
