#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def run_command(name: str, args: list[str], timeout: int = 120) -> dict:
    started_at = now_iso()
    resolved_args = list(args)
    resolved = shutil.which(resolved_args[0])
    if resolved:
        resolved_args[0] = resolved
    try:
        result = subprocess.run(
            resolved_args,
            cwd=str(ROOT),
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            timeout=timeout,
        )
        return {
            "name": name,
            "status": "PASS" if result.returncode == 0 else "FAIL",
            "exit_code": result.returncode,
            "started_at": started_at,
            "command": resolved_args,
            "stdout_tail": result.stdout[-4000:],
            "stderr_tail": result.stderr[-4000:],
        }
    except FileNotFoundError as error:
        return {
            "name": name,
            "status": "FAIL",
            "exit_code": 127,
            "started_at": started_at,
            "command": resolved_args,
            "stdout_tail": "",
            "stderr_tail": f"command_not_found:{args[0]}:{error}",
        }
    except subprocess.TimeoutExpired as error:
        return {
            "name": name,
            "status": "FAIL",
            "exit_code": 124,
            "started_at": started_at,
            "command": resolved_args,
            "stdout_tail": (error.stdout or "")[-4000:] if isinstance(error.stdout, str) else "",
            "stderr_tail": f"timeout_after_seconds={timeout}",
        }


def write_m0_baseline(commands: list[dict], report_path: Path) -> Path:
    baseline_dir = ROOT / "reports" / "dtt_baseline"
    baseline_dir.mkdir(parents=True, exist_ok=True)
    baseline_path = baseline_dir / "M0_BASELINE_STATUS.v1.json"
    payload = {
        "schema": "concept_master_m0_baseline_status.v1",
        "generated_at": now_iso(),
        "status": "PASS" if all(command["status"] == "PASS" for command in commands) else "FAIL",
        "definition": "Current ConceptMaster baseline is fixed for customer-usable Codex/Antigravity handoff.",
        "tests": {
            "harness_phase": next((command["status"] for command in commands if command["name"] == "phase_harness"), "MISSING"),
            "node_syntax": next((command["status"] for command in commands if command["name"] == "node_check_app"), "MISSING"),
            "product_tests": next((command["status"] for command in commands if command["name"] == "npm_test"), "MISSING"),
            "human_trial_template_gate": next((command["status"] for command in commands if command["name"] == "human_trial_template_gate"), "MISSING"),
        },
        "trace": {
            "harness_report": str(report_path),
            "menu_browser_report": "QA_EVIDENCE/menu_layout_browser_check_20260608_r2.json",
            "duolingo_browser_report": "QA_EVIDENCE/duolingo_style_browser_check_20260608_r2.json",
            "submission_prompt": "SUBMISSION_DOCS/DTT_CUSTOMER_USABLE_EXECUTION_PROMPT_20260608.md",
            "readiness_note": "Human-Verified remains false until Geonho completes a real use trial.",
        },
        "live_boundary": {
            "publish_upload_delete_browser_write_opened": False,
            "browser_or_vm_authority_opened": False,
            "provider_default_changed": False,
            "training_run_performed": False,
            "git_stage_commit_push_performed": False,
        },
    }
    baseline_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return baseline_path


