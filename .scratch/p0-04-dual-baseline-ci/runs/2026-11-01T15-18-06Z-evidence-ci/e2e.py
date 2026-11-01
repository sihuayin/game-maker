#!/usr/bin/env python3
import os, sys, json, hashlib, subprocess, time, glob
from pathlib import Path
from datetime import datetime, timezone

REPO = Path.cwd().resolve()
RUN = Path(sys.argv[1]).resolve()
RUN.mkdir(parents=True, exist_ok=True)
STARTED = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
COMMANDS = []

A_MAN = Path(".scratch/evidence-integrity-v1/manifest/expected-hashes.json")
A_ANCHOR = Path(".scratch/evidence-integrity-v1/manifest/expected-hashes.sha256")
B_MAN = Path(".scratch/p0-02-second-demo-v2/manifest/final-manifest.json")
B_ANCHOR = Path(".scratch/p0-02-second-demo-v2/manifest/expected-hashes.sha256")
REG = Path(".scratch/baselines/registry.json")
FREEZE = Path(".scratch/p0-02-second-demo-v2/freeze")

def sha_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()

def run(args, timeout=900):
    t0 = time.time()
    r = subprocess.run([str(a) for a in args], cwd=REPO, capture_output=True, text=True, timeout=timeout)
    rec = {"cmd": " ".join(str(a) for a in args), "exit": r.returncode, "durationMs": int((time.time()-t0)*1000),
           "stdoutTail": r.stdout[-4000:], "stderrTail": r.stderr[-4000:]}
    COMMANDS.append(rec)
    return r, rec

def evidence_paths():
    paths = [A_MAN, A_ANCHOR, B_MAN, B_ANCHOR, REG, Path(".scratch/p0-02-second-demo-v2/freeze-sha256.txt")]
    for man in (A_MAN, B_MAN):
        doc = json.loads(man.read_text(encoding="utf-8"))
        for rid, decl in doc["roots"].items():
            base = (man.parent / decl).resolve()
            for f in doc["files"]:
                if f["root"] == rid:
                    paths.append(base / f["path"])
    paths += [p for p in FREEZE.rglob("*") if p.is_file()]
    return paths

def snapshot(paths):
    out = {}
    for p in sorted({str(x) for x in paths}):
        pp = Path(p)
        if pp.exists() and pp.is_file():
            out[str(pp)] = sha_file(pp)
    return out

