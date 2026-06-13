import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { validate_trial } from './validate_human_trial_record.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE_NAME = "human_trial_record.template.v1.json";

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

function resolve_path(value) {
  if (path.isAbsolute(value)) {
    return value;
  }
  return path.resolve(ROOT, value);
}

function find_latest_record(recordsDir) {
  if (!fs.existsSync(recordsDir)) {
    return [null, 0];
  }
  const files = fs.readdirSync(recordsDir);
  const candidates = [];
  for (const file of files) {
    if (file !== TEMPLATE_NAME && (file.startsWith("human_trial_record") && file.endsWith(".json"))) {
      const fullPath = path.join(recordsDir, file);
      if (fs.statSync(fullPath).isFile()) {
        candidates.push(fullPath);
      }
    }
  }
  if (candidates.length === 0) {
    return [null, 0];
  }
  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return [candidates[0], candidates.length];
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

function build_payload(recordPath, recordCount) {
  const issues = [];
  let validatorStatus = "NOT_RUN";
  let humanVerified = false;
  let recordStatus = "";
  let tester = "";
  let dateTime = "";
  let m6Status = "";
  let nextAction = "";

  if (recordPath === null) {
    m6Status = "WAITING_FOR_TRIAL_RECORD";
    nextAction = "Run npm run trial:start -- --tester Geonho, then complete the checklist after actual use.";
  } else {
    const [record, load_issues] = load_json(recordPath);
    issues.push(...load_issues);
    if (record === null) {
      validatorStatus = "FAIL";
      m6Status = "INVALID_RECORD";
      nextAction = "Fix or recreate the human trial record with npm run trial:start -- --tester Geonho.";
    } else {
      recordStatus = String(record.record_status || "");
      tester = record.run && record.run.tester ? String(record.run.tester) : "";
      dateTime = record.run && record.run.date_time ? String(record.run.date_time) : "";
      issues.push(...validate_trial(record));
      validatorStatus = issues.length === 0 ? "PASS" : "FAIL";
      humanVerified = record.human_verified === true && issues.length === 0;
      if (humanVerified) {
        m6Status = "HUMAN_VERIFIED";
        nextAction = "Use the validated record as M6 evidence; do not change it without rerunning trial:status."
      } else {
        m6Status = "NEEDS_RECORD_COMPLETION";
        nextAction = "Fill the missing checklist fields after real use, then run npm run trial:validate -- --record <record>.";
      }
    }
  }

  return {
    schema: "concept_master_human_trial_status.v1",
    generated_at: now_iso(),
    status: "PASS",
    m6_status: m6Status,
    record_path: recordPath || "",
    record_count: recordCount,
    record_status: recordStatus,
    tester: tester,
    date_time: dateTime,
    validator_status: validatorStatus,
    issue_count: issues.length,
    issues: issues,
    human_verified: humanVerified,
    next_action: nextAction,
    live_boundary: {
      publish_upload_delete_browser_write_opened: false,
      browser_or_vm_authority_opened: false,
      provider_default_changed: false,
      training_run_performed: false,
      git_stage_commit_push_performed: false
    }
  };
}

try {
  const { values } = parseArgs({
    options: {
      record: { type: 'string', default: '' },
      'records-dir': { type: 'string', default: path.join(ROOT, 'trial_records') }
    }
  });

  let recordPath = null;
  let recordCount = 0;

  if (values.record) {
    recordPath = resolve_path(values.record);
    recordCount = fs.existsSync(recordPath) ? 1 : 0;
  } else {
    const recordsDir = resolve_path(values['records-dir']);
    const [latest, count] = find_latest_record(recordsDir);
    recordPath = latest;
    recordCount = count;
  }

  const payload = build_payload(recordPath, recordCount);
  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
} catch (err) {
  console.error("Error executing status: " + err.message);
  process.exit(1);
}
