import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TEMP_DIR = path.join(DIST, 'package_temp');
const ZIP_ROOT_NAME = 'concept-master-codefair';
const ZIP_INNER_DIR = path.join(TEMP_DIR, ZIP_ROOT_NAME);

const INCLUDE_DIRS = [
  ".claude",
  "assets",
  "docs",
  "phases",
  "QA_EVIDENCE",
  "reports/api_environment",
  "reports/dtt_baseline",
  "reports/token_harness",
  "scripts",
  "src",
  "SUBMISSION_DOCS",
  "tests",
  "trial_records",
];

const INCLUDE_FILES = [
  ".env.example",
  "AGENTS.md",
  "CLAUDE.md",
  "GEONHO_PC_RUN_GUIDE.md",
  "GEONHO_HUMAN_TRIAL_CHECKLIST.md",
  "HANDOFF_GEONHO.md",
  "index.html",
  "LIVE_MANUS_VERIFICATION.md",
  "package.json",
  "README.md",
  "styles.css",
  "SUBMISSION_PACKAGE.md",
];

const EXCLUDED_NAMES = new Set([
  ".env",
  "node_modules",
  "dist",
  "__pycache__",
]);

const EXCLUDED_SUFFIXES = new Set([
  ".log",
  ".pyc",
]);

const REQUIRED_IN_ZIP = [
  "package.json",
  "README.md",
  "GEONHO_PC_RUN_GUIDE.md",
  "HANDOFF_GEONHO.md",
  "GEONHO_HUMAN_TRIAL_CHECKLIST.md",
  ".env.example",
  "index.html",
  "src/server.mjs",
  "src/app.js",
  "tests/concept-master.test.mjs",
  "reports/token_harness/latest_status.v1.json",
];

const FORBIDDEN_IN_ZIP = [
  ".env",
  "server.err.log",
  "server.out.log",
];

function now_stamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

function should_skip(filePath) {
  const rel = path.relative(ROOT, filePath);
  const parts = rel.split(path.sep);
  if (parts.some(part => EXCLUDED_NAMES.has(part))) return true;
  if (EXCLUDED_SUFFIXES.has(path.extname(filePath))) return true;
  return false;
}

function get_all_files(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      get_all_files(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function iter_package_files() {
  const files = [];
  for (const rel of INCLUDE_FILES) {
    const filePath = path.join(ROOT, rel);
    if (fs.existsSync(filePath) && !should_skip(filePath)) {
      files.push(filePath);
    }
  }
  for (const rel of INCLUDE_DIRS) {
    const dirPath = path.join(ROOT, rel);
    if (!fs.existsSync(dirPath)) continue;
    const all = get_all_files(dirPath);
    for (const filePath of all) {
      if (!should_skip(filePath)) {
        files.push(filePath);
      }
    }
  }
  return [...new Set(files)].sort();
}

function read_text_if_small(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size > 2_000_000) return "";
    const text = fs.readFileSync(filePath, 'utf8');
    return text.replace(/^\uFEFF/, '');
  } catch {
    return "";
  }
}

function scan_secret_like(files) {
  const hits = [];
  const secretKeyPattern = /sk-[A-Za-z0-9_-]{20,}/;
  const envAssignmentPattern = /^\s*MANUS_API_KEY\s*=\s*(.+?)\s*$/m;
  
  for (const filePath of files) {
    const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
    const text = read_text_if_small(filePath);
    if (!text) continue;
    if (secretKeyPattern.test(text)) {
      hits.push(`${rel}:sk-prefix`);
    }
    const match = envAssignmentPattern.exec(text);
    if (match) {
      const value = match[1].trim().replace(/^['"]|['"]$/g, '');
      if (rel === ".env.example") continue;
      if (["", "...", "replace_with_your_manus_api_key", "your_real_key_here"].includes(value)) continue;
      hits.push(`${rel}:MANUS_API_KEY_assignment`);
    }
  }
  return hits;
}

try {
  const stamp = now_stamp();
  fs.mkdirSync(DIST, { recursive: true });
  
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(ZIP_INNER_DIR, { recursive: true });

  const files = iter_package_files();
  
  for (const filePath of files) {
    const rel = path.relative(ROOT, filePath);
    const destPath = path.join(ZIP_INNER_DIR, rel);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(filePath, destPath);
  }

  const zipName = `concept-master-codefair-geonho-m6-handoff-${stamp}.zip`;
  const zipPath = path.join(DIST, zipName);

  console.log("Compressing files via PowerShell Compress-Archive...");
  const psCmd = `Compress-Archive -Path "${TEMP_DIR}/*" -DestinationPath "${zipPath}" -Force`;
  const result = spawnSync("powershell", ["-Command", psCmd], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`PowerShell Compress-Archive failed: ${result.stderr}`);
  }

  fs.rmSync(TEMP_DIR, { recursive: true, force: true });

  const relFiles = files.map(p => path.relative(ROOT, p).replace(/\\/g, '/'));
  const missing_required = REQUIRED_IN_ZIP.filter(rel => !relFiles.includes(rel));
  const forbidden_present = FORBIDDEN_IN_ZIP.filter(rel => relFiles.includes(rel));
  const secret_like_hits = scan_secret_like(files);

  const issues = [];
  issues.push(...missing_required.map(i => `missing_required:${i}`));
  issues.push(...forbidden_present.map(i => `forbidden_present:${i}`));
  issues.push(...secret_like_hits.map(i => `secret_like:${i}`));

  const payload = {
    schema: "concept_master_handoff_package_scan.v1",
    generated_at: new Date().toISOString(),
    status: issues.length === 0 ? "PASS" : "FAIL",
    zip_path: zipPath,
    zip_name: zipName,
    zip_size_bytes: fs.statSync(zipPath).size,
    file_count: relFiles.length,
    required_in_zip: REQUIRED_IN_ZIP,
    missing_required: missing_required,
    forbidden_in_zip: FORBIDDEN_IN_ZIP,
    forbidden_present: forbidden_present,
    secret_like_hits: secret_like_hits,
    issue_count: issues.length,
    issues: issues,
    human_verified: false,
    live_boundary: {
      publish_upload_delete_browser_write_opened: false,
      browser_or_vm_authority_opened: false,
      provider_default_changed: false,
      training_run_performed: false,
      git_stage_commit_push_performed: false
    }
  };

  const scanPath = path.join(DIST, "package_scan.v1.json");
  fs.writeFileSync(scanPath, JSON.stringify(payload, null, 2) + "\n", 'utf8');
  console.log(JSON.stringify(payload, null, 2));
  process.exit(issues.length === 0 ? 0 : 1);
} catch (err) {
  console.error("Error executing package_handoff: " + err.message);
  process.exit(1);
}
