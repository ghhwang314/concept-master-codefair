import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export function loadEnvFile(root, filename = ".env") {
  const envPath = join(root, filename);
  if (!existsSync(envPath)) return false;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = unwrapValue(rawValue.trim());
  }

  return true;
}

function unwrapValue(value) {
  if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  return value;
}