def write_m2_api_environment_report(commands: list[dict], report_path: Path) -> Path:
    api_dir = ROOT / "reports" / "api_environment"
    api_dir.mkdir(parents=True, exist_ok=True)
    api_path = api_dir / "M2_API_ENVIRONMENT_STATUS.v1.json"
    issues: list[str] = []

    env_example = (ROOT / ".env.example").read_text(encoding="utf-8-sig") if (ROOT / ".env.example").exists() else ""
    if "MANUS_API_KEY=replace_with_your_manus_api_key" not in env_example:
        issues.append("env_example_missing_placeholder_key")
    if "MANUS_CREDIT_SAVER_MODE=true" not in env_example:
        issues.append("env_example_credit_saver_not_default_true")

    browser_entry_files = [
        "index.html",
        "styles.css",
        "src/app.js",
        "src/demoContract.js",
        "src/diagnosis.js",
        "src/generation.js",
        "src/learning.js",
        "src/misconceptionMap.js",
        "src/presentationPlan.js",
        "src/problems.js",
        "src/readinessAudit.js",
        "src/reviewScheduler.js",
        "src/staticSecurity.js",
    ]
    browser_secret_refs: list[str] = []
    bearer_refs: list[str] = []
    for rel in browser_entry_files:
        path = ROOT / rel
        if not path.exists():
            issues.append(f"browser_entry_missing:{rel}")
            continue
        text = path.read_text(encoding="utf-8-sig", errors="replace")
        if "MANUS_API_KEY" in text:
            browser_secret_refs.append(rel)
        if "Bearer " in text:
            bearer_refs.append(rel)
    if browser_secret_refs:
        issues.append("browser_entry_references_MANUS_API_KEY:" + ",".join(browser_secret_refs))
    if bearer_refs:
        issues.append("browser_entry_contains_bearer_auth:" + ",".join(bearer_refs))

    required_source_markers = {
        "src/server.mjs": ["shouldUseLiveManus", "fallbackReason: \"credit_saver_mode\"", "useLiveAi"],
        "src/manusClient.js": ["x-manus-api-key", "structured_output_schema", "MANUS_API_KEY is not configured"],
        "src/manusCreditPolicy.js": ["MANUS_CREDIT_SAVER_MODE", "requestedLiveAi === true"],
        "src/demoContract.js": ["rule_based_fallback"],
    }
    for rel, markers in required_source_markers.items():
        path = ROOT / rel
        if not path.exists():
            issues.append(f"required_source_missing:{rel}")
            continue
        text = path.read_text(encoding="utf-8-sig", errors="replace")
        for marker in markers:
            if marker not in text:
                issues.append(f"required_marker_missing:{rel}:{marker}")

    payload = {
        "schema": "concept_master_m2_api_environment_status.v1",
        "generated_at": now_iso(),
        "status": "PASS" if not issues and all(command["status"] == "PASS" for command in commands) else "FAIL",
        "definition": "Manus API configuration is server-only, credit-saving by default, and fallback-safe for local demos.",
        "issue_count": len(issues),
        "issues": issues,
        "checks": {
            "env_example_placeholder": "PASS" if "env_example_missing_placeholder_key" not in issues else "FAIL",
            "credit_saver_default": "PASS" if "env_example_credit_saver_not_default_true" not in issues else "FAIL",
            "browser_entry_secret_refs": browser_secret_refs,
            "browser_entry_bearer_refs": bearer_refs,
            "product_tests": next((command["status"] for command in commands if command["name"] == "npm_test"), "MISSING"),
        },
        "trace": {
            "harness_report": str(report_path),
            "readme": "README.md",
            "live_verification_note": "LIVE_MANUS_VERIFICATION.md",
            "api_doc": "docs/API_ENVIRONMENT.md",
        },
        "live_boundary": {
            "publish_upload_delete_browser_write_opened": False,
            "browser_or_vm_authority_opened": False,
            "provider_default_changed": False,
            "training_run_performed": False,
            "git_stage_commit_push_performed": False,
        },
    }
    api_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return api_path


def run_validate() -> int:
    validator = ROOT / "scripts" / "hooks" / "validate_phase.py"
    human_trial_validator = ROOT / "scripts" / "validate_human_trial_record.py"
    handoff_package_scan = ROOT / "dist" / "package_scan.v1.json"
    commands = [
        run_command("phase_harness", [sys.executable, str(validator), "--root", str(ROOT)], timeout=60),
        run_command("node_check_app", ["node", "--check", "src/app.js"], timeout=30),
        run_command("npm_test", ["npm", "test"], timeout=120),
        run_command(
            "human_trial_template_gate",
            [
                sys.executable,
                str(human_trial_validator),
                "--record",
                "trial_records/human_trial_record.template.v1.json",
                "--mode",
                "template",
            ],
            timeout=30,
        ),
    ]
    reports = ROOT / "reports" / "token_harness"
    reports.mkdir(parents=True, exist_ok=True)
    report_path = reports / "latest_status.v1.json"
    status = "PASS" if all(command["status"] == "PASS" for command in commands) else "FAIL"
    baseline_path = write_m0_baseline(commands, report_path)
    api_environment_path = write_m2_api_environment_report(commands, report_path)
    payload = {
        "schema": "token_harness_execute_result.v2",
        "generated_at": now_iso(),
        "status": status,
        "commands": commands,
        "issue_count": sum(1 for command in commands if command["status"] != "PASS"),
        "baseline_report": str(baseline_path),
        "api_environment_report": str(api_environment_path),
        "handoff_package_scan": str(handoff_package_scan) if handoff_package_scan.exists() else "",
        "live_boundary": {
            "publish_upload_delete_browser_write_opened": False,
            "browser_or_vm_authority_opened": False,
            "provider_default_changed": False,
            "training_run_performed": False,
            "git_stage_commit_push_performed": False,
        },
    }
    report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": payload["status"],
        "report_path": str(report_path),
        "baseline_report": str(baseline_path),
        "api_environment_report": str(api_environment_path),
    }, ensure_ascii=False))
    return 0 if status == "PASS" else 1


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the compact token harness.")
    parser.add_argument("command", choices=["validate", "status"], nargs="?", default="validate")
    args = parser.parse_args()
    if args.command in {"validate", "status"}:
        return run_validate()
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
