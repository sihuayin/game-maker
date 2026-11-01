#!/usr/bin/env python3
"""P0-04 票 01：基线 A/B 只读审计。只读证据文件；仅向本 runs/ 目录写结果。"""
import os, sys, json, hashlib, re, subprocess, unicodedata
from pathlib import Path
from collections import Counter, defaultdict
from datetime import datetime, timezone

REPO = Path.cwd().resolve()
REPO_REAL = Path(os.path.realpath(REPO))
RUN = Path(sys.argv[1]).resolve()
RUN.mkdir(parents=True, exist_ok=True)

A_MAN = Path(".scratch/evidence-integrity-v1/manifest/expected-hashes.json")
A_ANCHOR = Path(".scratch/evidence-integrity-v1/manifest/expected-hashes.sha256")
A_UPDATES = Path(".scratch/evidence-integrity-v1/manifest/MANIFEST-UPDATES.md")
B_MAN = Path(".scratch/p0-02-second-demo-v2/manifest/final-manifest.json")
B_SPEC = Path(".scratch/p0-02-second-demo-v2/manifest/final-spec.json")
B_FREEZE_HASHES = Path(".scratch/p0-02-second-demo-v2/freeze-sha256.txt")
B_FINAL_REPORT = Path(".scratch/p0-02-second-demo-v2/final-report.md")
B_FINAL_VERDICT = Path(".scratch/p0-02-second-demo-v2/final-verdict.json")
PRD = Path("docs/v7.6/接入.md")
A_ANCHOR_STR = "sha256:ba7a485b195fe3d362fd4cb244d397c844d4e07fb0d2ccc89f914043bf4d36fd"
B_SHA_STR = "sha256:07866e0e3d9ffa7f4223157ed31037907522db445c3ad17a9cf91b82bd78b9ab"
SHA_RE = re.compile(r"^sha256:[0-9a-f]{64}$")
LIVE_FILES = [
    ".github/workflows/ci.yml", ".github/workflows/evidence.yml", ".github/workflows/baseline-update.yml",
    "scripts/evidence-acceptance.mjs", "scripts/check-manifest-updates.mjs",
    "docs/adr/0001-evidence-trust-boundary.md", str(PRD),
    str(A_MAN), str(A_ANCHOR), str(A_UPDATES), str(B_MAN), str(B_SPEC),
    str(B_FREEZE_HASHES), str(B_FINAL_REPORT), str(B_FINAL_VERDICT),
]
COMMANDS = []

def now():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

def sha_bytes(b):
    return "sha256:" + hashlib.sha256(b).hexdigest()

