#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path


REQUIRED_FILES = [
    "docs/WORK_LANES.md",
    "docs/PRD.md",
    "docs/ARCHITECTURE.md",
    "docs/ADR.md",
    ".claude/commands/harness.md",
    ".claude/commands/review.md",
    ".claude/settings.json",
    "scripts/execute.py",
    "scripts/hooks/validate_phase.py",
    "phases/CURRENT_PHASE.md",
]
CONTRACT_FILES = ["CLAUDE.md", "AGENTS.md"]
REQUIRED_PHASE_HEADINGS = [
    "## Objective",
    "## Scope",
    "## Read First",
    "## Harness Command",
    "## Done Criteria",
    "## Live Boundary",
    "## Next Action",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate token-saving phase harness.")
    parser.add_argument("--root", default=".")
    args = parser.parse_args()
    root = Path(args.root).resolve()
    issues: list[str] = []

    if not any((root / rel).exists() for rel in CONTRACT_FILES):
        issues.append("missing_contract_file:CLAUDE.md_or_AGENTS.md")
    for rel in REQUIRED_FILES:
        if not (root / rel).exists():
            issues.append(f"missing_file:{rel}")

    phase_path = root / "phases" / "CURRENT_PHASE.md"
    phase_text = phase_path.read_text(encoding="utf-8-sig") if phase_path.exists() else ""
    for heading in REQUIRED_PHASE_HEADINGS:
        if heading not in phase_text:
            issues.append(f"missing_phase_heading:{heading}")
    for key in [
        "publish_upload_delete_browser_write_opened",
        "browser_or_vm_authority_opened",
        "provider_default_changed",
        "training_run_performed",
        "git_stage_commit_push_performed",
    ]:
        if f"{key}: true" in phase_text.lower():
            issues.append(f"live_boundary_open:{key}")

    payload = {
        "schema": "token_harness_phase_validation.v2",
        "generated_at": now_iso(),
        "status": "PASS" if not issues else "FAIL",
        "issue_count": len(issues),
        "issues": issues,
        "root": str(root),
        "live_boundary": {
            "publish_upload_delete_browser_write_opened": False,
            "browser_or_vm_authority_opened": False,
            "provider_default_changed": False,
            "training_run_performed": False,
            "git_stage_commit_push_performed": False,
        },
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if not issues else 1


if __name__ == "__main__":
    raise SystemExit(main())
