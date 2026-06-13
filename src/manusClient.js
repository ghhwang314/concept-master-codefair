export class ManusAiClient {
  constructor({
    baseUrl = process.env.MANUS_API_BASE_URL || process.env.MANUS_API_URL || "https://api.manus.ai",
    apiKey = process.env.MANUS_API_KEY,
    agentProfile = process.env.MANUS_AGENT_PROFILE || "manus-1.6-lite",
    fetchImpl = globalThis.fetch,
    requestTimeoutMs = Number(process.env.MANUS_REQUEST_TIMEOUT_MS || 15_000),
    pollIntervalMs = Number(process.env.MANUS_POLL_INTERVAL_MS || 2_000),
    maxPolls = Number(process.env.MANUS_MAX_POLLS || 30),
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
    this.agentProfile = agentProfile;
    this.fetchImpl = fetchImpl;
    this.requestTimeoutMs = requestTimeoutMs;
    this.pollIntervalMs = pollIntervalMs;
    this.maxPolls = maxPolls;
  }

  async diagnose(payload) {
    if (!this.apiKey) {
      throw new Error("MANUS_API_KEY is not configured");
    }

    const created = await this.postJson("/v2/task.create", {
      title: "ConceptMaster 오답 진단",
      hide_in_task_list: true,
      share_visibility: "private",
      agent_profile: this.agentProfile,
      message: {
        content: [
          {
            type: "text",
            text: buildDiagnosisPrompt(payload),
          },
        ],
      },
      structured_output_schema: diagnosisSchema,
    });

    if (!created?.ok || !created?.task_id) {
      throw new Error("Manus task.create did not return task_id");
    }

    return this.pollDiagnosis(created.task_id);
  }

  async generateSimilarProblem(payload) {
    if (!this.apiKey) {
      throw new Error("MANUS_API_KEY is not configured");
    }

    const created = await this.postJson("/v2/task.create", {
      title: "ConceptMaster 같은 개념 유사문항 생성",
      hide_in_task_list: true,
      share_visibility: "private",
      agent_profile: this.agentProfile,
      message: {
        content: [
          {
            type: "text",
            text: buildGenerationPrompt(payload),
          },
        ],
      },
      structured_output_schema: generatedProblemSchema,
    });

    if (!created?.ok || !created?.task_id) {
      throw new Error("Manus task.create did not return task_id");
    }

    return this.pollGeneratedProblem(created.task_id);
  }

  async postJson(path, body) {
    const response = await this.request(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return response.json();
  }

  async getJson(path, query = {}) {
    const url = new URL(`${this.baseUrl}${path}`);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const response = await this.request(url, {
      method: "GET",
      headers: { "x-manus-api-key": this.apiKey },
    });
    return response.json();
  }

  async request(url, options) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    try {
      const response = await this.fetchImpl(url, { ...options, signal: controller.signal });
      if (!response.ok) {
        const error = new Error(`Manus API failed: ${response.status}`);
        error.code = "manus_api_http_error";
        error.status = response.status;
        throw error;
      }
      return response;
    } finally {
      clearTimeout(timeout);
    }
  }

  headers() {
    return {
      "content-type": "application/json",
      "x-manus-api-key": this.apiKey,
    };
  }

  async startDiagnosis(payload) {
    if (!this.apiKey) {
      throw new Error("MANUS_API_KEY is not configured");
    }

    const created = await this.postJson("/v2/task.create", {
      title: "ConceptMaster 오답 진단",
      hide_in_task_list: true,
      share_visibility: "private",
      agent_profile: this.agentProfile,
      message: {
        content: [
          {
            type: "text",
            text: buildDiagnosisPrompt(payload),
          },
        ],
      },
      structured_output_schema: diagnosisSchema,
    });

    if (!created?.ok || !created?.task_id) {
      throw new Error("Manus task.create did not return task_id");
    }

    return created.task_id;
  }

  async checkDiagnosis(taskId) {
    const data = await this.getJson("/v2/task.listMessages", {
      task_id: taskId,
      order: "desc",
      limit: 20,
    });
    const diagnosis = parseDiagnosis(data);
    if (diagnosis) return { ...diagnosis, source: "manus_api", taskId };
    throwIfStructuredOutputFailed(data, "diagnosis");

    const status = latestAgentStatus(data?.messages);
    if (status === "error") throw new Error("Manus task ended with error");
    if (status === "waiting") throw new Error("Manus task is waiting for user input");
    if (status === "stopped") throw new Error("Manus task stopped without structured diagnosis");

    return null; // Still running
  }

  async pollDiagnosis(taskId) {
    for (let attempt = 0; attempt < this.maxPolls; attempt += 1) {
      const diagnosis = await this.checkDiagnosis(taskId);
      if (diagnosis) return diagnosis;
      await sleep(this.pollIntervalMs);
    }
    throw new Error("Manus task timed out before structured diagnosis");
  }

  async startGeneration(payload) {
    if (!this.apiKey) {
      throw new Error("MANUS_API_KEY is not configured");
    }

    const created = await this.postJson("/v2/task.create", {
      title: "ConceptMaster 같은 개념 유사문항 생성",
      hide_in_task_list: true,
      share_visibility: "private",
      agent_profile: this.agentProfile,
      message: {
        content: [
          {
            type: "text",
            text: buildGenerationPrompt(payload),
          },
        ],
      },
      structured_output_schema: generatedProblemSchema,
    });

    if (!created?.ok || !created?.task_id) {
      throw new Error("Manus task.create did not return task_id");
    }

    return created.task_id;
  }

  async checkGeneration(taskId) {
    const data = await this.getJson("/v2/task.listMessages", {
      task_id: taskId,
      order: "desc",
      limit: 20,
    });
    const problem = parseGeneratedProblem(data);
    if (problem) return { ...problem, source: "manus_api", taskId };
    throwIfStructuredOutputFailed(data, "generated problem");

    const status = latestAgentStatus(data?.messages);
    if (status === "error") throw new Error("Manus task ended with error");
    if (status === "waiting") throw new Error("Manus task is waiting for user input");
    if (status === "stopped") throw new Error("Manus task stopped without structured generated problem");

    return null; // Still running
  }

  async pollGeneratedProblem(taskId) {
    for (let attempt = 0; attempt < this.maxPolls; attempt += 1) {
      const problem = await this.checkGeneration(taskId);
      if (problem) return problem;
      await sleep(this.pollIntervalMs);
    }
    throw new Error("Manus task timed out before structured generated problem");
  }
}

const diagnosisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reason: {
      type: "string",
      enum: ["concept_misunderstanding", "calculation_error", "problem_interpretation", "memory_gap"],
    },
    conceptGap: { type: "string" },
    evidence: { type: "string" },
    recommendation: { type: "string" },
    nextAction: { type: "string", enum: ["same_concept_retry", "review_later", "teacher_check"] },
    confidence: { type: "number" },
  },
  required: ["reason", "conceptGap", "evidence", "recommendation", "nextAction", "confidence"],
};

const generatedProblemSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    conceptId: { type: "string" },
    difficulty: { type: "string", enum: ["bronze", "silver", "gold"] },
    question: { type: "string" },
    options: {
      type: "array",
      items: { type: "string" },
    },
    answer: { type: "integer" },
    explanation: { type: "string" },
    hint: { type: "string" },
    sourceReason: { type: "string" },
  },
  required: ["conceptId", "difficulty", "question", "options", "answer", "explanation", "hint", "sourceReason"],
};

function buildDiagnosisPrompt(payload) {
  return [
    "너는 ConceptMaster의 AI 오답 코치다.",
    "학생 답안 데이터를 보고 같은 개념 실수를 줄이기 위한 짧은 진단을 만든다.",
    "정답을 바로 설명하는 것보다 왜 같은 개념을 반복해서 틀렸는지, 다음에 어떤 복습을 해야 하는지를 판단한다.",
    "반드시 structured_output_schema 형식으로만 응답한다.",
    "",
    `문제 ID: ${payload.problem.id}`,
    `과목: ${payload.problem.subjectKo}`,
    `개념: ${payload.problem.conceptKo}`,
    `문항: ${payload.problem.question}`,
    `보기: ${payload.problem.options.map((option, index) => `${index}. ${option}`).join(" / ")}`,
    `학생 선택 index: ${payload.selectedAnswer}`,
    `학생 선택 보기: ${payload.selectedOption}`,
    `정답 index: ${payload.correctAnswer}`,
    `정답 보기: ${payload.correctOption}`,
    `해설: ${payload.problem.explanation}`,
  ].join("\n");
}

