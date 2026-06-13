import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const PASS_FAIL_FIELDS = [
  ["run", "npm_test_result"],
  ["run", "browser_load_result"],
  ["demo", "demo_reached_data_screen"],
  ["demo", "attempt_log_shown"],
  ["demo", "concept_summary_shown"],
  ["demo", "recommendation_trace_shown"],
  ["demo", "problem_bank_qa_shown"],
  ["demo", "generated_problem_qa_notice_shown_when_needed"],
  ["manus_and_fallback", "fallback_demo_finished"],
  ["manus_and_fallback", "needs_review_or_qa_issue_shown"],
];

const REQUIRED_EXPLANATION_FIELDS = [
  "why_features_were_built",
  "what_changed_after_wrong_answer",
  "what_ai_helped_with",
  "why_retry_uses_same_concept",
  "what_data_screen_proves",
];

function now_iso() {
  const date = new Date();
  const tzOffset = -date.getTimezoneOffset();
  const diff = tzOffset >= 0 ? '+' : '-';
  const pad = (num) => String(num).padStart(2, '0');
  
  const formattedDate = date.getFullYear() +
    '-' + pad(date.getMonth() + 1) +
    '-' + pad(date.getDate()) +
    'T' + pad(date.getHours()) +
    ':' + pad(date.getMinutes()) +
    ':' + pad(date.getSeconds());
    
  const absOffset = Math.abs(tzOffset);
  const hours = pad(Math.floor(absOffset / 60));
  const mins = pad(absOffset % 60);
  
  return `${formattedDate}${diff}${hours}:${mins}`;
}

function load_json(recordPath) {
  try {
    const text = fs.readFileSync(recordPath, 'utf8');
    const cleanText = text.replace(/^\uFEFF/, '');
    return [JSON.parse(cleanText), []];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [null, [`record_not_found:${recordPath}`]];
    }
    return [null, [`invalid_json:${error.message}`]];
  }
}

function text_has_secret(value) {
  const text = JSON.stringify(value);
  return text.includes("sk-") || text.includes("MANUS_API_KEY=");
}

function get_nested(record, section, key) {
  return record && record[section] ? record[section][key] : undefined;
}

function require_non_empty(record, section, key, issues) {
  const value = get_nested(record, section, key);
  if (typeof value !== 'string' || !value.trim()) {
    issues.push(`missing_required_field:${section}.${key}`);
  }
}

export function validate_structure(record) {
  const issues = [];
  if (!record) return issues;
  if (record.schema !== "concept_master_human_trial_record.v1") {
    issues.push("schema_mismatch");
  }
  if (record.record_status !== "TEMPLATE" && record.record_status !== "RECORDED") {
    issues.push("record_status_must_be_TEMPLATE_or_RECORDED");
  }
  if (typeof record.human_verified !== 'boolean') {
    issues.push("human_verified_must_be_boolean");
  }
  if (get_nested(record, "baseline", "expected_auto_verified_baseline") !== "44 PASS / 0 FAIL") {
    issues.push("baseline_must_match_current_44_pass");
  }
  if (!Array.isArray(record.issues)) {
    issues.push("issues_must_be_array");
  }

  const sections = ["run", "demo", "explanation", "manus_and_fallback", "final"];
  for (const section of sections) {
    if (typeof record[section] !== 'object' || record[section] === null) {
      issues.push(`missing_section:${section}`);
    }
  }

  if (text_has_secret(record)) {
    issues.push("secret_like_text_found");
  }
  return issues;
}

export function validate_template(record) {
  const issues = validate_structure(record);
  if (!record) return issues;
  if (record.record_status !== "TEMPLATE") {
    issues.push("template_mode_requires_TEMPLATE_status");
  }
  if (record.human_verified !== false) {
    issues.push("template_must_not_be_human_verified");
  }
  return issues;
}

export function validate_trial(record) {
  const issues = validate_structure(record);
  if (!record) return issues;
  if (record.record_status !== "RECORDED") {
    issues.push("trial_mode_requires_RECORDED_status");
  }

  const requiredFields = [
    ["run", "date_time"],
    ["run", "tester"],
    ["run", "ai_status_top_bar"],
    ["demo", "improvement_rate_shown"],
    ["final", "human_trial_decision"],
    ["final", "reason"],
    ["final", "next_one_action"],
  ];

  for (const [section, key] of requiredFields) {
    require_non_empty(record, section, key, issues);
  }

  for (const [section, key] of PASS_FAIL_FIELDS) {
    const value = get_nested(record, section, key);
    if (value !== "PASS" && value !== "FAIL" && value !== "N/A") {
      issues.push(`expected_PASS_FAIL_or_NA:${section}.${key}`);
    }
  }

  for (const key of REQUIRED_EXPLANATION_FIELDS) {
    require_non_empty(record, "explanation", key, issues);
  }

  const decision = get_nested(record, "final", "human_trial_decision");
  if (decision !== "PASS" && decision !== "FAIL") {
    issues.push("final.human_trial_decision_must_be_PASS_or_FAIL");
  }

  const human_verified = record.human_verified;
  if (decision === "PASS" && human_verified !== true) {
    issues.push("PASS_trial_must_set_human_verified_true");
  }
  if (decision === "FAIL" && human_verified !== false) {
    issues.push("FAIL_trial_must_keep_human_verified_false");
  }

  const weak_explanation = "ai made a quiz";
  let explanation_text = REQUIRED_EXPLANATION_FIELDS
    .map(key => String(get_nested(record, "explanation", key) || ""))
    .join(" ")
    .toLowerCase();
  if (explanation_text.includes(weak_explanation)) {
    issues.push("weak_explanation_ai_made_a_quiz");
  }

  return issues;
}

// 실행 진입점
const isMain = process.argv[1] && (
  fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1]) ||
  process.argv[1].endsWith('validate_human_trial_record.js')
);

if (isMain) {
  try {
    const { values } = parseArgs({
      options: {
        record: { type: 'string' },
        mode: { type: 'string', default: 'trial' }
      }
    });

    if (!values.record) {
      console.error("Error: --record is required");
      process.exit(1);
    }

    let recordPath = values.record;
    if (!path.isAbsolute(recordPath)) {
      recordPath = path.resolve(process.cwd(), recordPath);
    }

    const [record, load_issues] = load_json(recordPath);
    const issues = [...load_issues];
    if (record !== null) {
      if (values.mode === 'template') {
        issues.push(...validate_template(record));
      } else {
        issues.push(...validate_trial(record));
      }
    }

    const human_verified = record && record.human_verified === true && issues.length === 0 && values.mode === 'trial';
    const payload = {
      schema: "concept_master_human_trial_record_validation.v1",
      generated_at: now_iso(),
      status: issues.length === 0 ? "PASS" : "FAIL",
      mode: values.mode,
      record_path: recordPath,
      issue_count: issues.length,
      issues: issues,
      human_verified: !!human_verified,
      live_boundary: {
        publish_upload_delete_browser_write_opened: false,
        browser_or_vm_authority_opened: false,
        provider_default_changed: false,
        training_run_performed: false,
        git_stage_commit_push_performed: false
      }
    };

    console.log(JSON.stringify(payload, null, 2));
    process.exit(issues.length === 0 ? 0 : 1);
  } catch (err) {
    console.error("Error executing validator: " + err.message);
    process.exit(1);
  }
}