def main():
    before = snapshot(evidence_paths())
    results = {}

    r, c = run(["pnpm", "build"], timeout=900); results["build"] = c
    r, c = run(["node", "scripts/validate-baseline-registry.mjs", "--registry", str(REG), "--repo-root", ".", "--require-ids", "fpvs-v1,p0-02-second-demo-v2", "--exact-ids"]); results["registry"] = c
    r, c = run(["node", "scripts/check-baseline-updates.mjs", "--registry", str(REG), "--repo-root", "."]); results["updateLogs"] = c
    r, c = run(["node", "scripts/verify-freeze-snapshot.mjs", "--registry", str(REG), "--baseline-id", "p0-02-second-demo-v2", "--repo-root", ".", "--head-root", ".", "--out", str(RUN / "evidence-b/freeze-verification.json")]); results["freeze"] = c
    a_digest = A_ANCHOR.read_text(encoding="utf-8").strip()
    b_digest = B_ANCHOR.read_text(encoding="utf-8").strip()
    r, c = run(["node", "scripts/evidence-acceptance.mjs", "--manifest", str(A_MAN), "--expected-manifest-sha", a_digest, "--base-manifest", str(A_MAN), "--baseline-id", "fpvs-v1", "--out", str(RUN / "evidence-a")]); results["verifyA"] = c
    r, c = run(["node", "scripts/evidence-acceptance.mjs", "--manifest", str(B_MAN), "--expected-manifest-sha", b_digest, "--base-manifest", str(B_MAN), "--anchor-mode", "digest+base", "--baseline-id", "p0-02-second-demo-v2", "--out", str(RUN / "evidence-b")]); results["verifyB"] = c

    a_summaries = sorted(glob.glob(str(RUN / "evidence-a/*-test-evidence/summary.json")))
    a_reports = sorted(glob.glob(str(RUN / "evidence-a/*-delivery-verification/report.json")))
    b_summaries = sorted(glob.glob(str(RUN / "evidence-b/*-test-evidence/summary.json")))
    b_reports = sorted(glob.glob(str(RUN / "evidence-b/*-delivery-verification/report.json")))
    paths = {
        "aSummary": a_summaries[-1] if a_summaries else "",
        "aReport": a_reports[-1] if a_reports else "",
        "bSummary": b_summaries[-1] if b_summaries else "",
        "bReport": b_reports[-1] if b_reports else "",
        "bFreeze": str(RUN / "evidence-b/freeze-verification.json"),
    }
    r, c = run(["node", "scripts/dual-baseline-aggregate.mjs", "--registry", str(REG), "--repo-root", ".",
                "--a-outcome", "success" if results["verifyA"]["exit"] == 0 else "failure",
                "--b-outcome", "success" if results["verifyB"]["exit"] == 0 else "failure",
                "--b-freeze-outcome", "success" if results["freeze"]["exit"] == 0 else "failure",
                "--a-summary", paths["aSummary"], "--b-summary", paths["bSummary"],
                "--a-report", paths["aReport"], "--b-report", paths["bReport"],
                "--a-manifest", str(A_MAN), "--b-manifest", str(B_MAN), "--b-freeze", paths["bFreeze"],
                "--out", str(RUN / "evidence-aggregate/aggregate.json")]); results["aggregate"] = c

    r, c = run(["pnpm", "test"], timeout=1200); results["test"] = c
    r, c = run(["pnpm", "typecheck"], timeout=900); results["typecheck"] = c
    r, c = run(["pnpm", "check:links"], timeout=600); results["links"] = c

    after = snapshot(evidence_paths())
    changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
    aggregate = json.loads((RUN / "evidence-aggregate/aggregate.json").read_text(encoding="utf-8")) if (RUN / "evidence-aggregate/aggregate.json").exists() else None
    failures = []
    expected_exit = {"build": 0, "registry": 0, "updateLogs": 0, "freeze": 0, "verifyA": 0, "verifyB": 0, "aggregate": 0, "test": 0, "typecheck": 0, "links": 0}
    for k, v in expected_exit.items():
        if results[k]["exit"] != v: failures.append(f"{k} exit={results[k]['exit']} (expect {v})")
    if aggregate is None or aggregate.get("pass") is not True: failures.append("aggregate 未 PASS")
    if changed: failures.append(f"受保护文件变化：{changed[:10]}")
    verdict = "PASS" if not failures else "FAIL"

    facts = {
        "format": "p0-04-evidence-ci-e2e-facts/v1",
        "startedAt": STARTED, "finishedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "verdict": verdict, "failures": failures,
        "paths": paths, "results": results, "aggregate": aggregate,
        "immutability": {"changed": changed, "protectedFiles": len(before)},
        "note": "本地 E2E 模拟 base=head；真实 GitHub PR E3 需在 05 合并后执行。",
        "commands": COMMANDS,
    }
    (RUN / "facts.json").write_text(json.dumps(facts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    L = []
    L.append("# P0-04 票 05 · Evidence CI 双基线验收（本地 E2E）\n")
    L.append(f"- 生成时间：{STARTED}（UTC）")
    L.append(f"- 结论：**{verdict}**")
    L.append("- 说明：本报告是 **base=head 的本地 E2E 模拟**；真实 GitHub PR E3 在 05 合并后用临时正常 PR 执行。\n")
    L.append("## 结果\n")
    L.append("| 步骤 | 退出 | 耗时 |")
    L.append("|---|---|---|")
    for k in expected_exit:
        L.append(f"| {k} | {results[k]['exit']} | {results[k]['durationMs']} ms |")
    L.append("\n## Aggregate\n")
    L.append(f"- pass：**{aggregate.get('pass') if aggregate else None}**")
    if aggregate:
        for p in aggregate.get("problems", []): L.append(f"- ✗ {p}")
        L.append(f"- outcomes：`{json.dumps(aggregate.get('outcomes'), ensure_ascii=False)}`")
        L.append(f"- summaries：`{json.dumps(aggregate.get('summaries'), ensure_ascii=False)}`")
        L.append(f"- reports：`{json.dumps(aggregate.get('reports'), ensure_ascii=False)}`")
    L.append("\n## 零改动\n")
    L.append(f"- 受保护文件快照 {len(before)} 个（A/B 全部清单文件、Manifest、Anchor、更新日志、registry、112 冻结文件）：变化 **{changed if changed else '无'}**。")
    L.append("\n## 产物\n")
    for k, v in paths.items(): L.append(f"- {k}: `{Path(v).relative_to(REPO) if v else '(missing)'}`")
    (RUN / "report.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"VERDICT={verdict}")
    for f in failures: print("FAIL:", f)
    print("RUN=", RUN)

if __name__ == "__main__":
    main()
