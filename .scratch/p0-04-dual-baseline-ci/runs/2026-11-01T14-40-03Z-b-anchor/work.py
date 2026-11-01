#!/usr/bin/env python3
"""P0-04 票 04：创建 B 独立 Anchor 与更新日志，独立复算并留下 E3 证据。"""
import os, sys, json, hashlib, re, subprocess, time
from pathlib import Path
from datetime import datetime, timezone

REPO = Path.cwd().resolve()
RUN = Path(sys.argv[1]).resolve()
RUN.mkdir(parents=True, exist_ok=True)

A_MAN = Path(".scratch/evidence-integrity-v1/manifest/expected-hashes.json")
A_ANCHOR = Path(".scratch/evidence-integrity-v1/manifest/expected-hashes.sha256")
A_LOG = Path(".scratch/evidence-integrity-v1/manifest/MANIFEST-UPDATES.md")
B_DIR = Path(".scratch/p0-02-second-demo-v2/manifest")
B_MAN = B_DIR / "final-manifest.json"
B_SPEC = B_DIR / "final-spec.json"
B_ANCHOR = B_DIR / "expected-hashes.sha256"
B_LOG = B_DIR / "MANIFEST-UPDATES.md"
B_FREEZE_HASHES = Path(".scratch/p0-02-second-demo-v2/freeze-sha256.txt")
B_REPORT = Path(".scratch/p0-02-second-demo-v2/final-report.md")
B_VERDICT = Path(".scratch/p0-02-second-demo-v2/final-verdict.json")
FREEZE = Path(".scratch/p0-02-second-demo-v2/freeze")
EXPECTED = "sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab"
SHA_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
COMMANDS = []
STARTED = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def sha_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()

def run(args, timeout=600):
    t0 = time.time()
    r = subprocess.run(args, cwd=REPO, capture_output=True, text=True, timeout=timeout)
    rec = {"cmd": " ".join(str(a) for a in args), "exit": r.returncode,
           "durationMs": int((time.time() - t0) * 1000),
           "stdoutTail": r.stdout[-3000:], "stderrTail": r.stderr[-3000:]}
    COMMANDS.append(rec)
    return r, rec

def snapshot(paths):
    out = {}
    for p in sorted({str(x) for x in paths}):
        pp = Path(p)
        if pp.exists() and pp.is_file():
            out[str(pp)] = sha_file(pp)
    return out

