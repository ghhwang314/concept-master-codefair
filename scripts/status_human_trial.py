#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from validate_human_trial_record import load_json, now_iso, validate_trial


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE_NAME = "human_trial_record.template.v1.json"


def resolve_path(value: str) -> Path:
    path = Path(value)
    return path if path.is_absolute() else ROOT / path


def find_latest_record(records_dir: Path) -> tuple[Path | None, int]:
    if not records_dir.exists():
        return None, 0
    candidates = [
        path for path in records_dir.glob("human_trial_record*.json")
        if path.is_file() and path.name != TEMPLATE_NAME
    ]
    candidates.extend([
        path for path in records_dir.glob("human_trial_record*.v1.json")
        if path.is_file() and path.name != TEMPLATE_NAME and path not in candidates
    ])
    if not candidates:
        return None, 0
    latest = max(candidates, key=lambda path: path.stat().st_mtime)
    return latest, len(candidates)


def build_payload(record_path: Path | None, record_count: int) -> dict:
    issues: list[str] = []
    validator_status = "NOT_RUN"
    human_verified = False
    record_status = ""
    tester = ""
    date_time = ""

    if record_path is None:
        m6_status = "WAITING_FOR_TRIAL_RECORD"
        next_action = "Run npm run trial:start -- --tester Geonho, then complete the checklist after actual use."
    else:
        record, load_issues = load_json(record_path)
        issues.extend(load_issues)
        if record is None:
            validator_status = "FAIL"
            m6_status = "INVALID_RECORD"
            next_action = "Fix or recreate the human trial record with npm run trial:start -- --tester Geonho."
        else:
            record_status = str(record.get("record_status", ""))
            tester = str(record.get("run", {}).get("tester", ""))
            date_time = str(record.get("run", {}).get("date_time", ""))
            issues.extend(validate_trial(record))
            validator_status = "PASS" if not issues else "FAIL"
            human_verified = bool(record.get("human_verified") is True and not issues)
            if human_verified:
                m6_status = "HUMAN_VERIFIED"
                next_action = "Use the validated record as M6 evidence; do not change it without rerunning trial:status."
            else:
                m6_status = "NEEDS_RECORD_COMPLETION"
                next_action = "Fill the missing checklist fields after real use, then run npm run trial:validate -- --record <record>."

    return {
        "schema": "concept_master_human_trial_status.v1",
        "generated_at": now_iso(),
        "status": "PASS",
        "m6_status": m6_status,
        "record_path": str(record_path) if record_path else "",
        "record_count": record_count,
        "record_status": record_status,
        "tester": tester,
        "date_time": date_time,
        "validator_status": validator_status,
        "issue_count": len(issues),
        "issues": issues,
        "human_verified": human_verified,
        "next_action": next_action,
        "live_boundary": {
            "publish_upload_delete_browser_write_opened": False,
            "browser_or_vm_authority_opened": False,
            "provider_default_changed": False,
            "training_run_performed": False,
            "git_stage_commit_push_performed": False,
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Report current ConceptMaster M6 human trial status.")
    parser.add_argument("--record", default="", help="Optional record path. If omitted, the latest trial record is used.")
    parser.add_argument("--records-dir", default=str(ROOT / "trial_records"))
    args = parser.parse_args()

    if args.record:
        record_path = resolve_path(args.record)
        record_count = 1 if record_path.exists() else 0
    else:
        records_dir = resolve_path(args.records_dir)
        record_path, record_count = find_latest_record(records_dir)

    payload = build_payload(record_path, record_count)
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