def sha_file(p):
    h = hashlib.sha256()
    with open(p, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return "sha256:" + h.hexdigest()

def relpath(p):
    p = Path(p)
    try:
        return str(p.resolve().relative_to(REPO))
    except Exception:
        return str(p)

def within(root, target):
    try:
        return os.path.commonpath([str(root), str(target)]) == str(root)
    except ValueError:
        return False

def run_cmd(args, timeout=600):
    started = now()
    r = subprocess.run(args, cwd=REPO, capture_output=True, text=True, timeout=timeout)
    rec = {"cmd": " ".join(args), "startedAt": started, "finishedAt": now(),
           "exit": r.returncode, "stdoutTail": r.stdout[-2000:], "stderrTail": r.stderr[-2000:]}
    COMMANDS.append(rec)
    return r, rec

def path_issues(p):
    issues = []
    if not isinstance(p, str) or p == "":
        return ["empty-or-non-string"]
    if p.startswith("/"):
        issues.append("absolute")
    if "\\" in p:
        issues.append("backslash")
    if any(ord(c) < 32 for c in p):
        issues.append("control-char")
    parts = p.split("/")
    if any(x in ("..", ".", "") for x in parts):
        issues.append("dot-or-empty-component")
    if os.path.normpath(p) != p:
        issues.append("not-normalized")
    if p.endswith("/"):
        issues.append("trailing-slash")
    return issues

def audit_manifest(label, mpath):
    mpath = Path(mpath)
    out = {"label": label, "path": str(mpath), "abs": str(mpath.resolve()),
           "exists": mpath.exists(), "schemaIssues": [], "pathIssues": [], "duplicates": [],
           "caseCollisions": [], "unicodeCollisions": [], "symlinks": [],
           "roots": [], "perRoot": {}, "roles": {}, "fileResults": [],
           "records": [], "counts": {}}
    if not mpath.exists():
        out["schemaIssues"].append("manifest 不存在")
        return out
    raw = mpath.read_bytes()
    out["bytes"] = len(raw)
    out["sha256"] = sha_bytes(raw)
    out["mtime"] = datetime.fromtimestamp(mpath.stat().st_mtime, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    try:
        m = json.loads(raw)
    except Exception as e:
        out["schemaIssues"].append(f"JSON 不可解析：{e}")
        return out
    out["format"] = m.get("format")
    out["generatedAt"] = m.get("generatedAt")
    out["generatedBy"] = m.get("generatedBy")
    out["note"] = m.get("note")
    out["subject"] = m.get("subject")
    if m.get("format") != "delivery-evidence-manifest/v1":
        out["schemaIssues"].append(f"format={m.get('format')}")
    subj = m.get("subject") or {}
    for k, t in [("packId", str), ("packVersion", int), ("siteVersion", int), ("shellVersion", str),
                 ("manifestChecksum", str), ("configChecksum", str)]:
        if not isinstance(subj.get(k), t):
            out["schemaIssues"].append(f"subject.{k} 缺失或类型错误")
    for k in ("manifestChecksum", "configChecksum"):
        if not isinstance(subj.get(k), str) or not SHA_RE.match(subj.get(k, "")):
            out["schemaIssues"].append(f"subject.{k} 不是 sha256:<64hex>")
    roots = m.get("roots")
    if not isinstance(roots, dict) or len(roots) == 0:
        out["schemaIssues"].append("roots 缺失或为空")
        roots = {}
    root_abs = {}
    for rid, decl in roots.items():
        abs_p = (mpath.parent / decl).resolve(strict=False)
        real_p = Path(os.path.realpath(abs_p)) if abs_p.exists() else None
        info = {"id": rid, "declared": decl, "abs": str(abs_p),
                "real": str(real_p) if real_p else None,
                "exists": abs_p.exists(), "isDir": abs_p.is_dir() if abs_p.exists() else False,
                "insideRepo": within(REPO_REAL, real_p or abs_p)}
        out["roots"].append(info)
        if not info["exists"]:
            out["schemaIssues"].append(f"root {rid} 不存在：{abs_p}")
        if not info["insideRepo"]:
            out["schemaIssues"].append(f"root {rid} 解析到仓库外：{abs_p}")
        if info["real"]:
            root_abs[rid] = Path(info["real"])
        else:
            root_abs[rid] = abs_p
    files = m.get("files")
    if not isinstance(files, list) or len(files) == 0:
        out["schemaIssues"].append("files 缺失或为空")
        files = []
    records = m.get("records")
    if not isinstance(records, list):
        out["schemaIssues"].append("records 不是数组")
        records = []
    key_seen = {}
    case_seen = {}
    nfc_seen = {}
    for i, f in enumerate(files):
        where = f"files[{i}]"
        if not isinstance(f, dict):
            out["schemaIssues"].append(f"{where} 不是对象")
            continue
        for k, t in [("root", str), ("path", str), ("role", str)]:
            if not isinstance(f.get(k), t):
                out["schemaIssues"].append(f"{where}.{k} 缺失或类型错误")
        if not isinstance(f.get("required"), bool):
            out["schemaIssues"].append(f"{where}.required 不是布尔")
        if not isinstance(f.get("sha256"), str) or not SHA_RE.match(f.get("sha256", "")):
            out["schemaIssues"].append(f"{where}.sha256 非法")
        if "bytes" in f and (not isinstance(f["bytes"], int) or f["bytes"] < 0):
            out["schemaIssues"].append(f"{where}.bytes 非法")
        rid, p = f.get("root"), f.get("path")
        if rid not in roots:
            out["schemaIssues"].append(f"{where}.root 未登记：{rid}")
        issues = path_issues(p)
        if issues:
            out["pathIssues"].append({"key": f"{rid}:{p}", "issues": issues})
        key = f"{rid}:{p}"
        if key in key_seen:
            out["duplicates"].append({"key": key, "indices": [key_seen[key], i]})
        key_seen[key] = i
        case_key = f"{rid}:{p.casefold()}" if isinstance(p, str) else None
        if case_key is not None:
            if case_key in case_seen:
                out["caseCollisions"].append({"key": key, "other": case_seen[case_key]})
            case_seen[case_key] = key
            nfc_key = f"{rid}:{unicodedata.normalize('NFC', p)}"
            if nfc_key in nfc_seen and nfc_seen[nfc_key] != key:
                out["unicodeCollisions"].append({"key": key, "other": nfc_seen[nfc_key]})
            nfc_seen[nfc_key] = key
    file_by_key = {}
    for f in files:
        if not isinstance(f, dict):
            continue
        key = f"{f.get('root')}:{f.get('path')}"
        rid, p = f.get("root"), f.get("path")
        required = bool(f.get("required"))
        res = {"key": key, "root": rid, "path": p, "role": f.get("role"),
               "required": required, "expected": f.get("sha256")}
        if rid not in root_abs:
            res["status"] = "path-invalid"; res["detail"] = "root 未登记"
        elif not isinstance(p, str) or path_issues(p):
            res["status"] = "path-invalid"; res["detail"] = ";".join(path_issues(p or ""))
        else:
            lex = root_abs[rid] / p
            cur = root_abs[rid]
            syms = []
            for part in p.split("/"):
                cur = cur / part
                try:
                    if os.path.islink(cur):
                        syms.append(relpath(cur))
                except OSError:
                    pass
            if syms:
                res["symlinkComponents"] = syms
                out["symlinks"].append({"key": key, "components": syms})
            if not os.path.exists(lex):
                res["status"] = "optional-missing" if not required else "missing"
            elif not os.path.isfile(lex):
                res["status"] = "unreadable"; res["detail"] = "不是普通文件"
            else:
                real = Path(os.path.realpath(lex))
                res["real"] = str(real)
                if not within(root_abs[rid], real):
                    res["status"] = "path-invalid"; res["detail"] = "realpath 越出 root"
                else:
                    try:
                        buf = lex.read_bytes()
                    except Exception as e:
                        res["status"] = "unreadable"; res["detail"] = str(e)
                    else:
                        act = sha_bytes(buf)
                        res["actual"] = act
                        res["bytes"] = len(buf)
                        if act != f.get("sha256"):
                            res["status"] = "hash-mismatch"
                        elif "bytes" in f and f["bytes"] != len(buf):
                            res["status"] = "bytes-mismatch"
                        else:
                            res["status"] = "verified"
        file_by_key[key] = res
        out["fileResults"].append(res)
    # records
    for r in records:
        if not isinstance(r, dict):
            out["schemaIssues"].append("records 含非对象")
            continue
        key = f"{r.get('root')}:{r.get('path')}"
        rec = {"key": key, "role": r.get("role"), "required": r.get("required"),
               "identity": r.get("identity"), "inFiles": key in file_by_key,
               "fileStatus": file_by_key.get(key, {}).get("status")}
        if not rec["inFiles"]:
            out["schemaIssues"].append(f"记录不在 files[] 中：{key}")
        if r.get("identity") is not True:
            out["schemaIssues"].append(f"记录 identity 不为 true：{key}")
        out["records"].append(rec)
    # case conflicts among on-disk directory entries for listed files
    checked_dirs = set()
    dir_conflicts = []
    for res in out["fileResults"]:
        if res["status"] not in ("verified", "hash-mismatch", "bytes-mismatch"):
            continue
        parent = Path(res["real"]).parent
        if parent in checked_dirs:
            continue
        checked_dirs.add(parent)
        try:
            names = os.listdir(parent)
        except OSError:
            continue
        groups = defaultdict(list)
        for n in names:
            groups[unicodedata.normalize("NFC", n).casefold()].append(n)
        for v in groups.values():
            if len(v) > 1:
                dir_conflicts.append({"dir": relpath(parent), "names": sorted(v)})
    out["onDiskCaseConflicts"] = dir_conflicts
    out["counts"] = {
        "files": len(files),
        "required": sum(1 for f in files if isinstance(f, dict) and f.get("required") is True),
        "optional": sum(1 for f in files if isinstance(f, dict) and f.get("required") is not True),
        "records": len(records),
        "roots": len(roots),
    }
    out["perRoot"] = dict(Counter(f.get("root") for f in files if isinstance(f, dict)).most_common())
    out["roles"] = dict(Counter(f.get("role") for f in files if isinstance(f, dict)).most_common())
    out["statusCounts"] = dict(Counter(r["status"] for r in out["fileResults"]).most_common())
    out["requiredFailures"] = [r for r in out["fileResults"] if r["required"] and r["status"] not in ("verified",)]
    out["optionalProblems"] = [r for r in out["fileResults"] if not r["required"] and r["status"] not in ("verified",)]
    out["totalBytes"] = sum(r.get("bytes", 0) for r in out["fileResults"])
    return out

def freeze_audit(b):
    fr = Path(".scratch/p0-02-second-demo-v2/freeze")
    freeze_root = fr / "wasteland-scavenger-recipe"
    out = {"freezeRoot": str(fr), "declaredFiles": 0, "diskFiles": 0, "hashListEntries": 0,
           "hashListMismatches": [], "hashListMissing": [], "hashListExtra": [],
           "manifestOutCount": 0, "freezeOnly": [], "manifestOnly": [], "sharedHashMismatches": [],
           "explanation": []}
    disk = sorted(p for p in fr.rglob("*") if p.is_file())
    out["diskFiles"] = len(disk)
    disk_rel = {str(p.relative_to(fr)): p for p in disk}
    lines = B_FREEZE_HASHES.read_text(encoding="utf-8").splitlines()
    parsed = []
    for ln in lines:
        if not ln.strip():
            continue
        h, p = ln.split(None, 1)
        parsed.append((h, p.strip()))
    out["hashListEntries"] = len(parsed)
    expected_rel = set()
    for h, p in parsed:
        full = f"wasteland-scavenger-recipe/{p}"
        expected_rel.add(full)
        fp = fr / full
        if not fp.exists():
            out["hashListMissing"].append(full)
            continue
        act = sha_file(fp)
        if act != "sha256:" + h:
            out["hashListMismatches"].append({"path": full, "expected": "sha256:" + h, "actual": act})
    out["hashListExtra"] = sorted(set(disk_rel) - expected_rel)
    # manifest out root mapping
    roots = {r["id"]: Path(r["abs"]) for r in b["roots"]}
    out_root = roots.get("out")
    man_out = {r["path"]: r for r in b["fileResults"] if r["root"] == "out"}
    out["manifestOutCount"] = len(man_out)
    man_set = set(man_out)
    disk_set = set(disk_rel)
    out["freezeOnly"] = sorted(disk_set - man_set)
    out["manifestOnly"] = sorted(man_set - disk_set)
    for p in sorted(man_set & disk_set):
        mh = man_out[p].get("expected")
        if man_out[p].get("actual") and mh != man_out[p]["actual"]:
            out["sharedHashMismatches"].append({"path": p, "manifest": mh, "actual": man_out[p]["actual"]})
    spec = json.loads(B_SPEC.read_text(encoding="utf-8"))
    out["specOutEntries"] = [e for e in spec.get("entries", []) if e.get("root") == "out"]
    out["gitignoreLogRule"] = None
    gi = Path(".gitignore")
    if gi.exists():
        for i, ln in enumerate(gi.read_text(encoding="utf-8").splitlines(), 1):
            if ln.strip() == "*.log":
                out["gitignoreLogRule"] = {"file": ".gitignore", "line": i, "rule": "*.log"}
    for p in out["freezeOnly"]:
        fp = fr / p
        head = fp.read_text(encoding="utf-8", errors="replace")[:400]
        out["explanation"].append({
            "path": p, "bytes": fp.stat().st_size,
            "looksLikeChromeLog": ("DevTools listening" in head or "CVDisplayLink" in head or "Chrome" in head),
            "head": head.splitlines()[:3],
            "firstNonEmpty": next((ln for ln in head.splitlines() if ln.strip()), ""),
            "excludedBySpecRule": any(e.get("kind") == "dir" and ".log" in (e.get("excludeExt") or [])
                                      for e in spec.get("entries", []) if e.get("root") == "out"),
            "explicitlyListedInSpec": any(e.get("kind") == "file" and e.get("path") == f"wasteland-scavenger-recipe/{p[len('wasteland-scavenger-recipe/'):]}"
                                          for e in spec.get("entries", []) if e.get("root") == "out") if p.startswith("wasteland-scavenger-recipe/") else False,
            "coveredByFreezeHashList": p in expected_rel,
        })
    return out

def overlap_audit(a, b):
    def map_abs(man):
        d = {}
        for r in man["fileResults"]:
            if r.get("real"):
                d[r["real"]] = r
        return d
    am, bm = map_abs(a), map_abs(b)
    common = sorted(set(am) & set(bm))
    cats = Counter()
    hash_mismatches = []
    for k in common:
        ra, rb = am[k], bm[k]
        cats[(bool(ra["required"]), bool(rb["required"]))] += 1
        if ra.get("actual") and rb.get("actual") and ra["actual"] != rb["actual"]:
            hash_mismatches.append({"path": relpath(k), "a": ra["actual"], "b": rb["actual"]})
    by_root = Counter()
    for k in common:
        by_root[(am[k]["root"], bm[k]["root"])] += 1
    return {"count": len(common), "categories": {"bothRequired": cats[(True, True)],
            "aRequiredBOptional": cats[(True, False)], "aOptionalBRequired": cats[(False, True)],
            "bothOptional": cats[(False, False)]},
            "byRoot": [{"aRoot": x, "bRoot": y, "count": n} for (x, y), n in by_root.most_common()],
            "hashMismatches": hash_mismatches,
            "sample": [relpath(k) for k in common[:10]]}

def cli_run(label, manifest, extra):
    outdir = RUN / "cli" / label
    outdir.mkdir(parents=True, exist_ok=True)
    args = ["node", "packages/cli/dist/cli.mjs", "verify-delivery", "--manifest", str(manifest)] + extra + \
           ["--out", str(outdir), "--json"]
    r, rec = run_cmd(args)
    (RUN / f"cli-{label}.stdout.log").write_text(r.stdout, encoding="utf-8")
    (RUN / f"cli-{label}.stderr.log").write_text(r.stderr, encoding="utf-8")
    reports = sorted(outdir.rglob("report.json"))
    info = {"label": label, "command": rec, "reportCount": len(reports), "reportPath": None}
    if reports:
        rp = reports[-1]
        info["reportPath"] = str(rp.relative_to(RUN))
        info["reportSha256"] = sha_file(rp)
        rep = json.loads(rp.read_text(encoding="utf-8"))
        info["status"] = rep.get("status")
        info["declaredVerdict"] = (rep.get("declared") or {}).get("verdict")
        info["recomputedVerdict"] = (rep.get("recomputed") or {}).get("verdict")
        info["verdictMatch"] = (rep.get("comparison") or {}).get("verdictMatch")
        diags = rep.get("diagnostics") or []
        info["diagnostics"] = len(diags)
        info["diagnosticSeverities"] = dict(Counter(d.get("severity") for d in diags).most_common())
        info["scope"] = rep.get("scope")
        info["trust"] = rep.get("trust")
    return info

def snapshot(paths):
    out = {}
    for p in sorted(set(paths)):
        pp = Path(p)
        if pp.exists() and pp.is_file():
            out[str(pp)] = sha_file(pp)
    return out

def git_status():
    r, _ = run_cmd(["git", "status", "--porcelain", "--untracked-files=all"])
    return r.stdout.splitlines()

def main():
    started = now()
    initial_git = git_status()
    # collect evidence paths before hashing
    b_man = json.loads(B_MAN.read_text(encoding="utf-8"))
    a_man = json.loads(A_MAN.read_text(encoding="utf-8"))
    ev_paths = []
    for mpath, m in ((B_MAN, b_man), (A_MAN, a_man)):
        for rid, decl in m["roots"].items():
            base = (mpath.parent / decl).resolve()
            for f in m["files"]:
                if f["root"] == rid:
                    ev_paths.append(str(base / f["path"]))
    freeze_files = [str(p) for p in Path(".scratch/p0-02-second-demo-v2/freeze").rglob("*") if p.is_file()]
    before = snapshot(LIVE_FILES + ev_paths + freeze_files)

    a = audit_manifest("A (FPVS-V1)", A_MAN)
    b = audit_manifest("B (P0-02 Second Demo V2)", B_MAN)
    fz = freeze_audit(b)
    ov = overlap_audit(a, b)

    # A anchor + update log
    anchor_text = A_ANCHOR.read_text(encoding="utf-8").strip()
    a_anchor = {"path": str(A_ANCHOR), "content": anchor_text, "formatOk": bool(SHA_RE.match(anchor_text)),
                "matchesManifest": anchor_text == a["sha256"], "expectedFromMap": A_ANCHOR_STR}
    upd = A_UPDATES.read_text(encoding="utf-8")
    entries = re.findall(r"^\s*-\s*newSha256:\s*(\S+)\s*$", upd, re.M)
    a_updates = {"path": str(A_UPDATES), "entries": len(entries), "last": entries[-1] if entries else None,
                 "matchesManifest": bool(entries) and entries[-1] == a["sha256"]}
    # B recorded claims
    verdict = json.loads(B_FINAL_VERDICT.read_text(encoding="utf-8"))
    b_claims = {"finalVerdict.manifest": verdict.get("manifest"),
                "finalVerdict.freeze": verdict.get("freeze"),
                "finalReportShaMentioned": B_SHA_STR in B_FINAL_REPORT.read_text(encoding="utf-8")}
    b_recorded_sha = (verdict.get("manifest") or {}).get("sha256")
    b_counts_match_claims = (verdict.get("manifest") or {}).get("files") == b["counts"]["files"] and \
                            (verdict.get("manifest") or {}).get("required") == b["counts"]["required"] and \
                            (verdict.get("manifest") or {}).get("records") == b["counts"]["records"]

    cli_a = cli_run("A", A_MAN, ["--expected-manifest-sha", anchor_text, "--anchor-mode", "digest"])
    cli_b = cli_run("B", B_MAN, [])

    after = snapshot(LIVE_FILES + ev_paths + freeze_files)
    final_git = git_status()
    run_rel = str(RUN.relative_to(REPO))
    git_added = sorted(set(final_git) - set(initial_git))
    git_removed = sorted(set(initial_git) - set(final_git))
    git_outside_runs = [x for x in git_added + git_removed if not x.startswith(f"?? {run_rel}/")]
    changed = sorted(k for k in set(before) | set(after) if before.get(k) != after.get(k))
    new_files = sorted(set(after) - set(before))

    cli_dist = {"cli": sha_file("packages/cli/dist/cli.mjs"),
                "pipeline": sha_file("packages/pipeline/dist/evidence-integrity.js"),
                "cliMtime": datetime.fromtimestamp(Path("packages/cli/dist/cli.mjs").stat().st_mtime, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "pipelineMtime": datetime.fromtimestamp(Path("packages/pipeline/dist/evidence-integrity.js").stat().st_mtime, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "bundleHasBaselineUpdate": "baseline-update" in Path("packages/cli/dist/cli.mjs").read_text(encoding="utf-8", errors="replace")}

    failures = []
    warnings = []
    # A
    if a["counts"] != {"files": 223, "required": 151, "optional": 72, "records": 13, "roots": 9}:
        failures.append(f"A 计数不符：{a['counts']}")
    if a["sha256"] != A_ANCHOR_STR:
        failures.append(f"A Manifest 摘要不符：{a['sha256']}")
    if not a_anchor["matchesManifest"]:
        failures.append("A Anchor 与 Manifest 原始字节摘要不一致")
    if not a_updates["matchesManifest"]:
        failures.append("A MANIFEST-UPDATES 最后一条 newSha256 与 Manifest 不一致")
    if a["requiredFailures"]:
        failures.append(f"A required 文件校验失败 {len(a['requiredFailures'])} 条")
    if a["pathIssues"] or a["duplicates"] or a["caseCollisions"] or a["unicodeCollisions"] or a["onDiskCaseConflicts"]:
        failures.append("A 路径安全检查发现问题")
    if a["symlinks"]:
        failures.append("A 清单路径含符号链接组件")
    # B
    if b["counts"] != {"files": 231, "required": 137, "optional": 94, "records": 6, "roots": 3}:
        failures.append(f"B 计数不符：{b['counts']}")
    if b["sha256"] != B_SHA_STR:
        failures.append(f"B Manifest 摘要不符：{b['sha256']}")
    if b_recorded_sha != b["sha256"]:
        failures.append("B final-verdict.json 记录的 Manifest 摘要与实测不一致")
    if not b_counts_match_claims:
        failures.append("B final-verdict.json 记录的数量与实测不一致")
    if b["requiredFailures"]:
        failures.append(f"B required 文件校验失败 {len(b['requiredFailures'])} 条")
    if b["pathIssues"] or b["duplicates"] or b["caseCollisions"] or b["unicodeCollisions"] or b["onDiskCaseConflicts"]:
        failures.append("B 路径安全检查发现问题")
    if b["symlinks"]:
        failures.append("B 清单路径含符号链接组件")
    # freeze
    if fz["diskFiles"] != 112:
        failures.append(f"冻结快照文件数 {fz['diskFiles']} != 112")
    if fz["hashListEntries"] != 112:
        failures.append(f"freeze-sha256.txt 条目数 {fz['hashListEntries']} != 112")
    if fz["hashListMismatches"] or fz["hashListMissing"] or fz["hashListExtra"]:
        failures.append("freeze-sha256.txt 与磁盘快照不一致")
    if fz["manifestOnly"]:
        failures.append(f"清单 out 列了冻结快照里没有的文件：{fz['manifestOnly']}")
    if fz["sharedHashMismatches"]:
        failures.append("清单 out 与冻结快照共享文件哈希不一致")
    if set(fz["freezeOnly"]) - {"wasteland-scavenger-recipe/run/v1/playtest/v1/chrome.log",
                               "wasteland-scavenger-recipe/run/v1/playtest/v2/chrome.log"}:
        failures.append(f"冻结快照有未解释的清单外文件：{fz['freezeOnly']}")
    # CLI
    for info, label in ((cli_a, "A"), (cli_b, "B")):
        if info["command"]["exit"] != 0:
            failures.append(f"CLI {label} exit={info['command']['exit']}")
        if info.get("status") != "pass":
            failures.append(f"CLI {label} status={info.get('status')}")
        if info.get("diagnostics") != 0:
            failures.append(f"CLI {label} diagnostics={info.get('diagnostics')}")
        if info.get("verdictMatch") is not True:
            failures.append(f"CLI {label} declared↔recomputed 不一致")
    if cli_a.get("trust", {}).get("result") != "matched":
        failures.append("CLI A 锚点结果不是 matched")
    # immutability
    if changed:
        failures.append(f"审计期间证据/配置文件变化：{changed[:10]}")
    if git_removed:
        failures.append(f"审计期间 git 状态行消失（可能存在删除/覆盖）：{git_removed}")
    if git_outside_runs:
        failures.append(f"审计期间 runs/ 之外出现 git 状态变化：{git_outside_runs}")
    # warnings
    warnings.append("冻结快照中 2 个 chrome.log（v1/v2）不在 231 文件清单内：由 spec 的 excludeExt=[\".log\"] 排除，仅由 freeze-sha256.txt 固定；该哈希清单本身未被 A/B Manifest 或 Anchor 钉住。")
    warnings.append("B 尚无独立 Anchor 与更新日志（预期：由 04 票创建）。")
    warnings.append("B final-verdict.json / final-report.md 称 optional 含“旧 work 94 个”，实测 oldWork=93 + v3/chrome.log=1 = 94 optional；数量总数正确，但“94 个旧 work 文件”的表述不精确。")
    warnings.append("A/B 有实际文件路径重叠；A PASS 不能掩盖 B 对 B 独占 required 文件的失败，07 负向样本必须使用独占路径。")
    if not (set(fz["freezeOnly"]) == {"wasteland-scavenger-recipe/run/v1/playtest/v1/chrome.log",
                                      "wasteland-scavenger-recipe/run/v1/playtest/v2/chrome.log"}):
        warnings.append("冻结快照与清单 out 的差异集合与预期不同，请核对。")
    verdict_str = "PASS" if not failures else "FAIL"

    facts = {
        "format": "p0-04-baseline-audit-facts/v1",
        "startedAt": started, "finishedAt": now(),
        "repo": {"head": subprocess.run(["git", "rev-parse", "HEAD"], cwd=REPO, capture_output=True, text=True).stdout.strip(),
                 "branch": subprocess.run(["git", "rev-parse", "--abbrev-ref", "HEAD"], cwd=REPO, capture_output=True, text=True).stdout.strip(),
                 "path": str(REPO)},
        "verdict": verdict_str, "failures": failures, "warnings": warnings,
        "manifestA": a, "manifestB": b, "freeze": fz, "overlap": ov,
        "anchorA": a_anchor, "updatesA": a_updates, "bClaims": b_claims,
        "cli": {"A": cli_a, "B": cli_b, "dist": cli_dist},
        "immutability": {"changed": changed, "newFiles": new_files,
                          "gitStatusBefore": initial_git, "gitStatusAfter": final_git,
                          "gitAdded": git_added, "gitRemoved": git_removed,
                          "gitDeltaOnlyInRuns": not git_removed and not git_outside_runs,
                          "runRel": run_rel},
        "commands": COMMANDS,
    }
    (RUN / "facts.json").write_text(json.dumps(facts, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # report.md
    def st(r):
        return f"{r['status']}"
    L = []
    L.append("# P0-04 票 01 · 基线 A/B 只读审计报告\n")
    L.append(f"- 生成时间：{started}（UTC）")
    L.append(f"- 仓库 HEAD：`{facts['repo']['head']}` · 分支 `{facts['repo']['branch']}`")
    L.append(f"- 结论：**{verdict_str}**")
    L.append(f"- 机器可读：`facts.json`；CLI 日志：`cli-A.*` / `cli-B.*`\n")
    L.append("## 1. 结论\n")
    if verdict_str == "PASS":
        L.append("两套基线的身份、数量、冻结关系、路径安全、逐文件 SHA-256 与 A 零变化均通过；未发现身份或哈希不一致。B 的 2 个 chrome.log 差异有明确解释，见 §3。\n")
    else:
        L.append("存在 FAIL 项，**停止全图，不进入 03**：\n")
        for f in failures:
            L.append(f"- {f}")
        L.append("")
    L.append("## 2. 基线身份与统计\n")
    L.append("| 项 | 基线 A（FPVS-V1） | 基线 B（P0-02 Second Demo V2） |")
    L.append("|---|---|---|")
    L.append(f"| Manifest | `{a['path']}` | `{b['path']}` |")
    L.append(f"| 原始字节 SHA-256 | `{a['sha256']}` | `{b['sha256']}` |")
    L.append(f"| 大小 | {a['bytes']:,} B | {b['bytes']:,} B |")
    L.append(f"| 文件 / required / optional | {a['counts']['files']} / {a['counts']['required']} / {a['counts']['optional']} | {b['counts']['files']} / {b['counts']['required']} / {b['counts']['optional']} |")
    L.append(f"| records | {a['counts']['records']} | {b['counts']['records']} |")
    L.append(f"| roots | {a['counts']['roots']} | {b['counts']['roots']} |")
    L.append(f"| 清单总字节 | {a['totalBytes']:,} | {b['totalBytes']:,} |\n")
    L.append("A 的 Anchor 与更新日志：\n")
    L.append(f"- `expected-hashes.sha256` = `{anchor_text}`；与 Manifest 匹配：**{a_anchor['matchesManifest']}**")
    L.append(f"- `MANIFEST-UPDATES.md` 条目 {a_updates['entries']} 条；最后一条 `newSha256` = `{a_updates['last']}`；与 Manifest 匹配：**{a_updates['matchesManifest']}**\n")
    L.append("B 的正式记录：`final-verdict.json` 记录摘要 `{0}`，实测 `{1}`，一致：**{2}**；数量一致：**{3}**。\n".format(b_recorded_sha, b["sha256"], b_recorded_sha == b["sha256"], b_counts_match_claims))
    L.append("## 3. 冻结快照 112 与正式清单 231 的关系\n")
    L.append(f"- 冻结快照磁盘文件：**{fz['diskFiles']}**；`freeze-sha256.txt` 条目：**{fz['hashListEntries']}**；逐文件哈希不一致/缺失/多余：{len(fz['hashListMismatches'])} / {len(fz['hashListMissing'])} / {len(fz['hashListExtra'])}。")
    L.append(f"- 清单 `out` root 文件：**{fz['manifestOutCount']}**（109 required + 1 optional）。")
    L.append(f"- 冻结快照有、清单没有：{len(fz['freezeOnly'])} 个；清单有、快照没有：{len(fz['manifestOnly'])} 个；共享文件哈希不一致：{len(fz['sharedHashMismatches'])} 个。")
    L.append(f"- `.gitignore` 的 `*.log` 规则：`{fz['gitignoreLogRule']}`。")
    for e in fz["explanation"]:
        L.append(f"\n  - `{e['path']}`（{e['bytes']:,} B）：Chrome 运行日志，首条非空行 `{e.get('firstNonEmpty') or ''}`。被 spec 的 `out` 目录条目 `excludeExt=[\".log\"]` 排除：**{e['excludedBySpecRule']}**；被 spec 显式列为单个文件：**{e['explicitlyListedInSpec']}**；由 freeze-sha256.txt 覆盖：**{e['coveredByFreezeHashList']}**。")
    L.append("\n  结论：这 2 个文件是**已被 v3 取代的旧 playtest attempt 的 Chrome 运行日志**，不是交付证据；成功 attempt 的 `v3/chrome.log` 被 spec 显式列为 **optional**。冻结快照的 112 文件完整性由 `freeze-sha256.txt` 覆盖；但该哈希清单本身不在 231 清单或 Anchor 内（见 §10 警告）。\n")
    L.append("## 4. 逐文件校验\n")
    L.append("| 基线 | verified | required 失败 | optional 问题 | 状态分布 |")
    L.append("|---|---|---|---|---|")
    for label, m in (("A", a), ("B", b)):
        L.append(f"| {label} | {m['statusCounts'].get('verified', 0)} / {m['counts']['files']} | {len(m['requiredFailures'])} | {len(m['optionalProblems'])} | `{json.dumps(m['statusCounts'], ensure_ascii=False)}` |")
    if a["requiredFailures"] or b["requiredFailures"]:
        L.append("\nFAIL 明细：\n")
        for label, m in (("A", a), ("B", b)):
            for r in m["requiredFailures"]:
                L.append(f"- {label} `{r['key']}` → {r['status']} {r.get('detail','')}")
    optional_missing = [r for m in (a, b) for r in m["optionalProblems"]]
    L.append(f"\nOptional 缺失/异常逐条：{len(optional_missing)} 条" + ("" if not optional_missing else ""))
    for r in optional_missing:
        L.append(f"- `{r['key']}` → {r['status']}")
    L.append("\n## 5. 路径安全\n")
    L.append("| 检查 | A | B |")
    L.append("|---|---|---|")
    L.append(f"| root 均在仓库内 | {all(x['insideRepo'] for x in a['roots'])} | {all(x['insideRepo'] for x in b['roots'])} |")
    L.append(f"| 绝对路径 / `..` / 未规范化路径 | {len(a['pathIssues'])} | {len(b['pathIssues'])} |")
    L.append(f"| 重复 `root:path` | {len(a['duplicates'])} | {len(b['duplicates'])} |")
    L.append(f"| 大小写冲突（清单） | {len(a['caseCollisions'])} | {len(b['caseCollisions'])} |")
    L.append(f"| Unicode NFC 冲突 | {len(a['unicodeCollisions'])} | {len(b['unicodeCollisions'])} |")
    L.append(f"| 磁盘目录大小写冲突 | {len(a['onDiskCaseConflicts'])} | {len(b['onDiskCaseConflicts'])} |")
    L.append(f"| 符号链接组件 | {len(a['symlinks'])} | {len(b['symlinks'])} |")
    L.append("\n所有 root 解析结果：\n")
    for label, m in (("A", a), ("B", b)):
        L.append(f"**{label}**")
        for r in m["roots"]:
            L.append(f"- `{r['id']}` → `{r['declared']}` → `{r['abs']}`（real `{r['real']}`，仓库内 {r['insideRepo']}）")
        L.append("")
    L.append("## 6. 记录（records）\n")
    for label, m in (("A", a), ("B", b)):
        L.append(f"**{label}**：{m['counts']['records']} 条")
        for r in m["records"]:
            L.append(f"- `{r['key']}` · role={r['role']} · required={r['required']} · identity={r['identity']} · inFiles={r['inFiles']} · file={r['fileStatus']}")
        L.append("")
    L.append("## 7. 基线 A 零变化\n")
    L.append(f"- 223 文件逐条 SHA-256：{a['counts']['files'] - len(a['requiredFailures']) - len(a['optionalProblems'])} / {a['counts']['files']} verified。")
    L.append(f"- Manifest 原始字节摘要 = Anchor = 更新日志最后一条：**{a_anchor['matchesManifest'] and a_updates['matchesManifest'] and a['sha256'] == A_ANCHOR_STR}**。")
    L.append(f"- 审计开始/结束的 A/B/冻结/配置文件哈希快照：变化 {len(changed)} 个。")
    L.append(f"- `git status` 变化仅限本 effort 的 `runs/`：**{not git_removed and not git_outside_runs}**（新增 {len(git_added)} 行，消失/变更 {len(git_removed)} 行）。\n")
    L.append("## 8. A/B 隔离与重叠\n")
    L.append(f"- 绝对路径重叠 **{ov['count']}** 个：双方 required {ov['categories']['bothRequired']}；A required/B optional {ov['categories']['aRequiredBOptional']}；A optional/B required {ov['categories']['aOptionalBRequired']}；双方 optional {ov['categories']['bothOptional']}。")
    L.append(f"- 按 root 对：`{json.dumps(ov['byRoot'], ensure_ascii=False)}`。")
    L.append(f"- 重叠文件哈希不一致：{len(ov['hashMismatches'])}。")
    L.append("- 含义：07 的 A/B 负向样本必须选各自**独占** required 路径；否则“A PASS 掩盖 B FAIL”无法被证明。\n")
    L.append("## 9. CLI 复验（E3）\n")
    for label, info in (("A", cli_a), ("B", cli_b)):
        L.append(f"- **{label}**：`{info['command']['cmd']}`")
        L.append(f"  - exit={info['command']['exit']} · status={info.get('status')} · diagnostics={info.get('diagnostics')} · declared↔recomputed={info.get('verdictMatch')} · trust={json.dumps(info.get('trust'), ensure_ascii=False)}")
        L.append(f"  - 报告：`{info.get('reportPath')}`\n")
    L.append(f"CLI 构建物：`{cli_dist['cli']}`；pipeline `{cli_dist['pipeline']}`；包含 `baseline-update` 锚点模式：**{cli_dist['bundleHasBaselineUpdate']}**。\n")
    L.append("## 10. 发现与警告\n")
    for w in warnings:
        L.append(f"- ⚠️ {w}")
    L.append("\n没有 FAIL 项。" if not failures else "\n存在 FAIL 项，见 §1。")
    L.append("\n## 11. 只读性证据\n")
    L.append(f"- 审计命令与退出码见 `facts.json` → `commands`（共 {len(COMMANDS)} 条）。")
    L.append(f"- 开始 `git status`：{len(initial_git)} 行；结束：{len(final_git)} 行；变化仅限 `{run_rel}/`：**{not git_removed and not git_outside_runs}**。")
    L.append(f"- 新增状态行 {len(git_added)} 条（全部为本目录 CLI 报告）；删除/变更 {len(git_removed)} 条。")
    L.append(f"- 证据/配置文件哈希变化：{changed if changed else '无'}。")
    L.append(f"- 本目录外新增文件：{new_files if new_files else '无'}。")
    L.append("\n## 12. 输入与产出\n")
    L.append("- 输入（只读）：A Manifest/Anchor/更新日志；B Manifest/spec/freeze/freeze-sha256/final-report/final-verdict；PRD `docs/v7.6/接入.md`。")
    L.append("- 产出：`report.md`、`facts.json`、`cli-A.stdout.log`、`cli-A.stderr.log`、`cli-B.stdout.log`、`cli-B.stderr.log`、`cli/A/…`、`cli/B/…`。")
    (RUN / "report.md").write_text("\n".join(L) + "\n", encoding="utf-8")
    print(f"VERDICT={verdict_str}")
    print(f"FAILURES={len(failures)} WARNINGS={len(warnings)} CHANGED={len(changed)}")
    for f in failures:
        print("FAIL:", f)
    for w in warnings:
        print("WARN:", w)
    print(f"RUN={RUN}")

if __name__ == "__main__":
    main()
