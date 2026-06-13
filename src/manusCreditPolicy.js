const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export function isCreditSaverMode(env = process.env) {
  const raw = normalizeFlag(env.MANUS_CREDIT_SAVER_MODE);
  if (FALSE_VALUES.has(raw)) return false;
  return true;
}

export function isLiveManusDisabled(env = process.env) {
  return TRUE_VALUES.has(normalizeFlag(env.MANUS_LIVE_DISABLED));
}

export function shouldUseLiveManus({ requestedLiveAi = false, env = process.env } = {}) {
  if (isLiveManusDisabled(env)) return false;
  if (!isCreditSaverMode(env)) return true;
  return requestedLiveAi === true;
}

export function buildCreditPolicy({ requestedLiveAi = false, liveManusUsed = false, cacheHit = false, env = process.env } = {}) {
  return {
    creditSaverMode: isCreditSaverMode(env),
    liveDisabled: isLiveManusDisabled(env),
    requestedLiveAi: requestedLiveAi === true,
    liveManusUsed: liveManusUsed === true,
    cacheHit: cacheHit === true,
  };
}

function normalizeFlag(value) {
  return String(value ?? "").trim().toLowerCase();
}