function buildGenerationPrompt(payload) {
  const sourceProblem = payload.sourceProblem;
  const diagnosis = payload.diagnosis || {};

  // Adjust difficulty based on mistake reason
  let adjustedDifficulty = "silver";
  let difficultyExplanation = "";

  if (diagnosis.reason === "concept_misunderstanding") {
    adjustedDifficulty = "bronze";
    difficultyExplanation = "Lowered to BRONZE because the student did not understand the core concept. Provide a simpler, foundational same-concept question to reinforce basics.";
  } else if (diagnosis.reason === "memory_gap") {
    adjustedDifficulty = "bronze";
    difficultyExplanation = "Lowered to BRONZE because the student forgot essential prior knowledge. Keep calculations minimal and focus on basic definitions.";
  } else if (diagnosis.reason === "problem_interpretation") {
    adjustedDifficulty = "silver";
    difficultyExplanation = "Maintained at SILVER but make the wording extremely clear and simplify any distracting details to check if they can match key parameters.";
  } else if (diagnosis.reason === "calculation_error") {
    adjustedDifficulty = sourceProblem.level === "gold" ? "gold" : "silver";
    difficultyExplanation = "Kept at SILVER or GOLD because the student understood the concept but made a minor calculation typo. Maintain challenge to test accuracy.";
  } else {
    adjustedDifficulty = sourceProblem.level || "silver";
    difficultyExplanation = "Determined based on baseline difficulty.";
  }

  return [
    "You are ConceptMaster's AI same concept problem generator.",
    "Create one new Korean multiple-choice problem that checks the same concept without copying the original numbers exactly.",
    "Return only the structured_output_schema fields.",
    "",
    `Original question ID: ${sourceProblem.id}`,
    `Subject: ${sourceProblem.subjectKo}`,
    `Concept ID: ${sourceProblem.concept}`,
    `Concept: ${sourceProblem.conceptKo}`,
    `Original Difficulty: ${sourceProblem.level}`,
    `Mistake Reason / Wrong Answer Type: ${diagnosis.reason || "concept_misunderstanding"}`,
    `Concept Gap Detail: ${diagnosis.conceptGap || sourceProblem.conceptKo}`,
    `Target Difficulty (Adjusted based on Mistake Type): ${adjustedDifficulty}`,
    `Difficulty Adjust Explanation: ${difficultyExplanation}`,
    "",
    "Guidelines:",
    `1. You MUST generate the new question matching the Target Difficulty: ${adjustedDifficulty}.`,
    "2. Ensure the question is written in natural, student-friendly Korean.",
    "3. Return only the structured_output_schema fields.",
    `Original question: ${sourceProblem.question}`,
    `Original options: ${sourceProblem.options.map((option, index) => `${index}. ${option}`).join(" / ")}`,
    `Original answer index: ${sourceProblem.answer}`,
    `Original explanation: ${sourceProblem.explanation}`,
    "The answer field must be the zero-based index of the correct option.",
    "The sourceReason must explain why this problem is a same concept retry.",
  ].join("\n");
}

function parseDiagnosis(data) {
  const value = parseStructuredValue(data);
  if (value?.reason) return value;
  return null;
}

function parseGeneratedProblem(data) {
  const value = parseStructuredValue(data);
  if (value?.question && Array.isArray(value.options)) return value;
  return null;
}

function parseStructuredValue(data) {
  const structuredResult = latestStructuredOutputResult(data);
  if (structuredResult?.success && structuredResult.value) return structuredResult.value;

  const raw = data?.diagnosis || data?.output || data?.choices?.[0]?.message?.content || data?.assistant_message?.content;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return raw || null;
}

function throwIfStructuredOutputFailed(data, label) {
  const structuredResult = latestStructuredOutputResult(data);
  if (!structuredResult || structuredResult.success !== false) return;
  const error = new Error(`Manus structured output failed for ${label}`);
  error.code = "structured_output_failed";
  throw error;
}

function latestStructuredOutputResult(data) {
  return data?.messages?.find((message) =>
    message.type === "structured_output_result" && message.structured_output_result
  )?.structured_output_result;
}

function latestAgentStatus(messages = []) {
  return messages.find((message) => message.type === "status_update")?.status_update?.agent_status;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
