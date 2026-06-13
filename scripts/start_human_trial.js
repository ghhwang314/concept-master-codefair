import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const TEMPLATE = path.join(ROOT, "trial_records", "human_trial_record.template.v1.json");

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

function filename_stamp(value) {
  const cleaned = value.trim().replace(/[^0-9A-Za-z가-힣_-]+/g, '_');
  return cleaned.replace(/^_+|_+$/g, '') || "trial";
}

function unique_path(outputDir, dateTime, label) {
  const stamp = filename_stamp(dateTime.replace(/:/g, '').replace(/\+/g, '_').replace(/-/g, '').replace(/T/g, '_'));
  const suffix = label ? `_${filename_stamp(label)}` : "";
  let candidate = path.join(outputDir, `human_trial_record_${stamp}${suffix}.v1.json`);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(outputDir, `human_trial_record_${stamp}${suffix}_${counter}.v1.json`);
    counter++;
  }
  return candidate;
}

try {
  const { values } = parseArgs({
    options: {
      tester: { type: 'string', default: 'Geonho' },
      'date-time': { type: 'string', default: now_iso() },
      label: { type: 'string', default: 'human-trial' },
      'output-dir': { type: 'string', default: path.join(ROOT, 'trial_records') },
      port: { type: 'string', default: '4173' }
    }
  });

  let outputDir = values['output-dir'];
  if (!path.isAbsolute(outputDir)) {
    outputDir = path.resolve(ROOT, outputDir);
  }
  fs.mkdirSync(outputDir, { recursive: true });

  const templateText = fs.readFileSync(TEMPLATE, 'utf8').replace(/^\uFEFF/, '');
  const record = JSON.parse(templateText);
  record.record_status = "RECORDED";
  record.human_verified = false;
  record.run.date_time = values['date-time'];
  record.run.tester = values.tester;

  const recordPath = unique_path(outputDir, values['date-time'], values.label || values.tester);
  fs.writeFileSync(recordPath, JSON.stringify(record, null, 2) + "\n", 'utf8');

  const relativePath = path.relative(ROOT, recordPath);
  const validate_command = [
    "npm",
    "run",
    "trial:validate",
    "--",
    "--record",
    relativePath.replace(/\\/g, '/'),
  ];

  const payload = {
    schema: "concept_master_human_trial_start_packet.v1",
    status: "PASS",
    record_path: recordPath,
    record_status: record.record_status,
    human_verified: false,
    app_url: `http://localhost:${values.port}`,
    server_command: ["npm", "start"],
    server_environment: {
      PORT: String(values.port),
      MANUS_CREDIT_SAVER_MODE: "true"
    },
    checklist_path: path.join(ROOT, "GEONHO_HUMAN_TRIAL_CHECKLIST.md"),
    trial_steps: [
      "Run npm test and record PASS or FAIL.",
      "Run npm start with MANUS_CREDIT_SAVER_MODE=true.",
      "Open the app URL and run the 30-second demo once.",
      "Fill this JSON record from the checklist after actual use.",
      "Run the validate_command and keep human_verified false unless it passes."
    ],
    validate_command: validate_command,
    next_action: "Start the app, have Geonho or the owner use it once, fill the record, then run validate_command.",
    live_boundary: {
      publish_upload_delete_browser_write_opened: false,
      browser_or_vm_authority_opened: false,
      provider_default_changed: false,
      training_run_performed: false,
      git_stage_commit_push_performed: false
    }
  };

  console.log(JSON.stringify(payload, null, 2));
  process.exit(0);
} catch (err) {
  console.error("Error executing start: " + err.message);
  process.exit(1);
}
