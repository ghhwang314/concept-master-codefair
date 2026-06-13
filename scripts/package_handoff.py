#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"

INCLUDE_DIRS = [
    ".claude",
    "assets",
    "docs",
    "phases",
    "QA_EVIDENCE",
    "reports/api_environment",
    "reports/dtt_baseline",
    "reports/token_harness",
    "scripts",
    "src",
    "SUBMISSION_DOCS",
    "tests",
    "trial_records",
]

INCLUDE_FILES = [
    ".env.example",
    "AGENTS.md",
    "CLAUDE.md",
    "GEONHO_PC_RUN_GUIDE.md",
    "GEONHO_HUMAN_TRIAL_CHECKLIST.md",
    "HANDOFF_GEONHO.md",
    "index.html",
    "LIVE_MANUS_VERIFICATION.md",
    "package.json",
    "README.md",
    "styles.css",
    "SUBMISSION_PACKAGE.md",
]

EXCLUDED_NAMES = {
    ".env",
    "node_modules",
    "dist",
    "__pycache__",
}

EXCLUDED_SUFFIXES = {
    ".log",
    ".pyc",
}

REQUIRED_IN_ZIP = [
    "package.json",
    "README.md",
    "GEONHO_PC_RUN_GUIDE.md",
    "HANDOFF_GEONHO.md",
    "GEONHO_HUMAN_TRIAL_CHECKLIST.md",
    ".env.example",
    "index.html",
    "scripts/prepare_human_trial_record.py",
    "scripts/smoke_handoff_zip.py",
    "scripts/start_human_trial.py",
    "scripts/status_human_trial.py",
    "scripts/validate_human_trial_record.py",
    "trial_records/human_trial_record.template.v1.json",
    "src/server.mjs",
    "src/app.js",
    "tests/concept-master.test.mjs",
    "QA_EVIDENCE/m6_human_trial_gate_check_20260609.md",
    "reports/token_harness/latest_status.v1.json",
]

FORBIDDEN_IN_ZIP = [
    ".env",
    "server.err.log",
    "server.out.log",
]


def now_stamp() -> str:
    return datetime.now(timezone.utc).astimezone().strftime("%Y%m%d-%H%M")


def should_skip(path: Path) -> bool:
    rel_parts = path.relative_to(ROOT).parts
    if any(part in EXCLUDED_NAMES for part in rel_parts):
        return True
    if path.suffix in EXCLUDED_SUFFIXES:
        return True
    return False


def iter_package_files() -> list[Path]:
    files: list[Path] = []
    for rel in INCLUDE_FILES:
        path = ROOT / rel
        if path.exists() and not should_skip(path):
            files.append(path)
    for rel in INCLUDE_DIRS:
        base = ROOT / rel
        if not base.exists():
            continue
        for path in base.rglob("*"):
            if path.is_file() and not should_skip(path):
                files.append(path)
    return sorted(set(files), key=lambda item: item.as_posix())


def read_text_if_small(path: Path) -> str:
    if path.stat().st_size > 2_000_000:
        return ""
    try:
        return path.read_text(encoding="utf-8-sig", errors="replace")
    except UnicodeDecodeError:
        return ""


def scan_secret_like(paths: list[Path]) -> list[str]:
    hits: list[str] = []
    secret_key_pattern = re.compile(r"sk-[A-Za-z0-9_-]{20,}")
    env_assignment_pattern = re.compile(r"^\s*MANUS_API_KEY\s*=\s*(.+?)\s*$", re.MULTILINE)
    for path in paths:
        rel = path.relative_to(ROOT).as_posix()
        text = read_text_if_small(path)
        if not text:
            continue
        if secret_key_pattern.search(text):
            hits.append(f"{rel}:sk-prefix")
        for match in env_assignment_pattern.finditer(text):
            value = match.group(1).strip().strip('"').strip("'")
            if rel == ".env.example":
                continue
            if value in {"", "...", "replace_with_your_manus_api_key", "your_real_key_here"}:
                continue
            hits.append(f"{rel}:MANUS_API_KEY_assignment")
    return hits


def write_zip(zip_path: Path, files: list[Path]) -> None:
    root_name = "concept-master-codefair"
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in files:
            rel = path.relative_to(ROOT).as_posix()
            archive.write(path, f"{root_name}/{rel}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Build a ConceptMaster handoff zip without secrets.")
    parser.add_argument("--stamp", default=now_stamp())
    args = parser.parse_args()

    DIST.mkdir(parents=True, exist_ok=True)
    files = iter_package_files()
    zip_name = f"concept-master-codefair-geonho-m6-handoff-{args.stamp}.zip"
    zip_path = DIST / zip_name
    write_zip(zip_path, files)

    rel_files = [path.relative_to(ROOT).as_posix() for path in files]
    missing_required = [rel for rel in REQUIRED_IN_ZIP if rel not in rel_files]
    forbidden_present = [rel for rel in FORBIDDEN_IN_ZIP if rel in rel_files]
    secret_like_hits = scan_secret_like(files)
    issues = []
    issues.extend(f"missing_required:{item}" for item in missing_required)
    issues.extend(f"forbidden_present:{item}" for item in forbidden_present)
    issues.extend(f"secret_like:{item}" for item in secret_like_hits)

    payload = {
        "schema": "concept_master_handoff_package_scan.v1",
        "generated_at": datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds"),
        "status": "PASS" if not issues else "FAIL",
        "zip_path": str(zip_path),
        "zip_name": zip_name,
        "zip_size_bytes": zip_path.stat().st_size,
        "file_count": len(rel_files),
        "required_in_zip": REQUIRED_IN_ZIP,
        "missing_required": missing_required,
        "forbidden_in_zip": FORBIDDEN_IN_ZIP,
        "forbidden_present": forbidden_present,
        "secret_like_hits": secret_like_hits,
        "issue_count": len(issues),
        "issues": issues,
        "human_verified": False,
        "live_boundary": {
            "publish_upload_delete_browser_write_opened": False,
            "browser_or_vm_authority_opened": False,
            "provider_default_changed": False,
            "training_run_performed": False,
            "git_stage_commit_push_performed": False,
        },
    }
    scan_path = DIST / "package_scan.v1.json"
    scan_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if not issues else 1


if __name__ == "__main__":
    raise SystemExit(main())
