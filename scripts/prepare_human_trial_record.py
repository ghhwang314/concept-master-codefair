#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = ROOT / "trial_records" / "human_trial_record.template.v1.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def filename_stamp(value: str) -> str:
    cleaned = re.sub(r"[^0-9A-Za-z가-힣_-]+", "_", value.strip())
    cleaned = cleaned.strip("_")
    return cleaned or "trial"


def unique_path(output_dir: Path, date_time: str, label: str) -> Path:
    stamp = filename_stamp(date_time.replace(":", "").replace("+", "_").replace("-", "").replace("T", "_"))
    suffix = f"_{filename_stamp(label)}" if label else ""
    candidate = output_dir / f"human_trial_record_{stamp}{suffix}.v1.json"
    counter = 2
    while candidate.exists():
        candidate = output_dir / f"human_trial_record_{stamp}{suffix}_{counter}.v1.json"
        counter += 1
    return candidate


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare a dated ConceptMaster M6 human trial record.")
    parser.add_argument("--tester", default="", help="Tester name, for example Geonho or owner.")
    parser.add_argument("--date-time", default=now_iso(), help="Trial date/time in ISO-like text.")
    parser.add_argument("--label", default="", help="Optional short filename label.")
    parser.add_argument("--output-dir", default=str(ROOT / "trial_records"))
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    if not output_dir.is_absolute():
        output_dir = ROOT / output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    record = json.loads(TEMPLATE.read_text(encoding="utf-8-sig"))
    record["record_status"] = "RECORDED"
    record["human_verified"] = False
    record["run"]["date_time"] = args.date_time
    record["run"]["tester"] = args.tester

    record_path = unique_path(output_dir, args.date_time, args.label or args.tester)
    record_path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    validate_command = [
        "python",
        "scripts\\validate_human_trial_record.py",
        "--record",
        str(record_path.relative_to(ROOT) if record_path.is_relative_to(ROOT) else record_path),
        "--mode",
        "trial",
    ]
    payload = {
        "schema": "concept_master_human_trial_prepare_result.v1",
        "status": "PASS",
        "record_path": str(record_path),
        "record_status": record["record_status"],
        "human_verified": record["human_verified"],
        "validate_command": validate_command,
        "next_action": "Fill the copied record after actual Geonho or owner use, then run the validate command.",
        "live_boundary": {
            "publish_upload_delete_browser_write_opened": False,
            "browser_or_vm_authority_opened": False,
            "provider_default_changed": False,
            "training_run_performed": False,
            "git_stage_commit_push_performed": False,
        },
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