def main():
    before = snapshot([A_MAN, A_ANCHOR, A_LOG, B_MAN, B_SPEC, B_FREEZE_HASHES, B_REPORT, B_VERDICT] +
                      [str(p) for p in FREEZE.rglob("*") if p.is_file()])
    # 1. independent recomputation
    r1, c1 = run(["shasum", "-a", "256", str(B_MAN)])
    shasum_value = "sha256:" + r1.stdout.split()[0] if r1.returncode == 0 and r1.stdout.split() else None
    node_code = "const fs=require('fs'),c=require('crypto');process.stdout.write('sha256:'+c.createHash('sha256').update(fs.readFileSync(process.argv[1])).digest('hex')+'\\n')"
    r2, c2 = run(["node", "-e", node_code, str(B_MAN)])
    node_value = r2.stdout.strip() if r2.returncode == 0 else None
    py_value = sha_file(B_MAN)
    recompute = {"expected": EXPECTED, "shasum": shasum_value, "nodeRawBytes": node_value,
                 "pythonRawBytes": py_value, "allMatch": shasum_value == node_value == py_value == EXPECTED,
                 "object": str(B_MAN), "method": "SHA-256 over raw file bytes; no JSON reserialization",
                 "sizeBytes": B_MAN.stat().st_size}
    if not recompute["allMatch"]:
        (RUN / "facts.json").write_text(json.dumps({"verdict": "FAIL", "recompute": recompute, "commands": COMMANDS}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print("FAIL: recompute mismatch"); print(json.dumps(recompute, ensure_ascii=False, indent=2)); sys.exit(1)

    # 2. write anchor atomically
    anchor_text = py_value + "\n"
    tmp = B_ANCHOR.with_name(B_ANCHOR.name + ".tmp")
    tmp.write_text(anchor_text, encoding="utf-8")
    os.replace(tmp, B_ANCHOR)
    # 3. write update log
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    log_text = f"""# MANIFEST-UPDATES

只追加。最后一条 `- newSha256:` 必须等于当前 `final-manifest.json` 的**原始文件字节** SHA-256；
`scripts/check-manifest-updates.mjs` 会在普通 PR 的 evidence job 与 owner 基线更新 dispatch 中检查这一点。

本文件不是密码学意义上的不可篡改日志；历史仍由 git、受保护分支与人工审查负责。

## {today} · freeze P0-02 Second Demo V2 baseline

- reason: initial freeze of the P0-02 Second Demo V2 delivery evidence
- subject: wasteland-scavenger-recipe v1 / site v1 / shell 2
- oldSha256: none (initial freeze)
- newSha256: {py_value}
- evidence: 231 files (137 required / 94 optional), 6 records, 3 roots; freeze snapshot 112 files (freeze-sha256.txt)
- verifiedBy: p0-04-dual-baseline-ci 票 04 / {today}
- recordedIn: p0-04-dual-baseline-ci 票 04 / {today}
- baselineId: p0-02-second-demo-v2
"""
    B_LOG.write_text(log_text, encoding="utf-8")

    # 4. validate new files
    anchor_read = B_ANCHOR.read_text(encoding="utf-8")
    anchor_check = {"path": str(B_ANCHOR), "bytes": B_ANCHOR.stat().st_size,
                    "content": anchor_read.strip(), "formatOk": bool(SHA_RE.match(anchor_read.strip())),
                    "matchesManifest": anchor_read.strip() == py_value}
    log_read = B_LOG.read_text(encoding="utf-8")
    log_entries = re.findall(r"^\s*-\s*newSha256:\s*(\S+)\s*$", log_read, re.M)
    log_check = {"path": str(B_LOG), "bytes": B_LOG.stat().st_size, "entries": len(log_entries),
                 "last": log_entries[-1] if log_entries else None,
                 "matchesManifest": bool(log_entries) and log_entries[-1] == py_value}

    # 5. existing-script checks (A original, B new)
    existing = {}
    for name, logp, manp, expect in [
        ("B_positive", B_LOG, B_MAN, 0),
        ("A_positive", A_LOG, A_MAN, 0),
        ("B_log_vs_A_manifest", B_LOG, A_MAN, 1),
        ("missing_log", RUN / "does-not-exist.md", B_MAN, 1),
    ]:
        r, c = run(["node", "scripts/check-manifest-updates.mjs", "--log", str(logp), "--manifest", str(manp)])
        existing[name] = {"cmd": c["cmd"], "exit": r.returncode, "expectedExit": expect,
                          "pass": r.returncode == expect, "stdoutTail": c["stdoutTail"], "stderrTail": c["stderrTail"]}
    # invalid digest temp log
    bad_log = RUN / "bad-digest.log"
    bad_log.write_text("# test\n\n- newSha256: sha256:xyz\n", encoding="utf-8")
    r, c = run(["node", "scripts/check-manifest-updates.mjs", "--log", str(bad_log), "--manifest", str(B_MAN)])
    existing["invalid_digest"] = {"cmd": c["cmd"], "exit": r.returncode, "expectedExit": 1, "pass": r.returncode == 1, "stdoutTail": c["stdoutTail"], "stderrTail": c["stderrTail"]}
    empty_log = RUN / "empty.log"
    empty_log.write_text("# test\n", encoding="utf-8")
    r, c = run(["node", "scripts/check-manifest-updates.mjs", "--log", str(empty_log), "--manifest", str(B_MAN)])
    existing["empty_log"] = {"cmd": c["cmd"], "exit": r.returncode, "expectedExit": 1, "pass": r.returncode == 1, "stdoutTail": c["stdoutTail"], "stderrTail": c["stderrTail"]}
    # duplicate entries: existing script only checks last entry; strict duplicate validation is 05 wrapper
    dup_log = RUN / "duplicate.log"
    dup_log.write_text("# test\n\n" + f"- newSha256: sha256:{'0'*64}\n- newSha256: {py_value}\n", encoding="utf-8")
    r, c = run(["node", "scripts/check-manifest-updates.mjs", "--log", str(dup_log), "--manifest", str(B_MAN)])
    existing["duplicate_entries_current_behavior"] = {"cmd": c["cmd"], "exit": r.returncode, "note": "现有脚本只校验最后一条；严格重复字段校验由 05 wrapper 负责", "stdoutTail": c["stdoutTail"], "stderrTail": c["stderrTail"]}

    # 6. verify-delivery A/B with anchors
    cli = {}
    for label, man, anchor, out in [("A", A_MAN, A_ANCHOR, RUN / "cli-a"), ("B", B_MAN, B_ANCHOR, RUN / "cli-b")]:
        out.mkdir(parents=True, exist_ok=True)
        r, c = run(["node", "packages/cli/dist/cli.mjs", "verify-delivery", "--manifest", str(man),
                    "--expected-manifest-sha", anchor.read_text(encoding="utf-8").strip(),
                    "--anchor-mode", "digest", "--out", str(out), "--json"])
        reports = sorted(out.rglob("report.json"))
        info = {"cmd": c["cmd"], "exit": r.returncode, "report": str(reports[-1].relative_to(RUN)) if reports else None}
        if reports:
            rep = json.loads(reports[-1].read_text(encoding="utf-8"))
            info.update({"status": rep.get("status"), "diagnostics": len(rep.get("diagnostics") or []),
                         "verdictMatch": (rep.get("comparison") or {}).get("verdictMatch"),
                         "trust": rep.get("trust")})
        cli[label] = info

    # 7. regression
    regression = {}
    for name, args in [("test", ["pnpm", "test"]), ("typecheck", ["pnpm", "typecheck"])]:
        r, c = run(args, timeout=900)
        regression[name] = {"cmd": c["cmd"], "exit": r.returncode, "durationMs": c["durationMs"],
                            "stdoutTail": c["stdoutTail"], "stderrTail": c["stderrTail"]}

    after = snapshot([A_MAN, A_ANCHOR, A_LOG, B_MAN, B_SPEC, B_FREEZE_HASHES, B_REPORT, B_VERDICT] +
                     [str(p) for p in FREEZE.rglob("*") if p.is_file()])
    changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))

    failures = []
    if not recompute["allMatch"]: failures.append("独立复算不一致")
    if not anchor_check["formatOk"] or not anchor_check["matchesManifest"]: failures.append("B Anchor 格式或摘要不符")
    if not log_check["matchesManifest"] or log_check["entries"] != 1: failures.append("B 更新日志最后一条不符")
    for k, v in existing.items():
        if k == "duplicate_entries_current_behavior": continue
        if not v["pass"]: failures.append(f"现有脚本用例失败：{k}")
    for label, info in cli.items():
        if info["exit"] != 0 or info.get("status") != "pass" or info.get("diagnostics") != 0:
            failures.append(f"verify-delivery {label} 失败")
        if (info.get("trust") or {}).get("result") != "matched":
            failures.append(f"verify-delivery {label} anchor 未 matched")
    for name, info in regression.items():
        if info["exit"] != 0: failures.append(f"pnpm {name} 失败")
    if changed: failures.append(f"受保护文件变化：{changed[:10]}")
    verdict = "PASS" if not failures else "FAIL"

    facts = {
        "format": "p0-04-b-anchor-facts/v1",
        "startedAt": STARTED, "finishedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "verdict": verdict, "failures": failures,
        "recompute": recompute,
        "newFiles": {"anchor": anchor_check, "updateLog": log_check},
        "freezeSource": {
            "manifestPath": str(B_MAN),
            "freezeFiles": 112,
            "freezeHashList": str(B_FREEZE_HASHES),
            "freezeCommit": "21632ef62e5d043f98baa834a14a40aa38dff064",
            "freezeCommitSubject": "P0-02 v2 阶段 A 收口：六项缺口零付费收敛 + 正式清单",
            "finalReportCodeBaseline": "f0411e676309fede8f20b79d9f8e44e5ac479ef6",
            "finalVerdict": str(B_VERDICT),
        },
        "existingScript": existing,
        "cli": cli,
        "regression": regression,
        "immutability": {"changed": changed, "protectedFiles": len(before)},
        "commands": COMMANDS,
    }
    (RUN / "facts.json").write_text(json.dumps(facts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    L = []
    L.append("# P0-04 票 04 · B 独立 Anchor 与更新日志\n")
    L.append(f"- 生成时间：{STARTED}（UTC）")
    L.append(f"- 结论：**{verdict}**")
    L.append(f"- 机器可读：`facts.json`\n")
    L.append("## 1. 独立复算\n")
    L.append("| 方法 | 结果 |")
    L.append("|---|---|")
    L.append(f"| 期望值 | `{EXPECTED}` |")
    L.append(f"| `shasum -a 256` | `{shasum_value}` |")
    L.append(f"| Node `crypto` 原始字节 | `{node_value}` |")
    L.append(f"| Python `hashlib` 原始字节 | `{py_value}` |")
    L.append(f"| 一致 | **{recompute['allMatch']}** |\n")
    L.append(f"被计算文件：`{B_MAN}`（{recompute['sizeBytes']:,} B）；计算方式：对**原始文件字节**做 SHA-256，不重新序列化 JSON。")
    L.append(f"冻结来源：commit `21632ef62e5d043f98baa834a14a40aa38dff064`；B `final-report.md` 记录的代码基线为 `f0411e676309fede8f20b79d9f8e44e5ac479ef6`（生成时工作树未提交，冻结文件由 21632ef 入库）。\n")
    L.append("## 2. 新建文件\n")
    L.append(f"- `{B_ANCHOR}`：{anchor_check['bytes']} B，格式合法 **{anchor_check['formatOk']}**，与 Manifest 匹配 **{anchor_check['matchesManifest']}**。")
    L.append(f"- `{B_LOG}`：{log_check['bytes']} B，`newSha256` 条目 {log_check['entries']} 条，最后一条匹配 **{log_check['matchesManifest']}**。\n")
    L.append("## 3. 现有脚本校验（旧脚本零改动）\n")
    L.append("| 用例 | 期望退出 | 实际退出 | 结果 |")
    L.append("|---|---|---|---|")
    for k, v in existing.items():
        if k == "duplicate_entries_current_behavior":
            L.append(f"| {k} | n/a | {v['exit']} | 记录现状（严格重复校验由 05 wrapper 负责） |")
        else:
            L.append(f"| {k} | {v['expectedExit']} | {v['exit']} | {'PASS' if v['pass'] else 'FAIL'} |")
    L.append("\nA 原调用与 B 新日志调用均使用同一个 `scripts/check-manifest-updates.mjs`；脚本文件未修改。\n")
    L.append("## 4. verify-delivery（A/B，带 Anchor）\n")
    for label, info in cli.items():
        L.append(f"- **{label}**：exit={info['exit']} · status={info.get('status')} · diagnostics={info.get('diagnostics')} · trust={json.dumps(info.get('trust'), ensure_ascii=False)}")
        L.append(f"  - 报告：`{info.get('report')}`")
    L.append("\n## 5. 回归\n")
    L.append("| 命令 | 退出 | 耗时 |")
    L.append("|---|---|---|")
    for name, info in regression.items():
        L.append(f"| `{info['cmd']}` | {info['exit']} | {info['durationMs']} ms |")
    L.append(f"\n## 6. 零改动\n")
    L.append(f"- 受保护文件快照：{len(before)} 个（A 三件、B Manifest/spec、freeze-sha256、final-report/verdict、112 冻结文件）；变化：**{changed if changed else '无'}**。")
    L.append("- 未修改 B Manifest、B `freeze/`、A 文件或任何交付证据。")
    L.append("\n## 7. 说明\n")
    L.append("- 现有脚本只校验最后一条 `newSha256`；重复字段/多日志严格 schema 由 05 的 `scripts/check-baseline-updates.mjs` wrapper 实现（03 Q6）。")
    L.append("- B Anchor 单行 `sha256:<64 hex>`；B 更新日志为 Markdown 追加，初始 freeze 条目使用 A 兼容字段 + `baselineId`（03 Q7）。")
    (RUN / "report.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"VERDICT={verdict}")
    for f in failures: print("FAIL:", f)
    print(f"RUN={RUN}")

if __name__ == "__main__":
    main()
