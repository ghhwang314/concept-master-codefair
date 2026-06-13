#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = ROOT / "QA_EVIDENCE" / "m6_handoff_zip_smoke_20260609.json"
REQUIRED_EXTRACTED = [
    "package.json",
    "README.md",
    "HANDOFF_GEONHO.md",
    ".env.example",
    "index.html",
    "scripts/prepare_human_trial_record.py",
    "scripts/start_human_trial.py",
    "scripts/status_human_trial.py",
    "scripts/validate_human_trial_record.py",
    "trial_records/human_trial_record.template.v1.json",
    "src/server.mjs",
    "src/app.js",
    "tests/concept-master.test.mjs",
]
FORBIDDEN_EXTRACTED = [
    ".env",
    "server.err.log",
    "server.out.log",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def load_latest_zip() -> Path:
    scan_path = ROOT / "dist" / "package_scan.v1.json"
    scan = json.loads(scan_path.read_text(encoding="utf-8-sig"))
    return Path(scan["zip_path"])


def resolve_executable(name: str) -> str:
    direct = shutil.which(name)
    if direct:
        return direct
    if os.name == "nt" and not name.lower().endswith(".cmd"):
        cmd = shutil.which(f"{name}.cmd")
        if cmd:
            return cmd
    return name


def run_command(name: str, args: list[str], cwd: Path, timeout: int = 120, env: dict[str, str] | None = None) -> dict:
    started_at = now_iso()
    resolved_args = list(args)
    if resolved_args:
        resolved_args[0] = resolve_executable(resolved_args[0])
    try:
        result = subprocess.run(
            resolved_args,
            cwd=str(cwd),
            text=True,
            encoding="utf-8",
            errors="replace",
            capture_output=True,
            timeout=timeout,
            env=env,
        )
        return {
            "name": name,
            "status": "PASS" if result.returncode == 0 else "FAIL",
            "exit_code": result.returncode,
            "started_at": started_at,
            "command": resolved_args,
            "stdout_tail": result.stdout[-3000:],
            "stderr_tail": result.stderr[-3000:],
        }
    except subprocess.TimeoutExpired:
        return {
            "name": name,
            "status": "FAIL",
            "exit_code": 124,
            "started_at": started_at,
            "command": resolved_args,
            "stdout_tail": "",
            "stderr_tail": f"timeout_after_seconds={timeout}",
        }


def find_project_root(extract_dir: Path) -> Path:
    candidates = [path for path in extract_dir.iterdir() if path.is_dir() and (path / "package.json").exists()]
    if not candidates:
        raise RuntimeError("extracted_project_root_not_found")
    return candidates[0]


def http_request(url: str, method: str = "GET", body: dict | None = None, timeout: int = 5) -> tuple[int, str]:
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["content-type"] = "application/json"
    request = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.status, response.read().decode("utf-8", errors="replace")


def wait_for_server(port: int, seconds: int = 12) -> tuple[bool, str]:
    last_error = ""
    for _ in range(seconds * 2):
        try:
            status, text = http_request(f"http://127.0.0.1:{port}/", timeout=2)
            if status == 200 and any(marker in text for marker in ("AI 오답 코치", "오답 DNA", "dna-path-section")):
                return True, "root_loaded"
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = str(error)
        time.sleep(0.5)
    return False, last_error or "server_not_ready"


def smoke_server(project_root: Path, port: int) -> dict:
    env = os.environ.copy()
    env["PORT"] = str(port)
    env["MANUS_CREDIT_SAVER_MODE"] = "true"
    node = resolve_executable("node")
    process = subprocess.Popen(
        [node, "src/server.mjs"],
        cwd=str(project_root),
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env=env,
    )
    try:
        ready, ready_detail = wait_for_server(port)
        api_status = "NOT_RUN"
        api_detail = ""
        if ready:
            status, body = http_request(
                f"http://127.0.0.1:{port}/api/diagnose",
                method="POST",
                body={"questionId": "math_frac_001", "selectedAnswer": 0, "useLiveAi": False},
            )
            parsed = json.loads(body)
            source = parsed.get("source")
            fallback_reason = parsed.get("creditPolicy", {}).get("fallbackReason") or parsed.get("fallbackReason")
            api_status = "PASS" if status == 200 and source == "rule_based_fallback" else "FAIL"
            api_detail = f"status={status};source={source};fallbackReason={fallback_reason}"
        return {
            "name": "npm_start_http_smoke",
            "status": "PASS" if ready and api_status == "PASS" else "FAIL",
            "ready": ready,
            "ready_detail": ready_detail,
            "api_status": api_status,
            "api_detail": api_detail,
        }
    finally:
        process.terminate()
        try:
            stdout, stderr = process.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            stdout, stderr = process.communicate(timeout=5)
        if process.returncode is None:
            process.kill()


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract and smoke test a ConceptMaster handoff zip.")
    parser.add_argument("--zip", default="")
    parser.add_argument("--report", default=str(DEFAULT_REPORT))
    parser.add_argument("--port", type=int, default=4187)
    args = parser.parse_args()

    zip_path = Path(args.zip) if args.zip else load_latest_zip()
    if not zip_path.is_absolute():
        zip_path = ROOT / zip_path
    report_path = Path(args.report)
    if not report_path.is_absolute():
        report_path = ROOT / report_path
    report_path.parent.mkdir(parents=True, exist_ok=True)

    temp_dir = Path(tempfile.mkdtemp(prefix="conceptmaster-zip-smoke-"))
    commands: list[dict] = []
    issues: list[str] = []
    project_root = None
    try:
        with zipfile.ZipFile(zip_path, "r") as archive:
            archive.extractall(temp_dir)
        project_root = find_project_root(temp_dir)

        missing = [rel for rel in REQUIRED_EXTRACTED if not (project_root / rel).exists()]
        forbidden = [rel for rel in FORBIDDEN_EXTRACTED if (project_root / rel).exists()]
        issues.extend(f"missing_required:{rel}" for rel in missing)
        issues.extend(f"forbidden_present:{rel}" for rel in forbidden)

        commands.append(run_command("npm_test_extracted", ["npm", "test"], project_root, timeout=120))
        commands.append(run_command("trial_validate_template_extracted", ["npm", "run", "trial:validate-template"], project_root, timeout=30))
        commands.append(run_command(
            "trial_prepare_extracted",
            ["npm", "run", "trial:prepare", "--", "--tester", "ZipSmoke", "--date-time", "2026-06-09T19:00:00+09:00", "--label", "zip-smoke"],
            project_root,
            timeout=30,
        ))
        commands.append(run_command(
            "trial_start_packet_extracted",
            ["npm", "run", "trial:start", "--", "--tester", "ZipSmoke", "--date-time", "2026-06-09T19:00:00+09:00", "--label", "zip-smoke-start", "--port", str(args.port)],
            project_root,
            timeout=30,
        ))
        commands.append(run_command("trial_status_extracted", ["npm", "run", "trial:status"], project_root, timeout=30))
        commands.append(smoke_server(project_root, args.port))
    except Exception as error:
        issues.append(f"smoke_exception:{type(error).__name__}:{error}")
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

    command_failures = [item["name"] for item in commands if item.get("status") != "PASS"]
    issues.extend(f"command_failed:{name}" for name in command_failures)
    payload = {
        "schema": "concept_master_handoff_zip_smoke.v1",
        "generated_at": now_iso(),
        "status": "PASS" if not issues else "FAIL",
        "zip_path": str(zip_path),
        "extracted_project_root_name": project_root.name if project_root else "",
        "required_extracted": REQUIRED_EXTRACTED,
        "forbidden_extracted": FORBIDDEN_EXTRACTED,
        "commands": commands,
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
    report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=True, indent=2))
    return 0 if payload["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
