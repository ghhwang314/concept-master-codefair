import {
  attachGeneratedQualityGate,
  createTemplateProblem,
  validateGeneratedProblem,
  normalizeGeneratedProblem,
} from "./problems.js";

export async function generateSimilarProblem({
  sourceProblem,
  diagnosis = null,
  client,
  timeoutMs = 5000,
  sequence = 1,
} = {}) {
  if (!sourceProblem) throw new Error("sourceProblem is required");

  if (client?.generateSimilarProblem) {
    try {
      const generated = await withTimeout(client.generateSimilarProblem({ sourceProblem, diagnosis }), timeoutMs);
      const normalized = normalizeGeneratedProblem({
        sourceProblem,
        generated,
        sequence,
        generatedBy: generated.source === "manus_api" ? "manus_api" : "manus_api",
      });
      const gate = validateGeneratedProblem(normalized);
      if (gate.renderSafe) return normalized;

      return attachGeneratedQualityGate(
        createTemplateProblem({ sourceProblem, sequence }),
        [`Manus generated problem was not render-safe: ${gate.issues.join("; ")}`]
      );
    } catch {
      // Template fallback keeps the judged demo usable when Manus generation is unavailable.
    }
  }

  return createTemplateProblem({ sourceProblem, sequence });
}

function withTimeout(promise, timeoutMs) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error("generation_timeout")), timeoutMs);
    }),
  ]);
}
