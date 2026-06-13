#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PASS_FAIL_FIELDS = [
    ("run", "npm_test_result"),
    ("run", "browser_load_result"),
    ("demo", "demo_reached_data_screen"),
    ("demo", "attempt_log_shown"),
    ("demo", "concept_summary_shown"),
    ("demo", "recommendation_trace_shown"),
    ("demo", "problem_bank_qa_shown"),
    ("demo", "generated_problem_qa_notice_shown_when_needed"),
    ("manus_and_fallback", "fallback_demo_finished"),
    ("manus_and_fallback", "needs_review_or_qa_issue_shown"),
]

REQUIRED_EXPLANATION_FIELDS = [
    "why_features_were_built",
    "what_changed_after_wrong_answer",
    "what_ai_helped_with",
    "why_retry_uses_same_concept",
    "what_data_screen_proves",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def load_json(path: Path) -> tuple[dict[str, Any] | None, list[str]]:
    try:
        return json.loads(path.read_text(encoding="utf-8-sig")), []
    except FileNotFoundError:
        return None, [f"record_not_found:{path}"]
    except json.JSONDecodeError as error:
        return None, [f"invalid_json:{error}"]


def text_has_secret(value: Any) -> bool:
    text = json.dumps(value, ensure_ascii=False)
    return "sk-" in text or "MANUS_API_KEY=" in text


def get_nested(record: dict[str, Any], section: str, key: str) -> Any:
    return record.get(section, {}).get(key)


def require_non_empty(record: dict[str, Any], section: str, key: str, issues: list[str]) -> None:
    value = get_nested(record, section, key)
    if not isinstance(value, str) or not value.strip():
        issues.append(f"missing_required_field:{section}.{key}")


def validate_structure(record: dict[str, Any]) -> list[str]:
    issues: list[str] = []
    if record.get("schema") != "concept_master_human_trial_record.v1":
        issues.append("schema_mismatch")
    if record.get("record_status") not in {"TEMPLATE", "RECORDED"}:
        issues.append("record_status_must_be_TEMPLATE_or_RECORDED")
    if not isinstance(record.get("human_verified"), bool):
        issues.append("human_verified_must_be_boolean")
    if get_nested(record, "baseline", "expected_auto_verified_baseline") != "44 PASS / 0 FAIL":
        issues.append("baseline_must_match_current_44_pass")
    if not isinstance(record.get("issues"), list):
        issues.append("issues_must_be_array")

    for section in ["run", "demo", "explanation", "manus_and_fallback", "final"]:
        if not isinstance(record.get(section), dict):
            issues.append(f"missing_section:{section}")

    if text_has_secret(record):
        issues.append("secret_like_text_found")
    return issues


def validate_template(record: dict[str, Any]) -> list[str]:
    issues = validate_structure(record)
    if record.get("record_status") != "TEMPLATE":
        issues.append("template_mode_requires_TEMPLATE_status")
    if record.get("human_verified") is not False:
        issues.append("template_must_not_be_human_verified")
    return issues


def validate_trial(record: dict[str, Any]) -> list[str]:
    issues = validate_structure(record)
    if record.get("record_status") != "RECORDED":
        issues.append("trial_mode_requires_RECORDED_status")

    for section, key in [
        ("run", "date_time"),
        ("run", "tester"),
        ("run", "ai_status_top_bar"),
        ("demo", "improvement_rate_shown"),
        ("final", "human_trial_decision"),
        ("final", "reason"),
        ("final", "next_one_action"),
    ]:
        require_non_empty(record, section, key, issues)

    for section, key in PASS_FAIL_FIELDS:
        value = get_nested(record, section, key)
        if value not in {"PASS", "FAIL", "N/A"}:
            issues.append(f"expected_PASS_FAIL_or_NA:{section}.{key}")

    for key in REQUIRED_EXPLANATION_FIELDS:
        require_non_empty(record, "explanation", key, issues)

    decision = get_nested(record, "final", "human_trial_decision")
    if decision not in {"PASS", "FAIL"}:
        issues.append("final.human_trial_decision_must_be_PASS_or_FAIL")

    human_verified = record.get("human_verified")
    if decision == "PASS" and human_verified is not True:
        issues.append("PASS_trial_must_set_human_verified_true")
    if decision == "FAIL" and human_verified is not False:
        issues.append("FAIL_trial_must_keep_human_verified_false")

    weak_explanation = "ai made a quiz"
    explanation_text = " ".join(str(record.get("explanation", {}).get(key, "")) for key in REQUIRED_EXPLANATION_FIELDS).lower()
    if weak_explanation in explanation_text:
        issues.append("weak_explanation_ai_made_a_quiz")

    return issues


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate ConceptMaster M6 human trial records.")
    parser.add_argument("--record", required=True)
    parser.add_argument("--mode", choices=["template", "trial"], default="trial")
    args = parser.parse_args()

    record_path = Path(args.record)
    if not record_path.is_absolute():
        record_path = Path.cwd() / record_path
    record, load_issues = load_json(record_path)
    issues = list(load_issues)
    if record is not None:
        issues.extend(validate_template(record) if args.mode == "template" else validate_trial(record))

    human_verified = bool(record and record.get("human_verified") is True and not issues and args.mode == "trial")
    payload = {
        "schema": "concept_master_human_trial_record_validation.v1",
        "generated_at": now_iso(),
        "status": "PASS" if not issues else "FAIL",
        "mode": args.mode,
        "record_path": str(record_path),
        "issue_count": len(issues),
        "issues": issues,
        "human_verified": human_verified,
        "live_boundary": {
            "publish_upload_delete_browser_write_opened": False,
            "browser_or_vm_authority_opened": False,
            "provider_default_changed": False,
            "training_run_performed": False,
            "git_stage_commit_push_performed": False
        }
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0 if not issues else 1


if __name__ == "__main__":
    raise SystemExit(main())
