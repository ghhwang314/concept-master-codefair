#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

from prepare_human_trial_record import TEMPLATE, now_iso, unique_path


ROOT = Path(__file__).resolve().parents[1]


def rel_or_abs(path: Path) -> str:
    return str(path.relative_to(ROOT) if path.is_relative_to(ROOT) else path)


def main() -> int:
    parser = argparse.ArgumentParser(description="Prepare a human trial session packet without claiming Human-Verified.")
    parser.add_argument("--tester", default="Geonho")
    parser.add_argument("--date-time", default=now_iso())
    parser.add_argument("--label", default="human-trial")
    parser.add_argument("--output-dir", default=str(ROOT / "trial_records"))
    parser.add_argument("--port", type=int, default=4173)
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
        "npm",
        "run",
        "trial:validate",
        "--",
        "--record",
        rel_or_abs(record_path),
    ]
    payload = {
        "schema": "concept_master_human_trial_start_packet.v1",
        "status": "PASS",
        "record_path": str(record_path),
        "record_status": record["record_status"],
        "human_verified": False,
        "app_url": f"http://localhost:{args.port}",
        "server_command": ["npm", "start"],
        "server_environment": {
            "PORT": str(args.port),
            "MANUS_CREDIT_SAVER_MODE": "true",
        },
        "checklist_path": str(ROOT / "GEONHO_HUMAN_TRIAL_CHECKLIST.md"),
        "trial_steps": [
            "Run npm test and record PASS or FAIL.",
            "Run npm start with MANUS_CREDIT_SAVER_MODE=true.",
            "Open the app URL and run the 30-second demo once.",
            "Fill this JSON record from the checklist after actual use.",
            "Run the validate_command and keep human_verified false unless it passes.",
        ],
        "validate_command": validate_command,
        "next_action": "Start the app, have Geonho or the owner use it once, fill the record, then run validate_command.",
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
